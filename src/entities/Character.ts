import * as THREE from 'three';
import { Tile } from '../world/Tile';
import { CharacterAnimator } from './CharacterAnimator';
import type { GridCoord } from '../types/grid';
import type { PlayerIndex } from '../core/TurnManager';
import { gameConfig } from '../config/gameConfig';
import {
  makeShoes, makeLegs, makeCape, makeTorso, makeArms,
  makeHead, makeEyes, makeHairP1, makeHairP2,
  makeEnergyBlade, makeSlashRing, makeSparkles,
  makeAuraSphere, makeArcaneRing,
} from './characterParts';

export class Character {
  readonly playerIndex: PlayerIndex;
  readonly group: THREE.Group;
  private animator: CharacterAnimator;
  coord: GridCoord;
  onMoveComplete: ((coord: GridCoord) => void) | null = null;

  private idleTime = 0;
  private slashRing:        THREE.Mesh   | null = null;
  private weaponGroup:      THREE.Group  | null = null;
  private sparklesPoints:   THREE.Points | null = null;
  private sparklePositions: Float32Array | null = null;
  private sparkleVelocities: Float32Array | null = null;
  private auraInner:  THREE.Mesh | null = null;
  private auraOuter:  THREE.Mesh | null = null;
  private arcaneRing: THREE.Mesh | null = null;

  constructor(playerIndex: PlayerIndex, startCoord: GridCoord) {
    this.playerIndex = playerIndex;
    this.coord = startCoord;
    this.group = new THREE.Group();
    this.animator = new CharacterAnimator();

    const tileTop = gameConfig.grid.tileHeight / 2;
    const isP2 = playerIndex === 2;

    const legColor   = isP2 ? 0x5a1f1f : 0x3a2e5a;
    const capeColor  = isP2 ? 0x7a1f1f : 0x4a1f7a;
    const torsoColor = isP2 ? 0xb82a2a : 0x2a5cb8;
    const shoeColor  = 0x2c1810;

    // Body parts
    this.group.add(makeShoes(tileTop, shoeColor));
    this.group.add(makeLegs(tileTop, legColor));
    this.group.add(makeCape(tileTop, capeColor));
    this.group.add(makeTorso(tileTop, torsoColor));
    this.group.add(makeArms(tileTop, torsoColor));
    this.group.add(makeHead(tileTop));
    this.group.add(makeEyes(tileTop));
    this.group.add(isP2 ? makeHairP2(tileTop) : makeHairP1(tileTop));

    if (!isP2) {
      // P1 — Fighter (blue)
      this.weaponGroup = makeEnergyBlade(tileTop);
      this.group.add(this.weaponGroup);

      this.slashRing = makeSlashRing();
      this.slashRing.position.set(0, tileTop + 0.05, 0);
      this.group.add(this.slashRing);

      const sparkleColor = 0x60a5fa;
      const { points, positions, velocities } = makeSparkles(32, sparkleColor);
      this.sparklesPoints = points;
      this.sparklePositions = positions;
      this.sparkleVelocities = velocities;
      this.group.add(this.sparklesPoints);
    } else {
      // P2 — Caster (violet)
      const { inner, outer } = makeAuraSphere(tileTop);
      this.auraInner = inner;
      this.auraOuter = outer;
      this.group.add(this.auraInner, this.auraOuter);

      this.arcaneRing = makeArcaneRing();
      this.arcaneRing.position.set(0, tileTop + 0.05, 0);
      this.group.add(this.arcaneRing);

      const sparkleColor = 0xf0abfc;
      const { points, positions, velocities } = makeSparkles(32, sparkleColor);
      this.sparklesPoints = points;
      this.sparklePositions = positions;
      this.sparkleVelocities = velocities;
      this.group.add(this.sparklesPoints);
    }

    const worldPos = Tile.gridToWorld(startCoord);
    this.group.position.set(worldPos.x, 0, worldPos.z);

    this.animator.onComplete = () => {
      this.onMoveComplete?.(this.coord);
    };
  }

  moveTo(coord: GridCoord): void {
    if (this.animator.isPlaying) return;
    const target = Tile.gridToWorld(coord);
    const from = this.group.position.clone();
    from.y = 0;
    this.coord = coord;
    this.animator.start(from, target);
  }

  update(dt: number): void {
    if (this.animator.isPlaying) {
      this.animator.update(this.group.position, dt);
    } else {
      this.idleTime += dt;
      this.group.position.y =
        Math.sin(this.idleTime * gameConfig.vfx.idleBobSpeed) * gameConfig.vfx.idleBobAmplitude;
    }
    this.updateVfx(dt);
  }

  private updateVfx(dt: number): void {
    const t = performance.now() / 1000;

    if (this.slashRing) {
      this.slashRing.rotation.z += dt * gameConfig.vfx.slashRingSpeed;
      const pulse = 0.9 + 0.1 * Math.sin(t * 4);
      this.slashRing.scale.setScalar(pulse);
    }

    if (this.arcaneRing) {
      this.arcaneRing.rotation.z -= dt * gameConfig.vfx.slashRingSpeed;
      const pulse = 0.9 + 0.1 * Math.sin(t * 4);
      this.arcaneRing.scale.setScalar(pulse);
    }

    if (this.auraInner) {
      (this.auraInner.material as THREE.MeshToonMaterial).opacity =
        0.10 + 0.08 * Math.sin(t * 2.5);
    }

    if (this.sparklePositions && this.sparkleVelocities && this.sparklesPoints) {
      const count = this.sparkleVelocities.length;
      for (let i = 0; i < count; i++) {
        this.sparklePositions[i * 3 + 1] += this.sparkleVelocities[i] * dt;
        if (this.sparklePositions[i * 3 + 1] > 1.4) {
          this.sparklePositions[i * 3 + 1] = 0;
        }
      }
      (this.sparklesPoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}
