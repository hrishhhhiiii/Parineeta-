// Slim strip above the fixed nav; the nav is pushed down by --announce-h while it shows.
import { ANNOUNCEMENT, announcementActive } from '../data/announcement.js';
import { safeHref } from '../cms/urls.js';

export function renderAnnouncement() {
  document.querySelector('.announce')?.remove();
  document.documentElement.style.removeProperty('--announce-h');
  const a = ANNOUNCEMENT;
  if (!announcementActive(a)) return;
  const bar = document.createElement('div');
  bar.className = 'announce';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Announcement');
  const p = document.createElement('p');
  p.textContent = a.text.trim();
  const href = safeHref(a.linkUrl);
  if (href && a.linkText?.trim()) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = a.linkText.trim();
    p.append(' ', link);
  }
  bar.append(p);
  document.body.prepend(bar);
  const sync = () => document.documentElement.style.setProperty('--announce-h', `${bar.offsetHeight}px`);
  sync();
  new ResizeObserver(sync).observe(bar);
}
