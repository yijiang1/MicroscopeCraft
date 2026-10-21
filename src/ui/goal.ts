// Goal card: always on screen, tells the player what to do right now and shows the tech tree of the next
// microscope (click a material to track it). Works without the mouse: C crafts the next ready step. It also tells the world which material to
// point at (trackItem). Owner: Person D.
import { actionText, currentAction, nextGoalRecipe, planFor, type Plan } from '../shared/plan';
import { craft, type GameContext } from '../shared/state';
import { drawTree, goalLayout } from './techtree';
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

export function mountGoal(ctx: GameContext, toast: Toast, openMenu: () => void): GoalHandle {
  const card = div(
    'position:fixed;top:8px;right:calc(var(--panel-w, 0px) + 8px);z-index:15;width:min(310px,calc(100vw - 16px));max-height:56vh;overflow:auto;box-sizing:border-box;padding:8px 10px;border-radius:10px;background:#000c;color:#eee;font:13px system-ui',
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
    toggle.title = 'Show or hide the tree';
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
      const p = plan;
      const where = action?.kind === 'gather' && trackedRaw ? data.materials[trackedRaw.itemId]?.where : undefined;
      if (where) card.append(div('font-size:11px;color:#b8c8b8;margin-top:2px', where));
      if (expanded) {
        const left = (id: string) => p.steps.find((x) => x.recipe.output.itemId === id)?.times ?? 0;
        const raw = (id: string) => p.raw.find((r) => r.itemId === id);
        card.append(
          drawTree(ctx, goalLayout(p.goal, data), {
            size: 'small',
            done: (id) => (raw(id) ? raw(id)!.missing === 0 : left(id) === 0),
            badge: (id) => {
              const r = raw(id);
              const have = state.inventory[id] ?? 0;
              return r ? `${r.total - r.missing}/${r.total}` : have ? `${have}` : null;
            },
            hi: action?.kind === 'craft' ? action.step.recipe.output.itemId : trackedRaw?.itemId,
            onPick: (id) => raw(id) && raw(id)!.missing > 0 && ((pinned = id), render()),
          }),
        );
      }
    }

    if (said) card.append(div('margin-top:8px;padding:6px 8px;border-radius:6px;background:#1c3a1f;color:#fff', said));
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
