import * as THREE from 'three';
import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import type { GridCoord } from '../types/grid';

export class InputManager {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hoveredCoord: GridCoord | null = null;
  private tileMeshes: THREE.Mesh[];
  private camera: THREE.Camera;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, camera: THREE.Camera, tileMeshes: THREE.Mesh[]) {
    this.canvas = canvas;
    this.camera = camera;
    this.tileMeshes = tileMeshes;

    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('click', this.onClick);
  }

  private toNDC(e: MouseEvent): void {
    this.pointer.x = (e.offsetX / this.canvas.clientWidth) * 2 - 1;
    this.pointer.y = -(e.offsetY / this.canvas.clientHeight) * 2 + 1;
  }

  private getTileAtPointer(): { coord: GridCoord } | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.tileMeshes);
    if (hits.length === 0) return null;
    const tile = hits[0].object.userData['tile'];
    if (!tile) return null;
    return { coord: tile.coord as GridCoord };
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.toNDC(e);
    const result = this.getTileAtPointer();
    const newCoord = result?.coord ?? null;

    const prevCoord = this.hoveredCoord;

    if (prevCoord && (!newCoord || prevCoord.col !== newCoord.col || prevCoord.row !== newCoord.row)) {
      bus.emit(EVENTS.TILE_HOVER_EXIT, { coord: prevCoord });
    }

    if (newCoord && (!prevCoord || prevCoord.col !== newCoord.col || prevCoord.row !== newCoord.row)) {
      bus.emit(EVENTS.TILE_HOVER_ENTER, { coord: newCoord });
    }

    this.hoveredCoord = newCoord;
  };

  private onClick = (e: MouseEvent): void => {
    this.toNDC(e);
    const result = this.getTileAtPointer();
    if (result) {
      bus.emit(EVENTS.TILE_CLICKED, { coord: result.coord });
    } else {
      bus.emit(EVENTS.CANVAS_CLICKED_EMPTY, {});
    }
  };

  dispose(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('click', this.onClick);
  }
}
