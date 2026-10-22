import { describe, expect, it } from 'vitest';
import { allQuests } from './achievements';
import { loadGameData, parseGameData } from './data';
import { visibility } from './sim/optics';
import { NAKED_EYE, scopeParamsFromSpec } from './sim/scope';
import { StainSchema, type ScopeParams } from './schema';
import materials from '../../data/materials.json';
import recipes from '../../data/recipes.json';
import samples from '../../data/samples.json';
import catalog from '../../data/catalog.json';
import achievements from '../../data/achievements.json';
import npcs from '../../data/npcs.json';
import defaultWorld from '../../data/worlds/default.json';

const raw = { materials, recipes, samples, catalog, defaultWorld, achievements, npcs };

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

  it("rejects a scientist's request for a discovery that does not exist", () => {
    const bad = { ...raw, npcs: [{ ...npcs[0], quests: [{ ...npcs[0]!.quests[0], needs: { discovered: ['unicorn'] } }] }] };
    expect(() => parseGameData(bad)).toThrow(/unknown discovery "unicorn"/);
  });
});

describe('content rules', () => {
  const data = loadGameData();
  const features = Object.values(data.samples).flatMap((s) => s.features);
  /** Every step of every instrument, ideally set up, plus the naked eye. */
  const scopes: ScopeParams[] = [NAKED_EYE, ...data.recipes.flatMap((r) => (r.scope ? r.scope.steps.map((_, i) => scopeParamsFromSpec(r.scope!, i)) : []))];
  /** Stains are put on in the eyepiece of a light microscope (tiers 2 to 4). */
  const sees = (s: ScopeParams, f: (typeof features)[number]) =>
    [null, ...(s.tier >= 2 && s.tier <= 4 ? StainSchema.options : [])].some((stain) => visibility(f, s, stain).visible);
  const minTier = (id: string) => Math.min(...scopes.filter((s) => sees(s, features.find((f) => f.id === id)!)).map((s) => s.tier));

  it('has well over 100 discoveries', () => expect(features.length).toBeGreaterThanOrEqual(100));

  it('every Microdex blurb is exactly two sentences', () => {
    for (const f of features) expect(f.blurb.match(/[.!?](\s|$)/g)?.length, f.id).toBe(2);
  });

  it('every feature can be seen by some microscope step (perfect focus, aligned, no beam damage)', () => {
    for (const f of features) expect(scopes.some((s) => sees(s, f)), f.id).toBe(true);
  });

  it('each discovery needs the right tier: veins 1, cells 2, bacteria 3, a glow 4, atoms 5, beryllium 6, inside a seed 7', () => {
    expect(['leaf_veins', 'leaf_cells', 'pond_bacteria', 'willemite_glow', 'crystal_lattice', 'beryllium_atoms', 'seed_embryo'].map(minTier)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('X-ray maps say which absorption edge to tune above, and nothing else does', () => {
    for (const f of features) expect(!!f.edgeKeV, f.id).toBe(f.contrastIn.xrf !== undefined);
  });

  it('the "everything" achievements count everything', () => {
    expect(data.achievements.find((a) => a.id === 'discover_all')?.when.discoveries).toBe(features.length);
    expect(data.achievements.find((a) => a.id === 'quests_all')?.when.quests).toBe(allQuests(data).length);
  });

  it('every scientist has at least two requests, and every request says where to look', () => {
    for (const npc of Object.values(data.npcs)) {
      expect(npc.quests.length, npc.id).toBeGreaterThanOrEqual(2);
      for (const q of npc.quests) expect(q.hint.length, q.id).toBeGreaterThan(10);
    }
  });
});
