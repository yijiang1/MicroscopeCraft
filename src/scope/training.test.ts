import { describe, expect, it } from 'vitest';
import { loadGameData } from '../shared/data';
import { createGame } from '../shared/state';
import { trainingGames } from './training';

describe('campus training consoles', () => {
  it('stay locked until the player has the instrument they train on', () => {
    const ctx = createGame(loadGameData());
    const games = trainingGames(ctx);
    for (const g of Object.values(games)) expect(g.locked()).toBeTruthy();
    ctx.state.inventory.electron_microscope = 1;
    expect(games.tem!.locked()).toBeNull();
    expect(games.corrector!.locked()).toBeTruthy();
    ctx.state.inventory.compound_microscope = 1;
    expect(games.gram!.locked()).toBeTruthy();
    ctx.state.inventory.gram_kit = 1;
    expect(games.gram!.locked()).toBeNull();
  });
});
