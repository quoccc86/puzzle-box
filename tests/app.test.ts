import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../src/core/Game';
import { createApp } from '../src/ui/app';

function instrumentedGame(id: string) {
  return {
    id,
    name: `Game ${id}`,
    mount: vi.fn(),
    unmount: vi.fn(),
  };
}

function setup() {
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp(root);
  return {
    root,
    app,
    menu: () => root.querySelector('#menu') as HTMLElement,
    stage: () => root.querySelector('#stage') as HTMLElement,
    back: () => root.querySelector('#back') as HTMLButtonElement,
    card: (index: number) =>
      root.querySelectorAll<HTMLButtonElement>('#menu button')[index]!,
  };
}

describe('createApp', () => {
  it('shows empty state when no games', () => {
    const { app, root } = setup();
    app.start([]);
    expect(root.querySelector('.menu-empty')).not.toBeNull();
  });

  it('selecting a game mounts it into the stage and hides the menu', () => {
    const { app, card, menu, stage } = setup();
    const game = instrumentedGame('a');
    app.start([game]);
    card(0).click();
    expect(game.mount).toHaveBeenCalledTimes(1);
    expect(game.mount).toHaveBeenCalledWith(stage());
    expect(menu().hidden).toBe(true);
    expect(stage().hidden).toBe(false);
  });

  it('back unmounts the active game and shows the menu', () => {
    const { app, card, back, menu, stage } = setup();
    const game = instrumentedGame('a');
    app.start([game]);
    card(0).click();
    back().click();
    expect(game.unmount).toHaveBeenCalledTimes(1);
    expect(menu().hidden).toBe(false);
    expect(stage().hidden).toBe(true);
    expect(stage().children).toHaveLength(0);
  });

  it('switching games unmounts the previous one before mounting the next', () => {
    const { app, card, back } = setup();
    const first = instrumentedGame('a');
    const second = instrumentedGame('b');
    app.start([first, second]);
    card(0).click();
    back().click();
    card(1).click();
    expect(first.unmount).toHaveBeenCalledTimes(1);
    expect(second.mount).toHaveBeenCalledTimes(1);
    expect(first.unmount.mock.invocationCallOrder[0]!).toBeLessThan(
      second.mount.mock.invocationCallOrder[0]!,
    );
  });

  it('destroy unmounts the active game', () => {
    const { app, card } = setup();
    const game = instrumentedGame('a');
    app.start([game]);
    card(0).click();
    app.destroy();
    expect(game.unmount).toHaveBeenCalledTimes(1);
  });
});
