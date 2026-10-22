// CHESS beamline tuning (tier 7 mini-game): a CHESS Compact Undulator on CESR feeding a Si(111) double-crystal
// monochromator. The undulator is tuned the CHESS way, by sliding one magnet row along the other (its "phase"),
// which weakens the field instead of opening the gap.
import { clamp01 } from './fft';

/** CESR after the CHESS-U upgrade: 6 GeV positrons. CCU: 28.4 mm period, 0.952 T peak field, about 1.5 m long. */
export const RING_GEV = 6;
export const CCU = { periodMm: 28.4, peakFieldT: 0.952, periods: 52 };
/** Si(111) lattice-plane spacing, nm. */
export const SI111_NM = 0.31356;
const HC_KEV_NM = 1.23984;

/** Effective field when the rows are shifted by `phaseMm`: B₀·|cos(π·phase/λu)|; half a period cancels it. */
export const fieldT = (phaseMm: number) => CCU.peakFieldT * Math.abs(Math.cos((Math.PI * phaseMm) / CCU.periodMm));
/** Deflection parameter K = 0.934 · B[T] · λu[cm]. */
export const undulatorK = (phaseMm: number) => 0.934 * fieldT(phaseMm) * (CCU.periodMm / 10);
/** On-axis energy of harmonic n, keV: n · 0.9496 · E[GeV]² / (λu[cm] · (1 + K²/2)). 12.0 keV for n = 1 at K = 0. */
export const harmonicKeV = (n: number, K: number) => (n * 0.9496 * RING_GEV ** 2) / ((CCU.periodMm / 10) * (1 + (K * K) / 2));

/** Bessel function of the first kind J_m(x), integer m ≥ 0, by its power series (fine for the small x here). */
export function besselJ(m: number, x: number): number {
  let term = (x / 2) ** m;
  for (let k = 1; k <= m; k++) term /= k;
  let sum = term;
  for (let k = 1; k < 40; k++) {
    term *= -((x / 2) ** 2) / (k * (k + m));
    sum += term;
  }
  return sum;
}

/** On-axis brightness factor of odd harmonic n: F_n(K) = n²K²/(1+K²/2)² · [J_(n−1)/2(Y) − J_(n+1)/2(Y)]², Y = nK²/(4(1+K²/2)). */
export function harmonicStrength(n: number, K: number): number {
  const d = 1 + (K * K) / 2;
  const y = (n * K * K) / (4 * d);
  return ((n * n * K * K) / (d * d)) * (besselJ((n - 1) / 2, y) - besselJ((n + 1) / 2, y)) ** 2;
}

/** Relative photon flux at energy E (keV): odd harmonics with a width of about 1/(n·N), broadened by the beam's own spread.
 *  Simplification: Gaussian lines; a 0.6% floor stands in for the electron beam's energy spread and emittance. */
export function undulatorSpectrum(keV: number, phaseMm: number): number {
  const K = undulatorK(phaseMm);
  let flux = 0;
  for (let n = 1; n <= 9; n += 2) {
    const e = harmonicKeV(n, K);
    const width = e * Math.hypot(1 / (n * CCU.periods), 0.006);
    flux += harmonicStrength(n, K) * Math.exp(-(((keV - e) / width) ** 2));
  }
  return flux;
}

/** Bragg's law for the monochromator: E = hc / (2 d sinθ). */
export const monoKeV = (thetaDeg: number) => HC_KEV_NM / (2 * SI111_NM * Math.sin((thetaDeg * Math.PI) / 180));
export const monoThetaDeg = (keV: number) => (Math.asin(HC_KEV_NM / (2 * SI111_NM * keV)) * 180) / Math.PI;

/** The brightest any setting gives at this energy (the peak of the best harmonic tuned onto it), for normalising. */
export function bestFluxAt(keV: number): number {
  let best = 0;
  for (let p = 0; p < CCU.periodMm / 2; p += 0.02) best = Math.max(best, undulatorSpectrum(keV, p));
  return best;
}

export interface BeamTune {
  keV: number;
  /** Flux at the monochromator's energy relative to the best possible there, 0..1. */
  flux: number;
  /** Above the absorption edge, so the element is excited at all. */
  above: boolean;
  /** 0..1: above the edge, close to it (fluorescence is strongest just above an edge), and bright. */
  score: number;
}

/** How well the beam is set up to map an element whose absorption edge is `edgeKeV`. */
export function beamTune(phaseMm: number, thetaDeg: number, edgeKeV: number): BeamTune {
  const keV = monoKeV(thetaDeg);
  const flux = clamp01(undulatorSpectrum(keV, phaseMm) / bestFluxAt(keV));
  const above = keV > edgeKeV;
  // Simplification: excitation falls off a few keV above the edge (the absorption cross-section drops roughly as E⁻³).
  const near = above ? clamp01(1 - (keV - edgeKeV - 1.5) / 6) : 0;
  return { keV, flux, above, score: above ? flux * near : 0 };
}
