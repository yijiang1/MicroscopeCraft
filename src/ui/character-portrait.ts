import * as THREE from 'three';
import type { GameContext } from '../shared/state';
import type { Economy } from '../shared/economy';
import { buildPlayer } from '../visuals/player';

/** A still picture of a character, rendered once with the in-game model. */
export const characterPortrait = (ctx: GameContext, character: Economy['character'], width = 96, height = 128) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(width * Math.min(devicePixelRatio, 2), height * Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff7e4', '#547277', 2.6));
  const light = new THREE.DirectionalLight('#ffffff', 3); light.position.set(-3, 5, 4); scene.add(light);
  const model = buildPlayer(); model.equip({ ...ctx.state.economy, character, eyewear: character === 'lena' ? 'none' : ctx.state.economy.eyewear }); model.root.rotation.y = Math.PI + 0.3; scene.add(model.root);
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 20); camera.position.set(0, 1.1, 4.2); camera.lookAt(0, 1, 0);
  renderer.render(scene, camera);
  const img = document.createElement('img');
  img.src = renderer.domElement.toDataURL(); img.width = width; img.height = height; img.alt = ''; img.style.display = 'block';
  model.dispose(); renderer.dispose(); renderer.forceContextLoss(); // free the GL context now, not at GC
  return img;
};

