import type { GridCoord } from './grid';

export type SkillTargetType = 'enemy' | 'ally' | 'any';

export type EffectPreview =
  | { type: 'damage'; amount: number }
  | { type: 'heal'; amount: number }
  | { type: 'buff'; stat: string; amount: number }
  | { type: 'displace'; dc: number; dr: number };

export interface SkillDef {
  name: string;
  range: number;
  targetType: SkillTargetType;
}

export interface CharacterConfig {
  playerIndex: number; // unique per character — used as character ID in events and maps
  team: number;        // which side (1 or 2) — used for turn management and enemy detection
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
