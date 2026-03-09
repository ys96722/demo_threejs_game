import type { GridCoord } from './grid';

export interface SkillDef {
  name: string;
  range: number;
}

export interface CharacterConfig {
  playerIndex: number;
  name: string;
  startCoord: GridCoord;
  moveRange: number;
  spritePath: string;
  hp: number;
  strength: number;
  intellect: number;
  defense: number;
  resistance: number;
  attackRange: number;
  skills: SkillDef[];
}
