// The validator is the only path from LLM output into the game (docs/DESIGN.md). Owner: Person C.
// Errors are plain sentences so they can be sent back to the model for the one retry.
import { WorldSpecSchema, type Catalog, type WorldSpec } from './schema';

export type SpecResult = { ok: true; spec: WorldSpec } | { ok: false; errors: string[] };

export function validateWorldSpec(raw: unknown, catalog: Catalog): SpecResult {
  const parsed = WorldSpecSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'spec'}: ${i.message}`) };
  }
  const spec = parsed.data;
  const errors: string[] = [];
  for (const scale of spec.scales) {
    for (const f of scale.features) {
      const entry = catalog[f.type];
      if (!entry) errors.push(`Unknown feature type "${f.type}". Allowed: ${Object.keys(catalog).join(', ')}.`);
      else if (!entry.tiers.includes(scale.tier)) {
        errors.push(`"${f.type}" cannot appear at tier ${scale.tier}; allowed tiers: ${entry.tiers.join(', ')}.`);
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, spec };
}
