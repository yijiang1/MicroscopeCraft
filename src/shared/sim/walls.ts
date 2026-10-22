// "Hit a wall" messages: plain-language explanations grounded in the sim's own numbers.
// Used by the eyepiece banner and the guide so both say the same true thing. Owner: Person B.
import type { ContrastKey, Feature, Sample, ScopeParams, Stain, Tier } from '../schema';
import {
  abbeLimitUm, CONTRAST_THRESHOLD, EYE_LIMIT_UM, isDiffraction, scopeResolutionUm, usefulMagnificationMax, visibility, type Visibility,
} from './optics';

export const TIER_NAMES: Record<Tier, string> = {
  0: 'naked eye',
  1: 'hand lens',
  2: 'compound microscope',
  3: 'high-quality microscope',
  4: 'fluorescence microscope',
  5: 'transmission electron microscope',
  6: 'aberration-corrected STEM',
  7: 'synchrotron beamline',
};

/** What each mode or stain is, and where it is found, for "try this instead" advice. */
const HOW: Record<ContrastKey, string> = {
  brightfield: 'ordinary bright-field light',
  phase: 'phase contrast (the fluorescence microscope with the phase contrast kit)',
  darkfield: 'dark field (the fluorescence microscope with the dark-field condenser)',
  fluorescence: 'fluorescence (the fluorescence microscope)',
  tem: 'the transmission electron microscope',
  ediff: 'electron diffraction (the transmission electron microscope)',
  haadf: 'annular dark-field STEM, where heavy atoms shine (the aberration-corrected STEM)',
  ptycho: 'electron ptychography (the STEM with its pixel detector)',
  xct: 'X-ray tomography (the synchrotron beamline)',
  xrf: 'an X-ray fluorescence map (the synchrotron beamline)',
  xrd: 'X-ray diffraction (the synchrotron beamline)',
  iodine: 'an iodine stain (from the reagent shelf in the lab)',
  methylene_blue: 'a methylene blue stain (from the reagent shelf in the lab)',
  gram: 'a Gram stain (from the reagent shelf in the lab)',
  hematoxylin: 'a hematoxylin stain (from the felled logwood on the quad lawn)',
};

/** Lengths for humans: 0.24 nm, 210 nm, 30 µm, 1.4 mm. */
export function fmtUm(um: number): string {
  if (um >= 1000) return `${+(um / 1000).toPrecision(2)} mm`;
  if (um >= 1) return `${+um.toPrecision(2)} µm`;
  const nm = um * 1000;
  if (nm >= 10) return `${Math.round(nm)} nm`;
  return nm >= 0.1 ? `${+nm.toPrecision(2)} nm` : `${+(nm * 1000).toPrecision(2)} pm`;
}

type Wall = Pick<Feature, 'name' | 'sizeUm' | 'contrast'> & { contrastIn?: Partial<Record<ContrastKey, number>> };

/** The ways that do show this feature, best first. */
const showsIn = (f: Wall) =>
  (Object.entries(f.contrastIn ?? {}) as [ContrastKey, number][]).filter(([, c]) => c >= CONTRAST_THRESHOLD).sort((a, b) => b[1] - a[1]).map(([k]) => k);

/** Why this feature can't be seen with this scope, and what to do next; null if it can be seen. */
export function explainWall(f: Wall, scope: ScopeParams, v?: Visibility, stain: Stain | null = null): string | null {
  const vis = v ?? visibility(f, scope, stain);
  if (vis.visible) return null;
  const who = TIER_NAMES[scope.tier];
  const dDiff = abbeLimitUm(scope.wavelengthUm, scope.NA, scope.illuminationNA);
  const ways = showsIn(f).filter((k) => k !== scope.mode);
  const tryWay = ways.length ? ` Try ${HOW[ways[0]!]}.` : f.contrast >= CONTRAST_THRESHOLD ? ' Switch to an ordinary imaging step to see it.' : '';

  switch (vis.reason) {
    case 'other-mode':
      if (isDiffraction(scope.mode)) return `A diffraction pattern shows the spacings of atomic planes, not shapes like ${f.name}.${tryWay}`;
      if (scope.mode === 'fluorescence') return `${f.name} does not glow, so it stays dark in fluorescence.${tryWay}`;
      if (scope.mode === 'xrf') return `This X-ray fluorescence map shows where one element is; ${f.name} is not an element map.${tryWay}`;
      return `${f.name} is not a picture of shape: it only shows up another way.${tryWay}`;
    case 'unresolved': {
      const head = `Your ${who} resolves details down to about ${fmtUm(vis.dEffUm)}, but ${f.name} is ${fmtUm(f.sizeUm)}, so at most you see a speck, not its shape.`;
      if (scope.tier === 0) return `${head} You need a lens to see detail this fine.`;
      if (scope.tier === 1) return `${head} A single lens is limited; two lenses working together, with a lamp and a focus knob, build a compound microscope.`;
      if (scope.tier === 7) return `${head} An X-ray beam focused by lenses this size, or a detector with pixels this size, sets the limit here. Electrons see finer.`;
      if (scope.mode === 'ptycho') return `${head} At this point the atoms' own thermal jiggling blurs them.`;
      if (scope.tier === 6) return `${head} That is about as fine as corrected electron lenses focus. Ptychography reconstructs finer detail from the full diffraction pattern at every probe position.`;
      if (scope.tier === 5) return `${head} At this point lens errors, not the electron wavelength, set the limit. Real labs add aberration correctors to see single atoms.`;
      if (scope.illuminationNA !== undefined && scope.illuminationNA < scope.NA * 0.95) {
        return `${head} Your condenser lights the sample with an NA of only ${scope.illuminationNA.toFixed(2)}, so the objective cannot reach its limit. Align it (Köhler illumination).`;
      }
      if (scope.dLensUm > dDiff) return `${head} Lens errors, from flawed glass and from the curved surfaces of simple lenses, cause most of the blur. Purer glass and a precision lens would sharpen it.`;
      if (scope.tier < 3) return `${head} The wave nature of light blurs detail more with a small numerical aperture (NA ${scope.NA}). A better objective, immersion oil and a condenser raise it.`;
      return `${head} That is the diffraction limit: visible light can't resolve much below half its wavelength (about ${fmtUm(abbeLimitUm(scope.wavelengthUm, 1.4))}). Electrons have far shorter wavelengths.`;
    }
    case 'empty-magnification':
      return `At ${scope.magnification}× your optics only resolve down to ${fmtUm(vis.dEffUm)}. Past about ${usefulMagnificationMax(scope)}× this objective (1000 × NA) you only get a bigger blur. Go back to a lower zoom, or build better optics.`;
    case 'too-small-to-see':
      return `${f.name} is resolved, but at ${scope.magnification.toLocaleString('en-US')}× it looks only ${fmtUm(vis.apparentUm)} wide, below what the eye can see (${fmtUm(EYE_LIMIT_UM)}). Zoom in to at least ${Math.ceil(EYE_LIMIT_UM / f.sizeUm).toLocaleString('en-US')}×.`;
    case 'low-contrast':
      return `${f.name} is big enough to resolve but almost transparent against its background. It needs more contrast.${tryWay || ' A stain or another imaging mode would help.'}`;
    default:
      return null;
  }
}

/** The biggest feature this scope fails to show: the nearest goal for the player. */
export function nearestWall(sample: Pick<Sample, 'features'>, scope: ScopeParams, stain: Stain | null = null) {
  return sample.features
    .map((f) => ({ f, v: visibility(f, scope, stain) }))
    .filter((x) => !x.v.visible)
    .sort((a, b) => b.f.sizeUm - a.f.sizeUm)[0];
}

/** Resolution as a one-liner for HUDs: "resolves ≥ 1.5 µm", or the smallest lattice spacing a diffraction pattern records. */
export const resolutionLabel = (scope: ScopeParams) =>
  isDiffraction(scope.mode) ? `spacings ≥ ${fmtUm(scopeResolutionUm(scope))}` : `resolves ≥ ${fmtUm(scopeResolutionUm(scope))}`;
