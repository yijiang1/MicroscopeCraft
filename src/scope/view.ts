// The 2D eyepiece. Physics comes from shared/sim: the whole specimen is blurred by the scope's
// effective resolution d_eff, so unresolved detail really disappears instead of being faked per layer.
import { DRAWERS, type View } from './draw';
import { scopeResolutionUm, visibility } from '../shared/sim/optics';
import { discover, type GameContext } from '../shared/state';
import type { ScopeHandle } from './index';

/** Screen pixels per µm of *apparent* (magnified) size. Display choice: the eye's 100 µm limit shows as 10 px. */
const PX_PER_APPARENT_UM = 0.1;
/** Gaussian sigma = FWHM / 2.355. Simplification: treat d_eff as the FWHM of the point-spread function. */
const FWHM_TO_SIGMA = 1 / 2.355;
const BACKGROUND = '#16361a';
/** Specimen point at the middle of the field. Placeholder: sits on a secondary leaf vein so a magnified view
 *  shows a vein network rather than only the midrib. Becomes per-sample data when panning is added. */
const CENTER = { x: 475, y: -700 };

/** Round scale-bar length (1, 2 or 5 × 10^n µm) closest to 120 px. */
function niceBarUm(pxPerUm: number) {
  const target = 120 / pxPerUm;
  const pow = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].map((m) => m * pow).reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best));
}

const fmtUm = (um: number) => (um >= 1000 ? `${um / 1000} mm` : um >= 1 ? `${um} µm` : `${Math.round(um * 1000)} nm`);

export function mountEyepiece(el: HTMLElement, ctx: GameContext): ScopeHandle {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;background:#000';
  el.appendChild(canvas);
  const scene = document.createElement('canvas');

  const render = (sampleId: string) => {
    const sample = ctx.data.samples[sampleId];
    const g = canvas.getContext('2d');
    const sg = scene.getContext('2d');
    if (!sample || !g || !sg) return;
    const w = (canvas.width = scene.width = el.clientWidth);
    const h = (canvas.height = scene.height = el.clientHeight);
    const { scope } = ctx.state;
    const pxPerUm = scope.magnification * PX_PER_APPARENT_UM;
    const view: View = {
      x0: CENTER.x - w / 2 / pxPerUm, x1: CENTER.x + w / 2 / pxPerUm,
      y0: CENTER.y - h / 2 / pxPerUm, y1: CENTER.y + h / 2 / pxPerUm,
      pxPerUm,
    };

    // Specimen layer: smaller features first so the bigger structure sits on top. Alpha = contrast.
    sg.fillStyle = BACKGROUND;
    sg.fillRect(0, 0, w, h);
    sg.save();
    sg.translate(w / 2, h / 2);
    sg.scale(pxPerUm, pxPerUm);
    sg.translate(-CENTER.x, -CENTER.y);
    for (const f of [...sample.features].sort((a, b) => a.sizeUm - b.sizeUm)) {
      sg.globalAlpha = Math.min(1, f.contrast * scope.contrastBoost * 2);
      DRAWERS[f.drawing](sg, f, view);
    }
    sg.restore();

    // Eyepiece: blur by d_eff (ctx.filter needs a current Chrome/Firefox/Safari), clipped to a round field.
    const dEffUm = scopeResolutionUm(scope);
    const sigmaPx = dEffUm * pxPerUm * FWHM_TO_SIGMA;
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.save();
    g.beginPath();
    g.arc(w / 2, h / 2, Math.min(w, h) * 0.46, 0, Math.PI * 2);
    g.clip();
    g.filter = `blur(${sigmaPx.toFixed(2)}px)`;
    g.drawImage(scene, 0, 0);
    g.restore();

    // HUD: what each feature does under this scope, plus a scale bar.
    g.font = '15px system-ui';
    g.fillStyle = '#fff';
    g.fillText(`${sample.name} · ${scope.magnification}× · resolves ≥ ${fmtUm(+dEffUm.toPrecision(2))}`, 20, 28);
    sample.features.forEach((f, i) => {
      const v = visibility(f, scope);
      g.fillStyle = v.visible ? '#9be59b' : '#ffb27a';
      g.fillText(`${v.visible ? '✓' : '✗'} ${f.name} (${fmtUm(f.sizeUm)}): ${v.visible ? 'visible' : v.reason}`, 20, 54 + i * 22);
      if (v.visible) discover(ctx, f.id);
    });
    const bar = niceBarUm(pxPerUm);
    g.fillStyle = '#fff';
    g.fillRect(20, h - 40, bar * pxPerUm, 4);
    g.fillText(fmtUm(bar), 20, h - 48);
    g.fillStyle = '#aaa';
    g.fillText('Esc or F to close', w - 150, h - 20);
  };

  const onKey = (e: KeyboardEvent) => {
    if (el.style.display === 'block' && (e.key === 'Escape' || e.key.toLowerCase() === 'f')) {
      ctx.bus.emit('closeEyepiece', {});
    }
  };
  addEventListener('keydown', onKey);
  const offOpen = ctx.bus.on('openEyepiece', ({ sampleId }) => {
    el.style.display = 'block';
    render(sampleId);
  });
  const offClose = ctx.bus.on('closeEyepiece', () => (el.style.display = 'none'));

  return {
    dispose() {
      removeEventListener('keydown', onKey);
      offOpen();
      offClose();
      el.replaceChildren();
    },
  };
}
