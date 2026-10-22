import { describe, expect, it } from 'vitest';
import {
  abbeLimitUm, dose, effectiveResolutionUm, electronWavelengthNm, featureContrast, handLensMagnification, magnification, scopeResolutionUm,
  survivingSignal, usefulMagnificationMax, visibility, xrayWavelengthNm,
} from './optics';
import { NAKED_EYE, scopeFromInventory, scopeParamsFromSpec } from './scope';
import { loadGameData } from '../data';

const near = (a: number, b: number, tol = 1e-3) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('formulas', () => {
  it('magnification multiplies stages; hand lens M = 250/f', () => {
    expect(magnification(10, 10)).toBe(100);
    expect(handLensMagnification(25)).toBe(10);
  });
  it('Abbe limit: green light, NA 1.4 → 0.196 µm', () => near(abbeLimitUm(0.55, 1.4), 0.196, 1e-3));
  it('electron wavelength is relativistic: 2.51 pm at 200 kV, 1.97 pm at 300 kV; X-rays 0.103 nm at 12 keV', () => {
    near(electronWavelengthNm(200_000), 0.002508, 1e-6);
    near(electronWavelengthNm(300_000), 0.001969, 1e-6);
    near(xrayWavelengthNm(12), 0.10332, 1e-5);
  });
  it('Abbe with a condenser: d = λ / (NA + NA_illumination), so a stopped-down condenser costs resolution', () => {
    near(abbeLimitUm(0.55, 1.3), 0.2115, 1e-4);
    near(abbeLimitUm(0.55, 1.3, 0.65), 0.2821, 1e-4);
  });
  it('d_eff adds in quadrature', () => expect(effectiveResolutionUm(3, 4)).toBe(5));
  it('dose = I·t/A', () => expect(dose(1e6, 2, 100)).toBe(20_000));
});

describe('electron tier', () => {
  it('beam damage: signal decays exponentially with dose', () => {
    expect(survivingSignal(0, 5e4)).toBe(1);
    near(survivingSignal(5e4, 5e4), Math.exp(-1), 1e-9);
  });
  it('light has a useful-magnification ceiling, electrons do not', () => {
    expect(usefulMagnificationMax({ NA: 0.55, tier: 2 })).toBe(550);
    expect(usefulMagnificationMax({ NA: 0.01, tier: 5 })).toBe(Infinity);
  });
  it('the 200 kV scope resolves about 0.22 nm, so the 0.4 nm lattice is visible at 2,000,000×', () => {
    const data = loadGameData();
    const em = scopeFromInventory({ electron_microscope: 1 }, data, 3);
    near(scopeResolutionUm(em) * 1000, 0.219, 0.002);
    expect(visibility({ sizeUm: 0.0004, contrast: 0.5 }, em).visible).toBe(true);
    expect(visibility({ sizeUm: 0.0004, contrast: 0.5 }, { ...em, magnification: 50_000 }).reason).toBe('too-small-to-see');
  });
});

describe('visibility walls', () => {
  const data = loadGameData();
  const withHandLens = scopeFromInventory({ hand_lens: 1 }, data);
  const veins = { sizeUm: 40, contrast: 0.5 };
  const bacteria = { sizeUm: 1, contrast: 0.3 };

  it('naked eye: leaf veins are unresolved', () => {
    expect(scopeFromInventory({}, data)).toBe(NAKED_EYE);
    expect(visibility(veins, NAKED_EYE).reason).toBe('unresolved');
  });
  it('hand lens reveals leaf veins but not bacteria', () => {
    expect(withHandLens.tier).toBe(1);
    expect(visibility(veins, withHandLens).visible).toBe(true);
    expect(visibility(bacteria, withHandLens).reason).toBe('unresolved');
  });
  it('past 1000·NA magnification, unresolved features read as empty magnification', () => {
    expect(visibility(bacteria, { ...withHandLens, magnification: 500 }).reason).toBe('empty-magnification');
  });
  it('resolved but tiny on the retina → too-small-to-see; invisible stain → low-contrast', () => {
    expect(visibility({ sizeUm: 40, contrast: 0.5 }, { ...withHandLens, magnification: 2 }).reason).toBe('too-small-to-see');
    expect(visibility({ sizeUm: 40, contrast: 0.05 }, withHandLens).reason).toBe('low-contrast');
  });
});

describe('imaging modes', () => {
  const data = loadGameData();
  const at = (item: string, label: string) => {
    const spec = data.recipes.find((r) => r.output.itemId === item)!.scope!;
    return scopeParamsFromSpec(spec, spec.steps.findIndex((s) => s.label === label)); // every add-on built
  };
  const clearCell = { sizeUm: 60, contrast: 0.06, contrastIn: { phase: 0.5, methylene_blue: 0.6 } };
  const glow = { sizeUm: 30, contrast: 0, contrastIn: { fluorescence: 0.8 } };

  it('a clear cell is too faint in bright field, but phase contrast or a stain shows it', () => {
    expect(visibility(clearCell, at('fluorescence_microscope', '400× bright field')).reason).toBe('low-contrast');
    expect(visibility(clearCell, at('fluorescence_microscope', '400× bright field'), 'methylene_blue').visible).toBe(true);
    expect(visibility(clearCell, at('fluorescence_microscope', '400× phase contrast (Ph2)')).visible).toBe(true);
  });
  it('fluorescence shows only what glows; the glow shows only in fluorescence', () => {
    expect(featureContrast(clearCell, 'fluorescence')).toBe(0);
    expect(visibility(glow, at('fluorescence_microscope', '400× fluorescence')).visible).toBe(true);
    expect(visibility(glow, at('fluorescence_microscope', '400× bright field')).reason).toBe('other-mode');
  });
  it('dark field detects a 20 nm flagellum it cannot resolve', () => {
    const v = visibility({ sizeUm: 0.02, contrast: 0.02, contrastIn: { darkfield: 0.5 } }, at('fluorescence_microscope', '400× dark field'));
    expect(v).toMatchObject({ visible: true, detectedOnly: true });
  });
  it('diffraction resolves spacings by Bragg\'s law, with no lens blur and no eye limit', () => {
    const xrd = at('chess_beamline', 'X-ray diffraction');
    near(scopeResolutionUm(xrd) * 1000, 0.1033, 1e-4); // λ / 2 sin 30°
    expect(visibility({ sizeUm: 0.000282, contrast: 0, contrastIn: { xrd: 0.7 } }, xrd).visible).toBe(true);
    expect(visibility({ sizeUm: 0.00009, contrast: 0, contrastIn: { xrd: 0.7 } }, xrd).reason).toBe('unresolved');
  });
  it('ptychography at 80 kV reaches 0.39 Å; annular dark field cannot see light beryllium atoms', () => {
    near(scopeResolutionUm(at('stem_microscope', '20,000,000× ptychography (80 kV)')) * 1e4, 0.387, 0.005);
    const be = { sizeUm: 0.00016, contrast: 0.02, contrastIn: { ptycho: 0.5 } };
    expect(visibility(be, at('stem_microscope', '2,000,000× annular dark field')).reason).toBe('low-contrast');
    expect(visibility(be, at('stem_microscope', '20,000,000× ptychography (80 kV)')).visible).toBe(true);
  });
});
