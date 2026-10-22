// Pure simulation rules from DESIGN.md "Simulation model". Owner: Person B.
// Simple but directionally correct; every simplification is labelled.
import type { ContrastKey, Feature, Mode, ScopeParams, Stain } from '../schema';

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

/** Abbe limit d = λ / (NA_objective + NA_illumination), µm. With the illumination matched to the objective
 *  (a well-aligned condenser, or incoherent light such as fluorescence) this is the familiar λ / 2NA. */
export const abbeLimitUm = (wavelengthUm: number, NA: number, illuminationNA = NA) => wavelengthUm / (NA + illuminationNA);

/** Electron wavelength in nm from accelerating voltage in volts, relativistic: h / √(2 m₀ e V (1 + eV / 2m₀c²)).
 *  1.22639 nm·V^½ = h/√(2 m₀ e); 0.97848e-6 /V = e / 2m₀c². 2.51 pm at 200 kV. */
export const electronWavelengthNm = (volts: number) => 1.22639 / Math.sqrt(volts * (1 + 0.97848e-6 * volts));

/** X-ray wavelength in nm from photon energy in keV: λ = hc / E, hc = 1.23984 keV·nm. 0.103 nm at 12 keV. */
export const xrayWavelengthNm = (keV: number) => 1.23984 / keV;

/** Lens defects add blur on top of diffraction: d_eff = √(d_diff² + d_lens²), µm. */
export const effectiveResolutionUm = (dDiffUm: number, dLensUm: number) => Math.hypot(dDiffUm, dLensUm);

/** Electron dose D = I·t/A. Units here: I in electrons/s, t in s, A in nm² → electrons/nm². */
export const dose = (electronsPerSecond: number, seconds: number, areaNm2: number) =>
  (electronsPerSecond * seconds) / areaNm2;

/** Diffraction patterns record lattice spacings: no lens forms an image, so lens errors and the eye limit do not apply. */
export const isDiffraction = (mode: Mode) => mode === 'ediff' || mode === 'xrd';
/** Modes that only show what the feature list names for them: only fluorescent things glow, only crystals diffract,
 *  only the mapped element gives its X-rays. The other modes show everything with its bright-field contrast. */
const EXCLUSIVE: readonly Mode[] = ['fluorescence', 'ediff', 'xrd', 'xrf'];
/** Bright things on a black background can be detected even when they are too small to resolve (they show as a
 *  blur the size of d_eff): the reason dark field shows bacterial flagella. Only for features listed for the mode. */
const DETECT: readonly Mode[] = ['darkfield', 'fluorescence'];

type Seen = Pick<Feature, 'sizeUm' | 'contrast'> & { contrastIn?: Partial<Record<ContrastKey, number>> };

/** How strongly a feature stands out in this mode, with this stain (stains work in light microscopes only).
 *  Ptychography measures the phase the whole sample gives the electrons, so it shows what the other electron images
 *  show too (and, listed separately, light atoms they miss). */
export function featureContrast(f: Seen, mode: Mode, stain: Stain | null = null): number {
  const fallback = mode === 'ptycho' ? Math.max(f.contrast, f.contrastIn?.haadf ?? 0, f.contrastIn?.tem ?? 0) : EXCLUSIVE.includes(mode) ? 0 : f.contrast;
  const c = f.contrastIn?.[mode] ?? fallback;
  const light = mode === 'brightfield' || mode === 'phase' || mode === 'darkfield';
  return stain && light ? Math.max(c, f.contrastIn?.[stain] ?? 0) : c;
}

/** Classic "useful magnification" ceiling for light, M ≤ 1000·NA; beyond it the view only enlarges blur.
 *  Simplification: electron and X-ray images are recorded digitally and zoomed freely, so tiers 5+ have no ceiling. */
export const usefulMagnificationMax = (scope: Pick<ScopeParams, 'NA' | 'tier'>) =>
  scope.tier >= 5 ? Infinity : 1000 * scope.NA;

/** Fraction of an electron-sensitive sample's signal left after `doseENm2` (electrons/nm²):
 *  exp(−D/D_critical). Simplification: a single exponential, no dose-rate or temperature effects. */
export const survivingSignal = (doseENm2: number, criticalDoseENm2: number) => Math.exp(-doseENm2 / criticalDoseENm2);

/** d_eff of a whole scope, µm. In diffraction the smallest spacing recorded is Bragg's λ / 2 sinθ_max, with no lens term. */
export const scopeResolutionUm = (scope: ScopeParams) => {
  const dDiff = abbeLimitUm(scope.wavelengthUm, scope.NA, scope.illuminationNA);
  return isDiffraction(scope.mode) ? dDiff : effectiveResolutionUm(dDiff, scope.dLensUm);
};

export type VisibilityReason =
  | 'ok'
  /** Shows nothing in this imaging mode, but another mode or a stain shows it. */
  | 'other-mode'
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
  /** Seen only as an unresolved spot (dark field or fluorescence). */
  detectedOnly?: boolean;
}

/** The visibility rules of DESIGN.md, checked in the order the player hits the walls:
 *  right mode, resolved (or detected), big enough for the eye, enough contrast. */
export function visibility(feature: Seen, scope: ScopeParams, stain: Stain | null = null): Visibility {
  const dEffUm = scopeResolutionUm(scope);
  const apparentUm = feature.sizeUm * scope.magnification;
  const contrast = featureContrast(feature, scope.mode, stain) * scope.contrastBoost;
  const result = (reason: VisibilityReason, detectedOnly = false): Visibility => ({ visible: reason === 'ok', reason, dEffUm, apparentUm, detectedOnly });

  const elsewhere = feature.contrast > 0 || Object.values(feature.contrastIn ?? {}).some((c) => c > 0);
  if (contrast === 0 && elsewhere) return result('other-mode');
  let detected = false;
  if (feature.sizeUm < dEffUm) {
    detected = DETECT.includes(scope.mode) && feature.contrastIn?.[scope.mode] !== undefined;
    if (!detected) return result(scope.magnification > usefulMagnificationMax(scope) ? 'empty-magnification' : 'unresolved');
  }
  if (!isDiffraction(scope.mode) && Math.max(apparentUm, detected ? dEffUm * scope.magnification : 0) < EYE_LIMIT_UM) return result('too-small-to-see');
  if (contrast < CONTRAST_THRESHOLD) return result('low-contrast');
  return result('ok', detected);
}
