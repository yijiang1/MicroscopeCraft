import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import type { GameEvents } from './events';
import { scopeFromInventory } from './sim/scope';
import {
  carrySample, completeQuest, craft, createGame, discover, gather, parseSave, recordScore, SAMPLE_BAG_SIZE, selectScope, setPlayerLocation, setSite, setZoom, toSave, visit,
} from './state';

const gatherAll = (ctx: ReturnType<typeof createGame>, have: Record<string, number>) => {
  for (const [id, n] of Object.entries(have)) gather(ctx, id, n);
};

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

describe('tier 2 to 4 crafting', () => {
  it('upgrading to the high-quality microscope keeps the compound one so the two can be compared', () => {
    const ctx = createGame(loadGameData());
    gatherAll(ctx, { beach_sand: 6, iron_ore: 3, copper_ore: 2, quartz_sand: 6, plant_oil: 1 });
    const chain = [
      'glass', 'glass', 'glass', 'lens', 'lens', 'tube', 'focus_knob', 'light_source', 'compound_microscope',
      'quartz_glass', 'quartz_glass', 'quartz_glass', 'precision_lens', 'precision_lens', 'condenser', 'immersion_oil', 'hq_microscope',
    ];
    chain.forEach((id) => expect(craft(ctx, id), id).toBe(true));
    expect(ctx.state.inventory.compound_microscope).toBe(1);
    expect(ctx.state.scope.tier).toBe(3);
    expect(ctx.state.scope.steps).toHaveLength(3);
    expect(selectScope(ctx, 2)).toBe(true);
    expect(ctx.state.scope.tier).toBe(2);
    expect(ctx.state.scope.steps).toHaveLength(ctx.data.recipes.find((r) => r.id === 'compound_microscope')!.scope!.steps.length);
    setZoom(ctx, 1);
    expect(ctx.state.scope.tier).toBe(2); // zooming stays on the chosen scope
    expect(selectScope(ctx, 5)).toBe(false); // not owned
    expect(selectScope(ctx, 3)).toBe(true);
    expect(ctx.state.scope.tier).toBe(3);
  });

  it('the fluorescence microscope gains phase contrast and dark field steps as its add-ons are built', () => {
    const ctx = createGame(loadGameData());
    ctx.state.inventory.hq_microscope = 1;
    gatherAll(ctx, { quartz_sand: 10, fluorite: 2, tungsten_ore: 1, copper_ore: 1, iron_ore: 1 });
    for (const id of ['quartz_glass', 'quartz_glass', 'quartz_glass', 'precision_lens', 'fluorite_objective', 'arc_lamp', 'filter_cube', 'fluorescence_microscope']) {
      expect(craft(ctx, id), id).toBe(true);
    }
    expect(ctx.state.scope.tier).toBe(4);
    const modes = () => ctx.state.scope.steps.map((s) => s.mode);
    expect(modes()).not.toContain('phase');
    for (const id of ['quartz_glass', 'phase_kit', 'quartz_glass', 'darkfield_condenser']) expect(craft(ctx, id), id).toBe(true);
    expect(modes().filter((m) => m === 'phase')).toHaveLength(3);
    expect(modes()).toContain('darkfield');
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

describe('event order', () => {
  it('itemCrafted listeners already see the new microscope tier', () => {
    const ctx = createGame(loadGameData());
    gather(ctx, 'beach_sand', 2);
    gather(ctx, 'iron_ore');
    let tierSeen = -1;
    ctx.bus.on('itemCrafted', ({ itemId }) => itemId === 'hand_lens' && (tierSeen = ctx.state.scope.tier));
    for (const id of ['glass', 'lens', 'frame', 'hand_lens']) craft(ctx, id);
    expect(tierSeen).toBe(1);
  });
});

describe('tier 5 crafting', () => {
  it('the electron microscope is built from six components and works only in the lab', () => {
    const ctx = createGame(loadGameData());
    ctx.state.inventory.hand_lens = 1;
    gatherAll(ctx, { tungsten_ore: 3, resin: 3, iron_ore: 10, copper_ore: 9, willemite: 1, beach_sand: 2 });
    const tiers: number[] = [];
    ctx.bus.on('tierChanged', ({ tier }) => tiers.push(tier));
    const chain = [
      'filament', 'wehnelt', 'hv_tank', 'electron_gun',
      'magnetic_lens', 'magnetic_lens', 'magnetic_lens', 'magnetic_lens', 'magnetic_lens', 'aperture_strip', 'aperture_strip',
      'condenser_lenses', 'goniometer', 'objective_assembly', 'projector_lenses',
      'vacuum_seal', 'vacuum_chamber', 'vacuum_pump', 'vacuum_system', 'glass', 'viewing_screen', 'electron_microscope',
    ];
    for (const id of chain) expect(craft(ctx, id), id).toBe(true);
    expect(Object.entries(ctx.state.inventory).filter(([id, n]) => n !== 0 && id !== 'hand_lens' && id !== 'electron_microscope')).toEqual([]);
    expect(tiers).toEqual([5]); // built, even though it is far away in the lab
    expect(ctx.state.scope.tier).toBe(1); // outside the lab you still look through the hand lens
    expect(selectScope(ctx, 5)).toBe(false);
    setSite(ctx, 'lab');
    expect(ctx.state.scope.tier).toBe(5);
    setSite(ctx, 'chess');
    expect(ctx.state.scope.tier).toBe(1); // the CHESS hall is not the lab
    setSite(ctx, null);
    expect(ctx.state.scope.tier).toBe(1);
    setSite(ctx, 'lab');
    expect(ctx.state.scope.steps.map((s) => s.magnification)).toEqual([50_000, 150_000, 500_000, 2_000_000, 1]);
    expect(ctx.state.scope.steps.at(-1)?.mode).toBe('ediff');
  });

  it('a save round-trips progress and the microscope; an old save gets the new fields; a bad save starts fresh', () => {
    const ctx = createGame(loadGameData());
    gather(ctx, 'beach_sand', 2);
    gather(ctx, 'iron_ore');
    for (const id of ['glass', 'lens', 'frame', 'hand_lens']) craft(ctx, id);
    discover(ctx, 'leaf_veins');
    recordScore(ctx, 'koehler', 0.7);
    const back = createGame(loadGameData(), undefined, parseSave(JSON.stringify(toSave(ctx.state))));
    expect(back.state.inventory).toEqual(ctx.state.inventory);
    expect(back.state.discoveries).toEqual(['leaf_veins']);
    expect(back.state.best).toEqual({ koehler: 0.7 });
    expect(back.state.achievements).toEqual(ctx.state.achievements);
    expect(back.state.scope.tier).toBe(1);
    const old = parseSave(JSON.stringify({ inventory: { hand_lens: 1 }, discoveries: [], snapshots: {}, scopeChoice: null }));
    expect(old).toMatchObject({ achievements: [], quests: [], best: {}, stats: {}, visited: [], align: {} });
    expect(parseSave('{"inventory":5}')).toBeNull();
    expect(parseSave(null)).toBeNull();
  });

  it('keeps snapshots under their own key, still reads inline ones from older saves, and survives a bad snapshot key', () => {
    const shot = { image: 'data:image/jpeg;base64,AAAA', quality: 2 };
    const progress = JSON.stringify({ inventory: {}, discoveries: ['leaf_veins'], scopeChoice: null });
    expect(parseSave(progress, JSON.stringify({ leaf_veins: shot }))?.snapshots).toEqual({ leaf_veins: shot });
    const inline = JSON.stringify({ inventory: {}, discoveries: [], snapshots: { leaf_veins: shot }, scopeChoice: null });
    expect(parseSave(inline)?.snapshots).toEqual({ leaf_veins: shot });
    expect(parseSave(progress, '{not json')).toMatchObject({ discoveries: ['leaf_veins'], snapshots: {} });
    expect(toSave(createGame(loadGameData(), undefined, parseSave(inline)).state)).not.toHaveProperty('snapshots');
  });
});

describe('achievements and requests', () => {
  it('achievements unlock once, as soon as their condition holds, and one can unlock the next', () => {
    const ctx = createGame(loadGameData());
    const got: string[] = [];
    ctx.bus.on('achievementUnlocked', ({ id }) => got.push(id));
    discover(ctx, 'leaf_veins');
    expect(got).toEqual(['first_look']);
    discover(ctx, 'leaf_cells');
    expect(got).toEqual(['first_look']);
    visit(ctx, 'gorge');
    visit(ctx, 'gorge');
    expect(got).toEqual(['first_look', 'visit_gorge']);
  });

  it('a scientist accepts a request only once it is done, and doing it is an achievement', () => {
    const ctx = createGame(loadGameData());
    const got: string[] = [];
    ctx.bus.on('achievementUnlocked', ({ id }) => got.push(id));
    expect(completeQuest(ctx, 'leeuwenhoek', 'lw_animalcules')).toBe(false);
    discover(ctx, 'paramecium');
    expect(completeQuest(ctx, 'leeuwenhoek', 'lw_animalcules')).toBe(true);
    expect(completeQuest(ctx, 'leeuwenhoek', 'lw_animalcules')).toBe(false); // already shown
    expect(completeQuest(ctx, 'hooke', 'lw_animalcules')).toBe(false); // someone else's request
    expect(got).toContain('quest_lw_animalcules');
    expect(ctx.state.quests).toEqual(['lw_animalcules']);
  });

  it('mini-game scores keep the best, and a good enough score passes a request', () => {
    const ctx = createGame(loadGameData());
    recordScore(ctx, 'koehler', 0.9);
    recordScore(ctx, 'koehler', 0.4);
    expect(ctx.state.best.koehler).toBe(0.9);
    expect(completeQuest(ctx, 'abbe', 'ab_koehler')).toBe(true);
  });
});

describe('saved journey', () => {
  it('round-trips the ordered sample bag, location, facing and camera view', () => {
    const data = loadGameData();
    const ctx = createGame(data);
    carrySample(ctx, 'leaf');
    carrySample(ctx, 'gold_grid');
    const pose = { x: 40, z: 20, yaw: 1.2, pitch: -0.3, thirdPerson: false };
    setPlayerLocation(ctx, pose);
    const restored = createGame(data, undefined, parseSave(JSON.stringify(toSave(ctx.state))));
    expect(restored.state.carriedSamples).toEqual(['gold_grid', 'leaf']);
    expect(restored.state.playerLocation).toEqual(pose);
    expect(restored.state.currentSampleId).toBeNull();
    // The renderer supplies the site's current geometry after restoring the position.
    expect(restored.state.site).toBeNull();
  });

  it('keeps the newest eight distinct valid samples and emits after updating the bag', () => {
    const ctx = createGame(loadGameData());
    const ids = Object.keys(ctx.data.samples).slice(0, SAMPLE_BAG_SIZE + 1);
    const seen: string[][] = [];
    ctx.bus.on('carriedSamplesChanged', () => seen.push([...ctx.state.carriedSamples]));
    for (const id of ids) carrySample(ctx, id);
    expect(ctx.state.carriedSamples).toEqual(ids.slice(1).reverse());
    expect(seen.at(-1)).toEqual(ctx.state.carriedSamples);
    const repeated = ids[2]!;
    carrySample(ctx, repeated);
    expect(ctx.state.carriedSamples[0]).toBe(repeated);
    expect(new Set(ctx.state.carriedSamples).size).toBe(SAMPLE_BAG_SIZE);
    const count = seen.length;
    carrySample(ctx, repeated);
    carrySample(ctx, 'missing-sample');
    expect(seen).toHaveLength(count);
  });

  it('loads old saves and ignores damaged journey fields without losing progress', () => {
    const old = { inventory: { hand_lens: 1 }, discoveries: ['leaf_veins'], snapshots: {}, scopeChoice: null };
    expect(parseSave(JSON.stringify(old))).toMatchObject({ carriedSamples: [], playerLocation: null });
    const saved = parseSave(JSON.stringify({ ...old, carriedSamples: 123, playerLocation: { x: 'bad' } }));
    expect(saved).toMatchObject({ inventory: old.inventory, discoveries: old.discoveries, carriedSamples: [], playerLocation: null });
    const data = loadGameData();
    const ids = Object.keys(data.samples).slice(0, 10);
    const bag = ['missing-sample', ids[0], ids[0], ...ids.slice(1)];
    const restored = createGame(data, undefined, parseSave(JSON.stringify({ ...old, carriedSamples: bag })));
    expect(restored.state.carriedSamples).toEqual(ids.slice(0, SAMPLE_BAG_SIZE));
  });

  it('only requests a travel save when the player moves, looks, or changes view', () => {
    const ctx = createGame(loadGameData());
    let changes = 0;
    ctx.bus.on('playerMoved', () => changes++);
    const pose = { x: 38, z: -38, yaw: 0, pitch: 0, thirdPerson: true };
    setPlayerLocation(ctx, pose);
    setPlayerLocation(ctx, { ...pose });
    expect(changes).toBe(1);
    setPlayerLocation(ctx, { ...pose, yaw: 0.5 });
    setPlayerLocation(ctx, { ...pose, yaw: 0.5, thirdPerson: false });
    expect(changes).toBe(3);
    pose.x = 100;
    expect(ctx.state.playerLocation!.x).toBe(38);
  });
});
