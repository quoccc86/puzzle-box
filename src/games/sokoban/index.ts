import type { Game } from '../../core/Game';
import { createCanvas } from '../../core/canvas';
import { keyToDirection } from '../../core/input';
import { registerGame } from '../../core/registry';
import { applyMove, initialState, isSolved } from './logic';
import { LEVELS } from './levels';
import { TILE, levelSize, renderLevel } from './render';

const START_LEVEL = 0;

const WIN_DELAY_MS = 1000;

interface Mounted {
  onKey: (event: KeyboardEvent) => void;
  destroyCanvas: () => void;
  container: HTMLElement;
  cancelLevelTimer: () => void;
}

let mounted: Mounted | null = null;

function teardown(game: Mounted): void {
  window.removeEventListener('keydown', game.onKey);
  game.cancelLevelTimer();
  game.destroyCanvas();
  game.container.replaceChildren();
}

function build(el: HTMLElement): Mounted {
  let campaignIndex = START_LEVEL;
  let state = initialState(campaignIndex);
  let campaignComplete = false;
  let levelTimer: ReturnType<typeof setTimeout> | null = null;
  let solvedBannerText = '';
  const undoStack: typeof state[] = [];
  const redoStack: typeof state[] = [];

  const wrap = document.createElement('div');
  wrap.className = 'sokoban';

  const { cols, rows } = levelSize(state);
  const { canvas, ctx, destroy } = createCanvas(el, cols * TILE, rows * TILE);

  const levelLabel = document.createElement('p');
  levelLabel.className = 'sokoban-level';
  levelLabel.dataset.testid = 'level';
  levelLabel.dataset.index = String(campaignIndex);
  levelLabel.textContent = `Level ${campaignIndex + 1} / ${LEVELS.length}`;

  const instructions = document.createElement('p');
  instructions.className = 'sokoban-instructions';
  instructions.textContent = 'Push every box onto a target. Arrows/WASD move; Z undo, Y redo.';

  const hud = document.createElement('div');
  hud.className = 'sokoban-hud';

  const moves = document.createElement('span');
  moves.dataset.testid = 'moves';
  moves.textContent = 'Moves: 0';

  const undoButton = document.createElement('button');
  undoButton.type = 'button';
  undoButton.dataset.testid = 'undo';
  undoButton.textContent = 'Undo';
  undoButton.className = 'sokoban-restart';
  undoButton.disabled = true;

  const redoButton = document.createElement('button');
  redoButton.type = 'button';
  redoButton.dataset.testid = 'redo';
  redoButton.textContent = 'Redo';
  redoButton.className = 'sokoban-restart';
  redoButton.disabled = true;

  const restart = document.createElement('button');
  restart.type = 'button';
  restart.dataset.testid = 'restart';
  restart.textContent = 'Restart';
  restart.className = 'sokoban-restart';

  hud.append(moves, undoButton, redoButton, restart);
  wrap.append(hud, canvas);

  const banner = document.createElement('p');
  banner.className = 'sokoban-win';
  banner.dataset.testid = 'win';
  banner.hidden = true;
  banner.textContent = 'Level solved!';

  const replayButton = document.createElement('button');
  replayButton.type = 'button';
  replayButton.dataset.testid = 'replay';
  replayButton.className = 'sokoban-restart';
  replayButton.textContent = 'Play campaign again';
  replayButton.hidden = true;

  const campaignCompleteBanner = document.createElement('p');
  campaignCompleteBanner.className = 'sokoban-win';
  campaignCompleteBanner.dataset.testid = 'campaign-complete';
  campaignCompleteBanner.hidden = true;
  campaignCompleteBanner.textContent = 'Campaign complete!';

  el.replaceChildren(levelLabel, instructions, wrap, banner, campaignCompleteBanner, replayButton);

  function clearLevelTimer(): void {
    if (levelTimer !== null) {
      clearTimeout(levelTimer);
      levelTimer = null;
    }
  }

  function syncControls(): void {
    moves.textContent = `Moves: ${state.moves}`;
    levelLabel.dataset.index = String(campaignIndex);
    levelLabel.textContent = campaignComplete
      ? 'Campaign complete!'
      : `Level ${campaignIndex + 1} / ${LEVELS.length}`;
    banner.textContent = solvedBannerText || 'Level solved!';
    banner.hidden = !isSolved(state) || campaignComplete;
    undoButton.disabled = undoStack.length === 0;
    redoButton.disabled = redoStack.length === 0;
    campaignCompleteBanner.hidden = !campaignComplete;
    replayButton.hidden = !campaignComplete;
  }

  function scheduleLevelAdvance(): void {
    if (!isSolved(state) || levelTimer !== null || campaignComplete) return;
    solvedBannerText = campaignIndex === LEVELS.length - 1
      ? 'All five levels complete!'
      : `Level ${campaignIndex + 1} complete!`;
    syncControls();
    levelTimer = setTimeout(() => {
      levelTimer = null;
      if (campaignIndex === LEVELS.length - 1) {
        campaignComplete = true;
        undoStack.length = 0;
        redoStack.length = 0;
        syncControls();
        return;
      }
      campaignIndex += 1;
      state = initialState(campaignIndex);
      undoStack.length = 0;
      redoStack.length = 0;
      solvedBannerText = '';
      draw();
    }, WIN_DELAY_MS);
  }

  function draw(): void {
    if (!campaignComplete) renderLevel(ctx, state);
    syncControls();
    scheduleLevelAdvance();
  }

  function startCampaign(): void {
    clearLevelTimer();
    campaignIndex = START_LEVEL;
    campaignComplete = false;
    state = initialState(campaignIndex);
    undoStack.length = 0;
    redoStack.length = 0;
    solvedBannerText = '';
    draw();
  }

  function handleSolved(): void {
    if (levelTimer !== null || campaignComplete) return;
    solvedBannerText = campaignIndex === LEVELS.length - 1
      ? 'All five levels complete!'
      : `Level ${campaignIndex + 1} complete!`;
    syncControls();
    scheduleLevelAdvance();
  }

  function undoMove(): void {
    if (campaignComplete) return;
    clearLevelTimer();
    solvedBannerText = '';
    const previous = undoStack.pop();
    if (previous === undefined) return;
    redoStack.push(state);
    state = previous;
    draw();
  }

  function redoMove(): void {
    if (campaignComplete) return;
    const next = redoStack.pop();
    if (next === undefined) return;
    undoStack.push(state);
    state = next;
    draw();
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'z') {
      undoMove();
      return;
    }
    if (event.key.toLowerCase() === 'y') {
      redoMove();
      return;
    }
    if (levelTimer !== null || campaignComplete) return;

    const dir = keyToDirection(event.key);
    if (dir === null) return;
    const next = applyMove(state, dir);
    if (next === null) return;
    undoStack.push(state);
    redoStack.length = 0;
    state = next;
    draw();
    if (isSolved(state)) handleSolved();
  }

  function restartLevel(): void {
    clearLevelTimer();
    campaignComplete = false;
    state = initialState(campaignIndex);
    undoStack.length = 0;
    redoStack.length = 0;
    solvedBannerText = '';
    draw();
  }

  window.addEventListener('keydown', onKey);
  undoButton.addEventListener('click', undoMove);
  redoButton.addEventListener('click', redoMove);
  restart.addEventListener('click', restartLevel);
  replayButton.addEventListener('click', startCampaign);
  draw();

  return {
    onKey,
    destroyCanvas: destroy,
    container: el,
    cancelLevelTimer: clearLevelTimer,
  };
}

export const sokoban: Game = {
  id: 'sokoban',
  name: 'Sokoban',
  mount(el: HTMLElement): void {
    if (mounted !== null) teardown(mounted);
    mounted = build(el);
  },
  unmount(): void {
    if (mounted === null) return;
    teardown(mounted);
    mounted = null;
  },
};

registerGame(sokoban);
