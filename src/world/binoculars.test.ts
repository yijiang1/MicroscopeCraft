import { expect, it } from 'vitest';
import { binocularFov } from './binoculars';
it('makes objects four times larger while preserving perspective',()=>{
  for(const fov of [55,70,90]) {
    const zoomed=binocularFov(fov);
    expect(Math.tan(fov*Math.PI/360)/Math.tan(zoomed*Math.PI/360)).toBeCloseTo(4);
    expect(zoomed).toBeLessThan(fov);
  }
});
