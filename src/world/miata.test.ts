import { describe, expect, it } from 'vitest';
import { blocksRoadster, driveStep, roadsterGradeOK, TEST_DRIVE_MS } from './miata';
describe('Miata driving', () => {
  it('rolls over soft plants while retaining solid obstacles', () => {
    for (const kind of ['flower','leaf','fern','sunflower','sand','mud']) expect(blocksRoadster(kind)).toBe(false);
    for (const kind of ['npc','iron','log','resin','picnic']) expect(blocksRoadster(kind)).toBe(true);
  });
  it('handles gentle slopes and small curbs but rejects ledges', () => {
    expect(roadsterGradeOK(0.9, 1.7)).toBe(true);
    expect(roadsterGradeOK(-0.9, 1.7)).toBe(true);
    expect(roadsterGradeOK(0.12, 0.05)).toBe(true);
    expect(roadsterGradeOK(0.5, 0.1)).toBe(false);
    expect(roadsterGradeOK(-3, 1.7)).toBe(false);
  });
  it('accelerates, coasts to a stop, reverses and limits speed', () => {
    expect(driveStep(0,1,0,0,.1).speed).toBeGreaterThan(0);
    expect(driveStep(5,0,0,0,.1).speed).toBeLessThan(5);
    expect(driveStep(0,-1,0,0,.1).dz).toBeGreaterThan(0);
    expect(driveStep(15,1,0,0,.1).speed).toBeLessThanOrEqual(15);
  });
  it('makes a tight full-lock turn at both low and high speeds', () => {
    for (const speed of [2, 12]) {
      const step = driveStep(speed, 1, 1, 0, 0.05);
      const radius = Math.hypot(step.dx, step.dz) / Math.abs(step.yaw);
      expect(radius).toBeGreaterThanOrEqual(5.5);
      expect(radius).toBeLessThanOrEqual(6.5);
    }
  });
  it('steers with motion, rather than rotating a stationary car', () => {
    expect(driveStep(0,0,1,0,.1).yaw).toBe(0);
    expect(driveStep(5,1,1,0,.1).yaw).toBeGreaterThan(0);
    expect(driveStep(-3,-1,1,0,.1).yaw).toBeLessThan(0);
    expect(TEST_DRIVE_MS).toBe(30000);
  });
});
