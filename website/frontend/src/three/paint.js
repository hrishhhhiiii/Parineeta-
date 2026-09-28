// Pure 2D canvas painting helpers (no three.js), shared by textures and page backgrounds.

export function petal(g, x, y, w, h, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  g.moveTo(0, h / 2);
  g.bezierCurveTo(w * 0.7, h * 0.25, w * 0.45, -h * 0.35, 0, -h / 2);
  g.bezierCurveTo(-w * 0.45, -h * 0.35, -w * 0.7, h * 0.25, 0, h / 2);
  g.closePath();
  g.restore();
}

export function flower(g, x, y, r, fill, center) {
  g.fillStyle = fill;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    petal(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.7, r * 1.1, a + Math.PI / 2);
    g.fill();
  }
  g.fillStyle = center;
  g.beginPath();
  g.arc(x, y, r * 0.3, 0, Math.PI * 2);
  g.fill();
}

export function drawMandala(g, cx, cy, R, pal, { strokeOnly = false } = {}) {
  const fillOr = (c) => (strokeOnly ? 'transparent' : c);
  g.lineWidth = Math.max(1.5, R * 0.012);
  g.strokeStyle = pal.accent;
  // outer dotted ring
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    g.fillStyle = strokeOnly ? pal.accent : pal.detail;
    g.beginPath();
    g.arc(cx + Math.cos(a) * R * 0.96, cy + Math.sin(a) * R * 0.96, R * 0.018, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
  g.stroke();
  // outer petals
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    petal(g, cx + Math.cos(a) * R * 0.76, cy + Math.sin(a) * R * 0.76, R * 0.1, R * 0.22, a + Math.PI / 2);
    g.fillStyle = fillOr(pal.detail);
    g.fill();
    g.stroke();
  }
  g.beginPath();
  g.arc(cx, cy, R * 0.62, 0, Math.PI * 2);
  g.stroke();
  // mid ring of lotus petals
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    petal(g, cx + Math.cos(a) * R * 0.47, cy + Math.sin(a) * R * 0.47, R * 0.14, R * 0.28, a + Math.PI / 2);
    g.fillStyle = fillOr(pal.base === pal.detail ? pal.accent : pal.detail);
    g.fill();
    g.stroke();
  }
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    g.fillStyle = pal.accent;
    g.beginPath();
    g.arc(cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3, R * 0.016, 0, Math.PI * 2);
    g.fill();
  }
  // centre lotus
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    petal(g, cx + Math.cos(a) * R * 0.13, cy + Math.sin(a) * R * 0.13, R * 0.1, R * 0.22, a + Math.PI / 2);
    g.fillStyle = fillOr(pal.detail);
    g.fill();
    g.stroke();
  }
  g.fillStyle = pal.accent;
  g.beginPath();
  g.arc(cx, cy, R * 0.05, 0, Math.PI * 2);
  g.fill();
}
