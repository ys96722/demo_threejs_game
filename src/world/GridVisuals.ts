import * as THREE from 'three';
import { TileState } from '../types/grid';

export const TILE_COLORS_LIGHT: Record<TileState, number> = {
  [TileState.Default]:         0x2d3f5c,
  [TileState.Hover]:           0x4a90d9,
  [TileState.Selected]:        0xf08844,
  [TileState.Occupied]:        0x3b6fa0,
  [TileState.Reachable]:       0x2d6e3e,
  [TileState.AttackRange]:     0x1a3a6e,
  [TileState.ReachableAttack]: 0x2d5e6e,
};

export const TILE_COLORS_DARK: Partial<Record<TileState, number>> = {
  [TileState.Default]:  0x1a2638,
};

class GridVisuals {
  private materials: Map<string, THREE.MeshToonMaterial> = new Map();

  getMaterial(state: TileState, isDark: boolean): THREE.MeshToonMaterial {
    const key = `${state}-${isDark ? 'dark' : 'light'}`;
    if (!this.materials.has(key)) {
      const colorHex = isDark ? (TILE_COLORS_DARK[state] ?? TILE_COLORS_LIGHT[state]) : TILE_COLORS_LIGHT[state];
      const mat = new THREE.MeshToonMaterial({ color: new THREE.Color(colorHex) });
      this.materials.set(key, mat);
    }
    return this.materials.get(key)!;
  }

  applyTheme(light: Record<TileState, number>, dark: Partial<Record<TileState, number>>): void {
    for (const [key, mat] of this.materials) {
      const isDark = key.endsWith('-dark');
      const stateKey = (isDark ? key.slice(0, -5) : key.slice(0, -6)) as TileState;
      mat.color.setHex(isDark ? (dark[stateKey] ?? light[stateKey]) : light[stateKey]);
    }
  }

  dispose(): void {
    this.materials.forEach((mat) => mat.dispose());
    this.materials.clear();
  }
}

export const gridVisuals = new GridVisuals();
