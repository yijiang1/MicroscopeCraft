import { describe, expect, it } from 'vitest';
import { advanceLift, constrainTerrace, LANDING_PANELS, LIFT, nearLift, TERRACE } from './tower-lift';
describe('tower elevator', () => {
  it('travels both ways at a bounded speed and stops precisely at each landing', () => {
    expect(advanceLift(0, LIFT.rise, 1)).toBe(3);
    expect(advanceLift(29.9, LIFT.rise, 1)).toBe(LIFT.rise);
    expect(advanceLift(30, 0, 1)).toBe(27);
    expect(advanceLift(0.1, 0, 1)).toBe(0);
    expect(advanceLift(10, 30, 0)).toBe(10);
  });
  it('leaves a cabin-sized opening in the upper landing without overlapping floor faces', () => {
    for (const panel of LANDING_PANELS) {
      const overlapX = Math.min(panel.x + panel.w / 2, LIFT.x + LIFT.half) - Math.max(panel.x - panel.w / 2, LIFT.x - LIFT.half);
      const overlapZ = Math.min(panel.z + panel.d / 2, LIFT.z + LIFT.half) - Math.max(panel.z - panel.d / 2, LIFT.z - LIFT.half);
      expect(Math.min(overlapX, overlapZ)).toBeLessThan(1e-8);
    }
    const area = LANDING_PANELS.reduce((sum, p) => sum + p.w * p.d, 0);
    expect(area + (LIFT.half * 2) ** 2).toBeCloseTo(3 * 5);
  });
  it('keeps visitors behind the terrace railing', () => {
    const p = { x: -100, z: 100 }; constrainTerrace(p);
    expect(p.x).toBe(TERRACE.x0 + 0.4); expect(p.z).toBe(TERRACE.z1 - 0.4);
    expect(nearLift(LIFT.x,LIFT.z)).toBe(true);
    expect(nearLift(-38,-1)).toBe(false);
  });
});
