// The floating WhatsApp button steps aside while something it would cover, or that has its own WhatsApp or
// enquiry button, is on screen: the hero, the Visit section, and a product's price and buy buttons.
const fab = typeof document === 'undefined' ? null : document.querySelector('.fab');
const showing = new Set();
const io = fab && new IntersectionObserver((entries) => {
  // An element taken off the page reports "not on screen", so a replaced product panel clears itself
  // (and is let go of, so old panels are not kept in memory).
  entries.forEach((e) => {
    if (e.isIntersecting) showing.add(e.target);
    else {
      showing.delete(e.target);
      if (!e.target.isConnected) io.unobserve(e.target);
    }
  });
  fab.classList.toggle('is-tucked', showing.size > 0);
}, { threshold: 0.15 });

/** Tucks the floating button away whenever any of these elements is on screen. */
export function tuckFabNear(...els) {
  els.filter(Boolean).forEach((el) => io?.observe(el));
}
