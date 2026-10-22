// The light-microscope mini-games. Köhler illumination: focus, centre and size the field diaphragm's image, then set
// the aperture diaphragm; the result sets the illumination NA the eyepiece uses from then on. The Gram stain: four
// reagents in order, timed with a stopwatch that runs ten times fast; the alcohol rinse takes only a few seconds.
import { gram, koehler, KOEHLER_START, REAGENTS, UNALIGNED_ILLUMINATION, type Gram, type GramStep, type KoehlerKnobs } from '../shared/sim/bench';
import { recordScore, setAlign, type GameContext } from '../shared/state';
import { button, canvas, el, panel, pct, slider, steps, type Tuning } from './kit';

const modal = (host: HTMLElement, title: string) => {
  const box = el('div', 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(620px,94%);max-height:92%;overflow:auto;box-sizing:border-box;padding:14px 16px;border-radius:12px;background:#0b0f12f4;color:#eee;font:13px system-ui;z-index:5;box-shadow:0 8px 40px #000');
  box.append(el('div', 'font-size:16px;font-weight:700;margin-bottom:6px', title));
  host.append(box);
  return box;
};

/** The condenser's alignment, as the fraction of the objective's NA it lights the sample with. */
export const illumination = (ctx: GameContext, tier: number) => ctx.state.align[`koehler_${tier}`] ?? UNALIGNED_ILLUMINATION;

/** Köhler illumination as a modal over the eyepiece. Calls done() when closed. */
export function openKoehler(host: HTMLElement, ctx: GameContext, tier: number, done: () => void) {
  const k: KoehlerKnobs = { ...KOEHLER_START };
  const box = modal(host, 'Köhler illumination');
  const view = canvas(260);
  const pupil = canvas(110);
  const score = el('div', 'font-weight:600;color:#ffd24a');
  const list = steps([
    'Close the field diaphragm until you can see its edges.',
    'Raise or lower the condenser until those edges are sharp.',
    'Centre the bright patch with the centring screws.',
    'Open the field diaphragm until its edges just leave the field of view.',
    'Set the aperture diaphragm (the back focal plane, right) to about 70-90% of the objective.',
  ]);
  const draw = () => {
    const r = koehler(k);
    const g = view.getContext('2d')!;
    const W = view.width;
    const R = W * 0.46;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, W);
    g.save();
    g.beginPath();
    g.arc(W / 2, W / 2, R, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#1a1c1a';
    g.fillRect(0, 0, W, W);
    // the field diaphragm's image: an octagon, blurred by the condenser height error
    g.filter = `blur(${(r.edgeBlur * 10).toFixed(1)}px)`;
    g.fillStyle = '#f4f0dc';
    g.beginPath();
    const cx = W / 2 + r.offset[0] * R;
    const cy = W / 2 + r.offset[1] * R;
    for (let i = 0; i < 8; i++) g.lineTo(cx + Math.cos((i * Math.PI) / 4 + Math.PI / 8) * k.field * R, cy + Math.sin((i * Math.PI) / 4 + Math.PI / 8) * k.field * R);
    g.fill();
    g.filter = 'none';
    g.restore();
    const p = pupil.getContext('2d')!;
    p.fillStyle = '#000';
    p.fillRect(0, 0, 110, 110);
    p.strokeStyle = '#888';
    p.beginPath();
    p.arc(55, 55, 48, 0, Math.PI * 2);
    p.stroke();
    p.fillStyle = '#f4f0dc';
    p.beginPath();
    p.arc(55, 55, 48 * k.aperture, 0, Math.PI * 2);
    p.fill();
    score.textContent = `Alignment ${pct(r.score)} · lights ${pct(r.illumination)} of the objective's aperture`;
    list.tick(0, k.field < 1);
    list.tick(1, r.parts.focus >= 0.8);
    list.tick(2, r.parts.centre >= 0.8);
    list.tick(3, r.parts.field >= 0.95 && k.field >= 1);
    list.tick(4, r.parts.aperture >= 0.95);
  };
  const knob = (label: string, key: keyof KoehlerKnobs, min: number, max: number, step: number) =>
    slider(label, min, max, step, k[key], (v) => {
      k[key] = v;
      draw();
    }, (v) => v.toFixed(2)).wrap;
  const row = el('div', 'display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap');
  const left = el('div', 'text-align:center;font-size:11px;color:#aab', 'Field of view');
  const right = el('div', 'text-align:center;font-size:11px;color:#aab', 'Back focal plane');
  left.append(view);
  right.append(pupil, list.list);
  right.style.cssText += ';flex:1;min-width:200px;text-align:left';
  row.append(left, right);
  box.append(
    el('div', 'color:#aab;margin-bottom:6px', 'August Köhler (1893): light the sample evenly with the condenser, at an aperture matched to the objective.'),
    row,
    knob('Condenser height', 'height', -1, 1, 0.01),
    knob('Centring X', 'cx', -1, 1, 0.01),
    knob('Centring Y', 'cy', -1, 1, 0.01),
    knob('Field diaphragm', 'field', 0.3, 2, 0.01),
    knob('Aperture diaphragm', 'aperture', 0.1, 1, 0.01),
    score,
    button('Done', () => {
      const r = koehler(k);
      recordScore(ctx, 'koehler', r.score);
      setAlign(ctx, `koehler_${tier}`, r.illumination);
      box.remove();
      done();
    }, 'margin-top:8px;font-weight:600'),
    button('Cancel', () => {
      box.remove();
      done();
    }, 'margin:8px 0 0 6px'),
  );
  draw();
}

/** The condenser status panel for the high-quality and fluorescence microscopes in transmitted light. */
export function koehlerTuning(host: HTMLElement, ctx: GameContext, tier: number, redraw: () => void): Tuning {
  const { box, status } = panel(host, 'Condenser');
  const text = el('div', 'font-size:12px;color:#ccd;margin:4px 0');
  const sync = () => {
    const f = illumination(ctx, tier);
    const aligned = ctx.state.align[`koehler_${tier}`] !== undefined;
    status.textContent = aligned ? pct(f) : 'not aligned';
    text.textContent = aligned
      ? `Lighting ${pct(f)} of the objective's aperture. Resolution is λ / (NA objective + NA illumination).`
      : `Not aligned: the sample is lit unevenly, at about half the objective's aperture, so fine detail is lost.`;
  };
  box.append(
    text,
    button('Align condenser (Köhler)', () => {
      box.style.display = 'none';
      openKoehler(host, ctx, tier, () => {
        box.style.display = '';
        sync();
        redraw();
      });
    }, 'width:100%'),
  );
  sync();
  return {
    scope: (s) => (s.mode === 'fluorescence' ? s : { ...s, illuminationNA: s.NA * illumination(ctx, tier) }),
    dispose: () => box.remove(),
  };
}

/** The Gram stain as a modal: returns the result to `done` (null if cancelled). */
export function openGram(host: HTMLElement, ctx: GameContext, done: (result: Gram | null) => void) {
  const box = modal(host, 'Gram stain');
  const log: GramStep[] = [];
  const watch = el('div', 'font:600 28px system-ui;font-variant-numeric:tabular-nums;color:#ffd24a;text-align:center;margin:6px 0', '0 s');
  const sequence = el('div', 'font-size:12px;color:#ccd;min-height:18px');
  const slide = el('div', 'height:28px;border-radius:6px;margin:6px 0;background:#f4f0e8;transition:background .3s');
  let current: { reagent: GramStep['reagent']; start: number } | null = null;
  let raf = 0;
  const tick = () => {
    if (!current) return;
    watch.textContent = `${Math.round(((performance.now() - current.start) / 1000) * 10)} s`;
    raf = requestAnimationFrame(tick);
  };
  const rinse = () => {
    if (!current) return;
    const seconds = Math.round(((performance.now() - current.start) / 1000) * 10);
    log.push({ reagent: current.reagent, seconds });
    current = null;
    cancelAnimationFrame(raf);
    sequence.textContent = log.map((s) => `${REAGENTS.find((r) => r.id === s.reagent)!.name} ${s.seconds} s`).join(' → ');
    slide.style.background = '#e8eef4';
  };
  const reagentRow = el('div', 'display:flex;gap:6px;flex-wrap:wrap');
  for (const r of REAGENTS) {
    reagentRow.append(button(`${r.name}`, () => {
      rinse();
      current = { reagent: r.id, start: performance.now() };
      slide.style.background = r.color;
      tick();
    }, `border-left:6px solid ${r.color}`));
  }
  box.append(
    el('div', 'color:#aab;margin-bottom:6px', 'Hans Christian Gram (1884): crystal violet, then iodine to fix it, then a quick alcohol rinse, then safranin. Click a reagent to pour it, Rinse to wash it off. The stopwatch runs ten times fast.'),
    el('div', 'font-size:12px;color:#8fb8d8', REAGENTS.map((r) => `${r.name}: ${r.seconds}`).join(' · ')),
    reagentRow,
    slide,
    watch,
    button('Rinse with water', rinse, 'width:100%;font-weight:600'),
    sequence,
    button('Done: look at the result', () => {
      rinse();
      const result = gram(log);
      recordScore(ctx, 'gram', result.score);
      cancelAnimationFrame(raf);
      box.remove();
      done(result);
    }, 'margin-top:8px;font-weight:600'),
    button('Cancel', () => {
      cancelAnimationFrame(raf);
      box.remove();
      done(null);
    }, 'margin:8px 0 0 6px'),
  );
}
