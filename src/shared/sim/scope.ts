import { electronWavelengthNm, GREEN_LIGHT_UM } from './optics';
import type { GameData, Recipe, ScopeParams, ScopeSpec } from '../schema';

/** What the player sees with no instrument. NA 0.002 ≈ a 0.14 mm resolution limit (the eye, simplified). */
export const NAKED_EYE: ScopeParams = {
  tier: 0,
  steps: [{ label: '1×', magnification: 1, NA: 0.002 }],
  step: 0,
  magnification: 1,
  NA: 0.002,
  wavelengthUm: GREEN_LIGHT_UM,
  dLensUm: 0,
  contrastBoost: 1,
};

export function scopeParamsFromSpec(spec: ScopeSpec, step = 0): ScopeParams {
  const i = Math.min(Math.max(step, 0), spec.steps.length - 1);
  const s = spec.steps[i]!;
  return {
    tier: spec.tier,
    steps: spec.steps,
    step: i,
    magnification: s.magnification,
    NA: s.NA,
    wavelengthUm: spec.voltageV ? electronWavelengthNm(spec.voltageV) / 1000 : GREEN_LIGHT_UM,
    dLensUm: spec.dLensUm,
    contrastBoost: spec.contrastBoost,
  };
}

/** Electron microscopes (tier 5 and up) stay installed in the lab; light microscopes go wherever the player goes. */
export const FIXED_TIER = 5;

/** Microscopes in the inventory, lowest tier first. Outside the lab (inLab false) only the portable ones. */
export function ownedScopes(inventory: Record<string, number>, data: Pick<GameData, 'recipes'>, inLab = true) {
  return data.recipes
    .filter((r): r is Recipe & { scope: ScopeSpec } => !!r.scope && (inventory[r.output.itemId] ?? 0) > 0 && (inLab || r.scope.tier < FIXED_TIER))
    .sort((a, b) => a.scope.tier - b.scope.tier);
}

/** The chosen microscope (by tier) if owned, else the best one owned, at the given zoom step; or the naked eye. */
export function scopeFromInventory(
  inventory: Record<string, number>,
  data: Pick<GameData, 'recipes'>,
  step = 0,
  choice: number | null = null,
  inLab = true,
): ScopeParams {
  const owned = ownedScopes(inventory, data, inLab);
  const pick = owned.find((r) => r.scope.tier === choice) ?? owned.at(-1);
  return pick ? scopeParamsFromSpec(pick.scope, step) : NAKED_EYE;
}
