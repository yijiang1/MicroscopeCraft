// Game state lives here, not in any renderer. Only the actions below mutate it,
// and each emits its event after mutating. Renderers read ctx.state and call actions.
import { createBus, type Bus } from './events';
import type { GameData, GameState } from './schema';
import { NAKED_EYE, scopeFromInventory } from './sim/scope';

/** Handed to every module's mount function. */
export interface GameContext {
  data: GameData;
  state: GameState;
  bus: Bus;
}

export function createGame(data: GameData, bus: Bus = createBus()): GameContext {
  const state: GameState = { inventory: {}, discoveries: [], snapshots: {}, currentSampleId: null, scope: NAKED_EYE };
  const ctx = { data, state, bus };
  bus.on('openEyepiece', ({ sampleId }) => (state.currentSampleId = sampleId));
  bus.on('closeEyepiece', () => (state.currentSampleId = null));
  return ctx;
}

function refreshScope({ data, state, bus }: GameContext) {
  const before = state.scope.tier;
  // A new best microscope starts at its lowest zoom step.
  state.scope = scopeFromInventory(state.inventory, data, 0);
  if (state.scope.tier !== before) bus.emit('tierChanged', { tier: state.scope.tier });
}

/** Switch the current microscope to another zoom step (clamped to the steps it has). */
export function setZoom(ctx: GameContext, step: number) {
  const next = scopeFromInventory(ctx.state.inventory, ctx.data, step);
  if (next.step === ctx.state.scope.step) return;
  ctx.state.scope = next;
  ctx.bus.emit('zoomChanged', { step: next.step });
}

export function gather(ctx: GameContext, itemId: string, count = 1) {
  ctx.state.inventory[itemId] = (ctx.state.inventory[itemId] ?? 0) + count;
  ctx.bus.emit('itemGathered', { itemId, count });
}

export function canCraft(ctx: GameContext, recipeId: string): boolean {
  const recipe = ctx.data.recipes.find((r) => r.id === recipeId);
  return !!recipe && recipe.inputs.every((i) => (ctx.state.inventory[i.itemId] ?? 0) >= i.count);
}

/** Returns false (and changes nothing) if the recipe is unknown or inputs are missing. */
export function craft(ctx: GameContext, recipeId: string): boolean {
  const recipe = ctx.data.recipes.find((r) => r.id === recipeId);
  if (!recipe || !canCraft(ctx, recipeId)) return false;
  const inv = ctx.state.inventory;
  for (const i of recipe.inputs) inv[i.itemId] = (inv[i.itemId] ?? 0) - i.count;
  inv[recipe.output.itemId] = (inv[recipe.output.itemId] ?? 0) + recipe.output.count;
  refreshScope(ctx); // before the event, so listeners of itemCrafted already see the new microscope
  ctx.bus.emit('itemCrafted', { itemId: recipe.output.itemId });
  return true;
}

/** Emits discoveryUnlocked only the first time. A snapshot is kept for the Microdex card if it beats the stored one. */
export function discover(ctx: GameContext, featureId: string, snapshot?: { image: string; quality: number }) {
  const { discoveries, snapshots } = ctx.state;
  if (snapshot && snapshot.quality > (snapshots[featureId]?.quality ?? 0)) snapshots[featureId] = snapshot;
  if (discoveries.includes(featureId)) return;
  discoveries.push(featureId);
  ctx.bus.emit('discoveryUnlocked', { id: featureId });
}
