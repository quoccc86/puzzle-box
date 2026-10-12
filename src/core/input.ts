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
