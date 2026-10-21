// Day-one stub: flat plane and a few cubes. Replace with the real voxel world.
// Controls: click to lock mouse, WASD to move, E gathers the aimed cube, F looks through the eyepiece at a sample.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { gather, type GameContext } from '../shared/state';
import type { WorldHandle } from './index';

interface Aim {
  gather?: string;
  sample?: string;
}

const CUBES: { color: string; pos: [number, number]; aim: Aim }[] = [
  { color: '#4caf50', pos: [0, -4], aim: { gather: 'leaf_fiber', sample: 'leaf' } },
  { color: '#e8d9a0', pos: [3, -4], aim: { gather: 'beach_sand', sample: 'sand_grain' } },
  { color: '#8a5a44', pos: [-3, -4], aim: { gather: 'iron_ore' } },
];
const REACH = 6;

export function mountStubWorld(el: HTMLElement, ctx: GameContext): WorldHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9ed0ff');
  scene.add(new THREE.HemisphereLight('#ffffff', '#557755', 1.6));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshLambertMaterial({ color: '#6aa84f' }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const targets: THREE.Mesh[] = CUBES.map(({ color, pos, aim }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color }));
    m.position.set(pos[0], 0.5, pos[1]);
    m.userData = aim;
    scene.add(m);
    return m;
  });

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
  camera.position.set(0, 1.7, 2);
  const controls = new PointerLockControls(camera, renderer.domElement);

  const hint = document.createElement('div');
  hint.style.cssText = 'position:fixed;left:12px;bottom:12px;color:#fff;text-shadow:0 0 3px #000;pointer-events:none';
  hint.textContent = 'Click to look · WASD move · E gather · F eyepiece · Esc frees the mouse';
  const cross = document.createElement('div');
  cross.style.cssText = 'position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px;background:#fff;mix-blend-mode:difference;pointer-events:none';
  el.append(hint, cross);

  const keys = new Set<string>();
  let paused = false;
  const ray = new THREE.Raycaster();
  ray.far = REACH;
  const aimed = (): Aim | null => {
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    return (ray.intersectObjects(targets)[0]?.object.userData as Aim | undefined) ?? null;
  };

  const onKey = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (down) keys.add(k);
    else keys.delete(k);
    if (!down || paused || !controls.isLocked) return;
    const aim = aimed();
    if (k === 'e' && aim?.gather) gather(ctx, aim.gather);
    if (k === 'f' && aim?.sample) {
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
    renderer.render(scene, camera);
  });

  return {
    dispose() {
      cancelAnimationFrame(raf);
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
