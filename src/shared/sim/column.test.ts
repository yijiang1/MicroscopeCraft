import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data';
import { findFeature, scopeThatSees } from '../plan';
import type { TemBuild } from '../schema';
import {
  apertureAngle, APERTURES_UM, columnOptics, compileColumn, KV_SETTINGS, scherzerLimitNm, screeningAngle, shareStopped, wavelengthNm,
} from './column';
import { scopeResolutionUm, visibility } from './optics';
import { scopeParamsFromSpec, specOf } from './scope';
import { CS_NM, sampleHeightUm, scherzerNm, TEM_TRUTH, temState } from './tem';

const near = (a: number, b: number, tol = 1e-3) => expect(Math.abs(a - b)).toBeLessThan(tol);
const data = loadGameData();
const tem = data.recipes.find((r) => r.id === 'electron_microscope')!;
const base = tem.scope!;
const build = (kV: number, apertureUm: number): TemBuild => ({ kind: 'tem', kV, apertureUm, name: '' });
/** Can any step of this build show the feature? */
const sees = (b: TemBuild, featureId: string) => {
  const spec = compileColumn(b, base);
  const f = findFeature(data, featureId)!.feature;
  return spec.steps.some((_, i) => visibility(f, scopeParamsFromSpec(spec, i)).visible);
};

describe('the electron bench', () => {
  it('Scherzer resolution matches the makers: JEOL quotes 0.23 nm for its Cs 1.0 mm pole piece at 200 kV', () => {
    near(scherzerLimitNm(wavelengthNm(200), 1.0e6), 0.234, 0.002);
    near(scherzerLimitNm(wavelengthNm(200)), 0.244, 0.002); // the game's Cs 1.2 mm
    near(scherzerLimitNm(wavelengthNm(300)), 0.204, 0.002);
  });

  it('the aperture angle is D / 2f, and carbon scatters over about 15 mrad at 200 kV', () => {
    near(apertureAngle(40), 0.0087, 1e-4);
    near(screeningAngle(wavelengthNm(200)), 0.0155, 3e-4);
    near(shareStopped(0, 1), 1);
  });

  it('the image is limited by the aperture when it is small and by the lens when it is wide', () => {
    expect(columnOptics(build(200, 10), base).limit).toBe('aperture');
    expect(columnOptics(build(200, 70), base).limit).toBe('lens');
    near(columnOptics(build(200, 10), base).resolutionNm, wavelengthNm(200) / apertureAngle(10));
    near(columnOptics(build(200, 120), base).resolutionNm, scherzerLimitNm(wavelengthNm(200)));
  });

  it("the game's resolution of a built step is the column's", () => {
    for (const kV of KV_SETTINGS)
      for (const d of APERTURES_UM) {
        const spec = compileColumn(build(kV, d), base);
        const i = spec.steps.findIndex((s) => s.mode === 'tem');
        near(scopeResolutionUm(scopeParamsFromSpec(spec, i)) * 1000, columnOptics(build(kV, d), base).resolutionNm, 1e-6);
      }
  });

  it('contrast: a smaller aperture and slower electrons give more; the recipe aperture at 200 kV gives the same', () => {
    near(columnOptics(build(200, 2 * 2.3 * 0.01 * 1000), base).contrast, 1);
    expect(columnOptics(build(200, 20), base).contrast).toBeGreaterThan(columnOptics(build(200, 70), base).contrast);
    expect(columnOptics(build(80, 40), base).contrast).toBeGreaterThan(columnOptics(build(300, 40), base).contrast);
  });

  it('diffraction does not go through the objective aperture: that step stays the recipe’s', () => {
    const spec = compileColumn(build(120, 10), base);
    const ediff = (s: typeof spec) => s.steps.find((x) => x.mode === 'ediff');
    expect(ediff(spec)).toEqual(ediff(base));
    expect(spec.voltageV).toBe(120_000);
  });

  it('gold’s 0.235 nm planes need a well-chosen column: 300 kV and a 40 µm hole, not 200 kV', () => {
    expect(sees(build(300, 40), 'gold_fringes')).toBe(true);
    expect(sees(build(200, 70), 'gold_fringes')).toBe(false);
    expect(sees(build(300, 10), 'gold_fringes')).toBe(false);
  });

  it('no build can block progress: whatever the voltage and aperture, it shows what unlocks the next materials', () => {
    const gates = Object.values(data.materials)
      .map((m) => (m.unlockedBy ? findFeature(data, m.unlockedBy) : null))
      .filter((f) => f && scopeThatSees(f.feature, data)?.id === tem.id);
    expect(gates.length).toBeGreaterThan(0);
    for (const kV of KV_SETTINGS) for (const d of APERTURES_UM) for (const g of gates) expect(sees(build(kV, d), g!.feature.id), `${kV} kV ${d} µm`).toBe(true);
  });

  it('the eyepiece alignment aims for the Scherzer defocus of the column’s own voltage', () => {
    near(scherzerNm(CS_NM, wavelengthNm(300)), -58.3, 0.5);
    const aligned = { beamX: -TEM_TRUTH.beam[0], beamY: -TEM_TRUTH.beam[1], z: -sampleHeightUm('gold_grid'), stigX: TEM_TRUTH.astig[0], stigY: TEM_TRUTH.astig[1] };
    expect(temState({ ...aligned, focus: scherzerNm(CS_NM, wavelengthNm(300)) }, 'gold_grid', wavelengthNm(300)).parts.focus).toBeGreaterThan(0.99);
    expect(temState({ ...aligned, focus: scherzerNm() }, 'gold_grid', wavelengthNm(300)).parts.focus).toBeLessThan(0.95);
  });

  it('specOf uses the build only for the recipe it was made for', () => {
    const b = build(300, 40);
    expect(specOf(tem as typeof tem & { scope: typeof base }, { electron_microscope: b }).voltageV).toBe(300_000);
    expect(specOf(tem as typeof tem & { scope: typeof base }, {}).voltageV).toBe(200_000);
  });
});
