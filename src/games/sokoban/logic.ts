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
  if (state.boxes.size !== state.targets.size) return false;
  for (const target of state.targets) {
    if (!state.boxes.has(target)) return false;
  }
  return true;
}
