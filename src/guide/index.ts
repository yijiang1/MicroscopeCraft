// Person C (client side). Today: offline replies built from the simulation's own numbers via explainWall.
// Later: fetch('/api/guide') with the same snapshot, falling back to this on failure.
import { explainWall, nearestWall } from '../shared/sim/walls';
import type { GameContext } from '../shared/state';

export function mountGuide(ctx: GameContext): () => void {
  return ctx.bus.on('guideAsked', () => {
    const { state, data } = ctx;
    const sample = state.currentSampleId ? data.samples[state.currentSampleId] : undefined;
    const wall = sample && nearestWall(sample, state.scope);
    const text = wall
      ? (explainWall(wall.f, state.scope, wall.v) ?? '')
      : sample
        ? 'You can see everything on this sample. Find something smaller, or look at another sample.'
        : 'Walk up to something, aim at it and press F to look through your instrument.';
    ctx.bus.emit('guideReplied', { text });
  });
}
