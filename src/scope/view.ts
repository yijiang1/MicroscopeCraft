// The 2D eyepiece. Physics comes from shared/sim: the whole specimen is blurred by the scope's effective resolution
// d_eff, so unresolved detail really disappears instead of being faked per layer. Each step has an imaging mode
// (bright field, phase contrast, fluorescence, TEM, diffraction, annular dark field, ptychography, X-ray maps and
// tomography) that decides what shows and how it looks. Stains go on light-microscope samples. Alignment panels and
// mini-games (Köhler, TEM alignment, the corrector, ptychography, beam tuning, tomography) change what the eye gets.
import { DRAWERS, PATTERNS, type View } from './draw';
import type { Gram } from '../shared/sim/bench';
import { dose, featureContrast, isDiffraction, scopeResolutionUm, survivingSignal, visibility } from '../shared/sim/optics';
import { explainWall, fmtUm, nearestWall, resolutionLabel } from '../shared/sim/walls';
import { bump, discover, ownedScopes, selectScope, setZoom, type GameContext } from '../shared/state';
import type { Feature, Mode, ScopeParams, Stain } from '../shared/schema';
import { koehlerTuning, openGram, openSoak } from './bench';
import { beamTuning } from './beam';
import { correctorTuning } from './corrector';
import { button, type Tuning } from './kit';
import { ptychoTuning } from './ptycho';
import { temTuning } from './tem';
import { tomoTuning } from './tomo';
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

/** Focus (light microscopes): slider position runs -1..1. Defocus blur (µm) = |offset from best focus| × range × NA.
 *  Simplification: geometric blur, linear in NA, so high-NA objectives are fussier like real ones. */
const FOCUS_BLUR_UM_PER_NA = 8;
/** Electron beam current, electrons per second (about 16 pA). Game value: dose rate = I / imaged area, so zooming in burns faster. */
const BEAM_ELECTRONS_PER_S = 1e8;
const DOSE_TICK_MS = 250;
const DAMAGE_WARN = 0.5; // warn when this fraction of a fragile sample's signal is gone
const FOCUS_TIP_THRESHOLD = 0.5; // show the focus tip when defocus blur exceeds this fraction of d_eff

const MODE_NAMES: Record<Mode, string> = {
  brightfield: 'bright field', phase: 'phase contrast', darkfield: 'dark field', fluorescence: 'fluorescence', tem: 'TEM',
  ediff: 'electron diffraction', haadf: 'annular dark field', ptycho: 'ptychography', xct: 'X-ray tomography',
  xrf: 'X-ray fluorescence map', xrd: 'X-ray diffraction',
};
const BACKGROUNDS: Partial<Record<Mode, string>> = {
  phase: '#5a615b', darkfield: '#000000', fluorescence: '#000000', tem: '#1c2024', ediff: '#000000', xrd: '#000000',
  haadf: '#050505', ptycho: '#1a1e24', xrf: '#000000', xct: '#202020',
};
const GREY: readonly Mode[] = ['tem', 'ediff', 'haadf', 'ptycho', 'xct', 'xrd'];
const ELECTRON_IMAGING: readonly Mode[] = ['tem', 'haadf', 'ptycho'];
const TRANSMITTED: readonly Mode[] = ['brightfield', 'phase', 'darkfield'];
const STAINS: { id: Stain; item: string; name: string }[] = [
  { id: 'iodine', item: 'iodine_stain', name: 'Iodine' },
  { id: 'methylene_blue', item: 'methylene_blue', name: 'Methylene blue' },
  { id: 'gram', item: 'gram_kit', name: 'Gram stain' },
  { id: 'hematoxylin', item: 'hematoxylin', name: 'Hematoxylin' },
];
/** Stain colours, lightened to read on the eyepiece's dark field: iodine turns starch blue-black, methylene blue stains
 *  DNA blue, hematoxylin (with its alum mordant) turns nuclei blue-purple. */
const STAIN_COLORS: Record<Exclude<Stain, 'gram'>, string> = { iodine: '#7a6ad0', methylene_blue: '#5a8ae0', hematoxylin: '#8a6ad8' };
/** Progressive stains go on with the soak-and-rinse mini-game; how well it went scales the stain's contrast.
 *  Iodine binds starch almost at once, so it goes straight on. */
const SOAKED: readonly Stain[] = ['methylene_blue', 'hematoxylin'];
/** Slide colour of each soaked dye in the mini-game (the real dye, not lightened). */
const DYE_COLORS: Partial<Record<Stain, string>> = { methylene_blue: '#2f5fb0', hematoxylin: '#4b3a8c' };
/** The visibility reasons in plain words, for the feature list. */
const REASONS: Record<string, string> = {
  unresolved: 'too fine to resolve', 'empty-magnification': 'empty magnification', 'too-small-to-see': 'too small to see',
  'low-contrast': 'too faint', 'other-mode': 'shows up another way',
};

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

/** Scale every contrast of a feature (bright field and per mode). */
const scaled = (f: Feature, k: number): Feature => ({
  ...f,
  contrast: f.contrast * k,
  contrastIn: Object.fromEntries(Object.entries(f.contrastIn).map(([key, c]) => [key, c * k])),
});

export function mountEyepiece(el: HTMLElement, ctx: GameContext): ScopeHandle {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;background:#000';
  const scene = document.createElement('canvas');

  const controls = document.createElement('div');
  controls.style.cssText = 'position:absolute;left:50%;bottom:90px;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;align-items:center;max-width:calc(100% - 16px);color:#fff;font:14px system-ui;z-index:3';
  const scopeBox = document.createElement('div');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:8px;align-items:center';
  const zoomBox = document.createElement('div');
  const stainBox = document.createElement('div');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '-1';
  slider.max = '1';
  slider.step = '0.005';
  slider.value = '0';
  slider.style.width = '220px';
  const focusLabel = document.createElement('label');
  focusLabel.append('Focus ', slider);
  row.append(zoomBox, focusLabel);
  controls.append(scopeBox, row, stainBox);
  el.append(canvas, controls);
  const closeButton = button('Close eyepiece (Esc / F)', () => ctx.bus.emit('closeEyepiece', {}),
    'position:absolute;right:10px;bottom:10px;z-index:4');
  el.append(closeButton);

  let sampleId: string | null = null;
  /** Electrons per nm² delivered to the sample since the eyepiece opened (electron imaging only). Resets on open. */
  let doseENm2 = 0;
  let doseTimer = 0;
  let stain: Stain | null = null;
  let gramResult: Gram | null = null;
  /** How well the progressive stain on the slide went, 0..1 (SOAKED stains only). */
  let soak = 1;
  let closeStain: (() => void) | null = null;
  let tuning: Tuning | null = null;
  let tuningKey = '';
  /** A panel draws while it is being built; the eyepiece must not render (and discover things) before it is in place. */
  let building = false;
  let raf = 0;
  const open = () => el.style.display === 'block';

  /** The alignment panel or mini-game that belongs to this instrument, mode and sample. */
  const syncTuning = () => {
    const { scope } = ctx.state;
    const key = open() && sampleId ? `${scope.tier}:${scope.mode}:${sampleId}` : '';
    if (key === tuningKey) return;
    closeStain?.();
    closeStain = null;
    tuning?.dispose();
    tuning = null;
    tuningKey = key;
    if (!key || !sampleId) return;
    const sample = ctx.data.samples[sampleId]!;
    building = true;
    if (scope.condenser && TRANSMITTED.includes(scope.mode)) tuning = koehlerTuning(el, ctx, scope.tier, render);
    else if (scope.tier === 5 && scope.mode === 'tem') tuning = temTuning(el, ctx, sampleId, render);
    else if (scope.tier === 6 && scope.mode === 'haadf') tuning = correctorTuning(el, ctx, render);
    else if (scope.mode === 'ptycho') tuning = ptychoTuning(el, ctx, sampleId, render);
    else if (scope.mode === 'xrf') tuning = beamTuning(el, ctx, sample, render);
    else if (scope.mode === 'xct') tuning = tomoTuning(el, ctx, sampleId, render);
    building = false;
  };

  /** Scope as the eye sees it: defocus and the alignment panels change it, so visibility() and the picture agree. */
  const effectiveScope = (scope: ScopeParams): { scope: ScopeParams; defocusUm: number } => {
    let s = scope;
    let defocusUm = 0;
    if (scope.tier >= 2 && scope.tier <= 4 && sampleId) {
      defocusUm = Math.abs(+slider.value - bestFocus(sampleId, scope.step)) * FOCUS_BLUR_UM_PER_NA * scope.NA;
      s = { ...s, dLensUm: Math.hypot(s.dLensUm, defocusUm) };
    }
    if (tuning?.scope) s = tuning.scope(s);
    return { scope: s, defocusUm };
  };

  /** A feature as this view shows it: for seeing (contrast after beam damage, the stain and the tuning) and for
   *  drawing (colour and strength; a botched Gram stain still shows cells, in the wrong colour). */
  const present = (f: Feature): { f: Feature; draw: Feature } => {
    let k = f.criticalDoseENm2 ? survivingSignal(doseENm2, f.criticalDoseENm2) : 1;
    k *= tuning?.contrast?.(f) ?? 1;
    const seen = scaled(f, k);
    if (stain === 'gram' && gramResult && f.gram && f.contrastIn.gram !== undefined) {
      const ok = f.gram === 'positive' ? gramResult.positive : gramResult.negative;
      const right = ok >= 0.5;
      const looksPositive = f.gram === 'positive' ? right : !right && gramResult.negative < 0.5;
      const color = looksPositive ? '#a066e0' : '#ff6aa0'; // purple and pink
      return { f: { ...seen, contrastIn: { ...seen.contrastIn, gram: right ? seen.contrastIn.gram! * ok : 0 } }, draw: { ...seen, tint: color } };
    }
    if (stain === 'gram' && !gramResult) return { f: { ...seen, contrastIn: { ...seen.contrastIn, gram: 0 } }, draw: seen };
    if (stain && stain !== 'gram' && seen.contrastIn[stain] !== undefined) {
      const f2 = SOAKED.includes(stain) ? { ...seen, contrastIn: { ...seen.contrastIn, [stain]: seen.contrastIn[stain]! * soak } } : seen;
      return { f: f2, draw: { ...f2, tint: STAIN_COLORS[stain] } };
    }
    return { f: seen, draw: seen };
  };

  const syncControls = () => {
    const { scope } = ctx.state;
    focusLabel.style.display = scope.tier >= 2 && scope.tier <= 4 ? '' : 'none';
    // Instrument picker: every microscope usable here, keys 1-9. Only shown when there is a choice.
    const owned = ownedScopes(ctx.state.inventory, ctx.data, ctx.state.site);
    scopeBox.replaceChildren();
    scopeBox.style.cssText = `display:${owned.length > 1 ? 'flex' : 'none'};flex-wrap:wrap;justify-content:center;gap:4px;align-items:center`;
    scopeBox.append('Instrument:');
    owned.forEach((r, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1} ${r.name}`;
      b.disabled = r.scope.tier === scope.tier;
      b.style.cssText = b.disabled ? 'background:#3d7fd6;color:#fff;font-weight:600' : '';
      b.onclick = () => selectScope(ctx, r.scope.tier); // scopeChanged triggers the redraw
      scopeBox.append(b);
    });
    zoomBox.replaceChildren();
    zoomBox.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;justify-content:center';
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
    // Stains: light microscopes in transmitted light, for the stains you have picked up
    stainBox.replaceChildren();
    const canStain = scope.tier >= 2 && scope.tier <= 4 && TRANSMITTED.includes(scope.mode);
    const have = STAINS.filter((s) => (ctx.state.inventory[s.item] ?? 0) > 0);
    stainBox.style.cssText = `display:${canStain && have.length ? 'flex' : 'none'};flex-wrap:wrap;gap:4px;justify-content:center;align-items:center`;
    if (!canStain || !have.length) return;
    stainBox.append('Stain:');
    for (const s of have) {
      stainBox.append(
        button(s.name, () => {
          if (s.id === 'gram') {
            closeStain?.();
            closeStain = openGram(el, ctx, (result) => {
              closeStain = null;
              if (result) {
                stain = 'gram';
                gramResult = result;
                bump(ctx, 'stained');
              }
              syncControls();
              render();
            });
            return;
          }
          if (SOAKED.includes(s.id)) {
            closeStain?.();
            closeStain = openSoak(el, ctx, { name: s.name, color: DYE_COLORS[s.id]! }, (q) => {
              closeStain = null;
              if (q !== null) {
                stain = s.id;
                gramResult = null;
                soak = q;
                bump(ctx, 'stained');
              }
              syncControls();
              render();
            });
            return;
          }
          stain = s.id;
          gramResult = null;
          bump(ctx, 'stained');
          syncControls();
          render();
        }, stain === s.id ? 'background:#3d7fd6;color:#fff;font-weight:600' : ''),
      );
    }
    if (stain) stainBox.append(button('Wash off', () => ((stain = null), (gramResult = null), syncControls(), render())));
  };

  /** Centre crop of the field as a small JPEG, kept for the Microdex card (the HUD sits at the edges). */
  const snapshot = () => {
    const side = Math.min(canvas.width, canvas.height) * 0.55;
    const t = document.createElement('canvas');
    t.width = t.height = SNAPSHOT_PX;
    t.getContext('2d')?.drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, SNAPSHOT_PX, SNAPSHOT_PX);
    return t.toDataURL('image/jpeg', 0.8);
  };
  /** Count something for an achievement the first time it happens. */
  const once = (key: string) => {
    if (!ctx.state.stats[key]) bump(ctx, key);
  };

  function render() {
    if (building) return;
    const sample = sampleId ? ctx.data.samples[sampleId] : undefined;
    const g = canvas.getContext('2d');
    const sg = scene.getContext('2d');
    if (!sample || !g || !sg || !el.clientWidth || !el.clientHeight) return; // hidden or zero-sized pane
    const w = (canvas.width = scene.width = el.clientWidth);
    const h = (canvas.height = scene.height = el.clientHeight);
    const { scope: baseScope } = ctx.state;
    const { scope, defocusUm } = effectiveScope(baseScope);
    const mode = scope.mode;
    const diffraction = isDiffraction(mode);
    const pxPerUm = scope.magnification * PX_PER_APPARENT_UM;
    const areaNm2 = fieldAreaNm2(w, h, scope.magnification);
    const shown = sample.features.map(present);

    sg.fillStyle = BACKGROUNDS[mode] ?? (scope.tier >= 5 ? '#1c2024' : BACKGROUND);
    sg.fillRect(0, 0, w, h);
    if (diffraction) {
      // A diffraction pattern about the centre: a spacing d lands at radius ∝ 1/d, the smallest spacing at the edge.
      const radius = Math.min(w, h) * 0.44;
      const dMin = scopeResolutionUm(scope);
      for (const { draw } of shown) {
        const c = featureContrast(draw, mode, stain) * scope.contrastBoost;
        if (c <= 0) continue;
        sg.save();
        sg.translate(w / 2, h / 2);
        sg.globalAlpha = Math.min(1, c * 2);
        if (PATTERNS.has(draw.drawing)) DRAWERS[draw.drawing](sg, draw, { x0: -w / 2, x1: w / 2, y0: -h / 2, y1: h / 2, pxPerUm: radius * dMin });
        else {
          const k = 60 / draw.sizeUm; // maps made from diffraction (a grain map) are drawn at a readable scale
          sg.scale(k, k);
          DRAWERS[draw.drawing](sg, draw, { x0: -w / 2 / k, x1: w / 2 / k, y0: -h / 2 / k, y1: h / 2 / k, pxPerUm: k });
        }
        sg.restore();
      }
      sg.fillStyle = '#3a3a3a'; // the beam stop over the bright direct beam
      sg.fillRect(w / 2, h / 2 - 4, w / 2, 8);
      sg.beginPath();
      sg.arc(w / 2, h / 2, 10, 0, Math.PI * 2);
      sg.fill();
    } else {
      // Specimen layer: smaller features first so the bigger structure sits on top; onTop textures go last. Alpha = contrast.
      const [sx, sy] = tuning?.shift?.(performance.now()) ?? [0, 0];
      // The field is centred on the specimen origin, a node of every drawer's grid.
      const view: View = { x0: (-w / 2 - sx) / pxPerUm, x1: (w / 2 - sx) / pxPerUm, y0: (-h / 2 - sy) / pxPerUm, y1: (h / 2 - sy) / pxPerUm, pxPerUm };
      sg.save();
      sg.translate(w / 2 + sx, h / 2 + sy);
      sg.scale(pxPerUm, pxPerUm);
      for (const { draw } of [...shown].sort((a, b) => +a.draw.onTop - +b.draw.onTop || a.draw.sizeUm - b.draw.sizeUm)) {
        if (draw.sizeUm * pxPerUm > MAX_FEATURE_SCREENS * Math.max(w, h)) continue;
        const c = featureContrast(draw, mode, stain);
        if (c <= 0) continue;
        sg.globalAlpha = Math.min(1, c * scope.contrastBoost * 2);
        sg.save(); // drawers may move the origin
        DRAWERS[draw.drawing](sg, draw, view);
        sg.restore();
      }
      sg.restore();
    }

    // Eyepiece: blur by d_eff (ctx.filter needs a current Chrome/Firefox/Safari), clipped to a round field.
    const dEffUm = scopeResolutionUm(scope);
    const sigmaPx = diffraction ? 0.4 : dEffUm * pxPerUm * FWHM_TO_SIGMA;
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.save();
    g.beginPath();
    g.arc(w / 2, h / 2, Math.min(w, h) * 0.46, 0, Math.PI * 2);
    g.clip();
    g.filter = `${GREY.includes(mode) ? 'grayscale(1) ' : ''}blur(${sigmaPx.toFixed(2)}px)`;
    g.drawImage(scene, 0, 0);
    g.restore();

    // HUD: what each feature does under this scope, plus a scale bar.
    g.font = '15px system-ui';
    g.fillStyle = '#fff';
    const where = diffraction ? MODE_NAMES[mode] : `${MODE_NAMES[mode]} · ${scope.magnification.toLocaleString('en-US')}× · NA ${+scope.NA.toFixed(3)}`;
    g.fillText(`${sample.name} · ${where} · ${resolutionLabel(scope)}${stain ? ` · ${STAINS.find((s) => s.id === stain)!.name}` : ''}`, 20, 28);
    let lineY = 54;
    let emptyMag = false;
    shown.forEach(({ f }) => {
      const v = visibility(f, scope, stain);
      g.fillStyle = v.visible ? '#9be59b' : '#ffb27a';
      const what = v.visible ? (v.detectedOnly ? 'detected (smaller than the resolution)' : 'visible') : REASONS[v.reason] ?? v.reason;
      g.fillText(`${v.visible ? '✓' : '✗'} ${f.name} (${fmtUm(f.sizeUm)}): ${what}`, 20, lineY);
      lineY += 22;
      if (v.reason === 'empty-magnification') emptyMag = true;
      if (v.visible) {
        if (v.detectedOnly) once('detected');
        const px = f.sizeUm * pxPerUm;
        const good = diffraction || (px >= SNAPSHOT_FEATURE_PX.min && px <= SNAPSHOT_FEATURE_PX.max);
        const quality = f.sizeUm / dEffUm;
        const better = quality > (ctx.state.snapshots[f.id]?.quality ?? 0);
        discover(ctx, f.id, good && better ? { image: snapshot(), quality } : undefined);
      }
    });
    if (emptyMag) once('empty_mag');
    if (scope.tier >= 5 && ELECTRON_IMAGING.includes(mode)) {
      const perAng2 = 100; // 1 nm² = 100 Å²
      g.fillStyle = '#ffe08a';
      g.fillText(`Beam ${(dose(BEAM_ELECTRONS_PER_S, 1, areaNm2) / perAng2).toPrecision(2)} e⁻/Å²/s · total dose ${(doseENm2 / perAng2).toPrecision(2)} e⁻/Å²`, 20, lineY);
    }
    if (!diffraction) {
      const bar = niceBarUm(pxPerUm);
      g.fillStyle = '#fff';
      g.fillRect(20, h - 40, bar * pxPerUm, 4);
      g.fillText(fmtUm(bar), 20, h - 48);
    }
    // Banner: the nearest thing this view can't show, in plain words. Damage, then focus, then the instrument's own panel.
    const focusBlurry = defocusUm > FOCUS_TIP_THRESHOLD * scopeResolutionUm(baseScope);
    const wall = nearestWall({ features: shown.map((s) => s.f) }, scope, stain);
    const damaged = shown.find(({ f }, i) => f.criticalDoseENm2 && f.contrast < sample.features[i]!.contrast * DAMAGE_WARN);
    if (shown.some(({ f }, i) => f.criticalDoseENm2 && f.contrast < sample.features[i]!.contrast * 0.1)) once('burned');
    const banner = damaged
      ? `Beam damage! The electrons are destroying ${damaged.f.name}. Zoom out to lower the dose rate, or close the eyepiece to reset the sample.`
      : focusBlurry && scope.tier <= 4
      ? 'Out of focus: turn the focus knob (slider or mouse wheel) until the image is sharpest.'
      : (wall && tuning?.banner?.()) || (wall && explainWall(wall.f, scope, wall.v, stain));
    ctx.bus.emit('eyepieceStatus', {
      sampleId: sample.id,
      text: banner || 'You can see everything on this sample. Find something smaller, or look at another sample.',
    });
    if (banner) {
      g.font = '15px system-ui';
      g.fillStyle = '#000b';
      g.fillRect(w / 2 - 330, h - 82, 660, 62);
      g.fillStyle = '#ffd9b0';
      wrap(g, banner, w / 2 - 316, h - 62, 632, 19);
    }
  }

  /** The beam only runs (and burns the sample) while an electron microscope is imaging. */
  const syncBeam = () => {
    clearInterval(doseTimer);
    if (ctx.state.scope.tier < 5 || !ELECTRON_IMAGING.includes(ctx.state.scope.mode)) return;
    doseTimer = window.setInterval(() => {
      const area = fieldAreaNm2(canvas.width, canvas.height, ctx.state.scope.magnification);
      doseENm2 += dose(BEAM_ELECTRONS_PER_S, DOSE_TICK_MS / 1000, area);
      render();
    }, DOSE_TICK_MS);
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (open() && tuning?.animating?.()) render();
  };

  const openSample = (id: string) => {
    closeStain?.();
    closeStain = null;
    sampleId = id;
    openedAt = performance.now();
    doseENm2 = 0;
    stain = null;
    gramResult = null;
    el.style.display = 'block';
    slider.value = '0';
    syncBeam();
    syncControls();
    syncTuning();
    render();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  };

  const redraw = () => {
    if (!open()) return;
    syncBeam();
    syncControls();
    syncTuning();
    render();
  };

  // The F that opens the eyepiece (handled by the world) reaches this listener too; it must not also close it.
  let openedAt = 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || performance.now() - openedAt < 200) return;
    if (!open() || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    const typing = target.isContentEditable || target.tagName === 'TEXTAREA' ||
      (target instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button'].includes(target.type));
    if (e.key === 'Escape' || (!typing && e.key.toLowerCase() === 'f')) {
      e.preventDefault();
      ctx.bus.emit('closeEyepiece', {});
      return;
    }
    if (typing) return;
    const pick = ownedScopes(ctx.state.inventory, ctx.data, ctx.state.site)[+e.key - 1];
    if (pick) selectScope(ctx, pick.scope.tier);
  };
  const onWheel = (e: WheelEvent) => {
    slider.value = String(Math.min(1, Math.max(-1, +slider.value + e.deltaY * 0.0005)));
    render();
  };
  slider.addEventListener('input', render);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  addEventListener('keydown', onKey);
  const offs = [
    ctx.bus.on('openEyepiece', ({ sampleId: id }) => openSample(id)),
    ctx.bus.on('closeEyepiece', () => {
      el.style.display = 'none';
      clearInterval(doseTimer);
      cancelAnimationFrame(raf);
      syncTuning();
    }),
    ctx.bus.on('zoomChanged', redraw),
    ctx.bus.on('scopeChanged', redraw),
    ctx.bus.on('itemCrafted', redraw),
  ];

  return {
    dispose() {
      clearInterval(doseTimer);
      cancelAnimationFrame(raf);
      closeStain?.();
      closeStain = null;
      tuning?.dispose();
      removeEventListener('keydown', onKey);
      offs.forEach((off) => off());
      el.replaceChildren();
    },
  };
}
