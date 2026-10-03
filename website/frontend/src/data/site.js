export const SITE = {
  whatsapp: '919064188260',
  // Free key from https://web3forms.com (sign up with debrajnandi2004@gmail.com). Leave empty to disable email sending.
  web3formsKey: '',
  email: 'debrajnandi2004@gmail.com',
};

/**
 * Payment options shown at checkout. Each method appears only once its details are filled in.
 * UPI and bank transfers are free. A gateway link (Razorpay, Instamojo, PhonePe payment page)
 * is optional; gateways charge the shop a small fee per payment.
 */
export const PAYMENTS = {
  advancePercent: 50,
  upi: { id: '9734241918@axl', payeeName: 'Parineeta365' }, // State Bank of India account ending 5983
  bank: { accountName: '', accountNumber: '', ifsc: '', bankName: '' },
  gatewayLink: '', // e.g. 'https://rzp.io/l/parineeta'
  payAtShop: true, // cash or UPI when collecting at the shop, or on delivery
};

export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/oar2.jpg`;
export const ytUrl = (id) => `https://www.youtube.com/shorts/${id}`;
export const ytEmbed = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;

export const waLink = (text = '') =>
  `https://wa.me/${SITE.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/* ---------- the client's own photos and films (public/media) ---------- */
// Photos uploaded in the admin panel are stored as full URLs; the shop's original photos are ids.
const isUrl = (id) => /^https?:\/\//.test(id);
export const photoSrc = (id, size = 1600) => (isUrl(id) ? id : `/media/photos/${id}-${size}.webp`);
export const photoSrcset = (id) => (isUrl(id) ? `${id} 1600w` : [400, 800, 1600].map((s) => `${photoSrc(id, s)} ${s}w`).join(', '));
export const reelSrc = (id) => `/media/reels/${id}.mp4`;
export const reelPoster = (id) => `/media/reels/${id}.webp`;
export const reelPosterSmall = (id) => `/media/reels/${id}-sm.webp`;
export const reelStill = (id) => `/media/reels/${id}-still.webp`;
export const reelPreview = (id) => `/media/reels/${id}-preview.mp4`;

/** Film library: every reel the shop supplied. */
export const FILMS = {
  'kouto-river': { title: 'Gach kouto at sunset by the river', bn: 'গাছকৌটো' },
  topor: { title: 'The grand shola topor', bn: 'টোপর' },
  mukut: { title: 'Shola mukut, up close', bn: 'শোলার মুকুট' },
  'har-parvati': { title: 'Har Parvati, painted on a kula', bn: 'হর পার্বতী' },
  'biyer-piri': { title: 'A pair of painted biyer piri', bn: 'বিয়ের পিঁড়ি' },
  'thala-set': { title: 'Matir thala set with bowls and glass', bn: 'মাটির থালার সেট' },
  'kouto-portrait': { title: 'Gach kouto with a bride\'s portrait', bn: 'গাছকৌটো' },
  'kali-panel': { title: 'Maa Shyamsundari, painted for worship', bn: 'আরাধনা' },
  'ritual-set': { title: 'The bride\'s ritual set', bn: 'কনের সাজি' },
  'painted-pot': { title: 'A painted keepsake pot', bn: 'হাতে আঁকা' },
};

export const REELS = ['kouto-river', 'topor', 'mukut', 'har-parvati', 'biyer-piri', 'thala-set', 'kouto-portrait', 'kali-panel', 'ritual-set'];

/** Real customer review films from the shop's YouTube channel. `product` links a film to a product page. */
export const REVIEWS = [
  { id: '4QpR2G5Xna8', title: 'A groom picks up his order', product: null },
  { id: 'iVc9qb8TgCI', title: 'A family collects their set', product: null },
  { id: 'OrtG1NNxciM', title: 'Unboxing a painted punjabi', product: 'punjabi' },
];

/**
 * Celebrity visits supplied by the shop. Add each guest's name in `guest`
 * (only with their permission) and it will appear in the caption.
 */
export const TRUST = [
  { id: 'celeb-with-panels', guest: '', caption: 'Choosing painted panels at the Parineeta studio' },
  { id: 'celeb-selfie', guest: '', caption: 'A visit to our Patuli studio' },
  { id: 'celeb-browsing', guest: '', caption: 'Looking through the painted kula collection' },
  { id: 'celeb-choosing', guest: '', caption: 'Picking a piece to take home' },
];

/** Titles for product photos taken from the shop's films (not in the lookbook). */
export const PHOTO_TITLES = {
  'darpan-real': 'Darpan with a beaded silver frame',
  'sindoor-kouto-real': 'Sindoor kouto with a pearl rim',
  'kouto-peacock': 'Gach kouto in peacock blue',
  'ritual-set-real': "The bride's ritual set on a painted kula",
};

/** Curated lookbook from the shop's own photography. */
export const LOOKBOOK = [
  { id: 'aiburobhat-bride', title: 'Madur backdrop for an aiburobhat', w: 600, h: 800 },
  { id: 'mukut-noir', title: 'Shola mukut in pearl and silver', w: 800, h: 744 },
  { id: 'amader-meyer-biye', title: 'Amader meyer biye, a painted patipatro', w: 609, h: 800 },
  { id: 'kouto-stage', title: 'A gach kouto family on the wedding stage', w: 800, h: 625 },
  { id: 'velvet-arch-backdrop', title: 'Painted khoi daan kulo', w: 600, h: 800 },
  { id: 'bride-kula-panel', title: 'A bride, painted on a kula', w: 646, h: 800 },
  { id: 'kouto-set-garden', title: 'Gach kouto set in sindoor red', w: 800, h: 800 },
  { id: 'gopal-idol', title: 'Gopal, Angaraag', w: 667, h: 800 },
  { id: 'flower-dala', title: 'Engagement platter with roses and pearls', w: 748, h: 800 },
  { id: 'thala-set-top', title: 'Matir thala set, seen from above', w: 600, h: 800 },
  { id: 'mukut-garden', title: 'Shola mukut in daylight', w: 800, h: 595 },
  { id: 'punjabi-indigo', title: 'Hand-painted punjabi', w: 587, h: 800 },
];

export const SERVICES = [
  {
    id: 'backdrops',
    title: 'Backdrops, walls and floor alpana',
    bn: 'সাবেকি ব্যাকড্রপ ও আলপনা',
    body: 'Painted velvet kulo, mats and stage backdrops in the old Bengali style, plus alpana on your floors and walls.',
    photo: 'velvet-arch-backdrop',
    size: 'wide',
  },
  {
    id: 'punjabi',
    title: 'Hand-painted punjabi',
    bn: 'হাতে আঁকা পাঞ্জাবি',
    body: 'Kurtas for the groom and family, painted in colours that match the wedding.',
    photo: 'punjabi-indigo',
    size: 'tall',
  },
  {
    id: 'portraits',
    title: 'Portraits and patipatro',
    bn: 'প্রতিকৃতি',
    body: 'The couple, the family or a family deity, painted onto a board, a kula or a gach kouto.',
    photo: 'amader-meyer-biye',
    size: 'std',
  },
  {
    id: 'mehendi',
    title: 'Bridal mehendi',
    bn: 'মেহেন্দি',
    body: 'Henna for the bride and guests before the wedding. Ask us for dates.',
    photo: null,
    size: 'std',
  },
];
