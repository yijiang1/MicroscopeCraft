import { carrySample, gather, type GameContext } from './state';
/** A saved real-time cycle: reopening the game does not restart spring. */
export const SEASON_MS = 10 * 60 * 1000;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = typeof SEASONS[number];
export function seasonAt(startedAt: number, now: number) {
  const elapsed = Math.max(0, now - startedAt);
  return { season: SEASONS[Math.floor(elapsed / SEASON_MS) % 4]!, remainingMs: SEASON_MS - elapsed % SEASON_MS };
}
export const snowAvailable = (startedAt: number, now: number) => seasonAt(startedAt, now).season === 'winter';

export function collectSnow(ctx: GameContext, now = Date.now()) {
  if (!snowAvailable(ctx.state.seasonStartedAt, now)) return false;
  carrySample(ctx, 'snow_crystal');
  gather(ctx, 'snow');
  return true;
}
