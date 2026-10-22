// Person D. The goal card (always visible, keyboard-first), a menu panel (Tab), the tech tree (T),
// the Microdex (M), toasts and sound. Plain DOM; swap for anything.
import { SAVE_KEY, toSave, type GameContext } from '../shared/state';
import { fmtUm } from '../shared/sim/walls';
import { allAchievements } from '../shared/achievements';
import { mountDialog } from './dialog';
import { mountGoal } from './goal';
import { mountInventory } from './inventory';
import { mountJournal } from './journal';
import { mountMicrodex } from './microdex';
import { getGeminiKey, setGeminiKey } from './npcChat';
import { mountSound } from './sound';
import { mountTechTree } from './techtree';
import { createToast } from './toast';
import { mountTutorial, TUTORIAL_KEY } from './tutorial';

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
  const tutorial = mountTutorial(ctx);

  // --- menu panel (hidden until Tab): one icon row per action, key hint on the right
  el.style.cssText += ';background:#101418ee;padding:10px;box-sizing:border-box;display:none;font:14px system-ui,sans-serif;color:#e8eef2';
  const css = document.createElement('style');
  css.textContent = `
    .mc-menu-row{display:flex;align-items:center;gap:10px;width:100%;margin:3px 0;padding:8px 10px;border:1px solid #ffffff1a;border-radius:8px;background:#ffffff0d;color:inherit;font:inherit;text-align:left;cursor:pointer}
    .mc-menu-row:hover,.mc-menu-row:focus-visible{background:#ffffff24;outline:none}
    .mc-menu-row .ic{font-size:18px;width:22px;text-align:center}
    .mc-menu-row .lb{flex:1;display:flex;flex-direction:column;line-height:1.2}
    .mc-menu-row .sub{font-size:11px;opacity:.6}
    .mc-menu-row kbd{font:11px ui-monospace,monospace;padding:1px 6px;border:1px solid #ffffff40;border-radius:4px;opacity:.7}
    .mc-menu-row.danger{color:#ff9a8a}
    .mc-menu-sep{height:1px;background:#ffffff1f;margin:8px 2px}
    .mc-menu-h{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.55;margin:4px 2px 2px}
    .mc-menu-form{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 6px;padding:8px 10px;border-radius:8px;background:#ffffff0a;font-size:12px}
    .mc-menu-form input{flex:1;min-width:0}
    .mc-menu-form p{flex-basis:100%;margin:0;opacity:.65;line-height:1.35}
    .mc-menu-form a{color:#8fc8f0}`;
  const row = (icon: string, label: string, onclick: () => void, key = '') => {
    const b = document.createElement('button');
    b.className = 'mc-menu-row';
    b.innerHTML = `<span class="ic">${icon}</span><span class="lb"><span></span><span class="sub"></span></span>${key ? `<kbd>${key}</kbd>` : ''}`;
    const [main, sub] = b.querySelectorAll<HTMLSpanElement>('.lb span') as unknown as [HTMLSpanElement, HTMLSpanElement];
    main.textContent = label;
    b.onclick = onclick;
    return { b, set: (text: string, detail = '') => ((main.textContent = text), (sub.textContent = detail)) };
  };
  const sep = () => Object.assign(document.createElement('div'), { className: 'mc-menu-sep' });
  const tree = row('🌳', 'Tech tree', () => techTree.toggle(), 'T');
  const dex = row('🔬', 'Microdex', () => microdex.toggle(), 'M');
  const journalBtn = row('📓', 'Journal', () => journal.toggle(), 'J');
  const refsBtn = row('📚', 'References', () => journal.toggle('references'));
  const tutorialBtn = row('🎓', 'Tutorial', () => {
    setMenu(false);
    tutorial.replay();
  });
  const mute = row('', 'Sound', () => {
    sound.toggleMute();
    syncMute();
  // --- Gemini API key for chatting with scientists: the player's own, kept only in this browser
  const keyForm = document.createElement('div');
  keyForm.className = 'mc-menu-form';
  keyForm.hidden = true;
  const keyInput = Object.assign(document.createElement('input'), { type: 'password', placeholder: 'Paste your Gemini API key', autocomplete: 'off' });
  const keySave = Object.assign(document.createElement('button'), { textContent: 'Save' });
  const keyClear = Object.assign(document.createElement('button'), { textContent: 'Clear' });
  const keyNote = document.createElement('p');
  keyNote.innerHTML = 'Lets you chat with the scientists. The key stays in this browser and is sent only to Google. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Get a key</a>';
  keyForm.append(keyInput, keySave, keyClear, keyNote);
  const keyRow = row('🔑', 'Gemini API key', () => {
    keyForm.hidden = !keyForm.hidden;
    if (!keyForm.hidden) keyInput.focus();
  });
  const syncKey = () => keyRow.set('Gemini API key', getGeminiKey() ? 'Set · chat with scientists is on' : 'Not set · needed to chat with scientists');
  const saveKey = (key: string | null) => {
    setGeminiKey(key);
    keyInput.value = '';
    keyForm.hidden = true;
    syncKey();
    toast.notify(key ? 'Gemini key saved' : 'Gemini key cleared', 1600);
  };
  keySave.onclick = () => keyInput.value.trim() && saveKey(keyInput.value.trim());
  keyClear.onclick = () => saveKey(null);
  keyInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // typing must not trigger world/menu hotkeys
    if (e.key === 'Enter' && keyInput.value.trim()) saveKey(keyInput.value.trim());
    else if (e.key === 'Escape') keyForm.hidden = true;
  });
  syncKey();
  });
  const syncMute = () => {
    mute.b.querySelector('.ic')!.textContent = sound.muted() ? '🔇' : '🔊';
    mute.set(sound.muted() ? 'Sound off' : 'Sound on');
  };
  syncMute();
  // --- Gemini API key for chatting with scientists: the player's own, kept only in this browser
  const keyForm = document.createElement('div');
  keyForm.className = 'mc-menu-form';
  keyForm.hidden = true;
  const keyInput = Object.assign(document.createElement('input'), { type: 'password', placeholder: 'Paste your Gemini API key', autocomplete: 'off' });
  const keySave = Object.assign(document.createElement('button'), { textContent: 'Save' });
  const keyClear = Object.assign(document.createElement('button'), { textContent: 'Clear' });
  const keyNote = document.createElement('p');
  keyNote.innerHTML = 'Lets you chat with the scientists. The key stays in this browser and is sent only to Google. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Get a key</a>';
  keyForm.append(keyInput, keySave, keyClear, keyNote);
  const keyRow = row('🔑', 'Gemini API key', () => {
    keyForm.hidden = !keyForm.hidden;
    if (!keyForm.hidden) keyInput.focus();
  });
  const syncKey = () => keyRow.set('Gemini API key', getGeminiKey() ? 'Set · chat with scientists is on' : 'Not set · needed to chat with scientists');
  const saveKey = (key: string | null) => {
    setGeminiKey(key);
    keyInput.value = '';
    keyForm.hidden = true;
    syncKey();
    toast.notify(key ? 'Gemini key saved' : 'Gemini key cleared', 1600);
  };
  keySave.onclick = () => keyInput.value.trim() && saveKey(keyInput.value.trim());
  keyClear.onclick = () => saveKey(null);
  keyInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // typing must not trigger world/menu hotkeys
    if (e.key === 'Enter' && keyInput.value.trim()) saveKey(keyInput.value.trim());
    else if (e.key === 'Escape') keyForm.hidden = true;
  });
  syncKey();
  // --- save (also automatic after every change and on leaving the page) and restart
  let resetting = false;
  let travelSave = 0;
  const save = (): boolean => {
    clearTimeout(travelSave);
    travelSave = 0;
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
  const saveBtn = row('💾', 'Save game', () => toast.notify(save() ? 'Game saved' : 'Could not save (browser storage blocked)', 1600, 2));
  const restart = row('↺', 'Restart game', () => {
    if (!confirm('Restart from scratch? Your inventory, microscopes and Microdex will be erased.')) return;
    resetting = true;
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(TUTORIAL_KEY);
    } catch {
      /* nothing saved */
    }
    location.reload();
  });
  restart.b.classList.add('danger');
  addEventListener('pagehide', save);
  const saveWhenHidden = () => { if (document.hidden) save(); };
  document.addEventListener('visibilitychange', saveWhenHidden);
  const title = document.createElement('h4');
  title.innerHTML = 'Menu <kbd style="font:11px ui-monospace,monospace;opacity:.6">Tab</kbd>';
  title.style.margin = '2px 2px 10px';
  const heading = (text: string) => Object.assign(document.createElement('div'), { className: 'mc-menu-h', textContent: text });
  el.append(css, title, tree.b, dex.b, journalBtn.b, refsBtn.b, sep(), heading('Settings'), mute.b, keyRow.b, keyForm, sep(), tutorialBtn.b, saveBtn.b, restart.b);

  let menuOpen = false;
  const setMenu = (open: boolean) => {
    menuOpen = open;
    el.style.display = open ? '' : 'none';
    document.documentElement.style.setProperty('--panel-w', open ? 'min(260px, 85vw)' : '0px');
    if (open) document.exitPointerLock?.(); // free the mouse so the menu can be clicked
  };
  const goal = mountGoal(ctx, toast, () => setMenu(!menuOpen), inventory.el);

  const render = () => {
    dex.set('Microdex', microdex.summary());
    journalBtn.set('Journal', journal.summary());
  };
  render();

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      setMenu(!menuOpen);
    }
  };
  addEventListener('keydown', onKey);

  const name = (id: string) => ctx.data.items[id]?.name ?? id;
  const offs = [
    ctx.bus.on('playerMoved', () => {
      if (!travelSave) travelSave = window.setTimeout(save, 5000);
    }),
    ctx.bus.on('carriedSamplesChanged', save),
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
    ctx.bus.on('guideReplied', ({ text }) => goal.say(text)),
  ];
  return {
    dispose() {
      offs.forEach((off) => off());
      removeEventListener('keydown', onKey);
      removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', saveWhenHidden);
      clearTimeout(travelSave);
      goal.dispose();
      journal.dispose();
      closeDialog();
      tutorial.dispose();
      inventory.dispose();
      techTree.dispose();
      microdex.dispose();
      sound.dispose();
      toast.dispose();
      el.replaceChildren();
    },
  };
}
