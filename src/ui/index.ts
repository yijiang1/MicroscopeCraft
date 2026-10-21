// Person D. Inventory, crafting, Microdex and guide box. Plain DOM; swap for anything.
import { canCraft, craft, type GameContext } from '../shared/state';

export interface UIHandle {
  dispose(): void;
}

export function mountUI(el: HTMLElement, ctx: GameContext): UIHandle {
  el.style.cssText += ';background:#000a;padding:8px;box-sizing:border-box';
  const inv = document.createElement('div');
  const dex = document.createElement('div');
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
  el.append(inv, dex, guide);

  const render = () => {
    const { state, data } = ctx;
    inv.replaceChildren();
    const h = document.createElement('h4');
    h.textContent = `Inventory · scope tier ${state.scope.tier}`;
    inv.append(h);
    for (const [id, n] of Object.entries(state.inventory)) {
      if (n > 0) inv.append(Object.assign(document.createElement('div'), { textContent: `${data.items[id]?.name ?? id} ×${n}` }));
    }
    const ch = document.createElement('h4');
    ch.textContent = 'Craft';
    inv.append(ch);
    for (const r of data.recipes) {
      const b = document.createElement('button');
      b.textContent = `${r.name} (${r.station})`;
      b.disabled = !canCraft(ctx, r.id);
      b.style.cssText = 'display:block;margin:2px 0;width:100%';
      b.onclick = () => craft(ctx, r.id);
      inv.append(b);
    }
    dex.replaceChildren(Object.assign(document.createElement('h4'), { textContent: 'Microdex' }));
    for (const id of state.discoveries) {
      const f = Object.values(data.samples).flatMap((s) => s.features).find((x) => x.id === id);
      dex.append(Object.assign(document.createElement('div'), { textContent: f ? `${f.name}: ${f.blurb}` : id }));
    }
  };
  render();
  const offs = [
    ctx.bus.on('itemGathered', render),
    ctx.bus.on('itemCrafted', render),
    ctx.bus.on('discoveryUnlocked', render),
    ctx.bus.on('guideReplied', ({ text }) => (reply.textContent = text)),
  ];
  return {
    dispose() {
      offs.forEach((off) => off());
      el.replaceChildren();
    },
  };
}
