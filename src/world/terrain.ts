// The ground: a university campus on a flat hilltop, with a quad and its paths, a long steep slope falling away to
// the west (after Libe Slope) down to the west campus halls and the shore of a big lake beyond the map (after Cayuga),
// a small lake to the north-east, a gorge running west from the waterfall at its outlet, with a ledge along the creek
// and two trails down to it, and an engineering quad on a second flat terrace to the south. North is -z.
// heightAt() is the single source of truth: the mesh, the player's feet and every placed object read it.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export const WORLD_RADIUS = 150;
const CAMPUS_Y = 0.5;
export const LAKE = { x: 48, z: -66, r: 12 }; 
export const WATER_LEVEL = -0.9; // the lake surface
/** The waterfall: the lake spills over this lip (an x) into the gorge, at the west edge of the lake's water. */
export const FALLS_X = LAKE.x - LAKE.r - 3;
const SLOPE_X = -44; // the slope starts falling west of here...
const SLOPE_DROP = 10; // ...by this much over SLOPE_LEN m
const SLOPE_LEN = 32;
const GORGE = { bed: 3, top: 10 }; // half-widths of the creek bed and of the gorge at its rim
/** Flat building pads off the hilltop: Wilson Lab, east of the campus, the engineering quad to the south, the chemistry
 *  building, the athletic fields further east, and the residence halls north of the gorge. */
const PADS = [
  { x0: 47, x1: 74, z0: -17, z1: 9 }, { x0: -46, x1: 50, z0: 40, z1: 110 }, { x0: 50, x1: 70, z0: 14, z1: 32 },
  { x0: 78, x1: 120, z0: -34, z1: 52 }, { x0: -12, x1: 42, z0: -110, z1: -86 }, { x0: -120, x1: -78, z0: -30, z1: 20 },
];

/** Centre line of the gorge (a z) at x: a gentle meander that starts at the falls. */
export const gorgeZ = (x: number) => LAKE.z + 3 * Math.sin((x - FALLS_X) * 0.06);
/** The creek's surface below the falls, dropping gently westward. */
export const creekY = (x: number) => -8.5 - 0.03 * (FALLS_X - x);
/** The big lake beyond the west edge of the map, where the creek runs out: its shore is west of CAYUGA_X. */
export const CAYUGA_X = -128;
export const CAYUGA_Y = creekY(CAYUGA_X);
/** 1 in the wedge of the map's edge that looks west over the big lake (no edge hills there), 0 elsewhere. */
const lakeWedge = (x: number, z: number) => (x < 0 ? 1 - smoothstep(0.5, 0.75, Math.abs(Math.atan2(z, -x))) : 0);
/** The ledge along both banks of the creek, a step above the water. */
const BANK_UP = 0.35;
/** Trails from the rim down the gorge wall to the ledge: `top` and `bottom` are x's, side +1 is the south wall. */
export const TRAILS = [{ top: -20, bottom: 0, side: 1 }, { top: 10, bottom: -12, side: -1 }].map((t) => ({
  ...t, z0: gorgeZ(t.top) + t.side * 10.8, z1: gorgeZ(t.bottom) + t.side * 5.4, y1: creekY(t.bottom) + BANK_UP,
}));

/** Walkways (segments x0, z0, x1, z1): the quad's crossing paths and the ways to the tower and the science building. */
const PATHS: [number, number, number, number][] = [
  [-22, -36, 22, -2], [22, -36, -22, -2], // the quad's diagonals
  [0, -38, 0, 6], [-22, -19, 22, -19], // and its cross
  [-36, 5, 22, 5], // south walkway, the clock tower to the east
  [22, -2, 22, 20], [22, 20, 25, 20], // down to the science building door
  [8, 5, 8, 10], // to the greenhouse door
  [36, -20, 47, -4], [47, -4, 50, -4], // east to Wilson Lab's door
  [0, 5, 0, 94], // south to the engineering quad, and through it
  [-29, 76, 31, 76], // the engineering quad's cross path, between the geology hall and the east hall
  [0, 62, -8, 56], [0, 62, 19, 58], // to the materials hall and the atrium door
  [0, 94, 33, 98], // to the materials yard
  [-36, 4, -46, 2], [-46, 2, -82, -9], [-88, -21, -88, 5], [-88, -9, -82, -9], // from the tower down the slope to the west campus
  [-22, -36, -20, -54], [10, -88, 10, -80], // to the tops of the gorge trails
  [47, -4, 47, 23], [47, 23, 52, 23], // past the science building to the chemistry building's door
  [36, -20, 80, -20], [80, -20, 80, 30], [80, 30, 90, 30], [90, 30, 90, 34], // east to the athletic fields and the field house
  [22, -36, 26, -55], // to the suspension bridge, and from its north end to the residence halls
  [26, -79, 26, -94], [-1, -88, 26, -88], [-1, -92, -1, -88],
  ...TRAILS.map((t): [number, number, number, number] => [t.top, t.z0, t.bottom, t.z1]),
];
/** The walkways, for the lamps along them. */
export const WALKWAYS: readonly [number, number, number, number][] = PATHS;

const perlin = new ImprovedNoise();

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fractal Perlin noise, roughly in [-1, 1]. */
export function noise3(x: number, y: number, z: number, octaves = 3): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * perlin.noise(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

const fbm2 = (x: number, z: number, octaves = 4) => noise3(x, 0.37, z, octaves);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 1 on the paths, fading to 0 a little past their edges. */
export function pathAt(x: number, z: number): number {
  let d = Infinity;
  for (const [x0, z0, x1, z1] of PATHS) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = clamp01(((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz));
    d = Math.min(d, Math.hypot(x - x0 - t * dx, z - z0 - t * dz));
  }
  return 1 - smoothstep(0.9, 1.3, d);
}

export function heightAt(x: number, z: number): number {
  let h = CAMPUS_Y + 1.6 * fbm2(x * 0.02, z * 0.02) + 0.25 * fbm2(x * 0.15 + 10, z * 0.15, 2);
  // flat hilltop for the quads and buildings, and flat ground around the lake
  const outside = (lo: number, hi: number, v: number) => Math.max(lo - v, v - hi, 0);
  const core = (1 - smoothstep(0, 8, outside(-46, 48, x))) * (1 - smoothstep(0, 8, outside(-54, 34, z)));
  const pad = Math.max(0, ...PADS.map((p) => 1 - smoothstep(0, 6, outside(p.x0, p.x1, x) + outside(p.z0, p.z1, z))));
  const dLake = Math.hypot(x - LAKE.x, z - LAKE.z);
  h = mix(h, CAMPUS_Y, Math.max(core, pad, 1 - smoothstep(LAKE.r + 8, LAKE.r + 18, dLake)));
  h -= SLOPE_DROP * smoothstep(SLOPE_X, SLOPE_X - SLOPE_LEN, x); // the west slope
  h -= 3.4 * (1 - smoothstep(LAKE.r - 2, LAKE.r + 5, dLake)); // lake bowl
  if (x < LAKE.x) {
    // The gorge: a shallow outlet channel from the lake, then a sheer drop at the falls
    const bed = mix(creekY(x) - 0.6, -2, smoothstep(FALLS_X - 1.2, FALLS_X, x));
    const dz = Math.abs(z - gorgeZ(x));
    h = Math.min(h, mix(h, bed, 1 - smoothstep(GORGE.bed, GORGE.top, dz)));
    if (dz < 8 && x > CAYUGA_X) h = Math.max(h, creekY(x) + BANK_UP - 3 * (1 - smoothstep(3.4, 3.9, dz))); // the ledge
    for (const t of TRAILS) {
      const dx = t.bottom - t.top;
      const dzT = t.z1 - t.z0;
      const k = clamp01(((x - t.top) * dx + (z - t.z0) * dzT) / (dx * dx + dzT * dzT));
      const d = Math.hypot(x - t.top - k * dx, z - t.z0 - k * dzT);
      h = mix(h, mix(CAMPUS_Y, t.y1, k), 1 - smoothstep(1, 2.2, d));
    }
  }
  const r = Math.hypot(x, z);
  const wedge = lakeWedge(x, z);
  // hills rise toward the edge and hide the end of the map, except to the west, where the ground runs down into the big lake
  if (r > WORLD_RADIUS - 18) h += 0.014 * Math.min(r - WORLD_RADIUS + 18, 30) ** 2 * (1 - wedge); // capped: no peaks in the corners
  h -= 8 * smoothstep(CAYUGA_X, CAYUGA_X - 22, x) * wedge;
  return h;
}

/** Height of the water surface over (x, z): the lake, the creek, or -Infinity where there is no water. */
export function waterLevelAt(x: number, z: number): number {
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 3) return WATER_LEVEL;
  if (x < CAYUGA_X) return CAYUGA_Y;
  if (x < FALLS_X && Math.abs(z - LAKE.z) < 7) return creekY(x);
  return -Infinity;
}

/** Water too deep or fast to step into: the creek and the big lake. Only the small lake can be waded. */
export const deepWater = (x: number, z: number) => heightAt(x, z) < waterLevelAt(x, z) && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 3;

/** Tiny seeded value used to roughen colours. */
const speckle = (x: number, z: number) => 0.5 + 0.5 * noise3(x * 0.9, 1.3, z * 0.9, 2);

/** Ground colour: lawn, sand on the lake shore, shale on steep slopes and gorge walls, stone paths. */
export function groundColor(x: number, z: number, h: number, out: THREE.Color): THREE.Color {
  const slope = Math.hypot(heightAt(x + 0.6, z) - h, heightAt(x, z + 0.6) - h) / 0.6;
  const patch = speckle(x * 0.25, z * 0.25);
  out.set('#4f7f33').lerp(new THREE.Color('#86a64a'), patch);
  out.lerp(new THREE.Color('#9a9a4e'), 0.35 * smoothstep(0.55, 0.9, speckle(x * 0.07 + 40, z * 0.07)));
  const dLake = Math.hypot(x - LAKE.x, z - LAKE.z);
  out.lerp(new THREE.Color('#d6c28c'), 1 - smoothstep(LAKE.r + 3, LAKE.r + 8, dLake));
  out.lerp(new THREE.Color('#6d665d').lerp(new THREE.Color('#4f4a44'), speckle(x * 0.6, z * 0.6)), smoothstep(0.45, 0.9, slope));
  out.lerp(new THREE.Color('#c9c1b0'), pathAt(x, z));
  out.multiplyScalar(0.92 + 0.16 * speckle(x * 3, z * 3));
  return out;
}

export function buildTerrain(): THREE.Mesh {
  const size = (WORLD_RADIUS + 12) * 2;
  const seg = 420;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    groundColor(x, z, h, c);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  mesh.receiveShadow = true;
  return mesh;
}

/** The lake and the creek. Aimable: looking at either is how you sample the water. */
export function buildWater(): THREE.Group {
  const mat = new THREE.MeshPhysicalMaterial({ color: '#2a6f9e', transparent: true, opacity: 0.78, roughness: 0.04, metalness: 0, clearcoat: 1 });
  const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 3, 64).rotateX(-Math.PI / 2), mat);
  lake.position.set(LAKE.x, WATER_LEVEL, LAKE.z);
  // The creek: one long strip that follows creekY down the gorge; the gorge walls hide its edges.
  const x0 = CAYUGA_X;
  const x1 = FALLS_X - 0.6;
  const geo = new THREE.PlaneGeometry(x1 - x0, 14, 40, 1).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, creekY(pos.getX(i) + (x0 + x1) / 2));
  geo.computeVertexNormals();
  const creek = new THREE.Mesh(geo, mat);
  creek.position.set((x0 + x1) / 2, 0, LAKE.z);
  lake.receiveShadow = creek.receiveShadow = true;
  // the big lake, from the west shore of the map to the far hills
  const cayuga = new THREE.Mesh(new THREE.PlaneGeometry(400, 1000).rotateX(-Math.PI / 2), mat);
  cayuga.position.set(CAYUGA_X - 200, CAYUGA_Y, -300);
  const group = new THREE.Group();
  group.add(lake, creek, cayuga);
  return group;
}
