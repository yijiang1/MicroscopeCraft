// Campus buildings on the hilltop: the halls and statues around the quad, a clock tower with a working clock,
// the science building with the electron microscopy lab on its glass ground floor, and the waterfall.
// Boxes, prisms and canvas textures only. Walls are axis-aligned boxes the player collides with.
import * as THREE from 'three';
import { facadeTexture, labelTexture, waterfallTexture } from './textures';
import { creekY, FALLS_X, gorgeZ, heightAt, WATER_LEVEL } from './terrain';

/** An axis-aligned footprint, x0 < x1, z0 < z1 (north is -z). */
export interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
const box = (x0: number, x1: number, z0: number, z1: number): Box => ({ x0, x1, z0, z1 });

/** The science building. Its ground floor is the lab, entered by the door in the west wall. */
export const SCIENCE = box(24, 44, 12, 28);
const DOOR = { z0: 18.5, z1: 21.5 };
const LAB_H = 4.2;
/** The electron microscope's place in the lab: more than arm's reach from the glass, so it is only usable inside. */
export const EM_SPOT = { x: 36, z: 20 };
/** The glowing crystal stands in a little mineral garden by the lab entrance. */
export const CRYSTAL_SPOT = { x: 16, z: 27 };

const FLOOR_H = 3.6;
interface Hall {
  box: Box;
  floors: number;
  wall: string;
  flat?: boolean;
}
const HALLS: Hall[] = [
  { box: box(-18, 18, -48, -40), floors: 3, wall: '#a39a88' }, // domed hall (dome below), north end of the quad
  { box: box(-34, -26, -36, -26), floors: 3, wall: '#8f8a80' }, // west row of halls
  { box: box(-34, -26, -23, -13), floors: 3, wall: '#968f82' }, 
  { box: box(-34, -26, -10, -2), floors: 3, wall: '#8a8478' }, 
  { box: box(26, 36, -32, -8), floors: 3, wall: '#d8cdb4' }, // columned hall (portico below), east side
  { box: box(-44, -34, 4, 14), floors: 2, wall: '#8f8a80' }, // library, by the tower at the top of the west slope
  { box: box(-20, -6, 12, 22), floors: 3, wall: '#c9c1b0', flat: true }, // south library
];
const TOWER = { x: -38, z: -1, half: 2.5 }; // the clock tower
const PORTICO = box(23.6, 26, -27, -13);
/** Two pioneers of microscopy face each other across the quad: light on the west side, electrons on the east. */
const STATUES = [
  { x: -15, z: -19, facing: Math.PI / 2, who: 'leeuwenhoek', plaque: 'Antonie van Leeuwenhoek  1632–1723' },
  { x: 15, z: -19, facing: -Math.PI / 2, who: 'ruska', plaque: 'Ernst Ruska  1906–1988' },
] as const;

/** Everything with a footprint, for keeping scenery out of buildings. */
export const FOOTPRINTS: Box[] = [
  ...HALLS.map((h) => h.box),
  PORTICO,
  box(TOWER.x - TOWER.half, TOWER.x + TOWER.half, TOWER.z - TOWER.half, TOWER.z + TOWER.half),
  SCIENCE,
  ...STATUES.map((s) => box(s.x - 0.7, s.x + 0.7, s.z - 0.7, s.z + 0.7)),
];
export const insideBuilding = (x: number, z: number, margin = 0) =>
  FOOTPRINTS.some((b) => x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin);
export const inLab = (x: number, z: number) => x > SCIENCE.x0 && x < SCIENCE.x1 && z > SCIENCE.z0 && z < SCIENCE.z1;

const mat = (color: string, roughness = 0.85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const SLATE = mat('#4a4e55', 0.8);

/** A triangular prism: `span` wide, `rise` tall, `len` long along z. */
function prism(span: number, rise: number, len: number): THREE.BufferGeometry {
  const shape = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, rise)]);
  return new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2);
}

/** A box whose four walls carry the window texture, repeated one bay per ~3.4 m and one row per floor. */
function facadeBox(w: number, h: number, d: number, floors: number, tex: THREE.Texture, top: THREE.Material, bottom = top): THREE.Mesh {
  const side = (len: number) => {
    const t = tex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, Math.round(len / 3.4)), floors);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  };
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side(d), side(d), top, bottom, side(w), side(w)]);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function hall(h: Hall, group: THREE.Group) {
  const { x0, x1, z0, z1 } = h.box;
  const [w, d, cx, cz] = [x1 - x0, z1 - z0, (x0 + x1) / 2, (z0 + z1) / 2];
  const g = heightAt(cx, cz) - 0.5; // sunk a little so no edge floats
  const height = h.floors * FLOOR_H + 0.5;
  const body = facadeBox(w, height, d, h.floors, facadeTexture(h.wall, '#33404d'), SLATE);
  body.position.set(cx, g + height / 2, cz);
  group.add(body);
  if (h.flat) return;
  const alongX = w >= d;
  const span = (alongX ? d : w) + 0.6;
  const roof = new THREE.Mesh(prism(span, Math.min(span * 0.35, 4), (alongX ? w : d) + 0.6), SLATE);
  if (alongX) roof.rotation.y = Math.PI / 2;
  roof.position.set(cx, g + height, cz);
  roof.castShadow = true;
  group.add(roof);
}

/** The clock tower: a square stone shaft, belfry, octagonal lantern and spire, with a clock on every side. */
function tower(group: THREE.Group): THREE.Object3D[] {
  const { x, z, half } = TOWER;
  const g = heightAt(x, z) - 0.5;
  const stone = mat('#8d877c', 0.95);
  const dark = mat('#1d1f22', 1);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, g + y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(half * 2, 24, half * 2), stone, 12);
  add(new THREE.BoxGeometry(half * 2 + 0.6, 0.5, half * 2 + 0.6), stone, 24);
  add(new THREE.BoxGeometry(half * 2 + 0.2, 5, half * 2 + 0.2), stone, 26.7);
  add(new THREE.BoxGeometry(half * 2 + 0.8, 0.6, half * 2 + 0.8), stone, 29.4);
  add(new THREE.CylinderGeometry(2.1, 2.4, 3.6, 8), stone, 31.5);
  add(new THREE.ConeGeometry(2.5, 7, 8), SLATE, 36.8);
  const hands: THREE.Object3D[] = [];
  const face = mat('#f2efe6', 0.6);
  for (let i = 0; i < 4; i++) {
    const side = new THREE.Group();
    side.position.set(x, g, z);
    side.rotation.y = (i * Math.PI) / 2;
    group.add(side);
    // two dark belfry openings per side, where the chime bells hang
    for (const dx of [-0.9, 0.9]) {
      const opening = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3, 0.1), dark);
      opening.position.set(dx, 26.9, half + 0.12);
      side.add(opening);
    }
    const clock = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), face);
    clock.position.set(0, 20.5, half + 0.02);
    side.add(clock);
    for (const [len, width] of [[0.75, 0.13], [1.1, 0.08]] as const) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(width, len, 0.03).translate(0, len / 2 - 0.08, 0), dark);
      hand.position.set(0, 20.5, half + 0.05);
      side.add(hand);
      hands.push(hand);
    }
  }
  return hands;
}

/** A mesh at (x, y, z), tilted by rx (forward) and rz (sideways). */
function part(geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, 0, rz);
  return mesh;
}

/** Van Leeuwenhoek in a long coat and a curled wig, holding one of his tiny single-lens microscopes up to his eye. */
function leeuwenhoek(bronze: THREE.Material): THREE.Object3D[] {
  const brass = mat('#c9a24a', 0.35, 0.8);
  return [
    part(new THREE.CylinderGeometry(0.2, 0.42, 1.15, 16), bronze, 0, 0.58, 0), // coat skirt
    part(new THREE.CylinderGeometry(0.22, 0.2, 0.55, 16), bronze, 0, 1.42, 0), // chest
    part(new THREE.SphereGeometry(0.15, 16, 12), bronze, 0, 1.86, 0.04), // head
    part(new THREE.SphereGeometry(0.2, 16, 12).scale(1, 1.05, 0.8), bronze, 0, 1.88, -0.08), // wig
    part(new THREE.CapsuleGeometry(0.08, 0.3, 4, 8), bronze, -0.17, 1.6, -0.02), // curls falling to the shoulders
    part(new THREE.CapsuleGeometry(0.08, 0.3, 4, 8), bronze, 0.17, 1.6, -0.02),
    part(new THREE.CapsuleGeometry(0.055, 0.42, 4, 8), bronze, -0.26, 1.28, 0, 0, 0.12), // left arm down
    part(new THREE.CapsuleGeometry(0.055, 0.18, 4, 8), bronze, 0.23, 1.49, 0.12, 2.05), // right upper arm, forward
    part(new THREE.CapsuleGeometry(0.05, 0.33, 4, 8), bronze, 0.16, 1.62, 0.24, 0, 0.38), // forearm, up to the eye
    part(new THREE.BoxGeometry(0.03, 0.1, 0.06), brass, 0.06, 1.86, 0.25), // the microscope: a little brass plate held to the eye
  ];
}

/** Ruska in a suit beside a small model of the electron microscope column he built. */
function ruska(bronze: THREE.Material): THREE.Object3D[] {
  const parts = [
    part(new THREE.CylinderGeometry(0.08, 0.07, 0.8, 10), bronze, -0.23, 0.4, 0), // legs
    part(new THREE.CylinderGeometry(0.08, 0.07, 0.8, 10), bronze, -0.03, 0.4, 0),
    part(new THREE.CylinderGeometry(0.22, 0.2, 0.72, 16), bronze, -0.13, 1.14, 0), // jacket
    part(new THREE.SphereGeometry(0.15, 16, 12), bronze, -0.13, 1.68, 0.01), // head
    part(new THREE.SphereGeometry(0.155, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), bronze, -0.13, 1.7, -0.01), // short hair
    part(new THREE.CapsuleGeometry(0.055, 0.42, 4, 8), bronze, -0.37, 1.1, 0, 0, 0.1), // left arm down
    part(new THREE.CapsuleGeometry(0.055, 0.4, 4, 8), bronze, 0.1, 1.12, 0.04, 0, -0.45), // right arm reaching to the column
  ];
  let y = 0;
  for (const [r, h] of [[0.16, 0.3], [0.13, 0.2], [0.12, 0.25], [0.13, 0.2], [0.11, 0.25], [0.09, 0.2]] as const) {
    parts.push(part(new THREE.CylinderGeometry(r, r, h, 16), bronze, 0.42, y + h / 2, 0));
    y += h;
  }
  return parts;
}

/** Bronze statues on stone pedestals with name plaques, facing each other across the quad. */
function statues(group: THREE.Group) {
  const stone = mat('#a7a297');
  const bronze = mat('#8c6a3f', 0.45, 0.55);
  for (const s of STATUES) {
    const statue = new THREE.Group();
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 1.3), stone);
    pedestal.position.y = 0.8;
    const figure = new THREE.Group();
    figure.add(...(s.who === 'leeuwenhoek' ? leeuwenhoek(bronze) : ruska(bronze)));
    figure.position.y = 1.6;
    statue.add(pedestal, figure, sign(s.plaque, 1.2, 0, 1.15, 0.66, 0));
    statue.position.set(s.x, heightAt(s.x, s.z), s.z);
    statue.rotation.y = s.facing;
    statue.traverse((o) => (o.castShadow = true));
    group.add(statue);
  }
}

function sign(text: string, w: number, x: number, y: number, z: number, yaw: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 8), new THREE.MeshStandardMaterial({ map: labelTexture(text), roughness: 0.6 }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = yaw;
  return mesh;
}

/** The electron microscope: cabinet, a column of lens rings, the gun on top, and a console with two screens. */
function electronMicroscope(): THREE.Group {
  const em = new THREE.Group();
  const white = mat('#e9ecef', 0.5);
  const steel = mat('#c9cfd6', 0.35, 0.5);
  const blue = mat('#3b6ea8', 0.4, 0.3);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.3), white);
  cabinet.position.y = 0.55;
  em.add(cabinet);
  let y = 1.1;
  for (const [r, h, m] of [[0.5, 0.5, steel], [0.42, 0.35, blue], [0.4, 0.4, steel], [0.42, 0.35, blue], [0.36, 0.4, steel], [0.3, 0.35, blue]] as const) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), m);
    ring.position.y = y + h / 2;
    em.add(ring);
    y += h;
  }
  const gun = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), white);
  gun.position.y = y;
  em.add(gun);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.8), white);
  desk.position.set(-1.5, 0.4, 1.2);
  em.add(desk);
  const screen = new THREE.MeshStandardMaterial({ color: '#0d1b2a', emissive: '#2f6fae', emissiveIntensity: 0.8 });
  for (const dz of [0.75, 1.65]) {
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.8), screen);
    monitor.position.set(-1.65, 1.1, dz);
    em.add(monitor);
  }
  em.traverse((o) => (o.castShadow = true));
  return em;
}

/** The science building: glass ground floor (the lab) under an opaque upper block, whose underside is the lab ceiling. */
function scienceBuilding(group: THREE.Group, walls: Box[]): THREE.Group {
  const { x0, x1, z0, z1 } = SCIENCE;
  const [w, d, cx, cz] = [x1 - x0, z1 - z0, (x0 + x1) / 2, (z0 + z1) / 2];
  const g = heightAt(cx, cz);
  const T = 0.2;
  const glassWalls = [
    box(x0, x1, z0 - T / 2, z0 + T / 2),
    box(x0, x1, z1 - T / 2, z1 + T / 2),
    box(x1 - T / 2, x1 + T / 2, z0, z1),
    box(x0 - T / 2, x0 + T / 2, z0, DOOR.z0),
    box(x0 - T / 2, x0 + T / 2, DOOR.z1, z1),
  ];
  const glass = new THREE.MeshPhysicalMaterial({ color: '#a9cde0', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const frame = mat('#2f3439', 0.5, 0.4);
  for (const b of glassWalls) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, LAB_H, b.z1 - b.z0), glass);
    pane.position.set((b.x0 + b.x1) / 2, g + LAB_H / 2, (b.z0 + b.z1) / 2);
    group.add(pane);
    // mullions every 2.5 m along the wall
    const len = Math.max(b.x1 - b.x0, b.z1 - b.z0);
    for (let s = 0; s <= len + 0.01; s += len / Math.max(1, Math.round(len / 2.5))) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, LAB_H, 0.14), frame);
      const alongX = b.x1 - b.x0 > b.z1 - b.z0;
      post.position.set(alongX ? b.x0 + s : (b.x0 + b.x1) / 2, g + LAB_H / 2, alongX ? (b.z0 + b.z1) / 2 : b.z0 + s);
      group.add(post);
    }
  }
  walls.push(...glassWalls);

  const upperH = 9;
  const upper = facadeBox(w + 0.4, upperH, d + 0.4, 3, facadeTexture('#d5d8da', '#4f7391'), mat('#9aa0a6'), new THREE.MeshStandardMaterial({ color: '#e6e8ea', emissive: '#7d8185', roughness: 0.9 }));
  upper.position.set(cx, g + LAB_H + upperH / 2, cz);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.06, d - 0.2), mat('#b9bec3', 0.5));
  floor.position.set(cx, g + 0.03, cz);
  floor.receiveShadow = true;
  group.add(upper, floor);
  group.add(sign('Science Building', 10, x0 - 0.22, g + LAB_H + 1.1, cz, -Math.PI / 2));
  group.add(sign('Electron Microscopy Lab', 4.4, x1 - 0.3, g + 3.3, EM_SPOT.z, -Math.PI / 2));

  // lab benches along the north and south walls
  const bench = mat('#cfd5db', 0.5);
  for (const bz of [z0 + 0.8, z1 - 0.8]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(7, 0.95, 1), bench);
    top.position.set(x0 + 7, g + 0.475, bz);
    top.castShadow = top.receiveShadow = true;
    group.add(top);
    walls.push(box(x0 + 3.5, x0 + 10.5, bz - 0.5, bz + 0.5));
  }
  const light = new THREE.PointLight('#fff4e6', 22, 30, 1.6);
  light.position.set(cx, g + LAB_H - 0.4, cz);
  group.add(light);

  // the microscope's bay: a dark floor disc with a yellow safety ring; the microscope appears once it is built
  const bay = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40).rotateX(-Math.PI / 2), mat('#3a3f46', 0.6));
  bay.position.set(EM_SPOT.x, g + 0.07, EM_SPOT.z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.85, 40).rotateX(-Math.PI / 2), mat('#e0b400', 0.6));
  ring.position.set(EM_SPOT.x, g + 0.075, EM_SPOT.z);
  const em = electronMicroscope();
  em.position.set(EM_SPOT.x, g + 0.06, EM_SPOT.z);
  group.add(bay, ring, em);
  return em;
}

export interface Campus {
  group: THREE.Group;
  /** Solid footprints the player cannot walk through. */
  walls: Box[];
  /** The electron microscope model in the lab; hidden until the player builds one. */
  em: THREE.Group;
  /** Per frame: falling water and the tower clock. */
  update(t: number): void;
}

export function buildCampus(): Campus {
  const group = new THREE.Group();
  const walls: Box[] = [];
  HALLS.forEach((h) => hall(h, group));
  walls.push(...FOOTPRINTS.filter((b) => b !== SCIENCE));

  // the domed hall's dome
  const sibley = HALLS[0]!.box;
  const [sx, sz] = [(sibley.x0 + sibley.x1) / 2, (sibley.z0 + sibley.z1) / 2];
  const top = heightAt(sx, sz) - 0.5 + 3 * FLOOR_H + 0.5;
  const domeMat = mat('#7f8b8f', 0.6, 0.3);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 3.2, 24), mat('#a39a88'));
  drum.position.set(sx, top + 1.6, sz);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.position.set(sx, top + 3.2, sz);
  drum.castShadow = dome.castShadow = true;
  group.add(drum, dome);

  // the east hall's columned portico, facing the quad
  const stone = mat('#e3dac6', 0.8);
  const gy = heightAt(PORTICO.x0, -20);
  const colH = 3 * FLOOR_H - 1.6;
  for (let i = 0; i < 6; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, colH, 14), stone);
    col.position.set(PORTICO.x0 + 0.6, gy + colH / 2, PORTICO.z0 + 0.8 + i * 2.48);
    col.castShadow = true;
    group.add(col);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, PORTICO.z1 - PORTICO.z0 + 0.4), stone);
  beam.position.set((PORTICO.x0 + PORTICO.x1) / 2, gy + colH + 0.4, (PORTICO.z0 + PORTICO.z1) / 2);
  const pediment = new THREE.Mesh(prism(PORTICO.z1 - PORTICO.z0 + 0.4, 2.2, 2.6), stone);
  pediment.rotation.y = Math.PI / 2;
  pediment.position.set(beam.position.x, gy + colH + 0.8, beam.position.z);
  beam.castShadow = pediment.castShadow = true;
  group.add(beam, pediment);

  const hands = tower(group);
  statues(group);
  const em = scienceBuilding(group, walls);

  // The waterfall: a sheet of scrolling water where the lake spills into the gorge, foam at the foot
  const fallTex = waterfallTexture();
  fallTex.repeat.set(2, 1.5);
  const lip = WATER_LEVEL + 0.05;
  const foot = creekY(FALLS_X) - 0.3;
  const fall = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, lip - foot),
    new THREE.MeshStandardMaterial({ map: fallTex, emissiveMap: fallTex, emissive: '#ffffff', emissiveIntensity: 0.45, transparent: true, opacity: 0.88, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  fall.rotation.y = -Math.PI / 2;
  fall.position.set(FALLS_X - 0.9, (lip + foot) / 2, gorgeZ(FALLS_X));
  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#f4f8fa', transparent: true, opacity: 0.65, depthWrite: false }),
  );
  foam.position.set(FALLS_X - 2.4, creekY(FALLS_X) + 0.05, gorgeZ(FALLS_X));
  group.add(fall, foam);

  return {
    group,
    walls,
    em,
    update(t) {
      fallTex.offset.y = t * 0.0011;
      foam.scale.setScalar(1 + 0.05 * Math.sin(t * 0.004));
      const now = new Date();
      const minutes = now.getMinutes() + now.getSeconds() / 60;
      hands.forEach((hand, i) => (hand.rotation.z = -((i % 2 ? minutes / 60 : ((now.getHours() % 12) + minutes / 60) / 12) * Math.PI * 2)));
    },
  };
}
