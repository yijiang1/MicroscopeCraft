import * as THREE from 'three';
import { heightAt } from './terrain';

/** South-facing entrance on the path between the two quads. */
export const STORE_FOOTPRINT = { x0: -18, x1: -6, z0: 26, z1: 38 };
export const STORE_COUNTER = { x: -12, z: 33 };
export const STORE_WALLS = [
  { x0: -18, x1: -17.7, z0: 26, z1: 38 },
  { x0: -6.3, x1: -6, z0: 26, z1: 38 },
  { x0: -18, x1: -6, z0: 26, z1: 26.3 },
  { x0: -18, x1: -14, z0: 37.7, z1: 38 },
  { x0: -10, x1: -6, z0: 37.7, z1: 38 },
];

/** A walk-in shop in the broad base of an eighteen-metre optical microscope. */
export function buildScopeStore() {
  const group = new THREE.Group(); group.position.set(-12, heightAt(-12, 32), 32);
  const cream = new THREE.MeshStandardMaterial({ color: '#e8e3cd', roughness: 0.55, metalness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: '#263c43', roughness: 0.38, metalness: 0.4 });
  const red = new THREE.MeshStandardMaterial({ color: '#aa3444', roughness: 0.65 });
  const brass = new THREE.MeshStandardMaterial({ color: '#bea269', roughness: 0.32, metalness: 0.65 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#9bd2ce', transparent: true, opacity: 0.24, roughness: 0.12, depthWrite: false, side: THREE.DoubleSide });
  const glow = new THREE.MeshStandardMaterial({ color: '#e0fff4', emissive: '#7ec2a9', emissiveIntensity: 0.6 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group) => {
    const m = new THREE.Mesh(geometry, material);m.position.set(x,y,z);m.castShadow = material !== glass;m.receiveShadow = true;parent.add(m);return m;
  };
  const box = (w: number,h: number,d: number,x: number,y: number,z: number,material: THREE.Material) => mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z);
  const cylinder = (r: number,h: number,x: number,y: number,z: number,material: THREE.Material) => mesh(new THREE.CylinderGeometry(r,r,h,32),material,x,y,z);
  // The microscope foot is an actual shop room, with a four-metre-wide open doorway.
  box(12.6,0.15,12.6,0,-0.075,0,cream);
  box(12.6,0.65,12.6,0,3.55,0,cream);
  box(12.7,0.16,12.7,0,3.2,0,red);
  for (const wall of STORE_WALLS) {
    const w = wall.x1-wall.x0, d = wall.z1-wall.z0;
    box(w,2.9,d,(wall.x0+wall.x1)/2+12,1.6,(wall.z0+wall.z1)/2-32,glass);
    box(w,0.4,d,(wall.x0+wall.x1)/2+12,0.2,(wall.z0+wall.z1)/2-32,cream);
  }
  for (const x of [-5.85,5.85]) for (const z of [-5.85,0,5.85]) box(.24,3.2,.24,x,1.6,z,dark);
  for (const x of [-2,2]) box(.24,3.2,.3,x,1.6,5.85,brass);
  // Curved support arm: a thick C behind the stage, with a rounded upper shoulder.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,3.8,-3.9),new THREE.Vector3(0,7,-4.5),
    new THREE.Vector3(0,11,-4.1),new THREE.Vector3(0,14,-2.5),new THREE.Vector3(0,14.5,.2),
  ]);
  mesh(new THREE.TubeGeometry(curve,32,1.15,12,false),cream,0,0,0);
  box(8.8,.55,7.2,0,7.1,.1,dark);
  // Glass slide and stage clips, sized as architectural details.
  box(4.6,.12,2.2,0,7.45,.8,glass);
  for (const x of [-2.7,2.7]) box(.22,.16,2.8,x,7.5,.1,brass);
  cylinder(1.25,.75,0,6.35,.6,dark);
  cylinder(.8,.08,0,6.78,.6,glow);
  cylinder(.95,.25,0,4.02,.6,glow);
  // Focusing wheels on both sides of the arm.
  for (const side of [-1,1]) {
    const wheel = cylinder(1.35,.65,side*1.45,9.1,-3.6,dark);wheel.rotation.z=Math.PI/2;
    const fine = cylinder(.6,.35,side*1.95,9.1,-3.6,brass);fine.rotation.z=Math.PI/2;
    for (let i=0;i<12;i++) {
      const angle=i*Math.PI/6;
      box(.15,.2,.2,side*1.85,9.1+Math.cos(angle)*1.1,-3.6+Math.sin(angle)*1.1,cream);
    }
  }
  // Optical body tube, an angled eyepiece, and a three-objective revolving nosepiece.
  cylinder(1.05,3.6,0,13,.3,cream);
  cylinder(1.17,.25,0,14.7,.3,brass);
  const eyepiece = new THREE.Group();eyepiece.position.set(0,14.7,.3);eyepiece.rotation.x=.35;group.add(eyepiece);
  mesh(new THREE.CylinderGeometry(.6,.85,2.5,24),dark,0,1.2,0,eyepiece);
  mesh(new THREE.CylinderGeometry(.8,.8,.3,24),brass,0,2.5,0,eyepiece);
  mesh(new THREE.CylinderGeometry(.64,.64,.05,24),glass,0,2.68,0,eyepiece);
  cylinder(1.65,.5,0,10.9,.3,dark);
  for (const [x,z,h] of [[0,1.25,2.6],[-1,-.3,1.8],[1,-.3,1.4]]) {
    cylinder(.38,h!,x!,10.65-h!/2,z!,brass);
    cylinder(.42,.2,x!,10.65-h!,z!,dark);
    cylinder(.3,.04,x!,10.53-h!,z!,glass);
  }
  // A lit display shelf visible through the glazing.
  for (const y of [.7,1.5,2.3]) box(3.5,.12,.65,-3.6,y,-4.7,cream);
  for (let i=0;i<8;i++) box(.26,.55,.45,-5+i*.38,1.83,-4.7,i%2?red:dark);
  const c=document.createElement('canvas');c.width=1024;c.height=192;
  const g=c.getContext('2d')!;g.fillStyle='#aa3444';g.fillRect(0,0,1024,192);g.fillStyle='#fff8e6';g.textAlign='center';g.font='700 68px system-ui';g.fillText('ScopeCraft Store',512,85);g.font='27px system-ui';g.fillText('BOOKS  ·  FIELD GEAR  ·  SCIENCE SOUVENIRS',512,143);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(7.6,1.42),new THREE.MeshBasicMaterial({map:texture}),0,4.65,6.35);
  const light=new THREE.PointLight('#ffebc9',18,13,1.6);light.position.set(0,2.8,1);group.add(light);
  return group;
}
