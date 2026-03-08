import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function toonMesh(geo: THREE.BufferGeometry, color: number, extra?: Partial<THREE.MeshToonMaterialParameters>): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color, ...extra }));
  mesh.castShadow = true;
  return mesh;
}

export function makeShoes(tileTop: number, color: number): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.CapsuleGeometry(0.045, 0.08, 4, 8);
  const shoeL = toonMesh(geo, color);
  shoeL.geometry.rotateZ(Math.PI / 2);
  shoeL.position.set(-0.10, tileTop + 0.07, 0.01);
  const shoeR = toonMesh(geo, color);
  shoeR.geometry.rotateZ(Math.PI / 2);
  shoeR.position.set(0.10, tileTop + 0.07, 0.01);
  group.add(shoeL, shoeR);
  return group;
}

export function makeLegs(tileTop: number, color: number): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.CapsuleGeometry(0.055, 0.16, 4, 8);
  const legL = toonMesh(geo, color);
  legL.position.set(-0.10, tileTop + 0.22, 0);
  const legR = toonMesh(geo, color);
  legR.position.set(0.10, tileTop + 0.22, 0);
  group.add(legL, legR);
  return group;
}

export function makeCape(tileTop: number, color: number): THREE.Mesh {
  const mesh = toonMesh(new THREE.BoxGeometry(0.30, 0.32, 0.04), color);
  mesh.position.set(0, tileTop + 0.45, -0.10);
  return mesh;
}

export function makeTorso(tileTop: number, color: number): THREE.Mesh {
  const mesh = toonMesh(new RoundedBoxGeometry(0.28, 0.26, 0.16, 4, 0.04), color);
  mesh.position.set(0, tileTop + 0.43, 0);
  return mesh;
}

export function makeArms(tileTop: number, color: number): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.CapsuleGeometry(0.045, 0.18, 4, 8);
  const armL = toonMesh(geo, color);
  armL.position.set(-0.175, tileTop + 0.42, 0);
  const armR = toonMesh(geo, color);
  armR.position.set(0.175, tileTop + 0.42, 0);
  group.add(armL, armR);
  return group;
}

export function makeHead(tileTop: number): THREE.Mesh {
  const mesh = toonMesh(new THREE.SphereGeometry(0.13, 16, 12), 0xe5c49a);
  mesh.position.set(0, tileTop + 0.70, 0);
  return mesh;
}

export function makeEyes(tileTop: number): THREE.Group {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e, depthTest: false });
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });

  // Left iris
  const irisL = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.05), baseMat);
  irisL.position.set(-0.045, tileTop + 0.71, 0.131);
  irisL.renderOrder = 1;
  // Right iris
  const irisR = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.05), baseMat);
  irisR.position.set(0.045, tileTop + 0.71, 0.131);
  irisR.renderOrder = 1;
  // Left highlight
  const hlL = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.015), hlMat);
  hlL.position.set(-0.035, tileTop + 0.725, 0.132);
  hlL.renderOrder = 1;
  // Right highlight
  const hlR = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.015), hlMat);
  hlR.position.set(0.055, tileTop + 0.725, 0.132);
  hlR.renderOrder = 1;

  group.add(irisL, irisR, hlL, hlR);
  return group;
}

export function makeHairP1(tileTop: number): THREE.Group {
  const group = new THREE.Group();
  const color = 0x1a1010;
  const offsets: [number, number, number, number][] = [
    [0,     tileTop + 0.84, 0,     0.10],
    [-0.07, tileTop + 0.88, 0.02,  0.07],
    [0.07,  tileTop + 0.87, 0.02,  0.07],
    [-0.12, tileTop + 0.82, 0,     0.05],
    [0.12,  tileTop + 0.82, 0,     0.05],
  ];
  for (const [x, y, z, r] of offsets) {
    const m = toonMesh(new THREE.SphereGeometry(r, 8, 6), color);
    m.position.set(x, y, z);
    group.add(m);
  }
  return group;
}

export function makeHairP2(tileTop: number): THREE.Group {
  const group = new THREE.Group();
  const color = 0x6b21a8;
  const offsets: [number, number, number, number][] = [
    [0,     tileTop + 0.84, 0,     0.11],
    [-0.09, tileTop + 0.88, 0.01,  0.08],
    [0.09,  tileTop + 0.88, 0.01,  0.08],
    [-0.15, tileTop + 0.83, 0,     0.06],
    [0.15,  tileTop + 0.83, 0,     0.06],
    [0,     tileTop + 0.92, 0,     0.06],
  ];
  for (const [x, y, z, r] of offsets) {
    const m = toonMesh(new THREE.SphereGeometry(r, 8, 6), color);
    m.position.set(x, y, z);
    group.add(m);
  }
  return group;
}

// ---- P1 VFX ----

export function makeEnergyBlade(tileTop: number): THREE.Group {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.55, 0.015),
    new THREE.MeshToonMaterial({ color: 0x60a5fa, emissive: new THREE.Color(0x1e40af), emissiveIntensity: 0.6 })
  );
  blade.castShadow = true;
  blade.position.set(0.22, tileTop + 0.50, 0);
  // Guard
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.04, 0.02),
    new THREE.MeshToonMaterial({ color: 0x93c5fd })
  );
  guard.castShadow = true;
  guard.position.set(0.22, tileTop + 0.24, 0);
  group.add(blade, guard);
  return group;
}

export function makeSlashRing(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.015, 8, 48),
    new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

export function makeSparkles(count: number, color: number): {
  points: THREE.Points;
  positions: Float32Array;
  velocities: Float32Array;
} {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 0.7;
    positions[i * 3 + 1] = Math.random() * 1.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
    velocities[i] = 0.4 + Math.random() * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.035, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  return { points, positions, velocities };
}

// ---- P2 VFX ----

export function makeAuraSphere(tileTop: number): { inner: THREE.Mesh; outer: THREE.Mesh } {
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 12),
    new THREE.MeshToonMaterial({ color: 0xd946ef, transparent: true, opacity: 0.15 })
  );
  inner.position.set(0, tileTop + 0.45, 0);

  const outer = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      transparent: true,
      opacity: 0.07,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  outer.position.set(0, tileTop + 0.45, 0);
  return { inner, outer };
}

export function makeArcaneRing(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.015, 8, 48),
    new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}
