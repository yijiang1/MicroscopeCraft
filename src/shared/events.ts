// The only way modules talk to each other. Names mirror the contract in docs/DESIGN.md.
import type { Tier } from './schema';

export interface GameEvents {
  toggleBinoculars: Record<string, never>;
  mysteryChanged: Record<string, never>;
  openMysteryNotebook: Record<string, never>;
  driveMiata: { trial: boolean };
  musicScene: { distance: number; indoors: boolean };
  economyChanged: Record<string, never>;
  rewardEarned: { coins: number; vouchers: number };
  openCampusActivity: { activity: 'store' | 'lab' | 'chess' };
  campusActivityChanged: { open: boolean };
  /** world → scope: player aimed at a sample and pressed the eyepiece key. */
  openEyepiece: { sampleId: string };
  /** scope → world: eyepiece dismissed. */
  closeEyepiece: Record<string, never>;
  carriedSamplesChanged: Record<string, never>;
  /** World position/view changed; autosaving is throttled by the UI. */
  playerMoved: Record<string, never>;
  /** scope → guide: advice from the rendered image, including focus, alignment, stains and damage. */
  eyepieceStatus: { sampleId: string; text: string };
  /** Grounded player movement; consumed by the shared audio controller. */
  footstep: { surface: 'grass' | 'stone' | 'water'; running: boolean };
  itemGathered: { itemId: string; count: number };
  itemCrafted: { itemId: string };
  discoveryUnlocked: { id: string };
  tierChanged: { tier: Tier };
  /** Player picked another zoom step on the current microscope. */
  zoomChanged: { step: number };
  /** Player switched to another owned microscope in the eyepiece. */
  scopeChanged: { tier: Tier };
  /** ui → world: point the player at the nearest source of this item (null = stop). */
  trackItem: { itemId: string | null };
  /** ui → world: point the player at a sample to look at, or a scientist (null = stop). */
  trackTarget: { target: { kind: 'sample' | 'npc'; id: string } | null };
  /** ui → guide: the player asked the guide a question. */
  guideAsked: { question: string };
  /** guide → ui: the guide's answer. */
  guideReplied: { text: string };
  /** world → ui: the player pressed E at a scientist. */
  talkTo: { npcId: string };
  /** A scientist's request was done. */
  questCompleted: { npcId: string; questId: string };
  achievementUnlocked: { id: string };
  /** A mini-game finished with a score from 0 to 1; best = it beat the previous best. */
  minigameScored: { game: string; score: number; best: boolean };
  /** The player reached an area of the campus for the first time. */
  areaVisited: { area: string };
  /** world → sound: the clock tower rang a quarter (1–3), or struck the hour (quarter 0), `distance` m from the player. */
  towerBell: { quarter: number; hour: number; distance: number };
  /** Open the workbench to build a microscope by hand (or rebuild one you own). null = whichever is next. */
  openWorkbench: { recipeId: string | null };
  /** workbench → world, ui: the workbench was closed. */
  closeWorkbench: Record<string, never>;
  /** Easy or advanced mode was picked (setAdvanced). */
  modeChanged: { advanced: boolean };
}

export type Bus = ReturnType<typeof createBus>;

export function createBus() {
  const handlers = new Map<keyof GameEvents, Set<(p: never) => void>>();
  return {
    on<K extends keyof GameEvents>(type: K, fn: (payload: GameEvents[K]) => void): () => void {
      const set = handlers.get(type) ?? new Set();
      set.add(fn as (p: never) => void);
      handlers.set(type, set);
      return () => set.delete(fn as (p: never) => void);
    },
    emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
      handlers.get(type)?.forEach((fn) => (fn as (p: GameEvents[K]) => void)(payload));
    },
  };
}
