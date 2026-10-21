// Person D. The goal card (always visible, keyboard-first), a menu panel (Tab) with the guide, the tech tree (T),
// the Microdex (M), toasts and sound. Plain DOM; swap for anything.
import type { GameContext } from '../shared/state';
import { fmtUm } from '../shared/sim/walls';
import { mountGoal } from './goal';
import { mountInventory } from './inventory';
import { mountMicrodex } from './microdex';
import { mountSound } from './sound';
import { mountTechTree } from './techtree';
import { createToast } from './toast';

export interface UIHandle {
  dispose(): void;
}

export function mountUI(el: HTMLElement, ctx: GameContext): UIHandle {
  const toast = createToast();
  const microdex = mountMicrodex(document.body, ctx);
  const sound = mountSound(ctx);
  const inventory = mountInventory(ctx);
  const techTree = mountTechTree(document.body, ctx);

  // --- menu panel (hidden until Tab): tech tree and microdex buttons, sound, guide
  el.style.cssText += ';background:#000d;padding:8px;box-sizing:border-box;display:none';
  const tree = document.createElement('button');
  const dex = document.createElement('button');
  const mute = document.createElement('button');
  const guide = document.createElement('div');
  const input = document.createElement('input');
  const reply = document.createElement('p');
  tree.style.cssText = 'display:block;width:100%;margin:8px 0 2px';
  tree.textContent = 'Tech tree (T)';
  tree.onclick = () => techTree.toggle();
  dex.style.cssText = 'display:block;width:100%;margin:2px 0';
  dex.onclick = () => microdex.toggle();
  mute.style.cssText = 'display:block;width:100%;margin:2px 0';
  const syncMute = () => (mute.textContent = sound.muted() ? 'Sound: off' : 'Sound: on');
  mute.onclick = () => {
    sound.toggleMute();
    syncMute();
  };
  syncMute();
  input.placeholder = 'Ask the guide (try "where do I find sand?")';
  input.style.cssText = 'width:100%;box-sizing:border-box';
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // typing must not trigger world/scope/menu hotkeys
    if (e.key === 'Escape' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      input.blur();
      setMenu(false);
    } else if (e.key === 'Enter' && input.value.trim()) {
      ctx.bus.emit('guideAsked', { question: input.value.trim() });
      input.value = '';
    }
  });
  guide.append(input, reply);
  const title = document.createElement('h4');
  title.textContent = 'Menu (Tab to close)';
  title.style.margin = '4px 0 8px';
  el.append(title, tree, dex, mute, guide);

  let menuOpen = false;
  const setMenu = (open: boolean) => {
    menuOpen = open;
    el.style.display = open ? '' : 'none';
    document.documentElement.style.setProperty('--panel-w', open ? 'min(260px, 85vw)' : '0px');
    if (open) document.exitPointerLock?.(); // free the mouse so the menu can be clicked
  };
  const goal = mountGoal(ctx, toast, () => setMenu(!menuOpen));

  const render = () => {
    dex.textContent = `Microdex (M) · ${microdex.summary()}`;
  };
  render();

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      setMenu(!menuOpen);
    } else if (e.key.toLowerCase() === 'g' && !e.repeat) {
      e.preventDefault();
      setMenu(true);
      input.focus();
    }
  };
  addEventListener('keydown', onKey);

  const name = (id: string) => ctx.data.items[id]?.name ?? id;
  const offs = [
    ctx.bus.on('itemGathered', ({ itemId, count }) => {
      render();
      toast.notify(`+${count} ${name(itemId)}`, 1200);
    }),
    ctx.bus.on('itemCrafted', render),
    ctx.bus.on('tierChanged', ({ tier }) => {
      const built = ctx.data.recipes.find((r) => r.scope?.tier === tier);
      const how = tier >= 5
        ? 'It is installed in the lab of the science building (south-east): look (F) at a sample to take some, then carry it there.'
        : 'Aim at something and press F to look closer.';
      if (built) toast.notify(`You built the ${built.name}! ${how}`, 8000, 3);
    }),
    ctx.bus.on('discoveryUnlocked', ({ id }) => {
      render();
      const f = Object.values(ctx.data.samples).flatMap((x) => x.features).find((x) => x.id === id);
      toast.notify(`New discovery: ${f?.name ?? id}${f ? ` (${fmtUm(f.sizeUm)})` : ''}. Open the Microdex (M)`, 4000, 2);
    }),
    ctx.bus.on('guideReplied', ({ text }) => {
      reply.textContent = text;
      goal.say(text);
    }),
  ];
  return {
    dispose() {
      offs.forEach((off) => off());
      removeEventListener('keydown', onKey);
      goal.dispose();
      inventory.dispose();
      techTree.dispose();
      microdex.dispose();
      sound.dispose();
      toast.dispose();
      el.replaceChildren();
    },
  };
}
