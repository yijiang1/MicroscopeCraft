// "What do I build next, what do I need, where do I get it, and what must I identify first?"
// Pure, from the recipes, the inventory and the discoveries. Used by the goal panel and the guide. Owner: Person D.
import type { Feature, GameData, GameState, Recipe, Sample, Site, ZoomStep } from './schema';
import { visibility } from './sim/optics';
import { scopeFromInventory, scopeParamsFromSpec, withBuilds, type Builds } from './sim/scope';
import { fmtUm } from './sim/walls';

export interface PlanStep {
  recipe: Recipe;
  /** How many times to craft it. */
  times: number;
}

/** A material that is only recognisable under a microscope: it can't be gathered until the feature is discovered. */
export interface Identify {
  feature: Feature;
  sample: Sample;
  /** The simplest microscope that can show the feature, and the step that does. */
  scope: Recipe | null;
  step: ZoomStep | null;
  done: boolean;
  /** A microscope the player built by hand that would show the feature if built differently: rebuild it. */
  rebuild?: Recipe;
}

export interface PlanRaw {
  itemId: string;
  /** Total the goal needs from scratch. */
  total: number;
  /** Still to gather (0 when satisfied by the inventory or by parts already crafted). */
  missing: number;
  identify?: Identify;
}

export interface Plan {
  /** The microscope recipe being worked toward. */
  goal: Recipe;
  /** Every raw material the goal needs, in the order they come up. */
  raw: PlanRaw[];
  /** Raw materials still to gather. */
  missing: { itemId: string; count: number }[];
  /** All crafts from scratch, in order, and the ones still left. */
  allSteps: PlanStep[];
  steps: PlanStep[];
  /** The first remaining step whose inputs are all in the inventory right now. */
  nextStep: PlanStep | null;
}

const producerOf = (data: Pick<GameData, 'recipes'>, itemId: string) => data.recipes.find((r) => r.output.itemId === itemId);

export function findFeature(data: Pick<GameData, 'samples'>, featureId: string): { feature: Feature; sample: Sample } | null {
  for (const sample of Object.values(data.samples)) {
    const feature = sample.features.find((f) => f.id === featureId);
    if (feature) return { feature, sample };
  }
  return null;
}

/** The first step of a microscope that shows the feature (in focus, aligned, every add-on built), or null. */
export const stepThatSees = (feature: Feature, recipe: Recipe): ZoomStep | null =>
  recipe.scope?.steps.find((_, i) => visibility(feature, scopeParamsFromSpec(recipe.scope!, i)).visible) ?? null;

/** Lowest-tier microscope recipe that shows the feature (at its best zoom step, in focus). */
export function scopeThatSees(feature: Feature, data: Pick<GameData, 'recipes'>): Recipe | null {
  return data.recipes.filter((r) => stepThatSees(feature, r)).sort((a, b) => a.scope!.tier - b.scope!.tier)[0] ?? null;
}

export const SITE_NAMES: Record<Site, string> = { lab: 'science lab', chess: 'CHESS hall in Wilson Lab' };

/** The feature the player must discover before this item can be gathered, or null if it is free to gather. */
export function lockedBy(itemId: string, data: Pick<GameData, 'materials'>, discoveries: readonly string[]): string | null {
  const f = data.materials[itemId]?.unlockedBy;
  return f && !discoveries.includes(f) ? f : null;
}

/** Next microscope above the one the player has, or null when the tree is done. */
export function nextGoalRecipe(data: Pick<GameData, 'recipes'>, state: Pick<GameState, 'inventory'>): Recipe | null {
  const best = scopeFromInventory(state.inventory, data).tier; // best owned, not the one picked in the eyepiece
  return (
    data.recipes
      .filter((r) => r.scope && r.scope.tier > best)
      .sort((a, b) => a.scope!.tier - b.scope!.tier)[0] ?? null
  );
}

const identifyOf = (found: { feature: Feature; sample: Sample }, data: Pick<GameData, 'recipes'>, discoveries: readonly string[], builds: Builds): Identify => {
  const scope = scopeThatSees(found.feature, withBuilds(data, builds));
  const usual = scopeThatSees(found.feature, data);
  const rebuild = usual?.assembly && builds[usual.output.itemId] && scope?.id !== usual.id ? usual : undefined;
  return { ...found, scope, step: scope && stepThatSees(found.feature, scope), done: discoveries.includes(found.feature.id), rebuild };
};

export function planFor(
  goal: Recipe,
  data: Pick<GameData, 'recipes' | 'materials' | 'samples'>,
  inventory: Record<string, number>,
  discoveries: readonly string[] = [],
  builds: Builds = {},
): Plan {
  /** Expand the goal against an inventory: what raw material is missing and which crafts are needed. */
  const expand = (have: Record<string, number>) => {
    const inv = { ...have };
    const missing = new Map<string, number>();
    const steps = new Map<string, PlanStep>();
    const need = (itemId: string, count: number) => {
      const used = Math.min(inv[itemId] ?? 0, count);
      inv[itemId] = (inv[itemId] ?? 0) - used;
      const rest = count - used;
      if (rest <= 0) return;
      const recipe = producerOf(data, itemId);
      if (!recipe) {
        missing.set(itemId, (missing.get(itemId) ?? 0) + rest);
        return;
      }
      const times = Math.ceil(rest / recipe.output.count);
      for (const input of recipe.inputs) need(input.itemId, input.count * times);
      steps.set(recipe.id, { recipe, times: (steps.get(recipe.id)?.times ?? 0) + times });
    };
    for (const input of goal.inputs) need(input.itemId, input.count);
    steps.set(goal.id, { recipe: goal, times: 1 });
    return { missing, steps: [...steps.values()] };
  };

  const full = expand({});
  const now = expand(inventory);
  const raw: PlanRaw[] = [...full.missing].map(([itemId, total]) => {
    const found = lockedBy(itemId, data, []) ? findFeature(data, data.materials[itemId]!.unlockedBy!) : null;
    return {
      itemId,
      total,
      missing: now.missing.get(itemId) ?? 0,
      identify: found ? identifyOf(found, data, discoveries, builds) : undefined,
    };
  });
  // Materials that must be identified under a microscope first come first: they are the new thing to learn.
  raw.sort((a, b) => Number(!!b.identify && !b.identify.done) - Number(!!a.identify && !a.identify.done));
  const has = (r: Recipe) => r.inputs.every((i) => (inventory[i.itemId] ?? 0) >= i.count);
  return {
    goal,
    raw,
    missing: [...now.missing].map(([itemId, count]) => ({ itemId, count })),
    allSteps: full.steps,
    steps: now.steps,
    nextStep: now.steps.find((s) => has(s.recipe)) ?? null,
  };
}

export type Action =
  | { kind: 'identify'; raw: PlanRaw; identify: Identify }
  | { kind: 'gather'; raw: PlanRaw }
  | { kind: 'craft'; step: PlanStep };

/** The one thing to do right now: craft as soon as a step is ready (so the player sees materials turn into parts),
 * else identify or gather the first material still missing. */
export function currentAction(plan: Plan): Action | null {
  if (plan.nextStep) return { kind: 'craft', step: plan.nextStep };
  const raw = plan.raw.find((r) => r.missing > 0);
  if (!raw) return null;
  return raw.identify && !raw.identify.done ? { kind: 'identify', raw, identify: raw.identify } : { kind: 'gather', raw };
}

export function actionText(action: Action, data: Pick<GameData, 'items'>): string {
  switch (action.kind) {
    case 'identify': {
      const { sample, feature, scope, step, rebuild } = action.identify;
      if (rebuild) return `Your ${rebuild.name} can't show ${feature.name} (${fmtUm(feature.sizeUm)}) yet: rebuild it at the workbench [B] with a more strongly curved objective and its stop set`;
      const at = step && (scope?.scope?.steps.length ?? 0) > 1 ? ` at ${step.label}` : '';
      const site = scope?.scope?.site;
      if (site) return `Look [F] at a ${sample.name} to take a bit, then use the ${scope.name} in the ${SITE_NAMES[site]}${at} to spot ${feature.name}`;
      return `Look [F] at a ${sample.name} with your ${scope?.name ?? 'microscope'}${at} to spot ${feature.name}`;
    }
    case 'gather':
      return `Gather ${action.raw.missing} ${data.items[action.raw.itemId]?.name ?? action.raw.itemId} (aim and press [E])`;
    case 'craft':
      return action.step.recipe.assembly
        ? `Press [C] to build the ${action.step.recipe.name} at the workbench`
        : `Press C to craft ${action.step.recipe.name}`;
  }
}

/** Plain-words answer to "how do I get this item?", for the guide. */
export function howToGet(
  itemId: string,
  data: Pick<GameData, 'recipes' | 'materials' | 'items' | 'samples'>,
  discoveries: readonly string[] = [],
): string | null {
  const name = data.items[itemId]?.name;
  if (!name) return null;
  const recipe = producerOf(data, itemId);
  if (!recipe) {
    const where = data.materials[itemId]?.where;
    if (!where) return null;
    const locked = lockedBy(itemId, data, discoveries);
    const found = locked ? findFeature(data, locked) : null;
    const scope = found ? scopeThatSees(found.feature, data) : null;
    return `${name}: ${where}.${locked && scope ? ` You can only gather it after you have looked at it with a ${scope.name} and spotted ${found!.feature.name}.` : ' Aim at it and press [E].'}`;
  }
  const parts = recipe.inputs.map((i) => `${i.count} ${data.items[i.itemId]?.name ?? i.itemId}`);
  if (recipe.assembly) return `${name} is built by hand at the workbench [B], from ${parts.join(' and ')}: you grind the lenses and put the parts together.`;
  return `${name} is crafted, not found in the world. Make it in the crafting panel from ${parts.join(' and ')}.`;
}

/** Common material names, including the two different sands rather than silently choosing one. */
const ITEM_ALIASES: Record<string, string[]> = {
  sand: ['beach_sand', 'quartz_sand'],
  quartz: ['quartz_sand'],
  iron: ['iron_ore'],
  copper: ['copper_ore'],
  tungsten: ['tungsten_ore'],
  oil: ['plant_oil', 'immersion_oil'],
};

/** Whole words/phrases, longest first ("quartz sand" before "sand", "glass lens" before "glass"). */
export function itemsMentioned(text: string, data: Pick<GameData, 'items'>): string[] {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hits = [
    ...Object.entries(data.items).map(([id, v]) => ({ name: words(v.name), ids: [id] })),
    ...Object.entries(ITEM_ALIASES).map(([name, ids]) => ({ name, ids: ids.filter((id) => data.items[id]) })),
  ].sort((a, b) => b.name.length - a.name.length);
  const out: string[] = [];
  let rest = ` ${words(text)} `;
  for (const { name, ids } of hits) {
    const phrase = ` ${name} `;
    if (rest.includes(phrase)) {
      for (const id of ids) if (!out.includes(id)) out.push(id);
      rest = rest.replaceAll(phrase, ' ');
    }
  }
  return out;
}
