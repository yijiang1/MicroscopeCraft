// Person A. The swap point for 3D → 2D tiles: any replacement must export the same mountWorld.
import type { GameContext } from '../shared/state';
import { mountOpenWorld } from './world';

export interface WorldHandle {
  dispose(): void;
}

/** Talks to the rest of the game only through ctx.bus and the actions in shared/state. */
export function mountWorld(el: HTMLElement, ctx: GameContext): WorldHandle {
  return mountOpenWorld(el, ctx);
}
