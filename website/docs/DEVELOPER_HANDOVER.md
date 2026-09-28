# Developer handover

## Stack

| Layer | What is actually used |
|---|---|
| Framework | None. This is a plain multi-page **Vite 8** app with three entry pages: `index.html`, `admin.html` and `account.html`. |
| Language | JavaScript (ES modules, `"type": "module"`). The Supabase Edge Function is TypeScript for Deno. |
| UI | Hand-written DOM code (a small `h()` helper), with no UI framework. **three.js** for 3D, **GSAP** and **Lenis** for motion, **@phosphor-icons/core** for icons and **qrcode** for payment QR codes. |
| CSS | Plain CSS in `frontend/src/styles/*.css`, `frontend/src/admin/admin.css` and `frontend/src/account/account.css`. No CSS framework. |
| Database | Supabase Postgres. SQL migrations are in `database/`, the edge function in `backend/`. |
| ORM | None. The admin calls Postgres RPCs through `@supabase/supabase-js`, and the build scripts use plain `fetch` against PostgREST. |
| Authentication | Supabase Auth: email and password for admins (listed in the `admins` table), and optional passwordless email links for customers. |
| Storage | Supabase Storage bucket `media` (public, WebP only, 5 MB limit). Built-in media is in `frontend/public/media`. |
| Hosting | **NOT CONFIGURED.** The GitHub Actions workflow supports Cloudflare Pages or SFTP (Hostinger). `vercel.json` is left over from an earlier Vercel setup. |
| CI/CD | `.github/workflows/publish.yml`. It has not run yet, because there is no GitHub remote. |
| Third-party services | Web3Forms (email enquiries, optional, key NOT CONFIGURED), WhatsApp `wa.me` links, and GitHub `repository_dispatch` (triggered from Postgres through `pg_net`). |

## Project structure

Restructured 2026-09-28 into three top-level folders (`frontend/`, `backend/`, `database/`), with build/ops tooling that spans more than one of them left at `website/` root. See `PROJECT_LOG.md` (repo root, one level up) for the full move and every reference that was updated.

```text
website/
├── frontend/                Everything Vite builds and ships to the browser
│   ├── index.html           Public site markup; the built-in text in it matches frontend/src/data/homepage.js
│   ├── admin.html           Admin entry (noindex)
│   ├── account.html         /account and /track#<token> customer pages (noindex)
│   ├── login.html           Customer sign-in (noindex)
│   ├── vite.config.js       Four entry points + product-pages build plugin
│   ├── package.json         npm scripts (test/cms:* run against the repo root; see their `cd ..`)
│   ├── build/product-pages.js  Build step: writes /p/<id>/index.html per product, sitemap.xml, robots.txt
│   ├── frontend/src/
│   │   ├── main.js          Public site bootstrap
│   │   ├── data/            DEFAULT CONTENT: products.js, site.js (contact, payments, films), reviews.js, announcement.js,
│   │   │                    homepage.js (homepage text, socials, stores, videos, SEO + URL/YouTube validators)
│   │   ├── cms/              Content layer: apply.js (apply docs over defaults), published.js (baked JSON),
│   │   │                    preview.js (admin iframe handshake), defaults.js, extra-schemas.js, urls.js
│   │   ├── admin/            Admin app: admin.js (UI, save/publish/preview), schemas.js (EDITABLE FIELD DEFINITIONS)
│   │   ├── account/          Customer tracking and optional sign-in
│   │   ├── login/            Sign-in page logic
│   │   ├── ui/                Public UI modules; cmsContent.js applies homepage/socials/stores/videos/SEO to the DOM
│   │   ├── three/             3D models and scenes
│   │   └── styles/             CSS
│   └── frontend/public/               Copied as-is: media/, brand/, fonts/, products/, _headers, _redirects, .htaccess, robots.txt
├── backend/
│   └── functions/submit-enquiry/   Supabase Edge Function (Deno), deployed with the Supabase CLI
├── database/
│   ├── schema.sql            Original setup: site_content, admins, is_admin(), the media bucket and its policies
│   ├── SETUP_ALL.sql         schema.sql + every migration concatenated, for a fresh project
│   └── migrations/           001–004, run in order in the Supabase SQL editor
├── scripts/                  cms-schemas.mjs, fetch-content.mjs, mark-job.mjs — cross-cutting CI/ops tooling,
│                              always run with the repo root (website/) as cwd, not frontend/
├── test/cms.test.mjs         Node unit tests (imports from ../frontend/src/...)
├── .github/workflows/publish.yml
└── docs/                     These documents + CMS-PLAN.md (design history; paths in it predate the restructure)
```

There is no traditional backend server: the browser talks to Supabase directly (RLS-protected) for everything except sending an enquiry, which goes through the one edge function above. `scripts/`, `test/` and `docs/` stay at the `website/` root rather than inside one of the three folders, because each of them reaches into more than one layer (for example `cms-schemas.mjs` reads `frontend/src/admin/schemas.js` and writes `database/migrations/002_schemas.sql`).

**Files to know before editing:**
- **`frontend/src/admin/schemas.js`:** the admin's forms. When you change a field, run `npm run cms:schemas` and apply the regenerated `database/migrations/002_schemas.sql`. Otherwise saves fail server-side validation.
- **`frontend/src/cms/apply.js`:** maps each content document onto the data modules. Add a handler here for every new document.
- **`frontend/src/data/*.js`:** the default content. It is also what a never-saved section shows.
- **`frontend/src/data/published.json`:** **generated** in CI and git-ignored. Do not commit it.
- **`database/migrations/002_schemas.sql`:** **generated**. Do not hand-edit it.

## Architecture

```text
Visitor ──▶ Static site (HTML/JS/CSS + media) on the host ── no database calls
               ▲                       │ enquiry (optional)
               │ built by              ▼
        GitHub Action ◀─ dispatch ─ Supabase: Postgres (RPCs, RLS) · Auth · Storage `media`
        (fetch published            ▲                ▲
         content, mirror photos,    │ RPC + JWT      │ Edge Function submit-enquiry
         vite build, deploy)        │                │
                               Admin (/admin)   Customer (/account, /track)
```

**Publish flow:**
1. `save_draft` stores a revision with a version check.
2. `publish()` calls `_publish`, which runs `net.http_post` to the GitHub `dispatches` API.
3. The workflow runs `mark-job building`, then `fetch-content.mjs` (writes `published.json` and mirrors bucket photos into `frontend/public/media/photos/cms/`), then `vite build`, then deploys, then runs `mark-job live`.
4. The admin polls `publish_jobs` to show progress.

**Status:**
- **Verified locally:** unit tests, `vite build`, and the admin, preview and account flows in `?demo` mode.
- **Never run against a real Supabase project or CI yet:** the SQL migrations, the workflow and the Edge Function.

## Commands (from `package.json`)

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
npm run cms:schemas
npm run cms:fetch
```

`npm run cms:fetch` needs `SUPABASE_URL` and `SUPABASE_ANON_KEY` set. There is **no `npm run start`**, because the site is static.

Demo modes (dev server only): `/admin.html?demo` and `/account.html?demo`.

## How the newer documents render
- **Homepage text, stores, socials and videos:** `frontend/src/ui/cmsContent.js` rewrites the existing markup at page load, before icons hydrate. `index.html` keeps the defaults, so the text shows even without JS.
  - When the admin changes these texts, the built HTML still has the old text until the JS runs. Google renders JS, so it's fine for search.
- **SEO:** applied at **build time** in `build/product-pages.js` (`applySeo`). It covers the `<title>`, the meta description, `og:*`, and the JSON-LD `sameAs` (from socials), `telephone` (from stores) and `email`.
- **If you change `index.html` headings,** update `frontend/src/data/homepage.js` to match, so "Set to default" restores the right text.

## Known gaps (TO BE COMPLETED)
- Admin screens for:
  - scheduled publishing (the RPCs exist)
  - a media library and deleting stored photos
  - a dashboard and activity log
- Changing the order of homepage sections
- Weekly backup email: planned in CMS-PLAN.md, **not implemented**
- `vercel.json` can be removed once hosting is chosen
- The original `schema.sql` inserts the owner's email as an admin. Check it before running.
