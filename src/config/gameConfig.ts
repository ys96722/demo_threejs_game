export const gameConfig = {
  grid: {
    cols: 8,
    rows: 8,
    tileSize: 1.0,
    tileGap: 0.04,
    tileHeight: 0.12,
  },
  camera: {
    frustumSize: 14,
    elevation: 60,
    azimuth: 45,
    near: 0.1,
    far: 100,
  },
  movement: {
    animationDuration: 0.35,
    hopHeight: 0.3,
  },
} as const;
