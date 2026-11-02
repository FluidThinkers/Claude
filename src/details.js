import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';
import { smoothNormals } from './terrain.js';
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
  smoothNormals(g);
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
  const pos = [], frac = [], az = [], idx = [], slope = [];
  const da = (a1 - a0) / cols;
  for (let i = 0; i <= cols; i++) {
    const a = a0 + (a1 - a0) * (i / cols);
    const h = Math.max(heightFn(a), 0);
    const sl = (Math.max(heightFn(a + da), 0) - Math.max(heightFn(a - da), 0)) / (2 * da * R);
    slope.push(sl, sl);
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
  g.setAttribute('aSlope', new THREE.Float32BufferAttribute(slope, 1));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...skylineUniforms, uDepth: { value: depth } },
    vertexShader: /* glsl */`
      attribute vec2 aInfo; attribute float aAz; attribute float aSlope;
      varying float vT; varying float vH; varying float vAz; varying float vY; varying float vSl;
      void main(){ vT = aInfo.x; vH = aInfo.y; vAz = aAz; vY = position.y; vSl = aSlope;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uHaze, uBase, uSunDir, uSunCol; uniform float uSunVis, uDepth;
      varying float vT; varying float vH; varying float vAz; varying float vY; varying float vSl;
      float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
      void main(){
        float t = clamp(vY / max(vH, 1.0), 0.0, 1.0);
        float near = 1.0 - uDepth;
        // versanti: pendenza del crinale + canaloni che scendono (rumore stirato in verticale)
        float gul = vn(vec2(vAz * 1400.0, vY * 0.012)) * 0.65 + vn(vec2(vAz * 4200.0, vY * 0.03)) * 0.35;
        float sl = vSl * 1.6 + (gul - 0.5) * 2.2;
        vec3 radial = vec3(cos(vAz), 0.0, sin(vAz)), tang = vec3(-sin(vAz), 0.0, cos(vAz));
        vec3 n = normalize(-radial - tang * sl + vec3(0.0, 0.55 + 0.4 * (1.0 - t), 0.0));
        float lit = max(dot(n, uSunDir), 0.0);
        // materiali: macchia scura in basso, gariga e roccia chiara verso le creste
        float rk = smoothstep(0.45, 0.9, t + (vn(vec2(vAz * 700.0, vY * 0.02)) - 0.5) * 0.5);
        vec3 veg = mix(vec3(0.16, 0.2, 0.11), vec3(0.3, 0.3, 0.17), vn(vec2(vAz * 2200.0, vY * 0.05)));
        vec3 rock = vec3(0.52, 0.49, 0.44);
        vec3 alb = mix(veg, rock, rk * 0.75);
        vec3 amb = uBase * 0.8 + uHaze * 0.1;
        vec3 surf = alb * (amb + uSunCol * lit * 1.4 * uSunVis);
        // prospettiva aerea: lontano tutto diventa cielo; in basso la foschia è più densa
        float haze = clamp(uDepth * 0.75 + near * (1.0 - smoothstep(0.0, 0.7, t)) * 0.35, 0.0, 1.0);
        // nebbia di valle: una fascia chiara che si stende alla base di ogni piano
        haze = clamp(haze + (1.0 - smoothstep(0.0, 0.28, t)) * 0.35 * (0.6 + 0.4 * vn(vec2(vAz * 300.0, 1.0))), 0.0, 1.0);
        vec3 c = mix(surf, uHaze, haze);
        // il crinale controluce si accende appena
        c += uSunCol * smoothstep(0.92, 1.0, t) * 0.06 * uSunVis * near;
        // la sera e la notte: le montagne diventano sagome scure, quasi nere
        c *= 1.0 - 0.55 * smoothstep(0.0, 1.0, 1.0 - uSunVis) * (1.0 - uDepth * 0.4);
        // più scure e morbide: lontano si legge la massa, non il dettaglio
        c = mix(c, vec3(dot(c, vec3(0.3, 0.5, 0.2))) * vec3(0.92, 0.96, 1.05), 0.35) * 0.82;
        // sempre più scure dell'orizzonte dietro: anche col sole basso e la foschia del mattino restano sagome
        c = min(c, uHaze * mix(0.62, 0.86, uDepth));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

const D = Math.PI / 180;
const sm = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const ridged = (x, seed) => { let s = 0, a = 1, f = 1; for (let i = 0; i < 6; i++) { s += a * Math.pow(1 - Math.abs(vnoise(x * f + seed, seed * 0.37)), 1.6); f *= 2.03; a *= 0.5; } return s / 1.6; };
// profilo di catena vera: grandi masse, crinali erosi, qualche picco roccioso
const range = (a, k, seed) => { const w = a * k + 0.35 * Math.sin(a * k * 0.37 + seed); const big = vnoise(w * 0.18 + seed, 1.7) * 0.9 + 0.1; const r = ridged(w, seed); const jag = Math.pow(Math.max(0, vnoise(w * 3.1 + seed, 4.2) - 0.55), 2) * 2.2; return big * (0.55 + 0.45 * r) + jag * big; };

export function buildSkyline(scene) {
  const g = new THREE.Group();
  // cinque piani di montagne, come le coste del Mediterraneo viste dal mare: ogni piano più lontano è più azzurro e più chiaro
  // catena lontanissima, appena un'ombra azzurra
  g.add(ridgeLayer(5200, -40 * D, 125 * D, 1100, (a) => sm(-40 * D, -10 * D, a) * sm(125 * D, 95 * D, a) * (180 + 420 * range(a, 7, 11.3)), 0.78));
  // catena alle spalle del golfo
  g.add(ridgeLayer(3400, -30 * D, 115 * D, 1000, (a) => sm(-30 * D, -5 * D, a) * sm(115 * D, 80 * D, a) * (150 + 330 * range(a, 10, 3.1)), 0.58));
  // promontorio che scende a picco nel mare
  g.add(ridgeLayer(2300, -24 * D, 55 * D, 1000, (a) => sm(-24 * D, -15 * D, a) * sm(55 * D, 30 * D, a) * (90 + 200 * range(a, 15, 7.7) + 70 * sm(-15 * D, 5 * D, a)), 0.4));
  // colline basse dietro il paese
  g.add(ridgeLayer(1500, 15 * D, 100 * D, 800, (a) => sm(15 * D, 30 * D, a) * sm(100 * D, 85 * D, a) * (30 + 75 * range(a, 24, 1.3)), 0.24));
  // isola appena visibile sull'orizzonte del mare
  g.add(ridgeLayer(4200, -160 * D, -128 * D, 400, (a) => sm(-160 * D, -150 * D, a) * sm(-128 * D, -136 * D, a) * (40 + 70 * range(a, 30, 5.5)), 0.84));

  const mNear = new THREE.MeshBasicMaterial({ fog: false });
  scene.add(g);
  return { g, mNear };
}

export function updateSkyline(S, camPos, pal, sunDir, sunVis) {
  S.g.position.set(camPos.x, 0, camPos.z);
  const U = skylineUniforms;
  U.uHaze.value.copy(pal.hor).lerp(pal.sea, 0.25).lerp(pal.zen, 0.3).multiplyScalar(0.85);
  U.uBase.value.copy(pal.hor).lerp(pal.zen, 0.55).multiplyScalar(0.55);
  U.uSunDir.value.copy(sunDir); U.uSunCol.value.copy(pal.sun); U.uSunVis.value = sunVis;
  S.mNear.color.copy(U.uHaze.value).lerp(U.uBase.value, 0.62);
}

// ---------- Solchi delle gomme sulla sabbia e spruzzi dietro la ruota
function trackTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, 64, 128);
  c.filter = 'blur(1.5px)';
  c.fillStyle = 'rgb(150,140,130)'; c.fillRect(14, 0, 36, 128);
  c.fillStyle = 'rgb(110,100,92)';
  for (let y = 0; y < 128; y += 10) { c.fillRect(16, y, 13, 5); c.fillRect(35, y + 5, 13, 5); }
  c.fillStyle = 'rgb(232,226,218)'; c.fillRect(8, 0, 6, 128); c.fillRect(50, 0, 6, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class TireTracks {
  constructor(scene) {
    this.count = 700;
    const geo = new THREE.PlaneGeometry(0.2, 0.55); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: trackTexture(), blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, fog: false });
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>',
        '#if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )\n diffuseColor.rgb = mix(vec3(1.0), diffuseColor.rgb, vColor.r);\n#endif');
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.frustumCulled = false;
    this.items = [];
    for (let i = 0; i < this.count; i++) { this.items.push({ age: 0, life: 0 }); dummy.position.set(0, -999, 0); dummy.updateMatrix(); this.mesh.setMatrixAt(i, dummy.matrix); this.mesh.setColorAt(i, new THREE.Color(0, 0, 0)); }
    this.next = 0; this.dist = 0;
    scene.add(this.mesh);
  }
  update(dt, pos, yaw, onSand, step) {
    if (onSand) {
      this.dist += step;
      while (this.dist > 0.45) {
        this.dist -= 0.45;
        const i = this.next; this.next = (this.next + 1) % this.count;
        const it = this.items[i]; it.age = 0; it.life = (pos.z - shoreZ(pos.x) < 3.5) ? 10 : 160;
        const x = pos.x + Math.sin(yaw) * 0.7, z = pos.z + Math.cos(yaw) * 0.7;
        normalAt(x, z, tmpN);
        tmpQ.setFromUnitVectors(UP, tmpN); tmpQ2.setFromAxisAngle(UP, yaw);
        dummy.quaternion.copy(tmpQ).multiply(tmpQ2);
        dummy.position.set(x, heightAt(x, z) + 0.015, z); dummy.scale.setScalar(1); dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    const c = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      const it = this.items[i]; if (it.life === 0) continue;
      it.age += dt; const k = Math.min(it.age / it.life, 1);
      this.mesh.setColorAt(i, c.setScalar((1 - k * k) * 0.85));
      if (k >= 1) it.life = 0;
    }
    this.mesh.instanceColor.needsUpdate = true;
  }
}

export class SandSpray {
  constructor(scene, color = 0xcdb798, size = 0.05) {
    this.n = 260;
    this.p = new Float32Array(this.n * 3).fill(-999);
    this.v = new Float32Array(this.n * 3);
    this.life = new Float32Array(this.n);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false });
    this.pts = new THREE.Points(this.geo, this.mat); this.pts.frustumCulled = false;
    scene.add(this.pts);
    this.k = 0;
  }
  // spruzzo d'acqua: getto verso l'alto in tutte le direzioni
  burst(pos, n, power) {
    while (n-- > 0) {
      const i = this.k = (this.k + 1) % this.n;
      this.p[i * 3] = pos.x + (Math.random() - 0.5) * 0.6; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.6;
      const a = Math.random() * 6.28, r = Math.random() * power;
      this.v[i * 3] = Math.cos(a) * r; this.v[i * 3 + 1] = power * (0.8 + Math.random()); this.v[i * 3 + 2] = Math.sin(a) * r;
      this.life[i] = 0.8 + Math.random() * 0.6;
    }
  }
  emit(pos, yaw, speed, amount, dt) {
    let n = Math.floor(amount * dt * 400 + Math.random());
    while (n-- > 0) {
      const i = this.k = (this.k + 1) % this.n;
      const back = 0.75;
      this.p[i * 3] = pos.x + Math.sin(yaw) * back + (Math.random() - 0.5) * 0.2;
      this.p[i * 3 + 1] = pos.y + 0.08;
      this.p[i * 3 + 2] = pos.z + Math.cos(yaw) * back + (Math.random() - 0.5) * 0.2;
      const sp = 1 + speed * 0.25 * Math.random();
      this.v[i * 3] = Math.sin(yaw) * sp + (Math.random() - 0.5) * 1.5;
      this.v[i * 3 + 1] = 1.2 + Math.random() * 2.2;
      this.v[i * 3 + 2] = Math.cos(yaw) * sp + (Math.random() - 0.5) * 1.5;
      this.life[i] = 0.6 + Math.random() * 0.5;
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.v[i * 3 + 1] -= 9 * dt;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const h = Math.max(heightAt(this.p[i * 3], this.p[i * 3 + 2]), this.floorY ?? -99);
      if (this.p[i * 3 + 1] < h || this.life[i] <= 0) { this.life[i] = 0; this.p[i * 3 + 1] = -999; }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// ---------- La fascia di posidonia secca lasciata dalle mareggiate, con le palline di fibra
export class Wrack {
  constructor(scene) {
    const strip = new THREE.PlaneGeometry(1.0, 0.55, 4, 2); strip.rotateX(-Math.PI / 2);
    const sp = strip.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setY(i, Math.sin(sp.getX(i) * 5) * 0.012);
    strip.computeVertexNormals();
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const c2 = cv.getContext('2d');
    for (let i = 0; i < 160; i++) {
      const x = 20 + Math.random() * 216, y = 20 + Math.random() * 88, l = 20 + Math.random() * 70, a = (Math.random() - 0.5) * 0.7;
      if (Math.hypot((x - 128) / 1.8, y - 64) > 52) continue;
      const t = 50 + Math.random() * 60;
      c2.strokeStyle = `rgba(${t + 25 | 0},${t + 8 | 0},${t - 12 | 0},1)`; c2.lineWidth = 2 + Math.random() * 3; c2.lineCap = 'round';
      c2.beginPath(); c2.moveTo(x, y); c2.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + (Math.random() - 0.5) * 8, x + Math.cos(a) * l, y + Math.sin(a) * l); c2.stroke();
    }
    const wt = new THREE.CanvasTexture(cv); wt.colorSpace = THREE.SRGBColorSpace;
    this.leaves = new THREE.InstancedMesh(strip, new THREE.MeshStandardMaterial({ map: wt, alphaTest: 0.4, roughness: 0.95, side: THREE.DoubleSide }), 2600);
    this.balls = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0x8a6e4e, roughness: 1 }), 260);
    for (const m of [this.leaves, this.balls]) { m.frustumCulled = false; m.receiveShadow = true; m.castShadow = true; scene.add(m); }
    const c = new THREE.Color();
    for (let i = 0; i < 2600; i++) this.leaves.setColorAt(i, c.setHSL(0.08 + cellHash(i, 1, 2) * 0.04, 0.3, 0.55 + cellHash(i, 3, 4) * 0.35));
    this.cx = null;
  }
  update(px, pz) {
    const cx = Math.round(px / 6) * 6;
    if (cx === this.cx && Math.abs(pz - shoreZ(px)) > 60) return;
    if (cx === this.cx) return;
    this.cx = cx;
    let n = 0, nb = 0;
    for (let i = -70; i <= 70; i++) {
      const ci = Math.round(cx / 1.2) + i;
      const x0 = ci * 1.2;
      const patch = vnoise(x0 * 0.04 + 9, 2.0) * 0.6 + vnoise(x0 * 0.13, 5.0) * 0.4;
      if (patch < -0.25) continue;
      const per = Math.floor((patch + 0.25) * 7);
      for (let k = 0; k < per && n < 2600; k++) {
        const x = x0 + (cellHash(ci, k, 1) - 0.5) * 1.2;
        const d = 3.3 + (cellHash(ci, k, 2) - 0.5) * (1.0 + patch) + vnoise(x * 0.05, 3.0) * 0.8;
        const z = shoreZ(x) + d;
        dummy.position.set(x, heightAt(x, z) + 0.012 + k * 0.002, z);
        dummy.rotation.set(0, cellHash(ci, k, 3) * 6.28, 0);
        dummy.scale.set(0.6 + cellHash(ci, k, 4) * 0.8, 1, 1);
        dummy.updateMatrix(); this.leaves.setMatrixAt(n++, dummy.matrix);
      }
      if (cellHash(ci, 9, 9) > 0.7 && nb < 260) {
        const x = x0, d = 3.2 + (cellHash(ci, 9, 8) - 0.5) * 2, z = shoreZ(x) + d, s = 0.025 + cellHash(ci, 9, 7) * 0.025;
        dummy.position.set(x, heightAt(x, z) + s * 0.8, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(s * 1.3, s, s);
        dummy.updateMatrix(); this.balls.setMatrixAt(nb++, dummy.matrix);
      }
    }
    this.leaves.count = n; this.balls.count = nb;
    this.leaves.instanceMatrix.needsUpdate = true; this.balls.instanceMatrix.needsUpdate = true;
  }
}
