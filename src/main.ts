import { Game } from './core/Game';
import { LobbyScreen } from './lobby/LobbyScreen';
import { ThemeSwitcher } from './theme/ThemeSwitcher';
import type { GameMode } from './core/GameMode';

const switcher = new ThemeSwitcher();
void switcher;

const lobby = new LobbyScreen((mode: GameMode) => {
  const game = new Game(mode);
  game.start();
});

// Suppress unused-variable warning — lobby is held to keep the object alive
void lobby;
