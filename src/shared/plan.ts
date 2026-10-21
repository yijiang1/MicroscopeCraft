// "What do I build next, what do I need, and where do I get it?" Pure, from the recipes and the inventory.
// Used by the goal panel and the guide. Owner: Person D.
import type { GameData, GameState, Recipe } from './schema';

export interface PlanStep {
  recipe: Recipe;
  /** How many times to craft it. */
  times: number;
}

export interface Plan {
  /** The microscope recipe being worked toward. */
  goal: Recipe;
  /** Raw materials still to gather (not yet in the inventory), most urgent first. */
  missing: { itemId: string; count: number }[];
  /** Crafts still to do, in an order where each step's inputs come from earlier steps. */
  steps: PlanStep[];
  /** The first step whose inputs are all in the inventory right now. */
  nextStep: PlanStep | null;
}

const producerOf = (data: Pick<GameData, 'recipes'>, itemId: string) => data.recipes.find((r) => r.output.itemId === itemId);

/** Next microscope above the one the player has, or null when the tree is done. */
export function nextGoalRecipe(data: Pick<GameData, 'recipes'>, state: Pick<GameState, 'scope'>): Recipe | null {
  return (
    data.recipes
      .filter((r) => r.scope && r.scope.tier > state.scope.tier)
      .sort((a, b) => a.scope!.tier - b.scope!.tier)[0] ?? null
  );
}

export function planFor(goal: Recipe, data: Pick<GameData, 'recipes'>, inventory: Record<string, number>): Plan {
  const inv = { ...inventory };
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
    const prev = steps.get(recipe.id);
    steps.set(recipe.id, { recipe, times: (prev?.times ?? 0) + times });
  };
  for (const input of goal.inputs) need(input.itemId, input.count);
  steps.set(goal.id, { recipe: goal, times: 1 });

  const list = [...steps.values()];
  const has = (r: Recipe) => r.inputs.every((i) => (inventory[i.itemId] ?? 0) >= i.count);
  return {
    goal,
    missing: [...missing].map(([itemId, count]) => ({ itemId, count })),
    steps: list,
    nextStep: list.find((s) => has(s.recipe)) ?? null,
  };
}

/** Plain-words answer to "how do I get this item?", for the guide. */
export function howToGet(itemId: string, data: Pick<GameData, 'recipes' | 'materials' | 'items'>): string | null {
  const name = data.items[itemId]?.name;
  if (!name) return null;
  const recipe = producerOf(data, itemId);
  if (!recipe) return data.materials[itemId]?.where ? `${name}: ${data.materials[itemId]!.where}. Aim at it and press E.` : null;
  const parts = recipe.inputs.map((i) => `${i.count} ${data.items[i.itemId]?.name ?? i.itemId}`);
  return `${name} is crafted, not found in the world. Make it in the crafting panel from ${parts.join(' and ')}.`;
}

/** Items whose name appears in the text, longest names first ("glass lens" before "glass"). */
export function itemsMentioned(text: string, data: Pick<GameData, 'items'>): string[] {
  const t = text.toLowerCase();
  const hits = Object.entries(data.items)
    .filter(([, v]) => t.includes(v.name.toLowerCase()))
    .sort((a, b) => b[1].name.length - a[1].name.length);
  const out: string[] = [];
  let rest = t;
  for (const [id, v] of hits) {
    const n = v.name.toLowerCase();
    if (rest.includes(n)) {
      out.push(id);
      rest = rest.replace(n, ' ');
    }
  }
  return out;
}
