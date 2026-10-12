export interface Game {
  /** Unique slug, e.g. 'sokoban'. Used as the registry key. */
  id: string;
  /** Display name shown in the menu. */
  name: string;
  /** Attach the game's canvas/HUD into the given element. */
  mount(el: HTMLElement): void;
  /** Release listeners, animation frames, and DOM owned by this game. */
  unmount(): void;
}
