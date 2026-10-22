import { describe, expect, it } from 'vitest';
import { areaAt, arrowTo, collide, heading, PLAYER_RADIUS } from './navigation';
import { LAKE } from './terrain';

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
    expect(heading(0, -1)).toBe('N');
    expect(heading(1, 0)).toBe('E');
    expect(arrowTo(0, -10, 0, -1)).toBe('↑ 10 m'); // looking north, target to the north
    expect(arrowTo(10, 0, 0, -1)).toBe('→ 10 m'); // looking north, target to the east
  });
});
