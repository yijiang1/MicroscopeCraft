// The 2D eyepiece. Physics comes from shared/sim: the whole specimen is blurred by the scope's
// effective resolution d_eff, so unresolved detail really disappears instead of being faked per layer.
// Compound microscopes add a zoom step picker and a focus slider (mouse wheel works too).
import { DRAWERS, type View } from './draw';
import { dose, scopeResolutionUm, survivingSignal, visibility } from '../shared/sim/optics';
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
const SNAPSHOT_PX = 160;
/** A Microdex picture must show the feature between these on-screen sizes (px), so it is neither a speck nor a wall. */
const SNAPSHOT_FEATURE_PX = { min: 8, max: 300 };
/** A feature much bigger than the field is just background: drawing it would hide everything smaller
 *  (a 25 µm alga at 150,000× would fill the screen over the viruses), so layers past this many screens are skipped. */
const MAX_FEATURE_SCREENS = 3;

/** Focus: slider position runs -1..1. Defocus blur (µm) = |offset from best focus| × range × NA.
 *  Simplification: geometric blur, linear in NA, so high-NA objectives are fussier like real ones. */
const FOCUS_BLUR_UM_PER_NA = 8;
/** Focus range in µm of defocus: a light scope's stage moves by microns, an electron lens by about 0.2 µm. */
const focusRangeUm = (tier: number) => (tier >= 5 ? 0.2 : FOCUS_BLUR_UM_PER_NA);
/** Electron beam current, electrons per second (about 16 pA). Game value: dose rate = I / imaged area, so zooming in burns faster. */
const BEAM_ELECTRONS_PER_S = 1e8;
const DOSE_TICK_MS = 250;
const DAMAGE_WARN = 0.5; // warn when this fraction of a fragile sample's signal is gone
const FOCUS_TIP_THRESHOLD = 0.5; // show the focus tip when defocus blur exceeds this fraction of d_eff

/** Specimen area in the field of view, nm². */
const fieldAreaNm2 = (w: number, h: number, magnification: number) => (w * h) / (magnification * PX_PER_APPARENT_UM) ** 2 * 1e6;

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
  /** Electrons per nm² delivered to the sample since the eyepiece opened (tier 5 only). Resets on open. */
  let doseENm2 = 0;
  let doseTimer = 0;

  /** Scope as the eye sees it: defocus adds to the lens blur, so visibility() and the picture agree. */
  const effectiveScope = (scope: ScopeParams): { scope: ScopeParams; defocusUm: number } => {
    if (scope.tier < 2 || !sampleId) return { scope, defocusUm: 0 };
    const off = Math.abs(+slider.value - bestFocus(sampleId, scope.step));
    const defocusUm = off * focusRangeUm(scope.tier) * scope.NA;
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

  /** Centre crop of the field as a small JPEG, kept for the Microdex card (the HUD sits at the edges). */
  const snapshot = () => {
    const side = Math.min(canvas.width, canvas.height) * 0.55;
    const t = document.createElement('canvas');
    t.width = t.height = SNAPSHOT_PX;
    t.getContext('2d')?.drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, SNAPSHOT_PX, SNAPSHOT_PX);
    return t.toDataURL('image/jpeg', 0.8);
  };

  const render = () => {
    const sample = sampleId ? ctx.data.samples[sampleId] : undefined;
    const g = canvas.getContext('2d');
    const sg = scene.getContext('2d');
    if (!sample || !g || !sg || !el.clientWidth || !el.clientHeight) return; // hidden or zero-sized pane
    const w = (canvas.width = scene.width = el.clientWidth);
    const h = (canvas.height = scene.height = el.clientHeight);
    const { scope: baseScope } = ctx.state;
    const { scope, defocusUm } = effectiveScope(baseScope);
    const pxPerUm = scope.magnification * PX_PER_APPARENT_UM;
    const areaNm2 = fieldAreaNm2(w, h, scope.magnification);
    // The field is centred on the specimen origin, a node of every drawer's grid.
    const view: View = { x0: -w / 2 / pxPerUm, x1: w / 2 / pxPerUm, y0: -h / 2 / pxPerUm, y1: h / 2 / pxPerUm, pxPerUm };

    // Specimen layer: smaller features first so the bigger structure sits on top; onTop textures go last. Alpha = contrast.
    sg.fillStyle = BACKGROUND;
    sg.fillRect(0, 0, w, h);
    sg.save();
    sg.translate(w / 2, h / 2);
    sg.scale(pxPerUm, pxPerUm);
    // Beam damage fades fragile features: contrast × surviving signal.
    const features = sample.features.map((f) => ({
      ...f,
      contrast: f.contrast * (f.criticalDoseENm2 ? survivingSignal(doseENm2, f.criticalDoseENm2) : 1),
    }));
    for (const f of [...features].sort((a, b) => +a.onTop - +b.onTop || a.sizeUm - b.sizeUm)) {
      if (f.sizeUm * pxPerUm > MAX_FEATURE_SCREENS * Math.max(w, h)) continue;
      sg.globalAlpha = Math.min(1, f.contrast * scope.contrastBoost * 2);
      sg.save(); // drawers may move the origin
      DRAWERS[f.drawing](sg, f, view);
      sg.restore();
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
    g.filter = `${scope.tier >= 5 ? 'grayscale(1) ' : ''}blur(${sigmaPx.toFixed(2)}px)`; // electron images are grey
    g.drawImage(scene, 0, 0);
    g.restore();

    // HUD: what each feature does under this scope, plus a scale bar.
    g.font = '15px system-ui';
    g.fillStyle = '#fff';
    g.fillText(`${sample.name} · ${scope.magnification.toLocaleString("en-US")}× · NA ${scope.NA} · ${resolutionLabel(scope)}`, 20, 28);
    features.forEach((f, i) => {
      const v = visibility(f, scope);
      g.fillStyle = v.visible ? '#9be59b' : '#ffb27a';
      g.fillText(`${v.visible ? '✓' : '✗'} ${f.name} (${fmtUm(f.sizeUm)}): ${v.visible ? 'visible' : v.reason}`, 20, 54 + i * 22);
      if (v.visible) {
        const px = f.sizeUm * pxPerUm;
        const good = px >= SNAPSHOT_FEATURE_PX.min && px <= SNAPSHOT_FEATURE_PX.max;
        const quality = f.sizeUm / dEffUm;
        const better = quality > (ctx.state.snapshots[f.id]?.quality ?? 0);
        discover(ctx, f.id, good && better ? { image: snapshot(), quality } : undefined);
      }
    });
    if (scope.tier >= 5) {
      const perAng2 = 100; // 1 nm² = 100 Å²
      g.fillStyle = '#ffe08a';
      g.fillText(
        `Beam ${(dose(BEAM_ELECTRONS_PER_S, 1, areaNm2) / perAng2).toPrecision(2)} e⁻/Å²/s · total dose ${(doseENm2 / perAng2).toPrecision(2)} e⁻/Å²`,
        20,
        54 + features.length * 22,
      );
    }
    const bar = niceBarUm(pxPerUm);
    g.fillStyle = '#fff';
    g.fillRect(20, h - 40, bar * pxPerUm, 4);
    g.fillText(fmtUm(bar), 20, h - 48);
    g.fillStyle = '#aaa';
    g.fillText('Esc or F to close', w - 150, h - 20);

    // Wall banner: the nearest thing this view can't show, in plain words. Out-of-focus comes first.
    const focusBlurry = defocusUm > FOCUS_TIP_THRESHOLD * scopeResolutionUm(baseScope);
    const wall = nearestWall({ features }, scope);
    const damaged = features.find((f, i) => f.criticalDoseENm2 && f.contrast < sample.features[i]!.contrast * DAMAGE_WARN);
    const banner = damaged
      ? `Beam damage! The electrons are destroying ${damaged.name}. Zoom out to lower the dose rate, or close the eyepiece to reset the sample.`
      : focusBlurry
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
    openedAt = performance.now();
    doseENm2 = 0;
    el.style.display = 'block';
    slider.value = '0';
    clearInterval(doseTimer);
    if (ctx.state.scope.tier >= 5) {
      doseTimer = window.setInterval(() => {
        const area = fieldAreaNm2(canvas.width, canvas.height, ctx.state.scope.magnification);
        doseENm2 += dose(BEAM_ELECTRONS_PER_S, DOSE_TICK_MS / 1000, area);
        render();
      }, DOSE_TICK_MS);
    }
    syncControls();
    render();
  };

  // The F that opens the eyepiece (handled by the world) reaches this listener too; it must not also close it.
  let openedAt = 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || performance.now() - openedAt < 200) return;
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
    ctx.bus.on('closeEyepiece', () => {
      el.style.display = 'none';
      clearInterval(doseTimer);
    }),
    ctx.bus.on('zoomChanged', () => {
      if (el.style.display === 'block') {
        syncControls();
        render();
      }
    }),
  ];

  return {
    dispose() {
      clearInterval(doseTimer);
      removeEventListener('keydown', onKey);
      offs.forEach((off) => off());
      el.replaceChildren();
    },
  };
}
