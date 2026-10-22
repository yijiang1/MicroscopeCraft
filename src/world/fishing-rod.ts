import * as THREE from 'three';
export type FishingAction = 'ready' | 'cast' | 'reel' | 'caught' | 'idle';
/** Rod held by the avatar; line, float and catch live in world coordinates. */
export function buildFishingRod(player: THREE.Group) {
  const root=new THREE.Group();root.position.set(.38,1.08,-.45);player.add(root);root.visible=false;
  const shaft=new THREE.Group();root.add(shaft);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.012,.025,2.2,8),new THREE.MeshStandardMaterial({color:'#c9a56d'}));pole.position.y=1.1;shaft.add(pole);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.3,8),new THREE.MeshStandardMaterial({color:'#28383c'}));shaft.add(grip);
  const reel=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.08,12),new THREE.MeshStandardMaterial({color:'#a8c1c7',metalness:.7,roughness:.3}));reel.rotation.z=Math.PI/2;reel.position.set(-.08,.12,0);shaft.add(reel);
  const tip=new THREE.Object3D();tip.position.y=2.2;shaft.add(tip);
  const group=new THREE.Group();group.visible=false;
  const float=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),new THREE.MeshStandardMaterial({color:'#f35549',emissive:'#702018'}));group.add(float);
  const ripple=new THREE.Mesh(new THREE.RingGeometry(.15,.2,32),new THREE.MeshBasicMaterial({color:'#d1f1ee',transparent:true,opacity:.7,side:THREE.DoubleSide}));ripple.rotation.x=-Math.PI/2;group.add(ripple);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:'#edf3e8'}));group.add(line);
  const catchMesh=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshStandardMaterial({color:'#c4b750'}));catchMesh.scale.set(.3,.1,.15);group.add(catchMesh);catchMesh.visible=false;
  let action: FishingAction='idle',started=0;const target=new THREE.Vector3();const start=new THREE.Vector3();
  return {group, action(next: FishingAction, water?: THREE.Vector3, color?: string) {
    action=next;started=performance.now();if(water)target.copy(water);if(color)(catchMesh.material as THREE.MeshStandardMaterial).color.set(color);
    root.visible=group.visible=next!=='idle';catchMesh.visible=next==='caught';
  },update(t:number) {
    if(action==='idle')return;
    const elapsed=(t-started)/1000;
    shaft.rotation.x=action==='cast' ? -.9 + Math.sin(Math.min(1,elapsed/.8)*Math.PI)*1.8 : action==='reel' ? -.9+Math.sin(elapsed*16)*.12 : -.9;
    reel.rotation.x=action==='reel'?elapsed*15:0;
    player.updateMatrixWorld(true);tip.getWorldPosition(start);
    const progress=action==='cast'?Math.min(1,elapsed/.85):action==='ready'?0:1;
    float.position.lerpVectors(start,target,progress);float.position.y+=Math.sin(progress*Math.PI)*2;
    if(action==='caught'){float.position.lerpVectors(target,start,Math.min(1,elapsed/1.1));catchMesh.position.copy(float.position);catchMesh.rotation.z=Math.sin(elapsed*18)*.25;}
    else if(action==='reel'){float.position.lerp(start,.1*Math.max(0,1-elapsed));float.position.y+=Math.sin(elapsed*20)*.05;}
    else if(action!=='cast')float.position.y+=Math.sin(t*.006)*.035;
    const pos=line.geometry.attributes.position as THREE.BufferAttribute;pos.setXYZ(0,start.x,start.y,start.z);pos.setXYZ(1,float.position.x,float.position.y,float.position.z);pos.needsUpdate=true;line.geometry.computeBoundingSphere();
    ripple.position.copy(target);ripple.position.y+=.03;ripple.scale.setScalar(1+(elapsed%1)*2);ripple.visible=progress===1&&action!=='caught';
  },dispose(){player.remove(root);for(const g of [root,group])g.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();(o.material as THREE.Material).dispose();}});}};
}
