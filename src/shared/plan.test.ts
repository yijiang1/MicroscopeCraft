import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import { actionText, currentAction, howToGet, itemsMentioned, lockedBy, nextGoalRecipe, planFor, scopeThatSees } from './plan';
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
    const totalsAfter = (owned: string, keep: Record<string, number> = {}) => {
      const goal = nextGoalRecipe(data, { inventory: { [owned]: 1 } })!;
      return { id: goal.id, raw: totals(planFor(goal, data, keep)) };
    };
    const compound = totalsAfter('hand_lens');
    expect(compound.raw).toEqual({ beach_sand: 6, iron_ore: 2, copper_ore: 1 });
    expect(planFor(nextGoalRecipe(data, { inventory: { hand_lens: 1 } })!, data, {}).steps.find((s) => s.recipe.id === 'glass')?.times).toBe(3);
    expect(totalsAfter('compound_microscope', { compound_microscope: 1 })).toEqual({ id: 'hq_microscope', raw: { quartz_sand: 6, copper_ore: 1, plant_oil: 1 } });
    expect(totalsAfter('hq_microscope', { hq_microscope: 1 })).toEqual({ id: 'fluorescence_microscope', raw: { quartz_sand: 6, fluorite: 2, tungsten_ore: 1 } });
    expect(totalsAfter('fluorescence_microscope')).toEqual({
      id: 'electron_microscope', raw: { tungsten_ore: 3, iron_ore: 10, copper_ore: 9, resin: 3, willemite: 1, beach_sand: 2 },
    });
    expect(totalsAfter('electron_microscope', { electron_microscope: 1 })).toEqual({
      id: 'stem_microscope', raw: { tungsten_ore: 1, iron_ore: 5, copper_ore: 11, resin: 1, monazite: 1, quartz_sand: 4, beach_sand: 2 },
    });
    expect(totalsAfter('stem_microscope')).toEqual({
      id: 'chess_beamline', raw: { iron_ore: 12, copper_ore: 9, monazite: 2, resin: 2, beryl: 2, quartz_sand: 10, galena: 3 },
    });
    expect(nextGoalRecipe(data, { inventory: { chess_beamline: 1 } })).toBeNull();
  });
});

describe('hidden materials: each tier needs something found with the tier below', () => {
  const goals = data.recipes.filter((r) => r.scope).sort((a, b) => a.scope!.tier - b.scope!.tier);

  it('each hidden material is identified with the instrument one tier down from where it is needed', () => {
    const scopeOf = (item: string) => {
      const feature = data.materials[item]!.unlockedBy!;
      const f = Object.values(data.samples).flatMap((s) => s.features).find((x) => x.id === feature)!;
      return scopeThatSees(f, data)!.id;
    };
    expect(scopeOf('copper_ore')).toBe('hand_lens');
    expect(scopeOf('plant_oil')).toBe('compound_microscope');
    expect(scopeOf('tungsten_ore')).toBe('hq_microscope');
    expect(scopeOf('fluorite')).toBe('hq_microscope');
    expect(scopeOf('willemite')).toBe('fluorescence_microscope');
    expect(scopeOf('monazite')).toBe('electron_microscope');
    expect(scopeOf('beryl')).toBe('stem_microscope');
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

  it('for an instrument in the lab, the goal says to take a bit of the sample there, and which step shows it', () => {
    const stem = goals.find((g) => g.id === 'stem_microscope')!;
    const action = currentAction(planFor(stem, data, { electron_microscope: 1 }, ['copper_veins', 'tungsten_grains']))!;
    expect(actionText(action, data)).toBe(
      'Look (F) at a Dark creek sand to take a bit, then use the Transmission electron microscope in the science lab at Electron diffraction to spot Monazite diffraction',
    );
  });
});

describe('current action', () => {
  it('says to craft as soon as a step is ready, before gathering the rest', () => {
    const goal = nextGoalRecipe(data, { inventory: {} })!;
    const action = currentAction(planFor(goal, data, { beach_sand: 2 }))!;
    expect(action.kind === 'craft' && action.step.recipe.id).toBe('glass');
    expect(currentAction(planFor(goal, data, {}))!.kind).toBe('gather');
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
