// Scenery that is never gathered: sky, far hills, grass, trees, boulders, wild flowers, lamp posts, benches and birds.
// Buildings are in campus.ts.
// Everything repeated is instanced, so thousands of plants cost a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { stoneGeometry } from './models';
import { insideBuilding } from './campus';
import { CAYUGA_Y, deepWater, heightAt, LAKE, mulberry32, noise3, pathAt, WALKWAYS, waterLevelAt, WORLD_RADIUS } from './terrain';

export interface Blocker {
  x: number;
  z: number;
  r: number;
}

export const SUN_DIRECTION = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(25));

export function buildSky(): Sky {
  const sky = new Sky();
  sky.scale.setScalar(900);
  const u = sky.material.uniforms as Record<string, THREE.IUniform>;
  u.turbidity!.value = 4;
  u.rayleigh!.value = 1.6;
  u.mieCoefficient!.value = 0.004;
  u.mieDirectionalG!.value = 0.8;
  u.sunPosition!.value.copy(SUN_DIRECTION);
  return sky;
}

/** Same colour as the sky near the horizon, used for distance fog. */
export const FOG_COLOR = '#bcd3e6';

/** A copy of the geometry with one flat colour, optionally darker toward the bottom. */
function tinted(geo: THREE.BufferGeometry, hex: string, bottomShade = 1, height = 1): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const base = new THREE.Color(hex);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = bottomShade + (1 - bottomShade) * Math.min(1, Math.max(0, pos.getY(i) / height));
    colors.set([base.r * k, base.g * k, base.b * k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], tints?: THREE.Color[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    if (tints) mesh.setColorAt(i, tints[i]!);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function placeMatrix(x: number, z: number, scale: number, yaw: number, scaleY = scale, y = heightAt(x, z)): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    new THREE.Vector3(scale, scaleY, scale),
  );
}

function bush(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(1, 2);
}

/** Hazy hills all round the horizon, past the end of the map, on a far plain that fades into the fog. */
function farHills(): THREE.Group {
  const n = 240;
  const r = 430;
  const pos: number[] = [];
  const col: number[] = [];
  const low = new THREE.Color('#aebfcc');
  const high = new THREE.Color('#7890a2');
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const top = 28 + 40 * (0.5 + 0.5 * noise3(Math.cos(a) * 2.2, 5.1, Math.sin(a) * 2.2, 4));
    pos.push(Math.cos(a) * r, CAYUGA_Y - 1, Math.sin(a) * r, Math.cos(a) * r, top, Math.sin(a) * r);
    col.push(low.r, low.g, low.b, high.r, high.g, high.b);
  }
  const index: number[] = [];
  for (let i = 0; i < n; i++) index.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  const hills = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  const plain = new THREE.Mesh(new THREE.CircleGeometry(r + 10, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#5d7a45' }));
  plain.position.y = CAYUGA_Y - 0.4;
  const g = new THREE.Group();
  g.add(hills, plain);
  return g;
}

export interface SnowSite { x: number; z: number; y: number; radius: number }

export function buildDecor(avoid: { x: number; z: number }[]): { group: THREE.Group; blockers: Blocker[]; snowSites: SnowSite[]; update(t: number): void } {
  const group = new THREE.Group();
  const blockers: Blocker[] = [];
  const snowSites: SnowSite[] = [];
  const rng = mulberry32(2026);

  const dry = (x: number, z: number) => heightAt(x, z) > waterLevelAt(x, z) + 0.35 && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 4;
  const offPad = (x: number, z: number) => !insideBuilding(x, z, 2);
  const clear = (x: number, z: number, gap: number) => avoid.every((a) => Math.hypot(a.x - x, a.z - z) > gap);
  const points = (n: number, ok: (x: number, z: number) => boolean, cx = 0, cz = 0, spread = WORLD_RADIUS - 6) => {
    const out: { x: number; z: number }[] = [];
    for (let tries = 0; out.length < n && tries < n * 40; tries++) {
      const a = rng() * 6.283;
      const r = Math.sqrt(rng()) * spread;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (Math.hypot(x, z) < WORLD_RADIUS - 4 && ok(x, z)) out.push({ x, z });
    }
    return out;
  };
  const steep = (x: number, z: number) => {
    const h = heightAt(x, z);
    return Math.hypot(heightAt(x + 0.6, z) - h, heightAt(x, z + 0.6) - h) / 0.6 > 0.5;
  };
  /** Lawn: dry, off the paths, out of buildings, not on a gorge wall. */
  const meadow = (x: number, z: number) => dry(x, z) && !insideBuilding(x, z, 0.6) && pathAt(x, z) < 0.05 && !steep(x, z);
  /** The open lawn of the west slope, between the tower and the west campus: no trees on it. */
  const slopeLawn = (x: number, z: number) => x > -82 && x < -40 && z > -32 && z < 14;
  const quadLawn = (x: number, z: number) => (x > -23 && x < 23 && z > -38 && z < 1) || (x > -30 && x < 34 && z > 58 && z < 96);
  const engQuad = (x: number, z: number) => x > -48 && x < 52 && z > 38 && z < 112;

  // --- grass tufts: three crossed blades each
  const blade = (angle: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.03, 0, 0, 0.03, 0, 0, 0.005, 0.42, 0.07], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.3, 1, 0, 0.3, 1, 0, 0.3, 1], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([0.16, 0.33, 0.1, 0.16, 0.33, 0.1, 0.56, 0.78, 0.3], 3));
    g.rotateY(angle);
    return g;
  };
  const tuftGeo = mergeGeometries([blade(0), blade(1.05), blade(2.1)])!;
  const tufts = points(32000, (x, z) => meadow(x, z) && clear(x, z, 0.5), 0, 0, WORLD_RADIUS - 8);
  group.add(
    instanced(
      tuftGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }),
      tufts.map((p) => placeMatrix(p.x, p.z, 0.6 + rng() * 0.6, rng() * 6.28, 0.5 + rng() * 0.7)),
      tufts.map(() => new THREE.Color().setHSL(0.24 + rng() * 0.05, 0.4 + rng() * 0.2, 0.7 + rng() * 0.45)),
    ),
  );

  group.children.at(-1)!.userData.seasonal = 'grass';

  // --- wild flowers: stems and coloured heads
  const flowers = points(2400, (x, z) => meadow(x, z) && !quadLawn(x, z) && clear(x, z, 0.8), 0, 0, WORLD_RADIUS - 10);
  const stemGeo = new THREE.CylinderGeometry(0.004, 0.005, 0.26, 4);
  stemGeo.translate(0, 0.13, 0);
  group.add(instanced(stemGeo, new THREE.MeshStandardMaterial({ color: '#3f7a2c', roughness: 1 }), flowers.map((p) => placeMatrix(p.x, p.z, 1, 0))));
  group.children.at(-1)!.userData.seasonal = 'flowers';
  const headGeo = new THREE.CircleGeometry(0.045, 7);
  headGeo.rotateX(-1.1);
  headGeo.translate(0, 0.27, 0.01);
  const palette = ['#f4f0e6', '#f2d22e', '#e8548c', '#a86bd9', '#ef7a3a'].map((c) => new THREE.Color(c));
  group.add(
    instanced(
      headGeo,
      new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.8 }),
      flowers.map((p) => placeMatrix(p.x, p.z, 1, rng() * 6.28)),
      flowers.map(() => palette[Math.floor(rng() * palette.length)]!),
    ),
  );

  group.children.at(-1)!.userData.seasonal = 'flowers';

  // --- pine trees: one merged geometry, a grove on the lower west slope plus scattered ones off the campus hilltop
  const pineParts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.1, 0.18, 2.4, 7);
  trunk.translate(0, 1.2, 0);
  pineParts.push(tinted(trunk, '#5a4128'));
  for (let i = 0; i < 5; i++) {
    const cone = new THREE.ConeGeometry(1.55 - i * 0.28, 1.7, 9);
    cone.translate(0, 1.8 + i * 0.95 + 0.85, 0);
    pineParts.push(tinted(cone, '#2f5d34', 0.7, 7));
  }
  const pineGeo = mergeGeometries(pineParts)!;
  const pines = [
    ...points(34, (x, z) => dry(x, z) && offPad(x, z) && clear(x, z, 2.5), -58, 22, 13),
    ...points(130, (x, z) => dry(x, z) && offPad(x, z) && !engQuad(x, z) && !slopeLawn(x, z) && clear(x, z, 2.5) && (x < -46 || z < -54 || z > 36 || x > 50), 0, 0, WORLD_RADIUS - 8),
  ];
  group.add(
    instanced(
      pineGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      pines.map((p) => {
        const s = 0.75 + rng() * 0.7;
        blockers.push({ x: p.x, z: p.z, r: 0.3 * s });
        snowSites.push({x:p.x,z:p.z,y:heightAt(p.x,p.z)+2.8*s,radius:1.2*s});
        return placeMatrix(p.x, p.z, s, rng() * 6.28);
      }),
    ),
  );
  group.children.at(-1)!.castShadow = true;

  group.children.at(-1)!.userData.seasonal = 'pine';

  // --- oak-like trees: trunk plus lumpy crowns
  const oakParts: THREE.BufferGeometry[] = [];
  const oakTrunk = new THREE.CylinderGeometry(0.16, 0.27, 2.4, 8);
  oakTrunk.translate(0, 1.2, 0);
  oakParts.push(tinted(oakTrunk, '#4e3a24'));
  for (const [dx, dy, dz, r, hex] of [
    [0, 3.7, 0, 1.6, '#3f7a35'], [1.0, 3.2, 0.4, 1.15, '#4a8a3a'], [-0.9, 3.3, -0.5, 1.2, '#37702f'], [0.2, 4.5, -0.3, 1.0, '#559443'],
  ] as const) {
    const crown = bush();
    const pos = crown.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      v.multiplyScalar(r * (1 + 0.18 * noise3(v.x * 2 + dx, v.y * 2 + dy, v.z * 2 + dz)));
      pos.setXYZ(i, v.x + dx, v.y * 0.85 + dy, v.z + dz);
    }
    crown.computeVertexNormals();
    oakParts.push(tinted(crown, hex, 0.75, 6));
  }
  const oakGeo = mergeGeometries(oakParts)!;
  // big trees line the quad, a few more stand around campus
  const oaks = [
    ...[-34, -28, -22, -16, -10, -4].flatMap((z) => [{ x: -21, z }, { x: 21, z }]),
    ...[62, 70, 82, 90].flatMap((z) => [{ x: -15, z }, { x: 15, z }]), // and the engineering quad's lawn
    ...points(70, (x, z) => meadow(x, z) && !quadLawn(x, z) && !slopeLawn(x, z) && clear(x, z, 3) && Math.hypot(x, z) > 12, 0, 0, WORLD_RADIUS - 12),
  ];
  const oakMesh = instanced(
    oakGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    oaks.map((p) => {
      const s = 0.8 + rng() * 0.5;
      blockers.push({ x: p.x, z: p.z, r: 0.4 * s });
      snowSites.push({x:p.x,z:p.z,y:heightAt(p.x,p.z)+3.5*s,radius:1.5*s});
      return placeMatrix(p.x, p.z, s, rng() * 6.28);
    }),
  );
  oakMesh.userData.seasonal = 'oak';
  oakMesh.castShadow = true;
  group.add(oakMesh);

  // --- boulders, mostly in the highlands
  const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  for (let variant = 0; variant < 3; variant++) {
    const spots = [
      ...points(4, (x, z) => dry(x, z) && offPad(x, z) && clear(x, z, 1.8), -26, -50, 8),
      ...points(4, (x, z) => dry(x, z) && offPad(x, z) && clear(x, z, 1.8), 24, -51, 8),
      ...points(6, (x, z) => dry(x, z) && offPad(x, z) && clear(x, z, 1.8), -60, -18, 16),
      ...points(5, (x, z) => dry(x, z) && clear(x, z, 1.8), -10, -66, 30), // down in the gorge
    ];
    const rocks = instanced(
      stoneGeometry(20 + variant, 1),
      stoneMat,
      spots.map((p) => {
        const s = 0.4 + rng() * 1.1;
        blockers.push({ x: p.x, z: p.z, r: 0.8 * s });
        return placeMatrix(p.x, p.z, s, rng() * 6.28, s * (0.7 + rng() * 0.5), heightAt(p.x, p.z) + 0.05 * s);
      }),
    );
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    group.add(rocks);
  }

  // --- lamp posts every 14 m along the walkways, a step off to the side
  const lampSpots: { x: number; z: number }[] = [];
  for (const [x0, z0, x1, z1] of WALKWAYS) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let d = 4; d < len - 2; d += 14) {
      const x = x0 + ((x1 - x0) * d) / len + ((z1 - z0) / len) * 1.6;
      const z = z0 + ((z1 - z0) * d) / len - ((x1 - x0) / len) * 1.6;
      if (offPad(x, z) && !deepWater(x, z) && !steep(x, z) && clear(x, z, 1.5) && lampSpots.every((l) => Math.hypot(l.x - x, l.z - z) > 8)) lampSpots.push({ x, z });
    }
  }
  const lampPost = mergeGeometries([
    tinted(new THREE.CylinderGeometry(0.05, 0.09, 3.2, 8).translate(0, 1.6, 0), '#22262a'),
    tinted(new THREE.CylinderGeometry(0.16, 0.12, 0.08, 8).translate(0, 3.25, 0), '#22262a'),
    tinted(new THREE.ConeGeometry(0.22, 0.25, 8).translate(0, 3.75, 0), '#22262a'),
  ])!;
  group.add(instanced(lampPost, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), lampSpots.map((p) => placeMatrix(p.x, p.z, 1, 0))));
  group.add(instanced(
    new THREE.BoxGeometry(0.24, 0.32, 0.24).translate(0, 3.45, 0),
    new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffcf73', emissiveIntensity: 0.8 }),
    lampSpots.map((p) => placeMatrix(p.x, p.z, 1, 0)),
  ));
  for (const l of lampSpots) blockers.push({ x: l.x, z: l.z, r: 0.12 });

  // --- benches: along the top of the slope looking west over the lake, and by the cross paths of both quads
  const bench = mergeGeometries([
    tinted(new THREE.BoxGeometry(1.6, 0.06, 0.45).translate(0, 0.45, 0), '#7a5634'),
    tinted(new THREE.BoxGeometry(1.6, 0.35, 0.05).translate(0, 0.78, -0.22), '#7a5634'),
    ...[-0.7, 0.7].map((x) => tinted(new THREE.BoxGeometry(0.06, 0.8, 0.5).translate(x, 0.4, -0.02), '#2a2d30')),
  ])!;
  const benches = [
    ...[-24, -20, -16, -12, -8].map((z) => ({ x: -45, z, yaw: -Math.PI / 2 })),
    ...[-8, 8].flatMap((x) => [{ x, z: -21, yaw: 0 }, { x, z: -17, yaw: Math.PI }]),
    ...[-6, 6].flatMap((x) => [{ x, z: 74, yaw: 0 }, { x, z: 78, yaw: Math.PI }]),
  ].filter((b) => clear(b.x, b.z, 1.4));
  group.add(instanced(bench, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), benches.map((b) => placeMatrix(b.x, b.z, 1, b.yaw))));
  for (const b of benches) blockers.push({ x: b.x, z: b.z, r: 0.6 });

  // Snow sits above the seat and backrest, rather than sharing the wood's surface.
  const snowMaterial = new THREE.MeshStandardMaterial({color:'#edf8ff',roughness:.8});
  const benchSnowGeo = mergeGeometries([
    new THREE.BoxGeometry(1.58,.07,.43).translate(0,.525,0),
    new THREE.BoxGeometry(1.58,.06,.09).translate(0,.99,-.22),
  ])!;
  const benchSnow=instanced(benchSnowGeo,snowMaterial,benches.map(b=>placeMatrix(b.x,b.z,1,b.yaw)));
  benchSnow.userData.seasonal='snow';benchSnow.visible=false;group.add(benchSnow);
  for(const b of benches)snowSites.push({x:b.x,z:b.z,y:heightAt(b.x,b.z)+.55,radius:.8});

  // A pair of outdoor chairs beside the quad picnic table.
  const chairs=[{x:15,z:-13,yaw:-Math.PI/2},{x:15,z:-11,yaw:-Math.PI/2}];
  const chairGeo=mergeGeometries([
    tinted(new THREE.BoxGeometry(.65,.06,.55).translate(0,.45,0),'#7a5634'),
    tinted(new THREE.BoxGeometry(.65,.45,.06).translate(0,.75,-.25),'#7a5634'),
    ...[-.26,.26].flatMap(x=>[-.2,.2].map(z=>tinted(new THREE.BoxGeometry(.06,.45,.06).translate(x,.225,z),'#2a2d30'))),
  ])!;
  group.add(instanced(chairGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8}),chairs.map(b=>placeMatrix(b.x,b.z,1,b.yaw))));
  const chairSnowGeo=mergeGeometries([
    new THREE.BoxGeometry(.63,.07,.53).translate(0,.525,0),
    new THREE.BoxGeometry(.63,.06,.09).translate(0,1.01,-.25),
  ])!;
  const chairSnow=instanced(chairSnowGeo,snowMaterial,chairs.map(b=>placeMatrix(b.x,b.z,1,b.yaw)));
  chairSnow.userData.seasonal='snow';chairSnow.visible=false;group.add(chairSnow);
  for(const b of chairs){blockers.push({x:b.x,z:b.z,r:.4});snowSites.push({x:b.x,z:b.z,y:heightAt(b.x,b.z)+.55,radius:.5});}

  // --- birds: three small flocks circling over the quad, the slope and the lake, wings beating
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.12, -0.55, 0.12, 0, 0, 0, 0.12, 0, 0, -0.12, 0.55, 0.12, 0], 3));
  wing.computeVertexNormals();
  const flocks = [{ x: 0, z: -20, r: 32, y: 24 }, { x: -70, z: -6, r: 40, y: 14 }, { x: 48, z: -66, r: 22, y: 18 }];
  const birds = flocks.flatMap((f, fi) => Array.from({ length: 6 }, (_, i) => ({ ...f, phase: i * 0.16 + fi, lift: rng() * 3, flap: rng() * 6 })));
  const flock = new THREE.InstancedMesh(wing, new THREE.MeshStandardMaterial({ color: '#2b2b2e', side: THREE.DoubleSide, roughness: 1 }), birds.length);
  flock.frustumCulled = false;
  group.add(flock, farHills());
  const m = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const flapScale = new THREE.Vector3();

  return {
    group,
    blockers,
    snowSites,
    update(t) {
      birds.forEach((b, i) => {
        const a = t * 0.00012 + b.phase;
        at.set(b.x + Math.cos(a) * b.r, heightAt(b.x, b.z) + b.y + b.lift + Math.sin(t * 0.0007 + b.flap), b.z + Math.sin(a) * b.r);
        turn.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -a); // flying round the circle, anticlockwise seen from above
        flock.setMatrixAt(i, m.compose(at, turn, flapScale.set(1, Math.sin(t * 0.012 + b.flap) * 1.4, 1)));
      });
      flock.instanceMatrix.needsUpdate = true;
    },
  };
}
