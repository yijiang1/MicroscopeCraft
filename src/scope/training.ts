import { ownedScopes, type GameContext } from '../shared/state';
import { beamTuning } from './beam';
import { openGram, openKoehler, openSoak } from './bench';
import { correctorTuning } from './corrector';
import { ptychoTuning } from './ptycho';
import { temTuning } from './tem';
import { tomoTuning } from './tomo';
/** The composition root injects these consoles into campus activity panels. Each needs the instrument (and stain)
 *  it trains on, as in the eyepiece, so a console never scores a skill the player has not unlocked yet. */
export function trainingGames(ctx: GameContext): Record<string, { locked: () => string | null; open: (host: HTMLElement, done: () => void) => () => void }> {
  const owns = (tier: number) => ownedScopes(ctx.state.inventory, ctx.data).some((r) => r.scope.tier === tier);
  const has = (item: string) => (ctx.state.inventory[item] ?? 0) > 0;
  const light = () => owns(2) || owns(3) || owns(4);
  const need = (ok: () => boolean, what: string) => () => (ok() ? null : `Needs ${what}`);
  return {
    koehler: { locked: need(() => owns(3), 'the high-quality microscope'), open: (host, done) => openKoehler(host, ctx, 3, done) },
    gram: { locked: need(() => light() && has('gram_kit'), 'a light microscope and a Gram stain kit'), open: (host, done) => openGram(host, ctx, done) },
    soak: { locked: need(() => light() && has('methylene_blue'), 'a light microscope and methylene blue'), open: (host, done) => openSoak(host, ctx, { name: 'Methylene blue', color: '#3366bb' }, done) },
    tem: { locked: need(() => owns(5), 'the electron microscope'), open: (host) => temTuning(host, ctx, 'crystal', () => {}).dispose },
    corrector: { locked: need(() => owns(6), 'the STEM'), open: (host) => correctorTuning(host, ctx, () => {}).dispose },
    ptycho: { locked: need(() => owns(6), 'the STEM'), open: (host) => ptychoTuning(host, ctx, 'crystal', () => {}).dispose },
    beam: { locked: need(() => owns(7), 'the CHESS beamline'), open: (host) => beamTuning(host, ctx, ctx.data.samples['sand_grain']!, () => {}).dispose },
    tomo: { locked: need(() => owns(7), 'the CHESS beamline'), open: (host) => tomoTuning(host, ctx, 'crystal', () => {}).dispose },
  };
}
