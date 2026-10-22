import * as THREE from 'three';
import { heightAt } from './terrain';

export const LIFT = { x: -33.5, z: -1, rise: 30, half: 1.15, speed: 3 };
export const LANDING_PANELS = [
  { x: -33.5, z: -2.825, w: 3, d: 1.35 },
  { x: -33.5, z: 0.825, w: 3, d: 1.35 },
  { x: -34.825, z: -1, w: 0.35, d: 2.3 },
  { x: -32.175, z: -1, w: 0.35, d: 2.3 },
] as const;
export const liftBase = heightAt(-38, -1) + 0.12;
export const TERRACE = { x0: -42.5, x1: -32, z0: -5.5, z1: 3.5 };
export function advanceLift(height: number, target: number, dt: number) {
  return height + Math.sign(target - height) * Math.min(Math.abs(target - height), LIFT.speed * Math.max(0, dt));
}
export function nearLift(x: number, z: number) { return Math.hypot(x - LIFT.x, z - LIFT.z) < 1.8; }
export function constrainTerrace(p: { x: number; z: number }) {
  p.x = Math.max(TERRACE.x0 + 0.4, Math.min(TERRACE.x1 - 0.4, p.x));
  p.z = Math.max(TERRACE.z0 + 0.4, Math.min(TERRACE.z1 - 0.4, p.z));
}
export function buildTowerLift() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#354b50', metalness: 0.65, roughness: 0.35 });
  const stone = new THREE.MeshStandardMaterial({ color: '#d1c7ad', roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: '#a5e2e4', transparent: true, opacity: 0.18, depthWrite: false });
  const box = (parent: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x,y,z); m.castShadow = true; parent.add(m);
  };
  // Separate panels leave the solid tower shaft unobstructed and avoid coplanar surfaces.
  const top = liftBase + LIFT.rise;
  box(group,-37.25,top-0.15,-4.5,10.5,0.3,2,stone);
  box(group,-37.25,top-0.15,2.5,10.5,0.3,2,stone);
  box(group,-41.5,top-0.15,-1,2,0.3,5,stone);
  // The upper landing surrounds an open shaft: the cabin floor fills this opening.
  // Never put a terrace face underneath the cabin's coplanar floor (z-fighting).
  for (const panel of LANDING_PANELS) box(group,panel.x,top-0.15,panel.z,panel.w,0.3,panel.d,stone);
  for (const z of [TERRACE.z0,TERRACE.z1]) {
    box(group,-37.25,top+1.15,z,10.5,0.08,0.08,metal);
    for(let x=TERRACE.x0;x<=TERRACE.x1;x+=0.75) box(group,x,top+0.55,z,0.045,1.1,0.045,metal);
  }
  for(const x of [TERRACE.x0,TERRACE.x1]) {
    box(group,x,top+1.15,-1,0.08,0.08,9,metal);
    for(let z=TERRACE.z0;z<=TERRACE.z1;z+=0.75) box(group,x,top+0.55,z,0.045,1.1,0.045,metal);
  }
  for(const z of [-2.15,0.15]) box(group,LIFT.x-1.1,liftBase+16,z,0.12,32,0.12,metal);
  const cabin = new THREE.Group(); cabin.position.set(LIFT.x,liftBase,LIFT.z); group.add(cabin);
  box(cabin,0,-0.1,0,2.3,0.2,2.3,metal); box(cabin,0,2.6,0,2.3,0.12,2.3,metal);
  for(const z of [-1.1,1.1]) box(cabin,0,1.3,z,2.3,2.5,0.04,glass);
  box(cabin,-1.1,1.3,0,0.04,2.5,2.3,glass);
  const canvas = document.createElement('canvas'); canvas.width=512; canvas.height=128;
  const c = canvas.getContext('2d')!; c.fillStyle='#203b40'; c.fillRect(0,0,512,128); c.fillStyle='#fff5d8'; c.textAlign='center'; c.font='bold 36px sans-serif'; c.fillText('CAMPUS LOOKOUT',256,52); c.font='26px sans-serif'; c.fillText('E · Ride elevator',256,98);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8,0.7),new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(canvas), side:THREE.DoubleSide }));
  sign.position.set(LIFT.x+1.18,liftBase+3,LIFT.z); sign.rotation.y=Math.PI/2; group.add(sign);
  return { group, cabin };
}
