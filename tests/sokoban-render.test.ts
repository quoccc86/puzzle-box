import { describe, expect, it, vi } from 'vitest';
import { TILE, levelSize, renderLevel } from '../src/games/sokoban/render';
import { parseLevel } from '../src/games/sokoban/parse';

function fakeCtx() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    font: '',
    textAlign: '',
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('levelSize', () => {
  it('reports the map dimensions', () => {
    const state = parseLevel(['#####', '#@$.#', '#####'].join('\n'));
    expect(levelSize(state)).toEqual({ cols: 5, rows: 3 });
    expect(TILE).toBe(32);
  });
});

describe('renderLevel', () => {
  it('draws one full-tile rect for every wall, box, and the player', () => {
    const state = parseLevel(['#####', '#@$.#', '#####'].join('\n'));
    const ctx = fakeCtx();
    renderLevel(ctx, state);
    const rects = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    // fillRect is called as (x, y, width, height)
    const fullTiles = rects.filter(([, , w, h]) => w === TILE && h === TILE);
    // 3 floor cells + 12 walls + 1 box + 1 player
    expect(fullTiles.length).toBe(17);
    for (const [x, y] of fullTiles) {
      expect(x % TILE).toBe(0);
      expect(y % TILE).toBe(0);
    }
  });

  it('draws the target marker inset inside its tile', () => {
    const state = parseLevel(['#####', '#@$.#', '#####'].join('\n'));
    const ctx = fakeCtx();
    renderLevel(ctx, state);
    const inset = TILE / 4;
    const markers = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([, , w, h]) => w === TILE - inset * 2 && h === TILE - inset * 2,
    );
    expect(markers.length).toBe(1);
    expect(markers[0]![0]).toBe(TILE * 3 + inset);
    expect(markers[0]![1]).toBe(TILE + inset);
  });

  it('clears the previous frame before drawing', () => {
    const state = parseLevel(['#####', '#@$.#', '#####'].join('\n'));
    const ctx = fakeCtx();
    renderLevel(ctx, state);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, TILE * 5, TILE * 3);
  });
});
