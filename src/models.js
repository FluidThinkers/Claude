import * as THREE from 'three';

// Modelli dei mezzi: scafi a sezioni vere, linee pulite, materiali lucidi.

// micro-variazioni e polvere: niente superfici di plastica perfetta
let _dust = null, _rough = null;
function dustTex() {
  if (_dust) return _dust;
  _dust = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const a = Math.random() * 0.12; c.fillStyle = `rgba(150,120,85,${a})`; const r = Math.random() * 2.2; c.fillRect(Math.random() * w, Math.random() * h, r, r); }
    const g = c.createLinearGradient(0, h, 0, h * 0.4); g.addColorStop(0, 'rgba(165,130,90,0.35)'); g.addColorStop(1, 'rgba(165,130,90,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  return _dust;
}
function roughTex() {
  if (_rough) return _rough;
  _rough = canvasTex(256, 256, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 150 + Math.random() * 60; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
    for (let i = 0; i < 300; i++) { c.strokeStyle = `rgba(255,255,255,${Math.random() * 0.25})`; c.beginPath(); const x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 6); c.stroke(); }
  });
  _rough.colorSpace = THREE.NoColorSpace;
  return _rough;
}
export function seatTex() {
  return canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#1b1b1b'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 * 4; x < w; x += 8) { c.fillStyle = '#262626'; c.fillRect(x, y, 4, 4); }
    c.strokeStyle = '#3a3a3a'; c.setLineDash([3, 3]); c.lineWidth = 1.5; c.strokeRect(6, 6, w - 12, h - 12);
  });
}

export const mat = {
  dusty: (c, r = 0.35, m = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, map: dustTex(), roughnessMap: roughTex() }),
  gelcoat: (c = 0xf4f2ec) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.22, metalness: 0.0, vertexColors: true }),
  paint: (c, r = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0.05 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0xdfe2e4, roughness: 0.18, metalness: 0.95 }),
  dark: (r = 0.45) => new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: r, metalness: 0.3 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x1a1918, roughness: 0.95, map: dustTex(), roughnessMap: roughTex() }),
};

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

export function teakTexture() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#a77a4e'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      const t = 150 + Math.random() * 30 | 0;
      c.fillStyle = `rgb(${t + 20},${t - 15},${t - 60})`; c.fillRect(0, y + 1, w, 13);
      for (let k = 0; k < 20; k++) { c.fillStyle = `rgba(90,60,35,${0.06 + Math.random() * 0.1})`; c.fillRect(Math.random() * w, y + 2 + Math.random() * 11, 30 + Math.random() * 90, 1); }
      c.fillStyle = '#2a2420'; c.fillRect(0, y + 14, w, 2);
    }
  });
}

/**
 * Scafo a sezioni: lunghezza lungo x (prua a -x), larghezza lungo z, altezza y.
 * o: { len, beam, depth, sheer, bowFine, transom, deadrise, waterline, bottomColor, topColor, stripeY, stripeColor }
 */
export function hullGeometry(o) {
  const NS = 48, NV = 14;
  const pos = [], col = [], idx = [];
  const cTop = new THREE.Color(o.topColor ?? 0xf4f2ec), cBot = new THREE.Color(o.bottomColor ?? 0x1c2f4a), cStr = new THREE.Color(o.stripeColor ?? 0x1c2f4a);
  const outlineR = [];
  const station = (t) => {
    // t: 0 prua, 1 poppa
    const w = o.beam / 2 * Math.pow(Math.sin(Math.min(1, t * (o.bowFine ?? 1.7)) * Math.PI / 2), 0.85) * (1 - (1 - (o.transom ?? 0.85)) * Math.pow(Math.max(0, t - 0.6) / 0.4, 2));
    const top = o.depth * 0.5 + (o.sheer ?? 0.2) * Math.pow(1 - t, 2.2) - (o.sheer ?? 0.2) * 0.15 * t;
    const keel = -o.depth * 0.5 + o.depth * 0.75 * Math.pow(Math.max(0, 1 - t / 0.28), 2) + (o.sternRise ?? 0) * Math.pow(Math.max(0, t - 0.75) / 0.25, 2);
    return { w, top, keel };
  };
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NS; i++) {
      const t = i / NS, x = -o.len / 2 + o.len * t;
      const S = station(t);
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        // sezione: fondo a V (deadrise) che si apre in murata svasata
        const dr = o.deadrise ?? 0.25;
        const zz = S.w * Math.pow(Math.sin(v * Math.PI / 2), 0.55);
        const yy = S.keel + (S.top - S.keel) * (v * (1 - dr) + dr * v * v) ;
        pos.push(x, yy, side * zz);
        const wl = o.waterline ?? 0;
        let c = yy < wl ? cBot : cTop;
        if (o.stripeY !== undefined && Math.abs(yy - o.stripeY) < (o.stripeW ?? 0.06)) c = cStr;
        col.push(c.r, c.g, c.b);
        if (j === NV && side === 1) outlineR.push(new THREE.Vector3(x, yy, zz));
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NV; j++) {
      const a = base + i * (NV + 1) + j, b = a + 1, c = a + NV + 1, d = c + 1;
      if (side === 1) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  // specchio di poppa
  {
    const base = pos.length / 3;
    const t = 1, S = station(t), x = o.len / 2;
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, dr = o.deadrise ?? 0.25;
      const zz = S.w * Math.pow(Math.sin(v * Math.PI / 2), 0.55);
      const yy = S.keel + (S.top - S.keel) * (v * (1 - dr) + dr * v * v);
      pos.push(x, yy, zz, x, yy, -zz);
      const c = yy < (o.waterline ?? 0) ? cBot : cTop;
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let j = 0; j < NV; j++) { const a = base + j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.outline = outlineR;
  return g;
}

// coperta: riempie il profilo superiore dello scafo, un filo sotto l'orlo
export function deckGeometry(outline, drop = 0.06, inset = 0.04) {
  const pos = [], idx = [];
  outline.forEach((p, i) => { const z = Math.max(0, p.z - inset); pos.push(p.x, p.y - drop, z, p.x, p.y - drop, -z); });
  for (let i = 0; i < outline.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = []; outline.forEach((p) => { uv.push(p.x * 0.6, 0, p.x * 0.6, 1); });
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// tubo morbido lungo una serie di punti (tientibene, telai)
export function tube(points, r, material, seg = 64, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 10, closed), material);
}

// gunwale: orlo dello scafo su entrambi i lati
export function rubRail(outline, r, material) {
  const g = new THREE.Group();
  for (const s of [1, -1]) g.add(tube(outline.map((p) => new THREE.Vector3(p.x, p.y, p.z * s)), r, material, 80));
  return g;
}

export function roundedBox(w, h, d, r, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-ix, Math.min(ix, v.x)), Math.max(-iy, Math.min(iy, v.y)), Math.max(-iz, Math.min(iz, v.z)));
    const off = v.clone().sub(c);
    if (off.lengthSq() > 1e-9) v.copy(c).add(off.normalize().multiplyScalar(r));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function shadowAll(o) { o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; }
