import type { GameContext } from '../shared/state';
import type { GameEvents } from '../shared/events';

/** Four-cylinder firing pulses, with simple automatic gear changes and throttle load. */
export function roadsterVoice(speed: number, throttle: number) {
  const velocity = Math.min(15, Math.abs(speed));
  const load = Math.min(1, Math.abs(throttle));
  const gear = speed < 0 ? 0 : velocity < 4 ? 0 : velocity < 8 ? 1 : velocity < 12 ? 2 : 3;
  const rpm = 850 + velocity * [650, 390, 280, 225][gear]! + load * 650;
  return { frequency: rpm / 30, engineGain: .035 + load * .045 + velocity * .0015, exhaustGain: .035 + load * .065, cutoff: 180 + rpm * .1 + load * 250 };
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
      const engine = ac.createOscillator(), bass = ac.createOscillator(), pulse = ac.createOscillator();
      const engineGain = ac.createGain(), bassGain = ac.createGain(), exhaustGain = ac.createGain(), pulseGain = ac.createGain(), bus = ac.createGain();
      const filter = ac.createBiquadFilter(), source = ac.createBufferSource();
      engine.type = 'sawtooth'; bass.type = 'triangle'; pulse.type = 'sine';
      filter.type = 'lowpass'; filter.Q.value = .7;
      if (!noise) {
        noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const samples = noise.getChannelData(0);
        for (let i=0;i<samples.length;i++) samples[i] = Math.random()*2-1;
      }
      source.buffer = noise; source.loop = true;
      engine.connect(engineGain).connect(filter); bass.connect(bassGain).connect(bus);
      source.connect(exhaustGain).connect(filter); pulse.connect(pulseGain).connect(exhaustGain.gain);
      filter.connect(bus).connect(master);
      bus.gain.setValueAtTime(0,ac.currentTime); bus.gain.linearRampToValueAtTime(.7,ac.currentTime+.18);
      engineGain.gain.value=0; bassGain.gain.value=.035; exhaustGain.gain.value=0; pulseGain.gain.value=.02;
      for (const node of [engine,bass,pulse,source]) node.start();
      const nodes = [engine,bass,pulse,source,engineGain,bassGain,exhaustGain,pulseGain,filter,bus];
      voice = {
        update(speed,throttle) {
          const p = roadsterVoice(speed,throttle), t=ac.currentTime;
          engine.frequency.setTargetAtTime(p.frequency,t,.09);
          bass.frequency.setTargetAtTime(p.frequency/2,t,.12);
          pulse.frequency.setTargetAtTime(p.frequency,t,.1);
          engineGain.gain.setTargetAtTime(p.engineGain,t,.08);
          exhaustGain.gain.setTargetAtTime(p.exhaustGain,t,.12);
          filter.frequency.setTargetAtTime(p.cutoff,t,.1);
        },
        stop() {
          const t=ac.currentTime;
          bus.gain.cancelScheduledValues(t);bus.gain.setTargetAtTime(0,t,.035);
          source.onended=()=>nodes.forEach(n=>n.disconnect());
          for (const node of [engine,bass,pulse,source]) node.stop(t+.2);
        },
      };
    }
    voice.update(latest.speed,latest.throttle);
  };
  const off = ctx.bus.on('roadsterSound', state => { latest=state; update(); });
  document.addEventListener('visibilitychange',update);
  return { dispose() { off();document.removeEventListener('visibilitychange',update);stop(); } };
}
