/**
 * Written customer reviews. Add only real reviews the shop has received and approved.
 * Newest first. Example entry (copy, fill in, remove the comment markers):
 *
 * {
 *   product: 'gach-kouto',          // product id from products.js
 *   name: 'Ananya S.',              // as the customer agreed to be shown
 *   place: 'Bardhaman',             // optional
 *   date: '2026-08-14',             // YYYY-MM-DD
 *   rating: 5,                      // 1 to 5
 *   title: 'Painted exactly as we asked',
 *   text: 'The portrait of my parents on the kouto made everyone cry at the wedding.',
 *   style: 'sindoor',               // optional colourway id they bought
 *   verified: true,                 // true when the shop confirmed the order
 * },
 */
export const WRITTEN_REVIEWS = [];

/* Reviews the shop switched on in /admin → Customer reviews, read live from the database
   (database/migrations/011_reviews.sql), so they appear without a rebuild. Until they arrive, or if
   the database can't be reached, the built-in WRITTEN_REVIEWS above are used. */
let live = null;
let loading = null;
export function loadReviews() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return Promise.resolve(allReviews());
  return (loading ??= fetch(`${url}/rest/v1/rpc/public_reviews`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(8000),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((rows) => { if (Array.isArray(rows)) live = rows; return allReviews(); })
    .catch(() => allReviews()));
}
const allReviews = () => (live ?? []).concat(WRITTEN_REVIEWS);

export const reviewsFor = (productId) =>
  allReviews().filter((r) => r.product === productId).sort((a, b) => String(b.date).localeCompare(String(a.date)));

/** The newest shown reviews from across the shop (homepage). */
export const latestReviews = (n = 6) => allReviews().slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, n);

/** Star summary; reviews without stars (e.g. YouTube comments) are left out of the average. */
export function ratingSummary(list) {
  const rated = list.filter((r) => r.rating >= 1 && r.rating <= 5);
  const counts = [0, 0, 0, 0, 0];
  for (const r of rated) counts[Math.round(r.rating) - 1] += 1;
  const total = rated.length;
  const avg = total ? rated.reduce((s, r) => s + r.rating, 0) / total : 0;
  return { total, avg, counts };
}

export const SOURCE_LABELS = { google: 'Google', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', whatsapp: 'WhatsApp' };

/* Reviews a visitor wrote on this device: shown only to them until the shop approves and publishes them. */
const KEY = 'parineeta:my-reviews';

export function myReviews(productId) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(all) ? all.filter((r) => r && r.product === productId) : [];
  } catch {
    return [];
  }
}

export function saveMyReview(review) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '[]');
    const list = Array.isArray(all) ? all : [];
    list.unshift(review);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* storage unavailable: the review is still sent to the shop */
  }
}
