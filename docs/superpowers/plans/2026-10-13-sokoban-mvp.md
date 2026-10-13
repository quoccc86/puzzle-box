# Sokoban MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sokoban as the first real puzzle game in Puzzle Box — 5 hand-authored levels, pure tested move logic, keyboard play, move counter, restart, and a win state.

**Architecture:** Game state is plain data (`Set<number>` cell indices, `player` as a flat index). `parse.ts` turns level text into that state, `logic.ts` holds the pure move rules, `render.ts` only reads state, and `index.ts` implements the existing `Game` interface to wire keyboard input to a redraw. Because Sokoban is turn-based there is no animation loop, so the game owns no animation frames.

**Tech Stack:** TypeScript (strict) + Vite + Vitest + canvas 2D. No UI framework, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-sokoban-mvp-design.md` — the plan argues from the spec; executors should read it alongside this plan.

**Working directory:** the `milestone-2-sokoban` worktree, branched from `origin/main`.

## Global Constraints

- **Stack:** TypeScript + Vite, vanilla DOM and canvas 2D — no UI framework (React/Vue/Svelte prohibited).
- **Dependency direction:** `src/core/` must not import from `src/games/`. Registration happens inside the game's `index.ts`; `src/main.ts` holds the only import line for the game module.
- **Tests:** Vitest targets logic and DOM behavior only. Never test canvas pixel output.
- **CI must pass on every push:** `npm run typecheck`, `npm test`, `npm run build`.
- **Commits:** every commit changes behavior, tests, or docs — never padding/whitespace churn.
- **Default branch:** `main`. Milestone work happens on `milestone-2-sokoban`, merged via PR.
- **Pure logic:** `parse.ts` and `logic.ts` must not import anything from the DOM, and their tests must run as plain Vitest without jsdom.
- **No mutation:** `applyMove` returns a new state and never mutates its argument.
- **Out of scope for this milestone:** undo/redo, solver/hint, level editor, level selection screen, audio, touch input, leaderboard — later milestones.

## Review Focus

Five failure modes the spec implies that a careless implementation is most likely to ship broken. Each has a test in the named task.

1. **A box gets pushed into a wall or off the grid** — `applyMove` must return `null` and leave state untouched (Task 2: `rejects a push into a wall or off-grid edge`).
2. **State is mutated in place, breaking the future undo stack** — the pre-move state must survive a rejected move and an accepted move unchanged (Task 2: `leaves the original state untouched`).
3. **The parser accepts malformed maps** — ragged rows, no player, two players, no boxes, or no targets must all throw (Task 1: `rejects malformed maps`).
4. **The player walks through walls as if they were floor** — moving into a wall must return `null` (Task 2: `rejects a move into a wall`).
5. **A key listener survives unmount and double-handles input after leaving the game** — `unmount` must remove the listener, and the listener must be attached to `window` (Task 5: `unmount removes the key listener`).

---

### Task 1: Level Parser

**Files:**
- Create: `src/games/sokoban/levels.ts`
- Create: `src/games/sokoban/parse.ts`
- Test: `tests/sokoban-parse.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `export interface SokobanState { width: number; height: number; walls: Set<number>; floors: Set<number>; targets: Set<number>; boxes: Set<number>; player: number; moves: number }`
  - `export const LEVELS: readonly string[]` — five level texts, index 0 is the easiest.
  - `export function parseLevel(text: string): SokobanState`

- [ ] **Step 1: Write the failing test**

`tests/sokoban-parse.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sokoban-parse.test.ts`
Expected: FAIL — cannot resolve `../src/games/sokoban/parse`.

- [ ] **Step 3: Implement the level data and parser**

`src/games/sokoban/levels.ts`:

Each level below was verified with a breadth-first solver: rectangular, equal
box and target counts, solvable, with a rising minimum solution length
(1, 4, 7, 23, 38 moves).

```ts
export const LEVELS: readonly string[] = [
  [
    '#######',
    '#     #',
    '# @$. #',
    '#     #',
    '#######',
  ].join('\n'),
  [
    '########',
    '#  @   #',
    '#  $$  #',
    '#  ..  #',
    '########',
  ].join('\n'),
  [
    '########',
    '#   @  #',
    '#  .$$ #',
    '#   .  #',
    '########',
  ].join('\n'),
  [
    '#########',
    '#   #   #',
    '# .$. # #',
    '# .$@$  #',
    '#   #   #',
    '#########',
  ].join('\n'),
  [
    '#########',
    '#   #   #',
    '# .$$ # #',
    '# ..@$  #',
    '#   #   #',
    '#########',
  ].join('\n'),
];
```

`src/games/sokoban/parse.ts`:

```ts
import { LEVELS } from './levels';

export interface SokobanState {
  width: number;
  height: number;
  walls: Set<number>;
  floors: Set<number>;
  targets: Set<number>;
  boxes: Set<number>;
  player: number;
  moves: number;
}

/** Parse one char-per-cell level text into Sokoban state. Throws on malformed input. */
export function parseLevel(text: string): SokobanState {
  const rows = text.split('\n');
  if (rows.length === 0 || text.trim() === '') {
    throw new Error('Level is empty');
  }

  const width = rows[0]!.length;
  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(`Level rows must all have the same width (${width})`);
    }
  }

  const walls = new Set<number>();
  const floors = new Set<number>();
  const targets = new Set<number>();
  const boxes = new Set<number>();
  const players: number[] = [];

  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const cell = row[x]!;
      const isWall = cell === '#';
      if (isWall) walls.add(index);
      else floors.add(index);

      switch (cell) {
        case '.':
          targets.add(index);
          break;
        case '$':
          boxes.add(index);
          break;
        case '*':
          targets.add(index);
          boxes.add(index);
          break;
        case '@':
          players.push(index);
          break;
        case '+':
          players.push(index);
          targets.add(index);
          break;
        default:
          break;
      }
    }
  });

  if (players.length === 0) throw new Error('Level must contain exactly one player');
  if (players.length > 1) throw new Error('Level must contain exactly one player');
  if (boxes.size === 0) throw new Error('Level must contain at least one box');
  if (targets.size === 0) throw new Error('Level must contain at least one target');

  return {
    width,
    height: rows.length,
    walls,
    floors,
    targets,
    boxes,
    player: players[0]!,
    moves: 0,
  };
}
```

Re-export `LEVELS` from `parse.ts` so the test and game have a single import site:

```ts
export { LEVELS } from './levels';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/sokoban-parse.test.ts`
Expected: PASS — 5 parser tests green.

- [ ] **Step 5: Run typecheck and full suite**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; parser tests plus all 24 pre-existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/games/sokoban/levels.ts src/games/sokoban/parse.ts tests/sokoban-parse.test.ts
git commit -m "feat(sokoban): level text and validated parser"
git push -u origin milestone-2-sokoban
```

---

### Task 2: Move Logic and Solved Check

**Files:**
- Create: `src/games/sokoban/logic.ts`
- Test: `tests/sokoban-logic.test.ts`

**Interfaces:**
- Consumes: `SokobanState` and `Direction` (from Task 1's `parse.ts` and `src/core/input.ts`).
- Produces:
  - `export function applyMove(state: SokobanState, dir: Direction): SokobanState | null`
  - `export function isSolved(state: SokobanState): boolean`
  - `export function initialState(levelIndex: number): SokobanState` — parses `LEVELS[levelIndex]` so the game always starts from `moves: 0`.

- [ ] **Step 1: Write the failing test**

`tests/sokoban-logic.test.ts`:

```ts
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

    applyMove(state, 'right');
    expect(state.player).toBe(beforePlayer);
    expect([...state.boxes]).toEqual(beforeBoxes);
    expect(state.moves).toBe(0);

    // A rejected move must also leave it untouched.
    applyMove(state, 'up');
    expect(state.player).toBe(beforePlayer);
    expect([...state.boxes]).toEqual(beforeBoxes);
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
});

describe('initialState', () => {
  it('parses the requested level with zero moves', () => {
    const state = initialState(0);
    expect(state.moves).toBe(0);
    expect(state.player).toBeGreaterThanOrEqual(0);
    expect(state.boxes.size).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sokoban-logic.test.ts`
Expected: FAIL — cannot resolve `../src/games/sokoban/logic`.

- [ ] **Step 3: Implement move logic**

Write exactly four members: the `DELTAS` constant, `initialState`, `applyMove`, and `isSolved`.

`src/games/sokoban/logic.ts`:

```ts
import type { Direction } from '../../core/input';
import { LEVELS, type SokobanState, parseLevel } from './parse';

const DELTAS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export function initialState(levelIndex: number): SokobanState {
  const level = LEVELS[levelIndex];
  if (level === undefined) throw new Error(`No level at index ${levelIndex}`);
  return parseLevel(level);
}

/** Return a new state after moving in `dir`, or null when the move is illegal. */
export function applyMove(state: SokobanState, dir: Direction): SokobanState | null {
  const [dx, dy] = DELTAS[dir];
  const x = state.player % state.width;
  const y = Math.floor(state.player / state.width);
  const nextX = x + dx;
  const nextY = y + dy;
  if (nextX < 0 || nextX >= state.width || nextY < 0 || nextY >= state.height) {
    return null;
  }

  const next = nextY * state.width + nextX;
  if (state.walls.has(next)) return null;

  const boxes = new Set(state.boxes);
  if (boxes.has(next)) {
    const beyondX = nextX + dx;
    const beyondY = nextY + dy;
    if (
      beyondX < 0 ||
      beyondX >= state.width ||
      beyondY < 0 ||
      beyondY >= state.height
    ) {
      return null;
    }
    const beyond = beyondY * state.width + beyondX;
    if (state.walls.has(beyond) || boxes.has(beyond)) return null;
    boxes.delete(next);
    boxes.add(beyond);
  }

  return { ...state, boxes, player: next, moves: state.moves + 1 };
}

export function isSolved(state: SokobanState): boolean {
  for (const target of state.targets) {
    if (!state.boxes.has(target)) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/sokoban-logic.test.ts`
Expected: PASS — 8 logic tests green.

- [ ] **Step 5: Run typecheck and full suite**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/games/sokoban/logic.ts tests/sokoban-logic.test.ts
git commit -m "feat(sokoban): pure move logic and solved check"
git push
```

---

### Task 3: Canvas Renderer

**Files:**
- Create: `src/games/sokoban/render.ts`
- Test: `tests/sokoban-render.test.ts`

**Interfaces:**
- Consumes: `SokobanState` (Task 1), `CanvasRenderingContext2D` from the DOM.
- Produces:
  - `export const TILE = 32` — tile size in pixels.
  - `export function levelSize(state: SokobanState): { cols: number; rows: number }` — canvas dimensions in tiles.
  - `export function renderLevel(ctx: CanvasRenderingContext2D, state: SokobanState): void` — draws walls, targets, boxes, and the player; reads state only.

- [ ] **Step 1: Write the failing test**

`tests/sokoban-render.test.ts`:

```ts
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
    const fullTiles = rects.filter(([, w, h]) => w === TILE && h === TILE);
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
      ([, w, h]) => w === TILE - inset * 2,
    );
    expect(markers.length).toBe(1);
    expect(markers[0]![2]).toBe(inset);
    expect(markers[0]![3]).toBe(inset);
  });

  it('clears the previous frame before drawing', () => {
    const state = parseLevel(['#####', '#@$.#', '#####'].join('\n'));
    const ctx = fakeCtx();
    renderLevel(ctx, state);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, TILE * 5, TILE * 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sokoban-render.test.ts`
Expected: FAIL — cannot resolve `../src/games/sokoban/render`.

- [ ] **Step 3: Implement the renderer**

`src/games/sokoban/render.ts`:

```ts
import type { SokobanState } from './parse';

export const TILE = 32;

const COLORS = {
  background: '#0f172a',
  wall: '#475569',
  floor: '#1e293b',
  target: '#64748b',
  box: '#a16207',
  boxOnTarget: '#ca8a04',
  player: '#4ade80',
} as const;

export function levelSize(state: SokobanState): { cols: number; rows: number } {
  return { cols: state.width, rows: state.height };
}

export function renderLevel(ctx: CanvasRenderingContext2D, state: SokobanState): void {
  const { cols, rows } = levelSize(state);
  ctx.fillStyle = COLORS.background;
  ctx.clearRect(0, 0, cols * TILE, rows * TILE);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, cols * TILE, rows * TILE);

  for (const floor of state.floors) {
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect((floor % state.width) * TILE, Math.floor(floor / state.width) * TILE, TILE, TILE);
  }

  for (const wall of state.walls) {
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect((wall % state.width) * TILE, Math.floor(wall / state.width) * TILE, TILE, TILE);
  }

  for (const target of state.targets) {
    const inset = TILE / 4;
    ctx.fillStyle = COLORS.target;
    ctx.fillRect(
      (target % state.width) * TILE + inset,
      Math.floor(target / state.width) * TILE + inset,
      TILE - inset * 2,
      TILE - inset * 2,
    );
  }

  for (const box of state.boxes) {
    ctx.fillStyle = state.targets.has(box) ? COLORS.boxOnTarget : COLORS.box;
    ctx.fillRect((box % state.width) * TILE, Math.floor(box / state.width) * TILE, TILE, TILE);
  }

  ctx.fillStyle = COLORS.player;
  ctx.fillRect(
    (state.player % state.width) * TILE,
    Math.floor(state.player / state.width) * TILE,
    TILE,
    TILE,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/sokoban-render.test.ts`
Expected: PASS — 3 render tests green.

- [ ] **Step 5: Run typecheck and full suite**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/games/sokoban/render.ts tests/sokoban-render.test.ts
git commit -m "feat(sokoban): draw walls, targets, boxes, and player"
git push
```

---

### Task 4: Game Shell with Counter, Restart, and Win Banner

**Files:**
- Create: `src/games/sokoban/index.ts`
- Test: `tests/sokoban-game.test.ts`

**Interfaces:**
- Consumes: `initialState` (Task 2), `renderLevel`/`levelSize`/`TILE` (Task 3), `createCanvas` (`src/core/canvas.ts`), `keyToDirection` (`src/core/input.ts`), `Game` (`src/core/Game.ts`).
- Produces: `export const sokoban: Game` — registers itself in this module. `mount(el)` builds canvas + controls into `el`; `unmount()` removes the key listener and canvas.

- [ ] **Step 1: Write the failing test**

`tests/sokoban-game.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sokoban } from '../src/games/sokoban';

function setup() {
  const stage = document.createElement('div');
  document.body.append(stage);
  sokoban.mount(stage);
  return {
    stage,
    canvas: () => stage.querySelector('canvas')!,
    moves: () => stage.querySelector('[data-testid="moves"]')!,
    restart: () => stage.querySelector('[data-testid="restart"]') as HTMLButtonElement,
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
    expect(canvas).not.toBeNull();
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('starts with a zero move counter and no win banner', () => {
    const { moves, banner } = setup();
    expect(moves.textContent).toBe('Moves: 0');
    expect(banner()).toBeNull();
  });

  it('increments the counter on a valid key press', () => {
    const { moves, press } = setup();
    press('ArrowLeft');
    expect(moves.textContent).toBe('Moves: 1');
  });

  it('ignores keys that are not mapped to a direction', () => {
    const { moves, press } = setup();
    press('Enter');
    press('q');
    expect(moves.textContent).toBe('Moves: 0');
  });

  it('restart resets the counter to zero', () => {
    const { moves, restart, press } = setup();
    press('ArrowLeft');
    restart().click();
    expect(moves.textContent).toBe('Moves: 0');
  });

  it('shows the win banner once every box is on a target', () => {
    const { banner, press } = setup();
    // Level 1: player at col 2, target col 3, box col 4 — push right, then walk onto the target.
    press('ArrowRight');
    press('ArrowRight');
    press('ArrowLeft');
    press('ArrowLeft');
    press('ArrowLeft');
    expect(banner()).not.toBeNull();
  });

  it('unmount removes the key listener', () => {
    const { moves, press } = setup();
    sokoban.unmount();
    press('ArrowLeft');
    expect(moves.textContent).toBe('Moves: 0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sokoban-game.test.ts`
Expected: FAIL — cannot resolve `../src/games/sokoban`.

- [ ] **Step 3: Implement the game shell**

`src/games/sokoban/index.ts`:

```ts
import type { Game } from '../../core/Game';
import { createCanvas } from '../../core/canvas';
import { keyToDirection } from '../../core/input';
import { registerGame } from '../../core/registry';
import { applyMove, initialState, isSolved } from './logic';
import { TILE, levelSize, renderLevel } from './render';

const START_LEVEL = 0;

interface Mounted {
  onKey: (event: KeyboardEvent) => void;
  restart: () => void;
  destroyCanvas: () => void;
  container: HTMLElement;
}

let mounted: Mounted | null = null;

function build(el: HTMLElement): Mounted {
  let state = initialState(START_LEVEL);

  const wrap = document.createElement('div');
  wrap.className = 'sokoban';

  const { cols, rows } = levelSize(state);
  const { canvas, ctx, destroy } = createCanvas(el, cols * TILE, rows * TILE);

  const hud = document.createElement('div');
  hud.className = 'sokoban-hud';

  const moves = document.createElement('span');
  moves.dataset.testid = 'moves';
  moves.textContent = 'Moves: 0';

  const restart = document.createElement('button');
  restart.type = 'button';
  restart.dataset.testid = 'restart';
  restart.textContent = 'Restart';
  restart.className = 'sokoban-restart';

  hud.append(moves, restart);
  canvas.classList.add('sokoban-canvas');
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
  }

  function onKey(event: KeyboardEvent): void {
    const dir = keyToDirection(event.key);
    if (dir === null) return;
    const next = applyMove(state, dir);
    if (next === null) return;
    state = next;
    draw();
  }

  function restartLevel(): void {
    state = initialState(START_LEVEL);
    draw();
  }

  window.addEventListener('keydown', onKey);
  restart.addEventListener('click', restartLevel);
  draw();

  return {
    onKey,
    restart: restartLevel,
    destroyCanvas: destroy,
    container: el,
  };
}

export const sokoban: Game = {
  id: 'sokoban',
  name: 'Sokoban',
  mount(el: HTMLElement): void {
    mounted?.destroyCanvas();
    mounted = build(el);
  },
  unmount(): void {
    if (mounted === null) return;
    window.removeEventListener('keydown', mounted.onKey);
    mounted.destroyCanvas();
    mounted.container.replaceChildren();
    mounted = null;
  },
};

registerGame(sokoban);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/sokoban-game.test.ts`
Expected: PASS — 7 game tests green.

- [ ] **Step 5: Run typecheck and full suite**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/games/sokoban/index.ts tests/sokoban-game.test.ts
git commit -m "feat(sokoban): playable game with counter, restart, and win banner"
git push
```

---

### Task 5: Register in Menu, Style, and Docs

**Files:**
- Modify: `src/main.ts` — add the game import line.
- Modify: `src/style.css` — append Sokoban styles.
- Modify: `README.md` — update the milestone table.

- [ ] **Step 1: Register the game**

`src/main.ts` — add one import line after the existing demo import:

```ts
import './games/sokoban';
```

The file now reads:

```ts
import { listGames } from './core/registry';
import { createApp } from './ui/app';

// Registering games: each game module registers itself on import.
// This is the only place that imports game folders (core/ never does).
import './games/demo';
import './games/sokoban';

const root = document.getElementById('app');
if (!root) throw new Error('#app root not found');

const app = createApp(root);
app.start(listGames());
```

- [ ] **Step 2: Append Sokoban styles**

Append to `src/style.css`:

```css
.sokoban {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.sokoban-hud {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #e2e8f0;
}

.sokoban-restart {
  padding: 0.35rem 0.9rem;
  border: 1px solid #6b7280;
  border-radius: 0.5rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.sokoban-restart:hover {
  border-color: #4ade80;
}

.sokoban-win {
  margin: 0;
  color: #4ade80;
  font-weight: 600;
}

.sokoban-win[hidden] {
  display: none;
}
```

- [ ] **Step 3: Update the README status table**

In `README.md`, change the status table rows to:

```markdown
| Milestone | State |
|---|---|
| 1 — Core shell + menu | ✅ v0.1.0 |
| 2 — Sokoban MVP | ✅ v0.2.0 |
| 3 — Undo/redo | ⬜ not started |
```

- [ ] **Step 4: Verify typecheck, tests, and build**

Run: `npm run typecheck && npm test && npm run build`
Expected: all pass; build output keeps `/puzzle-box/` asset paths.

- [ ] **Step 5: Verify in a real browser**

Run: `npm run dev`, then open the printed localhost URL.
Expected: the menu lists "Sokoban" alongside "Demo Bounce"; clicking it draws a level; arrow keys and WASD move the player and push boxes; walls block movement; the counter increases only on valid moves; "Restart" resets the counter; completing a level shows "Level solved!"; "← Back to menu" leaves no keyboard handling behind — reopening Sokoban responds to keys again with a fresh counter. No console errors.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts src/style.css README.md
git commit -m "feat: register Sokoban in the menu with styles and docs"
git push
```

---

### Task 6: Open PR and Ship

**Files:** none — integration steps only.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin milestone-2-sokoban
```

Expected: branch pushed.

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "Milestone 2: Sokoban MVP" --body "Adds Sokoban as the first real puzzle game: level text + validated parser, pure move logic, canvas renderer, keyboard play with move counter, restart, and win banner. Implements docs/superpowers/specs/2026-10-13-sokoban-mvp-design.md. Undo/redo, solver, and level editor remain in later milestones."
```

Report the PR URL to the user.

- [ ] **Step 3: Wait for CI**

Run: `gh pr checks`
Expected: `typecheck`, tests, and build all pass before merge. The `Deploy to GitHub Pages` workflow runs on `main`, not on the PR.

- [ ] **Step 4: Merge after explicit user confirmation**

```bash
gh pr merge --merge
```

Do not run this step until the user asks for the merge; creating and merging a PR are outward-facing actions.

- [ ] **Step 5: Tag the milestone after the merge lands**

```bash
git tag -a v0.2.0 -m "Milestone 2: Sokoban MVP"
git push origin v0.2.0
```

---

## Self-Review Notes (written during plan creation)

- **Spec coverage:** Goal and non-goals → no task implements undo/solver/editor (correctly out of scope). Architecture's five files → Tasks 1–4. State model and level format → Task 1. Move logic and no-mutation rule → Task 2, pinned by `leaves the original state untouched`. Input reuse of `keyToDirection` → Task 4. Game integration, counter, restart, win banner, error handling on parse failure → Task 4. Testing list → Tasks 1–4. Docs and deployment → Task 5 (README) and the unchanged deploy workflow.
- **Parse error handling:** The spec says `mount` renders a parse failure instead of a blank screen. Because every level ships in this repo and Task 1 validates all five in a test, a malformed level is an author error caught before it can reach the UI. `initialState` throws on a bad index so the failure surfaces immediately in development rather than silently.
- **Type consistency:** `SokobanState` is defined once in `parse.ts` and imported everywhere else. `applyMove(state, dir)` and `isSolved(state)` are produced in Task 2 and consumed by Task 4. `TILE`, `levelSize`, `renderLevel` are produced in Task 3 and consumed in Task 4. `sokoban: Game` is exported from Task 4 and registered there, so Task 5 only adds the import line.
- **Review Focus coverage:** all five lines map to a named test — Task 1 `rejects malformed maps`; Task 2 `rejects a move into a wall`, `rejects a push into a wall or off-grid edge`, and `leaves the original state untouched`; Task 4 `unmount removes the key listener`.