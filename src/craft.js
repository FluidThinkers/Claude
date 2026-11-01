import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';
import { PONTILE, BELVEDERE } from './places.js';

// Mezzi per andare lontano: le navi al largo (si sale a bordo), il barchino a motore, il deltaplano.

const std = (c, r = 0.6, m = 0, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...e });
const sh = (o) => { o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };

function roundedBox(w, h, d, r, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-ix, Math.min(ix, v.x)), Math.max(-iy, Math.min(iy, v.y)), Math.max(-iz, Math.min(iz, v.z)));
    const off = v.clone().sub(c);
    if (off.lengthSq() > 1e-9) v.copy(c).add(off.normalize().multiplyScalar(r));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// scafo affusolato: assottiglia la larghezza verso prua (x negativo = prua)
function taper(geo, len, k = 0.75) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), t = Math.max(0, (-x / (len / 2) - 0.35) / 0.65);
    p.setZ(i, p.getZ(i) * (1 - k * t * t));
    if (p.getY(i) < 0) p.setZ(i, p.getZ(i) * (0.75 + 0.25 * (p.getY(i) + 1)));
  }
  geo.computeVertexNormals();
  return geo;
}

const tmpV = new THREE.Vector3();

export function buildCraft(scene) {
  const C = { ships: [] };

  // ---- Barca a vela: ponte calpestabile
  {
    const g = new THREE.Group();
    const white = std(0xf2f0ea, 0.45), teak = std(0xa07850, 0.8), dark = std(0x2a2c2e, 0.5, 0.3);
    const hull = new THREE.Mesh(taper(roundedBox(12, 2.2, 3.8, 0.5), 12, 0.8), white); hull.position.y = 0; g.add(hull);
    const stripe = new THREE.Mesh(taper(roundedBox(12.05, 0.18, 3.85, 0.08), 12, 0.8), std(0x1f3d5a, 0.5)); stripe.position.y = 0.55; g.add(stripe);
    const deck = new THREE.Mesh(taper(roundedBox(11.2, 0.12, 3.4, 0.05), 11.2, 0.8), teak); deck.position.y = 1.12; g.add(deck);
    const cabin = new THREE.Mesh(roundedBox(3.6, 0.7, 2.2, 0.2), white); cabin.position.set(-0.5, 1.5, 0); g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 14, 10), std(0xd8d8d8, 0.3, 0.8)); mast.position.set(-1.6, 8.1, 0); g.add(mast);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 8), dark); boom.rotation.z = Math.PI / 2; boom.position.set(0.9, 2.4, 0); g.add(boom);
    const sailM = std(0xf6f3ea, 0.9, 0, { side: THREE.DoubleSide });
    const tri = (pts) => { const t = new THREE.BufferGeometry(); t.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); t.computeVertexNormals(); return new THREE.Mesh(t, sailM); };
    g.add(tri([-1.5, 2.5, 0, -1.5, 14.8, 0, 3.3, 2.5, 0]));
    g.add(tri([-1.7, 13.5, 0.05, -5.6, 1.4, 0.05, -1.7, 2.0, 0.05]));
    for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 9, 6), std(0xcccccc, 0.3, 0.8)); rail.rotation.z = Math.PI / 2; rail.position.set(0.5, 1.75, s * 1.55); g.add(rail); }
    sh(g); scene.add(g);
    C.ships.push({ name: 'Barca a vela', g, kind: 'sail', speed: 1.4, s: 0, anchored: false,
      deck: { hx: 5.2, hz: 1.45, y: 1.18 }, blocks: [{ x: -0.5, z: 0, hx: 1.8, hz: 1.1, top: 1.85 }],
      path: (s) => { const x = 220 + 520 * Math.sin(s * 0.0022); return { x, z: shoreZ(x) - 620 + 60 * Math.sin(s * 0.004), yaw: Math.atan2(-Math.cos(s * 0.0022), 0) }; },
    });
  }

  // ---- Traghetto: un ponte di poppa dove si può camminare
  {
    const g = new THREE.Group();
    const white = std(0xf1f0ec, 0.5), blue = std(0x1d3f6a, 0.5), deckM = std(0x8c8f8a, 0.85), glass = std(0x22282e, 0.15, 0.6);
    const hull = new THREE.Mesh(taper(roundedBox(150, 14, 26, 2.5, 4), 150, 0.85), white); hull.position.y = 1; g.add(hull);
    const band = new THREE.Mesh(taper(roundedBox(150.4, 2, 26.4, 0.8, 4), 150.4, 0.85), blue); band.position.y = 3; g.add(band);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(60, 0.3, 24), deckM); deck.position.set(40, 8.1, 0); g.add(deck);
    const sup = new THREE.Mesh(roundedBox(80, 12, 22, 1.5), white); sup.position.set(-25, 14, 0); g.add(sup);
    const win = new THREE.Mesh(roundedBox(80.4, 1.6, 22.4, 0.6), glass); win.position.set(-25, 16, 0); g.add(win);
    const top = new THREE.Mesh(roundedBox(30, 6, 16, 1.2), white); top.position.set(-40, 23, 0); g.add(top);
    const funnel = new THREE.Mesh(roundedBox(6, 7, 4, 1.5), blue); funnel.position.set(-28, 29, 0); g.add(funnel);
    for (const s of [-1, 1]) for (let x = 12; x < 70; x += 2.5) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), std(0xdddddd, 0.3, 0.7)); st.position.set(x, 8.8, s * 11.8); g.add(st); }
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 58, 6), std(0xdddddd, 0.3, 0.7)); r.rotation.z = Math.PI / 2; r.position.set(41, 9.35, s * 11.8); g.add(r); }
    sh(g); scene.add(g);
    C.ships.push({ name: 'Traghetto', g, kind: 'ferry', speed: 5, s: 300, anchored: false,
      deck: { hx: 29, hz: 11.6, y: 8.25, cx: 41 }, blocks: [{ x: -25, z: 0, hx: 40, hz: 11, top: 20 }],
      path: (s) => ({ x: ((s * 1 + 4000) % 8000) - 4000, z: shoreZ(0) - 1150, yaw: Math.PI }),
    });
  }

  // ---- Barchino a motore legato in fondo al pontile
  {
    const g = new THREE.Group();
    const hullG = taper(roundedBox(4.6, 0.9, 1.8, 0.35), 4.6, 0.85);
    const hull = new THREE.Mesh(hullG, std(0xe9e4d8, 0.5)); g.add(hull);
    const inner = new THREE.Mesh(taper(roundedBox(4.0, 0.5, 1.4, 0.2), 4.0, 0.85), std(0x9a8a72, 0.85)); inner.position.y = 0.3; g.add(inner);
    const rim = new THREE.Mesh(taper(roundedBox(4.62, 0.12, 1.82, 0.05), 4.62, 0.85), std(0x2a5a7a, 0.6)); rim.position.y = 0.42; g.add(rim);
    const seat = new THREE.Mesh(roundedBox(0.4, 0.12, 1.4, 0.04), std(0xa07850, 0.8)); seat.position.set(0.3, 0.42, 0); g.add(seat);
    const seat2 = seat.clone(); seat2.position.x = 1.5; g.add(seat2);
    const motor = new THREE.Group();
    const cowl = new THREE.Mesh(roundedBox(0.45, 0.55, 0.35, 0.1), std(0x2a2b2d, 0.4, 0.3)); cowl.position.y = 0.75; motor.add(cowl);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.12), std(0x2a2b2d, 0.4, 0.3)); leg.position.y = 0.1; motor.add(leg);
    motor.position.set(2.4, 0, 0); g.add(motor);
    sh(g);
    const x = PONTILE.x + 3.1, z = PONTILE.z0 + PONTILE.to + 8;
    g.position.set(x, 0.1, z); g.rotation.y = -Math.PI / 2;
    scene.add(g);
    C.boat = { g, motor, yaw: 0, speed: 0, steer: 0 };
  }

  // ---- Deltaplano posato sul crinale vicino al belvedere
  {
    const g = new THREE.Group();
    const wing = new THREE.Group(); g.add(wing);
    const sail = new THREE.BufferGeometry();
    // vela a delta: naso davanti (-z), estremità laterali arretrate, bordo d'uscita curvo
    const pts = [], span = 5.2;
    const N = 10;
    for (let i = 0; i < N; i++) {
      const a = i / N, b = (i + 1) / N;
      const ax = -span + 2 * span * a, bx = -span + 2 * span * b;
      const az = 1.6 - 0.7 * Math.cos((a - 0.5) * Math.PI), bz = 1.6 - 0.7 * Math.cos((b - 0.5) * Math.PI);
      const ay = 0.25 * Math.abs(ax) / span, by = 0.25 * Math.abs(bx) / span;
      pts.push(0, 0, -2.2, ax, ay, az, bx, by, bz);
    }
    sail.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    sail.computeVertexNormals();
    const sailM = std(0xd94f2b, 0.75, 0, { side: THREE.DoubleSide });
    const s1 = new THREE.Mesh(sail, sailM); wing.add(s1);
    const stripe = new THREE.Mesh(sail, std(0xf3efe6, 0.75, 0, { side: THREE.DoubleSide })); stripe.scale.set(0.42, 1, 0.9); stripe.position.set(0, 0.01, -0.1); wing.add(stripe);
    const tube = std(0x9a9da0, 0.35, 0.8);
    const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4, 6), tube); keel.rotation.x = Math.PI / 2; keel.position.set(0, -0.05, -0.2); wing.add(keel);
    for (const s of [-1, 1]) {
      const le = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6.0, 6), tube);
      le.position.set(s * span / 2, 0.06, -0.3); le.rotation.set(Math.PI / 2, 0, 0); le.rotation.z = -s * Math.atan2(span, 3.9); wing.add(le);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 6), tube); up.position.set(s * 0.45, -0.9, -0.38); up.rotation.set(-0.18, 0, s * 0.24); wing.add(up);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), tube); bar.rotation.z = Math.PI / 2; bar.position.set(0, -1.75, -0.55); wing.add(bar);
    sh(g);
    const L = { x: BELVEDERE.x + 14, z: BELVEDERE.z + 4 };
    g.position.set(L.x, heightAt(L.x, L.z) + 1.9, L.z);
    g.rotation.y = 0; wing.rotation.x = 0.12;
    scene.add(g);
    C.glider = { g, wing, home: L, yaw: 0, speed: 0, bank: 0, vy: 0 };
  }

  return C;
}

// ponti delle navi: altezza calpestabile in (x,z) o -Infinity
export function deckHeight(C, x, z, feet) {
  let best = -Infinity;
  for (const S of C.ships) {
    const p = S.g.position, c = Math.cos(S.g.rotation.y), s = Math.sin(S.g.rotation.y);
    const dx = x - p.x, dz = z - p.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const D = S.deck, cx = D.cx || 0;
    if (Math.abs(lx - cx) < D.hx && Math.abs(lz) < D.hz) {
      const h = p.y + D.y;
      if (h <= feet + 0.65 && h > best) best = h;
    }
  }
  return best;
}

// spinge fuori dagli ingombri sul ponte (cabine, sovrastrutture)
export function shipCollide(C, pos) {
  for (const S of C.ships) {
    const p = S.g.position, c = Math.cos(S.g.rotation.y), s = Math.sin(S.g.rotation.y);
    for (const b of S.blocks) {
      if (pos.y > p.y + b.top - 0.2 || pos.y < p.y - 2) continue;
      const dx = pos.x - p.x, dz = pos.z - p.z;
      let lx = dx * c - dz * s - b.x, lz = dx * s + dz * c - b.z;
      const ox = b.hx + 0.3 - Math.abs(lx), oz = b.hz + 0.3 - Math.abs(lz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) lx += Math.sign(lx) * ox; else lz += Math.sign(lz) * oz;
        lx += b.x; lz += b.z;
        pos.x = p.x + lx * c + lz * s; pos.z = p.z - lx * s + lz * c;
      }
    }
  }
}

// la nave più vicina a cui puoi salire dall'acqua (entro 4 m dal bordo)
export function boardable(C, x, z) {
  for (const S of C.ships) {
    const p = S.g.position, c = Math.cos(S.g.rotation.y), s = Math.sin(S.g.rotation.y);
    const dx = x - p.x, dz = z - p.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const D = S.deck, cx = D.cx || 0;
    const ex = Math.max(0, Math.abs(lx - cx) - D.hx), ez = Math.max(0, Math.abs(lz) - D.hz);
    if (Math.hypot(ex, ez) < (S.kind === 'ferry' ? 6 : 4)) {
      // punto sul ponte più vicino
      const qx = cx + Math.max(-D.hx + 0.6, Math.min(D.hx - 0.6, lx - cx)), qz = Math.max(-D.hz + 0.6, Math.min(D.hz - 0.6, lz));
      return { S, x: p.x + qx * c + qz * s, z: p.z - qx * s + qz * c, y: p.y + D.y };
    }
  }
  return null;
}

export function updateCraft(C, dt, time, ctx) {
  // navi: avanzano sulla loro rotta, gettano l'ancora quando ti avvicini
  for (const S of C.ships) {
    const near = S.g.position.distanceTo(ctx.player) < (S.kind === 'ferry' ? 320 : 180);
    S.anchored = near;
    if (!near) S.s += S.speed * dt;
    const P = S.path(S.s);
    const P2 = S.path(S.s + 1);
    S.g.position.x = P.x; S.g.position.z = P.z;
    S.g.position.y = ctx.water + (S.kind === 'sail' ? Math.sin(time * 0.8) * 0.06 : Math.sin(time * 0.3) * 0.05);
    S.g.rotation.y = Math.atan2(P2.z - P.z, -(P2.x - P.x));
    if (S.kind === 'sail') S.g.rotation.x = Math.sin(time * 0.6) * 0.03;
    // foschia manuale: da lontano le navi si sciolgono nell'orizzonte
    const d = S.g.position.distanceTo(ctx.camera);
    const f = Math.min(0.85, 1 - Math.exp(-Math.pow(d * ctx.fog * 0.55, 2)));
    S.g.traverse((o) => { if (o.isMesh) { o.material.fog = false; o.material.emissive.copy(ctx.hor).multiplyScalar(f); if (!o.userData.c0) o.userData.c0 = o.material.color.clone(); o.material.color.copy(o.userData.c0).multiplyScalar(1 - f); } });
  }
  // barchino fermo: dondola
  const B = C.boat;
  if (!B.on) {
    B.g.position.y = ctx.water + 0.12 + Math.sin(time * 1.1) * 0.04;
    B.g.rotation.z = Math.sin(time * 0.8) * 0.03;
    B.speed *= Math.pow(0.5, dt);
  }
}

// guida del barchino
export function driveBoat(B, dt, input, ctx) {
  const { fx, fz, run } = input;
  const vmax = run ? 19 : 12;
  if (fz > 0) B.speed += (vmax - B.speed) * Math.min(1, 0.35 * dt) * fz;
  else if (fz < 0) B.speed = Math.max(B.speed - 6 * dt, -2.5);
  else B.speed *= Math.pow(0.7, dt);
  B.steer += (fx - B.steer) * Math.min(1, 3 * dt);
  B.yaw -= B.steer * 0.8 * Math.min(Math.abs(B.speed) / 4, 1) * Math.sign(B.speed || 1) * dt;
  const fwx = -Math.sin(B.yaw), fwz = -Math.cos(B.yaw);
  const nx = B.g.position.x + fwx * B.speed * dt, nz = B.g.position.z + fwz * B.speed * dt;
  if (ctx.water - heightAt(nx, nz) > 0.5) { B.g.position.x = nx; B.g.position.z = nz; } else B.speed *= -0.2;
  const plane = Math.min(Math.abs(B.speed) / 12, 1);
  B.g.position.y = ctx.water + 0.12 + Math.sin(ctx.time * 1.6) * 0.04 * (1 - plane) + plane * 0.08;
  B.g.rotation.y = B.yaw - Math.PI / 2;
  B.g.rotation.z = -plane * 0.12 - Math.sin(ctx.time * 2.3) * 0.015 * plane;
  B.g.rotation.x = B.steer * plane * 0.15;
  B.motor.rotation.y = B.steer * 0.5;
}

// volo in deltaplano
export function flyGlider(G, dt, input, ctx) {
  const { fx, fz } = input;
  const vt = 11 + fz * 6;
  G.speed += (vt - G.speed) * Math.min(1, 0.5 * dt);
  G.bank += (fx * 0.55 - G.bank) * Math.min(1, 1.8 * dt);
  G.yaw -= (9.8 * Math.tan(G.bank) / Math.max(G.speed, 6)) * dt;
  let sink = 0.75 + 0.03 * (G.speed - 10) * (G.speed - 10) + (G.speed < 7 ? (7 - G.speed) * 1.2 : 0) + G.bank * G.bank * 1.2;
  const p = G.g.position;
  const ground = heightAt(p.x, p.z);
  const d = p.z - shoreZ(p.x);
  // portanza: termiche sulle colline di giorno, e il vento che risale i pendii
  let lift = 0;
  if (d > 80) {
    const th = Math.max(0, vnoise(p.x * 0.006 + 4, p.z * 0.006) - 0.15);
    lift += th * 3.2 * ctx.day;
    lift += ctx.wind * 1.4 * Math.max(0, 1 - (p.y - ground) / 70);
  }
  G.vy += ((lift - sink) - G.vy) * Math.min(1, 1.5 * dt);
  p.x += -Math.sin(G.yaw) * G.speed * dt;
  p.z += -Math.cos(G.yaw) * G.speed * dt;
  p.y += G.vy * dt;
  G.g.rotation.set(0, G.yaw, 0);
  G.wing.rotation.set(0.08 - fz * 0.12, 0, -G.bank);
  const floor = Math.max(ground, ctx.water);
  return { landed: p.y - 1.9 < floor + 0.15, floor };
}
