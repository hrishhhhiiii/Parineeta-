import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { PALETTES } from '../data/products.js';
import { bandTexture, kunkeTexture, kunkeRimTexture, alpanaTexture, leafTexture, fabricTexture, matTexture, LEAF_BOUNDS, KURTA_BOUNDS } from './textures.js';
import { M } from './materials.js';

const TAU = Math.PI * 2;
const V2 = (x, y) => new THREE.Vector2(x, y);
const sharedGeo = new Map();
const shared = (key, make) => {
  if (!sharedGeo.has(key)) {
    const g = make();
    g.userData.shared = true;
    sharedGeo.set(key, g);
  }
  return sharedGeo.get(key);
};

function profile(pts, n = 160) {
  const curve = new THREE.SplineCurve(pts.map(([x, y]) => V2(x, y)));
  return curve.getSpacedPoints(n).map((p) => V2(Math.max(0, p.x), p.y));
}

function lathe(pts, segs = 96, n = 160) {
  const pr = profile(pts, n);
  const geo = new THREE.LatheGeometry(pr, segs);
  geo.userData.profile = pr;
  return geo;
}

function radiusAt(pr, y) {
  for (let i = 1; i < pr.length; i++) {
    const a = pr[i - 1];
    const b = pr[i];
    if ((a.y <= y && b.y >= y) || (a.y >= y && b.y <= y)) {
      const t = (y - a.y) / (b.y - a.y || 1);
      return a.x + (b.x - a.x) * t;
    }
  }
  return 0;
}

function ring(r, y, tube = 0.022, mat = M.gold()) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 72), mat);
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  return m;
}

function sphere(r, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
  m.position.set(x, y, z);
  return m;
}

function planarUV(geo, b) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - b.minX) / (b.maxX - b.minX);
    uv[i * 2 + 1] = (pos.getY(i) - b.minY) / (b.maxY - b.minY);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function bend(geo, R) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const th = x / R;
    const rr = R + z;
    p.setXYZ(i, Math.sin(th) * rr, p.getY(i), Math.cos(th) * rr - R);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const bendPoint = (x, y, z, R) => new THREE.Vector3(Math.sin(x / R) * (R + z), y, Math.cos(x / R) * (R + z) - R);

function instancedRing(geo, mat, count, place) {
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const d = new THREE.Object3D();
  d.rotation.order = 'YXZ';
  for (let i = 0; i < count; i++) {
    place(d, i);
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

/* ---------------- builders ---------------- */

const GACH = [[0, 0], [0.6, 0], [0.62, 0.05], [0.46, 0.14], [0.4, 0.22], [0.58, 0.38], [0.64, 0.52], [0.58, 0.66], [0.36, 0.78], [0.3, 0.84], [0.48, 0.98], [0.52, 1.1], [0.44, 1.22], [0.24, 1.31], [0.2, 1.37], [0.33, 1.48], [0.35, 1.57], [0.27, 1.66], [0.12, 1.75], [0.12, 1.82], [0.07, 1.9], [0.09, 1.97], [0.03, 2.08], [0, 2.12]];

function gachKouto(pal) {
  const g = new THREE.Group();
  const geo = shared('gach', () => lathe(GACH, 112, 220));
  g.add(new THREE.Mesh(geo, M.painted(bandTexture(pal, 'default'))));
  for (const y of [0.2, 0.82, 1.35, 1.79]) g.add(ring(radiusAt(geo.userData.profile, y) + 0.012, y, 0.022));
  g.add(sphere(0.05, M.gold(), 0, 2.12, 0));
  return g;
}

const SINDOOR = [[0, 0], [0.42, 0], [0.5, 0.04], [0.56, 0.16], [0.58, 0.3], [0.52, 0.4], [0.56, 0.44], [0.54, 0.5], [0.44, 0.62], [0.28, 0.7], [0.12, 0.74], [0.1, 0.78], [0.15, 0.85], [0.1, 0.93], [0.02, 0.97], [0, 0.97]];

function sindoorKouto(pal) {
  const g = new THREE.Group();
  const geo = shared('sindoor', () => lathe(SINDOOR, 96, 160));
  g.add(new THREE.Mesh(geo, M.painted(bandTexture(pal, 'small'))));
  g.add(ring(radiusAt(geo.userData.profile, 0.44) + 0.01, 0.44, 0.02));
  g.add(sphere(0.045, M.gold(), 0, 0.97, 0));
  return g;
}

// A squat open drum with raised lips top and bottom, like the shop's painted kunke.
function kunke(pal) {
  const g = new THREE.Group();
  const H = 0.62;
  const wall = new THREE.Mesh(shared('kunke-wall', () => new THREE.CylinderGeometry(0.55, 0.56, H - 0.16, 128, 1, true)), M.painted(kunkeTexture(pal)));
  wall.position.y = H / 2;
  g.add(wall);
  const inside = new THREE.Mesh(shared('kunke-inside', () => new THREE.CylinderGeometry(0.5, 0.5, H - 0.06, 96, 1, true)),
    new THREE.MeshStandardMaterial({ color: pal.deep, roughness: 0.75, side: THREE.BackSide }));
  inside.position.y = H / 2 + 0.03;
  g.add(inside);
  const floor = new THREE.Mesh(shared('kunke-floor', () => new THREE.CircleGeometry(0.5, 64)), inside.material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.06;
  g.add(floor);
  // rims: a rounded band whose cross-section is a short capsule
  const lip = (rIn, rOut, y0, y1) => {
    const pts = [];
    const mid = (y0 + y1) / 2;
    const half = (y1 - y0) / 2;
    for (let k = 0; k <= 16; k++) {
      const a = -Math.PI / 2 + (k / 16) * Math.PI;
      pts.push(V2(rOut - half + Math.cos(a) * half, mid + Math.sin(a) * half));
    }
    pts.push(V2(rIn, y1), V2(rIn, y0));
    pts.push(pts[0].clone());
    return new THREE.LatheGeometry(pts, 128);
  };
  const rimMat = M.painted(kunkeRimTexture(pal));
  g.add(new THREE.Mesh(shared('kunke-base', () => lip(0, 0.61, 0, 0.09)), rimMat));
  g.add(new THREE.Mesh(shared('kunke-lip', () => lip(0.5, 0.61, H - 0.1, H)), rimMat));
  g.add(ring(0.565, 0.1, 0.012));
  g.add(ring(0.565, H - 0.1, 0.012));
  return g;
}

function darpan(pal) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(shared('darpan-rim', () => new THREE.TorusGeometry(0.64, 0.11, 32, 128)), M.painted(bandTexture(pal, 'ring')));
  g.add(rim);
  g.add(new THREE.Mesh(shared('darpan-inner', () => new THREE.TorusGeometry(0.53, 0.022, 12, 96)), M.gold()));
  const mirror = new THREE.Mesh(shared('darpan-glass', () => new THREE.CircleGeometry(0.54, 96)), M.mirror());
  g.add(mirror);
  const back = new THREE.Mesh(shared('darpan-back', () => new THREE.CircleGeometry(0.56, 96)), M.painted(alpanaTexture(pal, 1024, 1024, { frame: false })));
  back.rotation.y = Math.PI;
  back.position.z = -0.004;
  g.add(back);
  const beadGeo = shared('bead', () => new THREE.SphereGeometry(1, 14, 10));
  g.add(instancedRing(beadGeo, M.gold(), 32, (d, i) => {
    const a = (i / 32) * TAU;
    d.position.set(Math.cos(a) * 0.79, Math.sin(a) * 0.79, 0);
    d.scale.setScalar(0.034);
  }));
  const handle = new THREE.Mesh(
    shared('darpan-handle', () => lathe([[0, 0], [0.08, 0], [0.1, 0.05], [0.06, 0.12], [0.08, 0.3], [0.06, 0.45], [0.1, 0.5], [0.07, 0.58], [0.05, 0.62], [0, 0.63]], 48, 80)),
    M.painted(bandTexture(pal, 'small')),
  );
  handle.position.y = -1.36;
  g.add(handle);
  g.add(ring(0.085, -0.86, 0.02));
  return g;
}

function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function piri(pal) {
  const g = new THREE.Group();
  const board = shared('piri-board', () => {
    const geo = new THREE.ExtrudeGeometry(roundedRect(1.8, 1.1, 0.24), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 16 });
    geo.rotateX(-Math.PI / 2);
    return geo;
  });
  g.add(new THREE.Mesh(board, M.lacquer(pal.deep)));
  const top = new THREE.Mesh(shared('piri-top', () => new THREE.PlaneGeometry(1.66, 0.96)), M.painted(alpanaTexture(pal, 1024, 592), 0.45));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.1335;
  g.add(top);
  const legGeo = shared('piri-leg', () => new THREE.CylinderGeometry(0.07, 0.05, 0.12, 20));
  for (const [x, z] of [[-0.7, -0.36], [0.7, -0.36], [-0.7, 0.36], [0.7, 0.36]]) {
    const leg = new THREE.Mesh(legGeo, M.lacquer(pal.deep));
    leg.position.set(x, -0.09, z);
    g.add(leg);
  }
  const edge = new THREE.Mesh(shared('piri-edge', () => {
    const pts = roundedRect(1.8, 1.1, 0.24).getSpacedPoints(160).map((p) => new THREE.Vector3(p.x, 0.02, -p.y));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.018, 8, true);
  }), M.gold());
  edge.scale.set(1.035, 1, 1.05);
  g.add(edge);
  return g;
}

function leafShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.55);
  s.bezierCurveTo(0.25, -0.95, 1.0, -0.9, 0.95, -0.3);
  s.bezierCurveTo(0.9, 0.3, 0.3, 0.7, 0, 1.05);
  s.bezierCurveTo(-0.3, 0.7, -0.9, 0.3, -0.95, -0.3);
  s.bezierCurveTo(-1.0, -0.9, -0.25, -0.95, 0, -0.55);
  return s;
}

function paanPata(pal) {
  const g = new THREE.Group();
  const geo = shared('leaf', () =>
    planarUV(new THREE.ExtrudeGeometry(leafShape(), { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 40 }), LEAF_BOUNDS));
  const tex = leafTexture(pal);
  const mat = pal.metal ? M.foil(tex) : M.painted(tex, 0.45);
  const stemGeo = shared('stem', () => new THREE.CylinderGeometry(0.018, 0.028, 0.6, 10));
  const make = (x, rz, z, ry) => {
    const leaf = new THREE.Group();
    leaf.add(new THREE.Mesh(geo, mat));
    const stem = new THREE.Mesh(stemGeo, M.lacquer(pal.deep, 0.5));
    stem.position.set(0, -0.84, 0.02);
    leaf.add(stem);
    leaf.position.set(x, 0, z);
    leaf.rotation.set(0, ry, rz);
    return leaf;
  };
  g.add(make(-0.42, 0.2, -0.04, 0.12));
  g.add(make(0.42, -0.2, 0.06, -0.12));
  return g;
}

const CROWN_R = 1.25;
const crownF = (x) => {
  const env = 0.22 + 0.95 * Math.pow(1 - Math.min(1, Math.abs(x)), 1.25);
  const peaks = 0.55 + 0.45 * Math.pow(Math.abs(Math.cos(x * Math.PI * 3.5)), 2.5);
  return 0.2 + (env - 0.2) * peaks + 0.28 * Math.exp(-((x / 0.05) ** 2));
};

function crownGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-1, 0);
  s.lineTo(1, 0);
  for (let i = 0; i <= 200; i++) {
    const x = 1 - (2 * i) / 200;
    s.lineTo(x, crownF(x));
  }
  s.lineTo(-1, 0);
  const addHole = (cx, cy, r) => {
    const top = Math.min(crownF(cx - r), crownF(cx), crownF(cx + r));
    if (cy + r + 0.05 > top || cy - r < 0.24) return;
    const h = new THREE.Path();
    h.absarc(cx, cy, r, 0, TAU, true);
    s.holes.push(h);
  };
  for (let x = -0.8; x <= 0.81; x += 0.16) addHole(x, 0.34, 0.045);
  for (let x = -0.64; x <= 0.65; x += 0.16) addHole(x, 0.52, 0.05);
  for (let x = -0.4; x <= 0.41; x += 0.2) addHole(x, 0.7, 0.045);
  addHole(0, 0.9, 0.07);
  let geo = new THREE.ExtrudeGeometry(s, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1, curveSegments: 14 });
  planarUV(geo, { minX: -1, maxX: 1, minY: 0, maxY: 1.5 });
  geo = new TessellateModifier(0.07, 6).modify(geo);
  return bend(geo, CROWN_R);
}

function mukut(pal) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(shared('crown', crownGeometry), M.shola()));
  const trimGeo = (y) => shared(`crown-trim-${y}`, () => {
    const pts = [];
    for (let i = 0; i <= 60; i++) pts.push(bendPoint(-1 + (2 * i) / 60, y, 0.07, CROWN_R));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.018, 8, false);
  });
  g.add(new THREE.Mesh(trimGeo(0.03), M.gold()));
  g.add(new THREE.Mesh(trimGeo(0.2), M.gold()));
  const gem = M.gem(pal.metal ? pal.accent : pal.base);
  for (let x = -0.9; x <= 0.91; x += 0.15) {
    const p = bendPoint(x, 0.115, 0.075, CROWN_R);
    g.add(sphere(0.032, gem, p.x, p.y, p.z));
  }
  for (let k = -3; k <= 3; k++) {
    const x = k / 3.5;
    const p = bendPoint(x, crownF(x) + 0.03, 0.03, CROWN_R);
    g.add(sphere(k === 0 ? 0.05 : 0.03, k === 0 ? gem : M.gold(), p.x, p.y, p.z));
  }
  return g;
}

const TOPOR = [[0, 0], [0.66, 0], [0.68, 0.08], [0.6, 0.16], [0.64, 0.26], [0.52, 0.5], [0.56, 0.56], [0.45, 0.8], [0.49, 0.86], [0.38, 1.1], [0.42, 1.16], [0.31, 1.4], [0.34, 1.46], [0.23, 1.7], [0.26, 1.75], [0.14, 1.98], [0.1, 2.1], [0.05, 2.25], [0, 2.3]];

function topor(pal) {
  const g = new THREE.Group();
  const geo = shared('topor', () => lathe(TOPOR, 112, 220));
  const trim = { base: '#F6EFDF', deep: '#E6D9BD', accent: pal.metal ? '#D9A441' : pal.base, detail: pal.metal ? '#C08A2A' : pal.accent, leaf: pal.leaf };
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: bandTexture(trim, 'shola'), roughness: 0.78, bumpMap: M.shola().bumpMap, bumpScale: 1 })));
  const petalGeo = shared('topor-petal', () => new THREE.SphereGeometry(1, 10, 8));
  for (const y of [0.26, 0.56, 0.86, 1.16, 1.46, 1.75]) {
    const r = radiusAt(geo.userData.profile, y) + 0.012;
    const n = Math.max(12, Math.floor((TAU * r) / 0.075));
    g.add(instancedRing(petalGeo, M.shola(), n, (d, i) => {
      const a = (i / n) * TAU;
      d.position.set(Math.cos(a) * r, y + 0.035, Math.sin(a) * r);
      d.rotation.set(-0.35, Math.PI / 2 - a, 0);
      d.scale.set(0.034, 0.06, 0.014);
    }));
  }
  const gem = M.gem(pal.metal ? pal.accent : pal.base);
  for (const y of [0.4, 1.0, 1.58]) {
    const r = radiusAt(geo.userData.profile, y) + 0.01;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      g.add(sphere(0.03, gem, Math.cos(a) * r, y, Math.sin(a) * r));
    }
  }
  g.add(sphere(0.045, M.gold(), 0, 2.31, 0));
  return g;
}

const PLATE = [[0, 0], [0.9, 0], [1.0, 0.03], [1.12, 0.1], [1.2, 0.16], [1.17, 0.18], [1.06, 0.12], [0.96, 0.09], [0, 0.09]];
const BOWL = [[0, 0], [0.12, 0], [0.17, 0.02], [0.24, 0.1], [0.26, 0.15], [0.24, 0.16], [0.2, 0.11], [0.14, 0.06], [0, 0.05]];

function thalaSet(pal) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(shared('plate', () => lathe(PLATE, 112, 140)), M.painted(bandTexture(pal, 'ring')));
  g.add(plate);
  const top = new THREE.Mesh(shared('plate-top', () => new THREE.CircleGeometry(0.97, 96)), M.painted(alpanaTexture(pal, 1024, 1024, { frame: false }), 0.42));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.092;
  g.add(top);
  const bowlGeo = shared('bowl', () => lathe(BOWL, 64, 80));
  const bowlMat = new THREE.MeshPhysicalMaterial({ map: bandTexture(pal, 'small'), roughness: 0.4, clearcoat: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const b = new THREE.Mesh(bowlGeo, bowlMat);
    b.position.set(Math.cos(a) * 0.62, 0.092, Math.sin(a) * 0.62);
    g.add(b);
  }
  return g;
}

function kurtaShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.2, 1.25);
  s.lineTo(-0.62, 1.12);
  s.lineTo(-1.25, 0.62);
  s.lineTo(-1.05, 0.4);
  s.lineTo(-0.62, 0.76);
  s.quadraticCurveTo(-0.6, -0.2, -0.68, -1.0);
  s.lineTo(0.68, -1.0);
  s.quadraticCurveTo(0.6, -0.2, 0.62, 0.76);
  s.lineTo(1.05, 0.4);
  s.lineTo(1.25, 0.62);
  s.lineTo(0.62, 1.12);
  s.lineTo(0.2, 1.25);
  s.quadraticCurveTo(0, 0.95, -0.2, 1.25);
  return s;
}

function punjabi(pal) {
  const g = new THREE.Group();
  const geo = shared('kurta', () =>
    planarUV(new THREE.ExtrudeGeometry(kurtaShape(), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 4, curveSegments: 24 }), KURTA_BOUNDS));
  g.add(new THREE.Mesh(geo, M.fabric(fabricTexture(pal))));
  const hook = new THREE.Mesh(shared('hook', () => new THREE.TorusGeometry(0.11, 0.014, 10, 40, Math.PI * 1.3)), M.gold());
  hook.position.set(0, 1.42, 0.04);
  hook.rotation.z = -0.2;
  g.add(hook);
  return g;
}

function archShape(hw, rectH, y0 = 0) {
  const s = new THREE.Shape();
  s.moveTo(-hw, y0);
  s.lineTo(hw, y0);
  s.lineTo(hw, rectH);
  s.absarc(0, rectH, hw, 0, Math.PI, false);
  s.lineTo(-hw, y0);
  return s;
}

const photoCache = new Map();
function photoTexture(url, crop) {
  const key = `${url}:${crop.join(',')}`;
  if (photoCache.has(key)) return photoCache.get(key);
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const entry = {};
  entry.ready = new Promise((resolve) => {
    entry.texture = loader.load(
      url,
      (t) => {
        entry.loaded = true;
        resolve(t);
      },
      undefined,
      () => {
        entry.failed = true;
        resolve(null);
      },
    );
  });
  entry.texture.colorSpace = THREE.SRGBColorSpace;
  entry.texture.repeat.set(crop[0], crop[1]);
  entry.texture.offset.set(crop[2], crop[3]);
  entry.texture.anisotropy = 8;
  photoCache.set(key, entry);
  return entry;
}

function archPanel(pal, opts) {
  const g = new THREE.Group();
  const panelGeo = shared('arch-panel', () =>
    planarUV(new THREE.ExtrudeGeometry(archShape(0.7, 1.25), { depth: 0.04, bevelEnabled: false, curveSegments: 48 }), { minX: -0.7, maxX: 0.7, minY: 0, maxY: 1.95 }));
  const entry = photoTexture(opts.image, opts.crop || [1, 1, 0, 0]);
  const front = new THREE.MeshStandardMaterial({ roughness: 0.5, color: 0xffffff });
  const fallback = alpanaTexture(PALETTES.sindoor);
  front.map = entry.loaded ? entry.texture : fallback;
  g.userData.ready = entry.ready.then((t) => {
    front.map = t || fallback;
    front.needsUpdate = true;
  });
  const frameMat = pal.metal ? M.gold() : M.lacquer(pal.base, 0.3);
  g.add(new THREE.Mesh(panelGeo, [front, frameMat]));
  const frameGeo = shared('arch-frame', () => {
    const outer = archShape(0.82, 1.25, -0.12);
    outer.holes.push(archShape(0.7, 1.25));
    return new THREE.ExtrudeGeometry(outer, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 48 });
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.z = -0.02;
  g.add(frame);
  const gem = M.gem(pal.metal ? '#A8161F' : pal.accent);
  const beadGeo = shared('bead', () => new THREE.SphereGeometry(1, 14, 10));
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI;
    pts.push([Math.cos(a) * 0.76, 1.25 + Math.sin(a) * 0.76]);
  }
  for (let y = 0.05; y < 1.2; y += 0.2) pts.push([0.76, y], [-0.76, y]);
  g.add(instancedRing(beadGeo, gem, pts.length, (d, i) => {
    d.position.set(pts[i][0], pts[i][1], 0.085);
    d.scale.setScalar(0.028);
  }));
  return g;
}

function backdrop(pal) {
  const g = new THREE.Group();
  const geo = shared('mat', () => {
    const p = new THREE.PlaneGeometry(2.4, 1.6, 64, 40);
    const pos = p.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      let z = 0.04 * Math.sin(x * 2.4);
      if (y < -0.5) {
        const d = -0.5 - y;
        z += d * d * 1.6;
      }
      pos.setZ(i, z);
    }
    p.computeVertexNormals();
    p.translate(0, 0.8, 0);
    return p;
  });
  g.add(new THREE.Mesh(geo, M.mat(matTexture(pal))));
  const rod = new THREE.Mesh(shared('rod', () => new THREE.CylinderGeometry(0.035, 0.035, 2.6, 20)), M.lacquer('#5A2E14', 0.4));
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 1.62, 0.01);
  g.add(rod);
  g.add(sphere(0.06, M.gold(), -1.32, 1.62, 0.01));
  g.add(sphere(0.06, M.gold(), 1.32, 1.62, 0.01));
  return g;
}

const DALA = [[0, 0], [0.86, 0], [0.92, 0.04], [0.97, 0.2], [1.0, 0.3], [0.98, 0.34], [0.6, 0.36], [0, 0.37]];

function flowerDala(pal) {
  const g = new THREE.Group();
  const top = 0.36;
  g.add(new THREE.Mesh(shared('dala', () => lathe(DALA, 96, 120)), M.silk(pal.base)));
  g.add(ring(0.995, 0.3, 0.024));
  g.add(ring(0.93, 0.06, 0.018));
  const lace = new THREE.Mesh(shared('dala-lace', () => new THREE.TorusGeometry(0.95, 0.045, 12, 96)), M.rice());
  lace.rotation.x = Math.PI / 2;
  lace.position.y = 0.03;
  g.add(lace);
  const beadGeo = shared('bead', () => new THREE.SphereGeometry(1, 14, 10));
  g.add(instancedRing(beadGeo, M.rice(), 60, (d, i) => {
    const a = (i / 60) * TAU;
    d.position.set(Math.cos(a) * 1.0, 0.075, Math.sin(a) * 1.0);
    d.scale.setScalar(0.024);
  }));
  const hoopR = 0.62;
  const stretch = 1.4;
  const z = -0.18;
  const hoop = new THREE.Mesh(shared('dala-hoop', () => new THREE.TorusGeometry(hoopR, 0.03, 12, 72, Math.PI)), M.gold());
  hoop.scale.set(1, stretch, 1);
  hoop.position.set(0, top, z);
  g.add(hoop);
  const fan = new THREE.Mesh(shared('dala-fan', () => new THREE.CircleGeometry(hoopR * 0.96, 48, 0, Math.PI)), M.silk(pal.deep));
  fan.scale.set(1, stretch, 1);
  fan.position.set(0, top, z - 0.02);
  g.add(fan);
  const roseGeo = shared('rose', () => new THREE.SphereGeometry(1, 18, 12));
  const roses = [M.silk('#E8859B'), M.silk('#FAD0D8')];
  const leafMat = M.silk(pal.leaf);
  const onHoop = (t, r = hoopR) => new THREE.Vector3(Math.cos(t) * r, top + Math.sin(t) * r * stretch, z);
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * Math.PI;
    const rose = new THREE.Mesh(roseGeo, roses[i % 2]);
    rose.position.copy(onHoop(t)).setZ(z + 0.03);
    rose.scale.set(0.095, 0.085, 0.09);
    g.add(rose);
    if (i < 16) {
      const leaf = new THREE.Mesh(roseGeo, leafMat);
      leaf.position.copy(onHoop(t + Math.PI / 32, hoopR + 0.07));
      leaf.scale.set(0.045, 0.022, 0.06);
      g.add(leaf);
    }
  }
  for (const side of [-1, 1]) {
    const from = onHoop(Math.PI / 2 - side * 0.42).setZ(z + 0.05);
    const to = new THREE.Vector3(side * 0.18, top + 0.03, 0.08);
    const n = 18;
    g.add(instancedRing(beadGeo, M.gem('#FFFFFF'), n, (d, i) => {
      const t = i / (n - 1);
      d.position.lerpVectors(from, to, t);
      d.position.x += Math.sin(t * Math.PI) * side * 0.06;
      d.scale.setScalar(0.021);
    }));
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.26;
    const rose = new THREE.Mesh(roseGeo, roses[i % 2]);
    rose.position.set(Math.cos(a) * 0.82, top + 0.04, Math.sin(a) * 0.82);
    rose.scale.set(0.08, 0.06, 0.08);
    g.add(rose);
  }
  return g;
}

const BUILD = { gachKouto, sindoorKouto, kunke, darpan, piri, paanPata, mukut, topor, thalaSet, punjabi, archPanel, backdrop, flowerDala };

const FIT = {
  gachKouto: { h: 2.05, w: 1.6 },
  sindoorKouto: { h: 1.15, w: 1.5 },
  kunke: { h: 1.15, w: 1.5 },
  darpan: { h: 2.0, w: 1.7 },
  piri: { h: 1.2, w: 1.7, tilt: 0.38 },
  paanPata: { h: 1.9, w: 1.9 },
  mukut: { h: 1.45, w: 1.95 },
  topor: { h: 2.1, w: 1.6 },
  thalaSet: { h: 1.3, w: 1.8, tilt: 0.5 },
  punjabi: { h: 1.9, w: 1.95 },
  archPanel: { h: 2.0, w: 1.6 },
  backdrop: { h: 1.8, w: 2.1 },
  flowerDala: { h: 1.9, w: 1.9 },
};

export function buildModel(product, styleId) {
  const pal = PALETTES[styleId] || PALETTES[product.styles[0]];
  const kind = BUILD[product.model?.kind] ? product.model.kind : 'kunke';
  const inner = BUILD[kind](pal, product.model);
  const fit = FIT[kind];
  if (fit.tilt) inner.rotation.x = fit.tilt;
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const s = Math.min(fit.h / size.y, fit.w / Math.max(size.x, size.z));
  inner.scale.setScalar(s);
  inner.updateMatrixWorld(true);
  box.setFromObject(inner);
  const c = box.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box.min.y, -c.z);
  const wrapper = new THREE.Group();
  wrapper.add(inner);
  wrapper.userData.ready = inner.userData.ready || Promise.resolve();
  wrapper.userData.height = box.max.y - box.min.y;
  return wrapper;
}

export function disposeModel(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
  });
}
