// Only links the site can safely render: https, same-page anchors and site paths (plus tel/mailto/wa.me where asked).
export function safeHref(url, { tel = false, mail = false } = {}) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^#[\w/-]*$/.test(u) || /^\/(?!\/)[^\s]*$/.test(u)) return u;
  if (tel && /^tel:\+?[\d ]{6,20}$/.test(u)) return u;
  if (mail && /^mailto:[^\s@]+@[^\s@]+$/.test(u)) return u;
  try {
    const p = new URL(u);
    return p.protocol === 'https:' ? p.href : '';
  } catch {
    return '';
  }
}
