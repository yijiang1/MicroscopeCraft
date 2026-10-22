// The two light-microscope mini-games: Köhler illumination (setting up the condenser) and the Gram stain.
// Pure rules here; the eyepiece draws them.
import { clamp01 } from './fft';

// ---------------------------------------------------------------- Köhler illumination

/** Knobs, each running −1..1 except the diaphragms, which run 0..1 (closed to open). */
export interface KoehlerKnobs {
  /** Condenser height: focuses the image of the field diaphragm onto the sample. */
  height: number;
  /** Condenser centring screws. */
  cx: number;
  cy: number;
  /** Field diaphragm: its image's size relative to the field of view (1 = just fills it). */
  field: number;
  /** Aperture diaphragm: the illumination NA as a fraction of the objective's NA. */
  aperture: number;
}

/** Where the condenser starts: a little out of focus and off centre, both diaphragms wide open. */
export const KOEHLER_START: KoehlerKnobs = { height: 0, cx: 0, cy: 0, field: 1.6, aperture: 1 };
/** The microscope's own offsets, which the knobs must cancel. */
export const KOEHLER_TRUTH = { height: 0.43, cx: -0.31, cy: 0.22 };

export interface Koehler {
  /** Blur of the field diaphragm's edge, 0 (sharp) to 1. */
  edgeBlur: number;
  /** Offset of the diaphragm image from the centre, in field radii. */
  offset: [number, number];
  parts: { focus: number; centre: number; field: number; aperture: number };
  score: number;
  /** Illumination NA ÷ objective NA after alignment: what the eyepiece uses for resolution. */
  illumination: number;
}

export function koehler(k: KoehlerKnobs): Koehler {
  const dh = k.height - KOEHLER_TRUTH.height;
  const offset: [number, number] = [k.cx - KOEHLER_TRUTH.cx, k.cy - KOEHLER_TRUTH.cy];
  const off = Math.hypot(...offset);
  const parts = {
    focus: clamp01(1 - Math.abs(dh) / 0.25),
    centre: clamp01(1 - off / 0.2),
    // Just outside the field of view: open enough to light it all, closed enough to keep stray light out.
    field: k.field < 1 ? clamp01(1 - (1 - k.field) / 0.15) : clamp01(1 - Math.max(0, k.field - 1.15) / 0.3),
    // The rule of thumb: about 70-90% of the objective's aperture, a trade between contrast and resolution.
    aperture: k.aperture < 0.7 ? clamp01(1 - (0.7 - k.aperture) / 0.3) : k.aperture > 0.92 ? clamp01(1 - (k.aperture - 0.92) / 0.2) : 1,
  };
  const score = (parts.focus + parts.centre + parts.field + parts.aperture) / 4;
  // A misaligned condenser lights the sample unevenly, as if with a smaller aperture.
  const quality = 0.6 + 0.4 * (parts.focus * parts.centre) ** 0.5;
  return { edgeBlur: clamp01(Math.abs(dh) / 0.6), offset, parts, score, illumination: Math.max(0.2, k.aperture * quality) };
}

/** Before the player aligns anything, the condenser lights the sample at about half the objective's aperture. */
export const UNALIGNED_ILLUMINATION = 0.5;

// ---------------------------------------------------------------- Gram stain

export type Reagent = 'crystal_violet' | 'iodine' | 'alcohol' | 'safranin';
export const REAGENTS: { id: Reagent; name: string; color: string; seconds: string }[] = [
  { id: 'crystal_violet', name: 'Crystal violet', color: '#5b2a86', seconds: 'about 60 s' },
  { id: 'iodine', name: "Gram's iodine", color: '#8a4a1a', seconds: 'about 60 s' },
  { id: 'alcohol', name: 'Alcohol (decolorizer)', color: '#d8e8f0', seconds: 'only a few seconds' },
  { id: 'safranin', name: 'Safranin', color: '#d0457a', seconds: 'about 60 s' },
];

export interface GramStep {
  reagent: Reagent;
  seconds: number;
}

export interface Gram {
  /** How purple the Gram-positive cells end up, 0..1 (they should be). */
  positive: number;
  /** How pink the Gram-negative cells end up, 0..1 (they should be). */
  negative: number;
  score: number;
  /** What went wrong, in plain words. */
  notes: string[];
}

/** Simplified dye kinetics: crystal violet soaks in over about 20 s; iodine locks it into the thick wall of
 *  Gram-positive cells; alcohol washes it out of thin Gram-negative walls in a few seconds (rate 0.5/s) but out of
 *  Gram-positive walls only slowly (0.02/s with iodine, ten times faster without); safranin then stains whatever is clear. */
export function gram(steps: GramStep[]): Gram {
  let violetPos = 0;
  let violetNeg = 0;
  let locked = false;
  let pink = 0;
  const notes: string[] = [];
  const seen = new Set<Reagent>();
  for (const { reagent, seconds } of steps) {
    if (reagent === 'crystal_violet') {
      const take = 1 - Math.exp(-seconds / 20);
      violetPos = Math.max(violetPos, take);
      violetNeg = Math.max(violetNeg, take);
      locked = false;
    } else if (reagent === 'iodine') {
      if (violetPos > 0) locked = seconds >= 20;
    } else if (reagent === 'alcohol') {
      violetPos *= Math.exp(-seconds * 0.02 * (locked ? 1 : 10));
      violetNeg *= Math.exp(-seconds * 0.5);
      pink *= Math.exp(-seconds * 0.3);
    } else if (reagent === 'safranin') {
      pink = Math.max(pink, 1 - Math.exp(-seconds / 20));
    }
    seen.add(reagent);
  }
  if (!seen.has('crystal_violet')) notes.push('No crystal violet: nothing can stay purple.');
  else if (violetPos < 0.5 && !locked) notes.push('Without iodine to lock it in, the alcohol washed the violet out of every cell.');
  else if (violetPos < 0.5) notes.push('Too long in alcohol: even the Gram-positive cells lost their violet.');
  if (violetNeg > 0.3) notes.push('Too short in alcohol: the Gram-negative cells kept their violet.');
  if (!seen.has('safranin') || pink < 0.5) notes.push('Not enough safranin: the cleared cells stay almost invisible.');
  // A cell looks purple if enough violet is left (the pink is masked); pink if it is clear and took safranin.
  const positive = clamp01((violetPos - 0.3) / 0.4);
  const negative = clamp01((0.3 - violetNeg) / 0.25) * clamp01((pink - 0.3) / 0.4);
  return { positive, negative, score: Math.min(positive, negative), notes };
}
