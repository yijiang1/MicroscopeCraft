import * as THREE from 'three';
import { groundAt, insideBuilding } from './campus';
import { heightAt, waterLevelAt } from './terrain';

export const TRACK_LIFETIME = 120;
/** Sample a continuous trail; never draw a line across a teleport or return to the store. */
export function trailSteps(distance: number, spacing = .22) {
  return distance < spacing || distance > 3 ? 0 : Math.floor(distance / spacing);
}
export function snowyGround(x: number, z: number, feet: number) {
  return !insideBuilding(x,z,.2) && heightAt(x,z)>waterLevelAt(x,z)+.03 && Math.abs(feet-heightAt(x,z))<.18 && Math.abs(groundAt(x,z,feet)-heightAt(x,z))<.12;
}

/** Two bounded instanced decal pools. Small depth offsets avoid coplanar snow/floor flicker. */
export function mountSnowTracks(scene: THREE.Scene) {
  const pools = [false, true].map(tire => {
    const capacity=tire?2048:512;
    const geometry=new THREE.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
    const births=new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(-1e6),1);
    geometry.setAttribute('born',births);
    const material=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
      uniforms:{now:{value:0},snow:{value:0},tire:{value:tire?1:0}},
      vertexShader:`attribute float born; varying vec2 tex; varying float birth;
        void main(){tex=uv;birth=born;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform float now;uniform float snow;uniform float tire;varying vec2 tex;varying float birth;
        void main(){
          float age=now-birth;float fade=1.0-smoothstep(75.0,120.0,age);
          vec2 q=tex-0.5;float shape=1.0;
          if(tire<0.5){
            float toe=1.0-smoothstep(.9,1.0,length(vec2(q.x/.4,(tex.y-.65)/.34)));
            float heel=(1.0-smoothstep(.27,.32,abs(q.x)))*step(.05,tex.y)*step(tex.y,.35);
            shape=max(toe,heel);
          }else{shape=1.0-smoothstep(.4,.5,abs(q.x));}
          float tread=mix(.7,1.0,step(.4,fract(tex.y*7.0+abs(q.x)*3.0)));
          float alpha=shape*fade*snow*tread*.32;
          if(alpha<.003||age<0.0)discard;
          gl_FragColor=vec4(.28,.38,.46,alpha);
        }`,
    });
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.frustumCulled=false;mesh.renderOrder=1;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const empty=new THREE.Matrix4().makeScale(0,0,0);
    for(let i=0;i<capacity;i++)mesh.setMatrixAt(i,empty);
    scene.add(mesh);
    return {mesh,geometry,material,births,capacity,index:0};
  });
  const normal=new THREE.Vector3(),right=new THREE.Vector3(),back=new THREE.Vector3(),point=new THREE.Vector3(),matrix=new THREE.Matrix4(),scale=new THREE.Vector3();
  let time=0, snow=0, left=false, cleared=true;
  let previous: {x:number;z:number}[]=[];
  const stamp=(tire:boolean,x:number,z:number,yaw:number,feet:number)=>{
    if(snow<.15 || !snowyGround(x,z,feet))return;
    cleared=false;
    const pool=pools[tire?1:0]!;
    const e=.08;
    normal.set((heightAt(x-e,z)-heightAt(x+e,z))/(2*e),1,(heightAt(x,z-e)-heightAt(x,z+e))/(2*e)).normalize();
    back.set(Math.sin(yaw),0,Math.cos(yaw));right.crossVectors(normal,back).normalize();back.crossVectors(right,normal).normalize();
    matrix.makeBasis(right,normal,back);matrix.scale(scale.set(tire?.23:.22,1,tire?.29:.36));
    point.set(x,heightAt(x,z)+.025,z);matrix.setPosition(point);
    pool.mesh.setMatrixAt(pool.index,matrix);pool.births.setX(pool.index,time);
    pool.index=(pool.index+1)%pool.capacity;pool.mesh.instanceMatrix.needsUpdate=true;pool.births.needsUpdate=true;
  };
  return {
    update(now:number,amount:number){
      time=now/1000;snow=amount;
      for(const pool of pools){pool.material.uniforms.now!.value=time;pool.material.uniforms.snow!.value=snow;pool.mesh.visible=snow>.01;}
      if(snow<.01&&!cleared){cleared=true;previous=[];for(const pool of pools){pool.births.array.fill(-1e6);pool.births.needsUpdate=true;}}
    },
    foot(x:number,z:number,yaw:number,feet:number){
      left=!left;const side=left?-.14:.14;
      stamp(false,x+Math.cos(yaw)*side,z-Math.sin(yaw)*side,yaw,feet);
    },
    car(root:THREE.Object3D,active:boolean){
      if(!active||snow<.15){previous=[];return;}
      root.updateMatrixWorld(true);
      const wheels=[-.81,.81].map(x=>new THREE.Vector3(x,.01,1.2).applyMatrix4(root.matrixWorld));
      const yaw=Math.atan2(root.matrixWorld.elements[8]!,root.matrixWorld.elements[10]!);
      wheels.forEach((wheel,index)=>{
        const last=previous[index];
        if(!last){previous[index]={x:wheel.x,z:wheel.z};return;}
        const distance=Math.hypot(wheel.x-last.x,wheel.z-last.z),steps=trailSteps(distance);
        if(distance>3){previous[index]={x:wheel.x,z:wheel.z};return;}
        for(let i=1;i<=steps;i++){
          const fraction=i*.22/distance,x=last.x+(wheel.x-last.x)*fraction,z=last.z+(wheel.z-last.z)*fraction;
          stamp(true,x,z,yaw,wheel.y);
        }
        if(steps){const fraction=steps*.22/distance;previous[index]={x:last.x+(wheel.x-last.x)*fraction,z:last.z+(wheel.z-last.z)*fraction};}
      });
    },
    dispose(){for(const pool of pools){scene.remove(pool.mesh);pool.mesh.dispose();pool.geometry.dispose();pool.material.dispose();}},
  };
}
