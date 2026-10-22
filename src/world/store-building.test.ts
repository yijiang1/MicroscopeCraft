import { STORE_FURNITURE } from './store-interior';
import { describe, expect, it } from 'vitest';
import { FOOTPRINTS, groundAt, insideBuilding } from './campus';
import { collide } from './navigation';
import { heightAt } from './terrain';
import { STORE_FLOOR_HALF, STORE_FLOOR_RISE, STORE_COUNTER, STORE_FOOTPRINT, STORE_WALLS } from './store-building';
import { PLACEMENTS } from './placements';
describe('microscope store', () => {
  it('leaves a continuous walkable route through the south entrance to the counter', () => {
    for (let z = 40; z >= STORE_COUNTER.z + 1.5; z -= 0.1) {
      const p = { x: STORE_COUNTER.x, z };
      collide(p, [...STORE_WALLS, ...STORE_FURNITURE], [{ ...STORE_COUNTER, radius: 1 }]);
      expect(p.x).toBe(STORE_COUNTER.x); expect(p.z).toBeCloseTo(z);
      expect(Math.abs(groundAt(p.x, p.z) - groundAt(STORE_COUNTER.x, STORE_COUNTER.z))).toBeLessThanOrEqual(STORE_FLOOR_RISE + 1e-8);
    }
  });
  it('leaves a route around the counter and car into the fitting booth', () => {
    const walls = [...STORE_WALLS, ...STORE_FURNITURE, {x0:-9.35,x1:-7.65,z0:30.9,z1:34.7}];
    const route = [[-14,36],[-14,29.55],[-8.6,29.55],[-8.6,28.8]];
    for(let i=1;i<route.length;i++) {
      const a=route[i-1]!,b=route[i]!;
      for(let step=0;step<=100;step++) {
        const x=a[0]!+(b[0]!-a[0]!)*step/100,z=a[1]!+(b[1]!-a[1]!)*step/100;
        const p={x,z};collide(p,walls,[{...STORE_COUNTER,radius:1},{x:-8.6,z:27.4,radius:1}]);
        expect(p.x).toBeCloseTo(x);expect(p.z).toBeCloseTo(z);
      }
    }
  });
  it('keeps the walking surface above terrain across the entire slab, with no offset outside', () => {
    for (let x = -12 - STORE_FLOOR_HALF; x <= -12 + STORE_FLOOR_HALF; x += 0.5) {
      for (let z = 32 - STORE_FLOOR_HALF; z <= 32 + STORE_FLOOR_HALF; z += 0.5) {
        expect(groundAt(x, z) - heightAt(x, z)).toBeCloseTo(STORE_FLOOR_RISE);
      }
    }
    expect(groundAt(-12, 38.4)).toBe(heightAt(-12, 38.4));
    expect(groundAt(-18.4, 32)).toBe(heightAt(-18.4, 32));
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
