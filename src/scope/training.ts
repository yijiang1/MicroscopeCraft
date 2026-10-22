import type { GameContext } from '../shared/state';
import { beamTuning } from './beam';
import { openGram, openKoehler, openSoak } from './bench';
import { correctorTuning } from './corrector';
import { ptychoTuning } from './ptycho';
import { temTuning } from './tem';
import { tomoTuning } from './tomo';
/** The composition root injects these consoles into campus activity panels. */
export function trainingGames(ctx: GameContext): Record<string, (host: HTMLElement, done: () => void) => () => void> {
  return {
    koehler: (host, done) => openKoehler(host, ctx, 3, done),
    gram: (host, done) => openGram(host, ctx, done),
    soak: (host, done) => openSoak(host, ctx, { name: 'Methylene blue', color: '#3366bb' }, done),
    tem: host => temTuning(host, ctx, 'crystal', () => {}).dispose,
    corrector: host => correctorTuning(host, ctx, () => {}).dispose,
    ptycho: host => ptychoTuning(host, ctx, 'crystal', () => {}).dispose,
    beam: host => beamTuning(host, ctx, ctx.data.samples['sand_grain']!, () => {}).dispose,
    tomo: host => tomoTuning(host, ctx, 'crystal', () => {}).dispose,
  };
}
