// Goal card: always on screen, tells the player what to do right now and shows the whole checklist for the next
// microscope. Works without the mouse: C crafts the next ready step. It also tells the world which material to
// point at (trackItem). Owner: Person D.
import { actionText, currentAction, nextGoalRecipe, planFor, type Plan } from '../shared/plan';
import { fmtUm } from '../shared/sim/walls';
import { canCraft, craft, type GameContext } from '../shared/state';
import type { Toast } from './toast';

export interface GoalHandle {
  render(): void;
  /** Show the guide's latest answer in the card. */
  say(text: string): void;
  dispose(): void;
}

const div = (css = '', text = '') => {
  const d = document.createElement('div');
  d.style.cssText = css;
  d.textContent = text;
  return d;
};

const MARK = { done: '✓', now: '▶', todo: '○', locked: '🔒' } as const;

export function mountGoal(ctx: GameContext, toast: Toast, openMenu: () => void): GoalHandle {
  const card = div(
    'position:fixed;top:8px;right:calc(var(--panel-w, 0px) + 8px);z-index:15;width:min(310px,calc(100vw - 16px));max-height:82vh;overflow:auto;box-sizing:border-box;padding:8px 10px;border-radius:10px;background:#000c;color:#eee;font:13px system-ui',
  );
  document.body.append(card);
  let pinned: string | null = null;
  let emitted: string | null | undefined;
  let expanded = innerWidth >= 700;
  let said = '';
  let sayTimer = 0;
  let plan: Plan | null = null;

  const track = (itemId: string | null) => {
    if (itemId === emitted) return;
    emitted = itemId;
    ctx.bus.emit('trackItem', { itemId });
  };

  const render = () => {
    const { data, state } = ctx;
    card.replaceChildren();
    const goal = nextGoalRecipe(data, state);
    plan = goal ? planFor(goal, data, state.inventory, state.discoveries) : null;
    const action = plan ? currentAction(plan) : null;

    // --- header: the one thing to do now
    const head = div('display:flex;gap:8px;align-items:flex-start');
    const now = div('flex:1;font-size:14px;font-weight:600;color:#ffe08a', plan ? (action ? actionText(action, data) : 'Look around') : 'You built every microscope!');
    const toggle = document.createElement('button');
    toggle.textContent = expanded ? '▾' : '▸';
    toggle.title = 'Show or hide the checklist';
    toggle.onclick = () => {
      expanded = !expanded;
      render();
    };
    const menu = document.createElement('button');
    menu.textContent = '☰';
    menu.title = 'Menu (Tab): inventory, all recipes, guide';
    menu.onclick = openMenu;
    head.append(now, toggle, menu);
    card.append(plan ? div('font-size:11px;color:#9ab', `GOAL: ${plan.goal.name.toUpperCase()}`) : div(), head);

    if (!plan) {
      track(null);
      card.append(div('color:#9ab;margin-top:4px', 'Explore, look at everything, and fill the Microdex (M).'));
    } else {
      const trackedRaw = plan.raw.find((r) => r.itemId === pinned && r.missing > 0) ?? plan.raw.find((r) => r.missing > 0);
      if (pinned && trackedRaw?.itemId !== pinned) pinned = null;
      track(trackedRaw?.itemId ?? null);
      if (expanded) card.append(...checklist(plan, trackedRaw?.itemId ?? null));
    }

    if (said) card.append(div('margin-top:8px;padding:6px 8px;border-radius:6px;background:#1c3a1f;color:#fff', said));
    card.append(div('margin-top:6px;font-size:11px;color:#789', 'C craft next · F look · Tab menu · G ask guide · M Microdex'));
  };

  const checklist = (p: Plan, tracked: string | null): HTMLElement[] => {
    const { data } = ctx;
    const rows: HTMLElement[] = [];
    const row = (mark: keyof typeof MARK, text: string, opts: { sub?: string; onClick?: () => void; hi?: boolean; dim?: boolean } = {}) => {
      const r = div(
        `margin:3px 0;padding:3px 6px;border-radius:6px;${opts.onClick ? 'cursor:pointer;' : ''}${opts.hi ? 'background:#2c4a2f;' : ''}${opts.dim ? 'opacity:.55;' : ''}`,
      );
      r.append(div('', `${MARK[mark]} ${text}`));
      if (opts.sub) r.append(div('font-size:11px;color:#b8c8b8;margin-left:16px', opts.sub));
      if (opts.onClick) r.onclick = opts.onClick;
      rows.push(r);
    };
    const nextId = p.nextStep?.recipe.id;
    const firstOpen = p.raw.find((r) => r.missing > 0);

    for (const r of p.raw) {
      const name = data.items[r.itemId]?.name ?? r.itemId;
      const idn = r.identify;
      if (idn) {
        const mark = idn.done ? 'done' : r === firstOpen ? 'now' : 'todo';
        row(mark, `Identify ${idn.feature.name} (${fmtUm(idn.feature.sizeUm)})`, {
          sub: idn.done ? undefined : `Look (F) at a ${idn.sample.name} with a ${idn.scope?.name ?? 'microscope'}`,
          hi: !idn.done && r === firstOpen,
          onClick: () => (pinned = r.itemId, render()),
        });
      }
      const done = r.missing === 0;
      const locked = !!idn && !idn.done;
      const have = r.total - r.missing;
      row(done ? 'done' : locked ? 'locked' : r === firstOpen ? 'now' : 'todo', `Gather ${name} ${have}/${r.total}`, {
        sub: !done && (r.itemId === tracked || r === firstOpen) ? data.materials[r.itemId]?.where : undefined,
        hi: r.itemId === tracked && !done,
        dim: done || locked,
        onClick: done ? undefined : () => (pinned = r.itemId, render()),
      });
    }
    for (const s of p.allSteps) {
      const left = p.steps.find((x) => x.recipe.id === s.recipe.id)?.times ?? 0;
      const ready = nextId === s.recipe.id;
      const uses = s.recipe.inputs.map((x) => `${x.count} ${data.items[x.itemId]?.name ?? x.itemId}`).join(' + ');
      row(left === 0 ? 'done' : ready ? 'now' : 'todo', `Craft ${s.recipe.name}${left > 1 ? ` ×${left}` : ''}${ready ? '  [C]' : ''}`, {
        sub: left > 0 ? `uses ${uses}` : undefined,
        hi: ready,
        dim: left === 0,
        onClick: left > 0 && canCraft(ctx, s.recipe.id) ? () => doCraft(s.recipe.id) : undefined,
      });
    }
    return rows;
  };

  const doCraft = (recipeId: string) => {
    if (craft(ctx, recipeId)) toast.notify(`Crafted ${ctx.data.items[ctx.data.recipes.find((r) => r.id === recipeId)!.output.itemId]?.name}`);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== 'c' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (plan?.nextStep) doCraft(plan.nextStep.recipe.id);
    else {
      const action = plan ? currentAction(plan) : null;
      toast.notify(`Nothing to craft yet. ${action ? actionText(action, ctx.data) : ''}`, 2600);
    }
  };
  addEventListener('keydown', onKey);

  render();
  const offs = [
    ctx.bus.on('itemGathered', render),
    ctx.bus.on('itemCrafted', render),
    ctx.bus.on('discoveryUnlocked', render),
  ];
  return {
    render,
    say(text) {
      said = text;
      render();
      clearTimeout(sayTimer);
      sayTimer = window.setTimeout(() => {
        said = '';
        render();
      }, 20_000);
    },
    dispose() {
      offs.forEach((off) => off());
      removeEventListener('keydown', onKey);
      clearTimeout(sayTimer);
      track(null);
      card.remove();
    },
  };
}
