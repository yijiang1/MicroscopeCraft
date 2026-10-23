import { describe, expect, it } from 'vitest';
import { loadGameData } from './data';
import { walkingMultiplier, chooseCharacter, equip, npcSample, purchase, SPECIMEN_IDS, storeCatalog } from './economy';
import { createGame, parseSave, recordScore, toSave } from './state';
const game = () => createGame(loadGameData());
describe('campus economy', () => {
  it('switches character models without losing progress or purchases, starting Lena without eyewear', () => {
    const ctx = game(); recordScore(ctx, 'gram', 1);
    purchase(ctx, 'glasses', 'coins'); equip(ctx, 'glasses');
    const before = JSON.parse(JSON.stringify(ctx.state.economy));
    for (const model of ['explorer', 'lena'] as const) {
      chooseCharacter(ctx, model);
      expect(ctx.state.economy).toEqual({ ...before, character: model, eyewear: model === 'lena' ? 'none' : 'glasses' });
      const restored = createGame(ctx.data, undefined, parseSave(JSON.stringify(toSave(ctx.state))));
      expect(restored.state.economy.character).toBe(model);
      expect(restored.state.economy.eyewear).toBe(model === 'lena' ? 'none' : 'glasses');
      expect(restored.state.best.gram).toBe(1);
    }
    expect(equip(ctx, 'glasses')).toBe(true);
    chooseCharacter(ctx, 'lena');
    expect(ctx.state.economy.eyewear).toBe('glasses');
  });
  it('charges for hiking boots and boosts only equipped walking, including after reload', () => {
    const ctx = game();
    expect(equip(ctx, 'hiking_boots')).toBe(false);
    expect(walkingMultiplier(ctx.state.economy, false)).toBe(1);
    ctx.state.economy.coins = 99;
    expect(purchase(ctx, 'hiking_boots', 'coins')).toBe(false);
    ctx.state.economy.coins = 100;
    expect(purchase(ctx, 'hiking_boots', 'coins')).toBe(true);
    expect(ctx.state.economy.coins).toBe(0);
    expect(walkingMultiplier(ctx.state.economy, false)).toBe(1);
    expect(equip(ctx, 'hiking_boots')).toBe(true);
    expect(walkingMultiplier(ctx.state.economy, false)).toBe(1.5);
    expect(walkingMultiplier(ctx.state.economy, true)).toBe(1);
    const restored = createGame(ctx.data, undefined, parseSave(JSON.stringify(toSave(ctx.state))));
    expect(walkingMultiplier(restored.state.economy, false)).toBe(1.5);
    chooseCharacter(restored, 'explorer');
    expect(walkingMultiplier(restored.state.economy, false)).toBe(1.5);
    equip(restored, 'hiking_boots');
    expect(walkingMultiplier(restored.state.economy, false)).toBe(1);
    const old = JSON.parse(JSON.stringify(toSave(ctx.state))); delete old.economy.hikingBoots;
    expect(parseSave(JSON.stringify(old))!.economy.hikingBoots).toBe(false);
    const vouchers = game(); vouchers.state.economy.vouchers = 4;
    expect(purchase(vouchers, 'hiking_boots', 'vouchers')).toBe(true);
    expect(vouchers.state.economy.vouchers).toBe(0);
  });
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
  it('requires eyewear ownership, switches pairs, removes them and restores saved outfits', () => {
    const ctx = game();
    expect(equip(ctx, 'glasses')).toBe(false);
    expect(equip(ctx, 'sunglasses')).toBe(false);
    expect(ctx.state.economy.eyewear).toBe('none');
    ctx.state.economy.coins = 75;
    expect(purchase(ctx, 'glasses', 'coins')).toBe(true);
    expect(purchase(ctx, 'sunglasses', 'coins')).toBe(true);
    expect(ctx.state.economy.coins).toBe(0);
    equip(ctx, 'glasses'); expect(ctx.state.economy.eyewear).toBe('glasses');
    equip(ctx, 'sunglasses'); expect(ctx.state.economy.eyewear).toBe('sunglasses');
    const saved = parseSave(JSON.stringify(toSave(ctx.state)))!;
    expect(createGame(ctx.data, undefined, saved).state.economy.eyewear).toBe('sunglasses');
    equip(ctx, 'sunglasses'); expect(ctx.state.economy.eyewear).toBe('none');
    const old = JSON.parse(JSON.stringify(saved)); delete old.economy.eyewear;
    const migrated = parseSave(JSON.stringify(old))!;
    expect(migrated.economy.eyewear).toBe('none');
    expect(migrated.economy.owned).toContain('glasses');
  });
  it('charges 75 coins for binoculars and saves ownership', () => {
    const ctx=game();ctx.state.economy.coins=74;
    expect(purchase(ctx,'binoculars','coins')).toBe(false);
    ctx.state.economy.coins=75;
    expect(purchase(ctx,'binoculars','coins')).toBe(true);
    expect(ctx.state.economy.coins).toBe(0);
    expect(purchase(ctx,'binoculars','coins')).toBe(false);
    expect(parseSave(JSON.stringify(toSave(ctx.state)))!.economy.owned).toContain('binoculars');
  });
  it('sells the premium roadster once and preserves ownership in saves', () => {
    const ctx = game();
    expect(purchase(ctx, 'miata_na', 'coins')).toBe(false);
    ctx.state.economy.coins = 600;
    expect(purchase(ctx, 'miata_na', 'coins')).toBe(true);
    expect(ctx.state.economy.coins).toBe(0);
    expect(purchase(ctx, 'miata_na', 'coins')).toBe(false);
    const saved = parseSave(JSON.stringify(toSave(ctx.state)))!;
    expect(saved.economy.owned).toContain('miata_na');
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
