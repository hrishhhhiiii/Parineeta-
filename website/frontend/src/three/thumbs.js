import { createStage } from './stage.js';
import { buildModel, disposeModel } from './models.js';

const W = 360;
const H = 440;
let stage = null;
let queue = Promise.resolve();
const cache = new Map();

function ensure() {
  if (stage) return stage;
  const canvas = document.createElement('canvas');
  stage = createStage(canvas, { fov: 26, observe: false, preserve: true, exposure: 1.1 });
  stage.setEnabled(false);
  stage.renderer.setPixelRatio(1);
  stage.renderer.setSize(W, H, false);
  stage.camera.aspect = W / H;
  stage.camera.updateProjectionMatrix();
  stage.camera.position.set(0, 1.7, 5.6);
  stage.camera.lookAt(0, 1.02, 0);
  return stage;
}

/** Returns a data URL of a studio render of the product in a given colourway. */
export function getThumb(product, styleId = product.styles[0], { scale = 1 } = {}) {
  const key = `${product.id}:${styleId}:${scale}`;
  if (cache.has(key)) return cache.get(key);
  const job = queue.then(async () => {
    const s = ensure();
    const model = buildModel(product, styleId);
    model.rotation.y = -0.45;
    s.scene.add(model);
    await model.userData.ready;
    s.renderer.setSize(W * scale, H * scale, false);
    s.renderer.render(s.scene, s.camera);
    const url = s.renderer.domElement.toDataURL(scale > 1 ? 'image/png' : 'image/webp', 0.9);
    if (scale !== 1) s.renderer.setSize(W, H, false);
    s.scene.remove(model);
    disposeModel(model);
    await new Promise((r) => setTimeout(r, 0));
    return url;
  }).catch(() => '');
  queue = job;
  cache.set(key, job);
  return job;
}
