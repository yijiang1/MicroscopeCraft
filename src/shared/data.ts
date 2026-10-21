// Loads and cross-checks everything in /data. Adding a recipe or sample = adding one JSON entry.
import { z } from 'zod';
import catalogJson from '../../data/catalog.json';
import materialsJson from '../../data/materials.json';
import recipesJson from '../../data/recipes.json';
import samplesJson from '../../data/samples.json';
import defaultWorldJson from '../../data/worlds/default.json';
import {
  CatalogSchema,
  MaterialSchema,
  RecipeSchema,
  SampleSchema,
  type GameData,
} from './schema';
import { validateWorldSpec } from './worldspec';

const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x]));

/** Throws one Error listing every problem, so a bad JSON entry is easy to find. */
export function parseGameData(raw: { materials: unknown; recipes: unknown; samples: unknown; catalog: unknown; defaultWorld: unknown }): GameData {
  const materials = z.array(MaterialSchema).parse(raw.materials);
  const recipes = z.array(RecipeSchema).parse(raw.recipes);
  const samples = z.array(SampleSchema).parse(raw.samples);
  const catalog = CatalogSchema.parse(raw.catalog);

  const items: GameData['items'] = {};
  for (const m of materials) items[m.id] = { name: m.name, color: m.color };
  for (const r of recipes) items[r.output.itemId] ??= { name: r.name, color: r.color };

  const errors: string[] = [];
  for (const r of recipes) {
    for (const i of r.inputs) if (!items[i.itemId]) errors.push(`recipe ${r.id}: unknown input "${i.itemId}"`);
  }
  for (const s of samples) {
    if (!catalog[s.worldObject]) errors.push(`sample ${s.id}: worldObject "${s.worldObject}" not in catalog`);
  }
  const featureIds = samples.flatMap((s) => s.features.map((f) => f.id));
  for (const m of materials) {
    if (m.unlockedBy && !featureIds.includes(m.unlockedBy)) errors.push(`material ${m.id}: unlockedBy "${m.unlockedBy}" is not a feature`);
  }
  for (const id of featureIds) {
    if (featureIds.indexOf(id) !== featureIds.lastIndexOf(id)) errors.push(`duplicate feature id "${id}"`);
  }
  const world = validateWorldSpec(raw.defaultWorld, catalog);
  if (!world.ok) errors.push(...world.errors.map((e) => `default world: ${e}`));
  if (errors.length || !world.ok) throw new Error(`Invalid game data:\n${errors.join('\n')}`);

  return { materials: byId(materials), recipes, samples: byId(samples), catalog, defaultWorld: world.spec, items };
}

export const loadGameData = () =>
  parseGameData({
    materials: materialsJson,
    recipes: recipesJson,
    samples: samplesJson,
    catalog: catalogJson,
    defaultWorld: defaultWorldJson,
  });
