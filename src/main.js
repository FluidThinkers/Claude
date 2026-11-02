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
import { FORM_TEXT, gullWings, moveForm, flapWings } from './forms.js';
import { SCOGLIERA, PERGOLA, BARCA, TORRETTA, BELVEDERE } from './places.js';
import { FOCE } from './terrain.js';
import { buildAnts } from './ants.js';
import { buildSignal } from './signal.js';
import { CloudLayer } from './cloudlayer.js';
import { Flocks } from './flock.js';
import { COLONY } from './places.js';
import { Motes, LightBurst } from './particles.js';
import { FormPath } from './paths.js';
import { buildIsland, updateIsland } from './island.js';
import { ISLAND, addDune, DUNES } from './terrain.js';

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
const fpath = new FormPath(scene, glowTex);
const island = buildIsland(scene);
// colonna di luce sopra il prossimo ricordo: si vede da lontano, svanisce quando sei vicino
const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), new THREE.ShaderMaterial({
  // un fascio di luce morbido, sempre rivolto verso chi guarda (niente facce che si sovrappongono)
  uniforms: { uOp: { value: 0 }, uTime: { value: 0 }, uW: { value: 2.4 }, uH: { value: 70 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `uniform float uW, uH; varying vec2 vUv;
    void main(){ vUv = uv;
      vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      vec3 toCam = cameraPosition - base; toCam.y = 0.0; toCam = normalize(toCam);
      vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
      vec3 w = base + side * position.x * uW + vec3(0.0, (position.y + 0.5) * uH, 0.0);
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
  fragmentShader: `uniform float uOp, uTime; varying vec2 vUv;
    float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
    void main(){
      float x = vUv.x * 2.0 - 1.0, h = vUv.y;
      float prof = exp(-x * x * 22.0) * 0.8 + exp(-x * x * 4.0) * 0.35;
      float vert = smoothstep(0.0, 0.025, h) * pow(1.0 - h, 1.7);
      // polvere luminosa che sale lenta dentro il fascio
      float dust = vn(vec2(x * 7.0, h * 40.0 - uTime * 0.9)) * vn(vec2(x * 3.0 + 4.0, h * 13.0 - uTime * 0.4));
      float a = prof * vert * (0.7 + 0.6 * dust) + exp(-x * x * 9.0) * exp(-h * 40.0) * 0.6;
      vec3 c = mix(vec3(1.0, 0.92, 0.72), vec3(0.72, 1.0, 0.78), smoothstep(0.0, 0.5, h));
      gl_FragColor = vec4(c * a * uOp, 1.0);
    }`,
}));
beam.frustumCulled = false; beam.visible = false;
const signal = buildSignal(scene);
const cloudLayer = new CloudLayer(scene);
const flocks = new Flocks(scene);
let layerRain = 0;
const cLit = new THREE.Color(), cShade = new THREE.Color();
let signalOp = 0;
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
const crestSpray = new SandSpray(scene, 0xf2f6f8, 0.32); crestSpray.floorY = 0; crestSpray.n = crestSpray.n;
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
  phys.add(TORRETTA.x, TORRETTA.z, 1.25, heightAt(TORRETTA.x, TORRETTA.z) + 3.4);
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
// tutto ciò che sta piantato nell'acqua: l'acqua ci gira attorno
const WATER_PILES = phys.statics.filter((c) => waterUniforms.uLevel.value - heightAt(c.x, c.z) > 0.08).map((c) => ({ x: c.x, z: c.z, r: c.r, w: 1 }));
const pileTmp = [];
function updatePiles() {
  const cx = camera.position.x, cz = camera.position.z;
  pileTmp.length = 0;
  for (const c of WATER_PILES) { const d = Math.abs(c.x - cx) + Math.abs(c.z - cz); if (d < 140) pileTmp.push([d, c]); }
  // scafi che galleggiano
  for (const S of craft.ships) if (!S.manual) pileTmp.push([Math.abs(S.g.position.x - cx) + Math.abs(S.g.position.z - cz), { x: S.g.position.x, z: S.g.position.z, r: S.kind === 'ferry' ? 6 : 2.2, w: 3 }]);
  pileTmp.push([Math.abs(craft.boat.g.position.x - cx) + Math.abs(craft.boat.g.position.z - cz), { x: craft.boat.g.position.x, z: craft.boat.g.position.z, r: 1.2, w: 1.5 }]);
  if (['swim', 'flow', 'sup'].includes(player.mode) || (player.mode === 'walk' && waterUniforms.uLevel.value - heightAt(player.pos.x, player.pos.z) > 0.15)) pileTmp.push([0, { x: player.pos.x, z: player.pos.z, r: 0.35, w: 1 }]);
  pileTmp.sort((a, b) => a[0] - b[0]);
  const U = waterUniforms.uPiles.value;
  for (let i = 0; i < 16; i++) { const e = pileTmp[i]; if (e && e[0] < 160) U[i].set(e[1].x, e[1].z, e[1].r, e[1].w); else U[i].set(0, 0, 0, 0); }
}
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
  // il cappello in cima alla gru, l'orologio nel relitto
  const mv = (t, x, y, z) => { t.pos.set(x, y, z); t.base = y; t.g.position.copy(t.pos); };
  const hat = places.traces.find((t) => t.kind === 'hat'), watch = places.traces.find((t) => t.kind === 'watch');
  if (explore.craneTop) mv(hat, explore.craneTop.x, explore.craneTop.y + 0.05, explore.craneTop.z);
  if (explore.wreck) { const x = explore.wreck.x + 4, z = explore.wreck.z + 3; mv(watch, x, heightAt(x, z) + 0.05, z); }
  const bino = places.traces.find((t) => t.kind === 'binoculars');
  if (explore.ruin) mv(bino, explore.ruin.box.x, explore.ruin.box.y, explore.ruin.box.z);
  const letter = places.traces.find((t) => t.kind === 'letter');
  const anchor = new THREE.Object3D(); anchor.position.set(2.6, 1.22, 0.7); craft.ships[0].g.add(anchor);
  letter.follow = anchor; letter.g.rotation.set(0, 0.4, 0);
  // i ricordi che nascono da un gesto restano invisibili finché non nascono
  places.traces.forEach((t) => { const a = FRAGMENTS[t.i].act; t.hidden = a && a !== 'pick'; });
}
// tutte le luci (sprite e particelle) sempre rotonde: la sfumatura la calcola lo shader, non dipende dall'immagine
function roundLights(root) {
  root.traverse((o) => {
    const m = o.material; if (!m || m.userData.round) return;
    if (o.isSprite) {
      m.userData.round = true;
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', '#ifdef USE_MAP\n  diffuseColor.a *= 1.0 - smoothstep(0.32, 0.5, length(vMapUv - 0.5));\n#endif\n#include <alphatest_fragment>'); };
      m.needsUpdate = true;
    } else if (o.isPoints && m.isPointsMaterial) {
      m.userData.round = true;
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', '  diffuseColor.a *= 1.0 - smoothstep(0.3, 0.5, length(gl_PointCoord - 0.5));\n#include <alphatest_fragment>'); };
      m.needsUpdate = true;
    }
  });
}
// l'ombra del gabbiano: la sagoma ad ali aperte, disegnata nello shader, morbida quanto più sei in alto
const gullShadow = (() => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.ShaderMaterial({
    uniforms: { uOp: { value: 0 }, uBlur: { value: 0.05 }, uFlap: { value: 0 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uOp, uBlur, uFlap; varying vec2 vU;
      float sd(vec2 p){
        float ax = abs(p.x);
        float body = length(vec2(p.x / 0.09, (p.y + 0.05) / 0.36)) - 1.0;
        float yc = 0.02 + (0.32 - 0.22 * uFlap) * ax - 0.42 * ax * ax;
        float wing = (abs(p.y - yc) - 0.13 * (1.0 - pow(ax, 1.6))) / 0.13;
        wing = max(wing, (ax - 0.98) / 0.05);
        float tail = length(vec2(p.x / 0.1, (p.y + 0.42) / 0.1)) - 1.0;
        return min(min(body, wing), tail);
      }
      void main(){ float a = 1.0 - smoothstep(-uBlur * 10.0, uBlur * 10.0 + 0.05, sd(vU)); gl_FragColor = vec4(0.02, 0.03, 0.05, a * uOp); }`,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  }));
  m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m;
})();
const ants = buildAnts(scene, COLONY, { x: BARCA.x + 3.5, z: BARCA.z - 1.5 });
// la cresta dell'onda che sei: un muro d'acqua verde-azzurro con la schiuma in cima, sotto e ai lati dello sguardo
const crest = (() => {
  const geo = new THREE.PlaneGeometry(26, 1, 40, 10), p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), v = p.getY(i) + 0.5;
    const side = 1 - Math.pow(Math.abs(x) / 13, 2.2);
    // la faccia dell'onda davanti a te: parte dal mare qualche metro avanti e sale fin sotto lo sguardo, col labbro che si arriccia
    const y = v * Math.max(0.06, side), z = -4.2 + 3.2 * v - 0.8 * Math.pow(v, 5) + Math.abs(x) * 0.16;
    p.setXYZ(i, x, y, z);
    const foam = Math.min(1, Math.pow(Math.max(0, (v - 0.7) / 0.3), 1.5) * (0.75 + 0.25 * Math.sin(x * 2.3 + v * 9)) + (v > 0.95 ? 0.3 : 0));
    // acqua che si alza: più chiara e verde in alto, dove la luce la attraversa
    col.push(0.16 + 0.12 * v + 0.75 * foam, 0.5 + 0.25 * v + 0.25 * foam, 0.52 + 0.2 * v + 0.25 * foam);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.92, roughness: 0.15, side: THREE.DoubleSide, emissive: 0x0c3a3c, emissiveIntensity: 0.6 }));
  m.visible = false; m.renderOrder = 5; m.frustumCulled = false; m.material.depthTest = false; camera.add(m); return m;
})();
camera.add(ants.held);
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
  if (e.code === 'KeyG') nextWeather();
  if (e.code === 'KeyV') { voiceOn = !voiceOn; if (!voiceOn) voiceStop(); showMsg(voiceOn ? 'Voce accesa.' : 'Voce spenta.', 2); }
  if (e.code === 'KeyM') sound.toggle();
  if (e.code === 'KeyJ') journal.toggle();
  if (e.code === 'KeyN') minimap.toggle();
  if (e.code === 'KeyQ') enterForm(formOptions());
  if (e.code === 'Equal' || e.code === 'NumpadAdd') minimap.setZoom(minimap.zoom * 1.4);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') minimap.setZoom(minimap.zoom / 1.4);
  if (e.code === 'KeyX') nextWind();
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
  // sblocca la voce (iPhone la permette solo dopo un tocco)
  if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
  sound.start();
  started = running = true;
  overlay.classList.add('hidden');
  if (!isTouch) document.body.requestPointerLock?.();
  else document.getElementById('touch').classList.remove('hidden');
  if (!introDone) { introDone = true; sequence(INTRO, 4.5, 1.5); setTimeout(() => INTRO.forEach((l, k) => say(l, 'intro_' + (k + 1))), 1500); setTimeout(() => { if (places.found === 0) setGoal('Un riflesso di luce, sul cumulo di sabbia vicino a te.'); }, 15000); }
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
document.getElementById('meteoBtn').addEventListener('touchstart', (e) => { nextWeather(); e.preventDefault(); });
document.getElementById('windBtn').addEventListener('touchstart', (e) => { nextWind(); e.preventDefault(); });
document.getElementById('actBtn').addEventListener('touchstart', (e) => { action(); e.preventDefault(); });

document.getElementById('formBtn').addEventListener('touchstart', (e) => { enterForm(formOptions()); e.preventDefault(); });
document.getElementById('bodyBtn').addEventListener('touchstart', (e) => { returnToBody(); e.preventDefault(); });

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
  const rh = document.getElementById('resetHud'); rh.addEventListener('click', reset); rh.addEventListener('touchend', reset); rh.addEventListener('touchstart', (e) => e.stopPropagation());
}

// ---------- HUD
const phaseEl = document.getElementById('phase'), countEl = document.getElementById('count'), msgEl = document.getElementById('msg'), promptEl = document.getElementById('prompt'), clockEl = document.getElementById('clock'), invEl = document.getElementById('inv');
let lastLabel = '', msgTimer = 0, phaseTimer = 0;
let storyBusy = 0;
function ambientMsg(text, dur) { if (performance.now() < storyBusy) return; showMsg(text, dur); }
function showMsg(text, dur = 5) { msgEl.textContent = text; msgEl.classList.add('on'); msgTimer = dur; }
function sequence(lines, every = 4, delay = 0) {
  lines.forEach((l, i) => setTimeout(() => showMsg(l, every - 0.6), (delay + i * every) * 1000));
}

function advancePhase() {
  // un'ora avanti, scorrendo
  const base = todAnim ? todAnim.to : tod;
  todAnim = { from: tod, to: base + 1 / 24, t: 0, dur: 1.6 };
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
  const cpn = null;
  const tgt = cpn || (active < n ? stepTarget() : zone);
  if (!started || !tgt || sitting) { hintEl.classList.remove('on'); return; }
  hintEl.classList.add('on');
  const dx = tgt.x - player.pos.x, dz = tgt.z - player.pos.z, d = Math.hypot(dx, dz);
  const near = d;
  if (cpn) { hintAr.style.opacity = 1; let rl = Math.atan2(-(cpn.x - player.pos.x), -(cpn.z - player.pos.z)) - player.yaw; rl = Math.atan2(Math.sin(rl), Math.cos(rl)); hintAr.style.transform = `rotate(${(-rl).toFixed(3)}rad)`; hintDs.textContent = 'passaggio ' + (fpath.i + 1) + ' di ' + fpath.cps.length + ' · ' + Math.round(d) + ' m'; return; }
  if (near < 22 && active < n && (FRAGMENTS[active].act || 'pick') === 'pick') { hintAr.style.opacity = 0.25; hintDs.textContent = 'qui vicino · un riflesso'; return; }
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
  zone = { i, x: t.pos.x, z: t.pos.z, r: 30 };
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
const tmpV3 = new THREE.Vector3();
let sunShade = 0;
let zoomPulse = 0, pileTick = 0, lastSea = -1, lastBreak = null, floodT = -99, swellI = 0;
// meteo a comando (G): sereno → velato → nuvoloso → tempesta → automatico
const WEATHER = [
  { name: 'Sereno', txt: 'Sereno. Il vento cala, il mare diventa una lastra.', cloud: 0.02, sea: 0.04, wind: 0.15, rain: 0, dark: 0 },
  { name: 'Velato', txt: 'Velato. Una garza di nuvole, una brezza leggera, il mare increspato.', cloud: 0.35, sea: 0.3, wind: 0.45, rain: 0, dark: 0.12 },
  { name: 'Nuvoloso', txt: 'Nuvoloso. Il cielo si chiude, il mare si gonfia.', cloud: 0.72, sea: 0.62, wind: 0.7, rain: 0, dark: 0.35 },
  { name: 'Tempesta', txt: 'Tempesta. Pioggia, vento forte, onde lunghe che si rompono bianche.', cloud: 0.95, sea: 1, wind: 1, rain: 1, dark: 0.62 },
];
let weatherI = -1, lastThunder = 0;
// vento a comando (X): separato dal cielo. Muove sabbia, mare, nuvole, alberi, vele
const WIND = [
  { name: 'Nessun vento', txt: 'Il vento cade. La sabbia si ferma, il mare si fa liscio.', w: 0.02 },
  { name: 'Brezza', txt: 'Una brezza leggera: increspa l\'acqua, muove appena l\'erba.', w: 0.28 },
  { name: 'Vento medio', txt: 'Vento teso: la sabbia comincia a correre, le onde hanno la cresta bianca.', w: 0.52 },
  { name: 'Vento forte', txt: 'Vento forte: la sabbia vola a nastri, il mare si gonfia, le palme si piegano.', w: 0.8 },
  { name: 'Uragano', txt: 'Uragano. La sabbia è una nebbia che corre, il mare è montagne d\'acqua.', w: 1.0 },
];
let windI = -1, windOv = 0;
function nextWind() {
  windI = windI + 1 > 4 ? -1 : windI + 1;
  showMsg(windI < 0 ? 'Il vento torna a fare da sé.' : WIND[windI].txt, 4);
  sound.chord();
}
const wx = { k: 0, cloud: 0.3, sea: 0.3, wind: 0.4, rain: 0, dark: 0 };
function nextWeather() {
  weatherI = weatherI + 1 > 3 ? -1 : weatherI + 1;
  showMsg(weatherI < 0 ? 'Il tempo torna a fare da sé.' : WEATHER[weatherI].txt, 4);
  sound.chord();
}
// il gesto che fa nascere ogni ricordo, con la forma giusta
const ACT_FORM = { land: 'gull', friends: 'fish', bigwave: 'wave', sails: 'wind', moor: 'sail', rain: 'cloud', nap: 'cat', carry: 'ant' };
const FORM_NAME = { walk: 'umano', swim: 'umano, in acqua', dive: 'umano, sott\'acqua', sup: 'umano, sul SUP', bike: 'umano, in moto', boat: 'umano, in barca', glide: 'in volo, sul deltaplano', flow: 'acqua', gull: 'gabbiano', fish: 'pesce', wave: 'onda', cloud: 'nuvola', rain: 'pioggia', sand: 'sabbia', tree: 'albero', light: 'luce', petal: 'petalo', wind: 'vento', cat: 'gatto', ant: 'formica', sail: 'barca a vela, spinta dal vento', body: 'umano' };
// il meteo giusto per ogni tappa (G cambia il meteo)
const WEATHER_FOR = { land: 'cielo sereno (G) e brezza (X): il gabbiano plana meglio con poca aria', friends: 'qualsiasi', bigwave: 'tempesta (G) e vento forte (X): solo il mare grosso fa onde grandi', sails: 'vento medio o forte (X): serve vento per raggiungere la barca', moor: 'vento medio (X): abbastanza per correre, non troppo per governare', rain: 'nuvoloso (G): le nuvole cariche fanno piovere', nap: 'sereno (G), di giorno (T), poco vento (X)', carry: 'senza pioggia e con poco vento: una formica vola via' };
function curForm() { return player.cat && player.mode === 'walk' ? 'cat' : player.mode; }
function formLabel() { const f = curForm(); return f === 'gull' && player.landed ? 'gabbiano, posato' : FORM_NAME[f] || ''; }
let pendingForm = null, leadSchool = null;
let hasKey = false, preDone = false, friendT = 0, napT = 0, fishLead = false, fishWay = null, fishLeadT = 0;
function stepNeed() { const F = FRAGMENTS[active]; if (!F) return null; if (F.pre && !preDone) return ACT_FORM[F.pre]; return ACT_FORM[F.act] || null; }
function collectTrace(t) {
  if (t.found) return;
  if (t.hidden) { t.hidden = false; burst.burst(t.pos.clone(), 160); sound.chord(); }
  if (t.kind === 'book' && places.cypress) places.cypress.mat.color.set(0x2f4a2a);
  t.appear = 1; t.found = true; t.sp.material.opacity = 0; places.found++; onFind(t);
}
// dove andare adesso (mappa, freccia, colonna di luce)
function stepTarget() {
  const t = places.traces[active], F = FRAGMENTS[active];
  if (!t) return null;
  if (F.act === 'carry' && !player.carry) return ants.crumb.position;
  if (F.act === 'friends' && sea.fish && player.mode === 'fish') { if (!leadSchool || !leadSchool.placed) leadSchool = sea.fish.schools.filter((q) => q.placed).sort((a, b) => a.c.distanceTo(player.pos) - b.c.distanceTo(player.pos))[0]; if (leadSchool) return leadSchool.c; }
  if (F.act === 'carry') return ants.colony;
  return t.pos;
}
function canPick(t) {
  const F = FRAGMENTS[t.i];
  if ((F.act || 'pick') !== 'pick') return false;
  if (F.pre && !preDone) return false;
  if (F.key && !hasKey) { if (!places._keyMsg) { places._keyMsg = true; showMsg('La lanterna è chiusa in una cassetta di ferro. Serve una chiave.', 4); } return false; }
  return true;
}
function checkAct(jump, downK, night, dt) {
  const t = places.traces[active], F = FRAGMENTS[active];
  if (!t || t.found || !F) return;
  const act = F.pre && !preDone ? F.pre : F.act;
  if (!act || act === 'pick') { if (actPrompt) { actPrompt = false; promptEl.classList.remove('on'); } return; }
  const eye = FORMS.includes(player.mode) || player.mode === 'flow' ? camera.position : player.pos;
  const tg = stepTarget();
  const dh = Math.hypot(tg.x - eye.x, tg.z - eye.z), M = curForm();
  let near = false, ok = false, prompt = (FRAGMENTS[active - 1] || {}).prompt;
  if (act === 'land') { near = M === 'gull' && dh < 40; prompt = player.landed ? 'Cammina sul braccio fino al cappello' : 'Posati sul braccio della gru (tieni S), poi camminaci sopra'; ok = near && player.landed && dh < 2.5 && Math.abs(player.pos.y - t.pos.y) < 1.5; }
  else if (act === 'friends') {
    // trova il banco; poi il banco si gira e ti guida fino al relitto
    near = M === 'fish';
    const sc = sea.fish && sea.fish.schools.filter((q) => q.placed).sort((a, b) => a.c.distanceTo(player.pos) - b.c.distanceTo(player.pos))[0];
    const withSchool = near && sc && sc.c.distanceTo(player.pos) < 8;
    if (!fishLead) {
      friendT = withSchool ? friendT + dt : Math.max(0, friendT - dt * 0.5);
      prompt = withSchool ? 'Nuoti con loro…' : 'Trova il banco di pesci d\'argento';
      if (friendT > 4) { fishLead = true; fishLeadT = elapsed; const t0 = places.traces[active].pos; fishWay = { x: t0.x + (player.pos.x < t0.x ? -55 : 55), z: t0.z + 35 }; msgEl.classList.add('thought'); showMsg('Il banco si gira tutto insieme e ti fa strada. Seguilo.', 5); setTimeout(() => msgEl.classList.remove('thought'), 5000); }
    } else {
      prompt = 'Segui il banco';
      if (fishWay && Math.hypot(fishWay.x - player.pos.x, fishWay.z - player.pos.z) < 14) fishWay = null;
      ok = near && !fishWay && elapsed - fishLeadT > (Q.has('testfast') ? 2 : 25) && Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z) < 10;
    }
  }
  else if (act === 'bigwave') {
    near = M === 'wave';
    const pct = Math.min(100, Math.round(((player.wsize || 1) - 0.4) / (1.9 - 0.4) * 100));
    prompt = pct < 100 ? 'Onda ' + pct + '% · lasciati raggiungere dalle onde più grandi' : 'Ora sei enorme: corri a riva';
    if (lastBreak && elapsed - lastBreak.t < 2 && lastBreak.size >= 1.9 && !lastBreak.used) {
      // la bottiglia arriva con l'onda, dove l'onda si stende
      lastBreak.used = true;
      const bx = lastBreak.x, bz = shoreZ(lastBreak.x) + 1.4;
      t.pos.set(bx, heightAt(bx, bz) + 0.04, bz); t.base = t.pos.y; t.g.position.copy(t.pos);
      ok = true;
    }
  }
  else if (act === 'sails') {
    const S = craft.ships[0].g.position;
    const ds = Math.hypot(S.x - eye.x, S.z - eye.z);
    near = M === 'wind' && ds < 120;
    ok = near && ds < 16 && eye.y < S.y + 18;
    if (ok) { craft.ships[0].blown = 6; sound.wind(1); illum = 1; }
  }
  else if (act === 'moor') {
    const R = explore.ruin, S = craft.ships[0].g.position;
    near = M === 'sail' && Math.hypot(R.deck.x - S.x, R.deck.z - S.z) < 120;
    ok = near && Math.hypot(R.deck.x - S.x, R.deck.z - S.z) < 24;
    if (ok) { sailState.v = 0; showMsg('La barca accosta alla rovina. Il ferro è caldo di sole.', 4); }
  }
  else if (act === 'clear') {
    const R = explore.ruin; const dr = Math.hypot(R.deck.x - eye.x, R.deck.z - eye.z);
    near = M === 'wind' && dr < 110;
    ok = near && cloudBias < -0.32;
    if (ok) { illum = 1; showMsg('Le nuvole si aprono: la luce scende sulla rovina.', 4); }
  }
  else if (act === 'rain') { near = (M === 'cloud' || M === 'rain') && dh < 80; ok = M === 'rain' && dh < 36; }
  else if (act === 'nap') {
    near = M === 'cat' && dh < 18;
    const still = Math.hypot(player.vel.x, player.vel.z) < 0.4;
    if (near && night > 0.5) prompt = 'È buio: il sole tornerà (T fa passare le ore)';
    napT = near && dh < 5 && still && night <= 0.5 ? napT + dt : 0;
    if (napT > 0.5) prompt = 'Ti appisoli al sole…';
    if (napT > 0.5) fadeTarget = Math.min(0.5, napT / 8); else if (fadeTarget > 0 && fadeTarget <= 0.5 && M === 'cat') fadeTarget = 0;
    ok = napT > 4;
    if (ok) fadeTarget = 0;
  }
  else if (act === 'carry') {
    near = M === 'ant';
    const c = ants.crumb.position;
    if (near && !player.carry) {
      prompt = 'Prendi la briciola';
      if (Math.hypot(c.x - player.pos.x, c.z - player.pos.z) < 0.35) { player.carry = true; ants.crumb.visible = false; ants.held.visible = true; showMsg('La briciola è pesante come un sasso. Portala a casa, al formicaio.', 5); }
    } else if (near) {
      prompt = 'Portala al formicaio';
      ok = Math.hypot(ants.colony.x - player.pos.x, ants.colony.z - player.pos.z) < 0.6;
      if (ok) { ants.held.visible = false; player.carry = false; }
    }
  }
  if (near && !ok && prompt) { promptEl.textContent = prompt; promptEl.classList.add('on'); actPrompt = true; }
  else if (actPrompt) { actPrompt = false; promptEl.classList.remove('on'); }
  if (ok) { actPrompt = false; promptEl.classList.remove('on'); collectTrace(t); }
}
let actPrompt = false, baseFov = 72, formLblTxt = null;
const sailState = { yaw: 0, v: 0, trim: 0.5, boom: 0.4, side: 1, luff: 0 };
// altezza del mare aperto (stessa formula dello shader): serve alle barche per salire e scendere sulle onde
function swellAt(x, z, t) {
  const d = z - shoreZ(x), depth = -heightAt(x, z) + waterUniforms.uLevel.value;
  const wk = waterUniforms.uWindK.value, sw = wk * wk * (1 + 2.2 * waterUniforms.uStorm.value);
  const k = THREE.MathUtils.smoothstep(depth, 1, 6);
  return sw * (0.55 * Math.sin(x * 0.045 + d * 0.16 - t * 0.9) + 0.32 * Math.sin(x * -0.09 + d * 0.23 - t * 1.35 + 1.7) + 0.15 * Math.sin(x * 0.21 - d * 0.11 - t * 2.1)) * k;
}
// la barca sull'onda: sale, scende, beccheggia e rolla senza ribaltarsi
function rideWaves(g, yaw, heel, t) {
  const p = g.position, lvl = waterUniforms.uLevel.value;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = -fz, sz = fx;
  const hc = swellAt(p.x, p.z, t), hb = swellAt(p.x + fx * 5, p.z + fz * 5, t), hs = swellAt(p.x - fx * 5, p.z - fz * 5, t);
  const hl = swellAt(p.x + sx * 1.8, p.z + sz * 1.8, t), hr = swellAt(p.x - sx * 1.8, p.z - sz * 1.8, t);
  p.y += (lvl + hc * 0.9 - p.y) * 0.15;
  const ud = g.userData; ud.pitch = (ud.pitch || 0) + (Math.atan2(hb - hs, 10) * 0.8 - (ud.pitch || 0)) * 0.1; ud.roll = (ud.roll || 0) + (THREE.MathUtils.clamp(Math.atan2(hl - hr, 3.6) * 0.6 + heel, -0.45, 0.45) - (ud.roll || 0)) * 0.1;
  const pitch = ud.pitch, roll = ud.roll;
  g.rotation.set(0, Math.atan2(fz, -fx), 0);
  g.rotateX(roll); g.rotateZ(-pitch);
}
const formLblEl = document.getElementById('formLbl');
// gesti delle forme: ognuno si racconta la prima volta
const acts = new Set();
function actOnce(id, txt, t = 5) { if (acts.has(id) || performance.now() < storyBusy) return; acts.add(id); illum = Math.max(illum, 0.4); msgEl.classList.add('thought'); showMsg(txt, t); setTimeout(() => msgEl.classList.remove('thought'), t * 1000); }
let lastDune = -9, cloudBias = 0, swell = null;
function onFind(t) {
  storyBusy = performance.now() + 60000; voiceStop();
  if (t.kind === 'letter') { hasKey = true; invEl.textContent = 'chiave arrugginita' + (hasGear ? ' · maschera · pinne' : ''); invEl.classList.add('on'); }
  preDone = false; friendT = 0; napT = 0; fishLead = false;
  sound.chime(t.i); setTimeout(() => sound.chord(), 400);
  memoryEvent(t);
  const f = FRAGMENTS[t.i], i = t.i;
  journal.add(t.i);
  illum = 1;
  active = t.i + 1;
  setZone(active);
  // il racconto guida il tempo: ricordo → pensiero → trasformazione, ognuno quando la voce ha finito il precedente
  const minWait = (ms) => new Promise((r) => setTimeout(r, ms));
  (async () => {
    msgEl.classList.remove('thought'); showMsg(f.text, 60);
    await Promise.all([say(f.text, 'r' + i + '_ricordo'), minWait(7000)]);
    msgEl.classList.add('thought'); showMsg(f.thought, 60);
    if (zone) launchWisp(t.pos, zone);
    { const na = FRAGMENTS[active] && FRAGMENTS[active].act; const wf = WEATHER_FOR[na]; setGoal(f.goal + (wf && wf !== 'qualsiasi' ? '<span class="wx">tempo giusto · ' + wf + '</span>' : '')); }
    await Promise.all([say(f.thought, 'r' + i + '_pensiero'), minWait(6000)]);
    msgEl.classList.remove('thought');
    if (f.form) {
      // il cambio di forma lo scegli tu, quando sei pronto: compare il tasto
      pendingForm = { form: f.form, become: f.become, why: f.why, i };
      const nm = FORM_NAME[f.form] || f.form;
      showMsg((isTouch ? 'Tocca FORMA' : 'Premi Q') + ' per diventare ' + nm + '.', 60);
      document.getElementById('formBtn').classList.remove('hidden');
    }
    else msgTimer = 4;
    storyBusy = performance.now() + 3000;
  })();
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
const FORMS = ['gull', 'tree', 'sand', 'wave', 'cloud', 'fish', 'rain', 'light', 'petal', 'wind', 'ant'];
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
  if (pendingForm) return pendingForm.form;
  if (player.mode === 'cloud' || player.mode === 'rain') { /* piovere fa parte della tappa della nuvola */ } else return null;
  if (player.mode === 'rain') return player.rainLanded ? 'cloud' : null;
  if (player.mode === 'cloud') {
    if (stepNeed() !== 'cloud') return 'rain';
    const tg = stepTarget(); return tg && Math.hypot(tg.x - player.pos.x, tg.z - player.pos.z) < 70 ? 'rain' : null;
  }
  // se sei tornato umano a metà strada, Q ti ridà la forma che questa tappa chiede
  const need = stepNeed();
  if (!need || curForm() === need || (need === 'cloud' && player.mode === 'rain')) return null;
  const lvl = waterUniforms.uLevel.value, deep = lvl - heightAt(player.pos.x, player.pos.z);
  if ((need === 'fish' || need === 'wave') && deep < 1.2) return null;
  if (need === 'sail' && craft.ships[0].g.position.distanceTo(player.pos) > 40) return null;
  if ((need === 'sand' || need === 'ant' || need === 'cat') && deep > 0.2) return null;
  if (!['walk', 'swim', 'dive'].includes(player.mode)) return null;
  return need;
}
function enterForm(f) {
  if (!f) { showMsg('Qui non c\'è niente in cui entrare.', 2.5); return; }
  if (f === 'cloud' && player.mode === 'rain') { player.rainLanded = false; player.mode = 'cloud'; player.cloudY = 150; showMsg('Il sole ti scalda: evapori, e torni nuvola.', 3); return; }
  if (pendingForm && f === pendingForm.form) { const pf = pendingForm; pendingForm = null; storyForm(pf.form, pf.become, pf.why, pf.i); return; }
  if (f !== 'rain') { storyForm(f, null, null); return; }
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
  if (f === 'rain') { player.pitch = -0.9; player.rainLanded = false; }
  wings.visible = f === 'gull';
  if (FORM_TEXT[f].enter) showMsg(FORM_TEXT[f].enter, 3);
}
// tornare corpo: sempre dove sei adesso, mai dove eri prima
function returnToBody() {
  body = null; fpath.clear();
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
  sequence(ENDING, 4.2, 0.5); ENDING.forEach((l, k) => say(l, 'fine_' + (k + 1)));
  setTimeout(() => { sound.chord(); const cur = ((tod % 1) + 1) % 1; todAnim = { from: tod, to: tod - cur + (cur < 0.75 ? 0.755 : 1.755), t: 0, dur: 30 }; }, ENDING.length * 4200);
  // finale: ti sciogli in luce sopra l'acqua della sera
  setTimeout(() => {
    body = { pos: player.pos.clone(), yaw: player.yaw, mode: 'walk' };
    player.mode = 'light'; player.cat = false; player.yaw = Math.PI * 0 ; player.pitch = 0.05;
    illum = 1; sound.chord();
    sequence(FINALE, 6, 0.5); FINALE.forEach((l, k) => say(l, 'finale_' + (k + 1)));
    setTimeout(() => {
      fade = 1; post.uniforms.uFadeCol.value.setRGB(1, 0.92, 0.85);
      setTimeout(() => { returnToBody(); showMsg('RIVA. Puoi restare, ed esplorare quanto vuoi.', 7); }, 1500);
    }, 26000);
  }, ENDING.length * 4200 + 3000);
}
// la forma che un ricordo ti fa prendere, per arrivare al successivo
// la trasformazione: annunciata, lenta, e spiegata
const BECOME = { sail: 'la barca, e il vento nelle sue vele', wind: 'vento', ant: 'una formica', gull: 'un gabbiano', sand: 'sabbia', fish: 'un pesce', wave: 'un\'onda', cloud: 'una nuvola', cat: 'un gatto', body: 'di nuovo umano', glide: 'leggero, come chi vola' };
// voce narrante: legge la trasformazione (V la spegne o la riaccende)
let voiceOn = true, voiceIt = null, voiceLive = 0;
function pickVoice() { if (!window.speechSynthesis) return; const v = speechSynthesis.getVoices(); voiceIt = v.find((x) => /it[-_]IT/i.test(x.lang) && /Premium/i.test(x.name)) || v.find((x) => /it[-_]IT/i.test(x.lang) && /(Enhanced|Siri|Neural|Natural)/i.test(x.name)) || v.find((x) => /it[-_]IT/i.test(x.lang) && /Alice|Federica|Paola|Emma|Luca|Google/i.test(x.name)) || v.find((x) => /^it/i.test(x.lang)) || null; }
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
// ---------- voce narrante: registrazioni vere se ci sono (audio/voce/<id>.wav o .mp3), altrimenti la voce di sistema
const voiceClips = {};
(async () => {
  try {
    const m = await (await fetch('audio/voce/manifest.json')).json();
    for (const [id, f] of Object.entries(m)) voiceClips[id] = 'audio/voce/' + f;
  } catch (e) { /* nessuna registrazione: voce di sistema */ }
})();
const voiceBufs = {};
let voiceChain = Promise.resolve(), voiceSrc = null;
function voiceStop() { if (window.speechSynthesis) speechSynthesis.cancel(); try { voiceSrc && voiceSrc.stop(); } catch (e) {} voiceSrc = null; voiceChain = Promise.resolve(); }
function speakOne(id, text) {
  return new Promise(async (done) => {
    if (!voiceOn || !text) return done();
    if (id && voiceClips[id] && sound.ctx) {
      try {
        if (!voiceBufs[id]) { const b = await (await fetch(voiceClips[id])).arrayBuffer(); voiceBufs[id] = await new Promise((ok, ko) => sound.ctx.decodeAudioData(b, ok, ko)); }
        const src = sound.ctx.createBufferSource(); src.buffer = voiceBufs[id];
        const g = sound.ctx.createGain(); g.gain.value = 1; src.connect(g); g.connect(sound.comp);
        voiceSrc = src; sound.narr && sound.narr(true);
        src.onended = () => { sound.narr && sound.narr(false); setTimeout(done, 700); };
        src.start(); return;
      } catch (e) { /* passa alla voce di sistema */ }
    }
    if (!window.speechSynthesis) return done();
    const clean = text.replace(/\([^)]*\)/g, '').replace(/[«»]/g, '');
    const parts = clean.match(/[^.!?…]+[.!?…]*/g) || [clean];
    let left = parts.length;
    const guard = setTimeout(done, 4000 + clean.length * 110);
    for (const part of parts) {
      const u = new SpeechSynthesisUtterance(part.trim());
      u.lang = 'it-IT'; if (voiceIt) u.voice = voiceIt; u.rate = 0.8; u.pitch = 0.88; u.volume = 1;
      u.onstart = () => { voiceLive++; sound.narr && sound.narr(true); };
      u.onend = u.onerror = () => { voiceLive = Math.max(0, voiceLive - 1); if (--left <= 0) { clearTimeout(guard); setTimeout(() => { if (!voiceLive) sound.narr && sound.narr(false); done(); }, 600); } };
      speechSynthesis.speak(u);
    }
  });
}
// in fila: ogni frase aspetta la precedente; ritorna quando questa è finita
function say(text, id = null) {
  const p = voiceChain.then(() => speakOne(id, text));
  voiceChain = p; return p;
}
async function storyForm(form, text, why, i = active - 1) {
  if (form === 'fish' && player.mode === 'gull') { player.landed = false; player.forceDive = true; player.gs = 12; player.pitch = -1.0; }
  const ann = 'Qualcosa cambia. Ti senti diventare ' + (BECOME[form] || form) + '.';
  showMsg(ann.replace('.', '…'), 60);
  fadeTarget = 0.8; post.uniforms.uFadeCol.value.setRGB(1, 0.96, 0.9);
  sound.chord(); illum = Math.max(illum, 0.6);
  // la trasformazione avviene mentre la voce annuncia, e si completa quando ha finito
  await Promise.all([say(ann, 'cambio_' + form), new Promise((r) => setTimeout(r, 3600))]);
  applyForm(form); fadeTarget = 0;
  if (text) { showMsg(text, 60); await Promise.all([say(text, 'r' + i + '_diventi'), new Promise((r) => setTimeout(r, 4000))]); }
  if (why) { msgEl.classList.add('thought'); showMsg(why, 60); await Promise.all([say(why, 'r' + i + '_perche'), new Promise((r) => setTimeout(r, 7000))]); msgEl.classList.remove('thought'); }
  msgTimer = 3;
}
function applyForm(form) {
  const lvl = waterUniforms.uLevel.value;
  if (FORMS.includes(player.mode) || player.mode === 'flow') { body = null; }
  if (['bike', 'boat', 'sup', 'glide'].includes(player.mode)) { player.mode = 'walk'; bike.fp.visible = false; bike.on = false; sea.fpPaddle.visible = false; craft.boat.on = false; }
  player.cat = false; wings.visible = false; body = null; player.waveRest = false; player.landed = false; player.forceDive = false;
  illum = Math.max(illum, 0.7);
  if (form === 'sand') { flowUnlocked = true; player.mode = 'sand'; player.pos.y = heightAt(player.pos.x, player.pos.z) + 0.4; player.pitch = -0.06; }
  else if (form === 'cat') { player.mode = 'walk'; player.cat = true; player.pos.y = groundAt(player.pos.x, player.pos.z, player.pos.y + 1); }
  else if (form === 'fish') {
    // resti dove sei: se sotto c'è acqua ci scivoli dentro, altrimenti scendi fin dove l'acqua è profonda
    let x = player.pos.x, z = player.pos.z;
    for (let i = 0; i < 80 && lvl - heightAt(x, z) < 1.4; i++) z -= 1;
    player.mode = 'fish'; player.pos.set(x, lvl - 1.0, z); player.pitch = -0.35; player.yaw = 0; drops = 0; sound.splash('dive', 0.8);
  }
  else if (form === 'wave') { player.mode = 'wave'; player.questWave = true; player.waveRest = false; player.wsize = 0.6; player.ws = 3; if (player.pos.z - shoreZ(player.pos.x) > -220) player.pos.z = shoreZ(player.pos.x) - 220; player.pos.y = lvl + 0.6; player.yaw = Math.PI; player.pitch = -0.1; }
  else if (form === 'gull') { player.mode = 'gull'; player.gs = 11; player.bank = 0; player.pos.y = Math.max(player.pos.y, heightAt(player.pos.x, player.pos.z)) + 8; player.pitch = -0.1; wings.visible = true; }
  else if (form === 'body') { player.mode = 'walk'; player.pos.y = groundAt(player.pos.x, player.pos.z, player.pos.y + 2); }
  else if (form === 'cloud') { player.mode = 'cloud'; player.cloudY = 150; player.pitch = -0.5; }
  else if (form === 'wind') { player.mode = 'wind'; player.vs = 14; player.pos.y = Math.max(player.pos.y, heightAt(player.pos.x, player.pos.z), lvl) + 6; player.pitch = -0.08; }
  else if (form === 'sail') {
    const S = craft.ships[0]; S.manual = true;
    const r = S.g.rotation.y; sailState.yaw = Math.atan2(Math.cos(r), -Math.sin(r)); sailState.v = 2; sailState.trim = 0.5;
    setTimeout(() => showMsg(isTouch ? 'Ai lati timoni. Avanti cazzi la randa, indietro la lasci. Guarda il nastro rosso: ti dice da dove arriva il vento.' : 'A e D: timone. W: cazza la randa · S: lascala. Il nastro rosso in testa d\'albero e a prua ti dice il vento.', 8), 4500);
    player.mode = 'sail'; player.yaw = sailState.yaw; player.pitch = -0.08;
  }
  else if (form === 'ant') { player.mode = 'ant'; player.carry = false; player.pos.y = heightAt(player.pos.x, player.pos.z) + 0.05; player.pitch = -0.05; }
  else if (form === 'glide') {
    player.mode = 'walk';
    const G = craft.glider; G.g.position.set(player.pos.x, player.pos.y + 2.5, player.pos.z);
    player.yaw = Math.atan2(-(18 - player.pos.x), -(shoreZ(18) - player.pos.z)); sitting = null;
    player.pos.y += 1.5; launchGlider(); G.speed = 12;
  }
  // il percorso di questa forma fino al prossimo ricordo
  const nt = places.traces[active];
  if (false && nt && fpath.build(form === 'body' ? 'body' : form, player.pos.clone(), nt.pos, waterUniforms.uLevel.value, { cloudY: player.cloudY })) {
    const PATH_TXT = { gull: 'Segui le correnti d\'aria: passaci attraverso, ti portano.', sand: 'Segui i mulinelli: il vento ti porta da uno all\'altro.', fish: 'Segui le colonne di bolle, giù verso il fondo.', wave: 'Passa nei cerchi di luce sul mare.', cloud: 'Unisciti alle altre nuvole, una dopo l\'altra.', cat: 'Segui i piccoli mulinelli tra i sassi.', glide: 'Passa negli anelli d\'aria calda: ti tengono su.' };
    setTimeout(() => { echoEl.textContent = PATH_TXT[form] || 'Segui il percorso.'; echoEl.classList.add('on'); clearTimeout(echo.t); echo.t = setTimeout(() => echoEl.classList.remove('on'), 9000); }, 21000);
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
    if (player.cat && depth > 0.15 && !onDeck) { player.pos.x -= player.vel.x * dt * 2; player.pos.z -= player.vel.z * dt * 2; player.vel.x *= -0.3; player.vel.z *= -0.3; }
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
    // chi nuota sale e scende con il mare
    player.swellY = swellAt(player.pos.x, player.pos.z, elapsed);
    player.pos.y = lvl + 0.12 - 1.65 + Math.sin(elapsed * 1.6) * 0.04 + player.swellY;
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
    const r = moveForm(M, player, { storm: waterUniforms.uStorm.value, groundAt, waveMin: FRAGMENTS[active] && FRAGMENTS[active].act === 'bigwave' ? 1.9 : 0, dt, fx, fz, run, up: upK, down: downK, jump, lvl, wind: wind.strength.value, windDir: wind.dir, time: elapsed,
      target: M === 'petal' ? craft.ships[0].g.position : M === 'cloud' && isleQ === 1 ? ISLAND : (M === 'sand' || M === 'cloud' || (M === 'wave' && player.questWave)) && qt ? qt.pos : null });
    if (M === 'wind' && player.pos.y < lvl + 10) { const T = waterUniforms.uTrail.value; if (Math.random() < dt * 8) T[trailI++ % T.length].set(player.pos.x, player.pos.z, elapsed, 0.5); }
    eyeH = 0;
    player.formRoll = r.roll;
    if (M === 'wave') player.pos.y += swellAt(player.pos.x, player.pos.z, elapsed) * 0.9 * Math.min(1, dt * 4);
    if (!['cloud', 'light', 'tree'].includes(M) && !(M === 'gull' && player.pos.y > 40)) {
      const rad = M === 'ant' ? 0.03 : M === 'wave' ? 0.8 : M === 'fish' ? 0.25 : 0.3;
      collide(player.pos); shipCollide(craft, player.pos); exploreCollide(explore, player.pos);
      phys.resolve(player.pos, rad, player.pos.y - 0.4, player.pos.y + 0.4);
    }
    if (r.timeScale && !todAnim && running) tod += dt * r.timeScale / CYCLE;
    if (M === 'gull' && r.landed) { sound.flap && sound.flap(0.6); if (!acts.has('landed')) { acts.add('landed'); showMsg('Ti posi. Puoi camminare; Spazio per ripartire.', 4); } }
    if (M === 'gull' && r.takeoff) { sound.flap && sound.flap(1); }
    if (M === 'gull' && r.plunge) { sound.splash('dive', 1); waterSpray.burst(new THREE.Vector3(player.pos.x, lvl + 0.1, player.pos.z), 80, 2.6); spawnRipple(W, player.pos.x, player.pos.z, night > 0.5); }
    if (M === 'gull' && r.emerge) {
      sound.splash('stroke', 1); waterSpray.burst(new THREE.Vector3(player.pos.x, lvl + 0.1, player.pos.z), 50, 2);
      const near = sea.fish && sea.fish.schools.some((sc) => sc.placed && sc.c.distanceTo(player.pos) < 14);
      actOnce(near ? 'catch' : 'dive', near ? 'Riemergi con un pesce d\'argento nel becco.' : 'Ti tuffi, e riemergi a mani vuote. Dove brillano i pesci, andrà meglio.');
    }
    if (M === 'gull') { flapWings(wings, r.flap || 0, player.bank || 0, fz > 0 || upK ? 0 : 1); sound.wind(Math.min(1, 0.3 + r.speed / 25)); if (Math.random() < dt * 0.03) sound.gull((Math.random() - 0.5) * 0.4, 7); }
    if (M === 'tree') sound.wind(Math.min(1, wind.strength.value + 0.3));
    if (M === 'fish' && r.leapStart) { sound.splash('stroke', 1); waterSpray.burst(new THREE.Vector3(player.pos.x, lvl, player.pos.z), 40, 2); actOnce('leap', 'Salti fuori dall\'acqua: per un attimo vedi il cielo, poi torni giù.'); }
    if (M === 'fish' && r.reentry) { sound.splash('dive', 0.7); spawnRipple(W, player.pos.x, player.pos.z, night > 0.5); waterSpray.burst(new THREE.Vector3(player.pos.x, lvl, player.pos.z), 30, 1.6); }
    if (M === 'gull' && r.touchWater && elapsed - (player.lastDip || 0) > 1.5) {
      player.lastDip = elapsed; sound.splash('stroke', 1.1); waterSpray.burst(new THREE.Vector3(player.pos.x, lvl, player.pos.z), 50, 2.4); spawnRipple(W, player.pos.x, player.pos.z, night > 0.5);
      const near = sea.fish && sea.fish.schools.some((sc) => sc.c.distanceTo(player.pos) < 12);
      player.pos.y += 1.2;
      if (near) { sound.gull(0, 6); actOnce('catch', 'Ti tuffi e risali con un pesce nel becco. Il mare dà da mangiare a chi lo conosce.'); }
      else actOnce('dip', 'Sfiori l\'acqua. Dove i pesci fanno brillare il fondo, potresti pescare.');
    }
    if (M === 'sand' && r.dune && elapsed - lastDune > 1.2 && heightAt(player.pos.x, player.pos.z) > lvl + 0.2) {
      lastDune = elapsed;
      const dx = -Math.sin(player.yaw) * 3, dz = -Math.cos(player.yaw) * 3;
      addDune(player.pos.x + dx, player.pos.z + dz, 4 + Math.random() * 2.5, 0.7 + Math.random() * 0.5); terrain.rebuild();
      spray.burst(new THREE.Vector3(player.pos.x + dx, player.pos.y, player.pos.z + dz), 120, 2.4); sound.wind(1);
      actOnce('dune', 'Ti ammucchi nel vento: nasce una duna. Il paesaggio cambia anche per mano tua.');
    }
    if (M === 'wind' && r.cloudDelta) {
      cloudBias = THREE.MathUtils.clamp(cloudBias + r.cloudDelta * dt * 0.18, -0.55, 0.65);
      if (cloudBias > 0.35) actOnce('gather', 'Spingi le nuvole una contro l\'altra: il cielo si chiude, e comincia a piovere.');
      if (cloudBias < -0.35) actOnce('clear', 'Spazzi via le nuvole: torna il sereno, e la luce cade sul mare.');
    }
    if (M === 'wave' && !player.waveRest) {
      // da dietro arrivano onde più grandi: si vedono, e se ti raggiungono ti unisci a loro
      const rough = waterUniforms.uWindK.value > 0.55;
      if (!rough && FRAGMENTS[active] && FRAGMENTS[active].act === 'bigwave') { if (!actPrompt) { promptEl.textContent = 'Il mare è troppo calmo: nessuna onda grande ti raggiungerà. Chiama la tempesta (G).'; promptEl.classList.add('on'); actPrompt = true; } }
      if (rough && (!swell || elapsed - swell.t0 > 7)) {
        swell = { x: player.pos.x + (Math.random() - 0.5) * 12, z: player.pos.z - 38, t0: elapsed, merged: false };
        const SW = waterUniforms.uSwells.value[(swellI = (swellI + 1) % 2)]; SW.set(swell.x, swell.z, elapsed, 1.0 + 0.3 * (player.wsize || 1));
      }
      if (swell) { const front = swell.z + (elapsed - swell.t0) * 7, dd = Math.abs(player.pos.z - front) + Math.max(0, Math.abs(player.pos.x - swell.x) - 60);
      if (!swell.merged && dd < 4 && elapsed - swell.t0 > 1.5) {
        swell.merged = true; player.wsize = Math.min(3, (player.wsize || 1) + 0.48); player.ws = Math.min(9, (player.ws || 3) + 1.5);
        sound.splash('dive', 1.3); camDip = 0.25; waterSpray.burst(new THREE.Vector3(player.pos.x, lvl + 0.8 * player.wsize, player.pos.z), 90, 2.6);
        showMsg(player.wsize >= 1.9 ? 'Sei un\'onda enorme, ora. Corri a riva.' : 'Ti unisci a un\'onda più grande: cresci.', 3);
      } }
    }
    if (M === 'fish' && r.blocked && !acts.has('shallow')) actOnce('shallow', 'Più in là l\'acqua è troppo bassa: un pesce resta nel mare.', 4);
    if (M === 'wave' && r.tooSmall && !player.smallTold) { player.smallTold = true; showMsg('Sei troppo piccola per arrivare a riva: cresci (avanti).', 4); }
    if (M === 'rain' && r.landed) {
      // la pioggia resta pioggia: si posa, e se non era il posto giusto evapora (Q) e torna nuvola
      player.pos.y = Math.max(heightAt(player.pos.x, player.pos.z), lvl) + 1.2;
      if (!player.rainLanded) { player.rainLanded = true; addRing(player.pos.x, player.pos.z, 0.3); if (stepNeed() !== 'cloud' || places.traces[active].found) {} else showMsg('Ti sei posata qui, lontano dal cipresso. Evapora (Q) e torna nuvola.', 5); }
    }
    if (M === 'sand' && r.inWater) { addRing(player.pos.x, player.pos.z, 0.4); player.mode = 'swim'; player.pos.y = lvl + 0.1 - 1.65; toggleFlow(); showMsg('La sabbia scivola in acqua, e tu con lei.', 3); }
    if (M === 'wave') {
      const T = waterUniforms.uTrail.value; if (Math.random() < dt * 6) T[trailI++ % T.length].set(player.pos.x, player.pos.z, elapsed, 0.3 + 0.35 * (r.size || player.wsize || 1));
      if (!player.waveHint) { player.waveHint = true; setTimeout(() => showMsg(isTouch ? 'Avanti per correre, indietro per rallentare, ai lati per piegare. Lasciati raggiungere dalle onde più grandi.' : 'W corri · S rallenti · A e D pieghi. Lasciati raggiungere dalle onde più grandi.', 5), 6500); }
      if (r.broke) lastBreak = { x: player.pos.x, z: player.pos.z, t: elapsed, size: player.wsize || 1 };
      if (r.broke && player.questWave && FRAGMENTS[active] && FRAGMENTS[active].act === 'bigwave') {
        // l'onda grande si rompe: resti onda, schiuma che si stende sulla sabbia, finché la storia non ti trasforma
        player.questWave = false; player.waveRest = true; if ((player.wsize || 1) >= 1.9) floodT = elapsed;
        addRing(player.pos.x, player.pos.z - 2, 0.6 * (player.wsize || 1)); sound.splash('dive', 1.6); camDip = 0.3;
        waterSpray.burst(new THREE.Vector3(player.pos.x, lvl + 0.3, player.pos.z), 160, 3.5);
      } else if (r.broke && player.questWave) {
        player.questWave = false;
        addRing(player.pos.x, player.pos.z - 2, 0.6 * (player.wsize || 1)); sound.splash('dive', 1.4);
        player.mode = 'walk'; player.pos.z += 2; player.pos.y = groundAt(player.pos.x, player.pos.z, 3);
        showMsg('L\'onda si rompe e ti lascia sulla riva.', 3.5);
      } else if (r.broke) {
        addRing(player.pos.x, player.pos.z - 2, 0.9); sound.splash('dive', 1.4);
        // l'onda si rompe e ti lascia sulla riva, lì dove sei arrivato
        player.mode = 'walk'; player.pos.z += 2; player.pos.y = groundAt(player.pos.x, player.pos.z, 3);
        showMsg('L\'onda si rompe e ti lascia sulla riva.', 3);
      }
    }
  } else if (M === 'sail') {
    // navigazione vera: il vento apparente decide tutto. A e D timone, W cazza la randa, S la lasca.
    const S = craft.ships[0];
    const hx = -Math.sin(sailState.yaw), hz = -Math.cos(sailState.yaw);
    const ws = 0.6 + 18 * Math.max(0, wind.strength.value - 0.12); // vento reale, m/s: con la calma la vela pende
    const storm = waterUniforms.uStorm.value;
    const awx = wind.dir.x * ws - hx * sailState.v, awz = wind.dir.y * ws - hz * sailState.v; // vento apparente (verso dove soffia)
    const aws = Math.hypot(awx, awz) || 1;
    const awa = Math.acos(THREE.MathUtils.clamp(-(awx * hx + awz * hz) / aws, -1, 1));    // 0 = vento in prua, π = in poppa
    const side = (awx * -hz + awz * hx) > 0 ? 1 : -1;            // da che lato soffia: la vela va sottovento
    sailState.trim = THREE.MathUtils.clamp(sailState.trim + (fz < 0 ? 0.35 : fz > 0 ? -0.35 : 0) * dt, 0, 1);
    const want = THREE.MathUtils.clamp((awa - 0.35) * 0.62, 0.08, 1.45); // angolo giusto del boma
    let boom = Math.min(sailState.trim * 1.45, awa * 0.95);       // la vela non va oltre il vento
    sailState.boom += (boom - sailState.boom) * Math.min(1, dt * 1.5);
    const err = sailState.boom - want;
    let drive = awa < 0.62 ? 0 : 1;                                // controvento: niente spinta
    let state = ws < 2 ? 'non c\'è vento: la vela pende (serve vento, G)' : awa < 0.62 ? 'controvento: la vela sbatte, poggia (A o D)' : storm > 0.5 ? 'tempesta: tieni la barca, lasca nelle raffiche' : 'vela a segno';
    if (drive && err > 0.14) { drive *= Math.max(0.1, 1 - (err - 0.14) * 2.5); state = 'la vela sbatte: cazza (W)'; }
    else if (drive && err < -0.16) { drive *= Math.max(0.35, 1 + (err + 0.16) * 2); state = 'troppo cazzata: lasca (S)'; }
    sailState.luff += ((awa < 0.62 || err > 0.14 ? 1 : 0) - sailState.luff) * Math.min(1, dt * 3);
    sailState.fill = drive * Math.min(1, ws / 6);
    const polar = awa < 0.62 ? 0 : awa < 1.1 ? 0.55 + (awa - 0.62) / 0.48 * 0.4 : awa < 2.3 ? 1 : 1 - (awa - 2.3) * 0.25;
    const target = ws * (1.35 + 0.35 * storm) * polar * drive;
    sailState.v += (target - sailState.v) * Math.min(1, dt * (target > sailState.v ? 0.55 : 0.35));
    // il timone morde di più quando la barca ha abbrivio
    sailState.rud = (sailState.rud || 0) + (fx - (sailState.rud || 0)) * Math.min(1, dt * 4);
    sailState.yaw -= sailState.rud * (0.3 + 0.06 * Math.min(sailState.v, 8)) * dt;
    // tempesta: raffiche che strappano il timone e fanno orzare
    if (storm > 0.3) { sailState.gust = (sailState.gust || 0) * 0.99 + (Math.random() - 0.5) * storm * 0.03; sailState.yaw += (sailState.gust * 1.5 + side * 0.07 * storm * Math.min(1, sailState.v / 4)) * dt; if (Math.abs(sailState.heel || 0) > 0.34) { sailState.yaw += side * 0.1 * dt; sailState.v *= 1 - dt * 0.2; } }
    const nx = S.g.position.x + hx * sailState.v * dt, nz = S.g.position.z + hz * sailState.v * dt;
    // ostacoli: fondale basso, pali, piloni, rovina, piattaforma. La barca si ferma, non rimbalza
    let blocked = heightAt(nx, nz) > lvl - 2.2 || exploreHeight(explore, nx, nz, 99) > lvl - 1;
    if (!blocked) for (const c of phys.statics) { if (c.top < lvl - 1 || c.bottom > lvl + 3 || Math.abs(c.x - nx) > 30 || Math.abs(c.z - nz) > 30) continue; if (Math.hypot(nx - c.x, nz - c.z) < c.r + 2.2) { blocked = true; break; } }
    if (!blocked) { S.g.position.x = nx; S.g.position.z = nz; }
    else { if (sailState.v > 2.5 && !sailState.bumped) { sound.splash('dive', 0.6); camDip = 0.15; showMsg('Urti. Poggia, allontanati col timone.', 3); } sailState.bumped = true; sailState.v *= 0.3; }
    if (!blocked) sailState.bumped = false;
    sailState.sideS = (sailState.sideS ?? side) + (side - (sailState.sideS ?? side)) * Math.min(1, dt * 1.2);
    const heelT = -sailState.sideS * Math.sin(awa) * drive * Math.min(1, ws / 7) * (0.1 + 0.28 * wind.strength.value) * (1 - sailState.trim * 0.4);
    sailState.heel = (sailState.heel || 0) + (heelT - (sailState.heel || 0)) * Math.min(1, dt * 1.2);
    const heel = sailState.heel;
    rideWaves(S.g, sailState.yaw, heel, elapsed);
    // la vela e i nastrini
    const R = S.rig;
    if (R) {
      const fl = sailState.luff * Math.sin(elapsed * 17) * 0.12;
      const sd = sailState.sideS;
      R.boomG.rotation.y = sd * (sailState.boom + fl);
      // la vela si gonfia quanto il vento la prende; sbatte se è lascata troppo
      R.main.scale.z = (sd >= 0 ? 1 : -1) * (0.15 + 0.95 * (sailState.fill || 0) + fl * 2.5);
      const ax = new THREE.Vector3(4.2, 12.7, 0).normalize();
      R.jibG.quaternion.setFromAxisAngle(ax, sd * (sailState.boom * 0.75 + fl));
      R.jib.scale.z = -(sd >= 0 ? 1 : -1) * (0.15 + 0.95 * (sailState.fill || 0) + fl * 2);
      const loc = Math.atan2(awz, awx) + S.g.rotation.y; // direzione del vento apparente nel riferimento della barca
      if (R.wheelG) R.wheelG.rotation.x = -(sailState.rud || 0) * 1.6;
      if (R.flagG) { R.flagG.rotation.y = -loc; const fa = R.flag.geometry.attributes.position; if (!R.flag.userData.b) R.flag.userData.b = fa.array.slice(); const b0 = R.flag.userData.b; for (let k = 0; k < fa.count; k++) { const x = b0[k * 3]; fa.setZ(k, Math.sin(x * 14 - elapsed * (9 + 12 * wind.strength.value)) * 0.05 * x * 2); fa.setY(k, b0[k * 3 + 1] - x * 0.25 * (1 - wind.strength.value)); } fa.needsUpdate = true; }
      for (const rb of R.ribbons) {
        rb.rotation.set(0, -loc, 0);
        const pa = rb.geometry.attributes.position, b0 = rb.userData.base;
        for (let k = 0; k < pa.count; k++) { const x = b0[k * 3]; pa.setY(k, b0[k * 3 + 1] - x * 0.08 * (1 - wind.strength.value)); pa.setZ(k, Math.sin(x * 9 - elapsed * (8 + 10 * wind.strength.value)) * 0.05 * x); }
        pa.needsUpdate = true;
      }
    }
    if (!actPrompt) { promptEl.textContent = state + ' · velocità ' + (sailState.v * 1.94).toFixed(1) + ' nodi'; promptEl.classList.add('on'); }
    tmp.set(3.4, 2.3, 0).applyEuler(S.g.rotation).add(S.g.position);
    player.pos.set(tmp.x, tmp.y - 1.6, tmp.z);
    let dy = sailState.yaw - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); player.yaw += dy * Math.min(1, dt * 1.5);
    player.vel.set(hx * sailState.v, 0, hz * sailState.v);
    player.boatRoll = heel;
    eyeH = 1.6;
    if (sailState.v > 1.5 && Math.random() < dt * 3) spawnRipple(W, S.g.position.x, S.g.position.z, night > 0.5);
    // a prua l'acqua si apre in spruzzi, di più con la velocità e il mare formato
    if (sailState.v > 2.5 && Math.random() < dt * (2 + sailState.v * 0.8)) { const bx = S.g.position.x + hx * 5.8, bz = S.g.position.z + hz * 5.8; crestSpray.burst(new THREE.Vector3(bx + (Math.random() - 0.5) * 1.2, lvl + swellAt(bx, bz, elapsed) + 0.2, bz), 6 + (sailState.v * 1.5 | 0), 1 + sailState.v * 0.18 + waterUniforms.uWindK.value); }
    { const T = waterUniforms.uTrail.value; if (sailState.v > 1 && Math.random() < dt * 4) T[trailI++ % T.length].set(S.g.position.x - hx * 5, S.g.position.z - hz * 5, elapsed, 0.6); }
    // pioggia sulla coperta
    if (wx.rain > 0.5 && Math.random() < dt * 25) waterSpray.burst(new THREE.Vector3(S.g.position.x + (Math.random() - 0.5) * 6, S.g.position.y + 1.3, S.g.position.z + (Math.random() - 0.5) * 2.5), 2, 0.6);
  } else if (M === 'boat') {
    const B = craft.boat;
    driveBoat(B, dt, { fx, fz, run }, { water: lvl, time: elapsed });
    B.g.position.y += swellAt(B.g.position.x, B.g.position.z, elapsed) * 0.9;
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
  // sott'acqua rispetto alla superficie vera, che col mare grosso sale e scende
  under = camera.position.y < lvl + swellAt(camera.position.x, camera.position.z, elapsed) - 0.03;

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
    if (player.mode === 'cloud' && isleQ === 0 && active >= places.traces.length) {
      isleQ = 1;
      setTimeout(() => { msgEl.classList.add('thought'); showMsg('Lontano, al largo, c\'è un\'isola secca che aspetta la pioggia. Portaci la nuvola, poi piovi (Q).', 7); setTimeout(() => msgEl.classList.remove('thought'), 7000); discZone = { x: ISLAND.x, z: ISLAND.z, r: 110 }; }, 5000);
    }
    const overIsle = Math.hypot(player.pos.x - ISLAND.x, player.pos.z - ISLAND.z) < ISLAND.r * 1.15;
    const bl = updateIsland(island, { dt, raining: (player.mode === 'rain' || (player.mode === 'wind' && cloudBias > 0.35)) && overIsle, wind: wind.dir, time: elapsed });
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
  let windK = updateWind(elapsed);
  {
    const W8 = weatherI >= 0 ? WEATHER[weatherI] : null, a = Math.min(1, dt * 0.6);
    wx.k += ((W8 ? 1 : 0) - wx.k) * a;
    if (W8) for (const k of ['cloud', 'sea', 'wind', 'rain', 'dark']) wx[k] += (W8[k] - wx[k]) * a;
    else { wx.rain += (0 - wx.rain) * a; wx.dark += (0 - wx.dark) * a; }
    if (wx.k > 0.01 && windI < 0) { wind.strength.value += (wx.wind - wind.strength.value) * wx.k; windK = wind.strength.value; }
    windOv += ((windI >= 0 ? 1 : 0) - windOv) * Math.min(1, dt * 0.6);
    if (windOv > 0.01) { wind.strength.value += ((windI >= 0 ? WIND[windI].w : wind.strength.value) - wind.strength.value) * windOv; windK = wind.strength.value; }
    islandUniforms.uWindS.value = windK;
    islandUniforms.uWindS.value = windK;
    // tempesta: lampi e tuoni ogni tanto
    if (wx.rain > 0.7 && elapsed - lastThunder > 9 + Math.random() * 14) { lastThunder = elapsed; illum = Math.max(illum, 0.9); setTimeout(() => sound._sample && sound._sample('thunder', (Math.random() - 0.5) * 1.2, 60 + Math.random() * 80, 1.4), 600 + Math.random() * 1800); }
  }
  drift.update(dt, player.pos, windK);
  sound.wind(player.mode === 'wind' ? 1 : player.mode === 'petal' ? Math.max(windK, 0.55) : player.mode === 'cloud' ? Math.max(windK, 0.75) : player.mode === 'gull' ? Math.max(windK, Math.min(1, 0.3 + (player.gs || 0) / 25)) : player.mode === 'tree' ? Math.min(1, windK + 0.3) : windK);
  // stato del mare: cambia lento nel corso del giorno, da calma piatta a mare mosso; il vento lo aiuta
  // il mare segue il tempo: cielo coperto e vento forte → mare grosso; sereno e brezza → calma piatta
  const seaState = THREE.MathUtils.clamp(0.08 + 1.1 * Math.max(0, skyUniforms.uCloud.value - 0.15) + 0.45 * (windK - 0.3) + 0.12 * Math.sin(elapsed * 0.009 + 1.3), 0, 1);
  if (lastSea < 0) lastSea = seaState;
  if (!Q.has('sea') && weatherI < 0 && Math.abs(seaState - lastSea) > 0.25) { lastSea = seaState; if (started && !under && performance.now() > storyBusy) { msgEl.classList.remove('thought'); showMsg(seaState > 0.6 ? 'Il cielo si chiude e il vento rinforza: il mare si alza, le onde arrivano lunghe e forti.' : 'Le nuvole si aprono, il vento cala: il mare si calma e torna liscio.', 4); } }
  waterUniforms.uWindK.value = Q.has('sea') ? num('sea', 0.5) : seaState + (wx.sea - seaState) * wx.k;
  // il vento scelto comanda il mare: senza vento è liscio, con l'uragano è enorme (la tempesta lo alza ancora)
  if (windOv > 0.01) waterUniforms.uWindK.value += (Math.min(1, 0.04 + 0.96 * Math.pow(windK, 1.1) + 0.15 * wx.rain) - waterUniforms.uWindK.value) * windOv;
  waterUniforms.uStorm.value = THREE.MathUtils.clamp(wx.dark * 1.6, 0, 1); waterUniforms.uRain.value = wx.rain;
  post.uniforms.uStorm.value = waterUniforms.uStorm.value;
  { // l'onda enorme che arriva a riva: sale lontano, sommerge, si ritira
    const ft = elapsed - floodT, F = 58;
    waterUniforms.uFloodF.value = ft < 0 || ft > 18 ? 0 : ft < 3.5 ? F * THREE.MathUtils.smoothstep(ft, 0, 3.5) : ft < 6 ? F : F * (1 - THREE.MathUtils.smoothstep(ft, 6, 18));
  } waterUniforms.uWindDir.value.copy(wind.dir);
    updateSea(sea, dt, elapsed, { player: player.pos, water: lvl, friend: player.mode === 'fish', lead: fishLead && FRAGMENTS[active] && FRAGMENTS[active].act === 'friends' ? (fishWay || places.traces[active].pos) : null });
  { const sp = sea.sup.g.position; if (heightAt(sp.x, sp.z) < lvl - 1) sp.y += swellAt(sp.x, sp.z, elapsed) * 0.9; }
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
    for (const v of waterUniforms.uSwells.value) if (elapsed - v.z < 40) { rx += v.x; rz += v.y + (elapsed - v.z) * 7; rn++; }
    if (rn) RB.set(rx / rn, rz / rn, 220); else RB.set(0, 0, -1);
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
    splash: (p) => { spawnRipple(W, p.x, p.z, night > 0.5); const dd = p.distanceTo(camera.position); if (dd < 80) sound.splash('stroke', 0.6 * 10 / (dd + 10)); },
    onMeteor: () => { if (!seenMeteor) { seenMeteor = true; onDiscover('stella'); } },
    onDiscover,
  });
  updateCraft(craft, dt, elapsed, { player: player.pos, camera: camera.position, water: lvl, fog: pal.fog * 2.2, hor: pal.hor });
  for (const S of craft.ships) {
    if (S.manual) { if (player.mode !== 'sail') rideWaves(S.g, sailState.yaw, 0, elapsed); }
    else { const h = swellAt(S.g.position.x, S.g.position.z, elapsed); S.g.position.y += h * 0.9; const rk = (S.kind === 'ferry' ? 0.012 : 0.05) * waterUniforms.uWindK.value * (1 + waterUniforms.uStorm.value); S.g.rotation.z = (S.kind === 'sail' ? S.g.rotation.z : 0) + Math.sin(elapsed * 0.7) * rk; S.g.rotation.x = Math.sin(elapsed * 0.53 + 1) * rk * 0.6; }
  }
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
    else if (formOptions() && !actPrompt) { const fo = formOptions(); promptEl.textContent = (isTouch ? 'FORMA · ' : 'Q · ') + 'diventa ' + (FORM_NAME[fo] || (FORM_TEXT[fo] && FORM_TEXT[fo].name) || fo).toLowerCase(); promptEl.classList.add('on'); }
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
  if (player.mode !== 'wind') cloudBias *= Math.pow(0.97, dt);
  U.uCloud.value = Q.has('clouds') ? num('clouds', 0.4) : THREE.MathUtils.clamp(0.18 + 0.42 * slow + 0.2 * Math.max(0, Math.sin(elapsed * 0.0031 + 2.2)) + cloudBias, 0.0, 0.95);
  U.uCloud.value += (wx.cloud - U.uCloud.value) * wx.k;
  // cielo di tempesta: tutto più grigio e più buio
  if (wx.dark > 0.01) { const gk = Math.min(1, wx.dark * 1.6); for (const c of [U.uZen.value, U.uMid.value, U.uHor.value, U.uSea.value]) { const l = Math.max((c.r + c.g + c.b) / 3, 0.06 * night); c.lerp(tmpC.setRGB(l * 0.96, l, l * 1.06), gk * 0.85).multiplyScalar(1 - wx.dark * 0.3 * (1 - night * 0.6)); } U.uSunVis.value *= 1 - wx.dark * 0.6; }
  U.uCirrus.value = 0.35 + 0.35 * Math.sin(elapsed * 0.009 + 1);
  const alto = Q.has('alto') ? num('alto', 1) : THREE.MathUtils.clamp(Math.sin(elapsed * 0.0045 + 2.2) * 1.4 - 0.5, 0, 1);
  U.uAlto.value = alto;
  const mist = THREE.MathUtils.clamp(0.75 * Math.exp(-(((todN - 0.26) / 0.06) ** 2)) + 0.25 * night + 0.12 * (0.5 + 0.5 * Math.sin(elapsed * 0.02)), 0, 1);
  U.uMist.value = mist;

  // da molto in alto l'aria è più limpida: si vede il mondo sotto
  const altFog = 1 / (1 + Math.max(0, camera.position.y - 25) / 70);
  sun.color.copy(pal.sun); sun.intensity = pal.sunI * (1 - alto * 0.55) * (1 - 0.45 * wx.dark * (1 - night * 0.7));
  // ogni tanto il sole passa dietro una nuvola: la luce cala e torna, e quando esce i raggi si accendono
  {
    const cov = U.uCloud.value;
    const n = 0.5 + 0.5 * Math.sin(elapsed * 0.071) * Math.sin(elapsed * 0.029 + 1.3) + 0.25 * Math.sin(elapsed * 0.19 + 2);
    const behind = THREE.MathUtils.smoothstep(n, 0.55 - cov * 0.5, 0.75 - cov * 0.4) * Math.min(1, cov * 2.2);
    sunShade += (behind - sunShade) * Math.min(1, dt * 0.8);
    sun.intensity *= 1 - 0.65 * sunShade;
    U.uSunVis.value *= 1 - 0.7 * sunShade;
  }
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
  scene.fog.color.copy(pal.hor); scene.fog.density = pal.fog * 2.2 * (1 + mist * 1.2) * altFog * ({ ant: 9, cat: 1.6, fish: 1.3, wind: 0.6, cloud: 0.6, gull: 0.8 }[curForm()] || 1);
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
  // tempesta di notte: la luna dietro le nuvole dà il minimo per leggere le sagome di onde, riva e colline
  if (night > 0.3 && wx.dark > 0.05) {
    const k = night * Math.min(1, wx.dark * 1.6);
    hemi.intensity = Math.max(hemi.intensity, 0.55 * k); hemi.color.lerp(tmpC.setRGB(0.55, 0.62, 0.78), k * 0.6); hemi.groundColor.lerp(tmpC.setRGB(0.12, 0.13, 0.15), k);
    sun.intensity = Math.max(sun.intensity, 0.45 * k); sun.color.lerp(tmpC.setRGB(0.7, 0.78, 0.95), k);
    if (!under) { const f = scene.fog.color; f.setRGB(Math.max(f.r, 0.045 * k), Math.max(f.g, 0.05 * k), Math.max(f.b, 0.065 * k)); scene.fog.density *= 1 - 0.4 * k; }
  }
  if (under !== lastUnder) {
    lastUnder = under; sound.setUnder(under ? 1 : 0);
    if (!under) { // riemergi: uno spruzzo vero attorno a te, che ricade; niente gocce sull'obiettivo
      const lv = waterUniforms.uLevel.value;
      waterSpray.burst(new THREE.Vector3(camera.position.x, lv + 0.05, camera.position.z), 90, 2.8);
      setTimeout(() => waterSpray.burst(new THREE.Vector3(camera.position.x, lv + 0.05, camera.position.z), 40, 1.6), 120);
      sound.splash('stroke', 0.9); spawnRipple(W, camera.position.x, camera.position.z, night > 0.5);
    }
    else waterSpray.burst(new THREE.Vector3(camera.position.x, waterUniforms.uLevel.value + 0.05, camera.position.z), 25, 1.6);
  }
  drops = 0;
  wings.visible = false; // niente ali in prima persona: solo l'ombra sul mare e sulla terra
  waterSpray.update(dt); crestSpray.update(dt);
  document.getElementById('bodyBtn').classList.add('hidden');

  waterUniforms.uCam.value.copy(camera.position);
  waterUniforms.uLightDir.value.copy(lightDir);
  waterUniforms.uLightCol.value.copy(pal.sun).multiplyScalar(pal.sunI * 0.5);
  waterUniforms.uAmb.value.copy(pal.hs).multiplyScalar(pal.hI * 0.75).add(tmpC.copy(pal.sun).multiplyScalar(pal.sunI * Math.max(sunDir.y, 0) * 0.18));
  if (night > 0.3 && wx.dark > 0.05) { const k = night * Math.min(1, wx.dark * 1.6), A = waterUniforms.uAmb.value; A.setRGB(Math.max(A.r, 0.1 * k), Math.max(A.g, 0.12 * k), Math.max(A.b, 0.16 * k)); }
  waterUniforms.uFog.value = pal.fog * altFog;
  water.position.set(Math.round(player.pos.x / 4) * 4, 0, Math.round(player.pos.z / 4) * 4);
  sky.position.copy(camera.position);

  updateWorld(W, dt, elapsed, {
    player: player.pos, yaw: player.yaw, night, pal, nextHor: nextPal.hor, onMeet,
  });
  updateWisp(dt);
  illum = Math.max(0, illum - dt * 0.25);
  updatePlaces(places, dt, elapsed, { active, wind: windK, night, player: player.pos, eye: camera.position, tod: todN, underwater: under, onFind, windDir: wind.dir, locked: false, allow: (t) => canPick(t),
    reach: ['gull', 'cloud', 'rain', 'wave', 'glide'].includes(player.mode) ? 9 : FORMS.includes(player.mode) || player.mode === 'flow' ? 5 : 3.2,
    vtol: player.mode === 'cloud' ? 400 : ['gull', 'rain', 'glide'].includes(player.mode) ? 14 : ['fish', 'flow', 'wave', 'dive', 'swim'].includes(player.mode) ? 10 : 3.5 });
  updateSkyline(skyline, camera.position, pal, sunDir, U.uSunVis.value);

  {
    // la risacca suona a tempo con le onde che vedi (stessa fase dello shader)
    const px = player.pos.x;
    const jit = vn2(px * 0.018, 3.0) * 2.2 + vn2(px * 0.005, 7.0) * 3.5;
    const om = Math.PI * 2 / 7.5;
    const lobe = vn2(px * 0.075, 1.3) * 1.1 + vn2(px * 0.21, 4.1) * 0.35;
    const surfU = (((om * elapsed + jit + lobe) / (Math.PI * 2)) % 1 + 1) % 1;
    const surfSet = (0.55 + 0.45 * Math.sin(elapsed * 0.11 + px * 0.0025) * Math.sin(elapsed * 0.047 + 1)) * (0.25 + 1.5 * waterUniforms.uWindK.value);
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
      form: FORMS.includes(player.mode) || player.mode === 'flow' ? player.mode : '', cat: player.cat && player.mode === 'walk', raining: cloudBias > 0.35 || wx.rain > 0.5,
      formSpeed: player.mode === 'flow' || player.mode === 'fish' ? Math.max(hs, player.fv || 0) : player.mode === 'wave' ? 9 * Math.min(1.4, (player.wsize || 1) * 0.6) : hs,
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
    const tg = t && started && !t.found ? stepTarget() : null;
    let op = 0;
    if (tg) { const d = Math.hypot(tg.x - camera.position.x, tg.z - camera.position.z); op = THREE.MathUtils.smoothstep(d, 4, 22) * (0.7 + 0.3 * night); }
    signalOp += (op - signalOp) * Math.min(1, dt * 1.5);
    if (tg) signal.update(tg, signalOp, elapsed, renderer.domElement.height, (tg.y ?? 0) - 0.03); else signal.update({ x: 0, y: 0, z: 0 }, 0, elapsed, 1, 0);
  }
  burst.update(dt, wind.dir);
  flocks.update(dt, elapsed, camera.position, night, tmpC.copy(pal.hor).multiplyScalar(0.18));
  {
    cLit.copy(pal.sun).multiplyScalar(0.55 * (1 - night * 0.85)).add(tmpC.copy(pal.hor).multiplyScalar(0.6)).multiplyScalar(1 - wx.dark * 0.55);
    cShade.copy(pal.hor).lerp(pal.zen, 0.4).multiplyScalar(0.62 * (1 - wx.dark * 0.5));
    cloudLayer.mesh.visible = !under; for (const F of flocks.flocks) if (under) F.im.visible = false;
    layerRain = cloudLayer.update({ dt, time: elapsed, wind: wind.dir, strength: wind.strength.value, cam: camera.position, player: player.pos, mode: player.mode, gather: player.mode === 'wind' ? (upK || jump ? 1 : downK ? -1 : 0) : 0, lit: cLit, shade: cShade, cover: skyUniforms.uCloud.value, storm: waterUniforms.uStorm.value });
  }
  crest.visible = false;
  {
    const on = player.mode === 'gull';
    gullShadow.visible = on;
    if (on) {
      const sd = sunDir.y > 0.08 ? sunDir : null;
      const surf = Math.max(groundAt(player.pos.x, player.pos.z, player.pos.y), waterUniforms.uLevel.value);
      const alt = Math.max(0, player.pos.y - surf);
      const ox = sd ? -sd.x / sd.y * alt : 0, oz = sd ? -sd.z / sd.y * alt : 0;
      gullShadow.position.set(player.pos.x + ox, surf + 0.04, player.pos.z + oz);
      gullShadow.rotation.set(-Math.PI / 2, 0, player.yaw);
      gullShadow.scale.setScalar(1 + alt * 0.012);
      const U2 = gullShadow.material.uniforms;
      U2.uOp.value = (sd ? 0.55 : 0.15) * Math.exp(-alt / 60) * (1 - wx.dark * 0.8);
      U2.uBlur.value = 0.01 + alt * 0.0025;
      U2.uFlap.value = player.landed ? 0.9 : 0.5 + 0.5 * Math.sin(player.flap || 0);
    }
  }
  if (crest.visible) {
    const ws = player.wsize || 1;
    // attaccata allo sguardo: la cresta è sotto e davanti a te, sale con la tua grandezza
    crest.position.set(0, -0.35 - 0.55 * ws, 0.6);
    crest.rotation.set(-player.pitch * 0.85, 0, 0);
    crest.scale.set(0.45 + 0.35 * ws, 0.25 + 0.5 * ws, 0.35 + 0.15 * ws);
  }
  if (running) checkAct(jump, downK, night, dt);
  ants.update(dt, elapsed);
  if (player.mode !== 'ant') ants.held.visible = false; else if (player.carry) ants.held.visible = true;
  { const nr = player.mode === 'ant' ? 0.004 : 0.1; if (camera.near !== nr) { camera.near = nr; camera.updateProjectionMatrix(); } }
  {
    const pi = fpath.update(dt, elapsed, player.mode === 'walk' || player.mode === 'swim' ? player.pos : camera.position, true);
    if (pi >= 0) {
      const c = fpath.cps[pi];
      burst.burst(new THREE.Vector3(c.x, c.y, c.z), 50); sound.chime(2 + pi);
      if (player.mode === 'gull') player.gs = (player.gs || 11) + 5;
      if (player.mode === 'fish') player.fv = (player.fv || 0) + 3;
      if (player.mode === 'wave') player.ws = Math.min(9, (player.ws || 4) + 2);
      
    }
  }
  if ((pileTick = (pileTick + 1) % 4) === 0) updatePiles();
  // tempesta: le creste si rompono e il vento ne strappa lo spruzzo
  if ((waterUniforms.uStorm.value > 0.3 || waterUniforms.uWindK.value > 0.6) && !under) {
    const st = Math.max(waterUniforms.uStorm.value, (waterUniforms.uWindK.value - 0.5) * 1.6);
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * 6.28, r = 8 + Math.random() * 45;
      const x = camera.position.x + Math.cos(a) * r, z = camera.position.z + Math.sin(a) * r;
      if (heightAt(x, z) > waterUniforms.uLevel.value - 1.5) continue;
      const h = swellAt(x, z, elapsed), hb = swellAt(x - wind.dir.x * 2, z - wind.dir.y * 2, elapsed);
      if (h > 0.5 * st && h > hb && Math.random() < st * 0.7) { crestSpray.burst(new THREE.Vector3(x, waterUniforms.uLevel.value + h + 0.2, z), 22, 2.2 + st * 2.5); }
    }
  }
  // il binocolo: per un attimo lo sguardo si avvicina a ciò che vede (applicato col campo visivo della forma)
  if (zoomPulse > 0) zoomPulse = Math.max(0, zoomPulse - dt / 5);
  motes.update(dt, elapsed, camera.position, under ? 'snow' : player.mode === 'rain' || cloudBias > 0.35 || wx.rain > 0.5 || layerRain > 0.6 ? 'rain' : player.mode === 'light' ? 'light' : '', underDeep, wind.dir, renderer.domElement.height);
  // mappa
  minimap.draw({
    player: player.pos, yaw: player.yaw, foce: FOCE, island: ISLAND, bloom: island.bloom,
    next: active < places.traces.length ? { x: stepTarget().x, z: stepTarget().z } : (zone && active >= places.traces.length ? zone : null),
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
  P.uExposure.value = pal.exp * (1 - 0.05 * wx.dark * (1 - night)) * (1 + 0.45 * wx.dark * night);
  P.uGrade.value.copy(pal.grade).lerp(tmpV3.set(0.97, 1.0, 1.04), Math.min(1, wx.dark * 1.6));
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
  {
    // ogni forma vede a modo suo: colore, campo visivo
    const LOOK = { cloud: [1.03, 1.03, 1.05, 0.14, 68], gull: [1.03, 1.03, 1.05, 0.22, 84], tree: [1.04, 1.06, 0.92, 0.35, 74], sand: [1.12, 1.0, 0.84, 0.38, 78], fish: [0.86, 1.04, 1.1, 0.3, 82], wave: [0.92, 1.04, 1.1, 0.3, 80], rain: [0.9, 0.95, 1.03, 0.32, 74], cat: [0.94, 0.97, 0.99, 0.4, 90], wind: [0.96, 0.99, 1.02, 0.3, 86], petal: [1.08, 1.0, 1.04, 0.3, 76], light: [1.08, 1.04, 0.96, 0.3, 72], ant: [1.06, 1.0, 0.88, 0.35, 96] };
    const L = LOOK[curForm()] || [1, 1, 1, 0, 72];
    const U4 = P.uForm.value; U4.x += (L[0] - U4.x) * Math.min(1, dt * 1.2); U4.y += (L[1] - U4.y) * Math.min(1, dt * 1.2); U4.z += (L[2] - U4.z) * Math.min(1, dt * 1.2); U4.w += (L[3] - U4.w) * Math.min(1, dt * 1.2);
    baseFov += (L[4] - baseFov) * Math.min(1, dt * 1.2);
    const zf = zoomPulse > 0 ? 1 - 0.55 * Math.sin(Math.PI * (1 - zoomPulse)) : 1;
    const fv = baseFov * zf;
    if (Math.abs(camera.fov - fv) > 0.01) { camera.fov = fv; camera.updateProjectionMatrix(); }
    const lbl = formLabel();
    if (lbl !== formLblTxt) { formLblTxt = lbl; formLblEl.textContent = lbl ? 'sei · ' + lbl : ''; formLblEl.classList.toggle('on', !!lbl && started); }
  }
  P.uUnderCol.value.copy(underDeep);
  P.uBreath.value = player.mode === 'dive' ? THREE.MathUtils.smoothstep(0.4 - player.breath, 0, 0.4) : 0;
  fade += (fadeTarget - fade) * Math.min(1, dt * 1.1);
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
roundLights(scene);
places.traces.forEach((t) => { t.sp.visible = false; });
window.__riva = { get fishWay() { return fishWay; }, applyFormT: (f) => applyForm(f), sailState, wind, swellAt, wx, crest, ants, camera, get active() { return active; }, FRAGMENTS, curForm, get cloudBias() { return cloudBias; }, get acts() { return [...acts]; }, fpath, island, get isleQ() { return isleQ; }, motes, explore, get flowUnlocked() { return flowUnlocked; }, sound, get trailT() { return trailT; }, get el() { return elapsed; }, waterUniforms, wrack, flora, craft, player, scene, water, renderer, W, journal, footprints, places, sea, findAll: () => places.traces.forEach((t) => t.pos.copy(camera.position)), setGear: () => { hasGear = true; }, setTime: (t) => { tod = t; } };
