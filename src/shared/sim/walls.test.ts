import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data';
import { visibility } from './optics';
import { scopeFromInventory } from './scope';
import { explainWall, fmtUm, nearestWall } from './walls';

const data = loadGameData();
const pond = data.samples.pond_water!;
const feature = (id: string) => pond.features.find((f) => f.id === id)!;
const scopeAt = (item: string, step: number) => scopeFromInventory({ [item]: 1 }, data, step);

describe('the three walls of the tech tree', () => {
  it('tier 1 → 2: a hand lens cannot show pond bacteria, and says to build a compound microscope', () => {
    const msg = explainWall(feature('pond_bacteria'), scopeAt('hand_lens', 0))!;
    expect(msg).toMatch(/hand lens resolves details down to about 30 µm/);
    expect(msg).toMatch(/compound microscope/);
  });

  it('tier 2: leaf cells and pond alga are visible at 100×', () => {
    const scope = scopeAt('compound_microscope', 1);
    expect(visibility(data.samples.leaf!.features[1]!, scope).visible).toBe(true);
    expect(visibility(feature('pond_alga'), scope).visible).toBe(true);
  });

  it('tier 2 wall: zooming to 800× on bacteria is empty magnification, not detail', () => {
    const at400 = visibility(feature('pond_bacteria'), scopeAt('compound_microscope', 2));
    const at800 = visibility(feature('pond_bacteria'), scopeAt('compound_microscope', 3));
    expect(at400.reason).toBe('unresolved');
    expect(at800.reason).toBe('empty-magnification');
    expect(explainWall(feature('pond_bacteria'), scopeAt('compound_microscope', 3))).toMatch(/bigger blur/);
  });

  it('tier 3: oil immersion shows bacteria; viruses hit the diffraction limit', () => {
    const scope = scopeAt('hq_microscope', 2);
    expect(visibility(feature('pond_bacteria'), scope).visible).toBe(true);
    expect(explainWall(feature('pond_virus'), scope)).toMatch(/diffraction limit.*Electrons/);
    expect(nearestWall(pond, scope)?.f.id).toBe('pond_virus');
  });

  it('visible features have no wall; fmtUm picks sensible units', () => {
    expect(explainWall(feature('pond_alga'), scopeAt('hq_microscope', 1))).toBeNull();
    expect([fmtUm(0.21), fmtUm(30), fmtUm(1400)]).toEqual(['210 nm', '30 µm', '1.4 mm']);
  });
});
