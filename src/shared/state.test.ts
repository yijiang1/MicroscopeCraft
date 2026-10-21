import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import type { GameEvents } from './events';
import { craft, createGame, discover, gather } from './state';

describe('state actions', () => {
  it('sand → glass → lens, iron → frame → hand lens raises the tier and emits events', () => {
    const ctx = createGame(loadGameData());
    const seen: string[] = [];
    (['itemGathered', 'itemCrafted', 'tierChanged'] as (keyof GameEvents)[]).forEach((t) =>
      ctx.bus.on(t, () => seen.push(t)),
    );
    expect(craft(ctx, 'glass')).toBe(false); // nothing to craft with, state untouched
    gather(ctx, 'beach_sand', 2);
    gather(ctx, 'iron_ore');
    for (const id of ['glass', 'lens', 'frame', 'hand_lens']) expect(craft(ctx, id)).toBe(true);
    expect(ctx.state.inventory.beach_sand).toBe(0);
    expect(ctx.state.inventory.hand_lens).toBe(1);
    expect(ctx.state.scope.tier).toBe(1);
    expect(seen.filter((s) => s === 'tierChanged')).toHaveLength(1);
  });

  it('discover is idempotent; eyepiece events track the current sample', () => {
    const ctx = createGame(loadGameData());
    let unlocked = 0;
    ctx.bus.on('discoveryUnlocked', () => unlocked++);
    discover(ctx, 'leaf_veins');
    discover(ctx, 'leaf_veins');
    expect(unlocked).toBe(1);
    ctx.bus.emit('openEyepiece', { sampleId: 'leaf' });
    expect(ctx.state.currentSampleId).toBe('leaf');
    ctx.bus.emit('closeEyepiece', {});
    expect(ctx.state.currentSampleId).toBeNull();
  });
});
