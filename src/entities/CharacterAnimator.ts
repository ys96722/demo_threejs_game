import * as THREE from 'three';
import { gameConfig } from '../config/gameConfig';

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export class CharacterAnimator {
  private startPos = new THREE.Vector3();
  private endPos = new THREE.Vector3();
  private elapsed = 0;
  private duration = 0;
  private active = false;
  onComplete: (() => void) | null = null;

  get isPlaying(): boolean {
    return this.active;
  }

  start(from: THREE.Vector3, to: THREE.Vector3): void {
    this.startPos.copy(from);
    this.endPos.copy(to);
    this.elapsed = 0;
    this.duration = gameConfig.movement.animationDuration;
    this.active = true;
  }

  update(position: THREE.Vector3, dt: number): void {
    if (!this.active) return;

    this.elapsed += dt;
    const t = Math.min(this.elapsed / this.duration, 1);
    const eased = easeInOutQuad(t);

    position.lerpVectors(this.startPos, this.endPos, eased);
    position.y = gameConfig.movement.hopHeight * Math.sin(t * Math.PI);

    if (t >= 1) {
      this.active = false;
      position.copy(this.endPos);
      position.y = 0;
      this.onComplete?.();
    }
  }
}
