import type { Npc } from '../shared/schema';
import { ATRIUM, FOOTPRINTS, GREENHOUSE, SCIENCE, WILSON } from './campus';
import { heightAt, LAKE, pathAt, waterLevelAt, WORLD_RADIUS } from './terrain';

/** North-up, player-centered map. Terrain is painted once; only the viewport and markers move. */
export function mountMinimap(parent: HTMLElement, npcs: Record<string, Npc>) {
  const size = 180;
  const range = 70;
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:12px;bottom:72px;width:clamp(120px,24vw,180px);padding:6px;background:#101c24e8;border:1px solid #aac6c066;border-radius:10px;pointer-events:none;color:#edf8f5;font:10px system-ui;box-shadow:0 3px 16px #0005';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * 2;
  canvas.style.cssText = 'display:block;width:100%;aspect-ratio:1;border-radius:6px';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Campus minimap: north is up; white arrow is you; gold dots are scientists; pink diamond is your tracked target.');
  const caption = document.createElement('div');
  caption.style.cssText = 'padding-top:4px;text-align:center';
  caption.textContent = 'N ↑ · You △ · Scientists ●';
  panel.append(canvas, caption);
  parent.append(panel);
  const g = canvas.getContext('2d')!;
  g.scale(2, 2);
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = 384;
  const a = atlas.getContext('2d')!;
  const scale = atlas.width / (WORLD_RADIUS * 2);
  for (let y = 0; y < atlas.height; y++) {
    for (let x = 0; x < atlas.width; x++) {
      const wx = x / scale - WORLD_RADIUS;
      const wz = y / scale - WORLD_RADIUS;
      a.fillStyle = Math.hypot(wx, wz) > WORLD_RADIUS ? '#0b1620'
        : heightAt(wx, wz) < waterLevelAt(wx, wz) ? '#386e89'
        : pathAt(wx, wz) > 0.35 ? '#b3a991' : '#49694e';
      a.fillRect(x, y, 1, 1);
    }
  }
  for (const b of [...FOOTPRINTS, GREENHOUSE, WILSON, ATRIUM]) {
    a.fillStyle = '#8b9399';
    a.fillRect((b.x0 + WORLD_RADIUS) * scale, (b.z0 + WORLD_RADIUS) * scale, (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale);
  }
  const labels = [
    { x: (SCIENCE.x0 + SCIENCE.x1) / 2, z: SCIENCE.z0 - 4, text: 'Science' },
    { x: (WILSON.x0 + WILSON.x1) / 2, z: WILSON.z0 - 4, text: 'CHESS' },
    { x: 0, z: -19, text: 'Quad' },
    { x: 0, z: 76, text: 'Engineering' },
    { ...LAKE, text: 'Lake' },
  ];
  let nextDraw = 0;
  return {
    update(x: number, z: number, directionX: number, directionZ: number, now: number, hidden: boolean, target?: { x: number; z: number } | null) {
      panel.hidden = hidden;
      if (hidden || now < nextDraw) return;
      nextDraw = now + 80;
      g.fillStyle = '#0b1620';
      g.fillRect(0, 0, size, size);
      g.drawImage(atlas, (x - range + WORLD_RADIUS) * scale, (z - range + WORLD_RADIUS) * scale, range * 2 * scale, range * 2 * scale, 0, 0, size, size);
      const project = (wx: number, wz: number) => [(wx - x) * size / (2 * range) + size / 2, (wz - z) * size / (2 * range) + size / 2];
      g.font = '10px system-ui';
      g.textAlign = 'center';
      g.lineWidth = 3;
      for (const label of labels) {
        const [lx, ly] = project(label.x, label.z);
        if (lx! < 24 || lx! > size - 24 || ly! < 12 || ly! > size - 12) continue;
        g.strokeStyle = '#17271e';
        g.strokeText(label.text, lx!, ly!);
        g.fillStyle = '#eef5ee';
        g.fillText(label.text, lx!, ly!);
      }
      for (const npc of Object.values(npcs)) {
        const [nx, ny] = project(npc.x, npc.z);
        g.beginPath();
        g.arc(nx!, ny!, 2.5, 0, Math.PI * 2);
        g.fillStyle = '#ffd36e';
        g.fill();
      }
      if (target) {
        const [tx, ty] = project(target.x, target.z);
        g.save();
        g.translate(Math.max(6, Math.min(size - 6, tx!)), Math.max(6, Math.min(size - 6, ty!)));
        g.rotate(Math.PI / 4);
        g.fillStyle = '#ff8cb5';
        g.fillRect(-3, -3, 6, 6);
        g.restore();
      }
      g.save();
      g.translate(size / 2, size / 2);
      g.rotate(Math.atan2(directionX, -directionZ));
      g.beginPath();
      g.moveTo(0, -8);
      g.lineTo(5, 6);
      g.lineTo(0, 3);
      g.lineTo(-5, 6);
      g.closePath();
      g.fillStyle = '#fff';
      g.strokeStyle = '#152a31';
      g.lineWidth = 2;
      g.fill();
      g.stroke();
      g.restore();
      g.fillStyle = '#fff';
      g.textAlign = 'left';
      g.fillText('N ↑', 6, 13);
      g.fillRect(8, size - 10, 20 * size / (2 * range), 2);
      g.fillText('20 m', 8, size - 14);
    },
    dispose() { panel.remove(); },
  };
}
