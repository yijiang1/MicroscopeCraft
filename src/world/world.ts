import { binocularFov, mountBinoculars } from './binoculars';
import { buildFishingRod, type FishingAction } from './fishing-rod';
import { buildFish, fishingWaterPoint, mountFishing } from './fishing';
import { blocksRoadster, buildMiata, driveStep, roadsterGradeOK, TEST_DRIVE_MS } from './miata';
import { advanceLift, buildTowerLift, constrainTerrace, LIFT, liftBase, nearLift } from './tower-lift';
import { mountSpeechOverlay } from './speech-overlay';
import { buildActivityStation, STATIONS } from './activity-stations';
// The open world: a university campus, which you walk and jump across, and 3D models you gather or look at.
// Fixed instruments stay where they are installed: the electron microscopes in the science lab, the CHESS beamline in
// Wilson Lab. Look (F) at a sample to take a bit along, carry it there and press F at the instrument.
// Scientists stand around campus: press E to talk to them. Cabinets hold several samples: F, then pick one.
// Click to lock the mouse; WASD move, Shift run, Space jump, E gather or talk, F look at the aimed sample.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { conditionMet } from '../shared/achievements';
import { lockedBy, SITE_NAMES } from '../shared/plan';
import { missionSample } from '../shared/mysteryActions';
import type { Site } from '../shared/schema';
import { carrySample, gather, ownedScopes, selectScope, setPlayerLocation, setSite, visit, type GameContext } from '../shared/state';
import { BEAM_SPOT, BRIDGE_RAILS, buildCampus, CRYSTAL_SPOT, EM_SPOT, groundAt, inChess, inLab, onDeck, SCIENCE, TOWER, WILSON } from './campus';
import { buildDecor, buildSky, FOG_COLOR, SUN_DIRECTION } from './decor';
import { createHud, createPicker } from './hud';
import type { WorldHandle } from './index';
import { buildModel, KINDS, samplesOf, type Aim, type Kind } from './kinds';
import { buildNpc, type NpcFigure } from './npc';
import { createScientistLife } from './scientist-life';
import { mountMinimap } from './minimap';
import { createFootstepTracker } from './footsteps';
import { buildPlayer } from './player';
import { createFrameLoop } from './loop';
import { areaAt, arrowTo, collide, heading, type Solid } from './navigation';
import { PLACEMENTS, SPAWN, type Placement } from './placements';
import { buildTerrain, buildWater, deepWater, pathAt, heightAt, LAKE, waterLevelAt, WATER_LEVEL, WORLD_RADIUS } from './terrain';

const EYE_HEIGHT = 1.7;
const WALK = 5;
const RUN = 8.5;
const GRAVITY = 20;
const JUMP = 6.2;
const REACH = 6;
const RESPAWN_MS = 15_000; // no scarcity: gathered things grow back
const ANIM_MS = 260;
const LOCKED_TEXT = 'Not identified yet: look at it first [F] through a microscope';
const MARKER_RANGE = 30; // the floating marker only shows when you are this close; the arrow always shows
const FRAME_MS = 1000 / 60; // walking: 60 fps is plenty, and a 120 Hz display would otherwise double the work
const IDLE_FRAME_MS = 1000 / 20; // mouse free (a menu, a dialog, the journal): only water and markers move
const SHADOW_SETTLE_FRAMES = 20; // keep redrawing shadows this long after a change, while limbs swing to rest
const NPC_SHADOW_RANGE = 45; // the sun's shadow box is 76 m across, centred on the player
const NPC_SHADOW_MS = 200; // a strolling scientist's shadow catches up five times a second

interface Node {
  /** 'em': the electron microscopes in the lab; 'beam': the CHESS beamline's desk; 'npc': a scientist. */
  kind: Kind | 'em' | 'beam' | 'npc' | 'activity';
  activity?: 'store' | 'lab' | 'chess';
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
  const fish = buildFish(); scene.add(fish.group);
  const campus = buildCampus();
  const lift = buildTowerLift(); scene.add(lift.group);
  let liftHeight = 0;
  let liftTarget = 0;
  let ridingLift = false;
  let onTerrace = false;
  const playerGround = (x: number, z: number, feet = Infinity) => onTerrace ? liftBase + LIFT.rise : groundAt(x, z, feet);
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

  for (const station of STATIONS) {
    const root = buildActivityStation(station); scene.add(root);
    nodes.push({ kind: 'activity', activity: station.activity, aim: {}, root, x: station.x, z: station.z, radius: 1, alive: true, index: -1, center: root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), aimRadius: 1 });
  }
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
  const fishingRod=buildFishingRod(player.root);scene.add(fishingRod.group);
  let fishingAction: FishingAction = 'idle';
  let fishingView = true;
  const viewCamera = camera.clone();
  const binoculars=mountBinoculars(ctx);
  const driver = buildPlayer(); driver.seated(); driver.root.scale.setScalar(0.72); driver.root.position.set(-0.39,0.24,0.4);
  const roadster = buildMiata(); roadster.root.add(driver.root); roadster.root.visible = false; scene.add(roadster.root);
  let driving = false, driveSpeed = 0, driveYaw = 0, driveDeadline = 0;
  let driveTimer: ReturnType<typeof setTimeout> | undefined;
  let savedThirdPerson = true;
  let thirdPerson = start?.thirdPerson ?? true;
  const facing = new THREE.Euler();
  const rememberPlayer = () => {
    facing.setFromQuaternion(camera.quaternion, 'YXZ');
    setPlayerLocation(ctx, { x: driving ? -12 : camera.position.x, z: driving ? 35.5 : camera.position.z, yaw: facing.y, pitch: facing.x, thirdPerson });
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
    player.root.visible = thirdPerson && !binoculars.active();
    viewCamera.position.copy(camera.position);
    viewCamera.quaternion.copy(camera.quaternion);
    if (thirdPerson && !binoculars.active()) {
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
    if (driving) {
      player.root.visible = false;
      camera.rotation.set(0,driveYaw,0,'YXZ');
      roadster.root.position.set(camera.position.x, camera.position.y - EYE_HEIGHT, camera.position.z);
      roadster.root.rotation.y = driveYaw;
      viewCamera.position.set(camera.position.x + Math.sin(driveYaw) * 6, camera.position.y + 2.5, camera.position.z + Math.cos(driveYaw) * 6);
      viewCamera.lookAt(camera.position.x - Math.sin(driveYaw) * 4, camera.position.y - 0.3, camera.position.z - Math.cos(driveYaw) * 4);
    }
    const fov=binoculars.active()?binocularFov(camera.fov):camera.fov;
    if(viewCamera.fov!==fov){viewCamera.fov=fov;viewCamera.updateProjectionMatrix();}
    viewCamera.updateMatrixWorld();
  };
  updateView();
  let vy = 0;
  let paused = false;

  const hud = createHud(el);
  hud.workbench(ctx.state.advanced);
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

  const sampleName = (id: string) => missionSample(ctx, id)?.name ?? id;
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
    if (!bag.length) return hud.flash('Bring a sample: look [F] at something, and you take a bit of it along');
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
    if (k==='b'&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.repeat) {
      if (!paused&&!driving&&fishingAction==='idle'&&!document.querySelector('dialog[open]')&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)&&!(e.target instanceof HTMLSelectElement)&&!(e.target as HTMLElement).isContentEditable) binoculars.toggle();
      return;
    }
    if (paused || (!controls.isLocked && !driving)) return;
    if (driving) { if (k === 'e' && !e.repeat) finishDrive(); return; }
    if (k === 'v' && !e.repeat) {
      thirdPerson = !thirdPerson;
      updateView();
      redrawShadows();
      return;
    }
    if (k === 'e' && !e.repeat && !ridingLift && nearLift(camera.position.x, camera.position.z)) {
      ridingLift = true; liftTarget = onTerrace ? 0 : LIFT.rise;
      liftHeight = onTerrace ? LIFT.rise : 0;
      camera.position.x = LIFT.x; camera.position.z = LIFT.z;
      hud.flash(onTerrace ? 'Returning to campus…' : 'Ascending to the campus lookout…');
      return;
    }
    if (ridingLift) return;
    const n = aimed();
    if (!n || e.repeat) return;
    if (k === 'e' && n.activity) { controls.unlock(); ctx.bus.emit('openCampusActivity', { activity: n.activity }); return; }
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
  // The eyepiece and the workbench each cover the world: it stops (no drawing, no movement) while either is open.
  let atBench = false;
  const pauseWorld = () => {
    binoculars.close();
    rememberPlayer();
    paused = true;
    keys.clear();
    loop.stop();
    // Finish pending gathering animations before a hidden respawn can replace them.
    for (const a of anims.splice(0)) {
      a.obj.scale.setScalar(a.to);
      a.done?.();
    }
  };
  const resumeWorld = () => {
    if (atBench || ctx.state.currentSampleId) return; // still covered by the other one
    paused = false;
    keys.clear();
    redrawShadows();
    loop.start();
  };
  const offOpen = ctx.bus.on('openEyepiece', pauseWorld);
  const offClose = ctx.bus.on('closeEyepiece', resumeWorld);
  const offBench = ctx.bus.on('openWorkbench', () => {
    atBench = true;
    controls.unlock();
    pauseWorld();
  });
  const offBenchClose = ctx.bus.on('closeWorkbench', () => {
    atBench = false;
    resumeWorld();
  });
  const offMode = ctx.bus.on('modeChanged', ({ advanced }) => hud.workbench(advanced));

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
    if (n.activity) return `[E] ${STATIONS.find(s => s.activity === n.activity)!.name}`;
    if (n.kind === 'npc') {
      const npc = ctx.data.npcs[n.npcId!]!;
      return `[E] Talk to ${npc.name}`;
    }
    if (n === emNode || n === beamNode) {
      const site: Site = n === emNode ? 'lab' : 'chess';
      const r = fixedAt(site);
      if (!r) return site === 'lab' ? 'Electron microscope bay: its parts are installed here as you build them' : 'Beamline control desk: build the beamline and it runs from here';
      return bag.length ? `[F] Put a sample in the ${r.name} (${bag.length} carried)` : `${r.name}: bring a sample first`;
    }
    const parts: string[] = [];
    if (n.aim.gather) {
      const locked = lockedBy(n.aim.gather, ctx.data, ctx.state.discoveries);
      parts.push(locked ? '🔒 Identify it first to gather' : `[E] Gather ${ctx.data.items[n.aim.gather]?.name ?? n.aim.gather}`);
    }
    if (n.aim.samples) parts.push(`[F] Look at one of ${n.aim.samples.length} samples`);
    else if (n.aim.sample) parts.push(`[F] Look at ${sampleName(n.aim.sample)}`);
    return parts.join('   ');
  };

  /** Everything round and solid: scenery, and the nodes (a gathered one is walkable until it grows back). */
  const scenerySolids = blockers.map((b) => ({ x: b.x, z: b.z, radius: b.r }));
  const solids: Solid[] = [...scenerySolids, ...nodes];
  const carSolids: Solid[] = [...scenerySolids, ...nodes.filter(n => blocksRoadster(n.kind))];
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

  const life = createScientistLife(Object.values(ctx.data.npcs));
  const npcNodes = new Map(nodes.filter(n => n.npcId).map(n => [n.npcId!, n]));
  const canRoam = (walker: { id: string; x: number; z: number }, x: number, z: number) => {
    if (deepWater(x, z) || Math.abs(groundAt(x, z) - groundAt(walker.x, walker.z)) > 0.4) return false;
    const p = { x, z };
    collide(p, campus.walls, solids.filter(s => s !== npcNodes.get(walker.id)));
    return Math.hypot(p.x - x, p.z - z) < 0.001 && Math.hypot(x - camera.position.x, z - camera.position.z) > 0.9;
  };
  const minimap = mountMinimap(el, life.walkers, open => ctx.bus.emit('campusActivityChanged', { open }));
  const speech = mountSpeechOverlay(el);
  const offActivity = ctx.bus.on('campusActivityChanged', ({ open }) => { paused = open; keys.clear(); if (open) { binoculars.close(); controls.unlock(); } });
  const dress = () => { player.equip(ctx.state.economy); redrawShadows(); };
  dress();
  const offDress = ctx.bus.on('economyChanged', dress);
  const finishDrive = () => {
    if (!driving) return;
    driving = false; clearTimeout(driveTimer); driveSpeed = 0; keys.clear();
    roadster.root.visible = false; thirdPerson = savedThirdPerson; vy = 0;
    camera.position.set(-12, groundAt(-12,35.5) + EYE_HEIGHT,35.5);
    camera.rotation.set(0,0,0,'YXZ'); rememberPlayer(); redrawShadows();
    controls.unlock(); ctx.bus.emit('openCampusActivity', { activity: 'store' });
  };
  const offBinoculars=ctx.bus.on('toggleBinoculars',()=>{if(!paused&&!driving&&fishingAction==='idle')binoculars.toggle();});
  const lowerBinoculars=()=>binoculars.close();controls.addEventListener('unlock',lowerBinoculars);
  const offDrive = ctx.bus.on('driveMiata', ({ trial }) => {
    if (driving || (!trial && !ctx.state.economy.owned.includes('miata_na'))) return;
    binoculars.close(); ridingLift = false; onTerrace = false; paused = false; keys.clear(); vy = 0;
    driver.equip(ctx.state.economy);
    savedThirdPerson = thirdPerson; thirdPerson = true;
    driving = true; driveSpeed = 0; driveYaw = -Math.PI / 2;
    driveDeadline = trial ? performance.now() + TEST_DRIVE_MS : Infinity;
    camera.position.set(-12, groundAt(-12,42) + EYE_HEIGHT,42);
    roadster.root.visible = true;
    if (trial) driveTimer = setTimeout(finishDrive, TEST_DRIVE_MS);
    hud.flash('Micro Roadster · W/S accelerate & reverse · A/D steer · E return to store');
    redrawShadows();
  });
  const fishing = mountFishing(ctx, lookAt, (action,color) => {
    if(action==='ready'&&fishingAction==='idle'){
      fishingView=thirdPerson;thirdPerson=true;
      const water=fishingWaterPoint(camera.position.x,camera.position.z,camera.position.y-EYE_HEIGHT);
      if(water) camera.rotation.set(-.15,Math.atan2(camera.position.x-water.x,camera.position.z-water.z),0,'YXZ');
    }
    if(action==='idle') thirdPerson=fishingView;
    fishingAction=action;
    fishingRod.action(action,fishingWaterPoint(camera.position.x,camera.position.z,camera.position.y-EYE_HEIGHT)??undefined,color);
    redrawShadows();
  });
  const footsteps = createFootstepTracker();
  let npcShadowAt = 0;
  const wasMoving = new Map<string, boolean>();
  const loop = createFrameLoop((dt, t) => {
    const previousX = camera.position.x;
    const previousY = camera.position.y;
    const previousZ = camera.position.z;
    const previousYaw = player.root.rotation.y;

    if (driving) {
      if (performance.now() >= driveDeadline) finishDrive();
      else if (!paused) {
        const step = driveStep(driveSpeed, (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0), (keys.has('a') ? 1 : 0) - (keys.has('d') ? 1 : 0), driveYaw, dt);
        const x = camera.position.x + step.dx, z = camera.position.z + step.dz;
        let blocked = Math.hypot(x,z) > WORLD_RADIUS - 4 || !roadsterGradeOK(groundAt(x,z) - groundAt(camera.position.x,camera.position.z), Math.hypot(step.dx,step.dz));
        // Check the car's full footprint, including corners, against buildings and people.
        for (const side of [-0.8,0,0.8]) for (const front of [-1.7,0,1.7]) {
          const q = { x: x + side * Math.cos(step.yaw) + front * Math.sin(step.yaw), z: z - side * Math.sin(step.yaw) + front * Math.cos(step.yaw) };
          const before = { ...q }; collide(q, campus.walls, carSolids);
          if (Math.hypot(q.x-before.x,q.z-before.z) > 0.001 || deepWater(before.x,before.z) || !roadsterGradeOK(groundAt(before.x,before.z) - groundAt(x,z), Math.hypot(side,front))) blocked = true;
        }
        if (blocked) driveSpeed = 0;
        else { driveSpeed = step.speed; driveYaw = step.yaw; camera.position.set(x,groundAt(x,z)+EYE_HEIGHT,z); }
      }
    } else if (ridingLift) {
      if (!paused) liftHeight = advanceLift(liftHeight, liftTarget, dt);
      lift.cabin.position.y = liftBase + liftHeight;
      camera.position.set(LIFT.x, liftBase + liftHeight + EYE_HEIGHT, LIFT.z); vy = 0;
      if (liftHeight === liftTarget) { ridingLift = false; onTerrace = liftTarget > 0; hud.flash(onTerrace ? 'Campus lookout · Explore the terrace; E at the elevator to descend' : 'Back on campus'); }
    } else if (controls.isLocked && !paused && !picker.isOpen()) {
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
      collide(p, onDeck(p.x, p.z, p.y - EYE_HEIGHT) ? [...campus.walls, ...BRIDGE_RAILS] : campus.walls, onTerrace ? [] : solids);
      if (onTerrace) constrainTerrace(p);
      // the creek and the big lake are off limits: slide along the water's edge instead (an old save may start in it)
      const inWater = (x: number, z: number) => deepWater(x, z) && !onDeck(x, z, p.y - EYE_HEIGHT);
      if (inWater(p.x, p.z) && !inWater(previousX, previousZ)) {
        if (!inWater(previousX, p.z)) p.x = previousX;
        else if (!inWater(p.x, previousZ)) p.z = previousZ;
        else p.set(previousX, p.y, previousZ);
      }
      const r = Math.hypot(p.x, p.z);
      if (r > WORLD_RADIUS - 2) p.multiplyScalar((WORLD_RADIUS - 2) / r); // keeps x, z; y is reset below
      const feet = playerGround(p.x, p.z, p.y - EYE_HEIGHT);
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
      camera.position.y = Math.max(camera.position.y, playerGround(camera.position.x, camera.position.z, camera.position.y - EYE_HEIGHT) + EYE_HEIGHT);
    }

    const { x: px, z: pz } = camera.position;
    rememberPlayer();
    setSite(ctx, inLab(px, pz) ? 'lab' : inChess(px, pz) ? 'chess' : null);
    if (t > areaCheck) {
      areaCheck = t + 500;
      const area = areaAt(px, pz);
      if (area) visit(ctx, area);
    }
    campus.update(t); fish.update(t);
    fishing.update(px,pz,camera.position.y-EYE_HEIGHT,!paused&&!driving&&!ridingLift&&!onTerrace,t);
    ctx.bus.emit('musicScene', { distance: Math.hypot(px - TOWER.x, pz - TOWER.z), indoors: inLab(px, pz) || inChess(px, pz) });
    // the tower bells, by the real clock: a chime each quarter hour, and the hour struck on the big bell
    const now = new Date();
    const quarter = Math.floor(now.getMinutes() / 15);
    if (quarter !== lastQuarter) {
      if (lastQuarter >= 0 && now.getMinutes() % 15 === 0) {
        ctx.bus.emit('towerBell', { quarter, hour: now.getHours() % 12 || 12, distance: Math.hypot(px - TOWER.x, pz - TOWER.z) });
      }
      lastQuarter = quarter;
    }
    const distance = Math.hypot(px - previousX, pz - previousZ);
    const grounded = vy === 0 && camera.position.y <= playerGround(px, pz) + EYE_HEIGHT + 0.02;
    const running = keys.has('shift');
    if (footsteps.update(distance, controls.isLocked && !paused && !driving && !picker.isOpen() && grounded, running)) {
      const surface = heightAt(px, pz) < waterLevelAt(px, pz) ? 'water'
        : pathAt(px, pz) > 0.5 || inLab(px, pz) || inChess(px, pz) ? 'stone' : 'grass';
      ctx.bus.emit('footstep', { surface, running });
    }
    player.update(distance, dt);
    if(fishingAction!=='idle') player.fishing(performance.now(),fishingAction==='reel');
    life.update(dt, camera.position, canRoam, paused);
    for (const w of life.walkers) {
      const n = npcNodes.get(w.id)!;
      const f = figures.get(w.id)!;
      n.x = w.x; n.z = w.z;
      n.root.position.set(w.x, groundAt(w.x, w.z), w.z);
      n.center.set(w.x, n.root.position.y + 1.2, w.z);
      n.root.rotation.y = w.yaw;
      f.update(t, w.moving);
      f.setSpeaking(!!w.speech && Math.hypot(w.x - px, w.z - pz) < 18);
      // A walker inside the shadow map's reach redraws it a few times a second, not every frame; stopping settles it.
      if (Math.hypot(w.x - px, w.z - pz) < NPC_SHADOW_RANGE) {
        if (w.moving && t >= npcShadowAt) { renderer.shadowMap.needsUpdate = true; npcShadowAt = t + NPC_SHADOW_MS; }
        if (w.moving !== wasMoving.get(w.id)) redrawShadows();
      }
      wasMoving.set(w.id, w.moving);
    }
    updateDecor(t);
    updateView(); fishingRod.update(performance.now());
    if(fishingAction!=='idle') redrawShadows();
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
    hud.prompt(driving ? `Micro Roadster · ${Number.isFinite(driveDeadline) ? `${Math.max(0,Math.ceil((driveDeadline-performance.now())/1000))}s left · ` : ''}W/S drive · A/D steer · E return` : ridingLift ? 'Elevator · Enjoy the view' : nearLift(px, pz) ? `[E] Elevator · ${onTerrace ? 'Return to campus' : 'Campus lookout'}` : describe(n));
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
      ? ctx.state.mystery && !ctx.state.mystery.conclusion ? 'Bragg’s unknown is in your sample bag. Build a TEM to measure its diffraction rings.' : ''
      : here && sites.includes(here)
      ? bag.length ? `Carrying ${names}: aim at the ${fixedAt(here)!.name} and press [F]` : 'No sample yet: look [F] at something to take a bit along'
      : bag.length
      ? `Carrying ${names} · ${sites.map((s) => `${SITE_NAMES[s]} ${pointTo(doors[s].x, doors[s].z)}`).join(' · ')}`
      : `Your ${sites.map((s) => fixedAt(s)!.name).join(' and ')}: look [F] at a sample to take some along`);
    camera.getWorldDirection(dir);
    hud.compass(`${heading(dir.x, dir.z)} · ${px.toFixed(0)}, ${pz.toFixed(0)}`);
    if (shadowFrames > 0) {
      shadowFrames--;
      renderer.shadowMap.needsUpdate = true;
    }
    minimap.update(px, pz, dir.x, dir.z, t, paused, targetNode);
    speech.update(life.walkers.map(w => ({ id: w.id, name: ctx.data.npcs[w.id]!.name, text: w.speech, partnerId: w.partnerId, partnerName: w.partnerId ? ctx.data.npcs[w.partnerId]?.name : undefined, position: npcNodes.get(w.id)!.root.position })), viewCamera, campus.group, t, paused);
    renderer.render(scene, viewCamera);
  }, () => (controls.isLocked ? FRAME_MS : IDLE_FRAME_MS));
  loop.start();

  if (import.meta.env.DEV) {
    // Dev only: jump around for screenshots, e.g. __world.lookAtKind('iron').
    const teleport = (x: number, z: number, yawDeg = 0, pitchDeg = 0) => {
      onTerrace = false; ridingLift = false;
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
      [offOpen, offClose, offBench, offBenchClose, offMode, offTrack, offTarget, offCrafted, offQuest, offScore, offDiscovery].forEach((off) => off());
      removeEventListener('keydown', onDown);
      removeEventListener('keyup', onUp);
      removeEventListener('pagehide', rememberPlayer);
      document.removeEventListener('visibilitychange', rememberPlayer);
      offBinoculars();controls.removeEventListener('unlock',lowerBinoculars);binoculars.dispose();
      fishing.dispose(); fishingRod.dispose(); minimap.dispose();
      speech.dispose(); offActivity(); offDress(); offDrive(); clearTimeout(driveTimer);
      driver.dispose(); player.dispose();
      controls.dispose();
      renderer.dispose();
      el.replaceChildren();
    },
  };
}
