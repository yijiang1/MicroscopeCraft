import { describe, expect, it } from 'vitest';
import { loadGameData } from '../shared/data';
import { createGame, gather } from '../shared/state';
import { mountGuide } from './index';

const data = loadGameData();

describe('guide replies', () => {
  it('answers where-to-find and what-next questions offline', () => {
    const ctx = createGame(data);
    mountGuide(ctx);
    let text = '';
    ctx.bus.on('guideReplied', (r) => (text = r.text));
    ctx.bus.emit('guideAsked', { question: 'where do I find the glass?' });
    expect(text).toMatch(/Glass is crafted.*2 Beach sand/);
    ctx.bus.emit('guideAsked', { question: 'where is quartz sand' });
    expect(text).toMatch(/White crystal clusters/);
    ctx.bus.emit('guideAsked', { question: 'what should I do next?' });
    expect(text).toMatch(/Next goal: Hand lens\. Gather 2 Beach sand .*Tan sand mounds/);
    gather(ctx, 'beach_sand', 2);
    gather(ctx, 'iron_ore');
    ctx.bus.emit('guideAsked', { question: 'what next' });
    expect(text).toMatch(/Press C to craft Glass/);
    // compound goal: copper must be identified with the hand lens before it can be gathered
    ctx.state.scope = { ...ctx.state.scope, tier: 1 };
    ctx.state.inventory = { beach_sand: 6, iron_ore: 2 };
    ctx.bus.emit('guideAsked', { question: 'what next' });
    expect(text).toMatch(/Next goal: Compound microscope\. Look \(F\) at a Grey rock with your Hand lens to spot Copper veins/);
  });
});
