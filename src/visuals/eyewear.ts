import * as THREE from 'three';

/** Face-sized frames, looking along -Z. Reused by the character and shop display. */
export function buildEyewear(sunglasses = false) {
  const root = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: sunglasses ? '#bd9b58' : '#273c48', roughness: .4, metalness: .4 });
  const lens = new THREE.MeshStandardMaterial({ color: sunglasses ? '#182b33' : '#bce5ef', transparent: !sunglasses, opacity: sunglasses ? 1 : .22, depthWrite: sunglasses, roughness: .2 });
  const box = (w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material) => {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);root.add(mesh);
  };
  for(const side of [-1,1]) {
    const x=side*.1;
    box(.15,.09,.012,x,0,-.215,lens);
    for(const y of [-.054,.054])box(.174,.018,.024,x,y,-.22,frame);
    for(const edge of [-1,1])box(.018,.09,.024,x+edge*.078,0,-.22,frame);
    box(.018,.018,.32,side*.19,.025,-.06,frame);
  }
  box(.05,.018,.024,0,.015,-.22,frame);
  return {root,dispose(){root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});frame.dispose();lens.dispose();}};
}
