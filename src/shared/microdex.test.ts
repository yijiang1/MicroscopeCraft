import { catchFish, FISH, prepareFish } from './fishing';
import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import { fishMicrodex, microdex } from './microdex';
import { createGame, discover, parseSave, toSave } from './state';

describe('microdex', () => {
  it('groups cards by biome, marks found ones and flags empty biomes as locked', () => {
    const ctx = createGame(loadGameData());
    discover(ctx, 'leaf_veins', { image: 'data:image/jpeg;base64,xx', quality: 1.3 });
    const dex = microdex(ctx.data, ctx.state);
    const meadow = dex.find((b) => b.biome === 'meadow')!;
    expect(meadow.found).toBe(1);
    expect(meadow.cards.find((c) => c.feature.id === 'leaf_veins')).toMatchObject({ found: true, snapshot: 'data:image/jpeg;base64,xx' });
    expect(dex.filter((b) => b.locked)).toEqual([]); // every biome has samples now
    expect(microdex({ samples: {} }, ctx.state).every((b) => b.locked)).toBe(true);
    expect(meadow.complete).toBe(false);
  });
  it('a sharper later snapshot replaces an earlier one; a worse one does not', () => {
    const ctx = createGame(loadGameData());
    discover(ctx, 'leaf_veins', { image: 'first', quality: 1.3 });
    discover(ctx, 'leaf_veins', { image: 'worse', quality: 1 });
    expect(ctx.state.snapshots.leaf_veins?.image).toBe('first');
    discover(ctx, 'leaf_veins', { image: 'sharper', quality: 20 });
    expect(ctx.state.snapshots.leaf_veins?.image).toBe('sharper');
  });
});

describe('fish Microdex collection', () => {
  it('records every species and retains catches after preparation and save reload', () => {
    const ctx = createGame(loadGameData());
    expect(fishMicrodex(ctx.data, ctx.state).every(f => !f.caught)).toBe(true);
    ctx.state.economy.owned.push('fishing_rod');
    for (const [index, fish] of FISH.entries()) {
      catchFish(ctx, (index + .5) / FISH.length);
      expect(fishMicrodex(ctx.data, ctx.state)[index]).toMatchObject({ caught: true, stock: 1, prepared: false, found: 0 });
      expect(prepareFish(ctx, fish.id)).toBe(true);
      const feature = ctx.data.samples[`fish_${fish.id}`]!.features[0]!;
      discover(ctx, feature.id);
      expect(fishMicrodex(ctx.data, ctx.state)[index]).toMatchObject({ caught: true, stock: 0, prepared: true, found: 1 });
    }
    ctx.state.carriedSamples = [];
    ctx.state.discoveries = [];
    expect(fishMicrodex(ctx.data, ctx.state).every(f => f.caught)).toBe(true);
    const restored = createGame(loadGameData(), undefined, parseSave(JSON.stringify(toSave(ctx.state)))!);
    expect(fishMicrodex(restored.data, restored.state)).toEqual(fishMicrodex(ctx.data, ctx.state));
  });
});
