// TEM alignment (tier 5 mini-game): the objective lens's wave aberration, its Thon rings, and what the
// player's leftover errors cost. Numbers follow an uncorrected 200 kV instrument (Cs 1.2 mm), as in the TEM explorer.
import { clamp01, hash3 } from './fft';
import { electronWavelengthNm } from './optics';

/** Spherical aberration of the objective, nm (1.2 mm). */
export const CS_NM = 1.2e6;
export const TEM_LAMBDA_NM = electronWavelengthNm(200_000);
/** Scherzer defocus, nm (negative = underfocus): −1.2 √(Cs λ) ≈ −66 nm. Phase contrast passes the widest band of detail here. */
export const scherzerNm = (cs = CS_NM, lam = TEM_LAMBDA_NM) => -1.2 * Math.sqrt(cs * lam);

/** Wave aberration χ (radians) at spatial frequency (kx, ky) in nm⁻¹, for defocus df (nm, negative = underfocus),
 *  two-fold astigmatism (ax, ay) in nm and spherical aberration cs in nm. */
export const chi = (kx: number, ky: number, lam: number, df: number, ax = 0, ay = 0, cs = CS_NM) => {
  const k2 = kx * kx + ky * ky;
  return Math.PI * lam * (df * k2 + ax * (kx * kx - ky * ky) + 2 * ay * kx * ky) + 0.5 * Math.PI * cs * lam ** 3 * k2 * k2;
};

/** The microscope's own misalignment, which the player's knobs must cancel. Fixed, like the quirks of a real column. */
export const TEM_TRUTH = { astig: [72, -46] as const, beam: [16, -11] as const };

/** How far this sample sits from the stage's tilt axis, µm (each sample is mounted a little differently).
 *  Simplification: within ±4 µm, so low-magnification views stay usable before the height is set (real offsets reach tens of µm). */
export const sampleHeightUm = (sampleId: string) => (hash3([...sampleId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7), 3, 11) - 0.5) * 8;

export interface TemKnobs {
  /** Beam shift, % of the field. */
  beamX: number;
  beamY: number;
  /** Stage height, µm. */
  z: number;
  /** Objective focus, nm (relative to the focus at eucentric height). */
  focus: number;
  /** Objective stigmators, nm. */
  stigX: number;
  stigY: number;
}

export const TEM_START: TemKnobs = { beamX: 0, beamY: 0, z: 0, focus: 0, stigX: 0, stigY: 0 };

export interface TemState {
  /** Where the beam sits, % of the field from the centre. */
  beam: [number, number];
  /** Sample height above the tilt axis, µm: 0 is eucentric. */
  dzUm: number;
  /** True defocus, nm: the knob, plus the height error (1 µm = 1000 nm). */
  defocusNm: number;
  astigNm: [number, number];
  /** Extra blur from the leftover errors, nm. */
  blurNm: number;
  parts: { beam: number; height: number; astig: number; focus: number };
  /** 0..1, the mean of the parts. */
  score: number;
}

/** lam: the electron wavelength, nm (a hand-built column may run at another voltage than 200 kV). */
export function temState(k: TemKnobs, sampleId: string, lam = TEM_LAMBDA_NM): TemState {
  const beam: [number, number] = [TEM_TRUTH.beam[0] + k.beamX, TEM_TRUTH.beam[1] + k.beamY];
  const dzUm = k.z + sampleHeightUm(sampleId);
  const defocusNm = k.focus - dzUm * 1000;
  const astigNm: [number, number] = [TEM_TRUTH.astig[0] - k.stigX, TEM_TRUTH.astig[1] - k.stigY];
  const astig = Math.hypot(...astigNm);
  const off = defocusNm - scherzerNm(CS_NM, lam);
  // Simplification: leftover defocus and astigmatism add a blur that grows linearly with the error, calibrated so a
  // well-aligned column (within ~10 nm) just resolves gold's 0.235 nm planes.
  const blurNm = Math.hypot(0.004 * off, 0.006 * astig);
  const parts = {
    beam: clamp01(1 - Math.hypot(...beam) / 30),
    height: clamp01(1 - Math.abs(dzUm) / 5),
    astig: clamp01(1 - astig / 40),
    focus: clamp01(1 - Math.abs(off) / 60),
  };
  return { beam, dzUm, defocusNm, astigNm, blurNm, parts, score: (parts.beam + parts.height + parts.astig + parts.focus) / 4 };
}

/** The live diffractogram of thin amorphous carbon: Thon rings sin²χ under a damping envelope, n×n pixels out to kMax (nm⁻¹).
 *  Round rings mean no astigmatism; their spacing shows the defocus. */
export function thonRings(n: number, kMax: number, defocusNm: number, astigNm: readonly [number, number], out = new Float32Array(n * n), lam = TEM_LAMBDA_NM) {
  for (let j = 0; j < n; j++) {
    const ky = ((j + 0.5) / n - 0.5) * 2 * kMax;
    for (let i = 0; i < n; i++) {
      const kx = ((i + 0.5) / n - 0.5) * 2 * kMax;
      const k = Math.hypot(kx, ky);
      const s = Math.sin(chi(kx, ky, lam, defocusNm, astigNm[0], astigNm[1]));
      // information limit about 0.14 nm; graininess from the carbon
      out[j * n + i] = s * s * Math.exp(-((k * 0.14) ** 4)) * (0.75 + 0.5 * hash3(i, j, 5)) + 0.04 * hash3(j, i, 9);
    }
  }
  return out;
}
