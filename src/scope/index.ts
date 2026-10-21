// Person B. The 2D eyepiece. Opens on openEyepiece, closes on closeEyepiece or Esc.
import type { GameContext } from '../shared/state';
import { mountEyepiece } from './view';

export interface ScopeHandle {
  dispose(): void;
}

export function mountScope(el: HTMLElement, ctx: GameContext): ScopeHandle {
  return mountEyepiece(el, ctx);
}
