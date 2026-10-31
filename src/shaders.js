import * as THREE from 'three';
import { SHORE_GLSL } from './terrain.js';

// Uniform condivise fra cielo e acqua
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
};

const SKY_GLSL = /* glsl */`
uniform vec3 uZen, uMid, uHor, uSea, uSunDir, uMoonDir, uSunCol;
uniform float uSunVis, uNight, uTime;
vec3 skyGrad(vec3 d){
  float y = d.y;
  float h = pow(clamp(y, 0.0, 1.0), 0.5);
  vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.45, h));
  c = mix(c, uZen, smoothstep(0.4, 1.0, h));
  float sd = max(dot(d, uSunDir), 0.0);
  float band = pow(1.0 - clamp(y, 0.0, 1.0), 6.0);
  c += uSunCol * uSunVis * (0.22 * pow(sd, 4.0) * band + 0.22 * pow(sd, 32.0) + 0.6 * pow(sd, 300.0));
  c = mix(c, uSea, 1.0 - smoothstep(-0.004, 0.0, y));
  return c;
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
        c += uSunCol * smoothstep(0.99955, 0.9997, sd) * 40.0 * uSunVis * above;
        float md = dot(d, uMoonDir);
        c += vec3(0.85, 0.88, 1.0) * smoothstep(0.99975, 0.9999, md) * 2.5 * uNight;
        c += vec3(0.25, 0.3, 0.45) * pow(max(md, 0.0), 120.0) * 0.4 * uNight;
        if (d.y > 0.0) {
          vec3 p = d * 420.0; vec3 id = floor(p); float h = hash13(id);
          vec3 f = fract(p) - 0.5;
          float s = step(0.9984, h) * smoothstep(0.38, 0.0, length(f));
          float tw = 0.55 + 0.45 * sin(uTime * 2.0 + h * 300.0);
          c += vec3(s * tw * 3.0) * uNight * smoothstep(0.0, 0.25, d.y);
        }
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
  uDeep: { value: new THREE.Color(0x1b467a) },
  uShallow: { value: new THREE.Color(0x63bdb0) },
  uFog: { value: 0.001 },
  uLevel: { value: 0 },
};

export function makeWater() {
  const geo = new THREE.PlaneGeometry(9000, 9000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...skyUniforms, ...waterUniforms },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uLevel;
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); w.y += uLevel; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: SKY_GLSL + SHORE_GLSL + /* glsl */`
      uniform vec3 uCam, uLightDir, uLightCol, uAmb, uDeep, uShallow;
      uniform float uFog;
      varying vec3 vW;
      float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
      vec2 wv(vec2 p, vec2 dir, float fr, float amp, float spd){ float ph = dot(p, dir)*fr + uTime*spd; return dir*fr*amp*cos(ph); }
      void main(){
        vec2 p = vW.xz;
        float dist = length(uCam - vW);
        vec2 g = wv(p, normalize(vec2(0.2,1.0)), 0.35, 0.07, 1.1)
               + wv(p, normalize(vec2(-0.6,0.8)), 0.7, 0.04, 1.6)
               + wv(p, normalize(vec2(0.9,0.4)), 1.3, 0.025, 2.2)
               + wv(p, normalize(vec2(-0.3,-1.0)), 2.7, 0.012, 3.1)
               + wv(p, normalize(vec2(0.7,-0.6)), 5.3, 0.006, 4.0);
        vec2 q = p * 2.2 + vec2(uTime * 0.35, uTime * 0.2);
        float e = 0.05;
        g += vec2(vn(q + vec2(e,0)) - vn(q - vec2(e,0)), vn(q + vec2(0,e)) - vn(q - vec2(0,e))) / (2.0*e) * 0.03;
        float s = 1.0 / (1.0 + dist * 0.035);
        vec3 N = normalize(vec3(-g.x * s, 1.0, -g.y * s));
        vec3 V = normalize(uCam - vW);
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y) + 0.002; R = normalize(R);
        vec3 refl = skyGrad(R);
        float d = vW.z - shoreZ(vW.x);
        float depth = vW.y - baseH(d);
        float sh = exp(-max(depth, 0.0) * 0.38);
        vec3 body = mix(uDeep, uShallow, sh) * uAmb;
        float alpha = mix(0.97, 0.32, sh);
        vec3 col = body * (1.0 - F) + refl * F;
        alpha = clamp(alpha + F, 0.0, 1.0);
        vec3 H = normalize(uLightDir + V);
        float nh = max(dot(N, H), 0.0);
        float spec = pow(nh, 500.0) * 8.0 + pow(nh, 60.0) * 0.12;
        col += uLightCol * spec;
        alpha = max(alpha, min(spec, 1.0));
        float edge = 0.12 + 0.08 * sin(uTime * 0.7 + vW.x * 0.03);
        float fn = vn(vW.xz * vec2(0.9, 2.2) + vec2(uTime * 0.25, 0.0));
        float foam = (1.0 - smoothstep(edge * 0.3, edge, depth)) * (0.5 + 0.5 * fn) * step(-0.3, depth);
        col = mix(col, uAmb * 1.3 + uLightCol * 0.12, foam * 0.85);
        alpha = max(alpha, foam * 0.85);
        float f = 1.0 - exp(-pow(dist * uFog, 2.0));
        col = mix(col, uSea, f);
        alpha = mix(alpha, 1.0, f);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 1;
  return m;
}

// Caustiche sul fondale (iniettate nel materiale standard della sabbia)
export const causticUniforms = { uTime: skyUniforms.uTime, uCaustic: { value: 1 } };
export function addCaustics(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = causticUniforms.uTime;
    shader.uniforms.uCaustic = causticUniforms.uCaustic;
    shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );
    shader.fragmentShader = 'varying vec3 vWPos;\nuniform float uTime;\nuniform float uCaustic;\n' + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      /* glsl */`#include <emissivemap_fragment>
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
        totalEmissiveRadiance += diffuseColor.rgb * min(cs, 3.0) * m * uCaustic * 2.2;
      }`
    );
  };
}

export function makePost(renderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: rt.texture },
      uRes: { value: size.clone() },
      uTime: { value: 0 },
      uExposure: { value: 1 },
      uGrade: { value: new THREE.Vector3(1, 1, 1) },
      uSunPos: { value: new THREE.Vector2() },
      uSunVis: { value: 0 },
      uSunCol: { value: new THREE.Color() },
      uFade: { value: 0 },
      uFadeCol: { value: new THREE.Color(1, 1, 1) },
    },
    depthTest: false,
    depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tScene; uniform vec2 uRes, uSunPos; uniform float uTime, uExposure, uSunVis, uFade;
      uniform vec3 uGrade, uSunCol, uFadeCol;
      varying vec2 vUv;
      float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      vec3 shoulder(vec3 x){ vec3 a = vec3(0.72); vec3 o = max(x - a, 0.0); return min(x, a) + (1.0 - a) * (1.0 - exp(-o / (1.0 - a))); }
      float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main(){
        vec2 uv = vUv; vec2 c = uv - 0.5; float r2 = dot(c, c);
        vec3 col;
        col.r = texture2D(tScene, uv - c * r2 * 0.012).r;
        col.g = texture2D(tScene, uv).g;
        col.b = texture2D(tScene, uv + c * r2 * 0.012).b;
        col *= uExposure;
        if (uSunVis > 0.001) {
          vec2 asp = vec2(uRes.x / uRes.y, 1.0);
          vec2 sp = clamp(uSunPos, 0.001, 0.999);
          float o = 0.0;
          o += lum(texture2D(tScene, sp).rgb);
          o += lum(texture2D(tScene, sp + vec2(0.004, 0.0)).rgb);
          o += lum(texture2D(tScene, sp - vec2(0.004, 0.0)).rgb);
          o += lum(texture2D(tScene, sp + vec2(0.0, 0.006)).rgb);
          float occ = smoothstep(2.0, 12.0, o);
          vec2 dv = (uv - uSunPos) * asp; float d = length(dv); float a = atan(dv.y, dv.x);
          float rays = pow(abs(cos(a * 3.0 + 0.4)), 80.0) + 0.6 * pow(abs(cos(a * 5.0 + 1.1)), 140.0);
          vec3 fl = uSunCol * (rays * exp(-d * 2.6) * 0.45 + exp(-d * 9.0) * 0.5 + exp(-d * 2.0) * 0.06);
          vec2 axis = vec2(0.5) - uSunPos;
          for (int i = 1; i <= 3; i++) {
            vec2 gp = uSunPos + axis * (0.55 * float(i));
            float gd = length((uv - gp) * asp);
            fl += uSunCol * vec3(0.45, 1.0, 0.6) * (1.0 - smoothstep(0.0, 0.03 * float(i), gd)) * 0.07;
          }
          col += fl * uSunVis * occ;
        }
        col = shoulder(col);
        col *= uGrade;
        float l = lum(col); col = mix(vec3(l), col, 1.1);
        col = pow(max(col, 0.0), vec3(1.0 / 2.2));
        col *= 1.0 - 0.3 * smoothstep(0.25, 0.9, length(c * vec2(1.0, 0.85)) * 1.25);
        col += (hash(uv * uRes + fract(uTime * 7.0) * 517.0) - 0.5) * 0.04;
        col = mix(col, uFadeCol, uFade);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    rt, uniforms: mat.uniforms,
    resize(w, h) { rt.setSize(w, h); mat.uniforms.uRes.value.set(w, h); },
    render() { renderer.setRenderTarget(null); renderer.render(scene, cam); },
  };
}
