// The text laid over the 3D view: key hints, the crosshair and what E/F do there, the tracking arrows, what you carry,
// the compass, and the list you pick one sample from (a cabinet's slides, or the samples you carry, at an instrument).
import type { GameContext } from '../shared/state';
import { missionSample } from '../shared/mysteryActions';
import { MYSTERY_SAMPLE_ID } from '../shared/mystery';

const CSS = 'position:fixed;color:#fff;text-shadow:0 0 3px #000;pointer-events:none';
const FLASH_MS = 3500;

export interface Hud {
  /** The line under the crosshair: what E and F do at the aimed thing (a flash message wins while it shows). */
  prompt(text: string): void;
  /** An orange message under the crosshair for a few seconds, e.g. why E did nothing. */
  flash(text: string): void;
  /** The yellow arrow to the material the goal needs. */
  track(text: string): void;
  /** The blue arrow to a tracked sample or scientist. */
  target(text: string): void;
  /** What you carry for the fixed instruments, and where to take it. */
  carry(text: string): void;
  compass(text: string): void;
}

const div = (css: string) => {
  const d = document.createElement('div');
  d.style.cssText = css;
  return d;
};

/** Called every frame; rewriting unchanged text anyway would re-lay out the page each frame. [E] draws a keycap
 * (same as withKeys in src/ui/keys.ts, which this module may not import). An empty text hides the element. */
const setText = (e: HTMLElement, text: string) => {
  if (e.dataset.text === text) return;
  e.dataset.text = text;
  e.hidden = !text;
  e.replaceChildren(...text.split(/\[([^\]\s]{1,6})\]/).map((s, i) => (i % 2 ? Object.assign(document.createElement('kbd'), { textContent: s }) : s)));
};

/** Moving and acting, then the panels: when both do not fit on one line, they break between the groups. */
const HINTS = [
  ['[Click] look', '[WASD] move', '[Shift] run', '[Space] jump', '[E] gather/talk', '[F] look closer', '[V] view'],
  ['[C] craft', '[B] workbench', '[T] tree', '[I] inventory', '[J] journal', '[M] Microdex', '[Tab] menu'],
];

export function createHud(el: HTMLElement): Hud {
  const hint = div(`${CSS};left:12px;bottom:12px;max-width:calc(100% - 340px);display:flex;flex-wrap:wrap;gap:4px 20px;padding:6px 12px;border-radius:10px;background:#0009;font-size:12px;line-height:1.6;color:#dde`);
  hint.append(...HINTS.map((group) => {
    const g = div('display:flex;flex-wrap:wrap;gap:4px 10px');
    g.append(...group.map((h) => {
      const chip = div('white-space:nowrap');
      setText(chip, h);
      return chip;
    }));
    return g;
  }));
  const prompt = div(`${CSS};left:50%;transform:translateX(-50%);max-width:min(420px,90vw);text-align:center;top:calc(50% + 22px);padding:5px 12px;border-radius:10px;background:#000a;font-size:15px;font-weight:600;line-height:1.7;text-shadow:none`);
  const track = div(`${CSS};left:50%;transform:translateX(-50%);top:14px;font-size:18px;font-weight:600;color:#ffd24a;white-space:nowrap`);
  const target = div(`${CSS};left:50%;transform:translateX(-50%);top:40px;font-size:16px;font-weight:600;color:#9fdcff;white-space:nowrap`);
  const carry = div(`${CSS};left:50%;transform:translateX(-50%);top:64px;font-size:15px;color:#bfe3ff;max-width:80vw;text-align:center`);
  const compass = div(`${CSS};left:12px;top:12px;font-size:13px`);
  const cross = div('position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px;background:#fff;mix-blend-mode:difference;pointer-events:none');
  el.append(hint, prompt, compass, track, target, carry, cross);

  let flashText = '';
  let flashUntil = 0;
  return {
    prompt(text) {
      const flashing = performance.now() < flashUntil;
      setText(prompt, flashing ? flashText : text);
      prompt.style.color = flashing ? '#ffb27a' : '#fff';
      prompt.style.background = flashing ? '#3a1a08cc' : '#000a';
    },
    flash(text) {
      flashText = text;
      flashUntil = performance.now() + FLASH_MS;
    },
    track: (text) => setText(track, text),
    target: (text) => setText(target, text),
    carry: (text) => setText(carry, text),
    compass: (text) => setText(compass, text),
  };
}

export interface Picker {
  isOpen(): boolean;
  /** List up to nine samples with how many of their discoveries you have; `then` gets the one picked. */
  open(title: string, ids: string[], then: (sampleId: string) => void): void;
  close(): void;
  /** A key press while open: 1-9 picks, Esc or F cancels. */
  key(e: KeyboardEvent): void;
}

export function createPicker(el: HTMLElement, ctx: GameContext): Picker {
  const box = div('position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:12;display:none;min-width:300px;max-width:90vw;padding:12px 16px;border-radius:12px;background:#000d;color:#eee;font:14px system-ui');
  el.append(box);
  let pick: { ids: string[]; then: (sampleId: string) => void } | null = null;
  const close = () => {
    pick = null;
    box.style.display = 'none';
  };
  const choose = (i: number) => {
    const p = pick;
    const id = p?.ids[i];
    close();
    if (p && id) p.then(id);
  };
  return {
    isOpen: () => !!pick,
    open(title, ids, then) {
      pick = { ids, then };
      box.replaceChildren();
      const h = div('font-weight:600;margin-bottom:6px');
      setText(h, `${title} · press [1]–[${Math.min(ids.length, 9)}] · [Esc] cancels`);
      box.append(h);
      ids.slice(0, 9).forEach((id, i) => {
        const s = missionSample(ctx, id);
        const found = s ? s.features.filter((f) => ctx.state.discoveries.includes(f.id)).length : 0;
        const total = s?.features.length ?? 0;
        const row = document.createElement('button');
        row.style.cssText = 'display:block;width:100%;margin:2px 0;text-align:left;cursor:pointer';
        setText(row, `[${i + 1}] ${s?.name ?? id}  ·  ${id === MYSTERY_SAMPLE_ID ? 'Bragg’s research mission' : `${found}/${total} found${found === total ? ' ✓' : ''}`}`);
        row.onclick = () => choose(i);
        box.append(row);
      });
      box.style.display = 'block';
    },
    close,
    key(e) {
      if (/^[1-9]$/.test(e.key)) choose(+e.key - 1);
      else if (e.key === 'Escape' || e.key.toLowerCase() === 'f') close();
    },
  };
}
