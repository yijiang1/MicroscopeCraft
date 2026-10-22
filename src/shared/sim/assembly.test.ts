import { describe, expect, it } from 'vitest';
import { loadGameData } from '../data';
import type { CompoundBuild, ScopeSpec } from '../schema';
import {
  apertureMm, BLANK_DIAMETER_MM, buildIssue, compileBuild, defocusBlurUm, focalLengthMm, imageOffsetMm, issueText,
  MIN_RADIUS_MM, objectiveOptics, sharpestNA, sphericalBlurUm, traceFan,
} from './assembly';
import { GREEN_LIGHT_UM, scopeResolutionUm, usefulMagnificationMax, visibility } from './optics';
import { scopeParamsFromSpec, specOf, withBuilds } from './scope';

const near = (a: number, b: number, tol = 1e-3) => expect(Math.abs(a - b)).toBeLessThan(tol);
const data = loadGameData();
const compound = data.recipes.find((r) => r.id === 'compound_microscope')!;
const base = compound.scope!;
const build = (objectives: number[], eyepiece = 25, tubeMm = 201, stopMm?: number): CompoundBuild => ({
  objectives: objectives.map((radiusMm) => ({ radiusMm, stopMm })), eyepiece: { radiusMm: eyepiece }, tubeMm, style: {}, name: '',
});
const seed = data.samples.sunflower_seed!.features.find((f) => f.id === 'seed_oil')!;
const pressed = data.samples.sunflower_seed!.features.find((f) => f.id === 'pressed_oil')!;
/** A lens of this radius stopped to its sharpest NA, as the game would use it. */
const sharpest = (radiusMm: number) => {
  const o = objectiveOptics({ radiusMm }, { radiusMm: 25 }, 201);
  const stopMm = 2 * o.workingDistanceMm * Math.tan(Math.asin(sharpestNA(o.fObjectiveMm, GREEN_LIGHT_UM)));
  return scopeParamsFromSpec(compileBuild(build([radiusMm], 25, 201, stopMm), base));
};

describe('lenses you grind', () => {
  it('lensmaker: a lens curved equally on both sides, n = 1.5, focuses at its own radius of curvature', () => {
    expect(focalLengthMm(16)).toBe(16);
    expect(focalLengthMm(4)).toBe(4);
  });
  it('a strongly curved lens has to be small (past about R its edge rays reflect inside); a gentle one is as wide as the blank', () => {
    expect(apertureMm(100)).toBe(BLANK_DIAMETER_MM);
    expect(apertureMm(2)).toBe(2);
  });
  it('spherical aberration K·f·NA³ matches an exact ray trace: a 16 mm lens stopped to NA 0.065 blurs about 3.7 µm', () => {
    near(sphericalBlurUm(16, 0.065), 3.69, 0.02);
    near(sphericalBlurUm(16, 0.265), 250, 20); // the same lens wide open: 234 µm traced (third order runs high)
  });
  it('the sharpest NA balances diffraction against spherical aberration', () => {
    const total = (f: number, NA: number) => Math.hypot(GREEN_LIGHT_UM / (2 * NA), sphericalBlurUm(f, NA));
    for (const f of [1.5, 4, 16]) {
      const NA = sharpestNA(f, GREEN_LIGHT_UM);
      expect(total(f, NA)).toBeLessThan(total(f, NA * 1.1));
      expect(total(f, NA)).toBeLessThan(total(f, NA / 1.1));
    }
    near(sharpestNA(4, GREEN_LIGHT_UM), 0.083, 0.002);
  });
});

describe('the optics of a build', () => {
  it('a 16 mm objective, a 25 mm eyepiece and a 201 mm tube give the textbook 10× × 10× = 100×', () => {
    const o = objectiveOptics({ radiusMm: 16 }, { radiusMm: 25 }, 201);
    expect(o.issue).toBeNull();
    near(o.imageMm, 176); // the image forms 160 mm past the objective's focal point
    near(o.workingDistanceMm, 17.6); // thin lens: 1/16 = 1/s + 1/176
    near(o.objectiveMag, 10); // s'/s = 176/17.6
    near(o.eyepieceMag, 10);
    near(o.magnification, 100);
    near(o.NA, Math.sin(Math.atan(4 / 17.6)), 1e-6); // an 8 mm wide lens
  });
  it('a longer tube magnifies more; a stronger objective magnifies more and gathers a wider cone (more NA)', () => {
    const short = objectiveOptics({ radiusMm: 16 }, { radiusMm: 25 }, 150);
    const long = objectiveOptics({ radiusMm: 16 }, { radiusMm: 25 }, 250);
    expect(long.magnification).toBeGreaterThan(1.8 * short.magnification);
    const strong = objectiveOptics({ radiusMm: 4 }, { radiusMm: 25 }, 201);
    expect(strong.magnification).toBeGreaterThan(400);
    expect(strong.NA).toBeGreaterThan(0.4);
    expect(strong.workingDistanceMm).toBeLessThan(4.2); // the stronger the lens, the closer the slide
  });
  it('names what stops a build: an unground eyepiece, an objective that cannot form an image, or one out of reach', () => {
    expect(objectiveOptics({ radiusMm: 16 }, { radiusMm: 200 }, 201).issue).toBe('weak-eyepiece');
    expect(objectiveOptics({ radiusMm: 200 }, { radiusMm: 25 }, 201).issue).toBe('weak-objective');
    const far = objectiveOptics({ radiusMm: 60 }, { radiusMm: 25 }, 201);
    expect(far.issue).toBe('out-of-reach');
    expect(issueText('out-of-reach', far)).toMatch(/slide would have to sit \d+ mm/);
    expect(buildIssue(build([16, 200]))).toBe('weak-objective');
    expect(buildIssue(build([40, 16, 4]))).toBeNull();
  });
});

describe('a build becomes a microscope', () => {
  it('one zoom step per objective, lowest first, each with the glass blur of the recipe plus its spherical aberration', () => {
    const spec = compileBuild(build([4, 40, 16]), base);
    expect(spec.steps.map((s) => s.magnification)).toEqual([...spec.steps.map((s) => s.magnification)].sort((a, b) => a - b));
    expect(spec.steps).toHaveLength(3);
    expect(spec.steps[1]!.label).toBe('100× (16 mm objective)');
    expect(spec.dLensUm).toBe(base.dLensUm);
    expect(spec.steps[1]!.dLensUm).toBeGreaterThan(100); // a 16 mm lens wide open blurs ~0.2 mm
    expect(spec.tier).toBe(2);
  });
  it('specOf and withBuilds swap in a hand-built microscope only for its own recipe', () => {
    const builds = { compound_microscope: build([16]) };
    expect(specOf(compound as typeof compound & { scope: ScopeSpec }, builds).steps).toHaveLength(1);
    const hq = withBuilds(data, builds).recipes.find((r) => r.id === 'hq_microscope')!;
    expect(hq.scope).toEqual(data.recipes.find((r) => r.id === 'hq_microscope')!.scope);
  });
  it('wide open, even a strong single lens blurs everything; stopped down it shows pressed oil drops (4 µm)', () => {
    const open = scopeParamsFromSpec(compileBuild(build([4]), base));
    expect(visibility(pressed, open).visible).toBe(false);
    expect(visibility(pressed, sharpest(4)).visible).toBe(true);
    expect(visibility(pressed, sharpest(16)).visible).toBe(false); // a 16 mm lens at its sharpest: about 5.5 µm
  });
  it('no single ground lens resolves the oil bodies in a seed cell (1.5 µm): that takes the next microscope', () => {
    const best = sharpest(MIN_RADIUS_MM);
    near(scopeResolutionUm(best), 3.15, 0.1);
    expect(visibility(seed, best).visible).toBe(false);
  });
  it('a stronger eyepiece adds magnification but no detail: past 1000 × NA it is empty magnification', () => {
    const spec = compileBuild(build([16], 3), base);
    const scope = scopeParamsFromSpec(spec);
    expect(scope.magnification).toBeGreaterThan(usefulMagnificationMax(scope));
    expect(visibility(seed, scope).reason).toBe('empty-magnification');
  });
});

describe('focus and the light path', () => {
  const o = objectiveOptics({ radiusMm: 16 }, { radiusMm: 25 }, 201);
  it('in focus the objective images the slide exactly at the eyepiece focal point; off focus it lands above or below', () => {
    near(imageOffsetMm(16, o.workingDistanceMm, 201, 25)!, 0);
    expect(imageOffsetMm(16, o.workingDistanceMm - 0.5, 201, 25)!).toBeGreaterThan(0); // slide too close: image too high
    expect(imageOffsetMm(16, 15, 201, 25)).toBeNull(); // inside the focal length there is no real image
  });
  it('defocus blur grows with the cone: 2 · NA · δ', () => {
    expect(defocusBlurUm(0.25, 0)).toBe(0);
    near(defocusBlurUm(0.25, 0.01), 5);
  });
  it('rays from one point meet at its inverted, magnified image and leave the eyepiece parallel when in focus', () => {
    const fan = traceFan({ f: 16, D: 8 }, { f: 25 }, o.workingDistanceMm, 201, 0.3, 5);
    near(fan.image!.z, o.workingDistanceMm + 176, 1e-6);
    near(fan.image!.y, -0.3 * o.objectiveMag, 1e-6);
    const slopes = fan.rays.map((r) => (r[3]![1] - r[2]![1]) / (r[3]![0] - r[2]![0]));
    for (const s of slopes) near(s, slopes[0]!, 1e-9);
    const off = traceFan({ f: 16, D: 8 }, { f: 25 }, o.workingDistanceMm + 1, 201, 0.3, 5);
    const offSlopes = off.rays.map((r) => (r[3]![1] - r[2]![1]) / (r[3]![0] - r[2]![0]));
    expect(Math.abs(offSlopes[0]! - offSlopes[4]!)).toBeGreaterThan(1e-3);
  });
});
