import { describe, expect, it } from 'vitest';
import { loadGameData } from '../shared/data';
import { createGame, gather } from '../shared/state';
import { mountGuide } from './index';

const data = loadGameData();

describe('guide replies', () => {
  it('answers its suggested sand question with both named materials and their locations', () => {
    const ctx = createGame(data);
    mountGuide(ctx);
    let text = '';
    ctx.bus.on('guideReplied', (r) => (text = r.text));
    ctx.bus.emit('guideAsked', { question: 'where do I find sand?' });
    expect(text).toContain('Beach sand:');
    expect(text).toContain(data.materials.beach_sand!.where);
    expect(text).toContain('Quartz sand:');
    expect(text).toContain(data.materials.quartz_sand!.where);
    expect(text).not.toContain('Ask me');
  });

  it('uses current image advice and never reuses it for another sample or a reopened eyepiece', () => {
    const ctx = createGame(data);
    const dispose = mountGuide(ctx);
    let text = '';
    ctx.bus.on('guideReplied', (r) => (text = r.text));
    const ask = () => ctx.bus.emit('guideAsked', { question: 'why is this blurry?' });
    ctx.bus.emit('openEyepiece', { sampleId: 'diatom_test' });
    // The scope can resolve this sample in principle; the actual image is out of focus.
    ctx.bus.emit('eyepieceStatus', { sampleId: 'diatom_test', text: 'Out of focus: turn the focus knob.' });
    ask();
    expect(text).toBe('Out of focus: turn the focus knob.');
    ctx.bus.emit('eyepieceStatus', { sampleId: 'diatom_test', text: 'Align the condenser (Köhler illumination).' });
    ask();
    expect(text).toBe('Align the condenser (Köhler illumination).');
    // Item questions still take priority over image advice.
    ctx.bus.emit('guideAsked', { question: 'where is quartz sand?' });
    expect(text).toContain('White crystal clusters');
    ctx.bus.emit('openEyepiece', { sampleId: 'leaf' });
    ask();
    expect(text).toContain('Wait for the eyepiece');
    ctx.bus.emit('closeEyepiece', {});
    ctx.bus.emit('openEyepiece', { sampleId: 'diatom_test' });
    ask();
    expect(text).toContain('Wait for the eyepiece');
    dispose();
    text = '';
    ask();
    expect(text).toBe('');
  });

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
    ctx.state.inventory = { hand_lens: 1 };
    ctx.bus.emit('guideAsked', { question: 'what next' });
    expect(text).toMatch(/Next goal: Compound microscope\. Look \[F\] at a Grey rock with your Hand lens to spot Copper veins/);
  });
});
