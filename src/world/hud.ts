// The text laid over the 3D view: key hints, the crosshair and what E/F do there, the tracking arrows, what you carry,
// the compass, and the list you pick one sample from (a cabinet's slides, or the samples you carry, at an instrument).
import type { GameContext } from '../shared/state';

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

/** Called every frame; rewriting unchanged text anyway would re-lay out the page each frame. */
const setText = (e: HTMLElement, text: string) => {
  if (e.textContent !== text) e.textContent = text;
};

export function createHud(el: HTMLElement): Hud {
  const hint = div(`${CSS};left:12px;bottom:12px;max-width:calc(100% - 340px)`);
  hint.textContent = 'Click to look · WASD move · Shift run · Space jump · E gather/talk · F look · C craft · T tree · I inventory · J journal · Tab menu · M Microdex · V view';
  const prompt = div(`${CSS};left:calc(50% - 170px);width:340px;text-align:center;top:calc(50% + 18px)`);
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
      h.textContent = `${title} (press a number, Esc to cancel)`;
      box.append(h);
      ids.slice(0, 9).forEach((id, i) => {
        const s = ctx.data.samples[id];
        const found = s ? s.features.filter((f) => ctx.state.discoveries.includes(f.id)).length : 0;
        const total = s?.features.length ?? 0;
        const row = document.createElement('button');
        row.style.cssText = 'display:block;width:100%;margin:2px 0;text-align:left;cursor:pointer';
        row.textContent = `${i + 1}  ${s?.name ?? id}  ·  ${found}/${total} found${found === total ? ' ✓' : ''}`;
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
