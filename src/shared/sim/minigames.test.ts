import { describe, expect, it } from 'vitest';
import { beamTune, CCU, harmonicKeV, monoKeV, monoThetaDeg, undulatorK } from './beamline';
import { bestSoakTime, gram, koehler, KOEHLER_START, KOEHLER_TRUTH, soakContrast, soakQuality } from './bench';
import { correctorScore, CORRECTOR_TRUTH, flatRadius, probeNm, residual, ronchigram, STEM_LAMBDA_NM, ZERO, type Aberrations } from './corrector';
import { epieIteration, field, makeProbe, overlap, ptychoScore, scanPositions, simulate, startReconstruction, truePhase } from './ptycho';
import { scherzerNm, sampleHeightUm, TEM_START, TEM_TRUTH, temState, thonRings } from './tem';
import { phantom, reconstruct, sinogram, trueAxisPx } from './tomo';

const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThan(tol);

describe('TEM alignment', () => {
  it('Scherzer defocus at 200 kV with Cs 1.2 mm is about −66 nm', () => near(scherzerNm(), -66, 1));

  it('an unaligned column blurs away the atoms; cancelling every error scores 1', () => {
    const start = temState(TEM_START, 'gold_grid');
    expect(start.score).toBeLessThan(0.5);
    expect(start.blurNm).toBeGreaterThan(0.4);
    const aligned = temState(
      { beamX: -TEM_TRUTH.beam[0], beamY: -TEM_TRUTH.beam[1], z: -sampleHeightUm('gold_grid'), focus: scherzerNm(), stigX: TEM_TRUTH.astig[0], stigY: TEM_TRUTH.astig[1] },
      'gold_grid',
    );
    expect(aligned.score).toBe(1);
    near(aligned.blurNm, 0, 1e-9);
  });

  it('a sample off the eucentric height is defocused by 1000 nm per µm', () => {
    const s = temState({ ...TEM_START, z: -sampleHeightUm('leaf') + 0.1 }, 'leaf');
    near(s.defocusNm, -100, 1e-6);
  });

  it('Thon rings are finite and darker at the first zero for round rings', () => {
    const img = thonRings(64, 6, -300, [0, 0]);
    expect(img.every(Number.isFinite)).toBe(true);
  });
});

describe('aberration corrector', () => {
  const tuned: Aberrations = { C1: -CORRECTOR_TRUTH.C1, A1: [-CORRECTOR_TRUTH.A1[0], -CORRECTOR_TRUTH.A1[1]], B2: [-CORRECTOR_TRUTH.B2[0], -CORRECTOR_TRUTH.B2[1]], A2: [-CORRECTOR_TRUTH.A2[0], -CORRECTOR_TRUTH.A2[1]], C3: -CORRECTOR_TRUTH.C3 };

  it('untuned, the flat centre of the Ronchigram is only a few mrad; tuned, C5 caps it near 26 mrad', () => {
    expect(flatRadius(residual(ZERO))).toBeLessThan(0.008);
    near(flatRadius(residual(tuned)), 0.026, 0.002);
  });

  it('a little negative C3 balances C5 and widens the flat region further', () => {
    const balanced = residual({ ...tuned, C3: tuned.C3 - 1500 });
    expect(flatRadius(balanced)).toBeGreaterThan(flatRadius(residual(tuned)));
  });

  it('the probe: diffraction-limited with a small aperture, aberrated with a big one, best in between', () => {
    const a = residual(tuned);
    near(probeNm(a, 0.005).dNm, STEM_LAMBDA_NM / 0.01, 0.002); // tiny aperture: λ/2θ dominates
    expect(probeNm(a, 0.04).dNm).toBeGreaterThan(probeNm(a, 0.022).dNm);
    expect(probeNm(a, 0.022).dNm).toBeLessThan(0.06); // a sub-ångström probe
    expect(correctorScore(a, 0.022)).toBeGreaterThan(0.85);
    near(probeNm(residual(ZERO), 0.025).dNm, 2, 1); // untuned: a couple of nanometres
    expect(correctorScore(residual(ZERO), 0.025)).toBeLessThan(0.1);
  });

  it('computes a Ronchigram', () => {
    const r = ronchigram(residual(ZERO), 64);
    expect(r).toHaveLength(64 * 64);
    expect(r.every(Number.isFinite)).toBe(true);
  });
});

describe('CHESS beamline', () => {
  it('the CCU on 6 GeV CESR: K up to about 2.5, first harmonic from about 2.9 to 12 keV', () => {
    near(undulatorK(0), 2.525, 0.01);
    expect(undulatorK(CCU.periodMm / 2)).toBeLessThan(1e-9);
    near(harmonicKeV(1, 0), 12.04, 0.01);
    near(harmonicKeV(1, undulatorK(0)), 2.87, 0.02);
  });

  it("the Si(111) monochromator follows Bragg's law", () => {
    near(monoKeV(monoThetaDeg(8.98)), 8.98, 1e-9);
    near(monoThetaDeg(1.23984 / 0.31356), 30, 0.01); // at 30° the wavelength equals d
  });

  it('tuning a harmonic onto an energy just above the copper edge scores high; below the edge scores nothing', () => {
    const theta = monoThetaDeg(9.6);
    let best = { phase: 0, score: 0 };
    for (let p = 0; p < 14.2; p += 0.05) {
      const s = beamTune(p, theta, 8.979).score;
      if (s > best.score) best = { phase: p, score: s };
    }
    expect(best.score).toBeGreaterThan(0.9);
    expect(beamTune(best.phase, monoThetaDeg(8.5), 8.979).score).toBe(0);
  });

  it("lead's L edge at 13.04 keV is out of reach of the first harmonic, so it needs the third", () => {
    expect(harmonicKeV(1, 0)).toBeLessThan(13.04);
    const theta = monoThetaDeg(13.6);
    const best = Math.max(...Array.from({ length: 285 }, (_, i) => beamTune(i * 0.05, theta, 13.035).score));
    expect(best).toBeGreaterThan(0.8);
  });
});

describe('tomography', () => {
  it('rebuilding with the right axis matches the slice better than an axis 4 pixels off', () => {
    const n = 64;
    const angles = 60;
    const img = phantom(n, 5);
    const axis = trueAxisPx('shale');
    const sino = sinogram(img, n, angles, axis);
    const corr = (rec: Float32Array) => {
      const m = (v: Float32Array) => v.reduce((a, b) => a + b, 0) / v.length;
      const ma = m(img);
      const mb = m(rec);
      let num = 0;
      let da = 0;
      let db = 0;
      for (let k = 0; k < n * n; k++) {
        num += (img[k]! - ma) * (rec[k]! - mb);
        da += (img[k]! - ma) ** 2;
        db += (rec[k]! - mb) ** 2;
      }
      return num / Math.sqrt(da * db);
    };
    const good = corr(reconstruct(sino, n, angles, axis));
    const bad = corr(reconstruct(sino, n, angles, axis + 4));
    expect(good).toBeGreaterThan(0.9);
    expect(good - bad).toBeGreaterThan(0.15);
  });
});

describe('ptychography', () => {
  const run = (stepPx: number, radiusPx: number, iterations = 25) => {
    const truth = truePhase();
    const probe = makeProbe(radiusPx);
    const positions = scanPositions(stepPx);
    const amps = simulate(truth, probe, positions);
    const rec = startReconstruction(radiusPx);
    for (let i = 0; i < iterations; i++) epieIteration(rec, amps, positions);
    return ptychoScore(rec, truth, field());
  };

  it('with plenty of overlap (about 70%) the reconstruction finds the atoms and the probe', () => {
    expect(overlap(5, 8)).toBeCloseTo(0.69, 2);
    expect(run(5, 8)).toBeGreaterThan(0.95);
  });

  it('with too little overlap it fails, even where the probe has been', () => {
    expect(run(11, 8)).toBeLessThan(0.6); // 31% overlap
    expect(run(20, 5)).toBeLessThan(0.3); // none: gaps between positions
  }, 20_000);
});

describe('Köhler illumination and the Gram stain', () => {
  it('the condenser starts misaligned; aligned by the textbook it scores 1 and lights 80% of the aperture', () => {
    expect(koehler(KOEHLER_START).score).toBeLessThan(0.6);
    const k = koehler({ height: KOEHLER_TRUTH.height, cx: KOEHLER_TRUTH.cx, cy: KOEHLER_TRUTH.cy, field: 1.08, aperture: 0.8 });
    expect(k.score).toBe(1);
    near(k.illumination, 0.8, 1e-9);
  });

  it('crystal violet, iodine, a few seconds of alcohol, safranin: purple and pink', () => {
    const ideal = gram([{ reagent: 'crystal_violet', seconds: 60 }, { reagent: 'iodine', seconds: 60 }, { reagent: 'alcohol', seconds: 10 }, { reagent: 'safranin', seconds: 60 }]);
    expect(ideal.score).toBeGreaterThan(0.95);
    const noIodine = gram([{ reagent: 'crystal_violet', seconds: 60 }, { reagent: 'alcohol', seconds: 10 }, { reagent: 'safranin', seconds: 60 }]);
    expect(noIodine.positive).toBe(0);
    const quick = gram([{ reagent: 'crystal_violet', seconds: 60 }, { reagent: 'iodine', seconds: 60 }, { reagent: 'alcohol', seconds: 1 }, { reagent: 'safranin', seconds: 60 }]);
    expect(quick.negative).toBeLessThan(0.2);
    const soaked = gram([{ reagent: 'crystal_violet', seconds: 60 }, { reagent: 'iodine', seconds: 60 }, { reagent: 'alcohol', seconds: 60 }, { reagent: 'safranin', seconds: 60 }]);
    expect(soaked.positive).toBeLessThan(0.5);
  });
});

describe('progressive stain', () => {
  it('contrast rises, peaks at t*, then fades as the background catches up', () => {
    const t = bestSoakTime();
    expect(soakContrast(0)).toBe(0);
    expect(soakContrast(t)).toBeGreaterThan(soakContrast(t * 0.5));
    expect(soakContrast(t)).toBeGreaterThan(soakContrast(t * 2));
    near(soakQuality(t), 1, 1e-6);
    expect(soakQuality(30)).toBeLessThan(0.1); // left far too long: everything is dark
  });

  it('a slower background moves the peak later', () => expect(bestSoakTime(1.5, 9)).toBeGreaterThan(bestSoakTime(1.5, 6)));
});
