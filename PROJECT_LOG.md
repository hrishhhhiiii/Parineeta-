# Parineeta: project log

This log records changes, decisions and updates for the Parineeta brand identity and website, newest first.
Each entry notes what changed, why, and where. Decisions that someone might revisit say what the alternative was.

- Brand package: `Parineeta_Brand_Identity/` (built by `_build/build_all.py`)
- Website: `website/` (Vite, three.js; `npm --prefix website run dev`)
- Section design concepts: `design_concepts/` (static 1600×900 HTML comps and PNGs)
- Snapshots before large changes: `_snapshots/`

---

## 2026-09-27 · Indexable product pages

Product pages were hash routes (`#/p/<id>`), so search engines and link previews saw the whole site as one page.

- **Prebuilt pages:** a build plugin, `build/product-pages.js` (registered in `vite.config.js`), writes `dist/p/<id>/index.html` for all 14 products. Each is the normal site with that product's title, description, `og:*` tags (`og:type` product, the product photo or reel still as the image) and static Product JSON-LD. Sets are skipped, as before.
- **Router:** `src/ui/router.js` now also opens a product from the path `/p/<id>/`. The hash form still works and is still used for in-page links. Any other hash on a product path, such as `#collection`, rewrites the URL to `/#collection` and shows the landing page. Prebuilt pages carry the landing title and description on `<html data-landing-title/-desc>`, so leaving a product restores them.
- **Share links and JSON-LD `offers.url`** now use `/p/<id>/`. (`ui/productPage.js`)
- **`VITE_SITE_URL`** (added to `.env.example`): when set at build time, the home page and product pages get `<link rel="canonical">`, `og:url` and absolute `og:image`/JSON-LD image URLs, and `dist/sitemap.xml` lists `/` plus the 14 product pages. When it is empty, pages are still built and URLs stay relative. The build also writes `robots.txt` with `Disallow: /admin` and, when the site URL is set, a `Sitemap:` line.
- **Verified:** without and with `VITE_SITE_URL=https://example.test`, each page has exactly one canonical link and the right image. In headless Chrome, on both the production build and the dev server: a direct `/p/shola-mukut/` opens the product with its title; an `#collection` link returns to the landing title; the `#/p/gach-kouto` route and browser Back work; an unknown `/p/…` falls back to landing. Full audit rerun at 1440, 375 and reduced motion: zero console errors, no missing files, no sideways scroll.
- **To do at launch:** set `VITE_SITE_URL` in the Vercel project settings, then submit `sitemap.xml` in Google Search Console. Products added later through the admin panel (Supabase) get no prebuilt page until the next build, but still open through the hash route.

## 2026-09-27 · Website Phase B: audit and fixes

Checked the production build with headless Chrome (puppeteer-core) at 1440×900 and 375×812, and again at 375 with reduced motion. Checked the dev server with an in-page contrast and label scan.

### Passed, no change needed
- **Contrast:** no text below WCAG AA on the dark, paper or sindoor surfaces.
- **Labels:** every button and link has an accessible name, and every image has alt text. There are no duplicate ids, and the heading order is H1 → H2 → H3.
- **Dialogs:** the cart opens with focus inside, Escape closes it, and focus returns to the cart button (native `<dialog>`).
- **Reduced motion:** Lenis smooth scroll is off, the marquee stops, and the reveals are skipped.
- **Behaviour:** zero console errors, no sideways scroll, and the product page `#/p/gach-kouto` renders at every size.
- **Mobile load:** 163 KB on first load, first paint about 0.5 s, CLS 0.

### Fixed
- **Touch targets:** buttons, icon buttons, the film sound button, the brand link and the footer links were 24–42px on touch screens. All are now at least 44px under `(pointer: coarse)`. (`redesign.css`)
- **Services backdrop loaded early on desktop:** Chrome's preload scanner fetched the 285 KB `velvet-arch-backdrop-1600.webp` at about 480 ms despite `loading="lazy"`. It now uses `data-src`/`data-srcset`/`data-sizes` and is set by an IntersectionObserver 1200px before the section. The desktop first load went from 995 KB to 713 KB, with first paint at 1.4 s against 2.2 s before. The image still loads on scroll. (`index.html`, `main.js` "deferred images")
- **Leftover Title Case:** the seven story chapter titles and the collection category labels are now sentence case. (`data/products.js`)
- **Social preview:** new `public/brand/og-image.jpg` (1200×630, 92 KB): the Bengali wordmark beside the shola mukut photo. It replaces the 412 KB brand board. Added `og:site_name`, `og:locale`, image size and alt. JSON-LD `image` updated. (`index.html`)

### Open, needs a decision or data
- **Domain:** set `VITE_SITE_URL` at build time. The build then adds canonical links, `og:url`, absolute images and `sitemap.xml`.
- ~~**Product pages are hash routes.**~~ Resolved 2026-09-27: prebuilt `/p/<id>/` pages (see "Indexable product pages").
- ~~**Unused heavy files in `public/brand/`.**~~ Resolved 2026-09-27: nine files (4.6 MB) that the site never loads were moved to `_snapshots/public-brand-removed-2026-09-27/`. They were the brand board, both mockups, the crest, the lockup, the original logo, the submark badge and both watermarks. Each is a byte-identical copy of a file in the brand kit folders (`01_`–`05_`, root). The product-page JSON-LD fallback image now points to `/brand/og-image.jpg`. Checked afterwards: the build passes, and the home page, `#/p/gach-kouto` and `admin.html` request no missing files and log no errors.
- **Parallel editor again (2026-09-27, around 05:30):** `admin.html`, `src/admin/`, `src/data/remote.js`, `supabase/`, `vercel.json` and a two-entry `vite.config.js` appeared during this pass, and `three/hero.js` was edited, so it was left in place. One build attempt failed mid-edit, and the next passed.

## 2026-09-27 · Website Phase A: finishing pass

- **Katwa to Patuli:** already done, since the Visit heading reads "Come to *Patuli.*" and no "Katwa" remains in the site source. No change needed.
- **Sentence case site-wide (D6 resolved):** nav, buttons, drawer titles, checkout, product-page labels and service titles now use sentence case. Proper names keep their capitals (product and set names, WhatsApp, UPI, Parineeta). "The Reception" on the invitation card is printed card text and stays as it is. Older headings now use the italic `<em>` style: "Painted in Patuli, *on the banks of the Bhagirathi.*", "The Parineeta *edit.*", "Straight from *the workshop.*". (`index.html`, `data/site.js`, `ui/checkout.js`, `ui/drawers.js`, `ui/productPage.js`, `ui/productPanel.js`, `ui/sections.js`)
- **Dead code:** `frameDistance` moved into `three/stage.js`, and `story.js` imports it from there. The unused `alpanaDataURL` was removed from `three/paint.js`. `three/hero.js` is no longer imported anywhere but is **still on disk**, because deleting it was blocked. It is safe to delete by hand.
- **Older sections:** the marquee is now a sindoor-red strip. The lookbook and reels are on the ivory paper surface, with the lookbook photos shown as prints with soft shadows. In Visit, the email address has its own row, so it no longer breaks mid-word. The footer sits on a solid ground under a gold hairline. (`redesign.css`, `index.html`)
- **Browser surfaces:** added a themed scrollbar, `accent-color` and `caret-color` (gold on dark, sindoor on paper) and the date-picker icon style. (`redesign.css`)
- Backup of `src/` and `index.html` taken before the pass (session scratchpad).

### Verification
- At 1440px and 375px, the page has no sideways scroll. The product page `#/p/gach-kouto` renders, the 3D story canvas starts, there are no console errors, and `vite build` passes.

## 2026-09-26 · Website redesign from the section concepts

**Status:** done 2026-09-26 19:4x. Verified in headless Chrome at 1440×900 and 390×844 with no console errors and no horizontal overflow, and `vite build` passes.

**Scope.** Carry the eight approved concepts in `design_concepts/` into the live site. Restyle and restructure the matching sections in place. Keep every working feature: 3D story, product pages, cart, wishlist, enquiry, checkout, alpana and invitation studios, lightbox and films.

**Safety.** The full source was snapshotted to `_snapshots/website-2026-09-26-1908/` before any edit. New styling lives in `website/src/styles/redesign.css`, imported last, so the redesign can be reviewed or reverted as one file.

### Decisions
| # | Decision | Why | Alternative not taken |
|---|----------|-----|-----------------------|
| D1 | Hero becomes photo-led: the noir shola mukut photo, headline bottom-left. The 3D hero kouto is removed. | Matches the concept. The page opens on a real product instead of waiting for WebGL, which improves first paint on phones. 3D stays in the story, the pavilion and the product views. | Keep the 3D kouto beside the new layout (two competing heroes). |
| D2 | The rituals section keeps its scroll-driven 3D story and gains the concept's heading and the large Bengali numeral ৭ as the page's one signature detail. | The concept's static index list would have removed a working, distinctive feature. | Replace the 3D story with the static index and photo. |
| D3 | The collection opens on a photo grid of the shop's real product photos. The 3D pavilion stays one tap away through the view toggle. | Matches the concept. Real photos sell faster than renders, and the mobile pavilion is currently failing to start (see Open issues). | Keep 3D as the default view. |
| D4 | Sections alternate surfaces: dark oxblood, ivory paper (trust, invitations) and one sindoor-red field (bridal sets). | Gives the long page rhythm and matches the concepts. | Keep every section on the same dark background. |
| D5 | Custom work becomes one full-bleed velvet-arch band with a row of the four real services from `SERVICES` in `src/data/site.js`. | Matches the concept. Uses real service data, not the placeholder labels in the comp. | Keep the photo tile grid. |
| D6 | Headings in redesigned sections use sentence case, as in the concepts. | The concepts were approved in sentence case, and sentence case reads calmer. Title Case had been applied site-wide by a separate edit on 2026-09-26 (see below). | Keep Title Case. **Flagged for the owner to confirm.** |
| D7 | Buttons are flat solid gold, not a gradient with a glow. | Matches the concepts and the earlier audit (gradients and glows made every button equally loud). | – |

### Changes
| Section | What changed | Files |
|---------|--------------|-------|
| All | Added `src/styles/redesign.css`, imported last in `main.js`. It defines `.surface-paper` (ivory) and `.surface-sindoor` (red) surfaces by remapping the colour tokens, so existing components recolour without new markup. Emphasised words in headings use `<em>` (gold on dark, sindoor on paper). | `main.js`, `redesign.css` |
| Hero | The 3D kouto canvas, colourway label, drag hint and repaint button are removed. The noir shola mukut photo fills the right 64% with scrims (on phones it stacks above the text). The primary button is now "Plan your pieces on WhatsApp", with "Explore the collection" as a text link. A caption reads "শোলার মুকুট · Shola mukut, cut from reed pith · from ₹950". The pause-animations button stays, top right. The photo has a slight scroll parallax in place of the old glow. `three/hero.js` is no longer loaded, but `story.js` still imports its `frameDistance` helper. | `index.html`, `main.js` |
| Trust | Ivory paper surface. Photos on the left (one large, two small; the fourth photo is still reachable in the lightbox), copy on the right, and the three facts in a row. | `index.html`, `redesign.css` |
| Seven objects | Heading "A Bengali wedding, in *seven objects.*" and a large faint Bengali ৭ behind the intro on desktop (hidden on phones). The 3D scroll story is unchanged. | `index.html`, `redesign.css` |
| Collection | Opens on a photo grid of all 14 pieces with Bengali name, English name and price, and a wishlist button on each tile. Each tile uses the shop's photo, else a film still, else the 3D render (only Paan Pata). The filters are underlined text tabs. The toggle reads "Photos / 3D pavilion". `?view=grid` is now the default, and `?view=3d` is added only when chosen. | `index.html`, `main.js`, `ui/sections.js` (`renderGrid`, new `tileImage`), `redesign.css` |
| Bridal sets | Sindoor-red field with a new lede. Cards are translucent on red, and buttons are cream with red text. | `index.html`, `redesign.css` |
| Invitation studio | Ivory paper surface. The selected segment and tab are ink on paper, inputs are light, and the card casts a warm shadow. Heading in sentence case. | `index.html`, `redesign.css` |
| Custom work | Full-bleed velvet-arch band with centred heading "Painted to order, *for the whole wedding.*" and a row of the four services from `SERVICES`. Each one opens the enquiry form with that service as the subject, and "Describe your commission" opens a general one. The old photo tiles and the generated alpana pattern are gone, so `alpanaDataURL` is no longer imported by `main.js`. | `index.html`, `main.js`, `ui/sections.js` (`renderBento`), `redesign.css` |
| Visit | Display heading "Come to *Katwa.*"; everything else unchanged. | `index.html`, `redesign.css` |
| Alpana studio | Heading in sentence case. | `index.html` |

**Not changed:** marquee, film band, lookbook, reels, reviews, map, footer, product pages, dialogs. They were not in the concepts.

**New copy to confirm with the owner:** "Plan your pieces on WhatsApp", "Pieces that belong together, painted to match and priced as one.", "Browse the shop's own photographs, or turn each piece in 3D and choose its colours.", "Painted to order, for the whole wedding.", "Come to Katwa.", "Describe your commission".

### Verification
- Flows tested at desktop and mobile: 14 photo tiles render. Switching to 3D starts the pavilion (focus card shows Gach Kouto ₹1,450) and writes `?view=3d`. A service opens the enquiry with its subject. A tile opens `#/p/gach-kouto`.
- Page width is exactly 1440 and 390 with no sideways scroll, and there are no console errors.

### Open issues
- ~~**Mobile 3D pavilion does not start.**~~ Resolved: after the redesign, the pavilion starts on a 390px viewport when chosen (verified 2026-09-26). The earlier failure was seen while a separate editor was changing `gallery.js` and `stage.js`. The cause was not isolated.
- ~~**Title Case vs sentence case (D6).**~~ Resolved 2026-09-27: sentence case site-wide. Redesigned headings use sentence case. Other copy (nav, buttons, chips, footer) is still in the Title Case applied by the separate edit. Pick one convention and apply it site-wide.
- `src/three/hero.js` is mostly unused now. Move `frameDistance` into `stage.js` and delete `hero.js` once the hero decision is final.
- **Parallel editing.** A second editor changed `index.html`, `main.js`, `drawers.js`, `checkout.js`, `enquiry.js`, `productPage.js`, `gallery.js`, `stage.js` and `dialogs.js` on 2026-09-26 between 18:05 and 18:48. Changes included Title Case copy, `translate="no"` on Bengali text, undo toasts in the cart, the collection filter in the URL and a pause-animations button. They are kept as found.

---

## 2026-09-26 · Section design concepts (static comps)

- Built eight 1600×900 section comps as HTML in `design_concepts/`, using the site's real photos, fonts (Cormorant Garamond, Plus Jakarta Sans, Noto Serif Bengali), palette, product names and prices. Rendered each to PNG with headless Chrome.
- Sections: hero, trust, seven objects, collection, bridal sets, custom work, invitation and alpana studio, visit and footer.
- **Decision:** built in HTML instead of an AI image model. The Higgsfield account had 0 credits, Bengali text renders correctly in HTML, and the result can be coded from directly.
- Copy that does not exist on the live site: "Painted to order, for the whole wedding", "Make it yours, before we paint it", "Come to Katwa". To be confirmed by the owner.

## 2026-09-26 · Website refinement pass (impeccable audit)

Fixed after a desktop and mobile audit:
- Mobile horizontal overflow: the collection focus-card buttons now wrap. The page is 390px wide again, and the header icons stay on screen. (`main.css`)
- Gold buttons and the WhatsApp button changed from gradient plus glow to solid gold with a small drop shadow. (`main.css`)
- Section entrances: headings start at 20% opacity instead of invisible and animate for 0.6s instead of 1s. (`main.js`)
- Removed the lone uppercase "Try it yourself" label. (`index.html`)
- Touch targets are 44px on touch screens, and hover lifts are off on touch devices. (`main.css`)
- Zari gold paint changed to `#A8741F` so it differs from Haldi yellow. (`ui/alpana.js`)
- The story progress bar has a visible track. (`main.css`)
- Bridal-set renders start loading about 1000px before the section. (`ui/drawers.js`)

Not done: browser-surface theming (scrollbar, date picker) and a full second audit.

## 2026-09-26 · Brand package QA

- Emblem: the knot sits inside the master artwork's lower disc, and the black band below the art is gone. One-colour, foil and emboss files use the vector emblem again (the gold emblem PDF is 38 KB with no raster). The `pad` parameter works again. The knot's pleats are clipped to the cloth. (`_build/art.py`)
- Regenerated the missing brand guidelines PDF: `00_Brand_Guidelines/Parineeta_Brand_Guidelines.pdf`, 16 pages.
- Build: 113 PNGs and 38 PDFs, with no PDF verification problems.
- Open: the vector knot looks flat against the photoreal emblem. Options: an AI-merged master emblem, or a redrawn knot from the reference image, which needs to be sent again.

## 2026-09-25 · Brand package created

- Built the vector brand system: emblem, lockups, monogram, seal, one-colour versions, icons, social templates, pattern, stationery mockups and the 16-page guidelines. Built with Python and HarfBuzz so the Bengali text shapes correctly.
- The client's ornate traditional emblem (raster) was adopted as the primary full-colour emblem at the client's request.
