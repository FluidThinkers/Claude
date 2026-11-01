import * as THREE from 'three';
import { heightAt } from './terrain.js';

// Il formicaio all'inizio del pontile: un cono di sabbia fine con un buco, formiche che vanno e vengono.
// Vicino alla barca in secco, una briciola da portare a casa.

export function buildAnts(scene, colony, crumbAt) {
  const g = new THREE.Group(); scene.add(g);
  const y0 = heightAt(colony.x, colony.z);
  const sandM = new THREE.MeshStandardMaterial({ color: 0xcdb48e, roughness: 1 });
  const mound = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.22, 24, 3, true), sandM);
  { const p = mound.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = 1 + 0.12 * Math.sin(a * 5) + 0.06 * Math.sin(a * 11); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } mound.geometry.computeVertexNormals(); }
  mound.position.set(colony.x, y0 + 0.1, colony.z); mound.receiveShadow = true; g.add(mound);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), new THREE.MeshBasicMaterial({ color: 0x1a120c }));
  hole.rotation.x = -Math.PI / 2; hole.position.set(colony.x, y0 + 0.215, colony.z); g.add(hole);

  // formiche: piccoli corpi a tre segmenti
  const body = new THREE.Group();
  const antM = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.5 });
  const geo = new THREE.SphereGeometry(0.008, 6, 4);
  const N = 60;
  const ants = new THREE.InstancedMesh(geo, antM, N * 3); ants.frustumCulled = false; g.add(ants);
  const A = Array.from({ length: N }, (_, i) => ({ a: Math.random() * 6.28, r: 0.1 + Math.random() * 2.5, s: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.5), ph: Math.random() * 10 }));

  // la briciola
  const crumbM = new THREE.MeshStandardMaterial({ color: 0xd9b27a, roughness: 0.95 });
  const crumbGeo = new THREE.DodecahedronGeometry(0.03, 0);
  const crumb = new THREE.Mesh(crumbGeo, crumbM);
  crumb.position.set(crumbAt.x, heightAt(crumbAt.x, crumbAt.z) + 0.025, crumbAt.z); crumb.castShadow = true; g.add(crumb);
  // la briciola portata: davanti agli occhi della formica
  const held = new THREE.Mesh(crumbGeo, crumbM); held.position.set(0, -0.035, -0.09); held.scale.setScalar(0.8); held.visible = false;

  const dmy = new THREE.Object3D();
  return {
    g, crumb, held, colony: { x: colony.x, z: colony.z, y: y0 + 0.2 }, crumbAt,
    update(dt, time) {
      let k = 0;
      for (const a of A) {
        a.a += a.s * dt / Math.max(0.3, a.r);
        a.r += Math.sin(time * 0.7 + a.ph) * dt * 0.2; a.r = Math.max(0.12, Math.min(2.8, a.r));
        const x = colony.x + Math.cos(a.a) * a.r, z = colony.z + Math.sin(a.a) * a.r;
        const y = (a.r < 0.55 ? y0 + 0.22 * (1 - a.r / 0.55) : heightAt(x, z)) + 0.006;
        const dir = a.a + Math.PI / 2 * Math.sign(a.s);
        for (let s = 0; s < 3; s++) {
          dmy.position.set(x + Math.cos(dir) * (s - 1) * 0.013, y, z + Math.sin(dir) * (s - 1) * 0.013);
          dmy.scale.set(s === 2 ? 1.3 : 1, 0.8, s === 2 ? 1.3 : 1);
          dmy.updateMatrix(); ants.setMatrixAt(k++, dmy.matrix);
        }
      }
      ants.instanceMatrix.needsUpdate = true;
    },
  };
}
