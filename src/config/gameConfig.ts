import type { CharacterConfig } from '../types/characters';

export const characters: CharacterConfig[] = [
  { playerIndex: 1, name: 'Seonjae', startCoord: { col: 1, row: 1 }, moveRange: 6, spritePath: '/textures/seonjae_base.png' },
  { playerIndex: 2, name: 'Mina',    startCoord: { col: 6, row: 6 }, moveRange: 4, spritePath: '/textures/mina_base.png' },
];

export const gameConfig = {
  character: {
    spriteScale: 2.0,
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
  scene: {
    background:         0x030712,
    fogColor:           0x030712,
    fogNear:            14,
    fogFar:             32,
    ambientIntensity:   0.35,
    dirLightIntensity:  1.1,
  },
} as const;
