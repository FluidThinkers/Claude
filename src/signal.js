import * as THREE from 'three';

// Il segnale del prossimo ricordo: un anello di luce che respira sul terreno (o sull'acqua)
// e una colonna di pulviscolo luminoso che sale piano. Tutto calcolato nello shader, punto per punto:
// nessuna immagine, nessuna superficie piatta che possa diventare un quadrato.

export function buildSignal(scene) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);

  // pulviscolo che sale
  const N = 150;
  const seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  const motesMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOp: { value: 0 }, uPx: { value: 800 }, uH: { value: 16 } },
    vertexShader: /* glsl */`
      attribute vec3 seed; uniform float uTime, uPx, uH; varying float vA;
      void main(){
        float t = fract(seed.x + uTime * (0.025 + seed.y * 0.03));
        float a = seed.z * 6.2831 + uTime * (0.2 + seed.y * 0.3);
        float r = 0.15 + 0.7 * seed.y * (1.0 - t * 0.5);
        vec3 p = vec3(cos(a) * r, t * uH, sin(a) * r);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float big = step(0.92, seed.x);
        gl_PointSize = clamp((0.2 + 0.3 * big) * uPx / max(-mv.z, 0.5), 2.2, 30.0);
        vA = sin(t * 3.14159) * (0.55 + 0.45 * sin(uTime * (1.5 + seed.z * 3.0) + seed.x * 40.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOp; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float a = pow(1.0 - d, 2.2) * vA * uOp;
        gl_FragColor = vec4(vec3(1.0, 0.9, 0.66) * a * 2.4, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(geo, motesMat); motes.frustumCulled = false; g.add(motes);

  // anello che respira a terra
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOp: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uOp; varying vec2 vP;
      void main(){
        float r = length(vP);
        float ph = fract(uTime * 0.22);
        float wave = exp(-pow((r - ph * 3.2) / 0.22, 2.0)) * (1.0 - ph);
        float core = exp(-r * r * 1.6) * 0.35;
        float rest = exp(-pow((r - 0.9) / 0.12, 2.0)) * 0.45;
        float a = (wave + core + rest) * smoothstep(3.6, 2.6, r) * uOp;
        gl_FragColor = vec4(vec3(1.0, 0.88, 0.6) * a * 1.8, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const ring = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.frustumCulled = false; g.add(ring);

  return {
    g,
    // pos: dove; op: quanto si vede; px: altezza dello schermo in pixel
    update(pos, op, time, px, ground) {
      g.visible = op > 0.01;
      if (!g.visible) return;
      g.position.set(pos.x, ground, pos.z);
      motesMat.uniforms.uTime.value = time; motesMat.uniforms.uOp.value = op; motesMat.uniforms.uPx.value = px;
      motesMat.uniforms.uH.value = Math.max(6, pos.y - ground + 12);
      ringMat.uniforms.uTime.value = time; ringMat.uniforms.uOp.value = op;
    },
  };
}
