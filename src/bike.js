import * as THREE from 'three';
import { heightAt, shoreZ } from './terrain.js';

// Una vecchia moto da enduro parcheggiata sul lungomare: per salire sulle colline.

const std = (c, r = 0.6, m = 0, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...e });
export const BIKE_START = { x: 8, z: shoreZ(8) + 66 };

import { tube, roundedBox as rbox, mat, seatTex } from './models.js';

function wheel(r = 0.36) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(r - 0.06, 0.07, 14, 48), mat.rubber()); g.add(tyre);
  // tasselli della gomma da fuoristrada
  const knob = new THREE.BoxGeometry(0.05, 0.035, 0.11);
  const knobs = new THREE.InstancedMesh(knob, mat.rubber(), 36);
  const d = new THREE.Object3D();
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    d.position.set(Math.cos(a) * (r + 0.005), Math.sin(a) * (r + 0.005), (i % 2 ? 0.035 : -0.035));
    d.rotation.set(0, 0, a); d.updateMatrix(); knobs.setMatrixAt(i, d.matrix);
  }
  g.add(knobs);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.11, 0.014, 8, 48), mat.paint(0x1a1a1a, 0.3)); g.add(rim);
  for (let i = 0; i < 18; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, (r - 0.11) * 2, 4), mat.steel());
    sp.rotation.z = (i / 18) * Math.PI; sp.position.z = (i % 2 ? 0.012 : -0.012); g.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 16), mat.paint(0x9a9da0, 0.25)); hub.rotation.x = Math.PI / 2; g.add(hub);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.006, 32), mat.steel()); disc.rotation.x = Math.PI / 2; disc.position.z = 0.06; g.add(disc);
  g.rotation.y = Math.PI / 2;
  return g;
}

export function buildBike(scene) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const white = mat.dusty(0xf2f1ec, 0.32), orange = mat.dusty(0xe2582a, 0.34), dark = mat.dark(0.4), chrome = mat.steel();
  const gold = mat.dusty(0xc9a046, 0.25);
  const wf = wheel(0.4); wf.position.set(0, 0.4, -0.76); body.add(wf);
  const wr = wheel(0.38); wr.position.set(0, 0.38, 0.7); body.add(wr);
  // telaio perimetrale a tubi curvi
  const fr = mat.dusty(0x2b2d30, 0.35);
  for (const sd of [-1, 1]) body.add(tube([new THREE.Vector3(sd * 0.07, 1.02, -0.5), new THREE.Vector3(sd * 0.1, 0.92, -0.2), new THREE.Vector3(sd * 0.1, 0.78, 0.15), new THREE.Vector3(sd * 0.08, 0.5, 0.18), new THREE.Vector3(sd * 0.06, 0.36, -0.12)], 0.022, fr, 24));
  body.add(tube([new THREE.Vector3(0, 1.02, -0.52), new THREE.Vector3(0, 0.62, -0.38), new THREE.Vector3(0, 0.34, -0.15)], 0.024, fr, 16));
  // forcellone
  for (const sd of [-1, 1]) body.add(tube([new THREE.Vector3(sd * 0.09, 0.5, 0.15), new THREE.Vector3(sd * 0.09, 0.43, 0.45), new THREE.Vector3(sd * 0.08, 0.38, 0.7)], 0.02, mat.dusty(0x9a9da0, 0.3), 12));
  const shock = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10), mat.dusty(0xe9b23a, 0.3)); shock.position.set(0, 0.68, 0.18); shock.rotation.x = -0.6; body.add(shock);
  // motore
  const engine = new THREE.Mesh(rbox(0.24, 0.3, 0.34, 0.06), mat.dusty(0x3b3d40, 0.3, 0.6)); engine.position.set(0, 0.48, -0.1); body.add(engine);
  const cyl = new THREE.Mesh(rbox(0.18, 0.2, 0.16, 0.04), mat.dusty(0x6a6d70, 0.3)); cyl.position.set(0, 0.7, -0.2); cyl.rotation.x = -0.35; body.add(cyl);
  // serbatoio e convogliatori del radiatore
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 8, 16), white); tank.rotation.x = Math.PI / 2 - 0.25; tank.position.set(0, 0.98, -0.22); tank.scale.set(1.35, 1, 0.85); body.add(tank);
  for (const sd of [-1, 1]) { const sh = new THREE.Mesh(rbox(0.04, 0.32, 0.42, 0.03), orange); sh.position.set(sd * 0.19, 0.88, -0.32); sh.rotation.set(0.25, sd * 0.1, 0); body.add(sh); }
  // sella lunga e piatta, fianchetti
  const seat = new THREE.Mesh(rbox(0.22, 0.09, 0.85, 0.04), new THREE.MeshStandardMaterial({ map: seatTex(), roughness: 0.8 })); seat.position.set(0, 1.04, 0.22); seat.rotation.x = -0.06; body.add(seat);
  for (const sd of [-1, 1]) { const sp = new THREE.Mesh(rbox(0.03, 0.2, 0.42, 0.03), white); sp.position.set(sd * 0.13, 0.9, 0.38); body.add(sp); }
  const tail = new THREE.Mesh(rbox(0.16, 0.04, 0.42, 0.02), white); tail.position.set(0, 1.0, 0.82); tail.rotation.x = -0.25; body.add(tail);
  // parafango anteriore a becco
  const fend = new THREE.Mesh(rbox(0.16, 0.03, 0.6, 0.015), orange); fend.position.set(0, 0.84, -0.78); fend.rotation.x = 0.12; body.add(fend);
  // scarico
  body.add(tube([new THREE.Vector3(0.05, 0.62, -0.28), new THREE.Vector3(0.15, 0.5, -0.05), new THREE.Vector3(0.17, 0.75, 0.35)], 0.025, chrome, 20));
  const muf = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.42, 16), mat.dusty(0x8e9194, 0.25, 0.8)); muf.rotation.x = Math.PI / 2 - 0.35; muf.position.set(0.17, 0.85, 0.6); body.add(muf);
  // forcella dorata, piastre, manubrio, tabella portanumero con faro
  const fork = new THREE.Group(); fork.position.set(0, 1.08, -0.56); body.add(fork);
  for (const s2 of [-1, 1]) {
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.45, 12), gold); up.position.set(s2 * 0.085, -0.2, -0.06); up.rotation.x = 0.27; fork.add(up);
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 12), chrome); lo.position.set(s2 * 0.085, -0.6, -0.17); lo.rotation.x = 0.27; fork.add(lo);
  }
  const clamp = new THREE.Mesh(rbox(0.26, 0.04, 0.08, 0.015), mat.dusty(0xc9a046, 0.3)); clamp.position.y = 0.03; fork.add(clamp);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.78, 10), mat.dusty(0x2b2d30, 0.35)); bar.rotation.z = Math.PI / 2; bar.position.y = 0.1; fork.add(bar);
  const plate = new THREE.Mesh(rbox(0.26, 0.24, 0.04, 0.03), white); plate.position.set(0, -0.08, -0.14); plate.rotation.x = 0.27; fork.add(plate);
  const lamp = new THREE.Mesh(rbox(0.14, 0.06, 0.02, 0.01), dark); lamp.position.set(0, -0.06, -0.165); lamp.rotation.x = 0.27; fork.add(lamp);
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 0.38, 0.3) })); lens.position.set(0, -0.06, -0.178); lens.rotation.set(0.27, Math.PI, 0); fork.add(lens);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const y = heightAt(BIKE_START.x, BIKE_START.z);
  g.position.set(BIKE_START.x, y + 0.5, BIKE_START.z);
  g.rotation.y = Math.PI / 2;
  body.rotation.z = 0.12; // sul cavalletto
  scene.add(g);

  // manubrio in prima persona
  const fp = new THREE.Group();
  const fbar = tube([new THREE.Vector3(-0.38, 0.05, 0.02), new THREE.Vector3(-0.15, 0.0, 0), new THREE.Vector3(0.15, 0.0, 0), new THREE.Vector3(0.38, 0.05, 0.02)], 0.014, mat.paint(0x2b2d30, 0.35), 24); fp.add(fbar);
  for (const s2 of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 12), mat.rubber()); grip.rotation.z = Math.PI / 2; grip.position.set(s2 * 0.34, 0.045, 0.02); fp.add(grip);
    const guard = new THREE.Mesh(rbox(0.04, 0.09, 0.16, 0.03), orange); guard.position.set(s2 * 0.4, 0.05, -0.08); fp.add(guard);
  }
  const dashF = new THREE.Mesh(rbox(0.1, 0.03, 0.07, 0.012), dark); dashF.position.set(0, 0.03, -0.06); dashF.rotation.x = -0.4; fp.add(dashF);
  const plateF = new THREE.Mesh(rbox(0.26, 0.2, 0.03, 0.03), white); plateF.position.set(0, -0.06, -0.16); plateF.rotation.x = 0.3; fp.add(plateF);
  const tankFp = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.28, 8, 16), white); tankFp.rotation.x = Math.PI / 2 - 0.25; tankFp.position.set(0, -0.42, 0.22); tankFp.scale.set(1.35, 1, 0.85); fp.add(tankFp);
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
  // sulla sabbia morbida la moto affonda: meno velocità, più attrito, la ruota scoda
  const soft = ctx.soft ? ctx.soft(B.g.position.x, B.g.position.z) : 0;
  B.soft = soft;
  const vmax = (run ? 30 : 21) * (1 - 0.5 * soft);
  if (soft > 0.3) B.speed *= Math.pow(1 - 0.25 * soft, dt);
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
  const lean = -B.steer * Math.min(Math.abs(B.speed) / 14, 1) * 0.42 + Math.sin(ctx.time * 7.3) * 0.04 * soft * Math.min(Math.abs(B.speed) / 8, 1);
  B.g.rotation.set(0, B.yaw + Math.sin(ctx.time * 5.1) * 0.05 * soft * Math.min(Math.abs(B.speed) / 8, 1), 0);
  B.body.rotation.set(-pitch, 0, lean);
  B.fork.rotation.y = B.steer * 0.35;
  B.fp.rotation.set(0, B.steer * 0.25, 0);
  return { pitch, lean };
}
