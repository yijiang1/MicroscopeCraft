// Small hand-drawn SVG icon for every item, tinted with the item's colour from the data. A new item without a
// shape here falls back to a plain rounded square. Owner: Person D.
import type { GameData } from '../shared/schema';

// 24×24 drawings; C is the item colour. Outlines and highlights are fixed so every colour reads on a dark panel.
const SHAPES: Record<string, string> = {
  pile: '<path d="M2 20 Q6 9 12 8 Q18 9 22 20Z" fill="C"/><g fill="#0004"><circle cx="9" cy="15" r="1"/><circle cx="14" cy="13" r="1"/><circle cx="16" cy="17" r="1"/><circle cx="11" cy="18" r="1"/></g>',
  crystal: '<path d="M7 21 L5 10 L9 4 L12 21Z M12 21 L11 7 L15 2 L18 9 L16 21Z" fill="C"/><path d="M9 4 L9 21 M15 2 L14 21" stroke="#fff8" fill="none"/>',
  ore: '<path d="M3 15 L6 7 L13 4 L20 8 L21 16 L14 21 L6 20Z" fill="#6a6f78"/><g fill="C"><circle cx="9" cy="11" r="2"/><circle cx="15" cy="9" r="1.5"/><circle cx="14" cy="16" r="2.2"/><circle cx="8" cy="17" r="1.2"/></g>',
  drop: '<path d="M12 2 Q20 13 18 16 A6 6 0 0 1 6 16 Q4 13 12 2Z" fill="C"/><path d="M9 14 Q9 17 11 18" stroke="#fff9" fill="none" stroke-width="1.5"/>',
  leaf: '<path d="M4 20 Q4 5 20 4 Q19 20 4 20Z" fill="C"/><path d="M4 20 L15 9" stroke="#0005" fill="none"/>',
  pane: '<path d="M4 7 L16 3 L20 17 L8 21Z" fill="C" opacity=".9"/><path d="M8 8 L13 6.5 M9 11 L11 10.4" stroke="#fff" fill="none" stroke-width="1.5"/>',
  lens: '<ellipse cx="12" cy="12" rx="5" ry="10" fill="C"/><path d="M10 6 Q9 12 10 18" stroke="#fffa" fill="none" stroke-width="1.5"/>',
  frame: '<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="C" stroke-width="4"/>',
  magnifier: '<circle cx="10" cy="10" r="6.5" fill="#bfe3ea88" stroke="C" stroke-width="3"/><path d="M15 15 L21 21" stroke="#8a5a44" stroke-width="4" stroke-linecap="round"/><path d="M7 8 Q8 6 10 6" stroke="#fff" fill="none"/>',
  tube: '<rect x="8" y="3" width="8" height="18" rx="1" fill="C"/><ellipse cx="12" cy="3.5" rx="4" ry="1.5" fill="#333"/><path d="M10 6 L10 19" stroke="#fff6" stroke-width="1.5"/>',
  knob: '<circle cx="12" cy="12" r="8" fill="C"/><g stroke="#0006" stroke-width="2"><path d="M12 4 V7 M12 17 V20 M4 12 H7 M17 12 H20 M6.3 6.3 L8.4 8.4 M15.6 15.6 L17.7 17.7 M6.3 17.7 L8.4 15.6 M15.6 8.4 L17.7 6.3"/></g><circle cx="12" cy="12" r="2.5" fill="#333"/>',
  bulb: '<circle cx="12" cy="10" r="7" fill="C"/><rect x="9" y="16" width="6" height="5" rx="1" fill="#c27d4a"/><path d="M10 10 L11 13 L13 13 L14 10" stroke="#c80" fill="none"/>',
  scope: '<path d="M10 3 L14 3 L15 13 L11 13Z" fill="C"/><path d="M8 13 H17 M12 13 V17" stroke="#555" stroke-width="2"/><path d="M15 7 Q20 10 18 19" stroke="#555" stroke-width="2.5" fill="none"/><rect x="5" y="19" width="15" height="3" rx="1" fill="#555"/><rect x="8" y="16" width="8" height="1.5" fill="#bfe3ea"/>',
  condenser: '<path d="M5 6 H19 L15 18 H9Z" fill="C"/><ellipse cx="12" cy="6" rx="7" ry="2" fill="#e6f4f8"/><path d="M9 18 H15" stroke="#c27d4a" stroke-width="3"/>',
  coil: '<path d="M4 20 L7 4 L10 20 L13 4 L16 20 L19 4" stroke="C" stroke-width="2.5" fill="none" stroke-linejoin="round"/>',
  ring: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="C" stroke-width="5"/><path d="M7 9 A6 6 0 0 1 12 5" stroke="#fff6" fill="none" stroke-width="1.5"/>',
  chamber: '<rect x="3" y="5" width="18" height="15" rx="3" fill="C"/><circle cx="12" cy="12.5" r="4" fill="#223" stroke="#d98a3d" stroke-width="1.5"/><path d="M5 3 V5 M19 3 V5" stroke="#555" stroke-width="2"/>',
  maglens: '<rect x="4" y="6" width="16" height="12" rx="3" fill="#6b6b6b"/><g stroke="C" stroke-width="2"><path d="M7 6 V18 M10 6 V18 M14 6 V18 M17 6 V18"/></g><rect x="10" y="10" width="4" height="4" fill="#223"/>',
  column: '<rect x="8" y="2" width="8" height="15" rx="2" fill="C"/><g stroke="#b8754a" stroke-width="2"><path d="M8 6 H16 M8 10 H16"/></g><rect x="4" y="17" width="16" height="5" rx="1" fill="#8a8f99"/><circle cx="12" cy="19.5" r="1.3" fill="#5bf"/>',
};

const SHAPE_OF: Record<string, string> = {
  beach_sand: 'pile', quartz_sand: 'crystal', iron_ore: 'ore', copper_ore: 'ore', tungsten_ore: 'ore',
  plant_oil: 'drop', immersion_oil: 'drop', resin: 'drop', leaf_fiber: 'leaf',
  glass: 'pane', quartz_glass: 'pane', lens: 'lens', precision_lens: 'lens', frame: 'frame', hand_lens: 'magnifier',
  tube: 'tube', focus_knob: 'knob', light_source: 'bulb', compound_microscope: 'scope', hq_microscope: 'scope',
  condenser: 'condenser', filament: 'coil', vacuum_seal: 'ring', vacuum_chamber: 'chamber', magnetic_lens: 'maglens',
  electron_microscope: 'column',
};

/** An inline SVG icon for the item, `size` px square. */
export function itemIcon(itemId: string, data: Pick<GameData, 'items'>, size = 16): HTMLElement {
  const color = data.items[itemId]?.color ?? '#888';
  const body = SHAPES[SHAPE_OF[itemId]!] ?? '<rect x="4" y="4" width="16" height="16" rx="4" fill="C"/>';
  const span = document.createElement('span');
  span.style.cssText = `display:inline-block;flex:none;width:${size}px;height:${size}px;vertical-align:middle`;
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke-linecap="round">${body.replaceAll('"C"', `"${color}"`)}</svg>`;
  return span;
}
