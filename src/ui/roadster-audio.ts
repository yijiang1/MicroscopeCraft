import type { GameContext } from '../shared/state';
import type { GameEvents } from '../shared/events';

/** A low-revving V8-style voice with automatic shifts and throttle load. */
export function roadsterVoice(speed: number, throttle: number) {
  const velocity = Math.min(15, Math.abs(speed));
  const load = Math.min(1, Math.abs(throttle));
  const gear = speed < 0 ? 0 : velocity < 4 ? 0 : velocity < 8 ? 1 : velocity < 12 ? 2 : 3;
  const rpm = 720 + velocity * [400, 240, 175, 135][gear]! + load * 300;
  return { rpm, frequency: rpm / 15, engineGain: .13 + load * .09, exhaustGain: .035 + load * .055, cutoff: 240 + rpm * .045 + load * 100 };
}

/** One seamless 720-degree cycle of an uneven exhaust bank at 720 RPM.
 * Damped pressure pulses replace the buzzy sawtooth; the other bank fills alternate firings.
 */
export function exhaustCycle(sampleRate: number, bank: 0 | 1) {
  const length = Math.round(sampleRate / 6), cycle = length / sampleRate;
  const samples = new Float32Array(length);
  const firings = bank === 0 ? [0, 3, 5, 6] : [1, 2, 4, 7];
  for (let i = 0; i < length; i++) {
    for (const [j, firing] of firings.entries()) {
      const age = (i / sampleRate - firing * cycle / 8 + cycle) % cycle;
      samples[i] = samples[i]! + Math.sin(2 * Math.PI * 82 * age) * Math.exp(-age / .022) * [1, .82, .94, .75][j]!;
    }
  }
  const mean = samples.reduce((sum, n) => sum + n, 0) / length;
  const peak = Math.max(...samples.map(n => Math.abs(n - mean))) || 1;
  return samples.map(n => (n - mean) / peak * .8);
}

/** Procedural engine harmonics and a pulsing, filtered exhaust rumble; no audio downloads. */
export function mountRoadsterAudio(ctx: GameContext, audio: () => AudioContext | null, output: () => GainNode | null) {
  let voice: { update(speed:number, throttle:number):void; stop():void } | null = null;
  let latest: GameEvents['roadsterSound'] = { driving: false, speed: 0, throttle: 0 };
  let noise: AudioBuffer | null = null;
  const stop = () => { voice?.stop(); voice = null; };
  const update = () => {
    const ac = audio(), master = output();
    if (!latest.driving || document.hidden) { stop(); return; }
    if (!ac || !master || ac.state !== 'running') return;
    if (!voice) {
      const engine = ac.createBufferSource(), secondBank = ac.createBufferSource(), bass = ac.createOscillator(), pulse = ac.createOscillator();
      const engineGain = ac.createGain(), bassGain = ac.createGain(), exhaustGain = ac.createGain(), pulseGain = ac.createGain(), bus = ac.createGain();
      const filter = ac.createBiquadFilter(), source = ac.createBufferSource();
      for (const [index, bank] of [engine, secondBank].entries()) {
        const buffer = ac.createBuffer(1, Math.round(ac.sampleRate / 6), ac.sampleRate);
        buffer.copyToChannel(exhaustCycle(ac.sampleRate, index as 0 | 1), 0); bank.buffer = buffer; bank.loop = true;
      }
      bass.type = 'sine'; pulse.type = 'sine';
      filter.type = 'lowpass'; filter.Q.value = .7;
      if (!noise) {
        noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i=0;i<samples.length;i++) samples[i] = Math.random()*2-1;
      }
      source.buffer = noise; source.loop = true;
      engine.connect(engineGain).connect(filter); secondBank.connect(engineGain); bass.connect(bassGain).connect(bus);
      source.connect(exhaustGain).connect(filter); pulse.connect(pulseGain).connect(exhaustGain.gain);
      filter.connect(bus).connect(master);
      bus.gain.setValueAtTime(0,ac.currentTime); bus.gain.linearRampToValueAtTime(.7,ac.currentTime+.18);
      engineGain.gain.value=0; bassGain.gain.value=.075; exhaustGain.gain.value=0; pulseGain.gain.value=.018;
      const startAt = ac.currentTime;
      for (const node of [engine,secondBank,bass,pulse,source]) node.start(startAt);
      const nodes = [engine,secondBank,bass,pulse,source,engineGain,bassGain,exhaustGain,pulseGain,filter,bus];
      voice = {
        update(speed,throttle) {
          const p = roadsterVoice(speed,throttle), t=ac.currentTime;
          engine.playbackRate.setTargetAtTime(p.rpm/720,t,.16);
          secondBank.playbackRate.setTargetAtTime(p.rpm/720,t,.16);
          bass.frequency.setTargetAtTime(p.rpm/60,t,.16);
          pulse.frequency.setTargetAtTime(p.rpm/120,t,.16);
          engineGain.gain.setTargetAtTime(p.engineGain,t,.08);
          exhaustGain.gain.setTargetAtTime(p.exhaustGain,t,.12);
          filter.frequency.setTargetAtTime(p.cutoff,t,.1);
        },
        stop() {
          const t=ac.currentTime;
          bus.gain.cancelScheduledValues(t);bus.gain.setTargetAtTime(0,t,.035);
          source.onended=()=>nodes.forEach(n=>n.disconnect());
          for (const node of [engine,secondBank,bass,pulse,source]) node.stop(t+.2);
        },
      };
    }
    voice.update(latest.speed,latest.throttle);
  };
  const off = ctx.bus.on('roadsterSound', state => { latest=state; update(); });
  document.addEventListener('visibilitychange',update);
  return { dispose() { off();document.removeEventListener('visibilitychange',update);stop(); } };
}
