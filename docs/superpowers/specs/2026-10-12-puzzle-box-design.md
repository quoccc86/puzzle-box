# Puzzle Box — Design Spec

**Date:** 2026-10-12
**Status:** Draft, awaiting user review

## Goal

Build a browser-based collection of small puzzle games that the owner can
extend incrementally, so that the GitHub profile gains a steady, honest
contribution graph through real commits — not fabricated ones.

Stated intent: **increase contribution count of the author's own profile**
(route B in the original discussion). Explicit non-goal: scripts that
auto-commit, whitespace churn, or any pattern GitHub would classify as
abuse.

Success looks like:

1. A public repo with a playable first game and a demo GIF in the README.
2. A task backlog long enough to sustain regular commits for months
   (~10 milestones for the first game alone, plus one milestone per
   additional game).
3. CI green on every push (type check, tests, build).

## Non-goals

- Multiplayer, accounts, or server-side anything.
- Achievements/in-app currency beyond local high scores.
- Auto-commit tooling or any form of contribution-graph manipulation.
- More than one game in the first milestone (depth first, breadth later).

## Architecture

A single-page shell loads a menu; games plug in via a registry.

```
puzzle-box/
├── index.html            # shell, loads menu
├── src/
│   ├── main.ts           # bootstrap, registry wiring
│   ├── core/
│   │   ├── Game.ts       # Game interface
│   │   ├── registry.ts   # game plugin registry
│   │   ├── canvas.ts     # canvas wrapper + game loop
│   │   ├── input.ts      # keyboard / pointer / touch
│   │   ├── score.ts      # localStorage high-score API
│   │   └── audio.ts      # WebAudio blips
│   ├── ui/
│   │   ├── menu.ts       # game grid, best scores
│   │   └── hud.ts        # pause / restart / mute
│   └── games/
│       ├── sokoban/      # game 1
│       └── ...           # future games, one folder each
├── docs/
│   ├── add-a-game.md     # contributor guide for new games
│   └── superpowers/specs/
├── tests/                # Vitest — pure logic only
├── .github/workflows/ci.yml
├── vite.config.ts
└── package.json
```

### Game interface

```ts
export interface Game {
  id: string;                          // 'sokoban'
  name: string;                        // 'Sokoban'
  mount(el: HTMLElement): void;        // attach canvas + HUD
  unmount(): void;                     // release listeners/rAF
}
```

Rules:

- Games register themselves in `registry.ts`; the core never imports a
  concrete game folder directly (registration happens in the game's
  `index.ts`, imported once from `main.ts`).
- Adding a game requires no core edits beyond one import line.
- `core/` must not depend on `games/`.

### Technology

- TypeScript + Vite. No UI framework (vanilla DOM keeps the toolchain
  small and each commit's blast radius low).
- Rendering: 2D canvas.
- Persistence: `localStorage` for high scores and level-pack progress.
- Tests: Vitest, targeting pure logic (moves, solver, parsing) — never
  the render layer.
- CI: GitHub Actions — `tsc --noEmit`, `vitest run`, `vite build`.

## First game: Sokoban

Player pushes boxes onto targets. Chosen because it yields many genuine
incremental tasks.

### Logic/render split

Game state is a plain data structure; `applyMove(state, dir)` is a pure
function returning a new state (or `null` if the move is invalid).
Rendering only reads state. This is what makes the solver and undo stack
testable.

```ts
interface SokobanState {
  width: number; height: number;
  walls: Set<number>;      // index = y * width + x
  floors: Set<number>;
  targets: Set<number>;
  boxes: Set<number>;
  player: number;
  moves: number;
}
```

### Milestones

| # | Commit batch | Contents |
|---|---|---|
| 1 | Core | game loop, canvas wrapper, input, registry, menu skeleton |
| 2 | Sokoban MVP | tile rendering, movement + push logic, 5 levels |
| 3 | Undo/redo | state history stack, keyboard bindings |
| 4 | Level pack 2 | 20 harder levels, `.txt` map format parser |
| 5 | Solver | BFS/A* — hint button + level solvability check |
| 6 | Level editor | place walls/boxes/targets, validate, export JSON |
| 7 | Polish | slide animation, win particles, light/dark theme |
| 8 | Mobile | swipe controls, responsive canvas |
| 9 | Audio | WebAudio blips, mute toggle |
| 10 | Leaderboard | local best-move counts per level |

Each milestone is 3–6 small commits (logic → tests → render → docs),
pushed regularly. Roughly 10 milestones ≈ several months of honest,
regular commits.

### Level format

Plain text, one char per cell:

```
########
#      #
# . $@ #
########
```

`#` wall, ` ` floor, `.` target, `$` box, `*` box on target,
`@` player, `+` player on target. Parser validates rectangular shape,
exactly one player, ≥1 box and ≥1 target.

### Tests (Vitest)

- `applyMove` on fixture maps → correct player/box positions; pushes
  rejected against walls/edges.
- BFS solver returns a solution of known minimal length for fixture
  levels; reports unsolvable for a deliberately blocked fixture.
- Undo stack restores exact state after N moves, including box positions.
- Level parser accepts valid packs, rejects ragged/empty/playerless maps.

## Contribution workflow

- Pushes and PRs run CI; merge only when green.
- Feature work is split into the milestone table's small commits
  (`feat(sokoban): sliding push animation`, `test(solver): unsolvable
  fixture`), never padded with no-op changes.
- README carries a demo GIF once rendering exists (capture via Playwright
  or a manual screen recording).
- Keep a few `good first issue` labels open (e.g. "add a level pack");
  outside contributions are welcome but not required.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Backlog dries up after one game | Design doc already lists 10 milestones; add-a-game.md makes the next game a template job |
| Core becomes a dumping ground | `core/` is feature-frozen by default; anything game-specific lives under `games/<id>/` |
| Commit pressure leads to padding | Rule: every commit changes behavior, tests, or docs — enforced in self-review before push |
| Single developer loses track of state | Each milestone ends with a tag and a README "status" line |

## Open questions

None — scope, tech, and first game confirmed by the user in review.
