// In-place radix-2 FFT on n×n row-major complex arrays (n a power of two). Ported from the TEM explorer's console.
const plans = new Map<number, { rev: Uint32Array; cos: Float64Array; sin: Float64Array; tr: Float64Array; ti: Float64Array }>();

function plan(n: number) {
  let p = plans.get(n);
  if (p) return p;
  const bits = Math.log2(n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  p = { rev, cos, sin, tr: new Float64Array(n), ti: new Float64Array(n) };
  plans.set(n, p);
  return p;
}

function fft1(re: Float64Array, im: Float64Array, n: number, sign: number) {
  const { rev, cos, sin } = plan(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i]!;
    if (j > i) {
      let t = re[i]!;
      re[i] = re[j]!;
      re[j] = t;
      t = im[i]!;
      im[i] = im[j]!;
      im[j] = t;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = i + j;
        const b = a + half;
        const wr = cos[k]!;
        const wi = sign * sin[k]!;
        const xr = re[b]! * wr - im[b]! * wi;
        const xi = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
      }
    }
  }
}

/** 2D FFT in place: sign −1 forward, +1 inverse (the inverse is scaled by 1/n²). */
export function fft2(re: Float64Array, im: Float64Array, n: number, sign: -1 | 1 = -1) {
  const { tr, ti } = plan(n);
  for (let y = 0; y < n; y++) {
    const o = y * n;
    for (let x = 0; x < n; x++) {
      tr[x] = re[o + x]!;
      ti[x] = im[o + x]!;
    }
    fft1(tr, ti, n, sign);
    for (let x = 0; x < n; x++) {
      re[o + x] = tr[x]!;
      im[o + x] = ti[x]!;
    }
  }
  const s = sign > 0 ? 1 / (n * n) : 1;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      tr[y] = re[y * n + x]!;
      ti[y] = im[y * n + x]!;
    }
    fft1(tr, ti, n, sign);
    for (let y = 0; y < n; y++) {
      re[y * n + x] = tr[y]! * s;
      im[y * n + x] = ti[y]! * s;
    }
  }
}

/** Spatial frequency of FFT index i (cycles per sample), wrapping the upper half to negative. */
export const freq = (i: number, n: number) => (i < n / 2 ? i : i - n) / n;

/** Deterministic noise in [0,1) for (i, j, seed). */
export function hash3(i: number, j: number, seed: number) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
