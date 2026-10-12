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
    const loop = createLoop({
      update: (dt) => updates.push(dt),
      render: () => {},
      timing: fake.timing,
    });
    loop.start();
    fake.tick(5000);
    expect(updates[0]).toBe(MAX_DT_MS);
  });

  it('stop cancels pending frame and halts updates', () => {
    const fake = fakeTiming();
    const updates: number[] = [];
    const loop = createLoop({
      update: (dt) => updates.push(dt),
      render: () => {},
      timing: fake.timing,
    });
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
    const loop = createLoop({
      update: (dt) => updates.push(dt),
      render: () => {},
      timing: fake.timing,
    });
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
