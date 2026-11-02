import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';
import { smoothNormals } from './terrain.js';

// Il mare come spazio da esplorare: SUP, maschera e pinne, fondale vivo.

const std = (color, rough = 0.7, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const at = (x, d) => ({ x, z: shoreZ(x) + d });
const dummy = new THREE.Object3D();

export const SUP_START = at(97, 1.2);
export const GEAR = at(90.3, 33.6);

function cellHash(i, j, k) { const h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); }

export function buildSea(scene, skyUniforms) {
  const S = {};

  // ---- SUP: tavola + pagaia
  {
    const g = new THREE.Group();
    const shape = new THREE.CapsuleGeometry(0.38, 2.4, 8, 20);
    shape.rotateX(Math.PI / 2);
    const p = shape.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      p.setY(i, p.getY(i) * 0.16);
      p.setX(i, p.getX(i) * (1 - 0.35 * Math.pow(Math.max(0, -z) / 1.6, 2)));
    }
    shape.computeVertexNormals();
    const board = new THREE.Mesh(shape, std(0xf0ece2, 0.45));
    board.castShadow = board.receiveShadow = true;
    g.add(board);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 2.6), std(0x2f6f8a, 0.5)); stripe.position.y = 0.0; g.add(stripe);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.065, 1.0), std(0x5d6a6e, 0.95)); pad.position.set(0, 0.03, 0.2); g.add(pad);
    const paddle = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.9, 8), std(0x222426, 0.4, 0.3)); shaft.position.y = 0.95; paddle.add(shaft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.015), std(0x2f6f8a, 0.4)); blade.position.y = -0.1; paddle.add(blade);
    paddle.position.set(0.3, 0.08, 0.6); paddle.rotation.set(Math.PI / 2, 0, 0.1);
    g.add(paddle);
    g.position.set(SUP_START.x, heightAt(SUP_START.x, SUP_START.z) + 0.08, SUP_START.z);
    g.rotation.y = Math.PI / 2 + 0.1;
    scene.add(g);
    S.sup = { g, paddle, vel: new THREE.Vector3(), yaw: g.rotation.y, onBoard: false };

    // pagaia in prima persona
    const fp = new THREE.Group();
    const fs = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.9, 8), std(0x222426, 0.4, 0.3)); fp.add(fs);
    const fb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.016), std(0x2f6f8a, 0.4)); fb.position.y = -1.05; fp.add(fb);
    fp.visible = false;
    S.fpPaddle = fp;
  }

  // ---- Maschera e pinne, appoggiate davanti a una cabina
  {
    const g = new THREE.Group();
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.62), std(0x1d3f57, 0.6));
    const fin2 = fin.clone();
    fin.position.set(-0.13, 0.02, 0); fin.rotation.y = 0.12; fin2.position.set(0.13, 0.05, 0.05); fin2.rotation.set(0.05, -0.1, 0.04);
    g.add(fin, fin2);
    const mask = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 20), std(0x111315, 0.5));
    frame.scale.set(1.4, 1, 1); mask.add(frame);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), std(0xbcd4dc, 0.05, 0, { transparent: true, opacity: 0.5 }));
    glass.scale.set(1.4, 1, 1); mask.add(glass);
    mask.rotation.x = -Math.PI / 2 + 0.3; mask.position.set(0, 0.11, -0.12);
    g.add(mask);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(GEAR.x, heightAt(GEAR.x, GEAR.z) + 0.01, GEAR.z);
    scene.add(g);
    S.gear = { g, taken: false };
  }

  // ---- Posidonia: prati di foglie nastriformi che ondeggiano
  {
    const blade = new THREE.PlaneGeometry(0.07, 1, 1, 5);
    blade.translate(0, 0.5, 0);
    const max = 7000;
    const mat = new THREE.MeshStandardMaterial({ color: 0x4f7a4a, roughness: 0.8, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = skyUniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float k = position.y * position.y;
        transformed.x += sin(uTime * 0.9 + ip.x * 0.4 + ip.z * 0.3) * 0.22 * k;
        transformed.z += cos(uTime * 0.7 + ip.x * 0.3) * 0.12 * k;`);
    };
    const im = new THREE.InstancedMesh(blade, mat, max);
    im.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < max; i++) im.setColorAt(i, c.setHSL(0.22 + Math.random() * 0.07, 0.4, 0.3 + Math.random() * 0.15));
    scene.add(im);
    S.grass = { im, max, cx: null, cz: null };
  }

  // ---- Banchi di pesci (salpe argentate)
  {
    // salpa: corpo affusolato e un po' schiacciato, coda a forbice; argento che lampeggia quando si gira
    const prof = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(Math.max(0.002, 0.058 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.9) * (1 - 0.55 * t * t)), -0.24 + t * 0.48)); }
    const body = new THREE.LatheGeometry(prof, 14); body.rotateX(Math.PI / 2); body.scale(0.6, 1, 1);
    const tshape = new THREE.Shape(); tshape.moveTo(0, 0); tshape.lineTo(0.07, 0.1); tshape.lineTo(0.02, 0.05); tshape.lineTo(0, 0.07); tshape.lineTo(-0.02, 0.05); tshape.lineTo(-0.07, 0.1); tshape.lineTo(0, 0);
    const tail = new THREE.ShapeGeometry(tshape); tail.rotateX(Math.PI / 2); tail.rotateZ(Math.PI / 2); tail.translate(0, 0, 0.235);
    const fin = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.09, 0), new THREE.Vector2(0.02, 0.035)])); fin.rotateY(-Math.PI / 2); fin.translate(0, 0.03, -0.04);
    const merged = mergeGeos([body, tail, fin]);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc9d3d6, roughness: 0.18, metalness: 0.85, emissive: 0x0b1416, side: THREE.DoubleSide });
    // il corpo ondeggia: la coda batte, e il fianco riflette il cielo a lampi
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = S.fishT = { value: 0 };
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  float ph = float(gl_InstanceID) * 1.37;\n  float k = smoothstep(-0.1, 0.3, position.z);\n  transformed.x += sin(uT * 9.0 + ph - position.z * 9.0) * 0.035 * k;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>');
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(0.75, 0.85, 0.9) * pow(max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 8.0) * 0.6;');
    };
    const N = 3, per = 36;
    const im = new THREE.InstancedMesh(merged, mat, N * per);
    im.frustumCulled = false;
    scene.add(im);
    S.fish = { im, schools: [], per };
    for (let s = 0; s < N; s++) {
      const fish = [];
      for (let i = 0; i < per; i++) fish.push({ o: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 3), ph: Math.random() * 6 });
      S.fish.schools.push({ c: new THREE.Vector3(), dir: Math.random() * 6.28, fish, t: Math.random() * 100, placed: false });
    }
  }

  // ---- Scogli sommersi con ricci
  {
    const geo = new THREE.IcosahedronGeometry(1, 3);
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + 0.22 * vnoise(v.x * 1.5, v.y * 1.5 + v.z)); p.setXYZ(i, v.x, v.y * 0.6, v.z); }
    smoothNormals(geo);
    const rocks = new THREE.InstancedMesh(geo, std(0x6c6a5e, 0.9), 60);
    const urch = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 1), std(0x1b1420, 0.9), 120);
    const c = new THREE.Color();
    let ui = 0;
    for (let i = 0; i < 60; i++) {
      const x = -260 + cellHash(i, 1, 2) * 420;
      const d = -25 - cellHash(i, 3, 4) * 140;
      const z = shoreZ(x) + d;
      const s = 0.7 + cellHash(i, 5, 6) * 2.2;
      dummy.position.set(x, heightAt(x, z) + s * 0.15, z);
      dummy.rotation.set(0, cellHash(i, 7, 8) * 6, 0);
      dummy.scale.set(s, s * (0.6 + cellHash(i, 9, 1) * 0.5), s * 1.2);
      dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
      rocks.setColorAt(i, c.setHSL(0.12 + cellHash(i, 2, 2) * 0.1, 0.12, 0.32 + cellHash(i, 3, 3) * 0.12));
      for (let k = 0; k < 2 && ui < 120; k++) {
        const a = cellHash(i, k, 9) * 6.28;
        dummy.position.set(x + Math.cos(a) * s * 0.7, heightAt(x, z) + s * 0.35, z + Math.sin(a) * s * 0.7);
        dummy.scale.setScalar(1); dummy.updateMatrix(); urch.setMatrixAt(ui++, dummy.matrix);
      }
    }
    urch.count = ui;
    rocks.receiveShadow = true;
    scene.add(rocks, urch);
  }

  return S;
}

function mergeGeos(list) {
  const pos = [], nor = [], idx = [];
  let off = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0;
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  m.setIndex(idx);
  return m;
}

export function updateSea(S, dt, time, ctx) {
  // posidonia attorno al giocatore (solo sott'acqua o vicino)
  {
    const G = S.grass;
    const cx = Math.round(ctx.player.x / 6) * 6, cz = Math.round(ctx.player.z / 6) * 6;
    if (cx !== G.cx || cz !== G.cz) {
      G.cx = cx; G.cz = cz;
      let n = 0;
      const C = 2.0, R = 34, r = Math.ceil(R / C);
      const i0 = Math.round(cx / C), j0 = Math.round(cz / C);
      for (let j = -r; j <= r && n < G.max; j++) for (let i = -r; i <= r && n < G.max; i++) {
        if (i * i + j * j > r * r) continue;
        const ci = i0 + i, cj = j0 + j;
        const x0 = ci * C, z0 = cj * C;
        const h = heightAt(x0, z0);
        if (h > -2.2) continue;
        // prati a chiazze
        const patch = vnoise(x0 * 0.05 + 11, z0 * 0.05) + 0.3 * vnoise(x0 * 0.2, z0 * 0.2 + 5);
        if (patch < 0.05) continue;
        const per = 6 + ((cellHash(ci, cj, 1) * 8) | 0);
        for (let k = 0; k < per && n < G.max; k++) {
          const x = x0 + (cellHash(ci, cj, k + 2) - 0.5) * C, z = z0 + (cellHash(ci, cj, k + 40) - 0.5) * C;
          dummy.position.set(x, heightAt(x, z) - 0.05, z);
          dummy.rotation.set((cellHash(ci, cj, k + 70) - 0.5) * 0.4, cellHash(ci, cj, k + 90) * 6.28, 0);
          const len = 0.5 + cellHash(ci, cj, k + 110) * 0.9;
          dummy.scale.set(1, len, 1);
          dummy.updateMatrix(); G.im.setMatrixAt(n++, dummy.matrix);
        }
      }
      G.im.count = n;
      G.im.instanceMatrix.needsUpdate = true;
    }
  }

  // pesci: i banchi si muovono vicino a te quando sei in acqua
  {
    const F = S.fish;
    let n = 0;
    for (const sc of F.schools) {
      sc.t += dt;
      if (!sc.placed || (sc.c.distanceTo(ctx.player) > 60 && !ctx.lead)) {
        const a = Math.random() * 6.28, r = 12 + Math.random() * 20;
        const x = ctx.player.x + Math.cos(a) * r, z = ctx.player.z + Math.sin(a) * r;
        const h = heightAt(x, z);
        if (h < -1.5) { sc.c.set(x, h + 0.8 + Math.random() * Math.min(2, -h - 1.2), z); sc.placed = true; }
        else { sc.placed = false; }
      }
      if (!sc.placed) { continue; }
      sc.dir += Math.sin(sc.t * 0.3) * dt * 0.6;
      // si allontanano se ti avvicini
      // se sei un pesce non scappano: ti vengono incontro e nuotano con te
      const dpl = sc.c.distanceTo(ctx.player);
      const away = ctx.friend ? (dpl > 3 ? 2.6 : 0.9) : dpl < 4 ? 2.2 : 0.5;
      if (ctx.friend && dpl > 3) sc.dir = Math.atan2(ctx.player.x - sc.c.x, ctx.player.z - sc.c.z);
      else if (!ctx.friend && away > 1) sc.dir = Math.atan2(sc.c.x - ctx.player.x, sc.c.z - ctx.player.z);
      if (ctx.friend) sc.c.y += (ctx.player.y - sc.c.y) * Math.min(1, dt * 0.8);
      // ti guida: nuota verso il relitto, ma ti aspetta se resti indietro
      if (ctx.lead) {
        const dl = Math.hypot(ctx.lead.x - sc.c.x, ctx.lead.z - sc.c.z), dp = sc.c.distanceTo(ctx.player);
        if (dl > 4) { sc.dir = Math.atan2(ctx.lead.x - sc.c.x, ctx.lead.z - sc.c.z); const v = dp < 9 ? 2.4 : 0.4; sc.c.x += Math.sin(sc.dir) * v * dt; sc.c.z += Math.cos(sc.dir) * v * dt; }
        sc.c.y += (Math.max(heightAt(sc.c.x, sc.c.z) + 1.5, Math.min(ctx.player.y, -1)) - sc.c.y) * Math.min(1, dt);
      }
      sc.c.x += Math.sin(sc.dir) * away * dt; sc.c.z += Math.cos(sc.dir) * away * dt;
      const floor = heightAt(sc.c.x, sc.c.z);
      sc.c.y = Math.min(Math.max(sc.c.y, floor + 0.4), -0.6);
      for (const f of sc.fish) {
        const w = Math.sin(sc.t * 1.5 + f.ph);
        dummy.position.set(sc.c.x + f.o.x + Math.sin(sc.t + f.ph) * 0.3, sc.c.y + f.o.y + w * 0.1, sc.c.z + f.o.z + Math.cos(sc.t * 0.8 + f.ph) * 0.3);
        dummy.rotation.set(0, sc.dir + Math.PI + Math.sin(sc.t * 6 + f.ph) * 0.15, 0);
        dummy.scale.setScalar(0.8 + (f.ph % 1) * 0.5);
        dummy.updateMatrix(); F.im.setMatrixAt(n++, dummy.matrix);
      }
    }
    F.im.count = n;
    F.im.instanceMatrix.needsUpdate = true;
    if (S.fishT) S.fishT.value = time;
  }

  // SUP alla deriva quando non ci sei sopra
  {
    const P = S.sup;
    const g = P.g;
    const h = heightAt(g.position.x, g.position.z);
    const water = ctx.water;
    if (h < water - 0.12) {
      g.position.y = water + 0.06 + Math.sin(time * 1.3) * 0.03;
      g.rotation.z = Math.sin(time * 0.9) * 0.03;
      g.rotation.x = Math.sin(time * 0.7 + 1) * 0.02;
      if (!P.onBoard) {
        P.vel.multiplyScalar(Math.pow(0.6, dt));
        g.position.addScaledVector(P.vel, dt);
      }
    } else if (!P.onBoard) {
      g.position.y = h + 0.08;
    }
  }
}
