// Person B. The 2D eyepiece. Opens on openEyepiece, closes on closeEyepiece or Esc.
import type { GameContext } from '../shared/state';
import { mountStubScope } from './stub';

export interface ScopeHandle {
  dispose(): void;
}

export function mountScope(el: HTMLElement, ctx: GameContext): ScopeHandle {
  return mountStubScope(el, ctx);
}
