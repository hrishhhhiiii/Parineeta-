import * as THREE from 'three';
import { gsap } from 'gsap';
import { createStage, dragRotate, reducedMotion, motion } from './stage.js';
import { createPedestal, PEDESTAL_TOP } from './pedestal.js';
import { buildModel } from './models.js';
import { floorTexture } from './textures.js';
import { inCategory } from '../data/products.js';

const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;

export function initGallery({ canvas, stageEl, products, onFocus, onOpen }) {
  const stage = createStage(canvas, { fov: 30 });
  const { scene, camera } = stage;
  const reduce = reducedMotion();
  scene.fog = new THREE.Fog(0x150507, 12, 27);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 96), new THREE.MeshStandardMaterial({ color: 0x1a0508, roughness: 0.9, metalness: 0, envMapIntensity: 0.15 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const pattern = new THREE.Mesh(new THREE.CircleGeometry(9.5, 96), new THREE.MeshBasicMaterial({ map: floorTexture(), transparent: true, opacity: 0.35, depthWrite: false }));
  pattern.rotation.x = -Math.PI / 2;
  pattern.position.y = 0.005;
  scene.add(pattern);

  const spot = new THREE.SpotLight(0xffd9a0, 90, 16, 0.36, 0.7, 1.4);
  scene.add(spot, spot.target);
  const glow = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.6, 64),
    new THREE.MeshBasicMaterial({ color: 0xe3aa3e, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.01;
  scene.add(glow);

  const ring = new THREE.Group();
  scene.add(ring);

  const items = products.map((p) => {
    const holder = new THREE.Group();
    holder.add(createPedestal());
    const spin = new THREE.Group();
    spin.position.y = PEDESTAL_TOP;
    holder.add(spin);
    holder.userData.product = p;
    ring.add(holder);
    return { p, holder, spin, model: null, angle: 0, shown: true, lift: 0 };
  });

  // Build models progressively so the first frame is not blocked.
  let buildIndex = 0;
  function buildNext() {
    if (buildIndex >= items.length) return;
    const it = items[buildIndex++];
    it.model = buildModel(it.p, it.p.styles[0]);
    it.spin.add(it.model);
    if (!reduce) gsap.from(it.model.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.7, ease: 'back.out(2)' });
    setTimeout(buildNext, 30);
  }
  buildNext();

  const state = { pos: 0, target: 0, R: 5 };
  let visible = items.slice();
  let focusedId = null;

  function layout(animate = true) {
    visible = items.filter((i) => i.shown);
    const n = visible.length;
    const step = TAU / n;
    const R = n <= 1 ? 0.001 : Math.max(3.2, (n * 2.5) / TAU);
    visible.forEach((it, k) => {
      if (animate && !reduce) gsap.to(it, { angle: k * step, duration: 0.9, ease: 'power3.inOut' });
      else it.angle = k * step;
    });
    if (animate && !reduce) gsap.to(state, { R, duration: 0.9, ease: 'power3.inOut' });
    else state.R = R;
  }
  layout(false);

  const stepAngle = () => TAU / Math.max(1, visible.length);
  const focusedItem = () => visible[mod(Math.round(state.pos), visible.length)];

  function goTo(index) {
    const n = visible.length;
    const cur = Math.round(state.target);
    const diff = mod(index - cur + n / 2, n) - n / 2;
    state.target = cur + Math.round(diff);
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(visible.map((i) => i.holder), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.product) o = o.parent;
    return o ? visible.find((i) => i.holder === o) : null;
  }

  const drag = dragRotate(canvas, {
    onDrag: (dx) => {
      state.pos -= dx * 0.0045;
      state.target = state.pos;
    },
    onRelease: (v) => {
      state.target = Math.round(state.pos - v * 0.9);
    },
    onTap: (e) => {
      const it = pick(e);
      if (!it) return;
      if (it === focusedItem() && Math.abs(state.pos - state.target) < 0.2) onOpen(it.p);
      else goTo(visible.indexOf(it));
    },
  });

  let hovered = null;
  canvas.addEventListener('pointermove', (e) => {
    if (drag.dragging || e.pointerType === 'touch') return;
    hovered = pick(e);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointerleave', () => {
    hovered = null;
  });

  stageEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      api.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      api.prev();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const it = focusedItem();
      if (it) onOpen(it.p);
    }
  });

  stage.onFrame((dt, t) => {
    if (!drag.dragging) state.pos += (state.target - state.pos) * Math.min(1, dt * (reduce ? 30 : 5));
    const step = stepAngle();
    ring.rotation.y = -state.pos * step;
    for (const it of items) {
      it.holder.position.set(Math.sin(it.angle) * state.R, 0, Math.cos(it.angle) * state.R);
      it.holder.rotation.y = it.angle;
      const isHover = it === hovered;
      it.lift += ((isHover ? 0.12 : 0) - it.lift) * Math.min(1, dt * 8);
      it.spin.position.y = PEDESTAL_TOP + it.lift + (reduce || motion.paused ? 0 : Math.sin(t * 1.3 + it.angle * 3) * 0.02);
      if (!reduce && (!motion.paused || isHover)) it.spin.rotation.y += dt * (isHover ? 1.1 : 0.32);
    }
    const f = focusedItem();
    if (f && f.p.id !== focusedId) {
      focusedId = f.p.id;
      onFocus(f.p);
    }
    const aspect = camera.aspect || 1;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(8.2, 3.6 / (2 * tan * aspect));
    camera.position.set(0, 3.1, state.R + dist);
    camera.lookAt(0, 1.05, state.R - 1.4);
    spot.position.set(0, 7, state.R + 2);
    spot.target.position.set(0, 0.8, state.R);
    glow.position.z = state.R;
    glow.material.opacity = 0.16 + Math.sin(t * 2) * 0.04;
  });

  const api = {
    next() {
      state.target = Math.round(state.target) + 1;
    },
    prev() {
      state.target = Math.round(state.target) - 1;
    },
    setFilter(cat) {
      for (const it of items) {
        const show = inCategory(it.p, cat); // a main category includes its sub-categories
        if (show === it.shown) continue;
        it.shown = show;
        gsap.killTweensOf(it.holder.scale);
        if (show) {
          it.holder.visible = true;
          gsap.fromTo(it.holder.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: reduce ? 0 : 0.7, ease: 'back.out(1.6)' });
        } else {
          gsap.to(it.holder.scale, { x: 0.001, y: 0.001, z: 0.001, duration: reduce ? 0 : 0.35, onComplete: () => { it.holder.visible = false; } });
        }
      }
      layout(true);
      state.pos = 0;
      state.target = 0;
    },
    focus(id) {
      const idx = visible.findIndex((i) => i.p.id === id);
      if (idx >= 0) goTo(idx);
    },
    get focused() {
      return focusedItem()?.p;
    },
  };
  return api;
}
