import { describe, expect, it } from 'vitest';
import { createScientistLife, ROAM_RADIUS } from './scientist-life';
const home = { id: 'a', x: 0, z: 0, facing: 0 };
const player = { x: 100, z: 100 };
describe('scientist life', () => {
  it('keeps roaming inside the home radius and respects blocked steps', () => {
    const life = createScientistLife([home], () => 0.37);
    for (let i = 0; i < 2000; i++) {
      life.update(0.1, player, () => true);
      expect(Math.hypot(life.walkers[0]!.x, life.walkers[0]!.z)).toBeLessThanOrEqual(ROAM_RADIUS + 1e-8);
    }
    const blocked = createScientistLife([home]);
    for (let i = 0; i < 100; i++) blocked.update(0.1, player, () => false);
    expect(blocked.walkers[0]!.x).toBe(0);
    expect(blocked.walkers[0]!.z).toBe(0);
  });
  it('stops near the player and during pauses', () => {
    const life = createScientistLife([home]);
    life.update(0.1, home, () => true);
    expect(life.walkers[0]!.moving).toBe(false);
    life.update(0.1, player, () => true, true);
    expect(life.walkers[0]!.x).toBe(0);
  });
  it('alternates speech between nearby partners then releases them', () => {
    const life = createScientistLife([home, { ...home, id: 'b', x: 3 }], () => 0);
    for (let i = 0; i < 20; i++) life.update(0.1, player, () => true);
    expect(life.walkers.filter(w => w.speech)).toHaveLength(1);
    const first = life.walkers.find(w => w.speech)!.id;
    for (let i = 0; i < 60; i++) life.update(0.1, player, () => true);
    expect(life.walkers.find(w => w.speech)!.id).not.toBe(first);
    for (let i = 0; i < 120; i++) life.update(0.1, player, () => true);
    expect(life.walkers.every(w => !w.speech)).toBe(true);
  });
  it('does not pair scientists across a blocked route', () => {
    const life = createScientistLife([home, { ...home, id: 'b', x: 3 }]);
    for (let i = 0; i < 100; i++) life.update(0.1, player, () => false);
    expect(life.walkers.every(w => !w.speech)).toBe(true);
  });
});
