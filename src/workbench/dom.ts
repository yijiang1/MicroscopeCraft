// Small DOM pieces for the workbench (dom.ts, not ui.ts: the lint rule reserves the name of the ui module): one style sheet, part icons, and element helpers.

const CSS = `
.wb{position:fixed;inset:0;z-index:27;display:none;background:#14171c;color:#e9e9e9;font:13px system-ui,sans-serif;line-height:1.35}
.wb *{box-sizing:border-box}
.wb-grid{display:grid;grid-template-columns:272px minmax(0,1fr) 344px;height:100%}
.wb-col{overflow:auto;padding:12px 12px 16px;background:#0e1115}
.wb-left{border-right:1px solid #ffffff14}
.wb-right{border-left:1px solid #ffffff14}
.wb-center{position:relative;min-width:0;min-height:0;overflow:hidden}
.wb-3d{position:absolute;inset:0}
.wb h2{font-size:18px;margin:0}
.wb-badge{display:inline-block;margin-top:6px;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600}
.wb-badge.build{background:#ffd35a22;color:#ffd35a;border:1px solid #ffd35a55}
.wb-badge.edit{background:#3d7fd633;color:#9cc4ff;border:1px solid #3d7fd677}
.wb-badge.practice{background:#ffffff12;color:#c8d0d8;border:1px solid #ffffff2a}
.wb-h{font-size:11px;letter-spacing:.07em;color:#8fa3b4;text-transform:uppercase;margin:14px 0 5px;font-weight:600}
.wb-muted{color:#9aabb8}
.wb-ok{color:#9be59b}
.wb-warn{color:#ffb27a}
.wb-gold{color:#ffd35a}
.wb-steps{margin:0;padding-left:20px}
.wb-steps li{margin:3px 0;color:#9aabb8}
.wb-steps li.done{color:#7fcf86}
.wb-steps li.done::marker{content:'✓  '}
.wb-steps li.now{color:#ffe08a;font-weight:600}
.wb-card{display:flex;gap:9px;align-items:center;padding:7px 8px;margin:5px 0;border-radius:9px;background:#ffffff08;border:1px solid #ffffff14}
.wb-card.next{border-color:#ffd35a;box-shadow:0 0 10px #ffd35a33}
.wb-card.sel{border-color:#6fb0ff}
.wb-card .ic{flex:none;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:#ffffff10;color:#dfe8ef}
.wb-card .ic svg{width:22px;height:22px}
.wb-card .tx{flex:1;min-width:0}
.wb-card .nm{font-weight:600}
.wb-card .sb{font-size:11px;color:#9aabb8}
.wb-btn{font:600 12px system-ui;padding:5px 10px;border-radius:7px;border:1px solid #ffffff26;background:#ffffff12;color:#e9e9e9;cursor:pointer;white-space:nowrap}
.wb-btn:hover:not(:disabled){background:#ffffff22}
.wb-btn:disabled{opacity:.45;cursor:default}
.wb-btn.primary{background:#ffd35a;border-color:#ffd35a;color:#222}
.wb-btn.primary:hover:not(:disabled){background:#ffe07f}
.wb-btn.big{font-size:14px;padding:9px 14px;width:100%}
.wb-btn.hold{user-select:none;touch-action:none}
.wb-btn.hold.on{background:#ff9d4a;border-color:#ff9d4a;color:#222}
.wb-row{display:flex;justify-content:space-between;gap:10px;padding:2px 0}
.wb-row b{font-variant-numeric:tabular-nums}
.wb-hint{position:absolute;left:50%;top:12px;transform:translateX(-50%);width:max-content;max-width:min(600px,calc(100% - 360px));padding:8px 14px;border-radius:10px;background:#000000c0;color:#ffe08a;font-weight:600;text-align:center;pointer-events:none}
.wb-float{position:absolute;right:12px;top:60px;width:min(330px,calc(100% - 24px));max-height:calc(100% - 200px);overflow:auto;padding:11px 12px;border-radius:12px;background:#0c0f13ee;border:1px solid #ffffff1f;box-shadow:0 8px 30px #0008;display:none}
.wb-float h3{margin:0 0 4px;font-size:15px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.wb-x{background:none;border:0;color:#9aabb8;font-size:18px;cursor:pointer;padding:0 4px}
.wb-tools{position:absolute;left:12px;top:12px;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.wb-tools .wb-chips{flex-direction:column;align-items:flex-start}
.wb-dock{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:min(640px,calc(100% - 24px));padding:9px 12px;border-radius:12px;background:#0c0f13e6;border:1px solid #ffffff1f;display:none}
.wb-slider{display:grid;grid-template-columns:72px minmax(0,1fr) 78px;gap:8px;align-items:center;margin:2px 0}
.wb-slider input{width:100%;accent-color:#ffd35a}
.wb-slider span:last-child{text-align:right;font-variant-numeric:tabular-nums;color:#cfe0ee}
.wb-chips{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0 8px}
.wb-chip{font:12px system-ui;padding:3px 10px;border-radius:999px;background:#ffffff12;border:1px solid #ffffff26;color:#e9e9e9;cursor:pointer}
.wb-chip.on{background:#3d7fd6;border-color:#3d7fd6;color:#fff;font-weight:600}
.wb-swatches{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0 8px}
.wb-swatch{width:24px;height:24px;border-radius:50%;border:2px solid #ffffff30;cursor:pointer;padding:0}
.wb-swatch.on{border-color:#fff;box-shadow:0 0 0 2px #3d7fd6}
.wb-text{width:100%;padding:6px 8px;border-radius:7px;border:1px solid #ffffff2a;background:#ffffff10;color:#fff;font:13px system-ui}
.wb-preview{position:relative}
.wb-preview canvas{display:block;width:100%;aspect-ratio:1;border-radius:50%;cursor:zoom-in;background:#000}
.wb-select{width:100%;margin-top:6px;padding:5px;border-radius:7px;background:#ffffff12;color:#eee;border:1px solid #ffffff2a;font:13px system-ui}
.wb-select option{background:#1b1f25}
.wb-list{margin:6px 0 0;padding:0;list-style:none;font-size:12px}
.wb-list li{margin:2px 0}
.wb-target{margin-top:8px;padding:8px 9px;border-radius:9px;background:#ffffff08;border:1px solid #ffffff14;font-size:12px}
.wb-note{margin-top:8px;padding:8px 9px;border-radius:9px;background:#ff9d4a18;border:1px solid #ff9d4a44;color:#ffcf9e;font-size:12px}
.wb-big{position:fixed;inset:0;z-index:28;display:none;align-items:center;justify-content:center;background:#000000ee}
.wb-big canvas{width:min(84vh,94vw);aspect-ratio:1;border-radius:50%;cursor:zoom-out}
.wb-done{position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;background:#000000a8}
.wb-done>div{width:min(460px,92%);padding:20px 22px;border-radius:16px;background:#101419;border:1px solid #ffd35a66;box-shadow:0 0 40px #ffd35a22}
.wb-done h3{margin:0 0 8px;font-size:22px;color:#ffd35a}
.wb-lensbar{position:relative;height:30px;margin:8px 2px 2px;border-radius:6px;background:linear-gradient(90deg,#24303a,#36495a)}
.wb-lensbar i{position:absolute;top:0;bottom:0;width:1px;background:#ffffff50}
.wb-lensbar em{position:absolute;top:31px;transform:translateX(-50%);font-size:10px;font-style:normal;color:#9aabb8;white-space:nowrap}
.wb-lensbar b{position:absolute;top:-3px;width:4px;height:36px;margin-left:-2px;border-radius:2px;background:#ffd35a;box-shadow:0 0 8px #ffd35a}
@media (max-width:1000px){
  .wb-hint{max-width:calc(100% - 24px);top:auto;bottom:150px}
  .wb-grid{display:block;overflow:auto;height:100%}
  .wb-center{height:62vh}
  .wb-col{overflow:visible;border:0!important}
}
`;

let injected = false;
export function injectStyle() {
  if (injected) return;
  injected = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
}

const svg = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONS: Record<string, string> = {
  base: svg('<path d="M3 19h18v2H3z"/><path d="M7 19c0-4 2-6 5-6s5 2 5 6"/>'),
  arm: svg('<path d="M8 21V12c0-5 3-8 8-8"/><path d="M14 9h4"/>'),
  stage: svg('<rect x="3" y="10" width="18" height="4" rx="1"/><circle cx="12" cy="12" r="1.2"/><path d="M6 14v5M18 14v5"/>'),
  lamp: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10.5c-.8.8-1 1.5-1 2.5H9c0-1-.2-1.7-1-2.5A6 6 0 0 1 12 3z"/>'),
  tube: svg('<rect x="8" y="2" width="8" height="20" rx="2"/><path d="M8 7h8M8 17h8"/>'),
  knobs: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  lens: svg('<path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/><path d="M2 12h20" stroke-dasharray="2 2"/>'),
  light: svg('<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="3.5"/>'),
};

/** Set an element's text, drawing every [Key] as a keycap, like the rest of the game (the kbd style is in index.html). */
export function keyed<E extends HTMLElement>(e: E, text: string): E {
  e.replaceChildren(...text.split(/\[([^\]\s]{1,6})\]/).map((s, i) => (i % 2 ? Object.assign(document.createElement('kbd'), { textContent: s }) : s)));
  return e;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) keyed(e, text);
  return e;
}

export function btn(text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = h('button', `wb-btn ${cls}`, text);
  b.type = 'button';
  b.onclick = onClick;
  return b;
}

export function icon(name: string): HTMLElement {
  const d = h('div', 'ic');
  d.innerHTML = ICONS[name] ?? ICONS.lens!;
  return d;
}

/** A labelled range slider with a readout. */
export function slider(label: string, min: number, max: number, step: number, onInput: (v: number) => void) {
  const row = h('label', 'wb-slider');
  const input = h('input');
  input.type = 'range';
  input.min = `${min}`;
  input.max = `${max}`;
  input.step = `${step}`;
  const out = h('span');
  input.addEventListener('input', () => onInput(+input.value));
  row.append(h('span', 'wb-muted', label), input, out);
  return {
    row,
    input,
    set(v: number, text: string) {
      if (document.activeElement !== input) input.value = `${v}`;
      out.textContent = text;
    },
  };
}

export const fmtMm = (mm: number) => (mm < 10 ? `${mm.toFixed(1)} mm` : `${Math.round(mm)} mm`);
export const fmtMag = (m: number) => `${m < 10 ? m.toFixed(1) : Math.round(m).toLocaleString('en-US')}×`;
