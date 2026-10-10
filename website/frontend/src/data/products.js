// Single source of truth for the catalogue. Prices are indicative placeholders: edit them here.
import { MODELS, isCustomKind, customModel } from './shapes.js';

export const PALETTES = {
  sindoor: { label: 'Sindoor red', base: '#A8161F', deep: '#5E0A10', accent: '#E3AA3E', detail: '#F7EEDC', leaf: '#2E6B3F' },
  haldi: { label: 'Haldi yellow', base: '#E8B23A', deep: '#A86D0E', accent: '#B0141F', detail: '#FFF4D6', leaf: '#2E6B3F' },
  peacock: { label: 'Peacock blue', base: '#15557A', deep: '#0A2F45', accent: '#E3AA3E', detail: '#F7EEDC', leaf: '#2F7A57' },
  night: { label: 'Rajwadi night', base: '#43070E', deep: '#220307', accent: '#DDA746', detail: '#F4E3B5', leaf: '#3F7A4F' },
  ivory: { label: 'Shola ivory', base: '#F2E8D2', deep: '#D8C59C', accent: '#C9962E', detail: '#A8161F', leaf: '#2E6B3F' },
  zari: { label: 'Zari gold', base: '#C99532', deep: '#8A5E14', accent: '#F3D27A', detail: '#FFF6E0', leaf: '#2E6B3F', metal: true },
  leaf: { label: 'Fresh betel', base: '#3F7D3A', deep: '#24502A', accent: '#E3AA3E', detail: '#FFF8E8', leaf: '#2E6B3F' },
  indigo: { label: 'Indigo', base: '#1F4E79', deep: '#12324F', accent: '#E3AA3E', detail: '#F4F7FA', leaf: '#2E6B3F' },
  rani: { label: 'Rani pink', base: '#D61F69', deep: '#8C0F45', accent: '#E3AA3E', detail: '#FFF4F7', leaf: '#2E6B3F' },
};

export const CATEGORIES = [
  { id: 'all', label: 'Everything' },
  { id: 'ritual', label: 'Wedding rituals', bn: 'বিয়ের আচার', line: 'The painted pieces every Bengali wedding ritual calls for.',
    about: "A Bengali Hindu wedding moves through a string of rituals, and each has its own object. The gach kouto holds the bride's sindoor, the kunke measures rice for a full home and the darpan travels with the couple. The bride sits on the biyer piri for saat paak, hides behind paan pata until shubho drishti, and offers khoi into the fire from the kulo. We paint every piece by hand in Patuli and match them to each other, so the whole set is yours." },
  { id: 'crown', label: 'Crowns', bn: 'মুকুট', line: 'Shola crowns for the bride and the groom, cut from reed pith.',
    about: "Bengali brides and grooms are crowned in shola, the soft white pith of a marsh reed, carved into filigree as fine as lace. The bride wears the shola mukut with her red and white sari; the groom arrives in the tall, conical topor. Both weigh almost nothing, and most families keep them long after the wedding. Ours are cut and finished by hand in Patuli and made to order for your wedding date." },
  { id: 'clay', label: 'Thala sets', bn: 'মাটি ও থালা', line: 'Hand-painted thala and bowls for the aiburobhat and the feast.',
    about: "The day before the wedding, the family serves the bride aiburobhat, her last meal at home as an unmarried daughter, on a thala with a small bowl for every dish. Our thala sets are painted by hand with alpana motifs in the colours of your wedding, and many brides keep them as a memory of that meal." },
  { id: 'apparel', label: 'Clothing', bn: 'পোশাক', line: 'Hand-painted cloth for the wedding day.',
    about: "Hand-painted clothing for the wedding day and the ceremonies around it. Our cotton punjabi (kurta) is painted with alpana borders and small flower buttis, made to your size and coloured to match the rest of the wedding, so the groom can wear the same motifs as the bride's kouto and piri." },
  { id: 'art', label: 'Devotional art', bn: 'ভক্তি শিল্প', line: 'Painted art for the home shrine and the ceremony.',
    about: "Painted panels for the home shrine, the wedding altar and the couple's new home. Har Parvati, Shiva and Parvati as the ideal married couple, is a traditional blessing for newlyweds, and our devotional series also includes Maa Shyamsundari. Every face is painted freehand on an arched panel in Patuli, so no two are alike, and they make a lasting wedding gift." },
  { id: 'decor', label: 'Decor', bn: 'সাজসজ্জা', line: 'Alpana and decor to dress the venue and the home.',
    about: "Decor to dress the venue and the home for the engagement and the wedding. The engagement platter carries the rings: a round tray wrapped in silk and lace, with a hoop of roses and strings of pearls. We also paint wall and floor alpana to order. Everything is made in your colours in Patuli, West Bengal." },
];

// The built-in "About" paragraphs by category code, kept before published content replaces CATEGORIES:
// categories saved before the About field existed get these instead of nothing.
export const DEFAULT_CATEGORY_ABOUT = Object.fromEntries(CATEGORIES.filter((c) => c.about).map((c) => [c.id, c.about]));

const single = { id: 'single', label: 'Single piece', add: 0 };

export const PRODUCTS = [
  {
    id: 'gach-kouto',
    en: 'Gach Kouto',
    bn: 'গাছকৌটো',
    aliases: 'gachkouto, gach kauto, kouto, kauto, sindoor box, sindur kouto, কৌটো',
    category: 'ritual',
    line: 'The tiered vermilion box a bride keeps for life.',
    story: 'A tall, tiered wooden box that holds the bride\'s sindoor (vermilion). She carries it into her new home and many families keep it for generations. Ours are turned in wood and painted by hand in Patuli, and can carry the couple\'s portrait.',
    priceFrom: 1450,
    styles: ['sindoor', 'peacock', 'haldi', 'ivory'],
    combos: [single, { id: 'with-kunke', label: 'With matching kunke', add: 420 }, { id: 'kouto-five', label: 'Full kouto set of five', add: 2650 }],
    customizable: true,
    leadDays: 7,
    model: { kind: 'gachKouto' },
    media: [{ type: 'reel', id: 'kouto-river' }, { type: 'photo', id: 'kouto-stage' }, { type: 'photo', id: 'kouto-peacock' }, { type: 'reel', id: 'kouto-portrait' }, { type: 'photo', id: 'kouto-set-garden' }],
  },
  {
    id: 'kunke',
    en: 'Kunke',
    bn: 'কুনকে',
    aliases: 'kunki, kunko, kunkey, measuring pot, rice pot, কুনকি',
    category: 'ritual',
    line: 'A rice-measuring pot, a wish for a full home.',
    story: 'A small pot for measuring rice, used in the wedding rites and in the bride\'s farewell. Filled with rice it stands for a household that never runs short. Painted to match your kouto set.',
    priceFrom: 380,
    styles: ['sindoor', 'haldi', 'night', 'peacock'],
    combos: [single, { id: 'pair', label: 'Pair', add: 340 }],
    customizable: false,
    leadDays: 5,
    model: { kind: 'kunke' },
    media: [{ type: 'photo', id: 'ritual-set-real' }, { type: 'reel', id: 'ritual-set' }],
  },
  {
    id: 'darpan',
    en: 'Darpan',
    bn: 'দর্পণ',
    aliases: 'dorpon, darpon, mirror, hand mirror, আয়না',
    category: 'ritual',
    line: 'The painted hand mirror of the ceremony.',
    story: 'A hand mirror that travels with the couple through the rituals. We paint the rim and handle so it matches the rest of the set, and it becomes a keepsake afterwards.',
    priceFrom: 520,
    styles: ['sindoor', 'peacock', 'night', 'haldi'],
    combos: [single, { id: 'pair', label: 'Pair, for bride and groom', add: 480 }],
    customizable: true,
    leadDays: 5,
    model: { kind: 'darpan' },
    media: [{ type: 'photo', id: 'darpan-real' }, { type: 'reel', id: 'ritual-set' }],
  },
  {
    id: 'biyer-piri',
    en: 'Biyer Piri',
    bn: 'বিয়ের পিঁড়ি',
    aliases: 'piri, pidi, pinri, biye piri, wedding seat, পিঁড়ি',
    category: 'ritual',
    line: 'The low seat the bride is carried in on.',
    story: 'The bride sits on this low wooden seat while her brothers lift her and walk seven circles around the groom, a ritual called saat paak. We paint the top with alpana in your colours.',
    priceFrom: 1800,
    styles: ['sindoor', 'night', 'haldi', 'peacock'],
    combos: [single, { id: 'pair', label: 'Pair, for bride and groom', add: 1650 }],
    customizable: true,
    leadDays: 8,
    model: { kind: 'piri' },
    media: [{ type: 'reel', id: 'biyer-piri' }],
  },
  {
    id: 'paan-pata',
    en: 'Paan Pata',
    bn: 'পানপাতা',
    aliases: 'paan, pan pata, betel leaf, paner pata, পান',
    category: 'ritual',
    line: 'The leaves she hides behind until the first look.',
    story: 'The bride covers her face with two betel leaves while she is carried around the groom. When she lowers them the couple share shubho drishti, their first auspicious look. Ours are painted with chandan dots.',
    priceFrom: 250,
    styles: ['zari', 'leaf', 'sindoor'],
    combos: [{ id: 'pair', label: 'Pair of leaves', add: 0 }, { id: 'four', label: 'Two pairs', add: 220 }],
    customizable: false,
    leadDays: 4,
    model: { kind: 'paanPata' },
    media: [],
  },
  {
    id: 'shola-mukut',
    en: 'Shola Mukut',
    bn: 'শোলার মুকুট',
    aliases: 'mukut, mukat, mukoot, shola, sola, sholar mukut, bride crown, crown, মুকুট',
    category: 'crown',
    line: 'The bride\'s crown, cut from reed pith.',
    story: 'The bride\'s crown is carved from sholapith, the soft white core of a marsh reed, and cut into filigree as fine as lace. Worn with a red and white sari, it marks her as Lakshmi for the day.',
    priceFrom: 950,
    styles: ['zari', 'sindoor', 'peacock'],
    combos: [single, { id: 'with-topor', label: 'With matching topor', add: 1040 }],
    customizable: false,
    leadDays: 6,
    model: { kind: 'mukut' },
    media: [{ type: 'reel', id: 'mukut' }, { type: 'photo', id: 'mukut-noir' }, { type: 'photo', id: 'mukut-garden' }],
  },
  {
    id: 'topor',
    en: 'Topor',
    bn: 'টোপর',
    aliases: 'topar, topur, tópor, groom crown, crown, টোপোর',
    category: 'crown',
    line: 'The groom\'s tall crown, light as paper.',
    story: 'The groom arrives in a tall conical crown made of sholapith. It weighs almost nothing and is carved like lace, and most families keep it long after the wedding.',
    priceFrom: 1250,
    styles: ['zari', 'sindoor', 'peacock'],
    combos: [single, { id: 'with-mukut', label: 'With matching mukut', add: 740 }],
    customizable: false,
    leadDays: 6,
    model: { kind: 'topor' },
    media: [{ type: 'reel', id: 'topor' }],
  },
  {
    id: 'thala-set',
    en: 'Matir Thala Set',
    bn: 'মাটির থালার সেট',
    aliases: 'thala, thali, plate, plate set, aiburobhat, bowls, থালা',
    category: 'clay',
    line: 'Hand-painted thala and bowls for the bride\'s last meal at home.',
    story: 'The day before the wedding the family serves the bride aiburobhat, her last meal as an unmarried daughter, on a hand-painted thala set: one large thala and a small bowl for every dish.',
    priceFrom: 1650,
    styles: ['sindoor', 'haldi', 'peacock', 'night'],
    combos: [{ id: 'set', label: 'Thala with four bowls', add: 0 }, { id: 'set-glass', label: 'Thala, six bowls and glass', add: 520 }],
    customizable: true,
    leadDays: 8,
    model: { kind: 'thalaSet' },
    media: [{ type: 'reel', id: 'thala-set' }, { type: 'photo', id: 'thala-set-top' }],
  },
  {
    id: 'punjabi',
    en: 'Hand-painted Punjabi',
    bn: 'হাতে আঁকা পাঞ্জাবি',
    aliases: 'panjabi, kurta, groom kurta, painted kurta, পাঞ্জাবি',
    category: 'apparel',
    line: 'A cotton kurta painted with alpana motifs.',
    story: 'A cotton punjabi (kurta) painted by hand with alpana borders and small flower buttis. We paint to your size and match the colours to the wedding. Tell us the size in the personalisation box.',
    priceFrom: 1450,
    styles: ['indigo', 'ivory', 'sindoor', 'haldi'],
    combos: [single, { id: 'couple', label: 'Matching pair for two', add: 1350 }],
    customizable: true,
    customHelp: 'Size (for example L or chest 40), and any names or motifs.',
    leadDays: 10,
    model: { kind: 'punjabi' },
    media: [{ type: 'photo', id: 'punjabi-indigo' }],
  },
  {
    id: 'har-parvati',
    en: 'Har Parvati Panel',
    bn: 'হর পার্বতী',
    aliases: 'hara parvati, shiva parvati, shiv parvati, shiva, panel, হর পার্বতী',
    category: 'art',
    line: 'The divine couple, painted as a blessing.',
    story: 'Shiva and Parvati, the ideal married couple in Hindu tradition, painted on an arched panel. Families hang it in the new home as a blessing for the newlyweds.',
    priceFrom: 2200,
    styles: ['zari', 'sindoor', 'ivory'],
    combos: [single],
    customizable: false,
    leadDays: 10,
    model: { kind: 'archPanel', image: '/media/textures/har-parvati.webp' },
    media: [{ type: 'reel', id: 'har-parvati' }],
  },
  {
    id: 'aradhana',
    en: 'Aradhana Panel',
    bn: 'আরাধনা',
    aliases: 'puja, devotional, panel, আরাধনা',
    category: 'art',
    line: 'Maa Shyamsundari, painted for worship.',
    story: 'From our devotional series: Maa Shyamsundari painted on an arched panel for the home shrine or the wedding altar. Each face is painted freehand, so no two are alike.',
    priceFrom: 1900,
    styles: ['zari', 'sindoor', 'ivory'],
    combos: [single],
    customizable: false,
    leadDays: 10,
    model: { kind: 'archPanel', image: '/media/textures/kali-panel.webp' },
    media: [{ type: 'reel', id: 'kali-panel' }],
  },
  {
    id: 'sabeki-backdrop',
    en: 'Khoi Daan Kulo',
    bn: 'খই দানের কুলো',
    aliases: 'kulo, khoi, khoi daan, kula, winnowing tray, কুলো',
    category: 'ritual',
    line: 'The velvet kulo the bride offers khoi from.',
    story: 'In the wedding\'s fire ritual the bride offers khoi (puffed rice) into the fire from a kulo, the winnowing tray, with the groom standing behind her. Ours is covered in velvet, painted by hand with white feathers and a kalka, and held in a cane frame.',
    priceFrom: 4500,
    styles: ['night', 'sindoor', 'peacock'],
    combos: [single],
    customizable: true,
    leadDays: 12,
    model: { kind: 'kulo' },
    media: [{ type: 'photo', id: 'velvet-arch-backdrop' }],
  },
  {
    id: 'flower-dala',
    en: 'Engagement Platter',
    bn: 'এনগেজমেন্ট প্ল্যাটার',
    aliases: 'dala, platter, engagement, ashirbad, tattva, ডালা',
    category: 'decor',
    line: 'A silk platter crowned with roses, for the engagement rings.',
    story: 'The engagement rings are brought out on this platter. A round tray wrapped in silk and edged with lace, with a hoop of roses at the back and strings of pearls falling to the centre. We make it in your colours.',
    priceFrom: 1200,
    styles: ['rani', 'sindoor', 'haldi', 'peacock'],
    combos: [single, { id: 'set-3', label: 'Set of three', add: 2100 }, { id: 'set-5', label: 'Set of five', add: 3900 }],
    customizable: true,
    customHelp: 'Colours, or the couple\'s names to add on a small tag.',
    leadDays: 6,
    model: { kind: 'flowerDala' },
    media: [{ type: 'photo', id: 'flower-dala' }],
  },
];

export const SETS = [
  {
    id: 'set-shubho-drishti',
    en: 'Shubho Drishti Set',
    bn: 'শুভদৃষ্টি সেট',
    line: 'For the first look: leaves, mirror and kunke.',
    items: ['paan-pata', 'darpan', 'kunke'],
    price: 1150,
  },
  {
    id: 'set-bride-ritual',
    en: 'Bride\'s Ritual Set',
    bn: 'কনের সাজি',
    line: 'Everything the bride carries through the day.',
    items: ['gach-kouto', 'kunke', 'darpan', 'paan-pata'],
    price: 2900,
  },
  {
    id: 'set-crowns',
    en: 'Crown Pair',
    bn: 'মুকুট ও টোপর',
    line: 'Matching shola crowns for bride and groom.',
    items: ['shola-mukut', 'topor'],
    price: 1990,
  },
  {
    id: 'set-complete',
    en: 'The Complete Biye',
    bn: 'সম্পূর্ণ বিয়ের সেট',
    line: 'Rituals, crowns, piri and the hand-painted thala set.',
    items: ['gach-kouto', 'kunke', 'darpan', 'paan-pata', 'shola-mukut', 'topor', 'biyer-piri', 'thala-set'],
    price: 8900,
  },
];

export const STORY = [
  {
    product: 'thala-set',
    photo: { type: 'photo', id: 'aiburobhat-bride' },
    moment: 'The day before',
    title: 'Aiburobhat, the last meal at home',
    body: 'The bride\'s family serves her one final meal as an unmarried daughter. It is laid out on a hand-painted thala set, a small bowl for every dish.',
  },
  {
    product: 'topor',
    photo: { type: 'reel', id: 'topor' },
    moment: 'The groom arrives',
    title: 'A crown made from a reed',
    body: 'He wears a tall topor carved from sholapith, the white core of a marsh reed. It is light as paper and cut like lace.',
  },
  {
    product: 'shola-mukut',
    photo: { type: 'photo', id: 'mukut-garden' },
    moment: 'The bride is dressed',
    title: 'The mukut, for a princess',
    body: 'Her crown is cut from the same pith. With a red and white sari it marks her as Lakshmi, goddess of good fortune, for the day.',
  },
  {
    product: 'biyer-piri',
    photo: { type: 'reel', id: 'biyer-piri' },
    moment: 'Saat paak',
    title: 'Seven circles on a wooden seat',
    body: 'Her brothers lift her on a low painted seat, the piri, and carry her around the groom seven times.',
  },
  {
    product: 'paan-pata',
    moment: 'Shubho drishti',
    title: 'The first look',
    body: 'All the while she hides her face behind two betel leaves. When the circles end she lowers them and the couple see each other.',
  },
  {
    product: 'kunke',
    photo: { type: 'reel', id: 'ritual-set' },
    moment: 'Sindoor daan',
    title: 'A line of vermilion',
    body: 'The groom takes sindoor from a painted kunke and draws it along the parting of her hair. Now she is married.',
  },
  {
    product: 'gach-kouto',
    photo: { type: 'reel', id: 'kouto-river' },
    moment: 'Leaving home',
    title: 'A box kept for a lifetime',
    body: 'Of all the Bengali wedding rituals, the gach kouto is the one that stays. It begins with her wedding and stays with her for the rest of her life.',
  },
];

/** False when the product shows its photos and films only: 3D shape set to "None", a built-in shape
 *  switched off under "3D models", or an uploaded model that was deleted or switched off. */
export const has3d = (p) => {
  const kind = p?.model?.kind;
  if (!kind || kind === 'none' || MODELS.off.includes(kind)) return false;
  return isCustomKind(kind) ? !!customModel(kind) : true;
};
/** A product's own web address: a prebuilt page that search engines can read. */
export const productHref = (id) => `/p/${id}/`;
/* ---------- choices (variants) ----------
   A product's choices are groups of options: [{ id, name, options: [{ id, label, add, photo, stock, count }] }].
   Products saved before choices existed have one list of options (`combos`); they become a single group with the
   id "option", which keeps their cart lines and message text exactly as before. Used by the site, the build and
   the admin, so all three always agree. */
const slugOf = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
const uniqueId = (wanted, used, fallback) => {
  let id = slugOf(wanted) || fallback;
  for (let n = 2; used.has(id); n++) id = `${slugOf(wanted) || fallback}-${n}`;
  used.add(id);
  return id;
};
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function variantsOf(p) {
  const groups = Array.isArray(p?.variants) && p.variants.length
    ? p.variants
    : Array.isArray(p?.combos) && p.combos.length ? [{ id: 'option', name: 'Option', options: p.combos }] : [];
  const usedGroups = new Set();
  return groups
    .filter((g) => g && Array.isArray(g.options) && g.options.length)
    .map((g, gi) => {
      const usedOptions = new Set();
      return {
        id: g.id && !usedGroups.has(g.id) ? (usedGroups.add(g.id), g.id) : uniqueId(g.name, usedGroups, `choice-${gi + 1}`),
        name: String(g.name || 'Option'),
        options: g.options.filter(Boolean).map((o, oi) => ({
          id: o.id && !usedOptions.has(o.id) ? (usedOptions.add(o.id), o.id) : uniqueId(o.label, usedOptions, `option-${oi + 1}`),
          label: String(o.label || ''),
          add: num(o.add),
          photo: o.photo || null,
          stock: ['made', 'ready', 'out'].includes(o.stock) ? o.stock : null,
          count: o.count == null || o.count === '' ? null : num(o.count),
        })),
      };
    });
}

export const byId = (id) => PRODUCTS.find((p) => p.id === id) || SETS.find((s) => s.id === id);
export const isSet = (id) => SETS.some((s) => s.id === id);

/** Search words written for the built-in products, kept before published content replaces PRODUCTS.
 *  Products the admin hasn't given "Other names" use these. */
export const DEFAULT_ALIASES = Object.fromEntries(PRODUCTS.map((p) => [p.id, p.aliases || '']));

/* ---------- categories and sub-categories (one level) ----------
   A category may sit inside another (`parent`). Only one level: a parent that itself has a parent is ignored. */
export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id);
/** The parent of a sub-category; null for a top-level or unknown category. */
export const parentOf = (id) => {
  const par = categoryOf(categoryOf(id)?.parent);
  return par && par.id !== 'all' && !par.parent ? par.id : null;
};
export const topCategories = () => CATEGORIES.filter((c) => c.id !== 'all' && !parentOf(c.id));
export const childrenOf = (id) => CATEGORIES.filter((c) => c.id !== 'all' && parentOf(c.id) === id);
/** A category's web address, made from its English name (/c/thala-sets/), not its internal code. */
export const categorySlug = (c) => slugOf(c.label) || c.id;
export const categoryPath = (c) => `/c/${categorySlug(c)}/`;
export const categoryBySlug = (slug) => CATEGORIES.find((c) => c.id !== 'all' && categorySlug(c) === slug);
/** Products of a parent category include those of its sub-categories. */
export const inCategory = (p, cat) => !cat || cat === 'all' || p.category === cat || parentOf(p.category) === cat;
