// Person C (client side). Today: offline replies built from the game's own data and the simulation's numbers.
//   - "where do I find X / how do I make X" → where-hints and recipes (shared/plan)
//   - "what next / what should I build"    → the current goal and the next step
//   - anything else, while looking at something → the nearest wall, via explainWall
// Later: fetch('/api/guide') with the same snapshot, falling back to this on failure.
import { actionText, currentAction, howToGet, itemsMentioned, nextGoalRecipe, planFor } from '../shared/plan';
import { stainedFeatures } from '../shared/sim/staining';
import { explainWall, nearestWall } from '../shared/sim/walls';
import type { GameContext } from '../shared/state';

const NEXT = /\b(next|what now|what should|what do i|how do i (build|start|begin)|goal|stuck|lost)\b/i;

export function mountGuide(ctx: GameContext): () => void {
  return ctx.bus.on('guideAsked', ({ question }) => {
    const { state, data } = ctx;
    const reply = (text: string) => ctx.bus.emit('guideReplied', { text });

    const items = itemsMentioned(question, data);
    if (items.length) {
      reply(items.slice(0, 2).map((id) => howToGet(id, data, state.discoveries)).filter(Boolean).join(' '));
      return;
    }

    if (NEXT.test(question)) {
      const goal = nextGoalRecipe(data, state);
      if (!goal) return reply('You have built every microscope. Explore, look at everything, and fill the Microdex.');
      const plan = planFor(goal, data, state.inventory, state.discoveries);
      const action = currentAction(plan);
      const where = action && action.kind !== 'craft' ? data.materials[action.raw.itemId]?.where : undefined;
      reply(`Next goal: ${goal.name}. ${action ? actionText(action, data) : 'Look around.'}.${where ? ` ${where}.` : ''}`);
      return;
    }

    const sample = state.currentSampleId ? data.samples[state.currentSampleId] : undefined;
    const wall = sample && nearestWall({ features: stainedFeatures(sample, state.stains) }, state.scope);
    reply(
      wall
        ? (explainWall(wall.f, state.scope, wall.v) ?? '')
        : sample
          ? 'You can see everything on this sample. Find something smaller, or look at another sample.'
          : 'Ask me "what next?" or "where do I find sand?". To look at something, aim at it and press F.',
    );
  });
}
