import { Game } from './core/Game';
import { LobbyScreen } from './lobby/LobbyScreen';
import { SettingsPanel } from './ui/SettingsPanel';
import type { GameMode } from './core/GameMode';

new SettingsPanel();

const lobby = new LobbyScreen((mode: GameMode) => {
  const game = new Game(mode);
  game.start();
  lobby.dispose();
});
