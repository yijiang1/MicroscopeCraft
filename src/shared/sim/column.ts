// The electron bench: a transmission electron microscope the player puts together by hand. The accelerating voltage
// sets the electron wavelength, and the objective aperture, in the back focal plane of the objective lens, decides
// which scattering angles may build the image. compileColumn turns a build into the zoom steps the rest of the game
// already understands (magnification, NA, lens blur, contrast), as compileBuild does for the compound microscope.
// Lengths are nm here; a ScopeSpec takes µm. Simplifications are labelled where they are made.
import type { ScopeSpec, TemBuild, ZoomStep } from '../schema';
import { electronWavelengthNm } from './optics';
import { CS_NM } from './tem';

/** Settings of the high-voltage tank, kV: the usual ones for TEMs. */
export const KV_SETTINGS = [80, 120, 200, 300] as const;
/** Holes in the objective aperture strip, diameter in µm (a usual set). */
export const APERTURES_UM = [10, 20, 40, 70, 120] as const;
/** Focal length of the objective lens, mm, as for a high-resolution pole piece (JEOL JEM-2100F HR: f 2.3 mm,
 *  Cs 1.0 mm). The game's lens keeps the Cs of sim/tem.ts, 1.2 mm. Simplification: f and Cs stay the same at every
 *  voltage (the lens current is raised with the voltage to keep the focus). */
export const OBJECTIVE_F_MM = 2.3;
/** Thomas–Fermi screening radius of carbon, nm: 0.885 a₀ Z^(−1/3), with a₀ = 0.0529 nm and Z = 6 (thin carbon films,
 *  stained cells: what most TEM samples are made of). */
const SCREENING_NM = (0.885 * 0.0529) / Math.cbrt(6);
/** Electron rest energy, keV. */
const REST_KEV = 511;

export const wavelengthNm = (kV: number) => electronWavelengthNm(kV * 1000);

/** Semi-angle of the cone the aperture lets through, rad: a hole D wide in the back focal plane, f behind the specimen,
 *  passes rays up to α = D / 2f. */
export const apertureAngle = (apertureUm: number) => apertureUm / 1000 / (2 * OBJECTIVE_F_MM);

/** Scherzer's point resolution, nm: 0.66 Cs^¼ λ^¾. At Scherzer defocus the contrast transfer function keeps one sign
 *  out to this spacing; finer detail comes through with its contrast flipped back and forth, so it cannot be read
 *  directly. 0.25 nm at 200 kV with the game's Cs of 1.2 mm. */
export const scherzerLimitNm = (lamNm: number, csNm = CS_NM) => 0.66 * csNm ** 0.25 * lamNm ** 0.75;

/** The finest spacing whose diffracted beam gets through the aperture, nm: a spacing d scatters by about λ/d, so
 *  d = λ/α. The aperture can only take resolution away, never add to what the lens allows. */
export const apertureLimitNm = (lamNm: number, alpha: number) => lamNm / alpha;

/** Typical scattering angle off a screened atom, rad: θ₀ = λ / 2πa (Wentzel). 15 mrad for carbon at 200 kV. */
export const screeningAngle = (lamNm: number) => lamNm / (2 * Math.PI * SCREENING_NM);

/** Share of the scattered electrons that an aperture of semi-angle α stops. Screened Rutherford scattering,
 *  dσ/dΩ ∝ 1/(θ² + θ₀²)², puts a share 1/(1 + (α/θ₀)²) of it outside α. */
export const shareStopped = (alpha: number, lamNm: number) => 1 / (1 + (alpha / screeningAngle(lamNm)) ** 2);

/** (v/c)² of the electrons. */
const beta2 = (kV: number) => 1 - 1 / (1 + kV / REST_KEV) ** 2;

/** Scattering contrast of a thin sample in bright field, in arbitrary units: the electrons the aperture stops. The total
 *  cross-section of a screened atom goes as 1/v² (∝ Z^4/3 / β²), so slower electrons scatter more and give more contrast.
 *  Simplification: one factor for every feature. A real aperture sets the amplitude contrast of thick, amorphous detail;
 *  lattice fringes are phase contrast and depend on it less. */
export const scatteringContrast = (kV: number, alpha: number) => shareStopped(alpha, wavelengthNm(kV)) / beta2(kV);

export interface ColumnOptics {
  lambdaNm: number;
  /** Aperture semi-angle, rad. */
  alpha: number;
  scherzerNm: number;
  apertureNm: number;
  /** The finest detail its images show, nm: the coarser of the two limits. */
  resolutionNm: number;
  limit: 'aperture' | 'lens';
  /** Contrast against the recipe's microscope (1 = the same). */
  contrast: number;
}

/** The recipe's TEM, which a build is compared with: its voltage and the aperture angle of its image steps. */
const reference = (base: ScopeSpec) => ({ kV: (base.voltageV ?? 200_000) / 1000, alpha: base.steps.find((s) => s.mode === 'tem')?.NA ?? 0.01 });

export function columnOptics(build: Pick<TemBuild, 'kV' | 'apertureUm'>, base: ScopeSpec): ColumnOptics {
  const lambdaNm = wavelengthNm(build.kV);
  const alpha = apertureAngle(build.apertureUm);
  const scherzerNm = scherzerLimitNm(lambdaNm);
  const apertureNm = apertureLimitNm(lambdaNm, alpha);
  const ref = reference(base);
  return {
    lambdaNm, alpha, scherzerNm, apertureNm,
    resolutionNm: Math.max(scherzerNm, apertureNm),
    limit: apertureNm > scherzerNm ? 'aperture' : 'lens',
    contrast: scatteringContrast(build.kV, alpha) / scatteringContrast(ref.kV, ref.alpha),
  };
}

/** The build as the microscope the game uses. Its image steps get the aperture angle as NA and its contrast; the rest
 *  of the resolution goes into the lens blur, since the game adds λ/2NA and the lens blur in quadrature
 *  (optics.ts). Diffraction does not use the objective aperture, so that step stays the recipe's. */
export function compileColumn(build: TemBuild, base: ScopeSpec): ScopeSpec {
  const o = columnOptics(build, base);
  const lensNm = Math.sqrt(o.resolutionNm ** 2 - (o.lambdaNm / (2 * o.alpha)) ** 2);
  const steps: ZoomStep[] = base.steps.map((s) =>
    s.mode === 'tem'
      ? { ...s, NA: o.alpha, dLensUm: lensNm / 1000, contrastBoost: Math.round(o.contrast * 1000) / 1000 }
      : s,
  );
  return { ...base, voltageV: build.kV * 1000, steps };
}
