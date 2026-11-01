import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';
import { smoothNormals } from './terrain.js';

// Pini marittimi e macchia sulle colline, generati attorno a te e mossi dal vento.

const dummy = new THREE.Object3D();
const hash = (i, j, k) => { const h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); };

function blob(detail, rough, flat) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + rough * vnoise(v.x * 2.1 + 5, v.y * 2.1 + v.z * 1.7) + rough * 0.4 * vnoise(v.x * 6, v.z * 6 + v.y));
    p.setXYZ(i, v.x, v.y * flat, v.z);
  }
  smoothNormals(g);
  return g;
}

function windMaterial(color, wind, amp) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.time; sh.uniforms.uWind = wind.strength;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ipw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float sway = (sin(uTime * 1.3 + ipw.x * 0.2 + ipw.z * 0.13) + 0.4 * sin(uTime * 3.1 + ipw.z)) * uWind;
      transformed.x += sway * ${amp.toFixed(3)} * max(position.y, 0.0);
      transformed.z += sway * ${(amp * 0.5).toFixed(3)} * max(position.y, 0.0);`);
  };
  return m;
}

export class Flora {
  constructor(scene, wind) {
    // pino: tronco inclinato + chioma a ombrello
    const trunk = new THREE.CylinderGeometry(0.11, 0.24, 1, 8, 4); trunk.translate(0, 0.5, 0);
    this.trunks = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95 }), 500);
    const crown = blob(3, 0.3, 0.55);
    this.crowns = new THREE.InstancedMesh(crown, windMaterial(0x4a6638, wind, 0.04), 1600);
    this.shrubs = new THREE.InstancedMesh(blob(3, 0.32, 0.8), windMaterial(0x5d7a48, wind, 0.08), 2500);
    for (const m of [this.trunks, this.crowns, this.shrubs]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }
    const c = new THREE.Color();
    for (let i = 0; i < 2500; i++) this.shrubs.setColorAt(i, c.setHSL(0.2 + hash(i, 1, 1) * 0.09, 0.3 + hash(i, 2, 2) * 0.15, 0.3 + hash(i, 3, 3) * 0.12));
    for (let i = 0; i < 1600; i++) this.crowns.setColorAt(i, c.setHSL(0.24 + hash(i, 4, 1) * 0.06, 0.32, 0.26 + hash(i, 5, 2) * 0.08));
    this.cx = null; this.cz = null;
  }

  update(px, pz) {
    const step = 10;
    const cx = Math.round(px / step) * step, cz = Math.round(pz / step) * step;
    if (cx === this.cx && cz === this.cz) return;
    this.cx = cx; this.cz = cz;
    let nt = 0, nc = 0, ns = 0;
    // pini: celle da 9 m entro 230 m
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
        const lean = (hash(ci, cj, 5) - 0.5) * 0.25;
        dummy.position.set(x, h - 0.3, z); dummy.rotation.set(lean, hash(ci, cj, 6) * 6.28, lean * 0.5); dummy.scale.set(1, H, 1);
        dummy.updateMatrix(); this.trunks.setMatrixAt(nt++, dummy.matrix);
        const top = new THREE.Vector3(0, H, 0).applyEuler(dummy.rotation).add(dummy.position);
        const w = 1.8 + hash(ci, cj, 7) * 1.8;
        const nk = 3 + ((hash(ci, cj, 12) * 2) | 0);
        for (let k = 0; k < nk && nc < 1600; k++) {
          const a = hash(ci, cj, 13 + k) * 6.28, rr = k ? w * 0.7 : 0;
          dummy.position.set(top.x + Math.cos(a) * rr, top.y + (k ? -0.5 - hash(ci, cj, 20 + k) * 0.9 : 0.3), top.z + Math.sin(a) * rr);
          dummy.rotation.set(0, hash(ci, cj, 10 + k) * 6, 0);
          const sc = k ? 0.65 + hash(ci, cj, 30 + k) * 0.3 : 1;
          dummy.scale.set(w * sc, w * 0.5 * sc, w * sc * 0.9);
          dummy.updateMatrix(); this.crowns.setMatrixAt(nc++, dummy.matrix);
        }
      }
    }
    // macchia: celle da 4 m entro 110 m
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
        const s = 0.35 + hash(ci, cj, 24) * 0.9;
        dummy.position.set(x, heightAt(x, z) + s * 0.15, z);
        dummy.rotation.set(0, hash(ci, cj, 25) * 6, 0);
        dummy.scale.set(s * (0.9 + hash(ci, cj, 26) * 0.6), s * 0.75, s);
        dummy.updateMatrix(); this.shrubs.setMatrixAt(ns++, dummy.matrix);
      }
    }
    this.trunks.count = nt; this.crowns.count = nc; this.shrubs.count = ns;
    for (const m of [this.trunks, this.crowns, this.shrubs]) m.instanceMatrix.needsUpdate = true;
  }
}
