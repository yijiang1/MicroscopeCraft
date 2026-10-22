import { compileBuild } from './assembly';
import { compileColumn } from './column';
import { electronWavelengthNm, EYE_LIMIT_UM, GREEN_LIGHT_UM, xrayWavelengthNm } from './optics';
import { isTemBuild, type Build, type GameData, type Recipe, type ScopeParams, type ScopeSpec, type Site, type ZoomStep } from '../schema';

/** Microscopes built by hand at the workbench or the electron bench, by item id. */
export type Builds = Readonly<Record<string, Build>>;

/** A microscope as the player has it: built by hand, or as its recipe makes it. */
export const specOf = (recipe: Recipe & { scope: ScopeSpec }, builds: Builds = {}): ScopeSpec => {
  const build = recipe.assembly ? builds[recipe.output.itemId] : undefined;
  if (!build) return recipe.scope;
  return isTemBuild(build) ? compileColumn(build, recipe.scope) : compileBuild(build, recipe.scope);
};

/** The recipes with every hand-built microscope's own steps, for anything that asks "which step shows this?". */
export const withBuilds = <D extends Pick<GameData, 'recipes'>>(data: D, builds: Builds): D =>
  Object.keys(builds).length
    ? { ...data, recipes: data.recipes.map((r) => (r.scope ? { ...r, scope: specOf(r as Recipe & { scope: ScopeSpec }, builds) } : r)) }
    : data;

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
    contrastBoost: s.contrastBoost ?? spec.contrastBoost,
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

/** The chosen microscope (by tier) if usable here, else the best one usable here, at the given zoom step; or the naked eye.
 *  A microscope built at the workbench uses the steps of its build. */
export function scopeFromInventory(
  inventory: Record<string, number>,
  data: Pick<GameData, 'recipes'>,
  step = 0,
  choice: number | null = null,
  site?: Site | null,
  builds: Builds = {},
): ScopeParams {
  const owned = ownedScopes(inventory, data, site);
  const pick = owned.find((r) => r.scope.tier === choice) ?? owned.at(-1);
  return pick ? scopeParamsFromSpec(specOf(pick, builds), step, inventory) : NAKED_EYE;
}
