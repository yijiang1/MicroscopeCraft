/** Fictional, scripted campus conversations, not historical quotations. No network/API calls. */
export const SCIENCE_CHATS = [
  ['What limits the detail we can resolve?', 'Wavelength and aperture matter. Magnification alone cannot recover missing detail.', 'Then let us compare resolution, not just image size.'],
  ['What can a diffraction pattern tell us?', 'Its spot positions reveal periodic order in a crystal.', 'And intensities need a model of how the waves scatter.'],
  ['How can we trust a faint feature in an image?', 'Repeat the measurement and check the background and calibration.', 'A useful control can be as revealing as the specimen.'],
  ['Could a sharper image damage our specimen?', 'More exposure can improve signal, but radiation can change the sample.', 'We should balance useful detail against dose.'],
  ['Why compare an image with a simulation?', 'It helps test how structure and instrument settings affect contrast.', 'Then we should test several explanations against the data.'],
];
export const ROAM_RADIUS = 12;
export interface Walker {
  id: string; x: number; z: number; homeX: number; homeZ: number;
  yaw: number; moving: boolean; speech: string; wait: number;
  partnerId?: string;
  goal?: { x: number; z: number };
}
export function createScientistLife(homes: readonly { id: string; x: number; z: number; facing: number }[], random = Math.random) {
  const walkers: Walker[] = homes.map((n, i) => ({ ...n, homeX: n.x, homeZ: n.z, yaw: n.facing, moving: false, speech: '', wait: i * 0.2 }));
  const chats: { a: Walker; b: Walker; elapsed: number; lines: string[] }[] = [];
  let nextChat = 1;
  let topic = 0;
  return { walkers, update(dt: number, player: { x: number; z: number }, canMove: (w: Walker, x: number, z: number) => boolean, paused = false) {
    if (paused) { walkers.forEach(w => { w.moving = false; w.speech = ''; }); return; }
    dt = Math.min(dt, 0.1);
    const busy = new Set<Walker>();
    for (let i = chats.length - 1; i >= 0; i--) {
      const c = chats[i]!;
      c.elapsed += dt;
      c.a.speech = c.b.speech = '';
      if (c.elapsed >= 18) { c.a.wait = c.b.wait = 8; chats.splice(i, 1); continue; }
      busy.add(c.a); busy.add(c.b);
      c.a.partnerId = c.b.id; c.b.partnerId = c.a.id;
      c.a.yaw = Math.atan2(c.a.x - c.b.x, c.a.z - c.b.z);
      c.b.yaw = c.a.yaw + Math.PI;
      const turn = Math.floor(c.elapsed / 6);
      (turn % 2 ? c.b : c.a).speech = c.lines[turn] ?? '';
    }
    for (const w of walkers) {
      w.moving = false;
      if (busy.has(w)) continue;
      w.speech = '';
      w.wait = Math.max(0, w.wait - dt);
      // Stay still for the player's interaction, even when the mouse is released for a dialog.
      if (Math.hypot(w.x - player.x, w.z - player.z) < 6 || w.wait > 0) continue;
      if (!w.goal) {
        const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * ROAM_RADIUS;
        w.goal = { x: w.homeX + Math.cos(angle) * radius, z: w.homeZ + Math.sin(angle) * radius };
      }
      const dx = w.goal.x - w.x, dz = w.goal.z - w.z, distance = Math.hypot(dx, dz);
      const step = Math.min(distance, dt * 0.7);
      const x = w.x + dx / (distance || 1) * step, z = w.z + dz / (distance || 1) * step;
      if (distance < 0.15 || !canMove(w, x, z)) { w.goal = undefined; w.wait = 1 + random() * 2; continue; }
      w.x = x; w.z = z; w.yaw = Math.atan2(-dx, -dz); w.moving = true;
    }
    const clearRoute = (a: Walker, b: Walker) => {
      const distance = Math.hypot(a.x - b.x, a.z - b.z);
      for (let d = 0.5; d < distance - 0.9; d += 0.5) {
        if (!canMove(a, a.x + (b.x - a.x) * d / distance, a.z + (b.z - a.z) * d / distance)) return false;
      }
      return true;
    };
    nextChat -= dt;
    if (nextChat <= 0) {
      nextChat = 3;
      for (const a of walkers) {
        if (busy.has(a) || a.wait > 3) continue;
        const b = walkers.find(b => b !== a && !busy.has(b) && b.wait <= 3 && Math.hypot(a.x - b.x, a.z - b.z) < 8 && clearRoute(a, b));
        if (!b) continue;
        chats.push({ a, b, elapsed: 0, lines: SCIENCE_CHATS[topic++ % SCIENCE_CHATS.length]! });
        busy.add(a); busy.add(b); a.goal = b.goal = undefined; a.moving = b.moving = false;
      }
    }
  } };
}
