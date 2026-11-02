import * as THREE from 'three';

// Uno strato di nuvole vere, sopra la spiaggia: ci si vola sopra e dentro.
// Ogni nuvola è un grappolo di sbuffi morbidi (billboard calcolati nello shader).
// Il vento le porta; chi è vento può separarle passandoci in mezzo o raccoglierle finché piovono.

const CL = 46, PER = 9, SPAN = 1600;

export class CloudLayer {
  constructor(scene) {
    this.clouds = [];
    for (let i = 0; i < CL; i++) {
      const puffs = [];
      for (let k = 0; k < PER; k++) puffs.push({ x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.3) * 12, z: (Math.random() - 0.5) * 40, r: 14 + Math.random() * 16 });
      this.clouds.push({ x: (Math.random() - 0.5) * SPAN, z: (Math.random() - 0.5) * SPAN - 300, y: 120 + Math.random() * 40, vx: 0, vz: 0, puffs, dark: 0 });
    }
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.6, 0.65, 0.72) }, uOp: { value: 1 }, uTime: { value: 0 } },
      vertexShader: /* glsl */`
        attribute vec4 aP; attribute float aDark; varying vec2 vUv; varying float vDark; varying float vY; varying float vFade;
        void main(){
          vUv = uv; vDark = aDark;
          vec3 c = aP.xyz;
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 w = c + (right * position.x + up * position.y) * aP.w * 2.0;
          vY = position.y;
          float d = length(cameraPosition - c);
          vFade = smoothstep(aP.w * 0.4, aP.w * 1.6, d) * (1.0 - smoothstep(1800.0, 2600.0, d));
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uLit, uShade; uniform float uOp, uTime; varying vec2 vUv; varying float vDark; varying float vY; varying float vFade;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          float edge = n(vUv * 5.0 + uTime * 0.02) * 0.35 + n(vUv * 11.0) * 0.15;
          float a = smoothstep(1.0, 0.35, r + edge * 0.6 - 0.1);
          if (a < 0.01) discard;
          vec3 col = mix(uShade, uLit, smoothstep(-0.45, 0.35, vY));
          col *= 1.0 - 0.55 * vDark;
          gl_FragColor = vec4(col, a * 0.85 * uOp * vFade);
        }`,
      transparent: true, depthWrite: false,
    });
    const n = CL * PER;
    this.mesh = new THREE.InstancedMesh(geo, this.mat, n);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.aDark = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    geo.setAttribute('aP', this.aP); geo.setAttribute('aDark', this.aDark);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }

  // ctx: { dt, time, wind (Vector2 dir), strength, cam, player, mode, gather (-1..1), sun, lit, shade, cover }
  update(ctx) {
    const { dt } = ctx;
    let k = 0, rainy = 0;
    for (const C of this.clouds) {
      // il vento le porta
      C.vx += (ctx.wind.x * (2 + 8 * ctx.strength) - C.vx) * dt * 0.2;
      C.vz += (ctx.wind.y * (2 + 8 * ctx.strength) - C.vz) * dt * 0.2;
      // chi è vento: passandoci in mezzo le separa, raccogliendo le spinge verso di sé
      if (ctx.mode === 'wind') {
        const dx = C.x - ctx.player.x, dz = C.z - ctx.player.z, dy = C.y - ctx.player.y, d = Math.hypot(dx, dz) || 1;
        if (d < 90 && Math.abs(dy) < 40) {
          if (ctx.gather > 0) { C.vx -= dx / d * 14 * dt; C.vz -= dz / d * 14 * dt; C.dark = Math.min(1, C.dark + dt * 0.15); }
          else { C.vx += dx / d * 30 * dt * (1 - d / 90); C.vz += dz / d * 30 * dt * (1 - d / 90); C.dark = Math.max(0, C.dark - dt * 0.2); }
        }
      }
      C.dark = Math.max(0, C.dark - dt * 0.004);
      C.x += C.vx * dt; C.z += C.vz * dt;
      // restano attorno a chi guarda
      const cx = ctx.cam.x, cz = ctx.cam.z;
      if (C.x - cx > SPAN / 2) C.x -= SPAN; if (C.x - cx < -SPAN / 2) C.x += SPAN;
      if (C.z - cz > SPAN / 2) C.z -= SPAN; if (C.z - cz < -SPAN / 2) C.z += SPAN;
      const vis = ctx.cover;
      for (let j = 0; j < PER; j++) {
        const P = C.puffs[j];
        const show = j / PER < 0.25 + vis * 1.1 ? 1 : 0;
        this.aP.setXYZW(k, C.x + P.x, C.y + P.y, C.z + P.z, P.r * show * (0.8 + 0.4 * C.dark));
        this.aDark.setX(k, Math.min(1, C.dark + ctx.storm * 0.6));
        k++;
      }
      if (C.dark > 0.6 && Math.hypot(C.x - ctx.player.x, C.z - ctx.player.z) < 120) rainy = Math.max(rainy, C.dark);
    }
    this.aP.needsUpdate = true; this.aDark.needsUpdate = true;
    const U = this.mat.uniforms;
    U.uTime.value = ctx.time; U.uLit.value.copy(ctx.lit); U.uShade.value.copy(ctx.shade);
    U.uOp.value = 0.35 + 0.65 * Math.min(1, ctx.cover * 2);
    return rainy;
  }
}
