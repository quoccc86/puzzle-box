# Puzzle Box

A browser-based collection of puzzle games, written in TypeScript.

## Status

| Milestone | State |
|---|---|
| 1 — Core shell + menu | ✅ v0.1.0 |
| 2 — Sokoban MVP | ⬜ not started |
| 3 — Undo/redo | ⬜ not started |

## Run locally

```bash
npm install
npm run dev
```

## Tests

```bash
npm test          # Vitest (logic + DOM behavior)
npm run typecheck # tsc --noEmit
npm run build     # typecheck + vite build
```

## Adding a game

See [docs/add-a-game.md](docs/add-a-game.md).
