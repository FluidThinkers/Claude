import * as THREE from 'three';
import { heightAt, shoreZ, vnoise, smoothNormals } from './terrain.js';
import { hullGeometry, deckGeometry, roundedBox as rbox, shadowAll } from './models.js';

// Esplorazione libera: il vecchio molo industriale, la piattaforma, il relitto,
// delfini, una tartaruga, stelle cadenti. Le scoperte si collegano tra loro.

function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const R = (() => { let s = 777; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();

const rustTex = () => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#4a3a30'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = R() * w, y = R() * h, r = 2 + Math.pow(R(), 2) * 22;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const tone = R();
    const col = tone < 0.4 ? '160,82,40' : tone < 0.7 ? '120,60,32' : tone < 0.9 ? '90,70,60' : '190,120,70';
    g.addColorStop(0, `rgba(${col},${0.25 + R() * 0.4})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(60,40,30,${0.2 + R() * 0.3})`; c.fillRect(R() * w, 0, 1 + R() * 2, h * R()); }
});
const concreteTex = () => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#9d9a92'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { const g = 120 + R() * 80 | 0; c.fillStyle = `rgba(${g},${g},${g - 6},${0.12 + R() * 0.2})`; c.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); }
  for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(110,80,55,${0.08 + R() * 0.15})`; const x = R() * w; c.fillRect(x, R() * h * 0.5, 3 + R() * 10, h); }
  c.strokeStyle = 'rgba(50,50,48,0.5)'; c.lineWidth = 1;
  for (let i = 0; i < 8; i++) { c.beginPath(); let x = R() * w, y = R() * h; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 40; y += (R() - 0.3) * 30; c.lineTo(x, y); } c.stroke(); }
});
const brickTex = () => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#b9a58c'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) for (let x = ((y / 16) % 2) * 16; x < w; x += 32) {
    const t = 150 + R() * 50 | 0; c.fillStyle = `rgb(${t + 30},${t},${t - 30})`; c.fillRect(x + 1, y + 1, 30, 14);
  }
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(80,70,60,${R() * 0.25})`; c.fillRect(R() * w, R() * h, 20 + R() * 60, 4 + R() * 30); }
});

const std = (o) => new THREE.MeshStandardMaterial(o);
const mesh = (g, m) => { const x = new THREE.Mesh(g, m); x.castShadow = x.receiveShadow = true; return x; };

export const MOLO = { x: 300, z0: shoreZ(300), deck: 4.6, half: 3.6, seg: 12, from: 10, n: 23, gaps: [9, 16] };

export function buildExplore(scene, platform, glowTex) {
  const E = { rects: [], blocks: [], ladders: [], discover: [], dolphins: [], meteors: [] };
  const rust = std({ map: rustTex(), roughness: 0.85, metalness: 0.4 });
  const rustDark = std({ map: rustTex(), color: 0x8a7a70, roughness: 0.9, metalness: 0.3 });
  const conc = concreteTex(); conc.repeat.set(1, 2);
  const concM = std({ map: conc, roughness: 0.95 });

  // ---- Il vecchio molo industriale
  {
    const M = MOLO, g = new THREE.Group();
    const H = 0.6;
    for (let i = 0; i < M.n; i++) {
      const d0 = M.from - i * M.seg, dc = d0 - M.seg / 2;
      const gap = M.gaps.includes(i);
      // piloni e controventi in acciaio arrugginito
      for (const sx of [-1, 1]) {
        const p = mesh(new THREE.CylinderGeometry(0.28, 0.32, 14, 10), rust); p.position.set(sx * (M.half - 0.6), M.deck - 7.4, d0); g.add(p);
      }
      const cross = mesh(new THREE.BoxGeometry(M.half * 2 - 1, 0.35, 0.35), rust); cross.position.set(0, M.deck - 1.2, d0); g.add(cross);
      if (i % 2 === 0) for (const s of [-1, 1]) { const br = mesh(new THREE.BoxGeometry(0.22, 7.5, 0.22), rustDark); br.position.set(0, M.deck - 4.5, d0 - 0.2 * s); br.rotation.z = s * 0.72; g.add(br); }
      if (gap) {
        // campata crollata: la soletta è caduta in acqua, inclinata
        const slab = mesh(new THREE.BoxGeometry(M.half * 2, H, M.seg - 0.4), concM);
        slab.position.set(0.6, -0.6, dc); slab.rotation.set(0.32, 0.06, 0.12); g.add(slab);
        E.ladders.push({ x: M.x + M.half - 0.3, z: M.z0 + d0 - 0.5, top: M.deck, name: 'risali la scaletta' });
        E.ladders.push({ x: M.x - M.half + 0.3, z: M.z0 + d0 - M.seg + 0.5, top: M.deck, name: 'risali la scaletta' });
        for (const zz of [d0 - 0.3, d0 - M.seg + 0.3]) {
          const lad = new THREE.Group();
          for (const sx of [-0.22, 0.22]) { const r2 = mesh(new THREE.CylinderGeometry(0.025, 0.025, 6, 6), rustDark); r2.position.set(sx, M.deck - 3, 0); lad.add(r2); }
          for (let k = 0; k < 14; k++) { const st = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 6), rustDark); st.rotation.z = Math.PI / 2; st.position.set(0, M.deck - 5.8 + k * 0.42, 0); lad.add(st); }
          lad.position.set(zz === d0 - 0.3 ? M.half - 0.3 : -M.half + 0.3, 0, zz); g.add(lad);
        }
        continue;
      }
      const slab = mesh(new THREE.BoxGeometry(M.half * 2, H, M.seg), concM); slab.position.set(0, M.deck - H / 2, dc); g.add(slab);
      E.rects.push({ x: M.x, z: M.z0 + dc, hx: M.half, hz: M.seg / 2, y: M.deck, rot: 0 });
      // binari, bitte
      for (const sx of [-1.1, 1.1]) { const r1 = mesh(new THREE.BoxGeometry(0.08, 0.1, M.seg), rustDark); r1.position.set(sx, M.deck + 0.05, dc); g.add(r1); }
      if (i % 3 === 1) for (const sx of [-1, 1]) { const b = mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 14), rust); b.position.set(sx * (M.half - 0.35), M.deck + 0.25, dc); g.add(b); }
    }
    // rampa da terra
    {
      const d0 = M.from, d1 = 30;
      const h1 = heightAt(M.x, M.z0 + d1);
      const len = d1 - d0, ang = Math.atan2(M.deck - h1, len);
      const ramp = mesh(new THREE.BoxGeometry(M.half * 2, H, Math.hypot(len, M.deck - h1)), concM);
      ramp.position.set(0, (M.deck + h1) / 2 - H / 2, (d0 + d1) / 2); ramp.rotation.x = ang; g.add(ramp);
      E.ramp = { x: M.x, z0: M.z0 + d0, z1: M.z0 + d1, y0: M.deck, y1: h1, hx: M.half };
    }
    // nastro trasportatore in parte crollato
    {
      const belt = new THREE.Group();
      for (let i = 0; i < 16; i++) {
        const d = M.from - 6 - i * 12;
        if (i === 7 || i === 8) continue;
        const truss = mesh(new THREE.BoxGeometry(1.4, 1.2, 11.5), rust); truss.material = rust; truss.position.set(-M.half + 0.8, M.deck + 4.5, d - 6);
        if (i === 6) { truss.rotation.x = -0.35; truss.position.y -= 1.8; }
        belt.add(truss);
        const leg = mesh(new THREE.BoxGeometry(0.25, 4, 0.25), rustDark); leg.position.set(-M.half + 0.8, M.deck + 2, d - 0.2); belt.add(leg);
      }
      g.add(belt);
    }
    // gru a portale in testa al molo
    {
      const dEnd = M.from - M.n * M.seg + 8;
      const cr = new THREE.Group();
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = mesh(new THREE.BoxGeometry(0.5, 13, 0.5), rust); l.position.set(sx * 2.8, M.deck + 6.5, sz * 2.4); l.rotation.z = -sx * 0.06; cr.add(l); }
      const top = mesh(new THREE.BoxGeometry(7, 1.0, 6), rust); top.position.y = M.deck + 13.2; cr.add(top);
      const cab = mesh(rbox(3.2, 2.4, 3.2, 0.2), std({ color: 0x6f7f84, roughness: 0.8, metalness: 0.3 })); cab.position.set(0, M.deck + 14.9, 0); cr.add(cab);
      const boom = mesh(new THREE.BoxGeometry(1.0, 1.0, 30), rust); boom.position.set(0, M.deck + 15.5, -13); boom.rotation.x = 0.28; cr.add(boom);
      const cable = mesh(new THREE.CylinderGeometry(0.03, 0.03, 12, 5), rustDark); cable.position.set(0, M.deck + 13.6, -24); cr.add(cable);
      const hook = mesh(new THREE.TorusGeometry(0.35, 0.08, 8, 16, 4.5), rustDark); hook.position.set(0, M.deck + 7.4, -24); cr.add(hook);
      cr.position.set(0, 0, dEnd); g.add(cr);
      E.rects.push({ x: M.x, z: M.z0 + dEnd, hx: 3.2, hz: 2.8, y: M.deck + 13.7, rot: 0, top: true });
      E.ladders.push({ x: M.x + 3.3, z: M.z0 + dEnd, top: M.deck + 13.7, name: 'sali sulla gru', fromDeck: true });
      E.craneTop = { x: M.x, z: M.z0 + dEnd, y: M.deck + 13.7 };
    }
    g.position.set(M.x, 0, M.z0);
    shadowAll(g); scene.add(g);
  }

  // ---- Il capannone: mattoni, tetto sfondato, la luce entra a fasce
  {
    const g = new THREE.Group();
    const x = MOLO.x, z = MOLO.z0 + 46, y0 = heightAt(x, z) - 0.2;
    const bt = brickTex(); bt.repeat.set(4, 1.2);
    const wallM = std({ map: bt, roughness: 0.95 });
    const W = 26, D = 14, Hh = 7;
    const wall = (w, h, px, pz, ry) => { const m = mesh(new THREE.BoxGeometry(w, h, 0.4), wallM); m.position.set(px, h / 2, pz); m.rotation.y = ry; g.add(m); return m; };
    wall(W, Hh, 0, D / 2, 0);
    wall(9, Hh, -W / 2 + 4.5, -D / 2, 0); wall(9, Hh, W / 2 - 4.5, -D / 2, 0); // apertura verso il mare
    wall(D, Hh, -W / 2, 0, Math.PI / 2); wall(D, Hh, W / 2, 0, Math.PI / 2);
    for (let k = 0; k < 7; k++) { // capriate e travi del tetto, poche lamiere rimaste
      const tr = mesh(new THREE.BoxGeometry(0.25, 0.25, D), rust); tr.position.set(-W / 2 + 2 + k * 3.7, Hh + 0.2, 0); g.add(tr);
      if (k % 3 !== 1) { const sh = mesh(new THREE.BoxGeometry(3.6, 0.05, D * (0.4 + R() * 0.5)), rustDark); sh.position.set(-W / 2 + 2 + k * 3.7 + 1.8, Hh + 0.35, (R() - 0.5) * 3); sh.rotation.z = (R() - 0.5) * 0.1; g.add(sh); }
    }
    const desk = mesh(rbox(1.8, 0.85, 0.9, 0.05), std({ color: 0x6b5a48, roughness: 0.8 })); desk.position.set(-8, 0.42, 3.5); g.add(desk);
    for (let k = 0; k < 6; k++) { const crate = mesh(rbox(1.2, 1.0, 1.2, 0.04), std({ color: 0x8c7356, roughness: 0.9 })); crate.position.set(5 + (k % 3) * 1.3, 0.5 + Math.floor(k / 3) * 1.0, 3.5); crate.rotation.y = R() * 0.3; g.add(crate); }
    g.position.set(x, y0, z);
    shadowAll(g); scene.add(g);
    const book = new THREE.Group();
    const cover = mesh(new THREE.BoxGeometry(0.34, 0.05, 0.24), std({ color: 0x3c3a52, roughness: 0.8 })); book.add(cover);
    const pages = mesh(new THREE.BoxGeometry(0.32, 0.04, 0.22), std({ color: 0xe8e0cc, roughness: 0.9 })); pages.position.y = 0.035; book.add(pages);
    book.position.set(x - 8, y0 + 0.88, z + 3.5); scene.add(book);
    E.discover.push({ id: 'registro', pos: book.position.clone(), r: 2.6 });
    E.blocks.push({ x: x - 8, z: z + 3.5, hx: 0.9, hz: 0.45, top: y0 + 0.85 });
    // collisione con i muri
    E.blocks.push({ x, z: z + D / 2, hx: W / 2, hz: 0.3, top: y0 + Hh });
    E.blocks.push({ x: x - W / 2, z, hx: 0.3, hz: D / 2, top: y0 + Hh }); E.blocks.push({ x: x + W / 2, z, hx: 0.3, hz: D / 2, top: y0 + Hh });
    E.blocks.push({ x: x - W / 2 + 4.5, z: z - D / 2, hx: 4.5, hz: 0.3, top: y0 + Hh }); E.blocks.push({ x: x + W / 2 - 4.5, z: z - D / 2, hx: 4.5, hz: 0.3, top: y0 + Hh });
    E.shed = { x, z };
  }

  // ---- La piattaforma diventa esplorabile: ponti calpestabili, scalette, una radio
  {
    const P = platform, rot = 0.15, c = Math.cos(rot), s = Math.sin(rot);
    const w = (lx, lz) => ({ x: P.x + lx * c + lz * s, z: P.z - lx * s + lz * c });
    const d1 = w(0, 0), d2 = w(-1, 0);
    E.rects.push({ x: d1.x, z: d1.z, hx: 10.5, hz: 6.5, y: 7.4, rot });
    E.rects.push({ x: d2.x, z: d2.z, hx: 7, hz: 4.5, y: 11.25, rot });
    const l1 = w(8.6, 6.8); E.ladders.push({ x: l1.x, z: l1.z, top: 7.4, name: 'sali la scaletta' });
    const l2 = w(5.6, 3.6); E.ladders.push({ x: l2.x, z: l2.z, top: 11.25, name: 'sali al ponte di sopra', fromDeck: true });
    const b1 = w(3, -1); E.blocks.push({ x: b1.x, z: b1.z, hx: 2.5, hz: 2, top: 10.4, rot });
    const b2 = w(-6, 0); E.blocks.push({ x: b2.x, z: b2.z, hx: 3, hz: 3.6, top: 10.5, rot });
    const b3 = w(-1, 0); E.blocks.push({ x: b3.x, z: b3.z, hx: 1.5, hz: 1.5, top: 13.5, rot });
    // scaletta dal mare
    const lad = new THREE.Group();
    for (const sx of [-0.22, 0.22]) { const r2 = mesh(new THREE.CylinderGeometry(0.025, 0.025, 9, 6), rustDark); r2.position.set(sx, 3, 0); lad.add(r2); }
    for (let k = 0; k < 20; k++) { const st = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 6), rustDark); st.rotation.z = Math.PI / 2; st.position.set(0, -1.2 + k * 0.42, 0); lad.add(st); }
    lad.position.set(l1.x, 0, l1.z); lad.rotation.y = rot; scene.add(lad);
    // la radio, ancora accesa
    const rp = w(3.2, 2.6);
    const radio = new THREE.Group();
    const box = mesh(rbox(0.5, 0.32, 0.3, 0.03), std({ color: 0x55605a, roughness: 0.6, metalness: 0.3 })); radio.add(box);
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 0.6) })); dial.position.set(0, 0.04, 0.151); radio.add(dial);
    const ant = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.7, 4), std({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.3 })); ant.position.set(0.2, 0.5, 0); ant.rotation.z = 0.3; radio.add(ant);
    const crate = mesh(rbox(0.7, 0.6, 0.6, 0.03), std({ color: 0x7c6a52, roughness: 0.9 })); crate.position.y = -0.46; radio.add(crate);
    radio.position.set(rp.x, 11.25 + 0.76, rp.z); radio.rotation.y = rot + 2.5; scene.add(radio);
    E.radio = { g: radio, dial };
    E.discover.push({ id: 'radio', pos: radio.position.clone(), r: 2.8 });
  }

  // ---- Il relitto: una barca da pesca coricata sul fondo davanti al molo
  {
    const x = MOLO.x + 30, z = shoreZ(MOLO.x + 30) - 150;
    const y = heightAt(x, z);
    const g = new THREE.Group();
    const hg = hullGeometry({ len: 11, beam: 3.6, depth: 1.9, sheer: 0.45, bowFine: 1.6, transom: 0.7, deadrise: 0.3, waterline: -0.3, topColor: 0x5c6f63, bottomColor: 0x3b4436, stripeY: 0.4, stripeColor: 0x7b3a2a });
    const hull = new THREE.Mesh(hg, std({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })); g.add(hull);
    const wh = mesh(rbox(2.2, 1.6, 2.0, 0.1), std({ color: 0x6e7a6a, roughness: 0.95 })); wh.position.set(1.5, 1.6, 0); wh.rotation.z = 0.15; g.add(wh);
    const mast = mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 8), std({ color: 0x5a5245, roughness: 0.95 })); mast.position.set(-1.5, 2.5, 0); mast.rotation.z = 0.5; g.add(mast);
    g.position.set(x, y + 0.6, z); g.rotation.set(0.05, 0.6, 1.0);
    shadowAll(g); scene.add(g);
    E.discover.push({ id: 'relitto', pos: new THREE.Vector3(x, y + 1, z), r: 7, under: true });
    E.wreck = { x, z };
  }

  // ---- Delfini al largo: saltano a gruppi, ogni tanto
  {
    const body = new THREE.CapsuleGeometry(0.35, 1.7, 8, 16); body.rotateX(Math.PI / 2);
    const bp = body.attributes.position;
    for (let i = 0; i < bp.count; i++) { const zz = bp.getZ(i); const k = 1 - Math.max(0, zz / 1.2) * 0.55; bp.setX(i, bp.getX(i) * k); bp.setY(i, bp.getY(i) * k * (bp.getY(i) > 0 ? 1.05 : 0.9)); }
    body.computeVertexNormals();
    const m = std({ color: 0x5b6670, roughness: 0.35, metalness: 0.05 });
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Group();
      g.add(mesh(body, m));
      const fin = mesh(new THREE.ConeGeometry(0.16, 0.45, 6), m); fin.position.set(0, 0.36, 0.1); fin.rotation.x = 0.5; fin.scale.z = 0.3; g.add(fin);
      const tail = mesh(new THREE.BoxGeometry(0.8, 0.04, 0.25), m); tail.position.set(0, 0, 1.15); g.add(tail);
      const beak = mesh(new THREE.CapsuleGeometry(0.07, 0.25, 4, 8), m); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.08, -1.22); g.add(beak);
      g.visible = false; scene.add(g);
      E.dolphins.push({ g, k, off: R() * 6 });
    }
    E.pod = { x: 0, z: 0, t: -1, dir: 1, next: 20 };
  }

  // ---- Una tartaruga marina che nuota piano
  {
    const g = new THREE.Group();
    const shellTex = canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#5a4a32'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#2e2618'; c.lineWidth = 3;
      for (let i = 0; i < 9; i++) { c.beginPath(); const x = 20 + (i % 3) * 44, y = 20 + Math.floor(i / 3) * 44; c.moveTo(x, y - 18); for (let a = 1; a <= 6; a++) c.lineTo(x + Math.sin(a * 1.047) * 20, y - Math.cos(a * 1.047) * 20); c.stroke(); }
    });
    const shell = new THREE.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); shell.scale(1, 0.45, 1.25);
    g.add(mesh(shell, std({ map: shellTex, roughness: 0.6 })));
    const skin = std({ color: 0x6c6a4c, roughness: 0.8 });
    const head = mesh(new THREE.SphereGeometry(0.14, 12, 10), skin); head.scale.set(1, 0.8, 1.3); head.position.set(0, 0.02, -0.68); g.add(head);
    const flip = [];
    for (const [sx, sz, l] of [[-1, -0.25, 0.55], [1, -0.25, 0.55], [-1, 0.4, 0.3], [1, 0.4, 0.3]]) {
      const f = new THREE.Group(); const fm = mesh(new THREE.BoxGeometry(l, 0.04, 0.2), skin); fm.position.x = sx * l / 2; f.add(fm);
      f.position.set(sx * 0.38, 0, sz); g.add(f); flip.push({ f, sx, big: l > 0.4 });
    }
    g.visible = false; scene.add(g);
    E.turtle = { g, flip, t: 0, pos: new THREE.Vector3(), dir: 0, active: false };
  }

  // ---- Al largo: una zattera ancorata (si sale con la scaletta) e una boa di segnalazione
  {
    const x = -10, z = shoreZ(-10) - 230;
    const g = new THREE.Group();
    const wood = std({ color: 0x8a6c4c, roughness: 0.9 });
    for (let i = 0; i < 9; i++) { const pl = mesh(rbox(0.38, 0.08, 4, 0.03), wood); pl.position.set(-1.6 + i * 0.4, 0.5, 0); g.add(pl); }
    for (const sx of [-1.4, 1.4]) for (const sz of [-1.5, 1.5]) { const dr = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.9, 16), std({ color: 0x2e4a66, roughness: 0.5 })); dr.rotation.z = Math.PI / 2; dr.position.set(sx * 0.6, 0.05, sz); g.add(dr); }
    const lad = new THREE.Group();
    for (const sx of [-0.2, 0.2]) { const r2 = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), std({ color: 0xcfd2d4, metalness: 0.9, roughness: 0.25 })); r2.position.set(sx, 0.1, 0); lad.add(r2); }
    for (let k = 0; k < 3; k++) { const st = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 6), std({ color: 0xcfd2d4, metalness: 0.9, roughness: 0.25 })); st.rotation.z = Math.PI / 2; st.position.y = -0.4 + k * 0.4; lad.add(st); }
    lad.position.set(1.85, 0, 0); g.add(lad);
    g.position.set(x, 0, z); scene.add(g);
    E.raft = { g, x, z };
    E.rects.push({ x, z, hx: 1.8, hz: 2.0, y: 0.55, rot: 0 });
    E.ladders.push({ x: x + 2.1, z, top: 0.55, name: 'sali sulla zattera' });
    // boa cardinale gialla e nera, con la luce in cima
    const by = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.4, 20), std({ color: 0xd9b52a, roughness: 0.5 })); body.position.y = 0.4; by.add(body);
    const band = mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.5, 20), std({ color: 0x1b1b1b, roughness: 0.5 })); band.position.y = 0.6; by.add(band);
    const mast = mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 8), std({ color: 0xd9b52a, roughness: 0.5 })); mast.position.y = 2.5; by.add(mast);
    for (const k of [0, 1]) { const cone = mesh(new THREE.ConeGeometry(0.35, 0.45, 12), std({ color: 0x1b1b1b, roughness: 0.5 })); cone.position.y = 3.6 + k * 0.5; by.add(cone); }
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0c0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    lamp.position.y = 4.5; lamp.scale.setScalar(4); by.add(lamp);
    by.position.set(160, 0, shoreZ(160) - 560); scene.add(by);
    E.buoy = { g: by, lamp };
  }

  // ---- Meduse: campane traslucide che pulsano a mezz'acqua
  {
    const bell = new THREE.SphereGeometry(0.22, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const m = new THREE.MeshStandardMaterial({ color: 0xd8a8d8, roughness: 0.2, transparent: true, opacity: 0.45, emissive: 0x6a3a6a, emissiveIntensity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    const im = new THREE.InstancedMesh(bell, m, 24); im.frustumCulled = false; im.count = 0;
    const tent = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.01, 0.003, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0xe8c0e0, transparent: true, opacity: 0.35, depthWrite: false }), 24 * 6);
    tent.frustumCulled = false; tent.count = 0;
    scene.add(im, tent);
    E.jelly = { im, tent, list: [] };
  }

  // ---- Stelle cadenti
  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false }));
    line.frustumCulled = false; scene.add(line);
    E.meteor = { line, t: -1, next: 25, a: new THREE.Vector3(), b: new THREE.Vector3() };
  }
  return E;
}

// superfici calpestabili: molo, rampa, gru, ponti della piattaforma
export function exploreHeight(E, x, z, feet) {
  let best = -Infinity;
  for (const r of E.rects) {
    let lx = x - r.x, lz = z - r.z;
    if (r.rot) { const c = Math.cos(r.rot), s = Math.sin(r.rot); const a = lx * c - lz * s; lz = lx * s + lz * c; lx = a; }
    if (Math.abs(lx) < r.hx && Math.abs(lz) < r.hz && r.y <= feet + 0.65 && r.y > best) best = r.y;
  }
  const rp = E.ramp;
  if (rp && Math.abs(x - rp.x) < rp.hx && z >= rp.z0 && z <= rp.z1) {
    const h = rp.y0 + (rp.y1 - rp.y0) * (z - rp.z0) / (rp.z1 - rp.z0);
    if (h <= feet + 0.65 && h > best) best = h;
  }
  return best;
}

export function exploreCollide(E, pos) {
  for (const b of E.blocks) {
    if (pos.y > b.top - 0.2 || pos.y < b.top - 8) continue;
    let lx = pos.x - b.x, lz = pos.z - b.z;
    const c = Math.cos(b.rot || 0), s = Math.sin(b.rot || 0);
    let ax = lx * c - lz * s, az = lx * s + lz * c;
    const ox = b.hx + 0.3 - Math.abs(ax), oz = b.hz + 0.3 - Math.abs(az);
    if (ox > 0 && oz > 0) {
      if (ox < oz) ax += Math.sign(ax) * ox; else az += Math.sign(az) * oz;
      pos.x = b.x + ax * c + az * s; pos.z = b.z - ax * s + az * c;
    }
  }
}

export function nearLadder(E, pos, mode) {
  for (const l of E.ladders) {
    const d = Math.hypot(l.x - pos.x, l.z - pos.z);
    if (d > 3.2) continue;
    if (l.fromDeck ? (mode === 'walk' && pos.y < l.top - 1) : (mode === 'swim' || mode === 'boat' || mode === 'sup')) return l;
  }
  return null;
}

const tv = new THREE.Vector3();
export function updateExplore(E, dt, time, ctx) {
  // boa: lampi di notte, dondola
  E.buoy.g.position.y = ctx.water + Math.sin(time * 0.8) * 0.15; E.buoy.g.rotation.z = Math.sin(time * 0.6) * 0.06;
  E.buoy.lamp.material.opacity = ctx.night > 0.3 ? ((time % 5) < 0.3 || ((time % 5) > 0.6 && (time % 5) < 0.9) ? 1 : 0) : 0;
  E.raft.g.position.y = ctx.water - 0.05 + Math.sin(time * 0.9) * 0.05; E.raft.g.rotation.x = Math.sin(time * 0.7) * 0.02;
  // meduse attorno a te quando sei in acqua alta
  {
    const J = E.jelly, du = new THREE.Object3D();
    if (ctx.inSea && J.list.length < 18 && heightAt(ctx.player.x, ctx.player.z) < -3) {
      const a = Math.random() * 6.28, r = 6 + Math.random() * 22;
      const x = ctx.player.x + Math.cos(a) * r, z = ctx.player.z + Math.sin(a) * r, h = heightAt(x, z);
      if (h < -2.5) J.list.push({ x, z, y: ctx.water - 0.8 - Math.random() * Math.min(4, -h - 1.5), ph: Math.random() * 6, s: 0.6 + Math.random() * 0.8 });
    }
    J.list = J.list.filter((j) => Math.hypot(j.x - ctx.player.x, j.z - ctx.player.z) < 60);
    let n = 0, nt = 0;
    for (const j of J.list) {
      const pulse = Math.sin(time * 2.2 + j.ph);
      j.y += (0.05 + Math.max(0, pulse) * 0.12) * dt; j.y -= 0.06 * dt; j.y = Math.min(j.y, ctx.water - 0.5);
      j.x += Math.sin(time * 0.1 + j.ph) * 0.05 * dt;
      du.position.set(j.x, j.y, j.z); du.rotation.set(0, j.ph, 0); du.scale.set(j.s * (1 + pulse * 0.12), j.s * (1 - pulse * 0.15), j.s * (1 + pulse * 0.12));
      du.updateMatrix(); J.im.setMatrixAt(n++, du.matrix);
      for (let k = 0; k < 6 && nt < 144; k++) {
        const a = k / 6 * 6.28;
        du.position.set(j.x + Math.cos(a) * 0.12 * j.s, j.y - 0.32 * j.s, j.z + Math.sin(a) * 0.12 * j.s);
        du.rotation.set(Math.sin(time * 1.5 + k + j.ph) * 0.3, 0, Math.cos(time * 1.3 + k) * 0.3); du.scale.setScalar(j.s);
        du.updateMatrix(); J.tent.setMatrixAt(nt++, du.matrix);
      }
    }
    J.im.count = n; J.tent.count = nt;
    J.im.instanceMatrix.needsUpdate = true; J.tent.instanceMatrix.needsUpdate = true;
  }
  // la radio: il quadrante pulsa
  E.radio.dial.material.color.setRGB(0.3 + 0.2 * Math.sin(time * 3), 1.4 + 0.3 * Math.sin(time * 3), 0.5);

  // delfini: un gruppo che salta, ogni tanto, al largo davanti a te
  const P = E.pod;
  P.next -= dt;
  if (ctx.inSea && P.next > 12) P.next = 12;
  if (P.t < 0 && P.next <= 0) {
    P.t = 0; P.dir = Math.random() < 0.5 ? -1 : 1;
    P.x = ctx.player.x - P.dir * 90; P.z = shoreZ(ctx.player.x) - 140 - Math.random() * 160;
    if (ctx.inSea) { P.x = ctx.player.x - P.dir * 45; P.z = ctx.player.z - 8 - Math.random() * 14; }
  }
  if (P.t >= 0) {
    P.t += dt;
    for (const d of E.dolphins) {
      const ph = (P.t * 1.1 + d.off) % 3.2;
      const x = P.x + P.dir * (P.t * 7 + d.k * 2.5), z = P.z + d.k * 2.2 - 3;
      const jump = ph < 1.2 ? Math.sin(ph / 1.2 * Math.PI) : 0;
      d.g.visible = true;
      d.g.position.set(x, ctx.water - 0.8 + jump * 2.6, z);
      d.g.rotation.set(ph < 1.2 ? -Math.cos(ph / 1.2 * Math.PI) * 0.8 : 0.1, P.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 'YXZ');
      if (ph < 1.2 && ph > 1.1 && !d.splashed) { d.splashed = true; ctx.splash(d.g.position); } else if (ph < 1.0) d.splashed = false;
    }
    if (P.t > 26) { P.t = -1; P.next = 50 + Math.random() * 60; for (const d of E.dolphins) d.g.visible = false; }
  }

  // tartaruga: compare vicino a te quando sei sott'acqua
  const T = E.turtle;
  if (ctx.under && !T.active) {
    const a = Math.random() * 6.28;
    T.pos.set(ctx.player.x + Math.cos(a) * 14, 0, ctx.player.z + Math.sin(a) * 14);
    const h = heightAt(T.pos.x, T.pos.z);
    if (h < -2) { T.pos.y = h + 1.2; T.active = true; T.dir = a + Math.PI * 0.7; T.g.visible = true; }
  }
  if (T.active) {
    T.t += dt;
    T.dir += Math.sin(T.t * 0.2) * 0.1 * dt;
    T.pos.x += Math.cos(T.dir) * 0.6 * dt; T.pos.z += Math.sin(T.dir) * 0.6 * dt;
    T.pos.y += (Math.max(heightAt(T.pos.x, T.pos.z) + 1.0, Math.min(T.pos.y, -1)) - T.pos.y) * dt * 0.5;
    T.g.position.copy(T.pos); T.g.rotation.y = -T.dir - Math.PI / 2;
    for (const f of T.flip) f.f.rotation.z = f.sx * Math.sin(T.t * (f.big ? 1.6 : 2.2)) * (f.big ? 0.6 : 0.3);
    if (T.pos.distanceTo(ctx.player) > 80) { T.active = false; T.g.visible = false; }
  }

  // stelle cadenti di notte
  const Mt = E.meteor;
  if (ctx.night > 0.7) {
    Mt.next -= dt;
    if (Mt.t < 0 && Mt.next <= 0) {
      Mt.t = 0; Mt.next = 20 + Math.random() * 40;
      const a = Math.random() * 6.28;
      Mt.a.set(Math.cos(a) * 800, 300 + Math.random() * 300, Math.sin(a) * 800 - 400);
      Mt.b.copy(Mt.a).add(new THREE.Vector3((Math.random() - 0.5) * 300, -120, (Math.random() - 0.5) * 300));
    }
  }
  if (Mt.t >= 0) {
    Mt.t += dt;
    const k = Mt.t / 0.9;
    const p = Mt.line.geometry.attributes.position;
    const head = tv.copy(Mt.a).lerp(Mt.b, Math.min(k, 1));
    const tail = Mt.a.clone().lerp(Mt.b, Math.max(0, k - 0.25));
    p.setXYZ(0, ctx.player.x + tail.x, tail.y, ctx.player.z + tail.z); p.setXYZ(1, ctx.player.x + head.x, head.y, ctx.player.z + head.z);
    p.needsUpdate = true;
    Mt.line.material.opacity = Math.sin(Math.min(k, 1) * Math.PI);
    if (k > 1.1) { Mt.t = -1; Mt.line.material.opacity = 0; ctx.onMeteor(); }
  }

  // scoperte per vicinanza
  for (const D of E.discover) {
    if (D.done) continue;
    if (D.under && !ctx.under) continue;
    if (D.pos.distanceTo(ctx.eye) < D.r) { D.done = true; ctx.onDiscover(D.id); }
  }
  for (const d of E.dolphins) if (d.g.visible && d.g.position.distanceTo(ctx.eye) < 45 && !E.sawDolphins) { E.sawDolphins = true; ctx.onDiscover('delfini'); }
  if (T.active && T.pos.distanceTo(ctx.eye) < 5 && !E.sawTurtle) { E.sawTurtle = true; ctx.onDiscover('tartaruga'); }
  if (E.craneTop && !E.sawCrane && Math.hypot(ctx.player.x - E.craneTop.x, ctx.player.z - E.craneTop.z) < 4 && ctx.player.y > E.craneTop.y - 1) { E.sawCrane = true; ctx.onDiscover('gru'); }
}
