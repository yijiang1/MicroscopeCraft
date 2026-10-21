// The shared contract: every type is a Zod schema, so the same definition is the TS type,
// the runtime validator (client data loading, tests, server world-spec validator) and,
// via z.toJSONSchema(), the JSON Schema for LLM prompts.
// Change these only after telling the team (see README → Contributing).
// Units: all lengths are micrometres (µm), spelled out in field names (sizeUm, dLensUm).
import { z } from 'zod';

/** 0 naked eye · 1 hand lens · 2 compound · 3 high-quality optics · 5 electron (4 and 6 reserved, see DESIGN.md). */
export const TierSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(5)]);
export type Tier = z.infer<typeof TierSchema>;

const Id = z.string().regex(/^[a-z0-9_]+$/, 'ids are lower_snake_case');
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color is #rrggbb');

/** How the 2D scope renderer draws a feature or catalog type. Add a value here when Person B adds a drawing. */
export const DrawingSchema = z.enum(['veins', 'grains', 'hair', 'cells', 'pollen', 'rods', 'algae', 'scales', 'virus', 'lattice']);
export type Drawing = z.infer<typeof DrawingSchema>;

export const MaterialSchema = z.object({
  id: Id,
  name: z.string(),
  color: Color,
  /** Where to find it in the world, in plain words (shown in the goal panel and by the guide). */
  where: z.string().optional(),
  /** Numeric properties that feed the simulation, e.g. { purity: 0.7 }. Free-form on purpose. */
  properties: z.record(z.string(), z.number()).default({}),
});
export type Material = z.infer<typeof MaterialSchema>;

/** One selectable magnification setting (objective + eyepiece). NA belongs to the objective, so it changes with the step. */
export const ZoomStepSchema = z.object({
  label: z.string(),
  magnification: z.number().positive(),
  NA: z.number().positive(),
});
export type ZoomStep = z.infer<typeof ZoomStepSchema>;

/** What owning a crafted item gives the player: a microscope. Highest tier owned wins. */
export const ScopeSpecSchema = z.object({
  tier: TierSchema,
  steps: z.array(ZoomStepSchema).min(1),
  /** Lens-defect blur on top of diffraction, µm. */
  dLensUm: z.number().nonnegative(),
  contrastBoost: z.number().positive().default(1),
  /** Electron scopes only: accelerating voltage in volts. Absent = visible light. */
  voltageV: z.number().positive().optional(),
});
export type ScopeSpec = z.infer<typeof ScopeSpecSchema>;

export const RecipeSchema = z.object({
  id: Id,
  name: z.string(),
  station: z.enum(['hand', 'furnace', 'bench']),
  inputs: z.array(z.object({ itemId: Id, count: z.number().int().positive() })).min(1),
  output: z.object({ itemId: Id, count: z.number().int().positive() }),
  /** Set when the output is a microscope. */
  scope: ScopeSpecSchema.optional(),
  /** Output color in the inventory/UI. */
  color: Color.default('#cccccc'),
});
export type Recipe = z.infer<typeof RecipeSchema>;

/** One thing that can be seen on a sample; its id is also the Microdex discovery id. */
export const FeatureSchema = z.object({
  id: Id,
  name: z.string(),
  sizeUm: z.number().positive(),
  /** 0..1, set by sample type (stains/imaging method multiply it via ScopeParams.contrastBoost). */
  contrast: z.number().min(0).max(1),
  drawing: DrawingSchema,
  /** Electron-beam damage: dose (electrons/nm²) that destroys most of the signal. Absent = beam-proof. */
  criticalDoseENm2: z.number().positive().optional(),
  /** Surface texture drawn over the larger features instead of under them (default: smaller features sit underneath). */
  onTop: z.boolean().default(false),
  /** Microdex card text: two sentences. */
  blurb: z.string(),
});
export type Feature = z.infer<typeof FeatureSchema>;

export const BiomeSchema = z.enum(['meadow', 'pond', 'mine', 'lab']);
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

/** Derived from the best microscope owned and the chosen zoom step; recomputed by state.ts. */
export interface ScopeParams {
  tier: Tier;
  steps: ZoomStep[];
  /** Index into steps; magnification and NA below are steps[step]. */
  step: number;
  magnification: number;
  NA: number;
  wavelengthUm: number;
  dLensUm: number;
  contrastBoost: number;
}

export interface GameState {
  inventory: Record<string, number>;
  discoveries: string[];
  /** The best picture the player has had of each discovery (small image data URL), by feature id.
   *  quality = feature size ÷ d_eff at capture; a sharper later view replaces an earlier one. */
  snapshots: Record<string, { image: string; quality: number }>;
  /** Sample currently under the eyepiece; null when the eyepiece is closed. */
  currentSampleId: string | null;
  scope: ScopeParams;
}

/** Everything the app loads from /data, validated, with cross-references checked. */
export interface GameData {
  materials: Record<string, Material>;
  recipes: Recipe[];
  samples: Record<string, Sample>;
  catalog: Catalog;
  defaultWorld: WorldSpec;
  /** Display info for every item id: materials plus recipe outputs. */
  items: Record<string, { name: string; color: string }>;
}
