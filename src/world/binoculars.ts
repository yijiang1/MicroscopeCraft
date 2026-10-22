import type { GameContext } from '../shared/state';
export const BINOCULAR_MAGNIFICATION = 4;
export const clampBinocularZoom = (zoom: number) => Math.max(2, Math.min(8, zoom));
export const binocularFov = (normal: number, zoom = BINOCULAR_MAGNIFICATION) => 2 * Math.atan(Math.tan(normal * Math.PI / 360) / clampBinocularZoom(zoom)) * 180 / Math.PI;
export function mountBinoculars(ctx: GameContext) {
  const overlay=document.createElement('div');overlay.hidden=true;overlay.setAttribute('aria-label','Binocular view');
  overlay.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9';
  overlay.innerHTML='<svg viewBox="0 0 1000 600" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true"><defs><mask id="binocular-mask"><rect width="1000" height="600" fill="white"/><ellipse cx="360" cy="300" rx="255" ry="245" fill="black"/><ellipse cx="640" cy="300" rx="255" ry="245" fill="black"/></mask></defs><rect width="1000" height="600" fill="#061015" fill-opacity=".97" mask="url(#binocular-mask)"/><path d="M480 300H520M500 280V320" stroke="#d3eee3" stroke-width="1" opacity=".6"/></svg><div style="position:absolute;bottom:7%;width:100%;text-align:center;color:#e4f1e9;font:15px system-ui;text-shadow:0 1px 3px black">Field binoculars · 4× · = to lower</div>';
  document.body.append(overlay);
  let active=false, zoom=BINOCULAR_MAGNIFICATION;
  const hint=overlay.querySelector('div')!;
  const render=()=>{
    hint.textContent=`Field binoculars · ${zoom}× · Scroll to zoom (2×–8×) · = to lower`;
    overlay.setAttribute('aria-label',`Binocular view, ${zoom} times magnification`);
  };
  const wheel=(e:WheelEvent)=>{
    if(!active)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(e.deltaY!==0)zoom=clampBinocularZoom(zoom-Math.sign(e.deltaY)*.5);
    render();
  };
  // Escape may release the browser's pointer lock, but it must not lower the optics.
  // Keep other keyboard actions from opening an activity that would replace the view.
  const key=(e:KeyboardEvent)=>{
    if(active&&!['=','w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' '].includes(e.key.toLowerCase()))e.stopImmediatePropagation();
  };
  addEventListener('wheel',wheel,{passive:false,capture:true});
  addEventListener('keydown',key,true);
  render();
  return { active:()=>active, zoom:()=>zoom, toggle(){if(!ctx.state.economy.owned.includes('binoculars'))return;active=!active;overlay.hidden=!active;},close(){active=false;overlay.hidden=true;},dispose(){removeEventListener('wheel',wheel,{capture:true});removeEventListener('keydown',key,{capture:true});overlay.remove();} };
}
