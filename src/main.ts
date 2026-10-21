// Composition root: the only file that imports every module. Wires data → state → modules.
import { mountGuide } from './guide';
import { mountScope } from './scope';
import { createGame } from './shared/state';
import { loadGameData } from './shared/data';
import { mountUI } from './ui';
import { mountWorld } from './world';

const el = (id: string) => document.getElementById(id) as HTMLElement;

try {
  const ctx = createGame(loadGameData());
  mountWorld(el('world'), ctx);
  mountScope(el('scope'), ctx);
  mountUI(el('ui'), ctx);
  mountGuide(ctx);
  if (import.meta.env.DEV) (window as unknown as { game: typeof ctx }).game = ctx; // console: game.bus.emit(...)
} catch (e) {
  document.body.innerText = String(e);
}
