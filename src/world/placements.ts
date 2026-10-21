// What stands where in the world. Pure data (plus a seeded scatter), no rendering, so it is easy to test and retune.
import { CRYSTAL_SPOT } from './campus';
import { LAKE, mulberry32 } from './terrain';

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
  // gathering these is locked until the Microdex discovery named by the material's unlockedBy
  copper: { gather: 'copper_ore', sample: 'copper_rock' },
  tungsten: { gather: 'tungsten_ore', sample: 'tungsten_rock' },
  sunflower: { gather: 'plant_oil', sample: 'sunflower_seed' },
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

/** Where the player starts: on the lake's south shore, facing north over the sand (the first thing to gather). */
export const SPAWN = { x: 38, z: -38 };

export const PLACEMENTS: Placement[] = [
  // A couple of leafy plants by the spawn, for a first look with the naked eye
  ...cluster('leaf', 33, -37, 2, 1.5, 10),
  // Quad lawn, south-west of the spawn
  ...cluster('leaf', -3, -7, 3, 3, 1),
  ...cluster('flower', 5, -5, 4, 3, 2, 1.2),
  { kind: 'wing', x: 2, z: -11 },
  ...cluster('sunflower', -3, -14, 3, 2.2, 3),
  // The lake, sand on its south shore right ahead of the spawn
  { kind: 'pond', x: LAKE.x, z: LAKE.z },
  ...cluster('sand', 46, -47, 9, 3.2, 4, 1.3),
  // Rocky rim of the gorge: iron near the waterfall (west of the spawn), quartz farther west behind the halls
  ...cluster('iron', 24, -49, 8, 4.5, 5),
  ...cluster('quartz', -26, -48, 7, 4, 6),
  // Shale outcrops on the west slope, west below the clock tower; the heavy rocks at its foot
  ...cluster('copper', -54, -16, 6, 4, 7),
  ...cluster('tungsten', -68, -30, 3, 2.5, 8),
  // Pines with resin stumps on the lower west slope, south-west
  ...cluster('resin', -56, 24, 3, 3, 9),
  // Mineral garden by the science building
  { kind: 'crystal', x: CRYSTAL_SPOT.x, z: CRYSTAL_SPOT.z },
];
