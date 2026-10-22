// Electron ptychography (tier 6 mini-game): a focused probe steps across the sample in overlapping positions and a
// pixel detector records a full diffraction pattern at each one. The ePIE algorithm (Maiden and Rodenburg, 2009)
// then finds an object and a probe that agree with every pattern. Without enough overlap the patterns do not pin
// the answer down and the reconstruction fails: the game's lesson.
import { clamp01, fft2, hash3 } from './fft';

/** Object field, n×n pixels; probe window, m×m (powers of two). */
export const OBJ_N = 96;
export const PROBE_N = 32;

/** The true object: a weak phase image of atoms on a hexagonal lattice (like MoS₂ in projection), phase in radians. */
export function truePhase(n = OBJ_N, spacingPx = 7, seed = 1): Float64Array {
  const ph = new Float64Array(n * n);
  const atoms: [number, number, number][] = [];
  const a = spacingPx;
  for (let r = -2; r < n / (a * 0.866) + 2; r++) {
    for (let q = -2; q < n / a + 2; q++) {
      const x = q * a + (r % 2) * a * 0.5;
      const y = r * a * 0.866;
      atoms.push([x, y, 0.35 + 0.25 * hash3(q, r, seed)]);
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (const [x, y, w] of atoms) {
        const d2 = (i - x) ** 2 + (j - y) ** 2;
        if (d2 < 16) v += w * Math.exp(-d2 / 2.2);
      }
      ph[j * n + i] = v;
    }
  }
  return ph;
}

/** A defocused probe: a soft disc of radius `radiusPx` with a curved (defocus) phase, in an m×m window. */
export function makeProbe(radiusPx: number, m = PROBE_N): { re: Float64Array; im: Float64Array } {
  const re = new Float64Array(m * m);
  const im = new Float64Array(m * m);
  const c = m / 2;
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const r = Math.hypot(i + 0.5 - c, j + 0.5 - c);
      const amp = 1 / (1 + Math.exp((r - radiusPx) / 0.8));
      const phase = (0.5 * r * r) / Math.max(radiusPx, 1);
      re[j * m + i] = amp * Math.cos(phase);
      im[j * m + i] = amp * Math.sin(phase);
    }
  }
  return { re, im };
}

/** Scan positions (top-left corners) on a grid with `stepPx`, each nudged by up to a pixel so the grid is not perfectly
 *  regular (a perfect raster lets ePIE converge to a false periodic answer). */
export function scanPositions(stepPx: number, n = OBJ_N, m = PROBE_N): [number, number][] {
  const out: [number, number][] = [];
  const span = n - m;
  const steps = Math.max(1, Math.round(span / stepPx));
  for (let j = 0; j <= steps; j++) {
    for (let i = 0; i <= steps; i++) {
      const jx = i === 0 || i === steps ? 0 : Math.round((hash3(i, j, 7) - 0.5) * 2);
      const jy = j === 0 || j === steps ? 0 : Math.round((hash3(j, i, 8) - 0.5) * 2);
      out.push([Math.round((i * span) / steps) + jx, Math.round((j * span) / steps) + jy]);
    }
  }
  return out;
}

/** Overlap between neighbouring probe positions, 0..1: 1 − step / diameter. */
export const overlap = (stepPx: number, radiusPx: number) => clamp01(1 - stepPx / (2 * radiusPx));

/** The diffraction intensities |FFT(probe · object)|² recorded at each position (noise-free). */
export function simulate(phase: Float64Array, probe: { re: Float64Array; im: Float64Array }, positions: [number, number][], n = OBJ_N, m = PROBE_N) {
  return positions.map(([px, py]) => {
    const re = new Float64Array(m * m);
    const im = new Float64Array(m * m);
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const p = phase[(py + j) * n + px + i]!;
        const pr = probe.re[j * m + i]!;
        const pi = probe.im[j * m + i]!;
        re[j * m + i] = pr * Math.cos(p) - pi * Math.sin(p);
        im[j * m + i] = pr * Math.sin(p) + pi * Math.cos(p);
      }
    }
    fft2(re, im, m, -1);
    const amp = new Float64Array(m * m);
    for (let k = 0; k < m * m; k++) amp[k] = Math.hypot(re[k]!, im[k]!);
    return amp;
  });
}

export interface Reconstruction {
  objRe: Float64Array;
  objIm: Float64Array;
  probeRe: Float64Array;
  probeIm: Float64Array;
}

/** Start from a blank object and a guess of the probe: the right size, but without its (unknown) defocus phase. */
export function startReconstruction(radiusPx: number, n = OBJ_N, m = PROBE_N): Reconstruction {
  const probe = makeProbe(radiusPx, m);
  const re = probe.re.map((r, k) => Math.hypot(r, probe.im[k]!));
  return { objRe: new Float64Array(n * n).fill(1), objIm: new Float64Array(n * n), probeRe: re, probeIm: new Float64Array(m * m) };
}

/** One ePIE pass over every position (object and probe both updated, step sizes 1). */
export function epieIteration(rec: Reconstruction, amps: Float64Array[], positions: [number, number][], n = OBJ_N, m = PROBE_N) {
  const re = new Float64Array(m * m);
  const im = new Float64Array(m * m);
  const order = positions.map((_, i) => i).sort((a, b) => hash3(a, positions.length, 3) - hash3(b, positions.length, 3));
  for (const idx of order) {
    const [px, py] = positions[idx]!;
    const amp = amps[idx]!;
    let pMax = 0;
    let oMax = 0;
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const k = j * m + i;
        const o = (py + j) * n + px + i;
        const pr = rec.probeRe[k]!;
        const pi = rec.probeIm[k]!;
        const or = rec.objRe[o]!;
        const oi = rec.objIm[o]!;
        re[k] = pr * or - pi * oi;
        im[k] = pr * oi + pi * or;
        pMax = Math.max(pMax, pr * pr + pi * pi);
        oMax = Math.max(oMax, or * or + oi * oi);
      }
    }
    const exitRe = re.slice();
    const exitIm = im.slice();
    fft2(re, im, m, -1);
    for (let k = 0; k < m * m; k++) {
      const a = Math.hypot(re[k]!, im[k]!);
      const s = a > 1e-12 ? amp[k]! / a : 0;
      re[k] = re[k]! * s;
      im[k] = im[k]! * s;
    }
    fft2(re, im, m, 1);
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const k = j * m + i;
        const o = (py + j) * n + px + i;
        const dr = re[k]! - exitRe[k]!;
        const di = im[k]! - exitIm[k]!;
        const pr = rec.probeRe[k]!;
        const pi = rec.probeIm[k]!;
        const or = rec.objRe[o]!;
        const oi = rec.objIm[o]!;
        rec.objRe[o] = or + (pr * dr + pi * di) / pMax;
        rec.objIm[o] = oi + (pr * di - pi * dr) / pMax;
        rec.probeRe[k] = pr + (or * dr + oi * di) / oMax;
        rec.probeIm[k] = pi + (or * di - oi * dr) / oMax;
      }
    }
  }
}

/** The field the scan is meant to image: everywhere a probe centre passes over (gaps between positions count). */
export function field(n = OBJ_N, m = PROBE_N) {
  const mask = new Float64Array(n * n);
  for (let j = m / 2; j < n - m / 2; j++) for (let i = m / 2; i < n - m / 2; i++) mask[j * n + i] = 1;
  return mask;
}

/** 0..1: correlation between the reconstructed and true phase over the lit area (global phase removed). */
export function ptychoScore(rec: Reconstruction, truth: Float64Array, mask: Float64Array): number {
  let sr = 0;
  let si = 0;
  for (let k = 0; k < truth.length; k++) if (mask[k]) {
    sr += rec.objRe[k]!;
    si += rec.objIm[k]!;
  }
  const g = Math.atan2(si, sr); // the global phase is arbitrary in ptychography
  const est: number[] = [];
  const tru: number[] = [];
  for (let k = 0; k < truth.length; k++) if (mask[k]) {
    const x = rec.objRe[k]! * Math.cos(-g) - rec.objIm[k]! * Math.sin(-g);
    const y = rec.objRe[k]! * Math.sin(-g) + rec.objIm[k]! * Math.cos(-g);
    est.push(Math.atan2(y, x));
    tru.push(truth[k]!);
  }
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
  const me = mean(est);
  const mt = mean(tru);
  let num = 0;
  let de = 0;
  let dt = 0;
  for (let k = 0; k < est.length; k++) {
    num += (est[k]! - me) * (tru[k]! - mt);
    de += (est[k]! - me) ** 2;
    dt += (tru[k]! - mt) ** 2;
  }
  return clamp01(num / Math.sqrt(de * dt || 1));
}
