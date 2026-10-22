// Aberration corrector panel (tier 6, annular dark field): tune defocus, astigmatism, coma, three-fold astigmatism
// and spherical aberration until the centre of the Ronchigram is flat and wide, then open the probe aperture to match.
import { bestAperture, correctorScore, probeNm, residual, ronchigram, STEM_LAMBDA_NM, ZERO, type Aberrations } from '../shared/sim/corrector';
import { fmtUm } from '../shared/sim/walls';
import { recordScore, setAlign, type GameContext } from '../shared/state';
import { button, canvas, el, paint, panel, pct, slider, steps, type Tuning } from './kit';

const KNOBS: [string, string, (a: Aberrations, v: number) => void, (a: Aberrations) => number, number, string][] = [
  ['C1 defocus', 'C1', (a, v) => (a.C1 = v), (a) => a.C1, 100, 'nm'],
  ['A1 astig. x', 'A1x', (a, v) => (a.A1[0] = v), (a) => a.A1[0], 60, 'nm'],
  ['A1 astig. y', 'A1y', (a, v) => (a.A1[1] = v), (a) => a.A1[1], 60, 'nm'],
  ['B2 coma x', 'B2x', (a, v) => (a.B2[0] = v), (a) => a.B2[0], 600, 'nm'],
  ['B2 coma y', 'B2y', (a, v) => (a.B2[1] = v), (a) => a.B2[1], 600, 'nm'],
  ['A2 3-fold x', 'A2x', (a, v) => (a.A2[0] = v), (a) => a.A2[0], 500, 'nm'],
  ['A2 3-fold y', 'A2y', (a, v) => (a.A2[1] = v), (a) => a.A2[1], 500, 'nm'],
  ['C3 spherical', 'C3', (a, v) => (a.C3 = v * 1000), (a) => a.C3 / 1000, 40, 'µm'],
];

export function correctorTuning(host: HTMLElement, ctx: GameContext, redraw: () => void): Tuning {
  const knobs: Aberrations = { ...ZERO, A1: [0, 0], B2: [0, 0], A2: [0, 0] };
  for (const [, key, set] of KNOBS) set(knobs, ctx.state.align[`cor_${key}`] ?? 0);
  let aperture = ctx.state.align.cor_aperture ?? 25; // mrad
  const { box, status } = panel(host, 'Aberration corrector');
  const ron = canvas(180);
  const read = el('div', 'font-size:12px;color:#cde;margin:2px 0');
  const list = steps([
    'Bring C1 near zero: the middle of the Ronchigram becomes a smooth patch.',
    'Cancel A1, B2 and A2 so the patch is round and centred.',
    'Trim C3: a little negative C3 balances the fixed fifth order and widens the patch.',
    'Choose the aperture that gives the smallest probe: about as wide as the flat patch. Wider lets in aberrated rays.',
  ]);
  let probe = probeNm(residual(knobs), aperture / 1000);
  let pending = 0;
  const update = () => {
    const a = residual(knobs);
    probe = probeNm(a, aperture / 1000);
    const score = correctorScore(a, aperture / 1000);
    status.textContent = pct(score);
    read.textContent = `Flat patch ${(probe.flatRad * 1000).toFixed(1)} mrad · aperture ${aperture} mrad · probe ${fmtUm(probe.dNm / 1000)}`;
    list.tick(0, Math.abs(a.C1) < 15);
    list.tick(1, Math.hypot(...a.A1) < 8 && Math.hypot(...a.B2) < 60 && Math.hypot(...a.A2) < 60);
    list.tick(2, probe.flatRad > 0.024);
    list.tick(3, probe.dNm <= bestAperture(a).dNm * 1.03);
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      paint(ron, ronchigram(a, 128, 0.04), 128, 0.45);
      const g = ron.getContext('2d')!;
      g.strokeStyle = '#ffd24a';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(ron.width / 2, ron.height / 2, (aperture / 40) * (ron.width / 2), 0, Math.PI * 2);
      g.stroke();
    });
    redraw();
  };
  const rows = KNOBS.map(([label, key, set, get, range, unit]) =>
    slider(label, -range, range, range / 200, get(knobs), (v) => {
      set(knobs, v);
      setAlign(ctx, `cor_${key}`, v);
      update();
    }, (v) => `${+v.toFixed(1)} ${unit}`).wrap,
  );
  box.append(
    el('div', 'font-size:12px;color:#aab;margin-top:2px', 'Ronchigram (the yellow circle is the probe aperture):'),
    ron,
    read,
    list.list,
    ...rows,
    slider('Probe aperture', 5, 40, 0.5, aperture, (v) => {
      aperture = v;
      setAlign(ctx, 'cor_aperture', v);
      update();
    }, (v) => `${v} mrad`).wrap,
    button('Record (score the probe)', () => recordScore(ctx, 'ronchigram', correctorScore(residual(knobs), aperture / 1000)), 'width:100%;margin-top:6px'),
  );
  update();
  return {
    // the probe sets the resolution: make the Abbe term equal the probe size; the stage and source floor stays in dLens
    scope: (s) => (s.mode === 'haadf' ? { ...s, NA: STEM_LAMBDA_NM / (2 * probe.dNm) } : s),
    banner: () => (probe.dNm > 0.12 ? `The probe is ${fmtUm(probe.dNm / 1000)} wide: tune the corrector until the Ronchigram's centre is flat, then match the aperture.` : null),
    dispose: () => {
      cancelAnimationFrame(pending);
      box.remove();
    },
  };
}
