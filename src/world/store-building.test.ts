import { describe, expect, it } from 'vitest';
import { FOOTPRINTS, groundAt, insideBuilding } from './campus';
import { collide } from './navigation';
import { STORE_COUNTER, STORE_FOOTPRINT, STORE_WALLS } from './store-building';
import { PLACEMENTS } from './placements';
describe('microscope store', () => {
  it('leaves a continuous walkable route through the south entrance to the counter', () => {
    for (let z = 40; z >= STORE_COUNTER.z + 1.5; z -= 0.1) {
      const p = { x: STORE_COUNTER.x, z };
      collide(p, STORE_WALLS, [{ ...STORE_COUNTER, radius: 1 }]);
      expect(p.x).toBe(STORE_COUNTER.x); expect(p.z).toBeCloseTo(z);
      expect(groundAt(p.x, p.z)).toBeCloseTo(groundAt(STORE_COUNTER.x, STORE_COUNTER.z));
    }
  });
  it('keeps the exterior walls solid and excludes scenery from the footprint', () => {
    const p = { x: STORE_FOOTPRINT.x0, z: 32 }; collide(p, STORE_WALLS, []);
    expect(p.x).not.toBe(STORE_FOOTPRINT.x0);
    expect(insideBuilding(STORE_COUNTER.x, STORE_COUNTER.z)).toBe(true);
  });
  it('does not overlap another building or a collectible', () => {
    const s = STORE_FOOTPRINT;
    for (const b of FOOTPRINTS.filter(b => b !== s)) expect(s.x0 < b.x1 && s.x1 > b.x0 && s.z0 < b.z1 && s.z1 > b.z0).toBe(false);
    expect(PLACEMENTS.some(p => p.x > s.x0 && p.x < s.x1 && p.z > s.z0 && p.z < s.z1)).toBe(false);
  });
});
