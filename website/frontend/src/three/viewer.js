import * as THREE from 'three';
import { gsap } from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStage, reducedMotion, motion } from './stage.js';
import { createPedestal, PEDESTAL_TOP } from './pedestal.js';
import { buildModel, disposeModel } from './models.js';
import { glowTexture } from './textures.js';

export function createViewer(canvas) {
  const stage = createStage(canvas, { fov: 28, observe: false });
  stage.setEnabled(false);
  const { scene, camera } = stage;
  const reduce = reducedMotion();

  scene.add(createPedestal());
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 }));
  halo.scale.set(3.4, 3.4, 1);
  halo.position.set(0, 1.5, -1.6);
  scene.add(halo);

  const holder = new THREE.Group();
  holder.position.y = PEDESTAL_TOP;
  scene.add(holder);

  camera.position.set(0, 2.1, 6.8);
  // A plain mouse wheel scrolls the page or panel; Ctrl + wheel (and a trackpad pinch) zooms the model.
  canvas.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation(); }, { capture: true });
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.35, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3.4;
  controls.maxDistance = 10;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.autoRotate = !reduce && !motion.paused;
  motion.listeners.add((paused) => {
    controls.autoRotate = !reduce && !paused;
  });
  controls.autoRotateSpeed = 1.4;
  controls.update();
  stage.onFrame(() => controls.update());

  let model = null;
  let key = '';

  return {
    show(product, styleId) {
      const k = `${product.id}:${styleId}`;
      if (k === key) return;
      const sameProduct = key.startsWith(`${product.id}:`);
      key = k;
      if (model) {
        holder.remove(model);
        disposeModel(model);
      }
      model = buildModel(product, styleId);
      holder.add(model);
      if (!sameProduct) {
        camera.position.set(0, 2.1, 6.8);
        controls.target.set(0, 1.35, 0);
      }
      if (!reduce) gsap.from(model.scale, { x: 0.85, y: 0.85, z: 0.85, duration: 0.5, ease: 'back.out(2)' });
    },
    start() {
      stage.setEnabled(true);
    },
    stop() {
      stage.setEnabled(false);
    },
  };
}
