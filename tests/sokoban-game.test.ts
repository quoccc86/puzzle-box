import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sokoban } from '../src/games/sokoban';
import { TILE } from '../src/games/sokoban/render';

function setup() {
  const stage = document.createElement('div');
  document.body.append(stage);
  sokoban.mount(stage);
  return {
    stage,
    canvas: () => stage.querySelector('canvas')!,
    moves: () => stage.querySelector('[data-testid="moves"]')!,
    restart: () => stage.querySelector('[data-testid="restart"]') as HTMLButtonElement,
    undo: () => stage.querySelector('[data-testid="undo"]') as HTMLButtonElement,
    redo: () => stage.querySelector('[data-testid="redo"]') as HTMLButtonElement,
    banner: () => stage.querySelector('[data-testid="win"]') as HTMLElement | null,
    press: (key: string) =>
      window.dispatchEvent(new KeyboardEvent('keydown', { key })),
  };
}

describe('sokoban game', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    sokoban.unmount();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('mounts a canvas sized to the level', () => {
    const { canvas } = setup();
    const element = canvas();
    expect(element).not.toBeNull();
    expect(element.width).toBe(7 * TILE);
    expect(element.height).toBe(5 * TILE);
  });

  it('starts with a zero move counter and a hidden win banner', () => {
    const { moves, banner } = setup();
    expect(moves().textContent).toBe('Moves: 0');
    expect(banner()!.hidden).toBe(true);
  });

  it('increments the counter on a valid key press', () => {
    const { moves, press } = setup();
    press('ArrowLeft');
    expect(moves().textContent).toBe('Moves: 1');
  });

  it('ignores keys that are not mapped to a direction', () => {
    const { moves, press } = setup();
    press('Enter');
    press('q');
    expect(moves().textContent).toBe('Moves: 0');
  });

  it('undo and redo buttons start disabled when their stacks are empty', () => {
    const { undo, redo } = setup();
    expect(undo().disabled).toBe(true);
    expect(redo().disabled).toBe(true);
  });

  it('undo restores the box position and move counter', () => {
    const { moves, press, undo, banner } = setup();
    press('ArrowRight');
    expect(moves().textContent).toBe('Moves: 1');
    expect(banner()!.hidden).toBe(false);
    undo().click();
    expect(moves().textContent).toBe('Moves: 0');
    expect(banner()!.hidden).toBe(true);
  });

  it('redo reapplies the undone push', () => {
    const { moves, press, undo, redo, banner } = setup();
    press('ArrowRight');
    undo().click();
    redo().click();
    expect(moves().textContent).toBe('Moves: 1');
    expect(banner()!.hidden).toBe(false);
  });

  it('undo restores a state before a non-pushing move', () => {
    const { moves, press, undo } = setup();
    press('ArrowLeft');
    undo().click();
    expect(moves().textContent).toBe('Moves: 0');
    expect(undo().disabled).toBe(true);
  });

  it('redo history is cleared by a new move', () => {
    const { moves, press, undo, redo } = setup();
    press('ArrowLeft');
    undo().click();
    press('ArrowRight');
    expect(moves().textContent).toBe('Moves: 1');
    expect(redo().disabled).toBe(true);
  });

  it('restart clears both undo and redo history', () => {
    const { moves, press, undo, redo, restart } = setup();
    press('ArrowRight');
    press('ArrowUp');
    undo().click();
    expect(redo().disabled).toBe(false);
    restart().click();
    expect(moves().textContent).toBe('Moves: 0');
    expect(undo().disabled).toBe(true);
    expect(redo().disabled).toBe(true);
  });

  it('supports Z and Y keyboard shortcuts for undo and redo', () => {
    const { moves, press, banner } = setup();
    press('ArrowRight');
    press('z');
    expect(moves().textContent).toBe('Moves: 0');
    expect(banner()!.hidden).toBe(true);
    press('y');
    expect(moves().textContent).toBe('Moves: 1');
    expect(banner()!.hidden).toBe(false);
  });

  it('does not let shortcuts mutate Sokoban after navigating away', () => {
    const { stage, press } = setup();
    sokoban.unmount();
    press('ArrowRight');
    press('z');
    press('y');
    expect(stage.childElementCount).toBe(0);
  });

  it('undoes a sequence back to its initial state', () => {
    const { moves, press, undo } = setup();
    press('ArrowRight');
    press('ArrowUp');
    press('ArrowLeft');
    undo().click();
    undo().click();
    undo().click();
    expect(moves().textContent).toBe('Moves: 0');
    expect(undo().disabled).toBe(true);
  });

  it('redoes a sequence in order', () => {
    const { moves, press, undo, redo } = setup();
    press('ArrowRight');
    press('ArrowUp');
    press('ArrowLeft');
    undo().click();
    undo().click();
    undo().click();
    redo().click();
    redo().click();
    redo().click();
    expect(moves().textContent).toBe('Moves: 3');
    expect(redo().disabled).toBe(true);
  });

  it('creates a new history branch after undo', () => {
    const { moves, press, undo, redo } = setup();
    press('ArrowRight');
    undo().click();
    press('ArrowLeft');
    expect(moves().textContent).toBe('Moves: 1');
    expect(redo().disabled).toBe(true);
  });

  it('rejected moves do not pollute the undo history', () => {
    const { moves, press, undo, redo } = setup();
    press('ArrowRight');
    undo().click();
    press('ArrowLeft');
    press('ArrowLeft');
    expect(moves().textContent).toBe('Moves: 1');
    expect(redo().disabled).toBe(true);
  });

  it('undoes a box push without losing its target relationship', () => {
    const { press, undo, redo, banner } = setup();
    press('ArrowRight');
    expect(banner()!.hidden).toBe(false);
    undo().click();
    expect(banner()!.hidden).toBe(true);
    redo().click();
    expect(banner()!.hidden).toBe(false);
  });

  it('keeps action buttons disabled when undo or redo has nothing to do', () => {
    const { moves, undo, redo } = setup();
    undo().click();
    redo().click();
    expect(moves().textContent).toBe('Moves: 0');
    expect(undo().disabled).toBe(true);
    expect(redo().disabled).toBe(true);
  });

  it('undo state is isolated between remounts', () => {
    const firstStage = document.createElement('div');
    const secondStage = document.createElement('div');
    document.body.append(firstStage, secondStage);
    sokoban.mount(firstStage);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    sokoban.mount(secondStage);
    const secondMoves = secondStage.querySelector('[data-testid="moves"]')!;
    expect(secondMoves.textContent).toBe('Moves: 0');
    expect((secondStage.querySelector('[data-testid="undo"]') as HTMLButtonElement).disabled).toBe(true);
  });


  it('restart resets the counter and redraws the level', () => {
    const { canvas, moves, restart, press } = setup();
    const ctx = canvas().getContext('2d')!;
    const fillRect = vi.mocked(ctx.fillRect);
    const drawsBeforeRestart = fillRect.mock.calls.length;

    press('ArrowLeft');
    restart().click();

    expect(moves().textContent).toBe('Moves: 0');
    expect(fillRect.mock.calls.length).toBeGreaterThan(drawsBeforeRestart);
  });

  it('removes the previous key listener when mounting again', () => {
    const firstStage = document.createElement('div');
    const secondStage = document.createElement('div');
    document.body.append(firstStage, secondStage);
    sokoban.mount(firstStage);
    const firstMoves = firstStage.querySelector('[data-testid="moves"]')!;

    sokoban.mount(secondStage);
    const secondMoves = secondStage.querySelector('[data-testid="moves"]')!;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));

    expect(firstMoves.textContent).toBe('Moves: 0');
    expect(secondMoves.textContent).toBe('Moves: 1');
  });

  it('unmount clears the stage and removes its key listener', () => {
    const { stage } = setup();
    const removeListener = vi.spyOn(window, 'removeEventListener');

    sokoban.unmount();

    expect(stage.childElementCount).toBe(0);
    expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('unmount is safe when nothing is mounted', () => {
    sokoban.unmount();
    expect(document.body.childElementCount).toBe(0);
  });

  it('shows the win banner once every box is on a target', () => {
    const { banner, press } = setup();
    // Level 1 is `# @$. #`: the box sits immediately right of the target, so a
    // single rightward push lands it on the target and solves the level.
    press('ArrowRight');
    expect(banner()!.hidden).toBe(false);
  });

  it('keeps the banner hidden while a box is still off its target', () => {
    const { banner, press } = setup();
    // Pushing twice drives the box past the target to a non-target cell.
    press('ArrowRight');
    press('ArrowRight');
    expect(banner()!.hidden).toBe(true);
  });

  it('unmount clears the stage and stops handling keys', () => {
    const { stage, moves, press } = setup();
    const counter = moves();
    expect(counter.textContent).toBe('Moves: 0');

    sokoban.unmount();
    expect(stage.childElementCount).toBe(0);

    // The listener is gone, so this key must not touch the detached counter.
    press('ArrowLeft');
    expect(counter.textContent).toBe('Moves: 0');
  });
});
