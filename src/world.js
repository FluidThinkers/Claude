import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';
import { concreteTexture, glowTexture } from './textures.js';

const std = (color, rough = 0.85, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = o.receiveShadow = true; return o; };
const cyl = (r, h, m, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.castShadow = o.receiveShadow = true; return o; };

export const PLATFORM = { x: -80, z: shoreZ(-80) - 420 };
export const SOGLIA = { x: -22, z: shoreZ(-22) - 45 };

export const ORB_LINES = [
  'Il vento conosce il tuo nome.',
  'Qui la terra finisce. Tu no.',
  'Ogni soglia è un tramonto.',
  'La riva si allunga quando nessuno guarda.',
  'Le pietre ricordano di essere state montagne.',
  'Il ferro dorme sul mare.',
  'Il mare ti ha sentito.',
];

export function buildWorld(scene) {
  const W = { orbs: [], ripples: [], collected: 0 };
  const glow = glowTexture();

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

  // ---- Promontorio, porto, gru e ciminiera (foto 9): miraggio che non si avvicina mai
  {
    const far = new THREE.Group();
    const mMtn = new THREE.MeshBasicMaterial({ fog: false });
    const mNear = new THREE.MeshBasicMaterial({ fog: false });
    const hill = (x, z, sx, sy, sz, seed) => {
      const geo = new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const n = vnoise(p.getX(i) * 3 + seed, p.getZ(i) * 3) * 0.18 + vnoise(p.getX(i) * 9, p.getZ(i) * 9 + seed) * 0.05;
        p.setY(i, Math.max(0, y + n * y * 1.4));
      }
      const m = new THREE.Mesh(geo, mMtn); m.scale.set(sx, sy, sz); m.position.set(x, -5, z); far.add(m);
    };
    hill(1500, -260, 330, 210, 260, 1);
    hill(1900, 120, 520, 300, 380, 2);
    hill(2500, 500, 620, 360, 420, 3);
    hill(1300, 650, 520, 230, 300, 4);
    hill(3000, -50, 500, 260, 400, 5);
    for (let i = 0; i < 5; i++) {
      const x = 1280 + i * 45, z = -150 + i * 10;
      const v = new THREE.Mesh(new THREE.BoxGeometry(4, 70, 4), mNear); v.position.set(x, 35, z); far.add(v);
      const h = new THREE.Mesh(new THREE.BoxGeometry(70, 3, 3), mNear); h.position.set(x - 10, 68, z); h.rotation.z = i % 2 ? 0.0 : 0.6; far.add(h);
    }
    for (let i = 0; i < 26; i++) {
      const hgt = 12 + Math.abs(Math.sin(i * 7.3)) * 40;
      const b = new THREE.Mesh(new THREE.BoxGeometry(25, hgt, 20), mNear);
      b.position.set(900 + i * 26, hgt / 2 - 4, 40 + Math.sin(i * 2.1) * 30 + i * 4); far.add(b);
    }
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 260, 12), mNear); ch.position.set(1650, 125, 230); far.add(ch);
    scene.add(far);
    W.far = far; W.mMtn = mMtn; W.mNear = mNear;
  }

  // ---- Pietre che levitano sopra il cumulo
  {
    const n = 48;
    const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), std(0xffffff, 0.7), n);
    im.castShadow = true;
    const data = [];
    const tones = [0xbab4aa, 0x8a8580, 0xe2ddd4, 0x6f6a66, 0xa89a88];
    for (let i = 0; i < n; i++) {
      const x = 30 + Math.random() * 50;
      const z = shoreZ(x) + 8 + Math.random() * 22;
      data.push({ x, z, y: heightAt(x, z) + 1.2 + Math.random() * 3.5, s: 0.06 + Math.pow(Math.random(), 3) * 0.3, ph: Math.random() * 6.28, rs: (Math.random() - 0.5) * 0.6 });
      im.setColorAt(i, new THREE.Color(tones[i % tones.length]));
    }
    scene.add(im);
    W.stones = { im, data, dummy: new THREE.Object3D() };
  }

  // ---- La Soglia: telaio di legno in mezzo al mare (foto 3)
  {
    const g = new THREE.Group();
    const wood = std(0x3b2418, 0.85);
    const p1 = box(0.32, 8, 0.32, wood); p1.position.set(-1.7, -0.5, 0); g.add(p1);
    const p2 = box(0.32, 8, 0.32, wood); p2.position.set(1.7, -0.5, 0); g.add(p2);
    const l1 = box(4.4, 0.32, 0.36, wood); l1.position.set(0, 3.5, 0); g.add(l1);
    const l2 = box(5.2, 0.28, 0.3, wood); l2.position.set(0.3, 4.4, 0.5); l2.rotation.z = 0.05; g.add(l2);
    const br = box(0.24, 2.6, 0.24, wood); br.position.set(0.9, 2.4, 0); br.rotation.z = 0.7; g.add(br);
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.4), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(1, 0.6, 0.5) }, uK: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`uniform float uTime, uK; uniform vec3 uCol; varying vec2 vUv;
        void main(){ float w = sin(vUv.y*40.0 - uTime*2.0 + sin(vUv.x*9.0+uTime)*2.0)*0.5+0.5;
          float e = smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x)*smoothstep(0.0,0.1,vUv.y)*smoothstep(1.0,0.9,vUv.y);
          gl_FragColor = vec4(uCol * (0.25 + 0.35*w) * e * uK, 1.0); }`,
    }));
    veil.position.set(0, 1.75, 0);
    g.add(veil);
    g.position.set(SOGLIA.x, 0, SOGLIA.z);
    scene.add(g);
    W.soglia = g; W.veil = veil;
  }

  // ---- Lumi (7 sfere di luce da raccogliere)
  {
    const spots = [
      [6, 18, 0.9],
      [12, -5, 1.4],
      [SOGLIA.x, -62, 1.6],
      [190, 9, 1.3],
      [-230, 18, 1.2],
      [PLATFORM.x, null, 13.4],
      [160, -720, 2.0],
    ];
    const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 2.2) });
    spots.forEach(([x, d, lift], i) => {
      let z, y;
      if (d === null) { z = PLATFORM.z; y = lift; } else { z = shoreZ(x) + d; y = Math.max(heightAt(x, z), 0) + lift; }
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), coreMat));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd9b8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.scale.setScalar(1.6); g.add(sp);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb08a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
      halo.scale.setScalar(5); g.add(halo);
      g.position.set(x, y, z);
      scene.add(g);
      W.orbs.push({ g, base: y, i, taken: false, sp, halo });
    });
    W.orbLight = new THREE.PointLight(0xffd0a8, 6, 14, 1.6);
    scene.add(W.orbLight);
  }

  // ---- Presenza: figura lontana che svanisce se ti avvicini
  {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: 0x120c10, transparent: true, opacity: 0, fog: true });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.05, 4, 10), m); body.position.y = 0.78; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), m); head.position.y = 1.6; g.add(head);
    g.visible = false;
    scene.add(g);
    W.phantom = { g, m, state: 'hidden', timer: 8, op: 0 };
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

  // ---- Colonna di luce finale
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 3000, 24, 1, true), new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.6, 1.2, 1.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
    }));
    m.position.set(PLATFORM.x, 1500, PLATFORM.z - 1400);
    m.visible = false;
    scene.add(m);
    W.beam = m;
  }

  return W;
}

export function spawnRipple(W, x, z, night) {
  const r = W.ripples[W.rippleIdx++ % W.ripples.length];
  r.life = 1; r.m.visible = true;
  r.m.position.set(x, 0.03, z);
  r.m.material.color.setRGB(night ? 0.3 : 1, night ? 1.6 : 1, night ? 1.8 : 1);
}

const tmpV = new THREE.Vector3();

export function updateWorld(W, dt, time, ctx) {
  // bandiera: punta sempre verso il lume più vicino (bussola mistica)
  {
    let best = null, bd = 1e9;
    for (const o of W.orbs) if (!o.taken) { const d = o.g.position.distanceToSquared(ctx.player); if (d < bd) { bd = d; best = o; } }
    const target = best ? Math.atan2(-(best.g.position.z - W.flag.position.z), best.g.position.x - W.flag.position.x) : time * 0.2;
    let diff = target - W.flag.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    W.flag.rotation.y += diff * Math.min(1, dt * 1.5);
    const p = W.flag.geometry.attributes.position.array, b = W.flagBase;
    for (let i = 0; i < p.length; i += 3) {
      const x = b[i];
      p[i + 2] = Math.sin(x * 5 - time * 7) * 0.09 * x + Math.sin(x * 11 - time * 11 + b[i + 1] * 3) * 0.03 * x;
      p[i + 1] = b[i + 1] - x * 0.06;
    }
    W.flag.geometry.attributes.position.needsUpdate = true;
    W.flag.geometry.computeVertexNormals();
  }

  for (const [i, b] of W.buoys.entries()) b.position.y = 0.15 + Math.sin(time * 0.9 + i * 1.7) * 0.12;
  W.platformLamp.material.opacity = (Math.sin(time * 2.2) > 0.6 ? 1 : 0.15) * (0.3 + ctx.night * 0.7);

  W.far.position.set(ctx.player.x, 0, ctx.player.z);
  W.mMtn.color.copy(ctx.pal.hor).lerp(ctx.pal.zen, 0.4).multiplyScalar(0.78);
  W.mNear.color.copy(ctx.pal.hor).lerp(ctx.pal.zen, 0.5).multiplyScalar(0.62);

  {
    const { im, data, dummy } = W.stones;
    for (let i = 0; i < data.length; i++) {
      const s = data[i];
      dummy.position.set(s.x + Math.sin(time * 0.1 + s.ph) * 0.4, s.y + Math.sin(time * 0.5 + s.ph) * 0.35, s.z);
      dummy.rotation.set(time * s.rs, time * s.rs * 0.7 + s.ph, 0);
      dummy.scale.setScalar(s.s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  }

  W.veil.material.uniforms.uTime.value = time;
  W.veil.material.uniforms.uCol.value.copy(ctx.nextHor);
  W.veil.material.uniforms.uK.value = 0.8 + ctx.night * 1.2;

  // lumi
  let nearest = null, nd = 1e9;
  for (const o of W.orbs) {
    if (o.taken) {
      if (o.fade > 0) { o.fade -= dt; o.g.scale.setScalar(Math.max(o.fade, 0.001)); o.g.position.y += dt * 3; if (o.fade <= 0) o.g.visible = false; }
      continue;
    }
    o.g.position.y = o.base + Math.sin(time * 1.3 + o.i) * 0.18;
    const pulse = 0.85 + 0.15 * Math.sin(time * 3 + o.i * 2);
    o.sp.scale.setScalar(1.6 * pulse);
    o.halo.material.opacity = 0.12 + ctx.night * 0.4;
    const d = tmpV.copy(o.g.position).sub(ctx.player).length();
    if (d < nd) { nd = d; nearest = o; }
    if (d < 1.8) {
      o.taken = true; o.fade = 1.2;
      W.collected++;
      ctx.onCollect(o);
    }
  }
  if (nearest) { W.orbLight.position.copy(nearest.g.position); W.orbLight.intensity = 6 + ctx.night * 10; }
  else W.orbLight.intensity = 0;

  // presenza
  {
    const P = W.phantom;
    P.timer -= dt;
    const dist = P.g.visible ? tmpV.set(P.g.position.x - ctx.player.x, 0, P.g.position.z - ctx.player.z).length() : 1e9;
    if (P.state === 'hidden' && P.timer <= 0) {
      const a = ctx.yaw + (Math.random() - 0.5) * 1.4;
      const r = 55 + Math.random() * 40;
      const x = ctx.player.x - Math.sin(a) * r, z = ctx.player.z - Math.cos(a) * r;
      P.g.position.set(x, Math.max(heightAt(x, z), 0), z);
      P.g.visible = true; P.state = 'in'; P.timer = 25 + Math.random() * 20;
    }
    if (P.state === 'in') { P.op = Math.min(P.op + dt * 0.4, 0.92); if (dist < 32 || P.timer <= 0) P.state = 'out'; }
    if (P.state === 'out') { P.op -= dt * 0.8; if (P.op <= 0) { P.op = 0; P.g.visible = false; P.state = 'hidden'; P.timer = 15 + Math.random() * 25; } }
    P.m.opacity = P.op;
    P.m.color.setRGB(0.012 + ctx.night * 0.02, 0.008 + ctx.night * 0.03, 0.01 + ctx.night * 0.05);
    P.g.rotation.y = Math.atan2(ctx.player.x - P.g.position.x, ctx.player.z - P.g.position.z);
  }

  for (const r of W.ripples) {
    if (r.life <= 0) continue;
    r.life -= dt / 2.6;
    const k = 1 - r.life;
    r.m.scale.setScalar(0.3 + k * 3.2);
    r.m.material.opacity = Math.max(r.life, 0) * (0.35 + ctx.night * 0.5);
    if (r.life <= 0) r.m.visible = false;
  }

  if (W.beam.visible) { W.beamOp = Math.min((W.beamOp || 0) + dt * 0.08, 0.5); W.beam.material.opacity = W.beamOp * (0.85 + 0.15 * Math.sin(time * 1.5)); }
}
