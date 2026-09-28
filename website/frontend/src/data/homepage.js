// Homepage text, social links, stores, YouTube videos and SEO: today's built-in content.
// Edited in the admin; these are also what "Set to default" restores.

export const HOMEPAGE_SECTIONS = [
  ['trust', 'Celebrity visits'], ['story', 'Wedding story'], ['filmband', 'Film band'],
  ['collection', 'Collection'], ['sets', 'Bridal sets'], ['lookbook', 'Lookbook'],
  ['studio', 'Alpana studio'], ['invitations', 'Invitation studio'], ['services', 'Services'],
  ['reels', 'Films and social'], ['visit', 'Visit us'],
];

export const HOMEPAGE = {
  hero: {
    strip: 'এ যেন এক বিয়ের মরশুম',
    stripEn: 'It feels like wedding season',
    title: 'Bengali wedding heirlooms,',
    titleEm: 'painted by hand.',
    sub: 'Crowns, ritual boxes and painted keepsakes, made to order in Patuli, West Bengal.',
    ctaText: 'Plan your pieces on WhatsApp',
    photo: 'mukut-noir',
    photoAlt: 'A white shola mukut, the Bengali bridal crown, hand-cut from reed pith and set with pearls, carrying the Parineeta seal',
    metaBn: 'শোলার মুকুট',
    meta: 'Shola mukut, cut from reed pith · from ₹950',
  },
  trust: { title: 'Loved by', titleEm: 'familiar faces.', lede: 'Celebrities from Bengal have visited our Patuli studio to choose hand-painted pieces. We are proud to paint for them, and for every family who walks through our door.', hidden: false },
  story: { title: 'A Bengali wedding, in', titleEm: 'seven objects.', lede: 'Every piece we paint has a job in the ceremony. Scroll through the wedding day, from the last meal at home to the first step into a new one.', hidden: false },
  filmband: { title: 'Painted in Patuli,', titleEm: 'on the banks of the Bhagirathi.', lede: "Every piece is made by hand in our studio and finished to order for your family's day.", hidden: false },
  collection: { title: 'The collection', titleEm: '', lede: "Every piece is painted to order. Browse the shop's own photographs, or turn each piece in 3D and choose its colours.", hidden: false },
  sets: { title: 'Bridal sets', titleEm: '', lede: 'Pieces that belong together, painted to match and priced as one.', hidden: false },
  lookbook: { title: 'The Parineeta', titleEm: 'edit.', lede: 'Our own photographs of pieces we have painted and weddings we have styled. Tap any picture to see it large.', hidden: false },
  studio: { title: 'Draw your own', titleEm: 'alpana.', lede: 'Bengali homes welcome guests with alpana: patterns painted on the floor with rice paste, by hand. Draw one line and watch it repeat around the circle.', hidden: false },
  invitations: { title: 'Design your', titleEm: 'wedding card.', lede: 'Make an invitation, a poster or a save-the-date in Bengali style. Type your names, choose a look and download it free.', hidden: false },
  services: { title: 'Painted to order,', titleEm: 'for the whole wedding.', lede: 'Beyond the ritual pieces, we take commissions for the whole wedding: backdrops, alpana, kurtas and portraits.', hidden: false },
  reels: { title: 'Straight from', titleEm: 'the workshop.', lede: 'We film every new piece before it leaves Patuli. Follow along for new designs each wedding season.', hidden: false },
  visit: { title: 'Come to', titleEm: 'Patuli.', lede: 'See the pieces in person, pick colours and talk through custom work. Please call or message before you come.', hidden: false },
};

export const PLATFORMS = {
  instagram: { label: 'Instagram', icon: 'instagram-logo', hosts: ['instagram.com'] },
  youtube: { label: 'YouTube', icon: 'youtube-logo', hosts: ['youtube.com', 'youtu.be'] },
  facebook: { label: 'Facebook', icon: 'facebook-logo', hosts: ['facebook.com', 'fb.com'] },
};

export const SOCIALS = [
  { platform: 'instagram', url: 'https://www.instagram.com/parineeta_365/', handle: '@parineeta_365', hidden: false },
  { platform: 'youtube', url: 'https://www.youtube.com/@RAJsCREATIONS-h8e', handle: 'PARINEETA_365', hidden: false },
  { platform: 'facebook', url: 'https://www.facebook.com/people/Parineeta365/61585270277510/', handle: 'Parineeta365', hidden: false },
];

export const STORES = [
  {
    name: 'Parineeta studio, Patuli',
    address: 'Patuli\nPurba Bardhaman, West Bengal',
    phones: '+91 97342 41918\n+91 95315 63183\n+91 92421 44634',
    mapsQuery: 'Patuli, Purba Bardhaman, West Bengal',
    hours: '',
    hidden: false,
  },
];

export const VIDEOS = [];

export const SEO = {
  title: 'Parineeta | Hand-painted Bengali Wedding Heirlooms, Patuli',
  description: '',
  ogTitle: 'Parineeta | Hand-painted Bengali Wedding Heirlooms',
  ogDescription: 'Crowns, ritual boxes and painted keepsakes, made to order in Patuli, West Bengal.',
  ogImage: '',
};

/** Returns the 11-character YouTube id from an id or any youtube.com / youtu.be link, else ''. */
export function youtubeId(v) {
  const s = String(v || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return '';
    const id = u.hostname.endsWith('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1];
    return /^[\w-]{11}$/.test(id || '') ? id : '';
  } catch {
    return '';
  }
}

/** True when the link is https and on one of the platform's own domains. */
export function socialUrlOk(platform, url) {
  try {
    const u = new URL(url);
    const hosts = PLATFORMS[platform]?.hosts || [];
    return u.protocol === 'https:' && hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export const phoneList = (s) => String(s || '').split(/\n|,/).map((x) => x.trim()).filter(Boolean);
export const telHref = (p) => `tel:${p.replace(/[^\d+]/g, '')}`;
