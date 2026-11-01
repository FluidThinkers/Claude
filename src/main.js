import * as THREE from 'three';
import { Terrain, heightAt, shoreZ } from './terrain.js';
import { evalPalette, makeState, sunDirection, PHASES } from './palette.js';
import { makeSky, makeWater, makePost, skyUniforms, waterUniforms, enhanceSand } from './shaders.js';
import { sandTextures, glowTexture } from './textures.js';
import { buildWorld, updateWorld, spawnRipple, PLATFORM } from './world.js';
import { buildPlaces, updatePlaces, placeHeight, collide, nearBench } from './places.js';
import { Footprints, Scatter, buildSkyline, updateSkyline } from './details.js';
import { Journal, FRAGMENTS, INTRO, ENDING } from './story.js';
import { Sound } from './audio.js';
import { buildSea, updateSea, SUP_START, GEAR } from './sea.js';
import { Gulls, gullPerches } from './birds.js';
import { PONTILE } from './places.js';
import { Flora } from './flora.js';
import { wind, updateWind, SandDrift } from './wind.js';
import { buildBike, rideBike } from './bike.js';
import { buildCraft, updateCraft, deckHeight, shipCollide, boardable, driveBoat, flyGlider } from './craft.js';
import { Minimap } from './minimap.js';
import { SCOGLIERA, PERGOLA, BARCA, TORRETTA, BELVEDERE } from './places.js';
import { FOCE } from './terrain.js';

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) ? parseFloat(Q.get(k)) : d);

// ---------- renderer / scena
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
const MOBILE = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xffffff, 0.001);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 9000);
camera.rotation.order = 'YXZ';

const post = makePost(renderer);
const sky = makeSky(); scene.add(sky);
const water = makeWater(); scene.add(water);

const sand = sandTextures();
const sandMat = new THREE.MeshStandardMaterial({
  map: sand.map, bumpMap: sand.bump, bumpScale: 1.2, roughness: 0.96, vertexColors: true,
  emissive: 0x000000,
});
enhanceSand(sandMat);
const terrain = new Terrain(sandMat);
scene.add(terrain.mesh);

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1);
scene.add(hemi);

const glowTex = glowTexture();
const W = buildWorld(scene, glowTex);
const places = buildPlaces(scene, glowTex, PLATFORM);
const footprints = new Footprints(scene);
const scatter = new Scatter(scene);
const skyline = buildSkyline(scene);
const journal = new Journal();
const sea = buildSea(scene, skyUniforms);
const gulls = new Gulls(scene, gullPerches(PONTILE));
const flora = new Flora(scene, wind);
const drift = new SandDrift(scene);
const bike = buildBike(scene);
const craft = buildCraft(scene);
const minimap = new Minimap(document.getElementById('map'));
{
  const anchor = new THREE.Object3D(); anchor.position.set(2.6, 1.22, 0.7);
  craft.ships[0].g.add(anchor);
  const bt = places.traces[7]; bt.follow = anchor; bt.g.rotation.set(0, 0.4, Math.PI / 2 - 0.1);
}
bike.g.position.y = Math.max(heightAt(bike.g.position.x, bike.g.position.z), placeHeight(bike.g.position.x, bike.g.position.z, 99));
camera.add(bike.fp);
// luce riflessa dal cielo su tutti i materiali (aggiornata ogni tanto)
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envSky = makeSky(); envScene.add(envSky);
let envRT = null, envTimer = 0;
scene.add(camera);
camera.add(sea.fpPaddle);
sea.fpPaddle.position.set(0.42, -0.55, -0.7);
const sound = new Sound();

// ---------- stato
const pal = makeState(), nextPal = makeState();
const sunDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
const moonDir = skyUniforms.uMoonDir.value;
let tod = num('t', 0.715);
const CYCLE = 720; // secondi per un giorno intero
let todAnim = null;
let fade = 0, fadeTarget = 0;
const tmp = new THREE.Vector3();
const tmpC = new THREE.Color();

const player = {
  pos: new THREE.Vector3(num('x', 2), 0, 0),
  vel: new THREE.Vector3(),
  yaw: num('yaw', 0), pitch: num('pitch', 0.02),
  ground: true, bob: 0, rippleT: 0, mode: 'walk', breath: 1, stroke: 0, supSpeed: 0, supYaw: 0,
};
let hasGear = Q.has('gear');
let under = false, lastUnder = false;
const underCol = new THREE.Color();
player.pos.z = num('z', shoreZ(player.pos.x) + 21.5);
player.pos.y = Math.max(heightAt(player.pos.x, player.pos.z), 0);
terrain.update(player.pos.x, player.pos.z, true);
const groundAt = (x, z, feet) => Math.max(heightAt(x, z), placeHeight(x, z, feet), deckHeight(craft, x, z, feet));
// seduti su una panchina il tempo scorre più veloce
let sitting = null;
// azione contestuale: SUP, attrezzatura, panchina
function nearSup() { const g = sea.sup.g.position; return Math.hypot(g.x - player.pos.x, g.z - player.pos.z) < 2.8; }
function nearGear() { return !hasGear && Math.hypot(GEAR.x - player.pos.x, GEAR.z - player.pos.z) < 2.2; }
function nearBoat() { const g = craft.boat.g.position; return Math.hypot(g.x - player.pos.x, g.z - player.pos.z) < 3.2; }
function nearGlider() { const g = craft.glider.g.position; return Math.hypot(g.x - player.pos.x, g.z - player.pos.z) < 3.2; }
function contextAction() {
  if (player.mode === 'bike') return 'scendi dalla moto';
  if (player.mode === 'glide') return null;
  if ((player.mode === 'swim' || player.mode === 'boat' || player.mode === 'sup') && boardable(craft, player.pos.x, player.pos.z)) return 'sali a bordo';
  if (player.mode === 'boat') return 'scendi dal barchino';
  if ((player.mode === 'walk' || player.mode === 'swim') && nearBoat()) return 'sali sul barchino';
  if (player.mode === 'walk' && nearGlider()) return 'prendi il deltaplano';
  if (player.mode === 'sup') return 'scendi dal SUP';
  if (player.mode === 'walk' && Math.hypot(bike.g.position.x - player.pos.x, bike.g.position.z - player.pos.z) < 2.6) return 'sali sulla moto';
  if (nearSup() && player.mode !== 'dive') return 'sali sul SUP';
  if (nearGear()) return 'prendi maschera e pinne';
  if (sitting) return 'alzati';
  if (player.mode === 'walk' && nearBench(player.pos.x, player.pos.z)) return 'siediti';
  return null;
}
function action() {
  const a = contextAction();
  if (a === 'sali a bordo') {
    const b = boardable(craft, player.pos.x, player.pos.z);
    if (player.mode === 'boat') { craft.boat.on = false; sound.engine(false, 0, 0); }
    if (player.mode === 'sup') { sea.sup.onBoard = false; sea.fpPaddle.visible = false; }
    player.mode = 'walk'; player.pos.set(b.x, b.y, b.z); player.vel.set(0, 0, 0); player.ground = true;
    sound.splash('stroke', 0.8); showMsg(b.S.name, 3);
    return;
  }
  if (a === 'sali sul barchino') {
    player.mode = 'boat'; craft.boat.on = true; craft.boat.speed = 0; player.yaw = craft.boat.yaw; player.pitch = -0.05;
    if (!seenBoatHint) { seenBoatHint = true; showMsg(isTouch ? 'Avanti per dare gas · lati per girare' : 'W gas · S indietro · A e D per girare', 4); }
    return;
  }
  if (a === 'scendi dal barchino') {
    const B = craft.boat; B.on = false; sound.engine(false, 0, 0);
    const px = B.g.position.x + Math.cos(B.yaw) * 1.6, pz = B.g.position.z - Math.sin(B.yaw) * 1.6;
    const lvl = waterUniforms.uLevel.value;
    const ph = placeHeight(px, pz, 99);
    player.pos.set(px, 0, pz);
    if (ph > lvl) { player.mode = 'walk'; player.pos.y = ph; }
    else if (lvl - heightAt(px, pz) > 1.3) { player.mode = 'swim'; player.pos.y = lvl + 0.15 - 1.65; sound.splash('dive', 0.7); }
    else { player.mode = 'walk'; player.pos.y = heightAt(px, pz); }
    player.vel.set(0, 0, 0);
    return;
  }
  if (a === 'prendi il deltaplano') {
    const G = craft.glider;
    player.mode = 'glide'; G.yaw = player.yaw; G.speed = 9; G.vy = 0; G.bank = 0;
    G.g.position.set(player.pos.x, player.pos.y + 1.9 + 0.6, player.pos.z);
    if (!seenGlideHint) { seenGlideHint = true; showMsg(isTouch ? 'Avanti per scendere veloce · indietro per rallentare · lati per virare' : 'W picchia · S cabra · A e D virano. Le colline e il vento ti sollevano.', 5); }
    return;
  }
  if (a === 'sali sulla moto') {
    player.mode = 'bike'; bike.on = true; bike.yaw = bike.g.rotation.y; bike.speed = 0; bike.fp.visible = true;
    player.yaw = bike.yaw; player.pitch = -0.05;
    if (!seenBikeHint) { seenBikeHint = true; showMsg(isTouch ? 'Avanti per accelerare · lati per sterzare' : 'W accelera · S frena · A e D sterzano', 4); }
  } else if (a === 'scendi dalla moto') {
    player.mode = 'walk'; bike.on = false; bike.fp.visible = false; bike.speed = 0;
    player.pos.x = bike.g.position.x + Math.cos(bike.yaw) * 1.0; player.pos.z = bike.g.position.z - Math.sin(bike.yaw) * 1.0;
    player.pos.y = groundAt(player.pos.x, player.pos.z, 99); bike.body.rotation.z = 0.12;
  } else if (a === 'sali sul SUP') mountSup();
  else if (a === 'scendi dal SUP') dismountSup();
  else if (a === 'prendi maschera e pinne') {
    hasGear = true; sea.gear.g.visible = false; sound.chime(5);
    showMsg('Maschera e pinne. Qualcuno le ha lasciate asciugare al sole.', 5);
    invEl.textContent = 'maschera · pinne'; invEl.classList.add('on');
  } else if (a === 'siediti' || a === 'alzati') toggleSit();
}
function mountSup() {
  const g = sea.sup.g;
  const lvl = waterUniforms.uLevel.value;
  // se è sulla sabbia, la spingi fino all'acqua
  if (heightAt(g.position.x, g.position.z) > lvl - 0.35) {
    let z = g.position.z;
    for (let k = 0; k < 60 && heightAt(g.position.x, z) > lvl - 0.45; k++) z -= 0.5;
    g.position.z = z;
    sound.splash('paddle', 1.2);
  }
  player.mode = 'sup'; sea.sup.onBoard = true;
  player.supYaw = player.yaw; player.supSpeed = 0;
  sea.fpPaddle.visible = true;
  if (!seenSupHint) { seenSupHint = true; showMsg('W per pagaiare · A e D per girare', 4); }
}
let seenSupHint = false, seenDiveHint = false, seenBikeHint = false, seenBoatHint = false, seenGlideHint = false;
function dismountSup() {
  const g = sea.sup.g;
  sea.sup.onBoard = false; sea.fpPaddle.visible = false;
  sea.sup.vel.set(-Math.sin(player.supYaw), 0, -Math.cos(player.supYaw)).multiplyScalar(player.supSpeed);
  player.pos.x = g.position.x + Math.cos(player.supYaw) * 1.1;
  player.pos.z = g.position.z - Math.sin(player.supYaw) * 1.1;
  const lvl = waterUniforms.uLevel.value;
  const depth = lvl - heightAt(player.pos.x, player.pos.z);
  if (depth > 1.3) { player.mode = 'swim'; player.pos.y = lvl + 0.15 - 1.65; sound.splash('dive', 0.7); }
  else { player.mode = 'walk'; player.pos.y = heightAt(player.pos.x, player.pos.z); }
  player.vel.set(0, 0, 0);
}
function toggleSit() {
  if (sitting) { sitting = null; promptEl.classList.remove('on'); return; }
  const b = nearBench(player.pos.x, player.pos.z);
  if (!b) return;
  sitting = b;
  player.pos.set(b.x, b.y - 0.45, b.z); player.vel.set(0, 0, 0);
  player.yaw = b.yaw; player.pitch = 0.04;
}

// ---------- input
const keys = new Set();
const touch = { move: null, look: null, mx: 0, my: 0 };
let running = false, started = false;
const isTouch = matchMedia('(pointer: coarse)').matches;

addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyT') advancePhase();
  if (e.code === 'KeyM') sound.toggle();
  if (e.code === 'KeyJ') journal.toggle();
  if (e.code === 'KeyN') minimap.toggle();
  if (e.code === 'KeyE') action();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== document.body) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * 0.0022, -1.4, 1.4);
});

const overlay = document.getElementById('start');
if (MOBILE) { overlay.querySelector('.cta').textContent = 'Tocca per entrare'; overlay.querySelector('.keys').innerHTML = 'Sinistra: muoviti · Destra: guarda<br>SU / GIÙ: salta, risali, immergiti · AZIONE · ORA · DIARIO<br>Ritrova i ricordi: ognuno ti porterà al prossimo.'; }
function begin() {
  sound.start();
  started = running = true;
  overlay.classList.add('hidden');
  if (!isTouch) document.body.requestPointerLock?.();
  else document.getElementById('touch').classList.remove('hidden');
  if (!introDone) { introDone = true; sequence(INTRO, 4.5, 1.5); setTimeout(() => { if (places.found === 0) setGoal('Un riflesso di luce, sul cumulo di sabbia vicino a te.'); }, 15000); }
}
let introDone = false;
overlay.addEventListener('click', begin);
document.addEventListener('pointerlockchange', () => {
  if (!isTouch && document.pointerLockElement !== document.body && started) {
    running = false;
    overlay.querySelector('.cta').textContent = 'Clicca per tornare';
    overlay.classList.remove('hidden');
  }
});

// touch: metà sinistra = cammina, metà destra = guarda
const stick = document.getElementById('stick');
addEventListener('touchstart', (e) => {
  if (!started) return;
  for (const t of e.changedTouches) {
    if (t.target.classList && t.target.classList.contains('tbtn')) continue;
    if (t.clientX < innerWidth / 2 && !touch.move) {
      touch.move = { id: t.identifier, x0: t.clientX, y0: t.clientY };
      stick.style.left = t.clientX + 'px'; stick.style.top = t.clientY + 'px'; stick.classList.add('on');
    } else if (!touch.look) touch.look = { id: t.identifier, x: t.clientX, y: t.clientY };
  }
}, { passive: true });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (touch.move && t.identifier === touch.move.id) {
      touch.mx = THREE.MathUtils.clamp((t.clientX - touch.move.x0) / 50, -1, 1);
      touch.my = THREE.MathUtils.clamp((t.clientY - touch.move.y0) / 50, -1, 1);
    } else if (touch.look && t.identifier === touch.look.id) {
      player.yaw -= (t.clientX - touch.look.x) * 0.005;
      player.pitch = THREE.MathUtils.clamp(player.pitch - (t.clientY - touch.look.y) * 0.005, -1.4, 1.4);
      touch.look.x = t.clientX; touch.look.y = t.clientY;
    }
  }
}, { passive: true });
addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (touch.move && t.identifier === touch.move.id) { touch.move = null; touch.mx = touch.my = 0; stick.classList.remove('on'); }
    if (touch.look && t.identifier === touch.look.id) touch.look = null;
  }
});
let touchJump = false;
document.getElementById('jumpBtn').addEventListener('touchstart', (e) => { touchJump = true; touchUp = true; e.preventDefault(); });
document.getElementById('timeBtn').addEventListener('touchstart', (e) => { advancePhase(); e.preventDefault(); });
document.getElementById('actBtn').addEventListener('touchstart', (e) => { action(); e.preventDefault(); });
let touchDive = false;
document.getElementById('diveBtn').addEventListener('touchstart', (e) => { touchDive = true; e.preventDefault(); });
document.getElementById('diveBtn').addEventListener('touchend', () => { touchDive = false; });
let touchUp = false;
document.getElementById('jumpBtn').addEventListener('touchend', () => { touchUp = false; });
document.getElementById('bookBtn').addEventListener('touchstart', (e) => { journal.toggle(); e.preventDefault(); });
document.getElementById('journal').addEventListener('click', () => journal.toggle(false));

// ---------- HUD
const phaseEl = document.getElementById('phase'), countEl = document.getElementById('count'), msgEl = document.getElementById('msg'), promptEl = document.getElementById('prompt'), clockEl = document.getElementById('clock'), invEl = document.getElementById('inv');
let lastLabel = '', msgTimer = 0, phaseTimer = 0;
function showMsg(text, dur = 5) { msgEl.textContent = text; msgEl.classList.add('on'); msgTimer = dur; }
function sequence(lines, every = 4, delay = 0) {
  lines.forEach((l, i) => setTimeout(() => showMsg(l, every - 0.6), (delay + i * every) * 1000));
}

function advancePhase() {
  const cur = ((tod % 1) + 1) % 1;
  let next = PHASES.find((p) => p > cur + 0.005);
  if (next === undefined) next = PHASES[0] + 1;
  todAnim = { from: tod, to: tod - cur + next, t: 0, dur: 4 };
  sound.chord();
}

function nextPhaseT() {
  const cur = ((tod % 1) + 1) % 1;
  const n = PHASES.find((p) => p > cur + 0.005);
  return n === undefined ? PHASES[0] : n;
}

// ---------- la catena dei ricordi
let active = 0;
let illum = 0;
let zone = null;
const goalEl = document.getElementById('goal');
function setGoal(txt) {
  goalEl.innerHTML = `<span class="gc">Ricordi ${places.found} / ${places.traces.length}</span>${txt}`;
  goalEl.classList.add('on');
}
function setZone(i) {
  const t = places.traces[i];
  if (!t) { zone = null; return; }
  const a = Math.random() * 6.28, r = 15 + Math.random() * 25;
  zone = { i, x: t.pos.x + Math.cos(a) * r, z: t.pos.z + Math.sin(a) * r, r: 55 };
}
// una piccola luce che si stacca dall'oggetto e vola verso il prossimo ricordo
const wisp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe2b8, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
wisp.scale.setScalar(0.9); scene.add(wisp);
const wispS = { t: -1, from: new THREE.Vector3(), dir: new THREE.Vector3() };
function launchWisp(from, to) {
  wispS.t = 0; wispS.from.copy(from);
  wispS.dir.set(to.x - from.x, 0, to.z - from.z).normalize();
}
function updateWisp(dt) {
  if (wispS.t < 0) return;
  wispS.t += dt;
  const k = wispS.t;
  const rise = Math.min(k * 1.2, 2.5);
  const run = Math.max(0, k - 1.5) * 6;
  wisp.position.copy(wispS.from).addScaledVector(wispS.dir, run);
  wisp.position.y += rise + Math.sin(k * 3) * 0.2;
  wisp.material.opacity = Math.min(1, k) * Math.max(0, 1 - Math.max(0, k - 7) / 3);
  wisp.scale.setScalar(0.6 + 0.25 * Math.sin(k * 6));
  if (k > 10) { wispS.t = -1; wisp.material.opacity = 0; }
}
function onFind(t) {
  sound.chime(t.i); setTimeout(() => sound.chord(), 400);
  const f = FRAGMENTS[t.i];
  journal.add(t.i);
  illum = 1;
  showMsg(f.text, 9);
  active = t.i + 1;
  setZone(active);
  // il pensiero arriva dopo il ricordo, e indica la strada
  setTimeout(() => {
    msgEl.classList.add('thought');
    showMsg(f.thought, 8);
    if (zone) launchWisp(t.pos, zone);
    setTimeout(() => msgEl.classList.remove('thought'), 8000);
    const nf = FRAGMENTS[active];
    if (nf) {
      setGoal(f.goal);
      const need = nf.needs;
      if (nf.needsHint && (need !== 'gear' || !hasGear)) setTimeout(() => showMsg(nf.needsHint, 6), 9000);
    } else {
      setGoal(f.goal);
      if (f.needsHint) setTimeout(() => showMsg(f.needsHint, 6), 9000);
    }
  }, 9500);
  if (active >= places.traces.length) {
    zone = { x: 18, z: shoreZ(18) + 1, r: 30 };
    // ti aspetta sul bagnasciuga, vicino alla bandiera
    const P = W.phantom;
    const x = 18, z = shoreZ(18) + 0.9;
    P.g.position.set(x, Math.max(heightAt(x, z), 0), z);
    P.g.rotation.y = 0; P.legL.rotation.x = P.legR.rotation.x = 0;
    P.state = 'final'; P.op = 0; P.dir = -1; P.d = 1.6; P.g.visible = true;
  }
}
function onMeet() {
  zone = null;
  goalEl.classList.remove('on');
  sequence(ENDING, 4.2, 0.5);
  setTimeout(() => { sound.chord(); const cur = ((tod % 1) + 1) % 1; todAnim = { from: tod, to: tod - cur + (cur < 0.75 ? 0.755 : 1.755), t: 0, dur: 30 }; }, ENDING.length * 4200);
}

// ---------- loop
const clock = new THREE.Timer();
let elapsed = 0;


function frame() {
  requestAnimationFrame(frame);
  clock.update(); const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const freeze = Q.has('freeze');

  // tempo del giorno
  if (todAnim) {
    todAnim.t += dt;
    const k = Math.min(todAnim.t / todAnim.dur, 1);
    const e = k * k * (3 - 2 * k);
    tod = todAnim.from + (todAnim.to - todAnim.from) * e;
    if (k >= 1) todAnim = null;
  } else if (running && !freeze) tod += dt / CYCLE;

  evalPalette(tod, pal);
  evalPalette(nextPhaseT(), nextPal);
  const elev = sunDirection(((tod % 1) + 1) % 1, sunDir);
  const dayK = THREE.MathUtils.smoothstep(elev, -0.06, 0.06);
  const night = 1 - THREE.MathUtils.smoothstep(elev, -0.25, 0.02);
  lightDir.copy(moonDir).lerp(sunDir, dayK).normalize();

  // movimento: camminare, guadare, nuotare, immergersi, pagaiare
  const lvl = 0.05 * Math.sin(elapsed * 0.45);
  waterUniforms.uLevel.value = lvl;
  let fx = 0, fz = 0, run = false, jump = false, upK = false, downK = false;
  if (running) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) fz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fz -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
    fx += touch.mx; fz -= touch.my;
    const len = Math.hypot(fx, fz);
    if (sitting && len > 0.2) { sitting = null; promptEl.classList.remove('on'); }
    if (sitting) { fx = 0; fz = 0; }
    if (len > 1) { fx /= len; fz /= len; }
    run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(touch.mx, touch.my) > 0.95;
    jump = keys.has('Space') || touchJump;
    upK = keys.has('Space') || touchUp;
    downK = keys.has('KeyC') || keys.has('ControlLeft') || touchDive;
    touchJump = false;
  }
  const ys = Math.sin(player.yaw), yc = Math.cos(player.yaw);
  const depthAt = (x, z) => lvl - heightAt(x, z);
  const M = player.mode;
  let eyeH = 1.65;

  if (M === 'walk') {
    const depth = Math.max(0, depthAt(player.pos.x, player.pos.z));
    const onDeck = placeHeight(player.pos.x, player.pos.z, player.pos.y) > heightAt(player.pos.x, player.pos.z) + 0.1;
    const wade = onDeck ? 0 : Math.min(depth / 1.25, 1);
    const speed = (run ? 9 : 4.2) * (1 - 0.62 * wade);
    const tx = (-ys * fz + yc * fx) * speed, tz = (-yc * fz - ys * fx) * speed;
    const acc = player.ground ? 10 : 2;
    player.vel.x += (tx - player.vel.x) * Math.min(1, acc * dt);
    player.vel.z += (tz - player.vel.z) * Math.min(1, acc * dt);
    if (jump && player.ground && wade < 0.5) { player.vel.y = 5.2; player.ground = false; }
    player.vel.y -= 13 * dt;
    player.pos.addScaledVector(player.vel, dt);
    collide(player.pos); shipCollide(craft, player.pos);
    const gh = groundAt(player.pos.x, player.pos.z, player.pos.y);
    const d2 = depthAt(player.pos.x, player.pos.z);
    if (d2 > 1.3 && player.pos.y < lvl - 0.2) {
      // dentro l'acqua alta: si nuota
      if (player.vel.y < -3) { sound.splash('dive', 1); for (let i = 0; i < 3; i++) setTimeout(() => spawnRipple(W, player.pos.x, player.pos.z, night > 0.5), i * 160); }
      player.mode = 'swim'; player.vel.y = 0;
      if (!seenDiveHint) { seenDiveHint = true; showMsg(isTouch ? 'GIÙ per immergerti' : 'C per immergerti · Spazio per risalire', 4); }
    } else if (player.pos.y <= gh) {
      player.pos.y = gh; player.vel.y = Math.max(player.vel.y, 0); player.ground = true;
    } else if (player.pos.y > gh + 0.05) player.ground = false;
    if (player.ground) player.pos.y += (gh - player.pos.y) * Math.min(1, dt * 20);
    player.breath = Math.min(1, player.breath + dt * 0.3);
  } else if (M === 'swim') {
    const speed = (hasGear ? 2.8 : 1.7) * (run ? 1.35 : 1);
    const tx = (-ys * fz + yc * fx) * speed, tz = (-yc * fz - ys * fx) * speed;
    player.vel.x += (tx - player.vel.x) * Math.min(1, 2.2 * dt);
    player.vel.z += (tz - player.vel.z) * Math.min(1, 2.2 * dt);
    player.vel.y = 0;
    player.pos.x += player.vel.x * dt; player.pos.z += player.vel.z * dt;
    collide(player.pos); shipCollide(craft, player.pos);
    player.pos.y = lvl + 0.12 - 1.65 + Math.sin(elapsed * 1.6) * 0.04;
    const hsw = Math.hypot(player.vel.x, player.vel.z);
    player.stroke += dt * hsw * 0.9;
    if (player.stroke > 1) { player.stroke = 0; sound.splash('stroke', 0.8); }
    if (depthAt(player.pos.x, player.pos.z) < 1.2) { player.mode = 'walk'; player.pos.y = heightAt(player.pos.x, player.pos.z); player.ground = true; }
    else if (downK) { player.mode = 'dive'; player.pos.y -= 0.7; player.vel.y = -1.4; sound.splash('dive', 0.6); sound.bubbles(); }
    player.breath = Math.min(1, player.breath + dt * 0.25);
  } else if (M === 'dive') {
    const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
    const speed = (hasGear ? 2.6 : 1.4) * (run ? 1.3 : 1);
    const dx = (-ys * cp * fz + yc * fx) * speed, dz = (-yc * cp * fz - ys * fx) * speed;
    let dy = sp * fz * speed + (upK ? 1.3 : 0) - (downK ? 1.3 : 0);
    if (player.breath <= 0) dy = 2.2;
    const k = Math.min(1, 2 * dt);
    player.vel.x += (dx - player.vel.x) * k; player.vel.z += (dz - player.vel.z) * k;
    player.vel.y += (dy + 0.18 - player.vel.y) * k;
    player.pos.addScaledVector(player.vel, dt);
    const floor = heightAt(player.pos.x, player.pos.z) + 0.45 - 1.65;
    if (player.pos.y < floor) { player.pos.y = floor; player.vel.y = Math.max(0, player.vel.y); }
    player.breath -= dt / (hasGear ? 45 : 30);
    if (Math.random() < dt * 0.5) sound.bubbles();
    if (player.pos.y + 1.65 > lvl + 0.05 && player.vel.y > 0) {
      player.mode = depthAt(player.pos.x, player.pos.z) > 1.3 ? 'swim' : 'walk';
      if (player.mode === 'walk') player.pos.y = heightAt(player.pos.x, player.pos.z);
      sound.splash('stroke', 1.2);
      if (player.breath < 0.3) showMsg('Aria.', 2);
    }
  } else if (M === 'boat') {
    const B = craft.boat;
    driveBoat(B, dt, { fx, fz, run }, { water: lvl, time: elapsed });
    // seduto a poppa, vicino al motore
    tmp.set(1.5, 0.45, 0).applyEuler(B.g.rotation).add(B.g.position);
    player.pos.set(tmp.x, tmp.y - 0.6, tmp.z);
    player.vel.set(-Math.sin(B.yaw) * B.speed, 0, -Math.cos(B.yaw) * B.speed);
    let dy = B.yaw - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    player.yaw += dy * Math.min(1, dt * (Math.abs(B.speed) > 1 ? 2 : 0.2));
    eyeH = 1.45;
    player.boatRoll = B.g.rotation.x;
    sound.engine(true, B.speed * 1.6, Math.max(0, fz));
    if (Math.abs(B.speed) > 3 && Math.random() < dt * 4) spawnRipple(W, B.g.position.x, B.g.position.z, night > 0.5);
  } else if (M === 'glide') {
    const G = craft.glider;
    const r = flyGlider(G, dt, { fx, fz }, { wind: wind.strength.value, day: 1 - night, water: lvl });
    player.pos.set(G.g.position.x - Math.sin(G.yaw) * -0.5, G.g.position.y - 2.05 - 1.6, G.g.position.z - Math.cos(G.yaw) * -0.5);
    let dy = G.yaw - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    player.yaw += dy * Math.min(1, dt * 1.5);
    player.vel.set(-Math.sin(G.yaw) * G.speed, G.vy, -Math.cos(G.yaw) * G.speed);
    eyeH = 1.6;
    sound.wind(Math.min(1, 0.4 + G.speed / 20));
    if (r.landed) {
      player.mode = 'walk';
      const gy = groundAt(G.g.position.x, G.g.position.z, 99);
      player.pos.set(G.g.position.x, Math.max(gy, lvl - 1.0), G.g.position.z);
      if (lvl - heightAt(player.pos.x, player.pos.z) > 1.3) { player.mode = 'swim'; player.pos.y = lvl + 0.15 - 1.65; sound.splash('dive', 1); G.g.position.y = lvl + 0.3; }
      else { G.g.position.y = gy + 1.9; sound.step('sand', 4); }
      G.wing.rotation.set(0.12, 0, 0);
      showMsg('Atterrato.', 2);
    }
  } else if (M === 'bike') {
    const r = rideBike(bike, dt, { fx, fz, run }, { ground: (x, z, y) => groundAt(x, z, y + 0.4), water: lvl });
    player.pos.set(bike.g.position.x, bike.g.position.y, bike.g.position.z);
    player.vel.set(-Math.sin(bike.yaw) * bike.speed, 0, -Math.cos(bike.yaw) * bike.speed);
    // lo sguardo torna lentamente davanti quando corri
    let dy = bike.yaw - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    player.yaw += dy * Math.min(1, dt * (Math.abs(bike.speed) > 1 ? 2.5 : 0.3));
    eyeH = 1.48;
    player.bikeLean = r.lean; player.bikePitch = r.pitch;
    sound.engine(true, bike.speed, Math.max(0, fz));
  } else if (M === 'sup') {
    const g = sea.sup.g;
    const target = (run ? 4.4 : 3.2) * fz;
    player.supSpeed += (target - player.supSpeed) * Math.min(1, (Math.abs(fz) > 0 ? 0.7 : 0.25) * dt);
    player.supYaw -= fx * dt * 0.7;
    let dyaw = player.yaw - player.supYaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    if (Math.abs(fz) > 0) player.supYaw += dyaw * Math.min(1, dt * 0.35);
    const vx = -Math.sin(player.supYaw) * player.supSpeed, vz = -Math.cos(player.supYaw) * player.supSpeed;
    const nx = g.position.x + vx * dt, nz = g.position.z + vz * dt;
    if (depthAt(nx, nz) > 0.3) { g.position.x = nx; g.position.z = nz; } else player.supSpeed *= 0.5;
    g.rotation.y = player.supYaw;
    player.pos.set(g.position.x, g.position.y + 0.07, g.position.z);
    player.vel.set(vx, 0, vz);
    eyeH = 1.72;
    // pagaiata
    if (Math.abs(fz) > 0.1) player.stroke += dt * 0.9;
    const ph = player.stroke * Math.PI * 2;
    const side = Math.floor(player.stroke) % 2 ? -1 : 1;
    sea.fpPaddle.position.set(0.42 * side, -0.55 + Math.max(0, Math.sin(ph)) * 0.12, -0.75 + Math.cos(ph) * 0.35);
    sea.fpPaddle.rotation.set(-0.35 + Math.sin(ph) * 0.3, 0, side * 0.12);
    if (Math.floor(player.stroke) !== player.lastStroke) { player.lastStroke = Math.floor(player.stroke); if (Math.abs(fz) > 0.1) { sound.splash('paddle', 1); spawnRipple(W, g.position.x + Math.cos(player.supYaw) * 0.6 * side, g.position.z - Math.sin(player.supYaw) * 0.6 * side, night > 0.5); } }
  }

  const hs = Math.hypot(player.vel.x, player.vel.z);
  const terrH = heightAt(player.pos.x, player.pos.z);
  const wadeDepth = player.mode === 'walk' ? Math.max(0, lvl - terrH) : 0;
  const onSand = player.mode === 'walk' && wadeDepth <= 0.02 && Math.abs(player.pos.y - terrH) < 0.05;
  if (player.mode === 'walk' && player.ground) player.bob += hs * dt * (1.9 - wadeDepth);
  const bobAmp = player.mode === 'walk' ? 0.035 * Math.min(hs / 4, 1.5) : 0;
  let roll = Math.sin(player.bob) * 0.004 * Math.min(hs / 4, 1.5);
  if (player.mode === 'sup') roll = Math.sin(elapsed * 0.9) * 0.025 + Math.sin(elapsed * 1.7) * 0.01;
  if (player.mode === 'swim') roll = Math.sin(elapsed * 1.3) * 0.02;
  if (player.mode === 'boat') roll = (player.boatRoll || 0) * 0.8 + Math.sin(elapsed * 1.1) * 0.012;
  if (player.mode === 'glide') roll = craft.glider.bank * 0.85;
  if (player.mode === 'bike') roll = (player.bikeLean || 0) * 0.7 + Math.sin(elapsed * 23) * 0.0015 * Math.min(Math.abs(bike.speed), 10);
  if (player.mode !== 'bike' && player.mode !== 'boat') sound.engine(false, 0, 0);
  const bob = Math.sin(player.bob * 2) * bobAmp;
  camera.position.set(player.pos.x, player.pos.y + (sitting ? 1.12 : eyeH) + bob, player.pos.z);
  camera.rotation.set(player.pitch + (player.mode === 'bike' ? (player.bikePitch || 0) * 0.6 : 0), player.yaw, roll);
  under = camera.position.y < lvl - 0.03;

  if (player.mode === 'walk' && wadeDepth > 0.08 && player.ground && hs > 0.5) {
    player.rippleT -= dt;
    if (player.rippleT <= 0) { spawnRipple(W, player.pos.x, player.pos.z, night > 0.5); player.rippleT = 0.5; sound.splash('stroke', 0.5 + wadeDepth * 0.4); }
  }

  const fp = footprints.update(dt, player.pos, player.yaw, onSand && player.ground, hs > 0.6, hs * dt);
  if (fp) sound.step('sand', hs);
  footprints.tick(dt);
  scatter.update(player.pos.x, player.pos.z);
  flora.update(player.pos.x, player.pos.z);
  const windK = updateWind(elapsed);
  drift.update(dt, player.pos, windK);
  sound.wind(windK);
  waterUniforms.uWindK.value = windK; waterUniforms.uWindDir.value.copy(wind.dir);
  updateSea(sea, dt, elapsed, { player: player.pos, water: lvl });
  updateCraft(craft, dt, elapsed, { player: player.pos, camera: camera.position, water: lvl, fog: pal.fog * 2.2, hor: pal.hor });
  gulls.update(dt, elapsed, camera.position, (p, takeoff) => {
    const rel = tmp.copy(p).sub(camera.position);
    const pan = rel.x * Math.cos(player.yaw) - rel.z * Math.sin(player.yaw);
    sound.gull(pan / Math.max(rel.length(), 1), rel.length() * (under ? 4 : 1));
    if (takeoff) sound.splash('stroke', 0.3);
  });

  // contesto
  {
    const a = contextAction();
    if (sitting) { promptEl.textContent = 'Il tempo passa · E per alzarti'; promptEl.classList.add('on'); }
    else if (a) { promptEl.textContent = (isTouch ? 'AZIONE · ' : 'E · ') + a; promptEl.classList.add('on'); }
    else if (player.mode === 'dive' && player.breath < 0.35) { promptEl.textContent = 'risali'; promptEl.classList.add('on'); }
    else promptEl.classList.remove('on');
  }

  // panchina
  if (sitting) {
    player.pos.x = sitting.x; player.pos.z = sitting.z; player.vel.set(0, 0, 0);
    if (!todAnim && running) tod += dt * 24 / CYCLE;
  }

  terrain.update(player.pos.x, player.pos.z);

  // uniform/luci
  const U = skyUniforms;
  U.uTime.value = elapsed;
  U.uZen.value.copy(pal.zen); U.uMid.value.copy(pal.mid); U.uHor.value.copy(pal.hor); U.uSea.value.copy(pal.sea);
  U.uSunDir.value.copy(sunDir); U.uSunCol.value.copy(pal.sun);
  U.uSunVis.value = THREE.MathUtils.smoothstep(elev, -0.08, 0.03);
  U.uNight.value = night;
  U.uCamPos.value.copy(camera.position);
  const todN = ((tod % 1) + 1) % 1;
  const slow = Math.sin(elapsed * 0.013) * 0.5 + Math.sin(elapsed * 0.0071 + 2) * 0.5;
  U.uCloud.value = Q.has('clouds') ? num('clouds', 0.4) : THREE.MathUtils.clamp(0.2 + 0.28 * slow, 0.0, 0.7);
  U.uCirrus.value = 0.35 + 0.35 * Math.sin(elapsed * 0.009 + 1);
  const alto = Q.has('alto') ? num('alto', 1) : THREE.MathUtils.clamp(Math.sin(elapsed * 0.0045 + 2.2) * 1.4 - 0.5, 0, 1);
  U.uAlto.value = alto;
  const mist = THREE.MathUtils.clamp(0.75 * Math.exp(-(((todN - 0.26) / 0.06) ** 2)) + 0.25 * night + 0.12 * (0.5 + 0.5 * Math.sin(elapsed * 0.02)), 0, 1);
  U.uMist.value = mist;

  sun.color.copy(pal.sun); sun.intensity = pal.sunI * (1 - alto * 0.55);
  sun.position.copy(player.pos).addScaledVector(lightDir, 120);
  sun.target.position.copy(player.pos);
  hemi.color.copy(pal.hs); hemi.groundColor.copy(pal.hg); hemi.intensity = pal.hI;
  scene.fog.color.copy(pal.hor); scene.fog.density = pal.fog * 2.2 * (1 + mist * 1.2);
  // sott'acqua: colore e foschia dell'acqua, la luce dipende dal giorno
  const daylight = 1 - night;
  underCol.setRGB(0.025, 0.2, 0.25).multiplyScalar(0.12 + 0.88 * daylight).lerp(tmpC.copy(pal.sun).multiplyScalar(0.12 * daylight), 0.15);
  waterUniforms.uUnderCol.value.copy(underCol);
  waterUniforms.uUnderFog.value = hasGear ? 0.035 : 0.16;
  if (under) { scene.fog.color.copy(underCol); scene.fog.density = hasGear ? 0.042 : 0.17; scene.background = underCol; }
  else scene.background = null;
  sky.visible = !under; skyline.g.visible = !under;
  bike.light.intensity = bike.on && night > 0.3 ? 60 * night : 0;
  bike.lens.material.color.setRGB(0.4 + (bike.on ? night * 4 : 0), 0.38 + (bike.on ? night * 3.8 : 0), 0.3 + (bike.on ? night * 3 : 0));
  if (bike.light.intensity > 0) {
    bike.light.position.set(bike.g.position.x, bike.g.position.y + 1.1, bike.g.position.z);
    bike.light.target.position.set(bike.g.position.x - Math.sin(bike.yaw) * 20, bike.g.position.y - 1, bike.g.position.z - Math.cos(bike.yaw) * 20);
  }
  // riflessi del cielo: aggiorna la luce ambientale ogni pochi secondi
  envTimer -= dt;
  if (envTimer <= 0) {
    envTimer = MOBILE ? 8 : 4;
    const old = envRT;
    envSky.position.set(0, 0, 0);
    envRT = pmrem.fromScene(envScene, 0, 0.1, 100);
    scene.environment = envRT.texture;
    if (old) old.dispose();
  }
  scene.environmentIntensity = under ? 0.15 : 0.35 + 0.4 * (1 - night);
  hemi.intensity = pal.hI * 0.7;
  if (under !== lastUnder) { lastUnder = under; sound.setUnder(under ? 1 : 0); }

  waterUniforms.uCam.value.copy(camera.position);
  waterUniforms.uLightDir.value.copy(lightDir);
  waterUniforms.uLightCol.value.copy(pal.sun).multiplyScalar(pal.sunI * 0.5);
  waterUniforms.uAmb.value.copy(pal.hs).multiplyScalar(pal.hI * 0.75).add(tmpC.copy(pal.sun).multiplyScalar(pal.sunI * Math.max(sunDir.y, 0) * 0.18));
  waterUniforms.uFog.value = pal.fog;
  water.position.set(Math.round(player.pos.x / 4) * 4, 0, Math.round(player.pos.z / 4) * 4);
  sky.position.copy(camera.position);

  updateWorld(W, dt, elapsed, {
    player: player.pos, yaw: player.yaw, night, pal, nextHor: nextPal.hor, onMeet,
  });
  updateWisp(dt);
  illum = Math.max(0, illum - dt * 0.25);
  updatePlaces(places, dt, elapsed, { active, wind: windK, night, player: player.pos, eye: camera.position, tod: todN, underwater: under, onFind });
  updateSkyline(skyline, camera.position, pal, sunDir, U.uSunVis.value);

  sound.update(elapsed, player.pos.z - shoreZ(player.pos.x), player.mode !== 'walk', hs, night);

  // HUD
  if (pal.label !== lastLabel) { lastLabel = pal.label; phaseEl.textContent = pal.label; phaseEl.classList.add('on'); phaseTimer = 4; }
  if (phaseTimer > 0 && (phaseTimer -= dt) <= 0) phaseEl.classList.remove('on');
  if (msgTimer > 0 && (msgTimer -= dt) <= 0) msgEl.classList.remove('on');
  {
    const mins = Math.floor(todN * 24 * 60);
    const txt = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    if (clockEl.textContent !== txt) clockEl.textContent = txt;
  }

  // mappa
  minimap.draw({
    player: player.pos, yaw: player.yaw, foce: FOCE,
    pontile: [{ x: PONTILE.x, z: PONTILE.z0 + PONTILE.from }, { x: PONTILE.x, z: PONTILE.z0 + PONTILE.to }],
    scogliera: [{ x: SCOGLIERA.x, z: SCOGLIERA.z0 + SCOGLIERA.from }, { x: SCOGLIERA.x, z: SCOGLIERA.z0 + SCOGLIERA.to }],
    places: [
      { ...PERGOLA, name: 'Chiosco' }, { ...BARCA, name: 'Barca in secco' }, { ...TORRETTA, name: 'Stabilimento' },
      { ...BELVEDERE, name: 'Belvedere' }, { x: PLATFORM.x, z: PLATFORM.z, name: 'Piattaforma' },
      { x: FOCE.x, z: shoreZ(FOCE.x) + 20, name: 'Foce' }, { x: 15, z: shoreZ(15) + 2, name: 'Bandiera' },
    ],
    vehicles: [
      { x: bike.g.position.x, z: bike.g.position.z, name: 'Moto', color: '#e0623f' },
      { x: sea.sup.g.position.x, z: sea.sup.g.position.z, name: 'SUP', color: '#7fd0e6' },
      { x: craft.boat.g.position.x, z: craft.boat.g.position.z, name: 'Barchino', color: '#f2efe6' },
      { x: craft.glider.g.position.x, z: craft.glider.g.position.z, name: 'Deltaplano', color: '#ff8a5c' },
      ...(hasGear ? [] : [{ x: GEAR.x, z: GEAR.z, name: 'Maschera e pinne', color: '#9fe0a0' }]),
      ...craft.ships.map((S) => ({ x: S.g.position.x, z: S.g.position.z, name: S.name, color: '#d8e6f2' })),
    ],
    traces: places.traces.filter((t) => t.found).map((t) => ({ x: t.pos.x, z: t.pos.z, found: true })),
    zone,
    figure: W.phantom.state === 'final' ? W.phantom.g.position : null,
  });

  // post
  const P = post.uniforms;
  P.uTime.value = elapsed;
  P.uExposure.value = pal.exp;
  P.uGrade.value.copy(pal.grade);
  P.uSunCol.value.copy(pal.sun);
  tmp.copy(camera.position).addScaledVector(sunDir, 1000).project(camera);
  const inFront = tmp.z < 1;
  P.uSunPos.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
  const edge = Math.max(Math.abs(tmp.x), Math.abs(tmp.y));
  P.uSunVis.value = inFront && !under ? U.uSunVis.value * (1 - THREE.MathUtils.smoothstep(edge, 0.9, 1.3)) : 0;
  P.uHaze.value = inFront && !under ? U.uSunVis.value * (0.1 + mist * 0.6) * (1 - U.uCloud.value * 0.5) : 0;
  P.uUnder.value = under ? 1 : 0;
  P.uBlur.value = under && !hasGear ? 1 : 0;
  P.uMask.value = under && hasGear ? 1 : 0;
  P.uIllum.value = illum;
  P.uUnderCol.value.copy(underCol);
  P.uBreath.value = player.mode === 'dive' ? THREE.MathUtils.smoothstep(0.4 - player.breath, 0, 0.4) : 0;
  fade += (fadeTarget - fade) * Math.min(1, dt * 1.5);
  P.uFade.value = fade;

  renderer.setRenderTarget(post.rt);
  renderer.render(scene, camera);
  post.render();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.resize(s.x, s.y);
});

if (Q.has('autostart')) { started = running = true; overlay.classList.add('hidden'); }
if (Q.get('mode') === 'sup') { sea.sup.g.position.set(player.pos.x, 0, player.pos.z); sea.sup.g.position.y = 0.06; mountSup(); }
if (Q.get('mode') === 'swim') { player.mode = 'swim'; }
if (Q.get('mode') === 'glide') { craft.glider.g.position.set(player.pos.x, player.pos.y + 2.5, player.pos.z); player.mode = 'walk'; action(); }
if (Q.get('mode') === 'boat') { craft.boat.g.position.set(player.pos.x, 0.1, player.pos.z); player.mode = 'walk'; action(); }
if (Q.get('mode') === 'bike') { bike.g.position.set(player.pos.x, groundAt(player.pos.x, player.pos.z, 99), player.pos.z); bike.g.rotation.y = player.yaw; player.mode = 'walk'; action(); }
if (Q.get('mode') === 'dive') { player.mode = 'dive'; player.pos.y = num('y', -4) - 1.65; }
frame();
window.__riva = { craft, player, scene, water, renderer, W, journal, footprints, places, sea, findAll: () => places.traces.forEach((t) => t.pos.copy(camera.position)), setGear: () => { hasGear = true; }, setTime: (t) => { tod = t; } };
