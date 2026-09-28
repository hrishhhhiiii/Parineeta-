import * as THREE from 'three';
import { gsap } from 'gsap';
import { createStage, dragRotate, reducedMotion, isSmallScreen, motion } from './stage.js';
import { createPedestal, PEDESTAL_TOP } from './pedestal.js';
import { buildModel, disposeModel } from './models.js';
import { glowTexture, sparkTexture } from './textures.js';
import { PRODUCTS, PALETTES } from '../data/products.js';

/** Frames a subject of given height/width at the right distance for the canvas aspect. */
export function frameDistance(camera, h, w) {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return Math.max(h / 2 / t, w / 2 / (t * camera.aspect));
}

export function initHero(canvas, { onStyle, onFirstFrame }) {
  const stage = createStage(canvas, { fov: 26 });
  const { scene, camera } = stage;
  const reduce = reducedMotion();
  const product = PRODUCTS.find((p) => p.id === 'gach-kouto') || PRODUCTS[0];
  const styles = product.styles;
  let styleIndex = 0;

  const pedestal = createPedestal();
  scene.add(pedestal);
  const turn = new THREE.Group();
  turn.position.y = PEDESTAL_TOP;
  scene.add(turn);
  let model = buildModel(product, styles[0]);
  turn.add(model);
  onStyle?.(PALETTES[styles[0]].label);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
  halo.scale.set(3.6, 3.6, 1);
  halo.position.set(0, 1.55, -1.4);
  scene.add(halo);

  const count = isSmallScreen() ? 80 : 170;
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.9 + Math.random() * 2.2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 3.6;
    pos[i * 3 + 2] = Math.sin(a) * r - 0.4;
    speed[i] = 0.08 + Math.random() * 0.22;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.06, map: sparkTexture(), color: 0xffd08a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  scene.add(dust);

  const look = new THREE.Vector3(0, 1.25, 0);
  let baseDist = 7.4;
  stage.onResize(() => {
    baseDist = frameDistance(camera, 3.5, 2.9);
  });

  const autoSpeed = reduce ? 0 : 0.4;
  const autoOf = () => (motion.paused ? 0 : autoSpeed);
  let angVel = autoOf();
  const drag = dragRotate(canvas, {
    onDrag: (dx) => {
      turn.rotation.y += dx * 0.012;
      angVel = 0;
    },
    onRelease: (v) => {
      angVel = THREE.MathUtils.clamp(v * 12, -9, 9);
    },
    onTap: () => repaint(),
  });

  let busy = false;
  function repaint() {
    if (busy) return;
    busy = true;
    styleIndex = (styleIndex + 1) % styles.length;
    const next = styles[styleIndex];
    angVel = reduce ? 0 : 7;
    gsap.to(halo.material, { opacity: 0.95, duration: 0.2, yoyo: true, repeat: 1 });
    gsap.to(turn.scale, {
      x: 0.82, y: 0.82, z: 0.82, duration: reduce ? 0 : 0.18, ease: 'power2.in',
      onComplete: () => {
        turn.remove(model);
        disposeModel(model);
        model = buildModel(product, next);
        turn.add(model);
        onStyle?.(PALETTES[next].label);
        gsap.to(turn.scale, { x: 1, y: 1, z: 1, duration: reduce ? 0 : 0.7, ease: 'back.out(2.6)', onComplete: () => { busy = false; } });
      },
    });
  }

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  canvas.closest('section')?.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  let first = true;
  stage.onFrame((dt, t) => {
    if (!drag.dragging) {
      angVel += (autoOf() - angVel) * Math.min(1, dt * 1.4);
      turn.rotation.y += angVel * dt;
    }
    if (!reduce && !motion.paused) {
      for (let i = 0; i < count; i++) {
        let y = pos[i * 3 + 1] + speed[i] * dt;
        if (y > 3.8) y = 0;
        pos[i * 3 + 1] = y;
      }
      dustGeo.attributes.position.needsUpdate = true;
      turn.position.y = PEDESTAL_TOP + Math.sin(t * 1.2) * 0.02;
    }
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);
    camera.position.set(mouse.x * 0.6, 1.7 - mouse.y * 0.3, baseDist);
    camera.lookAt(look);
    if (first) {
      first = false;
      requestAnimationFrame(() => onFirstFrame?.());
    }
  });

  return { repaint };
}
