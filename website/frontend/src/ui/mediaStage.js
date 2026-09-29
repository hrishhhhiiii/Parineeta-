// The product media stage used by the product page and the quick-view panel:
// the shop's real photos and films first, the 3D model as the last option
// (and the only one for products with no real media yet).
import { photoSrc, photoSrcset, reelSrc, reelPoster } from '../data/site.js';
import { h, icon } from './dom.js';
import { openLightbox, describeMedia } from './lightbox.js';
import { thumbImg } from './drawers.js';

/**
 * @param {object} p        product
 * @param {object} o
 * @param {HTMLElement} o.stage       element the main view is drawn into
 * @param {HTMLCanvasElement} o.canvas 3D canvas, reinserted when 3D is chosen
 * @param {() => Promise<object>} o.ensureViewer  loads the 3D viewer on demand
 * @param {() => object|null} o.viewer            the viewer, once loaded
 * @param {() => string} o.style                  current colourway
 * @param {() => boolean} o.isCurrent             false once another product is shown
 */
export function mediaStage(p, o) {
  const real = [...p.media.filter((m) => m.type === 'photo'), ...p.media.filter((m) => m.type === 'reel')];
  const items = [...real, { type: '3d' }];
  const thumbs = h('div', { class: 'ppage__thumbs', role: 'group', 'aria-label': 'Photos and films' });
  const { stage } = o;
  let active = -1;

  const show = (i) => {
    if (i === active) return;
    active = i;
    const it = items[i];
    stage.querySelector('video')?.pause();
    if (it.type !== '3d') o.viewer()?.stop();
    stage.classList.toggle('is-3d', it.type === '3d');

    if (it.type === '3d') {
      stage.replaceChildren(o.canvas, h('p', { class: 'stage-hint' }, icon('hand-grabbing'), h('span', { text: 'Drag to rotate' })));
      o.ensureViewer().then((v) => {
        if (!o.isCurrent() || items[active] !== it || !stage.isConnected) return;
        v.show(p, o.style());
        v.start();
      });
    } else if (it.type === 'reel') {
      const m = describeMedia(it);
      stage.replaceChildren(h('video', {
        class: 'ppage__video', src: reelSrc(it.id), poster: reelPoster(it.id), controls: true, playsinline: true, preload: 'metadata',
        'aria-label': m.title || `${p.en}, film`,
      }));
    } else {
      const m = describeMedia(it);
      stage.replaceChildren(
        h('img', { class: 'ppage__backdrop', src: photoSrc(it.id, 400), alt: '', 'aria-hidden': 'true' }),
        h('button', { type: 'button', class: 'ppage__photo', 'aria-label': `Enlarge photo: ${m.title || p.en}`, onclick: () => openLightbox(real, real.indexOf(it), { subject: p.en }) },
          h('img', { src: photoSrc(it.id, 1600), srcset: photoSrcset(it.id), sizes: '(max-width: 900px) 100vw, 58vw', alt: m.title || p.en, decoding: 'async' })),
        h('p', { class: 'stage-hint' }, icon('magnifying-glass-plus'), h('span', { text: 'Tap to enlarge' })));
    }
    for (const [j, b] of [...thumbs.children].entries()) b.setAttribute('aria-pressed', String(j === i));
  };

  thumbs.append(...items.map((it, i) => {
    if (it.type === '3d') {
      return h('button', { type: 'button', class: 'ppage__thumb ppage__thumb--3d', 'aria-label': 'View in 3D and try colourways', onclick: () => show(i) },
        thumbImg(p, o.style(), 'ppage__thumb-render'), h('span', { class: 'ppage__thumb-badge' }, icon('cube'), '3D'));
    }
    const m = describeMedia(it);
    return h('button', { type: 'button', class: 'ppage__thumb', 'aria-label': `${it.type === 'reel' ? 'Film' : 'Photo'}: ${m.title || p.en}`, onclick: () => show(i) },
      h('img', { src: m.thumb, alt: '', loading: 'lazy', width: 360, height: 640 }),
      it.type === 'reel' ? h('span', { class: 'pp__play' }, icon('play', 'fill')) : null);
  }));

  show(0);
  return {
    thumbs: items.length > 1 ? thumbs : null,
    show3d: () => show(items.length - 1),
    stop: () => {
      stage.querySelector('video')?.pause();
      o.viewer()?.stop();
    },
  };
}
