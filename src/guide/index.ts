// Person C (client side). Today: canned replies keyed on the simulation's own reason code.
// Later: fetch('/api/guide') with the same snapshot, falling back to this on failure.
import { visibility, type VisibilityReason } from '../shared/sim/optics';
import type { GameContext } from '../shared/state';

const CANNED: Record<VisibilityReason, string> = {
  ok: 'You can see this clearly. Try a smaller sample next.',
  unresolved: "Your instrument can't separate details this small: the lens and the wave nature of light blur them together. Build a better lens.",
  'empty-magnification': 'You are magnifying past what the optics can resolve, so you only get a bigger blur. A better objective, not more zoom, is the fix.',
  'too-small-to-see': 'The detail is resolved but still too small for your eye. You need more magnification.',
  'low-contrast': 'The feature is big enough but nearly transparent. It needs more contrast, such as a stain.',
};

export function mountGuide(ctx: GameContext): () => void {
  return ctx.bus.on('guideAsked', () => {
    const sample = ctx.state.currentSampleId ? ctx.data.samples[ctx.state.currentSampleId] : undefined;
    const blocked = sample?.features.map((f) => visibility(f, ctx.state.scope)).find((v) => !v.visible);
    const text = blocked
      ? CANNED[blocked.reason]
      : sample
        ? CANNED.ok
        : 'Walk up to something, aim at it and press F to look through your instrument.';
    ctx.bus.emit('guideReplied', { text });
  });
}
