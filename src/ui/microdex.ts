// Microdex overlay: one card per discovery, grouped by biome. Press M or use the side-panel button.
import { microdex } from '../shared/microdex';
import { fmtUm } from '../shared/sim/walls';
import type { GameContext } from '../shared/state';

const BIOME_NAMES = {
  meadow: 'Quad', pond: 'Lake', forest: 'Pine grove', garden: 'Greenhouse', mine: 'Gorge and slope rocks', lab: 'Science lab', chess: 'Wilson Lab (CHESS)', eng: 'Engineering quad',
} as const;

export interface MicrodexHandle {
  toggle(): void;
  /** Found / total across unlocked biomes. */
  summary(): string;
  dispose(): void;
}

export function mountMicrodex(parent: HTMLElement, ctx: GameContext): MicrodexHandle {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:20;display:none;overflow:auto;background:#0b130bee;color:#eee;padding:24px 40px;box-sizing:border-box;font:14px system-ui';
  parent.appendChild(overlay);

  const styled = (tag: string, css: string, text = '') => {
    const e = document.createElement(tag);
    e.style.cssText = css;
    e.textContent = text;
    return e;
  };

  const render = () => {
    const dex = microdex(ctx.data, ctx.state);
    overlay.replaceChildren(styled('h2', 'margin:0 0 4px', `Microdex · ${summary()}`), styled('div', 'color:#9ab;margin-bottom:16px', 'Everything you have seen through your instruments. Click a card you have not found yet to track its sample. Press M or Esc to close.'));
    for (const b of dex) {
      const head = styled('h3', 'margin:20px 0 8px', `${BIOME_NAMES[b.biome]}${b.locked ? ' 🔒' : ` · ${b.found}/${b.cards.length}${b.complete ? ' ✓ complete' : ''}`}`);
      overlay.append(head);
      if (b.locked) {
        overlay.append(styled('div', 'color:#789', 'Not explored yet. Finish the open biomes and build better optics to get here.'));
        continue;
      }
      const grid = styled('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px');
      for (const c of b.cards) {
        const card = styled('div', `display:flex;gap:12px;padding:10px;border-radius:8px;background:${c.found ? '#1c3a1f' : '#161c16'};opacity:${c.found ? 1 : 0.7}`);
        const pic = c.snapshot
          ? Object.assign(document.createElement('img'), { src: c.snapshot, width: 96, height: 96 })
          : styled('div', 'width:96px;height:96px;display:flex;align-items:center;justify-content:center;font-size:32px;color:#456', '?');
        pic.style.cssText += ';border-radius:50%;flex:none;object-fit:cover';
        const text = styled('div', '');
        text.append(
          styled('b', '', c.found ? c.feature.name : '???'),
          styled('div', 'color:#9ab;font-size:12px', c.found ? `${fmtUm(c.feature.sizeUm)} · seen on ${c.sampleName}` : `Look closer at: ${c.sampleName}`),
          styled('div', 'margin-top:6px', c.found ? c.feature.blurb : 'Build a better instrument to see this.'),
        );
        card.append(pic, text);
        if (!c.found) {
          card.style.cursor = 'pointer';
          card.title = `Track: ${c.sampleName}`;
          card.onclick = () => {
            ctx.bus.emit('trackTarget', { target: { kind: 'sample', id: c.sampleId } });
            toggle();
          };
        }
        grid.append(card);
      }
      overlay.append(grid);
    }
  };

  const summary = () => {
    const open = microdex(ctx.data, ctx.state).filter((b) => !b.locked);
    return `${open.reduce((n, b) => n + b.found, 0)}/${open.reduce((n, b) => n + b.cards.length, 0)} discovered`;
  };

  const toggle = () => {
    const show = overlay.style.display === 'none';
    overlay.style.display = show ? 'block' : 'none';
    if (show) {
      document.exitPointerLock?.(); // free the mouse so the player can scroll
      render();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key.toLowerCase() === 'm') toggle();
    else if (e.key === 'Escape' && overlay.style.display === 'block') toggle();
  };
  addEventListener('keydown', onKey);
  const off = ctx.bus.on('discoveryUnlocked', () => overlay.style.display === 'block' && render());

  return {
    toggle,
    summary,
    dispose() {
      removeEventListener('keydown', onKey);
      off();
      overlay.remove();
    },
  };
}
