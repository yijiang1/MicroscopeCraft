// Tech tree overlay: every item once, on a grid that flows top (raw materials) to bottom (microscopes), one column
// lane per microscope. Wires run straight down to a track above the row they feed, then across and down into the
// part. Ready parts glow and craft on click. Press T or use the menu button. Owner: Person D.
import { lockedBy, nextGoalRecipe } from '../shared/plan';
import type { GameData, Recipe } from '../shared/schema';
import { canCraft, craft, type GameContext } from '../shared/state';
import { itemIcon } from './icons';

export interface TechTreeHandle {
  toggle(): void;
  dispose(): void;
}

export interface TreeLayout {
  cells: Map<string, { row: number; col: number; lane: number }>;
  lanes: { recipe: Recipe; from: number; to: number }[];
  rows: number;
}

/** Optional add-ons a microscope's steps ask for (built separately and never used up), that the recipes can make. */
export const addOnsOf = (recipe: Recipe | undefined, recipes: Recipe[]) =>
  [...new Set(recipe?.scope?.steps.flatMap((s) => (s.requires ? [s.requires] : [])) ?? [])].filter((id) => recipes.some((r) => r.output.itemId === id));

/**
 * Rows: raw materials 0, microscopes (and their add-ons) last, each part one row above the first thing that uses it.
 * Columns: each microscope starts a lane; an input goes in its parent's column if the cells down to its deepest use
 * are free, else the next free column to the right. The cells a wire runs through are reserved, so wires never cross tiles.
 */
export function layoutTree(data: Pick<GameData, 'recipes'>): TreeLayout {
  const producer = (id: string) => data.recipes.find((r) => r.output.itemId === id);
  const inputs = (id: string) => producer(id)?.inputs.filter((i) => !i.keep) ?? [];
  const consumers = (id: string) => data.recipes.filter((r) => r.inputs.some((i) => i.itemId === id && !i.keep));
  const depth = (id: string): number => Math.max(-1, ...inputs(id).map((i) => depth(i.itemId))) + 1;
  const scopes = data.recipes.filter((r) => r.scope).sort((a, b) => a.scope!.tier - b.scope!.tier);
  const addOns = new Set(scopes.flatMap((s) => addOnsOf(s, data.recipes)));
  const last = Math.max(...scopes.map((s) => depth(s.output.itemId)));
  const row = (id: string): number => {
    const p = producer(id);
    if (!p) return 0;
    if (p.scope || addOns.has(id)) return last;
    return Math.min(last, ...consumers(id).map((c) => row(c.output.itemId))) - 1;
  };
  /** The lowest row an item's wires reach: one above its deepest consumer. */
  const wireEnd = (id: string) => Math.max(row(id), ...consumers(id).map((c) => row(c.output.itemId) - 1));

  const cells: TreeLayout['cells'] = new Map();
  const lanes: TreeLayout['lanes'] = [];
  const used = new Set<string>();
  const free = (col: number, r0: number, r1: number) => {
    for (let r = r0; r <= r1; r++) if (used.has(`${r},${col}`)) return false;
    return true;
  };
  let next = 0;
  const put = (id: string, col: number, lane: number) => {
    const r = row(id);
    cells.set(id, { row: r, col, lane });
    for (let y = r; y <= wireEnd(id); y++) used.add(`${y},${col}`);
    next = Math.max(next, col + 1);
    for (const i of inputs(id)) {
      if (cells.has(i.itemId)) continue;
      let c = col;
      while (!free(c, row(i.itemId), wireEnd(i.itemId))) c++;
      put(i.itemId, c, lane);
    }
  };
  for (const s of scopes) {
    const from = next;
    put(s.output.itemId, from, lanes.length);
    for (const a of addOnsOf(s, data.recipes)) if (!cells.has(a)) put(a, next, lanes.length);
    lanes.push({ recipe: s, from, to: next - 1 });
  }
  return { cells, lanes, rows: last + 1 };
}

/** `big` for the full-screen overlay, `small` for the goal card. */
const SIZES = {
  big: { col: 84, tile: 46, label: 28, gap: 58, laneGap: 14, pad: 24, top: 44, icon: 30, font: 10, lanes: true },
  small: { col: 64, tile: 32, label: 22, gap: 28, laneGap: 0, pad: 0, top: 2, icon: 22, font: 9, lanes: false },
};

export interface DrawOpts {
  size: keyof typeof SIZES;
  /** Green border and green outgoing wires. */
  done(itemId: string): boolean;
  /** Corner badge text, e.g. how many you have. */
  badge(itemId: string): string | null;
  /** The item to point at right now (white outline). */
  hi?: string | null;
  goal?: Recipe | null;
  /** Click on a part that is not ready to craft. */
  onPick?(itemId: string): void;
}

const styled = (tag: string, css: string, text = '') => {
  const e = document.createElement(tag);
  e.style.cssText = css;
  e.textContent = text;
  return e;
};

/** Draws a laid-out tree: tiles, wires on shared tracks, ×N badges. Ready parts glow and craft on click. */
export function drawTree(ctx: GameContext, layout: TreeLayout, o: DrawOpts): HTMLElement {
  const { data, state } = ctx;
  const S = SIZES[o.size];
  const rowH = S.tile + S.label + S.gap;
  const x = (col: number, lane: number) => S.pad + col * S.col + lane * S.laneGap + S.col / 2;
  const y = (row: number) => S.top + row * rowH;
  const { cells, lanes, rows } = layout;
  const cols = lanes[lanes.length - 1]!.to + 1;
  const width = S.pad * 2 + cols * S.col + (lanes.length - 1) * S.laneGap;
  const height = y(rows - 1) + S.tile + S.label + 4;
  const board = styled('div', `position:relative;width:${width}px;height:${height}px;margin:8px auto 0;font-size:${S.font}px`);

  if (S.lanes) {
    for (const [i, l] of lanes.entries()) {
      const left = x(l.from, i) - S.col / 2;
      const w = (l.to - l.from + 1) * S.col;
      const built = (state.inventory[l.recipe.output.itemId] ?? 0) > 0;
      const isGoal = l.recipe === o.goal;
      board.append(
        styled('div', `position:absolute;left:${left}px;top:0;width:${w}px;height:${height}px;border-radius:10px;background:${isGoal ? '#ffd35a14' : '#0000001f'};${isGoal ? 'outline:1px solid #ffd35a55' : ''}`),
        styled('div', `position:absolute;left:${left}px;top:8px;width:${w}px;text-align:center;font-weight:700;font-size:12px;color:${isGoal ? '#ffd35a' : built ? '#9be07f' : '#c9b8a4'}`, `${built ? '✓ ' : isGoal ? '▶ ' : ''}${l.recipe.name}`),
      );
    }
  }

  // Wires: one horizontal track per source in the gap above each row it feeds, so shared inputs read as one trunk.
  const inputsOf = (id: string) => data.recipes.find((r) => r.output.itemId === id)?.inputs.filter((i) => cells.has(i.itemId)) ?? [];
  const tracks = new Map<number, string[]>();
  for (const [id, c] of cells) {
    const list = tracks.get(c.row) ?? [];
    for (const i of inputsOf(id)) if (!i.keep && !list.includes(i.itemId)) list.push(i.itemId);
    tracks.set(c.row, list);
  }
  for (const list of tracks.values()) list.sort((a, b) => cells.get(a)!.col - cells.get(b)!.col);
  const paths: string[] = [];
  const badges: HTMLElement[] = [];
  /** A dashed link between two tiles on one row: a microscope kept by the next one, or an add-on. */
  const dashed = (ax: number, bx: number, my: number, color: string, label: string) => {
    const [l, r] = ax < bx ? [ax, bx] : [bx, ax];
    paths.push(`<path d="M${l + S.tile / 2} ${my} H${r - S.tile / 2}" stroke="${color}" stroke-width="2" stroke-dasharray="5 4" fill="none"/>`);
    badges.push(styled('div', `position:absolute;left:${r - S.tile / 2 - 48}px;top:${my - 18}px;width:44px;text-align:right;color:#c9b8a4`, label)); // beside the right-hand tile, so several links don't overlap
  };
  for (const [id, c] of cells) {
    for (const a of addOnsOf(data.recipes.find((r) => r.output.itemId === id), data.recipes)) {
      const s = cells.get(a);
      if (s) dashed(x(s.col, s.lane), x(c.col, c.lane), y(c.row) + S.tile / 2, o.done(a) ? '#7ccf5a' : '#a08b74', 'add-on');
    }
    const ins = inputsOf(id);
    for (const [k, i] of ins.entries()) {
      const s = cells.get(i.itemId)!;
      const color = o.done(i.itemId) ? '#7ccf5a' : '#a08b74';
      const sx = x(s.col, s.lane);
      if (i.keep) {
        dashed(sx, x(c.col, c.lane), y(c.row) + S.tile / 2, color, 'kept');
        continue;
      }
      const tx = x(c.col, c.lane) + (k - (ins.length - 1) / 2) * (S.tile / 6);
      const list = tracks.get(c.row)!;
      const ty = y(c.row) - S.gap + 8 + list.indexOf(i.itemId) * Math.min(8, (S.gap - 20) / Math.max(1, list.length - 1));
      paths.push(`<path d="M${sx} ${y(s.row) + S.tile} V${ty} H${tx} V${y(c.row)}" stroke="${color}" stroke-width="2" fill="none" stroke-linejoin="round"/>`);
      if (i.count > 1) badges.push(styled('div', `position:absolute;left:${tx - 10}px;top:${y(c.row) - 15}px;width:20px;text-align:center;border-radius:6px;background:#b8433a;color:#fff;font:600 9px/13px system-ui`, `×${i.count}`));
    }
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
  svg.innerHTML = paths.join('');
  board.append(svg, ...badges);

  for (const [id, c] of cells) {
    const recipe = data.recipes.find((r) => r.output.itemId === id);
    const have = state.inventory[id] ?? 0;
    const locked = !recipe && !have && !!lockedBy(id, data, state.discoveries);
    const ready = !!recipe && canCraft(ctx, recipe.id);
    const done = o.done(id);
    const ring = [id === o.hi ? '0 0 0 2px #fff' : '', ready ? '0 0 10px #ffd35a' : ''].filter(Boolean).join(',');
    const t = styled(
      'div',
      `position:relative;width:${S.tile}px;height:${S.tile}px;margin:0 auto;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:6px;border:2px solid ${ready ? '#ffd35a' : done ? '#7ccf5a' : '#000'};background:linear-gradient(160deg,#4a4540,#1d1a17);${ring ? `box-shadow:${ring};` : ''}${ready || o.onPick ? 'cursor:pointer;' : ''}${locked ? 'filter:grayscale(.8) brightness(.7);' : ''}`,
    );
    t.append(itemIcon(id, data, S.icon));
    const b = o.badge(id);
    if (b) t.append(styled('span', 'position:absolute;right:-7px;bottom:-6px;padding:0 3px;border-radius:7px;background:#2f6b25;color:#fff;font:600 9px/13px system-ui;white-space:nowrap', b));
    if (locked) t.append(styled('span', 'position:absolute;right:-7px;top:-8px;font-size:11px', '🔒'));
    t.title = `${data.items[id]?.name ?? id}\n${
      recipe ? `${recipe.station}: ${recipe.inputs.map((i) => `${i.count} ${data.items[i.itemId]?.name ?? i.itemId}${i.keep ? ' (kept)' : ''}`).join(' + ')}` : (data.materials[id]?.where ?? '')
    }${ready ? '\nClick to craft' : ''}`;
    if (ready) t.onclick = () => craft(ctx, recipe.id);
    else if (o.onPick) t.onclick = () => o.onPick!(id);
    const node = styled('div', `position:absolute;left:${x(c.col, c.lane) - S.col / 2}px;top:${y(c.row)}px;width:${S.col}px`);
    node.append(t, styled('div', `margin:3px auto 0;width:max-content;max-width:${S.col - 4}px;padding:1px 3px;border-radius:4px;background:#000a;text-align:center;line-height:1.2`, data.items[id]?.name ?? id));
    board.append(node);
  }
  return board;
}

/** Layout of just one microscope's tree (a kept earlier microscope is left out). */
export function goalLayout(goal: Recipe, data: Pick<GameData, 'recipes'>): TreeLayout {
  const keep = new Set<Recipe>();
  const add = (id: string) => {
    const r = data.recipes.find((x) => x.output.itemId === id);
    if (!r || keep.has(r)) return;
    keep.add(r);
    r.inputs.filter((i) => !i.keep).forEach((i) => add(i.itemId));
  };
  add(goal.output.itemId);
  return layoutTree({ recipes: data.recipes.filter((r) => keep.has(r) && (!r.scope || r === goal)) });
}

export function mountTechTree(parent: HTMLElement, ctx: GameContext): TechTreeHandle {
  const overlay = styled(
    'div',
    'position:fixed;inset:0;z-index:20;display:none;overflow:auto;background:linear-gradient(180deg,#6b4428 0%,#3a2617 45%,#140d08 100%);color:#f3e6d6;padding:20px 32px;box-sizing:border-box;font:13px system-ui',
  );
  parent.appendChild(overlay);
  const layout = layoutTree(ctx.data);
  const consumers = (id: string) => ctx.data.recipes.filter((r) => r.inputs.some((i) => i.itemId === id && !i.keep));
  // "You have it, or something made from it."
  const owned = (id: string): boolean => (ctx.state.inventory[id] ?? 0) > 0 || consumers(id).some((r) => owned(r.output.itemId));

  const render = () => {
    const have = (id: string) => ctx.state.inventory[id] ?? 0;
    overlay.replaceChildren(
      styled('h2', 'margin:0 0 4px', 'Tech tree'),
      styled('div', 'color:#c9b8a4', 'Raw materials at the top flow down into parts and microscopes. Green: you have it or what it makes. Glowing parts are ready: click to craft. Hover a part for details. T or Esc closes.'),
      drawTree(ctx, layout, { size: 'big', done: owned, badge: (id) => (have(id) ? `${have(id)}` : null), goal: nextGoalRecipe(ctx.data, ctx.state) }),
    );
  };

  const shown = () => overlay.style.display === 'block';
  const toggle = () => {
    overlay.style.display = shown() ? 'none' : 'block';
    if (shown()) {
      document.exitPointerLock?.(); // free the mouse so the player can click and scroll
      render();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.toLowerCase() === 't') toggle();
    else if (e.key === 'Escape' && shown()) toggle();
  };
  addEventListener('keydown', onKey);
  const refresh = () => shown() && render();
  const offs = [ctx.bus.on('itemGathered', refresh), ctx.bus.on('itemCrafted', refresh), ctx.bus.on('discoveryUnlocked', refresh)];

  return {
    toggle,
    dispose() {
      removeEventListener('keydown', onKey);
      offs.forEach((off) => off());
      overlay.remove();
    },
  };
}
