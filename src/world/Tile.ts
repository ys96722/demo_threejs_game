import * as THREE from 'three';
import type { GridCoord } from '../types/grid';
import { TileState } from '../types/grid';
import { gameConfig } from '../config/gameConfig';
import { gridVisuals } from './GridVisuals';

export class Tile {
  readonly coord: GridCoord;
  readonly mesh: THREE.Mesh;
  private _state: TileState = TileState.Default;
  readonly isDark: boolean;

  constructor(coord: GridCoord) {
    this.coord = coord;
    this.isDark = (coord.col + coord.row) % 2 === 1;

    const { tileSize, tileHeight } = gameConfig.grid;
    const geo = new THREE.BoxGeometry(tileSize, tileHeight, tileSize);
    const mat = gridVisuals.getMaterial(TileState.Default, this.isDark);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.userData['tile'] = this;

    const worldPos = Tile.gridToWorld(coord);
    this.mesh.position.set(worldPos.x, 0, worldPos.z);
  }

  get state(): TileState {
    return this._state;
  }

  setState(state: TileState): void {
    this._state = state;
    this.mesh.material = gridVisuals.getMaterial(state, this.isDark);
  }

  static gridToWorld(coord: GridCoord): THREE.Vector3 {
    const { tileSize, tileGap } = gameConfig.grid;
    const step = tileSize + tileGap;
    const cols = gameConfig.grid.cols;
    const rows = gameConfig.grid.rows;
    return new THREE.Vector3(
      (coord.col - (cols - 1) / 2) * step,
      0,
      (coord.row - (rows - 1) / 2) * step
    );
  }
}
