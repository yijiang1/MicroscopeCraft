// Composition root: the only file that imports every module. Wires data → state → modules.
import { mountGuide } from './guide';
import { mountScope } from './scope';
import { createGame, gather, parseSave, SAVE_KEY, SNAPSHOTS_KEY } from './shared/state';
import { loadGameData } from './shared/data';
import { mountUI } from './ui';
import { mountWorkbench } from './workbench';
import { mountWorld } from './world';

const el = (id: string) => document.getElementById(id) as HTMLElement;

try {
  let saved = null;
  try {
    saved = parseSave(localStorage.getItem(SAVE_KEY), localStorage.getItem(SNAPSHOTS_KEY));
  } catch {
    /* storage blocked: start fresh */
  }
  const ctx = createGame(loadGameData(), undefined, saved);
  mountWorld(el('world'), ctx);
  mountScope(el('scope'), ctx);
  mountUI(el('ui'), ctx);
  mountWorkbench(el('workbench'), ctx);
  mountGuide(ctx);
  // Demo mode (?demo): press K to restock every raw material, so a live demo can skip repeat gathering.
  if (new URLSearchParams(location.search).has('demo')) {
    addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'k' && (e.target as HTMLElement).tagName !== 'INPUT') {
        for (const id of Object.keys(ctx.data.materials)) gather(ctx, id, 10);
      }
    });
  }
  if (import.meta.env.DEV) (window as unknown as { game: typeof ctx }).game = ctx; // console: game.bus.emit(...)
} catch (e) {
  document.body.innerText = String(e);
}
