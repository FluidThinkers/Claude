import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';

// Il vento: una direzione che ruota piano e raffiche che vanno e vengono.
export const wind = {
  time: { value: 0 },
  strength: { value: 0.4 },
  dir: new THREE.Vector2(0.6, -0.8),
  angle: 0,
};

export function updateWind(t) {
  wind.time.value = t;
  wind.angle = -0.9 + Math.sin(t * 0.011) * 0.6 + Math.sin(t * 0.004 + 2) * 0.4;
  wind.dir.set(Math.cos(wind.angle), Math.sin(wind.angle));
  const gust = 0.5 + 0.5 * vnoise(t * 0.12, 3.7);
  wind.strength.value = Math.max(0.12, Math.min(1, 0.25 + 0.75 * gust * gust + 0.15 * Math.sin(t * 0.05)));
  return wind.strength.value;
}

// granelli di sabbia che scivolano a filo del suolo
export class SandDrift {
  constructor(scene) {
    this.n = 900;
    const pos = new Float32Array(this.n * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({ color: 0xe8d6b8, size: 0.03, transparent: true, opacity: 0, depthWrite: false });
    this.pts = new THREE.Points(this.geo, this.mat);
    this.pts.frustumCulled = false;
    scene.add(this.pts);
    this.seed = new Float32Array(this.n).map(() => Math.random());
    this.inited = false;
  }

  update(dt, center, strength) {
    const p = this.geo.attributes.position.array;
    const R = 22;
    const sp = 2 + strength * 7;
    for (let i = 0; i < this.n; i++) {
      let x = p[i * 3], z = p[i * 3 + 2];
      if (!this.inited || Math.abs(x - center.x) > R || Math.abs(z - center.z) > R) {
        x = center.x + (Math.random() - 0.5) * 2 * R; z = center.z + (Math.random() - 0.5) * 2 * R;
      }
      const s = this.seed[i];
      x += wind.dir.x * sp * (0.6 + s) * dt + Math.sin(wind.time.value * 3 + s * 40) * 0.01;
      z += wind.dir.y * sp * (0.6 + s) * dt;
      const h = heightAt(x, z);
      const d = z - shoreZ(x);
      // solo sulla sabbia asciutta
      const y = (h > 0.15 && d > 2 && d < 72) ? h + 0.03 + s * 0.25 * strength + Math.abs(Math.sin(wind.time.value * 2 + s * 30)) * 0.05 : -999;
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    }
    this.inited = true;
    this.geo.attributes.position.needsUpdate = true;
    this.mat.opacity = Math.max(0, strength - 0.35) * 0.9;
  }
}
