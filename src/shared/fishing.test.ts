import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import { createGame, parseSave, toSave } from './state';
import { purchase } from './economy';
import { catchFish, FISH, prepareFish, reelHit } from './fishing';
describe('fishing collection', () => {
  it('gives the rod free once and requires it to catch fish', () => {
    const ctx=createGame(loadGameData());
    expect(catchFish(ctx,0)).toBeNull();
    expect(purchase(ctx,'fishing_rod','coins')).toBe(true);
    expect(ctx.state.economy.coins).toBe(0);
    expect(purchase(ctx,'fishing_rod','coins')).toBe(false);
    expect(catchFish(ctx,NaN)).toBeNull();
  });
  it('catches each species, prepares valid microscope samples and persists the collection', () => {
    const ctx=createGame(loadGameData());purchase(ctx,'fishing_rod','coins');
    FISH.forEach((fish,i)=>{
      expect(catchFish(ctx,(i+.1)/FISH.length)?.id).toBe(fish.id);
      expect(prepareFish(ctx,fish.id)).toBe(true);
      expect(ctx.state.carriedSamples).toContain(`fish_${fish.id}`);
      expect(prepareFish(ctx,fish.id)).toBe(false);
      expect(ctx.data.samples[`fish_${fish.id}`]!.features.length).toBeGreaterThan(1);
    });
    catchFish(ctx,0);
    const restored=createGame(ctx.data,undefined,parseSave(JSON.stringify(toSave(ctx.state)))!);
    expect(restored.state.economy.fish.perch).toBe(1);
    expect(restored.state.economy.owned).toContain('fishing_rod');
    expect(restored.state.carriedSamples).toContain('fish_perch');
  });
  it('only awards reels in the green zone',()=>{
    expect(reelHit(.5)).toBe(true);expect(reelHit(.2)).toBe(false);expect(reelHit(.9)).toBe(false);
  });
});
