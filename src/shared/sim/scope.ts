import { electronWavelengthNm, EYE_LIMIT_UM, GREEN_LIGHT_UM, xrayWavelengthNm } from './optics';
import type { GameData, Recipe, ScopeParams, ScopeSpec, Site, ZoomStep } from '../schema';

/** What the player sees with no instrument: an NA chosen so the Abbe limit is the eye's ~0.1 mm at 25 cm (simplified). */
const EYE_NA = GREEN_LIGHT_UM / (2 * EYE_LIMIT_UM);

export const NAKED_EYE: ScopeParams = {
  tier: 0,
  steps: [{ label: '1×', magnification: 1, NA: EYE_NA, mode: 'brightfield' }],
  step: 0,
  magnification: 1,
  NA: EYE_NA,
  mode: 'brightfield',
  wavelengthUm: GREEN_LIGHT_UM,
  dLensUm: 0,
  contrastBoost: 1,
  condenser: false,
};

/** The steps you can use: a step that needs an add-on you have not built is left out. No inventory = every step. */
export const availableSteps = (spec: ScopeSpec, inventory?: Record<string, number>): ZoomStep[] =>
  spec.steps.filter((s) => !inventory || !s.requires || (inventory[s.requires] ?? 0) > 0);

/** The scope at one of its steps, ideally set up (in focus, aligned). The eyepiece adds the player's real settings. */
export function scopeParamsFromSpec(spec: ScopeSpec, step = 0, inventory?: Record<string, number>): ScopeParams {
  const steps = availableSteps(spec, inventory);
  const i = Math.min(Math.max(step, 0), steps.length - 1);
  const s = steps[i]!;
  const volts = s.voltageV ?? spec.voltageV;
  return {
    tier: spec.tier,
    steps,
    step: i,
    magnification: s.magnification,
    NA: s.NA,
    mode: s.mode,
    wavelengthUm: volts ? electronWavelengthNm(volts) / 1000 : spec.xrayKeV ? xrayWavelengthNm(spec.xrayKeV) / 1000 : GREEN_LIGHT_UM,
    dLensUm: s.dLensUm ?? spec.dLensUm,
    contrastBoost: spec.contrastBoost,
    condenser: spec.condenser,
    site: spec.site,
  };
}

/** Microscopes in the inventory, lowest tier first. `site` undefined = all of them, wherever they are;
 *  otherwise the portable ones plus those installed at that site (null = away from every site). */
export function ownedScopes(inventory: Record<string, number>, data: Pick<GameData, 'recipes'>, site?: Site | null) {
  return data.recipes
    .filter((r): r is Recipe & { scope: ScopeSpec } => !!r.scope && (inventory[r.output.itemId] ?? 0) > 0 && (site === undefined || !r.scope.site || r.scope.site === site))
    .sort((a, b) => a.scope.tier - b.scope.tier);
}

/** The chosen microscope (by tier) if usable here, else the best one usable here, at the given zoom step; or the naked eye. */
export function scopeFromInventory(
  inventory: Record<string, number>,
  data: Pick<GameData, 'recipes'>,
  step = 0,
  choice: number | null = null,
  site?: Site | null,
): ScopeParams {
  const owned = ownedScopes(inventory, data, site);
  const pick = owned.find((r) => r.scope.tier === choice) ?? owned.at(-1);
  return pick ? scopeParamsFromSpec(pick.scope, step, inventory) : NAKED_EYE;
}
