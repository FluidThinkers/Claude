import * as THREE from 'three';

// Stormi: centinaia di storni che danzano nell'aria sopra la riva, si stringono, si allargano, girano tutti insieme.
// Ogni uccello segue un punto che si muove su una curva; la forma dello stormo respira col tempo.

export class Flocks {
  constructor(scene) {
    this.flocks = [];
    const geo = new THREE.BufferGeometry();
    // un uccellino: due ali triangolari
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.12, -0.22, 0, 0.04, 0, 0, 0.05, 0, 0, -0.12, 0, 0, 0.05, 0.22, 0, 0.04], 3));
    geo.setAttribute('wing', new THREE.Float32BufferAttribute([0, 1, 0, 0, 0, 1], 1));
    geo.computeVertexNormals();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0.08, 0.08, 0.1) } },
      vertexShader: /* glsl */`
        attribute float wing; uniform float uTime;
        void main(){
          vec3 p = position;
          float ph = float(gl_InstanceID) * 0.73;
          p.y += wing * sin(uTime * 18.0 + ph) * 0.12;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 1.0); }',
      side: THREE.DoubleSide,
    });
    for (let f = 0; f < 3; f++) {
      const N = 260;
      const im = new THREE.InstancedMesh(geo, this.mat, N); im.frustumCulled = false; scene.add(im);
      const birds = Array.from({ length: N }, () => ({ o: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(Math.cbrt(Math.random())), p: new THREE.Vector3(), v: new THREE.Vector3(), ph: Math.random() * 10 }));
      this.flocks.push({ im, birds, c: new THREE.Vector3(-200 + f * 240, 45 + f * 12, 20 + f * 60), seed: f * 3.7 + 1 });
    }
    this.dm = new THREE.Object3D();
  }

  update(dt, time, cam, night, col) {
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uCol.value.copy(col);
    for (const F of this.flocks) {
      const s = F.seed, t = time * 0.05 + s;
      // il centro dello stormo vaga sopra la spiaggia e le colline
      F.c.set(Math.sin(t * 1.3) * 260 + Math.sin(t * 0.37) * 120, 38 + 18 * Math.sin(t * 2.1) + 10 * Math.sin(t * 5.3), 60 + Math.cos(t * 0.9) * 120);
      const vis = night < 0.6;
      F.im.visible = vis && F.c.distanceTo(cam) < 900;
      if (!F.im.visible) continue;
      // la forma respira: si allunga, si schiaccia, ruota
      const sx = 14 + 10 * Math.sin(time * 0.31 + s), sy = 5 + 4 * Math.sin(time * 0.47 + s * 2), sz = 9 + 7 * Math.cos(time * 0.23 + s);
      const rot = time * 0.25 + Math.sin(time * 0.13 + s) * 1.5;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      let k = 0;
      for (const B of F.birds) {
        const ox = B.o.x * sx, oz = B.o.z * sz;
        const tx = F.c.x + ox * cr - oz * sr + Math.sin(time * 1.7 + B.ph) * 1.2;
        const ty = F.c.y + B.o.y * sy + Math.sin(time * 0.9 + B.o.x * 3 + s) * 3;
        const tz = F.c.z + ox * sr + oz * cr + Math.cos(time * 1.3 + B.ph) * 1.2;
        // ognuno insegue il suo posto con un po' di ritardo: l'onda che attraversa lo stormo
        const lag = 1.2 + 0.8 * Math.sin(B.o.x * 2 + s);
        B.v.x += ((tx - B.p.x) * lag - B.v.x) * Math.min(1, dt * 2); B.v.y += ((ty - B.p.y) * lag - B.v.y) * Math.min(1, dt * 2); B.v.z += ((tz - B.p.z) * lag - B.v.z) * Math.min(1, dt * 2);
        if (B.p.lengthSq() === 0) B.p.set(tx, ty, tz);
        B.p.addScaledVector(B.v, dt);
        this.dm.position.copy(B.p);
        this.dm.rotation.set(0, Math.atan2(-B.v.x, -B.v.z), Math.sin(time * 3 + B.ph) * 0.4);
        this.dm.scale.setScalar(1.6);
        this.dm.updateMatrix(); F.im.setMatrixAt(k++, this.dm.matrix);
      }
      F.im.instanceMatrix.needsUpdate = true;
    }
  }
}
