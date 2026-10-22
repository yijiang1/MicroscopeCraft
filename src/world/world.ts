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
import { carrySample, gather, ownedScopes, selectScope, setPlayerLocation, setSite, visit, type GameContext } from '../shared/state';
import { BEAM_SPOT, BRIDGE_RAILS, buildCampus, CRYSTAL_SPOT, EM_SPOT, groundAt, inChess, inLab, onDeck, SCIENCE, TOWER, WILSON } from './campus';
import { buildDecor, buildSky, FOG_COLOR, SUN_DIRECTION } from './decor';
import { createHud, createPicker } from './hud';
import type { WorldHandle } from './index';
import { buildModel, KINDS, samplesOf, type Aim, type Kind } from './kinds';
import { buildNpc, type NpcFigure } from './npc';
import { buildPlayer } from './player';
import { createFrameLoop } from './loop';
import { areaAt, arrowTo, collide, heading, type Solid } from './navigation';
import { PLACEMENTS, SPAWN, type Placement } from './placements';
import { buildTerrain, buildWater, deepWater, heightAt, LAKE, waterLevelAt, WATER_LEVEL, WORLD_RADIUS } from './terrain';

const EYE_HEIGHT = 1.7;
const WALK = 5;
const RUN = 8.5;
const GRAVITY = 20;
const JUMP = 6.2;
const REACH = 6;
const RESPAWN_MS = 15_000; // no scarcity: gathered things grow back
const ANIM_MS = 260;
const LOCKED_TEXT = 'Not identified yet: look at it first (F) through a microscope';
const MARKER_RANGE = 30; // the floating marker only shows when you are this close; the arrow always shows
const FRAME_MS = 1000 / 60; // walking: 60 fps is plenty, and a 120 Hz display would otherwise double the work
const IDLE_FRAME_MS = 1000 / 20; // mouse free (a menu, a dialog, the journal): only water and markers move
const SHADOW_SETTLE_FRAMES = 20; // keep redrawing shadows this long after a change, while limbs swing to rest

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
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // with antialiasing, 2× pixels cost far more than they show
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.6;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // three.js dropped PCFSoftShadowMap and falls back to this anyway
  // Shadows are redrawn only when something in them changed (redrawShadows): standing still or looking around in first
  // person costs no shadow pass.
  renderer.shadowMap.autoUpdate = false;
  let shadowFrames = SHADOW_SETTLE_FRAMES;
  const redrawShadows = () => (shadowFrames = SHADOW_SETTLE_FRAMES);
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
    const item = KINDS[kind].aim.gather;
    return !item || !lockedBy(item, ctx.data, ctx.state.discoveries);
  };
  const place = (n: Node, p: Placement, root: THREE.Object3D) => {
    root.position.set(p.x, heightAt(p.x, p.z) + (p.y ?? 0), p.z);
    if (p.yaw !== undefined) root.rotation.y = p.yaw;
    root.updateMatrixWorld(true);
    n.root = root;
  };
  const spawnNode = (p: Placement, index: number) => {
    const node: Node = { kind: p.kind, aim: KINDS[p.kind].aim, root: new THREE.Group(), x: p.x, z: p.z, radius: KINDS[p.kind].radius, alive: true, index, center: new THREE.Vector3(), aimRadius: 0 };
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
    kind: 'pond', aim: KINDS.pond.aim, root: water, x: LAKE.x, z: LAKE.z, radius: 0, alive: true, index: -1,
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
  const bag = ctx.state.carriedSamples;

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
    redrawShadows();
    updateMarkers();
  });

  const crystal = nodes.find((n) => n.kind === 'crystal');
  const crystalLight = new THREE.PointLight('#8a7bff', 14, 18, 2);
  crystalLight.position.set(CRYSTAL_SPOT.x, heightAt(CRYSTAL_SPOT.x, CRYSTAL_SPOT.z) + 2.6, CRYSTAL_SPOT.z);
  scene.add(crystalLight);

  const { group: decor, blockers, update: updateDecor } = buildDecor([...PLACEMENTS, ...Object.values(ctx.data.npcs)].map((p) => ({ x: p.x, z: p.z })));
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
    redrawShadows();
    updateMarkers();
  });
  const offQuest = ctx.bus.on('questCompleted', updateMarkers);
  const offScore = ctx.bus.on('minigameScored', updateMarkers);

  // --- player
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1500);
  const saved = ctx.state.playerLocation;
  const start = saved && Math.hypot(saved.x, saved.z) <= WORLD_RADIUS - 2 ? saved : null;
  const { x: startX, z: startZ } = start ?? SPAWN;
  camera.position.set(startX, groundAt(startX, startZ) + EYE_HEIGHT, startZ);
  if (start) camera.rotation.set(start.pitch, start.yaw, 0, 'YXZ');
  const controls = new PointerLockControls(camera, renderer.domElement);
  const player = buildPlayer();
  scene.add(player.root);
  const viewCamera = camera.clone();
  let thirdPerson = start?.thirdPerson ?? true;
  const facing = new THREE.Euler();
  const rememberPlayer = () => {
    facing.setFromQuaternion(camera.quaternion, 'YXZ');
    setPlayerLocation(ctx, { x: camera.position.x, z: camera.position.z, yaw: facing.y, pitch: facing.x, thirdPerson });
  };
  addEventListener('pagehide', rememberPlayer);
  document.addEventListener('visibilitychange', rememberPlayer);
  const viewDirection = new THREE.Vector3();
  const shoulder = new THREE.Vector3();
  const boom = new THREE.Vector3();
  const boomRay = new THREE.Raycaster();
  const lookPoint = new THREE.Vector3();
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
      viewCamera.lookAt(lookPoint.copy(camera.position).addScaledVector(viewDirection, REACH));
    }
    viewCamera.updateMatrixWorld();
  };
  updateView();
  let vy = 0;
  let paused = false;

  const hud = createHud(el);
  const picker = createPicker(el, ctx);

  const keys = new Set<string>();
  const ray = new THREE.Raycaster();
  ray.far = REACH;
  let hitPoint = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const toNode = new THREE.Vector3();
  /** The node under the crosshair: the nearest aim sphere the view line passes through, or the pond surface. */
  const aimed = (): Node | null => {
    viewCamera.getWorldDirection(dir);
    let best: Node | null = null;
    let bestT = Infinity;
    for (const n of nodes) {
      if (!n.alive) continue;
      if (n.center.distanceTo(camera.position) > REACH + n.aimRadius) continue;
      const v = toNode.copy(n.center).sub(viewCamera.position);
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
  const animate = (obj: THREE.Object3D, from: number, to: number, done?: () => void) => {
    if (paused) {
      obj.scale.setScalar(to);
      done?.();
    } else anims.push({ obj, from, to, start: performance.now(), done });
  };

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

  const sampleName = (id: string) => ctx.data.samples[id]?.name ?? id;
  const look = (sampleId: string) => {
    controls.unlock();
    ctx.bus.emit('openEyepiece', { sampleId });
  };
  /** F at a sample: take a bit along if you own a fixed instrument, and look through your best portable microscope. */
  const lookAt = (sampleId: string) => {
    if (ownsFixed()) carrySample(ctx, sampleId);
    const portable = ownedScopes(ctx.state.inventory, ctx.data, null).at(-1);
    if (ctx.state.scope.site && portable) selectScope(ctx, portable.scope.tier);
    look(sampleId);
  };
  /** F at a fixed instrument: put one of the samples you carry in. */
  const useInstrument = (site: Site) => {
    const r = fixedAt(site);
    const what = site === 'lab' ? 'electron microscope' : 'beamline';
    if (!r) return hud.flash(`The ${what} goes here once you build it`);
    if (!bag.length) return hud.flash('Bring a sample: look (F) at something, and you take a bit of it along');
    const go = (id: string) => {
      selectScope(ctx, r.scope.tier);
      look(id);
    };
    if (bag.length === 1) go(bag[0]!);
    else picker.open(`Put a sample in the ${r.name}`, bag, go);
  };

  const onKey = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    const move = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' }[k] ?? k;
    if (move !== k && controls.isLocked) e.preventDefault(); // no page scroll
    if (down) keys.add(move);
    else keys.delete(move);
    if (e.code === 'Space') {
      if (down) keys.add(' ');
      else keys.delete(' ');
      if (controls.isLocked) e.preventDefault();
    }
    if (!down) return;
    if (picker.isOpen()) {
      picker.key(e);
      return;
    }
    if (paused || !controls.isLocked) return;
    if (k === 'v' && !e.repeat) {
      thirdPerson = !thirdPerson;
      updateView();
      redrawShadows();
      return;
    }
    const n = aimed();
    if (!n || e.repeat) return;
    if (k === 'e' && n.kind === 'npc') {
      controls.unlock();
      ctx.bus.emit('talkTo', { npcId: n.npcId! });
    } else if (k === 'e' && n.aim.gather) {
      if (lockedBy(n.aim.gather, ctx.data, ctx.state.discoveries)) hud.flash(LOCKED_TEXT);
      else gatherNode(n);
    }
    if (k !== 'f') return;
    if (n === emNode) useInstrument('lab');
    else if (n === beamNode) useInstrument('chess');
    else if (n.aim.samples) picker.open(n.kind === 'picnic' ? 'On the table' : n.kind === 'pine_branch' ? 'From the branch' : 'Pick a sample', n.aim.samples, lookAt);
    else if (n.aim.sample) lookAt(n.aim.sample);
  };
  const onDown = (e: KeyboardEvent) => onKey(e, true);
  const onUp = (e: KeyboardEvent) => onKey(e, false);
  const onClick = () => !paused && !picker.isOpen() && controls.lock();
  addEventListener('keydown', onDown);
  addEventListener('keyup', onUp);
  renderer.domElement.addEventListener('click', onClick);
  const offOpen = ctx.bus.on('openEyepiece', () => {
    rememberPlayer();
    paused = true;
    keys.clear();
    loop.stop();
    // Finish pending gathering animations before a hidden respawn can replace them.
    for (const a of anims.splice(0)) {
      a.obj.scale.setScalar(a.to);
      a.done?.();
    }
  });
  const offClose = ctx.bus.on('closeEyepiece', () => {
    paused = false;
    keys.clear();
    redrawShadows();
    loop.start();
  });

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

  /** Everything round and solid: scenery, and the nodes (a gathered one is walkable until it grows back). */
  const solids: Solid[] = [...blockers.map((b) => ({ x: b.x, z: b.z, radius: b.r })), ...nodes];
  let areaCheck = 0;
  let lastQuarter = -1;
  /** The arrow and distance from the player to (x, z), relative to where they look. */
  const pointTo = (x: number, z: number) => {
    camera.getWorldDirection(dir);
    return arrowTo(x - camera.position.x, z - camera.position.z, dir.x, dir.z);
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

  // Regenerated rocks/scenery may now occupy the saved spot; restore on walkable ground.
  collide(camera.position, campus.walls, solids);
  camera.position.y = groundAt(camera.position.x, camera.position.z) + EYE_HEIGHT;
  setSite(ctx, inLab(camera.position.x, camera.position.z) ? 'lab' : inChess(camera.position.x, camera.position.z) ? 'chess' : null);
  rememberPlayer();
  updateView();

  const loop = createFrameLoop((dt, t) => {
    const previousX = camera.position.x;
    const previousY = camera.position.y;
    const previousZ = camera.position.z;
    const previousYaw = player.root.rotation.y;

    if (controls.isLocked && !paused && !picker.isOpen()) {
      const p = camera.position;
      const ground = heightAt(p.x, p.z);
      const wading = ground < waterLevelAt(p.x, p.z);
      const fwd = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
      const right = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
      // divide by the input length so diagonals aren't √2 faster
      const speed = ((keys.has('shift') ? RUN : WALK) * (wading ? 0.55 : 1) * dt) / (Math.hypot(fwd, right) || 1);
      controls.moveForward(fwd * speed);
      controls.moveRight(right * speed);
      // up on the bridge its side screens are walls too; down in the gorge you walk under it
      collide(p, onDeck(p.x, p.z, p.y - EYE_HEIGHT) ? [...campus.walls, ...BRIDGE_RAILS] : campus.walls, solids);
      // the creek and the big lake are off limits: slide along the water's edge instead (an old save may start in it)
      const inWater = (x: number, z: number) => deepWater(x, z) && !onDeck(x, z, p.y - EYE_HEIGHT);
      if (inWater(p.x, p.z) && !inWater(previousX, previousZ)) {
        if (!inWater(previousX, p.z)) p.x = previousX;
        else if (!inWater(p.x, previousZ)) p.z = previousZ;
        else p.set(previousX, p.y, previousZ);
      }
      const r = Math.hypot(p.x, p.z);
      if (r > WORLD_RADIUS - 2) p.multiplyScalar((WORLD_RADIUS - 2) / r); // keeps x, z; y is reset below
      const feet = groundAt(p.x, p.z, p.y - EYE_HEIGHT);
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
      camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z, camera.position.y - EYE_HEIGHT) + EYE_HEIGHT);
    }

    const { x: px, z: pz } = camera.position;
    rememberPlayer();
    setSite(ctx, inLab(px, pz) ? 'lab' : inChess(px, pz) ? 'chess' : null);
    if (t > areaCheck) {
      areaCheck = t + 500;
      const area = areaAt(px, pz);
      if (area) visit(ctx, area);
    }
    campus.update(t);
    // the tower bells, by the real clock: a chime each quarter hour, and the hour struck on the big bell
    const now = new Date();
    const quarter = Math.floor(now.getMinutes() / 15);
    if (quarter !== lastQuarter) {
      if (lastQuarter >= 0 && now.getMinutes() % 15 === 0) {
        ctx.bus.emit('towerBell', { quarter, hour: now.getHours() % 12 || 12, distance: Math.hypot(px - TOWER.x, pz - TOWER.z) });
      }
      lastQuarter = quarter;
    }
    player.update(Math.hypot(px - previousX, pz - previousZ), dt);
    figures.forEach((f) => f.update(t));
    updateDecor(t);
    updateView();
    if (px !== previousX || pz !== previousZ || camera.position.y !== previousY || player.root.rotation.y !== previousYaw || anims.length) redrawShadows();

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

    const n = controls.isLocked && !paused && !picker.isOpen() ? aimed() : null;
    hud.prompt(describe(n));
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
    hud.track(itemNode ? `${ctx.data.items[tracked!]?.name ?? tracked} ${pointTo(itemNode.x, itemNode.z)}` : '');
    const tgt = target;
    const targetNode = !tgt ? null : tgt.kind === 'npc' ? nearest((m) => m.npcId === tgt.id) : nearest((m) => samplesOf(m.aim).includes(tgt.id));
    showMarker(targetMarker, targetNode, t);
    hud.target(targetNode && tgt
      ? `${tgt.kind === 'npc' ? ctx.data.npcs[tgt.id]?.name : sampleName(tgt.id)} ${pointTo(targetNode.x, targetNode.z)}`
      : '');
    // what you carry, and where to take it
    const sites = (['lab', 'chess'] as const).filter((s) => fixedAt(s));
    const here = ctx.state.site;
    const names = bag.slice(0, 3).map(sampleName).join(', ') + (bag.length > 3 ? ` and ${bag.length - 3} more` : '');
    hud.carry(!sites.length
      ? ''
      : here && sites.includes(here)
      ? bag.length ? `Carrying ${names}: aim at the ${fixedAt(here)!.name} and press F` : 'No sample yet: look (F) at something to take a bit along'
      : bag.length
      ? `Carrying ${names} · ${sites.map((s) => `${SITE_NAMES[s]} ${pointTo(doors[s].x, doors[s].z)}`).join(' · ')}`
      : `Your ${sites.map((s) => fixedAt(s)!.name).join(' and ')}: look (F) at a sample to take some along`);
    camera.getWorldDirection(dir);
    hud.compass(`${heading(dir.x, dir.z)} · ${px.toFixed(0)}, ${pz.toFixed(0)}`);
    if (shadowFrames > 0) {
      shadowFrames--;
      renderer.shadowMap.needsUpdate = true;
    }
    renderer.render(scene, viewCamera);
  }, () => (controls.isLocked ? FRAME_MS : IDLE_FRAME_MS));
  loop.start();

  if (import.meta.env.DEV) {
    // Dev only: jump around for screenshots, e.g. __world.lookAtKind('iron').
    const teleport = (x: number, z: number, yawDeg = 0, pitchDeg = 0) => {
      camera.position.set(x, groundAt(x, z) + EYE_HEIGHT, z);
      camera.rotation.set(THREE.MathUtils.degToRad(pitchDeg), THREE.MathUtils.degToRad(yawDeg), 0, 'YXZ');
    };
    (window as unknown as { __world: unknown }).__world = {
      camera,
      controls,
      renderer,
      scene,
      teleport,
      nodes: nodes.map((n) => ({ kind: n.kind, x: n.x, z: n.z, npc: n.npcId })),
      bag,
      get renderFrames() { return renderer.info.render.frame; },
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
      loop.stop();
      timers.forEach((id) => clearTimeout(id));
      ro.disconnect();
      [offOpen, offClose, offTrack, offTarget, offCrafted, offQuest, offScore, offDiscovery].forEach((off) => off());
      removeEventListener('keydown', onDown);
      removeEventListener('keyup', onUp);
      removeEventListener('pagehide', rememberPlayer);
      document.removeEventListener('visibilitychange', rememberPlayer);
      player.dispose();
      controls.dispose();
      renderer.dispose();
      el.replaceChildren();
    },
  };
}
