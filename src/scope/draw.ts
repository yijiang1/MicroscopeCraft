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
  g.strokeStyle = f.tint ?? '#a8e6a1';
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

/** Leave out some cells of a scattered pattern, but never the one at the origin: the field is centred there, and at
 *  the lowest magnification that shows a feature it may be the only cell in view. */
const skip = (i: number, j: number, seed: number, p: number) => (i !== 0 || j !== 0) && noise(i, j, seed) < p;

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
    g.fillStyle = f.tint ?? `hsl(${38 + noise(i, i + j, seed) * 12} 40% ${58 + noise(j, j + i, seed) * 22}%)`;
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
  g.strokeStyle = f.tint ?? '#d9e8c4';
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
    g.fillStyle = f.tint ?? '#c45fc0';
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
    g.fillStyle = heavy ? (f.tint ?? '#f2f8ff') : '#7fa6cc';
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
    grad.addColorStop(0, f.tint ? '#ffffffaa' : '#fff3b0');
    grad.addColorStop(f.tint ? 0.35 : 1, f.tint ?? '#d9a21c');
    if (f.tint) grad.addColorStop(1, f.tint);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  });
};

/** Rod-shaped and round bacteria (and mitochondria): little capsules. sizeUm is the length. */
const rods: Drawer = (g, f, v) => {
  const seed = seedOf(f.id);
  const L = f.sizeUm;
  const shift = (((seed >>> 0) % 5) / 5) * L * 1.25; // two kinds of bacteria of one size must not sit on one grid
  g.fillStyle = f.tint ?? '#a8e6a1';
  forGrid(v, L * 2.5, (i, j, cx, cy) => {
    const a = noise(i, j, seed) * Math.PI;
    const round = noise(j, i, seed + 2) < 0.2;
    g.save();
    g.translate(cx + shift + (noise(i, j, seed + 3) - 0.5) * L, cy + shift * 0.6 + (noise(j, i, seed + 4) - 0.5) * L);
    g.rotate(a);
    g.beginPath();
    if (round) g.arc(0, 0, L * 0.25, 0, Math.PI * 2);
    else g.roundRect(-L / 2, -L * 0.2, L, L * 0.4, L * 0.2);
    g.fill();
    g.restore();
  });
};

const tint = (f: Feature, fallback: string) => f.tint ?? fallback;

/** Stomata: two bean-shaped guard cells around a slit, scattered among the skin cells. sizeUm is the stoma length. */
const stomata: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  forGrid(v, s * 2.6, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.35)) return;
    g.save();
    g.translate(cx, cy);
    g.rotate((noise(j, i, seed) - 0.5) * 0.8);
    g.fillStyle = tint(f, '#7cc46a');
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(side * s * 0.18, 0, s * 0.2, s * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#0b1a0b';
    g.beginPath();
    g.ellipse(0, 0, s * 0.05, s * 0.32, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
};

/** Long gently curving strands at all angles: wood and cotton fibres, silk, hyphae, nanotubes. sizeUm is the width. */
const fibers: Drawer = (g, f, v) => {
  const w = f.sizeUm;
  const seed = seedOf(f.id);
  g.strokeStyle = tint(f, '#e8e2d0');
  g.lineWidth = w;
  g.lineCap = 'round';
  forGrid(v, w * 7, (i, j, cx, cy) => {
    const a = noise(i, j, seed) * Math.PI;
    const L = w * 30;
    const bend = (noise(j, i, seed) - 0.5) * L * 0.4;
    const dx = (Math.cos(a) * L) / 2;
    const dy = (Math.sin(a) * L) / 2;
    g.beginPath();
    g.moveTo(cx - dx, cy - dy);
    g.quadraticCurveTo(cx - Math.sin(a) * bend, cy + Math.cos(a) * bend, cx + dx, cy + dy);
    g.stroke();
  });
};

/** Patches of parallel lines sizeUm apart: lattice fringes, layers, striae, ridges, gills, bands. */
const lines: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  const cell = s * 14;
  g.strokeStyle = tint(f, '#d8e8f0');
  g.lineWidth = s * 0.45;
  forGrid(v, cell, (i, j, cx, cy) => {
    const a = Math.floor(noise(i, j, seed) * 3) * (Math.PI / 3) + noise(j, i, seed) * 0.2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const half = cell * 0.48;
    g.beginPath();
    for (let k = -6; k <= 6; k++) {
      const ox = -sn * k * s;
      const oy = c * k * s;
      g.moveTo(cx + ox - c * half, cy + oy - sn * half);
      g.lineTo(cx + ox + c * half, cy + oy + sn * half);
    }
    g.stroke();
  }, cell, false);
};

/** Ciliates (Paramecium, Vorticella's cousins): slipper-shaped cells fringed with cilia. sizeUm is the length. */
const ciliate: Drawer = (g, f, v) => {
  const L = f.sizeUm;
  const seed = seedOf(f.id);
  forGrid(v, L * 2.2, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.3)) return;
    g.save();
    g.translate(cx, cy);
    g.rotate(noise(j, i, seed) * Math.PI * 2);
    g.fillStyle = tint(f, '#c8d8c0');
    g.beginPath();
    g.ellipse(0, 0, L * 0.5, L * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff88';
    g.lineWidth = L * 0.01;
    g.beginPath();
    for (let k = 0; k < 48; k++) {
      const t = (k / 48) * Math.PI * 2;
      const x = Math.cos(t) * L * 0.5;
      const y = Math.sin(t) * L * 0.2;
      g.moveTo(x, y);
      g.lineTo(x * 1.08, y * 1.3);
    }
    g.stroke();
    g.fillStyle = '#ffffff44';
    g.beginPath();
    g.arc(L * 0.15, 0, L * 0.07, 0, Math.PI * 2);
    g.arc(-L * 0.2, L * 0.03, L * 0.05, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
};

/** Volvox: a hollow ball studded with tiny cells, daughter colonies inside. sizeUm is the diameter. */
const colony: Drawer = (g, f, v) => {
  const d = f.sizeUm;
  const seed = seedOf(f.id);
  const c = tint(f, '#4caf50');
  forGrid(v, d * 1.6, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.4)) return;
    g.fillStyle = `${c}33`;
    g.strokeStyle = c;
    g.lineWidth = d * 0.01;
    g.beginPath();
    g.arc(cx, cy, d / 2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = c;
    for (let k = 0; k < 90; k++) {
      const a = noise(k, i + j, seed) * Math.PI * 2;
      const r = Math.sqrt(noise(i + j, k, seed)) * d * 0.48;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, d * 0.012, 0, Math.PI * 2);
      g.fill();
    }
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(cx + (noise(k, i, seed) - 0.5) * d * 0.5, cy + (noise(j, k, seed) - 0.5) * d * 0.5, d * 0.09, 0, Math.PI * 2);
      g.fill();
    }
  });
};

/** Chains of beads: cyanobacteria filaments (with an occasional bigger heterocyst), glue droplets on silk. sizeUm is a bead. */
const beads: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  forGrid(v, s * 12, (i, j, cx, cy) => {
    const a = noise(i, j, seed) * Math.PI;
    for (let k = -5; k <= 5; k++) {
      const big = noise(k, i + j, seed) > 0.85;
      const wob = Math.sin(k * 0.6 + i) * s * 0.6;
      g.fillStyle = big ? '#c8d890' : tint(f, '#3c8f6a');
      g.beginPath();
      g.arc(cx + Math.cos(a) * k * s * 1.05 - Math.sin(a) * wob, cy + Math.sin(a) * k * s * 1.05 + Math.cos(a) * wob, (big ? 0.62 : 0.5) * s, 0, Math.PI * 2);
      g.fill();
    }
  }, s * 9);
};

/** Euglena: a spindle cell with a flagellum and a red eyespot. sizeUm is the length. */
const flagellate: Drawer = (g, f, v) => {
  const L = f.sizeUm;
  const seed = seedOf(f.id);
  forGrid(v, L * 1.8, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.3)) return;
    g.save();
    g.translate(cx, cy);
    g.rotate(noise(j, i, seed) * Math.PI * 2);
    g.fillStyle = tint(f, '#4caf50');
    g.beginPath();
    g.ellipse(0, 0, L * 0.5, L * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d8f0d0';
    g.lineWidth = L * 0.015;
    g.beginPath();
    g.moveTo(L * 0.48, 0);
    g.bezierCurveTo(L * 0.7, -L * 0.15, L * 0.8, L * 0.15, L * 1.0, 0);
    g.stroke();
    g.fillStyle = '#e03a2a';
    g.beginPath();
    g.arc(L * 0.36, -L * 0.05, L * 0.04, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
};

/** Cubic crystals (salt, galena, fluorite) drawn as little cubes with a light top. sizeUm is the edge. */
const cubes: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  const c = tint(f, '#f4f4f4');
  forGrid(v, s * 2.4, (i, j, cx, cy) => {
    const k = s * (0.6 + 0.5 * noise(i, j, seed));
    const x = cx + (noise(j, i, seed) - 0.5) * s;
    const y = cy + (noise(i, i + j, seed) - 0.5) * s;
    g.fillStyle = c;
    g.fillRect(x - k / 2, y - k / 2, k, k);
    g.fillStyle = '#ffffff55';
    g.beginPath();
    g.moveTo(x - k / 2, y - k / 2);
    g.lineTo(x - k / 4, y - k * 0.75);
    g.lineTo(x + k * 0.75, y - k * 0.75);
    g.lineTo(x + k / 2, y - k / 2);
    g.fill();
    g.fillStyle = '#00000033';
    g.fillRect(x + k / 2, y - k / 2, k / 4, k);
  });
};

/** Six-sided crystals seen end-on (beryl, willemite, protein crystals, magnetite). sizeUm is the width. */
const prisms: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  forGrid(v, s * 2.2, (i, j, cx, cy) => {
    const r = s * (0.35 + 0.2 * noise(i, j, seed));
    const a0 = noise(j, i, seed);
    g.fillStyle = tint(f, '#c8e8f0');
    g.strokeStyle = '#ffffff88';
    g.lineWidth = s * 0.04;
    g.beginPath();
    for (let k = 0; k < 6; k++) g.lineTo(cx + Math.cos(a0 + (k * Math.PI) / 3) * r, cy + Math.sin(a0 + (k * Math.PI) / 3) * r);
    g.closePath();
    g.fill();
    g.stroke();
  });
};

/** Needle crystals and hooks in tufts: malachite, raphides, hooklets, spikes, chromosomes. sizeUm is the width. */
const needles: Drawer = (g, f, v) => {
  const w = f.sizeUm;
  const seed = seedOf(f.id);
  g.strokeStyle = tint(f, '#e8e8e8');
  g.lineWidth = w;
  g.lineCap = 'round';
  forGrid(v, w * 14, (i, j, cx, cy) => {
    const a0 = noise(i, j, seed) * Math.PI * 2;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = a0 + (k - 2) * 0.25;
      const L = w * (5 + 4 * noise(k, i + j, seed));
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
    }
    g.stroke();
  });
};

/** Soft blobs that glow on black: minerals under UV, dyed structures. sizeUm is a blob. */
const glow: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  const c = tint(f, '#7dff8a');
  forGrid(v, s * 1.4, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.3)) return;
    const r = s * (0.3 + 0.4 * noise(j, i, seed));
    const x = cx + (noise(i, j + 1, seed) - 0.5) * s;
    const y = cy + (noise(i + 1, j, seed) - 0.5) * s;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, c);
    grad.addColorStop(1, `${c}00`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  });
};

/** An X-ray fluorescence map: where one element is, as patches about sizeUm across whose brightness counts its atoms,
 *  pixel by pixel like a real scanned map. */
const map: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  const a0 = g.globalAlpha;
  const px = s / 5;
  g.fillStyle = tint(f, '#ffb04a');
  forGrid(v, px, (i, j, cx, cy) => {
    const n = 0.65 * noise(Math.floor(i / 5), Math.floor(j / 5), seed) + 0.35 * noise(i, j, seed + 1);
    if (n < 0.35) return;
    g.globalAlpha = a0 * Math.min(1, (n - 0.35) / 0.5);
    g.fillRect(cx - px / 2, cy - px / 2, px * 1.02, px * 1.02);
  }, px, false);
};

/** A tomography slice: a grey body cut through, with what hides inside. sizeUm is the hidden structure. */
const slice: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  forGrid(v, s * 4, (i, j, cx, cy) => {
    g.fillStyle = '#8a8a8a';
    g.beginPath();
    g.ellipse(cx, cy, s * 1.7, s * 1.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = tint(f, '#e0d0a0');
    g.beginPath();
    g.ellipse(cx - s * 0.35, cy, s * 0.5, s * 0.75, 0.3, 0, Math.PI * 2);
    g.ellipse(cx + s * 0.35, cy, s * 0.5, s * 0.75, -0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2a2a2a';
    g.lineWidth = s * 0.05;
    g.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = noise(k, i + j, seed) * Math.PI * 2;
      g.moveTo(cx + Math.cos(a) * s * 0.3, cy + Math.sin(a) * s * 0.3);
      g.lineTo(cx + Math.cos(a + 0.4) * s * 1.1, cy + Math.sin(a + 0.4) * s * 0.9);
    }
    g.stroke();
  });
};

/** A honeycomb of atoms (graphene, MoS₂ in projection, a moiré): sizeUm is the distance between neighbours. */
const honeycomb: Drawer = (g, f, v) => {
  const a = f.sizeUm;
  const c = tint(f, '#e0e8f0');
  const dx = a * Math.sqrt(3);
  const dy = a * 1.5;
  g.fillStyle = c;
  g.strokeStyle = `${c}88`;
  g.lineWidth = a * 0.12;
  forGrid(v, dx, (i, j, cx, cy) => {
    const pts: [number, number][] = [[cx, cy - a / 2], [cx, cy + a / 2]];
    g.beginPath();
    g.moveTo(cx, cy - a / 2);
    g.lineTo(cx, cy + a / 2);
    g.moveTo(cx, cy - a / 2);
    g.lineTo(cx - dx / 2, cy - a);
    g.moveTo(cx, cy - a / 2);
    g.lineTo(cx + dx / 2, cy - a);
    g.stroke();
    for (const [x, y] of pts) {
      g.beginPath();
      g.arc(x, y, a * 0.28, 0, Math.PI * 2);
      g.fill();
    }
  }, dy, true);
};

/** Single bright atoms or atom columns scattered or in rows. sizeUm is their spacing. */
const atoms: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  const c = tint(f, '#ffffff');
  forGrid(v, s * 3, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.5)) return;
    const x = cx + (noise(j, i, seed) - 0.5) * s;
    const y = cy + (noise(i + 2, j, seed) - 0.5) * s;
    const grad = g.createRadialGradient(x, y, 0, x, y, s * 0.4);
    grad.addColorStop(0, c);
    grad.addColorStop(1, `${c}00`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, s * 0.4, 0, Math.PI * 2);
    g.fill();
  });
};

/** Silicon "dumbbells": close pairs of atom columns on a lattice. sizeUm is the distance within a pair. */
const dumbbells: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  g.fillStyle = tint(f, '#e8e8f0');
  forGrid(v, s * 2.8, (_i, _j, cx, cy) => {
    for (const side of [-0.5, 0.5]) {
      g.beginPath();
      g.arc(cx, cy + side * s, s * 0.3, 0, Math.PI * 2);
      g.fill();
    }
  }, s * 4, true);
};

/** Discs with a pale centre: red blood cells, canals, spore cases, starch grains. sizeUm is the diameter. */
const discs: Drawer = (g, f, v) => {
  const d = f.sizeUm;
  const seed = seedOf(f.id);
  const c = tint(f, '#d05050');
  forGrid(v, d * 1.4, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.15)) return;
    const x = cx + (noise(j, i, seed) - 0.5) * d * 0.3;
    const y = cy + (noise(i, j + 3, seed) - 0.5) * d * 0.3;
    const grad = g.createRadialGradient(x, y, 0, x, y, d / 2);
    grad.addColorStop(0, `${c}55`);
    grad.addColorStop(0.7, c);
    grad.addColorStop(1, c);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, d / 2, 0, Math.PI * 2);
    g.fill();
  });
};

/** Neurons: a cell body with branching dendrites and an axon. sizeUm is the cell body. */
const neurons: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  g.strokeStyle = g.fillStyle = tint(f, '#2a2018');
  g.lineCap = 'round';
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number, k: number) => {
    const x1 = x + Math.cos(a) * len;
    const y1 = y + Math.sin(a) * len;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x1, y1);
    g.stroke();
    if (depth > 0) for (const turn of [-0.5, 0.45]) branch(x1, y1, a + turn + (noise(k, depth, seed) - 0.5) * 0.4, len * 0.7, w * 0.7, depth - 1, k * 2 + (turn > 0 ? 1 : 0));
  };
  forGrid(v, s * 9, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.4)) return;
    g.beginPath();
    g.arc(cx, cy, s / 2, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 5; k++) branch(cx, cy, (k / 5) * Math.PI * 2 + noise(k, i, seed), s * 1.2, s * 0.18, 3, k + 1);
    g.lineWidth = s * 0.1;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + s * 4, cy + s * 2.5);
    g.stroke();
  });
};

/** Small animals: a segmented body with stubby legs (tardigrade), a crowned trumpet (rotifer) or a fly. sizeUm is the length. */
const critter: Drawer = (g, f, v) => {
  const L = f.sizeUm;
  const seed = seedOf(f.id);
  forGrid(v, L * 2.2, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.35)) return;
    g.save();
    g.translate(cx, cy);
    g.rotate(noise(j, i, seed) * Math.PI * 2);
    g.fillStyle = tint(f, '#d8c0a0');
    g.strokeStyle = '#00000044';
    g.lineWidth = L * 0.015;
    g.beginPath();
    g.ellipse(0, 0, L * 0.5, L * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    for (let k = -1; k <= 1; k++) {
      g.moveTo(k * L * 0.18, -L * 0.18);
      g.lineTo(k * L * 0.18, L * 0.18);
    }
    g.stroke();
    g.fillStyle = tint(f, '#d8c0a0');
    for (let k = 0; k < 4; k++) {
      for (const side of [-1, 1]) {
        g.beginPath();
        g.ellipse(-L * 0.3 + k * L * 0.2, side * L * 0.22, L * 0.04, L * 0.07, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = '#ffffff55';
    g.beginPath();
    g.arc(L * 0.5, 0, L * 0.08, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
};

/** A tiling of hexagonal facets: compound eyes, cone cells, honeycomb walls. sizeUm is a facet. */
const facets: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  const r = s / Math.sqrt(3);
  forGrid(v, s, (i, j, cx, cy) => {
    g.fillStyle = tint(f, '#6a4a2a');
    g.strokeStyle = '#00000066';
    g.lineWidth = s * 0.06;
    g.beginPath();
    for (let k = 0; k < 6; k++) g.lineTo(cx + Math.cos((k * Math.PI) / 3 + Math.PI / 6) * r, cy + Math.sin((k * Math.PI) / 3 + Math.PI / 6) * r);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = `rgba(255,255,255,${0.2 + 0.3 * noise(i, j, seed)})`;
    g.beginPath();
    g.arc(cx - s * 0.12, cy - s * 0.12, s * 0.12, 0, Math.PI * 2);
    g.fill();
  }, s * 0.866, true);
};

/** Box-shaped plant cells in a brick pattern, walls only: cork, onion skin, moss leaves. sizeUm is the cell width. */
const boxes: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  const c = tint(f, '#a07850');
  g.strokeStyle = c;
  g.lineWidth = s * 0.1;
  forGrid(v, s * 2.2, (i, j, cx, cy) => {
    g.fillStyle = `${c}${noise(i, j, seed) > 0.5 ? '33' : '22'}`;
    g.beginPath();
    g.rect(cx - s * 1.1, cy - s * 0.5, s * 2.2, s);
    g.fill();
    g.stroke();
  }, s, true);
};

/** Polygonal grains that tile the plane: metal grains (a rainbow in a grain map), mica flakes, flat cheek cells. sizeUm is a grain. */
const mosaic: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  const corner = (i: number, j: number): [number, number] => [(i + (noise(i, j, seed) - 0.5) * 0.7) * s, (j + (noise(j, i, seed + 1) - 0.5) * 0.7) * s];
  forGrid(v, s, (i, j) => {
    const p = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)];
    g.fillStyle = f.tint ? `${f.tint}${['ff', 'dd', 'bb'][Math.floor(noise(i, j, seed + 2) * 3)]}` : `hsl(${Math.floor(noise(i, j, seed + 5) * 360)} 70% 55%)`;
    g.strokeStyle = '#00000055';
    g.lineWidth = s * 0.04;
    g.beginPath();
    p.forEach(([x, y]) => g.lineTo(x, y));
    g.closePath();
    g.fill();
    g.stroke();
  }, s, false);
};

/** Raspberry-like clusters of tiny spheres: framboids, soot, cathode particles, antibody clumps. sizeUm is the cluster. */
const cluster: Drawer = (g, f, v) => {
  const d = f.sizeUm;
  const seed = seedOf(f.id);
  const c = tint(f, '#d8b84a');
  forGrid(v, d * 2, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.3)) return;
    for (let k = 0; k < 18; k++) {
      const a = noise(k, i, seed) * Math.PI * 2;
      const r = Math.sqrt(noise(j, k, seed)) * d * 0.4;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const grad = g.createRadialGradient(x - d * 0.03, y - d * 0.03, 0, x, y, d * 0.12);
      grad.addColorStop(0, '#ffffffaa');
      grad.addColorStop(0.4, c);
      grad.addColorStop(1, c);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, d * 0.12, 0, Math.PI * 2);
      g.fill();
    }
  });
};

/** Pennate diatoms: boat-shaped glass valves with a central line and rows of pores. sizeUm is the length. */
const diatoms: Drawer = (g, f, v) => {
  const L = f.sizeUm;
  const seed = seedOf(f.id);
  forGrid(v, L * 1.5, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.3)) return;
    g.save();
    g.translate(cx, cy);
    g.rotate(noise(j, i, seed) * Math.PI);
    g.fillStyle = tint(f, '#c8b070');
    g.beginPath();
    g.ellipse(0, 0, L / 2, L * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff66';
    g.lineWidth = L * 0.006;
    g.beginPath();
    g.moveTo(-L * 0.45, 0);
    g.lineTo(L * 0.45, 0);
    for (let k = -18; k <= 18; k++) {
      const x = (k / 18) * L * 0.44;
      const h = Math.sqrt(1 - (x / (L / 2)) ** 2) * L * 0.11;
      g.moveTo(x, -h);
      g.lineTo(x, h);
    }
    g.stroke();
    g.restore();
  });
};

/** Pine pollen: a body with two air sacs. sizeUm is the whole grain. */
const saccate: Drawer = (g, f, v) => {
  const s = f.sizeUm;
  const seed = seedOf(f.id);
  const c = tint(f, '#f0d070');
  forGrid(v, s * 1.7, (i, j, cx, cy) => {
    if (skip(i, j, seed, 0.25)) return;
    g.save();
    g.translate(cx, cy);
    g.rotate(noise(j, i, seed) * Math.PI);
    g.fillStyle = `${c}aa`;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(side * s * 0.3, -s * 0.05, s * 0.24, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(0, s * 0.05, s * 0.3, s * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
};

/** Club-shaped cells on stalks: basidia with four spores, bell-shaped Vorticella. sizeUm is the length. */
const clubs: Drawer = (g, f, v) => {
  const L = f.sizeUm;
  const seed = seedOf(f.id);
  const c = tint(f, '#e8dcc8');
  forGrid(v, L * 0.8, (i, j, cx, cy) => {
    const a = -Math.PI / 2 + (noise(i, j, seed) - 0.5) * 0.6;
    const x1 = cx + Math.cos(a) * L * 0.6;
    const y1 = cy + Math.sin(a) * L * 0.6;
    g.strokeStyle = c;
    g.lineWidth = L * 0.06;
    g.beginPath();
    g.moveTo(cx, cy + L * 0.3);
    g.lineTo(x1, y1);
    g.stroke();
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(x1, y1, L * 0.14, L * 0.2, a + Math.PI / 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8a6a4a';
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(x1 + Math.cos(a - 0.9 + k * 0.6) * L * 0.25, y1 + Math.sin(a - 0.9 + k * 0.6) * L * 0.25, L * 0.05, 0, Math.PI * 2);
      g.fill();
    }
  });
};

// ---------------------------------------------------------------- diffraction patterns
// Drawn about the centre of the screen: v.pxPerUm is the radius (px) times the spacing (µm) of a reflection,
// so a reflection from spacing d sits r = pxPerUm / d from the centre, as Bragg's law puts it.

/** A single crystal's spots on a reciprocal lattice (square or hexagonal), fading outward. */
const spots: Drawer = (g, f, v) => {
  const r = v.pxPerUm / f.sizeUm;
  const hex = seedOf(f.id) % 2 === 0;
  const edge = Math.min(v.x1, v.y1);
  g.fillStyle = '#ffffff';
  for (let h = -12; h <= 12; h++) {
    for (let k = -12; k <= 12; k++) {
      if (!h && !k) continue;
      const x = hex ? (h + k * 0.5) * r : h * r;
      const y = hex ? k * r * 0.866 : k * r;
      const d = Math.hypot(x, y);
      if (d > edge) continue;
      const strength = Math.exp(-d / (edge * 0.6)) * (0.4 + 0.6 * noise(h + 20, k + 20, seedOf(f.id)));
      g.globalAlpha = Math.min(1, strength * 1.6);
      g.beginPath();
      g.arc(x, y, 2.2 + 2 * strength, 0, Math.PI * 2);
      g.fill();
    }
  }
};

/** A powder's rings: many crystals at all angles turn the spots into circles (fcc-like ratios). */
const rings: Drawer = (g, f, v) => {
  const r = v.pxPerUm / f.sizeUm;
  const edge = Math.min(v.x1, v.y1);
  g.strokeStyle = '#ffffff';
  [1, 1.155, 1.633, 1.915, 2.0].forEach((q, n) => {
    if (r * q > edge) return;
    g.lineWidth = n === 0 ? 3 : 2;
    g.globalAlpha = n === 0 ? 1 : 0.6 / (n * 0.6 + 0.6);
    g.beginPath();
    g.arc(0, 0, r * q, 0, Math.PI * 2);
    g.stroke();
  });
};

/** A helix's fibre pattern: the X of Photo 51 (layer lines spaced by the pitch) and the strong arcs of the stacking. */
const helix: Drawer = (g, f, v) => {
  const r = v.pxPerUm / f.sizeUm;
  const edge = Math.min(v.x1, v.y1);
  g.fillStyle = '#ffffff';
  if (f.sizeUm < 0.001) {
    // the stacking arcs, top and bottom: the base pairs, ten per turn, give the strong 10th layer line
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(0, 0, Math.min(r, edge * 0.95), s * Math.PI / 2 - 0.25, s * Math.PI / 2 + 0.25);
      g.stroke();
    }
    return;
  }
  for (let n = -9; n <= 9; n++) {
    if (!n) continue;
    const y = n * r;
    if (Math.abs(y) > edge) continue;
    for (const s of [-1, 1]) {
      const x = s * Math.abs(n) * r * 0.55; // the arms of the X
      g.globalAlpha = Math.max(0.15, 1 - Math.abs(n) * 0.09);
      g.beginPath();
      g.ellipse(x, y, 7, 3, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
};

export const PATTERNS = new Set<Drawing>(['spots', 'rings', 'helix']);

export const DRAWERS: Record<Drawing, Drawer> = {
  veins, cells, grains, pollen, rods, algae, hair, scales, virus, droplets, lattice,
  stomata, fibers, lines, ciliate, colony, beads, flagellate, cubes, prisms, needles, spots, rings, helix, glow, map, slice,
  honeycomb, atoms, dumbbells, discs, neurons, critter, facets, boxes, mosaic, cluster, diatoms, saccate, clubs,
};
