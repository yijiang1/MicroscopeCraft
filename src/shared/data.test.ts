import { describe, expect, it } from 'vitest';
import { loadGameData, parseGameData } from './data';
import { visibility } from './sim/optics';
import { NAKED_EYE, scopeParamsFromSpec } from './sim/scope';
import materials from '../../data/materials.json';
import recipes from '../../data/recipes.json';
import samples from '../../data/samples.json';
import catalog from '../../data/catalog.json';
import defaultWorld from '../../data/worlds/default.json';

const raw = { materials, recipes, samples, catalog, defaultWorld };

describe('game data', () => {
  it('all /data JSON validates and cross-references resolve', () => {
    const data = loadGameData();
    expect(data.recipes.length).toBeGreaterThan(0);
    expect(data.items.hand_lens?.name).toBe('Hand lens');
  });

  it('rejects a recipe with an unknown input', () => {
    const bad = { ...raw, recipes: [{ ...recipes[0], inputs: [{ itemId: 'nope', count: 1 }] }] };
    expect(() => parseGameData(bad)).toThrow(/unknown input "nope"/);
  });

  it('rejects a sample on an object missing from the catalog', () => {
    const bad = { ...raw, samples: [{ ...samples[0], worldObject: 'ghost' }] };
    expect(() => parseGameData(bad)).toThrow(/not in catalog/);
  });
});

describe('content rules', () => {
  const data = loadGameData();
  const features = Object.values(data.samples).flatMap((s) => s.features);

  it('has about a dozen discoveries', () => expect(features.length).toBeGreaterThanOrEqual(10));

  it('every Microdex blurb is exactly two sentences', () => {
    for (const f of features) expect(f.blurb.match(/[.!?](\s|$)/g)?.length, f.id).toBe(2);
  });

  it('every feature can be seen by some microscope step (perfect focus, no beam damage)', () => {
    const scopes = [NAKED_EYE, ...data.recipes.flatMap((r) => (r.scope ? r.scope.steps.map((_, i) => scopeParamsFromSpec(r.scope!, i)) : []))];
    for (const f of features) expect(scopes.some((s) => visibility(f, s).visible), f.id).toBe(true);
  });

  it('the first discovery needs the right tier: veins at tier 1, bacteria at 3, atoms only at 5', () => {
    const minTier = (id: string) =>
      Math.min(...[NAKED_EYE, ...data.recipes.flatMap((r) => (r.scope ? r.scope.steps.map((_, i) => scopeParamsFromSpec(r.scope!, i)) : []))]
        .filter((s) => visibility(features.find((f) => f.id === id)!, s).visible).map((s) => s.tier));
    expect([minTier('leaf_veins'), minTier('leaf_cells'), minTier('pond_bacteria'), minTier('crystal_lattice')]).toEqual([1, 2, 3, 5]);
  });
});
