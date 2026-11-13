// "Collections" in the admin: every collection (Crowns, Wedding rituals…), the collections inside it, and the
// products in each, with what is special about each product: Bestseller, hidden, stock, 3D pavilion, promo
// banner. From here: move a product to another collection, switch Bestseller or Hide, add a collection, delete
// one (its products move to another), or open a collection's details (name, words, picture) in the usual form.
// Saved in two sections: "categories" (the collections; the code name is kept so published content still works)
// and "products" (when products are moved or switched), like the 3D models screen.
import { categoryPath } from '../data/products.js';
import { fromPrice } from '../data/pricing.js';
import { photoSrc } from '../data/site.js';

const STOCK = { made: 'Made to order', ready: 'Ready now', out: 'Sold out' };
const rupees = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

/** ctx: the admin's state; openDetails(index): the usual form for one collection; openProduct(id): the product's form. */
export function collectionsView({ h, toast, ctx, slugify, changed, saveAll, undoAll, edited, openDetails, openProduct }) {
  ctx.data.categories ||= [];
  const cats = () => ctx.data.categories;
  const products = () => ctx.data.products || [];
  const banners = () => (Array.isArray(ctx.data.banners) ? ctx.data.banners : []).filter((b) => b && !b.hidden);
  const body = h('div', { class: 'col' });
  let removing = null; // the collection whose "Delete" is asking where its products go

  const nameOf = (c) => c?.label || c?.id || 'New collection';
  const inside = (c) => cats().filter((x) => x.parent && x.parent === c.id);
  const productsIn = (id) => products().filter((p) => p.category === id);
  const tops = () => cats().filter((c) => !c.parent || !cats().some((x) => x.id === c.parent));
  const inBanner = (p) => banners().some((b) => b.linkType === 'product' && b.linkProduct === p.id);
  const has3d = (p) => p.model?.kind && p.model.kind !== 'none';

  const change = () => {
    edited();
    paint();
  };

  /* ---------- one product row ---------- */
  function row(p, c) {
    const photo = (p.media || []).find((m) => m && m.id && m.type !== 'reel')?.id;
    const tags = [
      p.featured ? ['Bestseller', 'is-star'] : null,
      p.hidden ? ['Hidden from the site', 'is-off'] : null,
      [STOCK[p.stock] || STOCK.made, p.stock === 'out' ? 'is-off' : p.stock === 'ready' ? 'is-good' : ''],
      has3d(p) && !p.noPavilion ? ['In the 3D pavilion', ''] : null,
      inBanner(p) ? ['In a promo banner', 'is-star'] : null,
    ].filter(Boolean);
    let price = 0;
    try { price = fromPrice(p); } catch { price = Number(p.priceFrom) || 0; }
    const move = h('select', { class: 'input input--sm', 'aria-label': `Move ${p.en || p.id} to another collection`,
      onchange: (e) => {
        if (!e.target.value) return;
        p.category = e.target.value;
        toast(`${p.en || p.id} moved to ${nameOf(cats().find((x) => x.id === e.target.value))}. Press Save.`);
        change();
      } },
    h('option', { value: '', text: 'Move to…' }),
    ...cats().filter((x) => x.id && x.id !== c?.id).map((x) => h('option', { value: x.id, text: x.parent ? `   ${nameOf(x)}` : nameOf(x) })));
    return h('li', { class: `col__item${p.hidden ? ' is-hidden' : ''}` },
      photo ? h('img', { class: 'col__thumb', src: /^\//.test(photo) ? photo : photoSrc(photo, 400), alt: '', width: 48, height: 48, loading: 'lazy', onerror: (e) => e.target.remove() })
        : h('span', { class: 'col__thumb col__thumb--none', 'aria-hidden': 'true', text: '🏺' }),
      h('div', { class: 'col__text' },
        h('button', { type: 'button', class: 'linkbtn col__name', text: `${p.en || p.id || 'New product'}${p.bn ? ` · ${p.bn}` : ''}`, title: 'Open this product', onclick: () => openProduct(p.id) }),
        h('span', { class: 'muted', text: `from ${rupees(price)}` }),
        h('span', { class: 'col__tags' }, ...tags.map(([t, cls]) => h('span', { class: `col__tag ${cls}`, text: t })))),
      h('div', { class: 'col__actions' },
        h('button', { type: 'button', class: `btn btn--sm ${p.featured ? 'btn--gold' : 'btn--ghost'}`, 'aria-pressed': String(!!p.featured),
          text: p.featured ? '★ Bestseller' : '☆ Bestseller', title: 'Shown in the "Bestsellers" row on the homepage',
          onclick: () => { p.featured = !p.featured; change(); } }),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: p.hidden ? 'Show on site' : 'Hide',
          onclick: () => { p.hidden = !p.hidden; change(); } }),
        move));
  }

  /* ---------- deleting: its products and the collections inside it go somewhere first ---------- */
  function deleteBox(c) {
    const items = productsIn(c.id);
    const kids = inside(c);
    const targets = cats().filter((x) => x.id && x.id !== c.id && x.parent !== c.id);
    const to = h('select', { class: 'input', 'aria-label': 'Move its products to' },
      ...targets.map((x) => h('option', { value: x.id, text: nameOf(x) })));
    if (kids.length) {
      return h('div', { class: 'col__delete' },
        h('p', { text: `${nameOf(c)} has ${kids.length} collection${kids.length > 1 ? 's' : ''} inside it (${kids.map(nameOf).join(', ')}). Delete or move ${kids.length > 1 ? 'those' : 'that'} first: open it and change "Inside collection".` }),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Cancel', onclick: () => { removing = null; paint(); } }));
    }
    if (items.length && !targets.length) {
      return h('div', { class: 'col__delete' },
        h('p', { text: 'This is the only collection, so its products have nowhere to go. Add another collection first.' }),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Cancel', onclick: () => { removing = null; paint(); } }));
    }
    return h('div', { class: 'col__delete' },
      h('p', { text: items.length ? `Delete ${nameOf(c)}? ${items.length > 1 ? `Its ${items.length} products move` : 'Its 1 product moves'} to:` : `Delete ${nameOf(c)}? It has no products.` }),
      items.length ? to : null,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Delete collection', onclick: () => {
          if (items.length) items.forEach((p) => { p.category = to.value; });
          ctx.data.categories = cats().filter((x) => x !== c);
          banners().filter((b) => b.linkType === 'category' && b.linkCategory === c.id).forEach((b) => { b.linkCategory = items.length ? to.value : ''; });
          removing = null;
          toast(`${nameOf(c)} deleted${items.length ? `; its products moved to ${nameOf(cats().find((x) => x.id === to.value))}` : ''}. Press Save to keep it, or Undo changes.`);
          change();
        } }),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Cancel', onclick: () => { removing = null; paint(); } })));
  }

  /* ---------- one collection (and the collections inside it) ---------- */
  function card(c, nested = false) {
    const items = productsIn(c.id);
    const index = cats().indexOf(c);
    const kids = nested ? [] : inside(c);
    const others = products().filter((p) => p.category !== c.id);
    const count = (f) => items.filter(f).length;
    const summary = [
      `${items.length} product${items.length === 1 ? '' : 's'}`,
      count((p) => p.featured) ? `${count((p) => p.featured)} bestseller${count((p) => p.featured) > 1 ? 's' : ''}` : '',
      count((p) => p.hidden) ? `${count((p) => p.hidden)} hidden` : '',
      count((p) => p.stock === 'ready') ? `${count((p) => p.stock === 'ready')} ready now` : '',
      count((p) => p.stock === 'out') ? `${count((p) => p.stock === 'out')} sold out` : '',
      banners().some((b) => b.linkType === 'category' && b.linkCategory === c.id) ? 'has a promo banner' : '',
    ].filter(Boolean).join(' · ');
    const add = others.length ? h('select', { class: 'input input--sm', 'aria-label': `Add a product to ${nameOf(c)}`,
      onchange: (e) => {
        const p = products().find((x) => x.id === e.target.value);
        if (!p) return;
        p.category = c.id;
        toast(`${p.en || p.id} moved into ${nameOf(c)}. Press Save.`);
        change();
      } },
    h('option', { value: '', text: '+ Add a product to this collection…' }),
    ...others.map((p) => h('option', { value: p.id, text: `${p.en || p.id}${p.category ? ` (now in ${nameOf(cats().find((x) => x.id === p.category)) || p.category})` : ''}` }))) : null;
    const live = items.some((p) => !p.hidden) && c.id;
    return h('article', { class: `card col__card${nested ? ' is-nested' : ''}` },
      h('div', { class: 'col__head' },
        c.image ? h('img', { class: 'col__tile', src: /^\//.test(c.image) ? c.image : photoSrc(c.image, 400), alt: '', width: 64, height: 64, loading: 'lazy', onerror: (e) => e.target.remove() }) : null,
        h('div', { class: 'col__title' },
          h('h2', { text: `${nested ? '↳ ' : ''}${nameOf(c)}${c.bn ? ` · ${c.bn}` : ''}` }),
          h('p', { class: 'muted', text: summary }),
          c.line ? h('p', { class: 'muted col__line', text: c.line }) : null),
        h('div', { class: 'col__actions' },
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Edit name, words & picture', onclick: () => openDetails(index) }),
          live ? h('a', { class: 'btn btn--ghost btn--sm', href: categoryPath(c), target: '_blank', rel: 'noopener', text: 'View on website ↗' }) : null,
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm col__del', text: 'Delete', onclick: () => { removing = c; paint(); } }))),
      removing === c ? deleteBox(c) : null,
      items.length ? h('ul', { class: 'col__list' }, ...items.map((p) => row(p, c)))
        : h('p', { class: 'muted', text: kids.length ? 'No products directly in it; see the collections inside it below.' : 'No products in this collection yet.' }),
      add,
      ...kids.map((k) => card(k, true)));
  }

  /* ---------- products whose collection no longer exists ---------- */
  function strays() {
    const ids = new Set(cats().map((c) => c.id));
    const list = products().filter((p) => !ids.has(p.category));
    if (!list.length) return null;
    return h('section', { class: 'card col__card col__strays' },
      h('h2', { text: `Not in any collection (${list.length})` }),
      h('p', { class: 'muted', text: 'Their collection was deleted or renamed in code. Customers can still open them, but they are missing from the collection filters. Move each one into a collection.' }),
      h('ul', { class: 'col__list' }, ...list.map((p) => row(p, null))));
  }

  function addCollection() {
    const name = prompt('Name of the new collection (e.g. Puja items):', '');
    if (!name || !name.trim()) return;
    const base = slugify(name).slice(0, 30) || 'collection';
    let id = base;
    for (let n = 2; cats().some((c) => c.id === id); n++) id = `${base}-${n}`;
    ctx.data.categories = [...cats(), { id, label: name.trim(), bn: '', line: '', about: '', parent: '', image: '' }];
    toast(`${name.trim()} added. Add products to it below, or open "Edit name, words & picture". Press Save.`);
    change();
  }

  function paint() {
    const dirty = changed('categories') || changed('products');
    const totals = {
      products: products().length,
      bestsellers: products().filter((p) => p.featured).length,
      hidden: products().filter((p) => p.hidden).length,
    };
    body.replaceChildren(
      h('div', { class: 'sec-head' },
        h('div', {},
          h('h1', { text: 'Collections' }),
          h('p', { class: 'muted', text: `Every collection and what is in it: ${cats().length} collection${cats().length === 1 ? '' : 's'}, ${totals.products} products, ${totals.bestsellers} bestseller${totals.bestsellers === 1 ? '' : 's'}${totals.hidden ? `, ${totals.hidden} hidden` : ''}. Changes go live with “Put changes live”.` }),
          h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: '+ New collection', onclick: addCollection })),
        h('div', { class: `savebar${dirty ? ' is-dirty' : ''}` },
          h('span', { class: 'savebar__state', text: dirty ? 'You have changes. Press Save.' : '' }),
          dirty ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Undo changes', onclick: () => undoAll() }) : null,
          h('button', { type: 'button', class: 'btn btn--gold', text: 'Save changes', disabled: !dirty, onclick: () => saveAll() }))),
      ...[strays(), ...tops().map((c) => card(c))].filter(Boolean)); // replaceChildren would print "null"
  }

  paint();
  return body;
}
