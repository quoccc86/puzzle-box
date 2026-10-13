import { LEVELS } from './levels';

export interface SokobanState {
  width: number;
  height: number;
  walls: Set<number>;
  floors: Set<number>;
  targets: Set<number>;
  boxes: Set<number>;
  player: number;
  moves: number;
}

/** Parse one char-per-cell level text into Sokoban state. Throws on malformed input. */
export function parseLevel(text: string): SokobanState {
  const rows = text.split('\n');
  if (rows.length === 0 || text.trim() === '') {
    throw new Error('Level is empty');
  }

  const width = rows[0]!.length;
  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(`Level rows must all have the same width (${width})`);
    }
  }

  const walls = new Set<number>();
  const floors = new Set<number>();
  const targets = new Set<number>();
  const boxes = new Set<number>();
  const players: number[] = [];

  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const cell = row[x]!;
      if (!'# .$*@+'.includes(cell)) {
        throw new Error(`Level contains invalid character '${cell}' at row ${y + 1}, column ${x + 1}`);
      }
      const isWall = cell === '#';
      if (isWall) walls.add(index);
      else floors.add(index);

      switch (cell) {
        case '.':
          targets.add(index);
          break;
        case '$':
          boxes.add(index);
          break;
        case '*':
          targets.add(index);
          boxes.add(index);
          break;
        case '@':
          players.push(index);
          break;
        case '+':
          players.push(index);
          targets.add(index);
          break;
        default:
          break;
      }
    }
  });

  if (players.length === 0) throw new Error('Level must contain a player');
  if (players.length > 1) throw new Error('Level must contain exactly one player');
  if (boxes.size === 0) throw new Error('Level must contain at least one box');
  if (targets.size === 0) throw new Error('Level must contain at least one target');

  return {
    width,
    height: rows.length,
    walls,
    floors,
    targets,
    boxes,
    player: players[0]!,
    moves: 0,
  };
}

export { LEVELS } from './levels';
