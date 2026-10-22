import { prepareFish } from '../shared/fishing';
// Microdex overlay: one card per discovery, grouped by biome. Press M or use the side-panel button.
import { fishMicrodex, microdex } from '../shared/microdex';
import { fmtUm } from '../shared/sim/walls';
import type { GameContext } from '../shared/state';
import { withKeys } from './keys';

const BIOME_NAMES = {
  meadow: 'Quad', pond: 'Lake', forest: 'Pine grove', garden: 'Greenhouse', mine: 'Gorge and slope rocks', lab: 'Science lab', chess: 'Synchrotron Lab', eng: 'Engineering quad', museum: 'Art museum',
  north: 'North campus and the observatory', woods: 'North woods', orchard: 'Orchard and apiary', farm: 'Farm, dairy and cornfield',
  fields: 'Athletic fields', shore: 'West campus and the lake shore', quarry: 'Fossil quarry',
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
    withKeys(e, text);
    return e;
  };

  const render = () => {
    const dex = microdex(ctx.data, ctx.state);
    overlay.replaceChildren(styled('h2', 'margin:0 0 4px', `Microdex · ${summary()}`), styled('div', 'color:#9ab;margin-bottom:16px', 'Everything you have seen through your instruments. Click a card you have not found yet to track its sample. [M] or [Esc] closes.'));
    const fishCards = fishMicrodex(ctx.data, ctx.state);
    overlay.append(styled('h3', 'margin:20px 0 8px', `Fish collection · ${fishCards.filter(f => f.caught).length}/${fishCards.length} caught`));
    const fishGrid = styled('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px');
    for (const fish of fishCards) {
      const card = styled('div', 'padding:16px;border:1px solid #36535c;border-radius:12px;background:#142b34');
      const portrait = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      portrait.setAttribute('viewBox', '0 0 240 100');
      portrait.setAttribute('role', 'img');
      portrait.setAttribute('aria-label', fish.name);
      portrait.style.cssText = `width:100%;height:85px;opacity:${fish.caught ? 1 : .25}`;
      portrait.innerHTML = `<path d="M170 50L218 18V82Z" fill="${fish.color}"/><ellipse cx="111" cy="50" rx="76" ry="32" fill="${fish.color}"/><path d="M98 23L120 4L143 24" fill="${fish.color}"/><circle cx="57" cy="43" r="6" fill="#102332"/>`;
      card.append(portrait, styled('b', 'display:block', fish.name), styled('p', 'color:#b2c9ce', fish.caught ? `${fish.stock} in collection · ${fish.found}/${fish.total} microscopic features discovered` : 'Not caught yet · Fish near the lake or creek with your fishing rod.'));
      if (fish.stock > 0 && !fish.prepared) {
        const prepare = styled('button', 'padding:8px;cursor:pointer', 'Prepare scale sample');
        prepare.onclick = () => { prepareFish(ctx, fish.id); };
        card.append(prepare);
      }
      if (fish.prepared) {
        const view = styled('button', 'padding:8px;cursor:pointer', 'View scale sample');
        view.onclick = () => { toggle(); ctx.bus.emit('openEyepiece', { sampleId: fish.sampleId }); };
        card.append(view);
      }
      fishGrid.append(card);
    }
    overlay.append(fishGrid);
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
          styled('div', 'margin-top:6px', c.found ? c.feature.blurb : c.sampleId.startsWith('fish_') ? 'Catch this fish and prepare its scale in the Fish collection above, then examine it with your instruments.' : 'Build a better instrument to see this.'),
        );
        card.append(pic, text);
        if (!c.found && !c.sampleId.startsWith('fish_')) {
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

  const offFish = ctx.bus.on('economyChanged', () => overlay.style.display === 'block' && render());

  return {
    toggle,
    summary,
    dispose() {
      removeEventListener('keydown', onKey);
      off();
      offFish();
      overlay.remove();
    },
  };
}
