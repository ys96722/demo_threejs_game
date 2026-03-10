import * as THREE from 'three';
import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';
import { gameConfig } from '../config/gameConfig';

export class CameraController {
  readonly camera: THREE.OrthographicCamera;

  private readonly _onResize = ({ width, height }: { width: number; height: number }): void => {
    this.updateFrustum(width / height);
  };

  constructor() {
    const { frustumSize, elevation, azimuth, near, far } = gameConfig.camera;
    const aspect = window.innerWidth / window.innerHeight;

    this.camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      near,
      far
    );

    this.positionCamera(elevation, azimuth);

    bus.on(EVENTS.RENDERER_RESIZED, this._onResize);
  }

  dispose(): void {
    bus.off(EVENTS.RENDERER_RESIZED, this._onResize);
  }

  private positionCamera(elevationDeg: number, azimuthDeg: number): void {
    const elRad = THREE.MathUtils.degToRad(elevationDeg);
    const azRad = THREE.MathUtils.degToRad(azimuthDeg);
    const dist = gameConfig.camera.dist;

    this.camera.position.set(
      dist * Math.cos(elRad) * Math.sin(azRad),
      dist * Math.sin(elRad),
      dist * Math.cos(elRad) * Math.cos(azRad)
    );
    this.camera.lookAt(0, 0, 0);
  }

  private updateFrustum(aspect: number): void {
    const { frustumSize } = gameConfig.camera;
    this.camera.left = (-frustumSize * aspect) / 2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }
}
