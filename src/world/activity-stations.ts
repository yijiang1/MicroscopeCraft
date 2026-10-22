import { STORE_COUNTER } from './store-building';
import * as THREE from 'three';
import { groundAt } from './campus';
export const STATIONS = [
  { activity: 'lab' as const, x: 28, z: 17, name: 'Field Lab · Mini-games', color: '#317c80' },
  { activity: 'chess' as const, x: 54, z: 2, name: 'CHESS · Challenges', color: '#4b608e' },
  { activity: 'store' as const, ...STORE_COUNTER, name: 'ScopeCraft Store', color: '#b32638' },
];
export function buildActivityStation(station: typeof STATIONS[number]) {
  const root = new THREE.Group(); root.position.set(station.x, groundAt(station.x, station.z), station.z);
  const mat = new THREE.MeshStandardMaterial({ color: station.color });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.8), mat); base.position.y = 0.45; root.add(base);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
  const g = canvas.getContext('2d')!;g.fillStyle = station.color;g.fillRect(0,0,512,192);g.fillStyle='#fff';g.textAlign='center';g.font='bold 30px system-ui';g.fillText(station.name,256,78,490);g.font='25px system-ui';g.fillText('E · Enter',256,130);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));sign.scale.set(2.4,0.9,1);sign.position.y=1.8;root.add(sign);
  return root;
}
