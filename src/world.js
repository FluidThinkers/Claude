import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';
import { concreteTexture } from './textures.js';

const std = (color, rough = 0.85, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = o.receiveShadow = true; return o; };
const cyl = (r, h, m, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.castShadow = o.receiveShadow = true; return o; };

export const PLATFORM = { x: -80, z: shoreZ(-80) - 420 };


export function buildWorld(scene, glow) {
  const W = { ripples: [] };

  // ---- Passerella di cemento + bandiera rossa (foto 4-5)
  {
    const rx = 12, sz = shoreZ(rx);
    const conc = concreteTexture(); conc.repeat.set(1, 4);
    const m = new THREE.MeshStandardMaterial({ map: conc, roughness: 0.95 });
    const len = 16;
    const z0 = sz - 3, z1 = sz + len - 3;
    const h0 = Math.max(heightAt(rx, z0), -0.35), h1 = heightAt(rx, z1);
    const ramp = box(3.2, 0.5, len, m);
    ramp.position.set(rx, (h0 + h1) / 2 + 0.12, (z0 + z1) / 2);
    ramp.rotation.x = Math.atan2(h1 - h0, len);
    scene.add(ramp);
    const pole = cyl(0.05, 5.5, std(0xe9e6e0, 0.4, 0.3), 10);
    pole.position.set(rx - 1.75, h0 + 2.75, z0 + 1.2);
    scene.add(pole);
    const fg = new THREE.PlaneGeometry(0.9, 0.6, 12, 6);
    fg.translate(0.45, 0, 0);
    const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.8, side: THREE.DoubleSide }));
    flag.castShadow = true;
    flag.position.set(rx - 1.75, h0 + 5.1, z0 + 1.2);
    scene.add(flag);
    W.flag = flag; W.flagBase = fg.attributes.position.array.slice();
  }

  // ---- Piattaforma offshore (foto 6) + boe bianche
  {
    const g = new THREE.Group();
    const yel = std(0xd2a838, 0.7, 0.2), rust = std(0x7a4228, 0.9), wht = std(0xe6e2d8, 0.6), grey = std(0xb8b2a6, 0.8);
    for (const [x, z] of [[-8, -5], [8, -5], [-8, 5], [8, 5], [0, -5], [0, 5]]) {
      const leg = cyl(0.55, 17, yel); leg.position.set(x, -1.5, z); g.add(leg);
      const rb = cyl(0.6, 1.2, rust); rb.position.set(x, 0.2, z); g.add(rb);
    }
    for (const y of [2.5, 5]) {
      for (const z of [-5, 5]) { const b = box(16, 0.25, 0.25, yel); b.position.set(0, y, z); g.add(b); }
      for (const x of [-8, 8]) { const b = box(0.25, 0.25, 10, yel); b.position.set(x, y, 0); g.add(b); }
    }
    const d1 = box(21, 0.8, 13, grey); d1.position.y = 7; g.add(d1);
    const d2 = box(14, 0.5, 9, grey); d2.position.set(-1, 11, 0); g.add(d2);
    for (const z of [-2, 2]) {
      const t = cyl(1.5, 6, wht, 20); t.rotation.z = Math.PI / 2; t.position.set(-6, 9, z); g.add(t);
    }
    const c1 = box(5, 3, 4, wht); c1.position.set(3, 8.9, -1); g.add(c1);
    const c2 = box(3, 2.2, 3, wht); c2.position.set(-1, 12.4, 0); g.add(c2);
    const c3 = box(2, 2, 2, std(0xc04030)); c3.position.set(6.5, 8.4, 3.5); g.add(c3);
    const mast = box(0.5, 9, 0.5, yel); mast.position.set(7, 15, 2.5); g.add(mast);
    const boom = box(0.4, 0.4, 11, yel); boom.position.set(7, 17, -1.5); boom.rotation.x = -0.75; g.add(boom);
    const cable = cyl(0.05, 9, std(0x222222), 6); cable.position.set(7, 13.6, -5.2); g.add(cable);
    for (let i = 0; i < 4; i++) {
      const rail = box(21, 0.08, 0.08, std(0xe0b030)); rail.position.set(0, 8 + i * 0.01, i < 2 ? 6.5 : -6.5); if (i % 2) rail.position.y = 8.5; g.add(rail);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.4, 0.3) }));
    lamp.position.set(7, 19.6, 2.5); g.add(lamp);
    const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff3020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    lampGlow.scale.setScalar(6); lampGlow.position.copy(lamp.position); g.add(lampGlow);
    g.position.set(PLATFORM.x, 0, PLATFORM.z);
    g.rotation.y = 0.15;
    scene.add(g);
    W.platformLamp = lampGlow;

    const bm = std(0xf2f0ea, 0.5);
    W.buoys = [];
    for (const [dx, dz] of [[-70, 25], [70, 30], [-150, 50], [150, 45]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), bm);
      b.scale.set(1.3, 0.8, 1.3); b.castShadow = true;
      b.position.set(PLATFORM.x + dx, 0.2, PLATFORM.z + dz);
      scene.add(b); W.buoys.push(b);
    }
  }

  // ---- Una persona lontana: abiti chiari, si dissolve come in un ricordo
  {
    const g = new THREE.Group();
    const mk = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, transparent: true, opacity: 0 });
    const shirt = mk(0xe9e4da), trousers = mk(0xb9ab95), skin = mk(0xc79a7c), hair = mk(0x3a2a22);
    const mats = [shirt, trousers, skin, hair];
    const body = new THREE.Group(); body.position.y = 1.05; g.add(body);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.45, 6, 14), shirt); torso.position.y = 0.2; torso.scale.set(1, 1, 0.75); body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 14), skin); head.position.y = 0.66; body.add(head);
    const hr = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); hr.position.y = 0.67; hr.rotation.x = -0.25; body.add(hr);
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8), shirt); arm.position.set(sx * 0.24, 0.12, 0); arm.rotation.z = sx * 0.06; body.add(arm);
    }
    const leg = () => { const lg = new THREE.Group(); lg.position.y = 1.0; const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.78, 4, 10), trousers); m.position.y = -0.47; lg.add(m); return lg; };
    const legL = leg(); legL.position.x = -0.09; g.add(legL);
    const legR = leg(); legR.position.x = 0.09; g.add(legR);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.visible = false;
    scene.add(g);
    W.phantom = {
      g, body, legL, legR, state: 'hidden', timer: 10, op: 0, dir: 1, d: 2, phase: 0,
      setOpacity(o) { for (const m of mats) { m.opacity = o; m.depthWrite = o > 0.85; } g.visible = o > 0.001 || this.state === 'final'; },
    };
  }

  // ---- Cerchi d'acqua sotto i passi
  {
    const geo = new THREE.RingGeometry(0.92, 1.0, 48); geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; m.renderOrder = 2;
      scene.add(m);
      W.ripples.push({ m, life: 0 });
    }
    W.rippleIdx = 0;
  }

  return W;
}

export function spawnRipple(W, x, z, night) {
  const r = W.ripples[W.rippleIdx++ % W.ripples.length];
  r.life = 1; r.m.visible = true;
  r.m.position.set(x, 0.03, z);
  r.m.material.color.setRGB(night ? 0.55 : 1, night ? 0.7 : 1, night ? 0.85 : 1);
}

const tmpV = new THREE.Vector3();

export function updateWorld(W, dt, time, ctx) {
  // bandiera: mossa solo dal vento, che cambia piano piano
  {
    const windA = 0.6 + Math.sin(time * 0.03) * 0.5 + Math.sin(time * 0.011 + 1) * 0.3;
    const gust = 0.6 + 0.4 * Math.sin(time * 0.7) * Math.sin(time * 0.23 + 2);
    let diff = windA - W.flag.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    W.flag.rotation.y += diff * Math.min(1, dt * 0.8);
    const p = W.flag.geometry.attributes.position.array, b = W.flagBase;
    for (let i = 0; i < p.length; i += 3) {
      const x = b[i];
      p[i + 2] = (Math.sin(x * 5 - time * 7 * gust) * 0.09 + Math.sin(x * 11 - time * 11 + b[i + 1] * 3) * 0.03) * x * gust;
      p[i + 1] = b[i + 1] - x * 0.12 * (1.2 - gust);
    }
    W.flag.geometry.attributes.position.needsUpdate = true;
    W.flag.geometry.computeVertexNormals();
  }

  for (const [i, b] of W.buoys.entries()) b.position.y = 0.15 + Math.sin(time * 0.9 + i * 1.7) * 0.12;
  W.platformLamp.material.opacity = (Math.sin(time * 2.2) > 0.6 ? 1 : 0.15) * (0.3 + ctx.night * 0.7);

  // qualcuno che cammina lontano sul bagnasciuga, e svanisce nella foschia
  presence: {
    const P = W.phantom;
    P.timer -= dt;
    const dist = P.g.visible ? tmpV.set(P.g.position.x - ctx.player.x, 0, P.g.position.z - ctx.player.z).length() : 1e9;
    const walk = (speed) => {
      P.g.position.x += P.dir * speed * dt;
      P.g.position.z = shoreZ(P.g.position.x) + P.d;
      P.g.position.y = Math.max(heightAt(P.g.position.x, P.g.position.z), 0);
      P.phase += dt * speed * 2.2;
      P.legL.rotation.x = Math.sin(P.phase) * 0.35 * Math.min(speed, 1);
      P.legR.rotation.x = -Math.sin(P.phase) * 0.35 * Math.min(speed, 1);
      P.body.position.y = 1.05 + Math.abs(Math.cos(P.phase)) * 0.025 * speed;
      P.g.rotation.y = P.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    };
    if (P.state === 'final') {
      P.op = Math.min(P.op + dt * 0.25, 0.9);
      if (!P.met) {
        P.g.rotation.y = Math.atan2(ctx.player.x - P.g.position.x, ctx.player.z - P.g.position.z);
        if (dist < 4.5) { P.met = true; ctx.onMeet(); }
      } else {
        P.leave = (P.leave || 0) + dt;
        if (P.leave > 12) { walk(0.9); if (P.leave > 22) P.op = Math.max(0, 0.9 - (P.leave - 22) * 0.12); }
      }
      P.setOpacity(P.op);
      break presence;
    }
    if (P.state === 'hidden' && P.timer <= 0) {
      P.dir = Math.random() < 0.5 ? -1 : 1;
      P.d = 1.5 + Math.random() * 2;
      const x = ctx.player.x + (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 60);
      P.g.position.set(x, 0, shoreZ(x) + P.d);
      P.g.visible = true; P.state = 'in'; P.timer = 50 + Math.random() * 30;
    }
    if (P.state === 'in' || P.state === 'out') walk(1.1);
    if (P.state === 'in') { P.op = Math.min(P.op + dt * 0.2, 0.9); if (dist < 38 || P.timer <= 0) P.state = 'out'; }
    if (P.state === 'out') { P.op -= dt * 0.25; if (P.op <= 0) { P.op = 0; P.g.visible = false; P.state = 'hidden'; P.timer = 20 + Math.random() * 30; } }
    P.setOpacity(P.op);
  }

  for (const r of W.ripples) {
    if (r.life <= 0) continue;
    r.life -= dt / 2.6;
    const k = 1 - r.life;
    r.m.scale.setScalar(0.3 + k * 3.2);
    r.m.material.opacity = Math.max(r.life, 0) * 0.1;
    if (r.life <= 0) r.m.visible = false;
  }
}
