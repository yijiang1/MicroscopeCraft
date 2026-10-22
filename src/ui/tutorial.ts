// Tutorial: a welcome card with the idea of the game, then a coach panel (top-left) that walks a new player through
// one loop: move, gather, craft, build the hand lens, look, discover. Each step ticks off when the player does it,
// and steps already done in a saved game are skipped. Replay from the menu. Owner: Person D.
import { ownedScopes, setAdvanced, type GameContext } from '../shared/state';
import * as THREE from 'three';
import { chooseCharacter, type Economy } from '../shared/economy';
import { buildPlayer } from '../visuals/player';
import { itemIcon } from './icons';
import { withKeys } from './keys';

export const TUTORIAL_KEY = 'microscopecraft:tutorial';

export interface TutorialHandle {
  /** Start again from the welcome card. */
  replay(): void;
  dispose(): void;
}

interface Step {
  title: string;
  text: string;
  /** True once the saved state shows the step was done (so a loaded game skips it). */
  done?: (ctx: GameContext) => boolean;
}

const STEPS: Step[] = [
  { title: 'Look and move', text: 'Click the game to take the mouse. Move the mouse to look around; W A S D to walk, Shift to run, Space to jump.' },
  {
    title: 'Gather a material',
    text: 'The yellow arrow at the top of the screen points to what you need next. Walk up to it, put the white dot on it and press [E].',
    done: (ctx) => Object.values(ctx.state.inventory).some((n) => n > 0),
  },
  {
    title: 'Craft a part',
    text: 'The NEXT CRAFT box on the right shows the recipe. When it lights up gold, press [C]: raw materials become parts.',
    done: (ctx) => Object.keys(ctx.state.inventory).some((id) => !ctx.data.materials[id]),
  },
  {
    title: 'Build your first microscope',
    text: 'Keep gathering and crafting until the Hand lens is done. The tree on the right shows what is left; T opens the full tech tree.',
    done: (ctx) => ownedScopes(ctx.state.inventory, ctx.data).length > 0,
  },
  { title: 'Look closer', text: 'Aim at something (a leaf, a rock, the sand) and press [F] to look at it through your microscope.', done: (ctx) => ctx.state.discoveries.length > 0 },
  {
    title: 'Focus and discover',
    text: 'Drag Focus until the picture is sharp. Anything big enough for your microscope to resolve becomes a discovery in the Microdex [M]. [Esc] goes back.',
    done: (ctx) => ctx.state.discoveries.length > 0,
  },
  {
    title: 'You know the loop',
    text: 'Each new microscope resolves smaller things. Light microscopes stop at about 0.2 µm, roughly half the wavelength of light; electrons go down to atoms. Scientists around campus ask for help [J],.',
  },
];

const div = (css = '', text = '') => {
  const d = document.createElement('div');
  d.style.cssText = css;
  withKeys(d, text);
  return d;
};
const button = (text: string, primary: boolean, onclick: () => void) => {
  const b = document.createElement('button');
  b.textContent = text;
  b.style.cssText = `padding:6px 14px;border-radius:6px;border:0;font-weight:700;cursor:pointer;${primary ? 'background:#ffd35a;color:#222' : 'background:#ffffff1a;color:#ddd'}`;
  b.onclick = onclick;
  return b;
};

/** A still picture of a character, rendered once with the in-game model. */
const portrait = (ctx: GameContext, character: Economy['character']) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(96, 128);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff7e4', '#547277', 2.6));
  const light = new THREE.DirectionalLight('#ffffff', 3); light.position.set(-3, 5, 4); scene.add(light);
  const model = buildPlayer(); model.equip({ ...ctx.state.economy, character }); model.root.rotation.y = Math.PI + 0.3; scene.add(model.root);
  const camera = new THREE.PerspectiveCamera(35, 96 / 128, 0.1, 20); camera.position.set(0, 1.1, 4.2); camera.lookAt(0, 1, 0);
  renderer.render(scene, camera);
  const img = document.createElement('img');
  img.src = renderer.domElement.toDataURL(); img.width = 96; img.height = 128; img.alt = ''; img.style.display = 'block';
  model.dispose(); renderer.dispose(); renderer.forceContextLoss(); // free the GL context now, not at GC
  return img;
};

const read = () => {
  try {
    return localStorage.getItem(TUTORIAL_KEY);
  } catch {
    return null;
  }
};
const write = (v: string) => {
  try {
    localStorage.setItem(TUTORIAL_KEY, v);
  } catch {
    /* storage blocked: the tutorial just shows again next time */
  }
};

export function mountTutorial(ctx: GameContext): TutorialHandle {
  const welcome = div('position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:#000a;font:14px system-ui;color:#eee');
  const coach = div('position:fixed;left:12px;top:36px;z-index:26;display:none;width:min(300px,calc(100vw - 24px));box-sizing:border-box;padding:10px 12px;border-radius:10px;background:#0f1418ee;border:1px solid #ffd35a66;color:#eee;font:13px system-ui;box-shadow:0 4px 20px #0008');
  document.body.append(welcome, coach);
  let step = -1; // -1: not running

  const finish = () => {
    step = -1;
    coach.style.display = 'none';
    write('done');
  };

  const go = (i: number) => {
    // skip everything the saved game shows as done already
    const last = STEPS.reduce((k, s, j) => (s.done?.(ctx) ? j : k), -1);
    step = Math.max(i, last + 1);
    if (step >= STEPS.length) return finish();
    write(String(step));
    const s = STEPS[step]!;
    coach.replaceChildren();
    const head = div('display:flex;align-items:center;gap:8px;font-size:11px;color:#9ab');
    head.append(div('flex:1', `TUTORIAL · STEP ${step + 1} OF ${STEPS.length}`));
    const skip = button('Skip', false, finish);
    skip.style.padding = '2px 8px';
    skip.title = 'Hide the tutorial (replay it from the menu)';
    head.append(skip);
    const dots = div('display:flex;gap:4px;margin:6px 0');
    STEPS.forEach((_, j) => dots.append(div(`flex:1;height:4px;border-radius:2px;background:${j < step ? '#9be07f' : j === step ? '#ffd35a' : '#ffffff22'}`)));
    coach.append(head, dots, div('font-size:15px;font-weight:700;color:#ffe08a;margin-bottom:4px', s.title), div('line-height:1.4', s.text));
    if (step === STEPS.length - 1) {
      const row = div('margin-top:8px;text-align:right');
      row.append(button('Got it', true, finish));
      coach.append(row);
    }
    coach.style.display = '';
  };
  const advance = (from: number) => step === from && go(from + 1);

  const showWelcome = () => {
    coach.style.display = 'none';
    step = -1;
    welcome.replaceChildren();
    const card = div('width:min(520px,92vw);max-height:90vh;overflow:auto;box-sizing:border-box;padding:20px 24px;border-radius:14px;background:#0f1418f5;box-shadow:0 8px 40px #000c');
    card.append(
      div('font-size:24px;font-weight:800;color:#ffe08a', 'MicroscopeCraft'),
      div('margin:6px 0 14px;color:#b8c8d0;line-height:1.45', 'Your eye cannot make out anything much smaller than about 0.1 mm, the width of a hair. Build better and better microscopes to see what is really there.'),
    );
    const points: [string, string, string][] = [
      ['beach_sand', 'Gather', 'raw materials around campus: sand, ore, plant oil and more.'],
      ['lens', 'Craft', 'them into parts, and parts into a microscope.'],
      ['compound_microscope', 'Look', 'at leaves, rocks and samples to discover cells, crystals and, in the end, atoms.'],
      ['electron_microscope', 'Climb the tree', 'from a hand lens to electron microscopes and an X-ray synchrotron beamline.'],
    ];
    for (const [icon, verb, rest] of points) {
      const row = div('display:flex;gap:10px;align-items:center;margin:8px 0;line-height:1.35');
      const text = div();
      const b = document.createElement('b');
      b.textContent = `${verb} `;
      text.append(b, rest);
      row.append(itemIcon(icon, ctx.data, 30), text);
      card.append(row);
    }
    // who to play as: Lena (default) or the original explorer
    card.append(div('margin:14px 0 6px;font-weight:700', 'Choose your character'));
    const people = div('display:flex;gap:8px');
    const person = (id: 'lena' | 'explorer') => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', id === 'lena' ? 'Long-haired explorer' : 'Short-haired explorer');
      b.append(portrait(ctx, id));
      b.onclick = () => (chooseCharacter(ctx, id), syncPeople());
      return Object.assign(b, { person: id });
    };
    const persons = [person('lena'), person('explorer')];
    const syncPeople = () => persons.forEach((b) => {
      const on = b.person === ctx.state.economy.character;
      b.style.cssText = `padding:4px;border-radius:8px;cursor:pointer;background:${on ? '#ffd35a26' : '#ffffff0d'};border:1px solid ${on ? '#ffd35a' : '#ffffff22'}`;
    });
    syncPeople();
    people.append(...persons);
    card.append(people);
    // easy or advanced mode, picked here and switchable later in the menu
    card.append(div('margin:14px 0 6px;font-weight:700', 'How do you want to play?'));
    const modes = div('display:flex;gap:8px;flex-wrap:wrap');
    const pick = (advanced: boolean, title: string, about: string) => {
      const b = document.createElement('button');
      b.append(div('font-weight:700;margin-bottom:2px', title), div('font-size:12px;line-height:1.35;opacity:.8', about));
      b.onclick = () => (setAdvanced(ctx, advanced), sync());
      return Object.assign(b, { advanced });
    };
    const choices = [
      pick(false, '🌱 Easy', 'Press C to craft each microscope from its parts.'),
      pick(true, '🛠️ Advanced', 'Also grind the lenses and put the compound microscope together yourself.'),
    ];
    const sync = () => choices.forEach((b) => {
      const on = b.advanced === ctx.state.advanced;
      b.style.cssText = `flex:1 1 180px;padding:8px 10px;border-radius:8px;text-align:left;cursor:pointer;color:#eee;background:${on ? '#ffd35a26' : '#ffffff0d'};border:1px solid ${on ? '#ffd35a' : '#ffffff22'}`;
    });
    sync();
    modes.append(...choices);
    card.append(modes, div('margin-top:4px;font-size:11px;opacity:.6', 'You can switch later: Tab → Settings → Mode.'));
    const close = () => (welcome.style.display = 'none');
    const row = div('display:flex;gap:8px;justify-content:flex-end;margin-top:16px');
    row.append(
      button('Skip tutorial', false, () => (close(), finish())),
      button('Start tutorial', true, () => (close(), go(0))),
    );
    card.append(row);
    welcome.append(card);
    welcome.style.display = 'flex';
  };

  const saved = read();
  if (saved === null) {
    if (STEPS.some((s) => s.done?.(ctx))) write('done'); // a game saved before the tutorial existed
    else showWelcome();
  } else if (saved !== 'done') go(Number(saved) || 0);

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if ('wasd'.includes(e.key.toLowerCase()) && e.key.length === 1) advance(0);
  };
  addEventListener('keydown', onKey);
  const offs = [
    ctx.bus.on('itemGathered', () => advance(1)),
    ctx.bus.on('itemCrafted', () => advance(2)),
    ctx.bus.on('tierChanged', () => advance(3)),
    ctx.bus.on('openEyepiece', () => {
      Object.assign(coach.style, { left: 'auto', right: '12px' }); // the eyepiece's readouts are top-left
      advance(4);
    }),
    ctx.bus.on('closeEyepiece', () => Object.assign(coach.style, { left: '12px', right: 'auto' })),
    ctx.bus.on('discoveryUnlocked', () => (step === 4 || step === 5) && go(6)), // a hand lens may resolve something at once
  ];
  return {
    replay: showWelcome,
    dispose() {
      offs.forEach((off) => off());
      removeEventListener('keydown', onKey);
      welcome.remove();
      coach.remove();
    },
  };
}
