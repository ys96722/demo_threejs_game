import type { GridCoord } from './grid';

export interface CharacterConfig {
  playerIndex: number;
  name: string;
  startCoord: GridCoord;
  moveRange: number;
  spritePath: string;
}
