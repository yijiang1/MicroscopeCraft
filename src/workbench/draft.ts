// The build on the workbench: which parts stand on it, the lens blanks and how far each is ground, what is mounted
// where, the tube length and the focus. No DOM and no Three.js, so the rules are testable. The optics come from
// shared/sim/assembly.ts, the same formulas that turn the finished build into the microscope the game uses.
import type { CompoundBuild } from '../shared/schema';
import {
  apertureMm, BLANK_RADIUS_MM, buildIssue, defocusBlurUm, FOCUS_RANGE_MM, imageOffsetMm, MAX_OBJECTIVES, MIN_RADIUS_MM,
  objectiveOptics, STOP_MIN_MM, TUBE_MM, type ObjectiveOptics,
} from '../shared/sim/assembly';
import { abbeLimitUm, effectiveResolutionUm, GREEN_LIGHT_UM } from '../shared/sim/optics';

export type PartId = 'base' | 'arm' | 'stage' | 'lamp' | 'tube' | 'knobs';

export interface PartDef {
  id: PartId;
  name: string;
  /** Inventory item the part is made from; absent = shaped from scrap at the bench (the stand). */
  item?: string;
  needs: PartId[];
  about: string;
}

export const PARTS: readonly PartDef[] = [
  { id: 'base', name: 'Base', needs: [], about: 'A heavy foot, so nothing wobbles.' },
  { id: 'arm', name: 'Arm', needs: ['base'], about: 'Holds the tube over the stage. A toothed rack inside lets the tube slide up and down.' },
  { id: 'stage', name: 'Stage', needs: ['arm'], about: 'The table for the slide, with a hole for the light.' },
  { id: 'lamp', name: 'Lamp', item: 'light_source', needs: ['base'], about: 'Shines up through the hole in the stage and through the slide.' },
  { id: 'tube', name: 'Tube', item: 'tube', needs: ['arm'], about: 'Keeps the objective and the eyepiece on one line and the right distance apart. It telescopes.' },
  { id: 'knobs', name: 'Focus knobs', item: 'focus_knob', needs: ['arm'], about: 'Turn the rack: the big knob moves the tube in millimetres, the small one in thousandths of a millimetre.' },
];

export const partDef = (id: PartId) => PARTS.find((p) => p.id === id)!;

/** Looks, by part. Shapes for the stand; a finish (or a #rrggbb paint) for everything. */
export const STYLE_DEFAULTS: Readonly<Record<string, string>> = {
  base: 'horseshoe', arm: 'curved', stage: 'square',
  baseFinish: 'black', armFinish: 'black', stageFinish: 'black', tubeFinish: 'brass', knobsFinish: 'brass', lampFinish: 'nickel', lensFinish: 'brass',
};
export const SHAPES: Readonly<Partial<Record<PartId, string[]>>> = {
  base: ['horseshoe', 'round', 'square', 'tripod'],
  arm: ['curved', 'pillar', 'swan'],
  stage: ['square', 'round'],
};
export const FINISHES = ['brass', 'black', 'nickel', 'iron', 'wood', 'white', 'red', 'blue', 'green', 'leather'] as const;

export interface Blank {
  id: number;
  radiusMm: number;
  /** Width of the stop in front of it when it is an objective, mm; absent = open. */
  stopMm?: number;
}

export interface Draft {
  placed: PartId[];
  blanks: Blank[];
  /** Blank ids on the revolving nosepiece, in slot order. */
  objectives: number[];
  eyepiece: number | null;
  /** Nosepiece slot in use. */
  active: number;
  tubeMm: number;
  /** Height of the objective lens above the slide, mm: what the focus knobs set. */
  focusMm: number;
  style: Record<string, string>;
  name: string;
  /** Optics (see opticsKey) last seen in focus; the focus step is done while they still match. */
  focusedFor: string | null;
}

/** A fresh, empty workbench with this many lens blanks. */
export function newDraft(blanks: number): Draft {
  return {
    placed: [],
    blanks: Array.from({ length: blanks }, (_, id) => ({ id, radiusMm: BLANK_RADIUS_MM })),
    objectives: [],
    eyepiece: null,
    active: 0,
    tubeMm: TUBE_MM.standard,
    focusMm: 25,
    style: { ...STYLE_DEFAULTS },
    name: '',
    focusedFor: null,
  };
}

/** A microscope you built before, back on the bench as it was (in focus), plus spare blanks to grind. */
export function draftFromBuild(build: CompoundBuild, spareBlanks: number): Draft {
  const lenses = [...build.objectives, build.eyepiece];
  const d: Draft = {
    ...newDraft(0),
    placed: PARTS.map((p) => p.id),
    blanks: [...lenses, ...Array.from({ length: spareBlanks }, () => ({ radiusMm: BLANK_RADIUS_MM }))].map((l: { radiusMm: number; stopMm?: number }, id) => ({ id, radiusMm: l.radiusMm, stopMm: l.stopMm })),
    objectives: build.objectives.map((_, i) => i),
    eyepiece: build.objectives.length,
    tubeMm: build.tubeMm,
    style: { ...STYLE_DEFAULTS, ...build.style },
    name: build.name,
  };
  const o = objectiveOptics(build.objectives[0]!, build.eyepiece, build.tubeMm);
  d.focusMm = o.issue ? 25 : o.workingDistanceMm;
  d.focusedFor = o.issue ? null : opticsKey(d);
  return d;
}

export const blank = (d: Draft, id: number) => d.blanks.find((b) => b.id === id);
export const roleOf = (d: Draft, id: number): 'objective' | 'eyepiece' | null =>
  d.objectives.includes(id) ? 'objective' : d.eyepiece === id ? 'eyepiece' : null;

export const canPlace = (d: Draft, part: PartId) => !d.placed.includes(part) && partDef(part).needs.every((n) => d.placed.includes(n));

export function place(d: Draft, part: PartId): boolean {
  if (!canPlace(d, part)) return false;
  d.placed.push(part);
  return true;
}

/** Lenses go into the tube: the objective at the bottom (on the nosepiece), the eyepiece at the top. */
export const canMount = (d: Draft) => d.placed.includes('tube');

export function mountObjective(d: Draft, id: number): boolean {
  if (!canMount(d) || !blank(d, id) || roleOf(d, id) === 'objective' || d.objectives.length >= MAX_OBJECTIVES) return false;
  if (d.eyepiece === id) d.eyepiece = null;
  d.objectives.push(id);
  d.active = d.objectives.length - 1;
  return true;
}

/** The eyepiece slot holds one lens; a lens already there goes back to the tray. */
export function mountEyepiece(d: Draft, id: number): boolean {
  if (!canMount(d) || !blank(d, id) || d.eyepiece === id) return false;
  unmount(d, id);
  d.eyepiece = id;
  return true;
}

export function unmount(d: Draft, id: number) {
  const i = d.objectives.indexOf(id);
  if (i >= 0) {
    d.objectives.splice(i, 1);
    d.active = Math.min(d.active, Math.max(0, d.objectives.length - 1));
  }
  if (d.eyepiece === id) d.eyepiece = null;
}

/** Seconds of grinding that curve a lens e times more strongly (Shift grinds finer). */
export const GRIND_SECONDS = 1.1;
export const FINE_GRIND_SECONDS = 5;

/** Grinding only takes glass away: the curve gets tighter, never flatter. A fresh blank starts flat again. */
export function grind(d: Draft, id: number, seconds: number, fine = false) {
  const b = blank(d, id);
  if (b) b.radiusMm = Math.max(MIN_RADIUS_MM, b.radiusMm * Math.exp(-seconds / (fine ? FINE_GRIND_SECONDS : GRIND_SECONDS)));
}

export function freshBlank(d: Draft, id: number) {
  const b = blank(d, id);
  if (b) b.radiusMm = BLANK_RADIUS_MM;
}

/** Open or close the stop in front of the objective in use; opened as wide as the lens, it is no stop at all. */
export function setStop(d: Draft, mm: number) {
  const b = activeObjective(d);
  if (b) b.stopMm = mm >= apertureMm(b.radiusMm) ? undefined : Math.max(STOP_MIN_MM, mm);
}

export function setTube(d: Draft, mm: number) {
  d.tubeMm = Math.min(TUBE_MM.max, Math.max(TUBE_MM.min, mm));
}

/** Turn the focus knobs. Returns true if the objective ran into the slide. */
export function moveFocus(d: Draft, deltaMm: number): boolean {
  const next = d.focusMm + deltaMm;
  d.focusMm = Math.min(FOCUS_RANGE_MM.max, Math.max(FOCUS_RANGE_MM.min, next));
  return next < FOCUS_RANGE_MM.min;
}

const activeObjective = (d: Draft) => {
  const id = d.objectives[d.active];
  return id === undefined ? undefined : blank(d, id);
};
const eyepieceBlank = (d: Draft) => (d.eyepiece === null ? undefined : blank(d, d.eyepiece));

/** Changes whenever something that moves the focus changes: the lenses in use, how they are ground, the tube. */
export const opticsKey = (d: Draft) => `${activeObjective(d)?.radiusMm ?? '-'}:${activeObjective(d)?.stopMm ?? '-'}:${eyepieceBlank(d)?.radiusMm ?? '-'}:${d.tubeMm}`;

/** In focus once the defocus blur is under this share of the finest detail the build resolves. */
export const SHARP = 0.6;

export interface Live {
  optics: ObjectiveOptics;
  /** Where the objective's image forms now, from the eyepiece's focal point (mm; null = no real image). */
  offsetMm: number | null;
  /** How far the focus is from sharp, mm (positive = objective too high). */
  deltaMm: number;
  /** Defocus blur in the specimen, µm. */
  blurUm: number;
  /** The finest detail it shows when sharp, µm. */
  dEffUm: number;
  sharp: boolean;
}

/** The optics of the objective in use, as the light goes through the build right now; null until both lenses are in. */
export function live(d: Draft, dLensUm: number): Live | null {
  const obj = activeObjective(d);
  const eye = eyepieceBlank(d);
  if (!obj || !eye) return null;
  const optics = objectiveOptics(obj, eye, d.tubeMm);
  const offsetMm = imageOffsetMm(optics.fObjectiveMm, d.focusMm, d.tubeMm, optics.fEyepieceMm);
  if (optics.issue) return { optics, offsetMm, deltaMm: 0, blurUm: Infinity, dEffUm: Infinity, sharp: false };
  const deltaMm = d.focusMm - optics.workingDistanceMm;
  const blurUm = defocusBlurUm(optics.NA, deltaMm);
  const dEffUm = effectiveResolutionUm(abbeLimitUm(GREEN_LIGHT_UM, optics.NA), Math.hypot(dLensUm, optics.sphericalUm));
  return { optics, offsetMm, deltaMm, blurUm, dEffUm, sharp: blurUm <= SHARP * dEffUm };
}

/** Call after every change: the focus step ticks once the current optics have been sharp. */
export function noteFocus(d: Draft, l: Live | null): boolean {
  if (!l?.sharp || d.focusedFor === opticsKey(d)) return false;
  d.focusedFor = opticsKey(d);
  return true;
}

export interface Step {
  id: 'stand' | 'lamp' | 'tube' | 'objective' | 'eyepiece' | 'focus';
  label: string;
  done: boolean;
}

/** The build, in the order it goes together. */
export function steps(d: Draft): Step[] {
  const has = (...ids: PartId[]) => ids.every((id) => d.placed.includes(id));
  return [
    { id: 'stand', label: 'Put up the stand: base, arm and stage', done: has('base', 'arm', 'stage') },
    { id: 'lamp', label: 'Put the lamp under the stage', done: has('lamp') },
    { id: 'tube', label: 'Mount the tube and the focus knobs', done: has('tube', 'knobs') },
    { id: 'objective', label: 'Grind a lens and screw it in as the objective', done: d.objectives.length > 0 },
    { id: 'eyepiece', label: 'Grind a lens and drop it in as the eyepiece', done: d.eyepiece !== null },
    { id: 'focus', label: 'Turn the focus knobs until the slide is sharp', done: d.focusedFor !== null && d.focusedFor === opticsKey(d) },
  ];
}

/** The build as the game keeps it, or null while something is missing. */
export function toBuild(d: Draft): CompoundBuild | null {
  const eye = eyepieceBlank(d);
  const round = (mm: number) => Math.round(mm * 100) / 100;
  const objectives = d.objectives.map((id) => blank(d, id)!).map((b) => ({ radiusMm: round(b.radiusMm), ...(b.stopMm ? { stopMm: round(b.stopMm) } : {}) }));
  if (!eye || !objectives.length) return null;
  return { objectives, eyepiece: { radiusMm: round(eye.radiusMm) }, tubeMm: Math.round(d.tubeMm), style: { ...d.style }, name: d.name.slice(0, 24) };
}

/** Ready to become a microscope: every step done and every objective on the nosepiece can be focused. */
export function finishable(d: Draft): boolean {
  const build = toBuild(d);
  return !!build && steps(d).every((s) => s.done) && !buildIssue(build);
}
