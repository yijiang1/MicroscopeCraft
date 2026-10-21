// What stands where in the world. Pure data (plus a seeded scatter), no rendering, so it is easy to test and retune.
import { LAB, mulberry32, POND } from './terrain';

export type Kind =
  | 'sand' | 'quartz' | 'iron' | 'copper' | 'tungsten' | 'sunflower' | 'resin' // gatherable
  | 'leaf' | 'flower' | 'wing' | 'pond' | 'crystal'; // samples to look at

export interface Aim {
  /** Item id gathered with E. */
  gather?: string;
  /** Sample id looked at with F. */
  sample?: string;
}

export const AIMS: Record<Kind, Aim> = {
  sand: { gather: 'beach_sand', sample: 'sand_grain' },
  quartz: { gather: 'quartz_sand', sample: 'quartz_grain' },
  iron: { gather: 'iron_ore' },
  copper: { gather: 'copper_ore' },
  tungsten: { gather: 'tungsten_ore' },
  sunflower: { gather: 'plant_oil' },
  resin: { gather: 'resin' },
  leaf: { sample: 'leaf' },
  flower: { sample: 'flower' },
  wing: { sample: 'insect_wing' },
  pond: { sample: 'pond_water' },
  crystal: { sample: 'crystal_sample' },
};

/** Collision / highlight radius in metres. */
export const RADIUS: Record<Kind, number> = {
  sand: 0.8, quartz: 0.7, iron: 0.6, copper: 0.6, tungsten: 0.55, sunflower: 0.3, resin: 0.4,
  leaf: 0.55, flower: 0.35, wing: 0.4, pond: 0, crystal: 1.1,
};

export interface Placement {
  kind: Kind;
  x: number;
  z: number;
}

/** n points in a disc around (cx, cz), at least `gap` apart; deterministic for a given seed. */
function cluster(kind: Kind, cx: number, cz: number, n: number, spread: number, seed: number, gap = 1.7): Placement[] {
  const rng = mulberry32(seed);
  const out: Placement[] = [];
  for (let tries = 0; out.length < n && tries < 400; tries++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * spread;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (out.every((p) => Math.hypot(p.x - x, p.z - z) >= gap)) out.push({ kind, x, z });
  }
  return out;
}

export const PLACEMENTS: Placement[] = [
  // Meadow around the spawn at the origin (looking toward -z)
  ...cluster('leaf', -3, -7, 3, 3, 1),
  ...cluster('flower', 5, -5, 4, 3, 2, 1.2),
  { kind: 'wing', x: 2, z: -11 },
  ...cluster('sunflower', -3, -14, 3, 2.2, 3),
  // Pond to the west (its bowl reaches x = -8), sand along the eastern shore
  { kind: 'pond', x: POND.x, z: POND.z },
  ...cluster('sand', -6, -6, 9, 3.2, 4, 1.3),
  // Rocky highlands (the mine) to the east
  ...cluster('iron', 16, -10, 8, 4.5, 5),
  ...cluster('quartz', 22, -3, 7, 4, 6),
  ...cluster('copper', 25, -17, 6, 4, 7),
  ...cluster('tungsten', 31, -24, 3, 2.5, 8),
  // Pine grove with resin stumps to the north-east
  ...cluster('resin', 8, -26, 3, 3, 9),
  // Workshop lab far to the north
  { kind: 'crystal', x: LAB.x, z: LAB.z },
];
