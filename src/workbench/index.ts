// The workbench (prototype): build the compound microscope by hand instead of pressing C. Grind each lens on the
// wheel (its curve sets its focal length), put the stand, lamp, tube and knobs together, screw in the objectives and
// drop in the eyepiece, then focus it yourself. The build is yours: shapes, finishes and a name engraved on the base.
// What it can see comes from how you built it: shared/sim/assembly.ts turns the build into the zoom steps the
// eyepiece uses. Open it with B, from the menu, or with C when the goal card says to build the microscope.
import type { CompoundBuild, Feature, Sample, ScopeParams } from '../shared/schema';
import { buildIssue, buildOptics, compileBuild, FOCUS_RANGE_MM, focalLengthMm, issueText, MAX_OBJECTIVES, TUBE_MM, type ObjectiveOptics } from '../shared/sim/assembly';
import { usefulMagnificationMax, visibility } from '../shared/sim/optics';
import { findFeature, scopeThatSees } from '../shared/plan';
import { explainWall, fmtUm } from '../shared/sim/walls';
import { assemble, canCraft, LENS_ITEM, scopeParamsFromSpec, type GameContext } from '../shared/state';
import {
  blank, canMount, canPlace, draftFromBuild, FINISHES, freshBlank, grind, live, mountEyepiece, mountObjective, moveFocus,
  newDraft, noteFocus, partDef, PARTS, place, roleOf, setTube, SHAPES, steps, toBuild, unmount, finishable, type Draft, type Live, type PartId,
} from './draft';
import { drawPreview, verdicts } from './preview';
import { createBenchScene, type BenchScene, type GhostId, type Pick } from './scene';
import { createBenchSound } from './sound';
import { btn, fmtMag, fmtMm, h, icon, injectStyle, keyed, slider } from './dom';

export interface WorkbenchHandle {
  dispose(): void;
}

/** build: you have the parts. edit: you own it and can change it. practice: no parts yet, nothing is kept. */
type Mode = 'build' | 'edit' | 'practice';

/** A compound microscope crafted before the workbench existed comes back as the recipe's usual three objectives. */
const LEGACY_BUILD: CompoundBuild = { objectives: [{ radiusMm: 40 }, { radiusMm: 16 }, { radiusMm: 4 }], eyepiece: { radiusMm: 25 }, tubeMm: 201, style: {}, name: '' };
/** Slides you can put on the stage to try the build; the first one holds what unlocks the next microscope. */
const SLIDES = ['sunflower_seed', 'leaf', 'blood_slide', 'flower', 'pond_scum', 'bark'];
const FINISH_COLOR: Record<string, string> = {
  brass: '#c9973f', black: '#1a1b20', nickel: '#cfd4db', iron: '#5c6068', wood: '#8f5c33', white: '#ece8df', red: '#b3302a', blue: '#2c5db0', green: '#2e8650', leather: '#5e2218',
};
/** Focus knobs: millimetres of travel per pixel dragged. */
const COARSE_MM_PER_PX = 0.08;
const FINE_MM_PER_PX = 0.00025;
const FINE_RANGE_UM = 60;

export function mountWorkbench(el: HTMLElement, ctx: GameContext): WorkbenchHandle {
  const recipe = ctx.data.recipes.find((r) => r.assembly === 'compound');
  if (!recipe?.scope) return { dispose() {} };
  injectStyle();
  const spec = recipe.scope;
  const item = recipe.output.itemId;
  const sound = createBenchSound();
  const targets = gateTargets(ctx, recipe.id);
  const slides = SLIDES.filter((id) => ctx.data.samples[id]);

  // --- layout
  el.className = 'wb';
  const grid = h('div', 'wb-grid');
  const left = h('div', 'wb-col wb-left');
  const center = h('div', 'wb-center');
  const right = h('div', 'wb-col wb-right');
  grid.append(left, center, right);
  const host3d = h('div', 'wb-3d');
  const hint = h('div', 'wb-hint');
  const float = h('div', 'wb-float');
  const tools = h('div', 'wb-tools');
  const dock = h('div', 'wb-dock');
  const done = h('div', 'wb-done');
  center.append(host3d, hint, tools, float, dock, done);
  const big = h('div', 'wb-big');
  const bigCanvas = h('canvas');
  big.append(bigCanvas);
  el.append(grid, big);

  // left column
  const head = h('div');
  const title = h('div');
  title.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px';
  title.append(h('h2', '', 'Workbench'), btn('Close [Esc]', () => close()));
  const badge = h('div', 'wb-badge');
  head.append(title, h('div', 'wb-muted', 'Compound microscope: the objective makes a magnified image inside the tube, and the eyepiece magnifies that image again.'), badge);
  const stepList = h('ol', 'wb-steps');
  const partHead = h('div', 'wb-h', 'Parts');
  const partList = h('div');
  const blankHead = h('div', 'wb-h', 'Lens blanks');
  const blankList = h('div');
  const partBox = h('div');
  const blankBox = h('div');
  partBox.append(partHead, partList);
  blankBox.append(blankHead, blankList);
  left.append(head, h('div', 'wb-h', 'Steps'), stepList, partBox, blankBox);

  // right column
  const previewBox = h('div', 'wb-preview');
  const preview = h('canvas');
  previewBox.append(preview);
  const slideSelect = h('select', 'wb-select');
  for (const id of slides) {
    const o = h('option', '', `Slide: ${ctx.data.samples[id]!.name}`);
    o.value = id;
    slideSelect.append(o);
  }
  const verdictList = h('ul', 'wb-list');
  const targetBox = h('div', 'wb-target');
  const optics = h('div');
  const finishBox = h('div');
  right.append(h('div', 'wb-h', 'Through the eyepiece'), previewBox, slideSelect, verdictList, targetBox, h('div', 'wb-h', 'Optics'), optics, h('div', 'wb-h', 'Finish'), finishBox);

  // focus dock
  const coarse = slider('Focus', FOCUS_RANGE_MM.min, FOCUS_RANGE_MM.max, 0.01, (v) => {
    const crashed = moveFocus(draft, v - draft.focusMm);
    fineCenter = draft.focusMm;
    afterFocus(crashed);
  });
  const fineSlider = slider('Fine', -FINE_RANGE_UM, FINE_RANGE_UM, 0.1, (v) => {
    const crashed = moveFocus(draft, fineCenter + v / 1000 - draft.focusMm);
    afterFocus(crashed);
  });
  const tube = slider('Tube', TUBE_MM.min, TUBE_MM.max, 1, (v) => {
    setTube(draft, v);
    refresh();
  });
  const focusStatus = h('div', 'wb-muted');
  focusStatus.style.cssText = 'margin-top:4px;font-size:12px';
  dock.append(coarse.row, fineSlider.row, tube.row, focusStatus);

  // --- state
  let mode: Mode = 'practice';
  const drafts: Partial<Record<Mode, Draft>> = {};
  let draft: Draft = newDraft(MAX_OBJECTIVES + 1);
  let scene: BenchScene | null = null;
  let selected: string | null = null; // 'part:base', 'objective:0', 'eyepiece'
  let wheel: number | null = null; // blank on the grinding wheel
  let holding = false;
  let fineGrind = false;
  let grindRaf = 0;
  let lastGrind = 0;
  let lastHeavy = 0;
  let showLight = true;
  let slideId = slides[0] ?? Object.keys(ctx.data.samples)[0]!;
  let fineCenter = draft.focusMm;
  let message = '';
  let messageTimer = 0;
  const isOpen = () => el.style.display === 'block';
  const lensCount = () => ctx.state.inventory[LENS_ITEM] ?? 0;

  const modeNow = (): Mode => ((ctx.state.inventory[item] ?? 0) > 0 ? 'edit' : canCraft(ctx, recipe.id) ? 'build' : 'practice');

  /** The bench for this mode: your own microscope as saved, or the build you left, with as many blanks as you have lenses. */
  const draftFor = (m: Mode): Draft => {
    if (m === 'edit') {
      const build = ctx.state.builds[item] ?? LEGACY_BUILD;
      return draftFromBuild(build, Math.min(MAX_OBJECTIVES - build.objectives.length, lensCount()));
    }
    const want = m === 'practice' ? MAX_OBJECTIVES + 1 : Math.min(MAX_OBJECTIVES + 1, lensCount());
    const d = drafts[m] ?? newDraft(want);
    while (d.blanks.length < want) d.blanks.push({ id: Math.max(-1, ...d.blanks.map((b) => b.id)) + 1, radiusMm: 200 });
    while (d.blanks.length > want) {
      const spare = [...d.blanks].reverse().find((b) => !roleOf(d, b.id));
      if (!spare) break;
      d.blanks.splice(d.blanks.indexOf(spare), 1);
    }
    drafts[m] = d;
    return d;
  };

  const say = (text: string) => {
    message = text;
    clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
      message = '';
      if (isOpen()) renderHint(live(draft, spec.dLensUm));
    }, 4000);
  };

  /** The microscope as the game would use it right now, at the objective in use (magnification not rounded). */
  const scopeFor = (o: ObjectiveOptics): ScopeParams =>
    scopeParamsFromSpec({ ...spec, steps: [{ label: '', magnification: o.magnification, NA: o.NA, mode: 'brightfield' }] }, 0);

  // --- actions
  const select = (tag: string | null) => {
    selected = tag;
    wheel = null;
    stopGrinding();
    refresh();
  };
  const openWheel = (id: number) => {
    selected = null;
    wheel = id;
    refresh();
  };
  const placePart = (id: PartId) => {
    if (!place(draft, id)) return;
    sound.place();
    selected = `part:${id}`;
    wheel = null;
    refresh();
  };
  /** Put a lens in: the one on the wheel if it is free, else the most strongly ground free one; none ground = open the wheel. */
  const mountRole = (role: 'objective' | 'eyepiece', id?: number) => {
    const free = draft.blanks.filter((b) => !roleOf(draft, b.id));
    const pick = id ?? (wheel !== null && !roleOf(draft, wheel) ? wheel : [...free].sort((a, b) => a.radiusMm - b.radiusMm)[0]?.id);
    if (pick === undefined) return say('No free lens blank left.');
    if (blank(draft, pick)!.radiusMm >= 199 && id === undefined) {
      say('Grind the lens first: a flat blank barely bends light.');
      return openWheel(pick);
    }
    const ok = role === 'objective' ? mountObjective(draft, pick) : mountEyepiece(draft, pick);
    if (!ok) return say(canMount(draft) ? `The nosepiece holds ${MAX_OBJECTIVES} objectives.` : 'Mount the tube first: lenses go into it.');
    sound.place();
    wheel = null;
    selected = role === 'objective' ? `objective:${draft.objectives.indexOf(pick)}` : 'eyepiece';
    refresh();
  };
  const useObjective = (i: number) => {
    if (i === draft.active || draft.objectives[i] === undefined) return;
    draft.active = i;
    sound.tick();
    say('The nosepiece turns. A different objective needs its own focus.');
    refresh();
  };
  const afterFocus = (crashed: boolean) => {
    if (crashed) {
      sound.crunch();
      scene?.shake();
      say('Crunch! The objective hit the slide. Lift it a little with the focus knob.');
    } else sound.tick();
    refreshFocus();
  };

  const onPick = (p: Pick) => {
    if (p.kind === 'ghost') {
      if (p.id === 'objective' || p.id === 'eyepiece') mountRole(p.id);
      else placePart(p.id);
    } else if (p.kind === 'part') select(`part:${p.id}`);
    else if (p.kind === 'objective') {
      if (p.index !== draft.active) useObjective(p.index);
      else select(`objective:${p.index}`);
    } else if (p.kind === 'eyepiece') select('eyepiece');
    else if (selected || wheel !== null) select(null);
  };
  const onKnob = (which: 'coarse' | 'fine', dy: number) => {
    const crashed = moveFocus(draft, -dy * (which === 'coarse' ? COARSE_MM_PER_PX : FINE_MM_PER_PX));
    if (which === 'coarse') fineCenter = draft.focusMm;
    afterFocus(crashed);
  };

  // --- grinding: hold the button (or Space); Shift grinds finer
  const grindFrame = () => {
    if (!holding || wheel === null) return;
    const now = performance.now();
    grind(draft, wheel, (now - lastGrind) / 1000, fineGrind);
    lastGrind = now;
    refresh(false, now - lastHeavy < 90);
    grindRaf = requestAnimationFrame(grindFrame);
  };
  const startGrinding = (fine: boolean) => {
    if (wheel === null || holding) return;
    holding = true;
    fineGrind = fine;
    lastGrind = performance.now();
    sound.grinding(true);
    grindRaf = requestAnimationFrame(grindFrame);
    renderFloat();
  };
  function stopGrinding() {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(grindRaf);
    sound.grinding(false);
    if (isOpen()) refresh();
  }

  // --- rendering
  const renderSteps = () => {
    stepList.replaceChildren();
    const list = steps(draft);
    const now = list.find((s) => !s.done);
    for (const s of list) {
      const li = h('li', s.done ? 'done' : s === now ? 'now' : '', s.label);
      stepList.append(li);
    }
    stepList.append(h('li', finishable(draft) ? 'now' : '', 'Style it, name it, and finish'));
  };

  const renderParts = () => {
    partList.replaceChildren();
    const next = steps(draft).find((s) => !s.done)?.id;
    const nextParts: Record<string, PartId[]> = { stand: ['base', 'arm', 'stage'], lamp: ['lamp'], tube: ['tube', 'knobs'] };
    // all on: the stand is done, so the lenses come first
    if (PARTS.every((p) => draft.placed.includes(p.id))) left.append(blankBox, partBox);
    else left.append(partBox, blankBox);
    for (const p of PARTS) {
      const placed = draft.placed.includes(p.id);
      const card = h('div', 'wb-card');
      const isNext = !placed && canPlace(draft, p.id) && !!nextParts[next ?? '']?.includes(p.id);
      if (isNext) card.classList.add('next');
      if (selected === `part:${p.id}`) card.classList.add('sel');
      const tx = h('div', 'tx');
      const from = p.item ? `your ${ctx.data.items[p.item]?.name ?? p.item}` : 'shaped from scrap at the bench';
      const sub = placed ? 'On the microscope' : isNext ? `${p.about} From ${mode === 'practice' ? 'practice stock' : from}.` : '';
      tx.append(h('div', 'nm', p.name));
      if (sub) tx.append(h('div', 'sb', sub));
      if (!isNext) card.style.padding = '4px 8px';
      const action = placed
        ? btn('Style', () => select(`part:${p.id}`))
        : canPlace(draft, p.id)
        ? btn('Place', () => placePart(p.id), card.classList.contains('next') ? 'primary' : '')
        : btn(`Needs ${p.needs.filter((n) => !draft.placed.includes(n)).map((n) => partDef(n).name.toLowerCase()).join(', ')}`, () => {}, '');
      if (!placed && !canPlace(draft, p.id)) action.disabled = true;
      card.append(icon(p.id), tx, action);
      partList.append(card);
    }
  };

  const lensLine = (radiusMm: number) => (radiusMm >= 199 ? 'flat: not ground yet' : `focal length ${fmtMm(focalLengthMm(radiusMm))}`);
  const renderBlanks = () => {
    blankList.replaceChildren();
    if (!draft.blanks.length) blankList.append(h('div', 'wb-muted', 'No glass lenses: craft some first (tech tree, T).'));
    const next = steps(draft).find((s) => !s.done)?.id;
    draft.blanks.forEach((b, i) => {
      const role = roleOf(draft, b.id);
      const card = h('div', 'wb-card');
      if (wheel === b.id) card.classList.add('sel');
      if (!role && (next === 'objective' || next === 'eyepiece') && canMount(draft)) card.classList.add('next');
      const tx = h('div', 'tx');
      const where = role === 'objective' ? `objective${draft.objectives.length > 1 ? ` ${draft.objectives.indexOf(b.id) + 1}` : ''} · ` : role === 'eyepiece' ? 'eyepiece · ' : '';
      tx.append(h('div', 'nm', `Lens ${i + 1}`), h('div', 'sb', `${where}${lensLine(b.radiusMm)}`));
      const acts = h('div');
      acts.style.cssText = 'display:flex;flex-direction:column;gap:4px';
      acts.append(btn(wheel === b.id ? 'On the wheel' : 'Grind', () => openWheel(b.id), !role && b.radiusMm >= 199 && canMount(draft) ? 'primary' : ''));
      if (role) acts.append(btn('Take out', () => (unmount(draft, b.id), sound.tick(), refresh())));
      card.append(icon('lens'), tx, acts);
      blankList.append(card);
    });
    if (mode !== 'practice' && draft.blanks.length < MAX_OBJECTIVES + 1) {
      blankList.append(h('div', 'sb wb-muted', `Each objective after the first needs one more glass lens (you have ${draft.blanks.length} blank${draft.blanks.length === 1 ? '' : 's'}).`));
    }
  };

  const focusText = (l: Live | null): string => {
    if (!l) return '';
    if (l.optics.issue) return issueText(l.optics.issue, l.optics);
    if (l.offsetMm === null) return 'The objective is closer to the slide than its focal length, so it makes no image: lift it with the focus knob.';
    if (l.sharp) return 'Sharp! The objective\'s image sits exactly at the eyepiece\'s focal point, the green ring.';
    const away = Math.abs(l.deltaMm);
    const dir = l.deltaMm < 0 ? 'lift the tube' : 'lower the tube';
    const where = l.offsetMm > 0 ? 'above' : 'below';
    if (away < 0.08) return `Nearly there: ${away * 1000 < 1 ? 'less than 1' : Math.round(away * 1000)} µm off. Use the small knob (fine focus, or [Shift] with the arrow keys) to ${dir}.`;
    return `The objective's image (the glowing dot) forms ${fmtMm(Math.abs(l.offsetMm))} ${where} the eyepiece's focal point (the blue ring): ${dir} with the big knob.`;
  };

  function renderHint(l: Live | null) {
    const next = steps(draft).find((s) => !s.done);
    const texts: Record<string, string> = {
      stand: 'Start with the stand: click a glowing outline (or Place on the left) to put the base down',
      lamp: 'Put the lamp on the base, under the hole in the stage',
      tube: 'Mount the tube on the arm, then the focus knobs',
      objective: 'Grind a lens blank (left), then screw it in at the bottom of the tube as the objective',
      eyepiece: 'Grind another lens and drop it into the top of the tube as the eyepiece',
      focus: 'Turn the focus: drag the big brass knob, the Focus slider below, or press [↑] [↓], until the glowing dot meets the ring',
    };
    const ready = mode === 'edit' ? 'Change anything you like: regrind, add an objective, restyle. Then Save on the right' : 'It works! Style it, give it a name, then Finish on the right';
    keyed(hint, message || (next ? texts[next.id]! : finishable(draft) ? ready : focusText(l)));
  }

  const renderTools = () => {
    tools.replaceChildren();
    const light = btn(showLight ? 'Light path: on [L]' : 'Light path: off [L]', () => {
      showLight = !showLight;
      refresh();
    });
    tools.append(light);
    if (draft.objectives.length > 1) {
      const row = h('div', 'wb-chips');
      row.style.margin = '0';
      draft.objectives.forEach((id, i) => {
        const c = h('button', `wb-chip${i === draft.active ? ' on' : ''}`, `[${i + 1}] ${fmtMm(focalLengthMm(blank(draft, id)!.radiusMm))} objective`);
        c.onclick = () => useObjective(i);
        row.append(c);
      });
      tools.append(row);
    }
  };

  const renderDock = (l: Live | null) => {
    const ready = draft.placed.includes('knobs') && draft.objectives.length > 0;
    dock.style.display = ready || draft.placed.includes('tube') ? 'block' : 'none';
    coarse.row.style.display = fineSlider.row.style.display = ready ? '' : 'none';
    tube.row.style.display = draft.placed.includes('tube') ? '' : 'none';
    coarse.set(draft.focusMm, fmtMm(draft.focusMm));
    // the big knob (3D drag, keys, wheel) can carry the focus past the fine slider's travel: re-centre it then
    if (Math.abs(draft.focusMm - fineCenter) * 1000 > FINE_RANGE_UM + 1) fineCenter = draft.focusMm;
    fineSlider.set((draft.focusMm - fineCenter) * 1000, `${(draft.focusMm - fineCenter) * 1000 >= 0 ? '+' : ''}${((draft.focusMm - fineCenter) * 1000).toFixed(1)} µm`);
    tube.set(draft.tubeMm, `${Math.round(draft.tubeMm)} mm`);
    keyed(focusStatus, ready ? focusText(l) : 'The tube telescopes: a longer tube puts the objective\'s image further away, so it is bigger.');
    focusStatus.className = l?.sharp ? 'wb-ok' : l?.optics.issue ? 'wb-warn' : 'wb-muted';
  };

  const row = (label: string, value: string, cls = '') => {
    const r = h('div', 'wb-row');
    const b = h('b', cls, value);
    r.append(h('span', 'wb-muted', label), b);
    return r;
  };
  const renderOptics = (l: Live | null) => {
    optics.replaceChildren();
    if (!l) {
      optics.append(h('div', 'wb-muted', 'Put in an objective and an eyepiece to see the numbers.'));
      return;
    }
    const o = l.optics;
    optics.append(
      row('Objective', `f ${fmtMm(o.fObjectiveMm)} · ${fmtMm(o.apertureMm)} wide`),
      row('Eyepiece', `f ${fmtMm(o.fEyepieceMm)} · ${fmtMag(o.eyepieceMag)}`),
      row('Tube', `${Math.round(draft.tubeMm)} mm`),
    );
    if (o.issue) {
      optics.append(h('div', 'wb-note', issueText(o.issue, o)));
      return;
    }
    const scope = scopeFor(o);
    const useful = usefulMagnificationMax(scope);
    optics.append(
      row('Magnification', `${fmtMag(o.objectiveMag)} × ${fmtMag(o.eyepieceMag)} = ${fmtMag(o.magnification)}`, 'wb-gold'),
      row('Numerical aperture', o.NA.toFixed(2)),
      row('Finest detail', fmtUm(l.dEffUm)),
      row('Slide below objective', `${fmtMm(o.workingDistanceMm)} when sharp`),
    );
    if (o.magnification > useful) {
      optics.append(h('div', 'wb-note', `Empty magnification: ${fmtMag(o.magnification)} is more than 1000 × NA (${fmtMag(useful)}). A stronger eyepiece only enlarges the blur; only a wider cone of light (more NA: a stronger, wider objective) adds detail.`));
    }
  };

  const renderPreview = (l: Live | null) => {
    const sample = ctx.data.samples[slideId]!;
    const has = (p: PartId) => draft.placed.includes(p);
    let note: string | undefined;
    let scope: ScopeParams | null = null;
    if (!has('stage')) note = 'No slide yet: put up the stage';
    else if (!has('lamp')) note = 'Dark: put the lamp under the stage';
    else if (!draft.objectives.length) note = 'Screw in an objective at the bottom of the tube';
    else if (draft.eyepiece === null) note = 'Put in an eyepiece to look through it';
    else if (l?.optics.issue) note = 'No image: see Optics';
    else if (l && l.offsetMm === null) note = 'No image: lift the objective with the focus knob';
    else if (l) scope = scopeFor(l.optics);
    const state = { sample, scope, defocusUm: l && Number.isFinite(l.blurUm) ? l.blurUm : 0, lit: has('lamp'), note };
    fitCanvas(preview);
    drawPreview(preview, state);
    if (big.style.display === 'flex') {
      fitCanvas(bigCanvas);
      drawPreview(bigCanvas, state);
    }
    verdictList.replaceChildren();
    for (const { f, v } of verdicts(state)) {
      const li = h('li', v.visible ? 'wb-ok' : 'wb-warn', `${v.visible ? '✓' : '✗'} ${f.name} (${fmtUm(f.sizeUm)}): ${v.visible ? (v.detectedOnly ? 'detected' : 'visible') : REASONS[v.reason] ?? v.reason}`);
      verdictList.append(li);
    }
    if (scope && l && !l.sharp) verdictList.prepend(h('li', 'wb-warn', 'Out of focus: details blur away until you focus.'));
  };

  /** Can any objective on the nosepiece show what unlocks the next microscope? */
  const renderTarget = () => {
    targetBox.replaceChildren();
    if (!targets.length) {
      targetBox.style.display = 'none';
      return;
    }
    targetBox.style.display = '';
    const build = toBuild(draft);
    for (const t of targets) {
      const head = h('div');
      head.innerHTML = `<b>Needed next:</b> ${t.feature.name} (${fmtUm(t.feature.sizeUm)}) in a ${t.sample.name.toLowerCase()}. Seeing them unlocks ${t.material}.`;
      targetBox.append(head);
      if (!build) {
        targetBox.append(h('div', 'wb-muted', 'Finish putting it together to find out whether it can.'));
        continue;
      }
      const seen = buildOptics(build).map((o, i) => ({ o, i })).filter(({ o }) => !o.issue).map(({ o, i }) => ({ i, o, v: visibility(t.feature, scopeFor(o)) }));
      const ok = seen.find((s) => s.v.visible);
      if (ok) targetBox.append(h('div', 'wb-ok', `✓ Objective ${ok.i + 1} (${fmtMag(ok.o.magnification)}) can show them, once focused.`));
      else {
        const best = seen.sort((a, b) => b.o.NA - a.o.NA)[0];
        targetBox.append(h('div', 'wb-warn', best ? `✗ ${explainWall(t.feature, scopeFor(best.o), best.v, null)}` : '✗ None of the objectives can form an image yet.'));
        if (best) targetBox.append(h('div', 'wb-muted', 'More NA resolves finer detail: grind an objective more strongly (shorter focal length).'));
      }
    }
  };

  const renderFinish = () => {
    finishBox.replaceChildren();
    const build = toBuild(draft);
    const ready = finishable(draft);
    const missing = steps(draft).filter((s) => !s.done).map((s) => s.label.toLowerCase());
    const issue = build && buildIssue(build);
    if (issue && build) {
      const o = buildOptics(build).find((x) => x.issue)!;
      finishBox.append(h('div', 'wb-note', `One objective on the nosepiece cannot be focused: ${issueText(issue, o)}`));
    } else if (missing.length) finishBox.append(h('div', 'wb-muted', `Still to do: ${missing.join('; ')}.`));
    const nameRow = h('div');
    nameRow.style.cssText = 'margin:8px 0';
    nameRow.append(nameInput('Name engraved on the base (optional)'));
    finishBox.append(nameRow);
    const label = mode === 'edit' ? 'Save my microscope' : mode === 'build' ? 'Finish: make it my microscope' : 'Done (practice)';
    const b = btn(label, finish, 'primary big');
    b.disabled = !ready;
    finishBox.append(b);
    const extra = build ? Math.max(0, build.objectives.length - 1) : 0;
    const cost =
      mode === 'build'
        ? `Uses your 2 glass lenses, tube, lamp and focus knob${extra ? `, plus ${extra} more glass lens${extra > 1 ? 'es' : ''} for the extra objective${extra > 1 ? 's' : ''}` : ''}.`
        : mode === 'edit'
        ? 'Adding an objective uses one more glass lens; taking one off gives it back.'
        : 'You don\'t have the parts yet, so this build is not kept. The goal card shows what to gather.';
    finishBox.append(h('div', 'wb-muted', cost));
  };

  function renderFloat() {
    float.replaceChildren();
    const closeX = () => {
      const x = h('button', 'wb-x', '×');
      x.onclick = () => select(null);
      return x;
    };
    if (wheel !== null) {
      float.style.display = 'block';
      renderWheel(closeX());
      return;
    }
    if (!selected) {
      float.style.display = 'none';
      return;
    }
    float.style.display = 'block';
    const [kind, arg] = selected.split(':');
    if (kind === 'part') {
      const p = partDef(arg as PartId);
      const t = h('h3', '', p.name);
      t.append(closeX());
      float.append(t, h('div', 'wb-muted', p.about));
      const shapes = SHAPES[p.id];
      if (shapes) {
        float.append(h('div', 'wb-h', 'Shape'));
        const chips = h('div', 'wb-chips');
        for (const s of shapes) {
          const c = h('button', `wb-chip${draft.style[p.id] === s ? ' on' : ''}`, s);
          c.onclick = () => ((draft.style[p.id] = s), sound.tick(), refresh());
          chips.append(c);
        }
        float.append(chips);
      }
      float.append(...finishPicker(`${p.id}Finish`));
      if (p.id === 'base') {
        float.append(h('div', 'wb-h', 'Engraving'), nameInput('Name engraved on the base'));
      }
    } else if (kind === 'objective' || kind === 'eyepiece') {
      const id = kind === 'objective' ? draft.objectives[+arg!]! : draft.eyepiece!;
      const b = blank(draft, id);
      if (!b) return select(null);
      const t = h('h3', '', kind === 'objective' ? `Objective ${+arg! + 1}` : 'Eyepiece');
      t.append(closeX());
      float.append(t, h('div', 'wb-muted', `Lens ${draft.blanks.indexOf(b) + 1}, ${lensLine(b.radiusMm)}.`));
      const acts = h('div');
      acts.style.cssText = 'display:flex;gap:6px;margin:8px 0';
      acts.append(btn('Grind it more', () => openWheel(id)), btn('Take it out', () => (unmount(draft, id), sound.tick(), select(null))));
      float.append(acts, ...finishPicker('lensFinish'));
    }
  }

  /** The engraving: typed here or in the style panel, it is the same name. */
  const nameInput = (placeholder: string) => {
    const name = h('input', 'wb-text');
    name.placeholder = placeholder;
    name.maxLength = 24;
    name.value = draft.name;
    name.dataset.engraving = '1';
    name.addEventListener('input', () => {
      draft.name = name.value;
      el.querySelectorAll<HTMLInputElement>('input[data-engraving]').forEach((i) => i !== name && (i.value = name.value));
      scene?.update(view());
    });
    return name;
  };

  const finishPicker = (key: string): HTMLElement[] => {
    const sw = h('div', 'wb-swatches');
    for (const f of FINISHES) {
      const s = h('button', `wb-swatch${draft.style[key] === f ? ' on' : ''}`);
      s.title = f;
      s.style.background = f === 'wood' ? 'linear-gradient(135deg,#8f5c33,#6b4122)' : f === 'leather' ? 'linear-gradient(135deg,#5e2218,#e0b850 85%)' : FINISH_COLOR[f]!;
      s.onclick = () => ((draft.style[key] = f), sound.tick(), refresh());
      sw.append(s);
    }
    const paint = h('input');
    paint.type = 'color';
    paint.title = 'Paint any colour';
    paint.value = /^#/.test(draft.style[key] ?? '') ? draft.style[key]! : '#3d7fd6';
    paint.style.cssText = 'width:30px;height:26px;padding:0;border:0;background:none;cursor:pointer';
    paint.addEventListener('input', () => ((draft.style[key] = paint.value), refresh()));
    sw.append(paint);
    const all = btn('Use on every part', () => {
      for (const k of Object.keys(draft.style)) if (k.endsWith('Finish')) draft.style[k] = draft.style[key]!;
      sound.tick();
      refresh();
    });
    return [h('div', 'wb-h', 'Finish'), sw, all];
  };

  const wheelCanvas = h('canvas');
  wheelCanvas.width = 600;
  wheelCanvas.height = 220;
  wheelCanvas.style.cssText = 'width:100%;height:auto;display:block;border-radius:8px;background:#0a0d10;margin:6px 0';
  const holdButton = btn('Hold to grind, or hold [Space]', () => {}, 'big hold');
  holdButton.addEventListener('pointerdown', (e) => {
    holdButton.setPointerCapture(e.pointerId);
    startGrinding(e.shiftKey);
  });
  holdButton.addEventListener('pointerup', stopGrinding);
  holdButton.addEventListener('pointercancel', stopGrinding);
  const wheelNumbers = h('div');
  const wheelBar = h('div', 'wb-lensbar');
  const wheelActions = h('div');
  wheelActions.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';

  /** The grinding wheel: hold to curve the lens more; the numbers say what it would do as an objective or an eyepiece. */
  function renderWheel(x: HTMLElement) {
    const b = blank(draft, wheel!)!;
    const t = h('h3', '', `Grinding wheel · Lens ${draft.blanks.indexOf(b) + 1}`);
    t.append(x);
    holdButton.classList.toggle('on', holding);
    keyed(holdButton, holding ? (fineGrind ? 'Grinding finely…' : 'Grinding…') : 'Hold to grind, or hold [Space]');
    float.append(t, h('div', 'wb-muted', 'Grinding takes glass away, so the curve only gets tighter. A tighter curve bends light more: a shorter focal length. Hold [Shift] to grind finely.'), wheelCanvas, holdButton, wheelNumbers, wheelBar, wheelActions);
    renderWheelParts(b.radiusMm);
  }
  const renderWheelParts = (radiusMm: number) => {
    drawLens(wheelCanvas, radiusMm, holding);
    const f = focalLengthMm(radiusMm);
    const eye = draft.eyepiece !== null && draft.eyepiece !== wheel ? blank(draft, draft.eyepiece)!.radiusMm : 25;
    const sImage = draft.tubeMm - focalLengthMm(eye);
    const asObjective = sImage > f * 1.05 ? `about ${fmtMag(sImage / f - 1)} as an objective in this tube` : 'too weak to be an objective in this tube';
    wheelNumbers.replaceChildren(
      row('Curve radius', fmtMm(radiusMm)),
      row('Focal length (n = 1.5)', fmtMm(f), 'wb-gold'),
      row('Width it can have', fmtMm(Math.min(8, 1.4 * radiusMm))),
      row('Used as an eyepiece', fmtMag(250 / f)),
      h('div', 'wb-muted', `Used as an objective: ${asObjective}.`),
    );
    // where this lens sits among the usual ones (log scale from flat to the tightest curve)
    wheelBar.replaceChildren();
    const pos = (mm: number) => `${(100 * Math.log(200 / mm)) / Math.log(200 / 1.5)}%`;
    for (const [k, [mm, label]] of ([[40, '4× objective'], [25, '10× eyepiece'], [16, '10× objective'], [4, '40× objective'], [1.5, 'glass bead']] as const).entries()) {
      const tick = h('i');
      tick.style.left = pos(mm);
      const em = h('em', '', label);
      em.style.left = pos(mm);
      if (k % 2) em.style.top = '-15px'; // alternate above and below, so close ones do not overlap
      wheelBar.append(tick, em);
    }
    const needle = h('b');
    needle.style.left = pos(radiusMm);
    wheelBar.append(needle);
    wheelBar.style.margin = '22px 2px 22px';
    wheelActions.replaceChildren();
    const role = roleOf(draft, wheel!);
    if (canMount(draft)) {
      if (role !== 'objective') wheelActions.append(btn('Screw in as objective', () => mountRole('objective', wheel!), role ? '' : 'primary'));
      if (role !== 'eyepiece') wheelActions.append(btn('Drop in as eyepiece', () => mountRole('eyepiece', wheel!)));
    } else wheelActions.append(h('div', 'wb-muted', 'Mount the tube to put lenses in.'));
    wheelActions.append(btn('Fresh blank', () => (freshBlank(draft, wheel!), refresh())));
  };

  // --- the 3D view
  const ghostsFor = (): GhostId[] => {
    const next = steps(draft).find((s) => !s.done)?.id;
    const by: Record<string, GhostId[]> = { stand: ['base', 'arm', 'stage'], lamp: ['lamp'], tube: ['tube', 'knobs'], objective: ['objective'], eyepiece: ['eyepiece'] };
    const list = by[next ?? ''] ?? [];
    return list.filter((id) => (id === 'objective' || id === 'eyepiece' ? canMount(draft) : canPlace(draft, id as PartId)));
  };
  const view = () => {
    const l = live(draft, spec.dLensUm);
    return {
      placed: draft.placed,
      style: draft.style,
      name: draft.name,
      objectives: draft.objectives.map((id) => ({ radiusMm: blank(draft, id)!.radiusMm })),
      active: draft.active,
      eyepiece: draft.eyepiece === null ? null : { radiusMm: blank(draft, draft.eyepiece)!.radiusMm },
      tubeMm: draft.tubeMm,
      focusMm: draft.focusMm,
      slideColor: draft.placed.includes('stage') ? slideColor(ctx.data.samples[slideId]!) : null,
      ghosts: ghostsFor(),
      selected: selected?.startsWith('part:') || selected?.startsWith('objective') || selected === 'eyepiece' ? selected : null,
      showLight,
      sharp: !!l?.sharp,
    };
  };

  /** Turning a knob changes only what depends on the focus, unless the slide just came into focus for the first time. */
  function refreshFocus() {
    const l = live(draft, spec.dLensUm);
    if (noteFocus(draft, l)) {
      sound.sharp();
      return refresh();
    }
    renderHint(l);
    renderDock(l);
    renderPreview(l);
    scene?.update(view());
  }

  /** Redraw everything. `light`: only the wheel, the dock and the preview numbers (while grinding). */
  function refresh(instant = false, light = false) {
    const l = live(draft, spec.dLensUm);
    if (noteFocus(draft, l)) sound.sharp();
    if (light && wheel !== null) {
      renderWheelParts(blank(draft, wheel)!.radiusMm);
      return;
    }
    lastHeavy = performance.now();
    badge.className = `wb-badge ${mode}`;
    badge.textContent = mode === 'build' ? 'Building it for real, from your parts' : mode === 'edit' ? 'Your microscope: change anything, then save' : 'Practice: no parts needed, nothing is kept';
    renderSteps();
    renderParts();
    renderBlanks();
    renderHint(l);
    renderTools();
    renderDock(l);
    renderOptics(l);
    renderPreview(l);
    renderTarget();
    renderFinish();
    renderFloat();
    scene?.update(view(), instant);
  }

  // --- finishing
  function finish() {
    const build = toBuild(draft);
    if (!build || !finishable(draft)) return;
    const practice = mode === 'practice';
    if (!practice && !assemble(ctx, recipe!.id, build)) return say('Could not finish: a part or a glass lens is missing.');
    sound.done();
    if (mode === 'build') delete drafts.build;
    showDone(build, practice);
  }
  function showDone(build: CompoundBuild, practice: boolean) {
    done.replaceChildren();
    const card = h('div');
    const zoom = compileBuild(build, spec).steps;
    card.append(h('h3', '', practice ? 'It would work!' : mode === 'edit' ? 'Saved' : 'It works! It is yours.'));
    if (build.name) card.append(h('div', 'wb-gold', `"${build.name}"`));
    const list = h('ul', 'wb-list');
    list.style.fontSize = '13px';
    for (const s of zoom) {
      const sc = scopeParamsFromSpec({ ...spec, steps: [s] }, 0);
      list.append(h('li', '', `${s.label}: finest detail ${fmtUm(Math.hypot(0.55 / (2 * s.NA), spec.dLensUm))}${s.magnification > usefulMagnificationMax(sc) ? ' (empty magnification)' : ''}`));
    }
    card.append(list);
    for (const t of targets) {
      const sees = zoom.some((s) => visibility(t.feature, scopeParamsFromSpec({ ...spec, steps: [s] }, 0)).visible);
      card.append(h('div', sees ? 'wb-ok' : 'wb-warn', sees
        ? `✓ It can show ${t.feature.name.toLowerCase()} (${fmtUm(t.feature.sizeUm)}), which unlocks ${t.material}.`
        : `✗ It cannot show ${t.feature.name.toLowerCase()} (${fmtUm(t.feature.sizeUm)}) yet, and you need them to unlock ${t.material}: come back (B) and grind a stronger objective.`));
    }
    card.append(
      h('p', 'wb-muted', practice
        ? 'This was practice: gather the parts the goal card lists, then build it for real here.'
        : 'Aim at anything and press [F] to look through it; each objective is a zoom step in the eyepiece. Come back with [B] to change it.'),
    );
    const acts = h('div');
    acts.style.cssText = 'display:flex;gap:8px;margin-top:10px';
    acts.append(
      btn('Back to the world', () => close(), 'primary'),
      btn('Keep tinkering', () => {
        done.style.display = 'none';
        mode = modeNow();
        draft = draftFor(mode);
        fineCenter = draft.focusMm;
        refresh(true);
      }),
    );
    card.append(acts);
    done.append(card);
    done.style.display = 'flex';
  }

  // --- open and close
  const onKey = (e: KeyboardEvent) => {
    if (!isOpen()) return;
    e.stopPropagation(); // the bench is modal: world, menu and crafting keys wait
    const target = e.target as HTMLElement;
    const typing = target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text';
    if (e.key === 'Escape') {
      e.preventDefault();
      if (big.style.display === 'flex') big.style.display = 'none';
      else if (typing) target.blur();
      else if (wheel !== null || selected) select(null);
      else close();
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space' && wheel !== null) {
      e.preventDefault();
      if (!e.repeat) startGrinding(e.shiftKey);
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && target.tagName !== 'INPUT' && draft.placed.includes('knobs')) {
      e.preventDefault();
      const step = e.shiftKey ? 0.0005 : 0.05;
      const crashed = moveFocus(draft, e.key === 'ArrowUp' ? step : -step);
      if (!e.shiftKey) fineCenter = draft.focusMm;
      afterFocus(crashed);
    } else if (/^[1-3]$/.test(e.key) && draft.objectives[+e.key - 1] !== undefined) useObjective(+e.key - 1);
    else if (e.key.toLowerCase() === 'l') {
      showLight = !showLight;
      refresh();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (!isOpen()) return;
    e.stopPropagation();
    if (e.code === 'Space') stopGrinding();
    if (e.key === 'Shift' && holding) fineGrind = false;
  };
  const onOpenKey = (e: KeyboardEvent) => {
    if (isOpen() || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'b') return;
    const t = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return; // typing
    ctx.bus.emit('openWorkbench', { recipeId: null });
  };

  function open() {
    if (isOpen()) return;
    if (ctx.state.currentSampleId) ctx.bus.emit('closeEyepiece', {});
    mode = modeNow();
    draft = draftFor(mode);
    fineCenter = draft.focusMm;
    selected = null;
    wheel = null;
    message = '';
    done.style.display = 'none';
    el.style.display = 'block';
    document.exitPointerLock?.();
    scene ??= createBenchScene(host3d, { pick: onPick, knob: onKnob });
    scene.start();
    addEventListener('keydown', onKey, true);
    addEventListener('keyup', onKeyUp, true);
    refresh(true);
  }
  function close() {
    if (!isOpen()) return;
    stopGrinding();
    el.style.display = 'none';
    big.style.display = 'none';
    scene?.stop();
    removeEventListener('keydown', onKey, true);
    removeEventListener('keyup', onKeyUp, true);
    ctx.bus.emit('closeWorkbench', {});
  }

  slideSelect.addEventListener('change', () => {
    slideId = slideSelect.value;
    refresh();
  });
  preview.addEventListener('click', () => {
    big.style.display = 'flex';
    refresh();
  });
  big.addEventListener('click', () => (big.style.display = 'none'));
  const onWheel = (e: WheelEvent) => {
    if (!draft.placed.includes('knobs')) return;
    e.preventDefault();
    const d = e.deltaY || e.deltaX;
    const crashed = moveFocus(draft, -d * (e.shiftKey ? 0.000005 : 0.002));
    if (!e.shiftKey) fineCenter = draft.focusMm;
    afterFocus(crashed);
  };
  preview.addEventListener('wheel', onWheel, { passive: false });
  bigCanvas.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onOpenKey);
  const offs = [ctx.bus.on('openWorkbench', () => open())];

  return {
    dispose() {
      close();
      offs.forEach((off) => off());
      removeEventListener('keydown', onOpenKey);
      scene?.dispose();
      sound.dispose();
      el.replaceChildren();
    },
  };
}

const REASONS: Record<string, string> = {
  unresolved: 'too fine to resolve', 'empty-magnification': 'empty magnification', 'too-small-to-see': 'too small to see',
  'low-contrast': 'too faint', 'other-mode': 'shows up another way',
};

/** What this microscope must be able to show: the features that unlock a material, first seen at this tier. */
function gateTargets(ctx: GameContext, recipeId: string): { feature: Feature; sample: Sample; material: string }[] {
  const out: { feature: Feature; sample: Sample; material: string }[] = [];
  for (const m of Object.values(ctx.data.materials)) {
    const found = m.unlockedBy ? findFeature(ctx.data, m.unlockedBy) : null;
    if (found && scopeThatSees(found.feature, ctx.data)?.id === recipeId) out.push({ ...found, material: m.name.toLowerCase() });
  }
  return out;
}

const slideColor = (s: Sample) => s.features.find((f) => f.tint)?.tint ?? '#9fd28a';

function fitCanvas(c: HTMLCanvasElement) {
  const w = Math.round((c.clientWidth || 300) * Math.min(devicePixelRatio, 2));
  if (c.width !== w || c.height !== w) {
    c.width = w;
    c.height = w;
  }
}

/** Cross-section of the lens on the wheel, its curve drawn three times deeper so a gentle lens still shows. */
function drawLens(c: HTMLCanvasElement, radiusMm: number, grinding: boolean) {
  const g = c.getContext('2d');
  if (!g) return;
  const w = c.width, hgt = c.height;
  g.clearRect(0, 0, w, hgt);
  const pxPerMm = 26;
  const D = Math.min(8, 1.4 * radiusMm);
  const half = (D / 2) * pxPerMm;
  const sag = (radiusMm - Math.sqrt(Math.max(0, radiusMm ** 2 - (D / 2) ** 2))) * pxPerMm * 3;
  const cx = w / 2, cy = hgt / 2;
  const edge = 6;
  // the optical axis
  g.strokeStyle = '#ffffff22';
  g.setLineDash([6, 6]);
  g.beginPath();
  g.moveTo(20, cy);
  g.lineTo(w - 20, cy);
  g.stroke();
  g.setLineDash([]);
  // the lens: two arcs through the rim, bulging by the (exaggerated) sag
  const grad = g.createLinearGradient(cx - sag, 0, cx + sag, 0);
  grad.addColorStop(0, '#9fd8ff55');
  grad.addColorStop(0.5, '#e8f8ffcc');
  grad.addColorStop(1, '#9fd8ff55');
  g.fillStyle = grad;
  g.strokeStyle = '#d8f2ff';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - edge, cy - half);
  g.quadraticCurveTo(cx - edge - 2 * sag, cy, cx - edge, cy + half);
  g.lineTo(cx + edge, cy + half);
  g.quadraticCurveTo(cx + edge + 2 * sag, cy, cx + edge, cy - half);
  g.closePath();
  g.fill();
  g.stroke();
  // light from the left, bent to the focus (drawn to scale on this axis when it fits)
  const f = focalLengthMm(radiusMm) * pxPerMm;
  g.strokeStyle = '#ffd98a99';
  g.lineWidth = 1.4;
  for (const y of [-0.8, -0.4, 0.4, 0.8]) {
    const yy = cy + y * half;
    g.beginPath();
    g.moveTo(30, yy);
    g.lineTo(cx, yy);
    const fx = cx + f;
    const t = Math.min(1, (w - 30 - cx) / Math.max(1, f));
    g.lineTo(cx + (fx - cx) * t, yy + (cy - yy) * t);
    g.stroke();
  }
  if (cx + f < w - 30) {
    g.fillStyle = '#ffd35a';
    g.beginPath();
    g.arc(cx + f, cy, 5, 0, Math.PI * 2);
    g.fill();
    g.font = '18px system-ui';
    g.fillText('focus', cx + f - 20, cy - 12);
  }
  if (grinding) {
    // sparks off the wheel
    g.fillStyle = '#ffcf7a';
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = half + Math.random() * 40;
      g.fillRect(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r, 2, 2);
    }
  }
  g.fillStyle = '#9aabb8';
  g.font = '19px system-ui';
  g.fillText(`curve drawn 3× deeper than it is · ${D.toFixed(1)} mm wide`, 14, hgt - 12);
}
