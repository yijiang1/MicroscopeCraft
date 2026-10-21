// Procedural specimen art, drawn in specimen coordinates (µm). Everything is deterministic
// (hash noise, no Math.random) so a view never flickers. One drawer per Drawing kind in the schema.
import type { Drawing, Feature } from '../shared/schema';

/** Visible window of the specimen, µm, plus the current scale. */
export interface View {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  pxPerUm: number;
}

type Drawer = (g: CanvasRenderingContext2D, f: Feature, v: View) => void;

const MAX_ITEMS = 20_000; // cheaper to skip a layer than to draw 100k cells that blur away anyway

const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

/** Hash noise in [0,1): same (a, b, seed) always gives the same value. */
function noise(a: number, b: number, seed: number) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Midrib, secondary veins and finer veins. Width scales from the feature's sizeUm (the finest vein). */
const veins: Drawer = (g, f) => {
  const seed = seedOf(f.id);
  g.strokeStyle = '#a8e6a1';
  g.lineCap = 'round';
  const line = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  line(-6000, 0, 6000, 0, f.sizeUm * 8);
  for (let i = -6; i <= 6; i++) {
    for (const side of [-1, 1]) {
      const x = i * 900 + noise(i, side, seed) * 200;
      const len = 3200;
      const ex = x + len * 0.55;
      const ey = side * len * 0.8;
      line(x, 0, ex, ey, f.sizeUm * 3);
      for (let k = 1; k < 14; k++) {
        const t = k / 14;
        const bx = x + (ex - x) * t;
        const by = side * Math.abs(ey) * t;
        const l = 320 * (1 - t * 0.6);
        line(bx, by, bx + l * 0.9, by + side * l * 0.45, f.sizeUm);
        line(bx, by, bx - l * 0.4, by + side * l * 0.9, f.sizeUm);
      }
    }
  }
};

/** Walk the grid cells that overlap the view; skip the whole layer if there would be too many. */
function forGrid(v: View, step: number, fn: (i: number, j: number, cx: number, cy: number) => void) {
  const i0 = Math.floor(v.x0 / step);
  const i1 = Math.ceil(v.x1 / step);
  const j0 = Math.floor(v.y0 / step);
  const j1 = Math.ceil(v.y1 / step);
  if ((i1 - i0) * (j1 - j0) > MAX_ITEMS) return;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(i, j, (i + (j % 2 ? 0.5 : 0)) * step, j * step);
}

const cells: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  const s = f.sizeUm;
  g.lineWidth = s * 0.14;
  g.strokeStyle = '#8fd48a';
  forGrid(v, s, (i, j, cx, cy) => {
    g.fillStyle = `hsl(115 45% ${22 + noise(i, j, seed) * 14}%)`;
    g.beginPath();
    g.roundRect(cx - s * 0.45, cy - s * 0.45, s * 0.9, s * 0.9, s * 0.2);
    g.fill();
    g.stroke();
  });
};

const grains: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  const step = f.sizeUm * 1.6;
  forGrid(v, step, (i, j, cx, cy) => {
    const r = f.sizeUm * (0.35 + 0.25 * noise(i, j, seed));
    const sides = 5 + Math.floor(noise(j, i, seed) * 3);
    g.fillStyle = `hsl(${38 + noise(i, i + j, seed) * 12} 40% ${58 + noise(j, j + i, seed) * 22}%)`;
    g.beginPath();
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2 + noise(i, j, seed + k);
      const rr = r * (0.8 + 0.4 * noise(i + k, j, seed));
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.fill();
  });
};

/** Stand-in for pollen, algae, rods, hair and lattices until someone draws them properly. */
const dots: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  g.fillStyle = '#a8e6a1';
  forGrid(v, f.sizeUm * 3, (i, j, cx, cy) => {
    g.beginPath();
    g.ellipse(cx, cy, f.sizeUm * 0.5, f.sizeUm * (f.drawing === 'rods' ? 0.2 : 0.5), noise(i, j, seed) * Math.PI, 0, Math.PI * 2);
    g.fill();
  });
};

export const DRAWERS: Record<Drawing, Drawer> = {
  veins, cells, grains, pollen: dots, rods: dots, algae: dots, hair: dots, lattice: dots,
};
