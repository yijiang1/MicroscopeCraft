// Every kind of thing that stands in the world, one entry each: what E gathers and F shows, how solid it is, whether
// it belongs indoors, and its 3D model. A new world object is one entry here plus its spots in placements.ts.
import * as THREE from 'three';
import {
  algaeMat, beeOnFlower, bone, bottle, brickStack, catalyticConverter, chimeBell, concreteBlocks, cottonPlant, crystalCluster,
  deviceCase, fallenLog, feather, fern, flowerPatch, galenaCubes, gramKit, leafPlant, logwoodLog, materialsBench, mergeByMaterial,
  mossyStone, mushrooms, nanoCase, nettlePlant, onionPlant, orchidPlant, oreNode, picnicTable, pineBranch, potatoPlant, resinStump,
  painting, rustyBeam, sampleRack, sandNode, shaleSlab, slideCabinet, solarPanel, spiderWeb, sunflower, wingOnStone,
  acidSieve, appleTree, beehive, cloverPatch, cornStalks, cow, dairyStand, dormDesk, dustBunnies, fallenApples, limestoneLedge, observatory,
  owlPellet, plankDock, saltPile, slimeLog, stainedGlass, tallGrass, trilobiteSlab, trophyCase, turfRoll,
  cattails, dandelions, hornCorals, hornetNest, sheep,
} from './models';
import { mulberry32 } from './terrain';

export interface Aim {
  /** Item id gathered with E. */
  gather?: string;
  /** Sample id looked at with F. */
  sample?: string;
  /** Several samples to choose from with F (a cabinet, a table). */
  samples?: string[];
}

export interface KindSpec {
  aim: Aim;
  /** Collision and highlight radius in metres; 0 walks through it. */
  radius: number;
  /** Stands inside a building (the greenhouse, the lab, the CHESS hall, the atrium) on purpose. */
  indoors?: true;
  /** Keeps the facing its placement gives it (furniture against a wall) instead of a random turn. */
  fixedYaw?: true;
  /** The model, feet at the origin. `revealed` is false for an ore not identified yet: it must look like plain rock.
   *  None for the pond: the lake itself is its model (terrain.buildWater). */
  model?: (rng: () => number, revealed: boolean) => THREE.Group;
}

const big = (g: THREE.Group) => {
  g.scale.setScalar(1.25);
  return g;
};

const kinds = {
  snow: { aim: { gather: 'snow', sample: 'snow_crystal' }, radius: 0, model: () => {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: '#edf8ff', roughness: .6 });
    for (const [x,z,r] of [[0,0,.65],[.45,.2,.38],[-.4,.15,.42]] as const) {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(r,12,8),material);
      mound.scale.y=.38;mound.position.set(x,.1,z);group.add(mound);
    }
    return group;
  } },
  // gatherable (the ores, gathering locked until the Microdex discovery named by the material's unlockedBy)
  sand: { aim: { gather: 'beach_sand', sample: 'sand_grain' }, radius: 0.8, model: (rng) => sandNode(rng) },
  quartz: {
    aim: { gather: 'quartz_sand', sample: 'quartz_grain' }, radius: 0.7,
    model: (rng) => crystalCluster(rng, { colors: ['#eef2f7', '#f7eef0', '#e3ecf5'], glow: 0.08, count: 7, height: 0.8, radius: 0.09 }),
  },
  iron: { aim: { gather: 'iron_ore', sample: 'iron_rock' }, radius: 0.6, model: (rng) => oreNode('iron', rng) },
  copper: { aim: { gather: 'copper_ore', sample: 'copper_rock' }, radius: 0.6, model: (rng, revealed) => oreNode(revealed ? 'copper' : 'stone', rng) },
  tungsten: { aim: { gather: 'tungsten_ore', sample: 'tungsten_rock' }, radius: 0.55, model: (rng, revealed) => oreNode(revealed ? 'tungsten' : 'stone', rng) },
  sunflower: { aim: { gather: 'plant_oil', sample: 'sunflower_seed' }, radius: 0.3, model: (rng) => sunflower(rng) },
  resin: { aim: { gather: 'resin' }, radius: 0.4, model: (rng) => resinStump(rng) },
  logwood: { aim: { gather: 'hematoxylin' }, radius: 0.5, model: () => logwoodLog() },
  fluorite: { aim: { gather: 'fluorite', sample: 'fluorite_rock' }, radius: 0.6, model: (rng, revealed) => oreNode(revealed ? 'fluorite' : 'stone', rng) },
  willemite: { aim: { gather: 'willemite', sample: 'willemite_rock' }, radius: 0.6, model: (rng, revealed) => oreNode(revealed ? 'willemite' : 'pale', rng) },
  monazite: {
    aim: { gather: 'monazite', sample: 'black_sand' }, radius: 0.6,
    model: (rng, revealed) => sandNode(rng, revealed ? ['#4a3a2c', '#6a4a30'] : ['#3a332c', '#2a2420'], 0.8),
  },
  beryl: {
    aim: { gather: 'beryl', sample: 'beryl_crystal' }, radius: 0.5,
    model: (rng, revealed) => crystalCluster(rng, revealed
      ? { colors: ['#7fd8b8', '#9fe0d0', '#6ac8b0'], glow: 0.12, count: 5, height: 0.7, radius: 0.1 }
      : { colors: ['#d8e0dc', '#e4e8e4'], glow: 0.02, count: 5, height: 0.7, radius: 0.1 }),
  },
  galena: { aim: { gather: 'galena', sample: 'galena_rock' }, radius: 0.4, model: (rng) => galenaCubes(rng) },
  iodine: { aim: { gather: 'iodine_stain' }, radius: 0, indoors: true, fixedYaw: true, model: () => bottle('#7a3a12') },
  methylene: { aim: { gather: 'methylene_blue' }, radius: 0, indoors: true, fixedYaw: true, model: () => bottle('#2f5fb0') },
  gramkit: { aim: { gather: 'gram_kit' }, radius: 0, indoors: true, fixedYaw: true, model: () => gramKit() },

  // samples to look at: the quad, the lake, the pine grove, the slope
  leaf: { aim: { sample: 'leaf' }, radius: 0.55, model: (rng) => leafPlant(rng) },
  flower: { aim: { sample: 'flower' }, radius: 0.35, model: (rng) => flowerPatch(rng) },
  wing: { aim: { sample: 'insect_wing' }, radius: 0.4, model: (rng) => wingOnStone(rng) },
  pond: { aim: { sample: 'pond_water' }, radius: 0 },
  crystal: {
    aim: { sample: 'crystal_sample' }, radius: 1.1,
    model: (rng) => crystalCluster(rng, { colors: ['#7b6cff', '#5aa9ff', '#b07bff'], glow: 0.7, count: 12, height: 3.4, radius: 0.28 }),
  },
  bee: { aim: { sample: 'bee' }, radius: 0.3, model: (rng) => beeOnFlower(rng) },
  picnic: { aim: { samples: ['table_salt', 'paper'] }, radius: 0.9, fixedYaw: true, model: () => picnicTable() },
  algae_mat: { aim: { sample: 'pond_scum' }, radius: 0, model: (rng) => algaeMat(rng) },
  mud: { aim: { sample: 'lake_mud' }, radius: 0.6, model: (rng) => sandNode(rng, ['#5a4632', '#4a3a28'], 0.7) },
  feather: { aim: { sample: 'feather' }, radius: 0, model: () => feather() },
  pine_branch: { aim: { samples: ['pine_needle', 'pine_pollen'] }, radius: 0.5, model: (rng) => pineBranch(rng) },
  log: { aim: { sample: 'bark' }, radius: 0.7, fixedYaw: true, model: () => fallenLog() },
  mushroom: { aim: { sample: 'mushroom' }, radius: 0.3, model: (rng) => mushrooms(rng) },
  moss: { aim: { sample: 'moss' }, radius: 0.45, model: (rng) => mossyStone(rng) },
  lichen: { aim: { sample: 'lichen' }, radius: 0.6, model: (rng) => oreNode('lichen', rng) },
  web: { aim: { sample: 'spider_web' }, radius: 0.2, fixedYaw: true, model: () => spiderWeb() },
  fern: { aim: { sample: 'fern' }, radius: 0.4, model: (rng) => fern(rng) },
  bone: { aim: { sample: 'bone' }, radius: 0.25, model: () => bone() },
  shale: { aim: { sample: 'shale' }, radius: 0.6, model: (rng) => shaleSlab(rng) },
  mica: { aim: { sample: 'mica_rock' }, radius: 0.6, model: (rng) => oreNode('mica', rng) },

  // the greenhouse
  onion: { aim: { sample: 'onion' }, radius: 0.2, indoors: true, model: (rng) => onionPlant(rng) },
  potato: { aim: { sample: 'potato' }, radius: 0.25, indoors: true, model: (rng) => potatoPlant(rng) },
  orchid: { aim: { sample: 'orchid' }, radius: 0.2, indoors: true, model: () => orchidPlant() },
  nettle: { aim: { sample: 'nettle' }, radius: 0.2, indoors: true, model: (rng) => nettlePlant(rng) },
  cotton: { aim: { sample: 'cotton' }, radius: 0.25, indoors: true, model: (rng) => cottonPlant(rng) },

  // the rock garden on the engineering quad
  granite: { aim: { sample: 'granite' }, radius: 0.6, model: (rng) => big(oreNode('granite', rng)) },
  basalt: { aim: { sample: 'basalt' }, radius: 0.6, model: (rng) => big(oreNode('basalt', rng)) },
  obsidian: { aim: { sample: 'obsidian' }, radius: 0.55, model: (rng) => big(oreNode('obsidian', rng)) },
  marble: { aim: { sample: 'marble' }, radius: 0.6, model: (rng) => big(oreNode('marble', rng)) },
  chalk: { aim: { sample: 'chalk' }, radius: 0.55, model: (rng) => big(oreNode('chalk', rng)) },
  pyrite: { aim: { sample: 'pyrite' }, radius: 0.45, model: (rng) => galenaCubes(rng, '#c9a63e') },
  malachite: { aim: { sample: 'malachite' }, radius: 0.55, model: (rng) => big(oreNode('malachite', rng)) },
  magnetite: { aim: { sample: 'magnetite' }, radius: 0.55, model: (rng) => big(oreNode('magnetite', rng)) },
  garnet: { aim: { sample: 'garnet_schist' }, radius: 0.6, model: (rng) => big(oreNode('garnet', rng)) },

  // engineering materials in the yard, and a bronze bell by the clock tower
  concrete: { aim: { sample: 'concrete' }, radius: 0.6, model: () => concreteBlocks() },
  ibeam: { aim: { sample: 'rusty_steel' }, radius: 0.8, fixedYaw: true, model: () => rustyBeam() },
  brick: { aim: { sample: 'brick' }, radius: 0.5, model: () => brickStack() },
  solar: { aim: { sample: 'solar_cell' }, radius: 0.9, fixedYaw: true, model: () => solarPanel() },
  catconv: { aim: { sample: 'catalytic_converter' }, radius: 0.7, model: () => catalyticConverter() },
  bell: { aim: { sample: 'bell_bronze' }, radius: 0.8, fixedYaw: true, model: () => chimeBell() },

  // the art museum's paintings, each looked at as a whole (F), from brushstrokes down to pigment grains and X-ray maps
  starry: { aim: { sample: 'starry_night' }, radius: 0, indoors: true, fixedYaw: true, model: () => painting('starry_night') },
  pearlgirl: { aim: { sample: 'pearl_earring' }, radius: 0, indoors: true, fixedYaw: true, model: () => painting('pearl_earring') },
  greatwave: { aim: { sample: 'great_wave' }, radius: 0, indoors: true, fixedYaw: true, model: () => painting('great_wave') },
  grandejatte: { aim: { sample: 'grande_jatte' }, radius: 0, indoors: true, fixedYaw: true, model: () => painting('grande_jatte') },
  nightwatch: { aim: { sample: 'night_watch' }, radius: 0, indoors: true, fixedYaw: true, model: () => painting('night_watch') },

  // cabinets and cases holding several samples
  slides: {
    aim: { samples: ['cheek_slide', 'blood_slide', 'nerve_slide', 'bacteria_culture', 'yeast_culture', 'diatom_test', 'cell_section'] },
    radius: 0.8, indoors: true, fixedYaw: true, model: () => slideCabinet(),
  },
  materials: {
    aim: { samples: ['virus_grid', 'gold_grid', 'graphene_sample', 'soot_sample', 'chip_sample', 'sto_crystal', 'mos2_sample', 'uranium_film'] },
    radius: 0.8, indoors: true, fixedYaw: true, model: () => materialsBench(),
  },
  rack: {
    aim: { samples: ['lysozyme', 'b12_crystals', 'dna_fiber', 'steel_sample', 'battery_cathode', 'amber_insect', 'meteorite_slice', 'silicon_crystal'] },
    radius: 0.7, indoors: true, fixedYaw: true, model: () => sampleRack(),
  },
  nanocase: { aim: { samples: ['quantum_dots', 'nanotubes', 'zeolite', 'mof'] }, radius: 0.8, indoors: true, fixedYaw: true, model: () => nanoCase() },
  devicecase: { aim: { samples: ['superconductor', 'blue_led'] }, radius: 0.8, indoors: true, fixedYaw: true, model: () => deviceCase() },

  // the corners of the bigger campus. North campus: a dorm room's desk and bed, and the observatory's gutter
  desk: { aim: { samples: ['data_disc', 'phone_screen'] }, radius: 0.6, indoors: true, fixedYaw: true, model: () => dormDesk() },
  bed: { aim: { sample: 'dust_bunny' }, radius: 0.9, indoors: true, fixedYaw: true, model: (rng) => dustBunnies(rng) },
  observatory: { aim: { sample: 'micrometeorites' }, radius: 2, fixedYaw: true, model: () => observatory() },
  // the north woods
  tick_grass: { aim: { sample: 'deer_tick' }, radius: 0, model: (rng) => tallGrass(rng) },
  slime_log: { aim: { sample: 'slime_mold' }, radius: 0.7, fixedYaw: true, model: (rng) => slimeLog(rng) },
  pellet: { aim: { sample: 'owl_pellet' }, radius: 0.4, model: (rng) => owlPellet(rng) },
  // the orchard and apiary
  apple_tree: { aim: { sample: 'apple' }, radius: 0.5, model: (rng) => appleTree(rng) },
  hive: { aim: { sample: 'beehive' }, radius: 0.45, model: () => beehive() },
  windfall: { aim: { sample: 'fruit_flies' }, radius: 0, model: (rng) => fallenApples(rng) },
  // the farm, the dairy and the cornfield
  dairy_stand: { aim: { samples: ['ice_cream', 'yogurt'] }, radius: 1, fixedYaw: true, model: () => dairyStand() },
  cow: { aim: { sample: 'rumen_fluid' }, radius: 0.9, model: () => cow() },
  corn: { aim: { sample: 'maize_ear' }, radius: 0.9, model: (rng) => cornStalks(rng) },
  // the athletic fields and the field house
  clover: { aim: { sample: 'clover' }, radius: 0, model: (rng) => cloverPatch(rng) },
  turf: { aim: { sample: 'turf_infill' }, radius: 0.8, model: (rng) => turfRoll(rng) },
  trophy: { aim: { sample: 'medal' }, radius: 0.8, indoors: true, fixedYaw: true, model: () => trophyCase() },
  // west campus and the Cayuga shore
  dock: { aim: { sample: 'lake_plankton' }, radius: 0.8, fixedYaw: true, model: () => plankDock() },
  salt_pile: { aim: { sample: 'road_salt' }, radius: 1.1, model: (rng) => saltPile(rng) },
  window: { aim: { sample: 'stained_glass' }, radius: 0.4, indoors: true, fixedYaw: true, model: () => stainedGlass() },
  // the fossil quarry
  ledge: { aim: { sample: 'crinoid_limestone' }, radius: 0.9, model: (rng) => limestoneLedge(rng) },
  trilobite: { aim: { sample: 'trilobite' }, radius: 0.6, model: (rng) => trilobiteSlab(rng) },
  sieve: { aim: { sample: 'conodonts' }, radius: 0.5, model: () => acidSieve() },
  // the edges of the map: cattails at the creek mouth, dandelions past the fields, horn corals beyond the quarry,
  // sheep at the far end of the farm, a hornet nest past the orchard
  cattail: { aim: { sample: 'cattails' }, radius: 0, model: (rng) => cattails(rng) },
  dandelion: { aim: { sample: 'dandelion' }, radius: 0, model: (rng) => dandelions(rng) },
  horn_coral: { aim: { sample: 'horn_coral' }, radius: 0.6, model: (rng) => hornCorals(rng) },
  sheep: { aim: { sample: 'sheep_wool' }, radius: 0.6, model: () => sheep() },
  hornet_nest: { aim: { sample: 'hornet_nest' }, radius: 0.4, fixedYaw: true, model: () => hornetNest() },
} satisfies Record<string, KindSpec>;

export type Kind = keyof typeof kinds;
export const KINDS: Record<Kind, KindSpec> = kinds;

/** Every sample a thing shows, one or several. */
export const samplesOf = (aim: Aim) => aim.samples ?? (aim.sample ? [aim.sample] : []);

/** Build the model for a placed thing. `seed` makes each instance a little different but repeatable. */
export function buildModel(kind: Kind, seed: number, revealed = true): THREE.Group {
  const spec = KINDS[kind];
  if (!spec.model) throw new Error(`${kind} has no model of its own`);
  const rng = mulberry32(seed * 7919 + 13);
  const g = spec.model(rng, revealed);
  if (!spec.fixedYaw) g.rotation.y = rng() * 6.28;
  mergeByMaterial(g);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}
