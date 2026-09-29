// Display details and a round avatar for a signed-in user. No Clerk import, so the admin demo can use it too.

/** Name, email, photo and initials for a user shaped { email, name, photo } (see userOf in client.js). */
export function profileOf(user) {
  const email = user?.email || '';
  const name = (user?.name || '').trim();
  const words = (name || email.split('@')[0]).split(/[\s._-]+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  const pic = user?.photo || '';
  return { name, email, photo: /^https:\/\//.test(pic) ? pic : '', initials };
}

/** A round avatar: the photo when there is one, otherwise initials. */
export function avatar(user, size = 32) {
  const p = profileOf(user);
  const el = document.createElement('span');
  el.className = 'avatar';
  el.style.setProperty('--size', `${size}px`);
  el.setAttribute('aria-hidden', 'true');
  el.textContent = p.initials;
  if (p.photo) {
    const img = document.createElement('img');
    Object.assign(img, { src: p.photo, alt: '', width: size, height: size, referrerPolicy: 'no-referrer', decoding: 'async' });
    img.addEventListener('error', () => img.remove()); // falls back to the initials underneath
    el.append(img);
  }
  return el;
}
