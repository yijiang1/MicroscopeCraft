import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import { validateWorldSpec } from './worldspec';

describe('world spec validator', () => {
  const { catalog, defaultWorld } = loadGameData();

  it('accepts the default world', () => expect(validateWorldSpec(defaultWorld, catalog).ok).toBe(true));

  it('rejects unknown types and wrong tiers with retry-ready messages', () => {
    const bad = {
      ...defaultWorld,
      scales: [{ tier: 2, features: [{ type: 'dragon', density: 1 }, { type: 'bacteria', density: 5 }] }],
    };
    const r = validateWorldSpec(bad, catalog);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatch(/Unknown feature type "dragon"/);
      expect(r.errors[1]).toMatch(/"bacteria" cannot appear at tier 2/);
    }
  });

  it('rejects malformed JSON shapes', () => expect(validateWorldSpec({ name: 1 }, catalog).ok).toBe(false));
});
