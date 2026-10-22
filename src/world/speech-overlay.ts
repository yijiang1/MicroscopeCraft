import * as THREE from 'three';
interface Speaker { id: string; name: string; partnerId?: string; partnerName?: string; text: string; position: THREE.Vector3 }
/** Compact screen-space bubbles above stationary speakers, without 3D ceiling intersections. */
export function mountSpeechOverlay(parent: HTMLElement) {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9;overflow:hidden';
  parent.append(layer);
  const labels = new Map<string, { el: HTMLDivElement; name: HTMLElement; text: HTMLElement; x: number; y: number; anchor: THREE.Vector3; phrase: string }>();
  const point = new THREE.Vector3(), ray = new THREE.Raycaster();
  let next = 0;
  return {
    update(speakers: readonly Speaker[], camera: THREE.Camera, buildings: THREE.Object3D, now: number, hidden: boolean) {
      if (now < next && !hidden) return; next = now + 50;
      const previouslyVisible = new Set([...labels].filter(([,l]) => !l.el.hidden).map(([id]) => id));
      labels.forEach(l => { l.el.hidden = true; });
      if (hidden) return;
      const occupied: { x: number; y: number; w: number; h: number }[] = [];
      for (const s of [...speakers].filter(s => s.text).sort((a,b) => a.position.distanceToSquared(camera.position) - b.position.distanceToSquared(camera.position))) {
        if (occupied.length >= 2) break;
        const distance = s.position.distanceTo(camera.position);
        if (distance > 18) continue;
        point.copy(s.position); point.y += 1.9;
        ray.set(camera.position, point.clone().sub(camera.position).normalize()); ray.far = Math.max(0, point.distanceTo(camera.position) - 0.2);
        if (ray.intersectObject(buildings, true).some(hit => {
          const material = (hit.object as THREE.Mesh).material;
          return material && (Array.isArray(material) ? material : [material]).some(m => !m.transparent || m.opacity > 0.6);
        })) continue;
        let label = labels.get(s.id);
        if (!label) {
          const el = document.createElement('div');
          el.style.cssText = 'position:absolute;box-sizing:border-box;width:min(218px,56vw);padding:9px 12px 10px;border:1px solid #b6c9b7bb;border-radius:12px;background:linear-gradient(135deg,#fffff8fa,#eef5ebfa);box-shadow:0 3px 12px #10251b26;color:#263b35;font:12px/1.4 system-ui;';
          const name = document.createElement('div'); name.style.cssText = 'font-size:10px;font-weight:650;color:#477467;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
          const text = document.createElement('div');
          const tail = document.createElement('div');tail.style.cssText = 'position:absolute;bottom:-5px;left:calc(50% - 4px);width:8px;height:8px;transform:rotate(45deg);background:#eef5eb;border-right:1px solid #b6c9b7bb;border-bottom:1px solid #b6c9b7bb';
          el.append(name, text, tail);layer.append(el);
          label = { el, name, text, x: 0, y: 0, anchor: s.position.clone(), phrase: '' }; labels.set(s.id, label);
        }
        // Latch the anchor for the utterance. Walking/bobbing cannot make the box jitter.
        if (label.phrase !== s.text || !previouslyVisible.has(s.id)) {
          label.anchor.copy(s.position); label.phrase = s.text;
          label.name.textContent = s.name; label.text.textContent = s.text;
        }
        point.copy(label.anchor); point.y += 2.2; point.project(camera);
        if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
        label.el.hidden = false;
        const w = label.el.offsetWidth, h = label.el.offsetHeight;
        const x = Math.max(8, Math.min(innerWidth - w - 8, (point.x + 1) * innerWidth / 2 - w / 2));
        let y = Math.max(50, Math.min(innerHeight - h - 80, (1 - point.y) * innerHeight / 2 - h - 6));
        // Keep the card below a nearby solid ceiling in the screen projection.
        const ceilingOrigin = label.anchor.clone(); ceilingOrigin.y += 2;
        ray.set(ceilingOrigin, new THREE.Vector3(0, 1, 0)); ray.far = 3;
        const ceiling = ray.intersectObject(buildings, true).find(hit => {
          const material = (hit.object as THREE.Mesh).material;
          return material && (Array.isArray(material) ? material : [material]).some(m => !m.transparent || m.opacity > 0.6);
        });
        if (ceiling) {
          const edge = ceiling.point.clone().project(camera);
          if (edge.z > -1 && edge.z < 1) y = Math.max(y, (1 - edge.y) * innerHeight / 2 + 8);
        }
        if (y + h > innerHeight - 72) { label.el.hidden = true; continue; }
        // Prefer one clear bubble over stacked boxes that obscure the scene.
        if (occupied.some(r => x < r.x + r.w + 12 && x + w + 12 > r.x && y < r.y + r.h + 12 && y + h + 12 > r.y)) { label.el.hidden = true; continue; }
        const blend = previouslyVisible.has(s.id) ? 0.65 : 1;
        label.x += (x - label.x) * blend; label.y += (y - label.y) * blend;
        label.el.style.transform = `translate(${Math.round(label.x)}px,${Math.round(label.y)}px)`;
        occupied.push({ x, y, w, h });
      }
    },
    dispose() { layer.remove(); },
  };
}
