import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import { acceptMystery, missionSample, mysteryScanBlock, predictMystery, recordMysteryScan, submitMystery } from './mysteryActions';
import { compatibleCandidates, measurements, MYSTERY_QUEST_ID, MYSTERY_SAMPLE_ID, newMystery, takeScan } from './mystery';
import { carrySample, craft, createGame, gather, parseSave, SAMPLE_BAG_SIZE, selectScope, setPlayerLocation, setSite, setZoom, toSave, type GameContext } from './state';

const atBragg = (ctx: GameContext) => {
  const npc = ctx.data.npcs.bragg!;
  setPlayerLocation(ctx, { x: npc.x, z: npc.z + 2, yaw: 0, pitch: 0, thirdPerson: true });
};
/** Use actual recipes/actions: no invented instrument spec or direct scope assignment. */
function build(ctx: GameContext, id: string) {
  const recipe = ctx.data.recipes.find((r) => r.output.itemId === id)!;
  for (const input of recipe.inputs) {
    while ((ctx.state.inventory[input.itemId] ?? 0) < input.count) {
      if (ctx.data.materials[input.itemId]) gather(ctx, input.itemId, input.count);
      else build(ctx, input.itemId);
    }
  }
  expect(craft(ctx, recipe.id)).toBe(true);
}
function loadedTem() {
  const ctx = createGame(loadGameData());
  atBragg(ctx); expect(acceptMystery(ctx, 32)).toBe(true);
  build(ctx, 'electron_microscope');
  setSite(ctx, 'lab'); selectScope(ctx, 5);
  ctx.bus.emit('openEyepiece', { sampleId: MYSTERY_SAMPLE_ID });
  predictMystery(ctx, 'copper');
  return ctx;
}
const diffraction = (ctx: GameContext) => setZoom(ctx, ctx.state.scope.steps.findIndex((s) => s.mode === 'ediff' || s.mode === 'xrd'));

describe('mystery mission in the main game', () => {
  it('must be accepted from Bragg and gives a prepared carried sample without granting an instrument', () => {
    const ctx = createGame(loadGameData());
    expect(acceptMystery(ctx, 1)).toBe(false);
    expect(missionSample(ctx, MYSTERY_SAMPLE_ID)).toBeUndefined();
    atBragg(ctx);
    expect(acceptMystery(ctx, 1)).toBe(true);
    expect(ctx.state.inventory).toEqual({});
    expect(ctx.state.carriedSamples).toContain(MYSTERY_SAMPLE_ID);
    expect(missionSample(ctx, MYSTERY_SAMPLE_ID)?.name).toContain('unknown');
    expect(acceptMystery(ctx, 2)).toBe(false);
    expect(recordMysteryScan(ctx, 'fine111')).toBe(false);
  });

  it('requires the carried unknown, a crafted microscope, the right station and diffraction mode', () => {
    const ctx = loadedTem();
    expect(ctx.state.scope.mode).toBe('tem');
    expect(recordMysteryScan(ctx, 'fine111')).toBe(false);
    diffraction(ctx);
    expect(mysteryScanBlock(ctx)).toBeNull();
    ctx.bus.emit('openEyepiece', { sampleId: 'leaf' });
    expect(recordMysteryScan(ctx, 'fine111')).toBe(false);
    ctx.bus.emit('openEyepiece', { sampleId: MYSTERY_SAMPLE_ID });
    setSite(ctx, null);
    expect(recordMysteryScan(ctx, 'fine111')).toBe(false);
    setSite(ctx, 'lab'); selectScope(ctx, 5); diffraction(ctx);
    expect(recordMysteryScan(ctx, 'fine111')).toBe(true);
    expect(ctx.state.mystery!.scans[0]!.instrument).toMatchObject({ tier: 5, mode: 'ediff', site: 'lab' });
    expect(recordMysteryScan(ctx, 'fine111')).toBe(false);
    ctx.bus.emit('closeEyepiece', {});
    expect(recordMysteryScan(ctx, 'fine200')).toBe(false);
  });

  it('also uses the player-built CHESS beamline, while rejecting fluorescence mode', () => {
    const ctx = createGame(loadGameData()); atBragg(ctx); acceptMystery(ctx, 8);
    const recipe = ctx.data.recipes.find((r) => r.scope?.tier === 7)!;
    build(ctx, recipe.output.itemId);
    setSite(ctx, 'chess'); selectScope(ctx, 7);
    ctx.bus.emit('openEyepiece', { sampleId: MYSTERY_SAMPLE_ID }); predictMystery(ctx, 'nickel');
    setZoom(ctx, ctx.state.scope.steps.findIndex((s) => s.mode === 'xrf'));
    expect(recordMysteryScan(ctx, 'fine111')).toBe(false);
    diffraction(ctx);
    expect(recordMysteryScan(ctx, 'fine111')).toBe(true);
    expect(ctx.state.mystery!.scans[0]!.instrument).toMatchObject({ tier: 7, mode: 'xrd', site: 'chess' });
  });

  it('preserves the mission sample in a full bag and restores evidence with the main save', () => {
    const ctx = loadedTem(); diffraction(ctx); recordMysteryScan(ctx, 'fine111');
    for (const id of Object.keys(ctx.data.samples).slice(0, 12)) carrySample(ctx, id);
    expect(ctx.state.carriedSamples).toHaveLength(SAMPLE_BAG_SIZE);
    expect(ctx.state.carriedSamples).toContain(MYSTERY_SAMPLE_ID);
    const restored = createGame(ctx.data, undefined, parseSave(JSON.stringify(toSave(ctx.state))));
    expect(restored.state.mystery).toEqual(ctx.state.mystery);
    expect(restored.state.carriedSamples).toContain(MYSTERY_SAMPLE_ID);
    expect(restored.state.currentSampleId).toBeNull();
    expect(recordMysteryScan(restored, 'fine200')).toBe(false);
    const fake = takeScan(newMystery(1), 'fine111', 'copper');
    expect(parseSave(JSON.stringify({ ...toSave(ctx.state), mystery: fake }))?.mystery).toBeNull();
    expect(parseSave(JSON.stringify({ ...toSave(ctx.state), mystery: { version: 1, seed: 1, scans: [] } }))?.mystery).toBeNull();
  });

  it('requires returning to Bragg, then records the journal quest and achievement exactly once', () => {
    const ctx = loadedTem(); diffraction(ctx);
    recordMysteryScan(ctx, 'fine111'); recordMysteryScan(ctx, 'fine200');
    const ms = measurements(ctx.state.mystery!);
    const correct = compatibleCandidates(ms)[0]!.id;
    const ids = ms.map((m) => m.id);
    setPlayerLocation(ctx, { x: 0, z: 50, yaw: 0, pitch: 0, thirdPerson: true });
    expect(submitMystery(ctx, correct, ids).accepted).toBe(false);
    atBragg(ctx);
    expect(submitMystery(ctx, correct, []).accepted).toBe(false);
    expect(submitMystery(ctx, correct, ids).accepted).toBe(true);
    expect(ctx.state.quests).toContain(MYSTERY_QUEST_ID);
    expect(ctx.state.stats.mystery_identified).toBe(1);
    expect(ctx.state.achievements.some((id) => id.includes(MYSTERY_QUEST_ID))).toBe(true);
    expect(submitMystery(ctx, correct, ids).accepted).toBe(false);
    expect(acceptMystery(ctx, 9)).toBe(true);
    expect(ctx.state.mystery!.scans).toEqual([]);
    expect(ctx.state.carriedSamples.filter((id) => id === MYSTERY_SAMPLE_ID)).toHaveLength(1);
  });
});
