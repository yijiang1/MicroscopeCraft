// Tomography panel (tier 7, tomography mode): the sample turns through 180° in the beam and every projection is
// recorded (the sinogram). Filtered back-projection rebuilds a slice, but only if you tell it where the rotation
// axis is: a wrong axis smears every edge into arcs.
import { phantom, reconstruct, sinogram, tomoScore, trueAxisPx } from '../shared/sim/tomo';
import { recordScore, type GameContext } from '../shared/state';
import { button, canvas, el, paint, panel, pct, slider, type Tuning } from './kit';

const N = 96;
const ANGLES = 90;
/** Pixel size of the tomography detector, µm (the step's lens blur). */
const PIXEL_UM = 2;

export function tomoTuning(host: HTMLElement, ctx: GameContext, sampleId: string, redraw: () => void): Tuning {
  const seed = [...sampleId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const axis = trueAxisPx(sampleId);
  const sino = sinogram(phantom(N, seed), N, ANGLES, axis);
  let guess = 0;
  const { box, status } = panel(host, 'Tomography');
  const sinoCanvas = canvas(130, 122);
  const slice = canvas(130);
  let pending = 0;
  const err = () => guess - axis;
  const update = () => {
    status.textContent = pct(tomoScore(err()));
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => paint(slice, reconstruct(sino, N, ANGLES, guess), N, 1));
    redraw();
  };
  const row = el('div', 'display:flex;gap:6px');
  const left = el('div', 'flex:1;text-align:center;font-size:11px;color:#aab', 'Sinogram');
  const right = el('div', 'flex:1;text-align:center;font-size:11px;color:#aab', 'Rebuilt slice');
  left.append(sinoCanvas);
  right.append(slice);
  row.append(left, right);
  box.append(
    el('div', 'font-size:12px;color:#aab;margin:2px 0', 'Each row of the sinogram is one projection as the sample turns. Move the rotation axis until the slice is sharp, with no arcs.'),
    row,
    slider('Rotation axis', -12, 12, 0.5, guess, (v) => {
      guess = v;
      update();
    }, (v) => `${v > 0 ? '+' : ''}${v} px`).wrap,
    button('Record (score the reconstruction)', () => recordScore(ctx, 'tomo_center', tomoScore(err())), 'width:100%;margin-top:6px'),
  );
  paint(sinoCanvas, sino, N, 1);
  update();
  return {
    // a wrong axis smears the slice by about half the error on each side
    scope: (s) => ({ ...s, dLensUm: Math.hypot(s.dLensUm, Math.abs(err()) * PIXEL_UM) }),
    banner: () => (Math.abs(err()) > 1 ? 'The rebuilt slices are smeared into arcs: the rotation axis is in the wrong place. Use the tomography panel.' : null),
    dispose: () => {
      cancelAnimationFrame(pending);
      box.remove();
    },
  };
}
