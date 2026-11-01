import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';
import { smoothNormals } from './terrain.js';
import { FRAGMENTS } from './story.js';

// Una spiaggia fuori stagione: tutto ciò che c'è è reale, solo un po' dimenticato.

const std = (color, rough = 0.8, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const sh = (o) => { o.traverse?.((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); if (o.isMesh) { o.castShadow = o.receiveShadow = true; } return o; };
const mesh = (geo, mat) => sh(new THREE.Mesh(geo, mat));
const boxM = (w, h, d, mat) => mesh(new THREE.BoxGeometry(w, h, d), mat);
// scatola con spigoli smussati: niente bordi taglienti da poligono
function roundedBox(w, h, d, r, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position, v = new THREE.Vector3(), inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(Math.max(-inner.x, Math.min(inner.x, v.x)), Math.max(-inner.y, Math.min(inner.y, v.y)), Math.max(-inner.z, Math.min(inner.z, v.z)));
    const off = v.clone().sub(c);
    if (off.lengthSq() > 1e-9) v.copy(c).add(off.normalize().multiplyScalar(r));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
const rboxM = (w, h, d, r, mat) => mesh(roundedBox(w, h, d, r), mat);
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const at = (x, d) => ({ x, z: shoreZ(x) + d });

// ---------- texture
function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const rnd = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();

const woodTex = () => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#9c8468'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) {
    const t = 130 + rnd() * 40 | 0;
    c.fillStyle = `rgb(${t + 25},${t + 5},${t - 20})`; c.fillRect(0, y + 1, w, 30);
    for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(80,60,40,${0.05 + rnd() * 0.12})`; c.fillRect(rnd() * w, y + 2 + rnd() * 27, 20 + rnd() * 80, 1); }
    c.fillStyle = 'rgba(60,45,30,0.6)'; c.fillRect(0, y, w, 2);
  }
  c.fillStyle = 'rgba(220,210,190,0.18)'; for (let k = 0; k < 60; k++) c.fillRect(rnd() * w, rnd() * h, rnd() * 30, 2);
});

const cabinTex = (col) => canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#ece8df'; c.fillRect(0, 0, w, h);
  c.fillStyle = col; for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 16, h);
  c.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 300; k++) c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1);
  c.fillStyle = 'rgba(90,80,70,0.15)'; for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 1, h);
});

const windowLightTex = (seed) => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  let k = seed * 7 + 3;
  for (let y = 24; y < h - 20; y += 58) for (let x = 20; x < w - 30; x += 60) {
    k = (k * 1103515245 + 12345) & 0x7fffffff;
    if (k % 5 === 0) { c.fillStyle = '#ffd9a8'; c.fillRect(x + 2, y + 2, 26, 36); }
  }
});

const facadeTex = () => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#e9dfcf'; c.fillRect(0, 0, w, h);
  for (let y = 24; y < h - 20; y += 58) for (let x = 20; x < w - 30; x += 60) {
    c.fillStyle = '#6f7d74'; c.fillRect(x, y, 30, 40);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 14, y, 2, 40);
    c.fillStyle = '#d8ccb8'; c.fillRect(x - 3, y + 40, 36, 4);
  }
  c.fillStyle = 'rgba(120,100,80,0.12)'; for (let k = 0; k < 200; k++) c.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 10, 1 + rnd() * 6);
});

// ---------- luoghi
export const PONTILE = { x: -42, z0: shoreZ(-42), deck: 1.35, half: 1.15, from: 13, to: -95 };
export const SCOGLIERA = { x: -172, z0: shoreZ(-172), half: 3.4, from: 2, to: -48 };
export const PERGOLA = at(34, 8.5);
export const BARCA = at(-96, 5.5);
export const TORRETTA = at(108, 7);
export const LUNGO = { d: 62, wall: 0.5 };
export const BELVEDERE = at(48, 300);

// panchine dove sedersi a guardare il tempo che passa
export const BENCHES = [];
// ostacoli (AABB in xz, con altezza)
const COLLIDERS = [];
const addCollider = (x, z, hx, hz, top, rot = 0) => COLLIDERS.push({ x, z, hx, hz, top, c: Math.cos(rot), s: Math.sin(rot) });

export function collide(pos) {
  for (const b of COLLIDERS) {
    if (pos.y > b.top - 0.2) continue;
    const dx = pos.x - b.x, dz = pos.z - b.z;
    let lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
    const r = 0.3;
    const ox = b.hx + r - Math.abs(lx), oz = b.hz + r - Math.abs(lz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) lx += Math.sign(lx) * ox; else lz += Math.sign(lz) * oz;
      pos.x = b.x + lx * b.c + lz * b.s; pos.z = b.z - lx * b.s + lz * b.c;
    }
  }
}

function rockTop(lx, d) {
  const S = SCOGLIERA;
  const k = 1 - (lx / S.half) ** 2;
  const end = Math.min(1, (d - S.to) / 6) * Math.min(1, (S.from + 3 - d) / 5);
  return 1.5 * Math.max(k, 0) * Math.max(end, 0) + 0.25 * vnoise(lx * 0.9, d * 0.9) - 0.1;
}

// superfici calpestabili sopra il terreno; -Infinity se fuori
export function placeHeight(x, z, feetY) {
  let best = -Infinity;
  const ok = (h) => { if (h <= feetY + 0.62 && h > best) best = h; };
  { // pontile
    const P = PONTILE, d = z - P.z0;
    if (Math.abs(x - P.x) < P.half && d <= P.from && d >= P.to) {
      if (d > 8) { const tH = heightAt(x, P.z0 + P.from); ok(tH + (P.deck - tH) * (P.from - d) / (P.from - 8)); }
      else ok(P.deck);
    }
  }
  { // scogliera
    const S = SCOGLIERA, d = z - S.z0, lx = x - S.x;
    if (Math.abs(lx) < S.half && d <= S.from + 3 && d >= S.to) ok(rockTop(lx, d));
  }
  { // lungomare
    const d = z - shoreZ(x);
    if (d >= LUNGO.d && d <= LUNGO.d + 9) ok(heightAt(x, shoreZ(x) + LUNGO.d) + LUNGO.wall);
  }
  return best;
}

function bench(g, x, y, z, rot, wood) {
  const b = new THREE.Group();
  const seat = rboxM(1.6, 0.06, 0.42, 0.025, wood); seat.position.y = 0.45; b.add(seat);
  const back = rboxM(1.6, 0.36, 0.05, 0.02, wood); back.position.set(0, 0.72, -0.2); back.rotation.x = -0.12; b.add(back);
  const iron = std(0x2a2b2d, 0.5, 0.6);
  for (const sx of [-0.7, 0.7]) { const l = boxM(0.05, 0.45, 0.4, iron); l.position.set(sx, 0.22, 0); b.add(l); }
  b.position.set(x, y, z); b.rotation.y = rot;
  g.add(b);
  const wp = new THREE.Vector3(); b.getWorldPosition(wp);
  return b;
}

// ---------- oggetti lasciati da qualcuno (ognuno custodisce un frammento)
function traceModel(kind) {
  const g = new THREE.Group();
  if (kind === 'jar') {
    const glass = mesh(lathe([[0, 0], [0.07, 0], [0.075, 0.02], [0.075, 0.15], [0.06, 0.17], [0.06, 0.19], [0, 0.19]], 24),
      std(0xdfe8e4, 0.08, 0, { transparent: true, opacity: 0.35 }));
    g.add(glass);
    const candle = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 16), std(0xf3ecdc, 0.6)); candle.position.y = 0.04; g.add(candle);
    g.userData.flame = new THREE.Vector3(0, 0.1, 0);
  } else if (kind === 'book') {
    const cover = std(0x6d4a3a, 0.7), page = std(0xf1ebde, 0.9);
    for (const s of [-1, 1]) {
      const c = mesh(new THREE.BoxGeometry(0.15, 0.008, 0.22), cover); c.position.set(s * 0.075, 0, 0); c.rotation.z = -s * 0.08; g.add(c);
      const p = mesh(new THREE.BoxGeometry(0.14, 0.02, 0.21), page); p.position.set(s * 0.073, 0.014, 0); p.rotation.z = -s * 0.12; g.add(p);
    }
  } else if (kind === 'sandals') {
    const m = std(0x7a5236, 0.7);
    for (const s of [-1, 1]) {
      const sole = mesh(new THREE.CapsuleGeometry(0.045, 0.16, 4, 12), m); sole.rotation.x = Math.PI / 2; sole.scale.set(1, 1, 0.25); sole.position.set(s * 0.07, 0.012, s * 0.02); sole.rotation.z = s * 0.1; g.add(sole);
      const strap = mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 16, Math.PI), m); strap.position.set(s * 0.07, 0.012, s * 0.02 - 0.03); strap.rotation.y = Math.PI / 2; g.add(strap);
    }
  } else if (kind === 'hat') {
    const straw = std(0xd8c08a, 0.85);
    const h = mesh(lathe([[0, 0.09], [0.08, 0.09], [0.095, 0.05], [0.1, 0.012], [0.19, 0.006], [0.2, 0], [0.19, -0.004], [0.1, 0.004], [0, 0.004]], 32), straw);
    g.add(h);
    const band = mesh(new THREE.CylinderGeometry(0.101, 0.101, 0.02, 32, 1, true), std(0x2e3a52, 0.8)); band.position.y = 0.022; g.add(band);
    g.rotation.z = 0.08;
  } else if (kind === 'letter') {
    const p = std(0xf2ede2, 0.95);
    const a = mesh(new THREE.BoxGeometry(0.16, 0.003, 0.11), p); a.position.set(0, 0.01, 0); g.add(a);
    const b = mesh(new THREE.BoxGeometry(0.16, 0.003, 0.11), p); b.position.set(0, 0.03, -0.045); b.rotation.x = 0.5; g.add(b);
  } else if (kind === 'lantern') {
    const iron = std(0x2c2c2c, 0.5, 0.6);
    const base = mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 12), iron); g.add(base);
    const glass = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 12), std(0xe8e0d0, 0.1, 0, { transparent: true, opacity: 0.3 })); glass.position.y = 0.1; g.add(glass);
    const top = mesh(new THREE.ConeGeometry(0.09, 0.07, 12), iron); top.position.y = 0.21; g.add(top);
    const ring = mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12), iron); ring.position.y = 0.27; g.add(ring);
    g.userData.flame = new THREE.Vector3(0, 0.1, 0);
  } else if (kind === 'watch') {
    const steel = std(0xb9b4a8, 0.3, 0.9), leather = std(0x4a3022, 0.8);
    const cs = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.009, 24), steel); cs.position.y = 0.006; g.add(cs);
    const face = mesh(new THREE.CircleGeometry(0.019, 24), std(0xf1ece0, 0.4)); face.rotation.x = -Math.PI / 2; face.position.y = 0.0112; g.add(face);
    const hand = mesh(new THREE.BoxGeometry(0.002, 0.001, 0.016), std(0x111111, 0.5)); hand.position.set(0, 0.0118, -0.006); g.add(hand);
    for (const s of [-1, 1]) { const st = mesh(new THREE.BoxGeometry(0.018, 0.003, 0.07), leather); st.position.set(0, 0.003, s * 0.05); st.rotation.x = s * 0.15; g.add(st); }
    g.scale.setScalar(2.2);
  } else if (kind === 'binoculars') {
    const body = std(0x2a2a2a, 0.5, 0.3), glass = std(0x7fa0b0, 0.05, 0.6);
    for (const s of [-1, 1]) {
      const t = mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.13, 16), body); t.rotation.x = Math.PI / 2; t.position.set(s * 0.04, 0.035, 0); g.add(t);
      const l = mesh(new THREE.CircleGeometry(0.028, 16), glass); l.position.set(s * 0.04, 0.035, -0.066); l.rotation.y = Math.PI; g.add(l);
    }
    const br = mesh(new THREE.BoxGeometry(0.05, 0.02, 0.05), body); br.position.y = 0.04; g.add(br);
  } else if (kind === 'bottle') {
    const b = mesh(lathe([[0, 0], [0.045, 0], [0.05, 0.02], [0.05, 0.17], [0.03, 0.22], [0.016, 0.25], [0.016, 0.3], [0, 0.3]], 20),
      std(0x4f7d5a, 0.1, 0, { transparent: true, opacity: 0.6 }));
    g.add(b);
    const paper = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 10), std(0xf2ede2, 0.9)); paper.position.y = 0.1; g.add(paper);
    g.rotation.z = Math.PI / 2 - 0.15;
  }
  return g;
}

function glintTexture() {
  return canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,250,240,0.7)'); g.addColorStop(1, 'rgba(255,240,220,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    c.globalCompositeOperation = 'lighter';
    const l = c.createLinearGradient(0, 32, 64, 32); l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.5, 'rgba(255,255,255,0.8)'); l.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = l; c.fillRect(0, 31, 64, 2); c.fillRect(31, 0, 2, 64);
  }, false);
}

export function buildPlaces(scene, glowTex, platform) {
  const P = { traces: [], lamps: [], palms: [], found: 0 };
  const wood = woodTex();
  const woodM = std(0xffffff, 0.85, 0, { map: wood });
  const darkWood = std(0x4a3426, 0.85);
  const whiteWood = std(0xe8e3d8, 0.8);

  // ---- Pontile di legno (cammini sopra il mare)
  {
    const p = PONTILE, len = p.from - p.to;
    const g = new THREE.Group();
    const n = Math.floor(len / 0.24);
    const plank = new THREE.BoxGeometry(p.half * 2, 0.05, 0.21);
    const im = new THREE.InstancedMesh(plank, std(0xffffff, 0.85, 0, { map: wood }), n);
    im.castShadow = im.receiveShadow = true;
    const dmy = new THREE.Object3D();
    const tones = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const d = p.from - i * 0.24 - 0.12;
      let y = p.deck;
      if (d > 8) { const tH = heightAt(p.x, p.z0 + p.from); y = tH + (p.deck - tH) * (p.from - d) / (p.from - 8); }
      dmy.position.set(0, y - 0.025, d);
      dmy.rotation.set(0, (rnd() - 0.5) * 0.015, (rnd() - 0.5) * 0.01);
      dmy.updateMatrix(); im.setMatrixAt(i, dmy.matrix);
      const t = 0.82 + rnd() * 0.25; im.setColorAt(i, tones.setRGB(t, t * 0.96, t * 0.9));
    }
    g.add(im);
    for (let d = 8; d >= p.to; d -= 3) {
      for (const s of [-1, 1]) {
        const post = mesh(new THREE.CylinderGeometry(0.11, 0.13, 7, 10), darkWood);
        post.position.set(s * (p.half - 0.1), p.deck - 3.6, d); g.add(post);
      }
      const beam = boxM(p.half * 2 + 0.2, 0.12, 0.14, darkWood); beam.position.set(0, p.deck - 0.13, d); g.add(beam);
    }
    for (const s of [-1, 1]) { // corrimano basso solo nell'ultimo tratto
      const r = boxM(0.06, 0.06, 30, darkWood); r.position.set(s * (p.half - 0.05), p.deck + 0.85, p.to + 15); g.add(r);
      for (let d = p.to + 0.3; d < p.to + 30; d += 3) { const st = boxM(0.07, 0.85, 0.07, darkWood); st.position.set(s * (p.half - 0.05), p.deck + 0.42, d); g.add(st); }
    }
    g.position.set(p.x, 0, p.z0);
    scene.add(g);
  }

  // ---- Scogliera di massi
  {
    const S = SCOGLIERA;
    const geo = new THREE.IcosahedronGeometry(1, 3);
    const pp = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pp.count; i++) {
      v.fromBufferAttribute(pp, i);
      v.multiplyScalar(1 + 0.16 * vnoise(v.x * 1.4 + 1, v.y * 1.4 + v.z) + 0.06 * vnoise(v.x * 4 + 7, v.z * 4));
      pp.setXYZ(i, v.x, v.y * 0.72, v.z);
    }
    smoothNormals(geo);
    const count = 140;
    const im = new THREE.InstancedMesh(geo, std(0xffffff, 0.75), count);
    im.castShadow = im.receiveShadow = true;
    const dmy = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const d = S.from - rnd() * (S.from - S.to);
      const lx = (rnd() - 0.5) * 2 * S.half * 0.9;
      const top = rockTop(lx, d);
      const s = 0.8 + rnd() * 1.1;
      dmy.position.set(S.x + lx, top - s * 0.5, S.z0 + d);
      dmy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      dmy.scale.set(s * (0.8 + rnd() * 0.5), s, s * (0.8 + rnd() * 0.5));
      dmy.updateMatrix(); im.setMatrixAt(i, dmy.matrix);
      const t = 0.55 + rnd() * 0.25; im.setColorAt(i, c.setRGB(t * 1.02, t, t * 0.94));
    }
    scene.add(im);
  }

  // ---- Il chiosco chiuso sotto la pergola (foto 3): le travi disegnano strisce d'ombra
  {
    const g = new THREE.Group();
    const y0 = heightAt(PERGOLA.x, PERGOLA.z);
    const W = 8, D = 6, H = 3.1;
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2], [0, -D / 2], [0, D / 2]]) {
      const p = boxM(0.2, H + 0.4, 0.2, darkWood); p.position.set(x, H / 2 - 0.2, z); g.add(p);
    }
    for (const z of [-D / 2, D / 2]) { const b = boxM(W + 0.6, 0.22, 0.14, darkWood); b.position.set(0, H, z); g.add(b); }
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 0.5) { const s = boxM(0.07, 0.12, D + 0.6, darkWood); s.position.set(x, H + 0.17, 0); g.add(s); }
    const br = boxM(0.12, 2.0, 0.12, darkWood); br.position.set(-W / 2 + 0.6, H - 0.6, -D / 2); br.rotation.z = -0.75; g.add(br);
    // chiosco con serrande abbassate
    const kiosk = rboxM(3.2, 2.5, 2.2, 0.08, whiteWood); kiosk.position.set(2, 1.25, 1.2); g.add(kiosk);
    const shutter = mesh(new THREE.BoxGeometry(2.6, 1.6, 0.04), std(0xa8afa9, 0.5, 0.4)); shutter.position.set(2, 1.35, 0.08); g.add(shutter);
    for (let i = 0; i < 12; i++) { const l = boxM(2.6, 0.012, 0.05, std(0x8d948f, 0.5, 0.4)); l.position.set(2, 0.6 + i * 0.13, 0.07); g.add(l); }
    // tavolino e panchina
    const table = new THREE.Group();
    const top = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 28), whiteWood); top.position.y = 0.74; table.add(top);
    const leg = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.74, 10), std(0x2a2b2d, 0.5, 0.6)); leg.position.y = 0.37; table.add(leg);
    table.position.set(-2, 0, -0.6); g.add(table);
    const b = bench(g, -2, 0, -1.6, Math.PI, woodM);
    // sedie impilate
    for (let i = 0; i < 4; i++) { const ch = boxM(0.45, 0.04, 0.45, whiteWood); ch.position.set(-3.2, 0.45 + i * 0.08, 1.8); ch.rotation.y = i * 0.05; g.add(ch); }
    g.position.set(PERGOLA.x, y0, PERGOLA.z);
    g.rotation.y = 0.12;
    scene.add(g);
    g.updateMatrixWorld(true);
    const wp = new THREE.Vector3(); b.getWorldPosition(wp);
    BENCHES.push({ x: wp.x, z: wp.z, y: wp.y + 0.45, yaw: 0.12 });
    const kp = new THREE.Vector3(); kiosk.getWorldPosition(kp);
    addCollider(kp.x, kp.z, 1.6, 1.1, y0 + 2.5, 0.12);
    const tp = new THREE.Vector3(); table.getWorldPosition(tp);
    P.bookAt = new THREE.Vector3(tp.x, y0 + 0.77, tp.z);
  }

  // ---- Lo stabilimento chiuso per la stagione: cabine, ombrelloni chiusi, lettini, torretta
  {
    const cols = ['#7fa6b8', '#9db7a2', '#d6a29a', '#7fa6b8', '#c9b98a', '#9db7a2', '#7fa6b8', '#d6a29a'];
    for (let i = 0; i < cols.length; i++) {
      const c = at(84 + i * 2.1, 36);
      const y0 = heightAt(c.x, c.z);
      const g = new THREE.Group();
      const m = std(0xffffff, 0.8, 0, { map: cabinTex(cols[i]) });
      const body = rboxM(1.9, 2.2, 1.8, 0.05, m); body.position.y = 1.1; g.add(body);
      const roof = mesh(new THREE.CylinderGeometry(0.01, 1.4, 0.5, 4, 1), whiteWood); roof.position.y = 2.45; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.95); g.add(roof);
      const door = boxM(0.8, 1.7, 0.03, std(0xd8d2c6, 0.8)); door.position.set(0, 0.9, -0.91); g.add(door);
      g.position.set(c.x, y0 - 0.05, c.z);
      scene.add(g);
      addCollider(c.x, c.z, 0.95, 0.9, y0 + 2.2);
    }
    // ombrelloni chiusi in file
    const poleG = new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8);
    const furl = lathe([[0, 0], [0.13, 0.15], [0.11, 0.9], [0.05, 1.25], [0, 1.32]], 16);
    const poleM = std(0xe6e2da, 0.4, 0.3);
    const furlMs = [std(0x2f5d73, 0.9), std(0xe8e2d4, 0.9), std(0xb5523e, 0.9)];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
      const c = at(82 + k * 4.5, 16 + r * 5.5);
      const y0 = heightAt(c.x, c.z);
      const pole = mesh(poleG, poleM); pole.position.set(c.x, y0 + 1.0, c.z); scene.add(pole);
      const f = mesh(furl, furlMs[(r + k) % 3]); f.position.set(c.x, y0 + 0.95, c.z); scene.add(f);
    }
    // lettini impilati
    for (let s = 0; s < 3; s++) {
      const c = at(122 + s * 2.4, 28);
      const y0 = heightAt(c.x, c.z);
      for (let i = 0; i < 6; i++) {
        const l = rboxM(0.7, 0.06, 1.9, 0.025, std(0xf0ece4, 0.5)); l.position.set(c.x, y0 + 0.25 + i * 0.09, c.z); l.rotation.y = 0.05 * Math.sin(i * 3); scene.add(l);
      }
      addCollider(c.x, c.z, 0.4, 1.0, y0 + 0.8);
    }
    // torretta del bagnino
    const g = new THREE.Group();
    const y0 = heightAt(TORRETTA.x, TORRETTA.z);
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { const l = boxM(0.1, 2.6, 0.1, whiteWood); l.position.set(x * 0.85, 1.3, z * 0.85); l.rotation.set(z * 0.08, 0, -x * 0.08); g.add(l); }
    const seat = boxM(1.2, 0.08, 1.0, whiteWood); seat.position.y = 2.6; g.add(seat);
    const back = boxM(1.2, 0.8, 0.06, whiteWood); back.position.set(0, 3.0, 0.5); g.add(back);
    for (let i = 0; i < 5; i++) { const st = boxM(0.7, 0.05, 0.12, whiteWood); st.position.set(0, 0.45 + i * 0.45, -0.95 + i * 0.07); g.add(st); }
    const ring = mesh(new THREE.TorusGeometry(0.3, 0.07, 10, 24), std(0xd2382c, 0.6)); ring.position.set(0.66, 2.0, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
    g.position.set(TORRETTA.x, y0, TORRETTA.z);
    g.rotation.y = Math.PI;
    scene.add(g);
  }

  // ---- Una barca da pesca tirata in secco
  {
    const g = new THREE.Group();
    const hullGeo = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const hp = hullGeo.attributes.position;
    for (let i = 0; i < hp.count; i++) { const z = hp.getZ(i); hp.setX(i, hp.getX(i) * (1 - 0.85 * Math.abs(z) ** 2.2)); }
    hullGeo.computeVertexNormals();
    const hull = mesh(hullGeo, std(0xe9e5dc, 0.6, 0, { side: THREE.DoubleSide })); hull.scale.set(0.95, 0.7, 2.6); g.add(hull);
    const stripe = mesh(new THREE.TorusGeometry(1, 0.03, 6, 48), std(0x2c5f86, 0.6)); stripe.rotation.x = Math.PI / 2; stripe.scale.set(0.95, 2.6, 1); stripe.position.y = -0.04; g.add(stripe);
    const rim = mesh(new THREE.TorusGeometry(1, 0.04, 6, 48), darkWood); rim.rotation.x = Math.PI / 2; rim.scale.set(0.95, 2.6, 1); g.add(rim);
    for (const z of [-0.8, 0.5]) { const s = boxM(1.7, 0.05, 0.25, woodM); s.position.set(0, -0.15, z); g.add(s); }
    const oar = boxM(0.05, 0.05, 2.6, woodM); oar.position.set(0.3, -0.25, 0); oar.rotation.y = 0.15; g.add(oar);
    const y0 = heightAt(BARCA.x, BARCA.z);
    g.position.set(BARCA.x, y0 + 0.55, BARCA.z);
    g.rotation.set(0, 0.5, 0.16);
    scene.add(g);
    g.updateMatrixWorld(true);
    addCollider(BARCA.x, BARCA.z, 0.9, 2.5, y0 + 0.9, -0.5);
    P.letterAt = new THREE.Vector3(BARCA.x, y0 + 0.42, BARCA.z);
  }

  // ---- Lungomare: muretto basso, passeggiata, lampioni, palme (ripetuti attorno a te)
  {
    const wallM = std(0xd9d1c3, 0.9), paveM = std(0xc7beb0, 0.9);
    const SEG = 24, NS = 13;
    P.walls = [];
    for (let i = 0; i < NS; i++) {
      const g = new THREE.Group();
      const wall = boxM(SEG + 0.1, 1.0, 0.4, wallM); wall.position.set(0, LUNGO.wall - 0.5, 0); g.add(wall);
      const cap = rboxM(SEG + 0.1, 0.09, 0.5, 0.03, std(0xe8e2d6, 0.8)); cap.position.set(0, LUNGO.wall + 0.04, 0); g.add(cap);
      const pave = boxM(SEG + 0.1, 0.4, 9, paveM); pave.position.set(0, LUNGO.wall - 0.2, 4.6); pave.castShadow = false; g.add(pave);
      // lampione
      const lamp = new THREE.Group();
      const post = mesh(lathe([[0, 0], [0.12, 0], [0.12, 0.3], [0.07, 0.5], [0.05, 3.6], [0, 3.6]], 14), std(0x2d3033, 0.45, 0.6)); lamp.add(post);
      const head = mesh(lathe([[0, 0], [0.18, 0.05], [0.12, 0.35], [0, 0.4]], 16), std(0x2d3033, 0.45, 0.6)); head.position.y = 3.6; lamp.add(head);
      const bulbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.28, 0.25) });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), bulbM); bulb.position.y = 3.62; lamp.add(bulb);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc58a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      glow.position.y = 3.6; glow.scale.setScalar(3.2); lamp.add(glow);
      lamp.position.set(0, LUNGO.wall, 0.7); g.add(lamp);
      // palma ogni due segmenti
      if (i % 2 === 0) {
        const palm = new THREE.Group();
        const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 6, 10, 12);
        const tp = trunkG.attributes.position;
        for (let k = 0; k < tp.count; k++) { const y = tp.getY(k) + 3; tp.setX(k, tp.getX(k) + 0.04 * y * y); }
        trunkG.computeVertexNormals();
        const trunk = mesh(trunkG, std(0x8a7a66, 0.95)); trunk.position.y = 3; palm.add(trunk);
        const frondG = new THREE.PlaneGeometry(0.9, 3.2, 1, 8); frondG.translate(0, 1.5, 0);
        const fp = frondG.attributes.position;
        for (let k = 0; k < fp.count; k++) { const y = fp.getY(k); fp.setZ(k, 0.16 * y * y); fp.setX(k, fp.getX(k) * Math.sin(Math.min(1, y / 3.3) * Math.PI) ); }
        frondG.computeVertexNormals();
        const frondM = std(0x5d7448, 0.8, 0, { side: THREE.DoubleSide });
        const crown = new THREE.Group(); crown.position.set(1.44, 6, 0); palm.add(crown);
        palm.userData.crown = crown;
        for (let k = 0; k < 14; k++) {
          const f = mesh(frondG, frondM);
          f.rotation.set(0, (k / 14) * Math.PI * 2 + k * 0.3, 0); f.rotateX(0.55 + (k % 3) * 0.25);
          crown.add(f);
        }
        palm.position.set(SEG / 2, LUNGO.wall, 6.5); g.add(palm); g.userData.palm = palm;
      }
      scene.add(g);
      P.walls.push({ g, glow, bulbM, i });
    }
    P.lampLights = [new THREE.PointLight(0xffb878, 0, 22, 1.5), new THREE.PointLight(0xffb878, 0, 22, 1.5)];
    for (const l of P.lampLights) scene.add(l);
    P.SEG = SEG; P.NS = NS;
  }

  // ---- Il belvedere sulle colline: un muretto a secco, una panchina, un vecchio cipresso
  {
    const B = BELVEDERE;
    const y0 = heightAt(B.x, B.z);
    const g = new THREE.Group();
    const stone = std(0xb9ad98, 0.95);
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const sp = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < sp.count; i++) { v.fromBufferAttribute(sp, i); v.multiplyScalar(1 + 0.15 * vnoise(v.x * 2, v.y * 2 + v.z)); sp.setXYZ(i, v.x, v.y * 0.6, v.z); }
    smoothNormals(geo);
    for (let k = 0; k < 46; k++) {
      const a = -Math.PI * 0.85 + (k / 45) * Math.PI * 0.7;
      const r = 4.2;
      const x = Math.sin(a) * r, z = -Math.cos(a) * r * 0.6 - 1.5;
      const row = k % 2;
      const st = mesh(geo, stone);
      st.scale.set(0.32 + rnd() * 0.12, 0.22, 0.26);
      st.position.set(x + (rnd() - 0.5) * 0.1, heightAt(B.x + x, B.z + z) - y0 + 0.2 + row * 0.3, z);
      st.rotation.y = rnd() * 3; g.add(st);
      const st2 = mesh(geo, stone); st2.scale.copy(st.scale).multiplyScalar(0.9);
      st2.position.copy(st.position).add(new THREE.Vector3(0.15, 0.3 - row * 0.6 + 0.3, 0)); g.add(st2);
    }
    const b = bench(g, 0, 0, 0.6, 0, woodM);
    const cyp = mesh(new THREE.IcosahedronGeometry(1, 3), std(0x2f4229, 0.9)); cyp.scale.set(0.9, 5.5, 0.9); cyp.position.set(3.2, 5.2, 2.5); g.add(cyp);
    const ctr = mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 8), std(0x4a3a2c, 0.95)); ctr.position.set(3.2, 0.3, 2.5); g.add(ctr);
    g.position.set(B.x, y0, B.z);
    scene.add(g);
    g.updateMatrixWorld(true);
    const wp = new THREE.Vector3(); b.getWorldPosition(wp);
    BENCHES.push({ x: wp.x, z: wp.z, y: wp.y + 0.45, yaw: 0 });
    const spot = new THREE.Vector3(B.x - 1.2, 0, B.z - 2.2); spot.y = heightAt(spot.x, spot.z) + 0.55;
    P.belvedereSpot = spot;
    // un sasso piatto su cui è appoggiato il binocolo
    const rest = mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.5, 14), stone); rest.position.set(spot.x, spot.y - 0.27, spot.z); scene.add(rest);
  }

  // ---- Le tracce: oggetti reali, un riflesso di luce li tradisce da lontano
  {
    const glint = glintTexture();
    const spawn = at(6, 18);
    const pontileEnd = new THREE.Vector3(PONTILE.x + 0.5, PONTILE.deck + 0.02, PONTILE.z0 + PONTILE.to + 1.2);
    const rockEnd = { x: SCOGLIERA.x + 0.4, z: SCOGLIERA.z0 + SCOGLIERA.to + 7 };
    const tor = at(TORRETTA.x - 1.2, 7.2);
    const list = [
      ['jar', new THREE.Vector3(spawn.x, heightAt(spawn.x, spawn.z) + 0.01, spawn.z)],
      ['book', P.bookAt],
      ['sandals', pontileEnd],
      ['watch', (() => { const x = PONTILE.x + 7, z = PONTILE.z0 - 122; return new THREE.Vector3(x, heightAt(x, z) + 0.03, z); })()],
      ['hat', new THREE.Vector3(tor.x, heightAt(tor.x, tor.z) + 0.01, tor.z)],
      ['letter', P.letterAt],
      ['lantern', new THREE.Vector3(rockEnd.x, rockTop(0.4, SCOGLIERA.to + 7) + 0.0, rockEnd.z)],
      ['bottle', new THREE.Vector3(platform.x + 26, 0.02, platform.z + 34)],
      ['binoculars', P.belvedereSpot],
    ];
    list.forEach(([kind, pos], i) => {
      const g = traceModel(kind);
      g.position.copy(pos);
      g.rotation.y += rnd() * 6;
      scene.add(g);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glint, color: 0xfff4e6, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, sizeAttenuation: false }));
      sp.scale.setScalar(0.035);
      sp.position.copy(pos).add(new THREE.Vector3(0, 0.12, 0));
      scene.add(sp);
      let flame = null;
      if (g.userData.flame) {
        flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa860, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
        flame.position.copy(pos).add(g.userData.flame); flame.scale.setScalar(0.5);
        scene.add(flame);
      }
      P.traces.push({ i, kind, g, sp, flame, pos: pos.clone(), base: pos.y, found: false, ph: rnd() * 10, hour: FRAGMENTS[i].hour });
    });
    P.traceLight = new THREE.PointLight(0xffa860, 0, 8, 1.6);
    scene.add(P.traceLight);
  }

  return P;
}

const tmp = new THREE.Vector3();

export function updatePlaces(P, dt, time, ctx) {
  const on = ctx.night > 0.1 ? Math.min(1, (ctx.night - 0.1) * 2.2) : 0;

  // lungomare che ti segue lungo la costa
  {
    const base = Math.round(ctx.player.x / P.SEG);
    const lamps = [];
    for (const w of P.walls) {
      const k = base + w.i - Math.floor(P.NS / 2);
      const x = k * P.SEG;
      const z = shoreZ(x) + LUNGO.d;
      w.g.position.set(x, heightAt(x, z), z);
      w.g.rotation.y = -Math.atan2(shoreZ(x + 1) - shoreZ(x - 1), 2);
      w.glow.material.opacity = on;
      const pc = w.g.userData.palm?.userData.crown;
      if (pc) { const ws = ctx.wind || 0.4; pc.rotation.set(Math.sin(time * 1.1 + w.i) * 0.05 * ws, 0, 0.08 * ws + Math.sin(time * 1.7 + w.i * 2) * 0.06 * ws); }
      w.bulbM.color.setRGB(0.3 + on * 4, 0.28 + on * 3, 0.25 + on * 1.8);
      lamps.push({ x, z, y: w.g.position.y + LUNGO.wall + 3.5, d: Math.abs(x - ctx.player.x) + Math.abs(z - ctx.player.z) });
    }
    lamps.sort((a, b) => a.d - b.d);
    P.lampLights.forEach((l, j) => { const L = lamps[j]; l.position.set(L.x, L.y, L.z + 0.7); l.intensity = on * 18; });
  }

  // tracce
  let near = null, nd = 1e9;
  for (const t of P.traces) {
    if (t.kind === 'bottle') { t.g.position.y = t.base + Math.sin(time * 0.9) * 0.05; t.g.rotation.x = Math.sin(time * 0.7) * 0.15; t.sp.position.y = t.g.position.y + 0.08; }
    const d = tmp.copy(t.pos).sub(ctx.eye).length();
    if (!t.found) {
      // un riflesso intermittente, come il sole su un vetro, ma solo alla sua ora
      const tw = Math.pow(Math.max(0, Math.sin(time * 1.3 + t.ph) * Math.sin(time * 0.37 + t.ph * 2)), 3);
      let dh = t.hour === null ? 0 : Math.abs(ctx.tod - t.hour); dh = Math.min(dh, 1 - dh);
      const inHour = t.hour === null ? 1 : 1 - THREE.MathUtils.smoothstep(dh, 0.035, 0.06);
      const vis = Math.min(1, d / 6) * Math.max(inHour, 1 - THREE.MathUtils.smoothstep(d, 8, 14));
      const lightK = t.kind === 'watch' ? (ctx.underwater ? 1 : 0.6) : (1 - ctx.night * 0.5);
      t.sp.material.opacity = (0.25 + 0.75 * tw) * vis * lightK;
      t.sp.scale.setScalar(0.022 + 0.03 * tw);
      if (d < nd) { nd = d; near = t; }
      if (d < 2.7) { t.found = true; t.sp.material.opacity = 0; P.found++; ctx.onFind(t); }
    }
    if (t.flame) {
      const fl = 0.85 + 0.15 * Math.sin(time * 17 + t.ph) * Math.sin(time * 9.1);
      t.flame.material.opacity = on * fl;
      t.flame.scale.setScalar(0.45 * fl);
    }
  }
  // una sola luce calda: la candela o la lanterna più vicina, di notte
  let lit = null, ld = 1e9;
  for (const t of P.traces) if (t.flame) { const d = tmp.copy(t.pos).sub(ctx.player).length(); if (d < ld) { ld = d; lit = t; } }
  if (lit) { P.traceLight.position.copy(lit.flame.position); P.traceLight.intensity = on * 3 * (0.9 + 0.1 * Math.sin(time * 13)); }
  return { on, near: nd };
}

export function nearBench(x, z) {
  for (const b of BENCHES) if (Math.hypot(b.x - x, b.z - z) < 1.8) return b;
  return null;
}
