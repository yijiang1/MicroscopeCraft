// Procedural 3D models for every gatherable and sample in the world: noise-displaced rocks, sand mounds,
// crystals, leafy plants, flowers, a butterfly wing. Geometry and materials are cached and shared, and each
// model's parts are merged into one mesh per material, so a model costs a few draw calls. Owner: Person A.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { noise3 } from './terrain';
import { barkTexture, labelTexture, leafTexture, PAINTINGS, paintingTexture, sunflowerTexture, wingTexture, type PaintingId } from './textures';

const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
}

/** Bake a model's meshes into one mesh per material, in the root's own space: a model is then a few draw calls,
 *  not one per part. Run it once the model is built; the root keeps its own transform. */
export function mergeByMaterial(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const buckets = new Map<string, THREE.Mesh[]>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || Array.isArray(o.material)) return;
    const key = `${o.material.uuid}:${o.castShadow}:${Object.keys(o.geometry.attributes).sort().join()}`;
    buckets.set(key, [...(buckets.get(key) ?? []), o]);
  });
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const merged = mergeGeometries(meshes.map((m) =>
      (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld))));
    if (!merged) continue;
    const one = new THREE.Mesh(merged, meshes[0]!.material);
    one.castShadow = meshes[0]!.castShadow;
    meshes.forEach((m) => m.removeFromParent());
    root.add(one);
  }
}

const col = (hex: string) => new THREE.Color(hex);
const pick = <T>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;

// ---------------------------------------------------------------- rocks and ores

interface Palette {
  base: [string, string];
  fleck: string[];
  /** Noise above this value becomes a fleck (lower = more flecks). */
  fleckAt: number;
  metalness?: number;
  roughness?: number;
}

const PALETTES: Record<string, Palette> = {
  iron: { base: ['#4b4743', '#5e5852'], fleck: ['#a0522d', '#8a3f22', '#c26a3a'], fleckAt: 0.22 }, // rust patches
  copper: { base: ['#554c45', '#6a5f55'], fleck: ['#3fa58a', '#2f8f78', '#c87533'], fleckAt: 0.2 }, // green and orange veins
  tungsten: { base: ['#2b2f35', '#3a3f47'], fleck: ['#9aa4b0', '#7d8794'], fleckAt: 0.25, metalness: 0.55, roughness: 0.4 },
  stone: { base: ['#77736c', '#8d887f'], fleck: ['#5c5852', '#a39e94'], fleckAt: 0.3 },
  fluorite: { base: ['#8a8790', '#a09ca8'], fleck: ['#8a5ac8', '#6a3aa8', '#b08ae0'], fleckAt: 0.18 }, // purple veins
  willemite: { base: ['#c8d0c0', '#dde4d4'], fleck: ['#9fd8a0', '#b8e8b0'], fleckAt: 0.22 }, // pale green
  pale: { base: ['#b8bab0', '#cfd0c8'], fleck: ['#a8aaa0', '#dcdcd4'], fleckAt: 0.3 },
  mica: { base: ['#6a6660', '#7c7770'], fleck: ['#e0e4ea', '#c8ccd4', '#f4f4f8'], fleckAt: 0.05, metalness: 0.5, roughness: 0.35 },
  lichen: { base: ['#7a766e', '#8a857c'], fleck: ['#c8c86a', '#9ab070', '#d8a050'], fleckAt: 0.0 },
  shale: { base: ['#3e3c3a', '#4c4946'], fleck: ['#5a5652', '#2e2c2a'], fleckAt: 0.3 },
  // the rock garden
  granite: { base: ['#b9aaa2', '#d0c2b8'], fleck: ['#e6a8a0', '#2a2624', '#f2ece6', '#8a8a8e'], fleckAt: -0.05 }, // pink feldspar, black mica, grey quartz
  basalt: { base: ['#2e2f31', '#3a3b3e'], fleck: ['#1e1f20', '#6a7a3a'], fleckAt: 0.35 },
  obsidian: { base: ['#0e0e12', '#1c1c24'], fleck: ['#2a2a36'], fleckAt: 0.4, metalness: 0.1, roughness: 0.12 },
  marble: { base: ['#e8e6e0', '#f6f4ef'], fleck: ['#b8bcc0', '#d0d4d8'], fleckAt: 0.32 }, // grey veins
  chalk: { base: ['#ecebe4', '#f8f7f2'], fleck: ['#d8d6cc'], fleckAt: 0.3, roughness: 1 },
  malachite: { base: ['#1f7a4a', '#3aa86a'], fleck: ['#0f4a2a', '#6ad09a'], fleckAt: -0.1, roughness: 0.5 }, // banded greens
  magnetite: { base: ['#25262a', '#33353a'], fleck: ['#5a5c62', '#1a1a1c'], fleckAt: 0.25, metalness: 0.45, roughness: 0.45 },
  garnet: { base: ['#7a7670', '#8e8a82'], fleck: ['#8a1f2e', '#a02838', '#d8dce0'], fleckAt: 0.28 }, // red garnets in silvery schist
};

/** A noise-displaced icosphere with faceted normals and speckled vertex colours. */
export function rockGeometry(seed: number, radius: number, palette: Palette): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, 3);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const [b0, b1] = palette.base.map(col) as [THREE.Color, THREE.Color];
  const flecks = palette.fleck.map(col);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + 0.32 * noise3(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2 + seed));
    v.y *= 0.72;
    pos.setXYZ(i, v.x, v.y, v.z);
    c.copy(b0).lerp(b1, 0.5 + 0.5 * noise3(v.x * 3, v.y * 3 + seed, v.z * 3, 2));
    const m = noise3(v.x * 7 + seed * 3, v.y * 7, v.z * 7, 2);
    if (m > palette.fleckAt) c.lerp(flecks[Math.floor((m + 1) * 7 + seed) % flecks.length]!, 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Plain grey boulder geometry for scenery. */
export const stoneGeometry = (seed: number, radius: number) => rockGeometry(seed, radius, PALETTES.stone!);

const rockMaterial = (name: string) =>
  memo(`rockmat:${name}`, () => {
    const p = PALETTES[name]!;
    return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: p.roughness ?? 0.88, metalness: p.metalness ?? 0.04 });
  });

function rock(name: string, seed: number, radius: number): THREE.Mesh {
  const geo = memo(`rock:${name}:${seed}:${radius}`, () => rockGeometry(seed, radius, PALETTES[name]!));
  return new THREE.Mesh(geo, rockMaterial(name));
}

/** An outcrop: one big boulder with two smaller rocks tucked against it. */
export function oreNode(name: string, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const seed = 1 + Math.floor(rng() * 4);
  const big = rock(name, seed, 0.5);
  big.rotation.y = rng() * 6.28;
  big.scale.setScalar(0.9 + rng() * 0.4);
  g.add(big);
  for (const [dx, dz, r] of [[0.55, 0.15, 0.22], [-0.3, 0.5, 0.28]] as const) {
    const s = rock(name, seed + 4, r);
    s.position.set(dx * (0.9 + rng() * 0.3), 0.02, dz);
    s.rotation.y = rng() * 6.28;
    g.add(s);
  }
  return g;
}

// ---------------------------------------------------------------- sand

const sandMoundGeometry = (seed: number, palette: [string, string]) =>
  memo(`sand:${seed}:${palette[0]}`, () => {
    const g = new THREE.SphereGeometry(1, 30, 18);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const a = col(palette[0]);
    const b = col(palette[1]);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const n = noise3(x * 2 + seed, 0.5, z * 2 + seed, 3);
      pos.setXYZ(i, x * (1 + 0.12 * n), Math.max(pos.getY(i), 0) * (0.34 + 0.08 * n), z * (1 + 0.12 * n));
      c.copy(a).lerp(b, 0.5 + 0.5 * noise3(x * 9, seed, z * 9, 2));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  });

/** A mound of beach sand (or dark heavy sand, or mud) with a few pebbles around it. */
export function sandNode(rng: () => number, palette: [string, string] = ['#dcc690', '#c4a96d'], scale = 1): THREE.Group {
  const g = new THREE.Group();
  const mound = new THREE.Mesh(
    sandMoundGeometry(1 + Math.floor(rng() * 4), palette),
    memo('mat:sand', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })),
  );
  mound.scale.set(0.85 * scale, scale, 0.85 * scale);
  g.add(mound);
  for (let i = 0; i < 7; i++) {
    const a = rng() * 6.28;
    const p = new THREE.Mesh(
      memo('pebble', () => new THREE.IcosahedronGeometry(1, 1)),
      memo('mat:pebble', () => new THREE.MeshStandardMaterial({ color: '#8c8478', roughness: 0.9, flatShading: true })),
    );
    p.scale.setScalar(0.04 + rng() * 0.05);
    p.position.set(Math.cos(a) * (0.75 + rng() * 0.35), 0.03, Math.sin(a) * (0.75 + rng() * 0.35));
    g.add(p);
  }
  return g;
}

// ---------------------------------------------------------------- crystals

/** Hexagonal prism with a pointed tip, base at y = 0. */
const crystalGeometry = (radius: number, height: number) =>
  memo(`crystal:${radius}:${height}`, () => {
    const body = new THREE.CylinderGeometry(radius * 0.85, radius, height * 0.75, 6);
    body.translate(0, height * 0.375, 0);
    const tip = new THREE.ConeGeometry(radius * 0.85, height * 0.25, 6);
    tip.translate(0, height * 0.75 + height * 0.125, 0);
    return mergeGeometries([body, tip])!;
  });

const crystalMaterial = (color: string, glow: number) =>
  memo(`crystalmat:${color}:${glow}`, () =>
    new THREE.MeshPhysicalMaterial({
      color, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.86, flatShading: true,
      emissive: color, emissiveIntensity: glow, clearcoat: 1,
    }),
  );

export function crystalCluster(rng: () => number, opts: { colors: string[]; glow: number; count: number; height: number; radius: number }): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < opts.count; i++) {
    const h = opts.height * (0.4 + rng() * 0.7);
    const r = opts.radius * (0.6 + rng() * 0.6);
    const m = new THREE.Mesh(crystalGeometry(Math.round(r * 100) / 100, Math.round(h * 10) / 10), crystalMaterial(pick(rng, opts.colors), opts.glow));
    const a = rng() * 6.28;
    const d = i === 0 ? 0 : 0.12 + rng() * opts.radius * 3;
    m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    m.rotation.set((rng() - 0.5) * 0.5, rng() * 6.28, (rng() - 0.5) * 0.5);
    g.add(m);
  }
  return g;
}

// ---------------------------------------------------------------- plants

/** Ovate leaf in the XY plane pointing +y, drooping outward; UVs map the vein texture. */
const leafGeometry = () =>
  memo('leafgeo', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.36, 0.1, 0.46, 0.55, 0, 1);
    s.bezierCurveTo(-0.46, 0.55, -0.36, 0.1, 0, 0);
    const g = new THREE.ShapeGeometry(s, 12);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      uv.setXY(i, (x + 0.4) / 0.8, y);
      pos.setZ(i, 0.3 * y * y); // droop
    }
    g.computeVertexNormals();
    return g;
  });

const leafMaterial = () => memo('mat:leaf', () => new THREE.MeshStandardMaterial({ map: leafTexture(), side: THREE.DoubleSide, roughness: 0.55 }));
const stemMaterial = () => memo('mat:stem', () => new THREE.MeshStandardMaterial({ color: '#4a7a32', roughness: 0.8 }));

function leaf(scale: number, yaw: number, lift: number): THREE.Object3D {
  const pivot = new THREE.Group();
  pivot.rotation.y = yaw;
  const m = new THREE.Mesh(leafGeometry(), leafMaterial());
  m.rotation.x = lift;
  m.scale.setScalar(scale);
  pivot.add(m);
  return pivot;
}

const tube = (points: THREE.Vector3[], radius: number) =>
  new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, radius, 6), stemMaterial());

export function leafPlant(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.01, 0.2, 0), new THREE.Vector3(0, 0.38, 0.01)], 0.018));
  for (let i = 0; i < 11; i++) {
    const l = leaf(0.55 + rng() * 0.45, i * 2.4 + rng() * 0.4, 0.45 + rng() * 0.8);
    l.position.y = 0.04 + (i / 11) * 0.3;
    g.add(l);
  }
  return g;
}

const PETAL = () =>
  memo('petalgeo', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.5, 0.2, 0.45, 0.8, 0, 1);
    s.bezierCurveTo(-0.45, 0.8, -0.5, 0.2, 0, 0);
    return new THREE.ShapeGeometry(s, 8);
  });

function petalRing(count: number, length: number, width: number, tilt: number, color: string): THREE.Group {
  const ring = new THREE.Group();
  const mat = memo(`mat:petal:${color}`, () => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 }));
  for (let i = 0; i < count; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / count) * Math.PI * 2;
    const m = new THREE.Mesh(PETAL(), mat);
    m.scale.set(width, length, 1);
    m.rotation.x = tilt; // cup the petals toward the viewer
    pivot.add(m);
    ring.add(pivot);
  }
  return ring;
}

function flower(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.35 + rng() * 0.25;
  const lean = (rng() - 0.5) * 0.1;
  g.add(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean, h * 0.5, 0), new THREE.Vector3(lean * 2, h, 0.03)], 0.01));
  const head = new THREE.Group();
  head.position.set(lean * 2, h, 0.03);
  head.rotation.x = -0.55;
  head.add(petalRing(9, 0.085, 0.036, -0.35, pick(rng, ['#e45a9b', '#b36ad6', '#f4f0e6', '#e8494a'])));
  const centre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.014, 14),
    memo('mat:fcentre', () => new THREE.MeshStandardMaterial({ color: '#e8b923', roughness: 0.7 })),
  );
  centre.rotation.x = Math.PI / 2;
  head.add(centre);
  g.add(head);
  for (const [y, yaw] of [[0.07, 0.4], [0.14, 3.5]] as const) {
    const l = leaf(0.13, yaw, 0.9);
    l.position.y = y;
    g.add(l);
  }
  return g;
}

export function flowerPatch(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const f = flower(rng);
    f.scale.setScalar(1.4);
    const a = (i / 4) * 6.28 + rng();
    f.position.set(Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28);
    f.rotation.y = rng() * 6.28;
    g.add(f);
  }
  return g;
}

export function sunflower(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(tube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.7, 0), new THREE.Vector3(0.07, 1.35, 0.03)], 0.022));
  const head = new THREE.Group();
  head.position.set(0.07, 1.38, 0.03);
  head.rotation.x = -0.4;
  head.add(petalRing(24, 0.17, 0.05, -0.15, '#f2c230'));
  head.add(petalRing(24, 0.15, 0.045, -0.3, '#e8a91c'));
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.115, 32),
    memo('mat:sfhead', () => new THREE.MeshStandardMaterial({ map: sunflowerTexture(), roughness: 0.9 })),
  );
  disc.position.z = 0.012;
  head.add(disc);
  g.add(head);
  for (const [y, yaw, s] of [[0.35, 0.3, 0.32], [0.62, 3.4, 0.38], [0.9, 1.8, 0.26]] as const) {
    const l = leaf(s, yaw + rng() * 0.3, 0.7);
    l.position.y = y;
    g.add(l);
  }
  return g;
}

// ---------------------------------------------------------------- resin stump, wing

export function resinStump(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const bark = memo('mat:bark', () => {
    const t = barkTexture();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.42, 16), bark);
  trunk.position.y = 0.21;
  g.add(trunk);
  const amber = memo('mat:amber', () =>
    new THREE.MeshPhysicalMaterial({ color: '#d98a2b', roughness: 0.12, clearcoat: 1, emissive: '#6a3200', emissiveIntensity: 0.25 }),
  );
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.04, 16), amber);
  top.position.y = 0.43;
  g.add(top);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28 + rng() * 0.5;
    const drip = new THREE.Mesh(memo('dripgeo', () => new THREE.IcosahedronGeometry(1, 2)), amber);
    const s = 0.035 + rng() * 0.04;
    drip.scale.set(s, s * (1.5 + rng()), s);
    drip.position.set(Math.cos(a) * 0.27, 0.12 + rng() * 0.25, Math.sin(a) * 0.27);
    g.add(drip);
  }
  return g;
}

/** Butterfly wing: a mirrored pair resting on a flat stone. */
export function wingOnStone(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const slab = rock('stone', 3, 0.45);
  slab.scale.y = 0.55;
  g.add(slab);
  const geo = memo('winggeo', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.1);
    s.bezierCurveTo(0.12, 0.45, 0.35, 0.72, 0.7, 0.78);
    s.bezierCurveTo(0.78, 0.6, 0.72, 0.38, 0.62, 0.3);
    s.bezierCurveTo(0.7, 0.18, 0.6, -0.05, 0.3, -0.12);
    s.bezierCurveTo(0.12, -0.12, 0.02, -0.02, 0, 0.1);
    const g2 = new THREE.ShapeGeometry(s, 14);
    const uv = g2.attributes.uv as THREE.BufferAttribute;
    const pos = g2.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 0.8, (pos.getY(i) + 0.15) / 1);
    return g2;
  });
  const mat = memo('mat:wing', () => new THREE.MeshStandardMaterial({ map: wingTexture(), side: THREE.DoubleSide, roughness: 0.7 }));
  for (const side of [1, -1]) {
    const w = new THREE.Mesh(geo, mat);
    w.scale.set(0.34 * side, 0.34, 0.34);
    w.rotation.x = -Math.PI / 2 + 0.12;
    w.rotation.z = side * 0.1;
    w.position.set(side * 0.01, 0.22 + rng() * 0.01, 0.05);
    g.add(w);
  }
  return g;
}


// ---------------------------------------------------------------- small shared helpers for the newer models

const std = (color: string, roughness = 0.8, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  memo(`std:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

const box = (w: number, h: number, d: number) => memo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt: number, rb: number, h: number, seg = 12) => memo(`cyl:${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const ball = (r: number, ws = 12, hs = 8) => memo(`ball:${r}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));

// ---------------------------------------------------------------- creatures and plants

/** A honeybee resting on a flower head: striped body, see-through wings. */
export function beeOnFlower(rng: () => number): THREE.Group {
  const g = flower(rng);
  g.scale.setScalar(1.6);
  const bee = new THREE.Group();
  const black = std('#1d1a14');
  const gold = std('#d9a21c');
  bee.add(mesh(ball(0.02), black, 0, 0, 0.025), mesh(ball(0.016), black, 0, 0, -0.015));
  for (let i = 0; i < 3; i++) bee.add(mesh(ball(0.019 - i * 0.002), i % 2 ? black : gold, 0, 0, -0.035 - i * 0.014));
  const wing = std('#e8f4ff', 0.2, 0, { transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  for (const side of [-1, 1]) bee.add(mesh(memo('beewing', () => new THREE.CircleGeometry(0.025, 10)), wing, side * 0.025, 0.02, -0.01, -1.2, 0, side * 0.4));
  bee.scale.setScalar(1.4);
  bee.position.set(0, 0.62, 0.05);
  const holder = new THREE.Group();
  holder.add(g, bee);
  return holder;
}

/** A wooden picnic table with a salt shaker and a notebook on it. */
export function picnicTable(): THREE.Group {
  const g = new THREE.Group();
  const wood = std('#8a6a48', 0.9);
  g.add(mesh(box(1.6, 0.06, 0.7), wood, 0, 0.75, 0));
  for (const z of [-0.55, 0.55]) g.add(mesh(box(1.6, 0.05, 0.25), wood, 0, 0.45, z));
  for (const x of [-0.65, 0.65]) for (const z of [-0.3, 0.3]) g.add(mesh(box(0.06, 0.75, 0.06), wood, x, 0.375, z, z > 0 ? 0.35 : -0.35));
  g.add(mesh(cyl(0.025, 0.03, 0.09), std('#f0f0f0', 0.3), -0.3, 0.825, 0.05), mesh(cyl(0.026, 0.026, 0.02), std('#c0c4c8', 0.3, 0.8), -0.3, 0.88, 0.05));
  g.add(mesh(box(0.3, 0.015, 0.22), std('#f4f1e6'), 0.25, 0.79, -0.05, 0, 0.3, 0), mesh(box(0.3, 0.004, 0.22), std('#3a5a9a'), 0.25, 0.8, -0.05, 0, 0.3, 0));
  const winterSnow = new THREE.Group();
  winterSnow.userData.winterSnow = true;
  winterSnow.visible = false;
  for (const x of [-.6, -.1, .55]) {
    const drift = new THREE.Mesh(new THREE.SphereGeometry(.19, 12, 8), std('#edf8ff', .65));
    drift.scale.set(1,.25,1);drift.position.set(x,.80,.1);winterSnow.add(drift);
  }
  g.add(winterSnow);
  return g;
}

/** A slick of green algae and scum at the water's edge. */
export function algaeMat(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const r = 0.25 + rng() * 0.35;
    const blob = mesh(memo('mat:disc', () => new THREE.CircleGeometry(1, 18)), std(pick(rng, ['#4a7a2a', '#5a8a30', '#3c6a2a']), 0.6), (rng() - 0.5) * 1.2, 0.02 + i * 0.002, (rng() - 0.5) * 1.2, -Math.PI / 2);
    blob.scale.set(r, r * (0.6 + rng() * 0.6), 1);
    g.add(blob);
  }
  return g;
}

/** A soft white duck feather lying on the ground: a shaft with a vane either side. */
export function feather(): THREE.Group {
  const g = new THREE.Group();
  const vane = memo('vanegeo', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.05, 0.05, 0.06, 0.2, 0, 0.3);
    s.lineTo(0, 0);
    return new THREE.ShapeGeometry(s, 8);
  });
  const white = std('#f2efe8', 0.7, 0, { side: THREE.DoubleSide });
  for (const side of [1, -1]) {
    const v = mesh(vane, white, 0, 0.012, 0, -Math.PI / 2, 0, 0);
    v.scale.x = side;
    g.add(v);
  }
  g.add(mesh(cyl(0.003, 0.004, 0.34, 5), std('#d8d0c0'), 0, 0.014, 0.14, Math.PI / 2));
  g.scale.setScalar(1.6);
  return g;
}

/** A low pine branch with yellow pollen cones, at a height you can look at. */
export function pineBranch(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.03, 0.05, 0.9, 6), std('#5a4128'), 0, 0.45, 0));
  const needles = std('#2f5d34', 0.9);
  for (let i = 0; i < 4; i++) {
    const tier = mesh(memo('pinecone', () => new THREE.ConeGeometry(0.45, 0.6, 9)), needles, 0, 0.75 + i * 0.3, 0, 0, rng(), 0);
    tier.scale.setScalar(1 - i * 0.2);
    g.add(tier);
  }
  const pollen = std('#e8c840', 0.7);
  for (let i = 0; i < 9; i++) {
    const a = rng() * 6.28;
    g.add(mesh(memo('polcone', () => new THREE.CapsuleGeometry(0.025, 0.06, 3, 6)), pollen, Math.cos(a) * 0.35, 0.8 + rng() * 0.5, Math.sin(a) * 0.35));
  }
  return g;
}

/** A fallen oak log with thick, cracked bark. */
export function fallenLog(): THREE.Group {
  const g = new THREE.Group();
  const bark = memo('mat:logbark', () => {
    const t = barkTexture();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  });
  g.add(mesh(cyl(0.28, 0.32, 2.4, 14), bark, 0, 0.28, 0, 0, 0, Math.PI / 2));
  g.add(mesh(memo('logend', () => new THREE.CircleGeometry(0.3, 14)), std('#b89a6a', 0.9), 1.2, 0.28, 0, 0, Math.PI / 2, 0));
  return g;
}

/** Felled logwood: a short log whose cut ends show the dark red heartwood that hematoxylin is extracted from. */
export function logwoodLog(): THREE.Group {
  const g = new THREE.Group();
  const bark = memo('mat:logbark', () => {
    const t = barkTexture();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  });
  g.add(mesh(cyl(0.2, 0.22, 1.1, 14), bark, 0, 0.21, 0, 0, 0, Math.PI / 2));
  for (const side of [1, -1]) g.add(mesh(memo('logwoodend', () => new THREE.CircleGeometry(0.21, 14)), std('#7a1f2b', 0.8), side * 0.55, 0.21, 0, 0, side * Math.PI / 2, 0));
  return g;
}

/** Three mushrooms: pale stems under brown caps. */
export function mushrooms(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = 0.6 + rng() * 0.6;
    const m = new THREE.Group();
    m.add(mesh(cyl(0.025, 0.035, 0.14, 8), std('#ece4d4'), 0, 0.07, 0));
    m.add(mesh(memo('cap', () => new THREE.SphereGeometry(0.08, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), std('#9a6a4a', 0.7), 0, 0.13, 0));
    m.add(mesh(memo('gills', () => new THREE.CircleGeometry(0.078, 14)), std('#6a4a3a', 0.9, 0, { side: THREE.DoubleSide }), 0, 0.131, 0, Math.PI / 2));
    m.scale.setScalar(s * 1.6);
    m.position.set((rng() - 0.5) * 0.4, 0, (rng() - 0.5) * 0.4);
    g.add(m);
  }
  return g;
}

/** A cushion of moss on a stone. */
export function mossyStone(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const stone = rock('stone', 2, 0.4);
  stone.scale.y = 0.6;
  g.add(stone);
  const moss = mesh(memo('mossgeo', () => {
    const geo = new THREE.SphereGeometry(0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) * (0.45 + 0.15 * noise3(pos.getX(i) * 9, 1, pos.getZ(i) * 9, 2)));
    geo.computeVertexNormals();
    return geo;
  }), std('#4f8a2e', 1), 0, 0.12 + rng() * 0.02, 0);
  g.add(moss);
  return g;
}

/** A spider web strung between two sticks. */
export function spiderWeb(): THREE.Group {
  const g = new THREE.Group();
  const stick = std('#5a4128');
  for (const x of [-0.5, 0.5]) g.add(mesh(cyl(0.015, 0.02, 1.2, 5), stick, x, 0.6, 0));
  const pts: number[] = [];
  const cy = 0.75;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    pts.push(0, cy, 0, Math.cos(a) * 0.42, cy + Math.sin(a) * 0.42, 0);
  }
  for (let r = 0.06; r < 0.42; r += 0.045) {
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * Math.PI * 2;
      const a1 = ((k + 1) / 12) * Math.PI * 2;
      pts.push(Math.cos(a0) * r, cy + Math.sin(a0) * r, 0, Math.cos(a1) * r, cy + Math.sin(a1) * r, 0);
    }
  }
  const geo = memo('webgeo', () => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)));
  g.add(new THREE.LineSegments(geo, memo('mat:web', () => new THREE.LineBasicMaterial({ color: '#f4f8ff', transparent: true, opacity: 0.85 }))));
  return g;
}

/** A clump of fern fronds with brown spore dots underneath. */
export function fern(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const l = leaf(0.55 + rng() * 0.25, (i / 7) * 6.28 + rng() * 0.3, 0.9 + rng() * 0.3);
    (l.children[0] as THREE.Mesh).scale.x *= 0.45;
    g.add(l);
  }
  return g;
}

/** An old weathered deer bone. */
export function bone(): THREE.Group {
  const g = new THREE.Group();
  const white = std('#e8dfc8', 0.8);
  g.add(mesh(cyl(0.035, 0.035, 0.45, 10), white, 0, 0.05, 0, 0, 0, Math.PI / 2));
  for (const x of [-0.24, 0.24]) for (const z of [-0.035, 0.035]) g.add(mesh(ball(0.05), white, x, 0.05, z));
  return g;
}

/** A clay pot. */
function pot(): THREE.Mesh {
  return mesh(cyl(0.16, 0.12, 0.22, 14), std('#b8603a', 0.9), 0, 0.11, 0);
}

export function onionPlant(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(pot(), mesh(ball(0.09), std('#c88a4a', 0.5), 0, 0.27, 0));
  for (let i = 0; i < 6; i++) g.add(mesh(cyl(0.008, 0.012, 0.45, 5), stemMaterial(), (rng() - 0.5) * 0.05, 0.55, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.4, 0, (rng() - 0.5) * 0.4));
  return g;
}

export function potatoPlant(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(pot());
  for (let i = 0; i < 9; i++) {
    const l = leaf(0.22 + rng() * 0.1, rng() * 6.28, 0.7 + rng() * 0.6);
    l.position.y = 0.24 + rng() * 0.2;
    g.add(l);
  }
  for (let i = 0; i < 3; i++) g.add(mesh(ball(0.05), std('#b89a6a', 0.9), (rng() - 0.5) * 0.2, 0.23, (rng() - 0.5) * 0.2));
  return g;
}

export function orchidPlant(): THREE.Group {
  const g = new THREE.Group();
  g.add(pot());
  for (const yaw of [0.3, 3.4]) {
    const l = leaf(0.28, yaw, 1.2);
    l.position.y = 0.22;
    g.add(l);
  }
  g.add(tube([new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(0.04, 0.5, 0), new THREE.Vector3(0.12, 0.62, 0.02)], 0.006));
  for (let i = 0; i < 4; i++) {
    const head = petalRing(5, 0.05, 0.04, -0.2, '#d070c0');
    head.position.set(0.04 + i * 0.03, 0.5 + i * 0.04, 0.03);
    head.rotation.x = -0.4;
    g.add(head);
  }
  return g;
}

export function nettlePlant(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(pot(), mesh(cyl(0.008, 0.012, 0.7, 5), stemMaterial(), 0, 0.57, 0));
  for (let i = 0; i < 5; i++) {
    for (const side of [0, Math.PI]) {
      const l = leaf(0.12, side + i * 1.57 + rng() * 0.2, 0.9);
      l.position.y = 0.32 + i * 0.1;
      g.add(l);
    }
  }
  return g;
}

export function cottonPlant(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  g.add(pot(), mesh(cyl(0.01, 0.015, 0.5, 5), std('#6a4a2a'), 0, 0.47, 0));
  for (let i = 0; i < 6; i++) {
    const a = rng() * 6.28;
    g.add(mesh(ball(0.05, 8, 6), std('#f8f6f0', 1), Math.cos(a) * 0.14, 0.45 + rng() * 0.25, Math.sin(a) * 0.14));
  }
  for (let i = 0; i < 5; i++) {
    const l = leaf(0.12, rng() * 6.28, 0.8);
    l.position.y = 0.35 + rng() * 0.3;
    g.add(l);
  }
  return g;
}

/** A slab of dark shale in layers, with the ribbed shell of a fossil brachiopod showing on top. */
export function shaleSlab(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) g.add(mesh(box(1.1 - i * 0.1, 0.07, 0.8 - i * 0.07), std(i % 2 ? '#45423f' : '#3a3836', 0.95), (rng() - 0.5) * 0.06, 0.035 + i * 0.07, (rng() - 0.5) * 0.06));
  const shell = mesh(memo('shell', () => new THREE.CircleGeometry(0.11, 16, 0, Math.PI)), std('#a89a80', 0.9, 0, { side: THREE.DoubleSide }), 0.15, 0.285, 0.05, -Math.PI / 2);
  g.add(shell);
  return g;
}

/** A cluster of metallic cubes: silver-grey galena, or brassy pyrite. */
export function galenaCubes(rng: () => number, color = '#8c939c'): THREE.Group {
  const g = new THREE.Group();
  const metal = std(color, 0.3, 0.85);
  for (let i = 0; i < 6; i++) {
    const s = 0.08 + rng() * 0.12;
    g.add(mesh(box(s, s, s), metal, (rng() - 0.5) * 0.4, s / 2, (rng() - 0.5) * 0.4, 0, rng() * 1.5, 0));
  }
  return g;
}

/** A white cabinet of drawers on legs, with a label strip: the lab's slide collection or materials samples. */
function labCabinet(top: string): THREE.Group {
  const g = new THREE.Group();
  const white = std('#e8ecef', 0.5);
  g.add(mesh(box(1.4, 1.0, 0.55), white, 0, 0.5, 0));
  for (let r = 0; r < 4; r++) g.add(mesh(box(1.3, 0.2, 0.02), std('#cfd6dc', 0.5), 0, 0.15 + r * 0.24, 0.285), mesh(box(0.2, 0.03, 0.03), std('#8a9098', 0.3, 0.6), 0, 0.15 + r * 0.24, 0.3));
  g.add(mesh(box(1.42, 0.04, 0.6), std(top, 0.4), 0, 1.02, 0));
  return g;
}

export function slideCabinet(): THREE.Group {
  const g = labCabinet('#2a3a4a');
  for (let i = 0; i < 6; i++) g.add(mesh(box(0.075, 0.003, 0.025), std('#d8f0ff', 0.1, 0, { transparent: true, opacity: 0.7 }), -0.4 + i * 0.16, 1.05, 0.05));
  return g;
}

export function materialsBench(): THREE.Group {
  const g = labCabinet('#3a3a3a');
  g.add(mesh(cyl(0.12, 0.12, 0.06, 16), std('#c8ccd0', 0.4, 0.6), -0.35, 1.07, 0), mesh(box(0.25, 0.12, 0.18), std('#5a6a8a', 0.5), 0.3, 1.1, 0));
  for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.015, 0.015, 0.004, 12), std('#c87a3a', 0.4, 0.8), -0.12 + i * 0.06, 1.045, 0.15)); // copper grids
  return g;
}

/** A reagent bottle: brown glass for iodine, blue for methylene blue; a small kit box of four for the Gram stain. */
export function bottle(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.05, 0.05, 0.16, 12), std(color, 0.15, 0, { transparent: true, opacity: 0.85 }), 0, 0.08, 0), mesh(cyl(0.025, 0.025, 0.05, 10), std('#2a2a2a', 0.6), 0, 0.185, 0));
  return g;
}

export function gramKit(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(box(0.34, 0.06, 0.12), std('#e8e8e8', 0.6), 0, 0.03, 0));
  ['#5b2a86', '#8a4a1a', '#d8e8f0', '#d0457a'].forEach((c, i) => {
    const b = bottle(c);
    b.scale.setScalar(0.6);
    b.position.set(-0.12 + i * 0.08, 0.06, 0);
    g.add(b);
  });
  return g;
}

/** A trolley of sample holders at the beamline: little pins, a crystal mount, a battery coin, a meteorite slice. */
export function sampleRack(): THREE.Group {
  const g = new THREE.Group();
  const steel = std('#b8c0c8', 0.35, 0.7);
  g.add(mesh(box(1.2, 0.04, 0.6), steel, 0, 0.9, 0), mesh(box(1.2, 0.04, 0.6), steel, 0, 0.4, 0));
  for (const x of [-0.56, 0.56]) for (const z of [-0.26, 0.26]) g.add(mesh(cyl(0.015, 0.015, 0.9, 6), steel, x, 0.45, z));
  const colors = ['#e0f0ff', '#c0302a', '#e8e8f8', '#a0a8b0', '#5a5a6a', '#d98a2b', '#a8b0b8', '#8a96a8'];
  colors.forEach((c, i) => g.add(mesh(cyl(0.035, 0.035, 0.08, 10), std(c, 0.4, 0.2), -0.45 + i * 0.13, 0.96, 0)));
  return g;
}

// ---------------------------------------------------------------- engineering materials

/** Two concrete blocks, one leaning on the other. */
export function concreteBlocks(): THREE.Group {
  const g = new THREE.Group();
  const grey = std('#9c9890', 0.95);
  g.add(mesh(box(0.8, 0.4, 0.4), grey, 0, 0.2, 0), mesh(box(0.8, 0.4, 0.4), grey, 0.1, 0.6, 0.02, 0, 0.15, 0));
  for (const x of [-0.2, 0.2]) g.add(mesh(box(0.26, 0.02, 0.26), std('#4a4844', 1), x, 0.811, 0.02, 0, 0.15, 0)); // the hollow cores, seen from above
  return g;
}

/** A rusty steel I-beam lying on two timbers. */
export function rustyBeam(): THREE.Group {
  const g = new THREE.Group();
  const rust = std('#8a4a2a', 0.9, 0.3);
  const wood = std('#7a6248', 0.95);
  for (const x of [-1, 1]) g.add(mesh(box(0.15, 0.12, 0.5), wood, x, 0.06, 0));
  g.add(mesh(box(3, 0.025, 0.2), rust, 0, 0.133, 0), mesh(box(3, 0.025, 0.2), rust, 0, 0.427, 0), mesh(box(3, 0.27, 0.02), std('#6e3a22', 0.9, 0.3), 0, 0.28, 0));
  return g;
}

/** Red bricks stacked on a pallet. */
export function brickStack(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(box(0.9, 0.12, 0.9), std('#8a7050', 0.95), 0, 0.06, 0));
  const reds = ['#9a3a2a', '#a8442e', '#8c3424'].map((c) => std(c, 0.95));
  for (let layer = 0; layer < 5; layer++) {
    for (let i = 0; i < 4; i++) {
      const along = layer % 2 === 0;
      const b = mesh(box(0.8, 0.065, 0.19), reds[(layer + i) % 3]!, along ? 0 : -0.3 + i * 0.2, 0.155 + layer * 0.07, along ? -0.3 + i * 0.2 : 0, 0, along ? 0 : Math.PI / 2, 0);
      g.add(b);
    }
  }
  return g;
}

/** A solar panel tilted on a frame: dark cells, silver grid lines, an aluminium rim. */
export function solarPanel(): THREE.Group {
  const g = new THREE.Group();
  const alu = std('#c8ccd0', 0.35, 0.8);
  const panel = new THREE.Group();
  panel.add(mesh(box(1.7, 0.04, 1.0), alu), mesh(box(1.62, 0.045, 0.92), std('#1a2238', 0.25, 0.3)));
  for (let i = 1; i < 6; i++) panel.add(mesh(box(0.008, 0.05, 0.92), alu, -0.81 + i * 0.27, 0, 0));
  for (let i = 1; i < 3; i++) panel.add(mesh(box(1.62, 0.05, 0.008), alu, 0, 0, -0.46 + i * 0.307));
  panel.rotation.x = -0.6;
  panel.position.set(0, 0.85, 0);
  g.add(panel);
  for (const x of [-0.7, 0.7]) g.add(mesh(box(0.05, 1.1, 0.05), alu, x, 0.55, -0.25), mesh(box(0.05, 0.55, 0.05), alu, x, 0.27, 0.3));
  return g;
}

/** A car's catalytic converter, its pipes cut off, with a spare ceramic honeycomb brick beside it. */
export function catalyticConverter(): THREE.Group {
  const g = new THREE.Group();
  const steel = std('#a8adb2', 0.35, 0.8);
  const can = mesh(cyl(0.16, 0.16, 0.5, 20), steel, 0, 0.18, 0, 0, 0, Math.PI / 2);
  can.scale.set(1, 1, 0.7);
  g.add(can);
  for (const s of [-1, 1]) g.add(mesh(cyl(0.12, 0.05, 0.12, 16), steel, s * 0.31, 0.18, 0, 0, 0, Math.PI / 2), mesh(cyl(0.045, 0.045, 0.25, 12), std('#7a6a5a', 0.7, 0.5), s * 0.48, 0.18, 0, 0, 0, Math.PI / 2));
  const brick = mesh(cyl(0.11, 0.11, 0.15, 24), std('#ddd4c2', 0.95), 0.05, 0.075, 0.42);
  g.add(brick, mesh(memo('catface', () => new THREE.CircleGeometry(0.11, 24)), std('#b8ae9a', 1), 0.05, 0.151, 0.42, -Math.PI / 2));
  return g;
}

/** A bronze chime bell hung in a small oak frame. */
export function chimeBell(): THREE.Group {
  const g = new THREE.Group();
  const oak = std('#6a5038', 0.9);
  for (const x of [-0.7, 0.7]) g.add(mesh(box(0.14, 1.9, 0.14), oak, x, 0.95, 0), mesh(box(0.14, 0.1, 0.7), oak, x, 0.05, 0));
  g.add(mesh(box(1.6, 0.14, 0.16), oak, 0, 1.9, 0));
  const profile = [[0.0, 0.0], [0.46, 0.0], [0.47, 0.05], [0.4, 0.2], [0.33, 0.45], [0.3, 0.7], [0.24, 0.82], [0.0, 0.85]].map(([r, y]) => new THREE.Vector2(r, y));
  const bell = mesh(memo('bell', () => new THREE.LatheGeometry(profile, 28)), std('#9a7a3a', 0.4, 0.85, { side: THREE.DoubleSide }), 0, 0.92, 0);
  const patina = mesh(memo('bellband', () => new THREE.TorusGeometry(0.335, 0.025, 6, 28)), std('#4a9a7a', 0.8, 0.2), 0, 1.33, 0, Math.PI / 2);
  g.add(bell, patina, mesh(box(0.08, 0.12, 0.08), std('#3a3a3a', 0.6, 0.6), 0, 1.8, 0));
  return g;
}

/** A display case: a cabinet with a glass box on top, holding what `contents` adds. */
function displayCase(contents: (g: THREE.Group) => void): THREE.Group {
  const g = labCabinet('#2a2e34');
  g.add(mesh(box(1.4, 0.5, 0.55), std('#dff0ff', 0.05, 0, { transparent: true, opacity: 0.18, depthWrite: false }), 0, 1.29, 0));
  contents(g);
  return g;
}

/** Nanomaterials: a vial of glowing quantum dots, black nanotube powder, zeolite and MOF crystals in dishes. */
export const nanoCase = () =>
  displayCase((g) => {
    g.add(mesh(cyl(0.035, 0.035, 0.14, 12), std('#ff7a3a', 0.2, 0, { emissive: '#ff6a2a', emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }), -0.45, 1.11, 0));
    [['#1a1a1a', -0.15], ['#f4f4f8', 0.15], ['#dfe8ff', 0.45]].forEach(([c, x]) => {
      g.add(mesh(cyl(0.09, 0.08, 0.025, 16), std('#e8f4ff', 0.1, 0, { transparent: true, opacity: 0.5 }), x as number, 1.055, 0));
      g.add(mesh(cyl(0.07, 0.07, 0.02, 14), std(c as string, 0.8), x as number, 1.06, 0));
    });
  });

/** Devices: a superconductor pellet with a magnet floating above it, and a blue LED chip that glows. */
export const deviceCase = () =>
  displayCase((g) => {
    g.add(mesh(cyl(0.1, 0.1, 0.03, 20), std('#1e1e22', 0.7), -0.3, 1.055, 0), mesh(box(0.06, 0.03, 0.06), std('#b8bcc4', 0.3, 0.9), -0.3, 1.14, 0));
    g.add(mesh(box(0.14, 0.02, 0.14), std('#e0d8b0', 0.4, 0.6), 0.3, 1.05, 0), mesh(box(0.05, 0.02, 0.05), std('#6a7aff', 0.2, 0, { emissive: '#4a5aff', emissiveIntensity: 1.6 }), 0.3, 1.07, 0));
  });

// ---------------------------------------------------------------- the art museum

/** A painting at its real size in a gilt frame, hung with its centre at eye height (big ones higher, clear of the floor),
 *  and a placard beside it. Faces +z; the canvas glows a little, as if under gallery lights. */
export function painting(id: PaintingId): THREE.Group {
  const { w, h, label } = PAINTINGS[id];
  const g = new THREE.Group();
  const y = Math.max(1.55, 0.5 + h / 2);
  const canvas = memo(`painting:${id}`, () => {
    const t = paintingTexture(id);
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.85 });
  });
  g.add(mesh(new THREE.PlaneGeometry(w, h), canvas, 0, y, 0.03));
  const gilt = std('#b08a3a', 0.4, 0.6);
  const f = Math.min(0.12, 0.04 + w * 0.02);
  g.add(mesh(box(w + 2 * f, f, 0.05), gilt, 0, y + h / 2 + f / 2, 0.025), mesh(box(w + 2 * f, f, 0.05), gilt, 0, y - h / 2 - f / 2, 0.025));
  g.add(mesh(box(f, h, 0.05), gilt, -w / 2 - f / 2, y, 0.025), mesh(box(f, h, 0.05), gilt, w / 2 + f / 2, y, 0.025));
  const placard = memo(`placard:${id}`, () => new THREE.MeshStandardMaterial({ map: labelTexture(label), roughness: 0.6 }));
  g.add(mesh(new THREE.PlaneGeometry(0.64, 0.08), placard, w / 2 + f + 0.4, 1.3, 0.01));
  return g;
}
