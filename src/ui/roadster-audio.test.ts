import { expect, it } from 'vitest';
import { roadsterVoice } from './roadster-audio';
it('idles, revs under load, and drops pitch on an upshift', () => {
  const idle=roadsterVoice(0,0), rev=roadsterVoice(0,1);
  expect(idle.frequency).toBeGreaterThan(20);
  expect(rev.frequency).toBeGreaterThan(idle.frequency);
  expect(rev.exhaustGain).toBeGreaterThan(idle.exhaustGain);
  expect(roadsterVoice(3.9,1).frequency).toBeGreaterThan(roadsterVoice(4.1,1).frequency);
  expect(roadsterVoice(-3,-1)).toEqual(roadsterVoice(3,1));
  expect(roadsterVoice(100,10)).toEqual(roadsterVoice(15,1));
});
