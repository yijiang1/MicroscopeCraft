import * as THREE from 'three';
import { seasonAt, type Season } from '../shared/seasons';
import { insideBuilding } from './campus';
import { heightAt, pathAt, waterLevelAt, mulberry32 } from './terrain';

export const SEASON_TRANSITION_MS = 12000;
export const transitionBlend = (elapsed: number) => { const t = Math.max(0, Math.min(1, elapsed / SEASON_TRANSITION_MS)); return t * t * (3 - 2 * t); };

const LABELS: Record<Season, string> = { spring: '🌱 Spring', summer: '☀ Summer', autumn: '🍂 Autumn', winter: '❄ Winter' };
const GROUND: Record<Season, string> = { spring: '#83b65c', summer: '#62903d', autumn: '#b29a54', winter: '#e5eff4' };
const LEAVES: Record<Season, string> = { spring: '#86bd59', summer: '#3f7a35', autumn: '#d88a30', winter: '#d3e3e9' };

/** Recolour the existing surface, without layering coplanar snow over floors. */
export function seasonalGround(base: THREE.Color, season: Season, amount: number) {
  return base.clone().lerp(new THREE.Color(GROUND[season]), amount);
}

export function mountSeasons(terrain: THREE.Mesh, decor: THREE.Group, scene: THREE.Scene, startedAt: number, onChange: (season: Season) => void, snowRoots: THREE.Object3D[] = []) {
  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;top:80px;left:14px;z-index:8;padding:9px 13px;border:1px solid #b4d1cb66;border-radius:12px;background:#132d35df;color:#eef7f1;font:13px system-ui;pointer-events:none';
  document.body.append(badge);
  const colors = terrain.geometry.getAttribute('color') as THREE.BufferAttribute;
  const base = Float32Array.from(colors.array);
  const pos = terrain.geometry.getAttribute('position');
  // Precompute where snow belongs, so seasonal changes never paint indoor floors or water.
  const cover = new Float32Array(pos.count);
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),z=pos.getZ(i);
    cover[i]=!insideBuilding(x,z,.5)&&heightAt(x,z)>waterLevelAt(x,z) ? 1-pathAt(x,z)*.7 : 0;
  }
  const plants: { mesh: THREE.Mesh; type: string; original?: Float32Array }[]=[];
  decor.traverse(obj=>{
    if(obj instanceof THREE.Mesh && obj.userData.seasonal) {
      const attribute=obj.geometry.getAttribute('color');
      plants.push({mesh:obj,type:obj.userData.seasonal,original:attribute ? Float32Array.from(attribute.array) : undefined});
    }
  });
  const rng=mulberry32(9191), count=700;
  const seeds=Array.from({length:count},()=>({x:rng()*60-30,z:rng()*60-30,y:rng()*24,speed:.7+rng()*.8}));
  const flakes=new THREE.BufferGeometry();
  flakes.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));
  const snow=new THREE.Points(flakes,new THREE.PointsMaterial({color:'#f3faff',size:.075,transparent:true,opacity:.85,depthWrite:false}));
  snow.frustumCulled=false;scene.add(snow);
  // Clone only materials that fade, keeping unrelated scenery unchanged.
  const fading: { mesh: THREE.Mesh; materials: THREE.Material[]; original: THREE.Material | THREE.Material[]; opacity: number[]; type: string; from: number; to: number; value: number }[] = [];
  const seen = new Set<THREE.Mesh>();
  const register = (mesh: THREE.Mesh, type: string) => {
    if (seen.has(mesh)) return; seen.add(mesh);
    const original = mesh.material;
    const materials = (Array.isArray(original) ? original : [original]).map(m => m.clone());
    fading.push({ mesh, materials, original, opacity: materials.map(m => m.opacity), type, from: 1, to: 1, value: 1 });
    mesh.material = Array.isArray(original) ? materials : materials[0]!;
  };
  for (const plant of plants) if (['snow','grass','flowers'].includes(plant.type)) register(plant.mesh, plant.type);
  scene.traverse(obj => { if (obj.userData.winterSnow) snowRoots.push(obj); });
  for (const root of snowRoots) {
    root.visible = true;
    root.traverse(obj => { if (obj instanceof THREE.Mesh) register(obj, 'snow'); });
  }
  const attributes = [colors, ...plants.filter(p => p.original && (p.type === 'oak' || p.type === 'pine')).map(p => p.mesh.geometry.getAttribute('color') as THREE.BufferAttribute)];
  let from = attributes.map(a => Float32Array.from(a.array)), target = from;
  let current:Season|undefined, lastLabel='', transitionStart=0, blending=false, lastPaint=0;
  let winterFrom=0, winterTo=0, winterAmount=0;
  const c=new THREE.Color();
  const apply=(season:Season)=>{
    for(let i=0;i<pos.count;i++) {
      c.fromArray(base,i*3);
      const amount=cover[i]!*(season==='winter'?.94:.28);
      c.copy(seasonalGround(c,season,amount));colors.setXYZ(i,c.r,c.g,c.b);
    }
    colors.needsUpdate=true;
    for(const {mesh,type,original} of plants) {
      if(type==='snow'){mesh.visible=season==='winter';continue;}
      mesh.visible=!(season==='winter'&&(type==='grass'||type==='flowers')) && !(season==='autumn'&&type==='flowers');
      if(!original || (type!=='oak'&&type!=='pine'))continue;
      const attr=mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
      const normals=mesh.geometry.getAttribute('normal');
      for(let i=0;i<attr.count;i++) {
        c.fromArray(original,i*3);
        // Merged tree geometry includes brown trunks: only recolour green crown vertices.
        if(c.g>c.r*1.15 && c.g>c.b*1.15) {
          const shade=.65+Math.min(.35,c.g);
          if(type==='oak')c.set(LEAVES[season]).multiplyScalar(shade);
          else if(season==='winter')c.lerp(new THREE.Color('#e0edf2'),normals.getY(i)>0?.85:.25);
        }
        attr.setXYZ(i,c.r,c.g,c.b);
      }
      attr.needsUpdate=true;
    }

  };
  return {
    update(now:number, position:THREE.Vector3) {
      const {season,remainingMs}=seasonAt(startedAt,now);
      if(season!==current){
        const initial = current === undefined;
        from = attributes.map(a => Float32Array.from(a.array));
        for (const fade of fading) fade.from = fade.value;
        winterFrom = winterAmount; winterTo = season === 'winter' ? 1 : 0;
        current=season; apply(season);
        target = attributes.map(a => Float32Array.from(a.array));
        for (const fade of fading) fade.to = fade.type === 'snow' ? winterTo : season === 'winter' || (season === 'autumn' && fade.type === 'flowers') ? 0 : 1;
        if(initial) { from=target; winterFrom=winterTo; for(const fade of fading)fade.from=fade.to; }
        transitionStart=initial ? now-SEASON_TRANSITION_MS : now; blending=true; lastPaint=-Infinity;
        onChange(season);
        badge.animate?.([{transform:'translateY(-8px)',opacity:.4},{transform:'translateY(0)',opacity:1}],{duration:700,easing:'ease-out'});
      }
      const blend = transitionBlend(now-transitionStart);
      if(blending && (now-lastPaint>=33 || blend===1)) {
        lastPaint=now;
        for(let j=0;j<attributes.length;j++) {
          const attr=attributes[j]!, a=from[j]!, b=target[j]!;
          for(let i=0;i<a.length;i++) attr.array[i]=a[i]!+(b[i]!-a[i]!)*blend;
          attr.needsUpdate=true;
        }
        for(const fade of fading) {
          const alpha=fade.from+(fade.to-fade.from)*blend;
          fade.value=alpha; fade.mesh.visible=alpha>.001;
          fade.materials.forEach((m,i)=>{
            const transparent=alpha<.999 || (Array.isArray(fade.original)?fade.original[i]!:fade.original).transparent;
            if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}
            m.opacity=fade.opacity[i]!*alpha;
            m.depthWrite=alpha>.98 && (Array.isArray(fade.original)?fade.original[i]!:fade.original).depthWrite;
          });
        }
        winterAmount=winterFrom+(winterTo-winterFrom)*blend;
        snow.visible=winterAmount>.001; snow.material.opacity=.85*winterAmount;
        blending=blend<1;
      }
      const seconds=Math.ceil(remainingMs/1000);
      const label=`${LABELS[season]} · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} until next season`;
      if(label!==lastLabel){badge.textContent=label;lastLabel=label;}
      if(winterAmount>.001) {
        const attr=flakes.getAttribute('position') as THREE.BufferAttribute;
        seeds.forEach((s,i)=>{
          const x=position.x+s.x+Math.sin(now*.0003+i)*1.4,z=position.z+s.z;
          const floor=heightAt(x,z), y=position.y+16-((now*.001*s.speed+s.y)%24);
          attr.setXYZ(i,x,insideBuilding(x,z,.6)||y<floor ? -1000 : y,z);
        });attr.needsUpdate=true;
      }
    },
    snowAmount: () => winterAmount,
    dispose(){badge.remove();scene.remove(snow);flakes.dispose();snow.material.dispose();for(const fade of fading){fade.mesh.material=fade.original;fade.materials.forEach(m=>m.dispose());}},
  };
}
