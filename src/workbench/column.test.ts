import { describe, expect, it } from 'vitest';
import {
  AIR_PA, columnFromBuild, columnSteps, COLUMN_PARTS, emission, filamentState, newColumn, place, pump, READY_PA, SATURATION, setAperture,
  setHeat, setKV, toTemBuild, vent,
} from './column';

const stacked = () => {
  const d = newColumn();
  for (const p of COLUMN_PARTS) expect(place(d, p.id), p.id).toBe(true);
  return d;
};

describe('the electron bench column', () => {
  it('goes together from the bottom up', () => {
    const d = newColumn();
    expect(place(d, 'gun')).toBe(false);
    expect(place(d, 'vacuum')).toBe(true);
    expect(place(d, 'objective')).toBe(false);
    expect(place(d, 'screen')).toBe(true);
  });

  it('pumps only when closed, and takes seconds to get below the ready pressure', () => {
    const open = newColumn();
    place(open, 'vacuum');
    expect(pump(open, 10)).toBe(false);
    expect(open.pressurePa).toBe(AIR_PA);
    const d = stacked();
    expect(pump(d, 1)).toBe(false);
    expect(pump(d, 5)).toBe(true);
    expect(d.pressurePa).toBeLessThanOrEqual(READY_PA);
  });

  it('locks out the high voltage in air, and the filament without high voltage', () => {
    const d = stacked();
    expect(setKV(d, 200)).toBe(false);
    expect(setHeat(d, 0.5)).toBe(false);
    pump(d, 10);
    expect(setHeat(d, 0.5)).toBe(false);
    expect(setKV(d, 200)).toBe(true);
    expect(setHeat(d, 0.5)).toBe(true);
    vent(d);
    expect(d.kV).toBe(0);
    expect(d.heat).toBe(0);
  });

  it('emission has a false peak below saturation and levels off above it', () => {
    expect(emission(0.57)).toBeGreaterThan(emission(0.62)); // the false peak, then a dip
    expect(emission(SATURATION)).toBeGreaterThan(0.9);
    expect(emission(1) - emission(SATURATION)).toBeLessThan(0.1); // hotter gives almost nothing more
    expect(filamentState(0.56)).toBe('under');
    expect(filamentState(SATURATION + 0.02)).toBe('saturated');
    expect(filamentState(0.95)).toBe('over');
  });

  it('becomes a build once every step is done, and comes back the same', () => {
    const d = stacked();
    pump(d, 10);
    setKV(d, 300);
    setHeat(d, SATURATION + 0.02);
    expect(toTemBuild(d)).toBeNull();
    setAperture(d, 40);
    d.name = 'Ruska';
    const b = toTemBuild(d)!;
    expect(b).toEqual({ kind: 'tem', kV: 300, apertureUm: 40, name: 'Ruska' });
    expect(columnSteps(columnFromBuild(b)).every((s) => s.done)).toBe(true);
    setHeat(d, 0.95); // overheated: not saturated "and no further"
    expect(toTemBuild(d)).toBeNull();
  });
});
