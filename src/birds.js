import * as THREE from 'three';
import { heightAt, shoreZ } from './terrain.js';

// Gabbiani: alcuni planano alti sopra la riva, altri riposano e si alzano quando ti avvicini.

// gabbiano reale mediterraneo: corpo affusolato, mantello grigio perla, punte nere con macchie bianche,
// becco giallo con la macchia rossa, zampe gialle
const GM = {
  white: new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.7 }),
  wing: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }),
  beak: new THREE.MeshStandardMaterial({ color: 0xe8c23a, roughness: 0.5 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc8322a, roughness: 0.5 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 }),
};
function wingGeo(side, outer) {
  // contorno dell'ala vista dall'alto: bordo d'attacco dritto, bordo d'uscita morbido, punta stretta
  const sh = new THREE.Shape();
  if (!outer) { sh.moveTo(0, 0.05); sh.lineTo(0.44, 0.07); sh.lineTo(0.44, -0.12); sh.quadraticCurveTo(0.2, -0.17, 0, -0.16); sh.lineTo(0, 0.05); }
  else { sh.moveTo(0, 0.07); sh.quadraticCurveTo(0.22, 0.06, 0.42, -0.04); sh.lineTo(0.46, -0.07); sh.quadraticCurveTo(0.24, -0.1, 0, -0.12); sh.lineTo(0, 0.07); }
  const g = new THREE.ShapeGeometry(sh, 10); g.rotateX(-Math.PI / 2); if (side < 0) g.scale(-1, 1, 1);
  const p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(p.getX(i)), z = p.getZ(i);
    let c = [0.66, 0.69, 0.72];                                   // grigio perla
    if (z > 0.1 && !outer) c = [0.95, 0.95, 0.94];                // bordo d'uscita bianco
    if (outer && x > 0.22) c = [0.08, 0.08, 0.09];                // punte nere
    if (outer && x > 0.36 && x < 0.42 && z > 0.02) c = [0.95, 0.95, 0.94]; // specchio bianco
    col.push(...c);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
function gullModel() {
  const g = new THREE.Group();
  const prof = []; for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new THREE.Vector2(Math.max(0.004, 0.105 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.8) * (1 - 0.6 * t * t)), -0.3 + t * 0.62)); }
  const bg = new THREE.LatheGeometry(prof, 16); bg.rotateX(Math.PI / 2); bg.scale(1, 0.9, 1);
  const body = new THREE.Mesh(bg, GM.white); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), GM.white); head.scale.set(0.9, 0.95, 1.1); head.position.set(0, 0.06, -0.31); g.add(head);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), GM.eye); e.position.set(sx * 0.05, 0.08, -0.34); g.add(e); }
  const bk = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.085, 10), GM.beak); bk.rotation.x = -Math.PI / 2 - 0.12; bk.position.set(0, 0.05, -0.41); g.add(bk);
  const spot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), GM.red); spot.position.set(0, 0.04, -0.42); g.add(spot);
  const ts = new THREE.Shape(); ts.moveTo(-0.07, 0); ts.lineTo(0.07, 0); ts.lineTo(0.06, 0.13); ts.quadraticCurveTo(0, 0.15, -0.06, 0.13); ts.lineTo(-0.07, 0);
  const tg = new THREE.ShapeGeometry(ts); tg.rotateX(Math.PI / 2);
  const tail = new THREE.Mesh(tg, GM.white); tail.material = GM.white; tail.position.set(0, 0.0, 0.27); g.add(tail);
  const wing = (side) => {
    const w = new THREE.Group();
    const inner = new THREE.Mesh(wingGeo(side, false), GM.wing); w.add(inner);
    const outer = new THREE.Group(); outer.position.x = side * 0.44; w.add(outer);
    outer.add(new THREE.Mesh(wingGeo(side, true), GM.wing));
    w.userData.outer = outer;
    w.position.set(side * 0.07, 0.05, -0.04);
    g.add(w);
    return w;
  };
  g.userData.wl = wing(-1); g.userData.wr = wing(1);
  const legs = new THREE.Group();
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.16, 6), GM.beak); l.position.set(sx * 0.03, -0.15, 0.03); legs.add(l); }
  g.add(legs);
  g.userData.legs = legs;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Gulls {
  constructor(scene, perches) {
    this.birds = [];
    this.center = new THREE.Vector3();
    for (let i = 0; i < 12; i++) {
      const m = gullModel();
      m.scale.setScalar(1.15);
      scene.add(m);
      const b = { m, state: 'fly', ph: Math.random() * 10, r: 25 + Math.random() * 45, h: 12 + Math.random() * 30, sp: (0.1 + Math.random() * 0.12) * (Math.random() < 0.5 ? -1 : 1), a: Math.random() * 6.28, flap: 0, perch: null, call: 5 + Math.random() * 20 };
      this.birds.push(b);
    }
    // alcuni posati: sulla sabbia bagnata e sui pali del pontile
    this.perches = perches;
    this.birds.slice(0, 6).forEach((b, i) => this._perch(b, this.perches[i % this.perches.length]));
  }

  _perch(b, p) {
    b.state = 'rest'; b.perch = p;
    b.m.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.17, (Math.random() - 0.5) * 1.5));
    if (p.post) b.m.position.set(p.x, p.y + 0.17, p.z);
    b.m.rotation.set(0, Math.random() * 6.28, 0);
    b.rest = 0;
  }

  update(dt, time, player, onCall) {
    // il centro dello stormo segue la riva vicino a te
    this.center.set(player.x + Math.sin(time * 0.02) * 40, 0, shoreZ(player.x) - 10 + Math.cos(time * 0.03) * 25);
    for (const b of this.birds) {
      const m = b.m, wl = m.userData.wl, wr = m.userData.wr;
      if (b.state === 'rest') {
        b.rest += dt;
        m.userData.legs.visible = true;
        wl.rotation.z = -0.1; wr.rotation.z = 0.1; wl.rotation.y = 1.3; wr.rotation.y = -1.3;
        if (Math.random() < dt * 0.15) m.rotation.y += (Math.random() - 0.5) * 1.2;
        const d = m.position.distanceTo(player);
        if (d < 9) { b.state = 'takeoff'; b.t = 0; b.a = Math.atan2(m.position.z - this.center.z, m.position.x - this.center.x); onCall(m.position, 1); }
        continue;
      }
      m.userData.legs.visible = false;
      wl.rotation.y = 0; wr.rotation.y = 0;
      if (b.state === 'takeoff') {
        b.t += dt;
        const away = new THREE.Vector3(m.position.x - player.x, 0, m.position.z - player.z).normalize();
        m.position.addScaledVector(away, dt * 5);
        m.position.y += dt * (3 + b.t * 2);
        m.rotation.y = Math.atan2(-away.x, -away.z);
        b.flap += dt * 14;
        if (b.t > 4) { b.state = 'fly'; b.a = Math.atan2(m.position.z - this.center.z, m.position.x - this.center.x); }
      } else {
        // volo ad anello, con lunghe planate
        b.a += b.sp * dt;
        const tx = this.center.x + Math.cos(b.a) * b.r;
        const tz = this.center.z + Math.sin(b.a) * b.r;
        const ty = b.h + Math.sin(time * 0.3 + b.ph) * 4;
        const tgt = new THREE.Vector3(tx, ty, tz);
        const dir = tgt.sub(m.position);
        const dist = dir.length();
        dir.normalize();
        m.position.addScaledVector(dir, Math.min(dist, dt * 9));
        const yaw = Math.atan2(-dir.x, -dir.z);
        let dy = yaw - m.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        m.rotation.y += dy * Math.min(1, dt * 2);
        m.rotation.z = THREE.MathUtils.clamp(-dy * 1.5, -0.6, 0.6);
        const gliding = Math.sin(time * 0.25 + b.ph) > -0.2;
        b.flap += dt * (gliding ? 0 : 9);
        if (gliding) b.flap = THREE.MathUtils.lerp(b.flap, Math.round(b.flap / Math.PI) * Math.PI, dt * 2);
        // ogni tanto uno scende a posarsi
        if (Math.random() < dt * 0.004 && this.perches.length) { this._perch(b, this.perches[(Math.random() * this.perches.length) | 0]); continue; }
      }
      const f = Math.sin(b.flap);
      wl.rotation.z = -0.15 - f * 0.55; wr.rotation.z = 0.15 + f * 0.55;
      wl.userData.outer.rotation.z = -f * 0.35; wr.userData.outer.rotation.z = f * 0.35;
      b.call -= dt;
      if (b.call <= 0) { b.call = 8 + Math.random() * 25; onCall(m.position, 0); }
    }
  }
}

export function gullPerches(pontile) {
  const out = [];
  for (const d of [-20, -35, -50, -65, -80]) out.push(Object.assign(new THREE.Vector3(pontile.x - pontile.half + 0.1, pontile.deck + 0.05, pontile.z0 + d), { post: true }));
  for (const x of [-70, -20, 40, 70, 140]) { const z = shoreZ(x) + 2.5; out.push(new THREE.Vector3(x, heightAt(x, z), z)); }
  return out;
}
