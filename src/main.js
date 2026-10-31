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

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) ? parseFloat(Q.get(k)) : d);

// ---------- renderer / scena
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
sun.shadow.mapSize.set(2048, 2048);
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
const sound = new Sound();

// ---------- stato
const pal = makeState(), nextPal = makeState();
const sunDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
const moonDir = skyUniforms.uMoonDir.value;
let tod = num('t', 0.715);
const CYCLE = 720; // secondi per un giorno intero
let todAnim = null;
let fade = 0, fadeTarget = 0;

const player = {
  pos: new THREE.Vector3(num('x', 2), 0, 0),
  vel: new THREE.Vector3(),
  yaw: num('yaw', 0), pitch: num('pitch', 0.02),
  ground: true, bob: 0, rippleT: 0,
};
player.pos.z = num('z', shoreZ(player.pos.x) + 21.5);
player.pos.y = Math.max(heightAt(player.pos.x, player.pos.z), 0);
terrain.update(player.pos.x, player.pos.z, true);
const groundAt = (x, z, feet) => Math.max(heightAt(x, z), 0.02, placeHeight(x, z, feet));
// seduti su una panchina il tempo scorre più veloce
let sitting = null;
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
  if (e.code === 'KeyE') toggleSit();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== document.body) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * 0.0022, -1.4, 1.4);
});

const overlay = document.getElementById('start');
function begin() {
  sound.start();
  started = running = true;
  overlay.classList.add('hidden');
  if (!isTouch) document.body.requestPointerLock?.();
  else document.getElementById('touch').classList.remove('hidden');
  if (!introDone) { introDone = true; sequence(INTRO, 4.5, 1.5); }
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
    if (t.target.id === 'jumpBtn') continue;
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
document.getElementById('jumpBtn').addEventListener('touchstart', (e) => { touchJump = true; e.preventDefault(); });
document.getElementById('timeBtn').addEventListener('touchstart', (e) => { if (nearBench(player.pos.x, player.pos.z) || sitting) toggleSit(); else advancePhase(); e.preventDefault(); });
document.getElementById('bookBtn').addEventListener('touchstart', (e) => { journal.toggle(); e.preventDefault(); });
document.getElementById('journal').addEventListener('click', () => journal.toggle(false));

// ---------- HUD
const phaseEl = document.getElementById('phase'), countEl = document.getElementById('count'), msgEl = document.getElementById('msg'), promptEl = document.getElementById('prompt');
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

function onFind(t) {
  sound.chime(t.i);
  countEl.textContent = `${places.found} / ${places.traces.length}`;
  countEl.classList.add('on');
  setTimeout(() => countEl.classList.remove('on'), 6000);
  const f = FRAGMENTS[t.i];
  journal.add(t.i);
  showMsg(f.text, 8);
  if (places.found === places.traces.length) {
    // ti aspetta sul bagnasciuga, vicino alla bandiera
    const P = W.phantom;
    const x = 18, z = shoreZ(18) + 0.9;
    P.g.position.set(x, Math.max(heightAt(x, z), 0), z);
    P.g.rotation.y = 0; P.legL.rotation.x = P.legR.rotation.x = 0;
    P.state = 'final'; P.op = 0; P.dir = -1; P.d = 1.6; P.g.visible = true;
  }
}
function onMeet() {
  sequence(ENDING, 4.2, 0.5);
  setTimeout(() => { sound.chord(); const cur = ((tod % 1) + 1) % 1; todAnim = { from: tod, to: tod - cur + (cur < 0.75 ? 0.755 : 1.755), t: 0, dur: 30 }; }, ENDING.length * 4200);
}

// ---------- loop
const clock = new THREE.Timer();
let elapsed = 0;
const tmp = new THREE.Vector3();
const tmpC = new THREE.Color();

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

  // movimento
  if (running) {
    let fx = 0, fz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) fz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fz -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) fx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) fx += 1;
    fx += touch.mx; fz -= touch.my;
    const len = Math.hypot(fx, fz);
    if (sitting && len > 0.2) { sitting = null; promptEl.classList.remove('on'); }
    if (sitting) { fx = 0; fz = 0; }
    if (len > 1) { fx /= len; fz /= len; }
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(touch.mx, touch.my) > 0.95 ? 9 : 4.2;
    const s = Math.sin(player.yaw), c = Math.cos(player.yaw);
    const tx = (-s * fz + c * fx) * speed, tz = (-c * fz - s * fx) * speed;
    const acc = player.ground ? 10 : 2;
    player.vel.x += (tx - player.vel.x) * Math.min(1, acc * dt);
    player.vel.z += (tz - player.vel.z) * Math.min(1, acc * dt);
    if ((keys.has('Space') || touchJump) && player.ground) { player.vel.y = 5.2; player.ground = false; }
    touchJump = false;
  }
  player.vel.y -= 13 * dt;
  player.pos.addScaledVector(player.vel, dt);
  collide(player.pos);
  const terrH = heightAt(player.pos.x, player.pos.z);
  const gh = groundAt(player.pos.x, player.pos.z, player.pos.y);
  const onWater = terrH < 0.02 && gh <= 0.03;
  const onSand = !onWater && Math.abs(gh - terrH) < 0.05;
  if (player.pos.y <= gh) {
    if (!player.ground && onWater && player.vel.y < -3) for (let i = 0; i < 3; i++) setTimeout(() => spawnRipple(W, player.pos.x, player.pos.z, night > 0.5), i * 150);
    player.pos.y = gh; player.vel.y = Math.max(player.vel.y, 0); player.ground = true;
  } else if (player.pos.y > gh + 0.05) player.ground = false;
  if (player.ground) player.pos.y += (gh - player.pos.y) * Math.min(1, dt * 20);

  const hs = Math.hypot(player.vel.x, player.vel.z);
  if (player.ground) player.bob += hs * dt * 1.9;
  const bob = Math.sin(player.bob * 2) * 0.035 * Math.min(hs / 4, 1.5);
  camera.position.set(player.pos.x, player.pos.y + (sitting ? 1.12 : 1.65) + bob, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, Math.sin(player.bob) * 0.004 * Math.min(hs / 4, 1.5));

  if (onWater && player.ground && hs > 0.5) {
    player.rippleT -= dt;
    if (player.rippleT <= 0) { spawnRipple(W, player.pos.x, player.pos.z, night > 0.5); player.rippleT = 0.42; sound.step('water', hs); }
  }

  const fp = footprints.update(dt, player.pos, player.yaw, onSand && player.ground, hs > 0.6, hs * dt);
  if (fp) sound.step(onSand ? 'sand' : 'water', hs);
  footprints.tick(dt);
  scatter.update(player.pos.x, player.pos.z);

  // panchina
  if (sitting) {
    player.pos.x = sitting.x; player.pos.z = sitting.z; player.vel.set(0, 0, 0);
    if (!todAnim && running) tod += dt * 24 / CYCLE;
    promptEl.textContent = 'Il tempo passa · E per alzarti'; promptEl.classList.add('on');
  } else if (nearBench(player.pos.x, player.pos.z)) {
    promptEl.textContent = isTouch ? 'ORA per sederti' : 'E · siediti'; promptEl.classList.add('on');
  } else promptEl.classList.remove('on');

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
  const mist = THREE.MathUtils.clamp(0.75 * Math.exp(-(((todN - 0.26) / 0.06) ** 2)) + 0.25 * night + 0.12 * (0.5 + 0.5 * Math.sin(elapsed * 0.02)), 0, 1);
  U.uMist.value = mist;

  sun.color.copy(pal.sun); sun.intensity = pal.sunI;
  sun.position.copy(player.pos).addScaledVector(lightDir, 120);
  sun.target.position.copy(player.pos);
  hemi.color.copy(pal.hs); hemi.groundColor.copy(pal.hg); hemi.intensity = pal.hI;
  scene.fog.color.copy(pal.hor); scene.fog.density = pal.fog * 2.2 * (1 + mist * 1.2);

  waterUniforms.uCam.value.copy(camera.position);
  waterUniforms.uLightDir.value.copy(lightDir);
  waterUniforms.uLightCol.value.copy(pal.sun).multiplyScalar(pal.sunI * 0.5);
  waterUniforms.uAmb.value.copy(pal.hs).multiplyScalar(pal.hI * 0.75).add(tmpC.copy(pal.sun).multiplyScalar(pal.sunI * Math.max(sunDir.y, 0) * 0.18));
  waterUniforms.uFog.value = pal.fog;
  waterUniforms.uLevel.value = 0.05 * Math.sin(elapsed * 0.45);
  water.position.set(Math.round(player.pos.x / 50) * 50, 0, Math.round(player.pos.z / 50) * 50);
  sky.position.copy(camera.position);

  updateWorld(W, dt, elapsed, {
    player: player.pos, yaw: player.yaw, night, pal, nextHor: nextPal.hor, onMeet,
  });
  updatePlaces(places, dt, elapsed, { night, player: player.pos, onFind });
  updateSkyline(skyline, camera.position, pal, sunDir, U.uSunVis.value);

  sound.update(elapsed, player.pos.z - shoreZ(player.pos.x), onWater, hs, night);

  // HUD
  if (pal.label !== lastLabel) { lastLabel = pal.label; phaseEl.textContent = pal.label; phaseEl.classList.add('on'); phaseTimer = 4; }
  if (phaseTimer > 0 && (phaseTimer -= dt) <= 0) phaseEl.classList.remove('on');
  if (msgTimer > 0 && (msgTimer -= dt) <= 0) msgEl.classList.remove('on');

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
  P.uSunVis.value = inFront ? U.uSunVis.value * (1 - THREE.MathUtils.smoothstep(edge, 0.9, 1.3)) : 0;
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
frame();
window.__riva = { player, scene, water, renderer, W, journal, footprints, places, findAll: () => places.traces.forEach((t) => t.pos.copy(player.pos)), setTime: (t) => { tod = t; } };
