import { describe, expect, it } from 'vitest';
import { collectSnow, SEASON_MS, seasonAt, snowAvailable } from './seasons';
import { createGame, parseSave, toSave } from './state';
import { loadGameData } from './data';

describe('season cycle',()=>{
  it('changes exactly every six minutes and repeats after twenty-four',()=>{
    expect(SEASON_MS).toBe(360000);
    const start=1000000;
    expect(seasonAt(start,start-1)).toEqual({season:'spring',remainingMs:SEASON_MS});
    expect(seasonAt(start,start+SEASON_MS-1)).toEqual({season:'spring',remainingMs:1});
    for(const [index,season] of ['spring','summer','autumn','winter','spring'].entries()) {
      expect(seasonAt(start,start+index*SEASON_MS)).toEqual({season,remainingMs:SEASON_MS});
      expect(snowAvailable(start,start+index*SEASON_MS)).toBe(season==='winter');
    }
    expect(seasonAt(start,start+19*SEASON_MS+500).season).toBe('winter');
  });
  it('preserves the cycle on reload and upgrades old saves without losing inventory',()=>{
    const ctx=createGame(loadGameData());ctx.state.inventory.snow=2;
    ctx.state.seasonStartedAt=1000000;
    const saved=toSave(ctx.state);
    const restored=createGame(ctx.data,undefined,parseSave(JSON.stringify(saved)));
    expect(restored.state.seasonStartedAt).toBe(1000000);
    const old={...saved,seasonStartedAt:undefined};
    const parsed=parseSave(JSON.stringify(old))!;
    expect(parsed.seasonStartedAt).toBeGreaterThan(0);
    expect(parsed.inventory.snow).toBe(2);
  });
});

it('only collects snow in winter and keeps the slide after the season changes and reloads',()=>{
  const ctx=createGame(loadGameData());const start=ctx.state.seasonStartedAt;
  expect(collectSnow(ctx,start)).toBe(false);
  expect(ctx.state.inventory.snow).toBeUndefined();
  expect(collectSnow(ctx,start+3*SEASON_MS)).toBe(true);
  expect(ctx.state.inventory.snow).toBe(1);
  expect(ctx.state.carriedSamples).toContain('snow_crystal');
  expect(collectSnow(ctx,start+4*SEASON_MS)).toBe(false);
  const restored=createGame(ctx.data,undefined,parseSave(JSON.stringify(toSave(ctx.state))));
  expect(restored.state.carriedSamples).toContain('snow_crystal');
  expect(restored.state.inventory.snow).toBe(1);
});
