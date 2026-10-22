// Walking around, as plain geometry on the ground plane (x east, z south): keeping the player out of solid things,
// naming the part of campus they are in, and the compass and arrow texts. No rendering, so it is tested directly.
import { inChess, inGreenhouse, inLab, onDeck, type Box } from './campus';
import { FALLS_X, gorgeZ, heightAt, LAKE } from './terrain';

export const PLAYER_RADIUS = 0.35;

/** Something round the player cannot walk through: a tree, a rock, a scientist. Skipped while `alive` is false. */
export interface Solid {
  x: number;
  z: number;
  radius: number;
  alive?: boolean;
}

/** Push the point out of every wall footprint and every solid, by the shortest way out. Changes `p` in place. */
export function collide(p: { x: number; z: number }, walls: readonly Box[], solids: readonly Solid[]) {
  const r = PLAYER_RADIUS;
  for (const b of walls) {
    const cx = Math.min(Math.max(p.x, b.x0), b.x1);
    const cz = Math.min(Math.max(p.z, b.z0), b.z1);
    const d = Math.hypot(p.x - cx, p.z - cz);
    if (d >= r) continue;
    if (d > 1e-4) {
      p.x = cx + ((p.x - cx) / d) * r;
      p.z = cz + ((p.z - cz) / d) * r;
      continue;
    }
    // centre inside the box: leave by the nearest side
    const exits: [number, number][] = [[b.x0 - r, p.z], [b.x1 + r, p.z], [p.x, b.z0 - r], [p.x, b.z1 + r]];
    const [x, z] = exits.sort((u, v) => Math.hypot(u[0] - p.x, u[1] - p.z) - Math.hypot(v[0] - p.x, v[1] - p.z))[0]!;
    p.x = x;
    p.z = z;
  }
  for (const s of solids) {
    if (s.alive === false || s.radius <= 0) continue;
    const dx = p.x - s.x;
    const dz = p.z - s.z;
    const d = Math.hypot(dx, dz);
    const min = s.radius + r;
    if (d < min) {
      // A save can sit exactly where a harvested rock regenerates on reload.
      p.x = s.x + (d > 1e-4 ? dx / d : 1) * min;
      p.z = s.z + (d > 1e-4 ? dz / d : 0) * min;
    }
  }
}

/** The part of campus at (x, z), for the explorer achievement; null between areas. */
export function areaAt(x: number, z: number): string | null {
  if (inLab(x, z)) return 'lab';
  if (inChess(x, z)) return 'chess';
  if (inGreenhouse(x, z)) return 'garden';
  if (onDeck(x, z)) return 'bridge';
  if (Math.hypot(x + 38, z + 1) < 7) return 'tower';
  if (x < FALLS_X && Math.abs(z - gorgeZ(x)) < 7 && heightAt(x, z) < -5) return 'gorge';
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 9) return 'lake';
  if (Math.hypot(x + 58, z - 22) < 15) return 'forest';
  // the corners: west campus and the shore, across the gorge, past the lake, beyond the fields, below the west slope
  if (x < -78 && z > -95 && z < 40) return 'shore';
  if (z < -84) return x < -14 ? 'woods' : x < 60 ? 'north' : 'orchard';
  if (x > 60 && z < -40) return 'orchard';
  if (x < -50 && z >= 40) return 'quarry';
  if (z > 112 || (x > 60 && z > 56)) return 'farm';
  if (x < -46) return 'slope';
  if (x > -23 && x < 23 && z > -38 && z < 1) return 'quad';
  if (x > -46 && x < 50 && z > 40 && z < 110) return 'engquad';
  if (x > 76 && x < 122 && z > -36 && z < 54) return 'fields';
  return null;
}

/** The compass point of a view direction (north is -z). */
export function heading(dirX: number, dirZ: number): string {
  const deg = (Math.atan2(dirX, -dirZ) * 180) / Math.PI;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}

/** An arrow to (dx, dz) away, relative to where the player looks (dirX, dirZ), then the distance: "↗ 12 m". */
export function arrowTo(dx: number, dz: number, dirX: number, dirZ: number): string {
  const angle = (Math.atan2(-dirZ * dx + dirX * dz, dirX * dx + dirZ * dz) * 180) / Math.PI; // 0 = straight ahead, 90 = right
  const arrow = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][((Math.round(angle / 45) % 8) + 8) % 8]!;
  return `${arrow} ${Math.hypot(dx, dz).toFixed(0)} m`;
}
