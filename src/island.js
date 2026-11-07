import * as THREE from 'three';
import { heightAt, ISLAND, islandK } from './terrain.js';

// L'isola secca. Quando ci piove sopra, nasce tutto: erba, macchia, fiori, pini.
// Poi i fiori lasciano andare i petali, e il vento se li porta.

function petalTex() {
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) { c.save(); c.translate(S / 2, S / 2); c.rotate(i * 1.2566); c.beginPath(); c.ellipse(0, -S * 0.22, S * 0.13, S * 0.22, 0, 0, 7); c.fill(); c.restore(); }
  c.fillStyle = '#e8b830'; c.beginPath(); c.arc(S / 2, S / 2, S * 0.08, 0, 7); c.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function mergeGeos(list) {
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of list) { pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3); for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov; ov += g.attributes.position.count; oi += g.index.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1)); return out;
}
export function buildIsland(scene) {
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const spots = (n, minH, maxH) => {
    const out = [];
    for (let t = 0; out.length < n && t < n * 30; t++) {
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * ISLAND.r * 1.1;
      const x = ISLAND.x + Math.cos(a) * r, z = ISLAND.z + Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h > minH && h < maxH && islandK(x, z).k > 0.9) out.push({ x, z, h, d: rnd() });
    }
    return out;
  };
  const g = new THREE.Group(); scene.add(g);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();

  // macchia: cuscini verdi irregolari
  // cespuglio: grappolo di sfere morbide (normali lisce), non un sasso
  const blob = (ox, oy, oz, r) => { const b = new THREE.SphereGeometry(r, 20, 14); b.translate(ox, oy, oz); return b; };
  const parts = [blob(0, 0.35, 0, 0.62), blob(0.45, 0.25, 0.15, 0.45), blob(-0.4, 0.3, -0.1, 0.5), blob(0.05, 0.55, -0.35, 0.42), blob(-0.15, 0.2, 0.45, 0.4)];
  const shrubGeo = mergeGeos(parts);
  { const p = shrubGeo.attributes.position, n = shrubGeo.attributes.normal; for (let i = 0; i < p.count; i++) { const v = ps.fromBufferAttribute(p, i); const k = 1 + 0.08 * Math.sin(v.x * 13.1 + v.z * 9.3) * Math.sin(v.y * 11.2 + 1); p.setXYZ(i, v.x * k, v.y * k, v.z * k); } }
  const shrubs = spots(2400, 1.3, 60);
  const shrubM = new THREE.InstancedMesh(shrubGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }), shrubs.length);
  const cA = new THREE.Color(0x3d5428), cB = new THREE.Color(0x6f7d3a), tc = new THREE.Color();
  shrubs.forEach((s, i) => { shrubM.setColorAt(i, tc.copy(cA).lerp(cB, s.d)); s.sz = 0.45 + s.d * s.d * 1.3; });
  shrubM.castShadow = shrubM.receiveShadow = true; g.add(shrubM);

  // fiori: piccoli petali colorati a croce
  const fl = new THREE.PlaneGeometry(0.2, 0.2); fl.rotateX(-Math.PI / 2);
  const flowers = spots(5600, 1.1, 60);
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide, map: petalTex(), alphaTest: 0.4 });
  const flowerM = new THREE.InstancedMesh(fl, flowerMat, flowers.length);
  const pal = [0xf2d2e4, 0xffe28a, 0xffffff, 0xd9b8f0, 0xff9e8a];
  flowers.forEach((s, i) => flowerM.setColorAt(i, tc.set(pal[Math.floor(s.d * 5) % 5])));
  g.add(flowerM);

  // pini d'Aleppo: tronco inclinato e chioma a ombrello
  const trunkG = new THREE.CylinderGeometry(0.22, 0.42, 1, 18); trunkG.translate(0, 0.5, 0);
  const crownG = new THREE.SphereGeometry(1, 20, 14); crownG.scale(1, 0.38, 1);
  const pines = spots(100, 2.5, 50);
  const trunkM = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x6a5240, roughness: 0.95 }), pines.length);
  const crownM = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: 0x41592f, roughness: 0.9 }), pines.length);
  trunkM.castShadow = crownM.castShadow = true; crownM.receiveShadow = true;
  g.add(trunkM, crownM);

  // petali che si staccano e salgono nel vento
  const petG = new THREE.BufferGeometry();
  const NP = 260, pp = new Float32Array(NP * 3);
  petG.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pet = new THREE.Points(petG, new THREE.PointsMaterial({ color: 0xffd9e6, size: 0.22, transparent: true, opacity: 0, depthWrite: false }));
  pet.frustumCulled = false; g.add(pet);
  const petS = Array.from({ length: NP }, () => ({ x: 0, y: 0, z: 0, t: rnd() * 10 }));

  const I = { g, shrubs, flowers, pines, shrubM, flowerM, trunkM, crownM, pet, petS, bloom: 0, target: 0, done: false, rainT: 0 };
  setGrowth(I, 0);
  return I;
}

function grow(k, delay) { const x = Math.max(0, Math.min(1, (k - delay) / 0.35)); return x * x * (3 - 2 * x); }

function setGrowth(I, k) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  I.shrubs.forEach((s, i) => {
    const gk = grow(k, s.d * 0.5);
    ps.set(s.x, s.h - 0.15, s.z); q.setFromEuler(e.set(0, s.d * 6.28, 0)); sc.set(s.sz * 1.2, s.sz * (0.6 + 0.4 * s.d), s.sz).multiplyScalar(Math.max(0.001, gk));
    I.shrubM.setMatrixAt(i, m4.compose(ps, q, sc));
  });
  I.flowers.forEach((s, i) => {
    const gk = grow(k, 0.35 + s.d * 0.45);
    ps.set(s.x, s.h + 0.05 + 0.18 * gk, s.z); q.setFromEuler(e.set(0, s.d * 9, 0)); sc.setScalar(Math.max(0.001, gk));
    I.flowerM.setMatrixAt(i, m4.compose(ps, q, sc));
  });
  I.pines.forEach((s, i) => {
    const gk = grow(k, 0.2 + s.d * 0.4), H = (5 + s.d * 6) * gk;
    const lean = (s.d - 0.5) * 0.35;
    ps.set(s.x, s.h - 0.2, s.z); q.setFromEuler(e.set(lean, s.d * 6.28, lean * 0.6)); sc.set(gk, Math.max(0.001, H), gk);
    I.trunkM.setMatrixAt(i, m4.compose(ps, q, sc));
    const top = new THREE.Vector3(0, H, 0).applyQuaternion(q);
    ps.set(s.x + top.x, s.h - 0.2 + top.y, s.z + top.z); q.identity(); sc.set(3 + s.d * 2, 2.2 + s.d, 3 + s.d * 2).multiplyScalar(Math.max(0.001, gk));
    I.crownM.setMatrixAt(i, m4.compose(ps, q, sc));
  });
  for (const m of [I.shrubM, I.flowerM, I.trunkM, I.crownM]) { m.instanceMatrix.needsUpdate = true; m.visible = k > 0.001; }
}

// ctx: { dt, raining (bool: stai piovendo sopra l'isola), wind (vec2), time }
export function updateIsland(I, ctx) {
  if (ctx.raining) I.rainT += ctx.dt;
  if (I.rainT > 0.8 && I.target === 0) { I.target = 1; I.started = true; }
  if (I.bloom < I.target) {
    I.bloom = Math.min(1, I.bloom + ctx.dt / 22);
    setGrowth(I, I.bloom);
    if (I.bloom >= 1) I.done = true;
  }
  // petali: dopo la fioritura, si alzano nel vento
  const P = I.pet, pk = Math.max(0, (I.bloom - 0.7) / 0.3);
  P.material.opacity = 0.9 * pk;
  if (pk > 0) {
    const a = P.geometry.attributes.position.array;
    I.petS.forEach((s, i) => {
      s.t += ctx.dt;
      if (s.t > 12 || s.y === 0) { const f = I.flowers[(Math.random() * I.flowers.length) | 0]; s.x = f.x; s.y = f.h + 0.3; s.z = f.z; s.t = Math.random() * 3; }
      s.x += (ctx.wind.x * 3 + Math.sin(s.t * 2 + i) * 0.6) * ctx.dt; s.z += (ctx.wind.y * 3 + Math.cos(s.t * 1.7 + i) * 0.6) * ctx.dt; s.y += (0.6 + Math.sin(s.t * 3 + i) * 0.4) * ctx.dt;
      a[i * 3] = s.x; a[i * 3 + 1] = s.y; a[i * 3 + 2] = s.z;
    });
    P.geometry.attributes.position.needsUpdate = true;
  }
  return I.bloom;
}
