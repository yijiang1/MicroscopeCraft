import { carrySample, type GameContext } from './state';
export const FISH = [
  { id: 'perch', name: 'Yellow perch', color: '#c4b750' },
  { id: 'bass', name: 'Largemouth bass', color: '#6c9363' },
  { id: 'salmon', name: 'Salmon', color: '#d58c86' },
  { id: 'sunfish', name: 'Sunfish', color: '#e3ad50' },
  { id: 'trout', name: 'Rainbow trout', color: '#a6b9c1' },
  { id: 'carp', name: 'Carp', color: '#b49c65' },
] as const;
export function catchFish(ctx: GameContext, roll: number) {
  if (!Number.isFinite(roll) || !ctx.state.economy.owned.includes('fishing_rod')) return null;
  const fish = FISH[Math.min(FISH.length - 1, Math.max(0, Math.floor(roll * FISH.length)))]!;
  const stock = ctx.state.economy.fish;
  stock[fish.id] = (stock[fish.id] ?? 0) + 1;
  ctx.bus.emit('economyChanged', {});
  return fish;
}
export function prepareFish(ctx: GameContext, id: string) {
  if (!FISH.some(f => f.id === id) || !((ctx.state.economy.fish[id] ?? 0) > 0)) return false;
  const sample = `fish_${id}`;
  if (!ctx.data.samples[sample]) return false;
  ctx.state.economy.fish[id]!--;
  carrySample(ctx,sample); ctx.bus.emit('economyChanged', {}); return true;
}
export const reelHit = (phase: number) => phase >= 0.35 && phase <= 0.65;
