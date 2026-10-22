// One short WebAudio sound per game action, synthesised (no asset files). Owner: Person D.
// Browsers only allow audio after a user gesture, so the AudioContext starts on the first click or key.
import type { GameEvents } from '../shared/events';
import type { GameContext } from '../shared/state';

interface Tone {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** End frequency for a glide. */
  to?: number;
  /** Seconds after the sound starts. */
  at?: number;
}

const arpeggio = (notes: number[], step = 0.09): Tone[] => notes.map((freq, i) => ({ freq, dur: 0.25, at: i * step }));

/** Event → tones. Keep each under half a second so rapid actions don't pile up. */
const SOUNDS = {
  itemGathered: [{ freq: 220, to: 330, dur: 0.09, type: 'triangle' }],
  itemCrafted: [{ freq: 440, dur: 0.1, type: 'square', gain: 0.07 }, { freq: 660, dur: 0.18, type: 'square', gain: 0.07, at: 0.1 }],
  discoveryUnlocked: arpeggio([523, 659, 784, 1047]),
  openEyepiece: [{ freq: 200, to: 800, dur: 0.3 }],
  closeEyepiece: [{ freq: 800, to: 200, dur: 0.25 }],
  zoomChanged: [{ freq: 600, dur: 0.04, type: 'square', gain: 0.05 }],
  tierChanged: arpeggio([392, 523, 659, 784, 1047], 0.12),
  guideReplied: [{ freq: 500, to: 560, dur: 0.12, gain: 0.1 }],
  achievementUnlocked: arpeggio([659, 784, 988, 1319], 0.08),
  questCompleted: arpeggio([523, 784, 1047], 0.1),
  talkTo: [{ freq: 380, to: 460, dur: 0.1, gain: 0.08 }],
  minigameScored: [{ freq: 700, dur: 0.08, type: 'triangle' }, { freq: 940, dur: 0.14, type: 'triangle', at: 0.09 }],
} satisfies Record<string, Tone[]>;

const MUTE_KEY = 'microscopecraft:muted';

export interface SoundHandle {
  /** Returns true when sound is now muted. */
  toggleMute(): boolean;
  muted(): boolean;
  dispose(): void;
}

export function mountSound(ctx: GameContext): SoundHandle {
  let ac: AudioContext | null = null;
  let muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    /* storage blocked: sound stays on */
  }

  const start = () => {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') void ac.resume();
  };
  addEventListener('pointerdown', start);
  addEventListener('keydown', start);

  const play = (tones: readonly Tone[]) => {
    if (muted || !ac || ac.state !== 'running') return;
    const t0 = ac.currentTime;
    for (const { freq, dur, type = 'sine', gain = 0.12, to, at = 0 } of tones) {
      const osc = ac.createOscillator();
      const amp = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0 + at);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + at + dur);
      amp.gain.setValueAtTime(gain, t0 + at);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur); // fade out: no click at the end
      osc.connect(amp).connect(ac.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + dur + 0.02);
    }
  };

  let noise: AudioBuffer | null = null;
  const step = ({ surface, running }: GameEvents['footstep']) => {
    if (muted || !ac || ac.state !== 'running') return;
    // Reuse a noise buffer; a filtered crunch accompanies a quiet low thud.
    if (!noise) {
      noise = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.2), ac.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const water = surface === 'water';
    const stone = surface === 'stone';
    const duration = water ? 0.16 : stone ? 0.065 : 0.1;
    const t = ac.currentTime;
    const source = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    source.buffer = noise;
    source.playbackRate.value = 0.9 + Math.random() * 0.2;
    filter.type = 'lowpass';
    filter.frequency.value = water ? 1900 : stone ? 1000 : 650;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime((running ? 0.13 : 0.09) * (water ? 1.3 : 1), t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(gain).connect(ac.destination);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(t);
    source.stop(t + duration + 0.01);
    play([{ freq: stone ? 150 : 95, to: 45, dur: 0.07, type: 'sine', gain: running ? 0.09 : 0.06 }]);
  };
  const offStep = ctx.bus.on('footstep', step);

  const offs = (Object.keys(SOUNDS) as (keyof typeof SOUNDS)[]).map((event) =>
    ctx.bus.on(event, () => play(SOUNDS[event])),
  );

  return {
    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        /* ignore */
      }
      return muted;
    },
    muted: () => muted,
    dispose() {
      offStep();
      offs.forEach((off) => off());
      removeEventListener('pointerdown', start);
      removeEventListener('keydown', start);
      void ac?.close();
    },
  };
}
