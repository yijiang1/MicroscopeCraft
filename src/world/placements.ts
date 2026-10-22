// What stands where in the world. Pure data (plus a seeded scatter), no rendering, so it is easy to test and retune.
import { CRYSTAL_SPOT, SCIENCE } from './campus';
import { gorgeZ, LAKE, mulberry32 } from './terrain';

export type Kind =
  | 'sand' | 'quartz' | 'iron' | 'copper' | 'tungsten' | 'sunflower' | 'resin' // gatherable
  | 'fluorite' | 'willemite' | 'monazite' | 'beryl' | 'galena' | 'iodine' | 'methylene' | 'gramkit'
  | 'leaf' | 'flower' | 'wing' | 'pond' | 'crystal' // samples to look at
  | 'bee' | 'picnic' | 'algae_mat' | 'mud' | 'feather' | 'pine_branch' | 'log' | 'mushroom' | 'moss' | 'lichen' | 'web'
  | 'fern' | 'bone' | 'onion' | 'potato' | 'orchid' | 'nettle' | 'cotton' | 'shale' | 'mica'
  | 'slides' | 'materials' | 'rack'; // cabinets holding several samples

export interface Aim {
  /** Item id gathered with E. */
  gather?: string;
  /** Sample id looked at with F. */
  sample?: string;
  /** Several samples to choose from with F (a cabinet, a table). */
  samples?: string[];
}

export const AIMS: Record<Kind, Aim> = {
  sand: { gather: 'beach_sand', sample: 'sand_grain' },
  quartz: { gather: 'quartz_sand', sample: 'quartz_grain' },
  iron: { gather: 'iron_ore', sample: 'iron_rock' },
  // gathering these is locked until the Microdex discovery named by the material's unlockedBy
  copper: { gather: 'copper_ore', sample: 'copper_rock' },
  tungsten: { gather: 'tungsten_ore', sample: 'tungsten_rock' },
  sunflower: { gather: 'plant_oil', sample: 'sunflower_seed' },
  fluorite: { gather: 'fluorite', sample: 'fluorite_rock' },
  willemite: { gather: 'willemite', sample: 'willemite_rock' },
  monazite: { gather: 'monazite', sample: 'black_sand' },
  beryl: { gather: 'beryl', sample: 'beryl_crystal' },
  galena: { gather: 'galena', sample: 'galena_rock' },
  resin: { gather: 'resin' },
  iodine: { gather: 'iodine_stain' },
  methylene: { gather: 'methylene_blue' },
  gramkit: { gather: 'gram_kit' },
  leaf: { sample: 'leaf' },
  flower: { sample: 'flower' },
  wing: { sample: 'insect_wing' },
  pond: { sample: 'pond_water' },
  crystal: { sample: 'crystal_sample' },
  bee: { sample: 'bee' },
  picnic: { samples: ['table_salt', 'paper'] },
  algae_mat: { sample: 'pond_scum' },
  mud: { sample: 'lake_mud' },
  feather: { sample: 'feather' },
  pine_branch: { samples: ['pine_needle', 'pine_pollen'] },
  log: { sample: 'bark' },
  mushroom: { sample: 'mushroom' },
  moss: { sample: 'moss' },
  lichen: { sample: 'lichen' },
  web: { sample: 'spider_web' },
  fern: { sample: 'fern' },
  bone: { sample: 'bone' },
  onion: { sample: 'onion' },
  potato: { sample: 'potato' },
  orchid: { sample: 'orchid' },
  nettle: { sample: 'nettle' },
  cotton: { sample: 'cotton' },
  shale: { sample: 'shale' },
  mica: { sample: 'mica_rock' },
  slides: { samples: ['cheek_slide', 'blood_slide', 'nerve_slide', 'bacteria_culture', 'yeast_culture', 'diatom_test', 'cell_section'] },
  materials: { samples: ['virus_grid', 'gold_grid', 'graphene_sample', 'soot_sample', 'chip_sample', 'sto_crystal', 'mos2_sample', 'uranium_film'] },
  rack: { samples: ['lysozyme', 'b12_crystals', 'dna_fiber', 'steel_sample', 'battery_cathode', 'amber_insect', 'meteorite_slice', 'silicon_crystal'] },
};

/** Every sample a thing shows, one or several. */
export const samplesOf = (aim: Aim) => aim.samples ?? (aim.sample ? [aim.sample] : []);

/** Collision / highlight radius in metres. */
export const RADIUS: Record<Kind, number> = {
  sand: 0.8, quartz: 0.7, iron: 0.6, copper: 0.6, tungsten: 0.55, sunflower: 0.3, resin: 0.4,
  fluorite: 0.6, willemite: 0.6, monazite: 0.6, beryl: 0.5, galena: 0.4, iodine: 0, methylene: 0, gramkit: 0,
  leaf: 0.55, flower: 0.35, wing: 0.4, pond: 0, crystal: 1.1,
  bee: 0.3, picnic: 0.9, algae_mat: 0, mud: 0.6, feather: 0, pine_branch: 0.5, log: 0.7, mushroom: 0.3, moss: 0.45,
  lichen: 0.6, web: 0.2, fern: 0.4, bone: 0.25, onion: 0.2, potato: 0.25, orchid: 0.2, nettle: 0.2, cotton: 0.25,
  shale: 0.6, mica: 0.6, slides: 0.8, materials: 0.8, rack: 0.7,
};

/** Things that stand inside buildings (the greenhouse, the lab, the CHESS hall) on purpose. */
export const INDOORS = new Set<Kind>(['onion', 'potato', 'orchid', 'nettle', 'cotton', 'slides', 'materials', 'iodine', 'methylene', 'gramkit', 'rack']);

export interface Placement {
  kind: Kind;
  x: number;
  z: number;
  /** Height above the ground (things on shelves). */
  y?: number;
  /** Facing, for furniture against a wall. */
  yaw?: number;
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

/** Points along the creek bank at the bottom of the gorge, `side` metres from the water's centre line. */
const creekBank = (kind: Kind, xs: number[], side: number): Placement[] => xs.map((x) => ({ kind, x, z: gorgeZ(x) + side }));

/** Where the player starts: on the lake's south shore, facing north over the sand (the first thing to gather). */
export const SPAWN = { x: 38, z: -38 };

export const PLACEMENTS: Placement[] = [
  // A couple of leafy plants by the spawn, for a first look with the naked eye
  ...cluster('leaf', 33, -37, 2, 1.5, 10),
  // Quad lawn, south-west of the spawn
  ...cluster('leaf', -3, -7, 3, 3, 1),
  ...cluster('flower', 5, -5, 4, 3, 2, 1.2),
  { kind: 'bee', x: 8.5, z: -2.5 },
  { kind: 'wing', x: 2, z: -11 },
  ...cluster('sunflower', -3, -14, 3, 2.2, 3),
  { kind: 'picnic', x: 13, z: -13, yaw: 0.4 },
  // The lake, sand on its south shore right ahead of the spawn; scum and mud at the water's edge, a feather nearby
  { kind: 'pond', x: LAKE.x, z: LAKE.z },
  ...cluster('sand', 46, -47, 9, 3.2, 4, 1.3),
  { kind: 'mud', x: 36, z: -54 },
  { kind: 'algae_mat', x: 60.5, z: -57.5 },
  { kind: 'feather', x: 41, z: -44 },
  // Rocky rim of the gorge: iron near the waterfall (west of the spawn), quartz farther west behind the halls,
  // galena east of the iron, fluorite west of the quartz
  ...cluster('iron', 24, -49, 8, 4.5, 5),
  ...cluster('galena', 14, -53, 4, 2.5, 21, 1.2),
  ...cluster('quartz', -26, -48, 10, 4.5, 6, 1.5),
  ...cluster('fluorite', -40, -50, 4, 2.5, 22),
  // Down at the creek: pale willemite rocks and dark heavy sand on the bank, a shale slab full of fossils
  ...creekBank('willemite', [2, 6, 10], 5.6),
  ...creekBank('monazite', [-12, -8, -4], 5.6),
  ...creekBank('shale', [16], -6),
  // Shale outcrops on the west slope, west below the clock tower, and more grey rocks north of the library;
  // the heavy rocks and beryl crystals at its foot; glittering mica schist on the way down
  ...cluster('copper', -54, -16, 6, 4, 7),
  ...cluster('copper', -50, 4, 6, 3.5, 23),
  ...cluster('iron', -48, -30, 5, 3, 24),
  ...cluster('tungsten', -68, -30, 5, 3.5, 8),
  ...cluster('beryl', -70, -10, 3, 2.5, 25),
  { kind: 'mica', x: -60, z: -4 },
  // Pines with resin stumps on the lower west slope, south-west; the pine grove's floor is full of life
  ...cluster('resin', -56, 24, 4, 3, 9),
  { kind: 'pine_branch', x: -61, z: 18 },
  { kind: 'log', x: -52, z: 16.5, yaw: 1.2 },
  ...cluster('mushroom', -63, 27, 2, 1.5, 26, 1),
  { kind: 'moss', x: -55, z: 30 },
  { kind: 'lichen', x: -65, z: 21 },
  { kind: 'web', x: -58, z: 13.5, yaw: 0.3 },
  ...cluster('fern', -50, 27, 2, 1.5, 27, 1.2),
  { kind: 'bone', x: -60, z: 31 },
  // Mineral garden by the science building
  { kind: 'crystal', x: CRYSTAL_SPOT.x, z: CRYSTAL_SPOT.z },
  // The greenhouse: plants in planters along the south and east walls
  { kind: 'onion', x: 4, z: 18.9, y: 0.35 },
  { kind: 'potato', x: 6.6, z: 18.9, y: 0.35 },
  { kind: 'orchid', x: 9.2, z: 18.9, y: 0.35 },
  { kind: 'nettle', x: 12.9, z: 16, y: 0.35 },
  { kind: 'cotton', x: 12.9, z: 13, y: 0.35 },
  // The science lab: stains on the shelf by the door, slides and materials samples in cabinets on the east wall
  { kind: 'iodine', x: SCIENCE.x0 + 0.45, z: 14.3, y: 0.97 },
  { kind: 'methylene', x: SCIENCE.x0 + 0.45, z: 15.2, y: 0.97 },
  { kind: 'gramkit', x: SCIENCE.x0 + 0.45, z: 16.2, y: 0.97 },
  { kind: 'slides', x: SCIENCE.x1 - 0.5, z: 14.6, yaw: -Math.PI / 2 },
  { kind: 'materials', x: SCIENCE.x1 - 0.5, z: 25.4, yaw: -Math.PI / 2 },
  // The CHESS hall in Wilson Lab: the sample rack by the south wall
  { kind: 'rack', x: 52.5, z: 4.2, yaw: Math.PI },
];
