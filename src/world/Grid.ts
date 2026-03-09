import * as THREE from 'three';
import { Tile } from './Tile';
import { gameConfig } from '../config/gameConfig';
import type { GridCoord } from '../types/grid';

export class Grid {
  readonly scene: THREE.Scene;
  private tiles: Tile[][] = [];
  readonly tileMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const { cols, rows } = gameConfig.grid;

    for (let row = 0; row < rows; row++) {
      this.tiles[row] = [];
      for (let col = 0; col < cols; col++) {
        const tile = new Tile({ col, row });
        this.tiles[row][col] = tile;
        this.tileMeshes.push(tile.mesh);
        scene.add(tile.mesh);
      }
    }
  }

  getTile(coord: GridCoord): Tile | undefined {
    return this.tiles[coord.row]?.[coord.col];
  }

  isValid(coord: GridCoord): boolean {
    const { cols, rows } = gameConfig.grid;
    return coord.col >= 0 && coord.col < cols && coord.row >= 0 && coord.row < rows;
  }

  allTiles(): Tile[] {
    return this.tiles.flat();
  }
}
