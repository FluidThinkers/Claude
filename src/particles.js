import * as THREE from 'three';

// Particelle attorno a chi guarda: neve marina sott'acqua, pioggia, luce del finale.
// Vivono in una scatola che segue la camera (wrap), così costano poco ovunque.

function wrap(v, c, h) { return c - h + ((((v - (c - h)) % (2 * h)) + 2 * h) % (2 * h)); }

export class Motes {
  constructor(scene, tex) {
    const N = 700;
    this.N = N; this.half = 9;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 18; pos[i * 3 + 1] = (Math.random() - 0.5) * 18; pos[i * 3 + 2] = (Math.random() - 0.5) * 18; seed[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex }, uCol: { value: new THREE.Color() }, uOp: { value: 0 }, uSize: { value: 1 }, uTime: { value: 0 }, uPx: { value: 8 } },
      vertexShader: /* glsl */`
        attribute float seed; uniform float uSize, uTime, uPx; varying float vS; varying float vD;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vD = -mv.z; vS = seed;
          gl_PointSize = clamp(uSize * (0.5 + seed) * uPx / max(vD, 0.3), 1.0, uPx * 0.7 * uSize);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex; uniform vec3 uCol; uniform float uOp, uTime; varying float vS; varying float vD;
        void main() {
          float a = texture2D(uTex, gl_PointCoord).a;
          float tw = 0.6 + 0.4 * sin(uTime * (1.0 + vS * 2.0) + vS * 40.0);
          float fade = smoothstep(0.25, 1.2, vD) * (1.0 - smoothstep(6.0, 9.0, vD));
          gl_FragColor = vec4(uCol, a * uOp * tw * fade);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.pts = new THREE.Points(g, this.mat);
    this.pts.frustumCulled = false; this.pts.visible = false;
    scene.add(this.pts);

    // pioggia: strisce
    const R = 900; this.R = R; this.rh = 14;
    const rp = new Float32Array(R * 6);
    this.rdrop = new Float32Array(R * 3);
    for (let i = 0; i < R; i++) { this.rdrop[i * 3] = (Math.random() - 0.5) * 28; this.rdrop[i * 3 + 1] = (Math.random() - 0.5) * 28; this.rdrop[i * 3 + 2] = (Math.random() - 0.5) * 28; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rmat = new THREE.LineBasicMaterial({ color: 0xe4ecf2, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.LineSegments(rg, this.rmat);
    this.rain.frustumCulled = false; this.rain.visible = false;
    scene.add(this.rain);
    this.k = { snow: 0, light: 0, rain: 0 };
  }

  // kind: 'snow' (sott'acqua), 'light' (finale / ricordo), 'rain'
  update(dt, time, cam, want, col, wind, px = 400) {
    this.mat.uniforms.uPx.value = px * 0.02;
    const K = this.k;
    for (const n of ['snow', 'light', 'rain']) K[n] += ((want === n ? 1 : 0) - K[n]) * Math.min(1, dt * 1.5);
    const pk = Math.max(K.snow, K.light);
    this.pts.visible = pk > 0.01;
    if (this.pts.visible) {
      const a = this.pts.geometry.attributes.position, p = a.array, h = this.half;
      const vy = K.light > K.snow ? 0.35 : -0.05;
      for (let i = 0; i < this.N; i++) {
        const s = this.pts.geometry.attributes.seed.array[i];
        p[i * 3] = wrap(p[i * 3] + Math.sin(time * 0.3 + s * 20) * 0.08 * dt + wind.x * 0.05 * dt, cam.x, h);
        p[i * 3 + 1] = wrap(p[i * 3 + 1] + vy * (0.5 + s) * dt, cam.y, h);
        p[i * 3 + 2] = wrap(p[i * 3 + 2] + Math.cos(time * 0.27 + s * 13) * 0.08 * dt + wind.y * 0.05 * dt, cam.z, h);
      }
      a.needsUpdate = true;
      this.mat.uniforms.uTime.value = time;
      if (K.light > K.snow) { this.mat.uniforms.uCol.value.setRGB(1.0, 0.85, 0.62); this.mat.uniforms.uSize.value = 1.4; this.mat.uniforms.uOp.value = K.light * 0.9; }
      else { this.mat.uniforms.uCol.value.copy(col).multiplyScalar(3.2).addScalar(0.05); this.mat.uniforms.uSize.value = 0.55; this.mat.uniforms.uOp.value = K.snow * 0.55; }
    }
    this.rain.visible = K.rain > 0.01;
    if (this.rain.visible) {
      const a = this.rain.geometry.attributes.position, p = a.array, d = this.rdrop, h = this.rh;
      const len = 0.9, vx = wind.x * 3, vz = wind.y * 3;
      for (let i = 0; i < this.R; i++) {
        d[i * 3] = wrap(d[i * 3] + vx * dt, cam.x, h); d[i * 3 + 1] = wrap(d[i * 3 + 1] - 36 * dt, cam.y, h); d[i * 3 + 2] = wrap(d[i * 3 + 2] + vz * dt, cam.z, h);
        p[i * 6] = d[i * 3]; p[i * 6 + 1] = d[i * 3 + 1]; p[i * 6 + 2] = d[i * 3 + 2];
        p[i * 6 + 3] = d[i * 3] - vx * 0.03; p[i * 6 + 4] = d[i * 3 + 1] + len; p[i * 6 + 5] = d[i * 3 + 2] - vz * 0.03;
      }
      a.needsUpdate = true;
      this.rmat.opacity = 0.6 * K.rain;
    }
  }
}

// Luce che si libera da un ricordo trovato: sale a spirale e il vento la porta
export class LightBurst {
  constructor(scene, tex) {
    this.n = 240;
    this.p = new Float32Array(this.n * 3).fill(-999);
    this.s = Array.from({ length: this.n }, () => ({ life: 0, a: 0, r: 0, cx: 0, cz: 0, y: 0, vy: 0 }));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.mat = new THREE.PointsMaterial({ map: tex, color: 0xffe6b8, size: 0.2, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts);
    this.k = 0;
  }
  burst(pos, n = 120) {
    while (n-- > 0) {
      const S = this.s[this.k = (this.k + 1) % this.n];
      S.life = 3 + Math.random() * 3; S.a = Math.random() * 6.28; S.r = 0.2 + Math.random() * 1.2;
      S.cx = pos.x; S.cz = pos.z; S.y = pos.y + Math.random() * 0.4; S.vy = 0.5 + Math.random() * 1.6; S.w = 0.8 + Math.random() * 1.5;
    }
  }
  update(dt, wind) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      const S = this.s[i];
      if (S.life <= 0) { this.p[i * 3 + 1] = -999; continue; }
      any = true;
      S.life -= dt; S.a += S.w * dt; S.r += 0.35 * dt; S.y += S.vy * dt;
      S.cx += wind.x * 1.2 * dt; S.cz += wind.y * 1.2 * dt;
      this.p[i * 3] = S.cx + Math.cos(S.a) * S.r; this.p[i * 3 + 1] = S.life > 0 ? S.y : -999; this.p[i * 3 + 2] = S.cz + Math.sin(S.a) * S.r;
    }
    this.pts.visible = any;
    if (any) this.pts.geometry.attributes.position.needsUpdate = true;
  }
}
