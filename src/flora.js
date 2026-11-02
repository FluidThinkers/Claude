import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';

// Vegetazione: pini marittimi con chiome di aghi, macchia a foglie, erba delle dune.
// Le chiome sono grappoli di "carte" con texture trasparente: morbide, mai poligonali.

const dummy = new THREE.Object3D();
const hash = (i, j, k) => { const h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); };

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ciuffi di aghi di pino
const needleTex = () => canvasTex(256, 256, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  for (let k = 0; k < 26; k++) {
    const cx = 30 + Math.random() * 196, cy = 30 + Math.random() * 196;
    const tone = 70 + Math.random() * 50;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, l = 14 + Math.random() * 22;
      c.strokeStyle = `rgba(${tone * 0.55 | 0},${tone + 25 | 0},${tone * 0.45 | 0},${0.75 + Math.random() * 0.25})`;
      c.lineWidth = 1.2 + Math.random() * 0.8;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); c.stroke();
    }
  }
});
// foglie della macchia (lentisco, mirto)
const leafTex = () => canvasTex(256, 256, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  for (let i = 0; i < 520; i++) {
    const x = 16 + Math.random() * 224, y = 16 + Math.random() * 224;
    if (Math.hypot(x - 128, y - 128) > 118) continue;
    const g = 70 + Math.random() * 60;
    c.fillStyle = `rgba(${g * 0.6 | 0},${g + 20 | 0},${g * 0.4 | 0},1)`;
    c.save(); c.translate(x, y); c.rotate(Math.random() * 6.28);
    c.beginPath(); c.ellipse(0, 0, 5 + Math.random() * 3, 2.2, 0, 0, 7); c.fill(); c.restore();
  }
});
// fili d'erba secca
// ciuffo di erba delle dune (sparto): foglie lunghe e sottili che si arcuano, scure alla base, paglierine in punta
const grassTex = () => canvasTex(256, 256, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x0 = w * 0.5 + (Math.random() - 0.5) * w * 0.35, hgt = h * (0.45 + Math.random() * 0.52);
    const lean = (Math.random() - 0.5) * w * 0.5 * (hgt / h), bw = 1.2 + Math.random() * 2.2;
    const g = c.createLinearGradient(0, h, 0, h - hgt);
    const dry = Math.random();
    g.addColorStop(0, 'rgba(62,70,40,1)');
    g.addColorStop(0.5, dry < 0.55 ? 'rgba(120,128,72,1)' : 'rgba(96,116,62,1)');
    g.addColorStop(1, dry < 0.55 ? 'rgba(205,196,150,1)' : 'rgba(170,176,112,1)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x0 - bw, h);
    c.quadraticCurveTo(x0 - bw * 0.6 + lean * 0.3, h - hgt * 0.55, x0 + lean, h - hgt);
    c.quadraticCurveTo(x0 + bw * 0.6 + lean * 0.3, h - hgt * 0.55, x0 + bw, h);
    c.closePath(); c.fill();
  }
});
const barkTex = () => { const t = canvasTex(64, 256, (c, w, h) => {
  c.fillStyle = '#5d4a3a'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 6 + Math.random() * 8) for (let x = 0; x < w; x += 8 + Math.random() * 10) {
    const t2 = 70 + Math.random() * 50; c.fillStyle = `rgb(${t2 + 20 | 0},${t2 | 0},${t2 - 15 | 0})`;
    c.fillRect(x, y, 6 + Math.random() * 8, 4 + Math.random() * 6);
  }
  c.strokeStyle = 'rgba(30,20,15,0.6)'; for (let i = 0; i < 30; i++) { c.beginPath(); const x = Math.random() * w; c.moveTo(x, 0); c.lineTo(x + (Math.random() - 0.5) * 8, h); c.stroke(); }
}); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 6); return t; };

// un grappolo di carte orientate a caso dentro una sfera, con normali sferiche (luce morbida)
function cardCluster(n, spread, size) {
  const pos = [], nor = [], uv = [], idx = [];
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.7, Math.random() - 0.5).normalize().multiplyScalar(Math.pow(Math.random(), 0.5) * spread);
    a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    b.crossVectors(a, v.clone().add(new THREE.Vector3(0.01, 1, 0.02)).normalize()).normalize();
    a.crossVectors(b, a).normalize();
    const s = size * (0.7 + Math.random() * 0.6);
    const base = pos.length / 3;
    for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = v.clone().addScaledVector(a, du * s).addScaledVector(b, dv * s);
      pos.push(p.x, p.y, p.z);
      nn.copy(p).normalize(); nn.y = nn.y * 0.8 + 0.3; nn.normalize();
      nor.push(nn.x, nn.y, nn.z);
      uv.push((du + 1) / 2, (dv + 1) / 2);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function crossedCards(w, h) {
  const g1 = new THREE.PlaneGeometry(w, h, 1, 5); g1.translate(0, h / 2, 0);
  const g2 = g1.clone(); g2.rotateY(Math.PI / 3); const g3 = g1.clone(); g3.rotateY(-Math.PI / 3);
  const pos = [], nor = [], uv = [], idx = [];
  let off = 0;
  for (const g of [g1, g2, g3]) {
    const p = g.attributes.position, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(0, 1, 0); uv.push(u.getX(i), u.getY(i)); }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
    off += p.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  m.setIndex(idx);
  return m;
}

function windMat(opts, wind, amp, translucent = 0.25) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide, alphaTest: 0.45, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.time; sh.uniforms.uWind = wind.strength; sh.uniforms.uWDir = { value: wind.dir };
    sh.vertexShader = 'uniform float uTime; uniform float uWind; uniform vec2 uWDir;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ipw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec2 wd = normalize(uWDir + vec2(1e-4));
      // raffiche che corrono sul prato nella direzione del vento
      float along = dot(ipw.xz, wd);
      float gust = smoothstep(0.2, 1.0, sin(along * 0.11 - uTime * 1.7) * 0.5 + 0.5) * smoothstep(-0.3, 0.8, sin(along * 0.031 - uTime * 0.43 + ipw.x * 0.01));
      float lean = (0.25 + 0.75 * uWind) * (0.35 + 0.65 * gust);
      // ogni filo trema un po' per conto suo
      float flut = sin(uTime * (5.0 + fract(ipw.x * 3.1) * 3.0) + ipw.z * 1.7 + position.x * 4.0) * (0.15 + 0.35 * gust) * uWind;
      float hk = max(position.y + 0.5, 0.0);
      float bend = (lean + flut * 0.4) * ${amp.toFixed(3)} * hk * hk * 1.6;
      // il vento in spazio locale dell'istanza
      vec3 wl = normalize((inverse(mat3(instanceMatrix)) * vec3(wd.x, 0.0, wd.y)) + vec3(1e-4));
      transformed.x += wl.x * bend + flut * ${(amp * 0.25).toFixed(3)} * hk;
      transformed.z += wl.z * bend;
      transformed.y -= bend * bend * 0.35;`);
    // un po' di luce che attraversa le foglie
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * ${translucent.toFixed(2)} * 0.35;`);
  };
  return m;
}

export class Flora {
  constructor(scene, wind) {
    const trunk = new THREE.CylinderGeometry(0.1, 0.24, 1, 10, 4, true); trunk.translate(0, 0.5, 0);
    this.trunks = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ map: barkTex(), roughness: 0.95 }), 500);
    const branch = new THREE.CylinderGeometry(0.04, 0.08, 1, 6); branch.translate(0, 0.5, 0);
    this.branches = new THREE.InstancedMesh(branch, new THREE.MeshStandardMaterial({ map: barkTex(), roughness: 0.95 }), 1600);
    this.crowns = new THREE.InstancedMesh(cardCluster(70, 1, 0.42), windMat({ map: needleTex() }, wind, 0.035), 2000);
    this.shrubs = new THREE.InstancedMesh(cardCluster(34, 0.8, 0.36), windMat({ map: leafTex() }, wind, 0.07), 2500);
    this.grass = new THREE.InstancedMesh(crossedCards(0.75, 0.75), windMat({ map: grassTex(), roughness: 0.92, alphaTest: 0.5 }, wind, 0.16, 0.35), 2600);
    for (const m of [this.trunks, this.branches, this.crowns, this.shrubs]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }
    this.grass.receiveShadow = true; this.grass.frustumCulled = false; scene.add(this.grass);
    const c = new THREE.Color();
    for (let i = 0; i < 2500; i++) this.shrubs.setColorAt(i, c.setHSL(0.2 + hash(i, 1, 1) * 0.08, 0.25 + hash(i, 2, 2) * 0.15, 0.55 + hash(i, 3, 3) * 0.25));
    for (let i = 0; i < 2000; i++) this.crowns.setColorAt(i, c.setHSL(0.24 + hash(i, 4, 1) * 0.05, 0.25, 0.6 + hash(i, 5, 2) * 0.25));
    for (let i = 0; i < 2600; i++) this.grass.setColorAt(i, c.setHSL(0.13 + hash(i, 6, 1) * 0.05, 0.18, 0.75 + hash(i, 7, 2) * 0.2));
    this.cx = null; this.cz = null;
    this.colliders = [];
  }

  update(px, pz) {
    const step = 10;
    const cx = Math.round(px / step) * step, cz = Math.round(pz / step) * step;
    if (cx === this.cx && cz === this.cz) return;
    this.cx = cx; this.cz = cz;
    let nt = 0, nb = 0, nc = 0, ns = 0, ng = 0;
    this.colliders = [];
    // pini marittimi
    {
      const C = 9, R = 230, r = Math.ceil(R / C);
      const i0 = Math.round(cx / C), j0 = Math.round(cz / C);
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (i * i + j * j > r * r || nt >= 500) continue;
        const ci = i0 + i, cj = j0 + j;
        const x = ci * C + (hash(ci, cj, 1) - 0.5) * C, z = cj * C + (hash(ci, cj, 2) - 0.5) * C;
        const d = z - shoreZ(x);
        if (d < 84) continue;
        const dens = 0.32 * Math.max(0, vnoise(x * 0.008 + 2, z * 0.008) + 0.15) * Math.min(1, (d - 84) / 40);
        if (hash(ci, cj, 3) > dens) continue;
        const h = heightAt(x, z);
        const sl = Math.abs(heightAt(x + 2, z) - heightAt(x - 2, z)) + Math.abs(heightAt(x, z + 2) - heightAt(x, z - 2));
        if (sl > 2.6) continue;
        const H = 7 + hash(ci, cj, 4) * 8;
        const lean = (hash(ci, cj, 5) - 0.5) * 0.3, ry = hash(ci, cj, 6) * 6.28;
        dummy.position.set(x, h - 0.3, z); dummy.rotation.set(lean, ry, lean * 0.5); dummy.scale.set(1, H, 1);
        dummy.updateMatrix(); this.trunks.setMatrixAt(nt++, dummy.matrix);
        this.colliders.push({ x, z, r: 0.28, top: h + H, bottom: h - 1 });
        const top = new THREE.Vector3(0, H, 0).applyEuler(dummy.rotation).add(dummy.position);
        const w = 1.9 + hash(ci, cj, 7) * 1.8;
        // rami che reggono la chioma a ombrello
        const nk = 4 + ((hash(ci, cj, 12) * 3) | 0);
        for (let k = 0; k < nk; k++) {
          const a = hash(ci, cj, 13 + k) * 6.28, rr = k ? w * (0.7 + hash(ci, cj, 40 + k) * 0.5) : 0;
          const tip = new THREE.Vector3(top.x + Math.cos(a) * rr, top.y + (k ? -0.4 - hash(ci, cj, 20 + k) * 0.8 : 0.4), top.z + Math.sin(a) * rr);
          if (k && nb < 1600) {
            const from = top.clone().add(new THREE.Vector3(0, -1.2 - k * 0.3, 0));
            const dv = tip.clone().sub(from), len = dv.length();
            dummy.position.copy(from); dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.normalize()); dummy.scale.set(1, len, 1);
            dummy.updateMatrix(); this.branches.setMatrixAt(nb++, dummy.matrix); dummy.rotation.set(0, 0, 0);
          }
          if (nc < 2000) {
            const sc = k ? 0.7 + hash(ci, cj, 30 + k) * 0.35 : 1.1;
            dummy.position.copy(tip); dummy.rotation.set(0, hash(ci, cj, 10 + k) * 6, 0);
            dummy.scale.set(w * sc, w * 0.45 * sc, w * sc);
            dummy.updateMatrix(); this.crowns.setMatrixAt(nc++, dummy.matrix);
          }
        }
      }
    }
    // macchia
    {
      const C = 4, R = 110, r = Math.ceil(R / C);
      const i0 = Math.round(cx / C), j0 = Math.round(cz / C);
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (i * i + j * j > r * r || ns >= 2500) continue;
        const ci = i0 + i, cj = j0 + j;
        const x = ci * C + (hash(ci, cj, 21) - 0.5) * C, z = cj * C + (hash(ci, cj, 22) - 0.5) * C;
        const d = z - shoreZ(x);
        if (d < 78) continue;
        const dens = Math.min(0.45, Math.max(0, vnoise(x * 0.02 + 7, z * 0.02 + 1) + 0.05)) * Math.min(1, (d - 78) / 25);
        if (hash(ci, cj, 23) > dens) continue;
        const s = 0.45 + hash(ci, cj, 24) * 0.9;
        dummy.position.set(x, heightAt(x, z) + s * 0.35, z);
        dummy.rotation.set(0, hash(ci, cj, 25) * 6, 0);
        dummy.scale.set(s * (0.9 + hash(ci, cj, 26) * 0.6), s * 0.8, s);
        dummy.updateMatrix(); this.shrubs.setMatrixAt(ns++, dummy.matrix);
        if (s > 0.8) this.colliders.push({ x, z, r: s * 0.6, top: heightAt(x, z) + s, bottom: heightAt(x, z) - 1 });
      }
    }
    // erba: ciuffi sulle dune (dietro la riva) e prati sulle colline
    {
      const C = 1.6, R = 55, r = Math.ceil(R / C);
      const i0 = Math.round(cx / C), j0 = Math.round(cz / C);
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (i * i + j * j > r * r || ng >= 2600) continue;
        const ci = i0 + i, cj = j0 + j;
        const x = ci * C + (hash(ci, cj, 51) - 0.5) * C, z = cj * C + (hash(ci, cj, 52) - 0.5) * C;
        const d = z - shoreZ(x);
        let dens = 0;
        if (d > 12 && d < 60) dens = 0.45 * Math.max(0, vnoise(x * 0.05 + 3, z * 0.05) - 0.05);
        else if (d > 74) dens = 0.75 * Math.min(1, (d - 74) / 12) * (0.4 + 0.6 * Math.max(0, vnoise(x * 0.03, z * 0.03 + 5) + 0.4));
        if (hash(ci, cj, 53) > dens) continue;
        const s = 0.6 + hash(ci, cj, 54) * 0.9;
        dummy.position.set(x, heightAt(x, z) - 0.05, z);
        dummy.rotation.set((hash(ci, cj, 56) - 0.5) * 0.2, hash(ci, cj, 55) * 6.28, 0);
        dummy.scale.set(s, s * (d < 74 ? 1.1 : 0.8), s);
        dummy.updateMatrix(); this.grass.setMatrixAt(ng++, dummy.matrix);
      }
    }
    this.trunks.count = nt; this.branches.count = nb; this.crowns.count = nc; this.shrubs.count = ns; this.grass.count = ng;
    for (const m of [this.trunks, this.branches, this.crowns, this.shrubs, this.grass]) m.instanceMatrix.needsUpdate = true;
  }
}
