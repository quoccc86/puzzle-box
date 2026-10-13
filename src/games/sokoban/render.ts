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
