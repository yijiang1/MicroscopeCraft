// Achievements and the scientists' requests share one rule language (Condition), checked here.
// Pure, so the journal, the scientists' dialogs and the tests read the same answer. Owner: Person D.
import type { Achievement, Condition, GameData, GameState, Npc, Quest } from './schema';

type State = Pick<GameState, 'discoveries' | 'inventory' | 'quests' | 'best' | 'stats' | 'visited' | 'achievements'>;
type Data = Pick<GameData, 'samples' | 'npcs'>;

/** Every request from every scientist, with who asked. */
export const allQuests = (data: Pick<GameData, 'npcs'>): { npc: Npc; quest: Quest }[] =>
  Object.values(data.npcs).flatMap((npc) => npc.quests.map((quest) => ({ npc, quest })));

/** The fixed achievements plus one for every scientist's request ("quest_<id>"). */
export function allAchievements(data: Pick<GameData, 'achievements' | 'npcs'>): Achievement[] {
  return [
    ...data.achievements,
    ...allQuests(data).map(({ npc, quest }) => ({ id: `quest_${quest.id}`, name: quest.title, description: `For ${npc.name}: ${quest.ask}`, when: { quest: quest.id } })),
  ];
}

/** How far along a condition is: done / total over all its parts, each part counting in its own units. */
export function progress(c: Condition, data: Data, s: State): { done: number; total: number } {
  let done = 0;
  let total = 0;
  const part = (have: number, need: number) => {
    done += Math.min(have, need);
    total += need;
  };
  const count = (ids: readonly string[], have: (id: string) => boolean) => part(ids.filter(have).length, ids.length);
  const found = (id: string) => s.discoveries.includes(id);
  if (c.discoveries) part(s.discoveries.length, c.discoveries);
  if (c.discovered) count(c.discovered, found);
  if (c.owns) count(c.owns, (id) => (s.inventory[id] ?? 0) > 0);
  if (c.biome) count(Object.values(data.samples).filter((x) => x.biome === c.biome).flatMap((x) => x.features.map((f) => f.id)), found);
  if (c.quests) part(s.quests.length, c.quests);
  if (c.quest) count([c.quest], (id) => s.quests.includes(id));
  if (c.questsOf) count(data.npcs[c.questsOf]?.quests.map((q) => q.id) ?? [], (id) => s.quests.includes(id));
  for (const [game, min] of Object.entries(c.best ?? {})) part((s.best[game] ?? 0) >= min ? 1 : 0, 1);
  for (const [key, min] of Object.entries(c.stats ?? {})) part(s.stats[key] ?? 0, min);
  if (c.visited) count(c.visited, (a) => s.visited.includes(a));
  if (c.achievements) part(s.achievements.length, c.achievements);
  return { done, total };
}

export const conditionMet = (c: Condition, data: Data, s: State) => {
  const p = progress(c, data, s);
  return p.total > 0 && p.done >= p.total;
};

/** Achievements the state satisfies that are not yet recorded, in list order. */
export const newlyEarned = (data: Pick<GameData, 'achievements' | 'npcs' | 'samples'>, s: State) =>
  allAchievements(data).filter((a) => !s.achievements.includes(a.id) && conditionMet(a.when, data, s));
