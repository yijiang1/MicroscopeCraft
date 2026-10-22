// Talking to a scientist (E): who they were, what they ask for, and a Show button for every request you can do now,
// with your own Microdex picture of what they asked to see. Owner: Person D.
import { conditionMet } from '../shared/achievements';
import { completeQuest, type GameContext } from '../shared/state';
import { questTarget } from './journal';
import type { Toast } from './toast';

const styled = (tag: string, css: string, text = '') => {
  const e = document.createElement(tag);
  e.style.cssText = css;
  e.textContent = text;
  return e;
};

export function mountDialog(ctx: GameContext, toast: Toast): () => void {
  const box = styled('div', 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:25;display:none;width:min(560px,92vw);max-height:84vh;overflow:auto;box-sizing:border-box;padding:16px 20px;border-radius:14px;background:#0f1418f2;color:#eee;font:14px system-ui;box-shadow:0 8px 40px #000a');
  document.body.append(box);
  let npcId: string | null = null;
  let said = '';

  const close = () => {
    npcId = null;
    box.style.display = 'none';
  };

  const render = () => {
    const npc = npcId ? ctx.data.npcs[npcId] : undefined;
    if (!npc) return close();
    box.replaceChildren();
    const head = styled('div', 'display:flex;align-items:baseline;gap:10px');
    head.append(styled('b', 'font-size:19px;flex:1', npc.name), styled('span', 'color:#889', npc.years));
    const x = styled('button', '', '✕');
    x.onclick = close;
    head.append(x);
    box.append(head, styled('div', 'color:#9fc8e8;margin:2px 0 8px', npc.role), styled('div', 'color:#bbc;font-size:13px;line-height:1.45', npc.bio));
    box.append(styled('div', 'margin:12px 0;padding:10px 12px;border-radius:10px;background:#1c2a33;font-style:italic;line-height:1.45', `“${said || npc.greeting}”`));
    for (const q of npc.quests) {
      const done = ctx.state.quests.includes(q.id);
      const ready = !done && conditionMet(q.needs, ctx.data, ctx.state);
      const row = styled('div', `display:flex;gap:10px;align-items:center;margin:6px 0;padding:8px 10px;border-radius:8px;background:${done ? '#16261a' : ready ? '#2e2810' : '#161b20'}`);
      const pic = q.needs.discovered?.map((id) => ctx.state.snapshots[id]?.image).find(Boolean);
      if (pic && (ready || done)) {
        const img = Object.assign(document.createElement('img'), { src: pic, width: 56, height: 56 });
        img.style.cssText = 'border-radius:50%;flex:none';
        row.append(img);
      }
      const text = styled('div', 'flex:1');
      text.append(
        styled('div', `font-weight:600;color:${done ? '#9be59b' : ready ? '#ffd24a' : '#ddd'}`, `${done ? '✓' : ready ? '★' : '•'} ${q.title}`),
        styled('div', 'font-size:13px;color:#ccd;margin-top:2px', done ? q.thanks : q.ask),
      );
      if (!done && !ready) text.append(styled('div', 'font-size:12px;color:#8fb8d8;margin-top:2px', q.hint));
      row.append(text);
      if (ready) {
        const b = styled('button', 'font-weight:600', 'Show');
        b.onclick = () => {
          if (!completeQuest(ctx, npc.id, q.id)) return;
          said = q.thanks;
          render();
        };
        row.append(b);
      } else if (!done) {
        const b = styled('button', 'font-size:11px', 'Track');
        b.onclick = () => {
          ctx.bus.emit('trackTarget', { target: questTarget(ctx, npc.id, q) });
          toast.notify(`Tracking: ${q.title}`, 1600);
          close();
        };
        row.append(b);
      }
      box.append(row);
    }
    box.append(styled('div', 'color:#778;font-size:12px;margin-top:8px', 'Enter shows the first thing you can show · Esc closes · J opens the journal'));
  };

  const onKey = (e: KeyboardEvent) => {
    if (!npcId) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Enter') {
      const npc = ctx.data.npcs[npcId]!;
      const q = npc.quests.find((x) => !ctx.state.quests.includes(x.id) && conditionMet(x.needs, ctx.data, ctx.state));
      if (q && completeQuest(ctx, npc.id, q.id)) {
        said = q.thanks;
        render();
      }
    }
  };
  addEventListener('keydown', onKey, true);
  const offs = [
    ctx.bus.on('talkTo', ({ npcId: id }) => {
      npcId = id;
      said = '';
      box.style.display = 'block';
      document.exitPointerLock?.();
      render();
    }),
    ctx.bus.on('openEyepiece', close),
  ];
  return () => {
    offs.forEach((off) => off());
    removeEventListener('keydown', onKey, true);
    box.remove();
  };
}
