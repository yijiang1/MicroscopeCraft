// Scenery that is never gathered: sky, grass, trees, boulders, wild flowers. Buildings are in campus.ts.
// Everything repeated is instanced, so thousands of plants cost a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { stoneGeometry } from './models';
import { insideBuilding } from './campus';
import { heightAt, LAKE, mulberry32, noise3, pathAt, waterLevelAt, WORLD_RADIUS } from './terrain';

export interface Blocker {
  x: number;
  z: number;
  r: number;
}

export const SUN_DIRECTION = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(25));

export function buildSky(): Sky {
  const sky = new Sky();
  sky.scale.setScalar(900);
  const u = sky.material.uniforms as Record<string, THREE.IUniform>;
  u.turbidity!.value = 4;
  u.rayleigh!.value = 1.6;
  u.mieCoefficient!.value = 0.004;
  u.mieDirectionalG!.value = 0.8;
  u.sunPosition!.value.copy(SUN_DIRECTION);
  return sky;
}

/** Same colour as the sky near the horizon, used for distance fog. */
export const FOG_COLOR = '#bcd3e6';

/** A copy of the geometry with one flat colour, optionally darker toward the bottom. */
function tinted(geo: THREE.BufferGeometry, hex: string, bottomShade = 1, height = 1): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const base = new THREE.Color(hex);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = bottomShade + (1 - bottomShade) * Math.min(1, Math.max(0, pos.getY(i) / height));
    colors.set([base.r * k, base.g * k, base.b * k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], tints?: THREE.Color[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    if (tints) mesh.setColorAt(i, tints[i]!);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function placeMatrix(x: number, z: number, scale: number, yaw: number, scaleY = scale, y = heightAt(x, z)): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    new THREE.Vector3(scale, scaleY, scale),
  );
}

function bush(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(1, 2);
}

export function buildDecor(avoid: { x: number; z: number }[]): { group: THREE.Group; blockers: Blocker[] } {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const rng = mulberry32(2026);

  const dry = (x: number, z: number) => heightAt(x, z) > waterLevelAt(x, z) + 0.35 && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 4;
  const offPad = (x: number, z: number) => !insideBuilding(x, z, 2);
  const clear = (x: number, z: number, gap: number) => avoid.every((a) => Math.hypot(a.x - x, a.z - z) > gap);
  const points = (n: number, ok: (x: number, z: number) => boolean, cx = 0, cz = 0, spread = WORLD_RADIUS - 6) => {
    const out: { x: number; z: number }[] = [];
    for (let tries = 0; out.length < n && tries < n * 40; tries++) {
      const a = rng() * 6.283;
      const r = Math.sqrt(rng()) * spread;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (Math.hypot(x, z) < WORLD_RADIUS - 4 && ok(x, z)) out.push({ x, z });
    }
    return out;
  };
  const steep = (x: number, z: number) => {
    const h = heightAt(x, z);
    return Math.hypot(heightAt(x + 0.6, z) - h, heightAt(x, z + 0.6) - h) / 0.6 > 0.5;
  };
  /** Lawn: dry, off the paths, out of buildings, not on a gorge wall. */
  const meadow = (x: number, z: number) => dry(x, z) && !insideBuilding(x, z, 0.6) && pathAt(x, z) < 0.05 && !steep(x, z);
  const quadLawn = (x: number, z: number) => x > -23 && x < 23 && z > -38 && z < 1;

  // --- grass tufts: three crossed blades each
  const blade = (angle: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.03, 0, 0, 0.03, 0, 0, 0.005, 0.42, 0.07], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.3, 1, 0, 0.3, 1, 0, 0.3, 1], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([0.16, 0.33, 0.1, 0.16, 0.33, 0.1, 0.56, 0.78, 0.3], 3));
    g.rotateY(angle);
    return g;
  };
  const tuftGeo = mergeGeometries([blade(0), blade(1.05), blade(2.1)])!;
  const tufts = points(14000, (x, z) => meadow(x, z) && clear(x, z, 0.5), 0, 0, 88);
  group.add(
    instanced(
      tuftGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }),
      tufts.map((p) => placeMatrix(p.x, p.z, 0.6 + rng() * 0.6, rng() * 6.28, 0.5 + rng() * 0.7)),
      tufts.map(() => new THREE.Color().setHSL(0.24 + rng() * 0.05, 0.4 + rng() * 0.2, 0.7 + rng() * 0.45)),
    ),
  );

  // --- wild flowers: stems and coloured heads
  const flowers = points(1000, (x, z) => meadow(x, z) && !quadLawn(x, z) && clear(x, z, 0.8), 0, 0, 85);
  const stemGeo = new THREE.CylinderGeometry(0.004, 0.005, 0.26, 4);
  stemGeo.translate(0, 0.13, 0);
  group.add(instanced(stemGeo, new THREE.MeshStandardMaterial({ color: '#3f7a2c', roughness: 1 }), flowers.map((p) => placeMatrix(p.x, p.z, 1, 0))));
  const headGeo = new THREE.CircleGeometry(0.045, 7);
  headGeo.rotateX(-1.1);
  headGeo.translate(0, 0.27, 0.01);
  const palette = ['#f4f0e6', '#f2d22e', '#e8548c', '#a86bd9', '#ef7a3a'].map((c) => new THREE.Color(c));
  group.add(
    instanced(
      headGeo,
      new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.8 }),
      flowers.map((p) => placeMatrix(p.x, p.z, 1, rng() * 6.28)),
      flowers.map(() => palette[Math.floor(rng() * palette.length)]!),
    ),
  );

  // --- pine trees: one merged geometry, a grove on the lower west slope plus scattered ones off the campus hilltop
  const pineParts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.1, 0.18, 2.4, 7);
  trunk.translate(0, 1.2, 0);
  pineParts.push(tinted(trunk, '#5a4128'));
  for (let i = 0; i < 5; i++) {
    const cone = new THREE.ConeGeometry(1.55 - i * 0.28, 1.7, 9);
    cone.translate(0, 1.8 + i * 0.95 + 0.85, 0);
    pineParts.push(tinted(cone, '#2f5d34', 0.7, 7));
  }
  const pineGeo = mergeGeometries(pineParts)!;
  const pines = [
    ...points(34, (x, z) => dry(x, z) && offPad(x, z) && clear(x, z, 2.5), -58, 22, 13),
    ...points(40, (x, z) => dry(x, z) && offPad(x, z) && clear(x, z, 2.5) && (x < -46 || z < -54 || z > 36 || x > 50), 0, 0, WORLD_RADIUS - 8),
  ];
  group.add(
    instanced(
      pineGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      pines.map((p) => {
        const s = 0.75 + rng() * 0.7;
        blockers.push({ x: p.x, z: p.z, r: 0.3 * s });
        return placeMatrix(p.x, p.z, s, rng() * 6.28);
      }),
    ),
  );
  group.children.at(-1)!.castShadow = true;

  // --- oak-like trees: trunk plus lumpy crowns
  const oakParts: THREE.BufferGeometry[] = [];
  const oakTrunk = new THREE.CylinderGeometry(0.16, 0.27, 2.4, 8);
  oakTrunk.translate(0, 1.2, 0);
  oakParts.push(tinted(oakTrunk, '#4e3a24'));
  for (const [dx, dy, dz, r, hex] of [
    [0, 3.7, 0, 1.6, '#3f7a35'], [1.0, 3.2, 0.4, 1.15, '#4a8a3a'], [-0.9, 3.3, -0.5, 1.2, '#37702f'], [0.2, 4.5, -0.3, 1.0, '#559443'],
  ] as const) {
    const crown = bush();
    const pos = crown.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      v.multiplyScalar(r * (1 + 0.18 * noise3(v.x * 2 + dx, v.y * 2 + dy, v.z * 2 + dz)));
      pos.setXYZ(i, v.x + dx, v.y * 0.85 + dy, v.z + dz);
    }
    crown.computeVertexNormals();
    oakParts.push(tinted(crown, hex, 0.75, 6));
  }
  const oakGeo = mergeGeometries(oakParts)!;
  // big trees line the quad, a few more stand around campus
  const oaks = [
    ...[-34, -28, -22, -16, -10, -4].flatMap((z) => [{ x: -21, z }, { x: 21, z }]),
    ...points(26, (x, z) => meadow(x, z) && !quadLawn(x, z) && clear(x, z, 3) && Math.hypot(x, z) > 12, 0, 0, 80),
  ];
  const oakMesh = instanced(
    oakGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    oaks.map((p) => {
      const s = 0.8 + rng() * 0.5;
      blockers.push({ x: p.x, z: p.z, r: 0.4 * s });
      return placeMatrix(p.x, p.z, s, rng() * 6.28);
    }),
  );
  oakMesh.castShadow = true;
  group.add(oakMesh);

  // --- boulders, mostly in the highlands
  const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  for (let variant = 0; variant < 3; variant++) {
    const spots = [
      ...points(4, (x, z) => dry(x, z) && offPad(x, z) && clear(x, z, 1.8), -26, -50, 8),
      ...points(4, (x, z) => dry(x, z) && offPad(x, z) && clear(x, z, 1.8), 24, -51, 8),
      ...points(6, (x, z) => dry(x, z) && offPad(x, z) && clear(x, z, 1.8), -60, -18, 16),
      ...points(5, (x, z) => dry(x, z) && clear(x, z, 1.8), -10, -66, 30), // down in the gorge
    ];
    const rocks = instanced(
      stoneGeometry(20 + variant, 1),
      stoneMat,
      spots.map((p) => {
        const s = 0.4 + rng() * 1.1;
        blockers.push({ x: p.x, z: p.z, r: 0.8 * s });
        return placeMatrix(p.x, p.z, s, rng() * 6.28, s * (0.7 + rng() * 0.5), heightAt(p.x, p.z) + 0.05 * s);
      }),
    );
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    group.add(rocks);
  }

  return { group, blockers };
}
