import * as THREE from 'three';

// World-space furniture bounds; the middle aisle and roadster display stay open.
export const STORE_FURNITURE = [
  { x0: -17.5, x1: -13.3, z0: 26.6, z1: 27.5 },
  { x0: -17.3, x1: -16.3, z0: 29, z1: 32 },
  { x0: -17.3, x1: -16.3, z0: 34, z1: 36.5 },
  { x0: -13, x1: -11, z0: 26.6, z1: 27.5 },
  { x0: -10.5, x1: -10.35, z0: 26.4, z1: 29 },
  { x0: -6.8, x1: -6.65, z0: 26.4, z1: 29 },
];
export function buildStoreInterior() {
  const root = new THREE.Group();
  const mat = (color: string, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness: .65, metalness });
  const wood = mat('#ab805b'), dark = mat('#29464c'), gold = mat('#c4a36a', .55), red = mat('#b32235'), blue = mat('#8ec9ee'), white = mat('#f0f2ed');
  const box = (w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  const label = (title:string,x:number,y:number,z:number,w:number) => {
    const c=document.createElement('canvas');c.width=512;c.height=96;
    const g=c.getContext('2d')!;g.fillStyle='#29464c';g.fillRect(0,0,512,96);g.fillStyle='#fff0d2';g.font='600 38px system-ui';g.textAlign='center';g.fillText(title,256,62,480);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(w,w*96/512),new THREE.MeshBasicMaterial({map:texture}));sign.position.set(x,y,z);root.add(sign);
  };
  const shelf=(x:number,width:number)=>{
    for(const side of [-1,1])box(.1,2.3,.8,x+side*(width/2-.05),1.21,-4.95,wood);
    for(const y of [.25,.95,1.65,2.4])box(width,.1,.8,x,y,-4.95,wood);
    box(width,2.3,.08,x,1.21,-5.32,dark);
  };
  shelf(-3.4,4.2);label('SCIENTISTS & FIELD GUIDES',-3.4,2.75,-4.9,3.9);
  for(const y of [.6,1.3,2])for(let i=0;i<15;i++){
    const x=-5.25+i*.265;const h=.38+(i%3)*.07;
    box(.19,h,.5,x,y,-4.9,[red,blue,white,gold,dark][i%5]!);
    box(.13,.025,.012,x,y+h*.25,-4.643,gold);
  }
  // Two open rails with visible shirts, hangers, shoes and backpacks.
  for(const z of [-1.5,3.25]){
    for(const end of [-1,1]){box(.07,2,.07,-4.8,1.06,z+end*1.15,gold);box(.85,.08,.25,-4.8,.12,z+end*1.15,dark);}
    box(.07,.07,2.45,-4.8,2.06,z,gold);
  }
  for(let i=0;i<4;i++){
    const z=-2.4+i*.6,m=[blue,red,white,blue][i]!;
    box(.04,.18,.04,-4.8,1.95,z,gold);box(.65,.04,.05,-4.8,1.85,z,gold);
    box(.53,.65,.16,-4.8,1.47,z,m);
    for(const side of [-1,1])box(.2,.32,.17,-4.8+side*.34,1.63,z,m).rotation.z=side*.35;
  }
  label('APPAREL',-4.8,2.45,.1,1.7);
  for(let i=0;i<3;i++){
    const z=2.45+i*.8;
    box(.43,.58,.28,-4.8,1.48,z,red);box(.33,.23,.12,-4.8,1.31,z+.19,dark);
    for(const side of [-1,1])box(.045,.7,.045,-4.8+side*.17,1.52,z-.2,gold);
    box(.18,.06,.06,-4.8,1.83,z,gold);
  }
  label('FIELD BAGS',-4.8,2.45,4.6,1.8);
  shelf(0,2);label('SOUVENIRS',0,2.75,-4.9,1.95);
  for(const x of [-.55,.45]){
    box(.5,.08,.42,x,1.75,-4.9,dark);box(.08,.38,.08,x+.15,1.98,-4.9,gold);
    box(.3,.06,.25,x,1.94,-4.9,dark);box(.1,.25,.1,x,2.15,-4.9,white);
    const mug=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.25,16),red);mug.position.set(x,1.13,-4.9);root.add(mug);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.08,.025,6,12),gold);handle.position.set(x+.15,1.14,-4.9);root.add(handle);
  }
  // Walk-in changing booth, open at the front, with a raised rug and framed mirror.
  for(const x of [1.575,5.275])box(.15,2.6,2.6,x,1.36,-4.3,wood);
  box(3.85,.15,.15,3.425,2.65,-3,gold);
  const curtain=mat('#536f78');
  for(const x of [1.8,5.05])for(let i=0;i<4;i++)box(.09,2.35,.12,x+(i-1.5)*.095,1.43,-3+(i%2)*.06,curtain);
  box(2.8,.025,2.1,3.4,.08,-4.25,mat('#507b77'));
  box(1.5,2.05,.12,3.4,1.35,-5.5,gold);
  box(1.35,1.9,.025,3.4,1.35,-5.42,mat('#b6d6dc',.8));
  label('FITTING ROOM',3.4,2.92,-2.9,3.1);
  return root;
}
