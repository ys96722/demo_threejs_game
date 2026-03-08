import * as THREE from 'three';
import { bus } from '../core/EventBus';
import { EVENTS } from '../types/events';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    const observer = new ResizeObserver(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.renderer.setSize(w, h);
      bus.emit(EVENTS.RENDERER_RESIZED, { width: w, height: h });
    });
    observer.observe(document.body);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }
}
