import { describe, expect, it } from 'vitest';
import { loadGameData } from '../shared/data';
import { AIMS, PLACEMENTS, RADIUS, type Kind } from './placements';
import { heightAt, LAB, POND, WATER_LEVEL, WORLD_RADIUS } from './terrain';

const data = loadGameData();

describe('world layout', () => {
  it('every placed thing gathers a real item and/or shows a real sample', () => {
    for (const kind of Object.keys(AIMS) as Kind[]) {
      const { gather, sample } = AIMS[kind];
      expect(gather || sample, kind).toBeTruthy();
      if (gather) expect(data.items[gather], `${kind} gathers ${gather}`).toBeDefined();
      if (sample) expect(data.samples[sample], `${kind} shows ${sample}`).toBeDefined();
      expect(RADIUS[kind]).toBeGreaterThanOrEqual(0);
    }
  });

  it('every raw material and every sample is reachable somewhere', () => {
    const gatherable = new Set(PLACEMENTS.map((p) => AIMS[p.kind].gather).filter(Boolean));
    for (const id of Object.keys(data.materials).filter((m) => m !== 'leaf_fiber')) expect(gatherable.has(id), id).toBe(true);
    const seen = new Set(PLACEMENTS.map((p) => AIMS[p.kind].sample).filter(Boolean));
    for (const id of Object.keys(data.samples)) expect(seen.has(id), id).toBe(true);
  });

  it('enough nodes to finish the tech tree without waiting for regrowth', () => {
    const count = (item: string) => PLACEMENTS.filter((p) => AIMS[p.kind].gather === item).length;
    // raw material totals from README "What to build"
    const need = { beach_sand: 8, iron_ore: 7, copper_ore: 6, quartz_sand: 6, plant_oil: 1, tungsten_ore: 1, resin: 2 };
    for (const [item, n] of Object.entries(need)) expect(count(item), item).toBeGreaterThanOrEqual(n);
  });

  it('everything stands on dry land inside the map; only the pond sits in water', () => {
    for (const p of PLACEMENTS) {
      expect(Math.hypot(p.x, p.z), `${p.kind} radius`).toBeLessThan(WORLD_RADIUS - 8);
      if (p.kind !== 'pond') expect(heightAt(p.x, p.z), `${p.kind} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBeGreaterThan(WATER_LEVEL + 0.15);
    }
  });

  it('terrain is deterministic, finite, and flat enough at the spawn', () => {
    expect(heightAt(12.3, -4.5)).toBe(heightAt(12.3, -4.5));
    expect(Number.isFinite(heightAt(-70, 40))).toBe(true);
    expect(Math.abs(heightAt(0, 0))).toBeLessThan(1);
    expect(heightAt(POND.x, POND.z)).toBeLessThan(WATER_LEVEL - 1); // pond is a real basin
    expect(Math.abs(heightAt(LAB.x, LAB.z) - 0.5)).toBeLessThan(0.01); // lab pad is flat
  });
});
