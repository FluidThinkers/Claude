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
  petal: { name: 'Petalo', unlock: 'Un petalo si stacca, e tu con lui.', enter: 'Sei un petalo. Il vento sa dove andare.' },
  wind: { name: 'Vento', unlock: 'Il petalo si posa. Tu continui.', enter: 'Sei vento. Nessuno ti vede, tutti ti sentono.' },
};

// ali in prima persona per il gabbiano
export function gullWings() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xe9e8e3, roughness: 0.8, side: THREE.DoubleSide });
  const tipM = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, side: THREE.DoubleSide });
  const mk = (s) => {
    const w = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.quadraticCurveTo(0.5 * s, 0.12, 1.1 * s, 0.05); shape.lineTo(1.25 * s, -0.12); shape.quadraticCurveTo(0.6 * s, -0.28, 0, -0.32); shape.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(shape, 12); geo.rotateX(-Math.PI / 2);
    w.add(new THREE.Mesh(geo, m));
    const tip = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), tipM); tip.rotation.x = -Math.PI / 2; tip.position.set(1.12 * s, -0.005, 0.05); tip.scale.set(1.2, 0.6, 1); w.add(tip);
    w.position.set(0.22 * s, -0.24, -0.5);
    return w;
  };
  const L = mk(-1), R = mk(1);
  g.add(L, R);
  g.userData = { L, R };
  g.visible = false;
  return g;
}

const tmp = new THREE.Vector3();

// movimento di ogni forma. P: giocatore; ctx: { dt, fx, fz, run, up, down, jump, lvl, wind, windDir, time, trees }
export function moveForm(form, P, ctx) {
  const { dt, fx, fz, run, lvl } = ctx;
  const ys = Math.sin(P.yaw), yc = Math.cos(P.yaw);
  const ground = Math.max(heightAt(P.pos.x, P.pos.z), lvl);
  let eye = 0, roll = 0, out = {};

  if (form === 'gull') {
    // volo: lo sguardo guida la quota, A/D virano, Spazio batte le ali
    P.gs = P.gs ?? 11;
    const target = fz > 0 ? (run ? 20 : 15) : fz < 0 ? 7 : 11;
    P.gs += (target - P.gs) * Math.min(1, dt * 0.8);
    P.bank = (P.bank || 0) + ((fx * 0.6) - (P.bank || 0)) * Math.min(1, dt * 2.5);
    P.yaw -= Math.tan(P.bank) * 9.8 / Math.max(P.gs, 6) * dt;
    const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    let vy = sp * P.gs - 0.6 + (ctx.up ? 3.5 : 0);
    P.pos.x += -ys * cp * P.gs * dt; P.pos.z += -yc * cp * P.gs * dt; P.pos.y += vy * dt;
    if (P.pos.y < ground + 0.8) { P.pos.y = ground + 0.8; }
    P.pos.y = Math.min(P.pos.y, 400);
    P.flap = (P.flap || 0) + dt * (ctx.up || fz > 0 ? 10 : 2.5);
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
  } else if (form === 'fish') {
    // pesce: veloce e morbido sott'acqua, non esce mai dall'acqua
    const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    const speed = fz > 0 ? (run ? 10 : 5.5) : fz < 0 ? -2 : 0;
    P.fv = (P.fv || 0) + (speed - (P.fv || 0)) * Math.min(1, dt * 2.5);
    P.pos.x += (-ys * cp * P.fv + Math.cos(P.yaw) * fx * 2.5) * dt;
    P.pos.z += (-yc * cp * P.fv - Math.sin(P.yaw) * fx * 2.5) * dt;
    P.pos.y += (sp * P.fv + (ctx.up ? 2 : 0) - (ctx.down ? 2 : 0)) * dt;
    const floor = heightAt(P.pos.x, P.pos.z) + 0.3;
    P.pos.y = Math.max(floor, Math.min(P.pos.y, lvl - 0.35));
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
    P.vs = (P.vs || 10) + ((fz > 0 ? (run ? 34 : 24) : fz < 0 ? 6 : 14) - (P.vs || 10)) * Math.min(1, dt * 1.2);
    P.yaw -= fx * 1.1 * dt;
    const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    P.pos.x += -ys * cp * P.vs * dt; P.pos.z += -yc * cp * P.vs * dt; P.pos.y += (sp * P.vs + (ctx.up ? 6 : 0)) * dt;
    P.pos.y = Math.max(ground + 1.2, Math.min(P.pos.y, ground + 60));
    roll = -fx * 0.15 + Math.sin(ctx.time * 3) * 0.02;
    out.speed = P.vs;
  } else if (form === 'wave') {
    // la cresta corre verso riva; tu sei la cresta
    P.ws = Math.min(9, (P.ws || 4) + dt * 1.5);
    const d = P.pos.z - shoreZ(P.pos.x);
    P.pos.z += P.ws * dt * (d < 0 ? 1 : 0);
    P.pos.x += fx * 8 * dt;
    if (ctx.target) P.pos.x += Math.sign(ctx.target.x - P.pos.x) * Math.min(Math.abs(ctx.target.x - P.pos.x), 7 * dt);
    const depth = lvl - heightAt(P.pos.x, P.pos.z);
    const lift = 0.6 + 0.8 * Math.max(0, 1 - Math.min(depth, 6) / 6);
    P.pos.y = lvl + lift + Math.sin(ctx.time * 1.7) * 0.05;
    P.yaw += (Math.PI - P.yaw + Math.PI * 2 * Math.round((P.yaw - Math.PI) / (Math.PI * 2))) * Math.min(1, dt * 0.5) * 0; // libera
    out.speed = P.ws;
    out.broke = depth < 0.5;
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
