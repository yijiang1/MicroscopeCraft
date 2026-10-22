// One short WebAudio sound per game action, synthesised (no asset files). Owner: Person D.
// Browsers only allow audio after a user gesture, so the AudioContext starts on the first click or key.
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

/** Tuned-bell partials as [ratio to the prime, amplitude, seconds to die away at 220 Hz]. */
const BELL_PARTIALS = [[0.5, 0.5, 7], [1, 1, 5], [1.2, 0.45, 3.5], [1.5, 0.3, 3], [2, 0.55, 2.5], [2.5, 0.2, 1.6], [3, 0.12, 1.2]] as const;
/** The quarter-hour phrase on the smaller bells (G4 F4 E4 C4), rung once per quarter past the hour. */
const QUARTER_PHRASE = [392, 349.2, 329.6, 261.6];

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

  /** One stroke of a bell: the hum, prime, minor-third tierce, quint and nominal partials of a tuned bell, each dying away. */
  const bell = (freq: number, at: number, gain: number) => {
    if (muted || !ac || ac.state !== 'running') return;
    const t0 = ac.currentTime + at;
    for (const [ratio, amp, decay] of BELL_PARTIALS) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.frequency.value = freq * ratio;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain * amp, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * (220 / freq) ** 0.5);
      osc.connect(g).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + decay * (220 / freq) ** 0.5 + 0.05);
    }
  };
  // the clock tower: quieter the further away you are, but heard all over campus
  const offBell = ctx.bus.on('towerBell', ({ quarter, hour, distance }) => {
    const gain = 0.09 * (40 / (40 + distance));
    for (let n = 0; n < quarter; n++) QUARTER_PHRASE.forEach((f, i) => bell(f, (n * 5 + i) * 0.9, gain));
    if (!quarter) for (let i = 0; i < hour; i++) bell(196, i * 2.4, gain * 1.4);
  });

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
      offs.forEach((off) => off());
      offBell();
      removeEventListener('pointerdown', start);
      removeEventListener('keydown', start);
      void ac?.close();
    },
  };
}
