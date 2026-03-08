import * as THREE from 'three';
import { TileState } from '../types/grid';

const TILE_COLORS_LIGHT: Record<TileState, number> = {
  [TileState.Default]:  0xa8c48a,
  [TileState.Hover]:    0xf0e070,
  [TileState.Selected]: 0xf08844,
  [TileState.Occupied]: 0xe8b84a,
};

const TILE_COLORS_DARK: Partial<Record<TileState, number>> = {
  [TileState.Default]: 0x7a9e62,
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

  dispose(): void {
    this.materials.forEach((mat) => mat.dispose());
    this.materials.clear();
  }
}

export const gridVisuals = new GridVisuals();
