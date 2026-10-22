import * as THREE from 'three';

export const TEST_DRIVE_MS = 30_000;
// Full-lock turning radius in metres: tight enough for campus paths.
const TURN_RADIUS = 6;
/** Low plants and loose surface samples do not stop a vehicle; trees and rocks still do. */
const SOFT_SURFACES = new Set(['sunflower', 'leaf', 'flower', 'bee', 'fern', 'mushroom', 'sand', 'mud', 'monazite', 'algae_mat', 'feather', 'pine_branch', 'web', 'bone', 'clover', 'windfall', 'tick_grass', 'cattail', 'dandelion']);
export const blocksRoadster = (kind: string) => !SOFT_SURFACES.has(kind);
/** Permit small curbs and grades up to roughly 33 degrees, but reject ledges and cliffs. */
export const roadsterGradeOK = (rise: number, run: number) => Math.abs(rise) <= 0.18 + Math.max(0, run) * 0.65;
export function driveStep(speed: number, throttle: number, steer: number, yaw: number, dt: number) {
  const nextSpeed = THREE.MathUtils.clamp(speed + (throttle * 9 - speed * (throttle ? 0.65 : 2.5)) * dt, -5, 15);
  const nextYaw = yaw + steer * nextSpeed / TURN_RADIUS * dt;
  return { speed: nextSpeed, yaw: nextYaw, dx: -Math.sin(nextYaw) * nextSpeed * dt, dz: -Math.cos(nextYaw) * nextSpeed * dt };
}
// Contact points match the four tyres in the model (front is local -Z).
export const ROADSTER_CONTACTS = [-.81,.81].flatMap(x => [-1.18,1.2].map(z => new THREE.Vector3(x,.01,z)));

/** Fit a road plane to all four wheel positions, retaining the steering heading. */
export function roadsterTerrainRotation(x:number,z:number,yaw:number,ground:(x:number,z:number)=>number) {
  const cos=Math.cos(yaw),sin=Math.sin(yaw);
  const heights=ROADSTER_CONTACTS.map(p=>ground(x+p.x*cos+p.z*sin,z-p.x*sin+p.z*cos));
  const across=((heights[2]!+heights[3]!)-(heights[0]!+heights[1]!))/(2*1.62);
  const along=((heights[1]!+heights[3]!)-(heights[0]!+heights[2]!))/(2*2.38);
  const right=new THREE.Vector3(cos,across,-sin);
  const back=new THREE.Vector3(sin,along,cos).normalize();
  const up=new THREE.Vector3().crossVectors(back,right).normalize();
  right.crossVectors(up,back).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,back));
}

/** Seat the actual tilted wheel footprint above terrain, including during suspension smoothing. */
export function roadsterGroundHeight(x:number,z:number,rotation:THREE.Quaternion,ground:(x:number,z:number)=>number) {
  return Math.max(...ROADSTER_CONTACTS.map(p=>{
    const contact=p.clone().applyQuaternion(rotation);
    return ground(x+contact.x,z+contact.z)-contact.y+.015;
  }));
}

export function alignRoadster(root:THREE.Group,x:number,z:number,yaw:number,ground:(x:number,z:number)=>number,dt=Infinity) {
  const rotation=roadsterTerrainRotation(x,z,yaw,ground);
  root.quaternion.slerp(rotation,1-Math.exp(-12*Math.max(0,dt)));
  root.position.set(x,roadsterGroundHeight(x,z,root.quaternion,ground),z);
}

/** A compact NA-inspired roadster: open cockpit, pop-up lamps and round rear lights. Front is -Z. */
export function buildMiata() {
  const root = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: '#c91927', metalness: 0.45, roughness: 0.28 });
  const dark = new THREE.MeshStandardMaterial({ color: '#171d23', roughness: 0.85 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#bfc9d0', metalness: 0.8, roughness: 0.25 });
  const glass = new THREE.MeshStandardMaterial({ color: '#b6e6f2', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const lamp = new THREE.MeshStandardMaterial({ color: '#fff4ce', emissive: '#fff0bb', emissiveIntensity: 0.6 });
  const box = (w: number,h: number,d: number,x: number,y: number,z: number,m: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); mesh.position.set(x,y,z); mesh.castShadow=true; root.add(mesh); return mesh;
  };
  box(1.62,.32,3.75,0,.5,0,red);
  box(1.55,.22,1.45,0,.76,-1.08,red); // long low bonnet
  box(1.53,.22,.75,0,.76,1.46,red);
  box(1.27,.08,1.35,0,.69,.24,dark);
  for (const x of [-.75,.75]) box(.12,.3,1.55,x,.79,.25,red);
  for (const x of [-.39,.39]) {
    box(.48,.16,.48,x,.78,.4,dark); box(.48,.55,.13,x,1,.69,dark);
    box(.37,.2,.32,x,.91,-1.52,red); box(.29,.12,.025,x,.92,-1.69,lamp);
    box(.18,.1,.16,x*2.25,1.01,-.35,red);
  }
  box(1.35,.61,.035,0,1.13,-.48,glass).rotation.x=.24;
  for(const x of [-.7,.7]) box(.045,.65,.055,x,1.13,-.48,chrome).rotation.x=.24;
  box(1.45,.045,.055,0,1.44,-.4,chrome);
  box(1.1,.1,.04,0,.42,-1.89,dark);
  box(.45,.13,.025,0,.48,1.89,chrome);
  for(const x of [-.58,-.36,.36,.58]) {
    const light = new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.035,16), new THREE.MeshStandardMaterial({color:'#eb453b',emissive:'#9d1010'}));
    light.rotation.x=Math.PI/2;light.position.set(x,.7,1.89);root.add(light);
  }
  const wheels: THREE.Mesh[]=[];
  for(const x of [-.81,.81]) for(const z of [-1.18,1.2]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.19,20),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.31,z);root.add(wheel);wheels.push(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.205,12),chrome);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);root.add(hub);
  }
  const steering = new THREE.Mesh(new THREE.TorusGeometry(.15,.025,6,16),dark);steering.position.set(-.38,1.04,-.16);steering.rotation.x=-.5;root.add(steering);
  return { root, wheels };
}
