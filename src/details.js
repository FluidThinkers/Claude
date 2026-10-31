import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';
import { PERGOLA } from './places.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpN = new THREE.Vector3();
const dummy = new THREE.Object3D();
const WHITE = new THREE.Color(1, 1, 1);

function normalAt(x, z, out) {
  const e = 0.25;
  return out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
}

function footprintTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, 64, 128);
  c.filter = 'blur(4px)';
  c.fillStyle = 'rgb(92,84,78)';
  c.beginPath(); c.ellipse(32, 92, 13, 22, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(34, 50, 16, 24, 0.08, 0, 7); c.fill();
  c.fillStyle = 'rgb(110,102,96)';
  [[22, 20, 5], [31, 17, 5.5], [39, 19, 4.6], [45, 24, 4], [49, 31, 3.5]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
  c.filter = 'none';
  // bordo rialzato chiaro
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = 'rgba(40,40,40,0.35)'; c.lineWidth = 3; c.filter = 'blur(2px)';
  c.beginPath(); c.ellipse(33, 66, 19, 52, 0.03, 0, 7); c.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- Impronte: le tue (svaniscono, l'acqua le cancella prima) e quelle di qualcun altro
export class Footprints {
  constructor(scene) {
    this.count = 520;
    const geo = new THREE.PlaneGeometry(0.24, 0.44); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: footprintTexture(), blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false,
    });
    // il colore d'istanza (r) è l'intensità dell'impronta: 0 = sparita
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>',
        '#if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )\n diffuseColor.rgb = mix(vec3(1.0), diffuseColor.rgb, vColor.r);\n#endif');
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    this.items = [];
    for (let i = 0; i < this.count; i++) {
      this.items.push({ age: 0, life: 0 });
      dummy.position.set(0, -999, 0); dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.mesh.setColorAt(i, new THREE.Color(0, 0, 0));
    }
    this.next = 0; this.dist = 0; this.side = 1;
    scene.add(this.mesh);
    this._trail();
  }

  place(x, z, yaw, life, strength = 1) {
    const i = this.next; this.next = (this.next + 1) % this.count;
    const it = this.items[i];
    it.age = 0; it.life = life; it.strength = strength;
    normalAt(x, z, tmpN);
    tmpQ.setFromUnitVectors(UP, tmpN);
    tmpQ2.setFromAxisAngle(UP, yaw);
    dummy.quaternion.copy(tmpQ).multiply(tmpQ2);
    dummy.position.set(x, heightAt(x, z) + 0.02, z);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    this.mesh.setMatrixAt(i, dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // la scia di chi è passato prima di te: porta al chiosco
  _trail() {
    let x = 5, z = shoreZ(5) + 23, side = 1;
    const tx = PERGOLA.x - 2, tz = PERGOLA.z - 4.5;
    for (let k = 0; k < 140; k++) {
      const dx = tx - x, dz = tz - z;
      const d = Math.hypot(dx, dz);
      if (d < 1) break;
      let yaw = Math.atan2(-dx, -dz) + Math.sin(k * 0.21) * 0.25;
      x += -Math.sin(yaw) * 0.7; z += -Math.cos(yaw) * 0.7;
      side = -side;
      const ox = Math.cos(yaw) * 0.11 * side, oz = -Math.sin(yaw) * 0.11 * side;
      this.place(x + ox, z + oz, yaw + side * 0.05, Infinity, 0.75);
    }
  }

  update(dt, player, yaw, onSand, moving, step) {
    if (onSand && moving) {
      this.dist += step;
      if (this.dist > 0.68) {
        this.dist = 0; this.side = -this.side;
        const ox = Math.cos(yaw) * 0.12 * this.side, oz = -Math.sin(yaw) * 0.12 * this.side;
        const x = player.x + ox, z = player.z + oz;
        const wet = z - shoreZ(x) < 3.5;
        this.place(x, z, yaw + this.side * 0.06, wet ? 9 : 140, 1);
        return this.side;
      }
    }
    return 0;
  }

  tick(dt) {
    const c = new THREE.Color();
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i];
      if (it.life === 0) continue;
      it.age += dt;
      const k = it.life === Infinity ? 0 : Math.min(it.age / it.life, 1);
      const fresh = Math.min(it.age / 0.25, 1);
      this.mesh.setColorAt(i, c.setScalar((1 - k * k) * it.strength * fresh));
      dirty = true;
      if (k >= 1) it.life = 0;
    }
    if (dirty) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------- Ciottoli, conchiglie e legnetti sparsi attorno al giocatore (deterministici per cella)
function pebbleGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.12 * vnoise(v.x * 1.7 + 3, v.y * 1.7 + v.z * 1.3) + 0.04 * vnoise(v.x * 5, v.z * 5 + v.y);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y * 0.55, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function cellHash(i, j, k) {
  const h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

const TONES = [0xb9b3a9, 0x8d8780, 0xe3ddd3, 0x6c6762, 0xa5927c, 0xcfc2ae, 0x5a5552, 0x9a8f86, 0xd8cfc0];

export class Scatter {
  constructor(scene) {
    this.max = 1400;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
    this.pebbles = new THREE.InstancedMesh(pebbleGeometry(), mat, this.max);
    this.pebbles.castShadow = false; this.pebbles.receiveShadow = true;
    this.pebbles.frustumCulled = false;
    const wood = new THREE.CylinderGeometry(0.035, 0.05, 1, 7, 4);
    const wp = wood.attributes.position;
    for (let i = 0; i < wp.count; i++) wp.setX(i, wp.getX(i) + Math.sin(wp.getY(i) * 3) * 0.04);
    wood.computeVertexNormals();
    this.sticks = new THREE.InstancedMesh(wood, new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.9 }), 40);
    this.sticks.castShadow = true; this.sticks.frustumCulled = false;
    const tmpC = new THREE.Color();
    for (let i = 0; i < this.max; i++) this.pebbles.setColorAt(i, tmpC.setHex(TONES[i % TONES.length]));
    scene.add(this.pebbles, this.sticks);
    this.cx = null; this.cz = null;
  }

  update(px, pz) {
    const C = 1.1, R = 30;
    const cx = Math.round(px / 4) * 4, cz = Math.round(pz / 4) * 4;
    if (cx === this.cx && cz === this.cz) return;
    this.cx = cx; this.cz = cz;
    let n = 0, ns = 0;
    const r = Math.ceil(R / C);
    const i0 = Math.round(cx / C), j0 = Math.round(cz / C);
    for (let j = -r; j <= r && n < this.max; j++) {
      for (let i = -r; i <= r && n < this.max; i++) {
        if (i * i + j * j > r * r) continue;
        const ci = i0 + i, cj = j0 + j;
        const x0 = ci * C, z0 = cj * C;
        const d = z0 - shoreZ(x0);
        // densità per zona: fascia di ciottoli, fondale basso, sabbia asciutta
        let prob, smin, smax, per;
        if (d > -0.5 && d < 3.8) { prob = 0.95; per = 3; smin = 0.018; smax = 0.07; }
        else if (d <= -0.5 && d > -12) { prob = 0.7; per = 2; smin = 0.02; smax = 0.08; }
        else if (d >= 3.8 && d < 40) { prob = 0.35; per = 1; smin = 0.012; smax = 0.04; }
        else continue;
        for (let k = 0; k < per && n < this.max; k++) {
          const h = cellHash(ci, cj, k);
          if (h > prob) continue;
          const x = x0 + (cellHash(ci, cj, k + 11) - 0.5) * C;
          const z = z0 + (cellHash(ci, cj, k + 23) - 0.5) * C;
          let s = smin + Math.pow(cellHash(ci, cj, k + 37), 3) * (smax - smin);
          if (cellHash(ci, cj, k + 41) > 0.985) s *= 2.4;
          const y = heightAt(x, z);
          dummy.position.set(x, y + s * 0.18, z);
          dummy.rotation.set((cellHash(ci, cj, k + 5) - 0.5) * 0.4, cellHash(ci, cj, k + 7) * 6.28, (cellHash(ci, cj, k + 9) - 0.5) * 0.4);
          const e = 0.65 + cellHash(ci, cj, k + 13) * 0.6;
          dummy.scale.set(s * e, s, s / e);
          dummy.updateMatrix();
          this.pebbles.setMatrixAt(n++, dummy.matrix);
        }
        if (d > 0 && d < 6 && ns < 40 && cellHash(ci, cj, 99) > 0.992) {
          const x = x0, z = z0;
          dummy.position.set(x, heightAt(x, z) + 0.03, z);
          dummy.rotation.set(Math.PI / 2, 0, cellHash(ci, cj, 98) * 6.28);
          dummy.scale.set(1, 0.3 + cellHash(ci, cj, 97) * 0.9, 1);
          dummy.updateMatrix();
          this.sticks.setMatrixAt(ns++, dummy.matrix);
        }
      }
    }
    this.pebbles.count = n; this.sticks.count = ns;
    this.pebbles.instanceMatrix.needsUpdate = true;
    this.sticks.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Orizzonte: crinali stratificati, morbidi e velati (niente poligoni visibili)
const skylineUniforms = {
  uHaze: { value: new THREE.Color() },
  uBase: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3() },
  uSunCol: { value: new THREE.Color() },
  uSunVis: { value: 0 },
};

function ridgeLayer(R, a0, a1, cols, heightFn, depth) {
  const pos = [], frac = [], az = [], idx = [];
  for (let i = 0; i <= cols; i++) {
    const a = a0 + (a1 - a0) * (i / cols);
    const h = Math.max(heightFn(a), 0);
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    pos.push(x, -40, z, x, h, z);
    frac.push(0, h, 1, h);
    az.push(a, a);
    if (i < cols) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(frac, 2));
  g.setAttribute('aAz', new THREE.Float32BufferAttribute(az, 1));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...skylineUniforms, uDepth: { value: depth } },
    vertexShader: /* glsl */`
      attribute vec2 aInfo; attribute float aAz;
      varying float vT; varying float vH; varying float vAz; varying float vY;
      void main(){ vT = aInfo.x; vH = aInfo.y; vAz = aAz; vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uHaze, uBase, uSunDir, uSunCol; uniform float uSunVis, uDepth;
      varying float vT; varying float vH; varying float vAz; varying float vY;
      float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
      void main(){
        float t = clamp(vY / max(vH, 1.0), 0.0, 1.0);
        // foschia: più densa in basso, il crinale resta nitido
        float haze = uDepth + (1.0 - uDepth) * (1.0 - smoothstep(0.0, 0.85, t)) * 0.75;
        vec3 c = mix(uBase, uHaze, clamp(haze, 0.0, 1.0));
        // canaloni e vegetazione appena accennati
        float g = vn(vec2(vAz * 900.0, vY * 0.03)) * 0.6 + vn(vec2(vAz * 2600.0, vY * 0.09)) * 0.4;
        c *= 1.0 - (g - 0.5) * 0.08 * (1.0 - uDepth);
        // versanti esposti al sole
        float lit = pow(max(dot(normalize(vec3(-cos(vAz), 0.4, -sin(vAz))), uSunDir), 0.0), 2.0);
        c += uSunCol * lit * 0.08 * uSunVis * (1.0 - uDepth) * t;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

const D = Math.PI / 180;
const sm = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const ridged = (x, seed) => { let s = 0, a = 1, f = 1; for (let i = 0; i < 5; i++) { s += a * (1 - Math.abs(vnoise(x * f + seed, seed * 0.37))); f *= 2.1; a *= 0.48; } return s / 1.9; };

export function buildSkyline(scene) {
  const g = new THREE.Group();
  // catena lontana alle spalle del golfo
  g.add(ridgeLayer(3400, -30 * D, 115 * D, 900, (a) => sm(-30 * D, -5 * D, a) * sm(115 * D, 80 * D, a) * (170 + 260 * ridged(a * 9, 3.1)), 0.62));
  // promontorio che scende a picco nel mare
  g.add(ridgeLayer(2300, -24 * D, 55 * D, 900, (a) => sm(-24 * D, -15 * D, a) * sm(55 * D, 30 * D, a) * (110 + 150 * ridged(a * 14, 7.7) + 60 * sm(-15 * D, 5 * D, a)), 0.42));
  // colline basse dietro il paese
  g.add(ridgeLayer(1500, 15 * D, 100 * D, 700, (a) => sm(15 * D, 30 * D, a) * sm(100 * D, 85 * D, a) * (35 + 55 * ridged(a * 22, 1.3)), 0.3));
  // isola appena visibile sull'orizzonte del mare
  g.add(ridgeLayer(4200, -160 * D, -128 * D, 300, (a) => sm(-160 * D, -150 * D, a) * sm(-128 * D, -136 * D, a) * (40 + 50 * ridged(a * 30, 5.5)), 0.82));

  // porto, gru e ciminiera: sagome sottili nella stessa foschia
  const mNear = new THREE.MeshBasicMaterial({ fog: false });
  const at = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
  for (let i = 0; i < 6; i++) {
    const [x, z] = at((-12 + i * 1.6) * D, 1400);
    const v = new THREE.Mesh(new THREE.BoxGeometry(3, 60 + (i % 3) * 8, 3), mNear); v.position.set(x, 30, z); g.add(v);
    const h = new THREE.Mesh(new THREE.BoxGeometry(60, 2.5, 2.5), mNear); h.position.set(x - 8, 62 + (i % 3) * 8, z);
    h.rotation.z = i % 2 ? 0 : 0.55; g.add(h);
  }
  for (let i = 0; i < 40; i++) {
    const [x, z] = at((4 + i * 1.35) * D, 1250 + Math.sin(i * 2.7) * 60);
    const hgt = 10 + Math.abs(Math.sin(i * 7.3)) * 34;
    const b = new THREE.Mesh(new THREE.BoxGeometry(22, hgt, 18), mNear);
    b.position.set(x, hgt / 2 - 6, z); b.rotation.y = Math.random(); g.add(b);
  }
  {
    const [x, z] = at(30 * D, 1500);
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 240, 24), mNear); ch.position.set(x, 115, z); g.add(ch);
  }
  scene.add(g);
  return { g, mNear };
}

export function updateSkyline(S, camPos, pal, sunDir, sunVis) {
  S.g.position.set(camPos.x, 0, camPos.z);
  const U = skylineUniforms;
  U.uHaze.value.copy(pal.hor).lerp(pal.sea, 0.25);
  U.uBase.value.copy(pal.hor).lerp(pal.zen, 0.55).multiplyScalar(0.55);
  U.uSunDir.value.copy(sunDir); U.uSunCol.value.copy(pal.sun); U.uSunVis.value = sunVis;
  S.mNear.color.copy(U.uHaze.value).lerp(U.uBase.value, 0.62);
}
