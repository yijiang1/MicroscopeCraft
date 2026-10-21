// Person D. Inventory, crafting, Microdex and guide box. Plain DOM; swap for anything.
import { canCraft, craft, type GameContext } from '../shared/state';
import { fmtUm } from '../shared/sim/walls';
import { mountGoal } from './goal';
import { mountMicrodex } from './microdex';
import { mountSound } from './sound';

export interface UIHandle {
  dispose(): void;
}

export function mountUI(el: HTMLElement, ctx: GameContext): UIHandle {
  el.style.cssText += ';background:#000a;padding:8px;box-sizing:border-box';
  // Side panel: collapsible, and collapsed by default on narrow windows where it would cover the world.
  const toggle = document.createElement('button');
  toggle.style.cssText = 'position:fixed;top:8px;right:8px;z-index:16;padding:2px 8px';
  const setPanel = (open: boolean) => {
    document.documentElement.style.setProperty('--panel-w', open ? 'min(260px, 85vw)' : '0px');
    el.style.display = open ? '' : 'none';
    toggle.textContent = open ? '✕' : '☰ Panel';
    toggle.title = open ? 'Hide the panel' : 'Show goals, crafting and the Microdex';
  };
  let panelOpen = innerWidth >= 700;
  toggle.onclick = () => setPanel((panelOpen = !panelOpen));
  document.body.append(toggle);
  setPanel(panelOpen);
  const goal = mountGoal(el, ctx);
  const inv = document.createElement('details');
  const dex = document.createElement('button');
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:30;padding:10px 18px;border-radius:8px;background:#1c3a1fee;color:#fff;font:15px system-ui;display:none;pointer-events:none';
  document.body.append(toast);
  let toastTimer = 0;
  const microdex = mountMicrodex(document.body, ctx);
  const sound = mountSound(ctx);
  const mute = document.createElement('button');
  mute.style.cssText = 'display:block;width:100%;margin:2px 0';
  const syncMute = () => (mute.textContent = sound.muted() ? 'Sound: off' : 'Sound: on');
  mute.onclick = () => {
    sound.toggleMute();
    syncMute();
  };
  syncMute();
  dex.style.cssText = 'display:block;width:100%;margin:8px 0';
  dex.onclick = () => microdex.toggle();
  const guide = document.createElement('div');
  const input = document.createElement('input');
  const reply = document.createElement('p');
  input.placeholder = 'Ask the guide…';
  input.style.cssText = 'width:100%;box-sizing:border-box';
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // typing must not trigger world/scope hotkeys
    if (e.key === 'Enter' && input.value.trim()) {
      ctx.bus.emit('guideAsked', { question: input.value.trim() });
      input.value = '';
    }
  });
  guide.append(input, reply);
  el.append(inv, dex, mute, guide);

  const render = () => {
    const { state, data } = ctx;
    inv.replaceChildren();
    const have = Object.entries(state.inventory).filter(([, n]) => n > 0);
    const sum = document.createElement('summary');
    sum.textContent = `Inventory and all recipes (tier ${state.scope.tier})`;
    sum.style.cssText = 'cursor:pointer;font-weight:600;margin:6px 0';
    inv.append(sum);
    inv.append(Object.assign(document.createElement('div'), { textContent: have.length ? have.map(([id, n]) => `${data.items[id]?.name ?? id} ×${n}`).join(', ') : 'Nothing yet' }));
    for (const r of data.recipes) {
      const b = document.createElement('button');
      b.textContent = `${r.name} (${r.station})`;
      b.title = `Uses ${r.inputs.map((x) => `${x.count} ${data.items[x.itemId]?.name ?? x.itemId}`).join(' + ')}`;
      b.disabled = !canCraft(ctx, r.id);
      b.style.cssText = 'display:block;margin:2px 0;width:100%';
      b.onclick = () => craft(ctx, r.id);
      inv.append(b);
    }
    dex.textContent = `Microdex (M) · ${microdex.summary()}`;
  };
  render();
  const offs = [
    ctx.bus.on('itemGathered', render),
    ctx.bus.on('itemCrafted', render),
    ctx.bus.on('discoveryUnlocked', ({ id }) => {
      render();
      const f = Object.values(ctx.data.samples).flatMap((x) => x.features).find((x) => x.id === id);
      toast.textContent = `New discovery: ${f?.name ?? id}${f ? ` (${fmtUm(f.sizeUm)})` : ''}. Open the Microdex (M)`;
      toast.style.display = 'block';
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toast.style.display = 'none'), 4000);
    }),
    ctx.bus.on('guideReplied', ({ text }) => (reply.textContent = text)),
  ];
  return {
    dispose() {
      offs.forEach((off) => off());
      toggle.remove();
      goal.dispose();
      microdex.dispose();
      sound.dispose();
      toast.remove();
      el.replaceChildren();
    },
  };
}
