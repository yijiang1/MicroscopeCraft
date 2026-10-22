// The journal (J): achievements with progress, every scientist's requests with where to look, and the references.
// Owner: Person D.
import { allAchievements, conditionMet, progress } from '../shared/achievements';
import { findFeature } from '../shared/plan';
import type { Quest } from '../shared/schema';
import type { GameContext } from '../shared/state';
import { REFERENCES } from './references';
import { withKeys } from './keys';

type Tab = 'achievements' | 'scientists' | 'references';

export interface JournalHandle {
  toggle(tab?: Tab): void;
  summary(): string;
  dispose(): void;
}

const styled = (tag: string, css: string, text = '') => {
  const e = document.createElement(tag);
  e.style.cssText = css;
  withKeys(e, text);
  return e;
};

/** Where to point the player for a request: the sample holding the first discovery still missing, else the scientist. */
export function questTarget(ctx: GameContext, npcId: string, quest: Quest): { kind: 'sample' | 'npc'; id: string } {
  const missing = quest.needs.discovered?.find((id) => !ctx.state.discoveries.includes(id));
  const found = missing ? findFeature(ctx.data, missing) : null;
  return found ? { kind: 'sample', id: found.sample.id } : { kind: 'npc', id: npcId };
}

export function mountJournal(parent: HTMLElement, ctx: GameContext): JournalHandle {
  const overlay = styled('div', 'position:fixed;inset:0;z-index:20;display:none;overflow:auto;background:#141020ee;color:#eee;padding:24px 40px;box-sizing:border-box;font:14px system-ui');
  parent.append(overlay);
  let tab: Tab = 'achievements';

  const counts = () => {
    const all = allAchievements(ctx.data);
    const quests = Object.values(ctx.data.npcs).reduce((n, npc) => n + npc.quests.length, 0);
    return { got: ctx.state.achievements.length, all: all.length, done: ctx.state.quests.length, quests };
  };
  const summary = () => {
    const c = counts();
    return `${c.got}/${c.all} achievements`;
  };

  const track = (target: { kind: 'sample' | 'npc'; id: string }) => {
    ctx.bus.emit('trackTarget', { target });
    toggle();
  };

  const renderAchievements = () => {
    const grid = styled('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px');
    for (const a of ctx.data.achievements) {
      const got = ctx.state.achievements.includes(a.id);
      const p = progress(a.when, ctx.data, ctx.state);
      const card = styled('div', `padding:10px 12px;border-radius:8px;background:${got ? '#3a2f12' : '#1d1a26'};border:1px solid ${got ? '#c9a23a' : '#2c2838'}`);
      card.append(
        styled('div', `font-weight:700;color:${got ? '#ffd24a' : '#bbb'}`, `${got ? '🏆' : '🔒'} ${a.name}`),
        styled('div', 'color:#aab;font-size:12px;margin-top:3px', a.description),
      );
      if (!got && p.total > 1) {
        const bar = styled('div', 'margin-top:6px;height:5px;border-radius:3px;background:#2c2838;overflow:hidden');
        bar.append(styled('div', `height:100%;width:${(100 * p.done) / p.total}%;background:#8a7aff`));
        card.append(bar, styled('div', 'font-size:11px;color:#889;margin-top:2px', `${p.done} / ${p.total}`));
      }
      grid.append(card);
    }
    return grid;
  };

  const renderScientists = () => {
    const list = styled('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px');
    for (const npc of Object.values(ctx.data.npcs)) {
      const done = npc.quests.filter((q) => ctx.state.quests.includes(q.id)).length;
      const card = styled('div', 'padding:10px 12px;border-radius:8px;background:#1d1a26;border:1px solid #2c2838');
      const head = styled('div', 'display:flex;gap:8px;align-items:baseline');
      head.append(styled('b', 'flex:1;font-size:15px', `${npc.name}`), styled('span', 'color:#889;font-size:12px', `${npc.years} · ${done}/${npc.quests.length}`));
      const find = styled('button', 'font-size:11px', 'Find');
      find.onclick = () => track({ kind: 'npc', id: npc.id });
      head.append(find);
      card.append(head, styled('div', 'color:#aab;font-size:12px;margin:2px 0 6px', npc.role));
      for (const q of npc.quests) {
        const isDone = ctx.state.quests.includes(q.id);
        const ready = !isDone && conditionMet(q.needs, ctx.data, ctx.state);
        const row = styled('div', 'display:flex;gap:6px;align-items:flex-start;margin:4px 0');
        const text = styled('div', 'flex:1');
        text.append(
          styled('div', `font-weight:600;color:${isDone ? '#9be59b' : ready ? '#ffd24a' : '#ddd'}`, `${isDone ? '✓' : ready ? '★' : '•'} ${q.title}`),
          styled('div', 'font-size:12px;color:#aab', isDone ? q.thanks : ready ? `Ready! Talk to ${npc.name.split(' ').at(-1)} [E] to show it.` : q.ask),
        );
        if (!isDone && !ready) text.append(styled('div', 'font-size:12px;color:#8fb8d8;margin-top:1px', q.hint));
        row.append(text);
        if (!isDone) {
          const b = styled('button', 'font-size:11px;flex:none', ready ? 'Go' : 'Track');
          b.onclick = () => track(ready ? { kind: 'npc', id: npc.id } : questTarget(ctx, npc.id, q));
          row.append(b);
        }
        card.append(row);
      }
      list.append(card);
    }
    return list;
  };

  const renderReferences = () => {
    const box = styled('div', 'max-width:900px');
    for (const [topic, refs] of Object.entries(REFERENCES)) {
      box.append(styled('h3', 'margin:14px 0 6px;color:#ffd24a', topic));
      const ol = styled('ol', 'margin:0;padding-left:22px;color:#ccd;line-height:1.45');
      for (const r of refs) {
        const li = styled('li', 'margin:3px 0', r.text + ' ');
        if (r.url) {
          const a = styled('a', 'color:#8fb8d8', 'link') as HTMLAnchorElement;
          a.href = r.url;
          a.target = '_blank';
          a.rel = 'noopener';
          li.append(a);
        }
        ol.append(li);
      }
      box.append(ol);
    }
    return box;
  };

  const render = () => {
    const c = counts();
    const tabs = styled('div', 'display:flex;gap:6px;margin:6px 0 14px');
    for (const [id, label] of [['achievements', `Achievements · ${c.got}/${c.all}`], ['scientists', `Scientists · ${c.done}/${c.quests} requests`], ['references', 'References']] as const) {
      const b = styled('button', id === tab ? 'background:#8a7aff;color:#fff;font-weight:600' : '', label);
      b.onclick = () => {
        tab = id;
        render();
      };
      tabs.append(b);
    }
    overlay.replaceChildren(
      styled('h2', 'margin:0 0 2px', 'Journal'),
      styled('div', 'color:#aab', 'Every request a scientist makes is an achievement too. Track shows the way on screen. [J] or [Esc] closes.'),
      tabs,
      tab === 'achievements' ? renderAchievements() : tab === 'scientists' ? renderScientists() : renderReferences(),
    );
  };

  const shown = () => overlay.style.display === 'block';
  const toggle = (to?: Tab) => {
    if (to) tab = to;
    overlay.style.display = shown() && !to ? 'none' : 'block';
    if (shown()) {
      document.exitPointerLock?.();
      render();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.toLowerCase() === 'j') toggle();
    else if (e.key === 'Escape' && shown()) toggle();
  };
  addEventListener('keydown', onKey);
  const refresh = () => shown() && render();
  const offs = (['achievementUnlocked', 'questCompleted', 'discoveryUnlocked', 'itemCrafted', 'minigameScored'] as const).map((t) => ctx.bus.on(t, refresh));
  return {
    toggle,
    summary,
    dispose() {
      removeEventListener('keydown', onKey);
      offs.forEach((off) => off());
      overlay.remove();
    },
  };
}
