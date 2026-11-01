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
    const dx = ctx.windDir.x * w + (-ys * fz + yc * fx) * 2;
    const dz = ctx.windDir.y * w + (-yc * fz - ys * fx) * 2;
    P.pos.x += dx * dt; P.pos.z += dz * dt;
    const h = heightAt(P.pos.x, P.pos.z);
    const hm = Math.max(h, heightAt(P.pos.x + 0.8, P.pos.z), heightAt(P.pos.x - 0.8, P.pos.z), heightAt(P.pos.x, P.pos.z + 0.8), heightAt(P.pos.x, P.pos.z - 0.8));
    P.pos.y += (hm + 0.32 + Math.abs(Math.sin(ctx.time * 3)) * 0.08 * ctx.wind - P.pos.y) * Math.min(1, dt * 8);
    out.speed = Math.hypot(dx, dz);
    out.inWater = lvl - h > 0.05;
  } else if (form === 'wave') {
    // la cresta corre verso riva; tu sei la cresta
    P.ws = Math.min(9, (P.ws || 4) + dt * 1.5);
    const d = P.pos.z - shoreZ(P.pos.x);
    P.pos.z += P.ws * dt * (d < 0 ? 1 : 0);
    P.pos.x += fx * 4 * dt;
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
    roll = Math.sin(ctx.time * 0.3) * 0.01;
    out.speed = w;
  }
  return { eye, roll, ...out };
}
