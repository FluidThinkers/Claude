import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Sabbia con granulosità e ciottoli sparsi (come in primo piano nelle foto)
export function sandTextures() {
  const S = 1024;
  const col = document.createElement('canvas'); col.width = col.height = S;
  const bmp = document.createElement('canvas'); bmp.width = bmp.height = S;
  const c = col.getContext('2d'), b = bmp.getContext('2d');
  const img = c.createImageData(S, S), bimg = b.createImageData(S, S);
  const r = rng(7);
  // granelli a più scale: macchie larghe, grana media, singoli granelli chiari e scuri
  const blot = new Float32Array(64 * 64).map(() => r());
  const bl = (x, y) => { const gx = x / S * 64, gy = y / S * 64, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const a = blot[(iy & 63) * 64 + (ix & 63)], b = blot[(iy & 63) * 64 + ((ix + 1) & 63)], c = blot[((iy + 1) & 63) * 64 + (ix & 63)], d = blot[((iy + 1) & 63) * 64 + ((ix + 1) & 63)];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; };
  for (let i = 0; i < S * S; i++) {
    const x = i % S, y = (i / S) | 0;
    const n = r();
    const grain = n < 0.03 ? 0.62 : n > 0.985 ? 1.28 : 0.9 + n * 0.16;
    const v = grain * (0.93 + 0.12 * bl(x, y));
    const hue = n < 0.05 ? [0.92, 0.9, 0.95] : n > 0.97 ? [1.05, 0.98, 0.9] : [1, 1, 1];
    img.data[i * 4] = Math.min(255, 192 * v * hue[0]); img.data[i * 4 + 1] = Math.min(255, 164 * v * hue[1]); img.data[i * 4 + 2] = Math.min(255, 130 * v * hue[2]); img.data[i * 4 + 3] = 255;
    const bv = 100 + n * 70 + bl(x, y) * 30;
    bimg.data[i * 4] = bimg.data[i * 4 + 1] = bimg.data[i * 4 + 2] = bv; bimg.data[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0); b.putImageData(bimg, 0, 0);
  const tones = ['#8a8580', '#c9c4bc', '#6f6a66', '#a89a88', '#e8e2d8', '#5b5552', '#9c7a5c'];
  for (let k = 0; k < 420; k++) {
    const x = r() * S, y = r() * S;
    const rad = 0.8 + Math.pow(r(), 3) * 7;
    const rot = r() * Math.PI;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const px = x + ox * S, py = y + oy * S;
      c.save(); c.translate(px, py); c.rotate(rot);
      c.fillStyle = tones[(r() * tones.length) | 0];
      c.beginPath(); c.ellipse(0, 0, rad, rad * (0.6 + r() * 0.3), 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.beginPath(); c.ellipse(-rad * 0.25, -rad * 0.25, rad * 0.4, rad * 0.25, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      b.save(); b.translate(px, py); b.rotate(rot);
      const gr = b.createRadialGradient(0, 0, 0, 0, 0, rad);
      gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      b.fillStyle = gr; b.beginPath(); b.ellipse(0, 0, rad, rad * 0.75, 0, 0, Math.PI * 2); b.fill();
      b.restore();
    }
  }
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(bmp);
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, bump };
}

export function concreteTexture() {
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const r = rng(3);
  c.fillStyle = '#9b9a95'; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) {
    const g = 120 + r() * 70 | 0;
    c.fillStyle = `rgba(${g},${g},${g - 4},${0.15 + r() * 0.2})`;
    c.fillRect(r() * S, r() * S, 1 + r() * 4, 1 + r() * 4);
  }
  c.strokeStyle = 'rgba(70,70,68,0.45)'; c.lineWidth = 1.5;
  for (let y = 0; y < S; y += 64) { c.beginPath(); c.moveTo(0, y + r() * 4); c.lineTo(S, y + r() * 4); c.stroke(); }
  c.fillStyle = 'rgba(210,190,150,0.25)';
  for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(r() * S, r() * S, 3 + r() * 14, 0, 7); c.fill(); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function glowTexture() {
  const S = 128;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,240,220,0.6)');
  g.addColorStop(0.45, 'rgba(255,220,190,0.15)');
  g.addColorStop(1, 'rgba(255,200,170,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}
