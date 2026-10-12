import type { Game } from '../core/Game';

export function renderMenu(
  container: HTMLElement,
  games: Game[],
  onSelect: (game: Game) => void,
): void {
  container.replaceChildren();

  if (games.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'menu-empty';
    empty.textContent = 'No games registered yet.';
    container.append(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'menu-grid';

  for (const game of games) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-card';
    button.textContent = game.name;
    button.addEventListener('click', () => onSelect(game));
    item.append(button);
    list.append(item);
  }

  container.append(list);
}
