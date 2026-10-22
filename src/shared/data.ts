// Loads and cross-checks everything in /data. Adding a recipe or sample = adding one JSON entry.
import { z } from 'zod';
import achievementsJson from '../../data/achievements.json';
import catalogJson from '../../data/catalog.json';
import materialsJson from '../../data/materials.json';
import npcsJson from '../../data/npcs.json';
import recipesJson from '../../data/recipes.json';
import samplesJson from '../../data/samples.json';
import defaultWorldJson from '../../data/worlds/default.json';
import {
  AchievementSchema,
  CatalogSchema,
  MaterialSchema,
  NpcSchema,
  RecipeSchema,
  SampleSchema,
  type Condition,
  type GameData,
} from './schema';
import { validateWorldSpec } from './worldspec';

const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x]));

/** The mini-games that report scores (recordScore). */
export const GAMES = ['koehler', 'gram', 'soak', 'tem_align', 'ronchigram', 'ptycho', 'beam_tune', 'tomo_center'] as const;
/** Areas of the campus the world reports visits to. */
export const AREAS = ['lake', 'quad', 'gorge', 'slope', 'forest', 'garden', 'lab', 'chess', 'tower', 'engquad', 'fields', 'bridge'] as const;

/** Throws one Error listing every problem, so a bad JSON entry is easy to find. */
export function parseGameData(raw: {
  materials: unknown; recipes: unknown; samples: unknown; catalog: unknown; defaultWorld: unknown; achievements: unknown; npcs: unknown;
}): GameData {
  const materials = z.array(MaterialSchema).parse(raw.materials);
  const recipes = z.array(RecipeSchema).parse(raw.recipes);
  const samples = z.array(SampleSchema).parse(raw.samples);
  const catalog = CatalogSchema.parse(raw.catalog);
  const achievements = z.array(AchievementSchema).parse(raw.achievements);
  const npcs = z.array(NpcSchema).parse(raw.npcs);

  const items: GameData['items'] = {};
  for (const m of materials) items[m.id] = { name: m.name, color: m.color };
  for (const r of recipes) items[r.output.itemId] ??= { name: r.name, color: r.color };

  const errors: string[] = [];
  const dupes = (what: string, ids: string[]) => ids.forEach((id, i) => ids.indexOf(id) !== i && errors.push(`duplicate ${what} id "${id}"`));
  for (const r of recipes) {
    for (const i of r.inputs) if (!items[i.itemId]) errors.push(`recipe ${r.id}: unknown input "${i.itemId}"`);
    for (const s of r.scope?.steps ?? []) if (s.requires && !items[s.requires]) errors.push(`recipe ${r.id}: step "${s.label}" requires unknown item "${s.requires}"`);
  }
  for (const s of samples) {
    if (!catalog[s.worldObject]) errors.push(`sample ${s.id}: worldObject "${s.worldObject}" not in catalog`);
  }
  const featureIds = samples.flatMap((s) => s.features.map((f) => f.id));
  for (const m of materials) {
    if (m.unlockedBy && !featureIds.includes(m.unlockedBy)) errors.push(`material ${m.id}: unlockedBy "${m.unlockedBy}" is not a feature`);
  }
  dupes('feature', featureIds);
  dupes('sample', samples.map((s) => s.id));
  dupes('scientist', npcs.map((n) => n.id));
  const questIds = npcs.flatMap((n) => n.quests.map((q) => q.id));
  dupes('request', questIds);
  dupes('achievement', achievements.map((a) => a.id));
  const check = (where: string, c: Condition) => {
    for (const id of c.discovered ?? []) if (!featureIds.includes(id)) errors.push(`${where}: unknown discovery "${id}"`);
    for (const id of c.owns ?? []) if (!items[id]) errors.push(`${where}: unknown item "${id}"`);
    for (const g of Object.keys(c.best ?? {})) if (!(GAMES as readonly string[]).includes(g)) errors.push(`${where}: unknown mini-game "${g}"`);
    for (const a of c.visited ?? []) if (!(AREAS as readonly string[]).includes(a)) errors.push(`${where}: unknown area "${a}"`);
    if (c.questsOf && !npcs.some((n) => n.id === c.questsOf)) errors.push(`${where}: unknown scientist "${c.questsOf}"`);
    if (c.quest && !questIds.includes(c.quest)) errors.push(`${where}: unknown request "${c.quest}"`);
  };
  for (const a of achievements) check(`achievement ${a.id}`, a.when);
  for (const n of npcs) for (const q of n.quests) check(`request ${q.id}`, q.needs);
  const world = validateWorldSpec(raw.defaultWorld, catalog);
  if (!world.ok) errors.push(...world.errors.map((e) => `default world: ${e}`));
  if (errors.length || !world.ok) throw new Error(`Invalid game data:\n${errors.join('\n')}`);

  return { materials: byId(materials), recipes, samples: byId(samples), catalog, defaultWorld: world.spec, achievements, npcs: byId(npcs), items };
}

export const loadGameData = () =>
  parseGameData({
    materials: materialsJson,
    recipes: recipesJson,
    samples: samplesJson,
    catalog: catalogJson,
    defaultWorld: defaultWorldJson,
    achievements: achievementsJson,
    npcs: npcsJson,
  });
