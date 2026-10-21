// Staining (DESIGN.md tier 4, "Contrast methods"): a dye soaks into the target faster than into its surroundings,
// so the contrast between them rises, peaks, then fades as the background catches up. Used by the staining lab
// (src/stain), the eyepiece and the guide, so all three agree on what a stained sample shows.
import type { Feature, Sample } from '../schema';

/** Dye uptake time constants, seconds: the target binds dye 4× faster than the background.
 *  Simplification: first-order binding, uptake = 1 − e^(−t/τ). Game values, tuned for a few seconds of play. */
export const TAU_TARGET_S = 1.5;
export const TAU_BACKGROUND_S = 6;

/** Fraction of its dye capacity a tissue has taken up after soaking t seconds. */
export const uptake = (tSec: number, tauSec: number) => (tSec <= 0 ? 0 : 1 - Math.exp(-tSec / tauSec));

/** Contrast the dye adds after t seconds: target uptake − background uptake = e^(−t/τb) − e^(−t/τt). */
export const stainContrast = (tSec: number, tauTarget = TAU_TARGET_S, tauBackground = TAU_BACKGROUND_S) =>
  uptake(tSec, tauTarget) - uptake(tSec, tauBackground);

/** Soak time with the most contrast (where the derivative is zero): t* = ln(τb/τt) · τt·τb / (τb − τt). */
export const bestStainTime = (tauTarget = TAU_TARGET_S, tauBackground = TAU_BACKGROUND_S) =>
  (Math.log(tauBackground / tauTarget) * tauTarget * tauBackground) / (tauBackground - tauTarget);

/** How good a stain is, 0..1: the contrast at rinse time ÷ the best this dye can give. */
export const stainQuality = (tSec: number, tauTarget = TAU_TARGET_S, tauBackground = TAU_BACKGROUND_S) =>
  Math.max(0, stainContrast(tSec, tauTarget, tauBackground) / stainContrast(bestStainTime(tauTarget, tauBackground), tauTarget, tauBackground));

/** The feature as it looks on a slide stained with this quality: its contrast moves toward the stain's. */
export function stainedFeature<F extends Pick<Feature, 'contrast' | 'stain'>>(f: F, quality = 0): F {
  if (!f.stain || quality <= 0) return f;
  return { ...f, contrast: f.contrast + (f.stain.contrast - f.contrast) * Math.min(1, quality) };
}

/** Every feature of a sample, with the sample's stain applied (stains: GameState.stains). */
export const stainedFeatures = (sample: Pick<Sample, 'id' | 'features'>, stains: Readonly<Record<string, number>>) =>
  sample.features.map((f) => stainedFeature(f, stains[sample.id]));
