import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../src/core/Game';
import { renderMenu } from '../src/ui/menu';

function fakeGame(id: string, name = id): Game {
  return { id, name, mount: () => {}, unmount: () => {} };
}

describe('renderMenu', () => {
  it('renders one button per game', () => {
    const host = document.createElement('div');
    renderMenu(host, [fakeGame('a', 'Game A'), fakeGame('b', 'Game B')], () => {});
    const buttons = [...host.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Game A', 'Game B']);
  });

  it('calls onSelect with the clicked game', () => {
    const host = document.createElement('div');
    const gameA = fakeGame('a', 'Game A');
    const gameB = fakeGame('b', 'Game B');
    const onSelect = vi.fn();
    renderMenu(host, [gameA, gameB], onSelect);
    const buttons = [...host.querySelectorAll('button')];
    buttons[1]?.click();
    expect(onSelect).toHaveBeenCalledWith(gameB);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('empty state message when no games', () => {
    const host = document.createElement('div');
    renderMenu(host, [], () => {});
    expect(host.querySelector('.menu-empty')?.textContent).toBe(
      'No games registered yet.',
    );
    expect(host.querySelector('button')).toBeNull();
  });

  it('replaces previous content on re-render', () => {
    const host = document.createElement('div');
    renderMenu(host, [fakeGame('a', 'Game A')], () => {});
    renderMenu(host, [fakeGame('b', 'Game B')], () => {});
    const buttons = [...host.querySelectorAll('button')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('Game B');
  });
});
