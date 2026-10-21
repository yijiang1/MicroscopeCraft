// The staining lab. Some cells are almost clear, so the eyepiece says "low contrast". With a dye in the inventory,
// S opens the lab over the eyepiece: add a drop (Space), watch the cells and the background soak it up, and rinse
// (Space) when the cells stand out most. Rinse too early and they stay pale; too late and the background darkens
// too. The result, 0..1 of the best possible contrast, is kept on the sample (stainSample) and the eyepiece redraws.
// Physics: shared/sim/stain.ts.
import { visibility } from '../shared/sim/optics';
import { bestStainTime, stainContrast, stainedFeature, stainQuality, TAU_BACKGROUND_S, TAU_TARGET_S, uptake } from '../shared/sim/staining';
import { stainSample, type GameContext } from '../shared/state';
import type { StainHandle } from './index';

/** Each attempt varies both soak speeds by up to ±25%, so the peak can't be timed by memory: watch the slide. */
const JITTER = 0.25;
/** Left this long, the slide is rinsed anyway (it is dark all over by then). */
const MAX_SOAK_S = 20;
/** Contrast at the right end of the meter. A perfect stain reaches about 0.45 to 0.6, depending on the attempt. */
const METER_MAX = 0.7;
/** Unstained cells and glass on a bright field. */
const CLEAR = '#e9efe9';
/** How dark fully stained tissue gets toward the dye color (1 = the pure dye color). */
const DYE_STRENGTH = 0.9;
const FIELD_PX = 280;
/** Grades: at least this share of the best possible contrast is a perfect / good stain. */
const PERFECT = 0.9;
const GOOD = 0.7;

type Phase = 'ready' | 'soaking' | 'done';

const pct = (q: number) => `${Math.round(q * 100)}%`;

function mix(a: string, b: string, t: number) {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t)).join(',')})`;
}

const styled = <K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text = '') => {
  const e = document.createElement(tag);
  e.style.cssText = css;
  e.textContent = text;
  return e;
};

export function mountLab(el: HTMLElement, ctx: GameContext): StainHandle {
  // --- hint chip above the eyepiece controls (the HUD and goal card own the top corners): what staining would do here
  const chip = styled('div', 'position:absolute;bottom:170px;left:50%;transform:translateX(-50%);max-width:min(560px,calc(100% - 32px));padding:6px 12px;border-radius:6px;background:#000c;color:#ffd9a0;font:14px system-ui;text-align:center;display:none');

  // --- the lab panel
  const panel = styled('div', 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 32px));max-height:calc(100% - 16px);overflow:auto;box-sizing:border-box;padding:16px;border-radius:10px;background:#141a16f2;color:#eee;font:14px system-ui;pointer-events:auto;display:none;box-shadow:0 8px 40px #000a');
  const title = styled('h3', 'margin:0 0 8px;font-size:17px');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = FIELD_PX;
  canvas.style.cssText = `display:block;margin:0 auto 10px;width:min(${FIELD_PX}px,36vh);max-width:100%;border-radius:50%`;
  const meterLabel = styled('div', 'display:flex;justify-content:space-between;font-size:12px;color:#aab', '');
  const meterName = styled('span', '', 'Contrast (cells − background)');
  const meterValue = styled('span', 'font-variant-numeric:tabular-nums', '0.00');
  meterLabel.append(meterName, meterValue);
  const meter = styled('div', 'height:10px;border-radius:5px;background:#2a332d;overflow:hidden;margin:2px 0 10px');
  const meterFill = styled('div', 'height:100%;width:0;background:#e0902a');
  meter.append(meterFill);
  const status = styled('p', 'margin:0 0 6px;min-height:40px;line-height:1.4');
  const hint = styled('p', 'margin:0 0 10px;color:#9aa;font-size:12px;line-height:1.4');
  const buttons = styled('div', 'display:flex;gap:8px;justify-content:flex-end');
  const primary = styled('button', 'font-weight:600');
  const again = styled('button', '', 'R · Try again');
  const leave = styled('button', '', 'Esc · Back');
  buttons.append(again, leave, primary);
  panel.append(title, canvas, meterLabel, meter, status, hint, buttons);
  el.append(chip, panel);

  let isOpen = false;
  let phase: Phase = 'ready';
  let tauTarget = TAU_TARGET_S;
  let tauBackground = TAU_BACKGROUND_S;
  let startedAt = 0;
  let frame = 0;

  /** The sample under the eyepiece, and a stainable feature on it that this microscope resolves. */
  const job = () => {
    const id = ctx.state.currentSampleId;
    const sample = id ? ctx.data.samples[id] : undefined;
    // Simplification: dyes are for light microscopes; electron images are grey (real labs use heavy-metal stains there).
    if (!sample || ctx.state.scope.tier >= 5) return null;
    const feature = sample.features.find((f) => f.stain && visibility(stainedFeature(f, 1), ctx.state.scope).visible);
    if (!feature?.stain) return null;
    const dye = feature.stain.dye;
    return { sample, feature, stain: feature.stain, dye, dyeName: ctx.data.items[dye]?.name ?? dye, have: ctx.state.inventory[dye] ?? 0 };
  };

  const syncChip = () => {
    const j = job();
    if (!j || isOpen) {
      chip.style.display = 'none';
      return;
    }
    const best = ctx.state.stains[j.sample.id];
    const shows = visibility(stainedFeature(j.feature, best), ctx.state.scope).visible;
    if (shows && (best ?? 0) >= GOOD) {
      chip.style.display = 'none'; // a good stain needs no reminder over the view
      return;
    }
    chip.style.display = '';
    chip.textContent = j.have
      ? shows
        ? `Stained with ${j.dyeName} (${pct(best ?? 0)}). S · stain again for more contrast (${j.have} left)`
        : `${j.feature.name} here are almost clear. S · stain this ${j.sample.name.toLowerCase()} with ${j.dyeName} (${j.have} left)`
      : shows
        ? `Stained with ${j.dyeName} (${pct(best ?? 0)}). Gather more ${j.dyeName} to stain it again`
        : `${j.feature.name} here are almost clear. To stain them, gather ${j.dyeName}: ${ctx.data.materials[j.dye]?.where ?? 'look around'}`;
  };

  /** Draw the slide at soak time t: the dye darkens the targets fast and the background slowly. */
  const drawSlide = (tSec: number) => {
    const j = job();
    const g = canvas.getContext('2d');
    if (!j || !g) return;
    const c = j.stain.color;
    const r = FIELD_PX / 2;
    g.fillStyle = mix(CLEAR, c, uptake(tSec, tauBackground) * DYE_STRENGTH);
    g.fillRect(0, 0, FIELD_PX, FIELD_PX);
    const target = mix(CLEAR, c, uptake(tSec, tauTarget) * DYE_STRENGTH);
    g.strokeStyle = '#0000001f';
    g.lineWidth = 1.5;
    if (j.feature.drawing === 'amoeba') {
      for (const [x, y, s, lobes] of [[0.3, 0.35, 0.2, 4], [0.68, 0.3, 0.16, 3], [0.55, 0.7, 0.22, 5], [0.22, 0.72, 0.12, 3]] as const) {
        g.fillStyle = target;
        g.beginPath();
        for (let k = 0; k <= 40; k++) {
          const a = (k / 40) * Math.PI * 2;
          const rr = s * r * (0.75 + 0.5 * Math.max(0, Math.sin(a * lobes + x * 9)) ** 3);
          g.lineTo(x * FIELD_PX + Math.cos(a) * rr, y * FIELD_PX + Math.sin(a) * rr);
        }
        g.fill();
        g.stroke();
      }
    } else {
      // A sheet of cells (walls barely visible) with one nucleus each: the nuclei take up the dye.
      const n = 5;
      const cell = FIELD_PX / n;
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < n; k++) {
          g.strokeRect(i * cell + 2, k * cell + 2, cell - 4, cell - 4);
          g.fillStyle = target;
          g.beginPath();
          g.arc(i * cell + cell * (0.4 + ((i * 7 + k * 3) % 5) * 0.05), k * cell + cell * (0.45 + ((i * 3 + k) % 3) * 0.05), cell * 0.17, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // the drop, while it is still sitting on the slide
    if (phase === 'soaking' && tSec < 0.6) {
      g.fillStyle = mix(c, '#000000', 0.1);
      g.globalAlpha = 1 - tSec / 0.6;
      g.beginPath();
      g.arc(r, r, r * (0.2 + tSec), 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    const contrast = stainContrast(tSec, tauTarget, tauBackground);
    meterValue.textContent = contrast.toFixed(2);
    meterFill.style.width = `${Math.min(100, (contrast / METER_MAX) * 100)}%`;
    meterFill.style.background = c;
  };

  const tick = () => {
    const t = (performance.now() - startedAt) / 1000;
    drawSlide(t);
    status.textContent = `Soaking… ${t.toFixed(1)} s`;
    if (t >= MAX_SOAK_S) rinse();
    else frame = requestAnimationFrame(tick);
  };

  const showReady = () => {
    const j = job();
    if (!j) return close();
    phase = 'ready';
    title.textContent = `Staining lab · ${j.sample.name}`;
    drawSlide(0);
    status.textContent = `${j.feature.name} are almost as clear as the glass around them. A drop of ${j.dyeName} will colour them.`;
    hint.textContent = 'The dye soaks into the cells faster than into the background. Rinse when the cells stand out most: too early and they stay pale, too late and the background darkens too.';
    primary.textContent = `Space · Add a drop of ${j.dyeName}`;
    again.style.display = 'none';
  };

  const addDrop = () => {
    // per-attempt soak speeds; the background always stays slower than the target
    const jitter = () => 1 + (Math.random() * 2 - 1) * JITTER;
    tauTarget = TAU_TARGET_S * jitter();
    tauBackground = TAU_BACKGROUND_S * jitter();
    phase = 'soaking';
    startedAt = performance.now();
    primary.textContent = 'Space · Rinse now';
    frame = requestAnimationFrame(tick);
  };

  const rinse = () => {
    cancelAnimationFrame(frame);
    const j = job();
    if (!j) return close();
    const t = (performance.now() - startedAt) / 1000;
    const q = stainQuality(t, tauTarget, tauBackground);
    const tBest = bestStainTime(tauTarget, tauBackground);
    const peak = stainContrast(tBest, tauTarget, tauBackground);
    phase = 'done';
    drawSlide(t);
    if (!stainSample(ctx, j.sample.id, j.dye, q)) {
      status.textContent = `You are out of ${j.dyeName}.`;
      return;
    }
    const grade =
      q >= PERFECT ? 'Perfect stain!'
      : q >= GOOD ? 'Good stain.'
      : t < tBest ? 'Too pale: you rinsed before the dye had soaked in.'
      : 'Overstained: the background took up dye too, so the cells blend in again.';
    status.textContent = `${grade} Contrast ${stainContrast(t, tauTarget, tauBackground).toFixed(2)} of a possible ${peak.toFixed(2)} (${pct(q)}).`;
    const kept = ctx.state.stains[j.sample.id] ?? q;
    hint.textContent = `The peak was at ${tBest.toFixed(1)} s; you rinsed at ${t.toFixed(1)} s.${kept > q + 0.005 ? ` Your earlier, better stain (${pct(kept)}) stays on the slide.` : ''}`;
    primary.textContent = 'Space · Back to the eyepiece';
    const left = ctx.state.inventory[j.dye] ?? 0;
    again.style.display = left ? '' : 'none';
    again.textContent = `R · Try again (${left} ${j.dyeName} left)`;
  };

  const openLab = () => {
    isOpen = true;
    panel.style.display = '';
    syncChip();
    showReady();
  };

  function close() {
    cancelAnimationFrame(frame);
    isOpen = false;
    panel.style.display = 'none';
    syncChip();
  }

  const onPrimary = () => (phase === 'ready' ? addDrop() : phase === 'soaking' ? rinse() : close());
  const onAgain = () => ((ctx.state.inventory[job()?.dye ?? ''] ?? 0) > 0 ? showReady() : undefined);
  primary.onclick = onPrimary;
  again.onclick = onAgain;
  leave.onclick = close;

  // Capture phase, so while the lab is open the eyepiece (F, Esc, 1-9) and the world never see these keys.
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isOpen) {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.repeat) return;
      if (e.key === 'Escape') close();
      else if (e.code === 'Space' || e.key === 'Enter') onPrimary();
      else if (e.key.toLowerCase() === 'r' && phase === 'done') onAgain();
      return;
    }
    if (e.key.toLowerCase() !== 's' || e.repeat) return;
    const j = job();
    if (!j || !j.have) return;
    e.stopImmediatePropagation();
    openLab();
  };
  addEventListener('keydown', onKey, true);

  const offs = [
    ctx.bus.on('closeEyepiece', close),
    // createGame's own openEyepiece listener runs first, so currentSampleId is already set here
    ...(['openEyepiece', 'zoomChanged', 'scopeChanged', 'itemGathered', 'sampleStained'] as const).map((t) => ctx.bus.on(t, syncChip)),
  ];

  return {
    dispose() {
      cancelAnimationFrame(frame);
      removeEventListener('keydown', onKey, true);
      offs.forEach((off) => off());
      el.replaceChildren();
    },
  };
}
