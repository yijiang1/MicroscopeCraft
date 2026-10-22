// Aberration-corrected STEM (tier 6 mini-game): the probe's wave aberration in Krivanek's notation, the flat
// "sweet spot" of the Ronchigram that tuning widens, and the probe size the chosen aperture then gives.
// 300 kV. Third-order terms are tunable; a fixed fifth-order C5 sets the final limit, as in real correctors.
import { clamp01, fft2, hash3 } from './fft';
import { electronWavelengthNm } from './optics';

export const STEM_LAMBDA_NM = electronWavelengthNm(300_000);

/** Aberration coefficients in nm: defocus C1, two-fold astigmatism A1, axial coma B2, three-fold astigmatism A2,
 *  spherical C3. Vector ones are (x, y) components. */
export interface Aberrations {
  C1: number;
  A1: [number, number];
  B2: [number, number];
  A2: [number, number];
  C3: number;
}

/** Fifth-order spherical aberration left after correction, nm (4 mm): it caps the flat region near 30 mrad. */
export const C5_NM = 4e6;

/** What the column has before the player tunes anything (the knobs add to these). */
export const CORRECTOR_TRUTH: Aberrations = { C1: 38, A1: [24, -15], B2: [260, -180], A2: [-210, 150], C3: 16000 };

export const ZERO: Aberrations = { C1: 0, A1: [0, 0], B2: [0, 0], A2: [0, 0], C3: 0 };

/** Leftover aberrations: the column's own plus the knob settings. */
export const residual = (k: Aberrations): Aberrations => ({
  C1: CORRECTOR_TRUTH.C1 + k.C1,
  A1: [CORRECTOR_TRUTH.A1[0] + k.A1[0], CORRECTOR_TRUTH.A1[1] + k.A1[1]],
  B2: [CORRECTOR_TRUTH.B2[0] + k.B2[0], CORRECTOR_TRUTH.B2[1] + k.B2[1]],
  A2: [CORRECTOR_TRUTH.A2[0] + k.A2[0], CORRECTOR_TRUTH.A2[1] + k.A2[1]],
  C3: CORRECTOR_TRUTH.C3 + k.C3,
});

/** χ(θ, φ) = (2π/λ)[C1θ²/2 + A1θ²cos2(φ−φ11)/2 + B2θ³cos(φ−φ21)/3 + A2θ³cos3(φ−φ23)/3 + C3θ⁴/4 + C5θ⁶/6], θ in radians. */
export function chiStem(tx: number, ty: number, a: Aberrations, lam = STEM_LAMBDA_NM): number {
  const t2 = tx * tx + ty * ty;
  const t = Math.sqrt(t2);
  if (t === 0) return 0;
  const c = tx / t;
  const s = ty / t;
  const c2 = c * c - s * s;
  const s2 = 2 * s * c;
  const c3 = c * c2 - s * s2;
  const s3 = s * c2 + c * s2;
  const v =
    (a.C1 * t2) / 2 +
    ((a.A1[0] * c2 + a.A1[1] * s2) * t2) / 2 +
    ((a.B2[0] * c + a.B2[1] * s) * t2 * t) / 3 +
    ((a.A2[0] * c3 + a.A2[1] * s3) * t2 * t) / 3 +
    (a.C3 * t2 * t2) / 4 +
    (C5_NM * t2 * t2 * t2) / 6;
  return ((2 * Math.PI) / lam) * v;
}

/** Radius (rad) of the flat centre of the Ronchigram: the largest angle within which χ stays inside ±π/4 in every direction. */
export function flatRadius(a: Aberrations, lam = STEM_LAMBDA_NM, max = 0.06): number {
  for (let t = 0.0005; t <= max; t += 0.0005) {
    for (let p = 0; p < 24; p++) {
      const phi = (p / 24) * 2 * Math.PI;
      if (Math.abs(chiStem(t * Math.cos(phi), t * Math.sin(phi), a, lam)) > Math.PI / 4) return t - 0.0005;
    }
  }
  return max;
}

/** Geometric blur (nm) of the rays at angle θ: (λ/2π)·|∇χ|, the largest in any direction. */
function rayBlurNm(a: Aberrations, theta: number, lam: number): number {
  const h = 1e-6;
  let max = 0;
  for (let p = 0; p < 24; p++) {
    const tx = theta * Math.cos((p / 24) * 2 * Math.PI);
    const ty = theta * Math.sin((p / 24) * 2 * Math.PI);
    const gx = (chiStem(tx + h, ty, a, lam) - chiStem(tx - h, ty, a, lam)) / (2 * h);
    const gy = (chiStem(tx, ty + h, a, lam) - chiStem(tx, ty - h, a, lam)) / (2 * h);
    max = Math.max(max, Math.hypot(gx, gy));
  }
  return (lam / (2 * Math.PI)) * max;
}

/** Probe size (nm) with a probe-forming aperture of `apertureRad`: the diffraction limit λ/2θ (the game's Abbe formula)
 *  added in quadrature to the geometric blur of the outermost rays. A small aperture is diffraction-limited; a big one
 *  lets in aberrated rays, so the best aperture sits near the edge of the Ronchigram's flat patch.
 *  Simplification: a geometric estimate, not a computed probe intensity. */
const probeOnly = (a: Aberrations, apertureRad: number, lam: number) => Math.hypot(lam / (2 * apertureRad), rayBlurNm(a, apertureRad, lam));
export function probeNm(a: Aberrations, apertureRad: number, lam = STEM_LAMBDA_NM) {
  return { dNm: probeOnly(a, apertureRad, lam), flatRad: flatRadius(a, lam) };
}

/** The best probe this column can make: third-order aberrations all gone, the aperture chosen well (C5 remains). */
export const BEST_PROBE_NM = Math.min(...Array.from({ length: 80 }, (_, i) => probeOnly(ZERO, 0.005 + i * 0.0005, STEM_LAMBDA_NM)));

/** The smallest probe these aberrations allow, and the aperture (rad) that gives it. */
export function bestAperture(a: Aberrations, lam = STEM_LAMBDA_NM) {
  let best = { rad: 0.005, dNm: Infinity };
  for (let t = 0.005; t <= 0.045; t += 0.0005) {
    const d = probeOnly(a, t, lam);
    if (d < best.dNm) best = { rad: t, dNm: d };
  }
  return best;
}

/** 0..1: how close the probe is to the best this column can do. */
export const correctorScore = (a: Aberrations, apertureRad: number, lam = STEM_LAMBDA_NM) => clamp01(BEST_PROBE_NM / probeOnly(a, apertureRad, lam));

/** Ronchigram of thin amorphous carbon, n×n (n a power of two), out to ±thetaMax rad: the shadow image the probe casts
 *  as it passes through the sample, computed as |FFT(probe × transmission)|². Its flat centre is where aberrations are small. */
export function ronchigram(a: Aberrations, n = 256, thetaMax = 0.05, seed = 3, lam = STEM_LAMBDA_NM) {
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  const dTheta = (2 * thetaMax) / n;
  const condenser = 0.95 * thetaMax; // the big condenser aperture used to view the Ronchigram
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const tx = (i < n / 2 ? i : i - n) * dTheta;
      const ty = (j < n / 2 ? j : j - n) * dTheta;
      if (tx * tx + ty * ty > condenser * condenser) continue;
      const x = -chiStem(tx, ty, a, lam);
      re[j * n + i] = Math.cos(x);
      im[j * n + i] = Math.sin(x);
    }
  }
  fft2(re, im, n, 1); // the probe in real space
  // amorphous carbon: a weak random phase, smoothed over about 0.1 nm (pixels of λ / 2θmax ≈ 0.02 nm)
  const phase = new Float64Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) phase[j * n + i] = hash3(i, j, seed) - 0.5;
  for (let pass = 0; pass < 3; pass++) {
    const src = phase.slice();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let d = -2; d <= 2; d++) sum += src[j * n + ((i + d + n) % n)]! + src[((j + d + n) % n) * n + i]!;
        phase[j * n + i] = sum / 10;
      }
    }
  }
  for (let k = 0; k < n * n; k++) {
    const p = phase[k]! * 9;
    const c = Math.cos(p);
    const s = Math.sin(p);
    const r = re[k]!;
    re[k] = r * c - im[k]! * s;
    im[k] = r * s + im[k]! * c;
  }
  fft2(re, im, n, -1);
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = ((j + n / 2) % n) * n + ((i + n / 2) % n); // centre the zero angle
      out[j * n + i] = re[k]! * re[k]! + im[k]! * im[k]!;
    }
  }
  return out;
}
