// Electron ptychography panel (tier 6, EMPAD mode): choose how big the defocused probe is and how far it steps,
// then reconstruct. With about 60% overlap or more, ePIE finds the atoms; with less it fails, as in real experiments.
// The reconstruction runs a few iterations per frame so you can watch it converge.
import { epieIteration, field, makeProbe, overlap, ptychoScore, scanPositions, simulate, startReconstruction, truePhase, OBJ_N, PROBE_N } from '../shared/sim/ptycho';
import { recordScore, setAlign, type GameContext } from '../shared/state';
import { button, canvas, el, paint, panel, pct, slider, type Tuning } from './kit';

/** Display units: the simulation's pixel is about 0.45 Å, so the lattice spacing matches MoS₂'s 3.2 Å. */
const PX_ANGSTROM = 0.45;
const ITERATIONS = 30;
/** Converged well enough to show the atoms. */
export const PTYCHO_PASS = 0.6;

/** Samples whose ptychography reconstruction converged, this session. */
const solved = new Set<string>();

export function ptychoTuning(host: HTMLElement, ctx: GameContext, sampleId: string, redraw: () => void): Tuning {
  let radius = ctx.state.align.ptycho_radius ?? 6;
  let step = ctx.state.align.ptycho_step ?? 10;
  const { box, status } = panel(host, 'Electron ptychography');
  const scan = canvas(140);
  const recon = canvas(140);
  const read = el('div', 'font-size:12px;color:#cde;margin:4px 0');
  const note = el('div', 'font-size:12px;color:#aab;margin:4px 0');
  let raf = 0;
  let running = false;
  const truth = truePhase();
  const drawScan = () => {
    const g = scan.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, scan.width, scan.height);
    const k = scan.width / OBJ_N;
    g.strokeStyle = '#ffd24a66';
    for (const [x, y] of scanPositions(step)) {
      g.beginPath();
      g.arc((x + PROBE_N / 2) * k, (y + PROBE_N / 2) * k, radius * k, 0, Math.PI * 2);
      g.stroke();
    }
    read.textContent = `Probe ${(2 * radius * PX_ANGSTROM).toFixed(1)} Å wide · step ${(step * PX_ANGSTROM).toFixed(1)} Å · overlap ${pct(overlap(step, radius))} · ${scanPositions(step).length} positions`;
  };
  const run = () => {
    if (running) return;
    running = true;
    const probe = makeProbe(radius);
    const positions = scanPositions(step);
    const amps = simulate(truth, probe, positions);
    const rec = startReconstruction(radius);
    const mask = field();
    let i = 0;
    const tick = () => {
      for (let n = 0; n < 2 && i < ITERATIONS; n++, i++) epieIteration(rec, amps, positions);
      const phase = rec.objRe.map((re, j) => Math.atan2(rec.objIm[j]!, re));
      paint(recon, phase, OBJ_N, 1, [200, 230, 255]);
      const score = ptychoScore(rec, truth, mask);
      status.textContent = `${i}/${ITERATIONS} · ${pct(score)}`;
      if (i < ITERATIONS) {
        raf = requestAnimationFrame(tick);
        return;
      }
      running = false;
      recordScore(ctx, 'ptycho', score);
      if (score >= PTYCHO_PASS) solved.add(sampleId);
      note.textContent = score >= PTYCHO_PASS
        ? 'Converged: the reconstruction matches every diffraction pattern. The atoms are in the picture.'
        : 'It did not converge: neighbouring positions overlap too little to pin down both the probe and the sample. Step less, or spread the probe.';
      redraw();
    };
    raf = requestAnimationFrame(tick);
  };
  box.append(
    el('div', 'font-size:12px;color:#aab;margin-top:2px', 'Scan positions (circles: the probe):'),
    scan,
    read,
    slider('Probe size', 4, 11, 0.5, radius, (v) => {
      radius = v;
      setAlign(ctx, 'ptycho_radius', v);
      drawScan();
    }, (v) => `${(2 * v * PX_ANGSTROM).toFixed(1)} Å`).wrap,
    slider('Scan step', 3, 24, 1, step, (v) => {
      step = v;
      setAlign(ctx, 'ptycho_step', v);
      drawScan();
    }, (v) => `${(v * PX_ANGSTROM).toFixed(1)} Å`).wrap,
    button('Reconstruct (ePIE)', run, 'width:100%;margin-top:6px'),
    el('div', 'font-size:12px;color:#aab;margin-top:6px', 'Reconstructed phase:'),
    recon,
    note,
  );
  drawScan();
  status.textContent = solved.has(sampleId) ? 'converged' : '';
  return {
    contrast: () => (solved.has(sampleId) ? 1 : 0), // no picture at all until a reconstruction converges
    banner: () => (solved.has(sampleId) ? null : 'Ptychography rebuilds the picture from a diffraction pattern at every probe position. Set the overlap and press Reconstruct.'),
    animating: () => running,
    dispose: () => {
      cancelAnimationFrame(raf);
      box.remove();
    },
  };
}
