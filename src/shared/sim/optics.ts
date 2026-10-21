// Pure simulation rules from DESIGN.md "Simulation model". Owner: Person B.
// Simple but directionally correct; every simplification is labelled.
import type { Feature, ScopeParams } from '../schema';

/** The eye resolves about 0.1 mm at reading distance. */
export const EYE_LIMIT_UM = 100;
/** Below this effective contrast a feature is invisible even if resolved. Game constant, tuned by hand. */
export const CONTRAST_THRESHOLD = 0.1;
/** Wavelength of green light, µm. */
export const GREEN_LIGHT_UM = 0.55;

/** M = Mobj · Meye. */
export const magnification = (mObj: number, mEye: number) => mObj * mEye;

/** Hand lens as a single stage, M = 250 mm / f (250 mm = standard near-point distance). Simplification: ignores eye relief. */
export const handLensMagnification = (focalMm: number) => 250 / focalMm;

/** Abbe limit d = λ / (2·NA), µm. */
export const abbeLimitUm = (wavelengthUm: number, NA: number) => wavelengthUm / (2 * NA);

/** Electron wavelength in nm from accelerating voltage in volts: 1.226/√V.
 *  Simplification: non-relativistic (about 10% too long at 200 kV). */
export const electronWavelengthNm = (volts: number) => 1.226 / Math.sqrt(volts);

/** Lens defects add blur on top of diffraction: d_eff = √(d_diff² + d_lens²), µm. */
export const effectiveResolutionUm = (dDiffUm: number, dLensUm: number) => Math.hypot(dDiffUm, dLensUm);

/** Electron dose D = I·t/A. Units here: I in electrons/s, t in s, A in nm² → electrons/nm². */
export const dose = (electronsPerSecond: number, seconds: number, areaNm2: number) =>
  (electronsPerSecond * seconds) / areaNm2;

/** Classic "useful magnification" ceiling for light, M ≤ 1000·NA; beyond it the view only enlarges blur.
 *  Simplification: electron images are recorded digitally and zoomed freely, so tier 5 has no ceiling. */
export const usefulMagnificationMax = (scope: Pick<ScopeParams, 'NA' | 'tier'>) =>
  scope.tier >= 5 ? Infinity : 1000 * scope.NA;

/** Fraction of an electron-sensitive sample's signal left after `doseENm2` (electrons/nm²):
 *  exp(−D/D_critical). Simplification: a single exponential, no dose-rate or temperature effects. */
export const survivingSignal = (doseENm2: number, criticalDoseENm2: number) => Math.exp(-doseENm2 / criticalDoseENm2);

/** d_eff of a whole scope, µm. */
export const scopeResolutionUm = (scope: ScopeParams) =>
  effectiveResolutionUm(abbeLimitUm(scope.wavelengthUm, scope.NA), scope.dLensUm);

export type VisibilityReason =
  | 'ok'
  /** Smaller than d_eff: the optics cannot separate it. */
  | 'unresolved'
  /** Unresolved AND magnified past the useful limit: a bigger blur. */
  | 'empty-magnification'
  /** Resolved, but size × M is under the eye's limit. */
  | 'too-small-to-see'
  | 'low-contrast';

export interface Visibility {
  visible: boolean;
  reason: VisibilityReason;
  /** Effective resolution of this scope, µm. */
  dEffUm: number;
  /** Feature size as it appears to the eye, µm. */
  apparentUm: number;
}

/** The three visibility rules of DESIGN.md, checked in the order the player hits the walls. */
export function visibility(feature: Pick<Feature, 'sizeUm' | 'contrast'>, scope: ScopeParams): Visibility {
  const dEffUm = scopeResolutionUm(scope);
  const apparentUm = feature.sizeUm * scope.magnification;
  const result = (reason: VisibilityReason): Visibility => ({ visible: reason === 'ok', reason, dEffUm, apparentUm });

  if (feature.sizeUm < dEffUm) {
    return result(scope.magnification > usefulMagnificationMax(scope) ? 'empty-magnification' : 'unresolved');
  }
  if (apparentUm < EYE_LIMIT_UM) return result('too-small-to-see');
  if (feature.contrast * scope.contrastBoost < CONTRAST_THRESHOLD) return result('low-contrast');
  return result('ok');
}
