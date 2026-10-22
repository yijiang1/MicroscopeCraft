import { describe, expect, it } from 'vitest';
import { createFootstepTracker } from './footsteps';

describe('footstep timing', () => {
  it('steps from actual travel, and runs at a faster cadence', () => {
    const count = (speed: number, running: boolean) => {
      const tracker = createFootstepTracker();
      let steps = 0;
      for (let i = 0; i < 120; i++) if (tracker.update(speed / 60, true, running)) steps++;
      return steps;
    };
    expect(count(5, false)).toBeGreaterThan(0);
    expect(count(8.5, true)).toBeGreaterThan(count(5, false));
    expect(count(0, false)).toBe(0);
  });
  it('does not step in the air, in menus, on teleport, or when blocked', () => {
    const tracker = createFootstepTracker();
    expect(tracker.update(1, true, false)).toBe(false);
    expect(tracker.update(0.5, false, false)).toBe(false);
    expect(tracker.update(0.5, true, false)).toBe(false);
    expect(tracker.update(20, true, false)).toBe(false);
    expect(tracker.update(0, true, false)).toBe(false);
    expect(tracker.update(1, true, false)).toBe(false);
    expect(tracker.update(0.5, true, false)).toBe(true);
  });
});
