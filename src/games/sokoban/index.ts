import type { Game } from '../../core/Game';
import { createCanvas } from '../../core/canvas';
import { keyToDirection } from '../../core/input';
import { registerGame } from '../../core/registry';
import { applyMove, initialState, isSolved } from './logic';
import { TILE, levelSize, renderLevel } from './render';

const START_LEVEL = 0;

interface Mounted {
  onKey: (event: KeyboardEvent) => void;
  destroyCanvas: () => void;
  container: HTMLElement;
}

let mounted: Mounted | null = null;

function teardown(game: Mounted): void {
  window.removeEventListener('keydown', game.onKey);
  game.destroyCanvas();
  game.container.replaceChildren();
}

function build(el: HTMLElement): Mounted {
  let state = initialState(START_LEVEL);
  const undoStack: typeof state[] = [];
  const redoStack: typeof state[] = [];

  const wrap = document.createElement('div');
  wrap.className = 'sokoban';

  const { cols, rows } = levelSize(state);
  const { canvas, ctx, destroy } = createCanvas(el, cols * TILE, rows * TILE);

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

  el.replaceChildren(wrap, banner);

  function draw(): void {
    renderLevel(ctx, state);
    moves.textContent = `Moves: ${state.moves}`;
    banner.hidden = !isSolved(state);
    undoButton.disabled = undoStack.length === 0;
    redoButton.disabled = redoStack.length === 0;
  }

  function undoMove(): void {
    const previous = undoStack.pop();
    if (previous === undefined) return;
    redoStack.push(state);
    state = previous;
    draw();
  }

  function redoMove(): void {
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

    const dir = keyToDirection(event.key);
    if (dir === null) return;
    const next = applyMove(state, dir);
    if (next === null) return;
    undoStack.push(state);
    redoStack.length = 0;
    state = next;
    draw();
  }

  function restartLevel(): void {
    state = initialState(START_LEVEL);
    undoStack.length = 0;
    redoStack.length = 0;
    draw();
  }

  window.addEventListener('keydown', onKey);
  undoButton.addEventListener('click', undoMove);
  redoButton.addEventListener('click', redoMove);
  restart.addEventListener('click', restartLevel);
  draw();

  return {
    onKey,
    destroyCanvas: destroy,
    container: el,
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
