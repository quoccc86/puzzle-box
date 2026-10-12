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
