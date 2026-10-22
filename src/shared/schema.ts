// The shared contract: every type is a Zod schema, so the same definition is the TS type,
// the runtime validator (client data loading, tests, server world-spec validator) and,
// via z.toJSONSchema(), the JSON Schema for LLM prompts.
// Change these only after telling the team (see README → Contributing).
// Units: all lengths are micrometres (µm), spelled out in field names (sizeUm, dLensUm).
import { z } from 'zod';
import type { MysteryRun } from './mystery';

/** 0 naked eye · 1 hand lens · 2 compound · 3 high-quality optics · 4 fluorescence (phase contrast, dark field)
 *  · 5 transmission electron · 6 aberration-corrected STEM · 7 synchrotron beamline (see DESIGN.md). */
export const TierSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7),
]);
export type Tier = z.infer<typeof TierSchema>;

const Id = z.string().regex(/^[a-z0-9_]+$/, 'ids are lower_snake_case');
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color is #rrggbb');

/** How a zoom step makes its picture: light (bright field, phase contrast, dark field, fluorescence), electrons (tem =
 *  transmission bright field, ediff = electron diffraction, haadf = annular dark-field STEM, ptycho = ptychography) or
 *  X-rays (xct = tomography, xrf = fluorescence map, xrd = diffraction). ediff and xrd record lattice spacings, not a picture. */
export const ModeSchema = z.enum(['brightfield', 'phase', 'darkfield', 'fluorescence', 'tem', 'ediff', 'haadf', 'ptycho', 'xct', 'xrf', 'xrd']);
export type Mode = z.infer<typeof ModeSchema>;
/** Stains the player puts on a sample in the eyepiece (light microscopes). */
export const StainSchema = z.enum(['iodine', 'methylene_blue', 'gram', 'hematoxylin']);
export type Stain = z.infer<typeof StainSchema>;
/** Anything that can change how strongly a feature stands out: an imaging mode or a stain. */
export const ContrastKeySchema = z.enum([...ModeSchema.options, ...StainSchema.options]);
export type ContrastKey = z.infer<typeof ContrastKeySchema>;
/** Where a fixed instrument is installed: the science lab or the CHESS hall in Wilson Lab. */
export const SiteSchema = z.enum(['lab', 'chess']);
export type Site = z.infer<typeof SiteSchema>;

/** How the 2D scope renderer draws a feature or catalog type. Add a value here when Person B adds a drawing. */
export const DrawingSchema = z.enum([
  'veins', 'grains', 'hair', 'cells', 'pollen', 'rods', 'algae', 'scales', 'virus', 'droplets', 'lattice',
  'stomata', 'fibers', 'lines', 'ciliate', 'colony', 'beads', 'flagellate', 'cubes', 'prisms', 'needles', 'spots',
  'rings', 'helix', 'glow', 'map', 'slice', 'honeycomb', 'atoms', 'dumbbells', 'discs', 'neurons', 'critter',
  'facets', 'boxes', 'mosaic', 'cluster', 'diatoms', 'saccate', 'clubs',
]);
export type Drawing = z.infer<typeof DrawingSchema>;

export const MaterialSchema = z.object({
  id: Id,
  name: z.string(),
  color: Color,
  /** Where to find it in the world, in plain words (shown in the goal panel and by the guide). */
  where: z.string().optional(),
  /** Feature id (a Microdex discovery) the player must have seen before this can be gathered:
   *  the material is only recognisable under a microscope. Absent = gatherable from the start. */
  unlockedBy: z.string().optional(),
  /** Numeric properties that feed the simulation, e.g. { purity: 0.7 }. Free-form on purpose. */
  properties: z.record(z.string(), z.number()).default({}),
});
export type Material = z.infer<typeof MaterialSchema>;

/** One selectable setting (objective + eyepiece, or a detector mode). NA belongs to the objective, so it changes with the step.
 *  In the diffraction modes NA is the sine of the largest scattering angle the detector catches (Bragg's d = λ/2 sinθ). */
export const ZoomStepSchema = z.object({
  label: z.string(),
  magnification: z.number().positive(),
  NA: z.number().positive(),
  mode: ModeSchema.default('brightfield'),
  /** An add-on item that unlocks this step (e.g. the phase contrast kit). Absent = always there. */
  requires: Id.optional(),
  /** Overrides the instrument's lens blur for this step, µm (a focused X-ray beam, a reconstruction). */
  dLensUm: z.number().nonnegative().optional(),
  /** Overrides the accelerating voltage for this step, volts. */
  voltageV: z.number().positive().optional(),
});
export type ZoomStep = z.infer<typeof ZoomStepSchema>;

/** What owning a crafted item gives the player: a microscope. Highest tier owned wins. */
export const ScopeSpecSchema = z.object({
  tier: TierSchema,
  steps: z.array(ZoomStepSchema).min(1),
  /** Lens-defect blur on top of diffraction, µm. */
  dLensUm: z.number().nonnegative(),
  contrastBoost: z.number().positive().default(1),
  /** Electron scopes only: accelerating voltage in volts. */
  voltageV: z.number().positive().optional(),
  /** X-ray scopes only: photon energy in keV. Absent (and no voltage) = visible light. */
  xrayKeV: z.number().positive().optional(),
  /** Fixed instruments only work where they are installed. Absent = portable. */
  site: SiteSchema.optional(),
  /** Has a condenser whose illumination the player aligns (Köhler), which sets the illumination NA. */
  condenser: z.boolean().default(false),
});
export type ScopeSpec = z.infer<typeof ScopeSpecSchema>;

/** A lens the player ground at the workbench. It is curved equally on both sides, so this one radius sets its
 *  focal length (sim/assembly.ts). */
export const LensBuildSchema = z.object({
  radiusMm: z.number().min(1).max(500),
  /** Width of the stop in front of an objective, mm; absent = the whole lens. */
  stopMm: z.number().positive().optional(),
});
export type LensBuild = z.infer<typeof LensBuildSchema>;

/** A compound microscope the player put together by hand at the workbench. Its optics replace the recipe's zoom
 *  steps (sim/assembly.ts); style and name are only looks. */
export const CompoundBuildSchema = z.object({
  /** On the revolving nosepiece, one zoom step each. */
  objectives: z.array(LensBuildSchema).min(1).max(3),
  eyepiece: LensBuildSchema,
  /** Distance from the objective lens to the eyepiece lens, mm (the tube telescopes). */
  tubeMm: z.number().min(100).max(300),
  /** Looks, by part: a shape or a finish name (free-form, so new looks need no schema change). */
  style: z.record(z.string(), z.string()).default({}),
  /** Engraved on the base. */
  name: z.string().max(24).default(''),
});
export type CompoundBuild = z.infer<typeof CompoundBuildSchema>;

export const RecipeSchema = z.object({
  id: Id,
  name: z.string(),
  station: z.enum(['hand', 'furnace', 'bench']),
  /** Put together by hand at the workbench instead of crafted with C: the player's build sets the zoom steps. */
  assembly: z.literal('compound').optional(),
  /** keep = needed to craft but not used up (a scope you build on stays in your inventory so you can compare). */
  inputs: z.array(z.object({ itemId: Id, count: z.number().int().positive(), keep: z.boolean().optional() })).min(1),
  output: z.object({ itemId: Id, count: z.number().int().positive() }),
  /** Set when the output is a microscope. */
  scope: ScopeSpecSchema.optional(),
  /** Output color in the inventory/UI. */
  color: Color.default('#cccccc'),
  /** One line on what the part is, shown in the tech tree. */
  about: z.string().optional(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

/** One thing that can be seen on a sample; its id is also the Microdex discovery id. */
export const FeatureSchema = z.object({
  id: Id,
  name: z.string(),
  sizeUm: z.number().positive(),
  /** 0..1 in bright field (stains and imaging modes can change it, see contrastIn). */
  contrast: z.number().min(0).max(1),
  /** Contrast under another imaging mode or stain. The exclusive modes (fluorescence, diffraction, XRF) show only
   *  the features listed for them; the others fall back to `contrast`. */
  contrastIn: z.partialRecord(ContrastKeySchema, z.number().min(0).max(1)).default({}),
  drawing: DrawingSchema,
  /** Colour for the drawing; absent = the drawing's own colour. */
  tint: Color.optional(),
  /** Electron-beam damage: dose (electrons/nm²) that destroys most of the signal. Absent = beam-proof. */
  criticalDoseENm2: z.number().positive().optional(),
  /** X-ray fluorescence maps: absorption edge (keV) of the element mapped; the beam must be tuned above it. */
  edgeKeV: z.number().positive().optional(),
  /** Bacteria: how the cell wall takes the Gram stain. */
  gram: z.enum(['positive', 'negative']).optional(),
  /** Surface texture drawn over the larger features instead of under them (default: smaller features sit underneath). */
  onTop: z.boolean().default(false),
  /** Microdex card text: two sentences. */
  blurb: z.string(),
});
export type Feature = z.infer<typeof FeatureSchema>;

export const BiomeSchema = z.enum(['meadow', 'pond', 'forest', 'garden', 'mine', 'lab', 'chess', 'eng', 'museum']);
export type Biome = z.infer<typeof BiomeSchema>;

export const SampleSchema = z.object({
  id: Id,
  name: z.string(),
  /** Id of the object in the world that this sample sits on (e.g. the leaf cube). */
  worldObject: Id,
  biome: BiomeSchema,
  features: z.array(FeatureSchema).min(1),
});
export type Sample = z.infer<typeof SampleSchema>;

/** Something to reach: every listed part must hold. Used by achievements and by the scientists' requests. */
export const ConditionSchema = z
  .object({
    /** At least this many Microdex discoveries. */
    discoveries: z.number().int().positive().optional(),
    /** Every one of these discoveries. */
    discovered: z.array(Id).min(1).optional(),
    /** Every one of these items. */
    owns: z.array(Id).min(1).optional(),
    /** Every discovery of this biome. */
    biome: BiomeSchema.optional(),
    /** At least this many requests done for the scientists. */
    quests: z.number().int().positive().optional(),
    /** This request done (the achievement every request gives). */
    quest: Id.optional(),
    /** Every request of this scientist. */
    questsOf: Id.optional(),
    /** Best mini-game scores (0..1) at least these. */
    best: z.record(Id, z.number().min(0).max(1)).optional(),
    /** Counters (gathered, crafted, ...) at least these. */
    stats: z.record(Id, z.number().positive()).optional(),
    /** Every one of these areas visited. */
    visited: z.array(Id).min(1).optional(),
    /** At least this many achievements. */
    achievements: z.number().int().positive().optional(),
  })
  .refine((c) => Object.values(c).some((v) => v !== undefined), 'a condition needs at least one part');
export type Condition = z.infer<typeof ConditionSchema>;

export const AchievementSchema = z.object({
  id: Id,
  name: z.string(),
  description: z.string(),
  when: ConditionSchema,
});
export type Achievement = z.infer<typeof AchievementSchema>;

/** A request from a scientist: show them something you discovered (or built, or mastered). Doing it is an achievement. */
export const QuestSchema = z.object({
  id: Id,
  /** The achievement's name. */
  title: z.string(),
  /** What they ask for, in their words. */
  ask: z.string(),
  /** Where and how to find it. */
  hint: z.string(),
  /** What they say when you show them. */
  thanks: z.string(),
  needs: ConditionSchema,
});
export type Quest = z.infer<typeof QuestSchema>;

/** A scientist who made a discovery with a microscope, standing somewhere on campus. */
export const NpcSchema = z.object({
  id: Id,
  name: z.string(),
  years: z.string(),
  /** One line: what they are known for. */
  role: z.string(),
  /** Two or three sentences of history, checked against sources. */
  bio: z.string(),
  /** What they may talk about in chat (their field, work and life); anything else they decline. */
  expertise: z.string(),
  greeting: z.string(),
  x: z.number(),
  z: z.number(),
  /** Direction they face, radians (0 = north, -z). */
  facing: z.number().default(0),
  look: z.object({
    skin: Color,
    hair: Color,
    coat: Color,
    pants: Color,
    hairStyle: z.enum(['short', 'long', 'wig', 'bald', 'bun', 'bob']).default('short'),
    beard: Color.optional(),
    glasses: z.boolean().default(false),
  }),
  quests: z.array(QuestSchema).min(1),
});
export type Npc = z.infer<typeof NpcSchema>;

/** Object types the world-spec validator accepts, with allowed size range and the tiers they may appear at. */
export const CatalogEntrySchema = z.object({
  label: z.string(),
  drawing: DrawingSchema,
  minSizeUm: z.number().positive(),
  maxSizeUm: z.number().positive(),
  tiers: z.array(TierSchema).min(1),
});
export const CatalogSchema = z.record(Id, CatalogEntrySchema);
export type Catalog = z.infer<typeof CatalogSchema>;

/** The only thing the LLM produces. Shape matches the example in DESIGN.md. */
export const WorldSpecSchema = z.object({
  name: z.string().min(1),
  scales: z
    .array(
      z.object({
        tier: TierSchema,
        features: z
          .array(
            z.object({
              type: Id,
              species_hint: z.string().optional(),
              shape: z.string().optional(),
              density: z.number().int().min(1).max(1000),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  /** Keyed by tier number as a string (JSON object keys are strings). */
  learning_notes: z.record(z.string(), z.string()),
});
export type WorldSpec = z.infer<typeof WorldSpecSchema>;

/** Derived from the microscope in use and the chosen zoom step; recomputed by state.ts. */
export interface ScopeParams {
  tier: Tier;
  /** The steps available now (add-ons you have not built are left out). */
  steps: ZoomStep[];
  /** Index into steps; magnification, NA and mode below are steps[step]. */
  step: number;
  magnification: number;
  NA: number;
  mode: Mode;
  wavelengthUm: number;
  dLensUm: number;
  contrastBoost: number;
  /** NA of the illumination; absent = matched to the objective (a well-aligned condenser), so d = λ / 2NA. */
  illuminationNA?: number;
  /** Has a condenser to align (Köhler). */
  condenser: boolean;
  site?: Site;
}

/** Ground position and view; vertical jump motion is deliberately not restored. */
export const PlayerLocationSchema = z.object({
  x: z.number().finite(),
  z: z.number().finite(),
  yaw: z.number().finite(),
  pitch: z.number().min(-Math.PI / 2).max(Math.PI / 2),
  thirdPerson: z.boolean(),
});
export type PlayerLocation = z.infer<typeof PlayerLocationSchema>;

export interface GameState {
  /** NPC-issued investigation, saved with the main game. */
  mystery?: MysteryRun | null;
  carriedSamples: string[];
  playerLocation: PlayerLocation | null;
  inventory: Record<string, number>;
  discoveries: string[];
  /** The best picture the player has had of each discovery (small image data URL), by feature id.
   *  quality = feature size ÷ d_eff at capture; a sharper later view replaces an earlier one. */
  snapshots: Record<string, { image: string; quality: number }>;
  /** Sample currently under the eyepiece; null when the eyepiece is closed. */
  currentSampleId: string | null;
  /** Tier of the microscope the player picked in the eyepiece; null = the best one owned. */
  scopeChoice: Tier | null;
  /** Where the player stands, if at a site with fixed instruments (the lab, the CHESS hall); null elsewhere. */
  site: Site | null;
  scope: ScopeParams;
  /** Achievement ids earned, in order. */
  achievements: string[];
  /** Scientists' requests done (quest ids). */
  quests: string[];
  /** Best score (0..1) of each mini-game. */
  best: Record<string, number>;
  /** Counters: gathered, crafted, looked, ... */
  stats: Record<string, number>;
  /** Areas of the campus the player has been to. */
  visited: string[];
  /** Knob positions the player left on aligned instruments (they keep their alignment). */
  align: Record<string, number>;
  /** Microscopes the player built by hand at the workbench, by item id. */
  builds: Record<string, CompoundBuild>;
  /** Advanced mode: the compound microscope is built by hand at the workbench. Easy mode (the default) crafts it with
   *  C like every other instrument, and any hand-built optics are set aside. */
  advanced: boolean;
}

/** Everything the app loads from /data, validated, with cross-references checked. */
export interface GameData {
  materials: Record<string, Material>;
  recipes: Recipe[];
  samples: Record<string, Sample>;
  catalog: Catalog;
  defaultWorld: WorldSpec;
  achievements: Achievement[];
  npcs: Record<string, Npc>;
  /** Display info for every item id: materials plus recipe outputs. */
  items: Record<string, { name: string; color: string }>;
}
