import * as THREE from 'three';
import { heightAt, shoreZ } from './terrain.js';

const std = (color, rough = 0.8, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const shadowed = (o) => { o.castShadow = o.receiveShadow = true; return o; };

// Luoghi strani lungo la riva
export const SCALA = { x: 62, z: shoreZ(62) + 31, steps: 36, rise: 0.28, run: 0.46, width: 1.8 };
SCALA.y0 = heightAt(SCALA.x, SCALA.z);
SCALA.len = SCALA.steps * SCALA.run;
SCALA.top = SCALA.y0 + SCALA.steps * SCALA.rise;

export const COLONNE = { x: -125, z: shoreZ(-125) - 24, r: 7.5 };
export const SPECCHIO = { x: 135, z: shoreZ(135) - 165, r: 15 };
export const PORTA = { x: -58, z: shoreZ(-58) + 11 };

// Rilievi calpestabili sopra il terreno (la Scala). Ritorna -Infinity se fuori.
export function placeHeight(x, z, feetY) {
  const S = SCALA;
  if (Math.abs(x - S.x) < S.width / 2) {
    const u = S.z - z; // la scala sale verso il mare (-z)
    if (u >= 0 && u <= S.len + 1.8) {
      const i = Math.min(Math.floor(u / S.run), S.steps - 1);
      const h = S.y0 + (i + 1) * S.rise;
      if (h <= feetY + 0.65) return h;
    }
  }
  return -Infinity;
}

function lathe(points, seg = 40) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

export function buildPlaces(scene, glowTex) {
  const P = {};

  // ---- La Scala: gradini di pietra chiara che salgono verso niente
  {
    const g = new THREE.Group();
    const stone = std(0xe6dfd2, 0.75);
    const geo = new THREE.BoxGeometry(SCALA.width, 0.16, SCALA.run + 0.06);
    // spigoli arrotondati: leggero smusso tramite normali morbide
    for (let i = 0; i < SCALA.steps; i++) {
      const s = shadowed(new THREE.Mesh(geo, stone));
      s.position.set(0, (i + 1) * SCALA.rise - 0.08, -(i + 0.5) * SCALA.run);
      g.add(s);
    }
    const landing = shadowed(new THREE.Mesh(new THREE.BoxGeometry(SCALA.width + 0.4, 0.2, 1.8), stone));
    landing.position.set(0, SCALA.steps * SCALA.rise - 0.1, -SCALA.len - 0.9);
    g.add(landing);
    // trave sottile sotto i gradini
    const beamLen = Math.hypot(SCALA.len, SCALA.steps * SCALA.rise);
    const beam = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, beamLen), std(0xcfc6b6, 0.8)));
    beam.position.set(0, SCALA.steps * SCALA.rise / 2 - 0.35, -SCALA.len / 2);
    beam.rotation.x = Math.atan2(SCALA.steps * SCALA.rise, SCALA.len);
    g.add(beam);
    g.position.set(SCALA.x, SCALA.y0, SCALA.z);
    scene.add(g);
  }

  // ---- Le Colonne: rovina di un tempio che emerge dall'acqua bassa
  {
    const g = new THREE.Group();
    const marble = std(0xece6da, 0.55);
    const shaft = lathe([[0, 0], [0.5, 0], [0.5, 0.15], [0.44, 0.3], [0.42, 3], [0.39, 6], [0.36, 7.2], [0, 7.2]]);
    const cap = lathe([[0, 0], [0.38, 0], [0.5, 0.18], [0.62, 0.32], [0.62, 0.48], [0, 0.48]]);
    const broken = lathe([[0, 0], [0.5, 0], [0.5, 0.15], [0.44, 0.3], [0.42, 2.6], [0.3, 2.9], [0.15, 2.75], [0, 3.0]]);
    const n = 10;
    const tops = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * COLONNE.r, z = Math.sin(a) * COLONNE.r;
      const yb = heightAt(COLONNE.x + x, COLONNE.z + z) - 0.2;
      const whole = i % 3 !== 1;
      const col = shadowed(new THREE.Mesh(whole ? shaft : broken, marble));
      col.position.set(x, yb, z);
      if (!whole) col.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * 3, (Math.random() - 0.5) * 0.12);
      g.add(col);
      if (whole) {
        const c = shadowed(new THREE.Mesh(cap, marble));
        c.position.set(x, yb + 7.2, z);
        g.add(c);
        tops.push({ i, x, z, y: yb + 7.68 });
      }
    }
    // architravi fra colonne intere consecutive
    for (let k = 0; k < tops.length; k++) {
      const a = tops[k], b = tops[(k + 1) % tops.length];
      if ((b.i - a.i + n) % n !== 1) continue;
      const len = Math.hypot(b.x - a.x, b.z - a.z) + 1.0;
      const ar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.9), marble));
      ar.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.27, (a.z + b.z) / 2);
      ar.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      g.add(ar);
    }
    // frammenti caduti sul fondale
    for (let k = 0; k < 5; k++) {
      const f = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1 + Math.random(), 28), marble));
      const x = (Math.random() - 0.5) * 12, z = (Math.random() - 0.5) * 12;
      f.position.set(x, heightAt(COLONNE.x + x, COLONNE.z + z) + 0.25, z);
      f.rotation.set(Math.PI / 2, Math.random() * 3, Math.random() * 0.4);
      g.add(f);
    }
    g.position.set(COLONNE.x, 0, COLONNE.z);
    scene.add(g);
  }

  // ---- Il Lampione sullo Specchio d'acqua
  {
    const g = new THREE.Group();
    const iron = std(0x1d1f22, 0.45, 0.6);
    const post = shadowed(new THREE.Mesh(lathe([[0, -6], [0.16, -6], [0.16, 0.2], [0.11, 0.6], [0.07, 1.2], [0.06, 4.4], [0, 4.4]], 20), iron));
    g.add(post);
    const arm = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 8, 24, Math.PI), iron));
    arm.position.set(0.45, 4.4, 0); g.add(arm);
    const lanternGlass = new THREE.Mesh(lathe([[0, 0], [0.16, 0.05], [0.2, 0.3], [0.12, 0.45], [0, 0.45]], 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.5) }));
    lanternGlass.position.set(0.9, 3.85, 0); g.add(lanternGlass);
    const hat = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 16), iron));
    hat.position.set(0.9, 4.38, 0); g.add(hat);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.position.set(0.9, 4.05, 0); glow.scale.setScalar(5); g.add(glow);
    const light = new THREE.PointLight(0xffb070, 0, 30, 1.4);
    light.position.set(0.9, 3.9, 0); g.add(light);
    g.position.set(SPECCHIO.x, 0, SPECCHIO.z);
    scene.add(g);
    P.lamp = { g, glass: lanternGlass, glow, light };
  }

  // ---- La Porta: una porta socchiusa piantata nella sabbia
  {
    const g = new THREE.Group();
    const frameM = std(0xe8e2d6, 0.8);
    const wood = std(0x5e8c8a, 0.7);
    const y0 = heightAt(PORTA.x, PORTA.z) - 0.15;
    const j1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.5, 0.22), frameM)); j1.position.set(-0.56, 1.25, 0); g.add(j1);
    const j2 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.5, 0.22), frameM)); j2.position.set(0.56, 1.25, 0); g.add(j2);
    const li = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.16, 0.22), frameM)); li.position.set(0, 2.5, 0); g.add(li);
    const hinge = new THREE.Group(); hinge.position.set(-0.48, 0, 0); g.add(hinge);
    const door = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.36, 0.05), wood));
    door.position.set(0.48, 1.2, 0); hinge.add(door);
    for (const y of [0.6, 1.75]) {
      const pnl = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.02), std(0x4f7a78, 0.75));
      pnl.position.set(0.48, y, 0.035); hinge.add(pnl);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std(0xb89a55, 0.3, 0.8));
    knob.position.set(0.86, 1.1, 0.06); hinge.add(knob);
    hinge.rotation.y = -0.75;
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 2.36), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(1, 0.7, 0.5) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
        void main(){ float e = smoothstep(0.0,0.2,vUv.x)*smoothstep(1.0,0.8,vUv.x)*smoothstep(0.0,0.1,vUv.y)*smoothstep(1.0,0.85,vUv.y);
          float w = 0.6 + 0.4*sin(vUv.y*14.0 - uTime*1.5);
          gl_FragColor = vec4(uCol * e * w * 0.7, 1.0); }`,
    }));
    veil.position.set(0, 1.2, 0); g.add(veil);
    g.position.set(PORTA.x, y0, PORTA.z);
    g.rotation.y = 0.35;
    scene.add(g);
    P.porta = { g, veil };
  }

  return P;
}

export function updatePlaces(P, dt, time, ctx) {
  const on = ctx.night > 0.15 ? Math.min(1, (ctx.night - 0.15) * 2) : 0;
  const flick = 0.92 + 0.08 * Math.sin(time * 13) * Math.sin(time * 7.3);
  P.lamp.light.intensity = on * 14 * flick;
  P.lamp.glow.material.opacity = on * flick;
  P.lamp.glass.material.color.setRGB(0.25 + on * 3.5, 0.2 + on * 2.6, 0.15 + on * 1.6);
  P.porta.veil.material.uniforms.uTime.value = time;
  P.porta.veil.material.uniforms.uCol.value.copy(ctx.nextHor).multiplyScalar(1.4);
  return on;
}
