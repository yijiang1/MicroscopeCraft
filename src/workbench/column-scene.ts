// The electron microscope on the electron bench, in 3D. The parts are revolved outlines with a wedge cut away toward
// the viewer, so the inside of the column shows: iron yokes with tapered pole pieces around copper coils, the gun's
// ribbed ceramic insulator, aperture strips and the side-entry holder. Ported from the TEM explorer of My First
// Microscope (tem-explorer.html). Parts still to place show as glowing outlines; the beam runs once the column is
// pumped, the high voltage is on and the filament is warm. Scene units are decimetres; the column stands on y = 0.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { APERTURES_UM } from '../shared/sim/column';
import { COLUMN_PARTS, type ColumnPartId } from './column';

/** Heights in the column, dm. */
const Y = { base: 2.6, screen: 3.2, chamberTop: 5.0, proj1: 5.6, proj2: 6.6, objective: 8.0, aperture: 7.45, specimen: 8.0, c1: 10.4, c2: 9.5, cap: 9.95, gun: 11.6 };
/** The cutaway: each part is revolved from PHI0 through PHIL, leaving a wedge open toward +z. */
const PHI0 = Math.PI * 0.375;
const PHIL = Math.PI * 1.25;
const TAU = Math.PI * 2;
/** Spacing of the holes along the objective aperture strip, dm. */
const HOLE_PITCH = 0.32;

export interface ColumnView {
  placed: readonly ColumnPartId[];
  ghosts: readonly ColumnPartId[];
  /** 0..1 of the saturated current; 0 = no beam. */
  beam: number;
  /** Filament heating, 0..1. */
  heat: number;
  apertureUm: number | null;
  selected: ColumnPartId | null;
}

export interface ColumnScene {
  update(v: ColumnView, instant?: boolean): void;
  /** The viewing screen's picture changed. */
  screenChanged(): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
const M = {
  steel: std({ color: '#2a3038', metalness: 0.8, roughness: 0.45 }),
  cover: std({ color: '#d9dcd6', metalness: 0.1, roughness: 0.5 }),
  cut: std({ color: '#8d96a0', metalness: 0.5, roughness: 0.55 }),
  copper: std({ color: '#b8693a', metalness: 1, roughness: 0.32 }),
  copperCut: std({ color: '#cf8450', metalness: 1, roughness: 0.28 }),
  ceramic: new THREE.MeshPhysicalMaterial({ color: '#c9c3b6', roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
  brass: std({ color: '#c9a14a', metalness: 1, roughness: 0.28 }),
  rubber: std({ color: '#14171c', roughness: 0.55 }),
  anodized: std({ color: '#1e3a8a', metalness: 0.7, roughness: 0.35 }),
  cabinet: std({ color: '#3a4250', metalness: 0.3, roughness: 0.6 }),
};

/** Revolve a closed outline of [radius, y] points about the beam axis with the wedge cut away, and cap the cut faces
 *  so each part reads as a solid section. */
function solid(outline: [number, number][], mat: THREE.Material, capMat: THREE.Material = M.cut): THREE.Group {
  const pts = outline.map(([r, y]) => new THREE.Vector2(r, y));
  const sides = pts.map((p, i) => new THREE.LatheGeometry([p, pts[(i + 1) % pts.length]!], 72, PHI0, PHIL));
  const shape = new THREE.Shape(pts);
  const caps = [PHI0, PHI0 + PHIL].map((phi) => new THREE.ShapeGeometry(shape).rotateY(phi - Math.PI / 2));
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeGeometries(sides), mat), new THREE.Mesh(mergeGeometries(caps), capMat));
  return g;
}
const tube = (y0: number, y1: number, r0 = 0.45, r1 = 0.55): [number, number][] => [[r0, y0], [r1, y0], [r1, y1], [r0, y1]];

/** Magnetic lens: an iron yoke with tapered pole pieces around a copper coil, centred at y. */
function lens(y: number, { h = 0.42, rb = 0.42, R = 1.35, t = 0.16, g = 0.2 } = {}): THREE.Group {
  const yoke: [number, number][] = [[rb, -g / 2], [rb, -h], [R, -h], [R, h], [rb, h], [rb, g / 2], [rb + t, g / 2 + 0.1], [rb + t, h - t], [R - t, h - t], [R - t, -h + t], [rb + t, -h + t], [rb + t, -g / 2 - 0.1]];
  const coil: [number, number][] = [[rb + t + 0.04, -h + t + 0.03], [R - t - 0.03, -h + t + 0.03], [R - t - 0.03, h - t - 0.03], [rb + t + 0.04, h - t - 0.03]];
  const at = (o: [number, number][]) => o.map(([r, z]) => [r, y + z] as [number, number]);
  const group = new THREE.Group();
  group.add(solid(at(yoke), M.steel), solid(at(coil), M.copper, M.copperCut));
  return group;
}

/** Aperture strip: a thin foil with a row of holes on a rod that runs out through the column wall to a drive. */
function strip(holesUm: readonly number[], drawScale: number): THREE.Group {
  const x1 = (holesUm.length - 1) * HOLE_PITCH + 0.2;
  const s = new THREE.Shape([[-0.2, -0.14], [x1, -0.14], [x1, 0.14], [-0.2, 0.14]].map(([x, y]) => new THREE.Vector2(x, y)));
  holesUm.forEach((um, i) => {
    const hole = new THREE.Path();
    hole.absarc(i * HOLE_PITCH, 0, Math.max(0.025, um * drawScale), 0, TAU, true);
    s.holes.push(hole);
  });
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 32 }).rotateX(Math.PI / 2), M.cut);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 12).rotateZ(Math.PI / 2), M.cut);
  rod.position.set(x1 + 0.8, -0.015, 0);
  const g = new THREE.Group();
  g.add(plate, rod);
  return g;
}

/** The barrel outside the column that drives an aperture rod, with its flange. */
function drive(x: number, y: number): THREE.Group {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.2, 20).rotateZ(Math.PI / 2), M.steel);
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 28).rotateZ(Math.PI / 2), M.steel);
  barrel.position.set(x + 0.6, y, 0);
  flange.position.set(x + 0.025, y, 0);
  g.add(barrel, flange);
  return g;
}

interface Built {
  group: THREE.Group;
  /** Moves with the chosen aperture (objective only). */
  strip?: THREE.Group;
  /** The glowing tip and its light (gun only). */
  filament?: { tip: THREE.Mesh; light: THREE.PointLight };
}

function buildPart(id: ColumnPartId, screenTex: THREE.Texture): Built {
  const g = new THREE.Group();
  switch (id) {
    case 'vacuum': {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(6, Y.base, 4.4).translate(0, Y.base / 2, -0.4), M.cabinet);
      const kick = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.25, 4.0).translate(0, 0.125, -0.2), M.rubber);
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.12, 48).translate(0, Y.base + 0.06, 0), M.steel);
      // a turbo pump hanging off the side of the column on its pipe, and the roughing pump on the floor behind
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.4, 20).rotateZ(Math.PI / 2).translate(2.2, Y.base + 1.1, -1.2), M.steel);
      const turbo = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 32).translate(3.5, Y.base + 0.55, -1.2), M.cover);
      const rough = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.8).translate(4.6, 0.45, -2.4), M.anodized);
      g.add(cabinet, kick, flange, pipe, turbo, rough);
      return { group: g };
    }
    case 'screen': {
      // the chamber, cut away at the front, with the green screen inside
      const chamber = solid([[0.6, Y.base + 0.12], [1.9, Y.base + 0.12], [1.9, Y.chamberTop], [0.55, Y.chamberTop], [0.55, Y.chamberTop - 0.12], [1.78, Y.chamberTop - 0.12], [1.78, Y.base + 0.24], [0.6, Y.base + 0.24]], M.steel);
      const screen = new THREE.Mesh(
        new THREE.CircleGeometry(1.5, 64).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: '#05070a', roughness: 0.85, emissive: '#ffffff', emissiveMap: screenTex, emissiveIntensity: 1 }),
      );
      screen.position.y = Y.screen;
      g.add(chamber, screen, solid(tube(Y.chamberTop, Y.proj1 - 0.42), M.steel));
      return { group: g };
    }
    case 'projector':
      g.add(lens(Y.proj1, { h: 0.45, rb: 0.5, R: 1.4 }), solid(tube(Y.proj1 + 0.45, Y.proj2 - 0.45), M.steel), lens(Y.proj2, { h: 0.45, rb: 0.5, R: 1.45 }));
      g.add(solid(tube(Y.proj2 + 0.45, Y.objective - 0.7), M.steel));
      return { group: g };
    case 'objective': {
      g.add(lens(Y.objective, { h: 0.7, rb: 0.5, R: 1.9, g: 0.7 }));
      // side-entry holder: a rod through the lens gap with a thin flake over the hole in its tip, and its handle
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.4).translate(-0.25, Y.specimen, 0), M.cut);
      const flake = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32).rotateX(-Math.PI / 2).translate(0, Y.specimen + 0.025, 0), new THREE.MeshStandardMaterial({ color: '#d8c070', metalness: 0.6, roughness: 0.4 }));
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 20).rotateZ(Math.PI / 2).translate(-2.3, Y.specimen, 0), M.cut);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.0, 32).rotateZ(Math.PI / 2).translate(-4.3, Y.specimen, 0), M.anodized);
      // the objective aperture strip, in the back focal plane just below the specimen, and its drive on the right
      const s = strip(APERTURES_UM, 0.0012);
      s.position.y = Y.aperture;
      g.add(tip, flake, rod, handle, s, drive(1.95, Y.aperture));
      g.add(solid(tube(Y.objective + 0.7, Y.c2 - 0.42), M.steel));
      return { group: g, strip: s };
    }
    case 'condenser': {
      const cap = strip([150, 100, 50, 30], 0.0008);
      cap.position.set(-HOLE_PITCH * 2, Y.cap, 0);
      g.add(lens(Y.c2, { rb: 0.42, R: 1.4 }), lens(Y.c1, { rb: 0.42, R: 1.35 }), cap, drive(1.4, Y.cap));
      g.add(solid(tube(Y.c1 + 0.42, Y.gun - 0.5), M.steel));
      return { group: g };
    }
    case 'gun': {
      const gy = Y.gun;
      // chamber, Wehnelt cap and anode, then the ribbed ceramic insulator that holds off the high voltage
      g.add(solid([[0.3, gy - 0.5], [1.3, gy - 0.5], [1.3, gy + 1.6], [1.1, gy + 1.6], [1.1, gy - 0.3], [0.3, gy - 0.3]], M.steel));
      g.add(solid([[0.08, gy + 0.68], [0.55, gy + 0.68], [0.55, gy + 0.06], [0.45, gy + 0.06], [0.45, gy + 0.58], [0.08, gy + 0.58]], M.brass));
      g.add(solid([[0.15, gy + 1.24], [1.1, gy + 1.24], [1.1, gy + 1.38], [0.15, gy + 1.38]], M.steel));
      const ribs: [number, number][] = [[0, gy + 3.2], [0.42, gy + 3.2], [0.5, gy + 3.12]];
      for (let z = 3.0, i = 0; z > 1.05; z -= 0.16, i++) ribs.push([i % 2 ? 0.58 : 0.72, gy + z]);
      ribs.push([0.5, gy + 0.98], [0.24, gy + 0.92], [0.24, gy + 0.5], [0, gy + 0.5]);
      const insulator = new THREE.Mesh(new THREE.LatheGeometry(ribs.map(([r, y]) => new THREE.Vector2(r, y)), 96), M.ceramic);
      const top = gy + 3.2;
      const cable = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0, 0], [0, 1.0, 0], [-1.4, 1.8, -0.8], [-4, 2.0, -2.6]].map(([x, y, z]) => new THREE.Vector3(x!, top + y!, z!))), 48, 0.14, 12),
        M.rubber,
      );
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 16).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#333' }));
      tip.position.y = gy + 0.62;
      const light = new THREE.PointLight('#ffa64d', 0, 3);
      light.position.y = gy + 0.62;
      g.add(insulator, cable, tip, light);
      return { group: g, filament: { tip, light } };
    }
  }
}

const GHOST = new THREE.MeshBasicMaterial({ color: '#7fdcff', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });

/** Glowing outline copy of a part: where it goes. */
function ghostOf(obj: THREE.Object3D, id: ColumnPartId): THREE.Group {
  const g = new THREE.Group();
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = new THREE.Mesh(o.geometry, GHOST);
    m.applyMatrix4(o.matrixWorld);
    m.userData.pick = `ghost:${id}`;
    g.add(m);
  });
  return g;
}

/** The beam's outline, [radius, y]: from the gun crossover, squeezed by the condensers, through the specimen, to a
 *  crossover in the objective's back focal plane, then spread over the screen. Widths are exaggerated to be seen. */
const BEAM: [number, number][] = [
  [0.01, Y.gun + 0.55], [0.18, Y.c1 + 0.4], [0.06, Y.c1 - 0.2], [0.012, Y.cap - 0.05], [0.16, Y.c2 - 0.1], [0.14, Y.specimen + 0.35],
  [0.12, Y.specimen], [0.02, Y.aperture - 0.08], [0.12, Y.proj2], [0.05, Y.proj1 + 0.25], [1.4, Y.screen + 0.01],
];

export function createColumnScene(host: HTMLElement, screen: HTMLCanvasElement, on: { pick(id: ColumnPartId | null, ghost: boolean): void }): ColumnScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#151a22');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.5;
  const key = new THREE.DirectionalLight('#fff1e0', 1.5);
  key.position.set(10, 16, 12);
  const rim = new THREE.DirectionalLight('#7dd3fc', 0.8);
  rim.position.set(-12, 6, -10);
  scene.add(key, rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#232a33', roughness: 0.9 }));
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  camera.position.set(13, 12.5, 29);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 7.6, 0);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 5, maxDistance: 45, maxPolarAngle: 1.5 });
  controls.update();

  const screenTex = new THREE.CanvasTexture(screen);
  screenTex.colorSpace = THREE.SRGBColorSpace;

  const root = new THREE.Group();
  scene.add(root);
  const parts: Partial<Record<ColumnPartId, Built>> = {};
  const placedAt: Partial<Record<ColumnPartId, number>> = {};
  const ghosts = new THREE.Group();
  scene.add(ghosts);
  const beam = new THREE.Mesh(
    new THREE.LatheGeometry(BEAM.map(([r, y]) => new THREE.Vector2(r, y)), 48),
    new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.renderOrder = 5;
  scene.add(beam);
  let stripTarget = 0;
  let ghostKey = '-';

  const sync = (v: ColumnView, instant: boolean) => {
    const now = instant ? -1e6 : performance.now();
    for (const p of COLUMN_PARTS) {
      const want = v.placed.includes(p.id);
      if (want && !parts[p.id]) {
        const b = buildPart(p.id, screenTex);
        b.group.traverse((o) => (o.userData.pick ??= `part:${p.id}`));
        root.add(b.group);
        parts[p.id] = b;
        placedAt[p.id] = now;
      } else if (!want && parts[p.id]) {
        parts[p.id]!.group.removeFromParent();
        delete parts[p.id];
        delete placedAt[p.id];
      }
    }
    if (ghostKey !== v.ghosts.join()) {
      ghostKey = v.ghosts.join();
      ghosts.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
      ghosts.clear();
      for (const id of v.ghosts) ghosts.add(ghostOf(buildPart(id, screenTex).group, id));
    }
    // the hole in use sits on the axis; pulled out, the strip clears the bore
    const i = v.apertureUm === null ? -1 : APERTURES_UM.indexOf(v.apertureUm as (typeof APERTURES_UM)[number]);
    stripTarget = i < 0 ? 1.4 : -i * HOLE_PITCH;
    const fil = parts.gun?.filament;
    if (fil) {
      const glow = Math.max(0, (v.heat - 0.2) / 0.8);
      (fil.tip.material as THREE.MeshBasicMaterial).color.setRGB(0.2 + 5 * glow, 0.2 + 2.6 * glow * glow, 0.2 + 0.9 * glow ** 3);
      fil.light.intensity = 3 * glow;
    }
    (beam.material as THREE.MeshBasicMaterial).opacity = 0.32 * v.beam;
    beam.visible = v.beam > 0.01;
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material !== M.cut && o.material.emissiveMap === null) {
        const picked = v.selected && o.userData.pick === `part:${v.selected}`;
        o.material = picked ? highlighted(o.material) : unhighlighted(o.material);
      }
    });
  };
  // a selected part's materials are swapped for lit copies (materials are shared between parts)
  const lit = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const unlit = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const highlighted = (m: THREE.MeshStandardMaterial) => {
    if (unlit.has(m)) return m;
    let c = lit.get(m);
    if (!c) {
      c = m.clone();
      c.emissive.set('#2c3a48');
      lit.set(m, c);
      unlit.set(c, m);
    }
    return c;
  };
  const unhighlighted = (m: THREE.MeshStandardMaterial) => unlit.get(m) ?? m;

  // --- picking
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = (e: PointerEvent): string | null => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    for (const h of ray.intersectObjects([...ghosts.children, root], true)) {
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.pick === undefined) o = o.parent;
      if (o) return o.userData.pick as string;
    }
    return null;
  };
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
  const onMove = (e: PointerEvent) => {
    if (!down) renderer.domElement.style.cursor = hit(e) ? 'pointer' : 'grab';
  };
  const onUp = (e: PointerEvent) => {
    const d = down;
    down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const tag = hit(e);
    if (!tag) return on.pick(null, false);
    const [kind, id] = tag.split(':') as [string, ColumnPartId];
    on.pick(id, kind === 'ghost');
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerup', onUp);

  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    // parts just placed drop onto the column with a little bounce
    for (const [id, t] of Object.entries(placedAt) as [ColumnPartId, number][]) {
      const k = Math.min(1, (now - t) / 480);
      parts[id]!.group.position.y = (1 - k) * (1 - k) * 6 - Math.sin(k * Math.PI) * 0.15 * (1 - k);
    }
    const s = parts.objective?.strip;
    if (s) s.position.x += (stripTarget - s.position.x) * 0.15;
    GHOST.opacity = 0.16 + 0.1 * Math.sin(now / 260);
    controls.update();
    renderer.render(scene, camera);
  };

  return {
    update: (v, instant = false) => sync(v, instant),
    screenChanged: () => void (screenTex.needsUpdate = true),
    start() {
      cancelAnimationFrame(raf);
      resize();
      raf = requestAnimationFrame(frame);
    },
    stop: () => cancelAnimationFrame(raf),
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      screenTex.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
