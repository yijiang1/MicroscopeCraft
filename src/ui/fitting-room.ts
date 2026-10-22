import * as THREE from 'three';
import { buildPlayer } from '../visuals/player';
import { equip, storeCatalog, type StoreItem } from '../shared/economy';
import type { GameContext } from '../shared/state';
import { storePreview } from './store-preview';

/** An owned-only wardrobe with the same character model used in the world. */
export function mountFittingRoom(host: HTMLElement, ctx: GameContext) {
  const layout=document.createElement('div');layout.style.cssText='display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start';
  const mirror=document.createElement('section');mirror.style.cssText='flex:1 1 260px;position:sticky;top:0;border:1px solid #c7ac7155;border-radius:16px;background:radial-gradient(ellipse at top,#3b6065,#152c35);overflow:hidden;text-align:center';
  const canvas=document.createElement('canvas');canvas.style.cssText='width:100%;height:350px;display:block';canvas.setAttribute('aria-label','Preview of your equipped outfit');
  const controls=document.createElement('div');controls.style.padding='8px';
  mirror.append(canvas,controls);
  const wardrobe=document.createElement('section');wardrobe.style.cssText='flex:1 1 300px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px';
  layout.append(mirror,wardrobe);host.append(layout);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff7e4','#547277',2.6));
  const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(-3,5,4);scene.add(light);
  const character=buildPlayer();character.root.rotation.y=Math.PI+.3;scene.add(character.root);
  const camera=new THREE.PerspectiveCamera(35,1,.1,20);camera.position.set(0,1.1,4.5);camera.lookAt(0,1,0);
  const render=()=>{character.equip(ctx.state.economy);renderer.render(scene,camera);};
  const resize=()=>{const w=canvas.clientWidth||280,h=350;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
  const ro=new ResizeObserver(resize);ro.observe(mirror);
  const button=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;};
  controls.append(button('↶ Rotate',()=>{character.root.rotation.y-=Math.PI/4;render();}),button('Rotate ↷',()=>{character.root.rotation.y+=Math.PI/4;render();}));
  const items:StoreItem[]=[{id:'shirt_blue',name:ctx.state.economy.character==='lena'?'Black turtleneck':'Original blue shirt',kind:'shirt',price:0,text:'Always available'},...storeCatalog(ctx.data).filter(i=>['shirt','backpack','model','eyewear'].includes(i.kind)&&ctx.state.economy.owned.includes(i.id))];
  const draw=()=>{
    wardrobe.replaceChildren();
    for(const item of items){
      const e=ctx.state.economy;const worn=item.id==='backpack'?e.backpack:item.id==='model'?e.model:item.kind==='eyewear'?e.eyewear===item.id:item.id===`shirt_${e.shirt}`;
      const card=document.createElement('article');card.style.border=worn?'1px solid #b4d9a0':'1px solid transparent';
      const picture=document.createElement('div');picture.style.height='100px';picture.append(storePreview(item));
      const name=document.createElement('h3');name.textContent=item.name;name.style.fontSize='14px';
      const b=button(worn?(item.kind==='shirt'?'Wearing':'Remove'):'Wear',()=>{equip(ctx,item.id);draw();render();});b.disabled=worn&&item.kind==='shirt';b.setAttribute('aria-pressed',String(worn));
      card.append(picture,name,b);wardrobe.append(card);
    }
    if(items.length===1){const hint=document.createElement('p');hint.textContent=`Your ${items[0]!.name.toLowerCase()} is ready to wear. Buy clothing and accessories in the store to add them here.`;wardrobe.append(hint);}
  };
  draw();resize();
  return ()=>{ro.disconnect();character.dispose();renderer.dispose();layout.remove();};
}
