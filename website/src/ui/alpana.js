import { h, $, reduceMotion } from './dom.js';
import { toast } from './toast.js';

const PAINTS = [
  { id: 'rice', label: 'Rice paste', color: '#F6EEDB' },
  { id: 'sindoor', label: 'Sindoor red', color: '#E4434F' },
  { id: 'haldi', label: 'Haldi yellow', color: '#F2C14E' },
  { id: 'zari', label: 'Zari gold', color: '#A8741F' },
];
const FOLDS = [6, 8, 12];
const BRUSHES = [
  { id: 'fine', label: 'Fine', w: 0.007 },
  { id: 'medium', label: 'Medium', w: 0.014 },
  { id: 'bold', label: 'Bold', w: 0.026 },
];

export function initAlpana() {
  const canvas = $('#alpana-canvas');
  const ctx = canvas.getContext('2d');
  const settings = { folds: 8, paint: PAINTS[0], brush: BRUSHES[1] };
  let strokes = [];
  let size = 0;
  let current = null;
  let demoTimer = 0;

  function radioGroup(root, options, isActive, onPick, render) {
    const buttons = options.map((o) => {
      const b = h('button', { type: 'button', role: 'radio', class: 'seg__btn' }, render(o));
      b.addEventListener('click', () => {
        onPick(o);
        sync();
      });
      return b;
    });
    function sync() {
      buttons.forEach((b, i) => {
        const on = isActive(options[i]);
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
        b.classList.toggle('is-active', on);
      });
    }
    root.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const i = options.findIndex(isActive);
      const n = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      onPick(options[n]);
      sync();
      buttons[n].focus();
    });
    root.append(...buttons);
    sync();
  }

  radioGroup($('#folds'), FOLDS, (f) => f === settings.folds, (f) => { settings.folds = f; drawBackground(); redrawStrokes(); }, (f) => `${f}-fold`);
  radioGroup($('#paints'), PAINTS, (p) => p === settings.paint, (p) => { settings.paint = p; }, (p) =>
    [h('span', { class: 'swatch', style: `--a:${p.color};--b:${p.color};--c:${p.color}`, 'aria-hidden': 'true' }), h('span', { class: 'sr-only', text: p.label })]);
  radioGroup($('#brushes'), BRUSHES, (b) => b === settings.brush, (b) => { settings.brush = b; }, (b) => b.label);
  $('#paints').querySelectorAll('button').forEach((b, i) => b.setAttribute('title', PAINTS[i].label));

  function drawBackground(target = ctx, s = size) {
    const c = s / 2;
    const g = target.createRadialGradient(c, c, 0, c, c, c * 1.1);
    g.addColorStop(0, '#5C0D16');
    g.addColorStop(1, '#260509');
    target.fillStyle = g;
    target.fillRect(0, 0, s, s);
    if (target !== ctx) return;
    target.save();
    target.translate(c, c);
    target.strokeStyle = 'rgba(227,170,62,0.12)';
    target.lineWidth = 1;
    for (const r of [0.25, 0.5, 0.75, 0.96]) {
      target.beginPath();
      target.arc(0, 0, r * c, 0, Math.PI * 2);
      target.stroke();
    }
    target.strokeStyle = 'rgba(227,170,62,0.07)';
    for (let k = 0; k < settings.folds; k++) {
      const a = (k / settings.folds) * Math.PI * 2;
      target.beginPath();
      target.moveTo(0, 0);
      target.lineTo(Math.cos(a) * c * 0.96, Math.sin(a) * c * 0.96);
      target.stroke();
    }
    target.restore();
  }

  function paintStroke(st, from = 0, target = ctx, s = size) {
    const R = s / 2;
    const pts = st.pts;
    if (!pts.length) return;
    target.save();
    target.translate(R, R);
    target.lineCap = 'round';
    target.lineJoin = 'round';
    for (let k = 0; k < st.folds; k++) {
      for (const m of [1, -1]) {
        target.save();
        target.rotate((k / st.folds) * Math.PI * 2);
        target.scale(1, m);
        for (const [alpha, mult] of [[0.22, 2.1], [1, 1]]) {
          target.globalAlpha = alpha;
          target.strokeStyle = st.color;
          target.fillStyle = st.color;
          target.lineWidth = st.w * R * mult;
          if (pts.length === 1) {
            target.beginPath();
            target.arc(pts[0][0] * R, pts[0][1] * R, (st.w * R * mult) / 2, 0, Math.PI * 2);
            target.fill();
          } else {
            target.beginPath();
            const start = Math.max(0, from - 1);
            target.moveTo(pts[start][0] * R, pts[start][1] * R);
            for (let i = start + 1; i < pts.length; i++) target.lineTo(pts[i][0] * R, pts[i][1] * R);
            target.stroke();
          }
        }
        target.restore();
      }
    }
    target.restore();
  }

  function redrawStrokes() {
    for (const st of strokes) paintStroke(st);
  }

  function resize() {
    const css = canvas.clientWidth;
    if (!css) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(css * dpr);
    if (px === size) return;
    size = px;
    canvas.width = px;
    canvas.height = px;
    drawBackground();
    redrawStrokes();
  }
  new ResizeObserver(resize).observe(canvas);

  const toNorm = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = ((e.clientY - r.top) / r.height) * 2 - 1;
    return [x, y];
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    stopDemo();
    canvas.setPointerCapture(e.pointerId);
    current = { pts: [toNorm(e)], color: settings.paint.color, w: settings.brush.w, folds: settings.folds };
    strokes.push(current);
    paintStroke(current);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    const p = toNorm(e);
    const last = current.pts[current.pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.004) return;
    current.pts.push(p);
    if (current.pts.length === 2) {
      drawBackground();
      redrawStrokes();
    } else paintStroke(current, current.pts.length - 1);
  });
  const end = () => {
    current = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  /* ---------- generated patterns ---------- */
  function generate(seed) {
    let s = seed;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const folds = pick(FOLDS);
    const out = [];
    const petal = (r0, r1, bulge, color, w) => {
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.04) pts.push([r0 + (r1 - r0) * t, Math.sin(Math.PI * t) * bulge]);
      out.push({ pts, color, w, folds });
    };
    const arc = (r, amp, color, w) => {
      const pts = [];
      const span = Math.PI / folds;
      for (let t = 0; t <= 1.0001; t += 0.03) {
        const a = span * t;
        const rr = r + amp * Math.sin(t * Math.PI * 2);
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      out.push({ pts, color, w, folds });
    };
    const dot = (r, a, color, w) => out.push({ pts: [[Math.cos(a) * r, Math.sin(a) * r]], color, w: w * 2.4, folds });
    const c1 = PAINTS[0].color;
    const c2 = pick(PAINTS.slice(1)).color;
    const c3 = pick(PAINTS).color;
    dot(0.05, 0, c2, 0.012);
    petal(0.08, 0.3, 0.05 + rand() * 0.05, c1, 0.012);
    dot(0.34, 0, c2, 0.01);
    arc(0.4, 0.02 + rand() * 0.03, c3, 0.008);
    petal(0.44, 0.7, 0.06 + rand() * 0.07, c1, 0.014);
    petal(0.5, 0.64, 0.025, c2, 0.008);
    arc(0.76, 0.02, c1, 0.007);
    dot(0.84, 0.12, c3, 0.01);
    petal(0.86, 0.95, 0.04, c1, 0.008);
    return { strokes: out, folds };
  }

  function stopDemo() {
    cancelAnimationFrame(demoTimer);
    demoTimer = 0;
  }

  function play(pattern) {
    stopDemo();
    strokes = [];
    settings.folds = pattern.folds;
    $('#folds').querySelectorAll('button').forEach((b, i) => {
      const on = FOLDS[i] === pattern.folds;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('is-active', on);
    });
    drawBackground();
    if (reduceMotion()) {
      strokes = pattern.strokes;
      redrawStrokes();
      return;
    }
    const queue = pattern.strokes.map((st) => ({ src: st, drawn: { ...st, pts: [] } }));
    let qi = 0;
    const tick = () => {
      const item = queue[qi];
      if (!item) {
        demoTimer = 0;
        return;
      }
      if (!item.drawn.pts.length) strokes.push(item.drawn);
      for (let n = 0; n < 3 && item.drawn.pts.length < item.src.pts.length; n++) item.drawn.pts.push(item.src.pts[item.drawn.pts.length]);
      paintStroke(item.drawn, Math.max(0, item.drawn.pts.length - 3));
      if (item.drawn.pts.length >= item.src.pts.length) qi++;
      demoTimer = requestAnimationFrame(tick);
    };
    demoTimer = requestAnimationFrame(tick);
  }

  $('#alp-surprise').addEventListener('click', () => play(generate(Math.floor(Math.random() * 1e6) + 1)));
  $('#alp-undo').addEventListener('click', () => {
    stopDemo();
    strokes.pop();
    drawBackground();
    redrawStrokes();
  });
  $('#alp-clear').addEventListener('click', () => {
    stopDemo();
    if (!strokes.length) return;
    const previous = strokes;
    strokes = [];
    drawBackground();
    toast('Canvas cleared.', {
      iconName: 'eraser',
      action: 'Undo',
      onAction: () => {
        strokes = previous;
        drawBackground();
        redrawStrokes();
      },
    });
  });
  $('#alp-save').addEventListener('click', () => {
    const out = document.createElement('canvas');
    const s = 1600;
    out.width = s;
    out.height = s;
    const o = out.getContext('2d');
    drawBackground(o, s);
    for (const st of strokes) paintStroke(st, 0, o, s);
    o.font = '600 28px "Plus Jakarta Sans", sans-serif';
    o.fillStyle = 'rgba(246,238,219,0.55)';
    o.textAlign = 'right';
    o.fillText('Drawn with Parineeta, Patuli', s - 40, s - 40);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = h('a', { href: URL.createObjectURL(blob), download: 'my-alpana.png' });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Your alpana has been saved as an image.');
    }, 'image/png');
  });

  resize();
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    if (!strokes.length) play(generate(20260925));
  }, { threshold: 0.4 });
  io.observe(canvas);
}
