// Game state lives here, not in any renderer. Only the actions below mutate it,
// and each emits its event after mutating. Renderers read ctx.state and call actions.
import { createBus, type Bus } from './events';
import type { GameData, GameState, Tier } from './schema';
import { NAKED_EYE, ownedScopes, scopeFromInventory } from './sim/scope';

export { ownedScopes }; // microscopes in the inventory, lowest tier first (UI modules may not import sim/scope)

/** Handed to every module's mount function. */
export interface GameContext {
  data: GameData;
  state: GameState;
  bus: Bus;
}

export function createGame(data: GameData, bus: Bus = createBus()): GameContext {
  const state: GameState = { inventory: {}, discoveries: [], snapshots: {}, currentSampleId: null, scopeChoice: null, inLab: false, scope: NAKED_EYE };
  const ctx = { data, state, bus };
  bus.on('openEyepiece', ({ sampleId }) => (state.currentSampleId = sampleId));
  bus.on('closeEyepiece', () => (state.currentSampleId = null));
  return ctx;
}

/** The microscope in use, at its lowest zoom step: the chosen one if usable here, else the best usable one. */
const usableScope = ({ data, state }: GameContext, step = 0) => scopeFromInventory(state.inventory, data, step, state.scopeChoice, state.inLab);

/** The world calls this as the player walks in or out of the lab: electron microscopes only work inside. */
export function setInLab(ctx: GameContext, inLab: boolean) {
  if (ctx.state.inLab === inLab) return;
  ctx.state.inLab = inLab;
  const tier = ctx.state.scope.tier;
  ctx.state.scope = usableScope(ctx);
  if (ctx.state.scope.tier !== tier) ctx.bus.emit('scopeChanged', { tier: ctx.state.scope.tier });
}

/** Switch the current microscope to another zoom step (clamped to the steps it has). */
export function setZoom(ctx: GameContext, step: number) {
  const next = usableScope(ctx, step);
  if (next.step === ctx.state.scope.step) return;
  ctx.state.scope = next;
  ctx.bus.emit('zoomChanged', { step: next.step });
}

/** Look through another microscope you own (by tier), e.g. to compare. Returns false if you don't own it. */
export function selectScope(ctx: GameContext, tier: number): boolean {
  if (!ownedScopes(ctx.state.inventory, ctx.data, ctx.state.inLab).some((r) => r.scope.tier === tier)) return false;
  ctx.state.scopeChoice = tier as Tier;
  if (ctx.state.scope.tier === tier) return true;
  ctx.state.scope = usableScope(ctx);
  ctx.bus.emit('scopeChanged', { tier: ctx.state.scope.tier });
  return true;
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
  const best = scopeFromInventory(inv, ctx.data).tier; // best owned anywhere, lab or not
  for (const i of recipe.inputs) if (!i.keep) inv[i.itemId] = (inv[i.itemId] ?? 0) - i.count;
  inv[recipe.output.itemId] = (inv[recipe.output.itemId] ?? 0) + recipe.output.count;
  if (recipe.scope) ctx.state.scopeChoice = null; // a newly built microscope is the one you look through
  // before the events, so listeners already see the new microscope
  ctx.state.scope = usableScope(ctx);
  const tier = scopeFromInventory(inv, ctx.data).tier;
  if (tier !== best) ctx.bus.emit('tierChanged', { tier });
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
