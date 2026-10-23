import { buildEyewear } from './eyewear';
import type { Economy } from '../shared/economy';
import * as THREE from 'three';

/** A block-style explorer (Lena or the original explorer), with feet at the origin and the face toward -Z. */
export function buildPlayer() {
  const root = new THREE.Group();
  const materials = {
    shirt: new THREE.MeshStandardMaterial({ color: '#8ec9ee', roughness: 0.9 }),
    pants: new THREE.MeshStandardMaterial({ color: '#c3ac78', roughness: 1 }),
    skin: new THREE.MeshStandardMaterial({ color: '#f3d6c2', roughness: 1 }),
    hair: new THREE.MeshStandardMaterial({ color: '#a9adb3', roughness: 1 }),
    hairTips: new THREE.MeshStandardMaterial({ color: '#c09a62', roughness: 1 }),
    leather: new THREE.MeshStandardMaterial({ color: '#a76e3d', roughness: .95 }),
    laces: new THREE.MeshStandardMaterial({ color: '#e7d2a3', roughness: 1 }),
    boots: new THREE.MeshStandardMaterial({ color: '#49382c', roughness: 1 }),
    eyes: new THREE.MeshStandardMaterial({ color: '#24272b' }),
  };
  const box = (parent: THREE.Group, size: number[], pos: number[], material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.position.set(pos[0]!, pos[1]!, pos[2]!);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  box(root, [0.55, 0.62, 0.3], [0, 1.15, 0], materials.shirt);
  box(root, [0.5, 0.12, 0.32], [0, 0.82, 0], materials.boots); // belt: a touch proud of the shirt so their faces don't z-fight
  const neck = box(root, [0.18, 0.12, 0.18], [0, 1.49, 0], materials.skin);
  box(root, [0.38, 0.4, 0.36], [0, 1.72, 0], materials.skin);
  const shortHair = new THREE.Group(), longHair = new THREE.Group(); root.add(shortHair, longHair);
  box(shortHair, [0.4, 0.12, 0.38], [0, 1.91, 0.01], materials.hair);
  box(shortHair, [0.4, 0.22, 0.08], [0, 1.77, 0.16], materials.hair);
  // Lena: long straight light-brown hair parted in the middle, lighter at the ends, falling past the shoulders
  box(longHair, [0.41, 0.1, 0.39], [0, 1.92, 0.01], materials.hair);
  box(longHair, [0.42, 0.5, 0.08], [0, 1.7, 0.2], materials.hair);
  box(longHair, [0.4, 0.3, 0.08], [0, 1.3, 0.2], materials.hairTips);
  for (const side of [-1, 1]) {
    box(longHair, [0.06, 0.4, 0.3], [side * 0.215, 1.75, 0.03], materials.hair);
    box(longHair, [0.1, 0.22, 0.06], [side * 0.19, 1.47, -0.18], materials.hair);
    box(longHair, [0.09, 0.2, 0.06], [side * 0.19, 1.26, -0.18], materials.hairTips);
  }
  for (const side of [-1, 1]) {
    box(root, [0.045, 0.045, 0.02], [side * 0.09, 1.76, -0.185], materials.eyes);
  }
  box(root, [0.08, 0.08, 0.07], [0, 1.67, -0.2], materials.skin);
  const arms: THREE.Group[] = [];
  const legs: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  const shoes: THREE.Mesh[] = [], hikingPairs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.38, 1.4, 0);
    box(arm, [0.2, 0.27, 0.28], [0, -0.11, 0], materials.shirt);
    box(arm, [0.17, 0.37, 0.22], [0, -0.42, 0], materials.skin);
    root.add(arm);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.14, 0.8, 0);
    box(leg, [0.23, 0.34, 0.28], [0, -0.15, 0], materials.pants);
    const knee = new THREE.Group(); knee.position.y = -0.32; leg.add(knee); knees.push(knee);
    box(knee, [0.23, 0.32, 0.28], [0, -0.15, 0], materials.pants);
    shoes.push(box(knee, [0.25, 0.16, 0.39], [0, -0.4, -0.05], materials.boots));
    const hiking = new THREE.Group(); knee.add(hiking); hikingPairs.push(hiking); hiking.visible = false;
    box(hiking, [.26,.23,.39], [0,-.335,-.05], materials.leather);
    box(hiking, [.27,.06,.41], [0,-.45,-.05], materials.boots);
    for (const y of [-.26,-.31,-.36]) box(hiking, [.16,.018,.015], [0,y,-.253], materials.laces);
    root.add(leg);
    legs.push(leg);
  }
  const backpack = new THREE.Group(); root.add(backpack);
  const bagMaterial = new THREE.MeshStandardMaterial({ color: '#a92338', roughness: 0.9 });
  box(backpack, [0.48, 0.56, 0.23], [0, 1.15, 0.27], bagMaterial);
  for (const side of [-1, 1]) box(backpack, [0.06, 0.55, 0.05], [side * 0.19, 1.18, -0.18], materials.boots);
  const souvenir = new THREE.Group(); root.add(souvenir);
  box(souvenir, [0.22, 0.045, 0.18], [0.4, 0.8, 0], materials.boots);
  box(souvenir, [0.045, 0.25, 0.05], [0.45, 0.94, 0.03], materials.shirt);
  box(souvenir, [0.14, 0.045, 0.14], [0.39, 0.91, -0.03], materials.boots);
  box(souvenir, [0.06, 0.15, 0.06], [0.37, 1.08, -0.03], materials.boots);
  backpack.visible = souvenir.visible = false;
  const glasses = buildEyewear(), sunglasses = buildEyewear(true);
  for (const pair of [glasses, sunglasses]) { pair.root.position.y = 1.76; pair.root.visible = false; root.add(pair.root); }
  let phase = 0;
  return {
    root,
    fishing(t: number, reeling: boolean) {
      arms.forEach((arm,i) => { arm.rotation.x = 1.1 + (reeling ? Math.sin(t*.014+i)*.18 : 0); });
      legs.forEach(leg => { leg.rotation.x = 0; });
    },
    seated() {
      arms.forEach(arm => { arm.rotation.x = 1.05; });
      legs.forEach(leg => { leg.rotation.x = Math.PI / 2; });
      knees.forEach(knee => { knee.rotation.x = -Math.PI / 2; });
    },
    equip(economy: Economy) {
      const lena = economy.character === 'lena';
      const hiking = economy.hikingBoots && economy.owned.includes('hiking_boots');
      shoes.forEach(shoe => { shoe.visible = !hiking; });
      hikingPairs.forEach(pair => { pair.visible = hiking; });
      shortHair.visible = !lena; longHair.visible = lena;
      materials.hair.color.set(lena ? '#8a6640' : '#a9adb3');
      materials.pants.color.set(lena ? '#2c313b' : '#c3ac78'); // Lena: dark jeans
      neck.material = lena && economy.shirt !== 'lab' ? materials.shirt : materials.skin; // her black turtleneck
      materials.shirt.color.set(economy.shirt === 'red' ? '#b32235' : economy.shirt === 'lab' ? '#f0f2ed' : lena ? '#1f2126' : '#8ec9ee');
      glasses.root.visible = economy.eyewear === 'glasses'; sunglasses.root.visible = economy.eyewear === 'sunglasses';
      backpack.visible = economy.backpack; souvenir.visible = economy.model;
    },
    update(distance: number, dt: number) {
      phase += distance * 2.5;
      const swing = distance > 0.001 ? Math.sin(phase) * 0.55 : 0;
      const blend = 1 - Math.exp(-dt * 18);
      arms.forEach((arm, i) => { arm.rotation.x += ((i === 0 ? swing : -swing) - arm.rotation.x) * blend; });
      legs.forEach((leg, i) => { leg.rotation.x += ((i === 0 ? -swing : swing) - leg.rotation.x) * blend; });
    },
    dispose() {
      root.remove(glasses.root, sunglasses.root); glasses.dispose(); sunglasses.dispose();
      root.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
      bagMaterial.dispose();
      Object.values(materials).forEach((material) => material.dispose());
    },
  };
}
