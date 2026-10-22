import { describe, expect, it } from 'vitest';
import { driveStep, TEST_DRIVE_MS } from './miata';
describe('Miata driving', () => {
  it('accelerates, coasts to a stop, reverses and limits speed', () => {
    expect(driveStep(0,1,0,0,.1).speed).toBeGreaterThan(0);
    expect(driveStep(5,0,0,0,.1).speed).toBeLessThan(5);
    expect(driveStep(0,-1,0,0,.1).dz).toBeGreaterThan(0);
    expect(driveStep(15,1,0,0,.1).speed).toBeLessThanOrEqual(15);
  });
  it('steers with motion, rather than rotating a stationary car', () => {
    expect(driveStep(0,0,1,0,.1).yaw).toBe(0);
    expect(driveStep(5,1,1,0,.1).yaw).toBeGreaterThan(0);
    expect(driveStep(-3,-1,1,0,.1).yaw).toBeLessThan(0);
    expect(TEST_DRIVE_MS).toBe(30000);
  });
});
