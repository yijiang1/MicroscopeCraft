import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import type { GameEvents } from './events';
import { scopeFromInventory } from './sim/scope';
import { craft, createGame, discover, gather, setZoom } from './state';

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

describe('tier 2 and 3 crafting', () => {
  it('upgrading to the high-quality microscope consumes the compound one and unlocks oil immersion', () => {
    const ctx = createGame(loadGameData());
    const have = { beach_sand: 6, iron_ore: 3, copper_ore: 2, quartz_sand: 6, plant_oil: 1 };
    for (const [id, n] of Object.entries(have)) gather(ctx, id, n);
    const chain = [
      'glass', 'glass', 'glass', 'lens', 'lens', 'tube', 'focus_knob', 'light_source', 'compound_microscope',
      'quartz_glass', 'quartz_glass', 'quartz_glass', 'precision_lens', 'precision_lens', 'condenser', 'immersion_oil', 'hq_microscope',
    ];
    chain.forEach((id) => expect(craft(ctx, id), id).toBe(true));
    expect(ctx.state.inventory.compound_microscope).toBe(0);
    expect(ctx.state.scope.tier).toBe(3);
    expect(ctx.state.scope.steps).toHaveLength(3);
  });

  it('setZoom picks a step, clamps it, and emits only on change', () => {
    const ctx = createGame(loadGameData());
    ctx.state.inventory.compound_microscope = 1;
    ctx.state.scope = scopeFromInventory(ctx.state.inventory, ctx.data);
    let n = 0;
    ctx.bus.on('zoomChanged', () => n++);
    setZoom(ctx, 2);
    setZoom(ctx, 2);
    setZoom(ctx, 99);
    expect(ctx.state.scope.step).toBe(3);
    expect(ctx.state.scope.magnification).toBe(800);
    expect(n).toBe(2);
  });
});
