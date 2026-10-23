import { expect, it } from 'vitest';
import { exhaustCycle, roadsterVoice } from './roadster-audio';
it('idles, revs under load, and drops pitch on an upshift', () => {
  const idle=roadsterVoice(0,0), rev=roadsterVoice(0,1);
  expect(idle.frequency).toBeGreaterThan(20);
  expect(rev.frequency).toBeGreaterThan(idle.frequency);
  expect(rev.exhaustGain).toBeGreaterThan(idle.exhaustGain);
  expect(roadsterVoice(3.9,1).frequency).toBeGreaterThan(roadsterVoice(4.1,1).frequency);
  expect(roadsterVoice(-3,-1)).toEqual(roadsterVoice(3,1));
  expect(roadsterVoice(100,10)).toEqual(roadsterVoice(15,1));
});

it('produces distinct bounded exhaust banks without DC offset', () => {
  const left = exhaustCycle(48000, 0), right = exhaustCycle(48000, 1);
  expect(left.length).toBe(8000);
  expect(left).not.toEqual(right);
  for (const bank of [left, right]) {
    expect(bank.every(Number.isFinite)).toBe(true);
    expect(Math.max(...bank.map(Math.abs))).toBeLessThanOrEqual(.801);
    expect(Math.abs(bank.reduce((sum,n)=>sum+n,0)/bank.length)).toBeLessThan(.00001);
    expect(Math.abs(bank[0]!-bank[bank.length-1]!)).toBeLessThan(.03);
  }
});
