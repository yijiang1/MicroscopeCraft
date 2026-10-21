// The open world: terrain you walk and jump across, a pond, highlands, a lab, and 3D models you gather or look at.
// Click to lock the mouse; WASD move, Shift run, Space jump, E gather the aimed item, F look at the aimed sample.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { lockedBy } from '../shared/plan';
import { gather, type GameContext } from '../shared/state';
import { buildDecor, buildSky, FOG_COLOR, SUN_DIRECTION, type Blocker } from './decor';
import type { WorldHandle } from './index';
import { buildModel } from './models';
import { buildPlayer } from './player';
import { AIMS, PLACEMENTS, RADIUS, type Aim, type Kind } from './placements';
import { buildTerrain, buildWater, heightAt, LAB, POND, WATER_LEVEL, WORLD_RADIUS } from './terrain';

const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.35;
const WALK = 5;
const RUN = 8.5;
const GRAVITY = 20;
const JUMP = 6.2;
const REACH = 6;
const RESPAWN_MS = 15_000; // no scarcity: gathered things grow back
const ANIM_MS = 260;
const LOCKED_TEXT = 'Not identified yet: look at it first (F) through a microscope';
const MARKER_RANGE = 30; // the floating marker only shows when you are this close; the arrow always shows

interface Node {
  kind: Kind;
  aim: Aim;
  root: THREE.Object3D;
  x: number;
  z: number;
  radius: number;
  alive: boolean;
  index: number;
  /** Aim sphere: where the crosshair counts as pointing at this node (forgiving for thin things like leaves). */
  center: THREE.Vector3;
  aimRadius: number;
}

export function mountOpenWorld(el: HTMLElement, ctx: GameContext): WorldHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.6;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 55, 200);
  scene.add(buildSky());
  scene.add(new THREE.HemisphereLight('#cfe6ff', '#6b7a4f', 1.7));
  const sun = new THREE.DirectionalLight('#fff1dc', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 200 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  scene.add(buildTerrain());
  const water = buildWater();
  scene.add(water);

  // --- things to gather or look at
  const nodes: Node[] = [];
  /** Ores that can only be recognised under a microscope look like plain rock until the player has discovered them. */
  const isRevealed = (kind: Kind) => {
    const item = AIMS[kind].gather;
    return !item || !lockedBy(item, ctx.data, ctx.state.discoveries);
  };
  const spawnNode = (kind: Kind, x: number, z: number, index: number) => {
    const root = buildModel(kind, index, isRevealed(kind));
    root.position.set(x, heightAt(x, z), z);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const aimRadius = Math.min(1.3, Math.max(0.35, box.getSize(new THREE.Vector3()).length() * 0.4));
    const node: Node = { kind, aim: AIMS[kind], root, x, z, radius: RADIUS[kind], alive: true, index, center: box.getCenter(new THREE.Vector3()), aimRadius };
    root.userData.node = node;
    scene.add(root);
    nodes.push(node);
    return node;
  };
  PLACEMENTS.forEach((p, i) => {
    if (p.kind === 'pond') return;
    spawnNode(p.kind, p.x, p.z, i);
  });
  const pondNode: Node = {
    kind: 'pond', aim: AIMS.pond, root: water, x: POND.x, z: POND.z, radius: 0, alive: true, index: -1,
    center: water.position.clone(), aimRadius: 0,
  };

  const offDiscovery = ctx.bus.on('discoveryUnlocked', ({ id }) => {
    for (const n of nodes) {
      const item = n.aim.gather;
      if (!item || ctx.data.materials[item]?.unlockedBy !== id) continue;
      const old = n.root;
      const fresh = buildModel(n.kind, n.index, true);
      fresh.position.copy(old.position);
      fresh.scale.copy(old.scale);
      fresh.userData.node = n;
      if (old.parent) {
        scene.remove(old);
        scene.add(fresh);
      }
      n.root = fresh;
    }
  });

  const crystal = nodes.find((n) => n.kind === 'crystal');
  const crystalLight = new THREE.PointLight('#8a7bff', 14, 18, 2);
  crystalLight.position.set(LAB.x, heightAt(LAB.x, LAB.z) + 2.6, LAB.z);
  scene.add(crystalLight);

  const { group: decor, blockers } = buildDecor(PLACEMENTS.map((p) => ({ x: p.x, z: p.z })));
  scene.add(decor);

  // --- aim ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 40),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 10;
  ring.visible = false;
  scene.add(ring);

  // --- tracking: an arrow with distance at the top of the screen, plus a small floating marker once you are close
  let tracked: string | null = null;
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11),
    new THREE.MeshBasicMaterial({ color: '#fff1b8', transparent: true, opacity: 0.85, depthWrite: false, fog: false }),
  );
  marker.visible = false;
  scene.add(marker);
  const offTrack = ctx.bus.on('trackItem', ({ itemId }) => (tracked = itemId));

  // --- player
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1500);
  camera.position.set(0, heightAt(0, 3) + EYE_HEIGHT, 3);
  const controls = new PointerLockControls(camera, renderer.domElement);
  const player = buildPlayer();
  scene.add(player.root);
  const viewCamera = camera.clone();
  let thirdPerson = false;
  const viewDirection = new THREE.Vector3();
  const shoulder = new THREE.Vector3();
  const updateView = () => {
    player.root.position.copy(camera.position);
    player.root.position.y -= EYE_HEIGHT;
    player.root.rotation.y = camera.rotation.y;
    player.root.visible = thirdPerson;
    viewCamera.position.copy(camera.position);
    viewCamera.quaternion.copy(camera.quaternion);
    if (thirdPerson) {
      camera.getWorldDirection(viewDirection);
      shoulder.set(1, 0, 0).applyQuaternion(camera.quaternion);
      viewCamera.position.addScaledVector(viewDirection, -3.2).addScaledVector(shoulder, 0.7);
      viewCamera.position.y = Math.max(viewCamera.position.y, heightAt(viewCamera.position.x, viewCamera.position.z) + 0.3);
      viewCamera.lookAt(camera.position.clone().addScaledVector(viewDirection, REACH));
    }
    viewCamera.updateMatrixWorld();
  };
  updateView();
  let vy = 0;
  let paused = false;

  const css = 'position:fixed;color:#fff;text-shadow:0 0 3px #000;pointer-events:none';
  const hint = document.createElement('div');
  hint.style.cssText = `${css};left:12px;bottom:12px`;
  hint.textContent = 'Click to look · WASD move · Shift run · Space jump · E gather · F look closer · C craft · Tab menu · M Microdex · V camera';
  const prompt = document.createElement('div');
  prompt.style.cssText = `${css};left:calc(50% - 150px);width:300px;text-align:center;top:calc(50% + 18px)`;
  const trackHud = document.createElement('div');
  trackHud.style.cssText = `${css};left:50%;transform:translateX(-50%);top:14px;font-size:18px;font-weight:600;color:#ffd24a`;
  const compass = document.createElement('div');
  compass.style.cssText = `${css};left:12px;top:12px;font-size:13px`;
  const cross = document.createElement('div');
  cross.style.cssText = 'position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px;background:#fff;mix-blend-mode:difference;pointer-events:none';
  el.append(hint, prompt, compass, trackHud, cross);

  const keys = new Set<string>();
  const ray = new THREE.Raycaster();
  ray.far = REACH;
  let hitPoint = new THREE.Vector3();
  const dir = new THREE.Vector3();
  /** The node under the crosshair: the nearest aim sphere the view line passes through, or the pond surface. */
  const aimed = (): Node | null => {
    viewCamera.getWorldDirection(dir);
    let best: Node | null = null;
    let bestT = Infinity;
    for (const n of nodes) {
      if (!n.alive) continue;
      if (n.center.distanceTo(camera.position) > REACH + n.aimRadius) continue;
      const v = n.center.clone().sub(viewCamera.position);
      const t = v.dot(dir);
      if (t < 0 || t > REACH + 4 + n.aimRadius || t >= bestT) continue;
      if (v.addScaledVector(dir, -t).length() <= n.aimRadius) {
        best = n;
        bestT = t;
      }
    }
    ray.far = thirdPerson ? REACH + 4 : REACH;
    ray.set(viewCamera.position, dir);
    const hit = ray.intersectObject(water)[0];
    // the water plane extends under the banks, so only count it where the ground is really below the surface
    if (hit && hit.point.distanceTo(camera.position) <= REACH && hit.distance < bestT && heightAt(hit.point.x, hit.point.z) < WATER_LEVEL - 0.02) {
      hitPoint = hit.point;
      return pondNode;
    }
    return best;
  };

  // --- gathering: shrink away, grow back later
  const anims: { obj: THREE.Object3D; from: number; to: number; start: number; done?: () => void }[] = [];
  const timers = new Set<number>();
  const animate = (obj: THREE.Object3D, from: number, to: number, done?: () => void) =>
    anims.push({ obj, from, to, start: performance.now(), done });

  const gatherNode = (n: Node) => {
    gather(ctx, n.aim.gather!);
    n.alive = false;
    animate(n.root, 1, 0.001, () => scene.remove(n.root));
    timers.add(
      window.setTimeout(() => {
        n.alive = true;
        n.root.scale.setScalar(0.001);
        scene.add(n.root);
        animate(n.root, 0.001, 1);
      }, RESPAWN_MS),
    );
  };

  let flashText = '';
  let flashUntil = 0;
  const flash = (text: string) => {
    flashText = text;
    flashUntil = performance.now() + 2500;
  };

  const onKey = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (down) keys.add(k);
    else keys.delete(k);
    if (e.code === 'Space') {
      if (down) keys.add(' ');
      else keys.delete(' ');
      if (controls.isLocked) e.preventDefault();
    }
    if (!down || paused || !controls.isLocked) return;
    if (k === 'v' && !e.repeat) {
      thirdPerson = !thirdPerson;
      updateView();
      return;
    }
    const n = aimed();
    if (!n) return;
    if (k === 'e' && n.aim.gather) {
      if (lockedBy(n.aim.gather, ctx.data, ctx.state.discoveries)) flash(LOCKED_TEXT);
      else gatherNode(n);
    }
    if (k === 'f' && n.aim.sample) {
      controls.unlock();
      ctx.bus.emit('openEyepiece', { sampleId: n.aim.sample });
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
    camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
    camera.updateProjectionMatrix();
    viewCamera.aspect = camera.aspect;
    viewCamera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  const describe = (n: Node | null) => {
    if (!n) return '';
    const parts: string[] = [];
    if (n.aim.gather) {
      const locked = lockedBy(n.aim.gather, ctx.data, ctx.state.discoveries);
      parts.push(locked ? 'E locked until identified' : `E gather ${ctx.data.items[n.aim.gather]?.name ?? n.aim.gather}`);
    }
    if (n.aim.sample) parts.push(`F look at ${ctx.data.samples[n.aim.sample]?.name ?? n.aim.sample}`);
    return parts.join(' · ');
  };

  /** Push the player out of anything solid: scenery blockers and live nodes. */
  const collide = (p: THREE.Vector3) => {
    const push = (x: number, z: number, r: number) => {
      const dx = p.x - x;
      const dz = p.z - z;
      const d = Math.hypot(dx, dz);
      const min = r + PLAYER_RADIUS;
      if (d < min && d > 1e-4) {
        p.x = x + (dx / d) * min;
        p.z = z + (dz / d) * min;
      }
    };
    blockers.forEach((b: Blocker) => push(b.x, b.z, b.r));
    nodes.forEach((n) => n.alive && n.radius > 0 && push(n.x, n.z, n.radius));
  };

  const heading = () => {
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    const deg = (Math.atan2(d.x, -d.z) * 180) / Math.PI;
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
  };

  const clock = new THREE.Clock();
  let raf = requestAnimationFrame(function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = performance.now();
    const previousX = camera.position.x;
    const previousZ = camera.position.z;

    if (controls.isLocked && !paused) {
      const p = camera.position;
      const ground = heightAt(p.x, p.z);
      const wading = ground < WATER_LEVEL;
      const speed = (keys.has('shift') ? RUN : WALK) * (wading ? 0.55 : 1) * dt;
      controls.moveForward(((keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0)) * speed);
      controls.moveRight(((keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)) * speed);
      collide(p);
      const r = Math.hypot(p.x, p.z);
      if (r > WORLD_RADIUS - 2) p.multiplyScalar((WORLD_RADIUS - 2) / r); // keeps x, z; y is reset below
      const feet = heightAt(p.x, p.z);
      const eye = feet + EYE_HEIGHT;
      const onGround = p.y <= eye + 0.02;
      if (onGround && keys.has(' ')) vy = JUMP;
      vy -= GRAVITY * dt;
      p.y += vy * dt;
      if (p.y <= eye) {
        p.y = eye;
        vy = 0;
      }
    } else {
      camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + EYE_HEIGHT);
    }

    player.update(Math.hypot(camera.position.x - previousX, camera.position.z - previousZ), dt);
    updateView();

    // sun and its shadow follow the player
    sun.position.copy(camera.position).addScaledVector(SUN_DIRECTION, 90);
    sun.target.position.copy(camera.position);

    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i]!;
      const k = Math.min(1, (t - a.start) / ANIM_MS);
      a.obj.scale.setScalar(a.from + (a.to - a.from) * k * k * (3 - 2 * k));
      if (k >= 1) {
        anims.splice(i, 1);
        a.done?.();
      }
    }
    if (crystal) crystalLight.intensity = 12 + 4 * Math.sin(t * 0.0021);

    const n = controls.isLocked && !paused ? aimed() : null;
    const flashing = performance.now() < flashUntil;
    prompt.textContent = flashing ? flashText : describe(n);
    prompt.style.color = flashing ? '#ffb27a' : '#fff';
    ring.visible = !!n;
    if (n) {
      const radius = n.radius > 0 ? n.radius + 0.2 : 0.8;
      const rx = n.radius > 0 ? n.x : hitPoint.x;
      const rz = n.radius > 0 ? n.z : hitPoint.z;
      ring.position.set(rx, n.radius > 0 ? heightAt(rx, rz) + 0.05 : WATER_LEVEL + 0.03, rz);
      ring.scale.setScalar(radius * (1 + 0.04 * Math.sin(t * 0.006)));
    }
    // nearest live source of the tracked item
    let target: Node | null = null;
    if (tracked) {
      let best = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - camera.position.x, n.z - camera.position.z);
        if (n.alive && n.aim.gather === tracked && d < best) {
          best = d;
          target = n;
        }
      }
    }
    marker.visible = !!target && Math.hypot(target.x - camera.position.x, target.z - camera.position.z) < MARKER_RANGE;
    trackHud.textContent = '';
    if (target) {
      marker.position.set(target.x, target.center.y + target.aimRadius + 0.4 + 0.06 * Math.sin(t * 0.004), target.z);
      marker.rotation.y = t * 0.002;
      const dx = target.x - camera.position.x;
      const dz = target.z - camera.position.z;
      camera.getWorldDirection(dir);
      const angle = (Math.atan2(-dir.z * dx + dir.x * dz, dir.x * dx + dir.z * dz) * 180) / Math.PI; // 0 = straight ahead, 90 = right
      const arrow = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][((Math.round(angle / 45) % 8) + 8) % 8]!;
      trackHud.textContent = `${arrow} ${ctx.data.items[tracked!]?.name ?? tracked} · ${Math.hypot(dx, dz).toFixed(0)} m`;
    }
    compass.textContent = `${heading()} · ${camera.position.x.toFixed(0)}, ${camera.position.z.toFixed(0)}`;
    renderer.render(scene, viewCamera);
  });

  if (import.meta.env.DEV) {
    // Dev only: jump around for screenshots, e.g. __world.lookAtKind('iron').
    const teleport = (x: number, z: number, yawDeg = 0, pitchDeg = 0) => {
      camera.position.set(x, heightAt(x, z) + EYE_HEIGHT, z);
      camera.rotation.set(THREE.MathUtils.degToRad(pitchDeg), THREE.MathUtils.degToRad(yawDeg), 0, 'YXZ');
    };
    (window as unknown as { __world: unknown }).__world = {
      camera,
      controls,
      teleport,
      nodes: nodes.map((n) => ({ kind: n.kind, x: n.x, z: n.z })),
      /** Stand `dist` m south of the first node of a kind, looking at it. */
      lookAtKind(kind: string, dist = 2.5) {
        const n = nodes.find((m) => m.kind === kind);
        if (n) teleport(n.x, n.z + dist, 0, -12);
        return !!n;
      },
    };
  }

  return {
    dispose() {
      cancelAnimationFrame(raf);
      timers.forEach((id) => clearTimeout(id));
      ro.disconnect();
      offOpen();
      offClose();
      offTrack();
      offDiscovery();
      removeEventListener('keydown', onDown);
      removeEventListener('keyup', onUp);
      player.dispose();
      controls.dispose();
      renderer.dispose();
      el.replaceChildren();
    },
  };
}
