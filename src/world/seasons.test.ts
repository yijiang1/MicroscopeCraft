import * as THREE from 'three';
import { SEASON_MS } from '../shared/seasons';
import { expect, it, vi } from 'vitest';
import { mountSeasons, transitionBlend, SEASON_TRANSITION_MS } from './seasons';
import { trailSteps, snowyGround } from './snow-tracks';
import { heightAt } from './terrain';
it('blends smoothly across twelve seconds without overshoot',()=>{
  expect(transitionBlend(-1)).toBe(0);
  expect(transitionBlend(0)).toBe(0);
  expect(transitionBlend(SEASON_TRANSITION_MS/2)).toBe(.5);
  expect(transitionBlend(SEASON_TRANSITION_MS)).toBe(1);
  expect(transitionBlend(SEASON_TRANSITION_MS*2)).toBe(1);
  expect(transitionBlend(100)).toBeLessThan(.001);
});
it('keeps tire trails continuous for movement but skips stationary frames and teleports',()=>{
  expect(trailSteps(.1)).toBe(0);expect(trailSteps(.66)).toBe(3);
  expect(trailSteps(0)).toBe(0);expect(trailSteps(30)).toBe(0);
});
it('excludes indoor floors and elevated platforms from snowy tracks',()=>{
  expect(snowyGround(-12,32,heightAt(-12,32))).toBe(false);
  expect(snowyGround(0,0,heightAt(0,0)+10)).toBe(false);
});

it('interpolates terrain and snow props instead of switching them immediately',()=>{
  const badge={style:{cssText:''},textContent:'',remove:vi.fn()};
  vi.stubGlobal('document',{createElement:()=>badge,body:{append:vi.fn()}});
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,heightAt(0,0),0],3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute([.2,.5,.1],3));
  const material=new THREE.MeshBasicMaterial(),terrain=new THREE.Mesh(geometry,material);
  const prop=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  const decor=new THREE.Group(),scene=new THREE.Scene();scene.add(terrain,prop,decor);
  const seasons=mountSeasons(terrain,decor,scene,0,()=>{},[prop]);
  try{
    seasons.update(3*SEASON_MS-1,new THREE.Vector3());
    const before=Array.from(geometry.getAttribute('color').array);
    expect(prop.visible).toBe(false);
    seasons.update(3*SEASON_MS,new THREE.Vector3());
    expect(Array.from(geometry.getAttribute('color').array)).toEqual(before);
    seasons.update(3*SEASON_MS+SEASON_TRANSITION_MS/2,new THREE.Vector3());
    expect(seasons.snowAmount()).toBe(.5);
    expect((prop.material as THREE.Material).opacity).toBe(.5);
    seasons.update(3*SEASON_MS+SEASON_TRANSITION_MS,new THREE.Vector3());
    expect(seasons.snowAmount()).toBe(1);expect(prop.visible).toBe(true);
    seasons.update(4*SEASON_MS,new THREE.Vector3());
    seasons.update(4*SEASON_MS+SEASON_TRANSITION_MS,new THREE.Vector3());
    expect(seasons.snowAmount()).toBe(0);expect(prop.visible).toBe(false);
  }finally{seasons.dispose();geometry.dispose();material.dispose();prop.geometry.dispose();(prop.material as THREE.Material).dispose();vi.unstubAllGlobals();}
});
