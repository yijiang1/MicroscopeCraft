import { describe, expect, it } from 'vitest';
import {
  canPlace, draftFromBuild, finishable, freshBlank, grind, live, mountEyepiece, mountObjective, moveFocus, newDraft, noteFocus,
  place, PARTS, steps, toBuild,
} from './draft';

const DLENS = 1; // the compound microscope's glass blur, µm

/** Grind a blank down to roughly this radius (grinding is exponential, 1.1 s per e-fold). */
const grindTo = (d: ReturnType<typeof newDraft>, id: number, radiusMm: number) => grind(d, id, 1.1 * Math.log(200 / radiusMm));

describe('putting a compound microscope together', () => {
  it('parts go on in order: the stand first, then the lamp, tube and knobs; lenses need the tube', () => {
    const d = newDraft(2);
    expect(canPlace(d, 'stage')).toBe(false);
    expect(mountObjective(d, 0)).toBe(false);
    for (const p of PARTS) expect(place(d, p.id)).toBe(true);
    expect(place(d, 'base')).toBe(false);
    expect(mountObjective(d, 0)).toBe(true);
    expect(mountEyepiece(d, 0)).toBe(true); // moving a lens moves it, it is not in two places
    expect(d.objectives).toEqual([]);
  });

  it('grinding only ever tightens the curve; a fresh blank starts flat again', () => {
    const d = newDraft(1);
    grindTo(d, 0, 16);
    expect(d.blanks[0]!.radiusMm).toBeCloseTo(16, 6);
    grind(d, 0, 0.5, true);
    expect(d.blanks[0]!.radiusMm).toBeLessThan(16);
    expect(d.blanks[0]!.radiusMm).toBeGreaterThan(14); // fine grinding is slow
    freshBlank(d, 0);
    expect(d.blanks[0]!.radiusMm).toBe(200);
  });

  it('focus has to be found: sharp only near the working distance, and the step stays done until the optics change', () => {
    const d = newDraft(2);
    PARTS.forEach((p) => place(d, p.id));
    grindTo(d, 0, 16);
    grindTo(d, 1, 25);
    mountObjective(d, 0);
    mountEyepiece(d, 1);
    d.tubeMm = 201;
    expect(live(d, DLENS)!.sharp).toBe(false); // the knob starts 25 mm up
    expect(finishable(d)).toBe(false);
    moveFocus(d, 17.6 - d.focusMm);
    const l = live(d, DLENS)!;
    expect(l.sharp).toBe(true);
    expect(l.offsetMm).toBeCloseTo(0, 6);
    expect(noteFocus(d, l)).toBe(true);
    expect(steps(d).every((s) => s.done)).toBe(true);
    expect(finishable(d)).toBe(true);
    d.tubeMm = 220; // a longer tube moves the focus
    expect(steps(d).find((s) => s.id === 'focus')!.done).toBe(false);
  });

  it('the objective can run into the slide; the knob stops there', () => {
    const d = newDraft(0);
    expect(moveFocus(d, -100)).toBe(true);
    expect(d.focusMm).toBeGreaterThan(0);
  });

  it('a build goes to the game and comes back to the bench as it was, in focus', () => {
    const d = newDraft(3);
    PARTS.forEach((p) => place(d, p.id));
    grindTo(d, 0, 40);
    grindTo(d, 1, 4);
    grindTo(d, 2, 25);
    mountObjective(d, 0);
    mountObjective(d, 1);
    mountEyepiece(d, 2);
    d.name = 'Little brass one';
    const build = toBuild(d)!;
    expect(build.objectives.map((o) => Math.round(o.radiusMm))).toEqual([40, 4]);
    const back = draftFromBuild(build, 1);
    expect(back.blanks).toHaveLength(4);
    expect(back.name).toBe('Little brass one');
    expect(live(back, DLENS)!.sharp).toBe(true);
    expect(finishable(back)).toBe(true);
  });
});
