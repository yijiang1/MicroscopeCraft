// One short message at the top of the screen. A message never replaces a more important one that is still showing.
import { withKeys } from './keys';

export interface Toast {
  /** priority: 1 routine (gathered, crafted), 2 discovery, 3 milestone (new microscope). */
  notify(text: string, ms?: number, priority?: 1 | 2 | 3): void;
  dispose(): void;
}

export function createToast(): Toast {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:30;max-width:min(560px,90vw);padding:9px 16px;border-radius:8px;background:#1c3a1fee;color:#fff;font:15px system-ui;display:none;pointer-events:none;text-align:center';
  document.body.append(el);
  let until = 0;
  let level = 0;
  let timer = 0;
  return {
    notify(text, ms = 1600, priority = 1) {
      if (performance.now() < until && priority < level) return;
      withKeys(el, text);
      el.style.display = 'block';
      until = performance.now() + ms;
      level = priority;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.style.display = 'none';
        level = 0;
      }, ms);
    },
    dispose() {
      clearTimeout(timer);
      el.remove();
    },
  };
}
