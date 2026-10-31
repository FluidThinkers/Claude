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

export function heightAt(x, z) {
  const d = z - shoreZ(x);
  let h = baseH(d);
  if (d > 5 && d < 35) h += ridgeH(x, d);
  const land = smooth(-1.5, 1.5, d);
  h += fbm(x * 0.06, z * 0.06, 3) * 0.18 * land;
  h += vnoise(x * 0.6, z * 0.6) * 0.02 * land;
  h += fbm(x * 0.12 + 50, z * 0.12, 2) * 0.35 * (1 - smooth(-6, -1, d));
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
  const wet = smooth(4, 0.3, d);
  const dk = 1 - 0.3 * wet;
  r *= dk; g *= dk; b *= dk;
  // fondale: verdognolo
  const uw = smooth(0, -3, d);
  r = r * (1 - uw) + 0.7 * uw; g = g * (1 - uw) + 0.78 * uw; b = b * (1 - uw) + 0.72 * uw;
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
    geo.attributes.color.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
    geo.computeVertexNormals();
  }

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
      const j1 = Math.min(this.job.row + 50, this.N + 1);
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
