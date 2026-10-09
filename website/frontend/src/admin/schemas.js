// What the shop owner can edit, and how each field is shown in the admin panel.
// Each section is saved as one document in Supabase `site_content` under its `key`.
import { PRODUCTS, CATEGORIES, SETS, STORY, PALETTES, variantsOf, DEFAULT_ALIASES } from '../data/products.js';
import { SITE, PAYMENTS, TRUST, LOOKBOOK, SERVICES, FILMS } from '../data/site.js';
import { WRITTEN_REVIEWS } from '../data/reviews.js';
import { ANNOUNCEMENT } from '../data/announcement.js';
import { HOMEPAGE, HOMEPAGE_SECTIONS, SOCIALS, PLATFORMS, STORES, VIDEOS, SEO, BANNERS } from '../data/homepage.js';
import { MODELS, customKind } from '../data/shapes.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export const SHAPES = [
  ['none', 'None: show only the photos and films'],
  ['gachKouto', 'Tall tiered box (gach kouto)'],
  ['sindoorKouto', 'Small round box (sindoor kouto)'],
  ['kunke', 'Small pot (kunke)'],
  ['darpan', 'Hand mirror (darpan)'],
  ['piri', 'Low wooden seat (piri)'],
  ['paanPata', 'Pair of betel leaves'],
  ['mukut', 'Bride\'s crown (mukut)'],
  ['topor', 'Groom\'s crown (topor)'],
  ['thalaSet', 'Plate and bowl set (thala)'],
  ['punjabi', 'Kurta / punjabi'],
  ['archPanel', 'Arched painted panel'],
  ['backdrop', 'Stage backdrop'],
  ['flowerDala', 'Engagement platter (round tray with a rose hoop)'],
  ['kulo', 'Khoi daan kulo (arched velvet panel in a cane frame)'],
];

const palettes = () => Object.entries(PALETTES).map(([id, p]) => [id, p.label]);
const films = () => Object.entries(FILMS).map(([id, f]) => [id, f.title]);
// Options that depend on other sections are read live from the admin's working copy.
const productOptions = (ctx) => (ctx.data.products || []).map((p) => [p.id, p.en || p.id]);
// The 3D shape list: None, the built-in shapes, then the shop's uploaded models (from "3D models").
const shapeOptions = (ctx) => [
  ...SHAPES,
  ...(ctx?.data?.models?.custom || []).filter((m) => m.id && m.file).map((m) => [customKind(m.id), `${m.name || m.id} (your upload)`]),
];
// Sub-categories are listed under their parent: "Crowns › Bride's crowns".
const categoryOptions = (ctx) => {
  const cats = ctx.data.categories || [];
  const name = (c) => {
    const par = c.parent && cats.find((x) => x.id === c.parent);
    return par ? `${par.label || par.id} › ${c.label || c.id}` : c.label || c.id;
  };
  return cats.map((c) => [c.id, name(c)]);
};
// A sub-category can only sit inside a top-level category (one level).
const parentOptions = (ctx) => [['', 'None (a main category)'], ...(ctx.data.categories || []).filter((c) => c.id && !c.parent).map((c) => [c.id, c.label || c.id])];

const mediaFields = [
  { key: 'type', label: 'Kind', type: 'select', options: [['photo', 'Photo'], ['reel', 'Film (from the shop\'s film library)']], default: 'photo' },
  { key: 'id', label: 'Photo or film', type: 'media', required: true },
  { key: 'title', label: 'Caption (optional)', type: 'text' },
];

export const SECTIONS = [
  {
    // Shown on its own screen (admin/modelsView.js), not the usual form.
    key: 'models',
    title: '3D models',
    icon: '🧊',
    kind: 'object',
    intro: 'Every 3D model on the website, which products use it, and your own uploaded models.',
    defaults: () => clone(MODELS),
    fields: [
      { key: 'off', label: 'Built-in shapes switched off', type: 'multi', options: () => SHAPES.filter(([k]) => k !== 'none') },
      { key: 'custom', label: 'Your uploaded models', type: 'list', of: [
        { key: 'id', label: 'Code', type: 'slug', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'file', label: 'File', type: 'text', required: true },
        { key: 'hidden', label: 'Switched off', type: 'bool' },
      ] },
    ],
  },
  {
    key: 'products',
    title: 'Products',
    icon: '🏺',
    kind: 'list',
    intro: 'Everything in the collection. Hidden products stay saved but do not appear on the site.',
    itemTitle: (p) => p.en || 'New product',
    thumb: (p) => (p.media || []).find((m) => m && m.id && m.type !== 'reel')?.id,
    itemSub: (p) => `${p.bn || ''}${p.priceFrom ? ` · from ₹${p.priceFrom}` : ''}${p.hidden ? ' · hidden' : ''}`,
    defaults: () => clone(PRODUCTS),
    blank: () => ({
      id: '', en: '', bn: '', category: 'ritual', line: '', story: '', priceFrom: 0,
      styles: ['sindoor'], variants: [], prices: [], stock: 'made', count: null, aliases: '', addedAt: new Date().toISOString().slice(0, 10),
      // New products start with photos and films only; a 3D model is optional.
      customizable: true, leadDays: 7, model: { kind: 'none' }, media: [],
    }),
    // Older products keep their options in `combos`; the admin edits them as choice groups (variantsOf)
    // and saves only `variants` from then on.
    prepare: (p) => {
      const { combos, ...rest } = p;
      return { ...rest, variants: variantsOf(p), prices: Array.isArray(p.prices) ? p.prices : [], stock: p.stock || 'made', aliases: p.aliases ?? DEFAULT_ALIASES[p.id] ?? '' };
    },
    normalize: (p) => {
      const { combos, ...rest } = p;
      const variants = variantsOf(p);
      const valid = (r) => r && r.pick && Number.isFinite(Number(r.price))
        && Object.entries(r.pick).some(([g, o]) => o && variants.some((x) => x.id === g && x.options.some((y) => y.id === o)));
      return {
        ...rest,
        variants,
        prices: (p.prices || []).filter(valid).map((r) => ({ pick: Object.fromEntries(Object.entries(r.pick).filter(([, o]) => o)), price: Number(r.price) })),
        stock: p.stock || 'made',
        count: p.count === '' || p.count == null ? null : Number(p.count),
        model: p.model?.image ? p.model : { kind: p.model?.kind || 'none' },
      };
    },
    fields: [
      { key: 'en', label: 'Name (English)', type: 'text', required: true },
      { key: 'bn', label: 'Name (Bengali)', type: 'text', lang: 'bn' },
      { advanced: true, key: 'id', label: 'Web address name', type: 'slug', from: 'en', required: true, help: 'Used in the page link, e.g. /p/gach-kouto/. Lowercase letters, numbers and dashes. Avoid changing it once shared.' },
      { key: 'category', label: 'Category', type: 'select', options: categoryOptions, required: true },
      { key: 'priceFrom', label: 'Price from (₹)', type: 'number', min: 0, required: true },
      { key: 'line', label: 'One-line summary', type: 'text', help: 'Shown under the name in the collection.' },
      { key: 'aliases', label: 'Other names customers use (optional)', type: 'text', help: 'Comma separated, in English or Bengali, e.g. "topar, টোপর, groom crown". The search finds the product by these too.' },
      { key: 'story', label: 'Full description', type: 'textarea' },
      { key: 'media', label: 'Photos and films', type: 'list', of: mediaFields, itemTitle: (m) => m.title || m.id || 'New photo', help: 'The first photo is the one shown in the collection grid.' },
      { key: 'model.kind', label: '3D model (optional)', type: 'select', options: shapeOptions, required: true, noStar: true, default: 'none', help: 'Leave as “None” to show only your photos and films. To let customers turn the piece around in 3D, pick the closest shape, or one of your own models from “3D models” in the menu.' },
      { key: 'noPavilion', label: 'Show in the 3D pavilion', type: 'bool', invert: true, help: 'The "3D pavilion" view of the collection on the homepage. Only pieces with a 3D model can appear there. Switched off, the piece still shows in Photos, search and its own page.' },
      { key: 'styles', label: 'Colourways offered', type: 'multi', options: palettes, required: true, help: 'The first one is shown by default.' },
      { key: 'variants', label: 'Choices', type: 'list', help: 'Groups of choices customers pick from, e.g. Size (Small, Large) or Type (Single, Pair). Each choice can add to the price, show its own photo and have its own stock. Leave empty if there is nothing to choose.', of: [
        { key: 'name', label: 'Choice name (e.g. Size)', type: 'text', required: true },
        { key: 'options', label: 'Options', type: 'list', of: [
          { key: 'label', label: 'Option name', type: 'text', required: true },
          { key: 'add', label: 'Extra price (₹)', type: 'number', min: 0, help: 'Added to "Price from". Leave 0 if it costs the same.' },
          { key: 'photo', label: 'Photo when chosen (optional)', type: 'media', photoOnly: true },
          { key: 'stock', label: 'Stock', type: 'select', options: [['', 'Same as the product'], ['made', 'Made to order'], ['ready', 'Ready now'], ['out', 'Sold out']] },
          { key: 'count', label: 'How many ready (optional)', type: 'number', min: 0, help: 'Customers see "Only a few left" at 3 or fewer. The number itself is never shown.' },
          { advanced: true, key: 'id', label: 'Option code', type: 'slug', from: 'label' },
        ], itemTitle: (o) => `${o.label || 'New option'}${o.add ? ` (+₹${o.add})` : ''}${o.stock === 'out' ? ' · sold out' : ''}` },
        { advanced: true, key: 'id', label: 'Choice code', type: 'slug', from: 'name' },
      ], itemTitle: (g) => `${g.name || 'New choice'}${g.options?.length ? `: ${g.options.map((o) => o.label).filter(Boolean).join(', ')}` : ''}` },
      { key: 'prices', label: 'Exact prices (optional)', type: 'exact-prices', help: 'Only when a combination costs something other than the sum, e.g. Large + Gold = ₹2,200. The most specific match wins.' },
      { key: 'stock', label: 'Stock', type: 'select', options: [['made', 'Made to order'], ['ready', 'Ready now'], ['out', 'Sold out']], default: 'made', help: 'Choices can override this. Stock goes live with "Put changes live" and is confirmed on WhatsApp.' },
      { key: 'count', label: 'How many ready (optional)', type: 'number', min: 0 },
      { advanced: true, key: 'addedAt', label: 'Date added', type: 'date', help: 'Used by "Newest first" in the collection.' },
      { key: 'leadDays', label: 'Days to make', type: 'number', min: 0 },
      { key: 'customizable', label: 'Can be personalised (names, portraits, colours)', type: 'bool' },
      { advanced: true, key: 'customHelp', label: 'Personalisation hint for customers', type: 'text' },
      { advanced: true, key: 'model.image', label: 'Painting on the panel (arched panel shape only)', type: 'media', photoOnly: true },
      { key: 'featured', label: 'Bestseller (shown in the "Bestsellers" row)', type: 'bool' },
      { key: 'hidden', label: 'Hide from the site', type: 'bool' },
    ],
  },
  {
    key: 'categories',
    title: 'Categories',
    icon: '🗂️',
    kind: 'list',
    intro: 'The groups the collection is organised into. Their order here is the order on the site.',
    itemTitle: (c) => c.label || 'New category',
    itemSub: (c) => [c.parent ? 'sub-category' : '', c.bn || ''].filter(Boolean).join(' · '),
    defaults: () => clone(CATEGORIES.filter((c) => c.id !== 'all')),
    blank: () => ({ id: '', label: '', bn: '', line: '', about: '', parent: '' }),
    // One level only, and no sub-category may be left pointing at a deleted (or nested) parent.
    check: (cats) => {
      const problems = [];
      for (const c of cats) {
        if (!c.parent) continue;
        const par = cats.find((x) => x.id === c.parent);
        if (c.parent === c.id) problems.push(`"${c.label || c.id}" can't sit inside itself.`);
        else if (!par) problems.push(`"${c.label || c.id}" sits inside a category that no longer exists. Choose another "Inside category", or None. (To delete a category, move its sub-categories first.)`);
        else if (par.parent) problems.push(`"${c.label || c.id}" sits inside "${par.label || par.id}", which is itself a sub-category. Only one level is allowed.`);
      }
      return problems;
    },
    fields: [
      { key: 'label', label: 'Name (English)', type: 'text', required: true },
      { key: 'bn', label: 'Name (Bengali)', type: 'text', lang: 'bn' },
      { advanced: true, key: 'id', label: 'Category code', type: 'slug', from: 'label', required: true, help: 'Products point at this code. Avoid changing it.' },
      { key: 'line', label: 'Short description', type: 'text' },
      { key: 'about', label: 'About this category (optional)', type: 'textarea', help: 'A short paragraph shown on the category page (e.g. /c/crowns/) under its name: what these pieces are and when they are used. Google reads it, so name the pieces the way customers search for them. Three or four sentences is plenty.' },
      { key: 'parent', label: 'Inside category (optional)', type: 'select', options: parentOptions, help: 'Make this a sub-category, e.g. "Bridal crowns" inside "Crowns". Customers pick sub-categories in Filters.' },
      { key: 'image', label: 'Tile picture (optional)', type: 'media', photoOnly: true, help: 'Shown on the category tiles under the homepage photo. Without one, the first product photo in the category is used.' },
    ],
  },
  {
    key: 'sets',
    title: 'Bridal sets',
    icon: '🎁',
    kind: 'list',
    intro: 'Bundles of products sold together at one price.',
    itemTitle: (s) => s.en || 'New set',
    itemSub: (s) => `${(s.items || []).length} pieces${s.price ? ` · ₹${s.price}` : ''}${s.hidden ? ' · hidden' : ''}`,
    defaults: () => clone(SETS),
    blank: () => ({ id: '', en: '', bn: '', line: '', items: [], price: 0 }),
    fields: [
      { key: 'en', label: 'Name (English)', type: 'text', required: true },
      { key: 'bn', label: 'Name (Bengali)', type: 'text', lang: 'bn' },
      { advanced: true, key: 'id', label: 'Set code', type: 'slug', from: 'en', prefix: 'set-', required: true },
      { key: 'price', label: 'Set price (₹)', type: 'number', min: 0, required: true },
      { key: 'line', label: 'One-line summary', type: 'text' },
      { key: 'items', label: 'Products in this set', type: 'multi', options: productOptions, required: true },
      { key: 'hidden', label: 'Hide from the site', type: 'bool' },
    ],
  },
  {
    key: 'reviews',
    title: 'Customer reviews',
    icon: '⭐',
    kind: 'list',
    intro: 'Add only real reviews customers sent you, shown with their permission. Reviews sent from the website arrive by WhatsApp or email; copy the ones you approve here.',
    itemTitle: (r) => r.title || r.name || 'New review',
    itemSub: (r) => `${'★'.repeat(Number(r.rating) || 0)} ${r.name || ''}${r.hidden ? ' · hidden' : ''}`,
    defaults: () => clone(WRITTEN_REVIEWS),
    blank: () => ({ product: '', name: '', place: '', date: new Date().toISOString().slice(0, 10), rating: 5, title: '', text: '', style: '', verified: true }),
    newFirst: true,
    fields: [
      { key: 'product', label: 'Product', type: 'select', options: productOptions, required: true },
      { key: 'name', label: 'Customer name (as they agreed to be shown)', type: 'text', required: true },
      { key: 'place', label: 'Town (optional)', type: 'text' },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'rating', label: 'Stars', type: 'select', options: [[5, '★★★★★ 5'], [4, '★★★★ 4'], [3, '★★★ 3'], [2, '★★ 2'], [1, '★ 1']], number: true },
      { key: 'title', label: 'Headline', type: 'text' },
      { key: 'text', label: 'Review', type: 'textarea', required: true },
      { key: 'style', label: 'Colourway they bought (optional)', type: 'select', options: () => [['', '—'], ...palettes()] },
      { key: 'verified', label: 'Confirmed order', type: 'bool' },
      { key: 'hidden', label: 'Hide from the site', type: 'bool' },
    ],
  },
  {
    key: 'settings',
    title: 'Contact and payments',
    icon: '⚙️',
    kind: 'object',
    intro: 'How customers reach you and pay. Payment methods left blank are hidden at checkout.',
    defaults: () => ({ site: clone(SITE), payments: clone(PAYMENTS) }),
    fields: [
      { heading: 'Contact' },
      { key: 'site.whatsapp', label: 'WhatsApp number', type: 'text', help: 'With country code, digits only, e.g. 919064188260.', pattern: '^\\d{10,15}$' },
      { key: 'site.email', label: 'Shop email', type: 'text' },
      { advanced: true, key: 'site.web3formsKey', label: 'Web3Forms access key', type: 'text', help: 'Turns on the "Send by Email" buttons. Free from web3forms.com.' },
      { key: 'site.deliveryBufferDays', label: 'Days to allow for delivery', type: 'number', min: 0, help: 'Product pages say "Order by …" = wedding date − days to make − these days.' },
      { heading: 'Payments' },
      { key: 'payments.advancePercent', label: 'Advance to confirm an order (%)', type: 'number', min: 0, max: 100 },
      { key: 'payments.upi.id', label: 'UPI ID', type: 'text', help: 'e.g. parineeta365@okaxis' },
      { key: 'payments.upi.payeeName', label: 'UPI payee name', type: 'text' },
      { key: 'payments.bank.accountName', label: 'Bank account name', type: 'text' },
      { key: 'payments.bank.accountNumber', label: 'Bank account number', type: 'text' },
      { key: 'payments.bank.ifsc', label: 'IFSC', type: 'text' },
      { key: 'payments.bank.bankName', label: 'Bank name', type: 'text' },
      { advanced: true, key: 'payments.gatewayLink', label: 'Payment page link (Razorpay, Instamojo…)', type: 'text' },
      { key: 'payments.payAtShop', label: 'Offer pay at the shop / on delivery', type: 'bool' },
    ],
  },
  {
    key: 'lookbook',
    title: 'Lookbook photos',
    icon: '📷',
    kind: 'list',
    intro: 'The gallery of the shop\'s photography.',
    itemTitle: (l) => l.title || 'New photo',
    defaults: () => clone(LOOKBOOK),
    blank: () => ({ id: '', title: '', w: 800, h: 800 }),
    thumbKey: 'id',
    fields: [
      { key: 'id', label: 'Photo', type: 'media', photoOnly: true, required: true, sizeKeys: ['w', 'h'] },
      { key: 'title', label: 'Caption', type: 'text', required: true },
    ],
  },
  {
    key: 'trust',
    title: 'Celebrity visits',
    icon: '🌟',
    kind: 'list',
    intro: 'Photos of well-known visitors. Name a guest only with their permission.',
    itemTitle: (t) => t.caption || 'New photo',
    itemSub: (t) => t.guest || '',
    defaults: () => clone(TRUST),
    blank: () => ({ id: '', guest: '', caption: '' }),
    thumbKey: 'id',
    fields: [
      { key: 'id', label: 'Photo', type: 'media', photoOnly: true, required: true },
      { key: 'caption', label: 'Caption', type: 'text', required: true },
      { key: 'guest', label: 'Guest name (only with permission)', type: 'text' },
    ],
  },
  {
    key: 'services',
    title: 'Services',
    icon: '🖌️',
    kind: 'list',
    intro: 'Commissions such as backdrops, painted punjabi and mehendi.',
    itemTitle: (s) => s.title || 'New service',
    itemSub: (s) => s.bn || '',
    defaults: () => clone(SERVICES),
    blank: () => ({ id: '', title: '', bn: '', body: '', photo: null, size: 'std' }),
    normalize: (s) => ({ ...s, photo: s.photo || null }),
    thumbKey: 'photo',
    fields: [
      { key: 'title', label: 'Name (English)', type: 'text', required: true },
      { key: 'bn', label: 'Name (Bengali)', type: 'text', lang: 'bn' },
      { advanced: true, key: 'id', label: 'Service code', type: 'slug', from: 'title', required: true },
      { key: 'body', label: 'Description', type: 'textarea' },
      { key: 'photo', label: 'Photo', type: 'media', photoOnly: true },
      { advanced: true, key: 'size', label: 'Tile size', type: 'select', options: [['std', 'Standard'], ['wide', 'Wide'], ['tall', 'Tall']] },
    ],
  },
  {
    key: 'story',
    title: 'The rituals (3D scroll)',
    icon: '🪔',
    kind: 'list',
    intro: 'The homepage section visitors scroll through ("A Bengali wedding, in seven objects"). Each chapter is one moment of the wedding day, with one product turning in 3D beside your words; a product without a 3D model shows its photo instead. Use Move up and Move down to change the order. If you add or remove chapters, change the number in the heading too.',
    itemTitle: (c) => c.title || 'New chapter',
    // "The day before · Matir Thala Set", noting a product that has no 3D model (its photo shows instead).
    itemSub: (c, ctx) => {
      const p = (ctx?.data?.products || []).find((x) => x.id === c.product);
      const no3d = p && (!p.model?.kind || p.model.kind === 'none');
      return [c.moment, p ? `${p.en || p.id}${no3d ? ' (photo, no 3D)' : ''}` : 'choose a product'].filter(Boolean).join(' · ');
    },
    // The chapter's own photo, else the featured product's first photo.
    thumb: (c, ctx) => (c.photo?.type === 'photo' && c.photo.id) || ((ctx?.data?.products || []).find((x) => x.id === c.product)?.media || []).find((m) => m?.id && m.type !== 'reel')?.id,
    links: [{ text: 'Change the heading, intro or hide this section', to: 'homepage', heading: 'The rituals (3D scroll)' }],
    defaults: () => clone(STORY),
    blank: () => ({ product: '', moment: '', title: '', body: '', photo: null }),
    normalize: (c) => ({ ...c, photo: c.photo?.type && c.photo?.id ? c.photo : null }),
    fields: [
      { key: 'moment', label: 'Moment (small italic line, e.g. "The day before")', type: 'text' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Text', type: 'textarea', required: true },
      { key: 'product', label: 'Product shown in 3D', type: 'select', options: productOptions, required: true, help: 'Its 3D model turns on the stage while this chapter is on screen. Set or change the model in Products → 3D model. With no model, its first photo shows instead.' },
      { key: 'photo.type', label: 'Real photo or film of this moment (optional)', type: 'select', options: [['', 'None'], ['photo', 'Photo'], ['reel', 'Film']] },
      { key: 'photo.id', label: 'Which photo or film', type: 'media' },
    ],
  },
  {
    key: 'announcement',
    title: 'Announcement bar',
    icon: '📣',
    kind: 'object',
    intro: 'A thin strip at the top of the website, e.g. "Puja orders close 20 Sept". Leave the dates empty to show it until you switch it off.',
    defaults: () => clone(ANNOUNCEMENT),
    fields: [
      { key: 'visible', label: 'Show the announcement', type: 'bool' },
      { key: 'text', label: 'Message', type: 'text', help: 'Keep it short: one line on a phone.' },
      { key: 'linkText', label: 'Link text (optional)', type: 'text' },
      { key: 'linkUrl', label: 'Link (optional)', type: 'text', pattern: '^(https://|/|#)', help: 'A full https:// address, or a part of this site like #collection.' },
      { advanced: true, key: 'startsAt', label: 'Show from (optional)', type: 'date' },
      { advanced: true, key: 'endsAt', label: 'Hide from (optional)', type: 'date' },
    ],
  },
  {
    key: 'homepage',
    title: 'Homepage text',
    icon: '🏠',
    kind: 'object',
    intro: 'The headline, big photo and the heading and intro of every section. The italic ending of a heading is typed separately.',
    defaults: () => clone(HOMEPAGE),
    fields: [
      { heading: 'Top of the page (hero)' },
      { key: 'hero.strip', label: 'Small Bengali line above the headline', type: 'text', lang: 'bn' },
      { key: 'hero.stripEn', label: 'Its English translation', type: 'text' },
      { key: 'hero.title', label: 'Headline', type: 'text', required: true },
      { key: 'hero.titleEm', label: 'Headline, highlighted ending (italic)', type: 'text' },
      { key: 'hero.sub', label: 'Line under the headline', type: 'textarea' },
      { key: 'hero.ctaText', label: 'WhatsApp button text', type: 'text' },
      { key: 'hero.photo', label: 'Big photo', type: 'media', photoOnly: true },
      { advanced: true, key: 'hero.photoAlt', label: 'Describe the photo (for blind visitors and Google)', type: 'text' },
      { advanced: true, key: 'hero.metaBn', label: 'Photo caption (Bengali)', type: 'text', lang: 'bn' },
      { advanced: true, key: 'hero.meta', label: 'Photo caption', type: 'text' },
      ...HOMEPAGE_SECTIONS.flatMap(([id, name]) => [
        { heading: name },
        { key: `${id}.title`, label: 'Heading', type: 'text' },
        { key: `${id}.titleEm`, label: 'Heading, highlighted ending (italic)', type: 'text' },
        { key: `${id}.lede`, label: 'Intro text', type: 'textarea' },
        { key: `${id}.hidden`, label: 'Hide this whole section', type: 'bool' },
      ]),
    ],
  },
  {
    key: 'stores',
    title: 'Shops and addresses',
    icon: '📍',
    kind: 'list',
    intro: 'Shown in "Visit us": addresses, phone numbers and the map. The first shop with a map search is the one on the map.',
    itemTitle: (s) => s.name || 'New shop',
    itemSub: (s) => `${String(s.address || '').split('\n')[0]}${s.hidden ? ' · hidden' : ''}`,
    defaults: () => clone(STORES),
    blank: () => ({ name: '', address: '', phones: '', mapsUrl: '', mapsQuery: '', hours: '', hidden: false }),
    fields: [
      { key: 'name', label: 'Shop name', type: 'text', required: true },
      { key: 'address', label: 'Address', type: 'textarea', required: true, help: 'One line per row.' },
      { key: 'phones', label: 'Phone numbers', type: 'textarea', help: 'One per line, e.g. +91 97342 41918' },
      { key: 'hours', label: 'Opening hours (optional)', type: 'text', help: 'e.g. Mon–Sat, 10am–8pm' },
      { key: 'mapsUrl', label: 'Google Maps link', type: 'text', pattern: '^https://', help: 'Open Google Maps, find the shop, press Share, then Copy link, and paste it here. It looks like https://maps.app.goo.gl/… The "Directions" button on the website opens this link.' },
      { advanced: true, key: 'mapsQuery', label: 'Place shown on the small map', type: 'text', help: 'What you would type into Google Maps to find the shop. Leave it empty to use the shop name and address.' },
      { key: 'hidden', label: 'Hide from the site', type: 'bool' },
    ],
  },
  {
    key: 'socials',
    title: 'Social media',
    icon: '🔗',
    kind: 'list',
    intro: 'Instagram, YouTube and Facebook links, shown in "Films and social", the footer and to Google.',
    itemTitle: (s) => PLATFORMS[s.platform]?.label || 'New link',
    itemSub: (s) => `${s.handle || s.url || ''}${s.hidden ? ' · hidden' : ''}`,
    defaults: () => clone(SOCIALS),
    blank: () => ({ platform: 'instagram', url: '', handle: '', hidden: false }),
    fields: [
      { key: 'platform', label: 'Platform', type: 'select', options: Object.entries(PLATFORMS).map(([k, v]) => [k, v.label]), required: true },
      { key: 'url', label: 'Link', type: 'text', required: true, pattern: '^https://', help: 'The full https:// address of your page. Links to other websites are ignored.' },
      { key: 'handle', label: 'Name shown under it', type: 'text', help: 'e.g. @parineeta_365' },
      { key: 'hidden', label: 'Hide from the site', type: 'bool' },
    ],
  },
  {
    key: 'banners',
    title: 'Promo banners',
    icon: '🎉',
    kind: 'list',
    intro: 'Big pictures under the homepage photo, like a shop app: a new piece, a festive offer, a category. Customers swipe through them; each opens what you choose. Use start and end dates to show one for a while.',
    itemTitle: (b) => b.title || 'New banner',
    itemSub: (b) => [b.start || b.end ? `${b.start || '…'} to ${b.end || '…'}` : '', b.hidden ? 'hidden' : ''].filter(Boolean).join(' · '),
    thumbKey: 'photo',
    defaults: () => clone(BANNERS),
    blank: () => ({ photo: '', title: '', line: '', linkType: 'product', linkProduct: '', linkCategory: '', linkSearch: '', linkUrl: '', start: '', end: '', hidden: false }),
    // Each banner must open something real, and web links must be https (never javascript: or http:).
    check: (list) => list.flatMap((b, i) => {
      const where = `"${b.title || `Banner ${i + 1}`}"`;
      if (b.linkType === 'product' && !b.linkProduct) return [`${where}: choose the product it opens.`];
      if (b.linkType === 'category' && !b.linkCategory) return [`${where}: choose the category it opens.`];
      if (b.linkType === 'search' && !String(b.linkSearch || '').trim()) return [`${where}: type the search words it opens.`];
      if (b.linkType === 'url' && !/^https:\/\/[^\s]+$/i.test(String(b.linkUrl || '').trim())) return [`${where}: the web address must start with https://`];
      if (b.start && b.end && b.end < b.start) return [`${where}: the end date is before the start date.`];
      return [];
    }),
    fields: [
      { key: 'photo', label: 'Picture', type: 'media', photoOnly: true, required: true, help: 'A wide photo works best (about 2:1).' },
      { key: 'title', label: 'Headline', type: 'text', required: true, help: 'Short, e.g. "Puja collection is here".' },
      { key: 'line', label: 'Small line (optional)', type: 'text' },
      { key: 'linkType', label: 'Opens', type: 'select', default: 'product', options: [['product', 'A product'], ['category', 'A category'], ['search', 'A search'], ['url', 'A web address']] },
      { key: 'linkProduct', label: 'Product (if it opens a product)', type: 'select', options: productOptions },
      { key: 'linkCategory', label: 'Category (if it opens a category)', type: 'select', options: categoryOptions },
      { key: 'linkSearch', label: 'Search words (if it opens a search)', type: 'text' },
      { key: 'linkUrl', label: 'Web address (if it opens one)', type: 'text', help: 'Must start with https://' },
      { key: 'start', label: 'Show from (optional)', type: 'date' },
      { key: 'end', label: 'Show until (optional)', type: 'date' },
      { key: 'hidden', label: 'Hide from the site', type: 'bool' },
    ],
  },
  {
    key: 'videos',
    title: 'YouTube videos',
    icon: '▶️',
    kind: 'list',
    intro: 'YouTube videos shown in "Films and social". Paste the video link. The player only loads when a visitor presses play.',
    itemTitle: (v) => v.title || 'New video',
    itemSub: (v) => `${v.youtubeId || ''}${v.hidden ? ' · hidden' : ''}`,
    defaults: () => clone(VIDEOS),
    blank: () => ({ youtubeId: '', title: '', hidden: false }),
    fields: [
      { key: 'youtubeId', label: 'YouTube link', type: 'text', required: true, pattern: '(youtube\\.com|youtu\\.be|^[\\w-]{11}$)', help: 'e.g. https://www.youtube.com/watch?v=… or https://youtu.be/…' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'hidden', label: 'Hide from the site', type: 'bool' },
    ],
  },
  {
    key: 'seo',
    title: 'Google and sharing',
    icon: '🔎',
    kind: 'object',
    intro: 'How the homepage appears in Google results and when its link is shared on WhatsApp or Facebook. Product pages set their own from each product.',
    defaults: () => clone(SEO),
    fields: [
      { key: 'title', label: 'Page title in Google', type: 'text', help: 'About 50–60 characters.' },
      { key: 'description', label: 'Description in Google', type: 'textarea', help: 'About 150 characters. Leave empty to keep the built-in one.' },
      { key: 'ogTitle', label: 'Title when shared', type: 'text' },
      { key: 'ogDescription', label: 'Description when shared', type: 'text' },
      { key: 'ogImage', label: 'Picture when shared', type: 'media', photoOnly: true, help: 'Leave empty to keep the Parineeta brand picture.' },
    ],
  },
];

export const FILM_OPTIONS = films;
