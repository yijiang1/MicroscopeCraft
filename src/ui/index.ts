// Person D. The goal card (always visible, keyboard-first), a menu panel (Tab) with the guide, the tech tree (T),
// the Microdex (M), toasts and sound. Plain DOM; swap for anything.
import { SAVE_KEY, toSave, type GameContext } from '../shared/state';
import { fmtUm } from '../shared/sim/walls';
import { allAchievements } from '../shared/achievements';
import { mountDialog } from './dialog';
import { mountGoal } from './goal';
import { mountInventory } from './inventory';
import { mountJournal } from './journal';
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
  const journal = mountJournal(document.body, ctx);
  const closeDialog = mountDialog(ctx, toast);

  // --- menu panel (hidden until Tab): tech tree and microdex buttons, sound, guide
  el.style.cssText += ';background:#000d;padding:8px;box-sizing:border-box;display:none';
  const tree = document.createElement('button');
  const dex = document.createElement('button');
  const journalBtn = document.createElement('button');
  const mute = document.createElement('button');
  const guide = document.createElement('div');
  const input = document.createElement('input');
  const reply = document.createElement('p');
  tree.style.cssText = 'display:block;width:100%;margin:8px 0 2px';
  tree.textContent = 'Tech tree (T)';
  tree.onclick = () => techTree.toggle();
  dex.style.cssText = 'display:block;width:100%;margin:2px 0';
  dex.onclick = () => microdex.toggle();
  journalBtn.style.cssText = 'display:block;width:100%;margin:2px 0';
  journalBtn.onclick = () => journal.toggle();
  const refsBtn = document.createElement('button');
  refsBtn.style.cssText = 'display:block;width:100%;margin:2px 0';
  refsBtn.textContent = 'References';
  refsBtn.onclick = () => journal.toggle('references');
  mute.style.cssText = 'display:block;width:100%;margin:2px 0';
  const syncMute = () => (mute.textContent = sound.muted() ? 'Sound: off' : 'Sound: on');
  mute.onclick = () => {
    sound.toggleMute();
    syncMute();
  };
  syncMute();
  // --- save (also automatic after every change and on leaving the page) and restart
  const saveBtn = document.createElement('button');
  const restart = document.createElement('button');
  saveBtn.style.cssText = restart.style.cssText = 'display:block;width:100%;margin:2px 0';
  saveBtn.textContent = 'Save game';
  restart.textContent = 'Restart game';
  let resetting = false;
  const save = (): boolean => {
    if (resetting) return false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(toSave(ctx.state)));
    } catch {
      // ponytail: quota full (snapshots are images) → keep progress, drop the pictures
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ ...toSave(ctx.state), snapshots: {} }));
      } catch {
        return false;
      }
    }
    return true;
  };
  saveBtn.onclick = () => toast.notify(save() ? 'Game saved' : 'Could not save (browser storage blocked)', 1600, 2);
  restart.onclick = () => {
    if (!confirm('Restart from scratch? Your inventory, microscopes and Microdex will be erased.')) return;
    resetting = true;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* nothing saved */
    }
    location.reload();
  };
  addEventListener('pagehide', save);
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
  el.append(title, tree, dex, journalBtn, refsBtn, mute, saveBtn, restart, guide);

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
    journalBtn.textContent = `Journal (J) · ${journal.summary()}`;
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
    ...(['itemGathered', 'itemCrafted', 'discoveryUnlocked', 'scopeChanged', 'questCompleted', 'achievementUnlocked', 'minigameScored', 'areaVisited', 'closeEyepiece'] as const).map((t) => ctx.bus.on(t, save)),
    ctx.bus.on('itemGathered',({ itemId, count }) => {
      render();
      toast.notify(`+${count} ${name(itemId)}`, 1200);
    }),
    ctx.bus.on('itemCrafted', render),
    ctx.bus.on('tierChanged', ({ tier }) => {
      const built = ctx.data.recipes.find((r) => r.scope?.tier === tier);
      const how = built?.scope?.site === 'chess'
        ? 'It is in the CHESS hall of Wilson Lab (east of campus): look (F) at a sample to take some, then carry it there and press F at the control desk.'
        : built?.scope?.site
        ? 'It is installed in the lab of the science building (south-east): look (F) at a sample to take some, then carry it there.'
        : tier === 4
        ? 'Aim at something and press F; switch to fluorescence in the eyepiece. Phase contrast and dark field are add-ons you can build next.'
        : 'Aim at something and press F to look closer.';
      if (built) toast.notify(`You built the ${built.name}! ${how}`, 8000, 3);
    }),
    ctx.bus.on('achievementUnlocked', ({ id }) => {
      render();
      const a = allAchievements(ctx.data).find((x) => x.id === id);
      if (a) toast.notify(`🏆 Achievement: ${a.name}`, 3500, 3);
    }),
    ctx.bus.on('questCompleted', () => render()),
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
      removeEventListener('pagehide', save);
      goal.dispose();
      journal.dispose();
      closeDialog();
      inventory.dispose();
      techTree.dispose();
      microdex.dispose();
      sound.dispose();
      toast.dispose();
      el.replaceChildren();
    },
  };
}
