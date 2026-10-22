import { chooseCharacter, type Economy } from '../shared/economy';
import type { GameContext } from '../shared/state';
import { characterPortrait } from './character-portrait';

const MODELS: { id: Economy['character']; name: string; description: string }[] = [
  { id: 'explorer', name: 'Male · David', description: 'Grey hair, light-blue shirt and khaki trousers.' },
  { id: 'lena', name: 'Female · Lena', description: 'Long brown hair and a dark outfit.' },
];

export function mountCharacterSelector(ctx: GameContext) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'character-selector-title');
  dialog.className = 'character-selector';
  dialog.style.cssText = 'width:min(580px,92vw);max-height:88vh;overflow:auto;box-sizing:border-box;padding:24px;border:1px solid #789891;border-radius:18px;background:#102129;color:#edf3f0;font:14px system-ui;box-shadow:0 18px 80px #0008';
  const style = document.createElement('style');
  style.textContent = '.character-selector::backdrop{background:#061219bb}.character-selector button{font:inherit;cursor:pointer;color:inherit;border:1px solid #78989166;border-radius:12px;background:#ffffff08;padding:12px}.character-selector button:hover{background:#ffffff16}.character-selector button:focus-visible{outline:3px solid #ffd35a;outline-offset:3px}.character-selector button[aria-pressed="true"]{border-color:#ffd35a;background:#ffd35a14}.character-selector img{max-width:100%;height:auto;margin:auto}';
  const heading = document.createElement('h2'); heading.id = 'character-selector-title'; heading.textContent = 'Choose your character'; heading.style.margin = '0 0 8px';
  const help = document.createElement('p'); help.textContent = 'Switch at any time. Your progress, purchases and equipped accessories stay with you.'; help.style.cssText = 'color:#b8cbd0;line-height:1.5;margin:0 0 18px';
  const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px';
  const status = document.createElement('p'); status.setAttribute('aria-live', 'polite'); status.style.cssText = 'min-height:1.5em;color:#cbe7b8';
  const close = document.createElement('button'); close.textContent = 'Done'; close.style.cssText = 'display:block;margin-left:auto;padding:10px 24px;background:#31555b'; close.onclick = () => dialog.close();
  dialog.append(heading, help, grid, status, close); document.body.append(style, dialog);
  let choices: { button: HTMLButtonElement; label: HTMLElement; model: typeof MODELS[number] }[] = [];
  const sync = () => {
    for (const choice of choices) {
      const selected = choice.model.id === ctx.state.economy.character;
      choice.button.setAttribute('aria-pressed', String(selected));
      choice.label.textContent = selected ? '✓ Playing as this character' : 'Choose this character';
    }
    status.textContent = `Current character: ${MODELS.find(m => m.id === ctx.state.economy.character)!.name}`;
  };
  dialog.addEventListener('keydown', e => e.stopPropagation());
  dialog.addEventListener('close', () => ctx.bus.emit('campusActivityChanged', { open: false }));
  return {
    open() {
      if (dialog.open) return;
      grid.replaceChildren();
      choices = MODELS.map(model => {
        const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', model.name);
        const picture = characterPortrait(ctx, model.id, 170, 220);
        const title = document.createElement('h3'); title.textContent = model.name; title.style.cssText = 'font-size:16px;margin:8px 0';
        const description = document.createElement('p'); description.textContent = model.description; description.style.cssText = 'font-size:12px;line-height:1.4;min-height:2.8em;color:#b8cbd0';
        const label = document.createElement('span'); label.style.cssText = 'display:block;font-size:12px;color:#ffe08a';
        button.append(picture, title, description, label);
        button.onclick = () => { chooseCharacter(ctx, model.id); sync(); };
        grid.append(button); return { button, label, model };
      });
      sync(); document.exitPointerLock?.();
      ctx.bus.emit('campusActivityChanged', { open: true }); dialog.showModal();
    },
    dispose() { if (dialog.open) dialog.close(); dialog.remove(); style.remove(); },
  };
}
