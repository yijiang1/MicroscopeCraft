import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import { equip, npcSample, purchase, SPECIMEN_IDS, storeCatalog } from './economy';
import { createGame, parseSave, recordScore, toSave } from './state';
const game = () => createGame(loadGameData());
describe('campus economy', () => {
  it('pays new score milestones once and adds one voucher at 80 percent', () => {
    const ctx = game();
    recordScore(ctx, 'tem_align', 0.6);
    expect(ctx.state.economy.coins).toBe(30);
    recordScore(ctx, 'tem_align', 0.6); recordScore(ctx, 'tem_align', 0.1);
    expect(ctx.state.economy.coins).toBe(30);
    recordScore(ctx, 'tem_align', 1);
    expect(ctx.state.economy.coins).toBe(50); expect(ctx.state.economy.vouchers).toBe(1);
    recordScore(ctx, 'tem_align', 1); recordScore(ctx, 'unknown', 1); recordScore(ctx, 'tem_align', NaN);
    expect(ctx.state.economy.coins).toBe(50); expect(ctx.state.best.tem_align).toBe(1);
  });
  it('rejects unaffordable and duplicate purchases, and unowned equipment', () => {
    const ctx = game();
    expect(purchase(ctx, 'backpack', 'coins')).toBe(false);
    expect(equip(ctx, 'backpack')).toBe(false);
    recordScore(ctx, 'gram', 1);
    expect(purchase(ctx, 'backpack', 'coins')).toBe(true);
    expect(ctx.state.economy.coins).toBe(0);
    expect(purchase(ctx, 'backpack', 'coins')).toBe(false);
    expect(equip(ctx, 'backpack')).toBe(true); expect(ctx.state.economy.backpack).toBe(true);
    equip(ctx, 'backpack'); expect(ctx.state.economy.backpack).toBe(false);
    expect(purchase(ctx, 'book_optics', 'vouchers')).toBe(true);
    expect(ctx.state.economy.vouchers).toBe(0);
  });
  it('saves balances, ownership, clothing and reward claims across reloads', () => {
    const ctx = game(); recordScore(ctx, 'soak', 1); purchase(ctx, 'shirt_red', 'coins'); equip(ctx, 'shirt_red');
    const save = parseSave(JSON.stringify(toSave(ctx.state)))!;
    const restored = createGame(ctx.data, undefined, save);
    expect(restored.state.economy.shirt).toBe('red'); expect(restored.state.economy.coins).toBe(10);
    recordScore(restored, 'soak', 1); expect(restored.state.economy.coins).toBe(10);
    const old = toSave(ctx.state) as Partial<ReturnType<typeof toSave>>; delete old.economy;
    expect(parseSave(JSON.stringify(old))!.economy.coins).toBe(0);
  });
  it('each scientist offers a valid sample and a purchasable biography', () => {
    const ctx = game(); const catalog = storeCatalog(ctx.data);
    for (const n of Object.values(ctx.data.npcs)) {
      expect(npcSample(ctx, n.id)?.id).toBeTruthy();
      expect(catalog.some(item => item.id === `bio_${n.id}`)).toBe(true);
    }
    expect(npcSample(ctx, 'missing')).toBeUndefined();
  });
  it('pays separately for ten specimen assignments without paying for replay', () => {
    const ctx = game();
    for (const id of SPECIMEN_IDS) { recordScore(ctx, `invisible_${id}`, 1); recordScore(ctx, `invisible_${id}`, 1); }
    expect(ctx.state.economy.coins).toBe(500); expect(ctx.state.economy.vouchers).toBe(10);
  });
});
