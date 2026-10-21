import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import { microdex } from './microdex';
import { createGame, discover } from './state';

describe('microdex', () => {
  it('groups cards by biome, marks found ones and flags empty biomes as locked', () => {
    const ctx = createGame(loadGameData());
    discover(ctx, 'leaf_veins', { image: 'data:image/jpeg;base64,xx', quality: 1.3 });
    const dex = microdex(ctx.data, ctx.state);
    const meadow = dex.find((b) => b.biome === 'meadow')!;
    expect(meadow.found).toBe(1);
    expect(meadow.cards.find((c) => c.feature.id === 'leaf_veins')).toMatchObject({ found: true, snapshot: 'data:image/jpeg;base64,xx' });
    expect(dex.filter((b) => b.locked).map((b) => b.biome)).toEqual(['mine']);
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
