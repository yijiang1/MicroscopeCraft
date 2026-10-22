import type { FishingAction } from './fishing-rod';
import * as THREE from 'three';
import { catchFish, FISH, prepareFish, reelHit } from '../shared/fishing';
import type { GameContext } from '../shared/state';
import { heightAt, LAKE, waterLevelAt } from './terrain';

export function fishingWaterPoint(x: number, z: number, feet: number) {
  for (let r = 0; r <= 5; r += 1) for (let i = 0; i < 16; i++) {
    const wx = x + r * Math.cos(i * Math.PI / 8), wz = z + r * Math.sin(i * Math.PI / 8);
    const y = waterLevelAt(wx,wz);
    if (Number.isFinite(y) && heightAt(wx,wz) < y - 0.08 && Math.abs(feet-y) < 3) return new THREE.Vector3(wx,y+.04,wz);
  }
  return null;
}
export const fishingWaterNear = (x:number,z:number,feet:number) => !!fishingWaterPoint(x,z,feet);
export function buildFish() {
  const group = new THREE.Group();
  const swimmers: { body: THREE.Group; x: number; z: number; phase: number; tx: number; tz: number; speed: number; turnAt: number }[] = [];
  for (let i=0;i<24;i++) {
    const x = i<12 ? LAKE.x + Math.cos(i)*6 : -115+(i-12)*11;
    const z = i<12 ? LAKE.z + Math.sin(i)*6 : LAKE.z;
    if (!(heightAt(x,z)<waterLevelAt(x,z)-.2)) continue;
    const body=new THREE.Group(); const material=new THREE.MeshStandardMaterial({color:FISH[i%FISH.length]!.color,roughness:.65});
    const torso=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),material);torso.scale.set(.4,.09,.14);body.add(torso);
    const tail=new THREE.Mesh(new THREE.ConeGeometry(.16,.24,3),material);tail.rotation.z=Math.PI/2;tail.position.x=-.4;body.add(tail);
    group.add(body);body.position.set(x,waterLevelAt(x,z)-.06,z);swimmers.push({body,x,z,phase:i,tx:x,tz:z,speed:.4+Math.random()*.8,turnAt:0});
  }
  let previous=0;
  return {group,update(t: number) {
    const dt=Math.min(.1,Math.max(0,(t-previous)/1000));previous=t;
    for(const f of swimmers) {
      const p=f.body.position;
      if(t>f.turnAt||Math.hypot(f.tx-p.x,f.tz-p.z)<.3){
        f.turnAt=t+2000+Math.random()*4000;
        for(let attempt=0;attempt<12;attempt++){
          const x=p.x+(Math.random()-.5)*12,z=p.z+(Math.random()-.5)*12;
          if(heightAt(x,z)<waterLevelAt(x,z)-.2){f.tx=x;f.tz=z;break;}
        }
      }
      const dx=f.tx-p.x,dz=f.tz-p.z,d=Math.hypot(dx,dz)||1;
      const x=p.x+dx/d*f.speed*dt,z=p.z+dz/d*f.speed*dt;
      if(heightAt(x,z)<waterLevelAt(x,z)-.15){p.set(x,waterLevelAt(x,z)-.055+Math.sin(t*.003+f.phase)*.025,z);f.body.rotation.y=-Math.atan2(dz,dx);}
      else f.turnAt=0;
      f.body.children[1]!.rotation.y=Math.sin(t*.01+f.phase)*.4;
    }
  }};
}
export function mountFishing(ctx: GameContext, view: (id: string) => void, animate: (action: FishingAction, color?: string) => void = () => {}) {
  const prompt=document.createElement('button');prompt.textContent='🎣 Fish · R';
  prompt.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);padding:12px 24px;border:1px solid #9bd2c5;border-radius:24px;background:#173e49;color:white;font:bold 16px system-ui;z-index:10;cursor:pointer';prompt.hidden=true;
  const modal=document.createElement('dialog');modal.setAttribute('aria-label','Fishing and specimens');
  modal.style.cssText='width:min(400px,85vw);max-height:80vh;overflow:auto;margin:auto 20px auto auto;border:1px solid #83bcb9;border-radius:18px;background:#102c38;color:#f0f7f2;padding:24px;font:16px system-ui';
  const title=document.createElement('h2');title.textContent='Shoreline field station';
  const info=document.createElement('p');info.textContent='Cast, then reel while the marker is green. Land three good reels before three misses.';
  const meter=document.createElement('div');meter.style.cssText='position:relative;height:24px;background:linear-gradient(to right,#8c5d52 35%,#61ba96 35%,#61ba96 65%,#8c5d52 65%);border-radius:12px;margin:18px 0';meter.hidden=true;
  const marker=document.createElement('span');marker.style.cssText='position:absolute;top:-3px;width:5px;height:30px;background:white;border-radius:3px';meter.append(marker);
  const button=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;b.style.cssText='padding:9px 14px;margin:5px;border:1px solid #88b8ad;border-radius:8px;background:#24505c;color:white;cursor:pointer';return b;};
  const trophy=document.createElement('div');trophy.hidden=true;
  const collection=document.createElement('div');
  let casting=false, biteAt=0, phase=0, hits=0, misses=0, cooldown=0, available=false, nextProbe=0;
  let pendingView:string|null=null;
  let viewing = false;
  const offView = ctx.bus.on('openEyepiece', () => { viewing = true; available = false; prompt.hidden = true; });
  const offViewClose = ctx.bus.on('closeEyepiece', () => { viewing = false; nextProbe = 0; });
  const renderCollection=()=>{
    collection.replaceChildren();
    const h=document.createElement('h3');h.textContent='Fish collection & samples';collection.append(h);
    for(const fish of FISH) {
      const n=ctx.state.economy.fish[fish.id]??0;const sample=`fish_${fish.id}`;
      const row=document.createElement('div');row.textContent=`${fish.name} · ${n} caught `;
      if(n>0) row.append(button('Prepare scale sample',()=>{if(prepareFish(ctx,fish.id)){info.textContent=`${fish.name} scale added to your sample bag.`;renderCollection();}}));
      if(ctx.state.carriedSamples.includes(sample)) row.append(button('View sample',()=>{pendingView=sample;modal.close();}));
      collection.append(row);
    }
  };
  const cast=button('Cast line',()=>{animate('cast');trophy.hidden=true;casting=true;hits=0;misses=0;biteAt=performance.now()+1200+Math.random()*1800;cooldown=0;cast.disabled=true;reel.disabled=true;meter.hidden=false;info.textContent='Line cast… wait for a bite.';});
  const reel=button('Reel in',()=>{
    const now=performance.now();if(!casting||now<biteAt||now<cooldown)return;cooldown=now+350;animate('reel');
    if(reelHit(phase))hits++;else misses++;
    info.textContent=`${hits}/3 good reels · ${misses}/3 misses`;
    if(hits===3||misses===3) {
      casting=false;cast.disabled=false;reel.disabled=true;meter.hidden=true;
      if(hits===3){const fish=catchFish(ctx,Math.random());if(fish){animate('caught',fish.color);trophy.hidden=false;trophy.replaceChildren();
        const illustration=document.createElementNS('http://www.w3.org/2000/svg','svg');illustration.setAttribute('viewBox','0 0 240 100');illustration.setAttribute('role','img');illustration.setAttribute('aria-label',`Caught ${fish.name}`);
        illustration.innerHTML=`<path d="M170 50L218 18V82Z" fill="${fish.color}"/><ellipse cx="111" cy="50" rx="76" ry="32" fill="${fish.color}"/><path d="M98 23L120 4L143 24" fill="${fish.color}"/><circle cx="57" cy="43" r="6" fill="#102332"/><circle cx="55" cy="41" r="2" fill="white"/><path d="M80 30Q65 50 80 70" fill="none" stroke="#24434b" stroke-width="3"/>`;trophy.append(illustration);
        const label=document.createElement('strong');label.textContent=`${fish.name} · Caught!`;trophy.append(label);
      }info.textContent=fish?`Caught a ${fish.name}! Prepare its scale below.`:'Get a fishing rod from the store first.';renderCollection();}
      else {animate('ready');info.textContent='The fish slipped away. Cast again!';}
    }
  });reel.disabled=true;
  modal.append(title,info,trophy,meter,cast,reel,button('Close',()=>modal.close()),collection);document.body.append(prompt,modal);
  const open=()=>{if(viewing||!available||modal.open)return;document.exitPointerLock?.();ctx.bus.emit('campusActivityChanged',{open:true});animate('ready');renderCollection();modal.showModal();};
  prompt.onclick=open;
  const key=(e:KeyboardEvent)=>{if(e.key.toLowerCase()==='r'&&!e.repeat&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement))open();};
  addEventListener('keydown',key);modal.addEventListener('keydown',e=>e.stopPropagation());
  modal.addEventListener('close',()=>{animate('idle');casting=false;cast.disabled=false;reel.disabled=true;meter.hidden=true;ctx.bus.emit('campusActivityChanged',{open:false});if(pendingView){const id=pendingView;pendingView=null;view(id);}});
  return {update(x:number,z:number,feet:number,enabled:boolean,t:number) {
    if(t>=nextProbe){nextProbe=t+250;available=!viewing&&enabled&&ctx.state.economy.owned.includes('fishing_rod')&&fishingWaterNear(x,z,feet);}
    prompt.hidden=viewing||!available||!enabled||modal.open;
    if(modal.open&&casting){const now=performance.now();phase=(Math.sin((now-biteAt)*.0024)+1)/2;marker.style.left=`${phase*98}%`;if(now>=biteAt&&reel.disabled){reel.disabled=false;info.textContent='A bite! Reel while the marker is in the green zone.';}}
  },dispose(){offView();offViewClose();removeEventListener('keydown',key);prompt.remove();modal.remove();}};
}
