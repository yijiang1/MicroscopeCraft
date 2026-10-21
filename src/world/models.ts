// Procedural 3D models for every gatherable and sample in the world: noise-displaced rocks, sand mounds,
// crystals, leafy plants, flowers, a butterfly wing. Geometry and materials are cached and shared,
// so a hundred nodes cost a few dozen draw calls. Owner: Person A.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Kind } from './placements';
import { mulberry32, noise3 } from './terrain';
import { barkTexture, leafTexture, sunflowerTexture, wingTexture } from './textures';

const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
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
function oreNode(name: 'iron' | 'copper' | 'tungsten' | 'stone', rng: () => number): THREE.Group {
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

/** A mound of beach sand with a few pebbles around it. */
function sandNode(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const mound = new THREE.Mesh(
    sandMoundGeometry(1 + Math.floor(rng() * 4), ['#dcc690', '#c4a96d']),
    memo('mat:sand', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })),
  );
  mound.scale.set(0.85, 1, 0.85);
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

function crystalCluster(rng: () => number, opts: { colors: string[]; glow: number; count: number; height: number; radius: number }): THREE.Group {
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

function leafPlant(rng: () => number): THREE.Group {
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

function flowerPatch(rng: () => number): THREE.Group {
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

function sunflower(rng: () => number): THREE.Group {
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

function resinStump(rng: () => number): THREE.Group {
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
function wingOnStone(rng: () => number): THREE.Group {
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

// ---------------------------------------------------------------- entry point

/** Build the model for a placed thing. `seed` makes each instance a little different but repeatable.
 *  `revealed` false builds the plain-looking version of ores that can only be recognised under a microscope. */
export function buildModel(kind: Kind, seed: number, revealed = true): THREE.Group {
  const rng = mulberry32(seed * 7919 + 13);
  let g: THREE.Group;
  switch (kind) {
    case 'sand': g = sandNode(rng); break;
    case 'quartz': g = crystalCluster(rng, { colors: ['#eef2f7', '#f7eef0', '#e3ecf5'], glow: 0.08, count: 7, height: 0.8, radius: 0.09 }); break;
    case 'iron': g = oreNode('iron', rng); break;
    case 'copper': case 'tungsten': g = oreNode(revealed ? kind : 'stone', rng); break;
    case 'sunflower': g = sunflower(rng); break;
    case 'resin': g = resinStump(rng); break;
    case 'leaf': g = leafPlant(rng); break;
    case 'flower': g = flowerPatch(rng); break;
    case 'wing': g = wingOnStone(rng); break;
    case 'crystal': g = crystalCluster(rng, { colors: ['#7b6cff', '#5aa9ff', '#b07bff'], glow: 0.7, count: 12, height: 3.4, radius: 0.28 }); break;
    case 'pond': throw new Error('the pond is built by terrain.buildWater');
  }
  g.rotation.y = rng() * 6.28;
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}
