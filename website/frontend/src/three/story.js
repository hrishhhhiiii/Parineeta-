import * as THREE from 'three';
import { gsap } from 'gsap';
import { createStage, dragRotate, reducedMotion, motion, frameDistance } from './stage.js';
import { createPedestal, PEDESTAL_TOP } from './pedestal.js';
import { buildModel } from './models.js';
import { has3d } from '../data/products.js';
import { glowTexture } from './textures.js';

export function initStory(canvas, products) {
  const stage = createStage(canvas, { fov: 26 });
  const { scene, camera } = stage;
  const reduce = reducedMotion();

  scene.add(createPedestal());
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
  halo.scale.set(3.4, 3.4, 1);
  halo.position.set(0, 1.5, -1.5);
  scene.add(halo);

  const turn = new THREE.Group();
  turn.position.y = PEDESTAL_TOP;
  scene.add(turn);

  const slots = products.map(() => null);
  let current = -1;

  function slot(i) {
    if (!slots[i]) {
      // A product shown with photos only (3D off) leaves the pedestal empty for its chapter.
      const m = has3d(products[i]) ? buildModel(products[i], products[i].styles[0]) : new THREE.Group();
      m.scale.setScalar(0.001);
      m.visible = false;
      turn.add(m);
      slots[i] = m;
    }
    return slots[i];
  }

  function setChapter(i) {
    if (i === current || i < 0 || i >= products.length) return;
    current = i;
    slots.forEach((m, k) => {
      if (!m || k === i) return;
      gsap.killTweensOf(m.scale);
      gsap.to(m.scale, { x: 0.001, y: 0.001, z: 0.001, duration: reduce ? 0 : 0.35, ease: 'power2.in', onComplete: () => { m.visible = false; } });
    });
    const m = slot(i);
    m.visible = true;
    gsap.killTweensOf(m.scale);
    gsap.to(m.scale, { x: 1, y: 1, z: 1, duration: reduce ? 0 : 0.85, delay: reduce ? 0 : 0.2, ease: 'back.out(1.8)' });
    if (!reduce) gsap.fromTo(turn.rotation, { y: turn.rotation.y - 1.6 }, { y: turn.rotation.y, duration: 1.1, ease: 'power3.out' });
  }

  const autoSpeed = reduce ? 0 : 0.35;
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
  });

  let dist = 7;
  stage.onResize(() => {
    dist = frameDistance(camera, 3.3, 2.8);
  });
  const look = new THREE.Vector3(0, 1.25, 0);
  stage.onFrame((dt) => {
    if (!drag.dragging) {
      angVel += (autoOf() - angVel) * Math.min(1, dt * 1.4);
      turn.rotation.y += angVel * dt;
    }
    camera.position.set(0, 1.9, dist);
    camera.lookAt(look);
  });

  setChapter(0);
  return { setChapter };
}
