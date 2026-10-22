// Game state lives here, not in any renderer. Only the actions below mutate it,
// and each emits its event after mutating. Renderers read ctx.state and call actions.
import { z } from 'zod';
import { conditionMet, newlyEarned } from './achievements';
import { createBus, type Bus } from './events';
import { SiteSchema, TierSchema, type GameData, type GameState, type Site, type Tier } from './schema';
import { NAKED_EYE, ownedScopes, scopeFromInventory } from './sim/scope';

export { ownedScopes }; // microscopes in the inventory, lowest tier first (UI modules may not import sim/scope)

/** Handed to every module's mount function. */
export interface GameContext {
  data: GameData;
  state: GameState;
  bus: Bus;
}

/** The part of the state worth keeping between visits. A bad save parses to null (start fresh); an older save
 *  without the newer fields gets their defaults. */
const SaveSchema = z.object({
  inventory: z.record(z.string(), z.number()),
  discoveries: z.array(z.string()),
  snapshots: z.record(z.string(), z.object({ image: z.string(), quality: z.number() })),
  scopeChoice: TierSchema.nullable(),
  achievements: z.array(z.string()).default([]),
  quests: z.array(z.string()).default([]),
  best: z.record(z.string(), z.number()).default({}),
  stats: z.record(z.string(), z.number()).default({}),
  visited: z.array(z.string()).default([]),
  align: z.record(z.string(), z.number()).default({}),
});
export type SaveData = z.infer<typeof SaveSchema>;
export const SAVE_KEY = 'microscopecraft:save';

export const toSave = ({ inventory, discoveries, snapshots, scopeChoice, achievements, quests, best, stats, visited, align }: GameState): SaveData => ({
  inventory, discoveries, snapshots, scopeChoice, achievements, quests, best, stats, visited, align,
});

export function parseSave(json: string | null): SaveData | null {
  try {
    return SaveSchema.parse(JSON.parse(json ?? ''));
  } catch {
    return null;
  }
}

export function createGame(data: GameData, bus: Bus = createBus(), save?: SaveData | null): GameContext {
  const state: GameState = {
    inventory: {}, discoveries: [], snapshots: {}, currentSampleId: null, scopeChoice: null, site: null, scope: NAKED_EYE,
    achievements: [], quests: [], best: {}, stats: {}, visited: [], align: {}, ...save,
  };
  const ctx = { data, state, bus };
  state.scope = usableScope(ctx);
  bus.on('openEyepiece', ({ sampleId }) => {
    state.currentSampleId = sampleId;
    bump(ctx, 'looked');
  });
  bus.on('closeEyepiece', () => (state.currentSampleId = null));
  return ctx;
}

/** The microscope in use, at its lowest zoom step: the chosen one if usable here, else the best usable one. */
const usableScope = ({ data, state }: GameContext, step = 0) => scopeFromInventory(state.inventory, data, step, state.scopeChoice, state.site);

/** The world calls this as the player walks in or out of a site: fixed instruments only work where they are installed. */
export function setSite(ctx: GameContext, site: Site | null) {
  if (ctx.state.site === site) return;
  SiteSchema.nullable().parse(site);
  ctx.state.site = site;
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

/** Look through another microscope you own (by tier), e.g. to compare. Returns false if you can't use it here. */
export function selectScope(ctx: GameContext, tier: number): boolean {
  if (!ownedScopes(ctx.state.inventory, ctx.data, ctx.state.site).some((r) => r.scope.tier === tier)) return false;
  ctx.state.scopeChoice = tier as Tier;
  if (ctx.state.scope.tier === tier) return true;
  ctx.state.scope = usableScope(ctx);
  ctx.bus.emit('scopeChanged', { tier: ctx.state.scope.tier });
  return true;
}

/** Record every achievement the state now satisfies (one can unlock the next, e.g. "earn 25 achievements"). */
export function checkAchievements(ctx: GameContext) {
  for (let fresh = newlyEarned(ctx.data, ctx.state); fresh.length; fresh = newlyEarned(ctx.data, ctx.state)) {
    for (const a of fresh) {
      ctx.state.achievements.push(a.id);
      ctx.bus.emit('achievementUnlocked', { id: a.id });
    }
  }
}

/** Add to a counter (gathered, crafted, looked, ...). */
export function bump(ctx: GameContext, key: string, n = 1) {
  ctx.state.stats[key] = (ctx.state.stats[key] ?? 0) + n;
  checkAchievements(ctx);
}

export function gather(ctx: GameContext, itemId: string, count = 1) {
  ctx.state.inventory[itemId] = (ctx.state.inventory[itemId] ?? 0) + count;
  ctx.bus.emit('itemGathered', { itemId, count });
  bump(ctx, 'gathered', count);
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
  // before the events, so listeners already see the new microscope (or the new steps an add-on gives, listed last)
  ctx.state.scope = usableScope(ctx, recipe.scope ? 0 : ctx.state.scope.step);
  const tier = scopeFromInventory(inv, ctx.data).tier;
  if (tier !== best) ctx.bus.emit('tierChanged', { tier });
  ctx.bus.emit('itemCrafted', { itemId: recipe.output.itemId });
  bump(ctx, 'crafted');
  return true;
}

/** Emits discoveryUnlocked only the first time. A snapshot is kept for the Microdex card if it beats the stored one. */
export function discover(ctx: GameContext, featureId: string, snapshot?: { image: string; quality: number }) {
  const { discoveries, snapshots } = ctx.state;
  if (snapshot && snapshot.quality > (snapshots[featureId]?.quality ?? 0)) snapshots[featureId] = snapshot;
  if (discoveries.includes(featureId)) return;
  discoveries.push(featureId);
  ctx.bus.emit('discoveryUnlocked', { id: featureId });
  checkAchievements(ctx);
}

/** Show a scientist what they asked for. Returns false if it is not done yet (or already shown). */
export function completeQuest(ctx: GameContext, npcId: string, questId: string): boolean {
  const quest = ctx.data.npcs[npcId]?.quests.find((q) => q.id === questId);
  if (!quest || ctx.state.quests.includes(questId) || !conditionMet(quest.needs, ctx.data, ctx.state)) return false;
  ctx.state.quests.push(questId);
  ctx.bus.emit('questCompleted', { npcId, questId });
  checkAchievements(ctx);
  return true;
}

/** A mini-game result, 0..1. Keeps the best. */
export function recordScore(ctx: GameContext, game: string, score: number) {
  const s = Math.min(1, Math.max(0, score));
  const best = s > (ctx.state.best[game] ?? -1);
  if (best) ctx.state.best[game] = s;
  ctx.bus.emit('minigameScored', { game, score: s, best });
  checkAchievements(ctx);
}

/** The world calls this as the player walks around; only the first visit to an area counts. */
export function visit(ctx: GameContext, area: string) {
  if (ctx.state.visited.includes(area)) return;
  ctx.state.visited.push(area);
  ctx.bus.emit('areaVisited', { area });
  checkAchievements(ctx);
}

/** Remember a knob position on an instrument (saved with the game; no event: knobs turn many times a second). */
export function setAlign(ctx: GameContext, key: string, value: number) {
  ctx.state.align[key] = value;
}
