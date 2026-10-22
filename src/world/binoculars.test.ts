import { createGame } from '../shared/state';
import { loadGameData } from '../shared/data';
import { expect, it, vi } from 'vitest';
import { binocularFov, clampBinocularZoom, mountBinoculars } from './binoculars';
it('preserves the selected magnification across camera fields of view',()=>{
  for(const fov of [55,70,90]) for(const zoom of [2,4,6,8]) {
    const zoomed=binocularFov(fov,zoom);
    expect(Math.tan(fov*Math.PI/360)/Math.tan(zoomed*Math.PI/360)).toBeCloseTo(zoom);
    expect(zoomed).toBeLessThan(fov);
  }
});
it('limits zoom to 2–8 times and starts at four times',()=>{
  expect(clampBinocularZoom(1.5)).toBe(2);
  expect(clampBinocularZoom(8.5)).toBe(8);
  expect(clampBinocularZoom(4.5)).toBe(4.5);
  expect(binocularFov(70)).toBe(binocularFov(70,4));
});

it('keeps binoculars raised on Escape and unregisters input handlers on disposal',()=>{
  const events=new EventTarget();
  const hint={textContent:''};
  const overlay={hidden:true,style:{cssText:''},innerHTML:'',setAttribute:vi.fn(),querySelector:()=>hint,remove:vi.fn()};
  vi.stubGlobal('document',{createElement:()=>overlay,body:{append:vi.fn()}});
  vi.stubGlobal('addEventListener',events.addEventListener.bind(events));
  vi.stubGlobal('removeEventListener',events.removeEventListener.bind(events));
  try {
    const ctx=createGame(loadGameData());ctx.state.economy.owned.push('binoculars');
    const binoculars=mountBinoculars(ctx);binoculars.toggle();
    const escape=Object.assign(new Event('keydown'),{key:'Escape'});
    events.dispatchEvent(escape);
    expect(binoculars.active()).toBe(true);expect(overlay.hidden).toBe(false);
    for(let i=0;i<20;i++)events.dispatchEvent(Object.assign(new Event('wheel',{cancelable:true}),{deltaY:-1}));
    expect(binoculars.zoom()).toBe(8);expect(hint.textContent).toContain('8×');
    for(let i=0;i<20;i++)events.dispatchEvent(Object.assign(new Event('wheel',{cancelable:true}),{deltaY:1}));
    expect(binoculars.zoom()).toBe(2);
    binoculars.dispose();
    events.dispatchEvent(Object.assign(new Event('wheel'),{deltaY:-1}));
    expect(binoculars.zoom()).toBe(2);expect(overlay.remove).toHaveBeenCalledOnce();
  } finally {vi.unstubAllGlobals();}
});
