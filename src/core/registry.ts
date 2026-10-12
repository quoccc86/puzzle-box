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
