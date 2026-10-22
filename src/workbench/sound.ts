// Workbench sounds, synthesised (no asset files): a grinding wheel while you hold the lens to it, a clunk when a part
// goes on, a tick from the focus knob, a chime when the slide comes into focus. Honours the game's mute setting.
const MUTE_KEY = 'microscopecraft:muted';

export interface BenchSound {
  grinding(on: boolean): void;
  place(): void;
  tick(): void;
  sharp(): void;
  crunch(): void;
  done(): void;
  dispose(): void;
}

export function createBenchSound(): BenchSound {
  let ac: AudioContext | null = null;
  let grind: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  let lastTick = 0;
  const muted = () => {
    try {
      return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  };
  const ctx = () => {
    if (muted()) return null;
    try {
      ac ??= new AudioContext();
      if (ac.state === 'suspended') void ac.resume();
      return ac;
    } catch {
      return null;
    }
  };
  const tone = (freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, to?: number, at = 0) => {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime + at;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  const noise = (dur: number, freq: number, gain: number) => {
    const a = ctx();
    if (!a) return null;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.4;
    const g = a.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(a.destination);
    return { src, gain: g, a };
  };
  return {
    grinding(on) {
      if (!on) {
        grind?.gain.gain.setTargetAtTime(0, grind.gain.context.currentTime, 0.04);
        const s = grind?.src;
        setTimeout(() => s?.stop(), 200);
        grind = null;
        return;
      }
      if (grind) return;
      const n = noise(2, 2600, 0.07);
      if (!n) return;
      n.src.loop = true;
      n.src.start();
      grind = { src: n.src, gain: n.gain };
    },
    place() {
      tone(150, 0.16, 'sine', 0.22, 70);
      const n = noise(0.05, 1800, 0.12);
      n?.src.start();
    },
    tick() {
      const now = performance.now();
      if (now - lastTick < 45) return;
      lastTick = now;
      tone(2400, 0.02, 'square', 0.02);
    },
    sharp() {
      tone(988, 0.18, 'triangle', 0.07);
      tone(1319, 0.26, 'triangle', 0.07, undefined, 0.09);
    },
    crunch() {
      const n = noise(0.18, 900, 0.3);
      n?.src.start();
      tone(90, 0.2, 'sawtooth', 0.06, 50);
    },
    done() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, undefined, i * 0.1));
    },
    dispose() {
      grind?.src.stop();
      grind = null;
      void ac?.close();
      ac = null;
    },
  };
}
