import * as THREE from 'three';
import { SHORE_GLSL } from './terrain.js';

// Uniform condivise fra cielo, acqua e sabbia
export const skyUniforms = {
  uZen: { value: new THREE.Color() },
  uMid: { value: new THREE.Color() },
  uHor: { value: new THREE.Color() },
  uSea: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uMoonDir: { value: new THREE.Vector3(0.3, 0.6, -0.75).normalize() },
  uSunCol: { value: new THREE.Color() },
  uSunVis: { value: 1 },
  uNight: { value: 0 },
  uTime: { value: 0 },
  uCamPos: { value: new THREE.Vector3() },
  uCloud: { value: 0.35 },
  uCirrus: { value: 0.5 },
  uMist: { value: 0 },
  uAlto: { value: 0 },
};

// rumore + nuvole ancorate al mondo (così le ombre a terra coincidono con quelle in cielo)
export const NOISE_GLSL = /* glsl */`
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
`;

export const CLOUD_GLSL = /* glsl */`
uniform vec3 uCamPos;
uniform float uCloud, uCirrus, uMist, uAlto;
const float CLOUD_H = 900.0;
float cloudFbm(vec2 p, int oct){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * vn(p); p = p * 2.07 + vec2(13.1, 7.7); a *= 0.5; }
  return s;
}
float cloudAt(vec2 xz, int oct){
  vec2 p = xz / CLOUD_H * 1.1 + vec2(uTime * 0.006, uTime * 0.0025);
  float n = cloudFbm(p, oct);
  float lo = 0.7 - uCloud * 0.3;
  return smoothstep(lo, lo + 0.26, n);
}
float cloudShadow(vec3 wp, vec3 L){
  if (L.y < 0.04) return 1.0;
  vec2 xz = wp.xz + L.xz / L.y * (CLOUD_H - wp.y);
  return 1.0 - cloudAt(xz, 3) * 0.6;
}
`;

export const SURF_GLSL = /* glsl */`
// ---- risacca: onde che si gonfiano, si rompono e risalgono la sabbia
const float SURF_OM = 6.2831853 / 7.5;
float surfJit(float x){ return vn(vec2(x * 0.018, 3.0)) * 2.2 + vn(vec2(x * 0.005, 7.0)) * 3.5; }
// la lama di risacca: a lobi, ogni onda diversa dall'altra, che sale veloce, rallenta, si ferma e si ritira.
// u: fase (0 arrivo); R: fin dove arriva quest'onda qui; adv: 1 mentre avanza
float swash(float x, float t, float windK, out float u, out float R, out float adv){
  float setMod = (0.55 + 0.45 * sin(t * 0.11 + x * 0.0025) * sin(t * 0.047 + 1.0)) * (0.75 + 0.5 * windK);
  float lobe = vn(vec2(x * 0.075, 1.3)) * 1.1 + vn(vec2(x * 0.21, 4.1)) * 0.35;  // i tratti di riva arrivano in tempi diversi
  float ph = (SURF_OM * t + surfJit(x) + lobe) / 6.2831853;
  float n = floor(ph); u = fract(ph);
  // ogni onda ha la sua forza, e cambia lungo la riva
  float k = 0.45 + 0.8 * vn(vec2(x * 0.035 + n * 3.7, n * 1.9));
  R = (0.9 + 4.2 * setMod) * k;
  // orlo frastagliato: lingue d'acqua più lunghe dove la sabbia è più liscia
  R += (vn(vec2(x * 0.55, n * 2.3)) - 0.5) * 0.9 * k + (vn(vec2(x * 1.7, n)) - 0.5) * 0.25;
  float up = 0.34;
  adv = 1.0 - smoothstep(up * 0.8, up, u);
  float f = u < up ? R * (1.0 - pow(1.0 - u / up, 2.2)) : R - (R + 1.2) * pow(smoothstep(up, 1.0, u), 1.4);
  return f;
}
// h: quota dell'acqua; s: fase (0 = cresta); brk: frangimento; bore: schiuma; film: lama sulla sabbia; front: fin dove risale
float surfY(float x, float d, float t, float lvl, float windK, out float s, out float brk, out float bore, out float film, out float front){
  float depth = -baseH(d);
  float setMod = 0.55 + 0.45 * sin(t * 0.11 + x * 0.0025) * sin(t * 0.047 + 1.0);
  setMod *= 0.75 + 0.5 * windK;
  float jit = surfJit(x);
  float ph = SURF_OM * t - d * 0.5 + jit;
  s = fract(ph / 6.2831853);
  float prof = max(pow(1.0 - s, 2.6), pow(smoothstep(0.78, 1.0, s), 1.6));
  float A = setMod * (0.08 + 0.62 * smoothstep(5.5, 1.5, depth)) * smoothstep(0.1, 1.1, depth);
  brk = smoothstep(2.0, 1.25, depth) * smoothstep(0.25, 0.8, depth) * setMod;
  bore = smoothstep(1.4, 0.5, depth) * smoothstep(-0.2, 0.3, depth) * setMod;
  float seaY = lvl + A * (prof - 0.32);
  // risalita: la lama d'acqua sulla sabbia (vedi swash). La mesh copre tutta la fascia
  // che la risacca può raggiungere; il bordo vero lo disegna il frammento, pixel per pixel.
  float u, R, adv;
  front = swash(x, t, windK, u, R, adv);
  film = 0.0;
  if (d < -1.5) return seaY;
  float Rmax = 1.0 + 6.0 * setMod;
  if (d > Rmax) return min(lvl, baseH(d) - 0.25);
  film = 0.02 + 0.06 * smoothstep(front, front - 2.5, d);
  return max(seaY, baseH(d) + film);
}
`;

const SKY_GLSL = /* glsl */`
uniform vec3 uZen, uMid, uHor, uSea, uSunDir, uMoonDir, uSunCol;
uniform float uSunVis, uNight, uTime;
` + NOISE_GLSL + CLOUD_GLSL + /* glsl */`
vec3 skyGrad(vec3 d){
  float y = d.y;
  float h = pow(clamp(y, 0.0, 1.0), 0.5);
  vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.45, h));
  c = mix(c, uZen, smoothstep(0.4, 1.0, h));
  float sd = max(dot(d, uSunDir), 0.0);
  float band = pow(1.0 - clamp(y, 0.0, 1.0), 6.0);
  c += uSunCol * uSunVis * (0.22 * pow(sd, 4.0) * band + 0.22 * pow(sd, 32.0) + 0.6 * pow(sd, 300.0));
  // foschia bassa sull'orizzonte
  c = mix(c, uHor * 1.05, uMist * pow(1.0 - clamp(y * 6.0, 0.0, 1.0), 2.0) * 0.6);
  c = mix(c, uSea, 1.0 - smoothstep(-0.004, 0.0, y));
  return c;
}
// cielo + nuvole; ritorna in .a la copertura (per oscurare sole/stelle)
vec4 skyClouds(vec3 d, vec3 c, int oct){
  if (d.y < 0.008) return vec4(c, 0.0);
  float t = (CLOUD_H - uCamPos.y) / d.y;
  vec2 xz = uCamPos.xz + d.xz * t;
  float dens = cloudAt(xz, oct);
  float fade = smoothstep(0.008, 0.16, d.y);
  float sd = max(dot(d, uSunDir), 0.0);
  float shade = 1.0;
  if (oct > 3) shade = 1.0 - 0.7 * cloudAt(xz + uSunDir.xz * 80.0, 3);
  vec3 amb = mix(uHor, uZen, 0.35) * 0.95 + uMid * 0.1;
  vec3 lit = uSunCol * uSunVis * (0.45 + 0.75 * shade) * (1.0 + pow(sd, 6.0) * 1.8);
  // cumuli: base scura e grigia, sommità luminose
  float thick = smoothstep(0.35, 1.0, dens);
  vec3 cc = amb * (0.62 + 0.38 * shade) * (1.0 - thick * 0.35) + lit * (1.0 - uNight) * 0.55 * (0.55 + 0.45 * shade);
  cc = mix(cc, vec3(0.06, 0.07, 0.1) + amb * 0.6, uNight * 0.8);
  float edgeGlow = (1.0 - dens) * dens * 4.0 * pow(sd, 10.0) * uSunVis;
  cc += uSunCol * edgeGlow * 1.5;
  float a = dens * fade;
  // cirri sottili e stirati
  vec2 cp = xz / CLOUD_H * vec2(0.5, 3.2) + vec2(uTime * 0.004, 0.0);
  float cir = smoothstep(0.55, 0.85, vn(cp) * 0.6 + vn(cp * 2.3 + 4.0) * 0.4) * uCirrus * 0.28 * fade;
  c = mix(c, amb * 1.05 + uSunCol * uSunVis * 0.35 * (1.0 - uNight), cir * (1.0 - a));
  c = mix(c, cc, a * 0.95);
  // cielo a pecorelle: altocumuli fitti che velano il cielo nei giorni coperti
  float alto = 0.0;
  if (uAlto > 0.01) {
    vec2 ap = xz / CLOUD_H * 5.5 + vec2(uTime * 0.01, uTime * 0.004);
    float cell = vn(ap) * 0.6 + vn(ap * 2.6 + 3.0) * 0.4;
    float sheet = vn(xz / CLOUD_H * 0.8 + 9.0);
    alto = smoothstep(0.42, 0.7, cell + (sheet - 0.5) * 0.5) * uAlto * fade;
    vec3 ac = mix(amb * 0.78, amb * 1.12 + uSunCol * uSunVis * 0.25 * (1.0 - uNight), smoothstep(0.55, 0.9, cell));
    c = mix(c, mix(uZen, uHor, 0.55) * 0.85, uAlto * 0.45 * fade);
    c = mix(c, ac, alto * 0.9);
  }
  return vec4(c, max(max(a, cir * 0.5), alto));
}
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
`;

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: SKY_GLSL + /* glsl */`
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = skyGrad(d);
        float above = step(0.0, d.y);
        float sd = dot(d, uSunDir);
        float md = dot(d, uMoonDir);
        vec3 lights = uSunCol * smoothstep(0.99955, 0.9997, sd) * 40.0 * uSunVis * above;
        lights += vec3(0.85, 0.88, 1.0) * smoothstep(0.99975, 0.9999, md) * 2.5 * uNight;
        c += vec3(0.25, 0.3, 0.45) * pow(max(md, 0.0), 120.0) * 0.4 * uNight;
        if (d.y > 0.0) {
          vec3 p = d * 420.0; vec3 id = floor(p); float h = hash13(id);
          vec3 f = fract(p) - 0.5;
          float s = step(0.9984, h) * smoothstep(0.38, 0.0, length(f));
          float tw = 0.55 + 0.45 * sin(uTime * 2.0 + h * 300.0);
          lights += vec3(s * tw * 3.0) * uNight * smoothstep(0.0, 0.25, d.y);
        }
        vec4 cl = skyClouds(d, c, 5);
        c = cl.rgb + lights * (1.0 - cl.a * 0.92);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

export const waterUniforms = {
  uCam: { value: new THREE.Vector3() },
  uLightDir: { value: new THREE.Vector3(0, 1, 0) },
  uLightCol: { value: new THREE.Color() },
  uAmb: { value: new THREE.Color(1, 1, 1) },
  uDeep: { value: new THREE.Color(0x16506a) },
  uShallow: { value: new THREE.Color(0x4fb0a6) },
  uFog: { value: 0.001 },
  uLevel: { value: 0 },
  uMirror: { value: new THREE.Vector3(0, 0, 0) },
  uLamp: { value: new THREE.Vector4(0, 0, 0, 0) },
  uUnderCol: { value: new THREE.Color(0x0e4a58) },
  uWindK: { value: 0.4 },
  uTrail: { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, -100, 0)) },
  uTrailBox: { value: new THREE.Vector3(0, 0, -1) },
  uRingBox: { value: new THREE.Vector3(0, 0, -1) },
  uRings: { value: [new THREE.Vector4(0, 0, -100, 0), new THREE.Vector4(0, 0, -100, 0), new THREE.Vector4(0, 0, -100, 0), new THREE.Vector4(0, 0, -100, 0)] },
  uWindDir: { value: new THREE.Vector2(0.6, -0.8) },
  uUnderFog: { value: 0.06 },
};

export function makeWater() {
  // griglia non uniforme: fitta vicino a te (le onde hanno forma), larga verso l'orizzonte
  const N = 240, Rr = 4000, Aa = 0.02, n = N + 1;
  const offs = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = -1 + (2 * i) / N; offs[i] = Rr * (Aa * u + (1 - Aa) * u * u * u); }
  const pos = new Float32Array(n * n * 3), idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = (j * n + i) * 3; pos[k] = offs[i]; pos[k + 1] = 0; pos[k + 2] = offs[j]; }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...skyUniforms, ...waterUniforms },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uLevel, uTime, uWindK;
      uniform vec4 uRings[4];
      varying vec3 vW; varying vec4 vSurf; varying vec2 vSlope; varying float vFront; varying float vRing; varying float vTrail;
      // scia: ogni punto lasciato da chi si muove manda un'onda circolare lenta;
      // l'inviluppo dei cerchi forma la V, al centro resta la schiuma rimescolata
      uniform vec4 uTrail[24];
      uniform vec3 uTrailBox, uRingBox;
      vec2 trailField(vec2 p){
        float h = 0.0, foam = 0.0;
        for (int i = 0; i < 24; i++) {
          float age = uTime - uTrail[i].z;
          if (age < 0.0 || age > 16.0) continue;
          vec2 dd = p - uTrail[i].xy;
          float r = length(dd);
          if (r > 2.0 + age * 1.8) continue;
          float st = uTrail[i].w;
          float front = age * 1.5;
          float x = (r - front) / (0.45 + age * 0.08);
          h += exp(-x * x) * st * 0.12 * exp(-age * 0.22);
          foam = max(foam, st * exp(-r * r / (0.4 + age * 0.6)) * exp(-age * 0.35));
          foam = max(foam, st * 0.6 * exp(-x * x * 3.0) * exp(-age * 0.45));
        }
        return vec2(h, foam);
      }
      // onde ad anello sollevate quando sei il mare
      float rings(vec2 p, out float crest){
        float h = 0.0; crest = 0.0;
        for (int i = 0; i < 4; i++) {
          float age = uTime - uRings[i].z;
          if (age < 0.0 || age > 14.0) continue;
          float r = length(p - uRings[i].xy);
          float front = age * 7.0;
          float a = uRings[i].w * exp(-age * 0.28) * (1.0 / (1.0 + r * 0.04));
          float x = (r - front) / 2.2;
          float w = exp(-x * x) * a;
          h += w * (1.0 - 0.6 * smoothstep(0.0, 2.0, -x));
          crest = max(crest, w / max(uRings[i].w, 0.01));
        }
        return h;
      }
      ` + NOISE_GLSL + SHORE_GLSL + SURF_GLSL + /* glsl */`
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        float s, brk, bore, film, front, s2, b2, o2, f2, fr2;
        float d = w.z - shoreZ(w.x);
        float y = surfY(w.x, d, uTime, uLevel, uWindK, s, brk, bore, film, front);
        float e = 0.35;
        float yx = surfY(w.x + e, (w.z) - shoreZ(w.x + e), uTime, uLevel, uWindK, s2, b2, o2, f2, fr2);
        float yz = surfY(w.x, d + e, uTime, uLevel, uWindK, s2, b2, o2, f2, fr2);
        float cr = 0.0, c2;
        float rg = 0.0, rgx = 0.0, rgz = 0.0;
        if (length(w.xz - uRingBox.xy) < uRingBox.z) {
          rg = rings(w.xz, cr);
          rgx = rings(w.xz + vec2(e, 0.0), c2); rgz = rings(w.xz + vec2(0.0, e), c2);
        }
        float seaK = smoothstep(0.0, -2.0, d);
        vec2 tf = vec2(0.0);
        if (length(w.xz - uTrailBox.xy) < uTrailBox.z) {
          tf = trailField(w.xz);
          float tfx = trailField(w.xz + vec2(e, 0.0)).x, tfz = trailField(w.xz + vec2(0.0, e)).x;
          rg += tf.x; rgx += tfx; rgz += tfz;
        }
        vTrail = tf.y * seaK;
        vSlope = vec2(yx - y + (rgx - rg) * seaK, yz - y + (rgz - rg) * seaK) / e;
        w.y = y + rg * seaK;
        vRing = cr * seaK;
        vW = w.xyz; vSurf = vec4(s, brk, bore, film); vFront = front - d;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: SKY_GLSL + SHORE_GLSL + SURF_GLSL + /* glsl */`
      uniform vec3 uCam, uLightDir, uLightCol, uAmb, uDeep, uShallow, uMirror;
      uniform vec4 uLamp;
      uniform vec3 uUnderCol;
      uniform float uFog, uUnderFog, uWindK;
      uniform vec2 uWindDir;
      varying vec3 vW; varying vec4 vSurf; varying vec2 vSlope; varying float vFront; varying float vRing; varying float vTrail;
      vec2 wv(vec2 p, vec2 dir, float fr, float amp, float spd){ float ph = dot(p, dir)*fr + uTime*spd; return dir*fr*amp*cos(ph); }
      void main(){
        vec2 p = vW.xz;
        float dist = length(uCam - vW);
        if (!gl_FrontFacing) {
          // vista da sotto: finestra di Snell (il cielo) e riflessione totale attorno
          vec3 Vu = normalize(uCam - vW);
          float up = -Vu.y;
          vec2 q = p * 1.6 + vec2(uTime * 0.4, uTime * 0.25);
          float rip = vn(q) * 0.6 + vn(q * 2.7 - uTime * 0.3) * 0.4;
          float win = smoothstep(0.6, 0.72, up + (rip - 0.5) * 0.08);
          vec3 skyC = mix(uHor, uZen, 0.5) * 1.6 + uSunCol * uSunVis * 0.4;
          vec3 c = mix(uUnderCol * 0.7, skyC, win);
          c += uSunCol * uSunVis * pow(max(dot(-Vu, uSunDir), 0.0), 40.0) * 3.0 * win;
          c += vec3(rip) * 0.05 * win;
          float fu = 1.0 - exp(-dist * uUnderFog);
          gl_FragColor = vec4(mix(c, uUnderCol, fu * 0.85), 1.0);
          return;
        }
        vec2 g = wv(p, normalize(vec2(0.2,1.0)), 0.35, 0.07, 1.1)
               + wv(p, normalize(vec2(-0.6,0.8)), 0.7, 0.04, 1.6)
               + wv(p, normalize(vec2(0.9,0.4)), 1.3, 0.025, 2.2)
               + wv(p, normalize(vec2(-0.3,-1.0)), 2.7, 0.012, 3.1)
               + wv(p, normalize(vec2(0.7,-0.6)), 5.3, 0.006, 4.0);
        vec2 q = p * 2.2 + vec2(uTime * 0.35, uTime * 0.2);
        float e = 0.05;
        g += vec2(vn(q + vec2(e,0)) - vn(q - vec2(e,0)), vn(q + vec2(0,e)) - vn(q - vec2(0,e))) / (2.0*e) * 0.03;
        // pendenza dell'onda vera (dalla geometria)
        g += vSlope * smoothstep(400.0, 60.0, dist);
        // raffiche: chiazze increspate più scure che corrono sull'acqua
        vec2 gp = p * 0.018 - uWindDir * uTime * 0.09;
        float gust = smoothstep(0.45, 0.8, vn(gp) * 0.7 + vn(gp * 2.3 + 7.0) * 0.3) * uWindK;
        vec2 q2 = p * 7.0 + uWindDir * uTime * 1.6;
        g += vec2(vn(q2 + vec2(e,0)) - vn(q2 - vec2(e,0)), vn(q2 + vec2(0,e)) - vn(q2 - vec2(0,e))) / (2.0*e) * (0.008 + gust * 0.05);
        // lo Specchio: acqua perfettamente immobile
        float mir = 0.0;
        if (uMirror.z > 0.0) mir = 1.0 - smoothstep(uMirror.z * 0.75, uMirror.z, length(p - uMirror.xy));
        float s = 1.0 / (1.0 + dist * 0.035) * (1.0 - mir * 0.97);
        vec3 N = normalize(vec3(-g.x * s, 1.0, -g.y * s));
        vec3 V = normalize(uCam - vW);
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        F = mix(F, 0.85, mir);
        vec3 R = reflect(-V, N); R.y = abs(R.y) + 0.002; R = normalize(R);
        vec3 refl = skyClouds(R, skyGrad(R), dist < 400.0 ? 4 : 3).rgb;
        float d = vW.z - shoreZ(vW.x);
        float depth = vW.y - baseH(d);
        float sh = exp(-max(depth, 0.0) * 0.38);
        float cs = mix(1.0, cloudShadow(vW, uLightDir), uSunVis);
        vec3 body = mix(uDeep, uShallow, sh) * uAmb * (0.75 + 0.25 * cs) * (1.0 - gust * 0.25);
        float alpha = mix(0.97, 0.32, sh);
        vec3 col = body * (1.0 - F) + refl * F;
        alpha = clamp(alpha + F, 0.0, 1.0);
        vec3 H = normalize(uLightDir + V);
        float nh = max(dot(N, H), 0.0);
        float spec = (pow(nh, mix(500.0, 30000.0, mir)) * 8.0 + pow(nh, 60.0) * 0.12 * (1.0 - mir)) * cs;
        spec += pow(nh, 4000.0) * 30.0 * (1.0 - uNight) * mir * cs;
        col += uLightCol * spec;
        alpha = max(alpha, min(spec, 1.0));
        // riflesso del lampione
        if (uLamp.w > 0.0) {
          vec2 lp = p - uLamp.xz;
          float streak = exp(-abs(dot(lp, normalize(vec2(V.z, -V.x)))) * 1.6) * exp(-length(lp) * 0.06);
          col += vec3(1.0, 0.72, 0.42) * streak * uLamp.w * 0.8 * (0.6 + 0.4 * vn(p * 3.0 + uTime));
        }
        float edge = 0.12 + 0.08 * sin(uTime * 0.7 + vW.x * 0.03);
        float fn = vn(vW.xz * vec2(0.9, 2.2) + vec2(uTime * 0.25, 0.0));
        float foam = (1.0 - smoothstep(edge * 0.2, edge * 0.7, depth)) * (0.5 + 0.5 * fn) * step(-0.3, depth);
        // schiuma: labbro della cresta che si rompe, bianco dell'onda rotta, merletto, orlo della risacca
        float sP = vSurf.x, brk = vSurf.y, bore = vSurf.z, film = vSurf.w;
        vec2 fl = vW.xz * 1.7 + vec2(0.0, uTime * 0.5);
        float lace = 1.0 - smoothstep(0.0, 0.06, abs(vn(fl) * 0.7 + vn(fl * 2.4 + 5.0) * 0.45 - 0.62));
        float brkUp = smoothstep(0.35, 0.75, vn(vW.xz * vec2(0.8, 2.5) + vec2(uTime * 0.2, -uTime * 0.8)));
        float lip = brk * smoothstep(0.86, 0.985, sP) * (0.55 + 0.45 * brkUp);
        float white = bore * (smoothstep(0.5, 0.0, sP) + smoothstep(0.88, 1.0, sP)) * (0.5 + 0.5 * brkUp);
        float residual = max(brk, bore) * lace * 0.55;
        // risacca pixel per pixel: bordo morbido e a lobi, schiuma di bolle sul fronte che avanza,
        // che si apre in chiazze mentre l'acqua si ritira
        float swU, swR, swA;
        float swF = swash(vW.x, uTime, uWindK, swU, swR, swA);
        float dd = swF - d;
        float bub = vn(p * 7.0 + vec2(0.0, uTime * 0.6)) * 0.55 + vn(p * 17.0 - uTime * 0.4) * 0.45;
        float edgeF = 0.0, filmLace = 0.0, swCut = 1.0;
        if (film > 0.0) {
          swCut = mix(1.0, smoothstep(-0.04, 0.22 + 0.25 * swA, dd), smoothstep(-0.9, -0.1, d));
          float band = exp(-max(dd, 0.0) / (0.25 + 0.5 * swA));
          edgeF = band * mix(0.35, 1.0, swA) * smoothstep(0.25, 0.6, bub + 0.25 * swA);
          // chiazze di schiuma che restano sulla lama e si sfaldano
          float patches = smoothstep(0.5, 0.8, vn(p * 2.2 + vec2(swU * 1.5, 0.0)) * 0.6 + bub * 0.4 + 0.25 * (1.0 - swU));
          filmLace = patches * (1.0 - swU) * 0.7 * smoothstep(0.0, 1.5, dd);
        }
        foam = max(max(lip, white), max(residual, max(edgeF, filmLace)));
        foam = max(foam, smoothstep(0.55, 0.95, vRing) * (0.5 + 0.5 * brkUp));
        // schiuma della scia, sfilacciata
        float tl = 1.0 - smoothstep(0.0, 0.12, abs(vn(vW.xz * 2.2 + uTime * 0.3) - 0.5));
        foam = max(foam, vTrail * (0.45 + 0.55 * max(brkUp, tl)));
        foam = clamp(foam, 0.0, 1.0);
        // l'onda che si alza diventa verde-azzurra e traslucida contro la luce
        float rise = brk * smoothstep(0.7, 0.97, sP);
        col = mix(col, uShallow * uAmb * 1.35 + uLightCol * 0.06, rise * 0.45 * (1.0 - foam));
        // la lama d'acqua sulla sabbia: sottile, trasparente, specchiante
        if (film > 0.0) alpha = min(alpha, (0.22 + 0.5 * smoothstep(0.0, 2.5, dd) + F * 0.6));
        vec3 foamCol = uAmb * 1.2 + uLightCol * 0.1;
        col = mix(col, foamCol, foam * 0.85);
        alpha = max(alpha, foam * 0.9);
        float fg = uFog * (1.0 + uMist * 1.6);
        float f = 1.0 - exp(-pow(dist * fg, 2.0));
        col = mix(col, uSea, f);
        alpha = mix(alpha, 1.0, f);
        alpha *= swCut;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 1;
  return m;
}

// Sabbia: increspature del vento / del fondale, caustiche, ombre delle nuvole
export const causticUniforms = { uCaustic: { value: 1 } };
export function enhanceSand(material) {
  material.onBeforeCompile = (shader) => {
    for (const k of ['uTime', 'uCamPos', 'uCloud', 'uCirrus', 'uMist', 'uSunDir', 'uSunVis', 'uSunCol']) shader.uniforms[k] = skyUniforms[k];
    shader.uniforms.uCaustic = causticUniforms.uCaustic;
    shader.uniforms.uWindK = waterUniforms.uWindK;
    shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );
    shader.fragmentShader = 'varying vec3 vWPos;\nuniform float uTime, uCaustic, uSunVis, uWindK;\nuniform vec3 uSunDir, uSunCol;\n' + NOISE_GLSL + CLOUD_GLSL + SHORE_GLSL + SURF_GLSL + shader.fragmentShader
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
      // la sabbia bagnata segue la risacca: dove l'onda è appena arrivata è scura e lucida, poi asciuga
      float swWet = 0.0;
      {
        float dS0 = vWPos.z - shoreZ(vWPos.x);
        if (dS0 > -1.0 && dS0 < 8.0) {
          float sU, sR, sA;
          float sF = swash(vWPos.x, uTime, uWindK, sU, sR, sA);
          float reached = smoothstep(sR + 0.5, sR - 0.3, dS0);
          swWet = max(smoothstep(sF + 0.3, sF - 0.2, dS0), reached * (1.0 - 0.55 * smoothstep(0.35, 1.0, sU)));
          swWet *= 1.0 - smoothstep(4.5, 7.5, dS0);
          diffuseColor.rgb *= mix(1.0, 0.74, swWet * smoothstep(0.4, 2.2, dS0));
        }
      }
      {
        // colline: erba secca e macchia invece della sabbia
        float dIn = vWPos.z - shoreZ(vWPos.x);
        float kIn = smoothstep(72.0, 88.0, dIn);
        if (kIn > 0.0) {
          float gn = vn(vWPos.xz * 1.9) * 0.4 + vn(vWPos.xz * 0.45) * 0.35 + vn(vWPos.xz * 0.08) * 0.25;
          vec3 base = vColor.rgb * vec3(0.8, 0.68, 0.42) * (0.6 + 0.6 * gn);
          diffuseColor.rgb = mix(diffuseColor.rgb, base, kIn * 0.9);
        }
      }`)
      .replace('#include <normal_fragment_maps>', /* glsl */`#include <normal_fragment_maps>
      {
        float dcam = length(vWPos - cameraPosition);
        float fadeR = 1.0 - smoothstep(4.0, 16.0, dcam) * (1.0 - smoothstep(-0.6, -1.4, vWPos.y)) - smoothstep(30.0, 70.0, dcam) * smoothstep(-0.6, -1.4, vWPos.y);
        if (fadeR > 0.0) {
          vec2 p = vWPos.xz;
          float under = smoothstep(-0.2, -1.2, vWPos.y);
          float w = vn(p * 0.07) * 9.0 + vn(p * 0.23) * 2.6;
          vec2 dir = normalize(mix(vec2(0.45, 1.0), vec2(0.08, 1.0), under));
          float fr = mix(9.0, 1.7, under);
          float amp = mix(0.006, 0.26, under) * (0.55 + 0.45 * vn(p * 0.45 + 3.0));
          float ph = dot(p, dir) * fr + w;
          float sp = sin(ph);
          vec2 gr = dir * fr * amp * cos(ph) * (1.0 + 0.6 * sp);
          gr *= fadeR;
          normal = normalize(normal + (viewMatrix * vec4(-gr.x, 0.0, -gr.y, 0.0)).xyz);
        }
      }`)
      .replace('#include <roughnessmap_fragment>', /* glsl */`#include <roughnessmap_fragment>
      {
        // sabbia bagnata: lucida, specchia il cielo; asciutta: opaca
        float dW = vWPos.z - shoreZ(vWPos.x);
        float wet = smoothstep(3.2, 0.3, dW) * smoothstep(-1.5, -0.2, vWPos.y);
        float puddle = smoothstep(0.55, 0.75, vn(vWPos.xz * 0.35)) * wet;
        wet = max(wet * 0.75, swWet);
        roughnessFactor = mix(roughnessFactor, 0.16, wet * 0.8);
        roughnessFactor = mix(roughnessFactor, 0.05, puddle * 0.7);
      }`)
      .replace('#include <lights_fragment_end>', /* glsl */`#include <lights_fragment_end>
      {
        float csh = mix(1.0, cloudShadow(vWPos, uSunDir), uSunVis);
        reflectedLight.directDiffuse *= csh;
        reflectedLight.directSpecular *= csh;
      }`)
      .replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
      {
        // granelli che scintillano controsole sulla sabbia asciutta
        float dc = length(cameraPosition - vWPos);
        float dS = vWPos.z - shoreZ(vWPos.x);
        if (dc < 22.0 && dS > 1.0 && dS < 74.0 && uSunVis > 0.0) {
          vec2 cell = floor(vWPos.xz * 55.0);
          float h1 = h21(cell), h2 = h21(cell + 17.3), h3 = h21(cell + 41.7);
          vec3 gn = normalize(vec3(h1 - 0.5, 0.9, h2 - 0.5));
          vec3 Vv = normalize(cameraPosition - vWPos);
          float sp = pow(max(dot(reflect(-uSunDir, gn), Vv), 0.0), 60.0) * step(0.955, h3);
          totalEmissiveRadiance += uSunCol * sp * 2.5 * uSunVis * (1.0 - smoothstep(6.0, 22.0, dc));
        }
      }
      if (vWPos.y < 0.0) {
        vec2 p = mod(vWPos.xz * 0.35, 6.2831853) - 250.0;
        vec2 i = p; float c = 1.0; float inten = 0.005;
        for (int n = 0; n < 4; n++) {
          float t = uTime * 0.6 * (1.0 - (3.5 / float(n + 1)));
          i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
          c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
        }
        c /= 4.0; c = 1.17 - pow(c, 1.4);
        float cs = pow(abs(c), 8.0);
        float m = smoothstep(0.0, 0.4, -vWPos.y) * exp(vWPos.y * 0.35);
        totalEmissiveRadiance += diffuseColor.rgb * min(cs, 3.0) * m * uCaustic * 2.2 * mix(1.0, cloudShadow(vWPos, uSunDir), uSunVis);
      }`);
  };
}

// Post-processing: bloom, raggi di luce (god rays), lens flare, grading, grana
export function makePost(renderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: matchMedia('(pointer: coarse)').matches ? 2 : 4 });
  const q = () => new THREE.WebGLRenderTarget(Math.max(1, size.x >> 2), Math.max(1, size.y >> 2), { type: THREE.HalfFloatType });
  const rtBright = q(), rtTmp = q(), rtBloom = q(), rtRays = q();

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const mk = (uniforms, fs) => new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false });

  const shared = {
    uExposure: { value: 1 },
    uSunPos: { value: new THREE.Vector2() },
    uSunVis: { value: 0 },
    uSunCol: { value: new THREE.Color() },
  };

  const brightMat = mk({ tScene: { value: rt.texture }, ...shared }, /* glsl */`
    uniform sampler2D tScene; uniform float uExposure; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tScene, vUv).rgb * uExposure;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor = vec4(c * smoothstep(0.9, 2.2, l), 1.0);
    }`);

  const blurMat = mk({ tIn: { value: null }, uDir: { value: new THREE.Vector2() } }, /* glsl */`
    uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tIn, vUv).rgb * 0.2270270270;
      c += texture2D(tIn, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
      c += texture2D(tIn, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
      c += texture2D(tIn, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
      c += texture2D(tIn, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }`);

  const raysMat = mk({ tScene: { value: rt.texture }, ...shared }, /* glsl */`
    uniform sampler2D tScene; uniform float uExposure, uSunVis; uniform vec2 uSunPos; uniform vec3 uSunCol; varying vec2 vUv;
    void main(){
      vec2 dlt = (vUv - uSunPos) / 40.0;
      vec2 uv = vUv; float decay = 1.0; vec3 acc = vec3(0.0);
      for (int i = 0; i < 40; i++) {
        uv -= dlt;
        vec3 s = texture2D(tScene, uv).rgb * uExposure;
        float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
        acc += s * smoothstep(3.0, 9.0, l) * decay;
        decay *= 0.955;
      }
      gl_FragColor = vec4(acc / 40.0 * uSunVis, 1.0);
    }`);

  const compMat = mk({
    tScene: { value: rt.texture }, tBloom: { value: rtBloom.texture }, tRays: { value: rtRays.texture },
    uRes: { value: size.clone() }, uTime: { value: 0 }, uGrade: { value: new THREE.Vector3(1, 1, 1) },
    uFade: { value: 0 }, uFadeCol: { value: new THREE.Color(1, 1, 1) }, uRaysK: { value: 1 },
    uUnder: { value: 0 }, uFlow: { value: 0 }, uForm: { value: new THREE.Vector4(1, 1, 1, 0) }, uDrops: { value: 0 }, uIllum: { value: 0 }, uMask: { value: 0 }, uBlur: { value: 0 }, uDepth: { value: 0 }, uBreath: { value: 0 }, uHaze: { value: 0 }, uUnderCol: { value: new THREE.Color() }, ...shared,
  }, /* glsl */`
    uniform sampler2D tScene, tBloom, tRays; uniform vec2 uRes, uSunPos; uniform float uTime, uExposure, uSunVis, uFade, uRaysK;
    uniform vec4 uForm; uniform float uDrops;
    uniform float uUnder, uFlow, uIllum, uMask, uBlur, uBreath, uHaze, uDepth; uniform vec3 uUnderCol;
    uniform vec3 uGrade, uSunCol, uFadeCol;
    varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    vec3 shoulder(vec3 x){ vec3 a = vec3(0.72); vec3 o = max(x - a, 0.0); return min(x, a) + (1.0 - a) * (1.0 - exp(-o / (1.0 - a))); }
    float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
    void main(){
      vec2 uv = vUv; vec2 c = uv - 0.5; float r2 = dot(c, c);
      if (uUnder > 0.0) uv += vec2(sin(uv.y * 22.0 + uTime * 1.7), cos(uv.x * 18.0 + uTime * 1.3)) * 0.0025 * uUnder;
      if (uFlow > 0.0) {
        // essere acqua: i bordi scorrono e si allungano, la vista ondeggia come in una corrente
        float ed = smoothstep(0.15, 0.7, length(c));
        uv += vec2(sin(uv.y * 9.0 + uTime * 2.2), cos(uv.x * 7.0 + uTime * 1.9)) * 0.006 * uFlow * (0.3 + ed);
        uv += c * ed * 0.03 * uFlow * sin(uTime * 1.3);
      }
      float dropHL = 0.0;
      if (uDrops > 0.0) {
        // gocce sull'obiettivo appena riemergi
        vec2 g = (uv + vec2(0.0, uTime * 0.0)) * vec2(16.0, 9.0);
        vec2 id = floor(g); vec2 fr = fract(g) - 0.5;
        float hh = hash(id);
        vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
        float rad = 0.12 + 0.22 * hh;
        vec2 q = fr - o * 0.5; q.y *= 0.8 + 0.4 * hash(id + 1.3);
        float dd = length(q);
        float m = (1.0 - smoothstep(rad * 0.55, rad, dd)) * step(0.4, hh) * uDrops;
        uv -= q * m * 0.045;
        dropHL = m * smoothstep(rad, 0.0, length(q + vec2(0.05, -0.06)));
      }
      vec3 col;
      col.r = texture2D(tScene, uv - c * r2 * 0.012).r;
      col.g = texture2D(tScene, uv).g;
      col.b = texture2D(tScene, uv + c * r2 * 0.012).b;
      if (uBlur > 0.0) {
        vec3 acc = col;
        for (int i = 0; i < 8; i++) { float a = float(i) * 0.785; acc += texture2D(tScene, uv + vec2(cos(a), sin(a)) * 0.007 * uBlur).rgb; }
        col = acc / 9.0;
      }
      col *= uExposure;
      col += vec3(dropHL) * 0.25;
      col += texture2D(tBloom, uv).rgb * 0.55;
      col += texture2D(tRays, uv).rgb * 1.1 * uRaysK;
      if (uSunVis > 0.001) {
        vec2 asp = vec2(uRes.x / uRes.y, 1.0);
        vec2 sp = clamp(uSunPos, 0.001, 0.999);
        float o = lum(texture2D(tScene, sp).rgb) + lum(texture2D(tScene, sp + vec2(0.004, 0.0)).rgb)
                + lum(texture2D(tScene, sp - vec2(0.004, 0.0)).rgb) + lum(texture2D(tScene, sp + vec2(0.0, 0.006)).rgb);
        float occ = smoothstep(2.0, 12.0, o);
        vec2 dv = (uv - uSunPos) * asp; float d = length(dv); float a = atan(dv.y, dv.x);
        float rays = pow(abs(cos(a * 3.0 + 0.4)), 80.0) + 0.6 * pow(abs(cos(a * 5.0 + 1.1)), 140.0);
        vec3 fl = uSunCol * (rays * exp(-d * 2.6) * 0.4 + exp(-d * 9.0) * 0.4 + exp(-d * 2.0) * 0.05);
        vec2 axis = vec2(0.5) - uSunPos;
        for (int i = 1; i <= 3; i++) {
          vec2 gp = uSunPos + axis * (0.55 * float(i));
          float gd = length((uv - gp) * asp);
          fl += uSunCol * vec3(0.45, 1.0, 0.6) * (1.0 - smoothstep(0.0, 0.03 * float(i), gd)) * 0.06;
        }
        col += fl * uSunVis * occ;
      }
      // foschia solare: velo luminoso attorno al sole quando l'aria è umida
      if (uHaze > 0.0) {
        vec2 dv2 = (uv - uSunPos) * vec2(uRes.x / uRes.y, 1.0);
        float dd = length(dv2);
        col += uSunCol * (exp(-dd * 2.4) * 0.35 + exp(-dd * 0.9) * 0.12) * uHaze;
      }
      if (uUnder > 0.0) {
        // raggi di luce che scendono dalla superficie
        float sh = vn2(vec2(uv.x * 9.0 + uv.y * 2.0 + uTime * 0.15, uTime * 0.1)) * vn2(vec2(uv.x * 4.0 - uv.y * 1.0 - uTime * 0.07, 3.0));
        float rays = exp(-uDepth * 0.12);
        // i raggi si stringono in alto verso la superficie e si spengono in profondità
        float sh2 = vn2(vec2((uv.x - 0.5) / (0.4 + uv.y) * 7.0 + uTime * 0.12, uTime * 0.08));
        col += uUnderCol * (2.5 * pow(sh, 2.0) + 1.6 * pow(sh2, 3.0)) * smoothstep(0.1, 1.0, uv.y) * uUnder * rays;
        // caustiche sul primo piano quando si è vicini alla superficie
        col *= 1.0 + 0.25 * rays * pow(vn2(uv * vec2(14.0, 9.0) + uTime * 0.4) * vn2(uv * vec2(9.0, 13.0) - uTime * 0.3), 2.0) * 3.0 * uUnder;
        col = mix(col, (col + uUnderCol * 0.6) * vec3(0.45, 0.85, 1.0), 0.72 * uUnder);
        col *= mix(1.0, 0.55 + 0.45 * smoothstep(-0.1, 1.0, uv.y), uUnder * (1.0 - rays * 0.6));
      }
      col = shoulder(col);
      col *= uGrade;
      float l = lum(col); col = mix(vec3(l), col, 1.1);
      col = pow(max(col, 0.0), vec3(1.0 / 2.2));
      col *= 1.0 - 0.28 * smoothstep(0.25, 0.9, length(c * vec2(1.0, 0.85)) * 1.25);
      col += (hash(uv * uRes + fract(uTime * 7.0) * 517.0) - 0.5) * 0.035;
      col *= 1.0 - uBreath * smoothstep(0.15, 0.75, length(c)) * 1.2;
      if (uMask > 0.0) {
        // il bordo della maschera ai lati dello sguardo
        vec2 mc = c * vec2(uRes.x / uRes.y, 1.0);
        vec2 qa = vec2(abs(mc.x), mc.y + 0.02);
        float dm = length(max(abs(qa - vec2(0.0, 0.0)) - vec2(0.68, 0.38), 0.0)) - 0.12;
        float nose = 1.0 - smoothstep(0.08, 0.13, length((mc - vec2(0.0, -0.52)) * vec2(1.0, 1.4)));
        float frame = max(smoothstep(-0.01, 0.04, dm), nose);
        col = mix(col, vec3(0.015, 0.02, 0.025), frame * uMask);
        col += vec3(0.6, 0.8, 0.9) * 0.04 * smoothstep(-0.06, -0.0, dm) * (1.0 - frame) * uMask;
      }
      if (uFlow > 0.0) {
        float ed2 = smoothstep(0.2, 0.8, length(c));
        col = mix(col, col * vec3(0.75, 1.0, 1.08) + vec3(0.0, 0.03, 0.05), uFlow * 0.6);
        col = mix(col, uUnderCol * 2.2 + vec3(0.08, 0.14, 0.16), ed2 * uFlow * 0.45);
      }
      if (uForm.w > 0.0) {
        // ogni forma vede il mondo a modo suo: la nuvola velata, l'albero caldo, la sabbia bassa e dorata
        float ed3 = smoothstep(0.25, 0.85, length(c));
        col = mix(col, col * uForm.rgb, uForm.w);
        col = mix(col, vec3(dot(col, vec3(0.33))) * 1.05 + 0.04, ed3 * uForm.w * (uForm.b > 1.06 ? 0.9 : 0.3));
      }
      // illuminazione: un ricordo che torna, luce calda e morbida
      if (uIllum > 0.0) {
        float il = uIllum * uIllum;
        col = mix(col, col * vec3(1.1, 1.0, 0.86) + vec3(0.07, 0.05, 0.03), il);
        col += vec3(1.0, 0.85, 0.65) * 0.18 * il * (1.0 - smoothstep(0.0, 0.7, length(c)));
      }
      col = mix(col, uFadeCol, uFade);
      gl_FragColor = vec4(col, 1.0);
    }`);

  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene, cam); };
  const texel = new THREE.Vector2();

  return {
    rt, uniforms: compMat.uniforms,
    resize(w, h) {
      rt.setSize(w, h);
      for (const r of [rtBright, rtTmp, rtBloom, rtRays]) r.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
      compMat.uniforms.uRes.value.set(w, h);
    },
    render() {
      texel.set(1 / rtBright.width, 1 / rtBright.height);
      pass(brightMat, rtBright);
      blurMat.uniforms.tIn.value = rtBright.texture; blurMat.uniforms.uDir.value.set(texel.x * 1.5, 0); pass(blurMat, rtTmp);
      blurMat.uniforms.tIn.value = rtTmp.texture; blurMat.uniforms.uDir.value.set(0, texel.y * 1.5); pass(blurMat, rtBloom);
      blurMat.uniforms.tIn.value = rtBloom.texture; blurMat.uniforms.uDir.value.set(texel.x * 3.5, 0); pass(blurMat, rtTmp);
      blurMat.uniforms.tIn.value = rtTmp.texture; blurMat.uniforms.uDir.value.set(0, texel.y * 3.5); pass(blurMat, rtBloom);
      if (shared.uSunVis.value > 0.001) pass(raysMat, rtRays);
      else { renderer.setRenderTarget(rtRays); renderer.clear(); }
      pass(compMat, null);
    },
  };
}
