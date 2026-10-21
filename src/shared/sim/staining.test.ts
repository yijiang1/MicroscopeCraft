import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data';
import { visibility } from './optics';
import { scopeFromInventory } from './scope';
import { bestStainTime, stainContrast, stainedFeature, stainedFeatures, stainQuality } from './staining';
import { createGame, gather, parseSave, stainSample, toSave } from '../state';
import { explainWall, nearestWall } from './walls';

const data = loadGameData();
const leaf = data.samples.leaf!;
const pond = data.samples.pond_water!;
const nuclei = leaf.features.find((f) => f.id === 'leaf_nuclei')!;
const amoeba = pond.features.find((f) => f.id === 'pond_amoeba')!;
const scopeAt = (item: string, step: number) => scopeFromInventory({ [item]: 1 }, data, step);

describe('stain kinetics', () => {
  it('contrast rises, peaks at t*, then fades as the background catches up', () => {
    const t = bestStainTime();
    expect(stainContrast(0)).toBe(0);
    expect(stainContrast(t)).toBeGreaterThan(stainContrast(t * 0.5));
    expect(stainContrast(t)).toBeGreaterThan(stainContrast(t * 2));
    expect(stainQuality(t)).toBeCloseTo(1, 6);
    expect(stainQuality(30)).toBeLessThan(0.1); // left far too long: everything is dark
  });

  it('a slower background moves the peak later', () => {
    expect(bestStainTime(1.5, 9)).toBeGreaterThan(bestStainTime(1.5, 6));
  });
});

describe('stained samples', () => {
  it('clear cells hit the low-contrast wall until stained, and the wall says to stain them', () => {
    const compound = scopeAt('compound_microscope', 1);
    expect(visibility(nuclei, compound).reason).toBe('low-contrast');
    expect(explainWall(nuclei, compound)).toMatch(/press S/);
    expect(visibility(stainedFeature(nuclei, 1), compound).visible).toBe(true);
    expect(visibility(stainedFeature(nuclei, 0.5), compound).visible).toBe(true);
  });

  it('an amoeba shows under a stained hand lens view; a stain does not beat the resolution limit', () => {
    expect(visibility(stainedFeature(amoeba, 1), scopeAt('hand_lens', 0)).visible).toBe(true);
    expect(visibility(stainedFeature(nuclei, 1), scopeAt('hand_lens', 0)).reason).toBe('unresolved');
  });

  it('stainedFeatures applies the stain recorded for that sample only', () => {
    const stains = { leaf: 1 };
    expect(stainedFeatures(leaf, stains).find((f) => f.id === 'leaf_nuclei')!.contrast).toBe(nuclei.stain!.contrast);
    expect(stainedFeatures(pond, stains).find((f) => f.id === 'pond_amoeba')!.contrast).toBe(amoeba.contrast);
  });

  it('the tier walls still come first: a clear amoeba never hides the diffraction-limit lesson', () => {
    expect(nearestWall(pond, scopeAt('hq_microscope', 2))?.f.id).toBe('pond_virus');
    expect(nearestWall(pond, scopeAt('hand_lens', 0))?.f.id).toBe('pond_alga');
  });
});

describe('stainSample', () => {
  it('uses up one dye, keeps the best stain, announces it and survives a save', () => {
    const ctx = createGame(loadGameData());
    const heard: number[] = [];
    ctx.bus.on('sampleStained', ({ quality }) => heard.push(quality));
    expect(stainSample(ctx, 'pond_water', 'saffron', 0.8)).toBe(false); // no dye yet
    gather(ctx, 'saffron', 2);
    expect(stainSample(ctx, 'pond_water', 'saffron', 0.8)).toBe(true);
    expect(stainSample(ctx, 'pond_water', 'saffron', 0.3)).toBe(true);
    expect(ctx.state.inventory.saffron).toBe(0);
    expect(ctx.state.stains.pond_water).toBe(0.8);
    expect(heard).toEqual([0.8, 0.3]);
    const back = createGame(loadGameData(), undefined, parseSave(JSON.stringify(toSave(ctx.state))));
    expect(back.state.stains.pond_water).toBe(0.8);
    expect(parseSave(JSON.stringify({ inventory: {}, discoveries: [], snapshots: {}, scopeChoice: null }))?.stains).toEqual({}); // older save
  });
});
