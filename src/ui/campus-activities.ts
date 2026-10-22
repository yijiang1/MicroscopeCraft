import { storePreview } from './store-preview';
import { equip, purchase, SPECIMEN_IDS, storeCatalog, type StoreItem } from '../shared/economy';
import { recordScore, type GameContext } from '../shared/state';
import type { Toast } from './toast';

const text = (tag: string, content: string) => Object.assign(document.createElement(tag), { textContent: content });
/** A training console: why it is still locked (null once the player has its instrument), and how to open it. */
export type TrainingGames = Record<string, { locked: () => string | null; open: (host: HTMLElement, done: () => void) => () => void }>;
export function mountCampusActivities(ctx: GameContext, toast: Toast, training: TrainingGames) {
  const modal = document.createElement('dialog');
  modal.setAttribute('aria-label', 'Campus activities');
  modal.style.cssText = 'width:min(1040px,94vw);height:min(820px,90vh);box-sizing:border-box;border:1px solid #68818b;border-radius:14px;background:#102129;color:#e8f2ee;padding:16px;font:14px system-ui';
  const style = document.createElement('style');
  style.textContent = '.campus-modal::backdrop{background:#0009}.campus-modal button{cursor:pointer;padding:7px 12px;margin:3px;border:1px solid #79908e;border-radius:7px;background:#253c44;color:#fff}.campus-modal button:disabled{opacity:.45;cursor:default}.campus-modal article{padding:12px;background:#ffffff09;border-radius:9px}.campus-modal h3{margin:0 0 8px}.campus-modal p{line-height:1.5}.campus-modal iframe{width:100%;height:calc(100% - 12px);border:0;border-radius:8px;background:#101818}';
  modal.className = 'campus-modal';
  document.body.append(style, modal);
  const header = document.createElement('header'); header.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap';
  const title = text('h2', ''); title.style.cssText = 'flex:1;margin:0;font-size:20px';
  const balance = text('span', ''); balance.setAttribute('aria-live', 'polite');
  const content = document.createElement('div'); content.style.cssText = 'height:calc(100% - 86px);overflow:auto;margin-top:12px';
  const button = (label: string, fn: () => void) => { const b = text('button', label) as HTMLButtonElement; b.onclick = fn; return b; };
  const result = text('span', ''); result.setAttribute('aria-live', 'polite'); result.style.cssText = 'flex-basis:100%;color:#b6e9aa;font-size:12px';
  const closeButton = button('Close ×', () => modal.close());
  header.append(title, balance, closeButton, result); modal.append(header, content);
  let cleanup: (() => void) | null = null;
  let iframe: HTMLIFrameElement | null = null;
  let activity = '';
  const clear = () => { result.textContent = ''; cleanup?.(); cleanup = null; iframe = null; content.replaceChildren(); };
  const sync = () => { balance.textContent = `${ctx.state.economy.coins} coins · ${ctx.state.economy.vouchers} voucher${ctx.state.economy.vouchers === 1 ? '' : 's'}`; };
  modal.addEventListener('keydown', e => e.stopPropagation());
  modal.addEventListener('close', () => { clear(); activity = ''; ctx.bus.emit('campusActivityChanged', { open: false }); });
  const shop = () => {
    clear(); title.textContent = 'ScopeCraft Store · Microscope House';
    content.append(text('p', 'Earn coins and vouchers in campus mini-games. Purchases and outfits are saved automatically. Books are readable in-game souvenirs.'));
    content.append(button('Wear original blue shirt', () => { equip(ctx, 'shirt_blue'); shop(); }));
    const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:10px';
    const itemCard = (item: StoreItem, expanded = false) => {
      const card = document.createElement('article');
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.setAttribute('aria-label', `Enlarge preview: ${item.name}`);
      preview.style.cssText = `display:block;width:100%;height:${expanded ? 260 : 140}px;padding:0;margin:0 0 12px;border:1px solid #a2c8bd26;border-radius:8px;background:radial-gradient(ellipse at 50% 40%,#33585b,#1c333e);cursor:${expanded ? 'default' : 'zoom-in'}`;
      preview.append(storePreview(item));
      if (expanded) {
        card.style.cssText = 'max-width:460px;margin:0 auto';
        preview.disabled = true; preview.style.opacity = '1';
      } else preview.onclick = () => {
        clear(); content.append(button('← Store & collection', shop), itemCard(item, true));
      };
      card.append(preview, text('h3', item.name));
      const owned = ctx.state.economy.owned.includes(item.id);
      if (owned) {
        if (item.kind === 'book') card.append(button('Read', () => {
          clear(); content.append(button('← Store & collection', shop), text('h2', item.name));
          const body = text('p', item.text); body.style.whiteSpace = 'pre-line'; content.append(body);
        }));
        else if (item.kind === 'tool') card.append(text('p', item.id === 'binoculars' ? 'Acquired · Press B to use binoculars' : 'Acquired · Approach water to fish'));
        else if (item.kind === 'car') card.append(text('p', 'Owned · Unlimited campus drives'));
        else {
          const e = ctx.state.economy;
          const worn = item.id === 'backpack' ? e.backpack : item.id === 'model' ? e.model : item.id === `shirt_${e.shirt}`;
          card.append(text('p', worn ? 'Equipped · press V in the world to see it' : 'Owned'));
          card.append(button(worn && item.kind !== 'shirt' ? 'Remove' : 'Equip', () => { equip(ctx, item.id); shop(); }));
        }
      } else {
        card.append(text('p', item.kind === 'book' ? 'A readable addition to your campus collection.' : item.text));
        for (const currency of (item.price === 0 ? ['coins'] as const : ['coins', 'vouchers'] as const)) {
          const cost = currency === 'coins' ? item.price : Math.ceil(item.price / 25);
          const b = button(item.price === 0 ? 'Get free rod · 0 coins' : `Buy · ${cost} ${cost === 1 ? currency.slice(0, -1) : currency}`, () => { if (purchase(ctx, item.id, currency)) { toast.notify(`Purchased ${item.name}`); shop(); } });
          b.disabled = ctx.state.economy[currency] < cost; card.append(b);
        }
      }
      if (item.kind === 'car') card.append(button(owned ? 'Drive your Micro Roadster' : 'Test drive · 30 seconds · Free', () => {
        modal.close(); ctx.bus.emit('campusActivityChanged', { open: false }); ctx.bus.emit('driveMiata', { trial: !owned });
      }));
      return card;
    };
    for (const item of storeCatalog(ctx.data)) grid.append(itemCard(item));
    content.append(grid); sync();
  };
  const games = (location: 'lab' | 'chess') => {
    clear(); title.textContent = location === 'lab' ? 'Science Building · Field Lab' : 'Wilson Lab · CHESS Challenges';
    content.append(text('p', 'Earn 10 coins at each new 20% score milestone, plus 1 voucher at 80%. Each milestone pays once per game. Replays let you improve your score. Each console opens once you have built the instrument it trains on.'));
    const launch = (name: string, run: () => (() => void), locked: string | null = null) => {
      const b = button(locked ? `${name} · ${locked}` : name, () => {
        clear(); title.textContent = name; content.append(button('← Activities', () => games(location)));
        const help = text('p', 'Submit your result using Record / Finish. New score milestones award coins automatically.'); content.append(help);
        cleanup = run();
      });
      b.disabled = !!locked; content.append(b);
    };
    const trainer = (name: string, id: string) => launch(name, () => training[id]!.open(content, () => games(location)), training[id]!.locked());
    if (location === 'lab') {
      launch('The Invisible Specimen', () => {
        content.replaceChildren();
        iframe = document.createElement('iframe'); iframe.title = 'The Invisible Specimen';
        iframe.src = `${import.meta.env.BASE_URL}minigames/invisible-specimen/index.html?embedded=1`;
        content.append(iframe);
        return () => iframe?.remove();
      });
      trainer('Köhler illumination', 'koehler');
      trainer('Gram staining', 'gram');
      trainer('Stain timing', 'soak');
      trainer('TEM alignment', 'tem');
      trainer('Aberration correction', 'corrector');
      trainer('Electron ptychography', 'ptycho');
    } else {
      trainer('Beam tuning', 'beam');
      trainer('Tomography', 'tomo');
    }
  };
  const open = (where: 'store' | 'lab' | 'chess') => {
    activity = where; document.exitPointerLock?.();
    ctx.bus.emit('campusActivityChanged', { open: true });
    if (!modal.open) modal.showModal();
    sync(); if (where === 'store') shop(); else games(where);
  };
  const message = (event: MessageEvent) => {
    if (!modal.open || activity !== 'lab' || !iframe || event.source !== iframe.contentWindow || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.type !== 'microscopecraft:specimen' || !SPECIMEN_IDS.includes(data.specimen)) return;
    recordScore(ctx, `invisible_${data.specimen}`, 1);
  };
  addEventListener('message', message);
  const offs = [ctx.bus.on('openCampusActivity', ({ activity }) => open(activity)), ctx.bus.on('economyChanged', sync), ctx.bus.on('rewardEarned', ({ coins, vouchers }) => { result.textContent = `Reward: +${coins} coins${vouchers ? ` · +${vouchers} voucher` : ''}`; toast.notify(result.textContent, 3200, 2); })];
  return { open, dispose() { clear(); offs.forEach(off => off()); removeEventListener('message', message); modal.remove(); style.remove(); } };
}
