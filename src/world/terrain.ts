// The ground: rolling hills, a pond basin, rocky highlands (the mine, to the east) and a flat lab pad (north).
// heightAt() is the single source of truth: the mesh, the player's feet and every placed object read it.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export const WORLD_RADIUS = 78;
export const POND = { x: -24, z: -12, r: 9 };
export const LAB = { x: 0, z: -48, r: 9 };
export const WATER_LEVEL = -0.9;
const MINE_X0 = 8; // highlands rise east of this

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

export function heightAt(x: number, z: number): number {
  let h = 1.8 * fbm2(x * 0.02, z * 0.02) + 0.25 * fbm2(x * 0.15 + 10, z * 0.15, 2);
  h += 4.5 * smoothstep(MINE_X0, MINE_X0 + 26, x) * (0.6 + 0.4 * fbm2(x * 0.05 + 3, z * 0.05, 3)); // highlands
  h = mix(h, 0.4, 1 - smoothstep(6, 16, Math.hypot(x, z))); // gentle meadow around the spawn
  const dPond = Math.hypot(x - POND.x, z - POND.z);
  h -= 3.4 * (1 - smoothstep(POND.r - 2, POND.r + 7, dPond)); // pond bowl
  const dLab = Math.hypot(x - LAB.x, z - LAB.z);
  h = mix(h, 0.5, 1 - smoothstep(LAB.r, LAB.r + 8, dLab)); // flat pad for the lab
  const r = Math.hypot(x, z);
  if (r > 60) h += 0.014 * (r - 60) ** 2; // hills rise toward the edge and hide the end of the map
  return h;
}

/** Tiny seeded value used to roughen colours. */
const speckle = (x: number, z: number) => 0.5 + 0.5 * noise3(x * 0.9, 1.3, z * 0.9, 2);

/** Ground colour: meadow grass, beach sand by the pond, bare rock in the highlands and on steep slopes, concrete at the lab. */
export function groundColor(x: number, z: number, h: number, out: THREE.Color): THREE.Color {
  const slope = Math.hypot(heightAt(x + 0.6, z) - h, heightAt(x, z + 0.6) - h) / 0.6;
  const patch = speckle(x * 0.25, z * 0.25);
  out.set('#4f7f33').lerp(new THREE.Color('#86a64a'), patch);
  out.lerp(new THREE.Color('#9a9a4e'), 0.35 * smoothstep(0.55, 0.9, speckle(x * 0.07 + 40, z * 0.07)));
  const dPond = Math.hypot(x - POND.x, z - POND.z);
  out.lerp(new THREE.Color('#d6c28c'), 1 - smoothstep(POND.r + 1, POND.r + 5, dPond));
  const rocky = Math.max(smoothstep(MINE_X0 + 2, MINE_X0 + 14, x) * 0.85, smoothstep(0.45, 0.9, slope));
  out.lerp(new THREE.Color('#7a7268').lerp(new THREE.Color('#5d574f'), speckle(x * 0.6, z * 0.6)), rocky);
  const dLab = Math.hypot(x - LAB.x, z - LAB.z);
  out.lerp(new THREE.Color('#8b9097'), 1 - smoothstep(LAB.r - 1, LAB.r + 2, dLab));
  out.multiplyScalar(0.92 + 0.16 * speckle(x * 3, z * 3));
  return out;
}

export function buildTerrain(): THREE.Mesh {
  const size = (WORLD_RADIUS + 12) * 2;
  const seg = 220;
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

/** Pond surface. Aimable: looking at it is how you sample pond water. */
export function buildWater(): THREE.Mesh {
  const geo = new THREE.CircleGeometry(POND.r + 6, 64);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({ color: '#2a6f9e', transparent: true, opacity: 0.78, roughness: 0.04, metalness: 0, clearcoat: 1 }),
  );
  mesh.position.set(POND.x, WATER_LEVEL, POND.z);
  mesh.receiveShadow = true;
  return mesh;
}
