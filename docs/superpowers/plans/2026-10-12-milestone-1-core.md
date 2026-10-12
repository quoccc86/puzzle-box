# Milestone 1: Core + Menu Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Puzzle Box project and ship a runnable shell: game registry, keyboard input mapping, canvas game loop, menu UI, mount/unmount lifecycle, and one demo game — CI green throughout.

**Architecture:** Single-page shell (`index.html` → `src/main.ts`) builds a menu from a game registry. Games implement a 4-member `Game` interface and register themselves when their module is imported; `core/` never imports `games/`. An app controller owns the mount/unmount lifecycle so switching games never leaks listeners or animation frames.

**Tech Stack:** TypeScript (strict) + Vite + Vitest (jsdom) + GitHub Actions. No UI framework.

**Spec:** `docs/superpowers/specs/2026-10-12-puzzle-box-design.md` — the plan argues from the spec; executors should read it alongside this plan.

**Working directory:** `puzzle-box/` (repo root, branch `milestone-1/core` created in Task 1).

## Global Constraints

- **Stack:** TypeScript + Vite, vanilla DOM — no UI framework (React/Vue/Svelte prohibited).
- **Dependency direction:** `src/core/` must not import from `src/games/`. Registration happens inside each game's `index.ts`; `src/main.ts` holds the only import lines for game modules.
- **Tests:** Vitest targets logic and DOM behavior only. Never test canvas pixel output (spec: "never the render layer").
- **CI must pass on every push:** `npm run typecheck` (`tsc --noEmit`), `npm test` (`vitest run`), `npm run build` (`tsc --noEmit && vite build`).
- **Commits:** every commit changes behavior, tests, or docs — never padding/whitespace churn (spec non-goal: no contribution-graph manipulation).
- **Default branch:** `main`. Milestone work happens on `milestone-1/core`, merged via PR.
- **Out of scope for this milestone:** `core/score.ts`, `core/audio.ts`, Sokoban, sound, mobile — later milestones.

## Review Focus

Five failure modes the spec implies but that a careless implementer is most likely to ship broken. Each has a test in the named task:

1. **Duplicate game id silently overwrites an earlier game** — registering the same `id` twice must throw, not shadow (Task 1: `duplicate id throws` test).
2. **Menu renders blank when the registry is empty** — must show an explicit empty state, not an empty box (Task 4: `empty state message` test).
3. **Unknown keys crash or mis-map input** — `keyToDirection` must return `null` for anything unmapped (Task 2: `unknown keys return null` test).
4. **Loop keeps running after `stop()` / jumps after a backgrounded tab** — `stop()` must cancel the pending frame; dt must clamp to `MAX_DT_MS` (Task 3: `stop cancels` + `dt clamps` tests).
5. **Switching games leaks the previous game's listener/rAF** — the previous game's `unmount` must fire before the next `mount`; `destroy()` must unmount an active game (Task 5: lifecycle tests).

---

### Task 1: Scaffold + Game Registry

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `.github/workflows/ci.yml`
- Create: `src/main.ts`, `src/style.css`, `src/core/Game.ts`, `src/core/registry.ts`
- Test: `tests/registry.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `Game` interface (`{ id: string; name: string; mount(el: HTMLElement): void; unmount(): void }`); `registerGame(game: Game): void` (throws on duplicate id), `getGame(id: string): Game | undefined`, `listGames(): Game[]` (registration order). All later tasks and the spec's registry contract depend on these exact names.

- [ ] **Step 1: Create project scaffold files**

`package.json`:

```json
{
  "name": "puzzle-box",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Puzzle Box</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`.gitignore`:

```
node_modules/
dist/
*.local
.DS_Store
```

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

`src/style.css` (minimal shell styles):

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  justify-content: center;
}

#app {
  width: min(64rem, 100%);
  padding: 1.5rem;
}
```

`src/main.ts` (placeholder shell — replaced by real wiring in Task 6):

```ts
const root = document.getElementById('app');
if (!root) throw new Error('#app root not found');

const heading = document.createElement('h1');
heading.textContent = 'Puzzle Box';
root.append(heading);
```

- [ ] **Step 2: Install dependencies**

Run: `npm install -D typescript vite vitest jsdom`
Expected: completes with no errors; `node_modules/` and `package-lock.json` exist.

- [ ] **Step 3: Write the failing registry test**

`tests/registry.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../src/core/Game';

function fakeGame(id: string, name = id): Game {
  return { id, name, mount: () => {}, unmount: () => {} };
}

// Registry is module-level state: reset modules so each test gets a fresh registry.
beforeEach(() => {
  vi.resetModules();
});

async function freshRegistry() {
  return import('../src/core/registry');
}

describe('registry', () => {
  it('registers and returns a game', async () => {
    const { registerGame, getGame } = await freshRegistry();
    registerGame(fakeGame('a', 'Game A'));
    expect(getGame('a')?.name).toBe('Game A');
  });

  it('duplicate id throws', async () => {
    const { registerGame } = await freshRegistry();
    registerGame(fakeGame('dup'));
    expect(() => registerGame(fakeGame('dup'))).toThrow('dup');
  });

  it('listGames preserves registration order', async () => {
    const { registerGame, listGames } = await freshRegistry();
    registerGame(fakeGame('first'));
    registerGame(fakeGame('second'));
    expect(listGames().map((g) => g.id)).toEqual(['first', 'second']);
  });

  it('getGame returns undefined for unknown id', async () => {
    const { getGame } = await freshRegistry();
    expect(getGame('missing')).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — module `../src/core/registry` not found (and `../src/core/Game` missing).

- [ ] **Step 5: Implement Game interface and registry**

`src/core/Game.ts`:

```ts
export interface Game {
  /** Unique slug, e.g. 'sokoban'. Used as the registry key. */
  id: string;
  /** Display name shown in the menu. */
  name: string;
  /** Attach the game's canvas/HUD into the given element. */
  mount(el: HTMLElement): void;
  /** Release listeners, animation frames, and DOM owned by this game. */
  unmount(): void;
}
```

`src/core/registry.ts`:

```ts
import type { Game } from './Game';

const games = new Map<string, Game>();

export function registerGame(game: Game): void {
  if (games.has(game.id)) {
    throw new Error(`Duplicate game id: ${game.id}`);
  }
  games.set(game.id, game);
}

export function getGame(id: string): Game | undefined {
  return games.get(id);
}

export function listGames(): Game[] {
  return [...games.values()];
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 4 registry tests green.

- [ ] **Step 7: Run typecheck and build**

Run: `npm run build`
Expected: succeeds; `dist/` produced.

- [ ] **Step 8: Commit and push branch**

```bash
git checkout -b milestone-1/core
git add -A
git commit -m "feat: scaffold Vite+TS project with game registry"
git push -u origin milestone-1/core
```

Expected: branch pushed; CI workflow triggers on the branch only when a PR is opened or pushed to `main` — first real CI run comes in Task 6. (The `on: pull_request` trigger will run it.)

---

### Task 2: Keyboard Input Mapping

**Files:**
- Create: `src/core/input.ts`
- Test: `tests/input.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure module).
- Produces: `type Direction = 'up' | 'down' | 'left' | 'right'`; `keyToDirection(key: string): Direction | null`. Sokoban (Milestone 2) and the HUD consume these names.

- [ ] **Step 1: Write the failing test**

`tests/input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { keyToDirection } from '../src/core/input';

describe('keyToDirection', () => {
  it('maps arrow keys', () => {
    expect(keyToDirection('ArrowUp')).toBe('up');
    expect(keyToDirection('ArrowDown')).toBe('down');
    expect(keyToDirection('ArrowLeft')).toBe('left');
    expect(keyToDirection('ArrowRight')).toBe('right');
  });

  it('maps WASD in both cases', () => {
    expect(keyToDirection('w')).toBe('up');
    expect(keyToDirection('W')).toBe('up');
    expect(keyToDirection('s')).toBe('down');
    expect(keyToDirection('S')).toBe('down');
    expect(keyToDirection('a')).toBe('left');
    expect(keyToDirection('A')).toBe('left');
    expect(keyToDirection('d')).toBe('right');
    expect(keyToDirection('D')).toBe('right');
  });

  it('unknown keys return null', () => {
    expect(keyToDirection('x')).toBeNull();
    expect(keyToDirection('Enter')).toBeNull();
    expect(keyToDirection('')).toBeNull();
    expect(keyToDirection('Escape')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `../src/core/input`.

- [ ] **Step 3: Implement input mapping**

`src/core/input.ts`:

```ts
export type Direction = 'up' | 'down' | 'left' | 'right';

const KEY_MAP: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
};

/** Map a KeyboardEvent.key value to a direction, or null if unmapped. */
export function keyToDirection(key: string): Direction | null {
  return KEY_MAP[key] ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 3 input tests green.

- [ ] **Step 5: Commit**

```bash
git add src/core/input.ts tests/input.test.ts
git commit -m "feat(core): map keyboard input to directions"
git push
```

---

### Task 3: Canvas Wrapper + Game Loop

**Files:**
- Create: `src/core/canvas.ts`
- Test: `tests/canvas.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createLoop(options: { update: (dtMs: number) => void; render: () => void; timing?: LoopTiming }): LoopHandle` where `LoopHandle = { start(): void; stop(): void; isRunning(): boolean }`
  - `LoopTiming = { now(): number; request(cb: FrameRequestCallback): number; cancel(handle: number): void }` (injectable for tests)
  - `MAX_DT_MS = 100` (clamp constant)
  - `createCanvas(el: HTMLElement, width: number, height: number): CanvasHandle` where `CanvasHandle = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; width: number; height: number; destroy(): void }`

- [ ] **Step 1: Write the failing test**

`tests/canvas.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { MAX_DT_MS, createCanvas, createLoop } from '../src/core/canvas';

function fakeTiming() {
  let time = 0;
  let nextHandle = 1;
  let pending: FrameRequestCallback | null = null;
  const canceled: number[] = [];
  return {
    timing: {
      now: () => time,
      request: (cb: FrameRequestCallback) => {
        pending = cb;
        return nextHandle++;
      },
      cancel: (handle: number) => {
        canceled.push(handle);
        pending = null;
      },
    },
    tick(ms: number) {
      time += ms;
      const cb = pending;
      pending = null;
      if (cb) cb(time);
    },
    hasPending: () => pending !== null,
    canceled,
  };
}

describe('createLoop', () => {
  it('calls update then render each frame', () => {
    const fake = fakeTiming();
    const updates: number[] = [];
    const renders: number[] = [];
    const loop = createLoop({
      update: (dt) => updates.push(dt),
      render: () => renders.push(1),
      timing: fake.timing,
    });
    loop.start();
    fake.tick(16);
    fake.tick(16);
    expect(updates).toEqual([16, 16]);
    expect(renders).toEqual([1, 1]);
    expect(loop.isRunning()).toBe(true);
  });

  it('dt clamps to MAX_DT_MS after a long gap', () => {
    const fake = fakeTiming();
    const updates: number[] = [];
    const loop = createLoop({ update: (dt) => updates.push(dt), render: () => {}, timing: fake.timing });
    loop.start();
    fake.tick(5000);
    expect(updates[0]).toBe(MAX_DT_MS);
  });

  it('stop cancels pending frame and halts updates', () => {
    const fake = fakeTiming();
    const updates: number[] = [];
    const loop = createLoop({ update: (dt) => updates.push(dt), render: () => {}, timing: fake.timing });
    loop.start();
    fake.tick(16);
    loop.stop();
    expect(loop.isRunning()).toBe(false);
    expect(fake.hasPending()).toBe(false);
    expect(fake.canceled.length).toBe(1);
    fake.tick(16);
    expect(updates).toHaveLength(1);
  });

  it('double start does not double-schedule', () => {
    const fake = fakeTiming();
    const updates: number[] = [];
    const loop = createLoop({ update: (dt) => updates.push(dt), render: () => {}, timing: fake.timing });
    loop.start();
    loop.start();
    fake.tick(16);
    expect(updates).toHaveLength(1);
  });
});

describe('createCanvas', () => {
  it('appends a canvas with requested size and destroys it', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const host = document.createElement('div');
    const handle = createCanvas(host, 320, 240);
    expect(host.querySelector('canvas')).toBe(handle.canvas);
    expect(handle.canvas.width).toBe(320);
    expect(handle.canvas.height).toBe(240);
    handle.destroy();
    expect(host.querySelector('canvas')).toBeNull();
    vi.restoreAllMocks();
  });

  it('throws a clear error when 2D context is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const host = document.createElement('div');
    expect(() => createCanvas(host, 10, 10)).toThrow('2D context');
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `../src/core/canvas`.

- [ ] **Step 3: Implement loop and canvas wrapper**

`src/core/canvas.ts`:

```ts
export const MAX_DT_MS = 100;

export interface LoopTiming {
  now(): number;
  request(cb: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface LoopHandle {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

const defaultTiming: LoopTiming = {
  now: () => performance.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export function createLoop(options: {
  update: (dtMs: number) => void;
  render: () => void;
  timing?: LoopTiming;
}): LoopHandle {
  const timing = options.timing ?? defaultTiming;
  let running = false;
  let handle: number | null = null;
  let last = 0;

  const frame = (): void => {
    if (!running) return;
    const now = timing.now();
    // Clamp dt so a backgrounded tab does not produce a giant step.
    const dt = Math.min(Math.max(now - last, 0), MAX_DT_MS);
    last = now;
    options.update(dt);
    options.render();
    handle = timing.request(frame);
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      last = timing.now();
      handle = timing.request(frame);
    },
    stop(): void {
      running = false;
      if (handle !== null) {
        timing.cancel(handle);
        handle = null;
      }
    },
    isRunning(): boolean {
      return running;
    },
  };
}

export interface CanvasHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  destroy(): void;
}

export function createCanvas(
  el: HTMLElement,
  width: number,
  height: number,
): CanvasHandle {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.className = 'game-canvas';
  el.append(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    throw new Error('2D context unavailable');
  }

  return {
    canvas,
    ctx,
    width,
    height,
    destroy(): void {
      canvas.remove();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 6 canvas/loop tests green (registry + input still green).

- [ ] **Step 5: Commit**

```bash
git add src/core/canvas.ts tests/canvas.test.ts
git commit -m "feat(core): game loop with dt clamp and canvas wrapper"
git push
```

---

### Task 4: Menu Renderer

**Files:**
- Create: `src/ui/menu.ts`
- Test: `tests/menu.test.ts`

**Interfaces:**
- Consumes: `Game` (Task 1).
- Produces: `renderMenu(container: HTMLElement, games: Game[], onSelect: (game: Game) => void): void` — renders one `<button class="menu-card">` per game, or a `<p class="menu-empty">` empty state. Clears the container first.

- [ ] **Step 1: Write the failing test**

`tests/menu.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../src/core/Game';
import { renderMenu } from '../src/ui/menu';

function fakeGame(id: string, name = id): Game {
  return { id, name, mount: () => {}, unmount: () => {} };
}

describe('renderMenu', () => {
  it('renders one button per game', () => {
    const host = document.createElement('div');
    renderMenu(host, [fakeGame('a', 'Game A'), fakeGame('b', 'Game B')], () => {});
    const buttons = [...host.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Game A', 'Game B']);
  });

  it('calls onSelect with the clicked game', () => {
    const host = document.createElement('div');
    const gameA = fakeGame('a', 'Game A');
    const gameB = fakeGame('b', 'Game B');
    const onSelect = vi.fn();
    renderMenu(host, [gameA, gameB], onSelect);
    const buttons = [...host.querySelectorAll('button')];
    buttons[1]?.click();
    expect(onSelect).toHaveBeenCalledWith(gameB);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('empty state message when no games', () => {
    const host = document.createElement('div');
    renderMenu(host, [], () => {});
    expect(host.querySelector('.menu-empty')?.textContent).toBe(
      'No games registered yet.',
    );
    expect(host.querySelector('button')).toBeNull();
  });

  it('replaces previous content on re-render', () => {
    const host = document.createElement('div');
    renderMenu(host, [fakeGame('a', 'Game A')], () => {});
    renderMenu(host, [fakeGame('b', 'Game B')], () => {});
    const buttons = [...host.querySelectorAll('button')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('Game B');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `../src/ui/menu`.

- [ ] **Step 3: Implement menu renderer**

`src/ui/menu.ts`:

```ts
import type { Game } from '../core/Game';

export function renderMenu(
  container: HTMLElement,
  games: Game[],
  onSelect: (game: Game) => void,
): void {
  container.replaceChildren();

  if (games.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'menu-empty';
    empty.textContent = 'No games registered yet.';
    container.append(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'menu-grid';

  for (const game of games) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-card';
    button.textContent = game.name;
    button.addEventListener('click', () => onSelect(game));
    item.append(button);
    list.append(item);
  }

  container.append(list);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 4 menu tests green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/menu.ts tests/menu.test.ts
git commit -m "feat(ui): render game menu with empty state"
git push
```

---

### Task 5: App Controller Lifecycle

**Files:**
- Create: `src/ui/app.ts`
- Test: `tests/app.test.ts`

**Interfaces:**
- Consumes: `Game` (Task 1), `renderMenu` (Task 4).
- Produces: `createApp(root: HTMLElement): App` where `App = { start(games: Game[]): void; destroy(): void }`. Builds `#menu`, `#stage`, `#back` inside `root`. Selecting a game unmounts any active game first, then mounts into `#stage`. `#back` returns to the menu. `destroy()` unmounts the active game and clears `root`.

- [ ] **Step 1: Write the failing test**

`tests/app.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../src/core/Game';
import { createApp } from '../src/ui/app';

function instrumentedGame(id: string): Game {
  return {
    id,
    name: `Game ${id}`,
    mount: vi.fn(),
    unmount: vi.fn(),
  };
}

function setup() {
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp(root);
  return {
    root,
    app,
    menu: () => root.querySelector('#menu') as HTMLElement,
    stage: () => root.querySelector('#stage') as HTMLElement,
    back: () => root.querySelector('#back') as HTMLButtonElement,
    card: (index: number) =>
      root.querySelectorAll<HTMLButtonElement>('#menu button')[index]!,
  };
}

describe('createApp', () => {
  it('shows empty state when no games', () => {
    const { app, root } = setup();
    app.start([]);
    expect(root.querySelector('.menu-empty')).not.toBeNull();
  });

  it('selecting a game mounts it into the stage and hides the menu', () => {
    const { app, card, menu, stage } = setup();
    const game = instrumentedGame('a');
    app.start([game]);
    card(0).click();
    expect(game.mount).toHaveBeenCalledTimes(1);
    expect(game.mount).toHaveBeenCalledWith(stage());
    expect(menu().hidden).toBe(true);
    expect(stage().hidden).toBe(false);
  });

  it('back unmounts the active game and shows the menu', () => {
    const { app, card, back, menu, stage } = setup();
    const game = instrumentedGame('a');
    app.start([game]);
    card(0).click();
    back().click();
    expect(game.unmount).toHaveBeenCalledTimes(1);
    expect(menu().hidden).toBe(false);
    expect(stage().hidden).toBe(true);
    expect(stage().children).toHaveLength(0);
  });

  it('switching games unmounts the previous one before mounting the next', () => {
    const { app, card, back } = setup();
    const first = instrumentedGame('a');
    const second = instrumentedGame('b');
    app.start([first, second]);
    card(0).click();
    back().click();
    card(1).click();
    expect(first.unmount).toHaveBeenCalledTimes(1);
    expect(second.mount).toHaveBeenCalledTimes(1);
    expect(first.unmount.mock.invocationCallOrder[0]!).toBeLessThan(
      second.mount.mock.invocationCallOrder[0]!,
    );
  });

  it('destroy unmounts the active game', () => {
    const { app, card } = setup();
    const game = instrumentedGame('a');
    app.start([game]);
    card(0).click();
    app.destroy();
    expect(game.unmount).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `../src/ui/app`.

- [ ] **Step 3: Implement app controller**

`src/ui/app.ts`:

```ts
import type { Game } from '../core/Game';
import { renderMenu } from './menu';

export interface App {
  start(games: Game[]): void;
  destroy(): void;
}

export function createApp(root: HTMLElement): App {
  let games: Game[] = [];
  let active: Game | null = null;

  const back = document.createElement('button');
  back.id = 'back';
  back.type = 'button';
  back.textContent = '← Back to menu';
  back.hidden = true;

  const menu = document.createElement('div');
  menu.id = 'menu';

  const stage = document.createElement('div');
  stage.id = 'stage';
  stage.hidden = true;

  root.replaceChildren(back, menu, stage);

  function showMenu(): void {
    if (active) {
      active.unmount();
      active = null;
    }
    stage.replaceChildren();
    stage.hidden = true;
    back.hidden = true;
    menu.hidden = false;
    renderMenu(menu, games, select);
  }

  function select(game: Game): void {
    if (active) {
      active.unmount();
      active = null;
    }
    menu.hidden = true;
    back.hidden = false;
    stage.hidden = false;
    stage.replaceChildren();
    active = game;
    game.mount(stage);
  }

  back.addEventListener('click', showMenu);

  return {
    start(initialGames: Game[]): void {
      games = initialGames;
      showMenu();
    },
    destroy(): void {
      if (active) {
        active.unmount();
        active = null;
      }
      back.removeEventListener('click', showMenu);
      root.replaceChildren();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 5 app tests green (all prior tasks still green).

- [ ] **Step 5: Commit**

```bash
git add src/ui/app.ts tests/app.test.ts
git commit -m "feat(ui): app controller with mount/unmount lifecycle"
git push
```

---

### Task 6: Demo Game, Real Wiring, Docs, Ship Milestone

**Files:**
- Create: `src/games/demo/index.ts`
- Modify: `src/main.ts` (replace placeholder), `src/style.css` (add menu/game styles)
- Create: `README.md`, `docs/add-a-game.md`

**Interfaces:**
- Consumes: `Game`, `registerGame` (Task 1), `createLoop`/`createCanvas` (Task 3), `createApp` (Task 5).
- Produces: registered `demo` game; `main.ts` entry that registers games then starts the app — the template every later game follows.

- [ ] **Step 1: Implement the demo game**

`src/games/demo/index.ts`:

```ts
import type { Game } from '../../core/Game';
import { createCanvas, createLoop } from '../../core/canvas';
import { registerGame } from '../../core/registry';

const SIZE = 320;
const BLOCK = 30;

let cleanup: (() => void) | null = null;

const demo: Game = {
  id: 'demo',
  name: 'Demo Bounce',
  mount(el: HTMLElement): void {
    const { ctx, destroy } = createCanvas(el, SIZE, SIZE);

    let x = 40;
    let y = 40;
    let vx = 140; // px per second
    let vy = 100;

    const loop = createLoop({
      update(dtMs: number): void {
        const s = dtMs / 1000;
        x += vx * s;
        y += vy * s;
        if (x < 0 || x + BLOCK > SIZE) vx = -vx;
        if (y < 0 || y + BLOCK > SIZE) vy = -vy;
      },
      render(): void {
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(x, y, BLOCK, BLOCK);
      },
    });
    loop.start();

    cleanup = (): void => {
      loop.stop();
      destroy();
    };
  },
  unmount(): void {
    cleanup?.();
    cleanup = null;
  },
};

registerGame(demo);
```

- [ ] **Step 2: Replace placeholder main.ts with real wiring**

`src/main.ts`:

```ts
import { listGames } from './core/registry';
import { createApp } from './ui/app';

// Registering games: each game module registers itself on import.
// This is the only place that imports game folders (core/ never does).
import './games/demo';

const root = document.getElementById('app');
if (!root) throw new Error('#app root not found');

const app = createApp(root);
app.start(listGames());
```

- [ ] **Step 3: Add menu and game styles to `src/style.css`**

Append to the existing file:

```css
.menu-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 1rem;
}

.menu-card {
  width: 100%;
  padding: 1.5rem 1rem;
  font-size: 1.1rem;
  border: 1px solid #6b7280;
  border-radius: 0.75rem;
  background: transparent;
  cursor: pointer;
}

.menu-card:hover {
  border-color: #4ade80;
}

.menu-empty {
  color: #6b7280;
}

#stage {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

.game-canvas {
  border: 1px solid #6b7280;
  border-radius: 0.5rem;
  max-width: 100%;
}
```

- [ ] **Step 4: Verify — typecheck, tests, build**

Run: `npm run typecheck && npm test && npm run build`
Expected: all pass.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, open the printed localhost URL.
Expected: menu shows one card "Demo Bounce"; clicking it shows a green square bouncing inside a dark canvas; "← Back to menu" returns to the menu; no errors in the browser console. Stop the dev server when done.

- [ ] **Step 6: Write README.md**

```markdown
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
```

- [ ] **Step 7: Write docs/add-a-game.md**

````markdown
# Adding a game

Every game lives in `src/games/<id>/` and implements the `Game` interface.

## 1. Create `src/games/<id>/index.ts`

```ts
import type { Game } from '../../core/Game';
import { createCanvas, createLoop } from '../../core/canvas';
import { registerGame } from '../../core/registry';

let cleanup: (() => void) | null = null;

const myGame: Game = {
  id: 'my-game', // unique slug
  name: 'My Game', // shown in the menu
  mount(el: HTMLElement): void {
    const { ctx, destroy } = createCanvas(el, 480, 320);
    const loop = createLoop({
      update(dtMs: number) {
        // advance state; dtMs is clamped to 100ms
      },
      render() {
        // draw current state with ctx
      },
    });
    loop.start();
    cleanup = () => {
      loop.stop();
      destroy();
    };
  },
  unmount() {
    cleanup?.();
    cleanup = null;
  },
};

registerGame(myGame);
```

## 2. Import it once in `src/main.ts`

```ts
import './games/my-game';
```

That import line is the **only** change outside your game folder.
`src/core/` must never import from `src/games/`.

## 3. Rules

- All game logic that can be tested (movement, scoring, parsing) goes in
  separate pure modules under `src/games/<id>/` with tests in `tests/`.
- `mount` must clean up everything in `unmount` — listeners, animation
  frames, DOM nodes.
- Run `npm test && npm run build` before pushing; CI must stay green.
````

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: demo game, real app wiring, README and add-a-game docs"
git push
```

- [ ] **Step 9: Open PR and merge**

```bash
gh pr create --title "Milestone 1: core shell + menu skeleton" --body "Game registry, input mapping, game loop, menu UI, app lifecycle, demo game. Closes no issues; implements docs/superpowers/specs/2026-10-12-puzzle-box-design.md."
gh pr merge --merge
git checkout main
git pull
```

Expected: CI green on the PR before merge.

- [ ] **Step 10: Tag the milestone**

```bash
git tag -a v0.1.0 -m "Milestone 1: core shell + menu skeleton"
git push origin v0.1.0
```

Expected: tag visible at https://github.com/quoccc86/puzzle-box/releases/tags/v0.1.0 (as a tag; no release notes needed).

---

## Self-Review Notes (written during plan creation)

- **Spec coverage:** Milestone 1 row of the spec's table = "game loop, canvas wrapper, input, registry, menu skeleton" → Tasks 1–5; spec architecture (`core/` + `games/` plugin rule, CI, demo) → Task 6 + CI file in Task 1. Spec items *not* in this plan (score.ts, audio.ts, Sokoban, solver, README GIF) belong to later milestones — listed under Global Constraints as out of scope.
- **Type consistency checked:** `Game`, `registerGame/getGame/listGames`, `keyToDirection`, `createLoop/createCanvas/MAX_DT_MS`, `renderMenu`, `createApp` — names identical across definition and consumption.
- **Review Focus:** all five lines map to a named test above.
