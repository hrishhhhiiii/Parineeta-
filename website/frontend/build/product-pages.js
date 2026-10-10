// Build step: writes a real HTML file for every product at /p/<id>/ so search engines and link
// previews see that product's title, description, image and Product data. The page is the
// normal site; the router reads /p/<id> from the path and opens the product on load.
// Set VITE_SITE_URL (e.g. https://parineeta365.in) to add canonical links, absolute social
// images and sitemap.xml. Without it, pages are still written but URLs stay relative.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCTS, CATEGORIES, isSet, parentOf, inCategory, categoryPath, categoryAliasSlug, has3d } from '../src/data/products.js';
import { fromPrice } from '../src/data/pricing.js';
import { photoSrc, photoSrcset, STAGE_SIZES } from '../src/data/site.js';
import { applyAll } from '../src/cms/apply.js';
import { SEO, SOCIALS, STORES, HOMEPAGE, socialUrlOk, phoneList } from '../src/data/homepage.js';
import { SITE } from '../src/data/site.js';
import { productTitle, productDescription, categoryDescription, productSchema, breadcrumbSchema, bothNames } from '../src/data/seo.js';

// Same published content the browser bundle bakes in, so /p/ pages never go stale.
const PUBLISHED_FILE = new URL('../src/data/published.json', import.meta.url);
if (existsSync(PUBLISHED_FILE)) applyAll(JSON.parse(readFileSync(PUBLISHED_FILE, 'utf8')).docs || {});

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DEFAULT_IMAGE = '/brand/og-logo.jpg';
const ldTag = (data, id) => `  <script type="application/ld+json"${id ? ` id="${id}"` : ''}>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>\n`;
// On product and category pages the page's own name is the one <h1>; the homepage headline becomes a paragraph.
const demoteHero = (html) => html.replace(/<h1 class="hero__title"([^>]*)>([\s\S]*?)<\/h1>/, '<p class="hero__title"$1>$2</p>');

export const routableProducts = () => PRODUCTS.filter((p) => !isSet(p.id) && p.model);

/** Up to four of the product's photos (or its film still) for the Product data. */
function productImages(p) {
  const photos = (p.media || []).filter((m) => m.type === 'photo').slice(0, 4).map((m) => photoSrc(m.id, 1600));
  return photos.length ? photos : [productImage(p)];
}

function productImage(p) {
  const photo = p.media?.find((m) => m.type === 'photo');
  if (photo) return photoSrc(photo.id, 1600);
  const reel = p.media?.find((m) => m.type === 'reel');
  if (reel) return `/media/reels/${reel.id}-still.webp`;
  return DEFAULT_IMAGE;
}

/** Homepage title, description, sharing text and LocalBusiness data from the admin's SEO, social and shop settings. */
function applySeo(html) {
  if (SEO.title) html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(SEO.title)}</title>`);
  if (SEO.description) html = setMeta(html, 'name', 'description', SEO.description);
  if (SEO.ogTitle) html = setMeta(html, 'property', 'og:title', SEO.ogTitle);
  if (SEO.ogDescription) html = setMeta(html, 'property', 'og:description', SEO.ogDescription);
  if (SEO.ogImage) html = html.replace(/\s*<meta property="og:image:(width|height|alt)" content="[^"]*" \/>/g, '');
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (m, json) => {
    let ld;
    try { ld = JSON.parse(json); } catch { return m; }
    ld.sameAs = SOCIALS.filter((x) => !x.hidden && socialUrlOk(x.platform, x.url)).map((x) => x.url);
    const phone = STORES.filter((x) => !x.hidden).flatMap((x) => phoneList(x.phones))[0];
    if (phone) ld.telephone = phone.replace(/[^\d+]/g, '');
    if (SITE.email) ld.email = SITE.email;
    if (SEO.description) ld.description = SEO.description;
    // The first shop's map link from the admin: a pasted Google Maps link, or a search for its place.
    const shop = STORES.find((x) => !x.hidden);
    const pasted = String(shop?.mapsUrl || '').trim();
    if (/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+\/maps)(\/|$)/i.test(pasted)) ld.hasMap = pasted;
    else if (shop?.mapsQuery) ld.hasMap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.mapsQuery)}`;
    return `<script type="application/ld+json">\n  ${JSON.stringify(ld, null, 2).replace(/</g, '\\u003c')}\n  </script>`;
  });
}

const abs = (site, path) => (site && !/^https?:\/\//.test(path) ? site + path : path);

/** Swaps one meta tag's content, or inserts it before </head> if the page lacks it. */
function setMeta(html, attr, key, value) {
  const re = new RegExp(`<meta ${attr}="${key}" content="[^"]*"\\s*/?>`);
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

/** Canonical, og:url and absolute og:image for a page, when the site URL is known. */
function setUrls(html, site, path, image) {
  html = setMeta(html, 'property', 'og:image', abs(site, image));
  if (!site) return html;
  html = setMeta(html, 'property', 'og:url', site + path);
  return html.replace('</head>', `  <link rel="canonical" href="${site}${path}" />\n</head>`);
}

/** The product's name, words and photo, written into the page so search engines and no-script visitors
 *  see it straight away. The browser then draws the full product page over it.
 *  The picture sits in the same boxes, and asks for the same files, as the script's own first view
 *  (ui/productPage.js builder + ui/mediaStage.js). So it is on screen before the script runs, the script
 *  finds those files already downloaded, and nothing large appears late. */
function productBody(p, image, cat) {
  const c = CATEGORIES.find((x) => x.id === p.category);
  const sep = '<span class="ico" aria-hidden="true">/</span>';
  const crumbs = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${sep}<a href="${c ? categoryPath(c) : '/#collection'}">${esc(c?.label || 'Collection')}</a>${sep}<span aria-current="page">${esc(p.en)}</span></nav>`;
  const alt = esc(`${bothNames(p)}, hand-painted by Parineeta`);
  const photo = p.media?.find((m) => m.type === 'photo');
  // A product with no 3D model opens on its photo over a blurred copy of it; one with 3D swaps the photo for the model.
  const backdrop = photo && !has3d(p) ? `<img class="ppage__backdrop" src="${esc(photoSrc(photo.id, 400))}" alt="" aria-hidden="true" />` : '';
  const picture = photo
    ? `${backdrop}<span class="ppage__photo"><img src="${esc(photoSrc(photo.id, 1600))}" srcset="${esc(photoSrcset(photo.id))}" sizes="${STAGE_SIZES}" alt="${alt}" fetchpriority="high" /></span>`
    : `<span class="ppage__photo"><img src="${esc(image)}" alt="${alt}" fetchpriority="high" /></span>`;
  const from = fromPrice(p);
  const price = from ? `<p class="ppage__line">From ₹${from.toLocaleString('en-IN')}${cat ? ` · ${esc(cat)}` : ''}</p>` : '';
  const info = `<div class="builder__info"><p class="pp__bn bn" lang="bn" translate="no">${esc(p.bn)}</p><h1 class="ppage__title" id="pg-en" tabindex="-1">${esc(p.en)}</h1><p class="ppage__line">${esc(p.line)}</p><p class="pp__story">${esc(p.story)}</p>${price}</div>`;
  return `<main class="ppage" id="product-page"><div class="container">${crumbs}<div class="builder"><div class="builder__main"></div><aside class="builder__panel"><div class="ppage__viewer builder__stage">${picture}</div>${info}</aside></div></div></main>`;
}

function productHtml(base, p, site, connect) {
  const path = `/p/${p.id}/`;
  const title = productTitle(p);
  const desc = productDescription(p);
  const image = productImage(p);
  const cat = CATEGORIES.find((c) => c.id === p.category)?.label;
  const landingTitle = base.match(/<title>([^<]*)<\/title>/)?.[1] || '';
  const landingDesc = base.match(/<meta name="description" content="([^"]*)"/)?.[1] || '';
  let html = base.replace(/<html lang="en">/, `<html lang="en" data-landing-title="${landingTitle}" data-landing-desc="${landingDesc}">`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = setMeta(html, 'name', 'description', desc);
  html = setMeta(html, 'property', 'og:type', 'product');
  html = setMeta(html, 'property', 'og:title', `${p.en} | Parineeta`);
  html = setMeta(html, 'property', 'og:description', p.line);
  html = setMeta(html, 'property', 'og:image:alt', `${bothNames(p)}, hand-painted by Parineeta`);
  html = html.replace(/\s*<meta property="og:image:(width|height)" content="[^"]*" \/>/g, '');
  html = setUrls(html, site, path, image);
  // Reviews come from the database as soon as the product page starts: open that connection early.
  if (connect) html = html.replace('</head>', `  <link rel="preconnect" href="${esc(connect)}" crossorigin />\n</head>`);
  html = demoteHero(html);
  // The landing page is hidden while a product shows, so its large hero photo waits until the visitor goes
  // there instead of being fetched first, ahead of the product's own picture.
  html = html.replace(/(<figure class="hero__photo">\s*<img [^>]*?)\s+fetchpriority="high"/, '$1 loading="lazy"');
  // The product shows first; the landing page stays in the HTML for when the visitor goes back.
  html = html.replace('<main id="main">', '<main id="main" hidden>').replace('<main class="ppage" id="product-page" hidden></main>', productBody(p, image, cat));
  const ld = productSchema(p, { origin: site, images: productImages(p) });
  const crumbs = breadcrumbSchema(site, { category: p.category, product: p });
  return html.replace('</head>', `${ldTag(ld, 'pg-jsonld')}${ldTag(crumbs, 'pg-crumbs-ld')}</head>`);
}

/* ---------- category pages: /c/<id>/ (shop catalogue, phase 5) ----------
   Every category with products gets its own address, title and description, with its product list written
   into the HTML for search engines and link previews. In the browser, main.js turns /c/<id>/ into the
   collection filtered to that category, the same way /p/<id>/ opens a product. */
export const routableCategories = () => CATEGORIES.filter((c) => c.id && c.id !== 'all' && PRODUCTS.some((p) => !isSet(p.id) && inCategory(p, c.id)));

function categoryHtml(base, c, site) {
  const path = categoryPath(c);
  const parent = CATEGORIES.find((x) => x.id === parentOf(c.id));
  const name = parent ? `${parent.label}: ${c.label}` : c.label;
  const items = PRODUCTS.filter((p) => !isSet(p.id) && inCategory(p, c.id));
  const title = `${name} | Bengali Wedding Pieces from Parineeta, Patuli`;
  const desc = categoryDescription(c, name);
  const image = items.map(productImage).find((x) => x !== DEFAULT_IMAGE) || DEFAULT_IMAGE;
  const landingTitle = base.match(/<title>([^<]*)<\/title>/)?.[1] || '';
  const landingDesc = base.match(/<meta name="description" content="([^"]*)"/)?.[1] || '';
  let html = base.replace(/<html lang="en">/, `<html lang="en" data-landing-title="${landingTitle}" data-landing-desc="${landingDesc}">`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = setMeta(html, 'name', 'description', desc);
  html = setMeta(html, 'property', 'og:title', `${name} | Parineeta`);
  html = setMeta(html, 'property', 'og:description', desc);
  html = html.replace(/\s*<meta property="og:image:(width|height|alt)" content="[^"]*" \/>/g, '');
  html = setMeta(html, 'property', 'og:image:alt', `${name}, hand-painted by Parineeta`);
  html = setUrls(html, site, path, image);
  html = demoteHero(html);
  // The collection's heading becomes the category's own <h1>, with its line under it; it stays after the
  // script starts (main.js keeps it in step when the visitor picks another category).
  // Under it, the category's "About" paragraph from the admin, for Google and for customers.
  const about = String(c.about || '').trim();
  html = html.replace(/<h2 class="h2" id="collection-title"([^>]*)>[^<]*<\/h2>(\s*)<p class="lede"([^>]*)>[^<]*<\/p>/,
    (m, a, gap, b) => `<h1 class="h2" id="collection-title"${a}>${esc(name)}</h1>${gap}<p class="lede"${b}>${esc(c.line || desc)}</p>${gap}<p class="cat-about" id="cat-about"${about ? '' : ' hidden'}>${esc(about)}</p>`);
  // What a search engine (or a visitor without JavaScript) reads; main.js removes it once the page starts.
  const list = items.map((p) => `<li><a href="/p/${p.id}/">${esc(p.en)}</a> <span lang="bn">${esc(p.bn)}</span> · from ₹${fromPrice(p).toLocaleString('en-IN')}</li>`).join('');
  const block = `<section class="container cat-static" id="cat-static"><ul>${list}</ul></section>`;
  html = html.replace('<div class="rails" id="rails"></div>', `${block}<div class="rails" id="rails"></div>`);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description: desc,
    ...(site ? { url: site + path } : {}),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.en, url: abs(site, `/p/${p.id}/`) })),
    },
  };
  return html.replace('</head>', `${ldTag(ld)}${ldTag(breadcrumbSchema(site, { category: c.id }))}</head>`);
}

export function productPages({ site = '', connect = '' } = {}) {
  site = site.replace(/\/+$/, '');
  connect = /^https:\/\/[a-z0-9.-]+\/?$/i.test(connect) ? connect.replace(/\/+$/, '') : '';
  let outDir = 'dist';
  return {
    name: 'parineeta-product-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.path.endsWith('/index.html')) return html;
        html = applySeo(html);
        // The hero photo chosen in the admin is written into the page, so the browser fetches it straight
        // away instead of fetching the built-in one first and swapping when the script runs.
        const hero = HOMEPAGE.hero || {};
        if (hero.photo) {
          html = html.replace(/(<figure class="hero__photo">\s*<img )src="[^"]*" srcset="[^"]*"( sizes="[^"]*") alt="[^"]*"/,
            (m, a, b) => `${a}src="${esc(photoSrc(hero.photo, 1600))}" srcset="${esc(photoSrcset(hero.photo))}"${b} alt="${esc(hero.photoAlt || '')}"`);
        }
        const ogImage = SEO.ogImage ? photoSrc(SEO.ogImage, 1600) : DEFAULT_IMAGE;
        html = setUrls(html, site, '/', ogImage).replace('"image": "/brand/og-logo.jpg"', `"image": "${abs(site, DEFAULT_IMAGE)}"`);
        // With the site address known, the shop gets a stable id and absolute links.
        if (site) html = html.replace('"logo": "/brand/seal-512.png"', `"@id": "${site}/#store",
  "url": "${site}/",
  "logo": "${site}/brand/seal-512.png"`);
        return html;
      },
    },
    async closeBundle() {
      const base = await readFile(join(outDir, 'index.html'), 'utf8');
      const bare = base.replace(/\s*<link rel="canonical" href="[^"]*" \/>/g, '').replace(/\s*<meta property="og:url" content="[^"]*" \/>/g, '');
      const list = routableProducts();
      for (const p of list) {
        const dir = join(outDir, 'p', p.id);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'index.html'), productHtml(bare, p, site, connect));
      }
      const cats = routableCategories();
      for (const c of cats) {
        const dir = join(outDir, ...categoryPath(c).split('/').filter(Boolean));
        await mkdir(dir, { recursive: true });
        const page = categoryHtml(bare, c, site);
        await writeFile(join(dir, 'index.html'), page);
        // A renamed category also answers at the address made from its current name (pages built before
        // addresses were fixed used it). Same page; its canonical link names the real address, and it is
        // left out of the sitemap.
        const alias = categoryAliasSlug(c);
        if (alias) {
          await mkdir(join(outDir, 'c', alias), { recursive: true });
          await writeFile(join(outDir, 'c', alias, 'index.html'), page);
        }
      }
      let robots = 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /login\n';
      if (site) {
        const urls = ['/', ...cats.map(categoryPath), ...list.map((p) => `/p/${p.id}/`)];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${site}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
        await writeFile(join(outDir, 'sitemap.xml'), xml);
        robots += `\nSitemap: ${site}/sitemap.xml\n`;
      }
      await writeFile(join(outDir, 'robots.txt'), robots);
      this.info?.(`product pages: ${list.length}, category pages: ${cats.length}${site ? ', sitemap.xml' : ' (set VITE_SITE_URL for canonical links and sitemap)'}`);
    },
  };
}
