// The workbench: a compound microscope the player builds by hand. Grinding sets each lens's curvature, the curvature
// sets its focal length, and where the lenses sit sets the magnification and the working distance. compileBuild turns
// a build into the zoom steps the rest of the game already understands (magnification, NA), so the eyepiece, the
// walls, the Microdex and the guide all treat a hand-built microscope like any other.
// Thin lenses on one axis, paraxial rays, a relaxed eye. Lengths are millimetres here (the game's µm only appear
// where a ScopeSpec needs them). Simplifications are labelled where they are made.
import type { CompoundBuild, LensBuild, ScopeSpec, ZoomStep } from '../schema';

/** Refractive index of the game's glass (ordinary crown glass is about 1.5). */
export const GLASS_N = 1.5;
/** Reading distance used for eyepiece magnification (the same 250 mm as the hand lens in optics.ts). */
export const NEAR_POINT_MM = 250;
/** Width of a lens blank. A strongly curved lens has to be smaller than this (see apertureMm). */
export const BLANK_DIAMETER_MM = 8;
/** A fresh blank is almost flat. */
export const BLANK_RADIUS_MM = 200;
/** The tightest curve the grinding wheel can cut. */
export const MIN_RADIUS_MM = 1.5;
/** The tube telescopes between these lengths, objective lens to eyepiece lens. Real tubes put the objective's image
 *  about 160 mm behind its focal point, which is what `standard` gives with a 16 mm objective and a 25 mm eyepiece. */
export const TUBE_MM = { min: 120, max: 260, standard: 200 } as const;
/** How far the focus knob can lift the objective above the slide. */
export const FOCUS_RANGE_MM = { min: 0.15, max: 60 } as const;
/** The narrowest stop the nosepiece takes, mm. */
export const STOP_MIN_MM = 0.1;
/** Lenses on the revolving nosepiece. */
export const MAX_OBJECTIVES = 3;

/** Lensmaker's equation for a thin lens curved equally on both sides: 1/f = (n − 1)·2/R.
 *  With n = 1.5 the focal length equals the radius of curvature. */
export const focalLengthMm = (radiusMm: number) => radiusMm / (2 * (GLASS_N - 1));

/** A lens curved on both sides can be no wider than its curves allow: an exact ray trace through both surfaces shows
 *  rays past about 1.04 R totally reflected inside the glass, so the usable width is capped at R. A strongly curved
 *  lens is small (Leeuwenhoek's lenses were glass beads), and a gentle one is as wide as the blank. */
export const apertureMm = (radiusMm: number) => Math.min(BLANK_DIAMETER_MM, radiusMm);

/** Spherical aberration of one ground lens: its edge focuses closer than its middle. For a thin equiconvex lens in
 *  n = 1.5 glass the blur at the plane of least confusion, in the specimen, is about K·f·NA³ (third order). K = 0.84
 *  is fitted to an exact ray trace (Snell's law at both curved surfaces) at NA ≤ 0.3. The eyepiece's is left out:
 *  the eye's small pupil stops it down. */
export const SPHERICAL_K = 0.84;
export const sphericalBlurUm = (fMm: number, NA: number) => SPHERICAL_K * fMm * NA ** 3 * 1000;

/** The NA that makes a lens sharpest: a wider cone shrinks the diffraction blur λ/2NA but grows spherical aberration
 *  as NA³. Minimising their sum in quadrature gives NA⁸ = (λ/2)² / (3·(K·f)²), λ and K·f in µm. */
export const sharpestNA = (fMm: number, wavelengthUm: number) => ((wavelengthUm / 2) ** 2 / (3 * (SPHERICAL_K * fMm * 1000) ** 2)) ** (1 / 8);

/** Angular magnification of an eyepiece (or a hand lens) for a relaxed eye: M = 250 mm / f. */
export const eyepieceMagnification = (fEyeMm: number) => NEAR_POINT_MM / fEyeMm;

/** Thin lens: an object s in front of a lens images s' = f·s / (s − f) behind it. Infinity when s ≤ f (no real image). */
export const imageDistanceMm = (fMm: number, sMm: number) => (sMm > fMm ? (fMm * sMm) / (sMm - fMm) : Infinity);

/** The same equation solved the other way: where the slide must sit for the image to form s' behind the lens. */
export const objectDistanceMm = (fMm: number, sImageMm: number) => (sImageMm > fMm ? (fMm * sImageMm) / (sImageMm - fMm) : Infinity);

/** For a relaxed eye the objective's image must form at the eyepiece's focal point, f_eye below the eyepiece lens. */
export const intermediateDistanceMm = (tubeMm: number, fEyeMm: number) => tubeMm - fEyeMm;

/** Numerical aperture of a lens D wide, s above the slide, in air: NA = sin(half-angle of the cone it accepts). */
export const numericalAperture = (apertureDiameterMm: number, sMm: number) => Math.sin(Math.atan(apertureDiameterMm / 2 / sMm));

/** Geometric defocus: a cone of half-angle θ, focused δ away from the slide, blurs a point into a disc about 2·NA·δ wide
 *  (small angles), µm. */
export const defocusBlurUm = (NA: number, deltaMm: number) => 2 * NA * Math.abs(deltaMm) * 1000;

/** Why a build cannot form a usable image yet. */
export type BuildIssue =
  /** The eyepiece is so weakly curved that its focal point leaves no room in the tube for the objective's image. */
  | 'weak-eyepiece'
  /** The objective is so weakly curved that it cannot form a real image inside the tube. */
  | 'weak-objective'
  /** It could form one, but only with the slide further away than the focus knob reaches. */
  | 'out-of-reach';

export interface ObjectiveOptics {
  /** Focal lengths and widths of the two lenses, mm. */
  fObjectiveMm: number;
  fEyepieceMm: number;
  /** The width light gets through: the lens, or the stop in front of it if that is narrower. */
  apertureMm: number;
  /** How wide the lens itself is, mm. */
  lensWidthMm: number;
  /** Where the objective's image forms (above the objective lens) and where the slide sits when it is sharp, mm. */
  imageMm: number;
  workingDistanceMm: number;
  /** Lateral magnification of the objective's image, angular magnification of the eyepiece, and their product. */
  objectiveMag: number;
  eyepieceMag: number;
  magnification: number;
  NA: number;
  /** Spherical-aberration blur in the specimen, µm. */
  sphericalUm: number;
  issue: BuildIssue | null;
}

/** The optics of one objective with the build's eyepiece and tube. */
export function objectiveOptics(objective: LensBuild, eyepiece: LensBuild, tubeMm: number): ObjectiveOptics {
  const fObjectiveMm = focalLengthMm(objective.radiusMm);
  const fEyepieceMm = focalLengthMm(eyepiece.radiusMm);
  const lensWidthMm = apertureMm(objective.radiusMm);
  const D = Math.min(lensWidthMm, objective.stopMm ?? Infinity);
  const imageMm = intermediateDistanceMm(tubeMm, fEyepieceMm);
  const workingDistanceMm = objectDistanceMm(fObjectiveMm, imageMm);
  const eyepieceMag = eyepieceMagnification(fEyepieceMm);
  const issue: BuildIssue | null =
    fEyepieceMm >= tubeMm / 2 ? 'weak-eyepiece'
    : !Number.isFinite(workingDistanceMm) ? 'weak-objective'
    : workingDistanceMm > FOCUS_RANGE_MM.max ? 'out-of-reach'
    : null;
  const objectiveMag = issue ? 0 : imageMm / workingDistanceMm;
  const NA = issue ? 0 : numericalAperture(D, workingDistanceMm);
  return {
    fObjectiveMm, fEyepieceMm, apertureMm: D, lensWidthMm, imageMm, workingDistanceMm,
    objectiveMag, eyepieceMag, magnification: objectiveMag * eyepieceMag,
    NA, sphericalUm: sphericalBlurUm(fObjectiveMm, NA),
    issue,
  };
}

/** Every objective of the build, in nosepiece order. */
export const buildOptics = (build: CompoundBuild) => build.objectives.map((o) => objectiveOptics(o, build.eyepiece, build.tubeMm));

/** The first thing that stops the build from working, or null when every objective forms an image you can focus. */
export const buildIssue = (build: CompoundBuild): BuildIssue | null => buildOptics(build).find((o) => o.issue)?.issue ?? null;

const fmtMm = (mm: number) => (mm < 10 ? mm.toFixed(1) : `${Math.round(mm)}`);

/** The problem in plain words, with what to do about it. */
export function issueText(issue: BuildIssue, o: ObjectiveOptics): string {
  switch (issue) {
    case 'weak-eyepiece':
      return `The eyepiece is barely curved (focal length ${fmtMm(o.fEyepieceMm)} mm), so its focal point is nowhere near the top of the tube. Grind it until its focal length is well under half the tube; a 25 mm eyepiece magnifies 10×.`;
    case 'weak-objective':
      return `The objective is too gently curved (focal length ${fmtMm(o.fObjectiveMm)} mm) to form an image inside this tube. Grind it more strongly curved, or lengthen the tube.`;
    case 'out-of-reach':
      return `To focus, the slide would have to sit ${fmtMm(o.workingDistanceMm)} mm below the objective, more than the focus knob can lift it (${FOCUS_RANGE_MM.max} mm). Grind the objective more strongly curved, or lengthen the tube.`;
  }
}

/** The build as the microscope the game uses: one zoom step per objective, lowest magnification first.
 *  Each step's lens blur is the recipe's glass blur (`base`) plus that objective's spherical aberration; contrast and
 *  condenser stay the recipe's. */
export function compileBuild(build: CompoundBuild, base: ScopeSpec): ScopeSpec {
  const steps: ZoomStep[] = buildOptics(build)
    .filter((o) => !o.issue)
    .sort((a, b) => a.magnification - b.magnification)
    .map((o) => ({
      label: `${Math.round(o.magnification)}× (${fmtMm(o.fObjectiveMm)} mm objective)`,
      magnification: Math.max(1, Math.round(o.magnification)),
      NA: Math.round(o.NA * 1000) / 1000,
      mode: 'brightfield',
      dLensUm: Math.round(Math.hypot(base.dLensUm, o.sphericalUm) * 100) / 100,
    }));
  return { ...base, steps: steps.length ? steps : base.steps };
}

/** Where the objective's image of a point forms when the slide sits s below the objective (mm above the objective lens),
 *  measured from the eyepiece's focal point: 0 = sharp, positive = too high in the tube. Null when there is no real image. */
export function imageOffsetMm(fObjectiveMm: number, sMm: number, tubeMm: number, fEyepieceMm: number): number | null {
  const s = imageDistanceMm(fObjectiveMm, sMm);
  return Number.isFinite(s) ? s - intermediateDistanceMm(tubeMm, fEyepieceMm) : null;
}

export interface RayFan {
  /** Rays as polylines in the plane of the axis: [height above the slide, distance from the axis], mm. */
  rays: [number, number][][];
  /** The objective's image of the point: height above the slide and distance from the axis (null: no real image). */
  image: { z: number; y: number } | null;
}

/** Trace a fan of rays from a point y0 off the axis on the slide, through the objective (s above the slide) and the
 *  eyepiece (tube above that), and on for `exitMm` past the eyepiece. Thin lenses: at each lens a ray's slope changes
 *  by −height/f. In focus, every ray leaves the eyepiece with the same slope (parallel light for a relaxed eye). */
export function traceFan(
  objective: { f: number; D: number },
  eyepiece: { f: number },
  sMm: number,
  tubeMm: number,
  y0: number,
  count = 5,
  exitMm = 40,
): RayFan {
  const rays: [number, number][][] = [];
  for (let k = 0; k < count; k++) {
    const ya = count === 1 ? 0 : -objective.D / 2 + (objective.D * k) / (count - 1);
    const u = (ya - y0) / sMm;
    const u1 = u - ya / objective.f;
    const ye = ya + u1 * tubeMm;
    const u2 = u1 - ye / eyepiece.f;
    rays.push([[0, y0], [sMm, ya], [sMm + tubeMm, ye], [sMm + tubeMm + exitMm, ye + u2 * exitMm]]);
  }
  const s = imageDistanceMm(objective.f, sMm);
  return { rays, image: Number.isFinite(s) ? { z: sMm + s, y: (-y0 * s) / sMm } : null };
}
