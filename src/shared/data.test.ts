import { describe, expect, it } from 'vitest';
import { loadGameData, parseGameData } from './data';
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
