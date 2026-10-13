import { describe, expect, it } from 'vitest';
import { LEVELS, parseLevel } from '../src/games/sokoban/parse';

const FIXTURE = ['#####', '# .@#', '# $ #', '#####'];

describe('parseLevel', () => {
  it('parses a valid map into cell sets', () => {
    const state = parseLevel(FIXTURE.join('\n'));
    expect(state.width).toBe(5);
    expect(state.height).toBe(4);
    // '# .@#' is row 1: target at col 2 → index 1 * 5 + 2 = 7, player at col 3 → 8
    expect([...state.targets]).toEqual([7]);
    expect(state.player).toBe(8);
    // '# $ #' is row 2: box at col 2 → index 2 * 5 + 2 = 12
    expect([...state.boxes]).toEqual([12]);
    expect(state.moves).toBe(0);
  });

  it('marks walls and floors as disjoint sets', () => {
    const state = parseLevel(FIXTURE.join('\n'));
    for (const wall of state.walls) expect(state.floors.has(wall)).toBe(false);
    // 20 cells minus 6 interior cells → 14 wall cells
    expect(state.walls.size).toBe(14);
    expect(state.floors.size).toBe(6);
  });

  it('treats * as box on target and + as player on target', () => {
    const state = parseLevel(['#######', '#@$. *#', '#######'].join('\n'));
    expect(state.player).toBe(8);
    // '$' at col 2 and '*' at col 5 are boxes; '.', '+' and '*' are targets
    expect([...state.boxes].sort((a, b) => a - b)).toEqual([9, 12]);
    expect([...state.targets].sort((a, b) => a - b)).toEqual([10, 12]);
  });

  it('rejects unsupported characters with their position', () => {
    expect(() => parseLevel(['#####', '#x$.#', '#####'].join('\n'))).toThrow(/invalid.*character.*x.*row 2.*column 2/i);
  });

  it('rejects malformed maps', () => {
    expect(() => parseLevel(['####', '#@ $', '###'].join('\n'))).toThrow(/same width/i);
    expect(() => parseLevel(['#####', '# . #', '#####'].join('\n'))).toThrow(/player/i);
    expect(() => parseLevel(['#####', '#@$.#', '#$@ #', '#####'].join('\n'))).toThrow(/player/i);
    expect(() => parseLevel(['#####', '# @ #', '#####'].join('\n'))).toThrow(/box/i);
    expect(() => parseLevel(['#####', '#  $#', '# @ #', '#####'].join('\n'))).toThrow(/target/i);
    expect(() => parseLevel('')).toThrow(/empty/i);
  });
});

describe('LEVELS', () => {
  it('ships five levels that all parse and are solvable-shaped', () => {
    expect(LEVELS).toHaveLength(5);
    for (const level of LEVELS) {
      const state = parseLevel(level);
      expect(state.boxes.size).toBeGreaterThan(0);
      expect(state.targets.size).toBe(state.boxes.size);
    }
  });
});
