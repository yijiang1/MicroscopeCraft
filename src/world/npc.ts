// The visiting scientists: block figures in the player's style, dressed from their data (checked against photos
// where one exists), with a name tag and a marker that shows whether they are waiting for something you can show them.
import * as THREE from 'three';
import type { Npc } from '../shared/schema';
import { mergeByMaterial } from './models';

export interface NpcFigure {
  root: THREE.Group;
  /** '!' gold: you have something to show; '?' grey: they are still waiting; none: every request done. */
  setMarker(kind: 'ready' | 'waiting' | 'done'): void;
  update(t: number, moving?: boolean): void;
  setSpeaking(speaking: boolean): void;
}

function tag(text: string, sub: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000000aa';
  g.beginPath();
  g.roundRect(4, 8, 504, 112, 24);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.font = '600 44px system-ui, sans-serif';
  g.fillText(text, 256, 60, 480);
  g.fillStyle = '#c8d8e8';
  g.font = '30px system-ui, sans-serif';
  g.fillText(sub, 256, 102, 480);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

function marker(): { sprite: THREE.Sprite; set(kind: 'ready' | 'waiting' | 'done'): void } {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.setScalar(0.42);
  return {
    sprite,
    set(kind) {
      sprite.visible = kind !== 'done';
      g.clearRect(0, 0, 64, 64);
      g.fillStyle = kind === 'ready' ? '#ffd24a' : '#9aa4ae';
      g.beginPath();
      g.arc(32, 32, 28, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a1a1a';
      g.font = '700 44px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(kind === 'ready' ? '!' : '?', 32, 35);
      tex.needsUpdate = true;
    },
  };
}

/** A scientist with their feet at the origin, facing -Z (turned by npc.facing when placed). */
export function buildNpc(npc: Npc): NpcFigure {
  const { look } = npc;
  const root = new THREE.Group();
  const m = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const coat = m(look.coat);
  const skin = m(look.skin);
  const hair = m(look.hair);
  const pants = m(look.pants);
  const dark = m('#24272b');
  const box = (size: [number, number, number], pos: [number, number, number], material: THREE.Material, parent: THREE.Object3D = root) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  box([0.55, 0.66, 0.3], [0, 1.15, 0], coat); // long coat or jacket
  box([0.5, 0.2, 0.32], [0, 0.78, 0], coat);
  box([0.18, 0.12, 0.18], [0, 1.49, 0], skin);
  box([0.38, 0.4, 0.36], [0, 1.72, 0], skin);
  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.38, 1.45, 0);
    const leg = new THREE.Group(); leg.position.set(side * 0.14, 0.7, 0);
    root.add(arm, leg); limbs.push(arm, leg);
    box([0.045, 0.045, 0.02], [side * 0.09, 1.76, -0.185], dark);
    box([0.2, 0.62, 0.26], [0, -0.27, 0], coat, arm);
    box([0.16, 0.12, 0.2], [0, -0.63, 0], skin, arm);
    box([0.23, 0.7, 0.28], [0, -0.35, 0], pants, leg);
    box([0.25, 0.14, 0.38], [0, -0.63, -0.05], dark, leg);
  }
  box([0.08, 0.08, 0.07], [0, 1.67, -0.2], skin);
  switch (look.hairStyle) {
    case 'bald':
      box([0.4, 0.1, 0.3], [0, 1.82, 0.06], hair); // a fringe around the back
      break;
    case 'long':
      box([0.4, 0.12, 0.38], [0, 1.91, 0.01], hair);
      box([0.42, 0.5, 0.1], [0, 1.66, 0.17], hair);
      break;
    case 'wig': // full curled periwig falling to the shoulders
      box([0.44, 0.16, 0.42], [0, 1.92, 0.02], hair);
      for (const side of [-1, 1]) box([0.1, 0.5, 0.36], [side * 0.24, 1.6, 0.03], hair);
      box([0.46, 0.52, 0.1], [0, 1.62, 0.19], hair);
      break;
    case 'bun':
      box([0.4, 0.12, 0.38], [0, 1.91, 0.01], hair);
      box([0.4, 0.3, 0.08], [0, 1.8, 0.17], hair);
      box([0.18, 0.16, 0.14], [0, 1.88, 0.25], hair);
      break;
    case 'bob':
      box([0.42, 0.14, 0.4], [0, 1.92, 0.01], hair);
      for (const side of [-1, 1]) box([0.06, 0.32, 0.36], [side * 0.22, 1.74, 0.02], hair);
      box([0.42, 0.34, 0.08], [0, 1.76, 0.18], hair);
      break;
    default:
      box([0.4, 0.12, 0.38], [0, 1.91, 0.01], hair);
      box([0.4, 0.22, 0.08], [0, 1.77, 0.16], hair);
  }
  if (look.beard) box([0.36, 0.16, 0.06], [0, 1.58, -0.17], m(look.beard));
  if (look.glasses) {
    const rim = m('#1a1a1a');
    for (const side of [-1, 1]) box([0.11, 0.07, 0.01], [side * 0.09, 1.76, -0.19], rim);
    box([0.07, 0.015, 0.01], [0, 1.77, -0.19], rim);
  }
  // Keep limb meshes separate so walking remains articulated.
  const body = new THREE.Group();
  for (const child of [...root.children]) if (!limbs.includes(child as THREE.Group)) body.add(child);
  mergeByMaterial(body); root.add(body);
  const name = tag(npc.name, npc.years);
  name.position.set(0, 2.35, 0);
  const mk = marker();
  mk.sprite.position.set(0, 2.75, 0);
  root.add(name, mk.sprite);
  let markerKind: 'ready' | 'waiting' | 'done' = 'waiting';
  let speaking = false;
  const phase = Math.random() * 6;
  return {
    root,
    setMarker(kind) { markerKind = kind; mk.set(kind); mk.sprite.visible = !speaking && kind !== 'done'; },
    setSpeaking(value) { speaking = value; name.visible = !value; mk.sprite.visible = !value && markerKind !== 'done'; },
    update(t, moving = false) {
      limbs.forEach((limb, i) => { limb.rotation.x = moving ? Math.sin(t * 0.007 + phase) * 0.4 * ([1, -1, -1, 1][i]!) : 0; });
      mk.sprite.position.y = 2.75 + 0.06 * Math.sin(t * 0.003 + phase);
    },
  };
}
