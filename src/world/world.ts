// Flat-colored cube world. Click to lock the mouse, WASD to move, E gathers the aimed cube,
// F looks at the aimed sample through the player's current microscope (or the naked eye).
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { gather, type GameContext } from '../shared/state';
import type { WorldHandle } from './index';

interface Aim {
  gather?: string;
  sample?: string;
}

interface Spot {
  color: string;
  x: number;
  z: number;
  aim: Aim;
}

const sand = (x: number, z: number): Spot => ({ color: '#e8d9a0', x, z, aim: { gather: 'beach_sand', sample: 'sand_grain' } });
const quartz = (x: number, z: number): Spot => ({ color: '#f4f1ea', x, z, aim: { gather: 'quartz_sand', sample: 'quartz_grain' } });
const iron = (x: number, z: number): Spot => ({ color: '#8a5a44', x, z, aim: { gather: 'iron_ore' } });
const copper = (x: number, z: number): Spot => ({ color: '#c27d4a', x, z, aim: { gather: 'copper_ore' } });
const tungsten = (x: number, z: number): Spot => ({ color: '#4a4f57', x, z, aim: { gather: 'tungsten_ore' } });
const resin = (x: number, z: number): Spot => ({ color: '#c8742a', x, z, aim: { gather: 'resin' } });
const oil = (x: number, z: number): Spot => ({ color: '#d9c84a', x, z, aim: { gather: 'plant_oil' } });
const block = (x0: number, x1: number, z0: number, z1: number, make: (x: number, z: number) => Spot): Spot[] => {
  const out: Spot[] = [];
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) out.push(make(x, z));
  return out;
};
// Leaf, flower, wing, pond and crystal are samples only: looking never uses them up.
const SPOTS: Spot[] = [
  ...block(3, 5, -6, -4, sand),
  ...block(8, 9, -6, -4, quartz),
  ...block(-5, -3, -4, -3, iron),
  ...block(-5, -3, -7, -6, copper),
  ...block(-8, -8, -5, -4, tungsten),
  ...block(5, 6, -9, -9, resin),
  ...block(0, 1, -9, -9, oil),
  { color: '#2e8b3a', x: 0, z: -5, aim: { sample: 'leaf' } },
  { color: '#d95fa8', x: -1, z: -7, aim: { sample: 'flower' } },
  { color: '#e89a3c', x: 2, z: -8, aim: { sample: 'insect_wing' } },
  { color: '#3d7fd6', x: -8, z: -10, aim: { sample: 'pond_water' } },
  { color: '#b9c4ff', x: 8, z: -10, aim: { sample: 'crystal_sample' } },
];
const REACH = 6;
const RESPAWN_MS = 15_000; // no scarcity: gathered cubes grow back

export function mountVoxelWorld(el: HTMLElement, ctx: GameContext): WorldHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9ed0ff');
  scene.add(new THREE.HemisphereLight('#ffffff', '#99aa99', 2.2));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: '#6aa84f' }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const targets = new Set<THREE.Mesh>();
  const timers = new Set<number>();
  const spawn = ({ color, x, z, aim }: Spot) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, 0.5, z);
    m.userData = { aim, spot: { color, x, z, aim } };
    scene.add(m);
    targets.add(m);
  };
  SPOTS.forEach(spawn);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
  camera.position.set(0, 1.7, 2);
  const controls = new PointerLockControls(camera, renderer.domElement);

  const css = 'position:fixed;color:#fff;text-shadow:0 0 3px #000;pointer-events:none';
  const hint = document.createElement('div');
  hint.style.cssText = `${css};left:12px;bottom:12px`;
  hint.textContent = 'Click to look · WASD move · E gather · F look through your instrument · Esc frees the mouse';
  const prompt = document.createElement('div');
  prompt.style.cssText = `${css};left:calc(50% - 130px);width:260px;text-align:center;top:calc(50% + 16px)`;
  const cross = document.createElement('div');
  cross.style.cssText = 'position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px;background:#fff;mix-blend-mode:difference;pointer-events:none';
  el.append(hint, prompt, cross);

  const keys = new Set<string>();
  let paused = false;
  const ray = new THREE.Raycaster();
  ray.far = REACH;
  const aimedMesh = () => {
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    return ray.intersectObjects([...targets])[0]?.object as THREE.Mesh | undefined;
  };

  const onKey = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (down) keys.add(k);
    else keys.delete(k);
    if (!down || paused || !controls.isLocked) return;
    const mesh = aimedMesh();
    const aim = mesh?.userData.aim as Aim | undefined;
    if (!mesh || !aim) return;
    if (k === 'e' && aim.gather) {
      gather(ctx, aim.gather);
      scene.remove(mesh);
      targets.delete(mesh);
      timers.add(window.setTimeout(() => spawn(mesh.userData.spot as Spot), RESPAWN_MS));
    }
    if (k === 'f' && aim.sample) {
      controls.unlock();
      ctx.bus.emit('openEyepiece', { sampleId: aim.sample });
    }
  };
  const onDown = (e: KeyboardEvent) => onKey(e, true);
  const onUp = (e: KeyboardEvent) => onKey(e, false);
  const onClick = () => !paused && controls.lock();
  addEventListener('keydown', onDown);
  addEventListener('keyup', onUp);
  renderer.domElement.addEventListener('click', onClick);

  const offOpen = ctx.bus.on('openEyepiece', () => (paused = true));
  const offClose = ctx.bus.on('closeEyepiece', () => (paused = false));

  const resize = () => {
    renderer.setSize(el.clientWidth, el.clientHeight);
    camera.aspect = el.clientWidth / el.clientHeight;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  const describe = (aim: Aim | undefined) => {
    if (!aim) return '';
    const parts: string[] = [];
    if (aim.gather) parts.push(`E gather ${ctx.data.items[aim.gather]?.name ?? aim.gather}`);
    if (aim.sample) parts.push(`F look at ${ctx.data.samples[aim.sample]?.name ?? aim.sample}`);
    return parts.join(' · ');
  };

  let last = performance.now();
  let raf = requestAnimationFrame(function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (controls.isLocked && !paused) {
      const speed = 5 * dt;
      controls.moveForward(((keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0)) * speed);
      controls.moveRight(((keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)) * speed);
    }
    prompt.textContent = controls.isLocked && !paused ? describe(aimedMesh()?.userData.aim as Aim | undefined) : '';
    renderer.render(scene, camera);
  });

  return {
    dispose() {
      cancelAnimationFrame(raf);
      timers.forEach((t) => clearTimeout(t));
      ro.disconnect();
      offOpen();
      offClose();
      removeEventListener('keydown', onDown);
      removeEventListener('keyup', onUp);
      renderer.dispose();
      el.replaceChildren();
    },
  };
}
