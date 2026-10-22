import { describe, expect, it } from 'vitest';
import { fishingWaterNear } from './fishing';
import { LAKE, WATER_LEVEL } from './terrain';
describe('shore fishing prompt',()=>{
  it('appears by water but not across campus or far above water',()=>{
    expect(fishingWaterNear(LAKE.x,LAKE.z,WATER_LEVEL+1)).toBe(true);
    expect(fishingWaterNear(0,0,.5)).toBe(false);
    expect(fishingWaterNear(LAKE.x,LAKE.z,30)).toBe(false);
  });
});
