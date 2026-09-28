// /?preview=1 inside the admin iframe: ask the parent for drafts, apply them, then boot as normal.
import { applyAll } from './apply.js';

export const IS_PREVIEW = new URLSearchParams(location.search).has('preview');

function banner(text) {
  const el = document.createElement('div');
  el.className = 'cms-preview-banner';
  el.setAttribute('role', 'status');
  el.textContent = text;
  el.style.cssText = 'position:fixed;inset:auto 12px 12px auto;z-index:99999;padding:8px 14px;border-radius:999px;background:#1d1a17;color:#fff;font:600 13px/1.2 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)';
  document.body.append(el);
}

/** Resolves once drafts arrive from the admin, or after the timeout with the live content. */
export function receivePreview(timeoutMs = 10000) {
  if (!IS_PREVIEW || window.parent === window) return Promise.resolve(false);
  return new Promise((resolve) => {
    const done = (ok, text) => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      const show = () => banner(text);
      document.body ? show() : addEventListener('DOMContentLoaded', show, { once: true });
      resolve(ok);
    };
    function onMessage(e) {
      if (e.origin !== location.origin || e.source !== window.parent || e.data?.type !== 'cms-preview') return;
      applyAll(e.data.docs || {});
      const at = e.data.at ? new Date(e.data.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      done(true, `Preview. Not live.${at ? ` Drafts from ${at}.` : ''}`);
    }
    const timer = setTimeout(() => done(false, 'Open preview from the admin to see drafts.'), timeoutMs);
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'cms-preview-ready' }, location.origin);
  });
}
