// Person D. The goal card (always visible, keyboard-first), a menu panel (Tab) with inventory, every recipe and
// the guide, the Microdex (M), toasts and sound. Plain DOM; swap for anything.
import { canCraft, craft, type GameContext } from '../shared/state';
import { fmtUm } from '../shared/sim/walls';
import { mountGoal } from './goal';
import { mountMicrodex } from './microdex';
import { mountSound } from './sound';
import { createToast } from './toast';

export interface UIHandle {
  dispose(): void;
}

export function mountUI(el: HTMLElement, ctx: GameContext): UIHandle {
  const toast = createToast();
  const microdex = mountMicrodex(document.body, ctx);
  const sound = mountSound(ctx);

  // --- menu panel (hidden until Tab): inventory, every recipe, microdex button, sound, guide
  el.style.cssText += ';background:#000d;padding:8px;box-sizing:border-box;display:none';
  const inv = document.createElement('div');
  const dex = document.createElement('button');
  const mute = document.createElement('button');
  const guide = document.createElement('div');
  const input = document.createElement('input');
  const reply = document.createElement('p');
  dex.style.cssText = 'display:block;width:100%;margin:8px 0';
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
  el.append(title, inv, dex, mute, guide);

  let menuOpen = false;
  const setMenu = (open: boolean) => {
    menuOpen = open;
    el.style.display = open ? '' : 'none';
    document.documentElement.style.setProperty('--panel-w', open ? 'min(260px, 85vw)' : '0px');
    if (open) document.exitPointerLock?.(); // free the mouse so the menu can be clicked
  };
  const goal = mountGoal(ctx, toast, () => setMenu(!menuOpen));

  const render = () => {
    const { state, data } = ctx;
    inv.replaceChildren();
    const have = Object.entries(state.inventory).filter(([, n]) => n > 0);
    inv.append(Object.assign(document.createElement('div'), { textContent: have.length ? `You have: ${have.map(([id, n]) => `${data.items[id]?.name ?? id} ×${n}`).join(', ')}` : 'You have nothing yet.' }));
    const all = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'All recipes';
    sum.style.cssText = 'cursor:pointer;font-weight:600;margin:8px 0 4px';
    all.append(sum);
    for (const r of data.recipes) {
      const b = document.createElement('button');
      b.textContent = r.name;
      b.title = `Uses ${r.inputs.map((x) => `${x.count} ${data.items[x.itemId]?.name ?? x.itemId}`).join(' + ')}`;
      b.disabled = !canCraft(ctx, r.id);
      b.style.cssText = 'display:block;margin:2px 0;width:100%';
      b.onclick = () => craft(ctx, r.id);
      all.append(b);
    }
    inv.append(all);
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
      if (built) toast.notify(`You built the ${built.name}! Aim at something and press F to look closer.`, 6000, 3);
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
      microdex.dispose();
      sound.dispose();
      toast.dispose();
      el.replaceChildren();
    },
  };
}
