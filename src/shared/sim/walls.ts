// "Hit a wall" messages: plain-language explanations grounded in the sim's own numbers.
// Used by the eyepiece banner and the guide so both say the same true thing. Owner: Person B.
import type { Feature, ScopeParams, Tier } from '../schema';
import {
  abbeLimitUm, EYE_LIMIT_UM, scopeResolutionUm, usefulMagnificationMax, visibility, type Visibility,
} from './optics';

const TIER_NAMES: Record<Tier, string> = {
  0: 'naked eye',
  1: 'hand lens',
  2: 'compound microscope',
  3: 'high-quality microscope',
  5: 'electron microscope',
};

/** Lengths for humans: 0.24 nm, 210 nm, 30 µm, 1.4 mm. */
export function fmtUm(um: number): string {
  if (um >= 1000) return `${+(um / 1000).toPrecision(2)} mm`;
  if (um >= 1) return `${+um.toPrecision(2)} µm`;
  const nm = um * 1000;
  return nm >= 10 ? `${Math.round(nm)} nm` : `${+nm.toPrecision(2)} nm`;
}

/** Why this feature can't be seen with this scope, and what to do next; null if it can be seen. */
export function explainWall(f: Pick<Feature, 'name' | 'sizeUm' | 'contrast'> & Partial<Pick<Feature, 'stain'>>, scope: ScopeParams, v?: Visibility): string | null {
  const vis = v ?? visibility(f, scope);
  if (vis.visible) return null;
  const who = TIER_NAMES[scope.tier];
  const dDiff = abbeLimitUm(scope.wavelengthUm, scope.NA);

  switch (vis.reason) {
    case 'unresolved': {
      const head = `Your ${who} resolves details down to about ${fmtUm(vis.dEffUm)}, but ${f.name} is ${fmtUm(f.sizeUm)}, so it blurs away.`;
      if (scope.tier === 0) return `${head} You need a lens to see detail this fine.`;
      if (scope.tier === 1) return `${head} A single lens is limited; two lenses working together, with a lamp and a focus knob, build a compound microscope.`;
      if (scope.tier >= 5) return `${head} At this point lens errors, not the electron wavelength, set the limit. Real labs add aberration correctors to see single atoms.`;
      if (scope.dLensUm > dDiff) return `${head} Defects in your lens glass cause most of the blur. Purer glass and a precision lens would sharpen it.`;
      if (scope.tier < 3) return `${head} The wave nature of light blurs detail more with a small numerical aperture (NA ${scope.NA}). A better objective, immersion oil and a condenser raise it.`;
      return `${head} That is the diffraction limit: visible light can't resolve much below half its wavelength (about ${fmtUm(abbeLimitUm(scope.wavelengthUm, 1.4))}). Electrons have far shorter wavelengths.`;
    }
    case 'empty-magnification':
      return `At ${scope.magnification}× your optics only resolve down to ${fmtUm(vis.dEffUm)}. Past about ${usefulMagnificationMax(scope)}× this objective (1000 × NA) you only get a bigger blur. Go back to a lower zoom, or build better optics.`;
    case 'too-small-to-see':
      return `${f.name} is resolved, but at ${scope.magnification}× it looks only ${fmtUm(vis.apparentUm)} wide, below what the eye can see (${fmtUm(EYE_LIMIT_UM)}). Zoom in to at least ${Math.ceil(EYE_LIMIT_UM / f.sizeUm)}×.`;
    case 'low-contrast':
      return f.stain
        ? `${f.name} is big enough to resolve but almost transparent against its background. Stain it: press S to add a dye, and rinse when the contrast peaks.`
        : `${f.name} is big enough to resolve but almost transparent against its background. It needs more contrast, such as a stain.`;
    default:
      return null;
  }
}

/** The biggest feature this scope fails to show: the nearest goal for the player. Low-contrast walls come last:
 *  staining is a side path, and the resolution walls are what lead to the next microscope. */
export function nearestWall<F extends Pick<Feature, 'sizeUm' | 'contrast'>>(sample: { features: F[] }, scope: ScopeParams) {
  const side = (x: { v: Visibility }) => +(x.v.reason === 'low-contrast');
  return sample.features
    .map((f) => ({ f, v: visibility(f, scope) }))
    .filter((x) => !x.v.visible)
    .sort((a, b) => side(a) - side(b) || b.f.sizeUm - a.f.sizeUm)[0];
}

/** Resolution as a one-liner for HUDs: "resolves ≥ 1.5 µm". */
export const resolutionLabel = (scope: ScopeParams) => `resolves ≥ ${fmtUm(scopeResolutionUm(scope))}`;
