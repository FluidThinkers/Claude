import * as THREE from 'three';

// Palette ricavate dalle foto: mattino blu profondo, tramonto con cintura di Venere rosa
// sul mare e cielo viola-grigio, sabbia che vira all'arancio.
const N = {
  zen: 0x020307, mid: 0x070a14, hor: 0x141a2a, sea: 0x05080f, sun: 0x8fa6d6, sunI: 0.5,
  hs: 0x2a3756, hg: 0x0e0e16, hI: 0.6, fog: 0.0014, exp: 1.35, grade: [0.9, 0.97, 1.15], label: 'Notte',
};

const RAW = [
  [0.0, N],
  [0.215, { zen: 0x10121e, mid: 0x3a2a34, hor: 0x8a4a3a, sea: 0x1e1a20, sun: 0xff7040, sunI: 0.3, hs: 0x4a5078, hg: 0x2a2224, hI: 0.7, fog: 0.0016, exp: 1.25, grade: [1.0, 0.95, 1.05], label: 'Prima luce' }],
  [0.27, { zen: 0x2a2836, mid: 0x8a4a3e, hor: 0xff7434, sea: 0x2a262c, sun: 0xff5a24, sunI: 2.2, hs: 0x6a5a68, hg: 0x3a2a24, hI: 0.75, fog: 0.0008, exp: 1.0, grade: [1.08, 0.93, 0.88], label: 'Alba' }],
  [0.305, { zen: 0x5a6276, mid: 0xb08458, hor: 0xf0a456, sea: 0x5e5446, sun: 0xffb060, sunI: 2.6, hs: 0x9a9aa8, hg: 0x7a6248, hI: 0.85, fog: 0.0012, exp: 1.0, grade: [1.08, 0.98, 0.88], label: 'Alba' }],
  [0.35, { zen: 0x1c46a8, mid: 0x3f78d0, hor: 0xb6d2f2, sea: 0x4f74a6, sun: 0xfff2de, sunI: 3.2, hs: 0x9cc0f2, hg: 0xa88a68, hI: 1.0, fog: 0.0007, exp: 1.0, grade: [0.98, 1.0, 1.04], label: 'Mattino' }],
  [0.5, { zen: 0x1a44aa, mid: 0x4682d8, hor: 0xc4dcf6, sea: 0x5f86ba, sun: 0xffffff, sunI: 3.4, hs: 0xa6c6f2, hg: 0xb09270, hI: 1.05, fog: 0.0007, exp: 1.0, grade: [1.0, 1.0, 1.02], label: 'Mezzogiorno' }],
  [0.63, { zen: 0x2856aa, mid: 0x6290d0, hor: 0xcddcec, sea: 0x6c88b0, sun: 0xfff0d6, sunI: 3.1, hs: 0xa6c0e6, hg: 0xb49270, hI: 1.0, fog: 0.0008, exp: 1.0, grade: [1.02, 1.0, 0.99], label: 'Pomeriggio' }],
  [0.705, { zen: 0x485b8e, mid: 0x9c8ca8, hor: 0xf4c39c, sea: 0x7c7c96, sun: 0xffb070, sunI: 3.0, hs: 0xb4a2b8, hg: 0xa07050, hI: 1.0, fog: 0.001, exp: 1.0, grade: [1.1, 0.98, 0.9], label: 'Ora dorata' }],
  [0.75, { zen: 0x241a22, mid: 0x7a3e36, hor: 0xff6a30, sea: 0x352628, sun: 0xff5422, sunI: 3.0, hs: 0x9a7488, hg: 0x9a5a40, hI: 1.1, fog: 0.0011, exp: 1.0, grade: [1.16, 0.9, 0.86], label: 'Tramonto' }],
  [0.8, { zen: 0x100c14, mid: 0x2e1e24, hor: 0x7a3a30, sea: 0x1a1418, sun: 0xff6a50, sunI: 0.6, hs: 0x5a4258, hg: 0x3a2420, hI: 0.75, fog: 0.0013, exp: 1.15, grade: [1.05, 0.92, 1.0], label: 'Crepuscolo' }],
  [0.87, N],
  [1.0, N],
];

const COLS = ['zen', 'mid', 'hor', 'sea', 'sun', 'hs', 'hg'];
const KEYS = RAW.map(([t, o]) => {
  const k = { t, label: o.label, sunI: o.sunI, hI: o.hI, fog: o.fog, exp: o.exp, grade: new THREE.Vector3(...o.grade) };
  for (const c of COLS) k[c] = new THREE.Color(o[c]);
  return k;
});

export const PHASES = [0.27, 0.35, 0.5, 0.705, 0.75, 0.8, 0.93];

export function makeState() {
  const s = { grade: new THREE.Vector3(), label: '' };
  for (const c of COLS) s[c] = new THREE.Color();
  return s;
}

export function evalPalette(t, s) {
  t = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  let f = (t - a.t) / (b.t - a.t);
  f = f * f * (3 - 2 * f);
  for (const c of COLS) s[c].copy(a[c]).lerp(b[c], f);
  s.sunI = a.sunI + (b.sunI - a.sunI) * f;
  s.hI = a.hI + (b.hI - a.hI) * f;
  s.fog = a.fog + (b.fog - a.fog) * f;
  s.exp = a.exp + (b.exp - a.exp) * f;
  s.grade.copy(a.grade).lerp(b.grade, f);
  s.label = f < 0.5 ? a.label : b.label;
  return s;
}

const D2R = Math.PI / 180;
// Il sole sorge sul mare e tramonta sulla terra (alle spalle del mare: cintura di Venere rosa sul mare)
export function sunDirection(t, out) {
  const day = (t - 0.24) / (0.775 - 0.24);
  const elev = Math.sin(day * Math.PI) * 1.08;
  const az = (-70 + 180 * day) * D2R;
  out.set(Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az));
  return elev;
}
