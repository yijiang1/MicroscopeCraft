import { describe, expect, it } from 'vitest';
import { loadGameData } from '../shared/data';
import { AIMS, PLACEMENTS, RADIUS, SPAWN, type Kind } from './placements';
import { insideBuilding, SCIENCE } from './campus';
import { heightAt, LAKE, waterLevelAt, WATER_LEVEL, WORLD_RADIUS } from './terrain';

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

  it('everything stands on dry land inside the map and outside buildings; only the lake sits in water', () => {
    for (const p of PLACEMENTS) {
      const at = `${p.kind} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`;
      expect(Math.hypot(p.x, p.z), `${p.kind} radius`).toBeLessThan(WORLD_RADIUS - 8);
      expect(insideBuilding(p.x, p.z, 1), at).toBe(false);
      if (p.kind !== 'pond') expect(heightAt(p.x, p.z), at).toBeGreaterThan(waterLevelAt(p.x, p.z) + 0.15);
    }
  });

  it('terrain is deterministic, finite, and flat enough at the spawn', () => {
    expect(heightAt(12.3, -4.5)).toBe(heightAt(12.3, -4.5));
    expect(Number.isFinite(heightAt(-70, 40))).toBe(true);
    expect(Math.abs(heightAt(SPAWN.x, SPAWN.z))).toBeLessThan(1);
    expect(insideBuilding(SPAWN.x, SPAWN.z, 2)).toBe(false);
    // the first materials (sand, then iron for the hand lens) are close to the start
    const nearest = (kind: Kind) => Math.min(...PLACEMENTS.filter((p) => p.kind === kind).map((p) => Math.hypot(p.x - SPAWN.x, p.z - SPAWN.z)));
    expect(nearest('sand')).toBeLessThan(15);
    expect(nearest('iron')).toBeLessThan(20);
    expect(nearest('leaf')).toBeLessThan(10);
    expect(heightAt(LAKE.x, LAKE.z)).toBeLessThan(WATER_LEVEL - 1); // the lake is a real basin
    for (const [x, z] of [[SCIENCE.x0, SCIENCE.z0], [SCIENCE.x1, SCIENCE.z1]]) expect(Math.abs(heightAt(x!, z!) - 0.5)).toBeLessThan(0.01); // the lab floor is flat
    expect(heightAt(-75, 0)).toBeLessThan(heightAt(-40, 0) - 6); // the west slope falls away to the west
  });
});
