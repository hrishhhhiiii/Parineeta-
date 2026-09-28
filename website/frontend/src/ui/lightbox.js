import { FILMS, LOOKBOOK, TRUST, PHOTO_TITLES, photoSrc, reelSrc, reelPoster, reelPosterSmall } from '../data/site.js';
import { h, $ } from './dom.js';
import { openDialog } from './dialogs.js';
import { openEnquiry } from './enquiry.js';

/** Resolves a media reference ({ type: 'photo' | 'reel', id }) to display data. */
export function describeMedia(item) {
  if (item.type === 'reel') {
    const f = FILMS[item.id] || {};
    return { ...item, title: item.title || f.title || '', bn: item.bn ?? f.bn ?? '', thumb: reelPosterSmall(item.id) };
  }
  const look = LOOKBOOK.find((x) => x.id === item.id) || TRUST.find((x) => x.id === item.id) || {};
  return { ...item, title: item.title || look.caption || look.title || PHOTO_TITLES[item.id] || '', bn: item.bn || '', thumb: photoSrc(item.id, 400) };
}

let items = [];
let index = 0;
let opts = {};
const dialog = () => $('#media-dialog');

function stopVideo() {
  const v = $('#lb-media video');
  if (v) {
    v.pause();
    v.removeAttribute('src');
    v.load();
  }
}

function render() {
  stopVideo();
  const it = describeMedia(items[index]);
  const box = $('#lb-media');
  box.replaceChildren();
  if (it.type === 'reel') {
    box.append(h('video', {
      src: reelSrc(it.id),
      poster: reelPoster(it.id),
      controls: true,
      autoplay: true,
      playsinline: true,
      preload: 'auto',
      'aria-label': it.title,
    }));
  } else {
    box.append(h('img', { src: photoSrc(it.id, 1600), alt: it.title, decoding: 'async', ...(it.w && it.h ? { width: it.w, height: it.h } : {}) }));
  }
  $('#lb-bn').textContent = it.bn;
  $('#lb-title').textContent = it.title;
  $('#lb-count').textContent = items.length > 1 ? `${index + 1} of ${items.length}` : '';
  const multi = items.length > 1;
  $('#lb-prev').hidden = !multi;
  $('#lb-next').hidden = !multi;
  $('#lb-enquire').hidden = opts.enquire === false;
}

export function openLightbox(list, start = 0, options = {}) {
  items = list;
  index = Math.max(0, Math.min(start, list.length - 1));
  opts = options;
  render();
  openDialog(dialog());
}

const step = (d) => {
  index = (index + d + items.length) % items.length;
  render();
};

export function setupLightbox() {
  const d = dialog();
  $('#lb-prev').addEventListener('click', () => step(-1));
  $('#lb-next').addEventListener('click', () => step(1));
  d.addEventListener('keydown', (e) => {
    if (items.length < 2 || e.target.closest('video')) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  d.addEventListener('close', () => {
    stopVideo();
    $('#lb-media').replaceChildren();
  });
  $('#lb-enquire').addEventListener('click', () => {
    const it = describeMedia(items[index]);
    stopVideo();
    openEnquiry({ subject: opts.subject || it.title });
  });
}
