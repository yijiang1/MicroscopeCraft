import { STORE_FURNITURE } from './store-interior';
import { LIFT } from './tower-lift';
import { buildScopeStore, storeFloorAt, STORE_FOOTPRINT, STORE_WALLS } from './store-building';
// Campus buildings on the hilltop: the halls and statues around the quad, a clock tower with a working clock,
// the science building with the electron microscopy lab on its glass ground floor, and the waterfall; to the south,
// the engineering quad (after Cornell's): the materials, geology, east and south halls and a glass atrium. Every hall
// has a door and a ground-floor room. East are the athletic fields over the storage ring and the chemistry building;
// north, over the gorge, a suspension footbridge leads to the residence halls; west, down the slope, the Gothic west
// campus halls and a tower. At the top of the slope by the gorge, the art museum (after I. M. Pei's Johnson Museum). An iron railing runs along both rims of the gorge, open only at the trails down to the creek.
// Boxes, prisms and canvas textures only. Walls are axis-aligned boxes the player collides with.
import * as THREE from 'three';
import { booksTexture, facadeTexture, fieldTexture, labelTexture, meshTexture, waterfallTexture } from './textures';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAYUGA_X, creekY, FALLS_X, gorgeZ, heightAt, TRAILS, WATER_LEVEL } from './terrain';

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
/** The greenhouse, south of the quad, entered by a door in its north wall. */
export const GREENHOUSE = box(2, 14, 10, 20);
const GH_DOOR = { x0: 7, x1: 9 };
const GH_H = 3.2;
/** Wilson Laboratory, east of campus: its hall is the CHESS experimental hall, beside the CESR ring. Door in the west wall. */
export const WILSON = box(50, 72, -14, 6);
const WL_DOOR = { z0: -6, z1: -2 };
const WL_H = 7;
/** The ring's tunnel wall (concrete shielding) along the east side of the hall, and the hutch where the beam ends. */
const RING_WALL_X = 68.5;
const HUTCH = box(52, 60, -8, -1);
const BEAM_Z = -4.5;
/** The beamline's control desk, where you put samples in. */
export const BEAM_SPOT = { x: 56, z: 0.5 };

/** The glass atrium on the engineering quad (after Duffield Hall's), with display cases of nanomaterials and devices.
 *  Door in the south wall, facing the quad. */
export const ATRIUM = box(8, 30, 46, 58);
const AT_DOOR = { x0: 17, x1: 21 };
const AT_H = 6;

/** The art museum (after I. M. Pei's Johnson Museum of Art, 1973): a concrete gallery on the ground floor, two towers
 *  rising from it and a top floor bridging them, cantilevered west over the slope, with an open sculpture court beneath.
 *  Door in the east wall, facing the quad. */
export const MUSEUM = box(-46, -36, -44.5, -34.5);
const MU_DOOR = { z0: -40.7, z1: -38.3 };
const MU_H = 4.6;

const FLOOR_H = 3.6;
/** Thickness of a hall's ground-floor walls, and the width of its door. */
const WALL_T = 0.3;
const DOOR_W = 2.4;
interface Hall {
  box: Box;
  floors: number;
  wall: string;
  flat?: boolean;
  /** Collegiate Gothic: a crenellated parapet around the flat roof. */
  gothic?: boolean;
  /** The door: which wall, and where along it (an x on the north or south wall, a z on the east or west wall). */
  door: { side: 'n' | 's' | 'e' | 'w'; at: number };
  /** The ground-floor room: bookshelves, a lab bench with glassware, or a blackboard over a long table, on the wall facing the door. */
  room: 'books' | 'lab' | 'class';
}
const HALLS: Hall[] = [
  { box: box(-18, 18, -48, -40), floors: 3, wall: '#a39a88', door: { side: 's', at: 0 }, room: 'class' }, // domed hall (dome below), north end of the quad
  { box: box(-34, -26, -36, -26), floors: 3, wall: '#8f8a80', door: { side: 'e', at: -31 }, room: 'lab' }, // west row of halls
  { box: box(-34, -26, -23, -13), floors: 3, wall: '#968f82', door: { side: 'e', at: -18 }, room: 'lab' },
  { box: box(-34, -26, -10, -2), floors: 3, wall: '#8a8478', door: { side: 'e', at: -6 }, room: 'class' },
  { box: box(26, 36, -32, -8), floors: 3, wall: '#d8cdb4', door: { side: 'w', at: -20 }, room: 'class' }, // columned hall (portico below), east side
  { box: box(-44, -34, 4, 14), floors: 2, wall: '#8f8a80', door: { side: 'e', at: 6.5 }, room: 'books' }, // library, by the tower at the top of the west slope
  { box: box(-20, -6, 12, 22), floors: 3, wall: '#c9c1b0', flat: true, door: { side: 'n', at: -13 }, room: 'books' }, // south library
  // the engineering quad
  { box: box(-30, -6, 46, 56), floors: 3, wall: '#b3a58f', door: { side: 's', at: -9 }, room: 'lab' }, // materials science hall (Bard), north side
  { box: box(-42, -30, 62, 88), floors: 3, wall: '#9a8b78', door: { side: 'e', at: 76 }, room: 'lab' }, // geology hall (Snee), west side, its rock garden in front
  { box: box(34, 46, 62, 88), floors: 4, wall: '#a8a49a', flat: true, door: { side: 'w', at: 76 }, room: 'class' }, // east hall (Upson)
  { box: box(-26, 22, 98, 108), floors: 3, wall: '#c2b8a4', door: { side: 'n', at: 0 }, room: 'class' }, // south hall (Phillips)
  // east of the science building: the chemistry building (after Baker Lab)
  { box: box(52, 68, 16, 30), floors: 3, wall: '#b8a48a', door: { side: 'w', at: 23 }, room: 'lab' },
  // by the athletic fields: the field house (after Barton Hall)
  { box: box(80, 100, 34, 48), floors: 2, wall: '#8c8070', door: { side: 'n', at: 90 }, room: 'class' },
  // north campus, over the gorge: two residence halls
  { box: box(14, 38, -104, -94), floors: 4, wall: '#b9ad9a', flat: true, door: { side: 's', at: 26 }, room: 'books' },
  { box: box(-8, 6, -108, -92), floors: 3, wall: '#a69c8c', door: { side: 's', at: -1 }, room: 'books' },
  // west campus, at the foot of the slope: Gothic stone residence halls and a tower (after the Baker group)
  { box: box(-110, -90, -26, -16), floors: 4, wall: '#8a8173', flat: true, gothic: true, door: { side: 'e', at: -21 }, room: 'books' },
  { box: box(-110, -90, 0, 10), floors: 4, wall: '#857c6f', flat: true, gothic: true, door: { side: 'e', at: 5 }, room: 'books' },
  { box: box(-86, -80, -12, -6), floors: 7, wall: '#7d766a', flat: true, gothic: true, door: { side: 'e', at: -9 }, room: 'class' },
  { box: box(-118, -112, -14, -4), floors: 3, wall: '#8f8578', flat: true, gothic: true, door: { side: 'e', at: -9 }, room: 'class' },
];
/** The clock tower, where the bells hang. */
export const TOWER = { x: -38, z: -1, half: 2.5 };
const PORTICO = box(23.6, 26, -27, -13);
const PORTICO_COLUMNS = Array.from({ length: 6 }, (_, i) => ({ x: PORTICO.x0 + 0.6, z: PORTICO.z0 + 0.8 + i * 2.48 }));
/** The athletic fields east of campus, over the storage ring's tunnel: a gridiron with stands, and a practice field. */
const GRIDIRON = box(84, 118, -26, -8);
const STANDS = box(86, 116, -33, -28);
const PRACTICE = box(84, 118, 2, 24);
/** The suspension footbridge over the gorge just below the falls (after the Fall Creek suspension bridge): its deck
 *  runs north–south between the towers on the two rims. */
const BRIDGE = { x: 26, z0: -80, z1: -54.5, half: 1, y: 0.75 };
const BRIDGE_TOWERS = [-78.5, -56] as const;
/** Two pioneers of microscopy face each other across the quad: light on the west side, electrons on the east. */
const STATUES = [
  { x: -15, z: -19, facing: Math.PI / 2, who: 'leeuwenhoek', plaque: 'Antonie van Leeuwenhoek  1632–1723' },
  { x: 15, z: -19, facing: -Math.PI / 2, who: 'ruska', plaque: 'Ernst Ruska  1906–1988' },
] as const;

/** Everything with a footprint, for keeping scenery out of buildings. */
export const FOOTPRINTS: Box[] = [
  STORE_FOOTPRINT,
  ...HALLS.map((h) => h.box),
  PORTICO,
  box(TOWER.x - TOWER.half, TOWER.x + TOWER.half, TOWER.z - TOWER.half, TOWER.z + TOWER.half),
  SCIENCE,
  MUSEUM,
  ...STATUES.map((s) => box(s.x - 0.7, s.x + 0.7, s.z - 0.7, s.z + 0.7)),
];
/** Inside a building, or on a structure where no scenery grows: the sports fields and their stands, the bridge. */
export const insideBuilding = (x: number, z: number, margin = 0) =>
  [box(LIFT.x - 1.6, LIFT.x + 2.3, LIFT.z - 1.6, LIFT.z + 1.6), ...FOOTPRINTS, GREENHOUSE, WILSON, ATRIUM, box(GRIDIRON.x0 - 2, GRIDIRON.x1 + 2, STANDS.z0, PRACTICE.z1 + 2), box(BRIDGE.x - 2, BRIDGE.x + 2, BRIDGE.z0 - 2, BRIDGE.z1 + 2)].some(
    (b) => x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin,
  );
const inside = (b: Box, x: number, z: number) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
export const inLab = (x: number, z: number) => inside(SCIENCE, x, z);
export const inChess = (x: number, z: number) => inside(WILSON, x, z);
export const inGreenhouse = (x: number, z: number) => inside(GREENHOUSE, x, z);
export const inAtrium = (x: number, z: number) => inside(ATRIUM, x, z);
/** Inside any building's walls: the lab, Wilson Lab, the greenhouse, the atrium or a hall's ground-floor room. */
export const indoors = (x: number, z: number) =>
  inside(STORE_FOOTPRINT, x, z) || inLab(x, z) || inChess(x, z) || inGreenhouse(x, z) || inAtrium(x, z) || inside(MUSEUM, x, z) || HALLS.some((h) => inside(h.box, x, z));
/** Up on the bridge deck, rather than down in the gorge under it, with the feet at `feet`. */
export const onDeck = (x: number, z: number, feet = Infinity) =>
  Math.abs(x - BRIDGE.x) < BRIDGE.half && z > BRIDGE.z0 && z < BRIDGE.z1 && feet > BRIDGE.y - 1;
/** Feet rest on the bridge deck, the raised shop floor, or the terrain. */
export const groundAt = (x: number, z: number, feet = Infinity) => (onDeck(x, z, feet) ? Math.max(heightAt(x, z), BRIDGE.y) : storeFloorAt(x, z) ?? heightAt(x, z));
/** The bridge's side screens, solid only to someone on the deck. */
export const BRIDGE_RAILS: Box[] = [-1, 1].map((s) => box(BRIDGE.x + s * BRIDGE.half - 0.05, BRIDGE.x + s * BRIDGE.half + 0.05, BRIDGE.z0, BRIDGE.z1));

/** A hall's furniture: one long piece along the wall facing the door, a metre short of each corner. */
function furnitureOf(h: Hall): Box {
  const { x0, x1, z0, z1 } = h.box;
  const depth = h.room === 'books' ? 0.5 : 0.85;
  const i = WALL_T + 0.05;
  switch (h.door.side) {
    case 's': return box(x0 + 1, x1 - 1, z0 + i, z0 + i + depth);
    case 'n': return box(x0 + 1, x1 - 1, z1 - i - depth, z1 - i);
    case 'e': return box(x0 + i, x0 + i + depth, z0 + 1, z1 - 1);
    case 'w': return box(x1 - i - depth, x1 - i, z0 + 1, z1 - 1);
  }
}
const FURNITURE = HALLS.map(furnitureOf);
/** Solid inside a building, where nothing may be placed: walls, the ring wall, the hutch, the beam pipe, benches. */
export const INDOOR_SOLIDS: Box[] = [box(RING_WALL_X, WILSON.x1, WILSON.z0, WILSON.z1), HUTCH, box(60, RING_WALL_X, BEAM_Z - 0.6, BEAM_Z + 0.6), ...FURNITURE];

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

const CEILING = new THREE.MeshStandardMaterial({ color: '#e8e4dc', emissive: '#6f6b64', roughness: 0.9 });
const WOOD = mat('#6b4a2e', 0.8);
const BENCH = mat('#cfd5db', 0.5);

/** A hall: a ground-floor room walled in on all four sides but for the door, under the solid upper floors. */
function hall(h: Hall, group: THREE.Group, walls: Box[]) {
  const { x0, x1, z0, z1 } = h.box;
  const [w, d, cx, cz] = [x1 - x0, z1 - z0, (x0 + x1) / 2, (z0 + z1) / 2];
  const ground = heightAt(cx, cz);
  const g = ground - 0.5; // sunk a little so no edge floats
  const height = h.floors * FLOOR_H + 0.5;
  const tex = facadeTexture(h.wall, '#33404d');
  // the north and south walls run the full width; the east and west walls fit between them, so no faces overlap
  const T = WALL_T;
  const sides: Record<Hall['door']['side'], Box> = {
    n: box(x0, x1, z0, z0 + T), s: box(x0, x1, z1 - T, z1), w: box(x0, x0 + T, z0 + T, z1 - T), e: box(x1 - T, x1, z0 + T, z1 - T),
  };
  const { side, at } = h.door;
  for (const [key, b] of Object.entries(sides)) {
    const alongX = key === 'n' || key === 's';
    const segments = key !== side ? [b]
      : alongX ? [box(b.x0, at - DOOR_W / 2, b.z0, b.z1), box(at + DOOR_W / 2, b.x1, b.z0, b.z1)]
      : [box(b.x0, b.x1, b.z0, at - DOOR_W / 2), box(b.x0, b.x1, at + DOOR_W / 2, b.z1)];
    for (const seg of segments) {
      const wall = facadeBox(seg.x1 - seg.x0, FLOOR_H + 0.5, seg.z1 - seg.z0, 1, tex, SLATE);
      wall.position.set((seg.x0 + seg.x1) / 2, g + (FLOOR_H + 0.5) / 2, (seg.z0 + seg.z1) / 2);
      group.add(wall);
      walls.push(seg);
    }
    if (key === side) {
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(alongX ? DOOR_W : T, 0.9, alongX ? T : DOOR_W), mat(h.wall, 0.9));
      lintel.position.set(alongX ? at : (b.x0 + b.x1) / 2, ground + FLOOR_H - 0.45, alongX ? (b.z0 + b.z1) / 2 : at);
      group.add(lintel);
    }
  }
  const upper = facadeBox(w, height - FLOOR_H - 0.5, d, h.floors - 1, tex, SLATE, CEILING);
  upper.position.set(cx, ground + FLOOR_H + (height - FLOOR_H - 0.5) / 2, cz);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * T, 0.06, d - 2 * T), mat('#9c8f7c', 0.7));
  floor.position.set(cx, ground + 0.03, cz);
  floor.receiveShadow = true;
  group.add(upper, floor);
  room(h, ground, group, walls);
  if (h.gothic) {
    // merlons a metre apart all round the roof edge, merged into one mesh
    const merlons: THREE.BufferGeometry[] = [];
    const top = ground + h.floors * FLOOR_H;
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]] as const) {
      const n = Math.round(Math.hypot(bx - ax, bz - az));
      for (let i = 0; i < n; i += 2) {
        const k = (i + 0.5) / n;
        merlons.push(new THREE.BoxGeometry(0.55, 0.7, 0.55).translate(ax + (bx - ax) * k, top + 0.35, az + (bz - az) * k));
      }
    }
    const parapet = new THREE.Mesh(mergeGeometries(merlons)!, mat(h.wall, 0.95));
    parapet.castShadow = true;
    group.add(parapet);
  }
  if (h.flat) return;
  const alongX = w >= d;
  const span = (alongX ? d : w) + 0.6;
  const roof = new THREE.Mesh(prism(span, Math.min(span * 0.35, 4), (alongX ? w : d) + 0.6), SLATE);
  if (alongX) roof.rotation.y = Math.PI / 2;
  roof.position.set(cx, g + height, cz);
  roof.castShadow = true;
  group.add(roof);
}

/** The furniture along the wall facing the door: bookshelves, a lab bench with glassware, or a table under a blackboard. */
function room(h: Hall, ground: number, group: THREE.Group, walls: Box[]) {
  const f = furnitureOf(h);
  walls.push(f);
  const [fw, fd, fx, fz] = [f.x1 - f.x0, f.z1 - f.z0, (f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2];
  const alongX = fw > fd;
  const piece = (height: number, m: THREE.Material | THREE.Material[]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(fw, height, fd), m);
    mesh.position.set(fx, ground + height / 2, fz);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  };
  // the side facing into the room, as a BoxGeometry material index: +x, -x, +y, -y, +z, -z
  const face = { s: 4, n: 5, e: 0, w: 1 }[h.door.side];
  if (h.room === 'books') {
    const t = booksTexture();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(Math.round(Math.max(fw, fd) / 1.5), 1);
    const spines = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    piece(2.2, Array.from({ length: 6 }, (_, i) => (i === face ? spines : WOOD)));
    return;
  }
  if (h.room === 'class') {
    piece(0.75, WOOD);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(Math.max(fw, fd) - 1, 8), 1.3), mat('#24392c', 0.95));
    const into = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[h.door.side]; // from the back wall toward the door
    const depth = Math.min(fw, fd);
    board.position.set(fx - into[0]! * (depth / 2 + 0.03), ground + 1.9, fz - into[1]! * (depth / 2 + 0.03));
    board.rotation.y = Math.atan2(into[0]!, into[1]!);
    group.add(board);
    return;
  }
  piece(0.95, BENCH);
  // glassware along the bench: flasks and beakers of coloured solutions
  const liquids = ['#3a7bd5', '#e0b400', '#d0453a', '#3aa76d', '#9b59b6'];
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f4f8', transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false });
  const len = Math.max(fw, fd);
  for (let i = 0, s = -len / 2 + 0.8; s < len / 2 - 0.5; s += 1.6, i++) {
    const [x, z] = alongX ? [fx + s, fz] : [fx, fz + s];
    const flask = i % 2
      ? new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 12), glass)
      : new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 12), glass);
    flask.position.set(x, ground + 1.07, z);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(i % 2 ? 0.06 : 0.07, i % 2 ? 0.06 : 0.09, 0.08, 12), mat(liquids[i % liquids.length]!, 0.3));
    liquid.position.set(x, ground + 0.995, z);
    group.add(flask, liquid);
  }
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

/** The electron microscope in the lab, assembled part by part: each crafted component appears in place.
 *  Cabinet and pumps (vacuum system), viewing chamber (screen), projector, objective with its side-entry holder,
 *  condensers, gun; the STEM upgrade adds a corrector stack and detectors. */
export interface EmModel {
  group: THREE.Group;
  /** Show the parts the player owns (an owned microscope shows all of its parts). */
  show(has: (itemId: string) => boolean): void;
}

function electronMicroscope(): EmModel {
  const em = new THREE.Group();
  const white = mat('#e9ecef', 0.5);
  const steel = mat('#c9cfd6', 0.35, 0.5);
  const blue = mat('#3b6ea8', 0.4, 0.3);
  const parts: Record<string, THREE.Object3D[]> = {};
  const add = (part: string, ...objs: THREE.Object3D[]) => {
    (parts[part] ??= []).push(...objs);
    em.add(...objs);
  };
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.3), white);
  cabinet.position.y = 0.55;
  const pumps = [-0.85, 0.85].map((z) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 16), mat('#8a9098', 0.4, 0.5));
    p.position.set(0.5, 0.35, z);
    return p;
  });
  add('vacuum_system', cabinet, ...pumps);
  const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), steel);
  chamber.position.set(0, 1.05, 0.55);
  const screen = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), new THREE.MeshStandardMaterial({ color: '#0a2a10', emissive: '#3aff6a', emissiveIntensity: 0.6 }));
  screen.position.set(0, 1.05, 0.81);
  add('viewing_screen', chamber, screen);
  let y = 1.1;
  const rings: [number, number, THREE.Material, string][] = [
    [0.5, 0.5, steel, 'projector_lenses'], [0.42, 0.35, blue, 'projector_lenses'], [0.4, 0.4, steel, 'objective_assembly'],
    [0.42, 0.35, blue, 'condenser_lenses'], [0.36, 0.4, steel, 'condenser_lenses'], [0.3, 0.35, blue, 'electron_gun'],
  ];
  for (const [r, h, m, part] of rings) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), m);
    ring.position.y = y + h / 2;
    add(part, ring);
    y += h;
  }
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 10), mat('#d0a050', 0.3, 0.8));
  holder.rotation.z = Math.PI / 2;
  holder.position.set(-0.6, 1.1 + 0.85 + 0.2, 0);
  add('objective_assembly', holder);
  const gun = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), white);
  gun.position.y = y;
  add('electron_gun', gun);
  // the STEM upgrade: a corrector stack lifts the gun higher, and an annular detector box sits under the objective
  const corrector = [0, 1, 2].map((i) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 24), mat(i % 2 ? '#d0905a' : '#e8e0d0', 0.4, 0.4));
    c.position.y = y + 0.32 + i * 0.3;
    return c;
  });
  const stemGun = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), white);
  stemGun.position.y = y + 1.22;
  const detector = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), mat('#e8d870', 0.4));
  detector.position.set(0.55, 1.75, 0);
  add('stem_microscope', ...corrector, stemGun, detector);
  // the console: always there, waiting
  const desk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.8), white);
  desk.position.set(-1.5, 0.4, 1.2);
  em.add(desk);
  const glow = new THREE.MeshStandardMaterial({ color: '#0d1b2a', emissive: '#2f6fae', emissiveIntensity: 0.8 });
  for (const dz of [0.75, 1.65]) {
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.8), glow);
    monitor.position.set(-1.65, 1.1, dz);
    em.add(monitor);
  }
  em.traverse((o) => (o.castShadow = true));
  return {
    group: em,
    show(has) {
      const tem = has('electron_microscope') || has('stem_microscope');
      for (const [part, objs] of Object.entries(parts)) {
        const on = part === 'stem_microscope' ? has(part) : tem || has(part);
        objs.forEach((o) => (o.visible = on));
      }
      // with the STEM built, the old gun dome gives way to the corrector stack and field-emission gun
      if (has('stem_microscope')) parts.electron_gun!.at(-1)!.visible = false;
    },
  };
}

/** The science building: glass ground floor (the lab) under an opaque upper block, whose underside is the lab ceiling. */
function scienceBuilding(group: THREE.Group, walls: Box[]): EmModel {
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
  em.group.position.set(EM_SPOT.x, g + 0.06, EM_SPOT.z);
  group.add(bay, ring, em.group);

  // the reagent shelf by the door, where the stains are kept (the bottles on it are gatherable)
  const shelf = new THREE.Group();
  const wood = mat('#c8ccd0', 0.5);
  for (const h of [0.4, 0.95, 1.5]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 3.4), wood);
    plank.position.set(0, h, 0);
    shelf.add(plank);
  }
  for (const dz of [-1.7, 1.7]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.6, 0.04), wood);
    side.position.set(0, 0.8, dz);
    shelf.add(side);
  }
  shelf.position.set(SCIENCE.x0 + 0.45, g, 15.2);
  group.add(shelf, sign('Stains and reagents', 1.8, SCIENCE.x0 + 0.2, g + 1.9, 15.2, Math.PI / 2));
  walls.push(box(SCIENCE.x0 + 0.1, SCIENCE.x0 + 0.7, 13.5, 16.9));
  return em;
}

/** A glass greenhouse with a pitched glass roof and planters inside. */
function greenhouse(group: THREE.Group, walls: Box[]) {
  const { x0, x1, z0, z1 } = GREENHOUSE;
  const g = heightAt((x0 + x1) / 2, (z0 + z1) / 2);
  const T = 0.12;
  const panes = [
    box(x0, GH_DOOR.x0, z0 - T / 2, z0 + T / 2), box(GH_DOOR.x1, x1, z0 - T / 2, z0 + T / 2),
    box(x0, x1, z1 - T / 2, z1 + T / 2), box(x0 - T / 2, x0 + T / 2, z0, z1), box(x1 - T / 2, x1 + T / 2, z0, z1),
  ];
  const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe8dc', transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  const frame = mat('#f2f2ee', 0.5);
  for (const b of panes) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, GH_H, b.z1 - b.z0), glass);
    pane.position.set((b.x0 + b.x1) / 2, g + GH_H / 2, (b.z0 + b.z1) / 2);
    group.add(pane);
  }
  walls.push(...panes);
  for (let x = x0; x <= x1 + 0.01; x += 2) {
    for (const z of [z0, z1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, GH_H, 0.08), frame);
      post.position.set(x, g + GH_H / 2, z);
      group.add(post);
    }
  }
  const roof = new THREE.Mesh(prism(z1 - z0 + 0.3, 1.6, x1 - x0 + 0.3), glass);
  roof.rotation.y = Math.PI / 2;
  roof.position.set((x0 + x1) / 2, g + GH_H, (z0 + z1) / 2);
  group.add(roof);
  // planters along the south and east walls
  const soil = mat('#4a3626', 1);
  const planterWood = mat('#8a6a48', 0.9);
  for (const b of [box(x0 + 0.4, x1 - 2.2, z1 - 1.5, z1 - 0.3), box(x1 - 1.5, x1 - 0.3, z0 + 1.2, z1 - 1.6)]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, 0.35, b.z1 - b.z0), planterWood);
    p.position.set((b.x0 + b.x1) / 2, g + 0.17, (b.z0 + b.z1) / 2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0 - 0.1, 0.02, b.z1 - b.z0 - 0.1), soil);
    top.position.set(p.position.x, g + 0.35, p.position.z);
    group.add(p, top);
  }
  group.add(sign('Greenhouse', 3, (x0 + x1) / 2, g + GH_H + 0.35, z0 - 0.1, Math.PI)); // faces north, toward the path
}

/** The atrium: a tall glass hall on a steel frame with a flat glass roof, open to the quad through its south door. */
function atrium(group: THREE.Group, walls: Box[]) {
  const { x0, x1, z0, z1 } = ATRIUM;
  const g = heightAt((x0 + x1) / 2, (z0 + z1) / 2);
  const T = 0.14;
  const panes = [
    box(x0, x1, z0 - T / 2, z0 + T / 2), box(x0, AT_DOOR.x0, z1 - T / 2, z1 + T / 2), box(AT_DOOR.x1, x1, z1 - T / 2, z1 + T / 2),
    box(x0 - T / 2, x0 + T / 2, z0, z1), box(x1 - T / 2, x1 + T / 2, z0, z1),
  ];
  const glass = new THREE.MeshPhysicalMaterial({ color: '#d6e6f0', transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  const steel = mat('#5b636d', 0.45, 0.6);
  for (const b of panes) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, AT_H, b.z1 - b.z0), glass);
    pane.position.set((b.x0 + b.x1) / 2, g + AT_H / 2, (b.z0 + b.z1) / 2);
    group.add(pane);
  }
  walls.push(...panes);
  for (let x = x0; x <= x1 + 0.01; x += 2.75) {
    for (const z of [z0, z1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, AT_H, 0.16), steel);
      post.position.set(x, g + AT_H / 2, z);
      group.add(post);
    }
  }
  for (let z = z0 + 3; z < z1; z += 3) {
    for (const x of [x0, x1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, AT_H, 0.16), steel);
      post.position.set(x, g + AT_H / 2, z);
      group.add(post);
    }
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.3, 0.08, z1 - z0 + 0.3), glass);
  roof.position.set((x0 + x1) / 2, g + AT_H, (z0 + z1) / 2);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0), mat('#d9d4ca', 0.6));
  floor.position.set((x0 + x1) / 2, g + 0.03, (z0 + z1) / 2);
  floor.receiveShadow = true;
  group.add(roof, floor);
  for (const [w, d, x, z] of [[x1 - x0 + 0.4, 0.3, (x0 + x1) / 2, z0], [x1 - x0 + 0.4, 0.3, (x0 + x1) / 2, z1], [0.3, z1 - z0, x0, (z0 + z1) / 2], [0.3, z1 - z0, x1, (z0 + z1) / 2]] as const) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), steel);
    beam.position.set(x, g + AT_H, z);
    group.add(beam);
  }
  group.add(sign('Nanoscale Science Atrium', 6, (AT_DOOR.x0 + AT_DOOR.x1) / 2, g + AT_H - 0.9, z1 + 0.12, 0));
}

/** The ring diagram on the shielding wall: CESR, the CHESS-U sector and this beamline, with lamps for the parts in the tunnel. */
function ringSign(): { mesh: THREE.Mesh; lamps: Record<string, THREE.Mesh> } {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 768;
  const g2 = c.getContext('2d')!;
  g2.fillStyle = '#1e2a36';
  g2.fillRect(0, 0, 1024, 768);
  g2.strokeStyle = '#5aa0e0';
  g2.lineWidth = 18;
  g2.beginPath();
  g2.arc(512, 400, 250, 0, Math.PI * 2);
  g2.stroke();
  g2.strokeStyle = '#ffd24a';
  g2.lineWidth = 26;
  g2.beginPath();
  g2.arc(512, 400, 250, Math.PI * 0.42, Math.PI * 0.75);
  g2.stroke();
  g2.fillStyle = '#f4f1ea';
  g2.textAlign = 'center';
  g2.font = '600 46px Georgia, serif';
  g2.fillText('The Electron Storage Ring', 512, 70);
  g2.font = '30px Georgia, serif';
  g2.fillText('768 m around, in a tunnel under the athletic fields', 512, 120);
  g2.fillText('6 GeV positrons, 200 mA', 512, 400);
  g2.fillStyle = '#ffd24a';
  g2.fillText('CHESS-U: six double-bend achromats', 512, 700);
  g2.fillText('in the south arc make room for undulators', 512, 740);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.5), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
  const lamps: Record<string, THREE.Mesh> = {};
  ['dba_cell', 'undulator', 'front_end'].forEach((id, i) => {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: '#333', emissive: '#000' }));
    lamp.position.set(-1.2 + i * 1.2, -1.6, 0.05);
    mesh.add(lamp);
    lamps[id] = lamp;
  });
  return { mesh, lamps };
}

export interface BeamlineModel {
  show(has: (itemId: string) => boolean): void;
}

/** Wilson Laboratory: a brick hall beside the CESR tunnel, with a beamline from the ring wall to a shielded hutch. */
function wilsonLab(group: THREE.Group, walls: Box[]): BeamlineModel {
  const { x0, x1, z0, z1 } = WILSON;
  const g = heightAt((x0 + x1) / 2, (z0 + z1) / 2);
  const T = 0.4;
  const outer = [
    box(x0, x1, z0 - T / 2, z0 + T / 2), box(x0, x1, z1 - T / 2, z1 + T / 2), box(x1 - T / 2, x1 + T / 2, z0, z1),
    box(x0 - T / 2, x0 + T / 2, z0, WL_DOOR.z0), box(x0 - T / 2, x0 + T / 2, WL_DOOR.z1, z1),
  ];
  const brick = facadeTexture('#8a5a46', '#2a3440');
  for (const b of outer) {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const wall = facadeBox(w, WL_H, d, 2, brick, mat('#5a5048'));
    wall.position.set((b.x0 + b.x1) / 2, g + WL_H / 2, (b.z0 + b.z1) / 2);
    group.add(wall);
  }
  walls.push(...outer);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.6, 0.4, z1 - z0 + 0.6), new THREE.MeshStandardMaterial({ color: '#4a4e55', emissive: '#262a30' }));
  roof.position.set((x0 + x1) / 2, g + WL_H + 0.2, (z0 + z1) / 2);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 0.4, 0.06, z1 - z0 - 0.4), mat('#9a9c98', 0.8));
  floor.position.set((x0 + x1) / 2, g + 0.03, (z0 + z1) / 2);
  floor.receiveShadow = true;
  group.add(roof, floor);
  for (const [lx, lz] of [[56, -8], [56, 2], [64, -8], [64, 2]] as const) {
    const lamp = new THREE.PointLight('#fff4e6', 16, 22, 1.6);
    lamp.position.set(lx, g + WL_H - 0.6, lz);
    group.add(lamp);
  }
  group.add(sign('Synchrotron Laboratory', 8, x0 - 0.25, g + WL_H - 1.2, (z0 + z1) / 2, -Math.PI / 2));

  // the ring's shielding wall, gently curved: CESR's 122 m radius bends it by under half a metre across the hall
  const concrete = mat('#b4b2aa', 0.95);
  for (let z = z0; z < z1; z += 2) {
    const zc = z + 1;
    const bow = 122 - Math.sqrt(122 * 122 - (zc + 4) ** 2);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(1.2, WL_H, 2.02), concrete);
    seg.position.set(RING_WALL_X + 0.6 + bow, g + WL_H / 2, zc);
    group.add(seg);
  }
  walls.push(INDOOR_SOLIDS[0]!);
  const ring = ringSign();
  ring.mesh.position.set(RING_WALL_X - 0.02, g + 3.6, 1.5);
  ring.mesh.rotation.y = -Math.PI / 2;
  group.add(ring.mesh);

  // the hutch: lead-lined walls with a warning sign and a door
  const hutchMat = mat('#7a8088', 0.6, 0.2);
  const hutch = new THREE.Mesh(new THREE.BoxGeometry(HUTCH.x1 - HUTCH.x0, 3, HUTCH.z1 - HUTCH.z0), hutchMat);
  hutch.position.set((HUTCH.x0 + HUTCH.x1) / 2, g + 1.5, (HUTCH.z0 + HUTCH.z1) / 2);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(HUTCH.x1 - HUTCH.x0 + 0.02, 0.25, HUTCH.z1 - HUTCH.z0 + 0.02), mat('#e0b400', 0.6));
  stripe.position.set(hutch.position.x, g + 2.7, hutch.position.z);
  group.add(hutch, stripe, sign('X-ray hutch · beam on when locked', 4, hutch.position.x, g + 2.2, HUTCH.z1 + 0.02, 0));
  walls.push(HUTCH);

  // the control desk outside the hutch
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 0.8), mat('#e9ecef', 0.5));
  desk.position.set(BEAM_SPOT.x, g + 0.4, BEAM_SPOT.z + 0.3);
  const glow = new THREE.MeshStandardMaterial({ color: '#0d1b2a', emissive: '#2f6fae', emissiveIntensity: 0.8 });
  for (const dx of [-0.5, 0.5]) {
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), glow);
    monitor.position.set(BEAM_SPOT.x + dx, g + 1.1, BEAM_SPOT.z + 0.55);
    group.add(monitor);
  }
  group.add(desk);
  walls.push(box(BEAM_SPOT.x - 1, BEAM_SPOT.x + 1, BEAM_SPOT.z - 0.1, BEAM_SPOT.z + 0.7));

  // the beamline from the ring wall to the hutch: pipe, front end, monochromator and focusing lens appear as they are built
  const parts: Record<string, THREE.Object3D[]> = {};
  const steel = mat('#c9cfd6', 0.35, 0.6);
  const part = (id: string, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, g + y, BEAM_Z);
    o.castShadow = true;
    group.add(o);
    (parts[id] ??= []).push(o);
  };
  part('front_end', new THREE.BoxGeometry(1.4, 1.2, 1), mat('#6a9ab8', 0.5, 0.3), RING_WALL_X - 0.8, 1.2);
  part('monochromator', new THREE.BoxGeometry(1.2, 1.1, 1.1), mat('#7a8aa8', 0.4, 0.4), 64.6, 1.2);
  part('crl', new THREE.CylinderGeometry(0.18, 0.18, 0.6, 16).rotateZ(Math.PI / 2), mat('#b8e0d4', 0.3, 0.4), 62, 1.2);
  for (const [xa, xb] of [[60, 61.7], [62.3, 64], [65.2, RING_WALL_X - 1.5]] as const) {
    part('chess_beamline', new THREE.CylinderGeometry(0.06, 0.06, xb - xa, 10).rotateZ(Math.PI / 2), steel, (xa + xb) / 2, 1.2);
  }
  for (const x of [61, 62, 64.6, 66.6]) part('chess_beamline', new THREE.CylinderGeometry(0.05, 0.08, 0.7, 8), steel, x, 0.35);
  return {
    show(has) {
      const all = has('chess_beamline');
      for (const [id, objs] of Object.entries(parts)) objs.forEach((o) => (o.visible = all || has(id)));
      for (const [id, lamp] of Object.entries(ring.lamps)) {
        const on = all || has(id);
        (lamp.material as THREE.MeshStandardMaterial).emissive.set(on ? '#3aff6a' : '#000000');
      }
    },
  };
}

/** The athletic fields: a gridiron with goalposts and stands, and a practice field with goals. */
function fields(group: THREE.Group, walls: Box[]) {
  const turf = (b: Box, gridiron: boolean) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(b.x1 - b.x0, b.z1 - b.z0).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: fieldTexture(gridiron), roughness: 0.95 }),
    );
    mesh.position.set((b.x0 + b.x1) / 2, heightAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) + 0.03, (b.z0 + b.z1) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  turf(GRIDIRON, true);
  turf(PRACTICE, false);
  const g = heightAt(100, -17);
  const yellow = mat('#f2c230', 0.5, 0.3);
  const white = mat('#f4f4f0', 0.5);
  const bar = (m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
  };
  // goalposts on the end lines: one post, a crossbar 3 m up and two uprights
  const mid = (GRIDIRON.z0 + GRIDIRON.z1) / 2;
  for (const x of [GRIDIRON.x0 + 0.3, GRIDIRON.x1 - 0.3]) {
    bar(yellow, 0.16, 3, 0.16, x, g + 1.5, mid);
    bar(yellow, 0.12, 0.12, 5.6, x, g + 3, mid);
    for (const dz of [-2.8, 2.8]) bar(yellow, 0.1, 6, 0.1, x, g + 6, mid + dz);
  }
  walls.push(...[GRIDIRON.x0 + 0.3, GRIDIRON.x1 - 0.3].map((x) => box(x - 0.15, x + 0.15, mid - 0.15, mid + 0.15)));
  // goals on the practice field: a white frame with a net behind
  const pmid = (PRACTICE.z0 + PRACTICE.z1) / 2;
  const netTex = meshTexture();
  netTex.repeat.set(5 / 0.2, 2 / 0.2);
  const net = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  for (const [x, back] of [[PRACTICE.x0 + 0.3, -1], [PRACTICE.x1 - 0.3, 1]] as const) {
    for (const dz of [-2.5, 2.5]) bar(white, 0.12, 2, 0.12, x, g + 1, pmid + dz);
    bar(white, 0.12, 0.12, 5.1, x, g + 2, pmid);
    const n = new THREE.Mesh(new THREE.PlaneGeometry(5, 2), net);
    n.rotation.y = Math.PI / 2;
    n.position.set(x + back * 1, g + 1, pmid);
    group.add(n);
    walls.push(box(Math.min(x, x + back * 1.1), Math.max(x, x + back * 1.1), pmid - 2.6, pmid + 2.6));
  }
  // the stands along the north side: concrete steps under rows of aluminium benches
  const concrete = mat('#a9a69e', 0.95);
  const alu = mat('#c8ccd0', 0.4, 0.6);
  const steps = 5;
  const depth = (STANDS.z1 - STANDS.z0) / steps;
  for (let i = 0; i < steps; i++) {
    const z = STANDS.z1 - (i + 0.5) * depth;
    bar(concrete, STANDS.x1 - STANDS.x0, 0.5 * (i + 1), depth, (STANDS.x0 + STANDS.x1) / 2, g + 0.25 * (i + 1), z);
    bar(alu, STANDS.x1 - STANDS.x0 - 0.4, 0.06, 0.35, (STANDS.x0 + STANDS.x1) / 2, g + 0.5 * (i + 1) + 0.42, z);
  }
  walls.push(STANDS);
}

/** An iron railing along both rims of the gorge, wherever the drop to the creek is more than 3 m, with gaps at the tops
 *  of the trails and at the bridge; a stone dam across the lip of the falls keeps waders in the lake. */
function gorgeRailing(group: THREE.Group, walls: Box[]) {
  const post = new THREE.CylinderGeometry(0.045, 0.045, 1.1, 6).translate(0, 0.55, 0);
  const rail = new THREE.BoxGeometry(0.05, 0.05, 2.02);
  const posts: THREE.Matrix4[] = [];
  const rails: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  for (const side of [-1, 1]) {
    for (let xa = FALLS_X; xa > CAYUGA_X; xa -= 2) {
      const xb = xa - 2;
      const mid = xa - 1;
      const [za, zb] = [gorgeZ(xa) + side * 10.8, gorgeZ(xb) + side * 10.8];
      const zm = (za + zb) / 2;
      if (heightAt(mid, zm) - creekY(mid) < 3) continue;
      if (xb < BRIDGE.x + 1 && xa > BRIDGE.x - 1) continue;
      if (TRAILS.some((t) => t.side === side && Math.abs(mid - (t.top + Math.sign(t.bottom - t.top))) < 2.2)) continue;
      const [ya, yb] = [heightAt(xa, za), heightAt(xb, zb)];
      posts.push(new THREE.Matrix4().makeTranslation(xa, ya, za));
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(xb - xa, yb - ya, zb - za).normalize());
      for (const y of [0.55, 1.05]) rails.push(new THREE.Matrix4().compose(new THREE.Vector3(mid, (ya + yb) / 2 + y, zm), q, new THREE.Vector3(1, 1, 1)));
      walls.push(box(xb, xa, Math.min(za, zb) - 0.08, Math.max(za, zb) + 0.08));
    }
  }
  const iron = mat('#26292b', 0.6, 0.5);
  for (const [geo, list] of [[post, posts], [rail, rails]] as const) {
    const mesh = new THREE.InstancedMesh(geo, iron, list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    group.add(mesh);
  }
  const z0 = gorgeZ(FALLS_X) - 10.8;
  const z1 = gorgeZ(FALLS_X) + 10.8;
  const dam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, z1 - z0), mat('#8d877c', 0.95));
  dam.position.set(FALLS_X + 0.3, WATER_LEVEL + 0.04 - 1.5, (z0 + z1) / 2);
  group.add(dam);
  walls.push(box(FALLS_X - 0.1, FALLS_X + 0.7, z0, z1));
}

/** The art museum: a gallery with a door to the east, then two concrete towers and a top floor over an open court. */
function museum(group: THREE.Group, walls: Box[]) {
  const { x0, x1, z0, z1 } = MUSEUM;
  const g = heightAt((x0 + x1) / 2, (z0 + z1) / 2);
  const concrete = mat('#cdc8bd', 0.95);
  const slab = (b: Box, y0: number, y1: number, m: THREE.Material | THREE.Material[] = concrete) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, y1 - y0, b.z1 - b.z0), m);
    mesh.position.set((b.x0 + b.x1) / 2, g + (y0 + y1) / 2, (b.z0 + b.z1) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  };
  const T = WALL_T;
  const gallery = [
    box(x0, x1, z0, z0 + T), box(x0, x1, z1 - T, z1), box(x0, x0 + T, z0 + T, z1 - T),
    box(x1 - T, x1, z0 + T, MU_DOOR.z0), box(x1 - T, x1, MU_DOOR.z1, z1 - T),
  ];
  for (const b of gallery) slab(b, -0.5, MU_H);
  walls.push(...gallery);
  slab(box(x1 - T, x1, MU_DOOR.z0, MU_DOOR.z1), 2.8, MU_H); // over the door
  slab(box(x0, x1, z0, z1), MU_H, MU_H + 0.5, [concrete, concrete, concrete, CEILING, concrete, concrete]);
  slab(box(x0 + T, x1 - T, z0 + T, z1 - T), 0, 0.06, mat('#8a8278', 0.5)); // polished floor
  // the towers north and south, the top floor across them reaching west over the slope, and the open court between
  slab(box(x0, x1, z0, z0 + 3.4), MU_H + 0.5, 13);
  slab(box(x0, x1, z1 - 3.4, z1), MU_H + 0.5, 13);
  slab(box(x0 - 4, x1, z0, z1), 13, 16.6);
  slab(box(x0 - 4, x1, z0, z1), 16.6, 16.8, SLATE);
  for (const b of [box(x0 - 4.02, x0 - 4, z0 + 1, z1 - 1), box(x1, x1 + 0.02, z0 + 1, z1 - 1)]) slab(b, 14.3, 15.3, mat('#33404d', 0.3)); // the top floor's long windows
  // a sculpture in the court: a bronze ring on a plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), concrete);
  plinth.position.set((x0 + x1) / 2, g + MU_H + 0.9, (z0 + z1) / 2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.18, 12, 32), mat('#7a5a32', 0.4, 0.7));
  ring.position.set(plinth.position.x, g + MU_H + 2.2, plinth.position.z);
  ring.rotation.y = 0.6;
  group.add(plinth, ring);
  group.add(sign('Museum of Art', 6, x1 + 0.03, g + 3.5, (z0 + z1) / 2 + 2.6, Math.PI / 2));
}

/** The suspension footbridge: steel portal towers on each rim, two main cables sagging between them with hangers down to
 *  the deck, and a mesh screen along both sides; the cables run on past the towers down to concrete anchor blocks. */
function bridge(group: THREE.Group, walls: Box[]) {
  const { x, z0, z1, half, y } = BRIDGE;
  const steel = mat('#3f4a46', 0.5, 0.6);
  const cableMat = mat('#2a2e30', 0.4, 0.7);
  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  // the deck: steel stringers under a plank walkway
  const len = z1 - z0;
  add(new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.08, len), mat('#8a7458', 0.85))).position.set(x, y - 0.04, (z0 + z1) / 2);
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, len), steel)).position.set(x + s * (half - 0.06), y - 0.25, (z0 + z1) / 2);
  const towerH = 5.5;
  const [ta, tb] = BRIDGE_TOWERS;
  for (const tz of BRIDGE_TOWERS) {
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.22, towerH + 1, 0.22), steel)).position.set(x + s * (half + 0.15), y + towerH / 2 - 0.5, tz);
    add(new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.6, 0.25, 0.25), steel)).position.set(x, y + towerH, tz);
  }
  // main cables: a parabola from tower top to tower top, lowest (1.1 m above the deck) at mid-span; then down to the anchors
  const top = y + towerH - 0.1;
  const low = y + 1.1;
  const cableY = (z: number) => low + (top - low) * ((z - (ta + tb) / 2) / ((tb - ta) / 2)) ** 2;
  const anchors = [z0 - 3, z1 + 3];
  for (const s of [-1, 1]) {
    const cx = x + s * (half + 0.15);
    const pts: THREE.Vector3[] = [new THREE.Vector3(cx, heightAt(cx, anchors[0]!) + 0.6, anchors[0]!)];
    for (let i = 0; i <= 24; i++) {
      const z = ta + ((tb - ta) * i) / 24;
      pts.push(new THREE.Vector3(cx, cableY(z), z));
    }
    pts.push(new THREE.Vector3(cx, heightAt(cx, anchors[1]!) + 0.6, anchors[1]!));
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 80, 0.05, 6), cableMat));
    // hangers every 1.25 m
    for (let z = ta + 1.25; z < tb - 0.6; z += 1.25) {
      const h = cableY(z) - y;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, h, 4), cableMat)).position.set(cx, y + h / 2, z);
    }
  }
  // an anchor block under each cable end, either side of the walkway
  const concrete = mat('#a9a69e', 0.95);
  for (const az of anchors) {
    for (const s of [-1, 1]) {
      const ax = x + s * (half + 0.15);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 1.4), concrete)).position.set(ax, heightAt(ax, az) + 0.3, az);
      walls.push(box(ax - 0.35, ax + 0.35, az - 0.7, az + 0.7));
    }
  }
  for (const tz of BRIDGE_TOWERS) for (const s of [-1, 1]) walls.push(box(x + s * (half + 0.15) - 0.11, x + s * (half + 0.15) + 0.11, tz - 0.11, tz + 0.11));
  // the side screens: wire mesh to shoulder height on a top rail
  const t = meshTexture();
  t.repeat.set(len / 0.35, 1.5 / 0.35);
  const screen = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.5), screen);
    m.rotation.y = Math.PI / 2;
    m.position.set(x + s * half, y + 0.75, (z0 + z1) / 2);
    group.add(m);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), steel)).position.set(x + s * half, y + 1.5, (z0 + z1) / 2);
  }
}

export interface Campus {
  group: THREE.Group;
  /** Solid footprints the player cannot walk through. */
  walls: Box[];
  /** The electron microscope in the lab, which shows each component as it is built. */
  em: EmModel;
  /** The CHESS beamline in Wilson Lab, likewise. */
  beamline: BeamlineModel;
  /** Per frame: falling water and the tower clock. */
  update(t: number): void;
}

export function buildCampus(): Campus {
  const group = new THREE.Group();
  const walls: Box[] = [];
  HALLS.forEach((h) => hall(h, group, walls));
  group.add(buildScopeStore()); walls.push(...STORE_WALLS, ...STORE_FURNITURE, box(-9.35,-7.65,30.9,34.7));
  // solid outside: the tower, the statues and the portico's columns (the halls and the lab build their own walls)
  walls.push(...FOOTPRINTS.filter((b) => b !== STORE_FOOTPRINT && b !== SCIENCE && b !== MUSEUM && b !== PORTICO && !HALLS.some((h) => h.box === b)));
  walls.push(...PORTICO_COLUMNS.map((c) => box(c.x - 0.35, c.x + 0.35, c.z - 0.35, c.z + 0.35)));

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
  for (const c of PORTICO_COLUMNS) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, colH, 14), stone);
    col.position.set(c.x, gy + colH / 2, c.z);
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
  greenhouse(group, walls);
  const beamline = wilsonLab(group, walls);
  atrium(group, walls);
  fields(group, walls);
  bridge(group, walls);
  gorgeRailing(group, walls);
  museum(group, walls);
  const hallSign = (i: number, text: string, side: 'south' | 'east') => {
    const b = HALLS[i]!.box;
    const y = heightAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) + FLOOR_H + 0.6;
    group.add(side === 'south' ? sign(text, 6, (b.x0 + b.x1) / 2, y, b.z1 + 0.05, 0) : sign(text, 6, b.x1 + 0.05, y, (b.z0 + b.z1) / 2, Math.PI / 2));
  };
  hallSign(7, 'Materials Science', 'south');
  hallSign(8, 'Geology · Rock Garden', 'east');
  const chem = HALLS[11]!.box;
  group.add(sign('Chemistry', 6, chem.x0 - 0.05, heightAt(chem.x0, 23) + FLOOR_H + 0.6, (chem.z0 + chem.z1) / 2, -Math.PI / 2));

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
    beamline,
    update(t) {
      fallTex.offset.y = t * 0.0011;
      foam.scale.setScalar(1 + 0.05 * Math.sin(t * 0.004));
      const now = new Date();
      const minutes = now.getMinutes() + now.getSeconds() / 60;
      hands.forEach((hand, i) => (hand.rotation.z = -((i % 2 ? minutes / 60 : ((now.getHours() % 12) + minutes / 60) / 12) * Math.PI * 2)));
    },
  };
}
