// The 2D eyepiece. Physics comes from shared/sim: the whole specimen is blurred by the scope's
// effective resolution d_eff, so unresolved detail really disappears instead of being faked per layer.
// Compound microscopes add a zoom step picker and a focus slider (mouse wheel works too).
import { DRAWERS, type View } from './draw';
import { scopeResolutionUm, visibility } from '../shared/sim/optics';
import { explainWall, fmtUm, nearestWall, resolutionLabel } from '../shared/sim/walls';
import { discover, setZoom, type GameContext } from '../shared/state';
import type { ScopeParams } from '../shared/schema';
import type { ScopeHandle } from './index';

/** Screen pixels per µm of *apparent* (magnified) size. Display choice: an 800 px field spans 20 mm of apparent size,
 *  so a 10× hand lens shows about 2 mm of specimen. Simplification: real eyepiece fields are about 10× wider. */
const PX_PER_APPARENT_UM = 0.04;
/** Gaussian sigma = FWHM / 2.355. Simplification: treat d_eff as the FWHM of the point-spread function. */
const FWHM_TO_SIGMA = 1 / 2.355;
const BACKGROUND = '#16361a';
/** Specimen point at the middle of the field. Placeholder: sits on a secondary leaf vein so a magnified view
 *  shows a vein network rather than only the midrib. Becomes per-sample data when panning is added. */
const CENTER = { x: 475, y: -700 };
/** Focus: slider position runs -1..1. Defocus blur (µm) = |offset from best focus| × this × NA.
 *  Simplification: geometric blur, linear in NA, so high-NA objectives are fussier like real ones. */
const FOCUS_BLUR_UM_PER_NA = 8;
const FOCUS_TIP_THRESHOLD = 0.5; // show the focus tip when defocus blur exceeds this fraction of d_eff

/** Round scale-bar length (1, 2 or 5 × 10^n µm) closest to 120 px. */
function niceBarUm(pxPerUm: number) {
  const target = 120 / pxPerUm;
  const pow = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].map((m) => m * pow).reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best));
}

/** Where sharp focus is for this sample and zoom step; stable so the player can find it by feel. */
function bestFocus(sampleId: string, step: number) {
  const h = [...`${sampleId}:${step}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 17);
  return (((h >>> 0) % 1000) / 1000) * 1.6 - 0.8;
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxW && line) {
      g.fillText(line, x, y);
      y += lineH;
      line = word;
    } else line = next;
  }
  g.fillText(line, x, y);
}

export function mountEyepiece(el: HTMLElement, ctx: GameContext): ScopeHandle {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;background:#000';
  const scene = document.createElement('canvas');

  const controls = document.createElement('div');
  controls.style.cssText = 'position:absolute;left:50%;bottom:90px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;color:#fff;font:14px system-ui';
  const zoomBox = document.createElement('div');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '-1';
  slider.max = '1';
  slider.step = '0.005';
  slider.value = '0';
  slider.style.width = '220px';
  const focusLabel = document.createElement('label');
  focusLabel.append('Focus ', slider);
  controls.append(zoomBox, focusLabel);
  el.append(canvas, controls);

  let sampleId: string | null = null;

  /** Scope as the eye sees it: defocus adds to the lens blur, so visibility() and the picture agree. */
  const effectiveScope = (scope: ScopeParams): { scope: ScopeParams; defocusUm: number } => {
    if (scope.tier < 2 || !sampleId) return { scope, defocusUm: 0 };
    const off = Math.abs(+slider.value - bestFocus(sampleId, scope.step));
    const defocusUm = off * FOCUS_BLUR_UM_PER_NA * scope.NA;
    return { scope: { ...scope, dLensUm: Math.hypot(scope.dLensUm, defocusUm) }, defocusUm };
  };

  const syncControls = () => {
    const { scope } = ctx.state;
    focusLabel.style.display = scope.tier >= 2 ? '' : 'none';
    zoomBox.replaceChildren();
    zoomBox.style.cssText = 'display:flex;gap:4px;white-space:nowrap';
    if (scope.steps.length > 1) {
      scope.steps.forEach((s, i) => {
        const b = document.createElement('button');
        b.textContent = s.label;
        b.disabled = i === scope.step;
        b.style.cssText = i === scope.step ? 'background:#3d7fd6;color:#fff;font-weight:600' : '';
        b.onclick = () => setZoom(ctx, i); // zoomChanged triggers the redraw
        zoomBox.append(b);
      });
    }
  };

  const render = () => {
    const sample = sampleId ? ctx.data.samples[sampleId] : undefined;
    const g = canvas.getContext('2d');
    const sg = scene.getContext('2d');
    if (!sample || !g || !sg) return;
    const w = (canvas.width = scene.width = el.clientWidth);
    const h = (canvas.height = scene.height = el.clientHeight);
    const { scope: baseScope } = ctx.state;
    const { scope, defocusUm } = effectiveScope(baseScope);
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
    g.fillText(`${sample.name} · ${scope.magnification}× · NA ${scope.NA} · ${resolutionLabel(scope)}`, 20, 28);
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

    // Wall banner: the nearest thing this view can't show, in plain words. Out-of-focus comes first.
    const focusBlurry = defocusUm > FOCUS_TIP_THRESHOLD * scopeResolutionUm(baseScope);
    const wall = nearestWall(sample, scope);
    const banner = focusBlurry
      ? 'Out of focus: turn the focus knob (slider or mouse wheel) until the image is sharpest.'
      : wall && explainWall(wall.f, scope, wall.v);
    if (banner) {
      g.fillStyle = '#000b';
      g.fillRect(w / 2 - 330, h - 82, 660, 62);
      g.fillStyle = '#ffd9b0';
      wrap(g, banner, w / 2 - 316, h - 62, 632, 19);
    }
  };

  const open = (id: string) => {
    sampleId = id;
    el.style.display = 'block';
    slider.value = '0';
    syncControls();
    render();
  };

  const onKey = (e: KeyboardEvent) => {
    if (el.style.display === 'block' && (e.key === 'Escape' || e.key.toLowerCase() === 'f')) {
      ctx.bus.emit('closeEyepiece', {});
    }
  };
  const onWheel = (e: WheelEvent) => {
    slider.value = String(Math.min(1, Math.max(-1, +slider.value + e.deltaY * 0.0005)));
    render();
  };
  slider.addEventListener('input', render);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  addEventListener('keydown', onKey);
  const offs = [
    ctx.bus.on('openEyepiece', ({ sampleId: id }) => open(id)),
    ctx.bus.on('closeEyepiece', () => (el.style.display = 'none')),
    ctx.bus.on('zoomChanged', () => {
      if (el.style.display === 'block') {
        syncControls();
        render();
      }
    }),
  ];

  return {
    dispose() {
      removeEventListener('keydown', onKey);
      offs.forEach((off) => off());
      el.replaceChildren();
    },
  };
}
