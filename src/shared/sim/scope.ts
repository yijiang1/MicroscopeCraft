import { electronWavelengthNm, GREEN_LIGHT_UM } from './optics';
import type { GameData, ScopeParams, ScopeSpec } from '../schema';

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

/** Best (highest-tier) microscope in the inventory at the given zoom step, or the naked eye. */
export function scopeFromInventory(
  inventory: Record<string, number>,
  data: Pick<GameData, 'recipes'>,
  step = 0,
): ScopeParams {
  const owned = data.recipes
    .filter((r) => r.scope && (inventory[r.output.itemId] ?? 0) > 0)
    .map((r) => r.scope as ScopeSpec)
    .sort((a, b) => b.tier - a.tier);
  return owned[0] ? scopeParamsFromSpec(owned[0], step) : NAKED_EYE;
}
