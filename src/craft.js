import * as THREE from 'three';
import { heightAt, shoreZ, vnoise } from './terrain.js';
import { PONTILE, BELVEDERE } from './places.js';
import { hullGeometry, deckGeometry, rubRail, tube, mat, teakTexture, roundedBox as rbox, shadowAll } from './models.js';

// Mezzi per andare lontano: le navi al largo (si sale a bordo), il barchino a motore, il deltaplano.

const std = (c, r = 0.6, m = 0, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...e });
const sh = (o) => { o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };

function roundedBox(w, h, d, r, seg = 3) {
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

// scafo affusolato: assottiglia la larghezza verso prua (x negativo = prua)
function taper(geo, len, k = 0.75) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), t = Math.max(0, (-x / (len / 2) - 0.35) / 0.65);
    p.setZ(i, p.getZ(i) * (1 - k * t * t));
    if (p.getY(i) < 0) p.setZ(i, p.getZ(i) * (0.75 + 0.25 * (p.getY(i) + 1)));
  }
  geo.computeVertexNormals();
  return geo;
}

const tmpV = new THREE.Vector3();

export function buildCraft(scene) {
  const C = { ships: [] };

  // ---- Barca a vela: scafo a sezioni, coperta in teak, tientibene in acciaio
  {
    const g = new THREE.Group();
    const teak = new THREE.MeshStandardMaterial({ map: teakTexture(), roughness: 0.7, side: THREE.DoubleSide });
    const hg = hullGeometry({ len: 12.2, beam: 3.9, depth: 1.95, sheer: 0.28, bowFine: 1.9, transom: 0.82, deadrise: 0.35, waterline: -0.22, topColor: 0xf6f4ee, bottomColor: 0x1b2e47, stripeY: 0.55, stripeColor: 0x1b2e47 });
    const gel = mat.gelcoat(); gel.side = THREE.DoubleSide;
    const hull = new THREE.Mesh(hg, gel); hull.position.y = 0.25; g.add(hull);
    // coperta piena: vista da sopra, da sotto e da dentro (prima si vedeva l'acqua attraverso)
    const deck = new THREE.Mesh(deckGeometry(hg.userData.outline, 0.05, 0.02), teak); deck.position.y = 0.25; g.add(deck);
    const sole = new THREE.Mesh(deckGeometry(hg.userData.outline, 0.7, 0.25), mat.paint(0x2a2e33, 0.8)); sole.material.side = THREE.DoubleSide; sole.position.y = 0.25; g.add(sole);
    const rail = rubRail(hg.userData.outline.map((p) => p.clone().setY(p.y + 0.02)), 0.035, mat.paint(0xe9e6df, 0.4)); rail.position.y = 0.25; g.add(rail);
    // tientibene: candelieri e cavo in acciaio
    const steel = mat.steel();
    const ol = hg.userData.outline;
    for (const sd of [1, -1]) {
      const pts = [];
      for (let i = 10; i < ol.length - 2; i += 6) {
        const p = ol[i];
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.62, 16), steel); st.position.set(p.x, p.y + 0.25 + 0.31, p.z * sd * 0.94); g.add(st);
        pts.push(new THREE.Vector3(p.x, p.y + 0.25 + 0.6, p.z * sd * 0.94));
      }
      g.add(tube(pts, 0.008, steel, 40));
    }
    // tuga con oblò
    const cab = new THREE.Mesh(rbox(3.4, 0.26, 2.0, 0.12), teak); cab.position.set(-0.6, 1.3, 0); g.add(cab);
    for (const sd of [1, -1]) for (const x of [-1.6, -0.6, 0.4]) { const w = new THREE.Mesh(rbox(0.45, 0.1, 0.02, 0.04), mat.dark(0.1)); w.position.set(x, 1.32, sd * 1.01); g.add(w); }
    // pozzetto
    const pit = new THREE.Mesh(rbox(2.4, 0.3, 2.0, 0.12), teak); pit.position.set(3.4, 1.05, 0); g.add(pit);
    const wheelG = new THREE.Group(); wheelG.position.set(4.3, 1.55, 0); wheelG.rotation.y = Math.PI / 2; g.add(wheelG);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 32), steel); wheelG.add(wheel);
    for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.84, 6), steel); sp.rotation.z = k * Math.PI / 6; wheelG.add(sp); }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat.paint(0xc8322a, 0.4)); knob.position.set(0, 0.44, 0); wheelG.add(knob);
    // bandierina segnavento su un'asta a poppa, ben visibile da chi timona
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 8), steel); staff.position.set(5.6, 2.0, 0.9); g.add(staff);
    const flagG = new THREE.Group(); flagG.position.set(5.6, 2.75, 0.9); g.add(flagG);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.22, 6, 2), new THREE.MeshBasicMaterial({ color: 0xd8342a, side: THREE.DoubleSide })); flag.geometry.translate(0.225, 0, 0); flagG.add(flag);
    // chiglia e timone
    const keel = new THREE.Mesh(rbox(1.2, 1.6, 0.16, 0.07), mat.paint(0x1b2e47, 0.4)); keel.position.set(-0.4, -1.4, 0); g.add(keel);
    const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.2, 6, 12), mat.paint(0x1b2e47, 0.4)); bulb.rotation.z = Math.PI / 2; bulb.position.set(-0.4, -2.2, 0); g.add(bulb);
    const rud = new THREE.Mesh(rbox(0.5, 1.1, 0.08, 0.04), mat.paint(0x1b2e47, 0.4)); rud.position.set(5.0, -0.8, 0); g.add(rud);
    // albero, boma, vele
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.085, 15, 24), mat.paint(0xd9dadb, 0.25)); mast.position.set(-1.8, 8.6, 0); g.add(mast);
    // il boma ruota attorno all'albero: è la randa che si regola
    const boomG = new THREE.Group(); boomG.position.set(-1.8, 0, 0); g.add(boomG);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 5.2, 20), mat.paint(0xd9dadb, 0.25)); boom.rotation.z = Math.PI / 2; boom.position.set(2.6, 2.45, 0); boomG.add(boom);
    const sailTex = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const c = cv.getContext('2d');
      c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, 256, 512);
      for (let y = 0; y < 512; y += 64) { c.fillStyle = 'rgba(120,115,100,0.25)'; c.fillRect(0, y, 256, 2); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(0, y + 3, 256, 1); }
      for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(${200 + Math.random() * 40 | 0},${195 + Math.random() * 40 | 0},${180 + Math.random() * 40 | 0},0.12)`; c.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const sailM = new THREE.MeshStandardMaterial({ color: 0xffffff, map: sailTex, roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0.97 });
    // tela vera: la vela respira, ondeggia verso la balumina, e sbatte quando perde il vento
    const sailU = { uT: { value: 0 }, uLuff: { value: 0 }, uWind: { value: 0.4 } };
    sailM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, sailU);
      sh.vertexShader = 'uniform float uT, uLuff, uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float edge = smoothstep(0.0, 0.6, uv.x);            // 0 all inferitura, 1 alla balumina
        float hgt = uv.y;
        float flap = uLuff * sin(uT * 14.0 - position.y * 1.3 + position.x * 2.1) * 0.22 * edge;
        float ripple = sin(uT * (3.0 + 4.0 * uWind) - position.y * 0.6 - position.x * 1.4) * (0.03 + 0.05 * uWind) * edge * (0.4 + 0.6 * hgt);
        float breathe = sin(uT * 0.9 + hgt * 2.0) * 0.06 * (1.0 - uLuff) * edge;
        transformed.z += flap + ripple + breathe;`);
    };
    const sailSurf = (ax, ay, bx, by, cx, cy, belly) => {
      const pts = [], idx = [], N = 10;
      for (let i = 0; i <= N; i++) for (let j = 0; j <= N - i; j++) {
        const u = i / N, v = j / N, w = 1 - u - v;
        const x = ax * w + bx * u + cx * v, y = ay * w + by * u + cy * v;
        pts.push(x, y, belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * (1 - v)) * (1 - v));
      }
      let k = 0; const row = [];
      for (let i = 0; i <= N; i++) { row.push(k); k += N - i + 1; }
      for (let i = 0; i < N; i++) for (let j = 0; j < N - i; j++) {
        const a = row[i] + j, b = row[i + 1] + j, c = a + 1;
        idx.push(a, b, c);
        if (j < N - i - 1) idx.push(b, row[i + 1] + j + 1, c);
      }
      const uvs = []; for (let k2 = 0; k2 < pts.length; k2 += 3) uvs.push((pts[k2] - Math.min(ax, bx, cx)) / 8, (pts[k2 + 1] - 1.5) / 14);
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); gg.setIndex(idx); gg.computeVertexNormals();
      return new THREE.Mesh(gg, sailM);
    };
    // randa (sul boma, relativa all'albero) e fiocco (sullo strallo, ruota attorno alla mura)
    const main = sailSurf(0.05, 2.6, 5.1, 2.6, 0.05, 15.6, 0.45); boomG.add(main);
    const jibG = new THREE.Group(); jibG.position.set(-6.0, 0, 0); g.add(jibG);
    const jib = sailSurf(4.1, 14.2, 0, 1.6, 4.1, 2.2, -0.35); jibG.add(jib);
    // nastrini segnavento: in testa d'albero e sul pulpito di prua
    const ribM = new THREE.MeshBasicMaterial({ color: 0xd8342a, side: THREE.DoubleSide });
    const ribbon = (x, y, len) => { const geo = new THREE.PlaneGeometry(len, 0.07, 10, 1); geo.translate(len / 2, 0, 0); const m = new THREE.Mesh(geo, ribM); m.position.set(x, y, 0); m.userData.base = geo.attributes.position.array.slice(); g.add(m); return m; };
    const ribbons = [ribbon(-1.8, 16.15, 0.9), ribbon(-6.1, 2.15, 0.6)];
    // sartiame che finisce davvero sullo scafo: strallo sulla prua, sartie sulle lande ai lati della coperta
    const olp = hg.userData.outline;
    const bow = olp.reduce((m, p) => (p.x < m.x ? p : m), olp[0]);
    const near = (x) => olp.reduce((m, p) => (Math.abs(p.x - x) < Math.abs(m.x - x) ? p : m), olp[0]);
    const ch = near(-1.5);
    const tack = new THREE.Vector3(bow.x + 0.15, bow.y + 0.25 + 0.04, 0);
    const stay = tube([tack, new THREE.Vector3(-1.8, 15.9, 0)], 0.008, steel, 8); g.add(stay);
    for (const sd of [1, -1]) {
      const cp = new THREE.Vector3(ch.x, ch.y + 0.25 + 0.03, sd * (ch.z - 0.06));
      g.add(tube([cp, new THREE.Vector3(-1.8, 15.6, 0)], 0.006, steel, 8));
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.03), steel); plate.position.copy(cp); g.add(plate);
    }
    jibG.position.set(tack.x, 0, 0);
    var rig = { boomG, jibG, main, jib, ribbons, wheelG, flagG, flag, sailU };
    shadowAll(g); scene.add(g);
    C.ships.push({ name: 'Barca a vela', g, kind: 'sail', speed: 1.4, s: 0, anchored: false, rig,
      deck: { hx: 5.2, hz: 1.45, y: 1.18 }, blocks: [{ x: -0.6, z: 0, hx: 1.9, hz: 1.15, top: 1.75 }],
      // un giro largo e chiuso: la barca vira dolcemente, non si gira su se stessa
      path: (s) => { const a = s * 0.0016; const x = 220 + 480 * Math.sin(a); return { x, z: shoreZ(x) - 640 + 140 * Math.cos(a), yaw: 0 }; },
    });
  }

  // ---- Traghetto: scafo a sezioni, ponte di poppa calpestabile
  {
    const g = new THREE.Group();
    const white = mat.paint(0xf3f2ee, 0.3), blue = mat.paint(0x1d3f6a, 0.35), glass = mat.dark(0.08), deckM = mat.paint(0x8f948f, 0.8);
    const hg = hullGeometry({ len: 150, beam: 26, depth: 15, sheer: 2.2, bowFine: 2.6, transom: 0.95, deadrise: 0.12, waterline: -6.2, topColor: 0xf3f2ee, bottomColor: 0x7a2a22, stripeY: -2.5, stripeColor: 0x1d3f6a, stripeW: 0.9 });
    const hull = new THREE.Mesh(hg, mat.gelcoat()); hull.position.y = 1; g.add(hull);
    const deck = new THREE.Mesh(deckGeometry(hg.userData.outline, 0.3, 0.3), deckM); deck.position.y = 1; g.add(deck);
    const sup = new THREE.Mesh(rbox(82, 11, 22, 1.8), white); sup.position.set(-25, 14, 0); g.add(sup);
    const win = new THREE.Mesh(rbox(82.4, 1.4, 22.4, 0.6), glass); win.position.set(-25, 15.5, 0); g.add(win);
    const win2 = new THREE.Mesh(rbox(82.4, 1.0, 22.4, 0.4), glass); win2.position.set(-25, 12.2, 0); g.add(win2);
    const top = new THREE.Mesh(rbox(32, 6, 17, 1.6), white); top.position.set(-42, 22, 0); g.add(top);
    const bridge = new THREE.Mesh(rbox(32.4, 1.2, 17.4, 0.5), glass); bridge.position.set(-42, 23, 0); g.add(bridge);
    const funnel = new THREE.Mesh(rbox(7, 8, 4.5, 2), blue); funnel.position.set(-26, 28, 0); funnel.rotation.z = 0.12; g.add(funnel);
    const steel = mat.steel();
    for (const sd of [1, -1]) {
      for (let x = 12; x < 70; x += 2.5) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 16), steel); st.position.set(x, 8.8, sd * 11.8); g.add(st); }
      g.add(tube([new THREE.Vector3(11, 9.35, sd * 11.8), new THREE.Vector3(40, 9.35, sd * 11.8), new THREE.Vector3(71, 9.35, sd * 11.8)], 0.05, steel, 20));
    }
    // dettagli che lo rendono una nave vera: file di oblò, scialuppe arancioni, antenne, ancore, nome a prua
    const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.35, 14), mat.dark(0.1));
    const ph = new THREE.InstancedMesh(porthole.geometry, porthole.material, 120); let pk = 0; const dm = new THREE.Object3D();
    for (const sd of [1, -1]) for (let x = -60; x < 55 && pk < 120; x += 2) { dm.position.set(x, 4.2, sd * 12.9); dm.rotation.set(0, sd > 0 ? 0 : Math.PI, 0); dm.updateMatrix(); ph.setMatrixAt(pk++, dm.matrix); }
    ph.count = pk; g.add(ph);
    const orange = mat.paint(0xe2661c, 0.4);
    for (const sd of [1, -1]) for (const x of [-50, -36, -14, 0]) { const lb = new THREE.Mesh(rbox(8, 2, 3, 0.9), orange); lb.position.set(x, 18.2, sd * 12.3); g.add(lb); const dv = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), steel); dv.position.set(x - 3, 19, sd * 11.6); g.add(dv); }
    for (const [x, h] of [[-40, 9], [-46, 6]]) { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, h, 16), steel); an.position.set(x, 25 + h / 2, 0); g.add(an); }
    const radar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 5), mat.dark(0.3)); radar.position.set(-40, 26, 0); g.add(radar); C.radar = radar;
    for (const sd of [1, -1]) { const anc = new THREE.Mesh(rbox(1.6, 2.2, 0.4, 0.3), mat.dark(0.5)); anc.position.set(68, 4, sd * 12.4); g.add(anc); }
    const nameTex = (() => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, 512, 96); c.fillStyle = '#1d3f6a'; c.font = 'bold 64px Georgia, serif'; c.textAlign = 'center'; c.fillText('LIBERTÀ', 256, 72); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    for (const sd of [1, -1]) { const nm = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true })); nm.position.set(52, 7.5, sd * 13.0); nm.rotation.y = sd > 0 ? 0 : Math.PI; g.add(nm); }
    shadowAll(g); scene.add(g);
    C.ships.push({ name: 'Traghetto', g, kind: 'ferry', speed: 5, s: 300, anchored: false,
      deck: { hx: 29, hz: 11.6, y: 8.25, cx: 41 }, blocks: [{ x: -25, z: 0, hx: 41, hz: 11, top: 20 }],
      path: (s) => ({ x: ((s * 1 + 4000) % 8000) - 4000, z: shoreZ(0) - 1150, yaw: Math.PI }),
    });
  }

  // ---- Barchino a motore (un piccolo open in vetroresina) legato in fondo al pontile
  {
    const g = new THREE.Group();
    const hg = hullGeometry({ len: 4.9, beam: 1.9, depth: 0.95, sheer: 0.22, bowFine: 1.6, transom: 0.88, deadrise: 0.4, waterline: -0.2, topColor: 0xf3f1ea, bottomColor: 0x2c4f6e, stripeY: 0.18, stripeColor: 0x2c4f6e, stripeW: 0.05 });
    const shell = new THREE.Mesh(hg, mat.gelcoat()); shell.material.side = THREE.DoubleSide; shell.position.y = 0.2; g.add(shell);
    const floor = new THREE.Mesh(deckGeometry(hg.userData.outline.map((p) => p.clone().setY(0.05)), 0, 0.14), new THREE.MeshStandardMaterial({ map: teakTexture(), roughness: 0.7 })); floor.position.y = 0.2; g.add(floor);
    const rail = rubRail(hg.userData.outline, 0.04, mat.paint(0x2a2b2d, 0.6)); rail.position.y = 0.2; g.add(rail);
    const mid = new THREE.Mesh(rbox(0.38, 0.12, 1.5, 0.05), new THREE.MeshStandardMaterial({ map: teakTexture(), roughness: 0.7 })); mid.position.set(-0.2, 0.5, 0); g.add(mid);
    const seat = new THREE.Mesh(rbox(0.5, 0.35, 1.3, 0.12), mat.paint(0xe9e2d4, 0.6)); seat.position.set(1.15, 0.45, 0); g.add(seat);
    const bow = new THREE.Mesh(rbox(0.9, 0.25, 1.0, 0.1), mat.paint(0xe9e2d4, 0.6)); bow.position.set(-1.5, 0.55, 0); g.add(bow);
    const motor = new THREE.Group();
    const cowl = new THREE.Mesh(rbox(0.42, 0.55, 0.36, 0.14), mat.paint(0x2a2b2d, 0.25)); cowl.position.y = 0.95; motor.add(cowl);
    const cap = new THREE.Mesh(rbox(0.44, 0.1, 0.38, 0.05), mat.paint(0xd0d3d6, 0.3)); cap.position.y = 1.25; motor.add(cap);
    const leg = new THREE.Mesh(rbox(0.12, 0.95, 0.16, 0.05), mat.paint(0x2a2b2d, 0.3)); leg.position.y = 0.25; motor.add(leg);
    const tiller = tube([new THREE.Vector3(0, 0.95, 0), new THREE.Vector3(-0.35, 0.9, 0), new THREE.Vector3(-0.7, 0.86, 0)], 0.02, mat.paint(0x2a2b2d, 0.4), 10); motor.add(tiller);
    const tgrip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 20), mat.rubber()); tgrip.rotation.z = Math.PI / 2; tgrip.position.set(-0.75, 0.86, 0); motor.add(tgrip);
    const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 16), mat.steel()); prop.rotation.z = Math.PI / 2; prop.position.set(0.08, -0.15, 0); motor.add(prop);
    motor.position.set(2.5, 0, 0); g.add(motor);
    shadowAll(g);
    const x = PONTILE.x + 3.1, z = PONTILE.z0 + PONTILE.to + 8;
    g.position.set(x, 0.1, z); g.rotation.y = -Math.PI / 2;
    scene.add(g);
    C.boat = { g, motor, yaw: 0, speed: 0, steer: 0 };
  }

  // ---- Deltaplano posato sul crinale vicino al belvedere
  {
    const g = new THREE.Group();
    const wing = new THREE.Group(); g.add(wing);
    // vela a delta: superficie curva tra bordo d'attacco e bordo d'uscita, con profilo
    const span = 5.2, NU = 40, NV = 12;
    const pos = [], uvs = [], idx = [];
    for (let i = 0; i <= NU; i++) {
      const u = -1 + 2 * i / NU, au = Math.abs(u);
      const L = new THREE.Vector3(u * span, 0.25 * au, -2.25 + 3.25 * au);
      const T = new THREE.Vector3(u * span, 0.25 * au + 0.05, 1.0 + 0.95 * Math.pow(1 - au, 1.4));
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        const P = L.clone().lerp(T, v);
        P.y += 0.22 * Math.sin(Math.PI * Math.pow(v, 0.8)) * (1 - au * 0.6);
        pos.push(P.x, P.y, P.z); uvs.push(i / NU, v);
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const sail = new THREE.BufferGeometry();
    sail.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sail.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    sail.setIndex(idx); sail.computeVertexNormals();
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#e4572e'; cx.fillRect(0, 0, 512, 64);
    cx.fillStyle = '#f4f0e6'; cx.fillRect(200, 0, 112, 64);
    cx.fillStyle = '#1f3a5c'; cx.fillRect(170, 0, 22, 64); cx.fillRect(320, 0, 22, 64);
    cx.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 1; k < 16; k++) cx.fillRect(k * 32, 0, 2, 64);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const sailM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide });
    const s1 = new THREE.Mesh(sail, sailM); wing.add(s1);
    const tube = std(0x9a9da0, 0.35, 0.8);
    const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4, 16), tube); keel.rotation.x = Math.PI / 2; keel.position.set(0, -0.05, -0.2); wing.add(keel);
    for (const s of [-1, 1]) {
      const le = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6.0, 16), tube);
      le.position.set(s * span / 2, 0.06, -0.3); le.rotation.set(Math.PI / 2, 0, 0); le.rotation.z = -s * Math.atan2(span, 3.9); wing.add(le);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 16), tube); up.position.set(s * 0.45, -0.9, -0.38); up.rotation.set(-0.18, 0, s * 0.24); wing.add(up);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 18), tube); bar.rotation.z = Math.PI / 2; bar.position.set(0, -1.75, -0.55); wing.add(bar);
    sh(g);
    const L = { x: BELVEDERE.x + 14, z: BELVEDERE.z + 4 };
    g.position.set(L.x, heightAt(L.x, L.z) + 1.9, L.z);
    g.rotation.y = 0; wing.rotation.x = 0.12;
    scene.add(g);
    C.glider = { g, wing, home: L, yaw: 0, speed: 0, bank: 0, vy: 0 };
  }

  return C;
}

// ponti delle navi: altezza calpestabile in (x,z) o -Infinity
export function deckHeight(C, x, z, feet) {
  let best = -Infinity;
  for (const S of C.ships) {
    const p = S.g.position, c = Math.cos(S.g.rotation.y), s = Math.sin(S.g.rotation.y);
    const dx = x - p.x, dz = z - p.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const D = S.deck, cx = D.cx || 0;
    if (Math.abs(lx - cx) < D.hx && Math.abs(lz) < D.hz) {
      const h = p.y + D.y;
      if (h <= feet + 0.65 && h > best) best = h;
    }
  }
  return best;
}

// spinge fuori dagli ingombri sul ponte (cabine, sovrastrutture)
export function shipCollide(C, pos) {
  for (const S of C.ships) {
    const p = S.g.position, c = Math.cos(S.g.rotation.y), s = Math.sin(S.g.rotation.y);
    for (const b of S.blocks) {
      if (pos.y > p.y + b.top - 0.2 || pos.y < p.y - 2) continue;
      const dx = pos.x - p.x, dz = pos.z - p.z;
      let lx = dx * c - dz * s - b.x, lz = dx * s + dz * c - b.z;
      const ox = b.hx + 0.3 - Math.abs(lx), oz = b.hz + 0.3 - Math.abs(lz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) lx += Math.sign(lx) * ox; else lz += Math.sign(lz) * oz;
        lx += b.x; lz += b.z;
        pos.x = p.x + lx * c + lz * s; pos.z = p.z - lx * s + lz * c;
      }
    }
  }
}

// la nave più vicina a cui puoi salire dall'acqua (entro 4 m dal bordo)
export function boardable(C, x, z) {
  for (const S of C.ships) {
    const p = S.g.position, c = Math.cos(S.g.rotation.y), s = Math.sin(S.g.rotation.y);
    const dx = x - p.x, dz = z - p.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const D = S.deck, cx = D.cx || 0;
    const ex = Math.max(0, Math.abs(lx - cx) - D.hx), ez = Math.max(0, Math.abs(lz) - D.hz);
    if (Math.hypot(ex, ez) < (S.kind === 'ferry' ? 6 : 4)) {
      // punto sul ponte più vicino
      const qx = cx + Math.max(-D.hx + 0.6, Math.min(D.hx - 0.6, lx - cx)), qz = Math.max(-D.hz + 0.6, Math.min(D.hz - 0.6, lz));
      return { S, x: p.x + qx * c + qz * s, z: p.z - qx * s + qz * c, y: p.y + D.y };
    }
  }
  return null;
}

export function updateCraft(C, dt, time, ctx) {
  for (const S of C.ships) if (S.rig && S.rig.sailU) { S.rig.sailU.uT.value = time; S.rig.sailU.uWind.value = ctx.wind ?? 0.4; if (!S.manual) S.rig.sailU.uLuff.value = 0.15; }
  if (C.radar) C.radar.rotation.y = time * 1.6;
  // navi: avanzano sulla loro rotta, gettano l'ancora quando ti avvicini
  for (const S of C.ships) {
    if (S.manual) continue;
    const near = S.g.position.distanceTo(ctx.player) < (S.kind === 'ferry' ? 320 : 180);
    S.anchored = near;
    if (S.blown > 0) S.blown -= dt;
    const bk = Math.min(1, Math.max(0, S.blown || 0) / 5);
    if (!near || bk > 0) S.s += S.speed * (1 + 3 * bk) * dt;
    const P = S.path(S.s);
    const P2 = S.path(S.s + 1);
    S.g.position.x = P.x; S.g.position.z = P.z;
    S.g.position.y = ctx.water + (S.kind === 'sail' ? Math.sin(time * 0.8) * 0.06 : Math.sin(time * 0.3) * 0.05);
    S.g.rotation.y = Math.atan2(P2.z - P.z, -(P2.x - P.x));
    if (S.kind === 'sail') { S.g.rotation.x = Math.sin(time * 0.6) * 0.03; S.g.rotation.z = (S.heel = (S.heel || 0) + (bk * 0.14 - (S.heel || 0)) * Math.min(1, dt * 0.5)); }
    // foschia manuale: da lontano le navi si sciolgono nell'orizzonte
    const d = S.g.position.distanceTo(ctx.camera);
    // lontano la nave si vela nella foschia come tutto il resto (nebbia vera, niente tinte strane)
    if (!S.fogFixed) { S.fogFixed = true; S.g.traverse((o) => { if (o.isMesh && o.material) { o.material.fog = true; if (o.material.emissive) o.material.emissive.setRGB(0, 0, 0); } }); }
  }
  // barchino fermo: dondola
  const B = C.boat;
  if (!B.on) {
    B.g.position.y = ctx.water + 0.12 + Math.sin(time * 1.1) * 0.04;
    B.g.rotation.z = Math.sin(time * 0.8) * 0.03;
    B.speed *= Math.pow(0.5, dt);
  }
}

// guida del barchino
export function driveBoat(B, dt, input, ctx) {
  const { fx, fz, run } = input;
  const vmax = run ? 19 : 12;
  if (fz > 0) B.speed += (vmax - B.speed) * Math.min(1, 0.35 * dt) * fz;
  else if (fz < 0) B.speed = Math.max(B.speed - 6 * dt, -2.5);
  else B.speed *= Math.pow(0.7, dt);
  B.steer += (fx - B.steer) * Math.min(1, 3 * dt);
  B.yaw -= B.steer * 0.8 * Math.min(Math.abs(B.speed) / 4, 1) * Math.sign(B.speed || 1) * dt;
  const fwx = -Math.sin(B.yaw), fwz = -Math.cos(B.yaw);
  const nx = B.g.position.x + fwx * B.speed * dt, nz = B.g.position.z + fwz * B.speed * dt;
  if (ctx.water - heightAt(nx, nz) > 0.5) { B.g.position.x = nx; B.g.position.z = nz; } else B.speed *= -0.2;
  const plane = Math.min(Math.abs(B.speed) / 12, 1);
  B.g.position.y = ctx.water + 0.12 + Math.sin(ctx.time * 1.6) * 0.04 * (1 - plane) + plane * 0.08;
  B.g.rotation.y = B.yaw - Math.PI / 2;
  B.g.rotation.z = -plane * 0.12 - Math.sin(ctx.time * 2.3) * 0.015 * plane;
  B.g.rotation.x = B.steer * plane * 0.15;
  B.motor.rotation.y = B.steer * 0.5;
}

// volo in deltaplano
export function flyGlider(G, dt, input, ctx) {
  const { fx, fz } = input;
  const vt = 11 + fz * 6;
  G.speed += (vt - G.speed) * Math.min(1, 0.5 * dt);
  G.bank += (fx * 0.55 - G.bank) * Math.min(1, 1.8 * dt);
  G.yaw -= (9.8 * Math.tan(G.bank) / Math.max(G.speed, 6)) * dt;
  let sink = 0.75 + 0.03 * (G.speed - 10) * (G.speed - 10) + (G.speed < 7 ? (7 - G.speed) * 1.2 : 0) + G.bank * G.bank * 1.2;
  const p = G.g.position;
  const ground = heightAt(p.x, p.z);
  const d = p.z - shoreZ(p.x);
  // portanza: termiche sulle colline di giorno, e il vento che risale i pendii
  let lift = 0;
  if (d > 80) {
    const th = Math.max(0, vnoise(p.x * 0.006 + 4, p.z * 0.006) - 0.15);
    lift += th * 3.2 * ctx.day;
    lift += ctx.wind * 1.4 * Math.max(0, 1 - (p.y - ground) / 70);
  }
  G.vy += ((lift - sink) - G.vy) * Math.min(1, 1.5 * dt);
  p.x += -Math.sin(G.yaw) * G.speed * dt;
  p.z += -Math.cos(G.yaw) * G.speed * dt;
  p.y += G.vy * dt;
  G.g.rotation.set(0, G.yaw, 0);
  G.wing.rotation.set(0.08 - fz * 0.12, 0, -G.bank);
  const floor = Math.max(ground, ctx.water);
  return { landed: p.y - 1.9 < floor + 0.15, floor };
}
