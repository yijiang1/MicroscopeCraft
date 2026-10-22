import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { alignRoadster, ROADSTER_CONTACTS, roadsterGroundHeight, roadsterTerrainRotation, blocksRoadster, driveStep, roadsterGradeOK, TEST_DRIVE_MS } from './miata';
describe('Miata driving', () => {
  it('rolls over soft plants while retaining solid obstacles', () => {
    for (const kind of ['flower','leaf','fern','sunflower','sand','mud']) expect(blocksRoadster(kind)).toBe(false);
    for (const kind of ['npc','iron','log','resin','picnic']) expect(blocksRoadster(kind)).toBe(true);
  });
  it('handles gentle slopes and small curbs but rejects ledges', () => {
    expect(roadsterGradeOK(0.9, 1.7)).toBe(true);
    expect(roadsterGradeOK(-0.9, 1.7)).toBe(true);
    expect(roadsterGradeOK(0.12, 0.05)).toBe(true);
    expect(roadsterGradeOK(0.5, 0.1)).toBe(false);
    expect(roadsterGradeOK(-3, 1.7)).toBe(false);
  });
  it('accelerates, coasts to a stop, reverses and limits speed', () => {
    expect(driveStep(0,1,0,0,.1).speed).toBeGreaterThan(0);
    expect(driveStep(5,0,0,0,.1).speed).toBeLessThan(5);
    expect(driveStep(0,-1,0,0,.1).dz).toBeGreaterThan(0);
    expect(driveStep(15,1,0,0,.1).speed).toBeLessThanOrEqual(15);
  });
  it('makes a tight full-lock turn at both low and high speeds', () => {
    for (const speed of [2, 12]) {
      const step = driveStep(speed, 1, 1, 0, 0.05);
      const radius = Math.hypot(step.dx, step.dz) / Math.abs(step.yaw);
      expect(radius).toBeGreaterThanOrEqual(5.5);
      expect(radius).toBeLessThanOrEqual(6.5);
    }
  });
  it('steers with motion, rather than rotating a stationary car', () => {
    expect(driveStep(0,0,1,0,.1).yaw).toBe(0);
    expect(driveStep(5,1,1,0,.1).yaw).toBeGreaterThan(0);
    expect(driveStep(-3,-1,1,0,.1).yaw).toBeLessThan(0);
    expect(TEST_DRIVE_MS).toBe(30000);
  });
});

describe('Roadster terrain contact',()=>{
  it('matches uphill, downhill and cross slopes at different headings',()=>{
    for(const [gx,gz] of [[0,0],[0,.4],[0,-.4],[.3,0],[.2,-.3]])for(const yaw of [0,.7,Math.PI/2,Math.PI]) {
      const ground=(x:number,z:number)=>gx!*x+gz!*z+2;
      const rotation=roadsterTerrainRotation(5,-7,yaw,ground);
      const up=new THREE.Vector3(0,1,0).applyQuaternion(rotation);
      expect(up.distanceTo(new THREE.Vector3(-gx!,1,-gz!).normalize())).toBeLessThan(1e-10);
      const y=roadsterGroundHeight(5,-7,rotation,ground);
      for(const p of ROADSTER_CONTACTS) {
        const at=p.clone().applyQuaternion(rotation).add(new THREE.Vector3(5,y,-7));
        expect(at.y-ground(at.x,at.z)).toBeCloseTo(.015,8);
      }
    }
  });
  it('smooths terrain changes without putting wheel contact points underground',()=>{
    const root=new THREE.Group();
    const ground=(x:number,z:number)=>.25*x+.15*z+(x>0&&z>0?.12:0);
    const target=roadsterTerrainRotation(0,0,0,ground);
    const before=root.quaternion.angleTo(target);
    alignRoadster(root,0,0,0,ground,1/60);
    expect(root.quaternion.angleTo(target)).toBeLessThan(before);
    expect(root.quaternion.angleTo(target)).toBeGreaterThan(0);
    for(const p of ROADSTER_CONTACTS){const at=p.clone().applyQuaternion(root.quaternion).add(root.position);expect(at.y-ground(at.x,at.z)).toBeGreaterThanOrEqual(.0149);}
    for(let i=0;i<120;i++)alignRoadster(root,0,0,0,()=>0,1/60);
    expect(root.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(.001);
  });
});
