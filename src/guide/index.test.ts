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
    expect(text).toMatch(/Next goal: Hand lens\. Gather 2 Beach sand, 1 Iron ore/);
    gather(ctx, 'beach_sand', 2);
    gather(ctx, 'iron_ore');
    ctx.bus.emit('guideAsked', { question: 'what next' });
    expect(text).toMatch(/You have the materials: press "Glass"/);
  });
});
