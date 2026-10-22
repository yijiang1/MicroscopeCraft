// Goal card: always on screen, tells the player what to do right now and shows the tech tree of the next
// microscope (click a material to track it). Works without the mouse: C crafts the next ready step. It also tells the world which material to
// point at (trackItem). Owner: Person D.
import { actionText, currentAction, nextGoalRecipe, planFor, type Plan } from '../shared/plan';
import type { Recipe } from '../shared/schema';
import { activeBuilds, canCraft, craft, type GameContext } from '../shared/state';
import { itemIcon } from './icons';
import { drawTree, goalLayout } from './techtree';
import type { Toast } from './toast';
import { withKeys } from './keys';

export interface GoalHandle {
  render(): void;
  /** Show the guide's latest answer in the card. */
  say(text: string): void;
  dispose(): void;
}

const WIDTH = 'min(310px,calc(100vw - 16px))';

const div = (css = '', text = '') => {
  const d = document.createElement('div');
  d.style.cssText = css;
  withKeys(d, text);
  return d;
};

/** `below` is the inventory box: the card takes the height above it. */
export function mountGoal(ctx: GameContext, toast: Toast, openMenu: () => void, below: HTMLElement): GoalHandle {
  const card = div(
    `position:fixed;top:8px;right:calc(var(--panel-w, 0px) + 8px);z-index:15;width:${WIDTH};max-height:56vh;overflow:auto;box-sizing:border-box;padding:8px 10px;border-radius:10px;background:#000c;color:#eee;font:13px system-ui`,
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
    let tree: ((size: 'small' | 'tiny') => HTMLElement) | null = null;
    const goal = nextGoalRecipe(data, state);
    plan = goal ? planFor(goal, data, state.inventory, state.discoveries, activeBuilds(state)) : null;
    const action = plan ? currentAction(plan) : null;

    // --- header: the one thing to do now
    const head = div('display:flex;gap:8px;align-items:flex-start');
    const now = div('flex:1;font-size:14px;font-weight:600;color:#ffe08a', plan ? (action ? actionText(action, data, state.advanced) : 'Look around') : 'You built every instrument!');
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
      card.append(div('color:#9ab;margin-top:4px', 'Fill the Microdex [M], and help the scientists around campus: [J] shows what each one asks for.'));
    } else {
      const trackedRaw = plan.raw.find((r) => r.itemId === pinned && r.missing > 0) ?? plan.raw.find((r) => r.missing > 0);
      if (pinned && trackedRaw?.itemId !== pinned) pinned = null;
      track(trackedRaw?.itemId ?? null);
      const p = plan;
      const where = action?.kind === 'gather' && trackedRaw ? data.materials[trackedRaw.itemId]?.where : undefined;
      if (where) card.append(div('font-size:11px;color:#b8c8b8;margin-top:2px', where));
      const step = p.nextStep ?? p.steps[0];
      if (step) card.append(recipeStrip(step.recipe));
      if (expanded) {
        const left = (id: string) => p.steps.find((x) => x.recipe.output.itemId === id)?.times ?? 0;
        const raw = (id: string) => p.raw.find((r) => r.itemId === id);
        const layout = goalLayout(p.goal, data);
        tree = (size: 'small' | 'tiny') => drawTree(ctx, layout, {
            size,
            done: (id) => (raw(id) ? raw(id)!.missing === 0 : left(id) === 0),
            badge: (id) => {
              const r = raw(id);
              const have = state.inventory[id] ?? 0;
              return r ? `${r.total - r.missing}/${r.total}` : have ? `${have}` : null;
            },
            hi: action?.kind === 'craft' ? action.step.recipe.output.itemId : trackedRaw?.itemId,
            onPick: (id) => raw(id) && raw(id)!.missing > 0 && ((pinned = id), render()),
          });
      }
    }

    // The guide's answer goes above the tree, so fit() counts it.
    if (said) card.append(div('margin-top:8px;padding:6px 8px;border-radius:6px;background:#1c3a1f;color:#fff', said));
    card.style.width = WIDTH;
    card.style.maxHeight = `${Math.max(innerHeight * 0.4, innerHeight - below.offsetHeight - 24)}px`;
    if (tree) {
      // Labelled tiles when they fit at a readable size, else icons only; whatever is still too big is scaled down.
      let t = tree('small');
      if (fit(t) < 0.85) {
        t.remove();
        fit((t = tree('tiny')));
      }
    }
  };

  /** Widens the card for a wide tree (up to 45vw), then shrinks the tree so the card never scrolls. Returns the scale. */
  const fit = (t: HTMLElement) => {
    card.append(t);
    const pad = 20;
    const w = parseFloat(t.style.width), h = parseFloat(t.style.height);
    card.style.width = `min(max(310px, ${w + pad}px), 45vw, calc(100vw - 16px))`;
    if (!card.clientWidth) return 1; // hidden behind the eyepiece; refit on close
    const rest = card.scrollHeight - t.offsetHeight;
    const maxH = parseFloat(getComputedStyle(card).maxHeight);
    const z = Math.min(1, (card.clientWidth - pad) / w, (maxH - rest - pad) / h);
    t.style.zoom = `${z}`;
    return z;
  };

  /** The next craft as a formula: [2 sand] + … → [glass], with a button that lights up once it can be made. */
  const recipeStrip = (recipe: Recipe) => {
    const { data, state } = ctx;
    const ready = canCraft(ctx, recipe.id);
    const box = div(`margin-top:8px;padding:6px 8px;border-radius:8px;background:#ffffff10;border:1px solid ${ready ? '#ffd35a' : '#ffffff22'}`);
    box.append(div('font-size:11px;color:#9ab;margin-bottom:4px', 'NEXT CRAFT'));
    const line = div('display:flex;align-items:center;gap:6px;flex-wrap:wrap');
    const short: string[] = [];
    for (const [k, i] of recipe.inputs.entries()) {
      const have = state.inventory[i.itemId] ?? 0;
      const name = data.items[i.itemId]?.name ?? i.itemId;
      if (have < i.count) short.push(`${i.count - have} more ${name}`);
      const chip = div('display:inline-flex;align-items:center;gap:3px');
      chip.title = name;
      chip.append(itemIcon(i.itemId, data, 22), div(`font-weight:600;color:${have >= i.count ? '#9be07f' : '#ff8a7a'}`, `${Math.min(have, i.count)}/${i.count}`));
      line.append(...(k ? [div('color:#9ab', '+')] : []), chip);
    }
    const out = div('display:inline-flex;align-items:center;gap:3px;font-weight:600');
    out.append(itemIcon(recipe.output.itemId, data, 22), `${data.items[recipe.output.itemId]?.name ?? recipe.output.itemId}`);
    line.append(div('color:#9ab;font-size:16px', '→'), out);
    const btn = document.createElement('button');
    const handBuilt = recipe.assembly && ctx.state.advanced;
    withKeys(btn, handBuilt ? 'Build it [C]' : 'Craft [C]');
    btn.title = handBuilt ? 'Opens the workbench: you grind the lenses and put the microscope together yourself' : '';
    btn.disabled = !ready;
    btn.style.cssText = `margin-left:auto;padding:3px 10px;border-radius:6px;border:0;font-weight:700;${ready ? 'background:#ffd35a;color:#222;cursor:pointer;box-shadow:0 0 8px #ffd35a88' : 'background:#444;color:#999'}`;
    btn.onclick = () => doCraft(recipe.id);
    line.append(btn);
    box.append(line);
    if (short.length) box.append(div('font-size:11px;color:#ff8a7a;margin-top:4px', `Need ${short.join(' and ')} first.`));
    return box;
  };

  const doCraft = (recipeId: string) => {
    const recipe = ctx.data.recipes.find((r) => r.id === recipeId);
    if (recipe?.assembly && ctx.state.advanced) return ctx.bus.emit('openWorkbench', { recipeId }); // built by hand, not crafted
    if (craft(ctx, recipeId)) toast.notify(`Crafted ${ctx.data.items[recipe!.output.itemId]?.name}`);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== 'c' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (plan?.nextStep) doCraft(plan.nextStep.recipe.id);
    else {
      const action = plan ? currentAction(plan) : null;
      toast.notify(`Nothing to craft yet. ${action ? actionText(action, ctx.data, ctx.state.advanced) : ''}`, 2600);
    }
  };
  addEventListener('keydown', onKey);
  addEventListener('resize', render);
  const belowSize = new ResizeObserver(() => render());
  belowSize.observe(below);

  render();
  const offs = [
    ctx.bus.on('itemGathered', render),
    ctx.bus.on('itemCrafted', render),
    ctx.bus.on('discoveryUnlocked', render),
    ctx.bus.on('openEyepiece', () => (card.style.display = 'none')), // the eyepiece has its own panels there
    ctx.bus.on('closeEyepiece', () => {
      card.style.display = '';
      render();
    }),
    ctx.bus.on('openWorkbench', () => (card.style.display = 'none')),
    ctx.bus.on('modeChanged', render),
    ctx.bus.on('closeWorkbench', () => {
      card.style.display = ctx.state.currentSampleId ? 'none' : '';
      render();
    }),
    ctx.bus.on('scopeChanged', render), // a microscope rebuilt at the workbench changes what the plan says
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
      removeEventListener('resize', render);
      belowSize.disconnect();
      clearTimeout(sayTimer);
      track(null);
      card.remove();
    },
  };
}
