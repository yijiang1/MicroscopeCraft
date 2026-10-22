// The column on the electron bench: which parts are stacked, the vacuum, the high voltage, the filament and the
// objective aperture. No DOM and no Three.js, so the rules are testable. The optics come from shared/sim/column.ts,
// the same formulas that turn the finished build into the microscope the game uses.
import type { TemBuild } from '../shared/schema';

export type ColumnPartId = 'vacuum' | 'screen' | 'projector' | 'objective' | 'condenser' | 'gun';

export interface ColumnPart {
  id: ColumnPartId;
  name: string;
  /** Inventory item the part is (the recipe's inputs). */
  item: string;
  needs: ColumnPartId[];
  about: string;
}

/** A TEM is built up from its base, so each part stands on the one before. */
export const COLUMN_PARTS: readonly ColumnPart[] = [
  { id: 'vacuum', name: 'Vacuum system', item: 'vacuum_system', needs: [], about: 'The base: pumps and the sealed tube that every other part bolts onto.' },
  { id: 'screen', name: 'Viewing chamber', item: 'viewing_screen', needs: ['vacuum'], about: 'The bottom of the column. Its screen glows green where electrons land, seen through a lead-glass window that stops the X-rays they make.' },
  { id: 'projector', name: 'Projector lenses', item: 'projector_lenses', needs: ['screen'], about: 'Magnify the first image again and spread it over the screen.' },
  { id: 'objective', name: 'Objective lens and stage', item: 'objective_assembly', needs: ['projector'], about: 'The strongest lens. The sample slides into the gap between its pole pieces on the end of a rod, and the objective aperture sits just below it.' },
  { id: 'condenser', name: 'Condenser lenses', item: 'condenser_lenses', needs: ['objective'], about: 'Gather the electrons from the gun into the beam that lights the sample.' },
  { id: 'gun', name: 'Electron gun', item: 'electron_gun', needs: ['condenser'], about: 'On top, closing the column: the filament, the Wehnelt cap and the high-voltage cable.' },
];
export const columnPart = (id: ColumnPartId) => COLUMN_PARTS.find((p) => p.id === id)!;

/** Air, Pa. */
export const AIR_PA = 1e5;
/** The gun and the high voltage stay locked out until the column is below this, Pa. A hot tungsten filament burns
 *  through in air and needs better than 10⁻² Pa; at 10⁻⁴ Pa a gas molecule flies tens of metres between collisions,
 *  far longer than the column. */
export const READY_PA = 1e-4;
/** Where the pumps level off, Pa. */
export const BASE_PA = 5e-6;
/** Pump-down speed in decades of pressure per second: the roughing pump down to 1 Pa, then the high-vacuum pump.
 *  Simplification: minutes in a real column, seconds here. */
const ROUGH_RATE = 2;
const HIGH_RATE = 1.5;

/** Filament heating (0..1 of the supply) where the emission levels off: saturation. */
export const SATURATION = 0.75;
/** How far past saturation still counts as set right. */
export const SATURATION_WINDOW = 0.06;

export interface ColumnDraft {
  placed: ColumnPartId[];
  pressurePa: number;
  pumping: boolean;
  /** 0 = high voltage off. */
  kV: number;
  /** Filament heating, 0..1. */
  heat: number;
  /** Hole in the beam, µm diameter; null = the strip pulled out. */
  apertureUm: number | null;
  name: string;
}

export const newColumn = (): ColumnDraft => ({ placed: [], pressurePa: AIR_PA, pumping: false, kV: 0, heat: 0, apertureUm: null, name: '' });

/** A TEM you built before, back on the bench running as you left it. */
export const columnFromBuild = (b: TemBuild): ColumnDraft => ({
  placed: COLUMN_PARTS.map((p) => p.id), pressurePa: BASE_PA, pumping: false, kV: b.kV, heat: SATURATION + SATURATION_WINDOW / 3, apertureUm: b.apertureUm, name: b.name,
});

export const complete = (d: ColumnDraft) => COLUMN_PARTS.every((p) => d.placed.includes(p.id));
export const pumped = (d: ColumnDraft) => d.pressurePa <= READY_PA;
export const canPlace = (d: ColumnDraft, id: ColumnPartId) => !d.placed.includes(id) && columnPart(id).needs.every((n) => d.placed.includes(n));

export function place(d: ColumnDraft, id: ColumnPartId): boolean {
  if (!canPlace(d, id)) return false;
  d.placed.push(id);
  return true;
}

/** Why the pumps won't start: the column must be closed at the top by the gun. */
export const canPump = (d: ColumnDraft) => complete(d);

/** Run the pumps for `seconds`. Returns true once the column is ready. */
export function pump(d: ColumnDraft, seconds: number): boolean {
  if (!canPump(d)) return false;
  let lg = Math.log10(d.pressurePa);
  let t = seconds;
  while (t > 0 && lg > Math.log10(BASE_PA)) {
    const rate = lg > 0 ? ROUGH_RATE : HIGH_RATE;
    const dt = lg > 0 ? Math.min(t, lg / rate + 1e-9) : t;
    lg -= rate * dt;
    t -= dt;
  }
  d.pressurePa = Math.max(BASE_PA, 10 ** lg);
  return pumped(d);
}

/** Let air back in: everything that needs the vacuum goes off. */
export function vent(d: ColumnDraft) {
  d.pressurePa = AIR_PA;
  d.pumping = false;
  d.kV = 0;
  d.heat = 0;
}

/** Set the high voltage (0 = off). Refused while the column holds gas. Switching it off also cools the filament,
 *  whose heating supply sits at the gun's high voltage. */
export function setKV(d: ColumnDraft, kV: number): boolean {
  if (kV > 0 && !pumped(d)) return false;
  d.kV = kV;
  if (!kV) d.heat = 0;
  return true;
}

/** Heat the filament; it needs the high voltage on to pull the electrons away. */
export function setHeat(d: ColumnDraft, heat: number): boolean {
  if (heat > 0 && !d.kV) return false;
  d.heat = Math.min(1, Math.max(0, heat));
  return true;
}

export const setAperture = (d: ColumnDraft, um: number | null) => void (d.apertureUm = um);

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Beam current from the gun, as a share of the saturated current. Warming the hairpin, electrons first boil off one
 *  hot spot (a false peak, then a dip), then the whole tip; past saturation the Wehnelt's self-bias holds the
 *  current steady however hot the filament runs. Simplification: a curve with that shape, not a model of one gun. */
export function emission(heat: number): number {
  const rise = Math.min(1, Math.max(0, (heat - 0.35) / (SATURATION - 0.35))) ** 3;
  const falsePeak = 0.3 * Math.exp(-(((heat - 0.56) / 0.04) ** 2)) * (1 - smooth(0.6, SATURATION, heat));
  return rise * (0.92 + 0.08 * smooth(SATURATION, 1, heat)) + falsePeak;
}

export type FilamentState = 'cold' | 'under' | 'saturated' | 'over';
export function filamentState(heat: number): FilamentState {
  if (heat < 0.35) return 'cold';
  if (heat < SATURATION) return 'under';
  return heat <= SATURATION + SATURATION_WINDOW ? 'saturated' : 'over';
}

/** Filament life against running at saturation. Illustrative: tungsten evaporates faster the hotter it runs, so a
 *  filament run hot burns out much sooner and gives no more current. */
export const filamentLife = (heat: number) => Math.min(1, Math.exp(-(heat - SATURATION) * 14));

export interface ColumnStep {
  id: 'stack' | 'pump' | 'hv' | 'filament' | 'aperture';
  label: string;
  done: boolean;
}

export function columnSteps(d: ColumnDraft): ColumnStep[] {
  return [
    { id: 'stack', label: 'Stack the column from the bottom up', done: complete(d) },
    { id: 'pump', label: 'Pump the air out of the column', done: complete(d) && pumped(d) },
    { id: 'hv', label: 'Switch on the high voltage', done: complete(d) && pumped(d) && d.kV > 0 },
    { id: 'filament', label: 'Heat the filament to saturation, and no further', done: complete(d) && d.kV > 0 && filamentState(d.heat) === 'saturated' },
    { id: 'aperture', label: 'Slide an objective aperture into the beam', done: d.apertureUm !== null },
  ];
}

/** The build as the game keeps it, or null while a step is left. */
export function toTemBuild(d: ColumnDraft): TemBuild | null {
  if (!columnSteps(d).every((s) => s.done) || d.apertureUm === null) return null;
  return { kind: 'tem', kV: d.kV, apertureUm: d.apertureUm, name: d.name.slice(0, 24) };
}
