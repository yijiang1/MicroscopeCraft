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
