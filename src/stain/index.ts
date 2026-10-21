// The staining lab mini-game (DESIGN.md tier 4, "Contrast methods"). Opens with S in the eyepiece on a sample with
// clear cells; talks to the rest of the game only through ctx (stainSample + the sampleStained event).
import type { GameContext } from '../shared/state';
import { mountLab } from './lab';

export interface StainHandle {
  dispose(): void;
}

export function mountStain(el: HTMLElement, ctx: GameContext): StainHandle {
  return mountLab(el, ctx);
}
