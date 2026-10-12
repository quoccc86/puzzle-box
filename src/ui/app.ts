import type { Game } from '../core/Game';
import { renderMenu } from './menu';

export interface App {
  start(games: Game[]): void;
  destroy(): void;
}

export function createApp(root: HTMLElement): App {
  let games: Game[] = [];
  let active: Game | null = null;

  const back = document.createElement('button');
  back.id = 'back';
  back.type = 'button';
  back.textContent = '← Back to menu';
  back.hidden = true;

  const menu = document.createElement('div');
  menu.id = 'menu';

  const stage = document.createElement('div');
  stage.id = 'stage';
  stage.hidden = true;

  root.replaceChildren(back, menu, stage);

  function showMenu(): void {
    if (active) {
      active.unmount();
      active = null;
    }
    stage.replaceChildren();
    stage.hidden = true;
    back.hidden = true;
    menu.hidden = false;
    renderMenu(menu, games, select);
  }

  function select(game: Game): void {
    if (active) {
      active.unmount();
      active = null;
    }
    menu.hidden = true;
    back.hidden = false;
    stage.hidden = false;
    stage.replaceChildren();
    active = game;
    game.mount(stage);
  }

  back.addEventListener('click', showMenu);

  return {
    start(initialGames: Game[]): void {
      games = initialGames;
      showMenu();
    },
    destroy(): void {
      if (active) {
        active.unmount();
        active = null;
      }
      back.removeEventListener('click', showMenu);
      root.replaceChildren();
    },
  };
}
