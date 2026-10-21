import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import { howToGet, itemsMentioned, nextGoalRecipe, planFor } from './plan';
import { craft, createGame, gather } from './state';

const data = loadGameData();
const totals = (p: ReturnType<typeof planFor>) => Object.fromEntries(p.missing.map((m) => [m.itemId, m.count]));

describe('goal plan', () => {
  it('starts with the hand lens: glass is smelted from sand, then lens, frame, hand lens', () => {
    const ctx = createGame(data);
    const goal = nextGoalRecipe(data, ctx.state)!;
    expect(goal.id).toBe('hand_lens');
    const p = planFor(goal, data, ctx.state.inventory);
    expect(totals(p)).toEqual({ beach_sand: 2, iron_ore: 1 });
    expect(p.steps.map((s) => s.recipe.id)).toEqual(['glass', 'lens', 'frame', 'hand_lens']);
    expect(p.nextStep).toBeNull(); // nothing gathered yet
  });

  it('shrinks as the player gathers and crafts, and points at the next button', () => {
    const ctx = createGame(data);
    gather(ctx, 'beach_sand', 2);
    let p = planFor(nextGoalRecipe(data, ctx.state)!, data, ctx.state.inventory);
    expect(totals(p)).toEqual({ iron_ore: 1 });
    expect(p.nextStep?.recipe.id).toBe('glass');
    gather(ctx, 'iron_ore');
    craft(ctx, 'glass');
    p = planFor(nextGoalRecipe(data, ctx.state)!, data, ctx.state.inventory);
    expect(p.missing).toEqual([]);
    expect(p.nextStep?.recipe.id).toBe('lens');
  });

  it('later goals list the raw totals from the README table', () => {
    const ctx = createGame(data);
    ctx.state.scope = { ...ctx.state.scope, tier: 1 };
    const compound = planFor(nextGoalRecipe(data, ctx.state)!, data, {});
    expect(totals(compound)).toEqual({ beach_sand: 6, iron_ore: 2, copper_ore: 1 });
    expect(compound.steps.find((s) => s.recipe.id === 'glass')?.times).toBe(3);

    ctx.state.scope = { ...ctx.state.scope, tier: 2 };
    const hq = planFor(nextGoalRecipe(data, ctx.state)!, data, { compound_microscope: 1 });
    expect(totals(hq)).toEqual({ quartz_sand: 6, copper_ore: 1, plant_oil: 1 });

    ctx.state.scope = { ...ctx.state.scope, tier: 3 };
    const em = planFor(nextGoalRecipe(data, ctx.state)!, data, {});
    expect(totals(em)).toEqual({ tungsten_ore: 1, resin: 2, iron_ore: 4, copper_ore: 4 });

    ctx.state.scope = { ...ctx.state.scope, tier: 5 };
    expect(nextGoalRecipe(data, ctx.state)).toBeNull();
  });
});

describe('where to find things', () => {
  it('every raw material that recipes use has a where-to-find hint', () => {
    const crafted = new Set(data.recipes.map((r) => r.output.itemId));
    const raw = new Set(data.recipes.flatMap((r) => r.inputs.map((i) => i.itemId)).filter((id) => !crafted.has(id)));
    for (const id of raw) expect(data.materials[id]?.where, id).toBeTruthy();
  });

  it('answers for raw and crafted items; matches the longest name', () => {
    expect(howToGet('beach_sand', data)).toMatch(/pond shore/);
    expect(howToGet('glass', data)).toMatch(/crafted.*2 Beach sand/);
    expect(itemsMentioned('where do i find glass lens?', data)).toEqual(['lens']);
    expect(itemsMentioned('how do I get glass', data)).toEqual(['glass']);
    expect(itemsMentioned('why is it blurry?', data)).toEqual([]);
  });
});
