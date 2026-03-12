import type { CharacterConfig } from '../types/characters';
import type { GridCoord } from '../types/grid';
import type { BoardType } from '../core/GameMode';
import { SKILL_NAMES } from '../types/skills';

export const characters: CharacterConfig[] = [
  // Team 1
  { playerIndex: 1, team: 1, name: 'Seonjae', startCoord: { col: 1, row: 1 }, moveRange: 6, spritePath: '/textures/seonjae_base.png', hp: 100, strength: 10, intellect: 8, defense: 1, resistance: 1, attackRange: 2, skills: [{ name: SKILL_NAMES.REVEILLE, range: 3, targetType: 'ally' as const }] },
  { playerIndex: 3, team: 1, name: 'Aerin',   startCoord: { col: 1, row: 3 }, moveRange: 5, spritePath: '/textures/aerin_base.png',   hp: 90,  strength: 7,  intellect: 3, defense: 3, resistance: 2, attackRange: 1, skills: [] },
  // Team 2
  { playerIndex: 2, team: 2, name: 'Mina',    startCoord: { col: 8, row: 6 }, moveRange: 4, spritePath: '/textures/mina_base.png',    hp: 100, strength: 1,  intellect: 1, defense: 1, resistance: 1, attackRange: 1, skills: [{ name: SKILL_NAMES.ABRAZO, range: 3, targetType: 'any' as const }] },
  { playerIndex: 4, team: 2, name: 'Isma',    startCoord: { col: 8, row: 8 }, moveRange: 3, spritePath: '/textures/isma_base.png',    hp: 130, strength: 4,  intellect: 5, defense: 5, resistance: 4, attackRange: 1, skills: [] },
];

export const gameConfig = {
  character: {
    spriteScale: 2.5,
    glowScale: 1.25,
    healthBarWidth: 1.2,
    healthBarHeight: 0.15,
    tokenRadius: 8,
  },
  grid: {
    cols: 10, // 8
    rows: 10, // 8
    tileSize: 1.0,
    tileGap: 0.04,
    tileHeight: 0.12,
  },
  camera: {
    frustumSize: 14,
    elevation: 80, // 60
    azimuth: 0, // 45
    near: 0.1,
    far: 100,
    dist: 20,
  },
  movement: {
    animationDuration: 0.8, // 0.35
    hopHeight: 0.3,
  },
  vfx: {
    idleBobSpeed:       1.8,
    idleBobAmplitude:   1, // 0.04
    bloomStrength:      0.15,
    bloomRadius:        0.2,
    bloomThreshold:     0.65,
  },
  audio: {
    gain: 0.25,
  },
  scene: {
    background:         0x030712,
    fogColor:           0x030712,
    fogNear:            14,
    fogFar:             32,
    ambientIntensity:   0.35,
    dirLightIntensity:  1.1,
  },
} as const;

// ---------------------------------------------------------------------------
// Board configs — keyed by BoardType
// ---------------------------------------------------------------------------

export const BOARD_CONFIGS: Record<BoardType, {
  cols: number; rows: number; tileSize: number; tileHeight: number; tileGap: number;
}> = {
  tactical: { cols: 10, rows: 10, tileSize: 1.0, tileHeight: 0.12, tileGap: 0.04 },
  go:       { cols: 9,  rows: 9,  tileSize: 1.0, tileHeight: 0.03, tileGap: 0.04 },
};

export const teamSpawnCoords: Record<number, GridCoord> = {
  1: { col: 1, row: 1 },
  2: { col: 8, row: 6 },
};

// Warm palette for the Go board (light/dark tile colors)
export const GO_TILE_COLORS = {
  light: 0x8B6914,
  dark:  0x6B4E10,
} as const;
