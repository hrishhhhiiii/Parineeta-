import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export { motion } from '../ui/motion.js';

export const isSmallScreen = () => window.matchMedia('(max-width: 767px)').matches;

/** Frames a subject of given height/width at the right distance for the canvas aspect. */
export function frameDistance(camera, h, w) {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return Math.max(h / 2 / t, w / 2 / (t * camera.aspect));
}

/** Renderer + scene + camera with visibility-aware render loop. */
export function createStage(canvas, { fov = 30, exposure = 1.05, observe = true, preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: preserve });
  renderer.debug.checkShaderErrors = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallScreen() ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xffe9cf, 0x3a0a10, 0.9);
  const key = new THREE.DirectionalLight(0xffe0b0, 2.1);
  key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight(0xff9a6a, 1.5);
  rim.position.set(-4, 3, -3);
  scene.add(hemi, key, rim);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  const frameFns = new Set();
  const resizeFns = new Set();
  let raf = 0;
  let last = 0;
  let visible = !observe;
  let enabled = true;
  let width = 0;
  let height = 0;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizeFns.forEach((f) => f(w, h));
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    resize();
    frameFns.forEach((f) => f(dt, t / 1000));
    renderer.render(scene, camera);
  }

  function update() {
    const should = visible && enabled && !document.hidden;
    if (should && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    } else if (!should && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  let io = null;
  if (observe) {
    io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      update();
    }, { rootMargin: '120px' });
    io.observe(canvas);
  }
  document.addEventListener('visibilitychange', update);
  resize();
  update();

  return {
    renderer,
    scene,
    camera,
    get size() {
      return { width, height };
    },
    onFrame: (fn) => frameFns.add(fn),
    onResize: (fn) => resizeFns.add(fn),
    setEnabled(v) {
      enabled = v;
      update();
    },
    render() {
      resize();
      renderer.render(scene, camera);
    },
  };
}

/** Pointer drag that rotates something around Y, with inertia and tap detection. */
export function dragRotate(el, { onDrag, onTap, onRelease }) {
  let down = false;
  let lastX = 0;
  let moved = 0;
  let vel = 0;
  let lastT = 0;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    down = true;
    moved = 0;
    vel = 0;
    lastX = e.clientX;
    lastT = performance.now();
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - lastX;
    const now = performance.now();
    lastX = e.clientX;
    moved += Math.abs(dx);
    vel = dx / Math.max(1, now - lastT);
    lastT = now;
    onDrag?.(dx);
  });
  const end = (e) => {
    if (!down) return;
    down = false;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (e.type === 'pointerup' && moved < 6) onTap?.(e);
    else onRelease?.(vel);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  return { get dragging() { return down; } };
}
