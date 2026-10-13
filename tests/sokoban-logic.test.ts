import { describe, expect, it } from 'vitest';
import { applyMove, initialState, isSolved } from '../src/games/sokoban/logic';
import { parseLevel } from '../src/games/sokoban/parse';

// MAP: player at 6, box at 7, target at 8. Row 1 is the only walkable row, so
// 'up' hits a wall and 'right' is the one legal move, which pushes the box onto
// the target. Verified with the real move rules.
const MAP = ['#####', '#@$.#', '#####'];

describe('applyMove', () => {
  it('moves the player into free floor and counts the move', () => {
    const state = parseLevel(['#####', '# @ #', '#  $#', '#  .#', '#####'].join('\n'));
    const next = applyMove(state, 'right');
    expect(next).not.toBeNull();
    expect(next!.player).toBe(8);
    expect(next!.moves).toBe(1);
    // the box at index 13 is not in the way, so it does not move
    expect([...next!.boxes]).toEqual([13]);
  });

  it('pushes the box when the cell beyond it is free', () => {
    const state = parseLevel(MAP.join('\n'));
    const next = applyMove(state, 'right');
    expect([...next!.boxes]).toEqual([8]);
  });

  it('rejects a move into a wall', () => {
    const state = parseLevel(MAP.join('\n'));
    expect(applyMove(state, 'up')).toBeNull();
  });

  it('rejects a push into a wall or off-grid edge', () => {
    // box at index 4 sits on the open left boundary; pushing left leaves the grid
    const edge = parseLevel(['####', '$@ .', '####'].join('\n'));
    expect(edge.player).toBe(5);
    expect([...edge.boxes]).toEqual([4]);
    expect(applyMove(edge, 'left')).toBeNull();

    // box at index 7 sits against the left wall; pushing left hits that wall
    const wall = parseLevel(['######', '#$@ .#', '######'].join('\n'));
    expect(wall.player).toBe(8);
    expect([...wall.boxes]).toEqual([7]);
    expect(applyMove(wall, 'left')).toBeNull();
  });

  it('leaves the original state untouched', () => {
    const state = parseLevel(MAP.join('\n'));
    const beforePlayer = state.player;
    const beforeBoxes = [...state.boxes];
    const beforeBoxSet = state.boxes;

    applyMove(state, 'right');
    expect(state.player).toBe(beforePlayer);
    expect([...state.boxes]).toEqual(beforeBoxes);
    expect(state.moves).toBe(0);

    // A rejected move must also leave it untouched.
    applyMove(state, 'up');
    expect(state.player).toBe(beforePlayer);
    expect([...state.boxes]).toEqual(beforeBoxes);
    expect(state.boxes).toBe(beforeBoxSet);
  });

  it('does not mutate the box set shared with the pre-move state', () => {
    const state = parseLevel(MAP.join('\n'));
    const boxesBefore = state.boxes;
    const next = applyMove(state, 'right');
    expect(next!.boxes).not.toBe(boxesBefore);
  });
});

describe('isSolved', () => {
  it('is false while any box is off a target', () => {
    const state = parseLevel(MAP.join('\n'));
    expect(isSolved(state)).toBe(false);
  });

  it('is true once every target holds a box', () => {
    const state = parseLevel(['#####', '#*@ #', '#####'].join('\n'));
    expect([...state.targets]).toEqual([6]);
    expect([...state.boxes]).toEqual([6]);
    expect(state.player).toBe(7);
    expect(isSolved(state)).toBe(true);
  });

  it('is false when extra boxes remain after every target is covered', () => {
    const parsed = parseLevel(['#####', '#*@ #', '#####'].join('\n'));
    const state = { ...parsed, boxes: new Set([...parsed.boxes, 8]) };
    expect(isSolved(state)).toBe(false);
  });
});

describe('initialState', () => {
  it('parses the requested level with zero moves', () => {
    const state = initialState(0);
    expect(state.moves).toBe(0);
    expect(state.player).toBeGreaterThanOrEqual(0);
    expect(state.boxes.size).toBeGreaterThan(0);
  });
});
