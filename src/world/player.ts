import * as THREE from 'three';

/** A block-style explorer, with feet at the origin and his face toward -Z. */
export function buildPlayer() {
  const root = new THREE.Group();
  const materials = {
    shirt: new THREE.MeshStandardMaterial({ color: '#8ec9ee', roughness: 0.9 }),
    pants: new THREE.MeshStandardMaterial({ color: '#c3ac78', roughness: 1 }),
    skin: new THREE.MeshStandardMaterial({ color: '#f3d6c2', roughness: 1 }),
    hair: new THREE.MeshStandardMaterial({ color: '#a9adb3', roughness: 1 }),
    boots: new THREE.MeshStandardMaterial({ color: '#49382c', roughness: 1 }),
    eyes: new THREE.MeshStandardMaterial({ color: '#24272b' }),
  };
  const box = (parent: THREE.Group, size: number[], pos: number[], material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.position.set(pos[0]!, pos[1]!, pos[2]!);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  };
  box(root, [0.55, 0.62, 0.3], [0, 1.15, 0], materials.shirt);
  box(root, [0.48, 0.12, 0.3], [0, 0.82, 0], materials.boots);
  box(root, [0.18, 0.12, 0.18], [0, 1.49, 0], materials.skin);
  box(root, [0.38, 0.4, 0.36], [0, 1.72, 0], materials.skin);
  box(root, [0.4, 0.12, 0.38], [0, 1.91, 0.01], materials.hair);
  box(root, [0.4, 0.22, 0.08], [0, 1.77, 0.16], materials.hair);
  for (const side of [-1, 1]) {
    box(root, [0.045, 0.045, 0.02], [side * 0.09, 1.76, -0.185], materials.eyes);
  }
  box(root, [0.08, 0.08, 0.07], [0, 1.67, -0.2], materials.skin);
  const arms: THREE.Group[] = [];
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.38, 1.4, 0);
    box(arm, [0.2, 0.27, 0.28], [0, -0.11, 0], materials.shirt);
    box(arm, [0.17, 0.37, 0.22], [0, -0.42, 0], materials.skin);
    root.add(arm);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.14, 0.8, 0);
    box(leg, [0.23, 0.65, 0.28], [0, -0.31, 0], materials.pants);
    box(leg, [0.25, 0.16, 0.39], [0, -0.72, -0.05], materials.boots);
    root.add(leg);
    legs.push(leg);
  }
  let phase = 0;
  return {
    root,
    update(distance: number, dt: number) {
      phase += distance * 2.5;
      const swing = distance > 0.001 ? Math.sin(phase) * 0.55 : 0;
      const blend = 1 - Math.exp(-dt * 18);
      arms.forEach((arm, i) => { arm.rotation.x += ((i === 0 ? swing : -swing) - arm.rotation.x) * blend; });
      legs.forEach((leg, i) => { leg.rotation.x += ((i === 0 ? -swing : swing) - leg.rotation.x) * blend; });
    },
    dispose() {
      root.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
      Object.values(materials).forEach((material) => material.dispose());
    },
  };
}
