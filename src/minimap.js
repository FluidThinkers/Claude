import { shoreZ } from './terrain.js';

// Mappa: in alto a destra, nord = mare. Tocca o premi N per ingrandirla.
export class Minimap {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.big = false;
    this.frame = 0;
    this.zoom = 1;
    canvas.addEventListener('wheel', (e) => { this.setZoom(this.zoom * (e.deltaY > 0 ? 0.85 : 1.18)); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('click', () => this.toggle());
    canvas.addEventListener('touchstart', (e) => { this.toggle(); e.preventDefault(); e.stopPropagation(); }, { passive: false });
  }

  toggle() { this.big = !this.big; this.cv.classList.toggle('big', this.big); document.getElementById('mapZoom').classList.toggle('on', this.big); }
  setZoom(z) { this.zoom = Math.max(0.25, Math.min(6, z)); this.frame = 0; }

  draw(S) {
    if (this.frame++ % 3) return;
    const cv = this.cv, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = (this.big ? W / 900 : W / 380) * this.zoom; // pixel per metro
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
    // isola
    if (S.island) {
      const [ix, iy] = toS(S.island.x, S.island.z);
      c.beginPath(); c.ellipse(ix, iy, S.island.r * 0.95 * scale, S.island.r * 0.8 * scale, 0.3, 0, 7);
      c.fillStyle = S.bloom > 0.5 ? 'rgba(120,150,90,0.95)' : 'rgba(196,176,140,0.95)'; c.fill();
    }
    // foce
    c.strokeStyle = 'rgba(70,120,140,0.95)'; c.lineWidth = Math.max(2, 7 * scale); c.beginPath();
    for (let d = -6, i = 0; d <= 58; d += 4, i++) { const x = S.foce.x + 7 * Math.sin(d * 0.06) + 2 * Math.sin(d * 0.17 + 1); const [sx, sy] = toS(x, shoreZ(x) + d); i ? c.lineTo(sx, sy) : c.moveTo(sx, sy); }
    c.stroke();
    // pontile e scogliera
    const line = (a, b, w, col) => { const [ax, ay] = toS(a.x, a.z), [bx, by] = toS(b.x, b.z); c.strokeStyle = col; c.lineWidth = Math.max(1.5, w * scale); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); };
    line(S.pontile[0], S.pontile[1], 2.3, 'rgba(120,95,70,1)');
    if (S.molo) line(S.molo[0], S.molo[1], 7, 'rgba(130,128,120,1)');
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
    if (S.zone) {
      const [zx, zy] = toS(S.zone.x, S.zone.z);
      const zr = Math.max(10, S.zone.r * scale);
      const t = performance.now() / 1000;
      c.beginPath(); c.arc(Math.max(zr * 0.3, Math.min(W - zr * 0.3, zx)), Math.max(zr * 0.3, Math.min(H - zr * 0.3, zy)), zr * (0.92 + 0.08 * Math.sin(t * 2)), 0, 7);
      c.fillStyle = 'rgba(110,220,130,0.14)'; c.fill();
      c.setLineDash([3, 3]); c.strokeStyle = 'rgba(150,240,160,0.85)'; c.lineWidth = 1.2; c.stroke(); c.setLineDash([]);
    }
    if (S.discZone) {
      const [zx, zy] = toS(S.discZone.x, S.discZone.z);
      const zr = Math.max(9, S.discZone.r * scale);
      c.beginPath(); c.arc(Math.max(zr * 0.3, Math.min(W - zr * 0.3, zx)), Math.max(zr * 0.3, Math.min(H - zr * 0.3, zy)), zr, 0, 7);
      c.fillStyle = 'rgba(150,220,235,0.15)'; c.fill();
      c.setLineDash([2, 4]); c.strokeStyle = 'rgba(170,230,240,0.85)'; c.lineWidth = 1.2; c.stroke(); c.setLineDash([]);
    }
    for (const p of S.places) { dot(p.x, p.z, 2.5, 'rgba(255,255,255,0.75)'); label(p.x, p.z, p.name); }
    for (const v of S.vehicles) { dot(v.x, v.z, 4, v.color, 'rgba(0,0,0,0.5)'); label(v.x, v.z, v.name, v.color); }
    // ricordi della storia: verdi. Pieni quelli trovati, il prossimo pulsa
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    for (const t of S.traces) {
      if (t.found) dot(t.x, t.z, 3.2, 'rgba(110,220,130,1)', 'rgba(0,0,0,0.45)');
      else { const [sx, sy] = dot(t.x, t.z, 4.5, `rgba(110,220,130,${0.35 + 0.5 * pulse})`, 'rgba(160,255,170,1)'); c.beginPath(); c.arc(sx, sy, 6 + 5 * pulse, 0, 7); c.strokeStyle = `rgba(140,240,150,${0.7 * (1 - pulse)})`; c.lineWidth = 1.5; c.stroke(); }
    }
    if (S.figure) dot(S.figure.x, S.figure.z, 3.5, 'rgba(240,235,225,1)', 'rgba(0,0,0,0.6)');

    // frecce verso il prossimo passo della storia e verso la scoperta
    const arrow = (z, col) => {
      if (!z) return;
      const dx = (z.x - px) * scale, dy = (z.z - pz) * scale;
      const dist = Math.hypot(z.x - px, z.z - pz);
      const rr = Math.hypot(dx, dy);
      const lim = (this.big ? Math.min(W, H) / 2 : W / 2) - 14;
      if (rr < lim - 4) return;
      const a = Math.atan2(dy, dx);
      const ax = cx + Math.cos(a) * lim, ay = cy + Math.sin(a) * lim;
      c.save(); c.translate(ax, ay); c.rotate(a);
      c.beginPath(); c.moveTo(9, 0); c.lineTo(-5, -6); c.lineTo(-2, 0); c.lineTo(-5, 6); c.closePath();
      c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.stroke();
      c.restore();
      c.font = '9px system-ui, sans-serif'; c.fillStyle = col; c.textAlign = 'center';
      c.fillText(dist > 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m', cx + Math.cos(a) * (lim - 16), cy + Math.sin(a) * (lim - 16) + 3);
    };
    arrow(S.zone, 'rgba(130,235,145,1)');
    arrow(S.discZone, 'rgba(170,230,240,1)');
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
