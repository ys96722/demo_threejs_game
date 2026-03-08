import * as THREE from 'three';
import { Tile } from '../world/Tile';
import { CharacterAnimator } from './CharacterAnimator';
import type { GridCoord } from '../types/grid';
import { gameConfig } from '../config/gameConfig';

export class Character {
  readonly group: THREE.Group;
  private animator: CharacterAnimator;
  coord: GridCoord;
  onMoveComplete: ((coord: GridCoord) => void) | null = null;

  constructor(startCoord: GridCoord) {
    this.coord = startCoord;
    this.group = new THREE.Group();
    this.animator = new CharacterAnimator();

    const tileTop = gameConfig.grid.tileHeight / 2;

    const makeMesh = (geo: THREE.BufferGeometry, color: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color }));
      mesh.castShadow = true;
      return mesh;
    };

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(0.09, 0.07, 0.12);
    const shoeL = makeMesh(shoeGeo, 0x2c1810);
    shoeL.position.set(-0.09, tileTop + 0.095, 0);
    const shoeR = makeMesh(shoeGeo, 0x2c1810);
    shoeR.position.set(0.09, tileTop + 0.095, 0);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.10, 0.18, 0.12);
    const legL = makeMesh(legGeo, 0x3a2e5a);
    legL.position.set(-0.09, tileTop + 0.235, 0);
    const legR = makeMesh(legGeo, 0x3a2e5a);
    legR.position.set(0.09, tileTop + 0.235, 0);

    // Cape (behind torso)
    const cape = makeMesh(new THREE.BoxGeometry(0.30, 0.32, 0.04), 0x4a1f7a);
    cape.position.set(0, tileTop + 0.45, -0.10);

    // Torso
    const torso = makeMesh(new THREE.BoxGeometry(0.28, 0.28, 0.16), 0x2a5cb8);
    torso.position.set(0, tileTop + 0.43, 0);

    // Head
    const head = makeMesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), 0xe5c49a);
    head.position.set(0, tileTop + 0.72, 0);

    // Hair
    const hair = makeMesh(new THREE.BoxGeometry(0.26, 0.10, 0.20), 0xc87820);
    hair.position.set(0, tileTop + 0.845, 0);

    this.group.add(shoeL, shoeR, legL, legR, cape, torso, head, hair);

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
    this.animator.update(this.group.position, dt);
  }
}
