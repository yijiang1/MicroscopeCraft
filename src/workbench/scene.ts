// The microscope on the bench, in 3D. Every part is built from code in the shape and finish the player picked; parts
// still to place show as glowing outlines where they go. The light path is traced with the same thin-lens formulas
// the game uses (shared/sim/assembly.ts): a cone from the slide into the objective, the objective's image inside the
// tube, and parallel light out of the eyepiece when it is in focus. Scene units are centimetres.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { apertureMm, focalLengthMm, objectiveOptics, traceFan } from '../shared/sim/assembly';
import type { PartId } from './draft';

/** Height of the slide above the bench, cm. */
const STAGE_Y = 9.5;
const BASE_H = 2.2;
const ARM_Z = -6;
/** Objective barrel from its front lens to the nosepiece, and the nosepiece's thickness, cm. */
const OBJ_LEN = 3;
const NOSE_H = 0.8;
/** The nosepiece turns about an axis behind the optical axis, so the objective in use sits on the axis. */
const NOSE_R = 1.3;
const KNOB_Y = 15;
/** Inner radius of the tube and of the eyepiece barrel, mm: stray light ends there. */
const TUBE_WALL_MM = 13;
const EXIT_WALL_MM = 11;
/** Lens curvature is drawn this many times deeper than it is, so a 16 mm lens still looks like a lens. */
const BULGE = 5;

export type GhostId = PartId | 'objective' | 'eyepiece';
export type Pick =
  | { kind: 'part'; id: PartId }
  | { kind: 'ghost'; id: GhostId }
  | { kind: 'objective'; index: number }
  | { kind: 'eyepiece' }
  | { kind: 'none' };

export interface SceneView {
  placed: readonly PartId[];
  style: Readonly<Record<string, string>>;
  name: string;
  objectives: readonly { radiusMm: number; stopMm?: number }[];
  active: number;
  eyepiece: { radiusMm: number } | null;
  tubeMm: number;
  focusMm: number;
  /** Colour of the specimen on the slide; null = no slide yet. */
  slideColor: string | null;
  ghosts: readonly GhostId[];
  selected: string | null;
  showLight: boolean;
  sharp: boolean;
}

export interface BenchScene {
  /** `instant`: parts already on the bench appear in place instead of dropping in. */
  update(v: SceneView, instant?: boolean): void;
  start(): void;
  stop(): void;
  /** The objective hit the slide. */
  shake(): void;
  dispose(): void;
}

interface Finish {
  color: string;
  metalness: number;
  roughness: number;
}
const FINISH: Record<string, Finish> = {
  brass: { color: '#c9973f', metalness: 0.9, roughness: 0.3 },
  black: { color: '#1a1b20', metalness: 0.3, roughness: 0.28 },
  nickel: { color: '#cfd4db', metalness: 0.95, roughness: 0.2 },
  iron: { color: '#5c6068', metalness: 0.75, roughness: 0.48 },
  wood: { color: '#8f5c33', metalness: 0, roughness: 0.7 },
  white: { color: '#ece8df', metalness: 0.05, roughness: 0.35 },
  red: { color: '#b3302a', metalness: 0.2, roughness: 0.32 },
  blue: { color: '#2c5db0', metalness: 0.2, roughness: 0.32 },
  green: { color: '#2e8650', metalness: 0.2, roughness: 0.32 },
  leather: { color: '#5e2218', metalness: 0, roughness: 0.85 },
};

let woodTexture: THREE.CanvasTexture | null = null;
function wood(): THREE.CanvasTexture {
  if (woodTexture) return woodTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a4a26';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const y = (i * 37) % 256;
    g.strokeStyle = `rgba(${i % 2 ? '40,20,8' : '160,110,60'},${0.12 + ((i * 13) % 10) / 60})`;
    g.lineWidth = 1 + ((i * 7) % 4);
    g.beginPath();
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3);
    g.stroke();
  }
  woodTexture = new THREE.CanvasTexture(c);
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.colorSpace = THREE.SRGBColorSpace;
  return woodTexture;
}

/** A finish name, or a #rrggbb paint. */
function material(finish: string | undefined): THREE.MeshStandardMaterial {
  const f = FINISH[finish ?? ''] ?? (/^#[0-9a-f]{6}$/i.test(finish ?? '') ? { color: finish!, metalness: 0.2, roughness: 0.35 } : FINISH.black!);
  const m = new THREE.MeshStandardMaterial({ color: f.color, metalness: f.metalness, roughness: f.roughness });
  if (finish === 'wood') m.map = wood();
  return m;
}

const glassMaterial = () =>
  new THREE.MeshPhysicalMaterial({ color: '#d8f1ff', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 2 });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A flat shape (in the bench's x / −z plane) extruded upward by h. */
function slab(shape: THREE.Shape, h: number, mat: THREE.Material, y = 0): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2, curveSegments: 28 });
  geo.rotateX(-Math.PI / 2);
  return mesh(geo, mat, 0, y, 0);
}

function roundedRect(w: number, d: number, r: number, cx = 0, cz = 0): THREE.Shape {
  const s = new THREE.Shape();
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = -cz - d / 2, y1 = -cz + d / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

function buildBase(shape: string, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  if (shape === 'round') g.add(slab(roundedRect(13, 13, 6.4, 0, -1), BASE_H - 0.24, mat, 0.12));
  else if (shape === 'square') g.add(slab(roundedRect(12.5, 14, 0.8, 0, -1.5), BASE_H - 0.24, mat, 0.12));
  else if (shape === 'tripod') {
    const hub = mesh(new THREE.CylinderGeometry(2.2, 2.6, BASE_H, 32), mat, 0, BASE_H / 2, -3.2);
    g.add(hub);
    for (const a of [Math.PI / 2 + 0.95, Math.PI / 2 - 0.95, -Math.PI / 2]) {
      const leg = mesh(new THREE.BoxGeometry(1.6, 1.3, 8), mat);
      leg.position.set(Math.cos(a) * 4, 0.65, -3.2 + Math.sin(a) * 4);
      leg.rotation.y = -a + Math.PI / 2;
      g.add(leg);
      const foot = mesh(new THREE.CylinderGeometry(0.9, 1, 0.5, 20), mat, Math.cos(a) * 7.6, 0.25, -3.2 + Math.sin(a) * 7.6);
      g.add(foot);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.8, 1, 2.1, 20), mat, 0, 1.05, 0)); // a post that holds the lamp
  } else {
    // horseshoe: a U open toward the viewer
    const s = new THREE.Shape();
    s.moveTo(-6, -5);
    s.lineTo(-6, 4);
    s.absarc(0, 4, 6, Math.PI, 0, true);
    s.lineTo(6, -5);
    s.quadraticCurveTo(6, -6.4, 4.6, -6.4);
    s.lineTo(3.4, -6.4);
    s.quadraticCurveTo(2.4, -6.4, 2.4, -5);
    s.lineTo(2.4, 2.5);
    s.absarc(0, 2.5, 2.4, 0, Math.PI, false);
    s.lineTo(-2.4, -5);
    s.quadraticCurveTo(-2.4, -6.4, -3.4, -6.4);
    s.lineTo(-4.6, -6.4);
    s.quadraticCurveTo(-6, -6.4, -6, -5);
    g.add(slab(s, BASE_H - 0.24, mat, 0.12));
    g.add(mesh(new THREE.CylinderGeometry(0.9, 1.1, BASE_H, 20), mat, 0, BASE_H / 2, 0)); // a post that holds the lamp
  }
  return g;
}

/** The arm stands behind the axis and carries a guide the tube's carrier slides on. */
function buildArm(shape: string, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const guide = mesh(new THREE.BoxGeometry(1.5, 23, 1.1), mat, 0, 18.5, ARM_Z + 1.6);
  g.add(guide);
  if (shape === 'pillar') {
    g.add(mesh(new THREE.BoxGeometry(2, 30, 2), mat, 0, BASE_H + 15, ARM_Z - 0.4));
    g.add(mesh(new THREE.CylinderGeometry(1.6, 1.9, 1.2, 24), mat, 0, BASE_H + 0.6, ARM_Z - 0.4));
  } else {
    const pts =
      shape === 'swan'
        ? [[0, BASE_H, -5.5], [0, 7, -9.5], [0, 15, -10.5], [0, 23, -9], [0, 29, -6.5], [0, 31.5, -4.8]]
        : [[0, BASE_H, -6], [0, 8, -8.6], [0, 16, -9], [0, 24, -8], [0, 30, -5.6]];
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    g.add(mesh(new THREE.TubeGeometry(curve, 48, shape === 'swan' ? 1.05 : 1.25, 18, false), mat));
    g.add(mesh(new THREE.CylinderGeometry(1.7, 2, 1.2, 24), mat, 0, BASE_H + 0.6, -6));
    // two bridges tie the curve to the guide
    g.add(mesh(new THREE.BoxGeometry(1.3, 1.2, 4.5), mat, 0, 12, -6.4));
    g.add(mesh(new THREE.BoxGeometry(1.3, 1.2, 4), mat, 0, 27.5, -5.8));
  }
  return g;
}

function buildStage(shape: string, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const s = shape === 'round' ? roundedRect(12, 12, 6, 0, 0) : roundedRect(11.5, 11.5, 0.6, 0, -0.4);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.9, 0, Math.PI * 2, true);
  s.holes.push(hole);
  g.add(slab(s, 0.6, mat, STAGE_Y - 0.72));
  g.add(mesh(new THREE.BoxGeometry(2.2, 0.9, 5), mat, 0, STAGE_Y - 0.9, ARM_Z + 2.4)); // bracket to the arm
  const clip = new THREE.MeshStandardMaterial({ color: '#b8bcc4', metalness: 0.9, roughness: 0.25 });
  for (const x of [-3.1, 3.1]) g.add(mesh(new THREE.BoxGeometry(0.45, 0.12, 3.8), clip, x, STAGE_Y + 0.18, 1.6));
  return g;
}

function buildLamp(mat: THREE.Material): { group: THREE.Group; bulb: THREE.Mesh; light: THREE.PointLight } {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(1.25, 1.4, 1.7, 28), mat, 0, BASE_H + 0.85, 0));
  group.add(mesh(new THREE.CylinderGeometry(1.32, 1.25, 0.25, 28), mat, 0, BASE_H + 1.8, 0));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), new THREE.MeshStandardMaterial({ color: '#fff4d0', emissive: '#ffd27a', emissiveIntensity: 2.2 }));
  bulb.position.set(0, BASE_H + 2.35, 0);
  group.add(bulb);
  const light = new THREE.PointLight('#ffd9a0', 6, 22, 1.6);
  light.position.copy(bulb.position);
  group.add(light);
  return { group, bulb, light };
}

function buildKnobs(mat: THREE.Material): { group: THREE.Group; coarse: THREE.Object3D[]; fine: THREE.Object3D[] } {
  const group = new THREE.Group();
  const coarse: THREE.Object3D[] = [];
  const fine: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const big = new THREE.Group();
    const disc = mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.75, 36), mat);
    disc.rotation.z = Math.PI / 2;
    big.add(disc);
    for (let k = 0; k < 18; k++) {
      // knurling: ridges round the rim, so you can see it turn
      const a = (k / 18) * Math.PI * 2;
      const ridge = mesh(new THREE.BoxGeometry(0.8, 0.22, 0.22), mat, 0, Math.cos(a) * 1.72, Math.sin(a) * 1.72);
      ridge.rotation.x = a;
      big.add(ridge);
    }
    big.position.set(side * 1.65, KNOB_Y, ARM_Z + 1.6);
    big.userData.pick = 'coarse';
    group.add(big);
    coarse.push(big);
    const small = new THREE.Group();
    const sd = mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.6, 28), mat);
    sd.rotation.z = Math.PI / 2;
    small.add(sd);
    const mark = mesh(new THREE.BoxGeometry(0.62, 0.7, 0.14), new THREE.MeshStandardMaterial({ color: '#e8e2cf' }), 0, 0.55, 0);
    small.add(mark);
    small.position.set(side * 2.35, KNOB_Y, ARM_Z + 1.6);
    small.userData.pick = 'fine';
    group.add(small);
    fine.push(small);
  }
  return { group, coarse, fine };
}

/** An objective: a tapering barrel with its front lens, as wide as the lens can be and bulging with its curve. */
function buildObjective(radiusMm: number, mat: THREE.Material, glass: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const f = focalLengthMm(radiusMm);
  const strength = Math.min(1, 16 / f); // stronger objectives get a slimmer nose
  const bottom = 0.95 - 0.35 * strength;
  g.add(mesh(new THREE.CylinderGeometry(0.95, bottom, OBJ_LEN - 0.1, 28), mat, 0, OBJ_LEN / 2 + 0.05, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.18, 28), new THREE.MeshStandardMaterial({ color: '#e4c95c', metalness: 0.9, roughness: 0.3 }), 0, OBJ_LEN - 0.5, 0));
  const r = apertureMm(radiusMm) / 20; // cm
  const sag = (radiusMm - Math.sqrt(Math.max(0, radiusMm ** 2 - (apertureMm(radiusMm) / 2) ** 2))) / 10;
  const lens = mesh(new THREE.SphereGeometry(r, 24, 12), glass, 0, 0.05, 0);
  lens.scale.y = Math.max(0.12, Math.min(1, (sag * BULGE) / r));
  g.add(lens);
  return g;
}

function buildEyepiece(mat: THREE.Material, glass: THREE.Material, radiusMm: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.18, 1.18, 2.9, 28, 1, true), mat, 0, 1.15, 0));
  g.add(mesh(new THREE.TorusGeometry(1.2, 0.22, 12, 32), new THREE.MeshStandardMaterial({ color: '#202124', roughness: 0.7 }), 0, 2.6, 0).rotateX(Math.PI / 2));
  const r = Math.min(1.1, apertureMm(radiusMm) / 20 + 0.55);
  const lens = mesh(new THREE.SphereGeometry(r, 24, 12), glass, 0, 0, 0);
  const sag = Math.min(radiusMm, apertureMm(radiusMm) / 2);
  lens.scale.y = Math.max(0.1, Math.min(0.6, (sag / radiusMm) * 0.5 + 0.08));
  g.add(lens);
  return g;
}

function plaque(text: string): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 512, 128);
  grad.addColorStop(0, '#d8b45a');
  grad.addColorStop(1, '#9a7428');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#6a4c14';
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = '#3a2808';
  g.font = '600 52px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text || 'MicroscopeCraft', 256, 66, 470);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshStandardMaterial({ map: t, metalness: 0.6, roughness: 0.35 }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

const GHOST = new THREE.MeshBasicMaterial({ color: '#7fdcff', transparent: true, opacity: 0.25, depthWrite: false });

/** Glowing outline copy of an object: where a part goes. */
function ghostOf(obj: THREE.Object3D, id: GhostId): THREE.Group {
  const g = new THREE.Group();
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = new THREE.Mesh(o.geometry, GHOST);
    m.applyMatrix4(o.matrixWorld);
    m.userData.pick = `ghost:${id}`;
    g.add(m);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), new THREE.LineBasicMaterial({ color: '#bff0ff', transparent: true, opacity: 0.7 }));
    edges.applyMatrix4(o.matrixWorld);
    g.add(edges);
  });
  return g;
}

export function createBenchScene(host: HTMLElement, on: { pick(p: Pick): void; knob(which: 'coarse' | 'fine', dyPx: number): void }): BenchScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1e24');
  scene.fog = new THREE.Fog('#1b1e24', 90, 190);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.add(new THREE.HemisphereLight('#dfe9ff', '#3a2a1a', 0.6));
  const key = new THREE.DirectionalLight('#fff3e0', 2.2);
  key.position.set(18, 40, 22);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  Object.assign(key.shadow.camera, { left: -25, right: 25, top: 30, bottom: -20, near: 1, far: 100 });
  key.shadow.bias = -0.0005;
  scene.add(key);

  // the bench
  const top = new THREE.MeshStandardMaterial({ map: wood(), roughness: 0.75 });
  (top.map as THREE.Texture).repeat.set(3, 2);
  const bench = mesh(new THREE.BoxGeometry(130, 4, 70), top, 0, -2, -8);
  bench.castShadow = false;
  scene.add(bench);
  const mat = new THREE.MeshStandardMaterial({ color: '#2b4a3a', roughness: 0.95 });
  const pad = mesh(new THREE.BoxGeometry(34, 0.12, 26), mat, 0, 0.06, -2); // a felt mat under the microscope
  pad.castShadow = false;
  scene.add(pad);
  // a few things lying about on the bench
  const spare = mesh(new THREE.BoxGeometry(7.6, 0.1, 2.6), glassMaterial(), 16, 0.18, 6);
  spare.rotation.y = 0.3;
  scene.add(spare);
  const wheel = new THREE.Group();
  wheel.add(mesh(new THREE.CylinderGeometry(4.2, 4.2, 1.4, 36), new THREE.MeshStandardMaterial({ color: '#8a8f96', roughness: 0.9 }), 0, 0.7, 0));
  wheel.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 3.6, 12), new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8 }), 0, 1.8, 0));
  wheel.position.set(-22, 0, 2);
  scene.add(wheel);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  camera.position.set(37, 34, 58);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 18.5, -1);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 22;
  controls.maxDistance = 120;
  controls.maxPolarAngle = 1.48;
  controls.update();

  // --- the microscope
  const root = new THREE.Group();
  scene.add(root);
  const parts: Partial<Record<PartId, THREE.Group>> = {};
  const keys: Record<string, string> = {};
  /** When each part was placed, for the drop-in animation. */
  const placedAt: Partial<Record<PartId, number>> = {};
  let lamp: ReturnType<typeof buildLamp> | null = null;
  let knobs: ReturnType<typeof buildKnobs> | null = null;
  const head = new THREE.Group(); // moves with the focus: objectives, nosepiece, tube, eyepiece, carrier
  root.add(head);
  let tubeParts: { outer: THREE.Mesh; draw: THREE.Mesh; bands: THREE.Mesh[]; carrier: THREE.Mesh; nose: THREE.Mesh } | null = null;
  const nose = new THREE.Group();
  head.add(nose);
  let objectiveMeshes: THREE.Group[] = [];
  let eyepieceMesh: THREE.Group | null = null;
  let slide: THREE.Group | null = null;
  let plaqueMesh: THREE.Mesh | null = null;
  const ghosts = new THREE.Group();
  scene.add(ghosts);
  const transparentWhenLit: THREE.MeshStandardMaterial[] = [];

  // light path
  const rayMaterial = new LineMaterial({ linewidth: 2.4, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false });
  const rayGeometry = new LineSegmentsGeometry();
  const rays = new LineSegments2(rayGeometry, rayMaterial);
  rays.renderOrder = 5;
  rays.frustumCulled = false;
  scene.add(rays);
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.45, STAGE_Y - BASE_H - 3.2, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  cone.position.y = BASE_H + 2.4 + (STAGE_Y - BASE_H - 3.2) / 2;
  scene.add(cone);
  const imageDot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffd35a', transparent: true, opacity: 0.95, depthTest: false }));
  imageDot.renderOrder = 6;
  scene.add(imageDot);
  const focalRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 8, 48), new THREE.MeshBasicMaterial({ color: '#7fdcff', transparent: true, opacity: 0.8, depthTest: false }));
  focalRing.rotation.x = Math.PI / 2;
  focalRing.renderOrder = 6;
  scene.add(focalRing);

  let shakeUntil = 0;

  const styleKey = (v: SceneView, id: string, shape = true) => `${shape ? v.style[id] : ''}|${v.style[`${id}Finish`]}`;
  const dispose = (o: THREE.Object3D) =>
    o.traverse((x) => {
      if (x instanceof THREE.Mesh || x instanceof THREE.LineSegments) x.geometry.dispose();
    });

  /** Rebuild the parts whose look changed; drop in the ones just placed. */
  const syncParts = (v: SceneView, instant: boolean) => {
    const now = instant ? -1e6 : performance.now();
    for (const id of ['base', 'arm', 'stage'] as const) {
      const want = v.placed.includes(id) ? styleKey(v, id) : '';
      if (keys[id] === want) continue;
      if (parts[id]) dispose(parts[id]!);
      parts[id]?.removeFromParent();
      delete parts[id];
      keys[id] = want;
      if (!want) {
        delete placedAt[id];
        continue;
      }
      const m = material(v.style[`${id}Finish`]);
      const g = id === 'base' ? buildBase(v.style.base!, m) : id === 'arm' ? buildArm(v.style.arm!, m) : buildStage(v.style.stage!, m);
      g.traverse((o) => (o.userData.pick ??= `part:${id}`));
      root.add(g);
      parts[id] = g;
      placedAt[id] ??= now;
    }
    const lampKey = v.placed.includes('lamp') ? styleKey(v, 'lamp', false) : '';
    if (keys.lamp !== lampKey) {
      lamp?.group.removeFromParent();
      lamp = null;
      keys.lamp = lampKey;
      if (!lampKey) delete placedAt.lamp;
      if (lampKey) {
        lamp = buildLamp(material(v.style.lampFinish));
        lamp.group.traverse((o) => (o.userData.pick ??= 'part:lamp'));
        root.add(lamp.group);
        parts.lamp = lamp.group;
        placedAt.lamp ??= now;
      }
    }
    const knobKey = v.placed.includes('knobs') ? styleKey(v, 'knobs', false) : '';
    if (keys.knobs !== knobKey) {
      knobs?.group.removeFromParent();
      knobs = null;
      keys.knobs = knobKey;
      if (!knobKey) delete placedAt.knobs;
      if (knobKey) {
        knobs = buildKnobs(material(v.style.knobsFinish));
        root.add(knobs.group);
        parts.knobs = knobs.group;
        placedAt.knobs ??= now;
      }
    }
    const tubeKey = v.placed.includes('tube') ? `${styleKey(v, 'tube', false)}|${v.showLight}` : '';
    if (keys.tube !== tubeKey) {
      if (tubeParts) for (const m of [tubeParts.outer, tubeParts.draw, tubeParts.carrier, tubeParts.nose, ...tubeParts.bands]) m.removeFromParent();
      tubeParts = null;
      keys.tube = tubeKey;
      transparentWhenLit.length = 0;
      if (!tubeKey) delete placedAt.tube;
      if (tubeKey) {
        const finish = v.style.tubeFinish;
        const m = material(finish);
        const inner = material(finish === 'leather' ? 'brass' : finish);
        for (const x of [m, inner]) {
          transparentWhenLit.push(x);
          x.transparent = v.showLight;
          x.opacity = v.showLight ? 0.3 : 1;
          x.depthWrite = !v.showLight;
        }
        const outer = mesh(new THREE.CylinderGeometry(1.45, 1.45, 1, 36, 1, true), m);
        const draw = mesh(new THREE.CylinderGeometry(1.28, 1.28, 1, 36, 1, true), inner);
        const gold = new THREE.MeshStandardMaterial({ color: '#e0b850', metalness: 0.9, roughness: 0.28 });
        const bands = finish === 'leather' ? [0, 1, 2].map(() => mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 36), gold)) : [];
        const carrier = mesh(new THREE.BoxGeometry(2.2, 3.2, 2.7), material(v.style.armFinish));
        const noseMesh = mesh(new THREE.CylinderGeometry(2.2, 2.4, NOSE_H, 40), material(finish === 'leather' ? 'brass' : finish));
        for (const x of [outer, draw, carrier, noseMesh, ...bands]) {
          x.userData.pick = 'part:tube';
          head.add(x);
        }
        tubeParts = { outer, draw, bands, carrier, nose: noseMesh };
        placedAt.tube ??= now;
      }
    }
    // lenses: rebuilt when a curve or the set changes (cheap)
    const lensKey = `${v.objectives.map((o) => o.radiusMm.toFixed(2)).join(',')}|${v.eyepiece?.radiusMm.toFixed(2) ?? '-'}|${v.style.lensFinish}|${v.showLight}`;
    if (keys.lenses !== lensKey) {
      keys.lenses = lensKey;
      objectiveMeshes.forEach((m) => m.removeFromParent());
      eyepieceMesh?.removeFromParent();
      const m = material(v.style.lensFinish);
      if (v.showLight) Object.assign(m, { transparent: true, opacity: 0.45, depthWrite: false });
      objectiveMeshes = v.objectives.map((o, i) => {
        const g = buildObjective(o.radiusMm, m, glassMaterial());
        g.traverse((x) => (x.userData.pick = `objective:${i}`));
        nose.add(g);
        return g;
      });
      eyepieceMesh = v.eyepiece ? buildEyepiece(m, glassMaterial(), v.eyepiece.radiusMm) : null;
      if (eyepieceMesh) {
        eyepieceMesh.traverse((x) => (x.userData.pick = 'eyepiece'));
        head.add(eyepieceMesh);
      }
    }
    const slideKey = v.slideColor ?? '';
    if (keys.slide !== slideKey) {
      keys.slide = slideKey;
      slide?.removeFromParent();
      slide = null;
      if (v.slideColor) {
        slide = new THREE.Group();
        slide.add(mesh(new THREE.BoxGeometry(7.6, 0.1, 2.6), glassMaterial(), 0, STAGE_Y + 0.05, 0.2));
        const spot = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshStandardMaterial({ color: v.slideColor, roughness: 0.6, transparent: true, opacity: 0.85 }));
        spot.rotation.x = -Math.PI / 2;
        spot.position.set(0, STAGE_Y + 0.105, 0);
        slide.add(spot);
        const label = mesh(new THREE.BoxGeometry(1.9, 0.02, 2.4), new THREE.MeshStandardMaterial({ color: '#f2efe6' }), -2.7, STAGE_Y + 0.11, 0.2);
        slide.add(label);
        slide.traverse((o) => (o.userData.pick = 'part:stage'));
        root.add(slide);
      }
    }
    const plaqueKey = v.placed.includes('base') ? `${v.name}|${v.style.base}` : '';
    if (keys.plaque !== plaqueKey) {
      keys.plaque = plaqueKey;
      plaqueMesh?.removeFromParent();
      plaqueMesh = null;
      if (plaqueKey) {
        plaqueMesh = plaque(v.name);
        if (v.style.base === 'tripod') {
          plaqueMesh.position.set(0, 1.32, -7.4);
          plaqueMesh.rotation.z = Math.PI / 2;
        } else plaqueMesh.position.set(0, BASE_H + 0.02, v.style.base === 'square' ? 4.2 : 3.8);
        if (v.style.base === 'horseshoe') {
          plaqueMesh.position.set(-4.1, BASE_H + 0.02, 1.4);
          plaqueMesh.rotation.z = Math.PI / 2;
        }
        plaqueMesh.userData.pick = 'part:base';
        root.add(plaqueMesh);
      }
    }
  };

  /** Everything that moves with the focus knobs, the tube length or the nosepiece. */
  const layout = (v: SceneView) => {
    const objY = STAGE_Y + v.focusMm / 10;
    head.position.y = objY;
    const tubeCm = v.tubeMm / 10;
    nose.position.set(0, 0, -NOSE_R);
    nose.rotation.y = 0;
    objectiveMeshes.forEach((g, i) => {
      const a = ((i - v.active) / Math.max(3, v.objectives.length)) * Math.PI * 2;
      g.position.set(Math.sin(a) * NOSE_R, 0, Math.cos(a) * NOSE_R);
      g.rotation.set(0, 0, 0);
      if (i !== v.active) g.position.y = 0.45; // the ones not in use swing up out of the way
    });
    if (tubeParts) {
      const bottom = OBJ_LEN + NOSE_H;
      const span = Math.max(1, tubeCm - bottom);
      const outerLen = Math.min(span, 11);
      tubeParts.nose.position.set(0, OBJ_LEN + NOSE_H / 2, -NOSE_R * 0.55);
      tubeParts.outer.scale.y = outerLen;
      tubeParts.outer.position.set(0, bottom + outerLen / 2, 0);
      const drawLen = Math.max(0.2, span - outerLen + 0.6);
      tubeParts.draw.scale.y = drawLen;
      tubeParts.draw.position.set(0, tubeCm - drawLen / 2, 0);
      tubeParts.bands.forEach((b, k) => b.position.set(0, bottom + 0.6 + (k * (outerLen - 1.2)) / 2, 0));
      tubeParts.carrier.position.set(0, bottom + 2.4, -2.55);
    }
    if (eyepieceMesh) eyepieceMesh.position.set(0, tubeCm, 0);
    if (knobs) {
      for (const k of knobs.coarse) k.rotation.x = -v.focusMm * 0.55;
      for (const k of knobs.fine) k.rotation.x = -v.focusMm * 18;
    }
    if (lamp) {
      const on = v.placed.includes('stage');
      lamp.light.intensity = 6;
      (lamp.bulb.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.4 : 1.6;
    }
  };

  /** The light: from the lamp up through the slide, into the objective, to its image and out of the eyepiece. */
  const syncLight = (v: SceneView) => {
    const lit = v.showLight && v.placed.includes('lamp');
    cone.visible = lit && v.placed.includes('stage');
    const obj = v.objectives[v.active];
    const positions: number[] = [];
    const colors: number[] = [];
    imageDot.visible = false;
    focalRing.visible = false;
    if (lit && obj && v.placed.includes('tube')) {
      const f = focalLengthMm(obj.radiusMm);
      const D = Math.min(apertureMm(obj.radiusMm), obj.stopMm ?? Infinity);
      const fEye = v.eyepiece ? focalLengthMm(v.eyepiece.radiusMm) : 1e9;
      const exit = v.eyepiece ? 45 : 0;
      const tube = v.eyepiece ? v.tubeMm : v.tubeMm - 8;
      const push = (fan: ReturnType<typeof traceFan>, phis: number[], rgb: [number, number, number]) => {
        for (const phi of phis) {
          const c = Math.cos(phi), s = Math.sin(phi);
          for (const ray of fan.rays) {
            for (let k = 0; k + 1 < ray.length; k++) {
              const [z0, y0] = ray[k]!;
              let [z1, y1] = ray[k + 1]!;
              // light that strays out of the tube hits its blackened wall, and stops there
              const wall = k === 1 ? TUBE_WALL_MM : k === 2 ? EXIT_WALL_MM : Infinity;
              if (Math.abs(y0) >= wall) break; // already stopped by the narrower eyepiece barrel
              if (z1 === z0) continue; // no eyepiece: nothing past the top of the tube
              const out = Math.abs(y1) > wall;
              if (out) {
                const t = (Math.sign(y1) * wall - y0) / (y1 - y0);
                z1 = z0 + (z1 - z0) * t;
                y1 = Math.sign(y1) * wall;
              }
              positions.push((y0 / 10) * c, STAGE_Y + z0 / 10, (y0 / 10) * s, (y1 / 10) * c, STAGE_Y + z1 / 10, (y1 / 10) * s);
              const fade = k === 2 ? 0.5 : 1;
              colors.push(rgb[0], rgb[1], rgb[2], rgb[0] * fade, rgb[1] * fade, rgb[2] * fade);
              if (out) break;
            }
          }
        }
      };
      push(traceFan({ f, D }, { f: fEye }, v.focusMm, tube, 0, 5, exit), [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4], [1, 0.72, 0.32]);
      const o = v.eyepiece ? objectiveOptics(obj, v.eyepiece, v.tubeMm) : null;
      const mObj = o && !o.issue ? o.objectiveMag : 8;
      const h = Math.min(1.2, 7 / Math.max(1, mObj)); // an off-axis point, so the image shows it is magnified and upside down
      const off = traceFan({ f, D }, { f: fEye }, v.focusMm, tube, h, 5, exit);
      push(off, [0], [0.3, 0.75, 1]);
      if (off.image && off.image.z < v.focusMm + v.tubeMm + 10) {
        // the image of the off-axis point, as an arrow from the axis
        positions.push(0, STAGE_Y + off.image.z / 10, 0, off.image.y / 10, STAGE_Y + off.image.z / 10, 0);
        colors.push(0.45, 0.85, 1, 0.45, 0.85, 1);
        positions.push(0, STAGE_Y + 0.11, 0, h / 10, STAGE_Y + 0.11, 0);
        colors.push(0.45, 0.85, 1, 0.45, 0.85, 1);
        imageDot.visible = true;
        imageDot.position.set(0, STAGE_Y + off.image.z / 10, 0);
        (imageDot.material as THREE.MeshBasicMaterial).color.set(v.sharp ? '#7dff9a' : '#ffd35a');
      }
      if (v.eyepiece) {
        focalRing.visible = true;
        focalRing.position.set(0, STAGE_Y + (v.focusMm + v.tubeMm - fEye) / 10, 0);
        (focalRing.material as THREE.MeshBasicMaterial).color.set(v.sharp ? '#7dff9a' : '#7fdcff');
      }
    }
    rays.visible = positions.length > 0;
    if (positions.length) {
      rayGeometry.setPositions(positions);
      rayGeometry.setColors(colors);
    }
  };

  /** Outlines where the next parts go (rebuilt only when what they show changes). */
  let ghostKey = '';
  const syncGhosts = (v: SceneView) => {
    const moving = v.ghosts.some((id) => id === 'tube' || id === 'objective' || id === 'eyepiece');
    const key = `${v.ghosts.join()}|${v.style.base}|${v.style.arm}|${v.style.stage}|${moving ? `${v.focusMm.toFixed(2)}|${v.tubeMm}` : ''}`;
    if (key === ghostKey) return;
    ghostKey = key;
    dispose(ghosts);
    ghosts.clear();
    const temp = new THREE.MeshStandardMaterial();
    for (const id of v.ghosts) {
      let obj: THREE.Object3D | null = null;
      if (id === 'base') obj = buildBase(v.style.base!, temp);
      else if (id === 'arm') obj = buildArm(v.style.arm!, temp);
      else if (id === 'stage') obj = buildStage(v.style.stage!, temp);
      else if (id === 'lamp') obj = buildLamp(temp).group;
      else if (id === 'knobs') obj = buildKnobs(temp).group;
      else if (id === 'tube') {
        obj = new THREE.Group();
        const y = STAGE_Y + v.focusMm / 10;
        const len = v.tubeMm / 10 - OBJ_LEN - NOSE_H;
        obj.add(mesh(new THREE.CylinderGeometry(1.45, 1.45, len, 32), temp, 0, y + OBJ_LEN + NOSE_H + len / 2, 0));
        obj.add(mesh(new THREE.CylinderGeometry(2.2, 2.4, NOSE_H, 32), temp, 0, y + OBJ_LEN + NOSE_H / 2, -NOSE_R * 0.55));
      } else if (id === 'objective') {
        obj = buildObjective(16, temp, temp);
        obj.position.set(0, STAGE_Y + v.focusMm / 10, 0);
      } else if (id === 'eyepiece') {
        obj = buildEyepiece(temp, temp, 25);
        obj.position.set(0, STAGE_Y + (v.focusMm + v.tubeMm) / 10, 0);
      }
      if (obj) ghosts.add(ghostOf(obj, id));
    }
  };

  const selectGlow = (v: SceneView) => {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
      if (o.material.emissiveIntensity > 1.5) return; // the lamp's bulb
      const picked = typeof o.userData.pick === 'string' && v.selected && o.userData.pick === v.selected;
      o.material.emissive.set(picked ? '#2c3540' : '#000000');
    });
  };

  // --- picking and dragging the knobs
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
  let down: { x: number; y: number; knob: 'coarse' | 'fine' | null; lastY: number } | null = null;
  const onDown = (e: PointerEvent) => {
    const tag = hit(e);
    const knob = tag === 'coarse' || tag === 'fine' ? tag : null;
    down = { x: e.clientX, y: e.clientY, knob, lastY: e.clientY };
    if (knob) {
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    }
  };
  const onMove = (e: PointerEvent) => {
    if (down?.knob) {
      on.knob(down.knob, e.clientY - down.lastY);
      down.lastY = e.clientY;
      return;
    }
    if (down) return;
    const tag = hit(e);
    renderer.domElement.style.cursor = tag === 'coarse' || tag === 'fine' ? 'ns-resize' : tag ? 'pointer' : 'grab';
  };
  const onUp = (e: PointerEvent) => {
    const d = down;
    down = null;
    controls.enabled = true;
    if (!d || d.knob || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const tag = hit(e);
    if (!tag) return on.pick({ kind: 'none' });
    const [kind, id] = tag.split(':');
    if (kind === 'ghost') on.pick({ kind: 'ghost', id: id as GhostId });
    else if (kind === 'part') on.pick({ kind: 'part', id: id as PartId });
    else if (kind === 'objective') on.pick({ kind: 'objective', index: +id! });
    else if (kind === 'eyepiece') on.pick({ kind: 'eyepiece' });
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerup', onUp);

  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rayMaterial.resolution.set(w, h);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let raf = 0;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    // parts just placed drop in with a little bounce
    for (const [id, t] of Object.entries(placedAt) as [PartId, number][]) {
      const g = id === 'tube' ? null : parts[id];
      const k = Math.min(1, (now - t) / 420);
      const drop = (1 - k) * (1 - k) * 7 - Math.sin(k * Math.PI) * 0.25 * (1 - k);
      if (g) g.position.y = drop;
      if (id === 'tube' && tubeParts) for (const m of [tubeParts.outer, tubeParts.draw, ...tubeParts.bands]) m.position.x = (1 - k) * (1 - k) * 6;
    }
    const pulse = 0.18 + 0.12 * Math.sin(now / 260);
    GHOST.opacity = pulse;
    root.position.x = now < shakeUntil ? Math.sin(now / 18) * 0.12 : 0;
    controls.update();
    renderer.render(scene, camera);
  };

  return {
    update(v, instant = false) {
      syncParts(v, instant);
      layout(v);
      syncLight(v);
      syncGhosts(v);
      selectGlow(v);
    },
    start() {
      cancelAnimationFrame(raf);
      resize();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
    },
    shake() {
      shakeUntil = performance.now() + 350;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
