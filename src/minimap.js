import { shoreZ } from './terrain.js';

// Mappa: in alto a destra, nord = mare. Tocca o premi N per ingrandirla.
export class Minimap {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.big = false;
    this.frame = 0;
    canvas.addEventListener('click', () => this.toggle());
    canvas.addEventListener('touchstart', (e) => { this.toggle(); e.preventDefault(); e.stopPropagation(); }, { passive: false });
  }

  toggle() { this.big = !this.big; this.cv.classList.toggle('big', this.big); }

  draw(S) {
    if (this.frame++ % 3) return;
    const cv = this.cv, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = this.big ? W / 900 : W / 380; // pixel per metro
    const px = S.player.x, pz = S.player.z;
    const cx = W / 2, cy = H / 2;
    const toS = (x, z) => [cx + (x - px) * scale, cy + (z - pz) * scale];

    // mare
    c.fillStyle = 'rgba(40,80,105,0.78)'; c.fillRect(0, 0, W, H);
    // terra: tutto ciò che sta dietro la riva
    const x0 = px - W / 2 / scale - 10, x1 = px + W / 2 / scale + 10;
    const band = (d, color) => {
      c.beginPath();
      for (let i = 0; i <= 60; i++) { const x = x0 + (x1 - x0) * (i / 60); const [sx, sy] = toS(x, shoreZ(x) + d); i ? c.lineTo(sx, sy) : c.moveTo(sx, sy); }
      c.lineTo(W + 10, H + 10); c.lineTo(-10, H + 10); c.closePath();
      c.fillStyle = color; c.fill();
    };
    band(0, 'rgba(206,180,140,0.92)');
    band(64, 'rgba(196,186,166,0.95)');
    band(74, 'rgba(150,152,110,0.95)');
    band(220, 'rgba(118,128,90,0.95)');
    band(500, 'rgba(98,104,82,0.95)');
    // foce
    c.strokeStyle = 'rgba(70,120,140,0.95)'; c.lineWidth = Math.max(2, 7 * scale); c.beginPath();
    for (let d = -6, i = 0; d <= 58; d += 4, i++) { const x = S.foce.x + 7 * Math.sin(d * 0.06) + 2 * Math.sin(d * 0.17 + 1); const [sx, sy] = toS(x, shoreZ(x) + d); i ? c.lineTo(sx, sy) : c.moveTo(sx, sy); }
    c.stroke();
    // pontile e scogliera
    const line = (a, b, w, col) => { const [ax, ay] = toS(a.x, a.z), [bx, by] = toS(b.x, b.z); c.strokeStyle = col; c.lineWidth = Math.max(1.5, w * scale); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); };
    line(S.pontile[0], S.pontile[1], 2.3, 'rgba(120,95,70,1)');
    line(S.scogliera[0], S.scogliera[1], 6, 'rgba(120,118,112,1)');

    // simboli
    const dot = (x, z, r, fill, stroke) => {
      let [sx, sy] = toS(x, z);
      const m = 7, off = sx < m || sy < m || sx > W - m || sy > H - m;
      sx = Math.max(m, Math.min(W - m, sx)); sy = Math.max(m, Math.min(H - m, sy));
      c.beginPath(); c.arc(sx, sy, off ? r * 0.7 : r, 0, 7);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
      return [sx, sy, off];
    };
    const label = (x, z, txt, col = 'rgba(255,255,255,0.9)') => {
      if (!this.big) return;
      const [sx, sy] = toS(x, z);
      if (sx < 10 || sy < 14 || sx > W - 10 || sy > H) return;
      c.font = '10px system-ui, sans-serif'; c.fillStyle = col; c.textAlign = 'center'; c.fillText(txt, sx, sy - 8);
    };
    for (const p of S.places) { dot(p.x, p.z, 2.5, 'rgba(255,255,255,0.75)'); label(p.x, p.z, p.name); }
    for (const v of S.vehicles) { dot(v.x, v.z, 4, v.color, 'rgba(0,0,0,0.5)'); label(v.x, v.z, v.name, v.color); }
    for (const t of S.traces) dot(t.x, t.z, 3, t.found ? 'rgba(255,214,150,1)' : null, t.found ? null : 'rgba(255,214,150,0.9)');
    if (S.figure) dot(S.figure.x, S.figure.z, 3.5, 'rgba(240,235,225,1)', 'rgba(0,0,0,0.6)');

    // tu
    c.save(); c.translate(cx, cy); c.rotate(-S.yaw);
    c.beginPath(); c.moveTo(0, -8); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath();
    c.fillStyle = '#fff'; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1; c.stroke();
    c.restore();
    // scala
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.font = '9px system-ui, sans-serif'; c.textAlign = 'left';
    const m = this.big ? 200 : 50;
    c.fillRect(8, H - 10, m * scale, 1.5); c.fillText(m + ' m', 8, H - 14);
  }
}
