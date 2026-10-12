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
