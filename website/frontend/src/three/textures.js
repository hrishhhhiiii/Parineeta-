import * as THREE from 'three';
import { petal, flower, drawMandala } from './paint.js';

const cache = new Map();

function canvasTexture(key, w, h, draw, { wrapS = THREE.RepeatWrapping, color = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = wrapS;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

// Deterministic pseudo-random so every build of a piece looks the same.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const BAND_DRAW = {
  gold(g, w, y, h, p) {
    g.fillStyle = p.accent;
    g.fillRect(0, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, y + h * 0.2, w, Math.max(1, h * 0.12));
  },
  dots(g, w, y, h, p, n = 48) {
    g.fillStyle = p.detail;
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.arc((i + 0.5) * (w / n), y + h / 2, h * 0.24, 0, Math.PI * 2);
      g.fill();
    }
  },
  petals(g, w, y, h, p, n = 24) {
    const cw = w / n;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * cw;
      g.fillStyle = p.detail;
      petal(g, x, y + h * 0.52, cw * 0.95, h * 0.9);
      g.fill();
      g.lineWidth = Math.max(1.5, h * 0.05);
      g.strokeStyle = p.accent;
      g.stroke();
      g.fillStyle = p.base;
      petal(g, x, y + h * 0.6, cw * 0.4, h * 0.42);
      g.fill();
    }
  },
  vine(g, w, y, h, p, n = 8) {
    g.fillStyle = p.deep;
    g.fillRect(0, y, w, h);
    const cw = w / n;
    g.strokeStyle = p.accent;
    g.lineWidth = Math.max(2, h * 0.05);
    g.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const yy = y + h / 2 + Math.sin((x / cw) * Math.PI * 2) * h * 0.22;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
    for (let i = 0; i < n * 2; i++) {
      const x = (i + 0.25) * (cw / 2);
      const up = i % 2 === 0;
      g.fillStyle = p.leaf;
      petal(g, x, y + h / 2 + (up ? -h * 0.18 : h * 0.18), h * 0.18, h * 0.34, up ? -0.6 : 0.6 + Math.PI);
      g.fill();
    }
    for (let i = 0; i < n; i++) {
      flower(g, (i + 0.5) * cw, y + h / 2, h * 0.24, p.detail, p.accent);
    }
  },
  lotus(g, w, y, h, p, n = 12) {
    const cw = w / n;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * cw;
      const by = y + h * 0.82;
      g.fillStyle = p.detail;
      petal(g, x, by - h * 0.32, cw * 0.28, h * 0.62);
      g.fill();
      petal(g, x - cw * 0.17, by - h * 0.22, cw * 0.22, h * 0.48, -0.55);
      g.fill();
      petal(g, x + cw * 0.17, by - h * 0.22, cw * 0.22, h * 0.48, 0.55);
      g.fill();
      g.strokeStyle = p.accent;
      g.lineWidth = Math.max(1.5, h * 0.035);
      petal(g, x, by - h * 0.32, cw * 0.28, h * 0.62);
      g.stroke();
      g.fillStyle = p.accent;
      g.fillRect(x - cw * 0.3, by, cw * 0.6, h * 0.06);
    }
  },
  chevron(g, w, y, h, p, n = 32) {
    const cw = w / n;
    g.fillStyle = p.detail;
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.moveTo(i * cw, y + h);
      g.lineTo(i * cw + cw / 2, y);
      g.lineTo((i + 1) * cw, y + h);
      g.closePath();
      g.fill();
    }
  },
};

const SEQUENCES = {
  default: [['gold', 0.02], ['dots', 0.05], ['gold', 0.015], ['petals', 0.12], ['vine', 0.2], ['gold', 0.02], ['lotus', 0.16], ['gold', 0.015], ['chevron', 0.04], ['dots', 0.05], ['vine', 0.18], ['gold', 0.02], ['petals', 0.1]],
  small: [['gold', 0.03], ['dots', 0.08], ['petals', 0.2], ['gold', 0.03], ['vine', 0.32], ['gold', 0.03], ['lotus', 0.25], ['gold', 0.03]],
  ring: [['gold', 0.1], ['dots', 0.2], ['vine', 0.4], ['dots', 0.2], ['gold', 0.1]],
  shola: [['gold', 0.015], ['dots', 0.04], ['petals', 0.1], ['gold', 0.01], ['chevron', 0.05], ['dots', 0.04], ['lotus', 0.14], ['gold', 0.015], ['petals', 0.1], ['dots', 0.04], ['chevron', 0.05], ['gold', 0.015]],
};

/** Horizontal painted bands; wraps seamlessly around lathe geometry. Canvas top = top of object. */
export function bandTexture(pal, variant = 'default') {
  const key = `band:${variant}:${pal.base}:${pal.accent}:${pal.detail}`;
  return canvasTexture(key, 1024, 1024, (g, w, h) => {
    g.fillStyle = pal.base;
    g.fillRect(0, 0, w, h);
    const seq = SEQUENCES[variant] || SEQUENCES.default;
    const total = seq.reduce((s, [, f]) => s + f, 0);
    const gap = (1 - total) / (seq.length + 1);
    let y = gap * h;
    for (const [kind, f] of seq) {
      const bh = f * h;
      BAND_DRAW[kind](g, w, y, bh, pal);
      y += bh + gap * h;
    }
    // subtle brush grain
    const r = rng(7);
    g.globalAlpha = 0.05;
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = r() > 0.5 ? '#000' : '#fff';
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1);
    }
    g.globalAlpha = 1;
  });
}

/** Kunke wall: sindoor-red drum painted with white feather scrolls between dotted borders, like the shop's own. */
export function kunkeTexture(pal) {
  return canvasTexture(`kunke:${pal.base}:${pal.accent}:${pal.detail}`, 2048, 320, (g, w, h) => {
    g.fillStyle = pal.base;
    g.fillRect(0, 0, w, h);
    // dotted borders top and bottom, each between two fine lines
    for (const y of [h * 0.08, h * 0.92]) {
      g.fillStyle = pal.detail;
      g.fillRect(0, y - h * 0.055, w, h * 0.012);
      g.fillRect(0, y + h * 0.043, w, h * 0.012);
      for (let x = 10; x < w; x += 26) {
        g.beginPath();
        g.arc(x, y, h * 0.022, 0, Math.PI * 2);
        g.fill();
      }
    }
    // feathers: curved quills combed on both sides, leaning alternately, packed close like the hand-painted ones
    const n = 16;
    const cw = w / n;
    const top = h * 0.2;
    const bot = h * 0.8;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x0 = i * cw + cw * 0.2;
      const lean = i % 2 ? -1 : 1;
      const pt = (t) => ({
        x: x0 + cw * 0.6 * t,
        y: bot - (bot - top) * t + Math.sin(t * Math.PI) * (bot - top) * 0.22 * lean,
      });
      g.strokeStyle = pal.detail;
      g.lineWidth = h * 0.022;
      g.beginPath();
      for (let k = 0; k <= 40; k++) {
        const q = pt(k / 40);
        if (k === 0) g.moveTo(q.x, q.y);
        else g.lineTo(q.x, q.y);
      }
      g.stroke();
      g.lineWidth = h * 0.009;
      for (let k = 2; k < 39; k++) {
        const a = pt(k / 40);
        const b = pt((k + 1) / 40);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const reach = h * (0.04 + 0.09 * Math.sin((k / 40) * Math.PI));
        for (const side of [1, -1]) {
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(a.x + (-dy / len) * reach * side + (dx / len) * reach * 0.7, a.y + (dx / len) * reach * side + (dy / len) * reach * 0.7);
          g.stroke();
        }
      }
      g.fillStyle = pal.accent;
      const c = pt(0.08);
      g.beginPath();
      g.arc(c.x, c.y, h * 0.026, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Kunke rims: plain red bands with one row of white dots. */
export function kunkeRimTexture(pal) {
  return canvasTexture(`kunke-rim:${pal.base}:${pal.detail}`, 1024, 64, (g, w, h) => {
    g.fillStyle = pal.base;
    g.fillRect(0, 0, w, h);
    g.fillStyle = pal.detail;
    for (let x = 8; x < w; x += 16) {
      g.beginPath();
      g.arc(x, h / 2, h * 0.14, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Khoi daan kulo face: deep velvet with a white feathered border following the arch and a kalka in the middle. */
export const KULO_SIZE = { w: 960, h: 1280 };
export function kuloTexture(pal) {
  const { w, h } = KULO_SIZE;
  return canvasTexture(`kulo:${pal.base}:${pal.detail}`, w, h, (g) => {
    const R = w / 2;
    // the arch outline, inset by d: semicircular top, straight sides
    const arch = (d) => {
      g.beginPath();
      g.moveTo(d, h);
      g.lineTo(d, R);
      g.arc(R, R, R - d, Math.PI, 0);
      g.lineTo(w - d, h);
    };
    const along = (d, t) => {
      // t in 0..1 along the arch at inset d: left side up, over the top, right side down
      const side = h - R;
      const top = Math.PI * (R - d);
      const total = side * 2 + top;
      let s = t * total;
      if (s < side) return { x: d, y: h - s, a: -Math.PI / 2 };
      s -= side;
      if (s < top) {
        const ang = Math.PI + (s / top) * Math.PI;
        return { x: R + Math.cos(ang) * (R - d), y: R + Math.sin(ang) * (R - d), a: ang + Math.PI / 2 };
      }
      s -= top;
      return { x: w - d, y: R + s, a: Math.PI / 2 };
    };
    const grd = g.createRadialGradient(R, h * 0.45, 40, R, h * 0.45, h * 0.75);
    grd.addColorStop(0, pal.base);
    grd.addColorStop(1, pal.deep);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = pal.detail;
    g.fillStyle = pal.detail;
    // feathered border: leaves combed along the arch, leaning the same way, between two white lines
    g.lineWidth = 6;
    arch(28);
    g.stroke();
    arch(170);
    g.stroke();
    for (let i = 0; i < 40; i++) {
      const p = along(99, (i + 0.5) / 40);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.a + 0.55);
      petal(g, 0, 0, 52, 124);
      g.fill();
      g.strokeStyle = pal.base;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 58);
      g.lineTo(0, -54);
      for (let k = -44; k < 54; k += 11) {
        g.moveTo(0, k);
        g.lineTo(15, k - 11);
        g.moveTo(0, k);
        g.lineTo(-15, k - 11);
      }
      g.stroke();
      g.restore();
    }
    // a row of dots inside the border
    for (let i = 0; i < 90; i++) {
      const p = along(196, (i + 0.5) / 90);
      g.beginPath();
      g.arc(p.x, p.y, 5, 0, Math.PI * 2);
      g.fill();
    }
    // the kalka (paisley) in the middle, over two curling scrolls
    const cx = R;
    const cy = h * 0.5;
    g.lineWidth = 7;
    g.strokeStyle = pal.detail;
    petal(g, cx, cy, 250, 380);
    g.stroke();
    petal(g, cx, cy + 18, 190, 300);
    g.stroke();
    // the kalka's filling: tiers of small leaves
    for (let row = 0; row < 6; row++) {
      const y = cy + 100 - row * 40;
      const n = row < 2 ? 3 : row < 4 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const x = cx + (k - (n - 1) / 2) * 44;
        petal(g, x, y, 22, 40);
        g.fill();
      }
    }
    g.beginPath();
    g.moveTo(cx, cy - 190);
    g.lineTo(cx, cy - 235);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy - 246, 14, 0, Math.PI * 2);
    g.fill();
    for (const s of [-1, 1]) {
      g.beginPath();
      for (let t = 0; t <= 1.001; t += 0.02) {
        const ang = t * Math.PI * 3.2;
        const r = 95 * (1 - t * 0.8);
        const x = cx + s * (110 + Math.cos(ang) * r);
        const y = cy + 230 - Math.sin(ang) * r;
        if (t === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      for (let k = 0; k < 9; k++) {
        petal(g, cx + s * (40 + k * 30), cy + 360, 16, 40, s * 0.5);
        g.fill();
      }
    }
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx - 280, cy + 330);
    g.lineTo(cx + 280, cy + 330);
    g.stroke();
  });
}

/** Alpana panel: frame border plus central mandala. */
export function alpanaTexture(pal, w = 1024, h = 1024, { bg = null, frame = true } = {}) {
  const key = `alpana:${w}x${h}:${pal.base}:${pal.detail}:${bg}:${frame}`;
  return canvasTexture(key, w, h, (g) => {
    g.fillStyle = bg || pal.base;
    g.fillRect(0, 0, w, h);
    const m = Math.min(w, h);
    if (!frame) {
      drawMandala(g, w / 2, h / 2, m * 0.47, pal);
      return;
    }
    g.strokeStyle = pal.accent;
    g.lineWidth = m * 0.012;
    g.strokeRect(m * 0.04, m * 0.04, w - m * 0.08, h - m * 0.08);
    g.lineWidth = m * 0.004;
    g.strokeRect(m * 0.065, m * 0.065, w - m * 0.13, h - m * 0.13);
    const n = Math.round(w / (m * 0.06));
    for (let i = 0; i < n; i++) {
      const x = m * 0.08 + (i + 0.5) * ((w - m * 0.16) / n);
      g.fillStyle = pal.detail;
      g.beginPath();
      g.arc(x, m * 0.052, m * 0.008, 0, Math.PI * 2);
      g.arc(x, h - m * 0.052, m * 0.008, 0, Math.PI * 2);
      g.fill();
    }
    drawMandala(g, w / 2, h / 2, m * 0.4, pal);
  });
}

/** Faint gold floor pattern on transparent background. */
export function floorTexture() {
  return canvasTexture('floor', 2048, 2048, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const pal = { base: '#000', detail: 'transparent', accent: 'rgba(227,170,62,0.55)' };
    g.globalAlpha = 0.9;
    drawMandala(g, w / 2, h / 2, w * 0.46, pal, { strokeOnly: true });
    g.globalAlpha = 1;
  }, { wrapS: THREE.ClampToEdgeWrapping });
}

export function glowTexture() {
  return canvasTexture('glow', 256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,214,140,0.85)');
    grd.addColorStop(0.3, 'rgba(227,150,60,0.32)');
    grd.addColorStop(0.62, 'rgba(160,40,30,0.08)');
    grd.addColorStop(0.9, 'rgba(120,20,20,0)');
    grd.addColorStop(1, 'rgba(120,20,20,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, { wrapS: THREE.ClampToEdgeWrapping });
}

export function sparkTexture() {
  return canvasTexture('spark', 64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,240,200,1)');
    grd.addColorStop(0.3, 'rgba(255,200,110,0.6)');
    grd.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, { wrapS: THREE.ClampToEdgeWrapping });
}

/** Grey-scale relief for sholapith (used as bump map). */
export function sholaBump() {
  return canvasTexture('shola', 512, 512, (g, w, h) => {
    g.fillStyle = '#9a9a9a';
    g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 5000; i++) {
      const v = Math.floor(120 + r() * 120);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    for (let y = 20; y < h; y += 42) {
      for (let x = 20; x < w; x += 42) {
        g.beginPath();
        g.arc(x, y, 9, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }, { color: false });
}

// Shared outline so the texture lines up with the geometry (see models.js).
export const LEAF_BOUNDS = { minX: -1, maxX: 1, minY: -0.98, maxY: 1.05 };
export function leafPath(g, map) {
  const P = (x, y) => map(x, y);
  g.beginPath();
  g.moveTo(...P(0, -0.55));
  g.bezierCurveTo(...P(0.25, -0.95), ...P(1.0, -0.9), ...P(0.95, -0.3));
  g.bezierCurveTo(...P(0.9, 0.3), ...P(0.3, 0.7), ...P(0, 1.05));
  g.bezierCurveTo(...P(-0.3, 0.7), ...P(-0.9, 0.3), ...P(-0.95, -0.3));
  g.bezierCurveTo(...P(-1.0, -0.9), ...P(-0.25, -0.95), ...P(0, -0.55));
  g.closePath();
}

export function leafTexture(pal) {
  const key = `leaf:${pal.base}:${pal.detail}`;
  return canvasTexture(key, 1024, 1024, (g, w, h) => {
    const B = LEAF_BOUNDS;
    const map = (x, y, s = 1) => [((x * s - B.minX) / (B.maxX - B.minX)) * w, h - ((y * s - B.minY + (1 - s) * 0.05) / (B.maxY - B.minY)) * h];
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, pal.accent);
    grd.addColorStop(0.5, pal.base);
    grd.addColorStop(1, pal.deep);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // veins
    g.strokeStyle = pal.deep;
    g.globalAlpha = 0.55;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(...map(0, -0.55));
    g.quadraticCurveTo(...map(0.03, 0.25), ...map(0, 1.0));
    g.stroke();
    g.lineWidth = 4;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const y0 = -0.45 + i * 0.26;
        g.beginPath();
        g.moveTo(...map(0, y0));
        g.quadraticCurveTo(...map(s * 0.35, y0 + 0.12), ...map(s * (0.72 - i * 0.1), y0 + 0.34));
        g.stroke();
      }
    }
    g.globalAlpha = 1;
    // chandan dots inset along the edge
    g.fillStyle = pal.detail;
    const pts = [];
    const bez = (p0, p1, p2, p3, t) => {
      const u = 1 - t;
      return [
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ];
    };
    const segs = [
      [[0, -0.55], [0.25, -0.95], [1.0, -0.9], [0.95, -0.3]],
      [[0.95, -0.3], [0.9, 0.3], [0.3, 0.7], [0, 1.05]],
      [[0, 1.05], [-0.3, 0.7], [-0.9, 0.3], [-0.95, -0.3]],
      [[-0.95, -0.3], [-1.0, -0.9], [-0.25, -0.95], [0, -0.55]],
    ];
    for (const s of segs) for (let t = 0.04; t < 1; t += 0.06) pts.push(bez(...s, t));
    for (const [x, y] of pts) {
      g.beginPath();
      g.arc(...map(x * 0.84, y * 0.84 + 0.03), 9, 0, Math.PI * 2);
      g.fill();
    }
    // central paisley
    g.save();
    g.translate(...map(-0.08, 0.1));
    g.rotate(-0.4);
    g.strokeStyle = pal.detail;
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(0, 0, 70, 120, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = pal.detail;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * 42, Math.sin(a) * 80, 6, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  });
}

export const KURTA_BOUNDS = { minX: -1.29, maxX: 1.29, minY: -1.04, maxY: 1.29 };
export function fabricTexture(pal) {
  const key = `fabric:${pal.base}:${pal.detail}`;
  return canvasTexture(key, 1024, 1024, (g, w, h) => {
    const B = KURTA_BOUNDS;
    const X = (x) => ((x - B.minX) / (B.maxX - B.minX)) * w;
    const Y = (y) => h - ((y - B.minY) / (B.maxY - B.minY)) * h;
    g.fillStyle = pal.base;
    g.fillRect(0, 0, w, h);
    // weave
    g.globalAlpha = 0.06;
    g.fillStyle = '#000';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    g.globalAlpha = 1;
    // hem border
    const hemTop = Y(-0.66);
    const hemH = Y(-1.0) - hemTop;
    BAND_DRAW.gold(g, w, hemTop, hemH * 0.07, pal);
    BAND_DRAW.vine(g, w, hemTop + hemH * 0.12, hemH * 0.56, { ...pal, deep: pal.base }, 6);
    BAND_DRAW.petals(g, w, hemTop + hemH * 0.7, hemH * 0.22, pal, 18);
    // placket
    const px = X(0);
    const pw = w * 0.07;
    g.fillStyle = pal.deep;
    g.fillRect(px - pw / 2, Y(1.0), pw, Y(0.2) - Y(1.0));
    for (let y = Y(0.96); y < Y(0.26); y += pw * 0.9) flower(g, px, y, pw * 0.34, pal.detail, pal.accent);
    // buttis
    const r = rng(3);
    for (let y = -0.52; y < 0.9; y += 0.28) {
      for (let x = -0.55; x <= 0.56; x += 0.26) {
        if (Math.abs(x) < 0.16) continue;
        const jx = x + (r() - 0.5) * 0.05;
        const jy = y + ((Math.round((x + 1) * 4) % 2) * 0.14);
        if (jy > 0.95) continue;
        flower(g, X(jx), Y(jy), w * 0.018, pal.detail, pal.accent);
      }
    }
    // cuffs
    for (const s of [-1, 1]) {
      g.save();
      g.translate(X(s * 1.12), Y(0.52));
      g.rotate(s * -0.8);
      g.fillStyle = pal.deep;
      g.fillRect(-w * 0.07, -w * 0.025, w * 0.14, w * 0.05);
      g.fillStyle = pal.detail;
      for (let i = -3; i <= 3; i++) {
        g.beginPath();
        g.arc(i * w * 0.018, 0, w * 0.006, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    // neckline dots
    g.fillStyle = pal.accent;
    for (let t = 0; t <= 1; t += 0.08) {
      const x = -0.2 + 0.4 * t;
      const y = 1.22 - Math.sin(t * Math.PI) * 0.26;
      g.beginPath();
      g.arc(X(x), Y(y), w * 0.006, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Sabeki woven mat with painted border, as in the shop's backdrop. */
export function matTexture(pal) {
  const key = `mat:${pal.base}`;
  return canvasTexture(key, 1536, 1024, (g, w, h) => {
    g.fillStyle = '#E6D6AE';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 5) {
      g.fillStyle = y % 10 === 0 ? 'rgba(120,90,40,0.12)' : 'rgba(255,255,255,0.12)';
      g.fillRect(0, y, w, 2);
    }
    const inset = (i) => [i, i, w - i * 2, h - i * 2];
    const B = 120;
    g.fillStyle = pal.base;
    g.fillRect(...inset(0));
    g.fillStyle = '#F0BE3E';
    g.fillRect(...inset(14));
    g.fillStyle = pal.base;
    g.fillRect(...inset(24));
    g.fillStyle = '#F0BE3E';
    g.fillRect(...inset(B));
    g.fillStyle = '#E6D6AE';
    g.fillRect(...inset(B + 12));
    for (let y = B + 12; y < h - B - 12; y += 5) {
      g.fillStyle = y % 10 === 0 ? 'rgba(120,90,40,0.12)' : 'rgba(255,255,255,0.12)';
      g.fillRect(B + 12, y, w - (B + 12) * 2, 2);
    }
    // white scrollwork inside the red border
    g.strokeStyle = '#FFFDF5';
    g.fillStyle = '#FFFDF5';
    g.lineWidth = 7;
    const mid = (24 + B) / 2;
    const scroll = (x, y, s, flip, rot = 0) => {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.beginPath();
      g.arc(0, 0, s, flip ? 0 : Math.PI, flip ? Math.PI * 1.7 : Math.PI * 2.7);
      g.stroke();
      petal(g, (flip ? s : -s) * 0.95, -s * 0.9, s * 0.62, s * 1.3, flip ? 0.7 : -0.7);
      g.fill();
      g.beginPath();
      g.arc(0, 0, s * 0.28, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    let k = 0;
    for (let x = B; x < w - B + 1; x += 64) {
      scroll(x, mid, 24, k % 2 === 0);
      scroll(x, h - mid, 24, k % 2 === 1, Math.PI);
      k++;
    }
    k = 0;
    for (let y = B + 40; y < h - B - 20; y += 64) {
      scroll(mid, y, 24, k % 2 === 0, -Math.PI / 2);
      scroll(w - mid, y, 24, k % 2 === 1, Math.PI / 2);
      k++;
    }
    // inner filigree along the mat edge
    g.lineWidth = 4;
    for (let x = B + 50; x < w - B - 30; x += 46) {
      petal(g, x, B + 42, 16, 30, 0);
      g.stroke();
      petal(g, x, h - B - 42, 16, 30, Math.PI);
      g.stroke();
    }
    // central temple motif
    g.fillStyle = pal.base;
    g.beginPath();
    g.moveTo(w / 2, h * 0.3);
    g.lineTo(w * 0.72, h * 0.72);
    g.lineTo(w * 0.28, h * 0.72);
    g.closePath();
    g.fill();
    g.fillStyle = '#F0BE3E';
    g.beginPath();
    g.moveTo(w / 2, h * 0.38);
    g.lineTo(w * 0.66, h * 0.68);
    g.lineTo(w * 0.34, h * 0.68);
    g.closePath();
    g.fill();
    g.fillStyle = '#FFFDF5';
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      g.beginPath();
      g.arc(w * 0.38 + t * w * 0.24, h * 0.64, 7, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI;
      g.beginPath();
      g.arc(w / 2 + Math.cos(a) * w * 0.3, h * 0.72 - Math.sin(a) * h * 0.46, 8, 0, Math.PI * 2);
      g.fill();
    }
  }, { wrapS: THREE.ClampToEdgeWrapping });
}

