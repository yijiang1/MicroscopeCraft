import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import { howToGet, itemsMentioned, lockedBy, nextGoalRecipe, planFor, scopeThatSees } from './plan';
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
    ctx.state.inventory = { hand_lens: 1 }; // owning it is what counts
    const compound = planFor(nextGoalRecipe(data, ctx.state)!, data, {});
    expect(totals(compound)).toEqual({ beach_sand: 6, iron_ore: 2, copper_ore: 1 });
    expect(compound.steps.find((s) => s.recipe.id === 'glass')?.times).toBe(3);

    ctx.state.inventory = { compound_microscope: 1 }; // owning it is what counts
    const hq = planFor(nextGoalRecipe(data, ctx.state)!, data, { compound_microscope: 1 });
    expect(totals(hq)).toEqual({ quartz_sand: 6, copper_ore: 1, plant_oil: 1 });

    ctx.state.inventory = { hq_microscope: 1 }; // owning it is what counts
    const em = planFor(nextGoalRecipe(data, ctx.state)!, data, {});
    expect(totals(em)).toEqual({ tungsten_ore: 1, resin: 2, iron_ore: 4, copper_ore: 4 });

    ctx.state.inventory = { electron_microscope: 1 }; // owning it is what counts
    expect(nextGoalRecipe(data, ctx.state)).toBeNull();
  });
});

describe('hidden materials: each tier needs something found with the tier below', () => {
  const goals = data.recipes.filter((r) => r.scope).sort((a, b) => a.scope!.tier - b.scope!.tier);

  it('copper needs the hand lens, plant oil the compound microscope, tungsten the high-quality microscope', () => {
    const scopeOf = (item: string) => {
      const feature = data.materials[item]!.unlockedBy!;
      const f = Object.values(data.samples).flatMap((s) => s.features).find((x) => x.id === feature)!;
      return scopeThatSees(f, data)!.id;
    };
    expect(scopeOf('copper_ore')).toBe('hand_lens');
    expect(scopeOf('plant_oil')).toBe('compound_microscope');
    expect(scopeOf('tungsten_ore')).toBe('hq_microscope');
  });

  it('every microscope after the first needs a material that is only identifiable with the previous tier', () => {
    goals.slice(1).forEach((goal, i) => {
      const previousTier = goals[i]!.scope!.tier;
      const plan = planFor(goal, data, {});
      const gates = plan.raw.filter((r) => r.identify).map((r) => r.identify!.scope!.scope!.tier);
      expect(gates, goal.id).toContain(previousTier);
    });
  });

  it('the plan lists what to identify, and gathering is locked until it is discovered', () => {
    const compound = goals.find((g) => g.id === 'compound_microscope')!;
    const before = planFor(compound, data, {}, []);
    const copper = before.raw.find((r) => r.itemId === 'copper_ore')!;
    expect(copper.identify).toMatchObject({ done: false, feature: { id: 'copper_veins' }, sample: { id: 'copper_rock' } });
    expect(lockedBy('copper_ore', data, [])).toBe('copper_veins');
    expect(lockedBy('copper_ore', data, ['copper_veins'])).toBeNull();
    expect(lockedBy('iron_ore', data, [])).toBeNull();
    expect(planFor(compound, data, {}, ['copper_veins']).raw.find((r) => r.itemId === 'copper_ore')!.identify!.done).toBe(true);
  });
});

describe('where to find things', () => {
  it('every raw material that recipes use has a where-to-find hint', () => {
    const crafted = new Set(data.recipes.map((r) => r.output.itemId));
    const raw = new Set(data.recipes.flatMap((r) => r.inputs.map((i) => i.itemId)).filter((id) => !crafted.has(id)));
    for (const id of raw) expect(data.materials[id]?.where, id).toBeTruthy();
  });

  it('answers for raw and crafted items; matches the longest name', () => {
    expect(howToGet('beach_sand', data)).toMatch(/the lake/);
    expect(howToGet('glass', data)).toMatch(/crafted.*2 Beach sand/);
    expect(howToGet('copper_ore', data)).toMatch(/only gather it after you have looked at it with a Hand lens and spotted Copper veins/);
    expect(howToGet('copper_ore', data, ['copper_veins'])).toMatch(/press E/);
    expect(itemsMentioned('where do i find glass lens?', data)).toEqual(['lens']);
    expect(itemsMentioned('how do I get glass', data)).toEqual(['glass']);
    expect(itemsMentioned('why is it blurry?', data)).toEqual([]);
  });

  it('the goal follows the best microscope owned, not the one picked in the eyepiece', () => {
    const ctx = createGame(data);
    ctx.state.inventory = { hand_lens: 1, compound_microscope: 1 };
    ctx.state.scopeChoice = 1;
    expect(nextGoalRecipe(data, ctx.state)?.id).toBe('hq_microscope');
  });
});
