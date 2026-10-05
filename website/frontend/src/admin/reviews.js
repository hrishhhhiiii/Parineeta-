// Admin → Customer reviews: every review is stored (written on the website, added here, or imported),
// and the shop switches "Show on website" on for the ones customers should see. The website reads
// those directly, so a switch takes effect at once. Database: migrations/011_reviews.sql.

const SOURCES = [
  ['shop', 'Added by the shop'], ['website', 'This website'], ['google', 'Google'], ['facebook', 'Facebook'],
  ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['whatsapp', 'WhatsApp'],
];
const sourceLabel = (s) => SOURCES.find(([k]) => k === s)?.[1] || s;
const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * sb: Supabase client. h, toast, explain: the admin's helpers. products: [[id, name]].
 * onCount(n): called with the number of new (not yet looked at) reviews.
 */
export function reviewsView(sb, { h, toast, explain, products, onCount }) {
  const body = h('div', {}, h('p', { class: 'loading', text: 'Loading reviews…' }));
  let rows = [];
  let filter = null; // set after loading: "new" if there are new ones, otherwise "all"
  let editing = null; // the review being edited, or {} for a new one
  const productName = (id) => (id ? products().find(([k]) => k === id)?.[1] || id : 'The shop in general');
  const isNew = (r) => !r.checked;
  const count = () => onCount(rows.filter(isNew).length);

  const FILTERS = [
    ['new', 'New', (r) => isNew(r)],
    ['shown', 'On the website', (r) => r.shown],
    ['hidden', 'Not on the website', (r) => !r.shown],
    ['all', 'All', () => true],
  ];

  const paint = () => {
    const [, , test] = FILTERS.find(([k]) => k === filter);
    const list = rows.filter(test);
    body.replaceChildren(...[
      h('div', { class: 'rv-tools' },
        h('div', { class: 'chips', role: 'tablist', 'aria-label': 'Show' }, ...FILTERS.map(([k, label, t]) => {
          const n = rows.filter(t).length;
          return h('button', { type: 'button', role: 'tab', class: `chip${k === filter ? ' is-on' : ''}`, 'aria-selected': String(k === filter),
            onclick: () => { filter = k; paint(); } }, `${label} (${n})`);
        })),
        h('button', { type: 'button', class: 'btn btn--gold', text: '+ Add a review', onclick: () => { editing = {}; paint(); } })),
      editing ? form(editing) : null,
      list.length ? h('div', { class: 'rv-list' }, ...list.map(card))
        : h('div', { class: 'card empty-state' }, h('span', { class: 'empty-state__icon', 'aria-hidden': 'true', text: '⭐' }),
          h('p', { text: filter === 'new' ? 'No new reviews.' : 'No reviews here yet.' }),
          h('p', { class: 'muted', text: 'Reviews customers write on a product page arrive here. You can also add one you received on WhatsApp, Google or Instagram with “+ Add a review”.' })),
    ].filter(Boolean)); // replaceChildren would print an empty slot as the word "null"
  };

  const setShown = async (r, shown, input) => {
    input.disabled = true;
    const { error } = await sb.rpc('set_review_shown', { p_id: r.id, p_shown: shown });
    input.disabled = false;
    if (error) { input.checked = !shown; return toast(explain(error), 'err'); }
    Object.assign(r, { shown, checked: true });
    toast(shown ? `Now showing on the website: ${r.name}'s review.` : `Hidden from the website: ${r.name}'s review.`);
    count();
    paint();
  };

  const card = (r) => {
    const toggle = h('input', { type: 'checkbox', checked: r.shown, 'aria-label': `Show ${r.name}'s review on the website` });
    toggle.addEventListener('change', () => setShown(r, toggle.checked, toggle));
    const digits = String(r.phone || '').replace(/\D/g, '');
    const date = r.review_date ? new Date(r.review_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    return h('article', { class: `card rv-item${r.shown ? ' is-shown' : ''}` },
      h('div', { class: 'rv-item__top' },
        h('label', { class: 'switch' }, toggle, h('span', { class: 'switch__track', 'aria-hidden': 'true' }), h('span', { class: 'switch__text', text: r.shown ? 'On the website' : 'Not on the website' })),
        isNew(r) ? h('span', { class: 'badge-new', text: 'New' }) : null,
        h('span', { class: 'muted', text: `${sourceLabel(r.source)}${date ? ` · ${date}` : ''}` })),
      h('div', { class: 'rv-item__head' },
        r.rating ? h('span', { class: 'rv-card__stars', 'aria-label': `${r.rating} out of 5 stars`, text: '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) }) : null,
        h('strong', { text: productName(r.product) })),
      r.title ? h('p', { class: 'rv-card__title', text: r.title }) : null,
      h('p', { class: 'rv-card__text', text: r.text }),
      h('p', { class: 'muted' }, [r.name, r.place].filter(Boolean).join(', '),
        r.verified ? ' · Confirmed order' : '',
        r.source_url ? [' · ', h('a', { href: r.source_url, target: '_blank', rel: 'noopener', text: 'See where it was posted ↗' })] : null,
        digits.length >= 10 ? [' · ', h('a', { href: `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`, target: '_blank', rel: 'noopener', text: 'WhatsApp them' })] : null),
      r.suspect ? h('p', { class: 'form-msg', text: 'Many reviews came from the same connection. Check this one is real.' }) : null,
      h('div', { class: 'row' },
        isNew(r) && !r.shown ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Keep it hidden', onclick: async () => {
          const { error } = await sb.rpc('mark_reviews_checked', { p_ids: [r.id] });
          if (error) return toast(explain(error), 'err');
          r.checked = true;
          count();
          paint();
        } }) : null,
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Edit', onclick: () => { editing = { ...r }; paint(); body.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }),
        h('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Delete', onclick: async () => {
          if (!confirm(`Delete ${r.name}'s review for good? To just take it off the website, switch it off instead.`)) return;
          const { error } = await sb.rpc('delete_review', { p_id: r.id });
          if (error) return toast(explain(error), 'err');
          rows = rows.filter((x) => x !== r);
          count();
          paint();
        } })));
  };

  // Add a review by hand, or edit one.
  const form = (r) => {
    const isNewOne = !r.id;
    const val = (k, d = '') => r[k] ?? d;
    const field = (label, control, help = '') => h('div', { class: 'field' }, h('label', { class: 'field__label' }, label, control), help ? h('p', { class: 'field__help', text: help }) : null);
    const select = (name, options, value) => h('select', { class: 'input', name }, ...options.map(([v, t]) => h('option', { value: v, text: t, selected: String(v) === String(value ?? '') })));
    const input = (name, value, attrs = {}) => h('input', { class: 'input', name, value: value ?? '', ...attrs });
    const f = h('form', { class: 'card form rv-form' },
      h('h2', { text: isNewOne ? 'Add a review' : 'Change this review' }),
      field('Product', select('product', [['', 'The shop in general'], ...products()], val('product'))),
      h('div', { class: 'rv-form__row' },
        field('Customer name', input('name', val('name'), { required: true, maxlength: 80 })),
        field('Town (optional)', input('place', val('place'), { maxlength: 60 }))),
      h('div', { class: 'rv-form__row' },
        field('Stars', select('rating', [[5, '★★★★★ 5'], [4, '★★★★ 4'], [3, '★★★ 3'], [2, '★★ 2'], [1, '★ 1'], ['', 'No stars']], isNewOne ? 5 : val('rating'))),
        field('Date', input('date', val('review_date', today()), { type: 'date' }))),
      field('Headline (optional)', input('title', val('title'), { maxlength: 120 })),
      field('Review', h('textarea', { class: 'input', name: 'text', rows: 5, required: true, maxlength: 2000, text: val('text') })),
      h('div', { class: 'rv-form__row' },
        field('Where it came from', select('source', SOURCES, isNewOne ? 'shop' : val('source'))),
        field('Link to it (optional)', input('sourceUrl', val('source_url'), { type: 'url', placeholder: 'https://…' }), 'Shown as “From Google ↗” and so on.')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'verified', checked: Boolean(r.verified) }), h('span', { text: 'Confirmed order (they bought from the shop)' })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'shown', checked: isNewOne ? true : Boolean(r.shown) }), h('span', { text: 'Show on the website' })),
      h('div', { class: 'row' },
        h('button', { type: 'submit', class: 'btn btn--gold', text: isNewOne ? 'Add review' : 'Save changes' }),
        h('button', { type: 'button', class: 'btn btn--ghost', text: 'Cancel', onclick: () => { editing = null; paint(); } })));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const el = f.elements;
      const p = {
        id: r.id || '', product: el.product.value, name: el.name.value.trim(), place: el.place.value.trim(), rating: el.rating.value,
        date: el.date.value, title: el.title.value.trim(), text: el.text.value.trim(), source: el.source.value,
        sourceUrl: el.sourceUrl.value.trim(), verified: el.verified.checked, shown: el.shown.checked,
      };
      if (!p.name) return toast('Please write the customer’s name.', 'err');
      if (!p.text) return toast('Please write the review.', 'err');
      if (p.sourceUrl && !/^https:\/\//.test(p.sourceUrl)) return toast('The link must start with https://', 'err');
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      const { error } = await sb.rpc('save_review', { p });
      btn.disabled = false;
      if (error) return toast(explain(error), 'err');
      toast(p.shown ? 'Saved. It is on the website now.' : 'Saved. It is not on the website.');
      editing = null;
      load();
    });
    return f;
  };

  const load = () => sb.rpc('admin_reviews').then(({ data, error }) => {
    if (error) {
      return body.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'form-msg', text: `Could not load reviews: ${explain(error)}` }),
        h('p', { class: 'muted', text: 'If this is new, run database/migrations/011_reviews.sql in the Supabase SQL editor.' })));
    }
    rows = data || [];
    if (!filter) filter = rows.some(isNew) ? 'new' : 'all';
    count();
    paint();
  });
  load();

  return h('div', {},
    h('div', { class: 'sec-head' }, h('div', {}, h('h1', { text: 'Customer reviews' }),
      h('p', { class: 'muted', text: 'Every review is kept here. Switch on “Show on website” for the ones you want customers to see; it changes on the website straight away.' }))),
    body);
}

/** How many reviews are new (not looked at yet). 0 if the database isn't updated (011). */
export async function newReviewCount(sb) {
  const { data, error } = await sb.rpc('admin_reviews');
  return error ? 0 : (data || []).filter((r) => !r.checked).length;
}
