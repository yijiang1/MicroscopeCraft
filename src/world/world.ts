// The open world: a university campus, which you walk and jump across, and 3D models you gather or look at.
// Fixed instruments stay where they are installed: the electron microscopes in the science lab, the CHESS beamline in
// Wilson Lab. Look (F) at a sample to take a bit along, carry it there and press F at the instrument.
// Scientists stand around campus: press E to talk to them. Cabinets hold several samples: F, then pick one.
// Click to lock the mouse; WASD move, Shift run, Space jump, E gather or talk, F look at the aimed sample.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { conditionMet } from '../shared/achievements';
import { lockedBy, SITE_NAMES } from '../shared/plan';
import type { Site } from '../shared/schema';
import { gather, ownedScopes, selectScope, setSite, visit, type GameContext } from '../shared/state';
import { BEAM_SPOT, buildCampus, CRYSTAL_SPOT, EM_SPOT, inChess, inGreenhouse, inLab, SCIENCE, WILSON, type Box } from './campus';
import { buildDecor, buildSky, FOG_COLOR, SUN_DIRECTION, type Blocker } from './decor';
import type { WorldHandle } from './index';
import { buildModel } from './models';
import { buildNpc, type NpcFigure } from './npc';
import { mountMinimap } from './minimap';
import { buildPlayer } from './player';
import { createFootstepTracker } from './footsteps';
import { AIMS, PLACEMENTS, RADIUS, samplesOf, SPAWN, type Aim, type Kind, type Placement } from './placements';
import { buildTerrain, buildWater, FALLS_X, gorgeZ, heightAt, LAKE, pathAt, waterLevelAt, WATER_LEVEL, WORLD_RADIUS } from './terrain';

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
const BAG_SIZE = 8; // samples you can carry to the fixed instruments at once

interface Node {
  /** 'em': the electron microscopes in the lab; 'beam': the CHESS beamline's desk; 'npc': a scientist. */
  kind: Kind | 'em' | 'beam' | 'npc';
  aim: Aim;
  npcId?: string;
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
  const campus = buildCampus();
  scene.add(campus.group);

  // --- things to gather or look at
  const nodes: Node[] = [];
  /** Ores that can only be recognised under a microscope look like plain rock until the player has discovered them. */
  const isRevealed = (kind: Kind) => {
    const item = AIMS[kind].gather;
    return !item || !lockedBy(item, ctx.data, ctx.state.discoveries);
  };
  const place = (n: Node, p: Placement, root: THREE.Object3D) => {
    root.position.set(p.x, heightAt(p.x, p.z) + (p.y ?? 0), p.z);
    if (p.yaw !== undefined) root.rotation.y = p.yaw;
    root.updateMatrixWorld(true);
    n.root = root;
  };
  const spawnNode = (p: Placement, index: number) => {
    const node: Node = { kind: p.kind, aim: AIMS[p.kind], root: new THREE.Group(), x: p.x, z: p.z, radius: RADIUS[p.kind], alive: true, index, center: new THREE.Vector3(), aimRadius: 0 };
    place(node, p, buildModel(p.kind, index, isRevealed(p.kind)));
    const box = new THREE.Box3().setFromObject(node.root);
    node.aimRadius = Math.min(1.3, Math.max(0.35, box.getSize(new THREE.Vector3()).length() * 0.4));
    box.getCenter(node.center);
    node.root.userData.node = node;
    scene.add(node.root);
    nodes.push(node);
    return node;
  };
  const placementOf = new Map<Node, Placement>();
  PLACEMENTS.forEach((p, i) => {
    if (p.kind === 'pond') return;
    placementOf.set(spawnNode(p, i), p);
  });
  const pondNode: Node = {
    kind: 'pond', aim: AIMS.pond, root: water, x: LAKE.x, z: LAKE.z, radius: 0, alive: true, index: -1,
    center: new THREE.Vector3(LAKE.x, WATER_LEVEL, LAKE.z), aimRadius: 0,
  };
  const emY = heightAt(EM_SPOT.x, EM_SPOT.z);
  const emNode: Node = {
    kind: 'em', aim: {}, root: campus.em.group, x: EM_SPOT.x, z: EM_SPOT.z, radius: 0.9, alive: true, index: -1,
    center: new THREE.Vector3(EM_SPOT.x, emY + 1.5, EM_SPOT.z), aimRadius: 1.2,
  };
  const beamNode: Node = {
    kind: 'beam', aim: {}, root: campus.group, x: BEAM_SPOT.x, z: BEAM_SPOT.z + 0.3, radius: 0, alive: true, index: -1,
    center: new THREE.Vector3(BEAM_SPOT.x, heightAt(BEAM_SPOT.x, BEAM_SPOT.z) + 1, BEAM_SPOT.z + 0.3), aimRadius: 1.1,
  };
  nodes.push(emNode, beamNode);

  // --- the scientists
  const figures = new Map<string, NpcFigure>();
  for (const npc of Object.values(ctx.data.npcs)) {
    const fig = buildNpc(npc);
    const y = heightAt(npc.x, npc.z);
    fig.root.position.set(npc.x, y, npc.z);
    fig.root.rotation.y = npc.facing;
    scene.add(fig.root);
    figures.set(npc.id, fig);
    nodes.push({
      kind: 'npc', aim: {}, npcId: npc.id, root: fig.root, x: npc.x, z: npc.z, radius: 0.35, alive: true, index: -1,
      center: new THREE.Vector3(npc.x, y + 1.2, npc.z), aimRadius: 0.75,
    });
  }
  const updateMarkers = () => {
    for (const [id, fig] of figures) {
      const open = ctx.data.npcs[id]!.quests.filter((q) => !ctx.state.quests.includes(q.id));
      fig.setMarker(!open.length ? 'done' : open.some((q) => conditionMet(q.needs, ctx.data, ctx.state)) ? 'ready' : 'waiting');
    }
  };
  updateMarkers();

  // --- fixed instruments: the best one installed at a site, and the parts of each model on show
  const has = (id: string) => (ctx.state.inventory[id] ?? 0) > 0;
  const fixedAt = (site: Site) => ownedScopes(ctx.state.inventory, ctx.data, site).filter((r) => r.scope.site === site).at(-1);
  const ownsFixed = () => ownedScopes(ctx.state.inventory, ctx.data).some((r) => r.scope.site);
  const showModels = () => {
    campus.em.show(has);
    campus.beamline.show(has);
  };
  showModels();
  /** Samples the player has taken along for the fixed instruments, newest first. */
  const bag: string[] = [];
  const carry = (sampleId: string) => {
    const i = bag.indexOf(sampleId);
    if (i >= 0) bag.splice(i, 1);
    bag.unshift(sampleId);
    bag.length = Math.min(bag.length, BAG_SIZE);
  };

  const offDiscovery = ctx.bus.on('discoveryUnlocked', ({ id }) => {
    for (const n of nodes) {
      const item = n.aim.gather;
      const p = placementOf.get(n);
      if (!item || !p || ctx.data.materials[item]?.unlockedBy !== id) continue;
      const old = n.root;
      const fresh = buildModel(p.kind, n.index, true);
      fresh.position.copy(old.position);
      fresh.rotation.y = p.yaw ?? fresh.rotation.y;
      fresh.scale.copy(old.scale);
      fresh.userData.node = n;
      if (old.parent) {
        scene.remove(old);
        scene.add(fresh);
      }
      n.root = fresh;
    }
    updateMarkers();
  });

  const crystal = nodes.find((n) => n.kind === 'crystal');
  const crystalLight = new THREE.PointLight('#8a7bff', 14, 18, 2);
  crystalLight.position.set(CRYSTAL_SPOT.x, heightAt(CRYSTAL_SPOT.x, CRYSTAL_SPOT.z) + 2.6, CRYSTAL_SPOT.z);
  scene.add(crystalLight);

  const { group: decor, blockers } = buildDecor([...PLACEMENTS, ...Object.values(ctx.data.npcs)].map((p) => ({ x: p.x, z: p.z })));
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

  // --- tracking: an arrow with distance at the top of the screen, plus a small floating marker once you are close.
  // Two things can be tracked: the material the goal needs (yellow) and a sample or scientist picked in a list (blue).
  let tracked: string | null = null;
  let target: { kind: 'sample' | 'npc'; id: string } | null = null;
  const makeMarker = (color: string) => {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, fog: false }),
    );
    m.visible = false;
    scene.add(m);
    return m;
  };
  const marker = makeMarker('#fff1b8');
  const targetMarker = makeMarker('#9fdcff');
  const offTrack = ctx.bus.on('trackItem', ({ itemId }) => (tracked = itemId));
  const offTarget = ctx.bus.on('trackTarget', ({ target: t }) => (target = t));
  const offCrafted = ctx.bus.on('itemCrafted', () => {
    showModels();
    updateMarkers();
  });
  const offQuest = ctx.bus.on('questCompleted', updateMarkers);
  const offScore = ctx.bus.on('minigameScored', updateMarkers);

  // --- player
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1500);
  camera.position.set(SPAWN.x, heightAt(SPAWN.x, SPAWN.z) + EYE_HEIGHT, SPAWN.z);
  const controls = new PointerLockControls(camera, renderer.domElement);
  const player = buildPlayer();
  scene.add(player.root);
  const viewCamera = camera.clone();
  let thirdPerson = true;
  const viewDirection = new THREE.Vector3();
  const shoulder = new THREE.Vector3();
  const boom = new THREE.Vector3();
  const boomRay = new THREE.Raycaster();
  const updateView = () => {
    player.root.position.copy(camera.position);
    player.root.position.y -= EYE_HEIGHT;
    camera.getWorldDirection(viewDirection);
    player.root.rotation.y = Math.atan2(-viewDirection.x, -viewDirection.z); // yaw only: camera.rotation is XYZ order, not YXZ
    player.root.visible = thirdPerson;
    viewCamera.position.copy(camera.position);
    viewCamera.quaternion.copy(camera.quaternion);
    if (thirdPerson) {
      shoulder.set(1, 0, 0).applyQuaternion(camera.quaternion);
      // pull the camera in front of any wall, ceiling or statue between it and the player's eyes
      boom.copy(viewDirection).multiplyScalar(-3.2).addScaledVector(shoulder, 0.7);
      const length = boom.length();
      boomRay.set(camera.position, boom.divideScalar(length));
      boomRay.far = length;
      const hit = boomRay.intersectObject(campus.group)[0];
      viewCamera.position.addScaledVector(boom, hit ? Math.max(0.2, hit.distance - 0.3) : length);
      player.root.visible = !hit || hit.distance > 1;
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
  hint.style.maxWidth = 'calc(100% - 340px)';
  hint.textContent = 'Click to look · WASD move · Shift run · Space jump · E gather/talk · F look · C craft · T tree · I inventory · J journal · Tab menu · G guide · M Microdex · V view';
  const prompt = document.createElement('div');
  prompt.style.cssText = `${css};left:calc(50% - 170px);width:340px;text-align:center;top:calc(50% + 18px)`;
  const trackHud = document.createElement('div');
  trackHud.style.cssText = `${css};left:50%;transform:translateX(-50%);top:14px;font-size:18px;font-weight:600;color:#ffd24a;white-space:nowrap`;
  const targetHud = document.createElement('div');
  targetHud.style.cssText = `${css};left:50%;transform:translateX(-50%);top:40px;font-size:16px;font-weight:600;color:#9fdcff;white-space:nowrap`;
  const carryHud = document.createElement('div');
  carryHud.style.cssText = `${css};left:50%;transform:translateX(-50%);top:64px;font-size:15px;color:#bfe3ff;max-width:80vw;text-align:center`;
  const compass = document.createElement('div');
  compass.style.cssText = `${css};left:12px;top:12px;font-size:13px`;
  const cross = document.createElement('div');
  cross.style.cssText = 'position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px;background:#fff;mix-blend-mode:difference;pointer-events:none';
  // a list to pick one sample from: a cabinet's slides, or the samples you carry, at an instrument (keys 1-9)
  const picker = document.createElement('div');
  picker.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:12;display:none;min-width:300px;max-width:90vw;padding:12px 16px;border-radius:12px;background:#000d;color:#eee;font:14px system-ui';
  el.append(hint, prompt, compass, trackHud, targetHud, carryHud, cross, picker);
  const minimap = mountMinimap(el, ctx.data.npcs);

  let pick: { ids: string[]; then: (sampleId: string) => void } | null = null;
  const closePicker = () => {
    pick = null;
    picker.style.display = 'none';
  };
  const openPicker = (title: string, ids: string[], then: (sampleId: string) => void) => {
    pick = { ids, then };
    picker.replaceChildren();
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:600;margin-bottom:6px';
    h.textContent = `${title} (press a number, Esc to cancel)`;
    picker.append(h);
    ids.slice(0, 9).forEach((id, i) => {
      const s = ctx.data.samples[id];
      const found = s ? s.features.filter((f) => ctx.state.discoveries.includes(f.id)).length : 0;
      const total = s?.features.length ?? 0;
      const row = document.createElement('button');
      row.style.cssText = 'display:block;width:100%;margin:2px 0;text-align:left;cursor:pointer';
      row.textContent = `${i + 1}  ${s?.name ?? id}  ·  ${found}/${total} found${found === total ? ' ✓' : ''}`;
      row.onclick = () => choose(i);
      picker.append(row);
    });
    picker.style.display = 'block';
  };
  const choose = (i: number) => {
    const p = pick;
    const id = p?.ids[i];
    closePicker();
    if (p && id) p.then(id);
  };

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
    // the water planes extend under the banks, so only count them where the ground is really below the surface
    if (hit && hit.point.distanceTo(camera.position) <= REACH && hit.distance < bestT && heightAt(hit.point.x, hit.point.z) < hit.point.y - 0.02) {
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
    flashUntil = performance.now() + 3500;
  };

  const sampleName = (id: string) => ctx.data.samples[id]?.name ?? id;
  const look = (sampleId: string) => {
    controls.unlock();
    ctx.bus.emit('openEyepiece', { sampleId });
  };
  /** F at a sample: take a bit along if you own a fixed instrument, and look through your best portable microscope. */
  const lookAt = (sampleId: string) => {
    if (ownsFixed()) carry(sampleId);
    const portable = ownedScopes(ctx.state.inventory, ctx.data, null).at(-1);
    if (ctx.state.scope.site && portable) selectScope(ctx, portable.scope.tier);
    look(sampleId);
  };
  /** F at a fixed instrument: put one of the samples you carry in. */
  const useInstrument = (site: Site) => {
    const r = fixedAt(site);
    const what = site === 'lab' ? 'electron microscope' : 'beamline';
    if (!r) return flash(`The ${what} goes here once you build it`);
    if (!bag.length) return flash('Bring a sample: look (F) at something, and you take a bit of it along');
    const go = (id: string) => {
      selectScope(ctx, r.scope.tier);
      look(id);
    };
    if (bag.length === 1) go(bag[0]!);
    else openPicker(`Put a sample in the ${r.name}`, bag, go);
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
    if (!down) return;
    if (pick) {
      if (/^[1-9]$/.test(e.key)) choose(+e.key - 1);
      else if (e.key === 'Escape' || k === 'f') closePicker();
      return;
    }
    if (paused || !controls.isLocked) return;
    if (k === 'v' && !e.repeat) {
      thirdPerson = !thirdPerson;
      updateView();
      return;
    }
    const n = aimed();
    if (!n || e.repeat) return;
    if (k === 'e' && n.kind === 'npc') {
      controls.unlock();
      ctx.bus.emit('talkTo', { npcId: n.npcId! });
    } else if (k === 'e' && n.aim.gather) {
      if (lockedBy(n.aim.gather, ctx.data, ctx.state.discoveries)) flash(LOCKED_TEXT);
      else gatherNode(n);
    }
    if (k !== 'f') return;
    if (n === emNode) useInstrument('lab');
    else if (n === beamNode) useInstrument('chess');
    else if (n.aim.samples) openPicker(n.kind === 'picnic' ? 'On the table' : n.kind === 'pine_branch' ? 'From the branch' : 'Pick a sample', n.aim.samples, lookAt);
    else if (n.aim.sample) lookAt(n.aim.sample);
  };
  const onDown = (e: KeyboardEvent) => onKey(e, true);
  const onUp = (e: KeyboardEvent) => onKey(e, false);
  const onClick = () => !paused && !pick && controls.lock();
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
    if (n.kind === 'npc') {
      const npc = ctx.data.npcs[n.npcId!]!;
      return `E talk to ${npc.name}`;
    }
    if (n === emNode || n === beamNode) {
      const site: Site = n === emNode ? 'lab' : 'chess';
      const r = fixedAt(site);
      if (!r) return site === 'lab' ? 'Electron microscope bay: its parts are installed here as you build them' : 'Beamline control desk: build the beamline and it runs from here';
      return bag.length ? `F put a sample in the ${r.name} (${bag.length} carried)` : `${r.name}: bring a sample first`;
    }
    const parts: string[] = [];
    if (n.aim.gather) {
      const locked = lockedBy(n.aim.gather, ctx.data, ctx.state.discoveries);
      parts.push(locked ? 'E locked until identified' : `E gather ${ctx.data.items[n.aim.gather]?.name ?? n.aim.gather}`);
    }
    if (n.aim.samples) parts.push(`F look at one of ${n.aim.samples.length} samples`);
    else if (n.aim.sample) parts.push(`F look at ${sampleName(n.aim.sample)}`);
    return parts.join(' · ');
  };

  /** Push the player out of anything solid: walls, scenery blockers and live nodes. */
  const collide = (p: THREE.Vector3) => {
    const pushBox = (b: Box) => {
      const cx = Math.min(Math.max(p.x, b.x0), b.x1);
      const cz = Math.min(Math.max(p.z, b.z0), b.z1);
      const d = Math.hypot(p.x - cx, p.z - cz);
      if (d >= PLAYER_RADIUS) return;
      if (d > 1e-4) {
        p.x = cx + ((p.x - cx) / d) * PLAYER_RADIUS;
        p.z = cz + ((p.z - cz) / d) * PLAYER_RADIUS;
        return;
      }
      // centre inside the box: leave by the nearest side
      const r = PLAYER_RADIUS;
      const exits: [number, number][] = [[b.x0 - r, p.z], [b.x1 + r, p.z], [p.x, b.z0 - r], [p.x, b.z1 + r]];
      const [x, z] = exits.sort((u, v) => Math.hypot(u[0] - p.x, u[1] - p.z) - Math.hypot(v[0] - p.x, v[1] - p.z))[0]!;
      p.x = x;
      p.z = z;
    };
    campus.walls.forEach(pushBox);
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

  /** The part of campus the player is in, for the explorer achievement. */
  const areaAt = (x: number, z: number): string | null => {
    if (inLab(x, z)) return 'lab';
    if (inChess(x, z)) return 'chess';
    if (inGreenhouse(x, z)) return 'garden';
    if (Math.hypot(x + 38, z + 1) < 7) return 'tower';
    if (x < FALLS_X && Math.abs(z - gorgeZ(x)) < 7 && heightAt(x, z) < -5) return 'gorge';
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 9) return 'lake';
    if (Math.hypot(x + 58, z - 22) < 15) return 'forest';
    if (x < -46) return 'slope';
    if (x > -23 && x < 23 && z > -38 && z < 1) return 'quad';
    if (x > -46 && x < 50 && z > 40 && z < 110) return 'engquad';
    return null;
  };
  let areaCheck = 0;

  /** An arrow relative to where the player looks, then the distance. */
  const arrowTo = (x: number, z: number) => {
    const dx = x - camera.position.x;
    const dz = z - camera.position.z;
    camera.getWorldDirection(dir);
    const angle = (Math.atan2(-dir.z * dx + dir.x * dz, dir.x * dx + dir.z * dz) * 180) / Math.PI; // 0 = straight ahead, 90 = right
    const arrow = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][((Math.round(angle / 45) % 8) + 8) % 8]!;
    return `${arrow} ${Math.hypot(dx, dz).toFixed(0)} m`;
  };
  const nearest = (match: (n: Node) => boolean): Node | null => {
    let best = Infinity;
    let found: Node | null = null;
    for (const n of nodes) {
      const d = Math.hypot(n.x - camera.position.x, n.z - camera.position.z);
      if (n.alive && match(n) && d < best) {
        best = d;
        found = n;
      }
    }
    return found;
  };
  const showMarker = (m: THREE.Mesh, n: Node | null, t: number) => {
    m.visible = !!n && Math.hypot(n.x - camera.position.x, n.z - camera.position.z) < MARKER_RANGE;
    if (!n) return;
    m.position.set(n.x, n.center.y + n.aimRadius + 0.4 + 0.06 * Math.sin(t * 0.004), n.z);
    m.rotation.y = t * 0.002;
  };
  const doors: Record<Site, { x: number; z: number }> = { lab: { x: SCIENCE.x0 - 1, z: EM_SPOT.z }, chess: { x: WILSON.x0 - 1, z: -4 } };

  const footsteps = createFootstepTracker();
  const clock = new THREE.Clock();
  let raf = requestAnimationFrame(function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = performance.now();
    const previousX = camera.position.x;
    const previousZ = camera.position.z;

    if (controls.isLocked && !paused && !pick) {
      const p = camera.position;
      const ground = heightAt(p.x, p.z);
      const wading = ground < waterLevelAt(p.x, p.z);
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

    const { x: px, z: pz } = camera.position;
    setSite(ctx, inLab(px, pz) ? 'lab' : inChess(px, pz) ? 'chess' : null);
    if (t > areaCheck) {
      areaCheck = t + 500;
      const area = areaAt(px, pz);
      if (area) visit(ctx, area);
    }
    campus.update(t);
    const distance = Math.hypot(px - previousX, pz - previousZ);
    const active = controls.isLocked && !paused && !pick;
    const grounded = vy === 0 && camera.position.y <= heightAt(px, pz) + EYE_HEIGHT + 0.02;
    const running = keys.has('shift');
    if (footsteps.update(distance, !!active && grounded, running)) {
      const surface = heightAt(px, pz) < waterLevelAt(px, pz) ? 'water'
        : pathAt(px, pz) > 0.5 || inLab(px, pz) || inChess(px, pz) || inGreenhouse(px, pz) ? 'stone' : 'grass';
      ctx.bus.emit('footstep', { surface, running });
    }
    player.update(distance, dt);
    figures.forEach((f) => f.update(t));
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

    const n = controls.isLocked && !paused && !pick ? aimed() : null;
    const flashing = performance.now() < flashUntil;
    prompt.textContent = flashing ? flashText : describe(n);
    prompt.style.color = flashing ? '#ffb27a' : '#fff';
    ring.visible = !!n;
    if (n) {
      const radius = n.radius > 0 ? n.radius + 0.2 : 0.8;
      const rx = n === pondNode ? hitPoint.x : n.x;
      const rz = n === pondNode ? hitPoint.z : n.z;
      ring.position.set(rx, n === pondNode ? hitPoint.y + 0.03 : heightAt(rx, rz) + 0.05, rz);
      ring.scale.setScalar(radius * (1 + 0.04 * Math.sin(t * 0.006)));
    }
    // nearest live source of the tracked item, and the tracked sample or scientist
    const itemNode = tracked ? nearest((m) => m.aim.gather === tracked) : null;
    showMarker(marker, itemNode, t);
    trackHud.textContent = itemNode ? `${ctx.data.items[tracked!]?.name ?? tracked} ${arrowTo(itemNode.x, itemNode.z)}` : '';
    const tgt = target;
    const targetNode = !tgt ? null : tgt.kind === 'npc' ? nearest((m) => m.npcId === tgt.id) : nearest((m) => samplesOf(m.aim).includes(tgt.id));
    showMarker(targetMarker, targetNode, t);
    targetHud.textContent = targetNode && tgt
      ? `${tgt.kind === 'npc' ? ctx.data.npcs[tgt.id]?.name : sampleName(tgt.id)} ${arrowTo(targetNode.x, targetNode.z)}`
      : '';
    // what you carry, and where to take it
    const sites = (['lab', 'chess'] as const).filter((s) => fixedAt(s));
    const here = ctx.state.site;
    const names = bag.slice(0, 3).map(sampleName).join(', ') + (bag.length > 3 ? ` and ${bag.length - 3} more` : '');
    carryHud.textContent = !sites.length
      ? ''
      : here && sites.includes(here)
      ? bag.length ? `Carrying ${names}: aim at the ${fixedAt(here)!.name} and press F` : 'No sample yet: look (F) at something to take a bit along'
      : bag.length
      ? `Carrying ${names} · ${sites.map((s) => `${SITE_NAMES[s]} ${arrowTo(doors[s].x, doors[s].z)}`).join(' · ')}`
      : `Your ${sites.map((s) => fixedAt(s)!.name).join(' and ')}: look (F) at a sample to take some along`;
    compass.textContent = `${heading()} · ${px.toFixed(0)}, ${pz.toFixed(0)}`;
    camera.getWorldDirection(dir);
    minimap.update(px, pz, dir.x, dir.z, t, paused, targetNode);
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
      nodes: nodes.map((n) => ({ kind: n.kind, x: n.x, z: n.z, npc: n.npcId })),
      bag,
      /** Stand `dist` m south of the first node of a kind (or a scientist's id), looking at it. */
      lookAtKind(kind: string, dist = 2.5) {
        const n = nodes.find((m) => m.kind === kind || m.npcId === kind);
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
      [offOpen, offClose, offTrack, offTarget, offCrafted, offQuest, offScore, offDiscovery].forEach((off) => off());
      removeEventListener('keydown', onDown);
      removeEventListener('keyup', onUp);
      minimap.dispose();
      player.dispose();
      controls.dispose();
      renderer.dispose();
      el.replaceChildren();
    },
  };
}
