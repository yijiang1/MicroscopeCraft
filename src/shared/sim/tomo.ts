// Tomography centring (tier 7 mini-game): a slice is projected at many angles (the sinogram) and rebuilt by
// filtered back-projection. If the rotation axis is assumed in the wrong place, every edge smears into arcs.
import { clamp01, hash3 } from './fft';

/** Where the rotation axis really is for this sample, in detector pixels from the centre (each mounting differs). */
export const trueAxisPx = (sampleId: string) =>
  Math.round((hash3([...sampleId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7), 1, 23) - 0.5) * 16);

/** A test slice, n×n: a round body with a few dense and hollow blobs inside, different for every seed. */
export function phantom(n: number, seed: number): Float32Array {
  const img = new Float32Array(n * n);
  const blobs = Array.from({ length: 7 }, (_, b) => ({
    x: (hash3(b, 1, seed) - 0.5) * 0.9,
    y: (hash3(b, 2, seed) - 0.5) * 0.9,
    r: 0.06 + 0.14 * hash3(b, 3, seed),
    v: hash3(b, 4, seed) < 0.5 ? -0.6 : 0.8,
  }));
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * 2 - 1;
      const y = ((j + 0.5) / n) * 2 - 1;
      if (x * x / 0.72 + y * y / 0.5 > 1) continue;
      let v = 1;
      for (const b of blobs) if ((x - b.x) ** 2 + (y - b.y) ** 2 < b.r * b.r) v += b.v;
      img[j * n + i] = Math.max(0, v);
    }
  }
  return img;
}

/** Projections at `angles` angles over 180°, shifted by `axisPx` (the true axis offset on the detector). */
export function sinogram(img: Float32Array, n: number, angles: number, axisPx: number): Float32Array {
  const sino = new Float32Array(angles * n);
  const c = n / 2;
  for (let a = 0; a < angles; a++) {
    const th = (a / angles) * Math.PI;
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v = img[j * n + i]!;
        if (!v) continue;
        const t = (i + 0.5 - c) * cs + (j + 0.5 - c) * sn + c + axisPx; // detector coordinate
        const t0 = Math.floor(t - 0.5);
        const f = t - 0.5 - t0;
        if (t0 >= 0 && t0 < n) sino[a * n + t0] = sino[a * n + t0]! + v * (1 - f);
        if (t0 + 1 >= 0 && t0 + 1 < n) sino[a * n + t0 + 1] = sino[a * n + t0 + 1]! + v * f;
      }
    }
  }
  return sino;
}

/** Filtered back-projection (Ram-Lak filter in real space), assuming the axis sits at `axisPx`. */
export function reconstruct(sino: Float32Array, n: number, angles: number, axisPx: number): Float32Array {
  const filtered = new Float32Array(angles * n);
  const h = (k: number) => (k === 0 ? 0.25 : k % 2 ? -1 / (Math.PI * Math.PI * k * k) : 0);
  for (let a = 0; a < angles; a++) {
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += sino[a * n + k]! * h(i - k);
      filtered[a * n + i] = s;
    }
  }
  const out = new Float32Array(n * n);
  const c = n / 2;
  for (let a = 0; a < angles; a++) {
    const th = (a / angles) * Math.PI;
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5 - c) * cs + (j + 0.5 - c) * sn + c + axisPx - 0.5;
        const t0 = Math.floor(t);
        const f = t - t0;
        if (t0 < 0 || t0 + 1 >= n) continue;
        out[j * n + i] = out[j * n + i]! + filtered[a * n + t0]! * (1 - f) + filtered[a * n + t0 + 1]! * f;
      }
    }
  }
  for (let k = 0; k < n * n; k++) out[k] = (out[k]! * Math.PI) / angles;
  return out;
}

/** 0..1 for an axis guess `errPx` pixels off: half a pixel is perfect, four or more smear the slice. */
export const tomoScore = (errPx: number) => clamp01(1 - (Math.abs(errPx) - 0.5) / 3.5);
