import { h, icon } from './dom.js';

export function toast(message, { action, onAction, iconName = 'check-circle' } = {}) {
  const root = document.getElementById('toasts');
  const el = h('div', { class: 'toast' }, icon(iconName), h('span', { text: message }));
  if (action) {
    el.append(h('button', { type: 'button', class: 'toast__action', text: action, onclick: () => { onAction?.(); dismiss(); } }));
  }
  root.append(el);
  // A modal dialog makes everything outside it inert, so toasts live inside the top open dialog.
  const host = [...document.querySelectorAll('dialog[open]')].pop() || document.body;
  if (root.parentElement !== host) {
    if (root.matches?.(':popover-open')) root.hidePopover();
    host.append(root);
  }
  if (root.showPopover) {
    try {
      if (root.matches(':popover-open')) root.hidePopover();
      root.showPopover();
    } catch {
      /* popover unsupported: falls back to z-index */
    }
  }
  requestAnimationFrame(() => el.classList.add('is-in'));
  const timer = setTimeout(dismiss, 3600);
  function dismiss() {
    clearTimeout(timer);
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 300);
  }
}
