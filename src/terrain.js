import * as THREE from 'three';

export const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

function hash(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

export function fbm(x, y, o) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}

// Linea di riva: il mare è verso -z, la terra verso +z
export function shoreZ(x) {
  return 6 * Math.sin(x * 0.004) + 3 * Math.sin(x * 0.011 + 1.3);
}

export function baseH(d) {
  return d > 0 ? 2.2 * (1 - Math.exp(-d / 40)) : -8 * (1 - Math.exp(d / 80));
}

// Il cumulo di sabbia (ripascimento) delle foto: cresta lunga e frastagliata parallela alla riva
function ridgeH(x, d) {
  const seg = smooth(-0.35, 0.35, Math.sin(x * 0.017) + 0.45 * Math.sin(x * 0.053 + 2.0) + 0.45);
  const w = (d - 18) / (3.2 + 1.2 * Math.sin(x * 0.05));
  const jag = 1 + 0.3 * fbm(x * 0.35, d * 0.35, 2);
  return 2.3 * seg * Math.exp(-w * w) * jag;
}

function ridged(x, y, o) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { const n = 1 - Math.abs(vnoise(x * f, y * f)); s += a * n * n; f *= 2.05; a *= 0.5; }
  return s;
}

// colline e montagne dietro la spiaggia (raggiungibili)
export function mountainH(x, z, d) {
  if (d < 74) return 0;
  const k = smooth(74, 150, d);
  const foot = Math.min((d - 74) * 0.09, 14);
  const big = 300 * Math.pow(smooth(120, 900, d), 1.2) * (0.35 + 0.75 * ridged(x * 0.0022 + 3.1, z * 0.0022, 4));
  const mid = 28 * fbm(x * 0.012, z * 0.012, 3) * smooth(100, 220, d);
  return k * (foot + big + mid);
}

// la foce: un canale che dal retroterra taglia la spiaggia fino al mare
export const FOCE = { x: -128 };
export function foceK(x, d) {
  if (d < -8 || d > 60) return 0;
  const cx = FOCE.x + 7 * Math.sin(d * 0.06) + 2 * Math.sin(d * 0.17 + 1);
  const w = 3.2 + 2.5 * smooth(12, -4, d) + 3 * smooth(46, 56, d);
  const k = 1 - smooth(w, w + 2.2, Math.abs(x - cx));
  return k * smooth(-8, -2, d) * (1 - smooth(55, 60, d));
}

// L'isola al largo: secca, aspetta la pioggia
export const ISLAND = { x: -380, z: -720, r: 115 };
export function islandK(x, z) {
  const dx = x - ISLAND.x, dz = z - ISLAND.z;
  const q = dx * dx + dz * dz;
  if (q > 260 * 260) return { k: 0, h: 0, rho: 1e9 };
  const a = Math.atan2(dz, dx);
  const rho = Math.sqrt(q) * (1 + 0.16 * Math.sin(a * 3 + 0.7) + 0.09 * Math.sin(a * 7 + 2.1) + 0.12 * (vnoise(dx * 0.02, dz * 0.02) - 0.5));
  const k = smooth(ISLAND.r * 1.45, ISLAND.r * 0.7, rho);
  const hill = 30 * Math.exp(-((rho / 62) ** 2)) + 9 * Math.exp(-(((dx + 30) ** 2 + (dz - 25) ** 2) / 1600)) + fbm(x * 0.05, z * 0.05, 3) * 2.2;
  return { k, h: 1.0 + hill * smooth(ISLAND.r * 0.95, ISLAND.r * 0.45, rho), rho };
}
// dune che la sabbia (da forma) ammucchia
export const DUNES = [];
export function addDune(x, z, r, h) { DUNES.push({ x, z, r, h: 0, H: h }); if (DUNES.length > 14) DUNES.shift(); }
export function heightAt(x, z) {
  let hi = heightAt0(x, z);
  for (let i = 0; i < DUNES.length; i++) { const D = DUNES[i], q = ((x - D.x) ** 2 + (z - D.z) ** 2) / (D.r * D.r); if (q < 1) { const k = 1 - q; hi += D.h * k * k * (1 + 0.25 * Math.sin(x * 0.7 + z * 0.4)); } }
  if (z > -300) return hi;
  const I = islandK(x, z);
  return I.k > 0 ? hi * (1 - I.k) + I.h * I.k : hi;
}
function heightAt0(x, z) {
  const d = z - shoreZ(x);
  let h = baseH(d);
  if (d > 74) h += mountainH(x, z, d);
  if (d > 5 && d < 35) h += ridgeH(x, d);
  const land = smooth(-1.5, 1.5, d);
  h += fbm(x * 0.06, z * 0.06, 3) * 0.18 * land;
  h += vnoise(x * 0.6, z * 0.6) * 0.02 * land;
  h += fbm(x * 0.12 + 50, z * 0.12, 2) * 0.35 * (1 - smooth(-6, -1, d));
  if (x > FOCE.x - 30 && x < FOCE.x + 30) {
    const k = foceK(x, d);
    if (k > 0) h = h * (1 - k) + (-0.32 + 0.06 * vnoise(x * 0.5, z * 0.5)) * k;
  }
  return h;
}

function colorAt(x, z, out, i) {
  const d = z - shoreZ(x);
  let r = 1, g = 1, b = 1;
  const v = 0.9 + 0.1 * vnoise(x * 0.05 + 9, z * 0.05);
  r *= v; g *= v; b *= v;
  // fascia di ciottoli grigi sul bagnasciuga
  const peb = Math.exp(-(((d - 1.4) / 1.4) ** 2)) * (0.55 + 0.45 * vnoise(x * 0.3, z * 0.3));
  const pk = peb * 0.65;
  r = r * (1 - pk) + 0.62 * pk; g = g * (1 - pk) + 0.62 * pk; b = b * (1 - pk) + 0.64 * pk;
  // sabbia bagnata
  const fk = (x > FOCE.x - 30 && x < FOCE.x + 30) ? foceK(x, d) : 0;
  const wet = Math.max(smooth(4, 0.3, d), smooth(0.05, 0.6, fk));
  const dk = 1 - 0.3 * wet;
  r *= dk; g *= dk; b *= dk;
  // fondale: verdognolo
  const uw = smooth(0, -3, d);
  r = r * (1 - uw) + 0.7 * uw; g = g * (1 - uw) + 0.78 * uw; b = b * (1 - uw) + 0.72 * uw;
  // isola: sabbia chiara sulla riva, terra secca e roccia sopra
  if (z < -300) {
    const I = islandK(x, z);
    if (I.k > 0.3) {
      const up = smooth(ISLAND.r * 0.85, ISLAND.r * 0.55, I.rho), n = vnoise(x * 0.06, z * 0.06);
      const ir = 0.95 * (1 - up) + (0.66 + 0.08 * n) * up, ig = 0.9 * (1 - up) + (0.56 + 0.06 * n) * up, ib = 0.78 * (1 - up) + (0.42 + 0.04 * n) * up;
      const kk = smooth(0.3, 0.8, I.k);
      r = r * (1 - kk) + ir * kk; g = g * (1 - kk) + ig * kk; b = b * (1 - kk) + ib * kk;
    }
  }
  out[i] = r; out[i + 1] = g; out[i + 2] = b;
}

// colore dell'entroterra, calcolato dopo le normali (pendenza = 1 - normal.y)
function inlandColor(x, z, ny, out, i) {
  const d = z - shoreZ(x);
  let r = out[i], g = out[i + 1], b = out[i + 2];
  {
    const sl = Math.sqrt(Math.max(0, 1 - ny * ny)) / Math.max(ny, 0.2);
    const land = smooth(70, 84, d);
    const n = vnoise(x * 0.04 + 3, z * 0.04);
    let cr = 0.62 + 0.1 * n, cg = 0.6 + 0.06 * n, cb = 0.36;           // erba secca
    // macchia mediterranea: copre gran parte dei versanti, scura e verde-oliva
    const mac = Math.min(1, smooth(-0.45, 0.15, vnoise(x * 0.02 + 7, z * 0.02 + 1) + vnoise(x * 0.09, z * 0.09) * 0.3) * smooth(88, 125, d) * 1.1);
    cr = cr * (1 - mac) + (0.22 + 0.06 * n) * mac; cg = cg * (1 - mac) + (0.3 + 0.05 * n) * mac; cb = cb * (1 - mac) + 0.15 * mac; // macchia
    const rock = smooth(0.5, 0.95, sl);
    cr = cr * (1 - rock) + 0.66 * rock; cg = cg * (1 - rock) + 0.63 * rock; cb = cb * (1 - rock) + 0.58 * rock;
    r = r * (1 - land) + cr * land; g = g * (1 - land) + cg * land; b = b * (1 - land) + cb * land;
  }
  out[i] = r; out[i + 1] = g; out[i + 2] = b;
}

// Griglia non uniforme centrata sul giocatore: fitta vicino, larga lontano.
// Ricostruita a fette su più frame per evitare scatti.
export class Terrain {
  constructor(material) {
    this.N = 200; this.R = 1000; this.A = 0.1;
    const n = this.N + 1;
    this.offs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = -1 + (2 * i) / this.N;
      this.offs[i] = this.R * (this.A * u + (1 - this.A) * u * u * u);
    }
    const idx = [];
    for (let j = 0; j < this.N; j++) for (let i = 0; i < this.N; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const index = new THREE.BufferAttribute(new Uint32Array(idx), 1);
    const mk = () => {
      const g = new THREE.BufferGeometry();
      g.setIndex(index);
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * n * 2), 2));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
      return g;
    };
    this.front = mk(); this.back = mk();
    this.mesh = new THREE.Mesh(this.front, material);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.cx = null; this.cz = null; this.job = null;
  }

  _rows(geo, cx, cz, j0, j1) {
    const n = this.N + 1;
    const p = geo.attributes.position.array, c = geo.attributes.color.array, uv = geo.attributes.uv.array;
    for (let j = j0; j < j1; j++) {
      const z = cz + this.offs[j];
      for (let i = 0; i < n; i++) {
        const x = cx + this.offs[i];
        const k = j * n + i;
        p[k * 3] = x; p[k * 3 + 1] = heightAt(x, z); p[k * 3 + 2] = z;
        colorAt(x, z, c, k * 3);
        uv[k * 2] = x / 3; uv[k * 2 + 1] = z / 3;
      }
    }
  }

  _finish(geo) {
    geo.attributes.position.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
    geo.computeVertexNormals();
    const p = geo.attributes.position.array, nr = geo.attributes.normal.array, c = geo.attributes.color.array;
    for (let k = 0; k < p.length; k += 3) {
      const x = p[k], z = p[k + 2];
      if (z - shoreZ(x) > 70) inlandColor(x, z, nr[k + 1], c, k);
    }
    geo.attributes.color.needsUpdate = true;
  }

  rebuild() { if (!this.job && this.cx !== null) this.job = { cx: this.cx, cz: this.cz, row: 0 }; }
  update(px, pz, force = false) {
    const step = 9;
    const cx = Math.round(px / step) * step, cz = Math.round(pz / step) * step;
    if (force) {
      this._rows(this.front, cx, cz, 0, this.N + 1);
      this._finish(this.front);
      this.cx = cx; this.cz = cz; this.job = null;
      return;
    }
    if (!this.job && (cx !== this.cx || cz !== this.cz)) this.job = { cx, cz, row: 0 };
    if (this.job) {
      const j1 = Math.min(this.job.row + 22, this.N + 1);
      this._rows(this.back, this.job.cx, this.job.cz, this.job.row, j1);
      this.job.row = j1;
      if (j1 >= this.N + 1) {
        this._finish(this.back);
        const old = this.front;
        this.front = this.back; this.back = old;
        this.mesh.geometry = this.front;
        this.cx = this.job.cx; this.cz = this.job.cz; this.job = null;
      }
    }
  }
}

export const SHORE_GLSL = /* glsl */`
float shoreZ(float x){ return 6.0*sin(x*0.004) + 3.0*sin(x*0.011 + 1.3); }
float baseH(float d){ return d > 0.0 ? 2.2*(1.0 - exp(-d/40.0)) : -8.0*(1.0 - exp(d/80.0)); }
`;

// normali morbide per geometrie non indicizzate (icosaedri deformati): niente facce piatte
export function smoothNormals(geo) {
  const p = geo.attributes.position, n = new Float32Array(p.count * 3);
  geo.computeVertexNormals();
  const fn = geo.attributes.normal;
  const acc = new Map();
  const key = (i) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    let a = acc.get(k); if (!a) { a = [0, 0, 0]; acc.set(k, a); }
    a[0] += fn.getX(i); a[1] += fn.getY(i); a[2] += fn.getZ(i);
  }
  for (let i = 0; i < p.count; i++) {
    const a = acc.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1;
    n[i * 3] = a[0] / l; n[i * 3 + 1] = a[1] / l; n[i * 3 + 2] = a[2] / l;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return geo;
}
