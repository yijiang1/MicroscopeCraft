// What your eye would see through the microscope on the bench, right now: the slide's features at the build's
// magnification, blurred by the finest detail it resolves plus the defocus, in a round field, like the eyepiece.
// The drawings are simpler than the eyepiece's own (that module is not ours to import), but what shows and what
// blurs away comes from the same shared visibility rules.
import type { Drawing, Feature, Sample, ScopeParams } from '../shared/schema';
import { featureContrast, scopeResolutionUm, visibility, type Visibility } from '../shared/sim/optics';

/** The eyepiece's display scale: the round field spans 20 mm of apparent (magnified) size. */
const APPARENT_FIELD_UM = 20_000;
const FWHM_TO_SIGMA = 1 / 2.355;
const BACKGROUND = '#16361a';
const MAX_ITEMS = 5000;
/** Layers this many fields wider than the view are only background, as in the eyepiece. */
const MAX_FEATURE_SCREENS = 3;

export interface PreviewState {
  sample: Sample;
  /** The build as the game would use it now; null = no image yet (a lens or the lamp missing). */
  scope: ScopeParams | null;
  defocusUm: number;
  lit: boolean;
  /** Shown in the middle of a dark field when there is no image. */
  note?: string;
}

/** The scope the eye gets: defocus adds to the lens blur, as in the eyepiece. */
export const withDefocus = (s: ScopeParams, defocusUm: number): ScopeParams => ({ ...s, dLensUm: Math.hypot(s.dLensUm, defocusUm) });

/** Each feature of the slide and whether it shows. */
export const verdicts = (p: PreviewState): { f: Feature; v: Visibility }[] =>
  p.scope ? p.sample.features.map((f) => ({ f, v: visibility(f, withDefocus(p.scope!, p.defocusUm)) })) : [];

type Kind = 'cells' | 'round' | 'line' | 'grid';
const KIND: Partial<Record<Drawing, Kind>> = {
  cells: 'cells', honeycomb: 'cells', mosaic: 'cells', boxes: 'cells', facets: 'cells', stomata: 'cells', scales: 'cells',
  veins: 'line', lines: 'line', fibers: 'line', hair: 'line', needles: 'line', rods: 'line', helix: 'line', neurons: 'line',
  lattice: 'grid', map: 'grid', slice: 'grid',
};
const COLOR: Record<Kind, string> = { cells: '#a8e6a1', round: '#eef3c8', line: '#cfe9ff', grid: '#d8d0ff' };

const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
function noise(a: number, b: number, seed: number) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface View {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function grid(v: View, step: number, fn: (i: number, j: number, x: number, y: number) => void) {
  const i0 = Math.floor(v.x0 / step), i1 = Math.ceil(v.x1 / step);
  const j0 = Math.floor(v.y0 / step), j1 = Math.ceil(v.y1 / step);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > MAX_ITEMS) return;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(i, j, i * step, j * step);
}

function drawFeature(g: CanvasRenderingContext2D, f: Feature, v: View) {
  const kind = KIND[f.drawing] ?? 'round';
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  g.strokeStyle = g.fillStyle = f.tint ?? COLOR[kind];
  if (kind === 'cells') {
    // walls of a jittered grid of cells, each about the feature's size
    g.lineWidth = Math.max(s * 0.08, 0.02);
    grid(v, s, (i, j, x, y) => {
      const jx = (noise(i, j, seed) - 0.5) * s * 0.3;
      const jy = (noise(j, i, seed) - 0.5) * s * 0.3;
      g.strokeRect(x + jx, y + jy, s * 0.92, s * (0.6 + noise(i, j, seed + 1) * 0.35));
    });
  } else if (kind === 'line') {
    g.lineWidth = s;
    g.lineCap = 'round';
    grid(v, s * 9, (i, j, x, y) => {
      if (noise(i, j, seed) < 0.35) return;
      const a = noise(i, j, seed + 3) * Math.PI;
      const l = s * (5 + noise(j, i, seed) * 9);
      g.beginPath();
      g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    });
  } else if (kind === 'grid') {
    // evenly spaced lines, one per spacing (lattice planes, grain boundaries)
    g.lineWidth = s * 0.35;
    const i0 = Math.floor(v.x0 / s), i1 = Math.ceil(v.x1 / s);
    if (i1 - i0 > MAX_ITEMS) return;
    for (let i = i0; i <= i1; i++) {
      g.beginPath();
      g.moveTo(i * s, v.y0);
      g.lineTo(i * s, v.y1);
      g.stroke();
    }
  } else {
    const ring = f.drawing === 'discs' || f.drawing === 'rings';
    const square = f.drawing === 'cubes' || f.drawing === 'boxes';
    grid(v, s * 2.6, (i, j, x, y) => {
      if (noise(i, j, seed) < 0.3) return;
      const cx = x + (noise(i, j, seed + 5) - 0.5) * s * 1.4;
      const cy = y + (noise(j, i, seed + 7) - 0.5) * s * 1.4;
      const r = (s / 2) * (0.8 + noise(i, j, seed + 9) * 0.4);
      if (square) return g.fillRect(cx - r, cy - r, r * 2, r * 2);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      if (ring) {
        g.lineWidth = r * 0.55;
        g.stroke();
      } else g.fill();
    });
  }
}

/** A round scale bar length (1, 2 or 5 × 10^n µm) closest to `px` on screen. */
function niceBarUm(pxPerUm: number, px: number) {
  const target = px / pxPerUm;
  const pow = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].map((m) => m * pow).reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best));
}
const fmt = (um: number) => (um >= 1000 ? `${um / 1000} mm` : um >= 1 ? `${um} µm` : `${um * 1000} nm`);

const scene = document.createElement('canvas');

export function drawPreview(c: HTMLCanvasElement, p: PreviewState) {
  const g = c.getContext('2d');
  const sg = scene.getContext('2d');
  if (!g || !sg) return;
  const w = c.width, h = c.height;
  const r = Math.min(w, h) * 0.47;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.save();
  g.beginPath();
  g.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  g.clip();
  if (!p.scope || !p.lit) {
    g.fillStyle = '#07090a';
    g.fillRect(0, 0, w, h);
    g.restore();
    g.fillStyle = '#8a96a0';
    g.font = '13px system-ui';
    g.textAlign = 'center';
    wrap(g, p.note ?? 'No image yet', w / 2, h / 2 - 8, r * 1.5, 17);
    g.textAlign = 'left';
    return;
  }
  const scope = withDefocus(p.scope, p.defocusUm);
  const pxPerUm = (scope.magnification * w) / APPARENT_FIELD_UM;
  scene.width = w;
  scene.height = h;
  sg.fillStyle = BACKGROUND;
  sg.fillRect(0, 0, w, h);
  const view: View = { x0: -w / 2 / pxPerUm, x1: w / 2 / pxPerUm, y0: -h / 2 / pxPerUm, y1: h / 2 / pxPerUm };
  sg.save();
  sg.translate(w / 2, h / 2);
  sg.scale(pxPerUm, pxPerUm);
  for (const f of [...p.sample.features].sort((a, b) => +a.onTop - +b.onTop || a.sizeUm - b.sizeUm)) {
    if (f.sizeUm * pxPerUm > MAX_FEATURE_SCREENS * Math.max(w, h)) continue;
    const contrast = featureContrast(f, scope.mode);
    if (contrast <= 0) continue;
    sg.globalAlpha = Math.min(1, contrast * scope.contrastBoost * 2);
    sg.save();
    drawFeature(sg, f, view);
    sg.restore();
  }
  sg.restore();
  const sigma = Math.min(60, scopeResolutionUm(scope) * pxPerUm * FWHM_TO_SIGMA);
  g.filter = `blur(${sigma.toFixed(2)}px)`;
  g.drawImage(scene, 0, 0);
  g.filter = 'none';
  // vignette at the edge of the field
  const vg = g.createRadialGradient(w / 2, h / 2, r * 0.7, w / 2, h / 2, r);
  vg.addColorStop(0, '#0000');
  vg.addColorStop(1, '#000a');
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
  g.restore();
  const bar = niceBarUm(pxPerUm, w * 0.22);
  g.fillStyle = '#fff';
  g.fillRect(w * 0.16, h * 0.86, bar * pxPerUm, 3);
  g.font = '11px system-ui';
  g.fillText(fmt(bar), w * 0.16, h * 0.86 - 5);
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  lines.forEach((l, i) => g.fillText(l, x, y - ((lines.length - 1) * lineH) / 2 + i * lineH));
}
