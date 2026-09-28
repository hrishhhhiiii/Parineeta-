import { byId } from '../data/products.js';
import { drawMandala, petal } from '../three/paint.js';
import { h, $, reduceMotion } from './dom.js';
import { openEnquiry } from './enquiry.js';
import { toast } from './toast.js';

const FORMATS = [
  { id: 'card', label: 'Invitation card', w: 1500, h: 2100, file: 'invitation-card', size: '5 × 7 in, print ready at 300 dpi' },
  { id: 'poster', label: 'Poster', w: 1654, h: 2339, file: 'wedding-poster', size: 'A-series poster, 1654 × 2339 px' },
  { id: 'story', label: 'Phone story', w: 1080, h: 1920, file: 'wedding-story', size: 'Instagram or WhatsApp story, 1080 × 1920 px' },
  { id: 'square', label: 'Square post', w: 1440, h: 1440, file: 'wedding-post', size: 'Square social post, 1440 × 1440 px' },
];

const OCCASIONS = [
  { id: 'wedding', label: 'Wedding', bn: 'শুভ বিবাহ', en: 'Shubho Bibaho', after: 'invite you to celebrate their wedding' },
  { id: 'boubhaat', label: 'Bou Bhaat', bn: 'বউভাত', en: 'The Reception', after: 'invite you to their Bou Bhaat reception' },
  { id: 'aiburobhat', label: 'Aiburobhat', bn: 'আইবুড়োভাত', en: 'Aiburobhat', after: 'invite you to the Aiburobhat feast' },
  { id: 'save', label: 'Save the date', bn: 'শুভ পরিণয়', en: 'Save the date', after: 'are getting married' },
];

const THEMES = [
  { id: 'crimson', label: 'Crimson', bg: ['#6e0e1a', '#26030a'], ink: '#F8EACB', accent: '#E8B24C', orn: '#E3AA3E', muted: 'rgba(248,234,203,0.74)', band: '#E3AA3E', bandInk: '#5A0B14', glow: 'rgba(240,190,90,0.35)', swatch: ['#6e0e1a', '#E3AA3E'] },
  { id: 'ivory', label: 'Ivory', bg: ['#FFF9EC', '#EEDCB6'], ink: '#4D050C', accent: '#A8161F', orn: '#B8862A', muted: 'rgba(77,5,12,0.72)', band: '#A8161F', bandInk: '#FFF4DE', glow: 'rgba(255,255,255,0.7)', swatch: ['#FBF1DC', '#A8161F'] },
  { id: 'haldi', label: 'Haldi', bg: ['#FBD669', '#E39B1B'], ink: '#48060C', accent: '#A8161F', orn: '#FFF6DE', muted: 'rgba(72,6,12,0.78)', band: '#A8161F', bandInk: '#FFF4DE', glow: 'rgba(255,248,220,0.6)', swatch: ['#F6C443', '#A8161F'] },
  { id: 'peacock', label: 'Peacock', bg: ['#1A5E86', '#061A29'], ink: '#F5EBD3', accent: '#E8B24C', orn: '#E3AA3E', muted: 'rgba(245,235,211,0.74)', band: '#E3AA3E', bandInk: '#0E3550', glow: 'rgba(240,190,90,0.3)', swatch: ['#15557A', '#E3AA3E'] },
];

const LAYOUTS = [
  { id: 'mandala', label: 'Mandala' },
  { id: 'arch', label: 'Temple arch' },
  { id: 'border', label: 'Painted border' },
];

const MOTIFS = [
  { id: 'crowns', label: 'Topor and mukut', items: ['topor', 'shola-mukut'], styleKey: 'crown' },
  { id: 'kouto', label: 'Gach kouto', items: ['gach-kouto'], styleKey: 'kouto' },
  { id: 'leaves', label: 'Paan leaves', items: ['paan-pata'], styleKey: 'leaf' },
  { id: 'alpana', label: 'Alpana' },
  { id: 'none', label: 'None' },
];

const MOTIF_STYLE = {
  crimson: { kouto: 'sindoor', crown: 'zari', leaf: 'zari' },
  ivory: { kouto: 'sindoor', crown: 'sindoor', leaf: 'zari' },
  haldi: { kouto: 'haldi', crown: 'sindoor', leaf: 'leaf' },
  peacock: { kouto: 'peacock', crown: 'peacock', leaf: 'zari' },
};

const LOOKS = [
  { id: 'royal', label: 'Rajwadi royal', theme: 'crimson', layout: 'mandala', motif: 'crowns' },
  { id: 'shola', label: 'Shola classic', theme: 'ivory', layout: 'arch', motif: 'crowns' },
  { id: 'haldi', label: 'Haldi festive', theme: 'haldi', layout: 'border', motif: 'leaves' },
  { id: 'peacock', label: 'Peacock night', theme: 'peacock', layout: 'arch', motif: 'kouto' },
  { id: 'alpana', label: 'Quiet alpana', theme: 'ivory', layout: 'mandala', motif: 'alpana' },
  { id: 'sindoor', label: 'Sindoor border', theme: 'crimson', layout: 'border', motif: 'kouto' },
];

const find = (list, id) => list.find((x) => x.id === id) || list[0];

function defaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 100);
  return d.toISOString().slice(0, 10);
}

const state = {
  format: 'card',
  occasion: 'wedding',
  theme: 'crimson',
  layout: 'mandala',
  motif: 'crowns',
  bride: 'Riya',
  groom: 'Arjun',
  date: defaultDate(),
  time: '7:00 pm onwards',
  venue: 'Rajbari Hall, Patuli, West Bengal',
  host: 'Together with their families',
  note: '',
};

/* ---------------- motif images (3D renders from the collection) ---------------- */
const motifCache = new Map();
let onMotifReady = () => {};

function motifEntry(st) {
  const motif = find(MOTIFS, st.motif);
  if (!motif.items) return null;
  const style = MOTIF_STYLE[st.theme][motif.styleKey];
  const key = `${motif.id}:${style}`;
  if (motifCache.has(key)) return motifCache.get(key);
  const entry = { imgs: null };
  entry.ready = import('../three/thumbs.js')
    .then(({ getThumb }) => Promise.all(motif.items.map((id) => getThumb(byId(id), style, { scale: 2 }))))
    .then((urls) => Promise.all(urls.filter(Boolean).map((u) => new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = u;
    }))))
    .then((imgs) => {
      entry.imgs = imgs.filter(Boolean);
      onMotifReady();
    })
    .catch(() => {
      entry.imgs = [];
    });
  motifCache.set(key, entry);
  return entry;
}

/* ---------------- drawing ---------------- */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function background(g, W, H, T) {
  const grd = g.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.5, Math.hypot(W, H) * 0.6);
  grd.addColorStop(0, T.bg[0]);
  grd.addColorStop(1, T.bg[1]);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  const r = rng(99);
  const n = Math.round((W * H) / 900);
  g.save();
  g.globalAlpha = 0.045;
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() > 0.5 ? '#000' : '#fff';
    g.fillRect(r() * W, r() * H, 1 + r() * 2.5, 1);
  }
  g.restore();
}

function cornerFan(g, x, y, dirX, dirY, m, color) {
  const base = Math.atan2(dirY, dirX);
  g.save();
  g.fillStyle = color;
  for (let i = -2; i <= 2; i++) {
    const a = base + i * 0.3;
    const d = m * 0.045;
    petal(g, x + Math.cos(a) * d, y + Math.sin(a) * d, m * 0.02, m * 0.05, a + Math.PI / 2);
    g.fill();
  }
  g.beginPath();
  g.arc(x, y, m * 0.009, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function frameMandala(g, W, H, T) {
  const m = Math.min(W, H);
  const p = m * 0.045;
  g.save();
  g.globalAlpha = 0.16;
  drawMandala(g, W / 2, H / 2, m * 0.47, { base: '#000', detail: 'transparent', accent: T.orn }, { strokeOnly: true });
  g.restore();
  g.strokeStyle = T.orn;
  g.lineWidth = m * 0.004;
  g.strokeRect(p, p, W - p * 2, H - p * 2);
  g.lineWidth = m * 0.0015;
  const q = p + m * 0.014;
  g.strokeRect(q, q, W - q * 2, H - q * 2);
  const c = q + m * 0.02;
  cornerFan(g, c, c, 1, 1, m, T.orn);
  cornerFan(g, W - c, c, -1, 1, m, T.orn);
  cornerFan(g, c, H - c, 1, -1, m, T.orn);
  cornerFan(g, W - c, H - c, -1, -1, m, T.orn);
  const inset = m * 0.1;
  return { x0: inset, x1: W - inset, y0: inset, y1: H - inset, credit: H - p - m * 0.03 };
}

function frameArch(g, W, H, T) {
  const m = Math.min(W, H);
  const p = m * 0.055;
  const x0 = p;
  const x1 = W - p;
  const r = (x1 - x0) / 2;
  const ay = p + r * (H > W * 1.2 ? 1 : 0.62);
  const y1 = H - p;
  const path = (inset) => {
    g.beginPath();
    g.moveTo(x0 + inset, y1 - inset);
    g.lineTo(x0 + inset, ay);
    g.ellipse(W / 2, ay, r - inset, (ay - p) - inset, 0, Math.PI, 0);
    g.lineTo(x1 - inset, y1 - inset);
    g.closePath();
  };
  path(0);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fill();
  g.strokeStyle = T.orn;
  g.lineWidth = m * 0.005;
  g.stroke();
  path(m * 0.018);
  g.lineWidth = m * 0.0015;
  g.stroke();
  // keystone ornament
  g.save();
  g.fillStyle = T.orn;
  petal(g, W / 2, p - m * 0.004, m * 0.03, m * 0.07, Math.PI);
  g.fill();
  g.restore();
  // row of petals along the base
  const n = Math.round((x1 - x0) / (m * 0.05));
  g.fillStyle = T.orn;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    petal(g, x, y1 - m * 0.045, m * 0.014, m * 0.034, 0);
    g.fill();
  }
  const inset = m * 0.09;
  return { x0: x0 + inset * 0.7, x1: x1 - inset * 0.7, y0: p + (ay - p) * 0.28, y1: y1 - m * 0.1, credit: y1 - m * 0.075 };
}

function frameBorder(g, W, H, T) {
  const m = Math.min(W, H);
  const b = m * 0.075;
  g.beginPath();
  g.rect(0, 0, W, H);
  g.rect(b, b, W - b * 2, H - b * 2);
  g.fillStyle = T.band;
  g.fill('evenodd');
  g.fillStyle = T.bandInk;
  const step = b * 0.95;
  const side = (len, place) => {
    const n = Math.max(2, Math.round(len / step));
    for (let i = 0; i <= n; i++) place((len * i) / n);
  };
  const dot = (x, y) => {
    g.beginPath();
    g.arc(x, y, b * 0.07, 0, Math.PI * 2);
    g.fill();
  };
  side(W, (t) => {
    petal(g, t, b * 0.5, b * 0.34, b * 0.62, Math.PI);
    g.fill();
    petal(g, t, H - b * 0.5, b * 0.34, b * 0.62, 0);
    g.fill();
    dot(t + step / 2, b * 0.5);
    dot(t + step / 2, H - b * 0.5);
  });
  side(H, (t) => {
    petal(g, b * 0.5, t, b * 0.34, b * 0.62, Math.PI / 2);
    g.fill();
    petal(g, W - b * 0.5, t, b * 0.34, b * 0.62, -Math.PI / 2);
    g.fill();
  });
  g.strokeStyle = T.orn;
  g.lineWidth = m * 0.003;
  const q = b + m * 0.014;
  g.strokeRect(q, q, W - q * 2, H - q * 2);
  const inset = b + m * 0.06;
  return { x0: inset, x1: W - inset, y0: inset, y1: H - inset, credit: H - b - m * 0.03 };
}

function wrap(g, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function formatDates(value) {
  if (!value) return { en: '', bn: '' };
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { en: '', bn: '' };
  let bn = '';
  try {
    bn = d.toLocaleDateString('bn-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    bn = '';
  }
  return { en: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), bn };
}

function buildItems(g, st, T, u, box, motifImgs) {
  const occ = find(OCCASIONS, st.occasion);
  const cx = (box.x0 + box.x1) / 2;
  const maxW = box.x1 - box.x0;
  const items = [];
  const text = (str, font, color, { lh = 1.2, gap = 0, spacing = 0, upper = false, fit = false, wrapIt = false } = {}) => {
    if (!str) return;
    let f = font;
    let size = parseFloat(font.match(/(\d+(\.\d+)?)px/)[1]);
    const s = upper ? str.toUpperCase() : str;
    g.font = f;
    g.letterSpacing = `${spacing}px`;
    if (fit) {
      while (g.measureText(s).width > maxW && size > 12) {
        size *= 0.94;
        f = font.replace(/\d+(\.\d+)?px/, `${size.toFixed(1)}px`);
        g.font = f;
      }
    }
    const lines = wrapIt ? wrap(g, s, maxW) : [s];
    g.letterSpacing = '0px';
    items.push({
      h: lines.length * size * lh,
      gap,
      draw(y) {
        g.font = f;
        g.fillStyle = color;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.letterSpacing = `${spacing}px`;
        lines.forEach((l, i) => g.fillText(l, cx + spacing / 2, y + size * lh * (i + 0.5)));
        g.letterSpacing = '0px';
      },
    });
  };

  if (st.motif !== 'none') {
    const mh = 230 * u;
    items.push({
      h: mh,
      gap: 30 * u,
      draw(y) {
        const cy = y + mh / 2;
        if (st.motif === 'alpana') {
          drawMandala(g, cx, cy, mh / 2, { base: T.bg[0], detail: T.ink, accent: T.orn });
          return;
        }
        const glow = g.createRadialGradient(cx, cy, 0, cx, cy, mh * 0.75);
        glow.addColorStop(0, T.glow);
        glow.addColorStop(1, T.glow.replace(/[\d.]+\)$/, '0)'));
        g.fillStyle = glow;
        g.fillRect(cx - mh, cy - mh, mh * 2, mh * 2);
        if (!motifImgs?.length) {
          g.save();
          g.globalAlpha = 0.35;
          drawMandala(g, cx, cy, mh * 0.4, { base: '#000', detail: 'transparent', accent: T.orn }, { strokeOnly: true });
          g.restore();
          return;
        }
        const dh = mh * 1.3;
        const widths = motifImgs.map((im) => (dh * im.naturalWidth) / im.naturalHeight);
        const overlap = widths.length > 1 ? dh * 0.12 : 0;
        const total = widths.reduce((a, b) => a + b, 0) - overlap * (widths.length - 1);
        let x = cx - total / 2;
        motifImgs.forEach((im, i) => {
          g.drawImage(im, x, cy - dh / 2 - mh * 0.06, widths[i], dh);
          x += widths[i] - overlap;
        });
      },
    });
  }

  text(occ.bn, `400 ${96 * u}px Galada, "Noto Serif Bengali"`, T.accent, { lh: 1.3, fit: true });
  text(occ.en, `600 ${22 * u}px "Plus Jakarta Sans"`, T.muted, { upper: true, spacing: 7 * u, gap: 46 * u, lh: 1.6 });
  text(st.host, `italic 500 ${34 * u}px "Cormorant Garamond"`, T.muted, { gap: 10 * u, wrapIt: true, lh: 1.25 });
  text(st.bride || ' ', `italic 500 ${138 * u}px "Cormorant Garamond"`, T.ink, { fit: true, lh: 1.08 });
  text('&', `italic 500 ${72 * u}px "Cormorant Garamond"`, T.accent, { lh: 1.05 });
  text(st.groom || ' ', `italic 500 ${138 * u}px "Cormorant Garamond"`, T.ink, { fit: true, lh: 1.08, gap: 8 * u });
  text(occ.after, `italic 500 ${32 * u}px "Cormorant Garamond"`, T.muted, { gap: 34 * u, wrapIt: true, lh: 1.25 });

  items.push({
    h: 26 * u,
    gap: 30 * u,
    draw(y) {
      const cy = y + 13 * u;
      g.strokeStyle = T.orn;
      g.lineWidth = 2.2 * u;
      g.beginPath();
      g.moveTo(cx - 170 * u, cy);
      g.lineTo(cx - 34 * u, cy);
      g.moveTo(cx + 34 * u, cy);
      g.lineTo(cx + 170 * u, cy);
      g.stroke();
      g.fillStyle = T.orn;
      petal(g, cx, cy - 4 * u, 13 * u, 30 * u, 0);
      g.fill();
      petal(g, cx - 13 * u, cy + 1 * u, 10 * u, 22 * u, -0.9);
      g.fill();
      petal(g, cx + 13 * u, cy + 1 * u, 10 * u, 22 * u, 0.9);
      g.fill();
    },
  });

  const dates = formatDates(st.date);
  text(dates.en, `600 ${44 * u}px "Cormorant Garamond"`, T.ink, { fit: true, lh: 1.2 });
  text(dates.bn, `500 ${28 * u}px "Noto Serif Bengali"`, T.muted, { lh: 1.5, gap: 16 * u });
  text([st.time, st.venue].filter(Boolean).join(', '), `500 ${27 * u}px "Plus Jakarta Sans"`, T.ink, { wrapIt: true, lh: 1.45, gap: 22 * u });
  text(st.note, `italic 500 ${30 * u}px "Cormorant Garamond"`, T.muted, { wrapIt: true, lh: 1.3 });
  return items;
}

function drawDesign(g, W, H, st, motifImgs) {
  const T = find(THEMES, st.theme);
  background(g, W, H, T);
  const layout = { mandala: frameMandala, arch: frameArch, border: frameBorder }[st.layout] || frameMandala;
  const box = layout(g, W, H, T);
  const avail = box.y1 - box.y0;
  let u = Math.min(box.x1 - box.x0, avail * 0.78) / 820;
  let items = buildItems(g, st, T, u, box, motifImgs);
  const total = () => items.reduce((s, it, i) => s + it.h + (i < items.length - 1 ? it.gap : 0), 0);
  for (let i = 0; i < 4 && total() > avail; i++) {
    u *= (avail / total()) * 0.98;
    items = buildItems(g, st, T, u, box, motifImgs);
  }
  let y = box.y0 + Math.max(0, (avail - total()) / 2);
  for (const it of items) {
    it.draw(y);
    y += it.h + it.gap;
  }
  const m = Math.min(W, H);
  g.font = `500 ${m * 0.014}px "Plus Jakarta Sans"`;
  g.fillStyle = T.muted;
  g.globalAlpha = 0.7;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('Designed with Parineeta, Patuli', W / 2, box.credit);
  g.globalAlpha = 1;
}

/* ---------------- UI ---------------- */
function segGroup(root, options, key, render = (o) => o.label, onChange) {
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', role: 'radio', class: 'seg__btn', dataset: { value: o.id } }, render(o));
    b.addEventListener('click', () => {
      state[key] = o.id;
      sync();
      onChange();
    });
    return b;
  });
  function sync() {
    buttons.forEach((b) => {
      const on = b.dataset.value === state[key];
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('is-active', on);
    });
  }
  root.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const i = options.findIndex((o) => o.id === state[key]);
    const n = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    state[key] = options[n].id;
    sync();
    buttons[n].focus();
    onChange();
  });
  root.append(...buttons);
  sync();
  return sync;
}

const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'card';

export function initInvite() {
  const canvas = $('#inv-canvas');
  const frame = $('#inv-frame');
  const desk = $('#inv-desk');
  const ctx = canvas.getContext('2d');
  let raf = 0;
  let fontsReady = false;

  function currentMotif() {
    const e = motifEntry(state);
    return e?.imgs || null;
  }

  function render() {
    raf = 0;
    const F = find(FORMATS, state.format);
    const cw = canvas.clientWidth;
    if (!cw || !fontsReady) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(cw * dpr);
    const ph = Math.round((pw * F.h) / F.w);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    ctx.setTransform(pw / F.w, 0, 0, ph / F.h, 0, 0);
    drawDesign(ctx, F.w, F.h, state, currentMotif());
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    syncLooks();
  }
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };
  onMotifReady = () => {
    schedule();
    scheduleLooks(60);
  };

  function applyFormat() {
    const F = find(FORMATS, state.format);
    const section = $('#invitations');
    section.style.setProperty('--ar', `${F.w} / ${F.h}`);
    section.style.setProperty('--ratio', String(F.w / F.h));
    $('#inv-size').textContent = F.size;
    schedule();
    scheduleLooks(0);
  }

  segGroup($('#inv-format'), FORMATS, 'format', undefined, applyFormat);
  segGroup($('#inv-occasion'), OCCASIONS, 'occasion', undefined, () => {
    schedule();
    scheduleLooks(0);
  });
  const syncTheme = segGroup($('#inv-theme'), THEMES, 'theme', (t) => [
    h('span', { class: 'swatch', style: `--a:${t.swatch[0]};--b:${t.swatch[1]};--c:${t.swatch[0]}`, 'aria-hidden': 'true' }),
    t.label,
  ], schedule);
  const syncLayout = segGroup($('#inv-layout'), LAYOUTS, 'layout', undefined, schedule);
  const syncMotif = segGroup($('#inv-motif'), MOTIFS, 'motif', undefined, schedule);

  // ready-made looks: live miniatures of the same card in different aesthetics
  const looksRoot = $('#inv-looks');
  const lookViews = LOOKS.map((look) => {
    const c = h('canvas', { 'aria-hidden': 'true' });
    const b = h('button', { type: 'button', class: 'look', 'aria-pressed': 'false', 'aria-label': `Apply the ${look.label} look` },
      h('span', { class: 'look__card' }, c),
      h('span', { class: 'look__label', text: look.label }));
    b.addEventListener('click', () => applyLook(look));
    looksRoot.append(b);
    return { look, c, b };
  });
  function syncLooks() {
    for (const { look, b } of lookViews) {
      b.setAttribute('aria-pressed', String(look.theme === state.theme && look.layout === state.layout && look.motif === state.motif));
    }
  }
  let looksTimer = 0;
  function renderLooks() {
    looksTimer = 0;
    if (!fontsReady) return;
    const F = find(FORMATS, state.format);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const { look, c } of lookViews) {
      const cw = c.clientWidth;
      if (!cw) continue;
      const pw = Math.round(cw * dpr);
      const ph = Math.round((pw * F.h) / F.w);
      c.width = pw;
      c.height = ph;
      const g = c.getContext('2d');
      const st = { ...state, theme: look.theme, layout: look.layout, motif: look.motif };
      g.setTransform(pw / F.w, 0, 0, ph / F.h, 0, 0);
      drawDesign(g, F.w, F.h, st, motifEntry(st)?.imgs || null);
    }
  }
  function scheduleLooks(delay = 280) {
    clearTimeout(looksTimer);
    looksTimer = setTimeout(renderLooks, delay);
  }
  function applyLook(look) {
    state.theme = look.theme;
    state.layout = look.layout;
    state.motif = look.motif;
    syncTheme();
    syncLayout();
    syncMotif();
    flip();
  }
  function flip() {
    if (reduceMotion()) {
      schedule();
      return;
    }
    frame.classList.remove('is-flipping');
    void frame.offsetWidth;
    frame.classList.add('is-flipping');
    setTimeout(schedule, 260);
  }

  for (const input of document.querySelectorAll('#inv-panel-words [data-key]')) {
    input.value = state[input.dataset.key];
    input.addEventListener('input', () => {
      state[input.dataset.key] = input.value;
      schedule();
      scheduleLooks();
    });
  }

  // tabs
  const tabs = [...document.querySelectorAll('.invite .tabs__tab')];
  const selectTab = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      selectTab(n);
      n.focus();
    });
  });

  // playful tilt on the preview
  if (!reduceMotion()) {
    desk.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = frame.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      frame.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
      frame.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
      frame.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
      frame.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    desk.addEventListener('pointerleave', () => {
      frame.style.setProperty('--rx', '0deg');
      frame.style.setProperty('--ry', '0deg');
    });
  }

  $('#inv-shuffle').addEventListener('click', () => {
    const pick = (list, cur) => {
      const opts = list.filter((x) => x.id !== cur);
      return opts[Math.floor(Math.random() * opts.length)].id;
    };
    state.theme = pick(THEMES, state.theme);
    state.layout = pick(LAYOUTS, state.layout);
    state.motif = pick(MOTIFS.filter((m) => m.id !== 'none'), state.motif);
    syncTheme();
    syncLayout();
    syncMotif();
    flip();
  });

  async function exportFile() {
    const F = find(FORMATS, state.format);
    const entry = motifEntry(state);
    if (entry) await entry.ready;
    const c = document.createElement('canvas');
    c.width = F.w;
    c.height = F.h;
    drawDesign(c.getContext('2d'), F.w, F.h, state, entry?.imgs || null);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    if (!blob) throw new Error('export failed');
    return new File([blob], `${F.file}-${slug(state.bride)}-${slug(state.groom)}.png`, { type: 'image/png' });
  }

  const busy = (btn, on) => {
    btn.disabled = on;
    btn.setAttribute('aria-busy', String(on));
  };

  $('#inv-download').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    busy(btn, true);
    try {
      const file = await exportFile();
      const url = URL.createObjectURL(file);
      const a = h('a', { href: url, download: file.name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast('Your design has been downloaded.', { iconName: 'download-simple' });
    } catch {
      toast('Sorry, that did not work. Please try again.', { iconName: 'x' });
    } finally {
      busy(btn, false);
    }
  });

  const shareBtn = $('#inv-share');
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'probe.png', { type: 'image/png' });
    shareBtn.hidden = !(navigator.canShare && navigator.canShare({ files: [probe] }));
  } catch {
    shareBtn.hidden = true;
  }
  shareBtn.addEventListener('click', async () => {
    busy(shareBtn, true);
    try {
      const file = await exportFile();
      await navigator.share({ files: [file], title: 'Our wedding invitation' });
    } catch {
      /* share sheet dismissed */
    } finally {
      busy(shareBtn, false);
    }
  });

  $('#inv-print').addEventListener('click', () => {
    const F = find(FORMATS, state.format);
    const T = find(THEMES, state.theme);
    const occ = find(OCCASIONS, state.occasion);
    openEnquiry({ subject: `Printed ${occ.label.toLowerCase()} ${F.label.toLowerCase()} for ${state.bride || 'the bride'} and ${state.groom || 'the groom'} (${T.label}, ${find(LAYOUTS, state.layout).label} layout, date ${state.date || 'to be confirmed'})` });
  });

  new ResizeObserver(schedule).observe(canvas);
  new ResizeObserver(() => scheduleLooks(120)).observe(looksRoot);
  applyFormat();

  const families = [
    ['400 40px Galada', 'শুভ বিবাহ'],
    ['italic 500 40px "Cormorant Garamond"', 'Riya'],
    ['600 40px "Cormorant Garamond"', 'Friday'],
    ['500 20px "Noto Serif Bengali"', 'ডিসেম্বর ২০২৬'],
    ['500 20px "Plus Jakarta Sans"', 'Patuli'],
    ['600 20px "Plus Jakarta Sans"', 'SHUBHO'],
  ];
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    Promise.all(families.map(([f, t]) => document.fonts.load(f, t).catch(() => null))).then(() => {
      fontsReady = true;
      schedule();
      scheduleLooks(0);
    });
    motifEntry(state);
    LOOKS.forEach((look) => motifEntry({ ...state, ...look }));
  }, { rootMargin: '400px' });
  io.observe(canvas);
}
