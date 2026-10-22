import { describe, expect, it } from 'vitest';
import { loadGameData } from '../shared/data';
import { nextGoalRecipe, planFor } from '../shared/plan';
import { AIMS, INDOORS, PLACEMENTS, RADIUS, samplesOf, SPAWN, type Kind } from './placements';
import { GREENHOUSE, inAtrium, inChess, inGreenhouse, inLab, insideBuilding, INDOOR_SOLIDS, SCIENCE, WILSON } from './campus';
import { heightAt, LAKE, waterLevelAt, WATER_LEVEL, WORLD_RADIUS } from './terrain';

const data = loadGameData();

describe('world layout', () => {
  it('every placed thing gathers a real item and/or shows real samples', () => {
    for (const kind of Object.keys(AIMS) as Kind[]) {
      const aim = AIMS[kind];
      expect(aim.gather || samplesOf(aim).length, kind).toBeTruthy();
      if (aim.gather) expect(data.items[aim.gather], `${kind} gathers ${aim.gather}`).toBeDefined();
      for (const s of samplesOf(aim)) expect(data.samples[s], `${kind} shows ${s}`).toBeDefined();
      expect(RADIUS[kind]).toBeGreaterThanOrEqual(0);
    }
  });

  it('every raw material and every sample is reachable somewhere', () => {
    const gatherable = new Set(PLACEMENTS.map((p) => AIMS[p.kind].gather).filter(Boolean));
    for (const id of Object.keys(data.materials).filter((m) => m !== 'leaf_fiber')) expect(gatherable.has(id), id).toBe(true);
    const seen = new Set(PLACEMENTS.flatMap((p) => samplesOf(AIMS[p.kind])));
    for (const id of Object.keys(data.samples)) expect(seen.has(id), id).toBe(true);
  });

  it('enough nodes to build any one instrument without waiting for regrowth', () => {
    const count = (item: string) => PLACEMENTS.filter((p) => AIMS[p.kind].gather === item).length;
    const need: Record<string, number> = {};
    const stages: Record<string, number>[] = [{}, { hand_lens: 1 }, { compound_microscope: 1 }, { hq_microscope: 1 }, { fluorescence_microscope: 1 }, { electron_microscope: 1 }, { stem_microscope: 1 }];
    for (const owned of stages) {
      const goal = nextGoalRecipe(data, { inventory: owned })!;
      for (const m of planFor(goal, data, owned).missing) need[m.itemId] = Math.max(need[m.itemId] ?? 0, m.count);
    }
    expect(Object.keys(need).length).toBeGreaterThan(10);
    for (const [item, n] of Object.entries(need)) expect(count(item), item).toBeGreaterThanOrEqual(Math.min(n, 12));
  });

  it('everything stands on dry land inside the map; outdoor things outside buildings, indoor things inside', () => {
    for (const p of PLACEMENTS) {
      const at = `${p.kind} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`;
      expect(Math.hypot(p.x, p.z), `${p.kind} radius`).toBeLessThan(WORLD_RADIUS - 8);
      if (INDOORS.has(p.kind)) expect(inLab(p.x, p.z) || inChess(p.x, p.z) || inGreenhouse(p.x, p.z) || inAtrium(p.x, p.z), at).toBe(true);
      else expect(insideBuilding(p.x, p.z, 1), at).toBe(false);
      if (p.kind !== 'pond' && p.kind !== 'algae_mat') expect(heightAt(p.x, p.z), at).toBeGreaterThan(waterLevelAt(p.x, p.z) + 0.15);
    }
  });

  it('every scientist stands somewhere reachable: on dry ground, out of walls and furniture', () => {
    for (const npc of Object.values(data.npcs)) {
      const at = `${npc.id} at ${npc.x},${npc.z}`;
      expect(heightAt(npc.x, npc.z), at).toBeGreaterThan(waterLevelAt(npc.x, npc.z) + 0.15);
      expect(Math.hypot(npc.x, npc.z), at).toBeLessThan(WORLD_RADIUS - 8);
      const indoors = inLab(npc.x, npc.z) || inChess(npc.x, npc.z) || inGreenhouse(npc.x, npc.z) || inAtrium(npc.x, npc.z);
      if (!indoors) expect(insideBuilding(npc.x, npc.z, 0.5), at).toBe(false);
      for (const b of INDOOR_SOLIDS) expect(npc.x > b.x0 - 0.5 && npc.x < b.x1 + 0.5 && npc.z > b.z0 - 0.5 && npc.z < b.z1 + 0.5, at).toBe(false);
    }
  });

  it('terrain is deterministic, finite, and flat enough at the spawn and under the buildings', () => {
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
    for (const b of [SCIENCE, WILSON, GREENHOUSE]) {
      for (const [x, z] of [[b.x0, b.z0], [b.x1, b.z1], [b.x0, b.z1], [b.x1, b.z0]]) expect(Math.abs(heightAt(x!, z!) - 0.5), `${x},${z}`).toBeLessThan(0.01);
    }
    expect(heightAt(-75, 0)).toBeLessThan(heightAt(-40, 0) - 6); // the west slope falls away to the west
  });
});
