// What stands where in the world. Pure data (plus a seeded scatter), no rendering, so it is easy to test and retune.
// What each kind of thing is (what it gathers or shows, its model) is in kinds.ts.
import { ATRIUM, CRYSTAL_SPOT, MUSEUM, SCIENCE } from './campus';
import type { Kind } from './kinds';
import { gorgeZ, LAKE, mulberry32 } from './terrain';

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
  // Felled logwood on the east edge of the lawn: its dark red heartwood gives hematoxylin
  { kind: 'logwood', x: 9.5, z: -8.5, yaw: 0.7 },
  // The lake, sand on its south shore right ahead of the spawn; scum and mud at the water's edge, a feather nearby
  { kind: 'pond', x: LAKE.x, z: LAKE.z },
  ...cluster('sand', 46, -47, 9, 3.2, 4, 1.3),
  { kind: 'mud', x: 36, z: -54 },
  { kind: 'algae_mat', x: 60.5, z: -57.5 },
  { kind: 'feather', x: 41, z: -44 },
  // Rocky rim of the gorge: iron near the waterfall (west of the spawn), quartz farther west behind the halls,
  // galena east of the iron, fluorite west of the quartz
  ...cluster('iron', 23, -46.5, 8, 3.5, 5),
  ...cluster('galena', 14, -53, 4, 2.5, 21, 1.2),
  ...cluster('quartz', -26, -48, 10, 4.5, 6, 1.5),
  ...cluster('fluorite', -40, -48.5, 4, 2.5, 22),
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
  // A spare bronze chime bell on a stand beside the clock tower
  { kind: 'bell', x: -31, z: 2 },
  // The engineering quad. The geology hall's rock garden, along the lawn in front of its east wall
  { kind: 'granite', x: -26, z: 65 },
  { kind: 'basalt', x: -21.5, z: 66.5 },
  { kind: 'obsidian', x: -26, z: 70 },
  { kind: 'marble', x: -21.5, z: 71.5 },
  { kind: 'chalk', x: -26, z: 80.5 },
  { kind: 'pyrite', x: -21.5, z: 81.5 },
  { kind: 'malachite', x: -26, z: 85.5 },
  { kind: 'magnetite', x: -21.5, z: 86.5 },
  { kind: 'garnet', x: -24, z: 90 },
  // the materials yard east of the south hall
  { kind: 'concrete', x: 27, z: 92.5 },
  { kind: 'brick', x: 38, z: 94.5 },
  { kind: 'ibeam', x: 33, z: 101.5, yaw: 0.3 },
  { kind: 'catconv', x: 27.5, z: 104 },
  { kind: 'solar', x: 38.5, z: 104.5, yaw: Math.PI },
  // display cases against the atrium's north wall
  { kind: 'nanocase', x: ATRIUM.x0 + 6, z: ATRIUM.z0 + 0.8 },
  { kind: 'devicecase', x: ATRIUM.x1 - 6, z: ATRIUM.z0 + 0.8 },
  // The art museum: the two big canvases on the west and north walls, three small ones side by side on the south wall
  { kind: 'nightwatch', x: MUSEUM.x0 + 0.34, z: -39.5, yaw: Math.PI / 2 },
  { kind: 'grandejatte', x: -41, z: MUSEUM.z0 + 0.34, yaw: 0 },
  { kind: 'starry', x: -43.5, z: MUSEUM.z1 - 0.34, yaw: Math.PI },
  { kind: 'pearlgirl', x: -41.3, z: MUSEUM.z1 - 0.34, yaw: Math.PI },
  { kind: 'greatwave', x: -39.3, z: MUSEUM.z1 - 0.34, yaw: Math.PI },

  // The corners of the bigger campus. North campus, across the suspension bridge: a desk and a dusty bed in the
  // first-floor room of the east residence hall, and the observatory a little north of it
  { kind: 'desk', x: 20, z: -97.5 },
  { kind: 'bed', x: 33, z: -100 },
  { kind: 'observatory', x: 26, z: -118 },
  // the north woods, west of the residence halls: tall grass with ticks, a slime mould on a log, an owl pellet on a stump
  ...cluster('tick_grass', -36, -96, 3, 3, 40, 1.5),
  { kind: 'slime_log', x: -44, z: -106, yaw: 0.6 },
  { kind: 'pellet', x: -28, z: -112 },
  // the orchard beyond the lake, its beehives, and windfall apples under the trees
  ...cluster('apple_tree', 92, -76, 5, 6, 41, 3.5),
  { kind: 'hive', x: 102, z: -66 },
  { kind: 'hive', x: 103.5, z: -66.5 },
  { kind: 'windfall', x: 86, z: -82 },
  // the farm south-east of the fields: the Dairy Bar's stand and two cows; the cornfield south of the south hall
  { kind: 'dairy_stand', x: 92, z: 76, yaw: Math.PI },
  { kind: 'cow', x: 100, z: 84 },
  { kind: 'cow', x: 104, z: 79 },
  ...cluster('corn', 6, 126, 4, 5, 42, 2.2),
  // the athletic fields: clover by the field house path, a roll of turf by the stands, the trophy case inside
  ...cluster('clover', 77, 28, 3, 2.5, 43, 1.5),
  { kind: 'turf', x: 79.5, z: -28 },
  { kind: 'trophy', x: 80.7, z: 40, yaw: Math.PI / 2 },
  // west campus and the Cayuga shore: a dock on the big lake, the road-salt heap, a window panel in the Gothic hall
  { kind: 'dock', x: -137, z: 2, yaw: Math.PI / 2 },
  { kind: 'salt_pile', x: -96, z: 24 },
  { kind: 'window', x: -100, z: 3, yaw: Math.PI / 2 },
  // the fossil quarry at the foot of the west slope, south-west
  ...cluster('ledge', -88, 80, 3, 4, 44, 2.6),
  { kind: 'trilobite', x: -80, z: 84 },
  { kind: 'sieve', x: -84, z: 70 },
  // and out at the edges: cattails where the creek meets Cayuga (reached through the north woods), dandelions east of
  // the fields, horn corals beyond the quarry, sheep at the far end of the farm, a hornet nest past the orchard
  ...cluster('cattail', -100, -88, 4, 3, 45, 1.6),
  ...cluster('dandelion', 130, 12, 4, 7, 46, 3),
  { kind: 'horn_coral', x: -75, z: 105 },
  { kind: 'sheep', x: 88, z: 100 },
  { kind: 'sheep', x: 91, z: 103 },
  { kind: 'hornet_nest', x: 120, z: -50 },
  // more of the same to keep the outer edges from being empty
  ...cluster('cattail', -121, -48, 3, 2.5, 47, 1.6),
  { kind: 'ledge', x: -116, z: 50 },
  ...cluster('apple_tree', 78, -110, 3, 4, 48, 3.5),
  ...cluster('clover', 120, 50, 3, 2.5, 49, 1.5),
  ...cluster('dandelion', 56, 66, 3, 3, 50, 2),
  ...cluster('corn', -34, 122, 3, 3, 51, 2.2),
  { kind: 'sheep', x: 62, z: 120 },
];
