# Sokoban MVP — Design Spec

**Date:** 2026-10-13
**Status:** Draft, awaiting user review
**Milestone:** 2 of the Puzzle Box roadmap

## Goal

Add Sokoban as the first real puzzle game, proving the plugin architecture
from Milestone 1 by adding a game through a single import line in
`src/main.ts` and no edits to `src/core/` or `src/ui/`.

Success looks like:

1. Sokoban appears in the menu, is playable in the browser, and ships to
   GitHub Pages through the existing deploy workflow.
2. Game logic is pure and fully unit-tested without a DOM.
3. Adding Milestone 3 (undo/redo) needs no rewrite of the move logic.

## Non-goals

- Undo/redo, hint solver, level editor, level selection screen — later
  milestones per the roadmap spec.
- Audio, mobile swipe controls, leaderboards, local high scores.
- Touch input of any kind; this milestone is keyboard-only.

## Architecture

Logic is pure data and pure functions; rendering only reads state. This is
the split that makes the solver and undo stack testable in later
milestones.

```
src/games/sokoban/
├── levels.ts    # 5 levels as plain text strings
├── parse.ts     # text → SokobanState, with validation
├── logic.ts     # applyMove(state, dir) → new state | null (pure)
├── render.ts    # state → canvas drawing (reads state only)
└── index.ts     # Game: mount/unmount, key handling, loop
```

Each file has one responsibility. `logic.ts` and `parse.ts` import nothing
from the DOM, so their tests run as plain Vitest without jsdom.

Dependency direction follows the existing rule: `src/core/` never imports
from `src/games/`, and `src/main.ts` holds the only import line for the
game module.

## State model

Flat integer indices, `index = y * width + x`, exactly as the roadmap spec
defines. `Set<number>` for collections, chosen over arrays because
membership tests dominate the move logic.

```ts
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
```

`floors` holds every non-wall cell, including cells occupied by a box or
the player, so "is this cell walkable" is one set lookup.

## Level format

One character per cell, no comments or separators — the format the roadmap
spec already committed to, so the Milestone 4 level parser is already
designed.

```
#######
#     #
# .$@ #
#     #
#######
```

| Char | Meaning |
|---|---|
| `#` | wall |
| ` ` | floor |
| `.` | target |
| `$` | box |
| `*` | box on target |
| `@` | player |
| `+` | player on target |

`parseLevel(text)` throws an `Error` with a specific message when the map
is ragged (rows of differing length), contains a character outside the
format's alphabet, contains no player, has more than one player, has no
boxes or no targets, or has a different number of boxes than targets.
The last rule rejects a level that could never be won. `*` contributes
both a box and a target; `+` contributes a player and a target.

## Move logic

`applyMove(state, dir)` returns a new state or `null`:

- Compute the player's target cell. If it is a wall, return `null`.
- Otherwise move the player and increment `moves`.
- If the target cell holds a box, compute the cell beyond it. If that cell
  is a wall or off-grid, return `null` — a box is never pushed into one.
- Otherwise move the box too.

The function never mutates its argument; it copies the box set and returns
a new state object. Keeping old states intact is what makes the Undo
stack in Milestone 3 a list of states with no extra machinery.

`isSolved(state)` returns true when every target holds a box.

## Input

`keyToDirection` from `src/core/input.ts` (already delivered in Milestone
1) maps arrow keys and WASD to `Direction`. The game ignores unmapped keys
by receiving `null` from that function. No new input code.

## Game integration

`index.ts` implements the existing `Game` interface:

- `mount(el)` — parse level 1, create the canvas via `createCanvas`, draw,
  attach a `keydown` listener on `window`, and render once per move. The
  canvas repaints only when state changes, so no animation loop is needed.
- `unmount()` — remove the key listener and destroy the canvas.

Because Sokoban is turn-based, there is no `createLoop`; the game holds no
animation frames and therefore cannot leak one.

Visible controls: the move counter, a "Restart" button that resets to the
initial state, and a win banner when `isSolved(state)` becomes true.

## Error handling

Levels are authored in this repository, so a malformed level is an author
error caught in development rather than a runtime condition. `mount`
catches a parse failure and renders the error message into the stage
instead of leaving a blank screen, so a bad level never produces a silent
empty canvas.

## Testing

Vitest, targeting pure logic. No canvas pixel assertions, per the standing
project rule that tests never cover the render layer.

- `applyMove` on a fixture map puts the player and box where expected.
- Moving into a wall returns `null` and leaves state untouched.
- Pushing a box against a wall or the grid edge returns `null`.
- Pushing a box into a free cell moves both box and player.
- `isSolved` is false with a box off-target and true once all targets hold
  boxes.
- `parseLevel` accepts valid maps and rejects ragged, playerless,
  multi-player, boxless, and targetless maps.

## Documentation and deployment

`src/main.ts` gains one line: `import './games/sokoban';`. The README status
table moves Milestone 2 to done and Milestone 3 to next. Deployment is
unchanged — the existing `Deploy to GitHub Pages` workflow publishes `main`
after merge.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Render logic grows into untested territory | `render.ts` only reads state; all rules live in tested pure functions |
| Copying box sets per move gets slow on large levels | Five small levels; revisit only if level size grows |
| Key listener survives unmount and double-handles input | `unmount` removes the listener; Milestone 1's lifecycle tests cover the mount/unmount contract |