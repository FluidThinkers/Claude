import * as THREE from 'three';
import { heightAt, shoreZ } from './terrain.js';

// Le forme: in un pensiero ci si trasferisce nelle cose. Acqua, onda, nuvola, gabbiano, albero, sabbia.
// Ognuna si muove come la cosa vera.

export const FORM_TEXT = {
  gull: { name: 'Gabbiano', unlock: 'Lo guardi alzarsi. Per un attimo senti il vento sotto le braccia.', enter: 'Sei un gabbiano.' },
  tree: { name: 'Albero', unlock: 'Appoggi la mano al tronco. È caldo di sole, e lento.', enter: 'Sei un albero. Il tempo passa più in fretta di te.' },
  sand: { name: 'Sabbia', unlock: 'Resti fermo, e il vento comincia a portarti via, un granello alla volta.', enter: 'Sei sabbia. Vai dove va il vento.' },
  wave: { name: 'Onda', unlock: 'L\'acqua che hai sollevato non torna giù: corre verso riva.', enter: 'Sei un\'onda.' },
  cloud: { name: 'Nuvola', unlock: 'Ti sciogli sulla riva, e il sole ti solleva piano.', enter: 'Sei una nuvola.' },
  fish: { name: 'Pesce', unlock: 'Il fondo ti chiama, e l\'acqua non pesa più.', enter: 'Sei un pesce.' },
  rain: { name: 'Pioggia', unlock: 'Diventi pesante, e cadi.', enter: 'Diventi pioggia.' },
  cat: { name: 'Gatto', unlock: 'Un gatto ti guarda dal muretto, senza fretta.', enter: 'Sei un gatto.' },
  light: { name: 'Luce', enter: '' },
  ant: { name: 'Formica', enter: 'Sei una formica. Ogni granello è una pietra.' },
  petal: { name: 'Petalo', unlock: 'Un petalo si stacca, e tu con lui.', enter: 'Sei un petalo. Il vento sa dove andare.' },
  wind: { name: 'Vento', unlock: 'Il petalo si posa. Tu continui.', enter: 'Sei vento. Nessuno ti vede, tutti ti sentono.' },
};

// ali in prima persona: gabbiano reale, mantello grigio perla, punte nere con macchie bianche.
// Ogni ala ha braccio (copritrici + secondarie) e mano (remiganti primarie separate, che si aprono).
function featherTex() {
  const W = 256, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f2f1ee'); g.addColorStop(0.35, '#c9ccd0'); g.addColorStop(1, '#b4b8bd');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // file di copritrici: archi sottili
  c.strokeStyle = 'rgba(90,95,100,0.1)'; c.lineWidth = 1;
  for (let row = 0; row < 6; row++) for (let x = -10; x < W + 10; x += 8 + row * 2) { c.beginPath(); c.arc(x + (row % 2) * 4, 14 + row * 13, 5 + row, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
  // secondarie lungo il bordo d'uscita, punta bianca
  for (let x = 0; x < W; x += 12) { c.fillStyle = '#aeb3b8'; c.beginPath(); c.moveTo(x, 92); c.lineTo(x + 12, 92); c.lineTo(x + 10, 124); c.quadraticCurveTo(x + 6, 128, x + 2, 124); c.fill(); c.strokeStyle = 'rgba(70,75,80,0.35)'; c.stroke(); c.fillStyle = '#f4f4f2'; c.fillRect(x + 2, 118, 8, 6); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function primaryTex() {
  const W = 64, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#b9bdc2'; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, H * 0.35, 0, H * 0.55); g.addColorStop(0, 'rgba(25,25,27,0)'); g.addColorStop(1, 'rgba(25,25,27,1)');
  c.fillStyle = g; c.fillRect(0, H * 0.35, W, H * 0.65);
  c.fillStyle = '#f5f5f3'; c.beginPath(); c.ellipse(W / 2, H * 0.83, W * 0.28, H * 0.05, 0, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W * 0.45, 0); c.lineTo(W * 0.5, H); c.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function gullWings() {
  const g = new THREE.Group();
  const armM = new THREE.MeshStandardMaterial({ map: featherTex(), roughness: 0.85, side: THREE.DoubleSide });
  const primM = new THREE.MeshStandardMaterial({ map: primaryTex(), roughness: 0.75, side: THREE.DoubleSide });
  const mk = (s) => {
    const root = new THREE.Group();
    // braccio: superficie curva (profilo d'ala), più spessa al bordo d'attacco
    const arm = new THREE.PlaneGeometry(0.62, 0.3, 14, 6);
    const p = arm.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.31, y0 = p.getY(i), y = y0 * (1 - 0.35 * x / 0.62) - 0.03 * x; const camber = 0.03 * Math.cos((y0 / 0.3) * Math.PI); p.setXYZ(i, x * s, camber - x * 0.04, -y - 0.02 * Math.sin(x * 4)); }
    arm.computeVertexNormals();
    const armMesh = new THREE.Mesh(arm, armM); root.add(armMesh);
    // mano: perno al polso, 9 primarie a ventaglio
    const hand = new THREE.Group(); hand.position.set(0.6 * s, -0.03, 0); root.add(hand);
    const prim = new THREE.PlaneGeometry(0.075, 0.5, 1, 6);
    { const q = prim.attributes.position; for (let i = 0; i < q.count; i++) { const y = q.getY(i) + 0.25; q.setXYZ(i, q.getX(i), 0.02 * Math.sin(y * 4), -y); } prim.rotateY(0); prim.computeVertexNormals(); }
    const feathers = [];
    for (let k = 0; k < 9; k++) {
      const f = new THREE.Mesh(prim, primM);
      const a = (k / 8) * 1.1 - 0.15;
      f.position.set(s * (0.02 + k * 0.012), 0, -0.02 - k * 0.02);
      f.rotation.y = -s * (Math.PI / 2 - a);
      f.scale.y = 0.8 + 0.25 * Math.sin((k / 8) * Math.PI);
      f.userData.a = a; hand.add(f); feathers.push(f);
    }
    // piccola copertura scura sul polso
    const cov = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.16), armM); cov.rotation.x = -Math.PI / 2; cov.position.set(s * 0.07, 0.005, -0.05); hand.add(cov);
    // le ali partono ai lati, appena sotto lo sguardo, e vanno all'indietro: si vedono il bordo e le punte
    root.position.set(0.34 * s, -0.24, -0.34);
    root.rotation.set(0.1, -s * 0.3, 0);
    root.scale.setScalar(0.9);
    return { root, hand, feathers, s };
  };
  const L = mk(-1), R = mk(1);
  g.add(L.root, R.root);
  // compatibilità: L/R ruotano su z come prima, ma l'animazione vera è in flapWings
  g.userData = { L: L.root, R: R.root, W: [L, R] };
  g.visible = false;
  return g;
}
// battito: il braccio ruota, la mano segue in ritardo e si piega; in planata le primarie si allargano
export function flapWings(g, flap, bank, glide) {
  for (const w of g.userData.W) {
    const s = w.s;
    w.root.rotation.z = -s * (flap - 0.12) - bank * 0.4;
    w.hand.rotation.z = -s * flap * 0.7;
    w.hand.rotation.y = s * (0.15 - glide * 0.12);
    w.feathers.forEach((f, k) => { f.rotation.y = -s * (Math.PI / 2 - f.userData.a * (0.8 + glide * 0.35)); });
  }
}

const tmp = new THREE.Vector3();

// movimento di ogni forma. P: giocatore; ctx: { dt, fx, fz, run, up, down, jump, lvl, wind, windDir, time, trees }
export function moveForm(form, P, ctx) {
  const { dt, fx, fz, run, lvl } = ctx;
  const ys = Math.sin(P.yaw), yc = Math.cos(P.yaw);
  const ground = Math.max(heightAt(P.pos.x, P.pos.z), lvl);
  let eye = 0, roll = 0, out = {};

  if (form === 'gull' && P.landed) {
    // posato: cammina a piccoli passi su sabbia, legno, ferro, scogli; galleggia sull'acqua. Spazio: riprende il volo
    const sp = fz > 0 ? 1.3 : fz < 0 ? -0.5 : 0;
    P.yaw -= fx * 1.8 * dt;
    const nx = P.pos.x - ys * sp * dt, nz = P.pos.z - yc * sp * dt;
    const gN = Math.max(ctx.groundAt(nx, nz, P.pos.y + 0.4), lvl);
    if (gN < P.pos.y + 0.6) { P.pos.x = nx; P.pos.z = nz; }
    const gr = Math.max(ctx.groundAt(P.pos.x, P.pos.z, P.pos.y + 0.4), lvl);
    P.pos.y += (gr + 0.28 + Math.abs(Math.sin(ctx.time * 9)) * 0.02 * Math.abs(sp) - P.pos.y) * Math.min(1, dt * 8);
    roll = Math.sin(ctx.time * 9) * 0.03 * Math.abs(sp);
    out.speed = Math.abs(sp); out.flap = 0;
    if (ctx.up) { P.landed = false; P.gs = 9; P.pos.y += 0.8; P.pitch = 0.25; out.takeoff = true; }
  } else if (form === 'gull') {
    // volo: lo sguardo guida la quota, A/D virano, Spazio batte le ali
    P.gs = P.gs ?? 11;
    const target = fz > 0 ? (run ? 20 : 15) : fz < 0 ? 6 : 11;
    P.gs += (target - P.gs) * Math.min(1, dt * (fz < 0 ? 2.2 : 0.8));
    P.bank = (P.bank || 0) + ((fx * 0.6) - (P.bank || 0)) * Math.min(1, dt * 2.5);
    P.yaw -= Math.tan(P.bank) * 9.8 / Math.max(P.gs, 6) * dt;
    const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    let vy = sp * P.gs - 0.6 + (ctx.up ? 3.5 : 0);
    P.pos.x += -ys * cp * P.gs * dt; P.pos.z += -yc * cp * P.gs * dt; P.pos.y += vy * dt;
    const surf = ctx.groundAt ? Math.max(ctx.groundAt(P.pos.x, P.pos.z, P.pos.y + 0.5), lvl) : ground;
    // tuffo: in picchiata sull'acqua aperta entri sotto, per un attimo, e risali
    const overSea = heightAt(P.pos.x, P.pos.z) < lvl - 1.2 && surf <= lvl + 0.01;
    if (!P.diving && overSea && P.pos.y < lvl + 1.3 && P.pitch < -0.35 && P.gs > 8) { P.diving = 1.4; out.plunge = true; }
    if (P.diving) {
      P.diving -= dt; const k = Math.max(0, P.diving / 1.4);
      P.pos.y = lvl + 0.3 - 1.9 * Math.sin(Math.PI * (1 - k));
      if (P.diving <= 0) { P.diving = 0; P.pos.y = lvl + 1.2; P.gs = 9; P.pitch = 0.3; out.emerge = true; }
      out.speed = P.gs; out.flap = 0;
      return { eye, roll, ...out };
    }
    if (P.pos.y < surf + 0.8) { P.pos.y = surf + 0.8; }
    // indietro vicino a una superficie: frena e si posa
    if (fz < 0 && P.pos.y - surf < 3 && P.gs < 8.5) { P.landed = true; out.landed = true; }
    P.pos.y = Math.min(P.pos.y, 400);
    P.flap = (P.flap || 0) + dt * (ctx.up || fz > 0 ? 10 : 2.5);
    // a pelo d'acqua in picchiata: tocchi il mare (per pescare)
    out.touchWater = heightAt(P.pos.x, P.pos.z) < lvl - 0.8 && P.pos.y < lvl + 0.95 && P.gs > 9;
    roll = P.bank * 0.9;
    out.flap = Math.sin(P.flap) * (ctx.up || fz > 0 ? 0.5 : 0.15);
    out.speed = P.gs;
  } else if (form === 'tree') {
    // fermo in cima alla chioma; il vento ti muove appena; il tempo corre
    const w = ctx.wind;
    P.pos.x = P.treeX + Math.sin(ctx.time * 1.1) * 0.25 * w; P.pos.z = P.treeZ + Math.cos(ctx.time * 0.9) * 0.18 * w;
    P.pos.y = P.treeY;
    roll = Math.sin(ctx.time * 1.3) * 0.02 * w;
    out.timeScale = 40;
    out.speed = 0;
  } else if (form === 'sand') {
    // a filo del suolo, portato dal vento; puoi solo deviare un poco
    const w = 1.5 + ctx.wind * 6;
    let wx = ctx.windDir.x, wz = ctx.windDir.y;
    if (ctx.target) { const tx = ctx.target.x - P.pos.x, tz = ctx.target.z - P.pos.z, tl = Math.hypot(tx, tz) || 1; wx = wx * 0.25 + tx / tl * 0.75; wz = wz * 0.25 + tz / tl * 0.75; const wl = Math.hypot(wx, wz); wx /= wl; wz /= wl; }
    const dx = wx * w + (-ys * fz + yc * fx) * 2;
    const dz = wz * w + (-yc * fz - ys * fx) * 2;
    P.pos.x += dx * dt; P.pos.z += dz * dt;
    const h = heightAt(P.pos.x, P.pos.z);
    const hm = Math.max(h, heightAt(P.pos.x + 0.8, P.pos.z), heightAt(P.pos.x - 0.8, P.pos.z), heightAt(P.pos.x, P.pos.z + 0.8), heightAt(P.pos.x, P.pos.z - 0.8));
    P.pos.y += (hm + 0.32 + Math.abs(Math.sin(ctx.time * 3)) * 0.08 * ctx.wind - P.pos.y) * Math.min(1, dt * 8);
    out.speed = Math.hypot(dx, dz);
    out.inWater = lvl - h > 0.05;
    out.dune = ctx.jump;
  } else if (form === 'fish') {
    // pesce: veloce e morbido sott'acqua, non esce mai dall'acqua
    const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    const speed = fz > 0 ? (run ? 10 : 5.5) : fz < 0 ? -2 : 0;
    P.fv = (P.fv || 0) + (speed - (P.fv || 0)) * Math.min(1, dt * 2.5);
    { // il pesce resta nel suo elemento: l'acqua bassa lo ferma
      const nx = P.pos.x + (-ys * cp * P.fv + Math.cos(P.yaw) * fx * 2.5) * dt, nz = P.pos.z + (-yc * cp * P.fv - Math.sin(P.yaw) * fx * 2.5) * dt;
      if (lvl - heightAt(nx, nz) > 0.8) { P.pos.x = nx; P.pos.z = nz; } else { P.fv *= 0.5; out.blocked = true; }
    }
    const floor = heightAt(P.pos.x, P.pos.z) + 0.3;
    // salto: veloce, vicino alla superficie, Spazio → fuori dall'acqua per un attimo
    if (!P.leap && ctx.jump && P.pos.y > lvl - 1.6 && P.fv > 3) { P.leap = true; P.vy = 4.5 + P.fv * 0.25; out.leapStart = true; }
    if (P.leap) {
      P.pos.y += P.vy * dt; P.vy -= 9.8 * dt;
      if (P.vy < 0 && P.pos.y < lvl - 0.35) { P.leap = false; out.reentry = true; }
    } else {
      P.pos.y += (sp * P.fv + (ctx.up ? 2 : 0) - (ctx.down ? 2 : 0)) * dt;
      P.pos.y = Math.max(floor, Math.min(P.pos.y, lvl - 0.35));
    }
    roll = Math.sin(ctx.time * 6 * (0.3 + Math.abs(P.fv) / 8)) * 0.04;
    out.speed = Math.abs(P.fv);
    out.shallow = lvl - heightAt(P.pos.x, P.pos.z) < 0.6;
  } else if (form === 'rain') {
    // pioggia: cadi, il vento ti sposta un poco
    P.pos.x += ctx.windDir.x * 3 * dt; P.pos.z += ctx.windDir.y * 3 * dt;
    P.pos.y -= 32 * dt;
    out.landed = P.pos.y < ground + 1.2;
    out.speed = 32;
  } else if (form === 'light') {
    // il finale: ti alzi piano sopra l'acqua della sera
    P.pos.x += -ys * 1.5 * dt; P.pos.z += -yc * 1.5 * dt;
    P.pos.y += (lvl + 30 - P.pos.y) * Math.min(1, dt * 0.05);
    out.speed = 2;
  } else if (form === 'ant') {
    // formica: rasoterra, il mondo diventa enorme; A e D girano, W avanza; l'acqua è un muro
    const sp = fz > 0 ? (run ? 4.2 : 2.4) : fz < 0 ? -1 : 0;
    P.yaw -= fx * 2.0 * dt;
    const nx = P.pos.x - ys * sp * dt, nz = P.pos.z - yc * sp * dt;
    if (heightAt(nx, nz) > lvl + 0.03) { P.pos.x = nx; P.pos.z = nz; }
    P.pos.y = heightAt(P.pos.x, P.pos.z) + 0.05 + Math.abs(Math.sin(ctx.time * 18)) * 0.004 * Math.abs(sp);
    roll = Math.sin(ctx.time * 9) * 0.01 * Math.abs(sp);
    out.speed = Math.abs(sp);
  } else if (form === 'petal') {
    // petalo: leggero, portato dal vento, ondeggia; puoi solo inclinarti un poco
    const w = 3 + ctx.wind * 6;
    let wx = ctx.windDir.x, wz = ctx.windDir.y;
    if (ctx.target) { const tx = ctx.target.x - P.pos.x, tz = ctx.target.z - P.pos.z, tl = Math.hypot(tx, tz) || 1; wx = wx * 0.3 + tx / tl * 0.7; wz = wz * 0.3 + tz / tl * 0.7; const wl = Math.hypot(wx, wz); wx /= wl; wz /= wl; }
    P.pos.x += (wx * w + (-ys * fz + yc * fx) * 4) * dt;
    P.pos.z += (wz * w + (-yc * fz - ys * fx) * 4) * dt;
    const fl = Math.sin(ctx.time * 2.3) * 0.8 + Math.sin(ctx.time * 5.1) * 0.3;
    P.pos.y += (fl + (ctx.up ? 2 : 0) - (ctx.down ? 2 : 0)) * dt;
    P.pos.y = Math.max(ground + 1.5, Math.min(P.pos.y, ground + 40));
    roll = Math.sin(ctx.time * 1.7) * 0.25;
    out.speed = w;
  } else if (form === 'wind') {
    // vento: veloce, radente; dove passi l'acqua si increspa e l'erba si piega
    // il vento sei tu, ma dipende dal tempo: con la calma quasi non ti muovi, con la tempesta corri e sbandi
    const wk = 0.15 + 1.1 * ctx.wind;
    P.vs = (P.vs || 10) + ((fz > 0 ? (run ? 34 : 24) : fz < 0 ? 6 : 14) * wk - (P.vs || 10)) * Math.min(1, dt * 1.2);
    if (ctx.storm > 0.3) { P.gustW = (P.gustW || 0) * 0.96 + (Math.random() - 0.5) * ctx.storm * 0.12; P.yaw += P.gustW * dt * 6; P.pos.y += Math.sin(ctx.time * 3.1) * ctx.storm * 2 * dt; }
    P.yaw -= fx * 1.1 * dt;
    const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    P.pos.x += -ys * cp * P.vs * dt; P.pos.z += -yc * cp * P.vs * dt; P.pos.y += (sp * P.vs + (ctx.up ? 6 : 0)) * dt;
    P.pos.y = Math.max(ground + 1.2, Math.min(P.pos.y, ground + 60));
    roll = -fx * 0.15 + Math.sin(ctx.time * 3) * 0.02;
    out.speed = P.vs;
    // Spazio: raduni le nuvole; C: le spazzi via
    out.cloudDelta = (ctx.jump || ctx.up ? 1 : 0) - (ctx.down ? 1 : 0);
  } else if (form === 'wave') {
    // l'onda va dove la porti: avanti corre, indietro rallenta e torna al largo, A e D piegano.
    // Non sale mai sulla sabbia asciutta; da piccola non riesce ad arrivare a riva.
    P.wsize = P.wsize || 1;
    const tsp = (fz > 0 ? 7.5 : fz < 0 ? -3 : 2.2) * (1 + 0.8 * (ctx.storm || 0));
    P.ws = (P.ws ?? 2) + (tsp - (P.ws ?? 2)) * Math.min(1, dt * 1.5);
    P.yaw -= fx * 1.3 * dt;
    const nx = P.pos.x - ys * P.ws * dt, nz = P.pos.z - yc * P.ws * dt;
    const d0 = lvl - heightAt(P.pos.x, P.pos.z), d1 = lvl - heightAt(nx, nz);
    const shoreward = d1 < d0;
    if (d1 < 0.3) { P.ws *= 0.5; }
    else if (ctx.waveMin && P.wsize < ctx.waveMin && shoreward && d1 < 1.4) { out.tooSmall = true; P.ws *= 0.6; }
    else { P.pos.x = nx; P.pos.z = nz; }
    const depth = lvl - heightAt(P.pos.x, P.pos.z);
    const lift = (0.45 + 0.8 * Math.max(0, 1 - Math.min(depth, 6) / 6)) * P.wsize + 0.2;
    P.pos.y += (lvl + lift + Math.sin(ctx.time * 1.7) * 0.05 * P.wsize - P.pos.y) * Math.min(1, dt * 4);
    roll = Math.sin(ctx.time * 1.3) * 0.02 * P.wsize - fx * 0.05;
    out.size = P.wsize;
    out.speed = Math.abs(P.ws);
    out.broke = !P.waveRest && depth < 0.7 && shoreward && P.ws > 1;
  } else if (form === 'cloud') {
    // alta e lenta: il vento ti porta, tu puoi spingerti
    const w = 3 + ctx.wind * 6;
    P.pos.x += (ctx.windDir.x * w + (-ys * fz + yc * fx) * 14) * dt;
    P.pos.z += (ctx.windDir.y * w + (-yc * fz - ys * fx) * 14) * dt;
    P.pos.y += ((P.cloudY || 320) - P.pos.y) * Math.min(1, dt * 0.4);
    if (ctx.target) { const tx = ctx.target.x - P.pos.x, tz = ctx.target.z - P.pos.z, tl = Math.hypot(tx, tz); if (tl > 20) { P.pos.x += tx / tl * 6 * dt; P.pos.z += tz / tl * 6 * dt; } }
    roll = Math.sin(ctx.time * 0.3) * 0.01;
    out.speed = w;
  }
  return { eye, roll, ...out };
}
