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

/** Midrib, secondary veins and finer veins. sizeUm is the finest vein width; the rest of the pattern scales
 *  with it (tuned at 40 µm) so a coarser vein feature, like an insect wing, gets a coarser network. */
const veins: Drawer = (g, f) => {
  const seed = seedOf(f.id);
  const k = f.sizeUm / 40;
  // The field is centred on the specimen origin, so shift the pattern to put that spot just off a secondary vein
  // (on the midrib a magnified view would show only one thick band).
  g.translate(-15.6 * f.sizeUm, 17.5 * f.sizeUm);
  g.strokeStyle = '#a8e6a1';
  g.lineCap = 'round';
  const line = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  line(-6000 * k, 0, 6000 * k, 0, f.sizeUm * 4);
  for (let i = -6; i <= 6; i++) {
    for (const side of [-1, 1]) {
      const x = (i * 900 + noise(i, side, seed) * 200) * k;
      const len = 3200 * k;
      const ex = x + len * 0.55;
      const ey = side * len * 0.8;
      line(x, 0, ex, ey, f.sizeUm * 2);
      for (let n = 1; n < 14; n++) {
        const t = n / 14;
        const bx = x + (ex - x) * t;
        const by = side * Math.abs(ey) * t;
        const l = 320 * k * (1 - t * 0.6);
        line(bx, by, bx + l * 0.9, by + side * l * 0.45, f.sizeUm);
        line(bx, by, bx - l * 0.4, by + side * l * 0.9, f.sizeUm);
      }
    }
  }
};

/** Walk the grid cells that overlap the view; skip the whole layer if there would be too many. */
function forGrid(v: View, step: number, fn: (i: number, j: number, cx: number, cy: number) => void, stepY = step, stagger = true) {
  const i0 = Math.floor(v.x0 / step);
  const i1 = Math.ceil(v.x1 / step);
  const j0 = Math.floor(v.y0 / stepY);
  const j1 = Math.ceil(v.y1 / stepY);
  if ((i1 - i0) * (j1 - j0) > MAX_ITEMS) return;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(i, j, (i + (stagger && j % 2 ? 0.5 : 0)) * step, j * stepY);
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

/** Spirogyra-style filaments: rows of long cells, each with a spiral chloroplast. */
const algae: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  const w = f.sizeUm * 2;
  const h = f.sizeUm;
  forGrid(v, w * 1.05, (i, j, cx, cy) => {
    g.fillStyle = '#2f6b32';
    g.beginPath();
    g.roundRect(cx - w / 2, cy - h / 2, w, h, h * 0.3);
    g.fill();
    g.strokeStyle = `hsl(${105 + noise(i, j, seed) * 20} 70% 60%)`;
    g.lineWidth = h * 0.12;
    g.beginPath();
    for (let k = -1; k <= 1; k++) {
      g.moveTo(cx + k * h - h * 0.5, cy + h * 0.4);
      g.lineTo(cx + k * h + h * 0.5, cy - h * 0.4);
    }
    g.stroke();
  }, h * 1.4);
};

/** Pollen: a round grain with a ring and a crown of spikes. */
const pollen: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  const r = f.sizeUm / 2;
  forGrid(v, f.sizeUm * 2.4, (i, j, cx, cy) => {
    const a0 = noise(i, j, seed) * Math.PI;
    g.fillStyle = `hsl(${48 + noise(j, i, seed) * 10} 75% ${55 + noise(i, j, seed + 1) * 10}%)`;
    g.strokeStyle = '#f6e27a';
    g.lineWidth = r * 0.12;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 14; k++) {
      const a = a0 + (k / 14) * Math.PI * 2;
      g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.lineTo(cx + Math.cos(a) * r * 1.28, cy + Math.sin(a) * r * 1.28);
    }
    g.stroke();
  });
};

/** Hairs: thin curved strands at random angles; sizeUm is the strand width. */
const hair: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  const len = f.sizeUm * 10;
  g.strokeStyle = '#d9e8c4';
  g.lineWidth = f.sizeUm * 0.5;
  g.lineCap = 'round';
  forGrid(v, len * 0.5, (i, j, cx, cy) => {
    const a = noise(i, j, seed) * Math.PI;
    const bend = (noise(j, i, seed) - 0.5) * len * 0.5;
    g.beginPath();
    g.moveTo(cx - Math.cos(a) * len / 2, cy - Math.sin(a) * len / 2);
    g.quadraticCurveTo(cx - Math.sin(a) * bend, cy + Math.cos(a) * bend, cx + Math.cos(a) * len / 2, cy + Math.sin(a) * len / 2);
    g.stroke();
  });
};

/** Overlapping wing scales, like roof tiles; sizeUm is the scale width. */
const scales: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  const w = f.sizeUm;
  forGrid(v, w, (i, j, cx, cy) => {
    g.fillStyle = `hsl(${25 + noise(i, j, seed) * 35} 55% ${40 + noise(j, i, seed) * 20}%)`;
    g.strokeStyle = '#00000055';
    g.lineWidth = w * 0.06;
    g.beginPath();
    g.ellipse(cx, cy, w * 0.55, w * 1.1, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }, w * 0.7);
};

/** Virus: a round capsid with a ring of spikes. sizeUm is the capsid diameter. */
const virus: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  const r = f.sizeUm / 2;
  g.strokeStyle = '#e39be0';
  g.lineWidth = r * 0.15;
  forGrid(v, f.sizeUm * 3, (i, j, cx, cy) => {
    const a0 = noise(i, j, seed) * Math.PI;
    g.fillStyle = '#c45fc0';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 12; k++) {
      const a = a0 + (k / 12) * Math.PI * 2;
      g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.lineTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
    }
    g.stroke();
  });
};

/** Crystal lattice: a square grid of atom columns, two species in a checkerboard. sizeUm is the lattice spacing.
 *  Simplification: atoms are drawn as discs, not computed from a wave-optics model. */
const lattice: Drawer = (g, f, v) => {
  forGrid(v, f.sizeUm, (i, j, cx, cy) => {
    const heavy = (i + j) % 2 === 0;
    g.fillStyle = heavy ? '#f2f8ff' : '#7fa6cc';
    g.beginPath();
    g.arc(cx, cy, f.sizeUm * (heavy ? 0.24 : 0.16), 0, Math.PI * 2);
    g.fill();
  }, f.sizeUm, false);
};

/** Oil droplets: glossy golden spheres of varying size with a small highlight. sizeUm is the typical diameter. */
const droplets: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  forGrid(v, f.sizeUm * 1.5, (i, j, cx, cy) => {
    const r = f.sizeUm * (0.25 + 0.3 * noise(i, j, seed));
    const x = cx + (noise(j, i, seed) - 0.5) * f.sizeUm * 0.5;
    const y = cy + (noise(i, i + j, seed) - 0.5) * f.sizeUm * 0.5;
    const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#fff3b0');
    grad.addColorStop(1, '#d9a21c');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  });
};

/** Cell nuclei: one round body per cell, with a darker nucleolus, on the grid of a cell layer three times their size
 *  (the leaf's 15 µm cells hold 5 µm nuclei). Painted in the stain's color; unstained they are a faint ghost (alpha = contrast). */
const nuclei: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  const r = f.sizeUm / 2;
  forGrid(v, f.sizeUm * 3, (i, j, cx, cy) => {
    const x = cx + (noise(i, j, seed) - 0.5) * f.sizeUm * 0.6;
    const y = cy + (noise(j, i, seed) - 0.5) * f.sizeUm * 0.6;
    g.fillStyle = f.stain?.color ?? '#e8efe6';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#00000059';
    g.beginPath();
    g.arc(x + r * 0.25, y - r * 0.2, r * 0.32, 0, Math.PI * 2);
    g.fill();
  });
};

/** Amoeba: a lobed body with blunt pseudopods, a nucleus and a few food vacuoles. sizeUm is the body width.
 *  The grid is offset half a step so the field's centre falls between amoebas and never hides what is under them. */
const amoeba: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  const r = f.sizeUm / 2;
  const step = f.sizeUm * 4;
  forGrid(v, step, (i, j, cx, cy) => {
    const x = cx + step / 2 + (noise(i, j, seed) - 0.5) * f.sizeUm;
    const y = cy + step / 2 + (noise(j, i, seed) - 0.5) * f.sizeUm;
    const lobes = 3 + Math.floor(noise(i + 1, j, seed) * 3);
    const phase = noise(i, j + 1, seed) * Math.PI * 2;
    g.fillStyle = f.stain?.color ?? '#e8efe6';
    g.beginPath();
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const rr = r * (0.7 + 0.55 * Math.max(0, Math.sin(a * lobes + phase)) ** 3);
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.fill();
    g.fillStyle = '#0000004d';
    g.beginPath();
    g.arc(x + r * 0.15, y - r * 0.1, r * 0.22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff73';
    g.lineWidth = r * 0.04;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(x - r * 0.3 + k * r * 0.2, y + r * (0.25 - k * 0.12), r * 0.08, 0, Math.PI * 2);
      g.stroke();
    }
  });
};

/** Stand-in for rods until someone draws them properly. */
const dots: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  g.fillStyle = '#a8e6a1';
  forGrid(v, f.sizeUm * (f.drawing === 'rods' ? 2.5 : 3), (i, j, cx, cy) => {
    g.beginPath();
    g.ellipse(cx, cy, f.sizeUm * 0.5, f.sizeUm * (f.drawing === 'rods' ? 0.2 : 0.5), noise(i, j, seed) * Math.PI, 0, Math.PI * 2);
    g.fill();
  });
};

export const DRAWERS: Record<Drawing, Drawer> = {
  veins, cells, grains, pollen, rods: dots, algae, hair, scales, virus, droplets, lattice, nuclei, amoeba,
};
