import * as THREE from 'three';
import { heightAt, shoreZ } from './terrain.js';

// Una vecchia moto da enduro parcheggiata sul lungomare: per salire sulle colline.

const std = (c, r = 0.6, m = 0, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...e });
export const BIKE_START = { x: 8, z: shoreZ(8) + 66 };

function wheel() {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.085, 12, 32), std(0x1b1b1c, 0.9));
  g.add(tyre);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.015, 6, 32), std(0xb8b8b8, 0.3, 0.9));
  g.add(rim);
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.56, 4), std(0xcfcfcf, 0.3, 0.9));
    sp.rotation.z = (i / 12) * Math.PI; g.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), std(0x888888, 0.4, 0.8));
  hub.rotation.x = Math.PI / 2; g.add(hub);
  g.rotation.y = Math.PI / 2;
  return g;
}

export function buildBike(scene) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const paint = std(0xb8462e, 0.35, 0.2), dark = std(0x222324, 0.5, 0.4), chrome = std(0xd0d0d0, 0.25, 0.9);
  const wf = wheel(); wf.position.set(0, 0.42, -0.72); body.add(wf);
  const wr = wheel(); wr.position.set(0, 0.42, 0.68); body.add(wr);
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), dark); frame.position.set(0, 0.72, 0); frame.rotation.x = 1.25; body.add(frame);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.38), std(0x55575a, 0.4, 0.7)); engine.position.set(0, 0.55, 0.0); body.add(engine);
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.32, 6, 14), paint); tank.rotation.x = Math.PI / 2 - 0.2; tank.position.set(0, 0.92, -0.18); tank.scale.set(1.2, 1, 0.9); body.add(tank);
  const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 6, 12), std(0x1a1a1a, 0.8)); seat.rotation.x = Math.PI / 2; seat.position.set(0, 0.95, 0.32); seat.scale.set(1.15, 1, 0.5); body.add(seat);
  const fender = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 16, Math.PI * 0.6), paint); fender.rotation.set(0, Math.PI / 2, Math.PI * 0.2); fender.position.set(0, 0.45, -0.72); fender.scale.set(1, 1, 0.6); body.add(fender);
  const fork = new THREE.Group(); fork.position.set(0, 1.05, -0.55); body.add(fork);
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 8), chrome); f.position.set(s * 0.09, -0.32, -0.08); f.rotation.x = 0.28; fork.add(f); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.72, 8), dark); bar.rotation.z = Math.PI / 2; bar.position.y = 0.06; fork.add(bar);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 16), dark); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, -0.08, -0.12); fork.add(lamp);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.38, 0.3) })); lens.position.set(0, -0.08, -0.155); lens.rotation.y = Math.PI; fork.add(lens);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.7, 10), chrome); exhaust.rotation.x = Math.PI / 2 - 0.2; exhaust.position.set(0.17, 0.62, 0.35); body.add(exhaust);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const y = heightAt(BIKE_START.x, BIKE_START.z);
  g.position.set(BIKE_START.x, y + 0.5, BIKE_START.z);
  g.rotation.y = Math.PI / 2;
  body.rotation.z = 0.12; // sul cavalletto
  scene.add(g);

  // manubrio in prima persona
  const fp = new THREE.Group();
  const fbar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.74, 10), dark); fbar.rotation.z = Math.PI / 2; fp.add(fbar);
  for (const s of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 10), std(0x111111, 0.9)); grip.rotation.z = Math.PI / 2; grip.position.x = s * 0.33; fp.add(grip);
    const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.03, 14), std(0x3a4148, 0.1, 0.8)); mirror.position.set(s * 0.3, 0.13, -0.05); mirror.rotation.y = Math.PI + s * 0.3; fp.add(mirror);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.13, 5), dark); stem.position.set(s * 0.3, 0.065, -0.03); fp.add(stem);
  }
  const dash = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), dark); dash.rotation.x = Math.PI / 2 - 0.5; dash.position.set(0, 0.03, -0.06); fp.add(dash);
  const tankFp = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.3, 6, 14), paint); tankFp.rotation.x = Math.PI / 2 - 0.25; tankFp.position.set(0, -0.42, 0.2); tankFp.scale.set(1.2, 1, 0.9); fp.add(tankFp);
  fp.position.set(0, -0.42, -0.62);
  fp.visible = false;

  const light = new THREE.SpotLight(0xfff0d8, 0, 60, 0.5, 0.5, 1.2);
  scene.add(light, light.target);

  return { g, body, fork, fp, lens, light, speed: 0, yaw: g.rotation.y, steer: 0, on: false };
}

const tmp = new THREE.Vector3();

// guida: ritorna true se la moto si è mossa
export function rideBike(B, dt, input, ctx) {
  const { fx, fz, run } = input;
  const vmax = run ? 30 : 21;
  if (fz > 0) B.speed += (vmax - B.speed) * Math.min(1, 0.55 * dt) * fz;
  else if (fz < 0) B.speed = Math.max(B.speed - 14 * dt, -3);
  else B.speed *= Math.pow(0.55, dt);
  B.steer += (fx - B.steer) * Math.min(1, 4 * dt);
  const turn = B.steer * 1.5 * Math.min(Math.abs(B.speed), 9) / 9 * Math.sign(B.speed || 1) / (1 + Math.abs(B.speed) * 0.03);
  B.yaw -= turn * dt;
  const fwx = -Math.sin(B.yaw), fwz = -Math.cos(B.yaw);
  const p = B.g.position;
  const g0 = ctx.ground(p.x, p.z, p.y);
  const nx = p.x + fwx * B.speed * dt, nz = p.z + fwz * B.speed * dt;
  const g1 = ctx.ground(nx, nz, p.y);
  const step = Math.hypot(nx - p.x, nz - p.z) || 1e-6;
  const slope = (g1 - g0) / step;
  // acqua alta o parete troppo ripida: ti fermi
  if (ctx.water - heightAt(nx, nz) > 0.45 || slope > 1.1) { B.speed *= -0.15; }
  else { p.x = nx; p.z = nz; }
  // la pendenza frena in salita e spinge in discesa
  B.speed -= Math.max(-0.6, Math.min(0.6, slope)) * 7 * dt;
  const ground = ctx.ground(p.x, p.z, p.y);
  p.y += (ground - p.y) * Math.min(1, 18 * dt);
  // inclinazione della moto: beccheggio dal terreno, piega in curva
  const hf = ctx.ground(p.x + fwx * 0.7, p.z + fwz * 0.7, p.y), hb = ctx.ground(p.x - fwx * 0.7, p.z - fwz * 0.7, p.y);
  const pitch = Math.atan2(hf - hb, 1.4);
  const lean = -B.steer * Math.min(Math.abs(B.speed) / 14, 1) * 0.42;
  B.g.rotation.set(0, B.yaw, 0);
  B.body.rotation.set(-pitch, 0, lean);
  B.fork.rotation.y = B.steer * 0.35;
  B.fp.rotation.set(0, B.steer * 0.25, 0);
  return { pitch, lean };
}
