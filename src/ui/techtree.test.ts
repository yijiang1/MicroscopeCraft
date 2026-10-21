import { describe, expect, it } from 'vitest';
import { loadGameData } from '../shared/data';
import { layoutTree } from './techtree';

describe('layoutTree', () => {
  const data = loadGameData();
  const { cells, rows } = layoutTree(data);

  it('gives every item its own cell, raw on top and microscopes on the bottom row', () => {
    const keys = [...cells.values()].map((c) => `${c.row},${c.col}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of data.recipes.filter((x) => x.scope)) expect(cells.get(r.output.itemId)?.row).toBe(rows - 1);
    for (const [id, c] of cells) if (data.materials[id]) expect(c.row).toBe(0);
  });

  it('feeds every part from rows above, with no tile in the way of a wire', () => {
    for (const [id, c] of cells) {
      for (const i of data.recipes.find((r) => r.output.itemId === id)?.inputs ?? []) {
        if (i.keep) continue;
        const s = cells.get(i.itemId)!;
        expect(s.row).toBeLessThan(c.row);
        const blocked = [...cells.values()].some((o) => o.col === s.col && o.row > s.row && o.row < c.row);
        expect(blocked, `${i.itemId} → ${id}`).toBe(false);
      }
    }
  });
});
