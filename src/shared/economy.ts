import { z } from 'zod';
import type { GameContext } from './state';
import type { GameData } from './schema';
export const EconomySchema = z.object({
  caughtFish: z.array(z.string()).default([]),
  fish: z.record(z.string(), z.number().int().nonnegative()).default({}),
  coins: z.number().int().nonnegative().default(0), vouchers: z.number().int().nonnegative().default(0),
  owned: z.array(z.string()).default([]), rewarded: z.record(z.string(), z.number().int().min(0).max(5)).default({}),
  character: z.enum(['lena', 'explorer']).default('lena'),
  hikingBoots: z.boolean().default(false),
  eyewear: z.enum(['none', 'glasses', 'sunglasses']).default('none'),
  shirt: z.enum(['blue', 'red', 'lab']).default('blue'), backpack: z.boolean().default(false), model: z.boolean().default(false),
});
export type Economy = z.infer<typeof EconomySchema>;
export interface StoreItem { id: string; name: string; price: number; kind: 'book' | 'shirt' | 'backpack' | 'model' | 'car' | 'tool' | 'eyewear' | 'boots'; text: string }
export function storeCatalog(data: GameData): StoreItem[] {
  return [
    { id: 'hiking_boots', name: 'Campus hiking boots', price: 100, kind: 'boots', text: 'Sturdy leather boots with grippy soles. Equip them for 50% faster walking. Running speed stays unchanged. Remove them in the fitting room to return to ordinary shoes.' },
    { id: 'glasses', name: 'Classic glasses', price: 30, kind: 'eyewear', text: 'Dark rectangular frames with clear lenses. Wear them in the fitting room; cosmetic only.' },
    { id: 'sunglasses', name: 'Campus sunglasses', price: 45, kind: 'eyewear', text: 'Gold frames with dark lenses for campus afternoons. Wear them in the fitting room; cosmetic only.' },
    { id: 'binoculars', name: 'Field binoculars · 2×–8×', price: 75, kind: 'tool', text: 'Survey the campus with adjustable 2×–8× magnification. After purchase, press = to raise or lower them and scroll to zoom. Kept in your field gear inventory.' },
    { id: 'fishing_rod', name: 'Field fishing rod', price: 0, kind: 'tool', text: 'Free field equipment. Approach a lake or stream, then select Fish to catch specimens. Convert your catches into microscope samples.' },
    { id: 'miata_na', name: 'Micro Roadster · Classic red', price: 600, kind: 'car', text: 'A red open-top roadster with pop-up headlights. Take a free 30-second campus test drive, or buy it for unlimited drives. WASD to drive; E returns to the store.' },
    { id: 'shirt_red', name: 'ScopeCraft red shirt', price: 40, kind: 'shirt', text: 'A red campus shirt. Equip it and press V to see your explorer.' },
    { id: 'shirt_lab', name: 'White lab outfit', price: 60, kind: 'shirt', text: 'A white jacket for your next microscopy session.' },
    { id: 'backpack', name: 'Field backpack', price: 50, kind: 'backpack', text: 'A red field bag with dark straps. Cosmetic; sample capacity stays at eight.' },
    { id: 'model', name: 'Miniature microscope', price: 80, kind: 'model', text: 'A wearable miniature microscope souvenir, displayed at your hip.' },
    { id: 'book_optics', name: 'Microscopy field guide', price: 25, kind: 'book', text: 'Resolution and magnification\n\nMagnification makes an image larger; resolution determines which nearby details can be distinguished. Shorter wavelengths and a larger numerical aperture can improve optical resolution.\n\nContrast and dose\n\nBright field, dark field and phase contrast reveal different specimen properties. Electron microscopy requires suitable preparation. More exposure can improve signal but can also damage the specimen.\n\nA good measurement\n\nCalibrate scale, focus carefully, compare controls and record the imaging conditions. A bright spot smaller than the resolution limit does not prove that its shape has been resolved.' },
    { id: 'book_scattering', name: 'Scattering lab notebook', price: 25, kind: 'book', text: 'From patterns to structure\n\nPeriodic structures scatter waves into characteristic directions. Diffraction spot positions carry information about lattice geometry. Intensities depend on the structure and on how waves interact with the specimen.\n\nElectron scattering\n\nMultiple scattering can matter in crystals. Comparing experimental images with simulations helps test structural explanations; specimen thickness, orientation and instrument conditions must be considered.\n\nThese are original in-game learning notes, not a reproduction of a published textbook.' },
    ...Object.values(data.npcs).map(n => ({ id: `bio_${n.id}`, name: `${n.name} — campus biography`, price: 20, kind: 'book' as const, text: `${n.name}\n${n.years}\n\n${n.bio}\n\nResearch interests\n${n.expertise}\n\nAn in-game souvenir profile.` })),
  ];
}
export const SPECIMEN_IDS = ['swimmer', 'rod', 'alga', 'salt', 'fiber', 'diatom', 'gold', 'virus', 'lattice', 'defect'];
const GAMES = new Set(['koehler', 'gram', 'soak', 'tem_align', 'ronchigram', 'ptycho', 'beam_tune', 'tomo_center', ...SPECIMEN_IDS.map(id => `invisible_${id}`)]);
/** Five one-time score milestones per game: 10 coins each, plus a voucher at 80%. */
export function rewardScore(ctx: GameContext, game: string, score: number) {
  if (!GAMES.has(game) || !Number.isFinite(score)) return;
  const economy = ctx.state.economy;
  const level = Math.floor(Math.min(1, Math.max(0, score)) * 5 + 1e-9);
  const previous = economy.rewarded[game] ?? 0;
  if (level <= previous) return;
  const coins = (level - previous) * 10, vouchers = previous < 4 && level >= 4 ? 1 : 0;
  economy.rewarded[game] = level; economy.coins += coins; economy.vouchers += vouchers;
  ctx.bus.emit('economyChanged', {});
  ctx.bus.emit('rewardEarned', { coins, vouchers });
}
export function purchase(ctx: GameContext, id: string, payment: 'coins' | 'vouchers') {
  const item = storeCatalog(ctx.data).find(i => i.id === id), e = ctx.state.economy;
  if (!item || e.owned.includes(id)) return false;
  const price = payment === 'coins' ? item.price : Math.ceil(item.price / 25);
  if (e[payment] < price) return false;
  e[payment] -= price; e.owned.push(id); ctx.bus.emit('economyChanged', {}); return true;
}
export function chooseCharacter(ctx: GameContext, character: Economy['character']) {
  if (character === 'lena' && ctx.state.economy.character !== 'lena') ctx.state.economy.eyewear = 'none';
  ctx.state.economy.character = character; ctx.bus.emit('economyChanged', {});
}
export function equip(ctx: GameContext, id: string) {
  const e = ctx.state.economy;
  if (id !== 'shirt_blue' && !e.owned.includes(id)) return false;
  if (id === 'shirt_blue') e.shirt = 'blue';
  else if (id === 'shirt_red') e.shirt = 'red';
  else if (id === 'shirt_lab') e.shirt = 'lab';
  else if (id === 'hiking_boots') e.hikingBoots = !e.hikingBoots;
  else if (id === 'backpack') e.backpack = !e.backpack;
  else if (id === 'glasses' || id === 'sunglasses') e.eyewear = e.eyewear === id ? 'none' : id;
  else if (id === 'model') e.model = !e.model;
  else return false;
  ctx.bus.emit('economyChanged', {}); return true;
}
/** Offer a sample tied to the scientist's requests; fall back to a portable optical specimen. */
export function npcSample(ctx: GameContext, npcId: string) {
  const npc = ctx.data.npcs[npcId];
  if (!npc) return undefined;
  const features = new Set(npc.quests.flatMap(q => q.needs.discovered ?? []));
  return Object.values(ctx.data.samples).find(s => s.features.some(f => features.has(f.id))) ?? ctx.data.samples['pond_water'] ?? Object.values(ctx.data.samples)[0];
}

/** Boots improve walking only; buying without equipping grants no speed boost. */
export const walkingMultiplier = (economy: Economy, running: boolean) =>
  !running && economy.hikingBoots && economy.owned.includes('hiking_boots') ? 1.5 : 1;
