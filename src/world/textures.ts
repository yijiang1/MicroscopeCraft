// Small procedural canvas textures: nothing is loaded from disk, so there are no asset licences to track.
import * as THREE from 'three';
import { mulberry32 } from './terrain';

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Broad leaf: green gradient with a pale midrib and branching side veins (u across, v along the leaf). */
export const leafTexture = () =>
  canvasTexture(256, 256, (g) => {
    const grad = g.createLinearGradient(0, 256, 0, 0);
    grad.addColorStop(0, '#2f6a28');
    grad.addColorStop(1, '#5b9c3a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#b9dd84';
    g.lineCap = 'round';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(128, 256);
    g.lineTo(128, 6);
    g.stroke();
    g.lineWidth = 2.2;
    for (let i = 0; i < 12; i++) {
      const y = 240 - i * 19;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(128, y);
        g.quadraticCurveTo(128 + s * 40, y - 12, 128 + s * 86 * (1 - i / 18), y - 40);
        g.stroke();
      }
    }
    g.lineWidth = 0.8;
    g.strokeStyle = '#8fc060';
    const rng = mulberry32(7);
    for (let i = 0; i < 160; i++) {
      const x = 40 + rng() * 176;
      const y = rng() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 22, y + (rng() - 0.5) * 22);
      g.stroke();
    }
  });

/** One butterfly wing pair half: orange with black veins, a dark rim and pale spots. u runs out from the body. */
export const wingTexture = () =>
  canvasTexture(512, 512, (g) => {
    const grad = g.createRadialGradient(0, 300, 20, 0, 300, 560);
    grad.addColorStop(0, '#f6a32b');
    grad.addColorStop(1, '#d8531b');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#1b120c';
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = -0.75 + i * 0.2;
      g.lineWidth = i % 3 === 0 ? 5 : 3;
      g.beginPath();
      g.moveTo(0, 300);
      g.quadraticCurveTo(200, 300 + Math.sin(a) * 120, 520, 300 + Math.sin(a) * 420);
      g.stroke();
    }
    g.lineWidth = 36;
    g.strokeRect(-20, -20, 552, 552);
    g.fillStyle = '#f5ecd0';
    const rng = mulberry32(3);
    for (let i = 0; i < 16; i++) {
      g.beginPath();
      g.arc(470 + rng() * 14, 20 + i * 30, 6 + rng() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });

/** Sunflower head: dark centre packed with seeds in golden-angle spirals. */
export const sunflowerTexture = () =>
  canvasTexture(256, 256, (g) => {
    g.fillStyle = '#3d2a14';
    g.fillRect(0, 0, 256, 256);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 520; i++) {
      const r = 6.4 * Math.sqrt(i);
      const a = i * golden;
      g.fillStyle = i % 2 ? '#6b4a22' : '#2a1b0b';
      g.beginPath();
      g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 3.2, 0, Math.PI * 2);
      g.fill();
    }
  });

/** Bark, for stumps. */
export const barkTexture = () =>
  canvasTexture(128, 128, (g) => {
    g.fillStyle = '#5a4128';
    g.fillRect(0, 0, 128, 128);
    const rng = mulberry32(11);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = rng() > 0.5 ? '#3d2b19' : '#7a5a38';
      g.lineWidth = 1 + rng() * 2;
      const x = rng() * 128;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + (rng() - 0.5) * 8, 128);
      g.stroke();
    }
  });

/** One window bay of a building facade (one floor high); repeat it across a wall. */
export const facadeTexture = (wall: string, glass: string) =>
  canvasTexture(64, 64, (g) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, 64, 64);
    const rng = mulberry32(5);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = rng() > 0.5 ? '#0000000f' : '#ffffff12';
      g.fillRect(rng() * 64, rng() * 64, 2 + rng() * 6, 1 + rng() * 2);
    }
    g.fillStyle = '#00000022';
    g.fillRect(16, 12, 32, 42);
    g.fillStyle = glass;
    g.fillRect(19, 15, 26, 36);
    g.fillStyle = '#ffffff30';
    g.fillRect(19, 15, 26, 3);
    g.fillRect(31, 15, 2, 36);
    g.fillStyle = '#00000030';
    g.fillRect(14, 52, 36, 3);
  });

/** White lettering on a dark sign. */
export const labelTexture = (text: string) =>
  canvasTexture(1024, 128, (g) => {
    g.fillStyle = '#26292d';
    g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#f4f1ea';
    g.font = '600 64px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 512, 68, 980);
  });

/** Falling water: pale vertical streaks on blue, scrolled downward every frame. */
export const waterfallTexture = () => {
  const t = canvasTexture(64, 256, (g) => {
    g.fillStyle = '#a9d2e6';
    g.fillRect(0, 0, 64, 256);
    const rng = mulberry32(13);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + rng() * 0.6})`;
      const [x, y, w, h] = [rng() * 64, rng() * 256, 1 + rng() * 4, 30 + rng() * 120];
      g.fillRect(x, y, w, h);
      g.fillRect(x, y - 256, w, h); // wrap, so the tiles join without a seam
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

/** Rows of book spines in muted colours, one shelf per row. */
export const booksTexture = () =>
  canvasTexture(256, 256, (g) => {
    const rng = mulberry32(11);
    const colors = ['#6b2e2a', '#2e4a6b', '#3d5a35', '#7a6236', '#4a3a5a', '#8a7a62', '#2a2a2a', '#a0522d'];
    g.fillStyle = '#4a3624';
    g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 4; row++) {
      for (let x = 2; x < 254; ) {
        const w = 5 + rng() * 9;
        g.fillStyle = colors[Math.floor(rng() * colors.length)]!;
        g.fillRect(x, row * 64 + 8 + rng() * 8, w - 1, 52);
        x += w;
      }
    }
  });

/** A sports field seen from above, u along its length: mown stripes and white lines; a gridiron gets end zones. */
export const fieldTexture = (gridiron: boolean) =>
  canvasTexture(1024, 512, (g) => {
    for (let i = 0; i < 20; i++) {
      g.fillStyle = i % 2 ? '#3f8a3a' : '#47963f';
      g.fillRect((i * 1024) / 20, 0, 1024 / 20 + 1, 512);
    }
    g.strokeStyle = '#f4f4ee';
    g.lineWidth = 6;
    g.strokeRect(8, 8, 1008, 496);
    if (gridiron) {
      g.fillStyle = '#9e2a2b';
      g.fillRect(11, 11, 96, 490);
      g.fillRect(917, 11, 96, 490);
      for (let i = 0; i <= 20; i++) {
        const x = 107 + (i * 810) / 20;
        g.lineWidth = i % 2 ? 2 : 5;
        g.beginPath();
        g.moveTo(x, 8);
        g.lineTo(x, 504);
        g.stroke();
      }
    } else {
      g.beginPath();
      g.moveTo(512, 8);
      g.lineTo(512, 504);
      g.stroke();
      g.beginPath();
      g.arc(512, 256, 70, 0, Math.PI * 2);
      g.stroke();
      g.strokeRect(8, 136, 120, 240);
      g.strokeRect(896, 136, 120, 240);
    }
  });

/** Diamond wire mesh on transparent ground, for the bridge's safety screens. */
export const meshTexture = () => {
  const t = canvasTexture(64, 64, (g) => {
    g.strokeStyle = '#3c4246';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 32);
    g.lineTo(32, 0);
    g.lineTo(64, 32);
    g.lineTo(32, 64);
    g.closePath();
    g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

/** The museum's paintings, painted procedurally after the originals (all long in the public domain). Widths in metres
 *  are the real canvases', so the gallery shows each at its true size. */
export const PAINTINGS = {
  starry_night: { w: 0.921, h: 0.737, label: 'After Vincent van Gogh · The Starry Night · 1889' },
  pearl_earring: { w: 0.39, h: 0.445, label: 'After Johannes Vermeer · Girl with a Pearl Earring · c. 1665' },
  great_wave: { w: 0.379, h: 0.257, label: 'After Katsushika Hokusai · The Great Wave off Kanagawa · c. 1831' },
  grande_jatte: { w: 3.08, h: 2.076, label: 'After Georges Seurat · A Sunday on La Grande Jatte · 1884–86' },
  night_watch: { w: 4.379, h: 3.631, label: 'After Rembrandt · The Night Watch · 1642' },
} as const;
export type PaintingId = keyof typeof PAINTINGS;

type Paint = (g: CanvasRenderingContext2D, W: number, H: number, rng: () => number) => void;

const blob = (g: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number, rot = 0) => {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
};

const PAINTERS: Record<PaintingId, Paint> = {
  // a swirling night sky over a village, a cypress flaring up on the left, eleven stars and a crescent moon
  starry_night(g, W, H, rng) {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1d2f78');
    sky.addColorStop(0.7, '#2f56a8');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.lineCap = 'round';
    for (let i = 0; i < 1400; i++) {
      // short strokes following a flow field, curling round the great swirl in the middle of the sky
      const x = rng() * W;
      const y = rng() * H * 0.72;
      const a = Math.atan2(y - H * 0.36, x - W * 0.5) + Math.PI / 2 + 0.6 * Math.sin(x * 0.02);
      g.strokeStyle = ['#5d86cc', '#8fb3e4', '#3b62b0', '#c8dcf0', '#2a4590'][Math.floor(rng() * 5)]!;
      g.lineWidth = 2 + rng() * 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      g.stroke();
    }
    const star = (x: number, y: number, r: number) => {
      const halo = g.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
      halo.addColorStop(0, '#fff6b0');
      halo.addColorStop(0.4, '#e8d060cc');
      halo.addColorStop(1, '#e8d06000');
      g.fillStyle = halo;
      g.beginPath();
      g.arc(x, y, r * 2.4, 0, Math.PI * 2);
      g.fill();
      blob(g, '#fff4a0', x, y, r * 0.6, r * 0.6);
    };
    for (const [x, y, r] of [[0.08, 0.12, 14], [0.27, 0.08, 12], [0.4, 0.2, 13], [0.55, 0.1, 11], [0.68, 0.18, 12], [0.6, 0.38, 10], [0.78, 0.33, 14], [0.92, 0.45, 12], [0.33, 0.45, 10], [0.15, 0.38, 9], [0.48, 0.5, 9]] as const) star(x * W, y * H, r);
    star(W * 0.88, H * 0.13, 24); // the moon, a crescent
    blob(g, '#2a4a98', W * 0.9, H * 0.11, 15, 15);
    g.fillStyle = '#24366e'; // the hills
    g.beginPath();
    g.moveTo(0, H * 0.72);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, H * (0.66 + 0.05 * Math.sin(x * 0.012) + 0.03 * Math.sin(x * 0.05)));
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();
    for (let i = 0; i < 26; i++) {
      // the village: little houses with lit windows, and a church spire
      const x = W * (0.3 + rng() * 0.65);
      const y = H * (0.8 + rng() * 0.14);
      g.fillStyle = '#1a2440';
      g.fillRect(x, y, 16, 12);
      g.fillStyle = '#f2d060';
      g.fillRect(x + 5, y + 4, 4, 4);
    }
    g.fillStyle = '#141c38';
    g.beginPath();
    g.moveTo(W * 0.55, H * 0.66);
    g.lineTo(W * 0.565, H * 0.84);
    g.lineTo(W * 0.535, H * 0.84);
    g.fill();
    g.fillStyle = '#1a2414'; // the cypress, a dark flame from the foot of the picture almost to its top
    g.beginPath();
    g.moveTo(W * 0.05, H);
    g.bezierCurveTo(W * 0.1, H * 0.6, W * 0.12, H * 0.3, W * 0.2, H * 0.05);
    g.bezierCurveTo(W * 0.22, H * 0.35, W * 0.3, H * 0.6, W * 0.3, H);
    g.fill();
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = rng() < 0.5 ? '#2e4a24' : '#4a3a20';
      g.lineWidth = 2;
      const x = W * (0.09 + rng() * 0.18);
      const y = H * (0.15 + rng() * 0.85);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 3, y - 14);
      g.stroke();
    }
  },
  // a girl in a blue and yellow turban looking over her shoulder, against a dark ground, a pearl at her ear
  pearl_earring(g, W, H) {
    g.fillStyle = '#121812';
    g.fillRect(0, 0, W, H);
    blob(g, '#8a6438', W * 0.45, H * 1.02, W * 0.48, H * 0.3); // ochre jacket
    blob(g, '#ece4d4', W * 0.52, H * 0.84, W * 0.16, H * 0.05, -0.2); // white collar
    blob(g, '#e6c8a4', W * 0.55, H * 0.55, W * 0.2, H * 0.24, 0.1); // face
    blob(g, '#d0a882', W * 0.4, H * 0.58, W * 0.08, H * 0.2, 0.1); // the shadowed side of the face
    blob(g, '#d8b860', W * 0.3, H * 0.42, W * 0.1, H * 0.3, 0.15); // the yellow cloth hanging from the turban
    blob(g, '#2b4fa8', W * 0.47, H * 0.27, W * 0.25, H * 0.15, -0.2); // ultramarine turban
    blob(g, '#4a74c8', W * 0.52, H * 0.22, W * 0.12, H * 0.05, -0.3);
    for (const [x, r] of [[0.6, 1], [0.76, 0.85]] as const) {
      blob(g, '#f4ece0', W * x, H * 0.5, 15 * r, 8 * r); // eyes: whites, dark irises, a catchlight
      blob(g, '#3a2418', W * x - 3, H * 0.5, 7 * r, 7 * r);
      blob(g, '#ffffff', W * x - 5, H * 0.495, 2, 2);
    }
    blob(g, '#c89a7a', W * 0.7, H * 0.6, 5, 14, 0.2); // the shadow of the nose
    blob(g, '#b04a40', W * 0.68, H * 0.68, 10, 6); // lips
    blob(g, '#8a8e94', W * 0.41, H * 0.72, 11, 13); // the pearl: a soft grey body, a reflection below and a bright highlight
    blob(g, '#e8ecf0', W * 0.41, H * 0.75, 7, 3);
    blob(g, '#ffffff', W * 0.4, H * 0.705, 4, 4);
  },
  // a great wave curling over three boats, its crest breaking into claws of foam, Mount Fuji small beneath it
  great_wave(g, W, H) {
    g.fillStyle = '#ece0c4';
    g.fillRect(0, 0, W, H);
    const top = g.createLinearGradient(0, 0, 0, H * 0.3);
    top.addColorStop(0, '#a8a090');
    top.addColorStop(1, '#ece0c400');
    g.fillStyle = top;
    g.fillRect(0, 0, W, H * 0.3);
    blob(g, '#6a7890', W * 0.66, H * 0.86, W * 0.08, H * 0.14); // Fuji, a small grey cone with a snow cap
    g.fillStyle = '#6a7890';
    g.beginPath();
    g.moveTo(W * 0.56, H * 0.92);
    g.lineTo(W * 0.66, H * 0.7);
    g.lineTo(W * 0.76, H * 0.92);
    g.fill();
    g.fillStyle = '#f4f0e6';
    g.beginPath();
    g.moveTo(W * 0.635, H * 0.76);
    g.lineTo(W * 0.66, H * 0.7);
    g.lineTo(W * 0.685, H * 0.76);
    g.fill();
    g.fillStyle = '#1c3c8c'; // the wave: Prussian blue
    g.beginPath();
    g.moveTo(0, H);
    g.bezierCurveTo(W * 0.05, H * 0.5, W * 0.25, H * 0.12, W * 0.5, H * 0.14);
    g.bezierCurveTo(W * 0.66, H * 0.15, W * 0.7, H * 0.3, W * 0.62, H * 0.4);
    g.bezierCurveTo(W * 0.55, H * 0.3, W * 0.45, H * 0.35, W * 0.4, H * 0.55);
    g.bezierCurveTo(W * 0.38, H * 0.75, W * 0.45, H * 0.9, W * 0.5, H);
    g.fill();
    g.strokeStyle = '#4f72b8';
    g.lineWidth = 3;
    for (let i = 1; i < 7; i++) {
      g.beginPath();
      g.moveTo(W * 0.04 * i, H);
      g.bezierCurveTo(W * (0.05 + 0.03 * i), H * 0.6, W * (0.2 + 0.03 * i), H * 0.25, W * 0.48, H * (0.16 + 0.02 * i));
      g.stroke();
    }
    g.fillStyle = '#f6f2e8'; // claws of foam along the crest
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      const x = W * (0.3 + 0.35 * t);
      const y = H * (0.16 + 0.24 * t * t);
      blob(g, '#f6f2e8', x, y, 6, 4, t * 2);
    }
    g.fillStyle = '#2a4a98'; // a smaller wave to the right, and the boats
    g.beginPath();
    g.moveTo(W * 0.45, H);
    g.quadraticCurveTo(W * 0.7, H * 0.6, W * 0.95, H);
    g.fill();
    for (const [x, y, r] of [[0.3, 0.72, -0.5], [0.62, 0.62, 0.3], [0.8, 0.85, 0.1]] as const) {
      blob(g, '#5a4a30', W * x, H * y + 2, W * 0.115, H * 0.03, r); // the boats, rowers crouched low
      blob(g, '#e8d8b0', W * x, H * y, W * 0.11, H * 0.022, r);
    }
    g.fillStyle = '#c8b890';
    g.fillRect(W * 0.03, H * 0.04, W * 0.16, H * 0.1); // the title cartouche
  },
  // a riverside park on a Sunday, strollers and loungers in the shade, all in small dabs of pure colour
  grande_jatte(g, W, H, rng) {
    g.fillStyle = '#4a7a3a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#9ab8c8';
    g.fillRect(0, 0, W, H * 0.12);
    g.fillStyle = '#3a7ab0'; // the river, on the left
    g.beginPath();
    g.moveTo(0, H * 0.12);
    g.lineTo(W * 0.35, H * 0.12);
    g.lineTo(W * 0.12, H * 0.62);
    g.lineTo(0, H * 0.7);
    g.fill();
    g.fillStyle = '#b8c858'; // sunlit lawn in the middle distance and the foreground
    g.fillRect(W * 0.2, H * 0.45, W * 0.8, H * 0.18);
    g.fillRect(0, H * 0.82, W, H * 0.18);
    for (let i = 0; i < 9; i++) blob(g, '#2a5428', W * (0.15 + i * 0.1), H * (0.08 + 0.05 * (i % 3)), W * 0.08, H * 0.1); // tree crowns
    for (let i = 0; i < 9; i++) g.fillRect(W * (0.15 + i * 0.1) - 3, H * 0.15, 6, H * 0.5);
    const figure = (x: number, y: number, s: number, color: string, bustle = false) => {
      blob(g, color, x, y - s * 0.55, s * 0.1, s * 0.1); // head
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x - s * 0.08, y - s * 0.45);
      g.lineTo(x + s * 0.08, y - s * 0.45);
      g.lineTo(x + s * (bustle ? 0.3 : 0.12), y);
      g.lineTo(x - s * 0.18, y);
      g.fill();
    };
    figure(W * 0.8, H * 0.95, H * 0.7, '#2a2030', true); // the couple on the right: a lady with a bustle and parasol, a man in a top hat
    blob(g, '#3a2a40', W * 0.78, H * 0.33, H * 0.09, H * 0.03);
    figure(W * 0.88, H * 0.95, H * 0.72, '#1e1c22');
    g.fillRect(W * 0.875, H * 0.5, H * 0.05, H * 0.06);
    figure(W * 0.55, H * 0.8, H * 0.4, '#e8e0d0');
    figure(W * 0.62, H * 0.62, H * 0.25, '#c84a3a');
    figure(W * 0.4, H * 0.62, H * 0.22, '#2a2a40', true);
    blob(g, '#3a3040', W * 0.2, H * 0.9, H * 0.12, H * 0.04); // loungers in the shade on the left
    blob(g, '#c86a30', W * 0.3, H * 0.92, H * 0.08, H * 0.04);
    // re-paint the whole picture in dabs: each dab takes the colour beneath it, nudged lighter or darker
    const img = g.getImageData(0, 0, W, H).data;
    for (let i = 0; i < 26000; i++) {
      const x = Math.floor(rng() * W);
      const y = Math.floor(rng() * H);
      const k = (y * W + x) * 4;
      const j = 0.75 + rng() * 0.55;
      g.fillStyle = `rgb(${Math.min(255, img[k]! * j)},${Math.min(255, img[k + 1]! * j)},${Math.min(255, img[k + 2]! * (0.8 + rng() * 0.5))})`;
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  },
  // a civic guard company stepping out of shadow: the captain in black with a red sash, his lieutenant in gold, pikes and a flag
  night_watch(g, W, H, rng) {
    const light = g.createRadialGradient(W * 0.5, H * 0.6, 20, W * 0.5, H * 0.6, W * 0.7);
    light.addColorStop(0, '#6a4a22');
    light.addColorStop(1, '#1a1208');
    g.fillStyle = light;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3a2a14';
    g.lineWidth = 14;
    g.beginPath();
    g.arc(W * 0.55, H * 0.45, W * 0.2, Math.PI, 0); // the arch of the gateway behind
    g.stroke();
    g.strokeStyle = '#2a1e10';
    g.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      // pikes and spears tilting across the crowd
      const x = W * (0.15 + rng() * 0.75);
      g.beginPath();
      g.moveTo(x, H * 0.9);
      g.lineTo(x + (rng() - 0.5) * W * 0.3, H * 0.1);
      g.stroke();
    }
    for (let i = 0; i < 22; i++) {
      // guardsmen in the gloom: dark bodies, pale faces
      const x = W * (0.08 + rng() * 0.85);
      const y = H * (0.45 + rng() * 0.2);
      blob(g, '#24180c', x, y + H * 0.15, W * 0.04, H * 0.15);
      blob(g, '#c89a70', x, y - H * 0.02, W * 0.015, H * 0.025);
    }
    blob(g, '#141010', W * 0.48, H * 0.72, W * 0.06, H * 0.2); // the captain in black
    blob(g, '#c83a2a', W * 0.48, H * 0.66, W * 0.05, H * 0.02, 0.5); // his red sash
    blob(g, '#e0c890', W * 0.48, H * 0.5, W * 0.018, H * 0.03);
    blob(g, '#d8b860', W * 0.58, H * 0.72, W * 0.05, H * 0.19); // the lieutenant in pale gold
    blob(g, '#e0c890', W * 0.58, H * 0.5, W * 0.017, H * 0.028);
    blob(g, '#f0d880', W * 0.36, H * 0.62, W * 0.025, H * 0.08); // the girl in gold, caught in the light
    g.fillStyle = '#3a4a6a'; // the flag
    g.fillRect(W * 0.62, H * 0.2, W * 0.08, H * 0.12);
  },
};

export const paintingTexture = (id: PaintingId) => {
  const { w, h } = PAINTINGS[id];
  const W = 512;
  return canvasTexture(W, Math.round((W * h) / w), (g) => PAINTERS[id](g, W, Math.round((W * h) / w), mulberry32(id.length * 97)));
};
