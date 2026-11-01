import * as THREE from 'three';
import { heightAt } from './terrain.js';

// Il percorso di ogni forma: prima del ricordo, una serie di passaggi che fanno sentire cosa sei.
// aria: correnti (anelli di luce verticali che girano) · terra: mulinelli di sabbia · acqua: cerchi di luce
// sulla superficie · fondo: colonne di bolle. Il ricordo si lascia prendere solo alla fine.

const PER = 110;
const MAX = 6;

export class FormPath {
  constructor(scene, tex) {
    const n = PER * MAX;
    this.pos = new Float32Array(n * 3).fill(-999);
    this.col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ map: tex, size: 0.6, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.visible = false;
    scene.add(this.pts);
    this.cps = []; this.i = 0; this.active = false; this.seed = Math.random() * 10;
  }

  // costruisce i passaggi tra from e to
  build(form, from, to, lvl, extra = {}) {
    const air = ['gull', 'cloud', 'glide', 'petal', 'wind'].includes(form);
    const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz);
    if (dist < 25 || form === 'body') { this.clear(); return false; }
    const n = Math.max(3, Math.min(MAX, Math.round(dist / (air ? 70 : 40))));
    const px = -dz / dist, pz = dx / dist;
    const amp = Math.min(30, dist * 0.14);
    this.cps = [];
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      let x = from.x + dx * t + px * Math.sin(t * Math.PI * 2 + this.seed) * amp;
      let z = from.z + dz * t + pz * Math.sin(t * Math.PI * 2 + this.seed) * amp;
      let y, style, R;
      if (air) {
        style = 'air';
        R = form === 'cloud' ? 26 : form === 'glide' ? 11 : 6.5;
        const g = Math.max(heightAt(x, z), lvl);
        if (form === 'cloud') y = extra.cloudY || 150;
        else if (form === 'glide') y = Math.max(g + 25, from.y + (to.y + 25 - from.y) * t);
        else y = Math.max(g + 9, from.y + (to.y + 6 - from.y) * t + Math.sin(t * Math.PI) * 14);
      } else if (form === 'fish') {
        style = 'deep'; R = 3.5;
        for (let s = 0; s < 60 && lvl - heightAt(x, z) < 2.5; s++) z -= 2;
        y = heightAt(x, z);
      } else {
        const wet = lvl - heightAt(x, z) > 0.4;
        if (form === 'wave' || form === 'flow') { for (let s = 0; s < 60 && lvl - heightAt(x, z) < 0.6; s++) z -= 2; style = 'water'; R = form === 'wave' ? 6 : 4.5; y = lvl; }
        else { style = wet ? 'water' : 'ground'; R = form === 'cat' ? 2.4 : 4; y = wet ? lvl : heightAt(x, z); }
      }
      this.cps.push({ x, y, z, R, style, done: false, k: 0 });
    }
    this.i = 0; this.active = true; this.form = form; this.pts.visible = true;
    return true;
  }
  clear() { this.cps = []; this.active = false; this.pts.visible = false; }
  get next() { return this.active ? this.cps[this.i] : null; }

  // ritorna l'indice del passaggio appena attraversato, oppure -1
  update(dt, time, p, inForm) {
    if (!this.active) return -1;
    let passed = -1;
    const c = this.cps[this.i];
    if (c && inForm) {
      const dh = Math.hypot(p.x - c.x, p.z - c.z);
      const hit = c.style === 'air' ? Math.hypot(dh, p.y - c.y) < c.R * 1.15
        : c.style === 'deep' ? dh < c.R + 1 && p.y < c.y + 9
        : dh < c.R + 0.8 && Math.abs(p.y - c.y) < 7;
      if (hit) { c.done = true; passed = this.i; this.i++; if (this.i >= this.cps.length) this.active = false; }
    }
    // disegno
    const P = this.pos, C = this.col;
    for (let j = 0; j < MAX; j++) {
      const cp = this.cps[j];
      for (let q = 0; q < PER; q++) {
        const o = (j * PER + q) * 3;
        if (!cp) { P[o + 1] = -999; continue; }
        cp.k += (cp.done ? -dt * 0.8 : dt * 0.5) / PER; cp.k = Math.max(0, Math.min(1, cp.k));
        const cur = j === this.i;
        const vis = cp.done ? cp.k : (cur ? 1 : 0.35) * Math.max(cp.k, 0.2);
        const u = q / PER, a = u * Math.PI * 2;
        let x = cp.x, y = cp.y, z = cp.z, b = vis;
        if (cp.style === 'air') {
          // anello verticale rivolto lungo il percorso, che ruota piano: una corrente d'aria
          const nx = this.cps[j + 1] ? this.cps[j + 1].x - cp.x : cp.x - (this.cps[j - 1] ? this.cps[j - 1].x : cp.x - 1);
          const nz = this.cps[j + 1] ? this.cps[j + 1].z - cp.z : cp.z - (this.cps[j - 1] ? this.cps[j - 1].z : cp.z);
          const l = Math.hypot(nx, nz) || 1, sx = -nz / l, sz = nx / l;
          const aa = a + time * 0.6 * (j % 2 ? 1 : -1);
          const rr = cp.R * (1 + 0.06 * Math.sin(u * 37 + time * 2));
          x += sx * Math.cos(aa) * rr; z += sz * Math.cos(aa) * rr; y += Math.sin(aa) * rr;
          b *= 0.55 + 0.45 * Math.sin(u * 23 - time * 3);
        } else if (cp.style === 'water') {
          // due cerchi di luce sulla superficie che respirano
          const ring = q % 2 ? 1 : 0.62;
          const rr = cp.R * ring * (1 + 0.05 * Math.sin(time * 1.6 + ring * 3));
          x += Math.cos(a + time * 0.2 * ring) * rr; z += Math.sin(a + time * 0.2 * ring) * rr; y += 0.08 + Math.sin(a * 6 + time * 2) * 0.05;
        } else if (cp.style === 'ground') {
          // mulinello di sabbia: spirale che sale e si allarga
          const h = ((u * 7 + time * 0.5) % 1);
          const rr = cp.R * (0.25 + h * 0.8);
          const aa = a * 7 + time * 3.5;
          x += Math.cos(aa) * rr; z += Math.sin(aa) * rr; y += 0.1 + h * cp.R * 1.6;
          b *= 1 - h * 0.7;
        } else {
          // colonna di bolle dal fondo
          const h = ((u * 5.3 + time * 0.25 + (q % 7) * 0.13) % 1);
          x += Math.cos(q * 2.4) * 0.5 * (1 + h); z += Math.sin(q * 2.4) * 0.5 * (1 + h); y += h * 8;
          b *= 1 - h * 0.6;
        }
        P[o] = x; P[o + 1] = y; P[o + 2] = z;
        const warm = cp.style === 'deep' || cp.style === 'water' ? [0.6, 0.95, 1.0] : cp.style === 'ground' ? [1.0, 0.85, 0.6] : [0.85, 1.0, 0.88];
        C[o] = warm[0] * b; C[o + 1] = warm[1] * b; C[o + 2] = warm[2] * b;
      }
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
    this.pts.geometry.attributes.color.needsUpdate = true;
    this.mat.size = this.form === 'cloud' ? 2.2 : 0.6;
    if (!this.active && this.cps.every((cp) => cp.k <= 0.01)) this.pts.visible = false;
    return passed;
  }
}
