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

export const reviewsFor = (productId) =>
  WRITTEN_REVIEWS.filter((r) => r.product === productId).sort((a, b) => b.date.localeCompare(a.date));

export function ratingSummary(list) {
  const counts = [0, 0, 0, 0, 0];
  for (const r of list) counts[Math.max(1, Math.min(5, Math.round(r.rating))) - 1] += 1;
  const total = list.length;
  const avg = total ? list.reduce((s, r) => s + r.rating, 0) / total : 0;
  return { total, avg, counts };
}

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
