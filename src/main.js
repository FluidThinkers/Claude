import * as THREE from 'three';
import { Terrain, heightAt, shoreZ } from './terrain.js';
import { evalPalette, makeState, sunDirection, PHASES } from './palette.js';
import { makeSky, makeWater, makePost, skyUniforms, waterUniforms, enhanceSand, islandUniforms } from './shaders.js';
import { sandTextures, glowTexture } from './textures.js';
import { buildWorld, updateWorld, spawnRipple, PLATFORM } from './world.js';
import { buildPlaces, updatePlaces, placeHeight, collide, nearBench } from './places.js';
import { Footprints, Scatter, buildSkyline, updateSkyline, TireTracks, SandSpray, Wrack } from './details.js';
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
import { buildExplore, updateExplore, exploreHeight, exploreCollide, nearLadder, MOLO } from './explore.js';
import { DISCOVERIES, ECHOES, FINALE } from './story.js';
import { Physics } from './physics.js';
import { FORM_TEXT, gullWings, moveForm } from './forms.js';
import { SCOGLIERA, PERGOLA, BARCA, TORRETTA, BELVEDERE } from './places.js';
import { FOCE } from './terrain.js';
import { Motes, LightBurst } from './particles.js';
import { buildIsland, updateIsland } from './island.js';
import { ISLAND } from './terrain.js';

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) ? parseFloat(Q.get(k)) : d);
let stepDist = 0;
// lo stesso rumore dello shader, per far suonare la risacca a tempo
const h21 = (x, y) => { let a = (x * 0.1031) % 1, b = (y * 0.1031) % 1, c = (x * 0.1031) % 1; if (a < 0) a += 1; if (b < 0) b += 1; if (c < 0) c += 1; const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33); a += d; b += d; c += d; const r = ((a + b) * c) % 1; return r < 0 ? r + 1 : r; };
const vn2 = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1); return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; };
let discZone = null, flowUnlocked = Q.has('flow'), lastRing = -9, ringPow = 1, ringI = 0, seenMeteor = false, trailT = 0, trailI = 0;

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
const motes = new Motes(scene, glowTex);
const burst = new LightBurst(scene, glowTex);
const island = buildIsland(scene);
// colonna di luce sopra il prossimo ricordo: si vede da lontano, svanisce quando sei vicino
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 16, 1, true), new THREE.ShaderMaterial({
  uniforms: { uOp: { value: 0 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: 'uniform float uOp, uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(1.0 - abs(dot(normalize(vN.xz), normalize(vV.xz))), 0.5); float h = vUv.y; float a = (1.0 - rim) * pow(1.0 - h, 1.6) * smoothstep(0.0, 0.03, h) * (0.85 + 0.15 * sin(uTime * 2.0 - h * 20.0)); gl_FragColor = vec4(vec3(0.62, 1.0, 0.66) * a * uOp, 1.0); }',
}));
beam.frustumCulled = false; scene.add(beam);
let isleQ = 0, lastFO = null;
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
const tracks = new TireTracks(scene);
const spray = new SandSpray(scene);
const waterSpray = new SandSpray(scene, 0xeef6f8, 0.06); waterSpray.floorY = 0;
let drops = 0;
document.getElementById('zin').addEventListener('click', () => minimap.setZoom(minimap.zoom * 1.4));
document.getElementById('zout').addEventListener('click', () => minimap.setZoom(minimap.zoom / 1.4));
document.getElementById('zin').addEventListener('touchstart', (e) => { minimap.setZoom(minimap.zoom * 1.4); e.preventDefault(); });
document.getElementById('zout').addEventListener('touchstart', (e) => { minimap.setZoom(minimap.zoom / 1.4); e.preventDefault(); });
// sabbia morbida: spiaggia asciutta, non la passeggiata né l'erba
const softSand = (x, z) => { const d = z - shoreZ(x); if (d < 1 || d > 74) return 0; if (placeHeight(x, z, 99) > heightAt(x, z) + 0.1) return 0; return Math.min(1, (d - 1) / 4) * (d > 60 ? Math.max(0, (74 - d) / 14) : 1); };
const craft = buildCraft(scene);
const explore = buildExplore(scene, PLATFORM, glowTex);
const wrack = new Wrack(scene);
const wings = gullWings(); camera.add(wings);
// ---------- ostacoli fisici
const phys = new Physics();
{
  const c = Math.cos(0.12), sn = Math.sin(0.12);
  for (const [lx, lz] of [[-4, -3], [4, -3], [-4, 3], [4, 3], [0, -3], [0, 3]]) phys.add(PERGOLA.x + lx * c + lz * sn, PERGOLA.z - lx * sn + lz * c, 0.18, heightAt(PERGOLA.x, PERGOLA.z) + 3.2);
  phys.add(TORRETTA.x, TORRETTA.z, 0.75, heightAt(TORRETTA.x, TORRETTA.z) + 2.6);
  phys.add(BELVEDERE.x + 3.2, BELVEDERE.z + 2.5, 0.9);
  for (let k = 0; k < 12; k++) { const a = -Math.PI * 0.85 + (k / 11) * Math.PI * 0.7; phys.add(BELVEDERE.x + Math.sin(a) * 4.2, BELVEDERE.z - Math.cos(a) * 4.2 * 0.6 - 1.5, 0.35, heightAt(BELVEDERE.x, BELVEDERE.z) + 0.7); }
  for (let d = 8; d >= PONTILE.to; d -= 3) for (const sx of [-1, 1]) phys.add(PONTILE.x + sx * (PONTILE.half - 0.1), PONTILE.z0 + d, 0.14, PONTILE.deck - 0.15);
  for (let i = 0; i <= MOLO.n; i++) for (const sx of [-1, 1]) phys.add(MOLO.x + sx * (MOLO.half - 0.6), MOLO.z0 + MOLO.from - i * MOLO.seg, 0.33, MOLO.deck - 0.7);
  const pc = Math.cos(0.15), ps = Math.sin(0.15);
  for (const [lx, lz] of [[-8, -5], [8, -5], [-8, 5], [8, 5], [0, -5], [0, 5]]) phys.add(PLATFORM.x + lx * pc + lz * ps, PLATFORM.z - lx * ps + lz * pc, 0.62, 6.8);
  phys.add(12 - 1.75, shoreZ(12) - 3 + 1.2, 0.08, 6);
}
phys.add(explore.raft.x, explore.raft.z, 2.0, 0.5);
phys.add(explore.buoy.g.position.x, explore.buoy.g.position.z, 0.9, 1.5);
const shipCircles = () => {
  const out = [];
  for (const S of craft.ships) {
    const p = S.g.position, c = Math.cos(S.g.rotation.y), sn = Math.sin(S.g.rotation.y);
    const n = S.kind === 'ferry' ? 9 : 5, L = S.kind === 'ferry' ? 130 : 10, r = S.kind === 'ferry' ? 11 : 1.5;
    for (let k = 0; k < n; k++) { const lx = -L / 2 + L * k / (n - 1); out.push({ x: p.x + lx * c, z: p.z - lx * sn, r: r * (k === 0 ? 0.5 : 1), top: p.y + 0.5, bottom: -20 }); }
  }
  return out;
};
let camDip = 0, slopeK = 1;
const echoed = new Set();
const echoEl = document.getElementById('echo');
function echo(id) {
  if (echoed.has(id) || !ECHOES[id] || msgTimer > 0) return;
  echoed.add(id);
  echoEl.textContent = ECHOES[id]; echoEl.classList.add('on');
  clearTimeout(echo.t); echo.t = setTimeout(() => echoEl.classList.remove('on'), 7000);
}
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
const underCol = new THREE.Color(), underDeep = new THREE.Color();
player.pos.z = num('z', shoreZ(player.pos.x) + 21.5);
player.pos.y = Math.max(heightAt(player.pos.x, player.pos.z), 0);
terrain.update(player.pos.x, player.pos.z, true);
const groundAt = (x, z, feet) => Math.max(heightAt(x, z), placeHeight(x, z, feet), deckHeight(craft, x, z, feet), exploreHeight(explore, x, z, feet));
// seduti su una panchina il tempo scorre più veloce
let sitting = null;
// azione contestuale: SUP, attrezzatura, panchina
function nearSup() { const g = sea.sup.g.position; return Math.hypot(g.x - player.pos.x, g.z - player.pos.z) < 2.8; }
function nearGear() { return !hasGear && Math.hypot(GEAR.x - player.pos.x, GEAR.z - player.pos.z) < 2.2; }
function nearBoat() { const g = craft.boat.g.position; return Math.hypot(g.x - player.pos.x, g.z - player.pos.z) < 3.2; }
function nearGlider() { const g = craft.glider.g.position; return Math.hypot(g.x - player.pos.x, g.z - player.pos.z) < 3.2; }
function contextAction() {
  if (player.mode === 'flow') return null;
  const lad = nearLadder(explore, player.pos, player.mode);
  if (lad) return lad.name;
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
function launchGlider() {
  const G = craft.glider;
  player.mode = 'glide'; G.yaw = player.yaw; G.speed = 9; G.vy = 0; G.bank = 0;
  G.g.position.set(player.pos.x, player.pos.y + 1.9 + 0.6, player.pos.z);
  if (!seenGlideHint) { seenGlideHint = true; showMsg(isTouch ? 'Avanti per scendere veloce · indietro per rallentare · lati per virare' : 'W picchia · S cabra · A e D virano. Le colline e il vento ti sollevano.', 5); }
}
function action() {
  const a = contextAction();
  const lad = nearLadder(explore, player.pos, player.mode);
  if (lad && a === lad.name) {
    // sali: ti porta sul ponte, un passo verso l'interno
    let best = null, bd = 1e9;
    for (const r of explore.rects) { if (Math.abs(r.y - lad.top) > 0.3) continue; const d = Math.hypot(r.x - lad.x, r.z - lad.z); if (d < bd) { bd = d; best = r; } }
    const tx = best ? lad.x + (best.x - lad.x) / bd * 1.6 : lad.x, tz = best ? lad.z + (best.z - lad.z) / bd * 1.6 : lad.z;
    if (player.mode === 'boat') { craft.boat.on = false; sound.boatEngine(false, 0, 0); }
    if (player.mode === 'sup') { sea.sup.onBoard = false; sea.fpPaddle.visible = false; }
    player.mode = 'walk'; player.pos.set(tx, lad.top, tz); player.vel.set(0, 0, 0); player.ground = true;
    fade = 0.5; post.uniforms.uFadeCol.value.setRGB(0.1, 0.1, 0.1);
    sound.step('sand', 3);
    return;
  }
  if (a === 'sali a bordo') {
    const b = boardable(craft, player.pos.x, player.pos.z);
    if (player.mode === 'boat') { craft.boat.on = false; sound.boatEngine(false, 0, 0); }
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
    const B = craft.boat; B.on = false; sound.boatEngine(false, 0, 0);
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
  if (a === 'prendi il deltaplano') { launchGlider(); return; }
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
  if (e.code === 'KeyF') toggleFlow();
  if (e.code === 'KeyQ') enterForm(formOptions());
  if (e.code === 'Equal' || e.code === 'NumpadAdd') minimap.setZoom(minimap.zoom * 1.4);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') minimap.setZoom(minimap.zoom / 1.4);
  if (e.code === 'KeyB') returnToBody();
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
document.getElementById('flowBtn').addEventListener('touchstart', (e) => { toggleFlow(); e.preventDefault(); });
document.getElementById('formBtn').addEventListener('touchstart', (e) => { enterForm(formOptions()); e.preventDefault(); });
document.getElementById('bodyBtn').addEventListener('touchstart', (e) => { returnToBody(); e.preventDefault(); });
if (flowUnlocked) document.getElementById('flowBtn').classList.remove('hidden');
let touchDive = false;
document.getElementById('diveBtn').addEventListener('touchstart', (e) => { touchDive = true; e.preventDefault(); });
document.getElementById('diveBtn').addEventListener('touchend', () => { touchDive = false; });
let touchUp = false;
document.getElementById('jumpBtn').addEventListener('touchend', () => { touchUp = false; });
document.getElementById('bookBtn').addEventListener('touchstart', (e) => { journal.toggle(); e.preventDefault(); });
document.getElementById('journal').addEventListener('click', () => journal.toggle(false));
// ricominciare: la giornata torna al suo inizio (nessun salvataggio da cancellare: si ricarica la pagina pulita)
{
  const rb = document.getElementById('resetBtn');
  const reset = (e) => { e.stopPropagation(); e.preventDefault(); if (confirm('Ricominciare la giornata dall\'inizio?')) location.replace(location.pathname); };
  rb.addEventListener('click', reset); rb.addEventListener('touchend', reset);
}

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
// in cima: una freccia lieve verso il prossimo ricordo, e i ricordi trovati
const hintEl = document.getElementById('hint'), hintAr = hintEl.querySelector('.ar'), hintDs = hintEl.querySelector('.ds'), hintDots = hintEl.querySelector('.dots');
let hintKey = '';
function updateHint() {
  const n = places.traces.length, key = places.found + '/' + active;
  if (key !== hintKey) { hintKey = key; hintDots.innerHTML = places.traces.map((t, i) => `<i class="${t.found ? 'f' : i === active ? 'n' : ''}"></i>`).join(''); }
  const tgt = active < n ? places.traces[active].pos : zone;
  if (!started || !tgt || sitting) { hintEl.classList.remove('on'); return; }
  hintEl.classList.add('on');
  const dx = tgt.x - player.pos.x, dz = tgt.z - player.pos.z, d = Math.hypot(dx, dz);
  const near = active < n ? Math.hypot(places.traces[active].pos.x - player.pos.x, places.traces[active].pos.z - player.pos.z) : d;
  if (near < 22 && active < n) { hintAr.style.opacity = 0.25; hintDs.textContent = 'qui vicino · un riflesso'; return; }
  hintAr.style.opacity = 1;
  let rel = Math.atan2(-dx, -dz) - player.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  hintAr.style.transform = `rotate(${(-rel).toFixed(3)}rad)`;
  hintDs.textContent = d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d / 5) * 5 + ' m';
}
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
// in ogni luogo del ricordo succede qualcosa
function memoryEvent(t) {
  const p = t.pos.clone();
  burst.burst(p, 140);
  const lvl = waterUniforms.uLevel.value;
  const k = t.kind;
  if (k === 'jar') { spray.burst(p, 90, 2.2); setTimeout(() => sound.gull(-0.4, 25), 600); setTimeout(() => sound.gull(0.5, 35), 1500); }
  if (k === 'book' || k === 'letter') { waterSpray.mat.color.set(0xfffaf0); waterSpray.burst(p, 50, 1.6); }
  if (k === 'sandals') { addRing(p.x, p.z - 4, 0.5); }
  if (k === 'watch') { for (let i = 0; i < 6; i++) setTimeout(() => sound.bubbles(), i * 350); for (let i = 0; i < 8; i++) setTimeout(() => sound._grains && sound.ctx && sound._grains(0.03, 1), 1200 + i * 1000); }
  if (k === 'hat') { spray.burst(p, 40, 1.5); setTimeout(() => sound.gull(0, 18), 400); }
  if (k === 'lantern') { illum = 1.2; }
  if (k === 'bottle') { for (let i = 0; i < 3; i++) setTimeout(() => burst.burst(p, 60), 900 * (i + 1)); }
  if (k === 'binoculars') { zoomPulse = 1; }
  if (p.y < lvl + 0.3 && k !== 'watch') spawnRipple(W, p.x, p.z, false);
}
let zoomPulse = 0;
function onFind(t) {
  sound.chime(t.i); setTimeout(() => sound.chord(), 400);
  memoryEvent(t);
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
    if (f.form) setTimeout(() => storyForm(f.form, f.become, f.why), 8600);
    setTimeout(() => msgEl.classList.remove('thought'), 8000);
    const nf = FRAGMENTS[active];
    if (nf) {
      setGoal(f.goal);
      const need = nf.needs;
      if (nf.needsHint && !f.form && (need !== 'gear' || !hasGear)) setTimeout(() => showMsg(nf.needsHint, 6), 9000);
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
// ---------- scoperte libere
const discovered = new Set();
function onDiscover(id) {
  if (discovered.has(id)) return;
  discovered.add(id);
  const D = DISCOVERIES[id]; if (!D) return;
  journal.addDiscovery(D);
  sound.chime(4 + discovered.size); illum = 0.8;
  showMsg(D.title + '. ' + D.text, 8);
  setTimeout(() => {
    msgEl.classList.add('thought'); showMsg(D.thought, 7);
    setTimeout(() => msgEl.classList.remove('thought'), 7000);
    if (D.next === 'radio') discZone = { x: PLATFORM.x, z: PLATFORM.z, r: 45 };
    else if (D.next === 'relitto') discZone = { x: explore.wreck.x + 20, z: explore.wreck.z - 15, r: 45 };
    else if (D.next === undefined && (id === 'relitto')) discZone = null;
    if (D.unlock === 'flow') {
      flowUnlocked = true;
      setTimeout(() => { showMsg(isTouch ? 'Ora puoi fluire: in acqua tocca FLUISCI.' : 'Ora puoi fluire: in acqua premi F. Spazio solleva un\'onda.', 7); document.getElementById('flowBtn').classList.remove('hidden'); }, 7500);
    }
  }, 8500);
}
function addRing(x, z, amp) {
  const r = waterUniforms.uRings.value[ringI++ % 4];
  r.set(x, z, elapsed, amp);
  waterSpray.burst(new THREE.Vector3(x, waterUniforms.uLevel.value + 0.1, z), Math.round(40 * amp), 2.5 * amp);
  sound.splash('dive', 1.2);
}
function toggleFlow() {
  if (!flowUnlocked) return;
  const lvl = waterUniforms.uLevel.value;
  if (player.mode === 'flow') {
    const deep = lvl - heightAt(player.pos.x, player.pos.z) > 1.3;
    if (camera.position.y < lvl - 0.2) { player.mode = 'dive'; player.pos.y = camera.position.y - 1.65; }
    else if (deep) { player.mode = 'swim'; player.pos.y = lvl + 0.12 - 1.65; }
    else { player.mode = 'walk'; player.pos.y = heightAt(player.pos.x, player.pos.z); }
    showMsg('Torni corpo.', 2.5);
    return;
  }
  if (player.mode === 'swim' || player.mode === 'dive') {
    player.mode = 'flow';
    player.pos.y = camera.position.y;
    illum = 0.6; sound.chord();
    showMsg('Sei il mare.', 3);
  }
}
// ---------- le forme
const FORMS = ['gull', 'tree', 'sand', 'wave', 'cloud', 'fish', 'rain', 'light', 'petal', 'wind'];
const unlocked = new Set((Q.get('forms') || '').split(',').filter(Boolean));
let body = null, stillT = 0, touchT = 0;
function unlockForm(id) {
  if (unlocked.has(id)) return;
  unlocked.add(id);
  const F = FORM_TEXT[id] || { unlock: '' };
  illum = Math.max(illum, 0.6); sound.chime(6);
  echoEl.textContent = F.unlock + (isTouch ? '  (FORMA)' : '  (Q)'); echoEl.classList.add('on');
  clearTimeout(echo.t); echo.t = setTimeout(() => echoEl.classList.remove('on'), 7000);
  document.getElementById('formBtn').classList.remove('hidden');
}
function nearestTree(maxD) {
  let best = null, bd = maxD;
  for (const c of flora.colliders) { if (c.r > 0.5) continue; const d = Math.hypot(c.x - player.pos.x, c.z - player.pos.z); if (d < bd) { bd = d; best = c; } }
  return best;
}
function nearestGull(maxD) {
  let bd = maxD, ok = false;
  for (const b of gulls.birds) { const d = b.m.position.distanceTo(camera.position); if (d < bd) { bd = d; ok = true; } }
  return ok;
}
// i cambi di forma li decide la storia: qui resta solo ciò che la storia chiede di fare con le tue mani
function formOptions() {
  if (player.mode === 'cloud') return 'rain';
  return null;
}
function enterForm(f) {
  if (!f) { showMsg('Qui non c\'è niente in cui entrare.', 2.5); return; }
  if (['walk', 'swim', 'dive'].includes(player.mode) && !body) body = { pos: player.pos.clone(), yaw: player.yaw, mode: player.mode };
  if (f === 'flow') { if (player.mode === 'gull') { player.pos.y = waterUniforms.uLevel.value + 0.2; } player.mode = 'swim'; toggleFlow(); return; }
  const from = player.mode;
  player.mode = f; player.vel.set(0, 0, 0);
  fade = 0.55; post.uniforms.uFadeCol.value.setRGB(0.95, 0.97, 1);
  sound.chord(); illum = Math.max(illum, 0.5);
  if (f === 'tree') { const t = nearestTree(16); player.treeX = t.x; player.treeZ = t.z; player.treeY = t.top - 0.6; player.pitch = -0.1; }
  if (f === 'gull') { player.gs = 11; player.bank = 0; if (from !== 'cloud' && from !== 'tree') player.pos.y = Math.max(player.pos.y, heightAt(player.pos.x, player.pos.z)) + 6; if (from === 'cloud') player.pos.y -= 30; player.pitch = -0.15; }
  if (f === 'sand') { player.pos.y = heightAt(player.pos.x, player.pos.z) + 0.4; player.pitch = -0.08; }
  if (f === 'wave') { player.ws = 3; player.yaw = 0 + Math.PI; player.pitch = -0.1; }
  if (f === 'cloud') { player.cloudY = 170; player.pitch = -0.6; }
  if (f === 'petal') { player.pitch = -0.1; }
  if (f === 'wind') { player.vs = 14; player.pitch = -0.08; }
  if (f === 'rain') { player.pitch = -0.9; }
  wings.visible = f === 'gull';
  if (FORM_TEXT[f].enter) showMsg(FORM_TEXT[f].enter, 3);
}
// tornare corpo: sempre dove sei adesso, mai dove eri prima
function returnToBody() {
  body = null;
  if (player.cat) { player.cat = false; showMsg('Torni corpo.', 2.5); fade = 0.5; return; }
  if (player.mode === 'flow') { toggleFlow(); return; }
  if (!FORMS.includes(player.mode)) return;
  const lvl = waterUniforms.uLevel.value;
  if (lvl - heightAt(player.pos.x, player.pos.z) > 1.3) { player.mode = 'swim'; player.pos.y = lvl + 0.12 - 1.65; }
  else { player.mode = 'walk'; player.pos.y = groundAt(player.pos.x, player.pos.z, player.pos.y + 2); }
  player.vel.set(0, 0, 0); player.questWave = false;
  wings.visible = false; fade = 0.6; post.uniforms.uFadeCol.value.setRGB(0.05, 0.05, 0.06); showMsg('Torni corpo, qui.', 2.5);
}
function onMeet() {
  zone = null;
  goalEl.classList.remove('on');
  sequence(ENDING, 4.2, 0.5);
  setTimeout(() => { sound.chord(); const cur = ((tod % 1) + 1) % 1; todAnim = { from: tod, to: tod - cur + (cur < 0.75 ? 0.755 : 1.755), t: 0, dur: 30 }; }, ENDING.length * 4200);
  // finale: ti sciogli in luce sopra l'acqua della sera
  setTimeout(() => {
    body = { pos: player.pos.clone(), yaw: player.yaw, mode: 'walk' };
    player.mode = 'light'; player.cat = false; player.yaw = Math.PI * 0 ; player.pitch = 0.05;
    illum = 1; sound.chord();
    sequence(FINALE, 6, 0.5);
    setTimeout(() => {
      fade = 1; post.uniforms.uFadeCol.value.setRGB(1, 0.92, 0.85);
      setTimeout(() => { returnToBody(); showMsg('RIVA. Puoi restare, ed esplorare quanto vuoi.', 7); }, 1500);
    }, 26000);
  }, ENDING.length * 4200 + 3000);
}
// la forma che un ricordo ti fa prendere, per arrivare al successivo
// la trasformazione: annunciata, lenta, e spiegata
const BECOME = { gull: 'un gabbiano', sand: 'sabbia', fish: 'un pesce', wave: 'un\'onda', cloud: 'una nuvola', cat: 'un gatto', body: 'di nuovo umano', glide: 'leggero, come chi vola' };
function storyForm(form, text, why) {
  msgEl.classList.remove('thought');
  showMsg('Qualcosa cambia. Ti senti diventare ' + (BECOME[form] || form) + '…', 3.6);
  fadeTarget = 0.8; post.uniforms.uFadeCol.value.setRGB(1, 0.96, 0.9);
  sound.chord(); illum = Math.max(illum, 0.6);
  setTimeout(() => { applyForm(form); fadeTarget = 0; if (text) showMsg(text, 5.5); }, 3000);
  if (why) setTimeout(() => { msgEl.classList.add('thought'); showMsg(why, 11); setTimeout(() => msgEl.classList.remove('thought'), 11000); }, 9200);
}
function applyForm(form) {
  const lvl = waterUniforms.uLevel.value;
  if (FORMS.includes(player.mode) || player.mode === 'flow') { body = null; }
  if (['bike', 'boat', 'sup', 'glide'].includes(player.mode)) { player.mode = 'walk'; bike.fp.visible = false; bike.on = false; sea.fpPaddle.visible = false; craft.boat.on = false; }
  player.cat = false; wings.visible = false; body = null;
  illum = Math.max(illum, 0.7);
  if (form === 'sand') { flowUnlocked = true; player.mode = 'sand'; player.pos.y = heightAt(player.pos.x, player.pos.z) + 0.4; player.pitch = -0.06; }
  else if (form === 'cat') { player.mode = 'walk'; player.cat = true; player.pos.y = groundAt(player.pos.x, player.pos.z, player.pos.y + 1); }
  else if (form === 'fish') {
    // resti dove sei: se sotto c'è acqua ci scivoli dentro, altrimenti scendi fin dove l'acqua è profonda
    let x = player.pos.x, z = player.pos.z;
    for (let i = 0; i < 80 && lvl - heightAt(x, z) < 1.4; i++) z -= 1;
    player.mode = 'fish'; player.pos.set(x, lvl - 1.0, z); player.pitch = -0.35; player.yaw = 0; drops = 0; sound.splash('dive', 0.8);
  }
  else if (form === 'wave') { player.mode = 'wave'; player.questWave = true; player.ws = 4; player.pos.y = lvl + 0.6; player.yaw = Math.PI; player.pitch = -0.1; }
  else if (form === 'gull') { player.mode = 'gull'; player.gs = 11; player.bank = 0; player.pos.y = Math.max(player.pos.y, heightAt(player.pos.x, player.pos.z)) + 8; player.pitch = -0.1; wings.visible = true; }
  else if (form === 'body') { player.mode = 'walk'; player.pos.y = groundAt(player.pos.x, player.pos.z, player.pos.y + 2); }
  else if (form === 'cloud') { player.mode = 'cloud'; player.cloudY = 150; player.pitch = -0.5; }
  else if (form === 'glide') {
    player.mode = 'walk';
    const G = craft.glider; G.g.position.set(player.pos.x, player.pos.y + 2.5, player.pos.z);
    player.yaw = Math.atan2(-(18 - player.pos.x), -(shoreZ(18) - player.pos.z)); sitting = null;
    player.pos.y += 1.5; launchGlider(); G.speed = 12;
  }
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
    const speed = (run ? 9 : 4.2) * (1 - 0.62 * wade) * slopeK * (player.cat ? 1.35 : 1);
    if (player.cat && depth > 0.15) { player.pos.x -= player.vel.x * dt * 2; player.pos.z -= player.vel.z * dt * 2; player.vel.x *= -0.3; player.vel.z *= -0.3; }
    const tx = (-ys * fz + yc * fx) * speed, tz = (-yc * fz - ys * fx) * speed;
    const acc = player.ground ? 10 : 2;
    player.vel.x += (tx - player.vel.x) * Math.min(1, acc * dt);
    player.vel.z += (tz - player.vel.z) * Math.min(1, acc * dt);
    if (jump && player.ground && wade < 0.5) { player.vel.y = player.cat ? 7.2 : 5.2; player.ground = false; }
    if (player.cat) eyeH = 0.32;
    player.vel.y -= 13 * dt;
    player.pos.addScaledVector(player.vel, dt);
    collide(player.pos); shipCollide(craft, player.pos); exploreCollide(explore, player.pos); phys.resolve(player.pos, 0.32, player.pos.y + 0.2, player.pos.y + 1.7);
    const gh = groundAt(player.pos.x, player.pos.z, player.pos.y);
    const d2 = depthAt(player.pos.x, player.pos.z);
    if (d2 > 1.3 && player.pos.y < lvl - 0.2) {
      // dentro l'acqua alta: si nuota
      if (player.vel.y < -3) { sound.splash('dive', 1); waterSpray.burst(new THREE.Vector3(player.pos.x, lvl + 0.05, player.pos.z), 70, 3.2); drops = 1; for (let i = 0; i < 3; i++) setTimeout(() => spawnRipple(W, player.pos.x, player.pos.z, night > 0.5), i * 160); }
      player.mode = 'swim'; player.vel.y = 0;
      if (!seenDiveHint) { seenDiveHint = true; showMsg(isTouch ? 'GIÙ per immergerti' : 'C per immergerti · Spazio per risalire', 4); }
    } else if (player.pos.y <= gh) {
      if (!player.ground && player.vel.y < -4) { camDip = Math.min(0.32, -player.vel.y * 0.035); sound.step('sand', 6); }
      player.pos.y = gh; player.vel.y = Math.max(player.vel.y, 0); player.ground = true;
    } else if (player.pos.y > gh + 0.05) player.ground = false;
    if (player.ground) player.pos.y += (gh - player.pos.y) * Math.min(1, dt * 20);
    {
      // le salite ripide rallentano, quelle troppo ripide non si scalano
      const hv = Math.hypot(player.vel.x, player.vel.z);
      if (hv > 0.3 && player.ground) {
        const ax = player.pos.x + player.vel.x / hv * 0.8, az = player.pos.z + player.vel.z / hv * 0.8;
        const sl = (groundAt(ax, az, player.pos.y) - gh) / 0.8;
        slopeK += ((sl > 0.25 ? Math.max(0.15, 1 - (sl - 0.25) * 1.3) : 1) - slopeK) * Math.min(1, dt * 6);
      } else slopeK += (1 - slopeK) * Math.min(1, dt * 4);
    }
    player.breath = Math.min(1, player.breath + dt * 0.3);
  } else if (M === 'swim') {
    const speed = (hasGear ? 2.8 : 1.7) * (run ? 1.35 : 1);
    const tx = (-ys * fz + yc * fx) * speed, tz = (-yc * fz - ys * fx) * speed;
    player.vel.x += (tx - player.vel.x) * Math.min(1, 2.2 * dt);
    player.vel.z += (tz - player.vel.z) * Math.min(1, 2.2 * dt);
    player.vel.y = 0;
    player.pos.x += player.vel.x * dt; player.pos.z += player.vel.z * dt;
    collide(player.pos); shipCollide(craft, player.pos); exploreCollide(explore, player.pos); phys.resolve(player.pos, 0.32, player.pos.y + 0.2, player.pos.y + 1.7);
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
  } else if (M === 'flow') {
    // essere il mare: scorri sopra e sotto la superficie, sollevi onde
    const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
    const speed = run ? 24 : 12;
    const tx = (-ys * cp * fz + yc * fx) * speed, tz = (-yc * cp * fz - ys * fx) * speed;
    const ty = sp * fz * speed * 0.8 + (upK ? 3 : 0) - (downK ? 3 : 0);
    const k = Math.min(1, 2.2 * dt);
    player.vel.x += (tx - player.vel.x) * k; player.vel.z += (tz - player.vel.z) * k; player.vel.y += (ty - player.vel.y) * k;
    player.pos.addScaledVector(player.vel, dt);
    const floor = heightAt(player.pos.x, player.pos.z) + 0.5;
    player.pos.y = Math.max(floor, Math.min(player.pos.y, lvl + 0.35 + Math.sin(elapsed * 1.4) * 0.06));
    eyeH = 0;
    const hsF = Math.hypot(player.vel.x, player.vel.z);
    sound.wind(Math.min(1, 0.3 + hsF / 20));
    player.stroke += dt * hsF * 0.25;
    if (player.stroke > 1) { player.stroke = 0; if (player.pos.y > lvl - 0.5) spawnRipple(W, player.pos.x, player.pos.z, night > 0.5); else sound.bubbles(); }
    if (jump && elapsed - lastRing > 1.2 && player.pos.y > lvl - 1.5) {
      // ogni onda sollevata subito dopo l'altra è più grande
      ringPow = elapsed - lastRing < 4 ? Math.min(2.8, ringPow + 0.45) : 1;
      lastRing = elapsed;
      addRing(player.pos.x - ys * 7, player.pos.z - yc * 7, ringPow + (run ? 0.4 : 0)); camDip = 0.08 * ringPow;
      if (ringPow > 2.2) showMsg('Il mare risponde. Ogni onda più grande della prima.', 3);
    }
    // arrivato a riva, l'onda si scioglie e torni corpo
    if (lvl - heightAt(player.pos.x, player.pos.z) < 0.6) {
      player.mode = 'walk'; player.pos.y = Math.max(heightAt(player.pos.x, player.pos.z), lvl - 0.5); player.vel.set(0, 0, 0);
      addRing(player.pos.x, player.pos.z - 3, 0.6); showMsg('L\'onda si scioglie sulla sabbia. Torni corpo.', 3.5);
    }
  } else if (FORMS.includes(M)) {
    const qt = places.traces[active];
    const r = moveForm(M, player, { dt, fx, fz, run, up: upK, down: downK, jump, lvl, wind: wind.strength.value, windDir: wind.dir, time: elapsed,
      target: M === 'petal' ? craft.ships[0].g.position : M === 'cloud' && isleQ === 1 ? ISLAND : (M === 'sand' || M === 'cloud' || (M === 'wave' && player.questWave)) && qt ? qt.pos : null });
    if (M === 'wind' && player.pos.y < lvl + 10) { const T = waterUniforms.uTrail.value; if (Math.random() < dt * 8) T[trailI++ % T.length].set(player.pos.x, player.pos.z, elapsed, 0.5); }
    eyeH = 0;
    player.formRoll = r.roll;
    if (r.timeScale && !todAnim && running) tod += dt * r.timeScale / CYCLE;
    if (M === 'gull') { wings.userData.L.rotation.z = r.flap; wings.userData.R.rotation.z = -r.flap; sound.wind(Math.min(1, 0.3 + r.speed / 25)); if (Math.random() < dt * 0.03) sound.gull((Math.random() - 0.5) * 0.4, 7); }
    if (M === 'tree') sound.wind(Math.min(1, wind.strength.value + 0.3));
    if (M === 'fish' && r.shallow) { player.mode = 'walk'; player.pos.y = heightAt(player.pos.x, player.pos.z); showMsg('Il fondo sale, e torni sulla riva.', 3); }
    if (M === 'rain' && r.landed) {
      const deep = lvl - heightAt(player.pos.x, player.pos.z) > 1.3;
      if (deep) { player.mode = 'swim'; player.pos.y = lvl + 0.1 - 1.65; addRing(player.pos.x, player.pos.z, 0.5); }
      else { player.mode = 'walk'; player.pos.y = groundAt(player.pos.x, player.pos.z, player.pos.y); camDip = 0.25; }
      showMsg(deep ? 'Cadi nel mare. Torni corpo, qui.' : 'Tocchi terra. Torni corpo.', 3);
      fade = 0.4; post.uniforms.uFadeCol.value.setRGB(0.7, 0.75, 0.8);
    }
    if (M === 'sand' && r.inWater) { addRing(player.pos.x, player.pos.z, 0.4); player.mode = 'swim'; player.pos.y = lvl + 0.1 - 1.65; toggleFlow(); showMsg('La sabbia scivola in acqua, e tu con lei.', 3); }
    if (M === 'wave') {
      const T = waterUniforms.uTrail.value; if (Math.random() < dt * 6) T[trailI++ % T.length].set(player.pos.x, player.pos.z, elapsed, 1);
      if (r.broke && player.questWave) {
        player.questWave = false;
        addRing(player.pos.x, player.pos.z - 2, 0.9); sound.splash('dive', 1.4);
        player.mode = 'walk'; player.pos.z += 2; player.pos.y = groundAt(player.pos.x, player.pos.z, 3);
        showMsg('L\'onda si rompe e ti lascia sulla riva.', 3.5);
      } else if (r.broke) {
        addRing(player.pos.x, player.pos.z - 2, 0.9); sound.splash('dive', 1.4);
        // l'onda si rompe e ti lascia sulla riva, lì dove sei arrivato
        player.mode = 'walk'; player.pos.z += 2; player.pos.y = groundAt(player.pos.x, player.pos.z, 3);
        showMsg('L\'onda si rompe e ti lascia sulla riva.', 3);
      }
    }
  } else if (M === 'boat') {
    const B = craft.boat;
    driveBoat(B, dt, { fx, fz, run }, { water: lvl, time: elapsed });
    if (phys.resolve(B.g.position, 1.4, lvl - 0.5, lvl + 0.8)) { if (Math.abs(B.speed) > 2) { sound.splash('dive', 0.6); camDip = 0.12; } B.speed *= -0.3; }
    // seduto a poppa, vicino al motore
    tmp.set(1.5, 0.45, 0).applyEuler(B.g.rotation).add(B.g.position);
    player.pos.set(tmp.x, tmp.y - 0.6, tmp.z);
    player.vel.set(-Math.sin(B.yaw) * B.speed, 0, -Math.cos(B.yaw) * B.speed);
    let dy = B.yaw - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    player.yaw += dy * Math.min(1, dt * (Math.abs(B.speed) > 1 ? 2 : 0.2));
    eyeH = 1.45;
    player.boatRoll = B.g.rotation.x;
    sound.boatEngine(true, B.speed, Math.max(0, fz));
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
    const r = rideBike(bike, dt, { fx, fz, run }, { ground: (x, z, y) => groundAt(x, z, y + 0.4) - 0.07 * softSand(x, z), water: lvl, soft: softSand, time: elapsed });
    const onS = softSand(bike.g.position.x, bike.g.position.z) > 0.2 || (lvl - heightAt(bike.g.position.x, bike.g.position.z) > -0.3 && lvl - heightAt(bike.g.position.x, bike.g.position.z) < 0.4);
    tracks.update(dt, bike.g.position, bike.yaw, onS && Math.abs(bike.speed) > 0.3, Math.abs(bike.speed) * dt);
    if (onS && fz > 0) spray.emit(bike.g.position, bike.yaw, Math.abs(bike.speed), 0.4 + bike.soft, dt);
    if (phys.resolve(bike.g.position, 0.55, bike.g.position.y + 0.2, bike.g.position.y + 1.3)) { if (Math.abs(bike.speed) > 3) { sound.splash('dive', 0.4); camDip = 0.15; } bike.speed *= -0.25; }
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
  if (FORMS.includes(player.mode)) roll = player.formRoll || 0;
  if (player.mode === 'bike') roll = (player.bikeLean || 0) * 0.7 + Math.sin(elapsed * 23) * 0.0015 * Math.min(Math.abs(bike.speed), 10);
  if (player.mode !== 'bike') sound.engine(false, 0, 0);
  if (player.mode !== 'boat') sound.boatEngine(false, 0, 0);
  const bob = Math.sin(player.bob * 2) * bobAmp;
  camDip *= Math.pow(0.02, dt);
  camera.position.set(player.pos.x, player.pos.y + (sitting ? 1.12 : eyeH) + bob - camDip, player.pos.z);
  camera.rotation.set(player.pitch + (player.mode === 'bike' ? (player.bikePitch || 0) * 0.6 : 0), player.yaw, roll);
  under = camera.position.y < lvl - 0.03;

  if (player.mode === 'walk' && wadeDepth > 0.08 && player.ground && hs > 0.5) {
    player.rippleT -= dt;
    if (player.rippleT <= 0) { spawnRipple(W, player.pos.x, player.pos.z, night > 0.5); player.rippleT = 0.5; sound.splash('stroke', 0.5 + wadeDepth * 0.4); }
  }

  const fp = footprints.update(dt, player.pos, player.yaw, onSand && player.ground, hs > 0.6, hs * dt);
  if (player.mode === 'walk') {
    const tr = nearestTree(1.3);
    touchT = tr ? touchT + dt : 0;

    const dS2 = player.pos.z - shoreZ(player.pos.x);
    stillT = (hs < 0.15 && dS2 > 4 && dS2 < 60 && Math.abs(player.pos.y - heightAt(player.pos.x, player.pos.z)) < 0.1 && wind.strength.value > 0.3) ? stillT + dt : 0;

  }
  // il viaggio dell'acqua: nuvola → pioggia sull'isola → fioritura → petalo → vento → vele
  {
    if (player.mode === 'cloud' && isleQ === 0) {
      isleQ = 1;
      setTimeout(() => { msgEl.classList.add('thought'); showMsg('Lontano, al largo, c\'è un\'isola secca che aspetta la pioggia. Portaci la nuvola, poi piovi (Q).', 7); setTimeout(() => msgEl.classList.remove('thought'), 7000); discZone = { x: ISLAND.x, z: ISLAND.z, r: 110 }; }, 5000);
    }
    const overIsle = Math.hypot(player.pos.x - ISLAND.x, player.pos.z - ISLAND.z) < ISLAND.r * 1.15;
    const bl = updateIsland(island, { dt, raining: player.mode === 'rain' && overIsle, wind: wind.dir, time: elapsed });
    islandUniforms.uBloom.value = bl;
    if (island.started && isleQ < 2) { isleQ = 2; discZone = null; setTimeout(() => showMsg('Piovi sull\'isola. La terra beve, e qualcosa si sveglia.', 5), 1500); }
    if (island.done && isleQ === 2 && player.mode !== 'rain') {
      isleQ = 3; onDiscover('isola');
      setTimeout(() => {
        body = null; player.cat = false;
        player.pos.y = Math.max(player.pos.y, heightAt(player.pos.x, player.pos.z)) + 3;
        enterForm('petal'); player.yaw = Math.atan2(-(craft.ships[0].g.position.x - player.pos.x), -(craft.ships[0].g.position.z - player.pos.z));
        discZone = { x: craft.ships[0].g.position.x, z: craft.ships[0].g.position.z, r: 60 };
      }, 9500);
    }
    const ship = craft.ships[0].g.position;
    if (isleQ >= 3 && isleQ < 5 && discZone) { discZone.x = ship.x; discZone.z = ship.z; }
    if (isleQ === 3 && player.mode === 'petal' && Math.hypot(ship.x - player.pos.x, ship.z - player.pos.z) < 45) {
      isleQ = 4; enterForm('wind');
      setTimeout(() => showMsg('La barca a vela è ferma, senza un filo d\'aria. Soffia nelle sue vele.', 6), 2500);
    }
    if (isleQ === 4 && player.mode === 'wind' && Math.hypot(ship.x - player.pos.x, ship.z - player.pos.z) < 24) {
      isleQ = 5; craft.ships[0].blown = 45; discZone = null; onDiscover('vento');
    }
  }
  // passi: il suono dipende da cosa c'è sotto i piedi
  if (player.mode === 'walk' && player.ground && hs > 0.6 && !sitting) {
    stepDist += hs * dt;
    if (stepDist > (hs > 6 ? 1.0 : 0.72)) {
      stepDist = 0;
      const px = player.pos.x, pz = player.pos.z, th = heightAt(px, pz), dS = pz - shoreZ(px);
      let kind = 'sand';
      if (wadeDepth > 0.08) kind = 'water';
      else if (player.pos.y > th + 0.15) {
        const onPontile = Math.abs(px - PONTILE.x) < PONTILE.half + 0.2 && player.pos.y < PONTILE.deck + 0.3;
        const onSail = deckHeight(craft, px, pz, player.pos.y + 0.1) > -Infinity && craft.ships[0].g.position.distanceTo(player.pos) < 10;
        kind = onPontile || onSail ? 'wood' : (Math.abs(px - SCOGLIERA.x) < SCOGLIERA.half + 1 && dS < 5 ? 'rock' : 'concrete');
      } else if (dS < 3.5) kind = 'wet';
      else if (dS > 74) kind = 'grass';
      sound.step(player.cat && kind !== 'water' ? 'paw' : kind, hs);
    }
  }
  footprints.tick(dt);
  spray.update(dt);
  if (player.mode !== 'bike') tracks.update(dt, player.pos, 0, false, 0);
  scatter.update(player.pos.x, player.pos.z);
  flora.update(player.pos.x, player.pos.z);
  wrack.update(player.pos.x, player.pos.z);
  {
    const dyn = flora.colliders.slice();
    for (const w of places.walls) { const pl = w.g.userData.palm; if (!pl) continue; pl.getWorldPosition(tmp); dyn.push({ x: tmp.x, z: tmp.z, r: 0.3, top: tmp.y + 6, bottom: tmp.y - 2 }); }
    if (player.mode !== 'bike') dyn.push({ x: bike.g.position.x, z: bike.g.position.z, r: 0.7, top: bike.g.position.y + 1.1, bottom: bike.g.position.y - 1 });
    if (player.mode !== 'boat') dyn.push({ x: craft.boat.g.position.x, z: craft.boat.g.position.z, r: 1.3, top: craft.boat.g.position.y + 0.6, bottom: -3 });
    dyn.push(...shipCircles());
    phys.setDynamic(dyn);
  }
  const windK = updateWind(elapsed);
  drift.update(dt, player.pos, windK);
  sound.wind(player.mode === 'wind' ? 1 : player.mode === 'petal' ? Math.max(windK, 0.55) : player.mode === 'cloud' ? Math.max(windK, 0.75) : player.mode === 'gull' ? Math.max(windK, Math.min(1, 0.3 + (player.gs || 0) / 25)) : player.mode === 'tree' ? Math.min(1, windK + 0.3) : windK);
  waterUniforms.uWindK.value = windK; waterUniforms.uWindDir.value.copy(wind.dir);
  updateSea(sea, dt, elapsed, { player: player.pos, water: lvl });
  // scia: chi si muove sull'acqua lascia punti che si allargano in onde e schiuma
  {
    const T = waterUniforms.uTrail.value;
    let src = null, st = 0;
    const hsT = Math.hypot(player.vel.x, player.vel.z);
    if (player.mode === 'boat') { src = craft.boat.g.position; st = Math.min(1, Math.abs(craft.boat.speed) / 9); }
    else if (player.mode === 'sup') { src = sea.sup.g.position; st = Math.min(0.5, Math.abs(player.supSpeed) / 6); }
    else if (player.mode === 'swim') { src = player.pos; st = Math.min(0.35, hsT / 5); }
    else if (player.mode === 'flow' && player.pos.y > lvl - 0.8) { src = player.pos; st = Math.min(1, hsT / 14); }
    else if (player.mode === 'walk' && lvl - heightAt(player.pos.x, player.pos.z) > 0.25) { src = player.pos; st = Math.min(0.35, hsT / 6); }
    else if (player.mode === 'bike' && lvl - heightAt(player.pos.x, player.pos.z) > -0.05) { src = player.pos; st = Math.min(0.8, Math.abs(bike.speed) / 10); }
    trailT -= dt;
    if (src && st > 0.04 && trailT <= 0) { trailT = 0.22; T[trailI++ % T.length].set(src.x, src.z, elapsed, st); }
    // zona da calcolare: solo attorno ai punti di scia ancora vivi
    let cx = 0, cz = 0, n = 0;
    for (const v of T) if (elapsed - v.z < 16) { cx += v.x; cz += v.y; n++; }
    const TB = waterUniforms.uTrailBox.value;
    if (n) { cx /= n; cz /= n; let r = 0; for (const v of T) if (elapsed - v.z < 16) r = Math.max(r, Math.hypot(v.x - cx, v.y - cz)); TB.set(cx, cz, r + 32); } else TB.set(0, 0, -1);
    const RB = waterUniforms.uRingBox.value;
    let rn = 0, rx = 0, rz = 0;
    for (const v of waterUniforms.uRings.value) if (elapsed - v.z < 14) { rx += v.x; rz += v.y; rn++; }
    if (rn) RB.set(rx / rn, rz / rn, 140); else RB.set(0, 0, -1);
  }
  // eco dei luoghi
  {
    const px = player.pos.x, pz = player.pos.z, dS = pz - shoreZ(px);
    const near = (x, z, r) => Math.hypot(px - x, pz - z) < r;
    if (near(PONTILE.x, PONTILE.z0 - 20, 22)) echo('pontile');
    if (near(FOCE.x, shoreZ(FOCE.x) + 20, 22)) echo('foce');
    if (near(PERGOLA.x, PERGOLA.z, 10)) echo('chiosco');
    if (near(TORRETTA.x - 10, TORRETTA.z + 20, 25)) echo('stabilimento');
    if (near(SCOGLIERA.x, SCOGLIERA.z0 - 20, 22)) echo('scogliera');
    if (near(BARCA.x, BARCA.z, 7)) echo('barca');
    if (dS > 62 && dS < 72 && player.pos.y > heightAt(px, pz) + 0.3) echo('lungomare');
    if (dS > 140) echo('colline');
    if (near(MOLO.x, MOLO.z0 - 60, 40)) echo('molo');
    if (near(explore.shed.x, explore.shed.z, 12)) echo('capannone');
    if (near(PLATFORM.x, PLATFORM.z, 30)) echo('piattaforma');
    if (near(15, shoreZ(15) + 2, 8)) echo('bandiera');
    if (dS < -300) echo('largo');
  }
  updateExplore(explore, dt, elapsed, {
    player: player.pos, eye: camera.position, water: lvl, under, night,
    inSea: ['swim', 'dive', 'boat', 'sup', 'flow'].includes(player.mode),
    splash: (p) => { spawnRipple(W, p.x, p.z, night > 0.5); if (p.distanceTo(camera.position) < 80) sound.splash('stroke', 0.6); },
    onMeteor: () => { if (!seenMeteor) { seenMeteor = true; onDiscover('stella'); } },
    onDiscover,
  });
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
    else if (formOptions()) { promptEl.textContent = (isTouch ? 'FORMA · ' : 'Q · ') + 'diventa ' + FORM_TEXT[formOptions()].name.toLowerCase(); promptEl.classList.add('on'); }
    else if (FORMS.includes(player.mode) && body) { promptEl.textContent = (isTouch ? 'CORPO' : 'B') + ' · torna corpo'; promptEl.classList.add('on'); }
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

  // da molto in alto l'aria è più limpida: si vede il mondo sotto
  const altFog = 1 / (1 + Math.max(0, camera.position.y - 25) / 70);
  sun.color.copy(pal.sun); sun.intensity = pal.sunI * (1 - alto * 0.55);
  {
    // ombre: la zona d'ombra segue lo sguardo; in volo si allarga
    const alt = camera.position.y - Math.max(heightAt(camera.position.x, camera.position.z), waterUniforms.uLevel.value);
    const sz = alt > 40 ? 160 : alt > 12 ? 90 : 50;
    const C = sun.shadow.camera;
    if (C.right !== sz) { C.left = C.bottom = -sz; C.right = C.top = sz; C.far = 260 + sz; C.updateProjectionMatrix(); }
    const ahead = sz * 0.45, tx = player.pos.x - Math.sin(player.yaw) * ahead, tz = player.pos.z - Math.cos(player.yaw) * ahead;
    const texel = (2 * sz) / sun.shadow.mapSize.x;
    const sx = Math.round(tx / texel) * texel, sz2 = Math.round(tz / texel) * texel;
    sun.target.position.set(sx, Math.round(player.pos.y / texel) * texel, sz2);
    sun.position.copy(sun.target.position).addScaledVector(lightDir, 120 + sz);
  }
  hemi.color.copy(pal.hs); hemi.groundColor.copy(pal.hg); hemi.intensity = pal.hI;
  scene.fog.color.copy(pal.hor); scene.fog.density = pal.fog * 2.2 * (1 + mist * 1.2) * altFog;
  // sott'acqua: colore e foschia dell'acqua, la luce dipende dal giorno
  const daylight = 1 - night;
  underCol.setRGB(0.025, 0.2, 0.25).multiplyScalar(0.12 + 0.88 * daylight).lerp(tmpC.copy(pal.sun).multiplyScalar(0.12 * daylight), 0.15);
  waterUniforms.uUnderCol.value.copy(underCol);
  const clearEyes = hasGear || player.mode === 'fish' || player.mode === 'flow';
  waterUniforms.uUnderFog.value = clearEyes ? 0.035 : 0.16;
  // più giù, meno luce: il rosso sparisce per primo
  const camDepth = Math.max(0, waterUniforms.uLevel.value - camera.position.y);
  underDeep.copy(underCol).multiply(tmpC.setRGB(Math.exp(-camDepth * 0.16), Math.exp(-camDepth * 0.06), Math.exp(-camDepth * 0.045)));
  if (under) { scene.fog.color.copy(underDeep); scene.fog.density = clearEyes ? 0.042 : 0.17; scene.background = underDeep; }
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
  if (under !== lastUnder) {
    lastUnder = under; sound.setUnder(under ? 1 : 0);
    if (!under) drops = 1; // riemergi: gocce sull'obiettivo
    else waterSpray.burst(new THREE.Vector3(camera.position.x, waterUniforms.uLevel.value + 0.05, camera.position.z), 25, 1.6);
  }
  drops = Math.max(0, drops - dt * 0.4);
  wings.visible = player.mode === 'gull';
  waterSpray.update(dt);
  document.getElementById('bodyBtn').classList.toggle('hidden', !body || !isTouch);

  waterUniforms.uCam.value.copy(camera.position);
  waterUniforms.uLightDir.value.copy(lightDir);
  waterUniforms.uLightCol.value.copy(pal.sun).multiplyScalar(pal.sunI * 0.5);
  waterUniforms.uAmb.value.copy(pal.hs).multiplyScalar(pal.hI * 0.75).add(tmpC.copy(pal.sun).multiplyScalar(pal.sunI * Math.max(sunDir.y, 0) * 0.18));
  waterUniforms.uFog.value = pal.fog * altFog;
  water.position.set(Math.round(player.pos.x / 4) * 4, 0, Math.round(player.pos.z / 4) * 4);
  sky.position.copy(camera.position);

  updateWorld(W, dt, elapsed, {
    player: player.pos, yaw: player.yaw, night, pal, nextHor: nextPal.hor, onMeet,
  });
  updateWisp(dt);
  illum = Math.max(0, illum - dt * 0.25);
  updatePlaces(places, dt, elapsed, { active, wind: windK, night, player: player.pos, eye: camera.position, tod: todN, underwater: under, onFind, windDir: wind.dir,
    reach: ['gull', 'cloud', 'rain', 'wave'].includes(player.mode) ? 7 : FORMS.includes(player.mode) || player.mode === 'flow' ? 4 : 2.7 });
  updateSkyline(skyline, camera.position, pal, sunDir, U.uSunVis.value);

  {
    // la risacca suona a tempo con le onde che vedi (stessa fase dello shader)
    const px = player.pos.x;
    const jit = vn2(px * 0.018, 3.0) * 2.2 + vn2(px * 0.005, 7.0) * 3.5;
    const om = Math.PI * 2 / 7.5;
    const lobe = vn2(px * 0.075, 1.3) * 1.1 + vn2(px * 0.21, 4.1) * 0.35;
    const surfU = (((om * elapsed + jit + lobe) / (Math.PI * 2)) % 1 + 1) % 1;
    const surfSet = (0.55 + 0.45 * Math.sin(elapsed * 0.11 + px * 0.0025) * Math.sin(elapsed * 0.047 + 1)) * (0.75 + 0.5 * wind.strength.value);
    const dS = player.pos.z - shoreZ(px);
    const shorePan = Math.sign(-dS) * -Math.sin(player.yaw);
    let trees = 0; for (const c of flora.colliders) if (Math.abs(c.x - px) < 25 && Math.abs(c.z - player.pos.z) < 25) trees++;
    const inShed = Math.hypot(px - explore.shed.x, player.pos.z - explore.shed.z) < 13;
    const underMolo = Math.abs(px - MOLO.x) < MOLO.half && dS < MOLO.from && dS > MOLO.from - MOLO.n * MOLO.seg && camera.position.y < MOLO.deck - 1;
    sound.update({
      time: elapsed, shoreDist: dS, shorePan, surfU, surfSet: Math.min(1, surfSet), onWater: player.mode !== 'walk',
      speed: Math.max(hs, player.mode === 'glide' ? craft.glider.speed : 0), night, under,
      trees: Math.min(1, trees / 6), reverb: inShed ? 0.55 : underMolo ? 0.4 : 0.04,
      exposure: (player.pos.y > 25 || dS < -60) ? 1.4 : 1,
      form: FORMS.includes(player.mode) || player.mode === 'flow' ? player.mode : '', cat: player.cat && player.mode === 'walk',
      formSpeed: player.mode === 'flow' || player.mode === 'fish' ? Math.max(hs, player.fv || 0) : player.mode === 'wave' ? (player.ws || 0) : hs,
      flapRate: player.mode === 'gull' ? (fz > 0 || upK ? 10 / (2 * Math.PI) : 0.12) : 0,
    });
  }

  // HUD
  if (pal.label !== lastLabel) { lastLabel = pal.label; phaseEl.textContent = pal.label; phaseEl.classList.add('on'); phaseTimer = 4; }
  if (phaseTimer > 0 && (phaseTimer -= dt) <= 0) phaseEl.classList.remove('on');
  if (msgTimer > 0 && (msgTimer -= dt) <= 0) msgEl.classList.remove('on');
  {
    const mins = Math.floor(todN * 24 * 60);
    const txt = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    if (clockEl.textContent !== txt) clockEl.textContent = txt;
  }

  updateHint();
  { const fo = !!formOptions(); if (fo !== lastFO) { lastFO = fo; document.getElementById('formBtn').classList.toggle('hidden', !fo); } }
  {
    const t = places.traces[active];
    let op = 0;
    if (t && started) { const d = Math.hypot(t.pos.x - camera.position.x, t.pos.z - camera.position.z); op = THREE.MathUtils.smoothstep(d, 12, 45) * (0.5 + 0.5 * night) * 0.9; beam.position.set(t.pos.x, t.pos.y + 29.5, t.pos.z); beam.scale.setScalar(1 + d / 250); beam.scale.y = 1; }
    beam.material.uniforms.uOp.value += (op - beam.material.uniforms.uOp.value) * Math.min(1, dt * 2);
    beam.material.uniforms.uTime.value = elapsed; beam.visible = beam.material.uniforms.uOp.value > 0.01;
  }
  burst.update(dt, wind.dir);
  if (zoomPulse > 0) {
    // il binocolo: per un attimo lo sguardo si avvicina a ciò che vede
    zoomPulse = Math.max(0, zoomPulse - dt / 5);
    if (!camera.userData.fov0) camera.userData.fov0 = camera.fov;
    camera.fov = camera.userData.fov0 * (1 - 0.55 * Math.sin(Math.PI * (1 - zoomPulse)));
    camera.updateProjectionMatrix();
  }
  motes.update(dt, elapsed, camera.position, under ? 'snow' : player.mode === 'rain' ? 'rain' : player.mode === 'light' ? 'light' : '', underDeep, wind.dir, renderer.domElement.height);
  // mappa
  minimap.draw({
    player: player.pos, yaw: player.yaw, foce: FOCE, island: ISLAND, bloom: island.bloom,
    next: active < places.traces.length ? { x: places.traces[active].pos.x, z: places.traces[active].pos.z } : (zone && active >= places.traces.length ? zone : null),
    molo: [{ x: MOLO.x, z: MOLO.z0 + MOLO.from }, { x: MOLO.x, z: MOLO.z0 + MOLO.from - MOLO.n * MOLO.seg }],
    pontile: [{ x: PONTILE.x, z: PONTILE.z0 + PONTILE.from }, { x: PONTILE.x, z: PONTILE.z0 + PONTILE.to }],
    scogliera: [{ x: SCOGLIERA.x, z: SCOGLIERA.z0 + SCOGLIERA.from }, { x: SCOGLIERA.x, z: SCOGLIERA.z0 + SCOGLIERA.to }],
    places: [
      { ...PERGOLA, name: 'Chiosco' }, { ...BARCA, name: 'Barca in secco' }, { ...TORRETTA, name: 'Stabilimento' },
      { ...BELVEDERE, name: 'Belvedere' }, { x: PLATFORM.x, z: PLATFORM.z, name: 'Piattaforma' },
      { x: FOCE.x, z: shoreZ(FOCE.x) + 20, name: 'Foce' }, { x: 15, z: shoreZ(15) + 2, name: 'Bandiera' },
      { x: explore.shed.x, z: explore.shed.z, name: 'Capannone' }, { x: explore.raft.x, z: explore.raft.z, name: 'Zattera' }, { x: explore.buoy.g.position.x, z: explore.buoy.g.position.z, name: 'Boa' }, { x: MOLO.x, z: MOLO.z0 - 130, name: 'Vecchio molo' }, { x: ISLAND.x, z: ISLAND.z, name: 'Isola' },
    ],
    vehicles: [
      { x: bike.g.position.x, z: bike.g.position.z, name: 'Moto', color: '#e0623f' },
      { x: sea.sup.g.position.x, z: sea.sup.g.position.z, name: 'SUP', color: '#7fd0e6' },
      { x: craft.boat.g.position.x, z: craft.boat.g.position.z, name: 'Barchino', color: '#f2efe6' },
      { x: craft.glider.g.position.x, z: craft.glider.g.position.z, name: 'Deltaplano', color: '#ff8a5c' },
      ...(hasGear ? [] : [{ x: GEAR.x, z: GEAR.z, name: 'Maschera e pinne', color: '#9fe0a0' }]),
      ...craft.ships.map((S) => ({ x: S.g.position.x, z: S.g.position.z, name: S.name, color: '#d8e6f2' })),
    ],
    traces: places.traces.filter((t) => !t.found && t.i === active).map((t) => ({ x: t.pos.x, z: t.pos.z, found: false })),
    zone, discZone,
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
  P.uBlur.value = under && !clearEyes ? 1 : 0;
  P.uMask.value = under && hasGear && !FORMS.includes(player.mode) && player.mode !== 'flow' ? 1 : 0;
  P.uDepth.value = under ? camDepth : 0;
  P.uIllum.value = illum;
  P.uDrops.value = Math.min(1, drops * 1.5) * (under ? 0 : 1);
  P.uFlow.value = player.mode === 'flow' || player.mode === 'wave' ? 1 : 0;
  P.uForm.value.set(...({ cloud: [1.03, 1.03, 1.05, 0.12], gull: [1.02, 1.02, 1.04, 0.2], tree: [1.04, 1.06, 0.92, 0.35], sand: [1.1, 1.0, 0.86, 0.35] }[player.mode] || [1, 1, 1, 0]));
  P.uUnderCol.value.copy(underDeep);
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
if (Q.get('mode') === 'flow') { player.mode = 'flow'; player.pos.y = 0.2; }
if (Q.get('mode') === 'glide') { craft.glider.g.position.set(player.pos.x, player.pos.y + 2.5, player.pos.z); player.mode = 'walk'; action(); }
if (Q.get('mode') === 'boat') { craft.boat.g.position.set(player.pos.x, 0.1, player.pos.z); player.mode = 'walk'; action(); }
if (Q.get('mode') === 'bike') { bike.g.position.set(player.pos.x, groundAt(player.pos.x, player.pos.z, 99), player.pos.z); bike.g.rotation.y = player.yaw; player.mode = 'walk'; action(); }
if (Q.get('mode') === 'dive') { player.mode = 'dive'; player.pos.y = num('y', -4) - 1.65; }
frame();
window.__riva = { island, get isleQ() { return isleQ; }, motes, explore, get flowUnlocked() { return flowUnlocked; }, sound, get trailT() { return trailT; }, get el() { return elapsed; }, waterUniforms, wrack, flora, craft, player, scene, water, renderer, W, journal, footprints, places, sea, findAll: () => places.traces.forEach((t) => t.pos.copy(camera.position)), setGear: () => { hasGear = true; }, setTime: (t) => { tod = t; } };
