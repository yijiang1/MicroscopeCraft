// The electron bench (advanced mode): build the transmission electron microscope by hand instead of pressing C.
// Stack the column from its base up, pump it down, switch on the high voltage, heat the filament to saturation and
// slide in an objective aperture. The voltage and the aperture are yours to choose, and they decide what it can
// see: shared/sim/column.ts turns the build into the zoom steps the eyepiece uses. Opened like the workbench, with
// Shift+B, from the menu, or with C when the goal card says to build the TEM.
import type { Feature, Sample } from '../shared/schema';
import { isTemBuild } from '../shared/schema';
import { scopeThatSees } from '../shared/plan';
import { APERTURES_UM, columnOptics, compileColumn, KV_SETTINGS, wavelengthNm } from '../shared/sim/column';
import { visibility } from '../shared/sim/optics';
import { chi, CS_NM, scherzerNm } from '../shared/sim/tem';
import { fmtUm } from '../shared/sim/walls';
import { assemble, canCraft, scopeParamsFromSpec, type GameContext } from '../shared/state';
import {
  canPlace, canPump, columnFromBuild, columnPart, columnSteps, COLUMN_PARTS, complete, emission, filamentLife, filamentState, newColumn,
  place, pump, pumped, READY_PA, SATURATION, setAperture, setHeat, setKV, toTemBuild, vent, type ColumnDraft, type ColumnPartId,
} from './column';
import { createColumnScene, type ColumnScene } from './column-scene';
import { btn, h, injectStyle, slider } from './dom';

type Mode = 'build' | 'edit' | 'practice';
export interface ElectronBench {
  open(): void;
  dispose(): void;
}
export type GateTarget = { feature: Feature; sample: Sample; material: string };

const GLYPH: Record<ColumnPartId, string> = { vacuum: '⛭', screen: '▣', projector: '◎', objective: '◉', condenser: '◎', gun: '⚡' };
/** Samples to try the column on, if the game has them; the gold grid first. */
const TEST_SAMPLES = ['gold_grid', 'stained_glass', 'magnetite', 'soot_sample', 'crystal_sample', 'monazite'];

/** Pressure as 1.0 × 10⁻⁴ Pa. */
const SUP: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const fmtPa = (pa: number) => {
  const e = Math.floor(Math.log10(pa) + 1e-9);
  return `${(pa / 10 ** e).toFixed(1)} × 10${[...`${e}`].map((c) => SUP[c]).join('')} Pa`;
};
const fmtNm = (nm: number) => `${nm.toFixed(nm < 1 ? 3 : 2)} nm`;

export function mountElectronBench(el: HTMLElement, ctx: GameContext, targets: GateTarget[]): ElectronBench {
  const recipe = ctx.data.recipes.find((r) => r.assembly === 'tem');
  if (!recipe?.scope) return { open() {}, dispose() {} };
  injectStyle();
  const spec = recipe.scope;
  const item = recipe.output.itemId;
  const samples = TEST_SAMPLES.filter((id) => ctx.data.samples[id]);

  // --- layout (the workbench's style sheet)
  el.className = 'wb';
  const grid = h('div', 'wb-grid');
  const left = h('div', 'wb-col wb-left');
  const center = h('div', 'wb-center');
  const right = h('div', 'wb-col wb-right');
  grid.append(left, center, right);
  const host3d = h('div', 'wb-3d');
  const hint = h('div', 'wb-hint');
  const float = h('div', 'wb-float');
  const dock = h('div', 'wb-dock');
  dock.style.display = 'block';
  const done = h('div', 'wb-done');
  center.append(host3d, hint, float, dock, done);
  el.append(grid);

  const title = h('div');
  title.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px';
  title.append(h('h2', '', 'Electron bench'), btn('Close [Esc]', () => close()));
  const badge = h('div', 'wb-badge');
  const stepList = h('ol', 'wb-steps');
  const partList = h('div');
  left.append(
    title,
    h('div', 'wb-muted', 'Transmission electron microscope: electrons from the gun pass through a thin sample, and magnetic lenses make the image on a glowing screen.'),
    badge, h('div', 'wb-h', 'Steps'), stepList, h('div', 'wb-h', 'Column parts'), partList,
  );

  const screen = h('canvas');
  screen.width = screen.height = 320;
  const screenBox = h('div', 'wb-preview');
  screen.style.cursor = 'default';
  screenBox.append(screen);
  const opticsBox = h('div');
  const ctf = h('canvas');
  ctf.width = 640;
  ctf.height = 300;
  ctf.style.cssText = 'display:block;width:100%;border-radius:8px;background:#0b0e12';
  const sampleSelect = h('select', 'wb-select');
  for (const id of samples) {
    const o = h('option', '', `Sample: ${ctx.data.samples[id]!.name}`);
    o.value = id;
    sampleSelect.append(o);
  }
  const verdictList = h('ul', 'wb-list');
  const targetBox = h('div', 'wb-target');
  const nameInput = h('input', 'wb-text');
  nameInput.placeholder = 'Name it (engraved on the column)';
  nameInput.maxLength = 24;
  const finishBtn = btn('', () => finish(), 'primary big');
  right.append(
    h('div', 'wb-h', 'Viewing screen'), screenBox,
    h('div', 'wb-h', 'Optics'), opticsBox,
    h('div', 'wb-h', 'Contrast transfer at Scherzer defocus'), ctf,
    h('div', 'wb-h', 'What it will show'), sampleSelect, verdictList, targetBox,
    h('div', 'wb-h', 'Finish'), nameInput, h('div'), finishBtn,
  );
  finishBtn.style.marginTop = '8px';

  // --- the dock: vacuum, high voltage, filament, aperture
  const gauge = h('div', 'wb-row');
  const pumpBtn = btn('Pump down', () => togglePump());
  const vacRow = h('div');
  vacRow.style.cssText = 'display:flex;gap:10px;align-items:center;justify-content:space-between';
  vacRow.append(gauge, pumpBtn);
  const chips = <T>(label: string, values: readonly T[], text: (v: T) => string, pick: (v: T) => void) => {
    const row = h('div');
    row.style.cssText = 'display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px;align-items:center';
    const box = h('div', 'wb-chips');
    box.style.margin = '3px 0';
    const buttons = values.map((v) => {
      const b = h('button', 'wb-chip', text(v));
      b.type = 'button';
      b.onclick = () => pick(v);
      box.append(b);
      return b;
    });
    row.append(h('span', 'wb-muted', label), box);
    return { row, set: (on: (v: T) => boolean, enabled = true) => buttons.forEach((b, i) => ((b.className = `wb-chip${on(values[i]!) ? ' on' : ''}`), (b.disabled = !enabled))) };
  };
  const kvChips = chips('Voltage', [0, ...KV_SETTINGS], (v) => (v ? `${v} kV` : 'Off'), (v) => {
    if (!setKV(draft, v)) say(complete(draft) ? 'The high voltage stays locked until the column is pumped: it would spark across the gas.' : 'Put the column together and pump it first.');
    refresh();
  });
  const heat = slider('Filament', 0, 1, 0.002, (v) => {
    if (!setHeat(draft, v)) say('Switch on the high voltage first: it pulls the electrons away from the filament.');
    refresh();
  });
  const apChips = chips('Aperture', [null, ...APERTURES_UM], (v) => (v === null ? 'Out' : `${v} µm`), (v) => {
    setAperture(draft, v);
    refresh();
  });
  dock.append(vacRow, kvChips.row, heat.row, apChips.row);

  // --- state
  let mode: Mode = 'practice';
  const drafts: Partial<Record<Mode, ColumnDraft>> = {};
  let draft = newColumn();
  let scene: ColumnScene | null = null;
  let selected: ColumnPartId | null = null;
  let sampleId = samples[0] ?? Object.keys(ctx.data.samples)[0]!;
  let message = '';
  let messageTimer = 0;
  let raf = 0;
  let last = 0;
  const isOpen = () => el.style.display === 'block';
  const modeNow = (): Mode => ((ctx.state.inventory[item] ?? 0) > 0 ? 'edit' : canCraft(ctx, recipe.id) ? 'build' : 'practice');
  const draftFor = (m: Mode): ColumnDraft => {
    const saved = ctx.state.builds[item];
    if (m === 'edit') return columnFromBuild(isTemBuild(saved) ? saved : { kind: 'tem', kV: 200, apertureUm: 40, name: '' });
    return (drafts[m] ??= newColumn());
  };
  const say = (text: string) => {
    message = text;
    clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
      message = '';
      if (isOpen()) refresh();
    }, 4500);
  };
  const builtSpec = () => (draft.kV && draft.apertureUm !== null ? compileColumn({ kind: 'tem', kV: draft.kV, apertureUm: draft.apertureUm, name: '' }, spec) : null);
  const beamShare = () => (pumped(draft) && draft.kV ? emission(draft.heat) : 0);

  // --- actions
  const placePart = (id: ColumnPartId) => {
    if (!place(draft, id)) {
      const need = columnPart(id).needs.find((n) => !draft.placed.includes(n));
      if (need) say(`The ${columnPart(id).name.toLowerCase()} stands on the ${columnPart(need).name.toLowerCase()}: a TEM is built from the base up.`);
      return;
    }
    selected = null;
    refresh();
  };
  function togglePump() {
    if (draft.pumping) draft.pumping = false;
    else if (pumped(draft)) {
      vent(draft);
      say('Vented: air is back in the column, so the high voltage and the filament went off.');
    } else if (!canPump(draft)) say('The pumps cannot start: the column is still open. Put every part on, up to the gun that closes the top.');
    else {
      draft.pumping = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }
    refresh();
  }
  const tick = (now: number) => {
    if (!draft.pumping || !isOpen()) return;
    const ready = pump(draft, Math.min(0.1, (now - last) / 1000));
    last = now;
    if (ready && draft.pressurePa <= READY_PA / 10) draft.pumping = false;
    refresh();
    if (draft.pumping) raf = requestAnimationFrame(tick);
  };
  function finish() {
    const build = toTemBuild(draft);
    if (!build) return;
    if (mode === 'practice') return showDone(build, true);
    if (!assemble(ctx, recipe!.id, build)) return say('Something is missing: check the parts in your bag.');
    showDone(build, false);
  }

  // --- drawing
  /** The green screen: the beam's spot. Below saturation it shows the hot filament itself (a halo with a bright
   *  spot to one side); at saturation an even round disc. */
  const drawScreen = () => {
    const g = screen.getContext('2d')!;
    const w = screen.width, c = w / 2;
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, w);
    g.fillStyle = '#0d1a10';
    g.beginPath();
    g.arc(c, c, c - 4, 0, Math.PI * 2);
    g.fill();
    const e = beamShare();
    if (e > 0.005) {
      const under = Math.min(1, Math.max(0, (SATURATION - draft.heat) / (SATURATION - 0.35)));
      const R = c * 0.62;
      const lum = (a: number) => `rgba(140,255,150,${Math.min(1, a)})`;
      const disc = g.createRadialGradient(c, c, 0, c, c, R);
      disc.addColorStop(0, lum(e * (1 - under) * 0.95));
      disc.addColorStop(0.85, lum(e * (1 - under) * 0.8));
      disc.addColorStop(1, lum(0));
      g.fillStyle = disc;
      g.fillRect(0, 0, w, w);
      if (under > 0) {
        // the filament's own image: a ring of emission round a darker middle, and the hot spot that emits first
        g.strokeStyle = lum(e * under * 1.2);
        g.lineWidth = R * 0.18;
        g.filter = 'blur(6px)';
        g.beginPath();
        g.arc(c, c, R * 0.55, 0, Math.PI * 2);
        g.stroke();
        const spot = g.createRadialGradient(c + R * 0.32, c - R * 0.12, 0, c + R * 0.32, c - R * 0.12, R * 0.35);
        spot.addColorStop(0, lum(e * under * 1.6));
        spot.addColorStop(1, lum(0));
        g.fillStyle = spot;
        g.fillRect(0, 0, w, w);
        g.filter = 'none';
      }
    }
    g.fillStyle = '#9aabb8';
    g.font = '15px system-ui';
    g.textAlign = 'center';
    g.fillText(e > 0.005 ? `beam ${Math.round(e * 100)}% of saturation` : pumped(draft) ? 'no beam' : 'no vacuum, no beam', c, w - 18);
    scene?.screenChanged();
  };

  /** −sin χ along one direction at Scherzer defocus: the band where atoms show dark, cut off where the aperture is. */
  const drawCtf = () => {
    const g = ctf.getContext('2d')!;
    const W = ctf.width, H = ctf.height, pad = 34, kMax = 8;
    g.clearRect(0, 0, W, H);
    const x = (k: number) => pad + ((W - 2 * pad) * k) / kMax;
    const y = (v: number) => H / 2 - v * (H / 2 - 24);
    g.strokeStyle = '#ffffff22';
    g.beginPath();
    g.moveTo(pad, y(0));
    g.lineTo(W - pad, y(0));
    g.stroke();
    g.fillStyle = '#8fa3b4';
    g.font = '18px system-ui';
    g.textAlign = 'center';
    for (const d of [0.5, 0.25, 0.2, 0.15]) {
      g.fillText(`${d} nm`, x(1 / d), H - 6);
      g.fillRect(x(1 / d) - 0.5, y(0) - 4, 1, 8);
    }
    if (!draft.kV) {
      g.fillText('switch on the high voltage', W / 2, H / 2 - 20);
      return;
    }
    const lam = wavelengthNm(draft.kV);
    const df = scherzerNm(CS_NM, lam);
    const o = draft.apertureUm === null ? null : columnOptics({ kV: draft.kV, apertureUm: draft.apertureUm }, spec);
    const cut = o ? 1 / o.apertureNm : Infinity;
    if (o) {
      g.fillStyle = '#ff9d4a22';
      g.fillRect(x(Math.min(kMax, cut)), 18, W - pad - x(Math.min(kMax, cut)), H - 46);
    }
    g.strokeStyle = '#9be59b';
    g.lineWidth = 2.5;
    g.beginPath();
    for (let i = 0; i <= 400; i++) {
      const k = (kMax * i) / 400;
      const v = -Math.sin(chi(k, 0, lam, df));
      g.globalAlpha = k > cut ? 0.25 : 1;
      if (i === 0) g.moveTo(x(k), y(v));
      else g.lineTo(x(k), y(v));
      if (k > cut && (i === 0 || (kMax * (i - 1)) / 400 <= cut)) {
        g.stroke();
        g.beginPath();
        g.moveTo(x(k), y(v));
      }
    }
    g.stroke();
    g.globalAlpha = 1;
    const kS = 1 / columnOptics({ kV: draft.kV, apertureUm: 1 }, spec).scherzerNm;
    g.fillStyle = '#ffd35a';
    g.fillRect(x(kS) - 1, 18, 2, H - 46);
    g.textAlign = 'left';
    g.fillText(`first zero ${fmtNm(1 / kS)}`, Math.min(x(kS) + 6, W - 170), 30);
    if (o && cut < kMax) {
      g.fillStyle = '#ffb27a';
      g.fillText(`aperture ${fmtNm(o.apertureNm)}`, Math.min(x(cut) + 6, W - 170), 54);
    }
    g.fillStyle = '#8fa3b4';
    g.fillText(`defocus ${Math.round(df)} nm`, pad, 30);
  };

  // --- render
  function refresh(instant = false) {
    const steps = columnSteps(draft);
    const now = steps.findIndex((s) => !s.done);
    badge.className = `wb-badge ${mode}`;
    badge.textContent = mode === 'build' ? 'Building: you have every part' : mode === 'edit' ? 'Your TEM: change the voltage or aperture' : 'Practice: nothing is kept';
    stepList.replaceChildren(...steps.map((s, i) => h('li', s.done ? 'done' : i === now ? 'now' : '', s.label)));

    partList.replaceChildren(
      ...COLUMN_PARTS.map((p) => {
        const on = draft.placed.includes(p.id);
        const card = h('div', `wb-card${!on && canPlace(draft, p.id) ? ' next' : ''}${selected === p.id ? ' sel' : ''}`);
        const ic = h('div', 'ic', GLYPH[p.id]);
        const tx = h('div', 'tx');
        const need = p.needs.find((n) => !draft.placed.includes(n));
        tx.append(h('div', 'nm', p.name), h('div', 'sb', on ? 'In the column' : need ? `Goes on the ${columnPart(need).name.toLowerCase()}` : mode === 'practice' ? 'Ready to place (practice)' : 'Ready to place'));
        card.append(ic, tx);
        if (!on) {
          const b = btn('Place', () => placePart(p.id));
          b.disabled = !canPlace(draft, p.id);
          card.append(b);
        }
        card.onclick = (e) => {
          if ((e.target as HTMLElement).tagName === 'BUTTON') return;
          selected = selected === p.id ? null : p.id;
          refresh();
        };
        return card;
      }),
    );

    // dock
    gauge.replaceChildren(h('span', 'wb-muted', 'Vacuum'), h('b', pumped(draft) ? 'wb-ok' : draft.pumping ? 'wb-gold' : '', fmtPa(draft.pressurePa)));
    pumpBtn.textContent = draft.pumping ? 'Stop pumps' : pumped(draft) ? 'Vent' : 'Pump down';
    pumpBtn.className = `wb-btn${steps[1]!.done || !complete(draft) ? '' : ' primary'}`;
    kvChips.set((v) => v === draft.kV, pumped(draft));
    const st = filamentState(draft.heat);
    heat.set(draft.heat, draft.kV ? `${Math.round(emission(draft.heat) * 100)}%${st === 'over' ? ` · life ×${filamentLife(draft.heat).toFixed(2)}` : ''}` : 'off');
    heat.input.disabled = !draft.kV;
    apChips.set((v) => v === draft.apertureUm, complete(draft));

    // hint
    hint.textContent = message || hintText(now);

    // part info
    if (selected) {
      const p = columnPart(selected);
      const x = h('button', 'wb-x', '×');
      x.onclick = () => {
        selected = null;
        refresh();
      };
      const head = h('h3', '', p.name);
      head.append(x);
      float.replaceChildren(head, h('div', 'wb-muted', p.about));
      float.style.display = 'block';
    } else float.style.display = 'none';

    // optics
    const lam = draft.kV ? wavelengthNm(draft.kV) : null;
    const o = draft.kV && draft.apertureUm !== null ? columnOptics({ kV: draft.kV, apertureUm: draft.apertureUm }, spec) : null;
    const row = (k: string, v: string, cls = '') => {
      const r = h('div', 'wb-row');
      r.append(h('span', 'wb-muted', k), h('b', cls, v));
      return r;
    };
    opticsBox.replaceChildren(
      row('Electron wavelength', lam ? `${(lam * 1000).toFixed(2)} pm` : '—'),
      row('Aperture semi-angle', draft.apertureUm !== null ? `${(columnOptics({ kV: draft.kV || 200, apertureUm: draft.apertureUm }, spec).alpha * 1000).toFixed(1)} mrad` : 'out'),
      row('Lens limit 0.66 Cs¼ λ¾', o ? fmtNm(o.scherzerNm) : '—'),
      row('Aperture limit λ/α', o ? fmtNm(o.apertureNm) : '—'),
      row('Finest detail', o ? `${fmtNm(o.resolutionNm)} (${o.limit === 'aperture' ? 'the aperture' : 'the lens'})` : '—', o ? 'wb-gold' : ''),
      row('Contrast', o ? `×${o.contrast.toFixed(2)} of the standard TEM` : '—', o && o.contrast < 0.6 ? 'wb-warn' : ''),
    );

    // verdicts
    const built = builtSpec();
    const sample = ctx.data.samples[sampleId];
    verdictList.replaceChildren();
    if (!built || !sample) verdictList.append(h('li', 'wb-muted', 'Switch on the high voltage and choose an aperture to see what this column resolves.'));
    else {
      const best = built.steps.map((s) => s.mode).lastIndexOf('tem');
      for (const f of sample.features) {
        const tier = scopeThatSees(f, ctx.data)?.scope?.tier ?? 0;
        if (tier < 5 || tier > 6) continue; // things for light microscopes or X-rays
        const seen = built.steps.some((_, i) => visibility(f, scopeParamsFromSpec(built, i)).visible);
        const v = visibility(f, scopeParamsFromSpec(built, best));
        verdictList.append(h('li', seen ? 'wb-ok' : 'wb-warn', `${seen ? '✓' : '✗'} ${f.name} (${fmtUm(f.sizeUm)})${seen ? '' : `: ${v.reason === 'low-contrast' ? 'too faint' : v.reason === 'unresolved' ? 'too fine to resolve' : 'not shown'}`}`));
      }
      if (!verdictList.children.length) verdictList.append(h('li', 'wb-muted', 'Nothing on this sample needs an electron microscope.'));
    }
    targetBox.replaceChildren();
    targetBox.style.display = targets.length ? 'block' : 'none';
    for (const t of targets) {
      const sees = built ? built.steps.some((_, i) => visibility(t.feature, scopeParamsFromSpec(built, i)).visible) : false;
      targetBox.append(h('div', built ? (sees ? 'wb-ok' : 'wb-warn') : 'wb-muted', `${built ? (sees ? '✓' : '✗') : '•'} ${t.feature.name} (${fmtUm(t.feature.sizeUm)}) unlocks ${t.material}.`));
    }

    // finish
    const ready = !!toTemBuild(draft);
    finishBtn.disabled = !ready;
    finishBtn.textContent = mode === 'edit' ? 'Save changes' : mode === 'build' ? 'Switch it on: it is yours' : 'Try it (practice)';
    if (document.activeElement !== nameInput) nameInput.value = draft.name;

    drawScreen();
    drawCtf();
    scene?.update(
      { placed: draft.placed, ghosts: COLUMN_PARTS.filter((p) => canPlace(draft, p.id)).map((p) => p.id), beam: complete(draft) ? beamShare() : 0, heat: draft.kV ? draft.heat : 0, apertureUm: draft.apertureUm, selected },
      instant,
    );
  }

  function hintText(now: number): string {
    const next = COLUMN_PARTS.find((p) => canPlace(draft, p.id));
    switch (columnSteps(draft)[now]?.id) {
      case 'stack':
        return `Click the glowing outline, or Place, to add the ${next!.name.toLowerCase()}. A TEM is built from the base up.`;
      case 'pump':
        return draft.pumping ? `Pumping: ${draft.pressurePa > 1 ? 'the roughing pump' : 'the high-vacuum pump'} at ${fmtPa(draft.pressurePa)}` : 'The column is closed. Pump the air out: electrons would bounce off gas molecules.';
      case 'hv':
        return 'Choose a high voltage. Faster electrons have a shorter wavelength and resolve finer detail, but scatter less, so the image has less contrast.';
      case 'filament': {
        const st = filamentState(draft.heat);
        if (st === 'over') return 'Too hot: the current has stopped rising, and the filament only burns out sooner. Turn it back to where the current just levels off.';
        if (draft.heat > 0.58 && draft.heat < 0.66) return 'The current dipped: that was a false peak, one hot spot emitting first. Keep going until it stops rising.';
        return draft.heat < 0.35 ? 'Turn the filament up slowly, watching the screen.' : 'Not saturated yet: the spot is uneven, an image of the hot filament itself. Keep turning until it is a round, even disc.';
      }
      case 'aperture':
        return 'Saturated. Now slide an objective aperture in: a small hole gives more contrast but coarser detail, a big one finer detail but less contrast.';
      default:
        return mode === 'edit' ? 'Change the voltage or the aperture and save. Check what it will show on the right.' : 'Ready. Check what it will show on the right, then switch it on.';
    }
  }

  function showDone(build: { kV: number; apertureUm: number; name: string }, practice: boolean) {
    const o = columnOptics(build, spec);
    const card = h('div');
    card.append(
      h('h3', '', practice ? 'It would work!' : mode === 'edit' ? 'Saved' : 'It works! It is yours.'),
      h('p', '', `${build.kV} kV, a ${build.apertureUm} µm objective aperture: finest detail ${fmtNm(o.resolutionNm)}, contrast ×${o.contrast.toFixed(2)} of the standard TEM.`),
      h('p', 'wb-muted', practice
        ? 'This was practice: gather the parts the goal card lists, then build it for real here.'
        : 'It is installed in the lab of the science building: carry a sample there and press [F]. Come back with [Shift+B] to change the voltage or the aperture.'),
    );
    const acts = h('div');
    acts.style.cssText = 'display:flex;gap:8px;margin-top:10px';
    acts.append(btn('Back to the world', () => close(), 'primary'), btn('Keep tinkering', () => {
      done.style.display = 'none';
      mode = modeNow();
      draft = draftFor(mode);
      refresh(true);
    }));
    card.append(acts);
    done.replaceChildren(card);
    done.style.display = 'flex';
  }

  // --- open and close
  const onKey = (e: KeyboardEvent) => {
    if (!isOpen()) return;
    e.stopPropagation(); // the bench is modal: world, menu and crafting keys wait
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (document.activeElement === nameInput) nameInput.blur();
    else if (selected) {
      selected = null;
      refresh();
    } else close();
  };
  function open() {
    if (isOpen() || !ctx.state.advanced) return;
    if (ctx.state.currentSampleId) ctx.bus.emit('closeEyepiece', {});
    mode = modeNow();
    draft = draftFor(mode);
    selected = null;
    message = '';
    done.style.display = 'none';
    el.style.display = 'block';
    document.exitPointerLock?.();
    scene ??= createColumnScene(host3d, screen, {
      pick: (id, ghost) => {
        if (id && ghost) return placePart(id);
        selected = id && selected !== id ? id : null;
        refresh();
      },
    });
    scene.start();
    addEventListener('keydown', onKey, true);
    refresh(true);
    if (draft.pumping) raf = requestAnimationFrame(tick);
  }
  function close() {
    if (!isOpen()) return;
    cancelAnimationFrame(raf);
    el.style.display = 'none';
    scene?.stop();
    removeEventListener('keydown', onKey, true);
    ctx.bus.emit('closeWorkbench', {});
  }
  sampleSelect.addEventListener('change', () => {
    sampleId = sampleSelect.value;
    refresh();
  });
  nameInput.addEventListener('input', () => (draft.name = nameInput.value));

  return {
    open,
    dispose() {
      close();
      scene?.dispose();
      el.replaceChildren();
    },
  };
}
