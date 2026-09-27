import * as THREE from 'three';
import { M } from './materials.js';
import { alpanaTexture } from './textures.js';

const TOP_PALETTE = { base: '#3a0810', deep: '#220307', accent: '#d9a441', detail: '#5c1119', leaf: '#3f7a4f' };

const TAU = Math.PI * 2;
let geos = null;

function build() {
  const pts = [[0, 0], [1.0, 0], [1.03, 0.04], [0.96, 0.08], [0.9, 0.1], [0.88, 0.34], [0.93, 0.36], [0.99, 0.4], [0.97, 0.44], [0, 0.44]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(pts, 96);
  const ring = new THREE.TorusGeometry(1, 0.018, 10, 128);
  const petal = new THREE.SphereGeometry(1, 16, 10);
  const top = new THREE.CircleGeometry(0.95, 96);
  top.rotateX(-Math.PI / 2);
  const topMat = new THREE.MeshStandardMaterial({ map: alpanaTexture(TOP_PALETTE, 1024, 1024, { frame: false }), roughness: 0.55, metalness: 0.1 });
  return { body, ring, petal, top, topMat };
}

export const PEDESTAL_TOP = 0.44;

export function createPedestal() {
  geos ||= build();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geos.body, M.pedestal()));
  const top = new THREE.Mesh(geos.top, geos.topMat);
  top.position.y = 0.4415;
  g.add(top);
  for (const [r, y] of [[1.0, 0.03], [0.985, 0.42]]) {
    const t = new THREE.Mesh(geos.ring, M.gold());
    t.scale.setScalar(r);
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    g.add(t);
  }
  const n = 22;
  const petals = new THREE.InstancedMesh(geos.petal, M.gold(), n);
  const d = new THREE.Object3D();
  d.rotation.order = 'YXZ';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    d.position.set(Math.cos(a) * 0.9, 0.22, Math.sin(a) * 0.9);
    d.rotation.set(0.25, Math.PI / 2 - a, 0);
    d.scale.set(0.07, 0.12, 0.025);
    d.updateMatrix();
    petals.setMatrixAt(i, d.matrix);
  }
  petals.instanceMatrix.needsUpdate = true;
  g.add(petals);
  return g;
}
