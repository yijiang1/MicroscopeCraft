// Goal panel: the next microscope to build, what to gather and where, and the crafts in order.
// It also tells the world which material to point at (trackItem), so the player is never lost. Owner: Person D.
import { nextGoalRecipe, planFor } from '../shared/plan';
import { canCraft, craft, type GameContext } from '../shared/state';

export interface GoalHandle {
  render(): void;
  dispose(): void;
}

const div = (css = '', text = '') => {
  const d = document.createElement('div');
  d.style.cssText = css;
  d.textContent = text;
  return d;
};

export function mountGoal(parent: HTMLElement, ctx: GameContext): GoalHandle {
  const box = div('margin-bottom:8px');
  parent.appendChild(box);
  /** Material the player clicked "Show" on; stays until it is no longer missing. */
  let pinned: string | null = null;
  let emitted: string | null | undefined;

  const track = (itemId: string | null) => {
    if (itemId === emitted) return;
    emitted = itemId;
    ctx.bus.emit('trackItem', { itemId });
  };

  const render = () => {
    const { data, state } = ctx;
    box.replaceChildren();
    const goal = nextGoalRecipe(data, state);
    if (!goal) {
      box.append(div('font-weight:600', 'You built the whole tree!'), div('color:#9ab', 'Explore, look at everything, and fill the Microdex (M).'));
      track(null);
      return;
    }
    const plan = planFor(goal, data, state.inventory);
    if (pinned && !plan.missing.some((m) => m.itemId === pinned)) pinned = null;
    const tracked = pinned ?? plan.missing[0]?.itemId ?? null;
    track(tracked);

    box.append(div('font-size:12px;color:#9ab', 'NEXT GOAL'), div('font-size:16px;font-weight:600;margin-bottom:6px', goal.name));

    if (plan.missing.length) {
      box.append(div('font-size:12px;color:#9ab;margin-top:4px', 'GATHER (aim and press E)'));
      for (const m of plan.missing) {
        const row = div(`padding:4px 6px;margin:3px 0;border-radius:6px;background:${m.itemId === tracked ? '#2c4a2f' : '#ffffff14'}`);
        const name = data.items[m.itemId]?.name ?? m.itemId;
        const head = div('display:flex;justify-content:space-between;gap:6px');
        head.append(div('', `${name}: ${m.count} more`));
        const show = document.createElement('button');
        show.textContent = m.itemId === tracked ? 'Showing' : 'Show me';
        show.disabled = m.itemId === tracked;
        show.onclick = () => {
          pinned = m.itemId;
          render();
        };
        head.append(show);
        row.append(head, div('font-size:12px;color:#b8c8b8', data.materials[m.itemId]?.where ?? ''));
        box.append(row);
      }
      box.append(div('font-size:12px;color:#9ab', 'An arrow at the top of the screen points to the nearest one.'));
    } else {
      box.append(div('color:#9be59b;margin:4px 0', 'You have everything. Press the green button.'));
    }

    box.append(div('font-size:12px;color:#9ab;margin-top:8px', 'CRAFT, IN ORDER'));
    plan.steps.forEach((step, i) => {
      const r = step.recipe;
      const b = document.createElement('button');
      const next = plan.nextStep?.recipe.id === r.id;
      b.style.cssText = `display:block;width:100%;text-align:left;margin:3px 0;padding:4px 6px;${next ? 'background:#2f7a35;color:#fff;font-weight:600' : ''}`;
      const uses = r.inputs.map((x) => `${x.count} ${data.items[x.itemId]?.name ?? x.itemId}`).join(' + ');
      b.append(`${i + 1}. ${r.name}${step.times > 1 ? ` ×${step.times}` : ''}`, Object.assign(div('font-size:11px;font-weight:400;opacity:.8', `uses ${uses}`)));
      b.disabled = !canCraft(ctx, r.id);
      b.onclick = () => craft(ctx, r.id);
      box.append(b);
    });
  };
  render();
  const offs = [ctx.bus.on('itemGathered', render), ctx.bus.on('itemCrafted', render)];
  return {
    render,
    dispose() {
      offs.forEach((off) => off());
      track(null);
      box.remove();
    },
  };
}
