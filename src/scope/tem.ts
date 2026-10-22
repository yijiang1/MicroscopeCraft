// TEM alignment panel (tier 5): centre the beam, find eucentric height with the α wobbler, correct the objective
// astigmatism by making the Thon rings round, and set Scherzer defocus. Modelled on the TEM explorer's console.
// The knobs stay where you leave them; each new sample sits at its own height, so the height (and focus) need redoing.
import { CS_NM, scherzerNm, TEM_LAMBDA_NM, TEM_START, temState, thonRings, type TemKnobs } from '../shared/sim/tem';
import { recordScore, setAlign, type GameContext } from '../shared/state';
import { button, canvas, el, paint, panel, pct, slider, steps, type Tuning } from './kit';

const KEYS: (keyof TemKnobs)[] = ['beamX', 'beamY', 'z', 'focus', 'stigX', 'stigY'];

/** lamNm: the column's electron wavelength (a hand-built TEM sets its own voltage). */
export function temTuning(host: HTMLElement, ctx: GameContext, sampleId: string, redraw: () => void, lamNm = TEM_LAMBDA_NM): Tuning {
  const k: TemKnobs = { ...TEM_START };
  for (const key of KEYS) k[key] = ctx.state.align[`tem_${key}`] ?? TEM_START[key];
  let wobbler = false;
  const { box, status } = panel(host, 'TEM alignment');
  const fft = canvas(180);
  const list = steps([
    'Centre the beam (beam shift): the bright disc fills the screen evenly.',
    'Eucentric height: turn on the α wobbler and change Z until the image stops swinging.',
    'Astigmatism: make the rings in the live FFT round (stigmator X and Y).',
    `Focus: set about ${Math.round(scherzerNm(CS_NM, lamNm))} nm, Scherzer defocus, where atoms show best.`,
  ]);
  let s = temState(k, sampleId, lamNm);
  const update = () => {
    s = temState(k, sampleId, lamNm);
    status.textContent = pct(s.score);
    [s.parts.beam, s.parts.height, s.parts.astig, s.parts.focus].forEach((p, i) => list.tick(i, p >= 0.8));
    paint(fft, thonRings(96, 6, s.defocusNm, s.astigNm, undefined, lamNm), 96, 0.8, [190, 255, 200]);
    redraw();
  };
  const knob = (label: string, key: keyof TemKnobs, min: number, max: number, step: number, unit: string) =>
    slider(label, min, max, step, k[key], (v) => {
      k[key] = v;
      setAlign(ctx, `tem_${key}`, v);
      update();
    }, (v) => `${+v.toFixed(2)} ${unit}`).wrap;
  const wob = el('label', 'display:flex;gap:6px;align-items:center;font-size:12px;margin:4px 0');
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.onchange = () => {
    wobbler = check.checked;
    redraw();
  };
  wob.append(check, 'α wobbler (tilts the stage back and forth)');
  box.append(
    el('div', 'font-size:12px;color:#aab;margin-top:2px', 'Live FFT of the thin carbon film (Thon rings):'),
    fft,
    list.list,
    knob('Beam shift X', 'beamX', -40, 40, 1, '%'),
    knob('Beam shift Y', 'beamY', -40, 40, 1, '%'),
    knob('Height Z', 'z', -8, 8, 0.05, 'µm'),
    wob,
    knob('Focus', 'focus', -400, 400, 1, 'nm'),
    knob('Stigmator X', 'stigX', -150, 150, 1, 'nm'),
    knob('Stigmator Y', 'stigY', -150, 150, 1, 'nm'),
    button('Record image (score the alignment)', () => recordScore(ctx, 'tem_align', s.score), 'width:100%;margin-top:6px'),
  );
  update();
  return {
    scope: (sc) => ({ ...sc, dLensUm: Math.hypot(sc.dLensUm, s.blurNm / 1000) }),
    // the beam off-centre dims the picture: modelled as lower contrast
    contrast: () => Math.max(0.15, 1 - Math.hypot(...s.beam) / 45),
    shift: (t) => (wobbler ? [s.dzUm * 12 * Math.sin(t * 0.004), 0] : [0, 0]),
    animating: () => wobbler,
    banner: () =>
      s.blurNm > 0.15 ? `Your column is out of alignment, adding about ${s.blurNm.toFixed(2)} nm of blur. Use the alignment panel: height, focus and astigmatism.` : null,
    dispose: () => box.remove(),
  };
}
