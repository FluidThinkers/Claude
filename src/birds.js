import * as THREE from 'three';
import { heightAt, shoreZ } from './terrain.js';

// Gabbiani: alcuni planano alti sopra la riva, altri riposano e si alzano quando ti avvicini.

function gullModel() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.8 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9ea3a8, roughness: 0.8, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, side: THREE.DoubleSide });
  const beak = new THREE.MeshStandardMaterial({ color: 0xe0b23c, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), white); body.scale.set(0.11, 0.1, 0.3); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), white); head.position.set(0, 0.07, -0.27); g.add(head);
  const bk = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08, 6), beak); bk.rotation.x = -Math.PI / 2; bk.position.set(0, 0.06, -0.37); g.add(bk);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.14), grey); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.01, 0.34); g.add(tail);
  const wing = (side) => {
    const w = new THREE.Group();
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.2), grey); inner.rotation.x = -Math.PI / 2; inner.position.set(side * 0.21, 0, 0); w.add(inner);
    const outer = new THREE.Group(); outer.position.x = side * 0.42; w.add(outer);
    const o = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.15), grey); o.rotation.x = -Math.PI / 2; o.position.set(side * 0.18, 0, 0.02); outer.add(o);
    const tip = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), dark); tip.rotation.x = -Math.PI / 2; tip.position.set(side * 0.38, 0, 0.03); outer.add(tip);
    w.userData.outer = outer;
    w.position.set(side * 0.06, 0.04, -0.03);
    g.add(w);
    return w;
  };
  g.userData.wl = wing(-1); g.userData.wr = wing(1);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), beak); legs.position.set(0, -0.15, 0.02); g.add(legs);
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
