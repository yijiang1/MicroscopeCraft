import { expect, it } from 'vitest';
import { freeLookStep } from './free-look';
it('keeps forward and strafe movement relative to the locked character heading', () => {
  expect(freeLookStep(0,1,0,2)).toEqual({x:0,z:-2});
  const west=freeLookStep(Math.PI/2,1,0,2);
  expect(west.x).toBeCloseTo(-2);expect(west.z).toBeCloseTo(0);
  const strafe=freeLookStep(Math.PI/2,0,1,2);
  expect(strafe.x).toBeCloseTo(0);expect(strafe.z).toBeCloseTo(-2);
  const diagonal=freeLookStep(.8,1,1,2/Math.sqrt(2));
  expect(Math.hypot(diagonal.x,diagonal.z)).toBeCloseTo(2);
});
