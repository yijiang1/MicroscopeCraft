// The only way modules talk to each other. Names mirror the contract in DESIGN.md.
import type { Tier } from './schema';

export interface GameEvents {
  /** world → scope: player aimed at a sample and pressed the eyepiece key. */
  openEyepiece: { sampleId: string };
  /** scope → world: eyepiece dismissed. */
  closeEyepiece: Record<string, never>;
  itemGathered: { itemId: string; count: number };
  itemCrafted: { itemId: string };
  discoveryUnlocked: { id: string };
  tierChanged: { tier: Tier };
  /** Player picked another zoom step on the current microscope. */
  zoomChanged: { step: number };
  /** ui → world: point the player at the nearest source of this item (null = stop). */
  trackItem: { itemId: string | null };
  /** ui → guide: the player asked the guide a question. */
  guideAsked: { question: string };
  /** guide → ui: the guide's answer. */
  guideReplied: { text: string };
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
