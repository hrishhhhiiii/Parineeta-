// Build step: writes a real HTML file for every product at /p/<id>/ so search engines and link
// previews see that product's title, description, image and Product data. The page is the
// normal site; the router reads /p/<id> from the path and opens the product on load.
// Set VITE_SITE_URL (e.g. https://parineeta365.in) to add canonical links, absolute social
// images and sitemap.xml. Without it, pages are still written but URLs stay relative.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PRODUCTS, CATEGORIES, isSet } from '../src/data/products.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DEFAULT_IMAGE = '/brand/og-image.jpg';

export const routableProducts = () => PRODUCTS.filter((p) => !isSet(p.id) && p.model);

function productImage(p) {
  const photo = p.media?.find((m) => m.type === 'photo');
  if (photo) return `/media/photos/${photo.id}-1600.webp`;
  const reel = p.media?.find((m) => m.type === 'reel');
  if (reel) return `/media/reels/${reel.id}-still.webp`;
  return DEFAULT_IMAGE;
}

const abs = (site, path) => (site ? site + path : path);

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

function productHtml(base, p, site) {
  const path = `/p/${p.id}/`;
  const title = `${p.en} (${p.bn}) | Parineeta, Patuli`;
  const desc = `${p.line} ${p.story}`.slice(0, 300);
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
  html = setMeta(html, 'property', 'og:image:alt', `${p.en} (${p.bn}), hand-painted by Parineeta`);
  html = html.replace(/\s*<meta property="og:image:(width|height)" content="[^"]*" \/>/g, '');
  html = setUrls(html, site, path, image);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.en,
    alternateName: p.bn,
    description: p.story,
    category: cat,
    brand: { '@type': 'Brand', name: 'Parineeta' },
    image: abs(site, image),
    offers: { '@type': 'Offer', priceCurrency: 'INR', price: p.priceFrom, availability: 'https://schema.org/MadeToOrder', ...(site ? { url: site + path } : {}) },
  };
  return html.replace('</head>', `  <script type="application/ld+json" id="pg-jsonld">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`);
}

export function productPages({ site = '' } = {}) {
  site = site.replace(/\/+$/, '');
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
        return setUrls(html, site, '/', DEFAULT_IMAGE).replace('"image": "/brand/og-image.jpg"', `"image": "${abs(site, DEFAULT_IMAGE)}"`);
      },
    },
    async closeBundle() {
      const base = await readFile(join(outDir, 'index.html'), 'utf8');
      const list = routableProducts();
      for (const p of list) {
        const dir = join(outDir, 'p', p.id);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'index.html'), productHtml(base.replace(/\s*<link rel="canonical" href="[^"]*" \/>/g, '').replace(/\s*<meta property="og:url" content="[^"]*" \/>/g, ''), p, site));
      }
      let robots = 'User-agent: *\nAllow: /\nDisallow: /admin\n';
      if (site) {
        const urls = ['/', ...list.map((p) => `/p/${p.id}/`)];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${site}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
        await writeFile(join(outDir, 'sitemap.xml'), xml);
        robots += `\nSitemap: ${site}/sitemap.xml\n`;
      }
      await writeFile(join(outDir, 'robots.txt'), robots);
      this.info?.(`product pages: ${list.length}${site ? ', sitemap.xml' : ' (set VITE_SITE_URL for canonical links and sitemap)'}`);
    },
  };
}
