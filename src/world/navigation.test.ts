import { describe, expect, it } from 'vitest';
import { BRIDGE_RAILS, groundAt } from './campus';
import { areaAt, arrowTo, collide, heading, PLAYER_RADIUS } from './navigation';
import { deepWater, gorgeZ, heightAt, LAKE, TRAILS } from './terrain';

describe('walking around', () => {
  const wall = { x0: 0, x1: 4, z0: 0, z1: 2 };

  it('pushes the player out of a wall to arm’s length, and out the nearest side when inside it', () => {
    const p = { x: -0.1, z: 1 };
    collide(p, [wall], []);
    expect(p).toEqual({ x: -PLAYER_RADIUS, z: 1 });
    const inside = { x: 3.9, z: 1 };
    collide(inside, [wall], []);
    expect(inside).toEqual({ x: 4 + PLAYER_RADIUS, z: 1 });
  });

  it('pushes the player out of solids, but walks through gathered ones and zero-radius ones', () => {
    const p = { x: 0.5, z: 0 };
    collide(p, [], [{ x: 0, z: 0, radius: 0.5 }]);
    expect(p.x).toBeCloseTo(0.5 + PLAYER_RADIUS);
    const q = { x: 0.5, z: 0 };
    collide(q, [], [{ x: 0, z: 0, radius: 0.5, alive: false }, { x: 0.4, z: 0, radius: 0 }]);
    expect(q).toEqual({ x: 0.5, z: 0 });
  });

  it('names the area and points the way', () => {
    expect(areaAt(LAKE.x, LAKE.z)).toBe('lake');
    expect(areaAt(0, -20)).toBe('quad');
    // the corners: the dorms, the woods west of them, past the lake, west campus, the quarry, the farm and the cornfield
    expect([[26, -100], [-40, -100], [95, -75], [-100, 5], [-82, 74], [95, 80], [0, 125]].map(([x, z]) => areaAt(x!, z!)))
      .toEqual(['north', 'woods', 'orchard', 'shore', 'quarry', 'farm', 'farm']);
    expect(areaAt(-60, 0)).toBe('slope'); // the slope lawn stays the slope
    expect(heading(0, -1)).toBe('N');
    expect(heading(1, 0)).toBe('E');
    expect(arrowTo(0, -10, 0, -1)).toBe('↑ 10 m'); // looking north, target to the north
    expect(arrowTo(10, 0, 0, -1)).toBe('→ 10 m'); // looking north, target to the east
  });

  it('the bridge deck carries you over the gorge, its screens keep you on it, and you can walk under it', () => {
    expect(groundAt(26, -67, 0.75)).toBeCloseTo(0.75);
    expect(groundAt(26, -67, -9)).toBeLessThan(-8);
    expect(areaAt(26, -67)).toBe('bridge');
    const p = { x: 26.8, z: -67 };
    collide(p, BRIDGE_RAILS, []);
    expect(p.x).toBeLessThan(26.61);
  });

  it('the creek is off limits, but the ledge beside it is dry and the trails lead down to it', () => {
    expect(deepWater(0, gorgeZ(0))).toBe(true);
    expect(deepWater(0, gorgeZ(0) + 5)).toBe(false);
    expect(deepWater(LAKE.x, LAKE.z)).toBe(false); // the small lake can be waded
    for (const t of TRAILS) {
      expect(deepWater(t.bottom, t.z1)).toBe(false);
      expect(heightAt(t.bottom, t.z1)).toBeLessThan(-8);
    }
  });
});
