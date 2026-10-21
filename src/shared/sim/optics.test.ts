import { describe, expect, it } from 'vitest';
import {
  abbeLimitUm, dose, effectiveResolutionUm, electronWavelengthNm, handLensMagnification, magnification, visibility,
} from './optics';
import { NAKED_EYE, scopeFromInventory } from './scope';
import { loadGameData } from '../data';

const near = (a: number, b: number, tol = 1e-3) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('formulas', () => {
  it('magnification multiplies stages; hand lens M = 250/f', () => {
    expect(magnification(10, 10)).toBe(100);
    expect(handLensMagnification(25)).toBe(10);
  });
  it('Abbe limit: green light, NA 1.4 → 0.196 µm', () => near(abbeLimitUm(0.55, 1.4), 0.196, 1e-3));
  it('electron wavelength at 200 kV ≈ 0.0027 nm (non-relativistic)', () =>
    near(electronWavelengthNm(200_000), 0.002742, 1e-5));
  it('d_eff adds in quadrature', () => expect(effectiveResolutionUm(3, 4)).toBe(5));
  it('dose = I·t/A', () => expect(dose(1e6, 2, 100)).toBe(20_000));
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
