import { expect, it, vi } from 'vitest';
import { DRAWERS } from './draw';
import { loadGameData } from '../shared/data';
it('draws six arms at 60 degree intervals in the ice crystal',()=>{
  const rotate=vi.fn();
  const g={save:vi.fn(),restore:vi.fn(),translate:vi.fn(),rotate,beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),closePath:vi.fn(),stroke:vi.fn()};
  const feature=loadGameData().samples.snow_crystal!.features[0]!;
  DRAWERS.snowflake(g as unknown as CanvasRenderingContext2D,feature,{x0:0,x1:0,y0:0,y1:0,pxPerUm:1});
  expect(rotate.mock.calls.map(([angle])=>angle)).toEqual(Array.from({length:6},(_,i)=>i*Math.PI/3));
});
