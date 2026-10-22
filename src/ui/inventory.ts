// Inventory box: always visible bottom-right, so the player sees what they carry without opening the menu.
// Three groups: raw materials, crafted parts, microscopes (the one in use is marked). I collapses it. Owner: Person D.
import { ownedScopes, type GameContext } from '../shared/state';
import { itemIcon } from './icons';
import { withKeys } from './keys';

export interface InventoryHandle {
  /** The box, so the goal card above can take the height that is left. */
  el: HTMLElement;
  dispose(): void;
}

const el = (tag: string, css = '', text = '') => {
  const e = document.createElement(tag);
  e.style.cssText = css;
  withKeys(e, text);
  return e;
};

export function mountInventory(ctx: GameContext): InventoryHandle {
  const box = el(
    'div',
    'position:fixed;bottom:8px;right:calc(var(--panel-w, 0px) + 8px);z-index:15;width:min(310px,calc(100vw - 16px));max-height:34vh;overflow:auto;box-sizing:border-box;padding:6px 10px;border-radius:10px;background:#000c;color:#eee;font:13px system-ui',
  );
  document.body.append(box);
  let collapsed = false;

  const chip = (itemId: string, n: number, extra = '') => {
    const name = ctx.data.items[itemId]?.name ?? itemId;
    const c = el('span', 'display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0;white-space:nowrap');
    c.append(itemIcon(itemId, ctx.data, 18), `${name}${n > 1 ? ` ×${n}` : ''}${extra}`);
    return c;
  };

  const render = () => {
    const { inventory } = ctx.state;
    const have = Object.entries(inventory).filter(([, n]) => n > 0);
    const scopeIds = new Set(ownedScopes(inventory, ctx.data).map((r) => r.output.itemId));
    const group = (title: string, rows: HTMLElement[]) => {
      if (!rows.length) return;
      const list = el('div');
      list.append(...rows);
      box.append(el('div', 'margin-top:4px;font-size:11px;color:#9ab', title), list);
    };

    box.replaceChildren();
    const head = el('div', 'display:flex;gap:8px;align-items:center');
    head.append(el('b', 'flex:1', `Inventory${have.length ? ` · ${have.reduce((s, [, n]) => s + n, 0)} items` : ''}`));
    const toggle = el('button', '', collapsed ? '▸' : '▾');
    toggle.title = 'Show or hide the inventory (I)';
    toggle.onclick = () => {
      collapsed = !collapsed;
      render();
    };
    head.append(toggle);
    box.append(head);
    if (collapsed) return;
    if (ctx.state.economy.owned.includes('binoculars')) {
      const use=el('button','margin:4px 0;padding:7px 10px;border:1px solid #638b95;border-radius:7px;background:#203c47;color:#eef8f4;cursor:pointer','🔭 Binoculars · 4× · [B]');
      use.onclick=()=>ctx.bus.emit('toggleBinoculars',{});group('FIELD GEAR',[use]);
    }
    if (!have.length && !ctx.state.economy.owned.includes('binoculars')) return void box.append(el('div', 'color:#9ab;margin-top:4px', 'Empty. Gather materials with [E].'));

    const inUse = ctx.state.scope.tier;
    group('MATERIALS', have.filter(([id]) => ctx.data.materials[id]).map(([id, n]) => chip(id, n)));
    group('PARTS', have.filter(([id]) => !ctx.data.materials[id] && !scopeIds.has(id)).map(([id, n]) => chip(id, n)));
    group(
      'MICROSCOPES',
      ownedScopes(inventory, ctx.data).map((r) => chip(r.output.itemId, 1, r.scope.tier === inUse ? ' (in use)' : '')),
    );
  };
  render();

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.key.toLowerCase() === 'i') {
      collapsed = !collapsed;
      render();
    }
  };
  addEventListener('keydown', onKey);
  const offs = [
    ctx.bus.on('economyChanged', render),
    ctx.bus.on('itemGathered', render),
    ctx.bus.on('itemCrafted', render),
    ctx.bus.on('scopeChanged', render),
    ctx.bus.on('openEyepiece', () => (box.style.display = 'none')), // the eyepiece has its own controls
    ctx.bus.on('closeEyepiece', () => (box.style.display = '')),
  ];
  return {
    el: box,
    dispose() {
      offs.forEach((off) => off());
      removeEventListener('keydown', onKey);
      box.remove();
    },
  };
}
