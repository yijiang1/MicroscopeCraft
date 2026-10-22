// Small DOM pieces shared by the eyepiece's alignment panels and mini-games, and the Tuning contract they follow.
import type { Feature, ScopeParams } from '../shared/schema';

/** What an alignment panel or mini-game does to the picture. Every hook is optional. */
export interface Tuning {
  /** The scope the eye really gets: the player's illumination, leftover aberrations, probe size... */
  scope?(s: ScopeParams): ScopeParams;
  /** Multiplies a feature's contrast: beam flux and absorption edges, a reconstruction that failed... 1 = unchanged. */
  contrast?(f: Feature): number;
  /** Shift of the picture in px at time t (ms): the image swinging under the wobbler. */
  shift?(t: number): [number, number];
  /** A message that matters more than the usual "hit a wall" one, or null. */
  banner?(): string | null;
  /** Keeps redrawing while true (an animation, a wobbler). */
  animating?(): boolean;
  dispose(): void;
}

export const el = (tag: string, css = '', text = ''): HTMLElement => {
  const e = document.createElement(tag);
  e.style.cssText = css;
  e.textContent = text;
  return e;
};

export function button(text: string, onClick: () => void, css = ''): HTMLButtonElement {
  const b = el('button', css, text) as HTMLButtonElement;
  b.onclick = onClick;
  return b;
}

/** A labelled range input whose value shows beside it. `fmt` turns the value into its readout. */
export function slider(label: string, min: number, max: number, step: number, value: number, onInput: (v: number) => void, fmt: (v: number) => string = (v) => `${v}`) {
  const wrap = el('label', 'display:grid;grid-template-columns:88px minmax(0,1fr) 62px;gap:6px;align-items:center;margin:3px 0;font-size:12px');
  const input = document.createElement('input');
  input.style.cssText = 'width:100%;min-width:0;margin:0';
  input.type = 'range';
  input.min = `${min}`;
  input.max = `${max}`;
  input.step = `${step}`;
  input.value = `${value}`;
  const out = el('span', 'text-align:right;color:#cde;font-variant-numeric:tabular-nums', fmt(value));
  input.addEventListener('input', () => {
    out.textContent = fmt(+input.value);
    onInput(+input.value);
  });
  input.addEventListener('keydown', (e) => {
    // Keep native slider navigation local; Escape/F and instrument shortcuts still reach the eyepiece.
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) e.stopPropagation();
  });
  wrap.append(el('span', 'color:#bcd', label), input, out);
  return { wrap, input, set: (v: number) => ((input.value = `${v}`), (out.textContent = fmt(v))) };
}

export function canvas(w: number, h = w): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.style.cssText = `display:block;margin:6px auto;width:${w}px;height:${h}px;border-radius:8px;background:#000`;
  return c;
}

/** Paint a grey (or coloured) image from values, scaled between their min and max (with an optional gamma). */
export function paint(c: HTMLCanvasElement, values: ArrayLike<number>, n: number, gamma = 1, tint: [number, number, number] = [255, 255, 255]) {
  const g = c.getContext('2d');
  if (!g) return;
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < values.length; k++) {
    lo = Math.min(lo, values[k]!);
    hi = Math.max(hi, values[k]!);
  }
  const img = g.createImageData(n, values.length / n);
  for (let k = 0; k < values.length; k++) {
    const v = Math.pow((values[k]! - lo) / (hi - lo || 1), gamma);
    img.data[k * 4] = tint[0] * v;
    img.data[k * 4 + 1] = tint[1] * v;
    img.data[k * 4 + 2] = tint[2] * v;
    img.data[k * 4 + 3] = 255;
  }
  const tmp = document.createElement('canvas');
  tmp.width = n;
  tmp.height = values.length / n;
  tmp.getContext('2d')?.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(tmp, 0, 0, c.width, c.height);
}

/** A side panel inside the eyepiece, top right. */
export function panel(host: HTMLElement, title: string): { box: HTMLElement; status: HTMLElement } {
  const box = el('div', 'position:absolute;right:10px;top:10px;width:300px;max-height:calc(100% - 160px);overflow:auto;box-sizing:border-box;padding:10px 12px;border-radius:10px;background:#000000d0;color:#eee;font:13px system-ui;z-index:2');
  const head = el('div', 'display:flex;justify-content:space-between;align-items:baseline;gap:8px');
  const status = el('span', 'color:#ffd24a;font-weight:600');
  head.append(el('b', 'font-size:14px', title), status);
  box.append(head);
  host.append(box);
  return { box, status };
}

/** A tick list of steps for a procedure. */
export function steps(items: string[]) {
  const list = el('ol', 'margin:6px 0;padding-left:18px;font-size:12px;color:#ccd');
  const rows = items.map((t) => {
    const li = el('li', 'margin:2px 0', t);
    list.append(li);
    return li;
  });
  return { list, tick: (i: number, done: boolean) => (rows[i]!.style.color = done ? '#9be59b' : '#ccd') };
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
