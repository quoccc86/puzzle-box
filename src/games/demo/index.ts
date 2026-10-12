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
