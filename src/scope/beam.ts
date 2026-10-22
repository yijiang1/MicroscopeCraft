// CHESS beam tuning panel (tier 7, X-ray fluorescence mode): slide the undulator's magnet rows (its phase) to move
// its harmonics, and turn the Si(111) monochromator to pick an energy. An element shows in the map only if the
// energy is above its absorption edge, and brightly only if a harmonic's peak sits on that energy.
import type { Sample } from '../shared/schema';
import { beamTune, CCU, harmonicKeV, monoKeV, undulatorK, undulatorSpectrum } from '../shared/sim/beamline';
import { recordScore, setAlign, type GameContext } from '../shared/state';
import { button, canvas, el, panel, pct, slider, type Tuning } from './kit';

const E_MIN = 2;
const E_MAX = 30;

export function beamTuning(host: HTMLElement, ctx: GameContext, sample: Sample, redraw: () => void): Tuning {
  let phase = ctx.state.align.beam_phase ?? 0;
  let theta = ctx.state.align.beam_theta ?? 28; // starts at about 4.2 keV, below most edges
  const edges = sample.features.filter((f) => f.edgeKeV).map((f) => ({ name: f.name, keV: f.edgeKeV! }));
  const { box, status } = panel(host, 'Beam tuning');
  const plot = canvas(276, 150);
  const read = el('div', 'font-size:12px;color:#cde;margin:4px 0');
  const tuned = () => edges.map((e) => ({ ...e, t: beamTune(phase, theta, e.keV) }));
  const draw = () => {
    const g = plot.getContext('2d')!;
    const W = plot.width;
    const H = plot.height;
    g.fillStyle = '#05080c';
    g.fillRect(0, 0, W, H);
    const x = (e: number) => ((e - E_MIN) / (E_MAX - E_MIN)) * W;
    const ys: number[] = [];
    for (let i = 0; i < W; i++) ys.push(undulatorSpectrum(E_MIN + (i / W) * (E_MAX - E_MIN), phase));
    const top = Math.max(...ys, 1e-6);
    g.strokeStyle = '#ffd24a';
    g.lineWidth = 1.5;
    g.beginPath();
    ys.forEach((y, i) => g.lineTo(i, H - 14 - (y / top) * (H - 30)));
    g.stroke();
    g.font = '10px system-ui';
    for (const e of edges) {
      g.strokeStyle = '#7fd0ff';
      g.setLineDash([4, 3]);
      g.beginPath();
      g.moveTo(x(e.keV), 0);
      g.lineTo(x(e.keV), H - 12);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#7fd0ff';
      g.fillText(`${e.keV} keV`, x(e.keV) + 2, 10);
    }
    const em = monoKeV(theta);
    g.strokeStyle = '#ff6a8a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x(em), 0);
    g.lineTo(x(em), H - 12);
    g.stroke();
    g.fillStyle = '#889';
    for (let e = 5; e <= 30; e += 5) g.fillText(`${e}`, x(e) - 4, H - 2);
  };
  const update = () => {
    const K = undulatorK(phase);
    const list = tuned();
    const best = list.reduce((a, b) => (b.t.score > a.t.score ? b : a), list[0]!);
    status.textContent = best ? pct(best.t.score) : '';
    read.textContent = `K = ${K.toFixed(2)} · harmonics ${[1, 3, 5].map((n) => harmonicKeV(n, K).toFixed(1)).join(', ')} keV · monochromator ${monoKeV(theta).toFixed(2)} keV · flux ${best ? pct(best.t.flux) : '–'}`;
    draw();
    redraw();
  };
  box.append(
    el('div', 'font-size:12px;color:#aab;margin-top:2px', `Edges in ${sample.name}: ${edges.map((e) => `${e.name.replace(/ map$/, '')} ${e.keV} keV`).join(', ') || 'none'}. Put the monochromator (red) just above an edge (blue), on an undulator peak (yellow).`),
    plot,
    read,
    slider('Undulator phase', 0, CCU.periodMm / 2, 0.05, phase, (v) => {
      phase = v;
      setAlign(ctx, 'beam_phase', v);
      update();
    }, (v) => `${v.toFixed(2)} mm`).wrap,
    slider('Mono angle θ', 4, 30, 0.01, theta, (v) => {
      theta = v;
      setAlign(ctx, 'beam_theta', v);
      update();
    }, (v) => `${v.toFixed(2)}°`).wrap,
    el('div', 'font-size:11px;color:#889', 'Sliding one row of magnets along the other by half a period (14.2 mm) cancels the field; less shift, a stronger field and lower harmonic energies.'),
    button('Record (score the beam)', () => {
      const best = Math.max(0, ...tuned().map((e) => e.t.score));
      recordScore(ctx, 'beam_tune', best);
    }, 'width:100%;margin-top:6px'),
  );
  update();
  return {
    contrast: (f) => {
      if (!f.edgeKeV) return 1;
      const t = beamTune(phase, theta, f.edgeKeV);
      return t.above ? t.flux : 0; // a map needs real flux: about 15% of the best or more to show at all
    },
    banner: () =>
      edges.length && !tuned().some((e) => e.t.above)
        ? 'The beam is below every absorption edge here, so no element gives off its X-rays. Tune the beam to a higher energy.'
        : null,
    dispose: () => box.remove(),
  };
}
