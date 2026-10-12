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
