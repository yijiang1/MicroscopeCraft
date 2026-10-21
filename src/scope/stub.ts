// Day-one stub: one strip per feature. Visible features draw sharp, the rest are blurred and labelled
// with the reason from shared/sim. Replace with the real zoom/focus view.
import { visibility } from '../shared/sim/optics';
import { discover, type GameContext } from '../shared/state';
import type { Drawing } from '../shared/schema';
import type { ScopeHandle } from './index';

const PAD = 24;
const STRIP = 220;

/** Fake art: deterministic scribbles per drawing kind. */
function drawFake(g: CanvasRenderingContext2D, kind: Drawing, x: number, y: number, w: number, h: number) {
  g.strokeStyle = '#7fd67f';
  g.fillStyle = '#7fd67f';
  g.lineWidth = 2;
  g.beginPath();
  if (kind === 'veins') {
    g.moveTo(x, y + h / 2);
    g.lineTo(x + w, y + h / 2);
    for (let i = 1; i < 12; i++) {
      const px = x + (w * i) / 12;
      g.moveTo(px, y + h / 2);
      g.lineTo(px + 40, y + (i % 2 ? 0 : h));
    }
    g.stroke();
  } else {
    for (let i = 0; i < 60; i++) {
      const cx = x + ((i * 97) % w);
      const cy = y + ((i * 53) % h);
      g.moveTo(cx + 14, cy);
      g.arc(cx, cy, 14, 0, Math.PI * 2);
    }
    g.stroke();
  }
}

export function mountStubScope(el: HTMLElement, ctx: GameContext): ScopeHandle {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;background:#000';
  el.appendChild(canvas);

  const render = (sampleId: string) => {
    const sample = ctx.data.samples[sampleId];
    if (!sample) return;
    canvas.width = el.clientWidth;
    canvas.height = el.clientHeight;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.fillStyle = '#0b1a0b';
    g.fillRect(0, 0, canvas.width, canvas.height);
    sample.features.forEach((f, i) => {
      const v = visibility(f, ctx.state.scope);
      const y = PAD + i * (STRIP + PAD);
      g.save();
      g.filter = v.visible ? 'none' : 'blur(10px)'; // 2D filter blur; the real view should blur by d_eff
      drawFake(g, f.drawing, PAD, y, canvas.width - 300 - PAD * 2, STRIP);
      g.restore();
      g.fillStyle = '#fff';
      g.font = '16px system-ui';
      g.fillText(`${f.name}: ${v.visible ? 'visible' : v.reason}`, PAD, y + STRIP + 16);
      if (v.visible) discover(ctx, f.id);
    });
    g.fillStyle = '#aaa';
    g.fillText(`${sample.name} · ${ctx.state.scope.magnification}× · Esc or F to close`, PAD, canvas.height - 12);
  };

  const close = () => ctx.bus.emit('closeEyepiece', {});
  const onKey = (e: KeyboardEvent) => {
    if (el.style.display === 'block' && (e.key === 'Escape' || e.key.toLowerCase() === 'f')) close();
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
