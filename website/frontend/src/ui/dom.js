export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  if (props && props.lang === 'bn' && props.translate == null) el.setAttribute('translate', 'no');
  // "Load this picture only when it is near the screen" has to be on the element before its address is.
  // Given the address first, the browser may start the download at once (it did for every picture made
  // after the page's load event), and a later loading="lazy" does not call it back.
  if (props && props.loading != null) el.setAttribute('loading', String(props.loading));
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export { svgIcon as icon } from './icons.js';

export { inr } from '../data/money.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
