import { mountRoadsterAudio } from './roadster-audio';
import { CAMPUS_THEME, LAB_THEME, midiHz, TANNENBAUM, TOWER_MUSIC_INTERVAL } from './music';
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
  let master: GainNode | null = null;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    /* storage blocked: sound stays on */
  }

  const start = () => {
    if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ac.destination); }
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
      osc.connect(amp).connect(master!);
      osc.onended = () => { osc.disconnect(); amp.disconnect(); };
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
    source.connect(filter).connect(gain).connect(master!);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(t);
    source.stop(t + duration + 0.01);
    play([{ freq: stone ? 150 : 95, to: 45, dur: 0.07, type: 'sine', gain: running ? 0.09 : 0.06 }]);
  };
  const offStep = ctx.bus.on('footstep', step);
  const roadsterAudio = mountRoadsterAudio(ctx, () => ac, () => master);
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
      osc.connect(g).connect(master!);
      osc.onended = () => { osc.disconnect(); g.disconnect(); };
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

  let nextTower = 0;
  let nextNote = 0;
  let melodyIndex = -1;
  let nextAmbient = 0;
  let ambientIndex = 0;
  // Audio-clock scheduling avoids catching up missed music after a hidden tab or suspended context.
  const offMusic = ctx.bus.on('musicScene', ({ distance, indoors }) => {
    if (!ac || ac.state !== 'running' || document.hidden) return;
    const now = ac.currentTime;
    if (!nextTower) nextTower = now + TOWER_MUSIC_INTERVAL;
    if (now >= nextTower) { nextTower = now + TOWER_MUSIC_INTERVAL; melodyIndex = 0; nextNote = now; }
    if (melodyIndex >= 0 && now >= nextNote) {
      const note = TANNENBAUM[melodyIndex];
      if (note) {
        bell(midiHz(note[0]), 0, 0.055 * 35 / (35 + distance));
        nextNote = now + note[1] * 0.5; melodyIndex++;
      } else melodyIndex = -1;
    }
    if (now >= nextAmbient) {
      nextAmbient = now + 1.5;
      const theme = indoors ? LAB_THEME : CAMPUS_THEME;
      const note = theme[ambientIndex % theme.length]!;
      const gain = melodyIndex >= 0 ? 0.004 : 0.014;
      play([{ freq: midiHz(note), dur: 2.5, type: 'sine', gain },
        { freq: midiHz(note - 12), dur: 3, type: 'sine', gain: gain * 0.45 }]);
      ambientIndex++;
    }
  });

  const offs = (Object.keys(SOUNDS) as (keyof typeof SOUNDS)[]).map((event) =>
    ctx.bus.on(event, () => play(SOUNDS[event])),
  );

  return {
    toggleMute() {
      muted = !muted;
      if (ac && master) master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.025);
      try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        /* ignore */
      }
      return muted;
    },
    muted: () => muted,
    dispose() {
      roadsterAudio.dispose();
      offMusic();
      offStep();
      offs.forEach((off) => off());
      offBell();
      removeEventListener('pointerdown', start);
      removeEventListener('keydown', start);
      void ac?.close();
    },
  };
}
