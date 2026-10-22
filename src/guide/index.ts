// Person C (client side). Today: offline replies built from the game's own data and the simulation's numbers.
//   - "where do I find X / how do I make X" → where-hints and recipes (shared/plan)
//   - "what next / what should I build"    → the current goal and the next step
//   - anything else, while looking at something → advice from the actual rendered eyepiece
// Later: fetch('/api/guide') with the same snapshot, falling back to this on failure.
import { actionText, currentAction, howToGet, itemsMentioned, nextGoalRecipe, planFor } from '../shared/plan';
import type { GameEvents } from '../shared/events';
import type { GameContext } from '../shared/state';

const NEXT = /\b(next|what now|what should|what do i|how do i (build|start|begin)|goal|stuck|lost)\b/i;

export function mountGuide(ctx: GameContext): () => void {
  let view: GameEvents['eyepieceStatus'] | null = null;
  const offs = [
    ctx.bus.on('eyepieceStatus', (status) => { view = status; }),
    ctx.bus.on('closeEyepiece', () => { view = null; }),
  ];
  offs.push(ctx.bus.on('guideAsked', ({ question }) => {
    const { state, data } = ctx;
    const reply = (text: string) => ctx.bus.emit('guideReplied', { text });

    const items = itemsMentioned(question, data);
    if (items.length) {
      reply(items.slice(0, 2).map((id) => howToGet(id, data, state.discoveries)).filter(Boolean).join(' '));
      return;
    }

    if (NEXT.test(question)) {
      const goal = nextGoalRecipe(data, state);
      if (!goal) return reply('You have built every instrument. Fill the Microdex, and help the scientists around campus: the journal (J) lists what each one asks for.');
      const plan = planFor(goal, data, state.inventory, state.discoveries);
      const action = currentAction(plan);
      const where = action && action.kind !== 'craft' ? data.materials[action.raw.itemId]?.where : undefined;
      reply(`Next goal: ${goal.name}. ${action ? actionText(action, data) : 'Look around.'}.${where ? ` ${where}.` : ''}`);
      return;
    }

    const sample = state.currentSampleId ? data.samples[state.currentSampleId] : undefined;
    reply(
      sample
        ? view?.sampleId === sample.id ? view.text : 'Wait for the eyepiece image to appear, then ask me again.'
        : 'Ask me "what next?" or "where do I find sand?". To look at something, aim at it and press F.',
    );
  }));
  return () => offs.forEach((off) => off());
}
