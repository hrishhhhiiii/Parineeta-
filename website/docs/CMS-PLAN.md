# Parineeta CMS: reviewed implementation plan

Status: reviewed by `/plan-ceo-review` on 2026-09-28 in SELECTIVE EXPANSION mode. **Partly implemented (2026-09-28):** see §10 for which tasks are done and what still needs the real Supabase, GitHub and hosting accounts.

Source brief: "PAREENITA — Production Admin Panel / CMS Implementation" (34 sections). This plan adapts the brief to the real project. Wherever it departs from the brief, it records the decision (D1…D9) and the evidence.

Revision 2 applies the 40 findings from the adversarial spec review and decision D9 (the publish pipeline moved to GitHub Actions and Cloudflare Pages).

Revision 3 applies round 2 of the spec review (score 7/10, 13 new findings N1–N13) and makes the host swappable (D10). **Where a revision 3 amendment below conflicts with the body of this plan, the amendment wins.**

## 0. Revision 3 amendments

**D10: host-agnostic deploy.** The Action ends in a single `deploy` step selected by the repo variable `DEPLOY_TARGET`:
- `cloudflare` (default): `wrangler pages deploy dist`.
- `sftp`: for Hostinger or any shared host. It uploads `dist/` to `${REMOTE_DIR}.next`, then swaps the folders over SSH (`mv live live.prev && mv live.next live`). A plain FTP upload without the swap is allowed only when the host has no SSH, and the runbook states that such an upload is not atomic.
- `public/.htaccess` mirrors `_redirects` and `_headers` for Apache and LiteSpeed. Cloudflare ignores the file, and the Hostinger build uses it.

Rollback per target:
- **Cloudflare:** the dashboard rollback.
- **SFTP:** `live.prev` is swapped back, or the workflow is re-run on an earlier commit.

**N1: retry after a failed build.** `content_heads` gains `deployed_rev`.
- `mark_job(live)` copies `published_rev` to `deployed_rev` for every key in the job.
- The "not live yet" state is computed as `published_rev ≠ deployed_rev`, so the dashboard is correct after a failure.
- The new owner RPC `redeploy()` inserts a job for the keys that are not live yet and dispatches it. It works even when there are no draft changes.
- The admin's Retry button calls `redeploy()`.

**N2: a schedule can't roll content back.** When a schedule fires, `_publish` skips every key whose current `published_rev` is greater than the snapshot revision (revision ids only increase). Skipped keys are recorded in the activity log detail and in `scheduled_publishes.error`.

**N3: sequence, not timestamps.**
- `_publish` takes `nextval('publish_seq')` **after** acquiring the advisory lock and stores it in `publish_jobs.seq` and `content_heads.published_seq`.
- `published_content` exposes `published_seq`, and `fetch-content.js` writes `max(published_seq)` to `content-version.json`.
- `mark_job(live, seq)` marks every job with `seq ≤ seq` as live.

**N4: staging and production are separate targets.**
- The dispatch payload carries `target` (`production` or `staging`).
- The workflow sets `concurrency: publish-${{ github.event.client_payload.target || 'production' }}` and `environment: <target>`, and each GitHub Environment holds its own secrets.
- Checkout uses `ref: main` for production and `ref: staging` for staging.

**N5: one deploy path.**
- `on: push` to `main` runs the same workflow in the `publish-production` group and fetches published content, so code deploys also carry the latest content.
- The runbook forbids deploying production from a laptop.

**N6: no `service_role` in CI.**
- `_publish` generates `job_secret = encode(gen_random_bytes(24),'hex')`, stores `sha256(job_secret)` on the job, and sends the secret in `client_payload`.
- `mark_job(id, secret, status, seq, run_url, deploy_url, error)` is granted to `anon` and verifies the hash, which works for exactly one job.
- A push-triggered run has no job, so it doesn't call `mark_job`.
- Branch protection on `main` without bypass is a prerequisite.
- The dispatch PAT is fine-grained and scoped to this one repo.

**N7: media ids.**
- The mirror downloads all three variants (`-400`, `-800`, `-1600`) to `public/media/photos/cms/<uuid>-<w>.webp`.
- The published URL is then rewritten to the id `cms/<uuid>`, so `photoSrc()` and `productImage()` both resolve through the existing `/media/photos/<id>-<w>.webp` scheme.
- `productImage()` also passes full URLs through unchanged (a fix for the bug that exists today).

**N8: enquiry delivery.**
- `submit-enquiry` is deployed with `--no-verify-jwt`.
- The client sends a CORS simple request (`Content-Type: text/plain`, no custom headers) with `keepalive: true`.
- The function parses the JSON itself and answers the `OPTIONS` preflight anyway.

**N9: IP key.**
- Use the rightmost `x-forwarded-for` entry added by Supabase's gateway (verify on staging, and record the result in the runbook), falling back to `cf-connecting-ip`.
- A global cap of 60 enquiries per hour backs up the per-IP limit.

**N10: preview handshake.**
- The iframe posts `{type:'cms-preview-ready'}` to its parent, and the admin replies only when `event.source === iframe.contentWindow`.
- The iframe accepts only messages from `location.origin`.

**N11:** `_headers` and `.htaccess` send `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`, never `DENY`.

**N12:** there is no `/admin` rewrite rule, because Pages serves `admin.html` at `/admin` natively. `.htaccess` maps `/admin` to `admin.html` itself, since Apache does not.

**N13:** the PAT expiry date is stored in `cms_config.pat_expires_on`. The dashboard shows a health tile that turns amber 14 days before expiry.

**Partials closed:**
- **8:** `published.js` uses `import.meta.glob('../data/published.json', { eager: true })`, which returns `{}` when the file is absent.
- **18:** `<` in JSON-LD is written as `<`.
- **29:** lists have no `order` field; array order is the order. `lat`/`lng` are dropped, because `mapsUrl` is enough. `featured` stays, and it pins a product to the front of the collection.
- **7:** validation runs inside the RPCs, not in a trigger. The backfill calls the same validation function.

---

## 1. Architecture assessment (brief §1)

| Question | Finding |
|---|---|
| Framework | Vite 8, plain JavaScript ES modules. No React/Next, no TypeScript. |
| Frontend | A single `index.html` (about 40 KB of hand-written markup) plus `src/main.js`, which renders sections from data files with the `h()` DOM helper (`src/ui/dom.js`, textContent only). three.js 3D story and collection, GSAP ScrollTrigger pins, Lenis scroll. Hash and `/p/<id>/` product routes (`src/ui/router.js`). |
| Backend | None of its own. Supabase: Postgres, Auth and Storage, called from the browser under row-level security (RLS). |
| Database / ORM | Postgres (Supabase). No ORM. Tables `site_content (key, data jsonb)` and `admins (email)` (`supabase/schema.sql`). |
| Authentication | Supabase Auth, email and password. The `is_admin()` SQL function checks `admins`. The JWT is sent in the Authorization header, not in cookies. |
| Image handling | Static images in `public/media` as WebP at 400, 800 and 1600. Admin uploads are resized in the browser to 1600 px WebP and stored in the public `media` bucket (`admin.js:203`). |
| API routes | None. The public site reads `site_content` over Supabase REST at runtime (`src/data/remote.js`). |
| Admin | `/admin` (`admin.html`, `src/admin/admin.js` 482 lines, `schemas.js` 236 lines). A schema-driven form builder with 9 sections, a demo mode, and a reset per section to the bundled content. |
| Design system | Tokens in `src/styles/main.css` and `redesign.css`: ink `#150507`, paper `#f3e9d6`, sindoor `#a8161f`, gold `#e3aa3e`. Fonts: Cormorant Garamond, Plus Jakarta Sans, Noto Serif Bengali. |
| Hosting (today) | Vercel (`vercel.json`), with no git. The **Hobby plan forbids commercial use** ([Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines)), and deploy hooks need a Git-connected project ([deploy hooks](https://vercel.com/docs/deploy-hooks)). Hosting therefore moves (D9). |

**Hard-coded content to move into the CMS:**
- Hero heading, subtitle, CTA and caption.
- Every section heading, italic highlight and lede in `index.html`.
- The marquee and the film-band copy.
- The Visit section: three call numbers, email and address.
- Footer and reels social links (6 places) and the footer tagline.
- SEO meta, OG tags and the LocalBusiness JSON-LD in `<head>` (including `sameAs`).
- The YouTube review films (`REVIEWS` in `site.js`).

**Reusable:**
- The `h()` renderer and all `render*` functions in `src/ui/sections.js`.
- `CONTENT_APPLY` (`remote.js:36`). It moves to `src/cms/apply.js` with no `import.meta.env`, so it runs in Node too.
- The admin field system in `schemas.js` and `admin.js`, and the existing `validate()` at `admin.js:155` for friendly messages.
- The bundled data files, which become the defaults registry.
- `build/product-pages.js`.

**Landmines in the current code:**
- `main.js:30` `await loadRemoteContent()` blocks the first render for up to 3.5 s.
- `admin.js:181` upserts a whole document blindly, so the last write wins.
- There is no history, so one bad save permanently replaces a section.
- `/p/<id>/` pages are built from bundled data and go stale.
- Nothing validates content on the server.
- Storage policies let any admin overwrite or delete media (`schema.sql:44-51`).
- The site is hosted on a plan that doesn't permit commercial use.

## 2. Decisions

| # | Decision | Answer |
|---|---|---|
| D1 | Architecture | **C: keep the JSON documents and add a publish pipeline.** This adds revisions, draft and publish, activity and validation enforced in the database, and a static rebuild on publish. The public site stops calling Supabase at runtime. |
| D2 | Mode | Selective expansion |
| D3.1 | TypeScript | **Cut.** Use a JSON Schema generated from `schemas.js` (pg_jsonschema on the server), plus JSDoc. |
| D3.2 | Roles | **A role column enforced in the database, with no UI.** `owner` can do everything. `editor` can save drafts and upload photos, but cannot publish, restore, delete media, change settings, or read enquiries. |
| D3.3 | Stores | **A "Shops" list inside Contact & business settings**, with the full field set from brief §8. |
| D4.1–4 | Extras | **Accepted:** enquiry inbox, weekly backup, scheduled publish, announcement bar. |
| D5 | Homepage reorder | **Only the free sections can be reordered.** Anchored sections are a code constant. Section backgrounds are assigned by position. |
| D6 | Hardening | **Included:** 1 edit-conflict detection, 2 unsaved-change protection, 4 publish status. **Declined:** 3, the media table and orphan cleanup. |
| D6.3 | Brief §6 media usage | **Lightweight:** usage is computed on demand, and deleting a photo that's in use asks for confirmation. |
| D7 | Enquiry retention | **Auto-delete after 18 months.** The form states this. |
| D8 | Local git | Declined at first, then **reversed by D9**. A GitHub repo is needed for the publish pipeline. |
| D9 | Publish pipeline / hosting | **A: private GitHub repo, a GitHub Actions build, deployed to Cloudflare Pages** (free, commercial use allowed). The Action reports its own status and mirrors uploaded media into the build. |

## 3. Target architecture

```
  OWNER / EDITOR                          SUPABASE (ap-south-1, free tier)
  ┌───────────────────┐   JWT + RPC  ┌──────────────────────────────────────────────────────────┐
  │ /admin            │─────────────▶│ Auth · Postgres                                          │
  │ admin.js (forms)  │              │  admins(email, role)                                     │
  │ schemas.js        │              │  content_schemas(key, schema)  ← npm run cms:schemas      │
  │  Preview ─────────┼─postMessage─┐│  content_revisions · content_heads · activity_log        │
  │  (drafts in hand) │             ││  publish_jobs · enquiries · enquiry_rate                 │
  └────────┬──────────┘             ││  view published_content (owner-rights, anon SELECT)      │
           │ upload (3 sizes)       ││  RPCs (authenticated only) · _publish (internal)         │
           ▼                        ││  pg_cron: dispatch-sweep 1m · scheduled publish 5m ·     │
     Storage `media` (webp)         ││           enquiry purge 03:00 · rate purge hourly ·      │
                                    ││           revision prune monthly · backup Sun 00:30 UTC  │
                                    ││  pg_net + Vault(GITHUB_DISPATCH_TOKEN) ──┐               │
                                    ││  Edge Fns: submit-enquiry, weekly-backup │               │
                                    │└──────────────────────────────────────────┼───────────────┘
                                    │                                           │ POST /repos/…/dispatches
                                    │                                           ▼ {event_type:"cms-publish", job_id}
                                    │   GITHUB ACTIONS (private repo, concurrency group "publish")
                                    │   1 mark_job(building)  2 fetch-content.js → src/data/published.json
                                    │   3 mirror media → public/media/cms/, rewrite URLs  4 vite build
                                    │   5 wrangler pages deploy dist  6 mark_jobs(live, content_version, url)
                                    │   on failure: mark_job(failed, run URL)   · daily cron: keep-alive ping
                                    │                                           │
                                    │                                           ▼
                                    │               CLOUDFLARE PAGES (static; _redirects, _headers)
                                    └──── /?preview=1 iframe ◀── same bundle ── visitors: zero Supabase
                                          calls, except the enquiry POST
```

**Coupling.** Before: every visit went through `main.js → remote.js → Supabase`. After: `main.js → src/cms/published.js`, a static import that falls back to defaults when the file is absent (for example in local dev).

Only `admin.js` and the GitHub Action talk to Supabase. Preview receives drafts from the admin by `postMessage`, so supabase-js is never in the public bundle.

**Extensibility.** A new module (testimonials, offers, blog) needs three things:
- an entry in `schemas.js`
- an `apply.js` handler
- a renderer

Revisions, draft and publish, validation, activity, preview and reset all key off the document `key`, so the new module gets them for free.

### 3.1 Content documents

| key | Shape | Brief § |
|---|---|---|
| `products` | As today, plus `featured` and `order`. Media items gain `alt`. | §4 |
| `categories` | Plus `hidden` and `order` | §5 |
| `sets`, `story`, `reviews`, `trust`, `services` | As today | homepage |
| `lookbook` | Plus `alt`, `caption` and `hidden` (this is the gallery) | §7 |
| `settings` | Keep `site.whatsapp` and `site.email` as the **single source**, plus `payments`. Add `site.phones[]`, `shops[]{name,address,city,phone,email,mapsUrl,lat,lng,opens,closes,photo,description,active,order}` and `about{title,body,story}`. | §8, §11, §12 |
| `homepage` ★ | `hero{heading,headingEm,sub,ctaText,ctaUrl,photo,caption,visible}` and `sections[]{id,title,titleEm,lede,visible,order}`. Anchored sections come from a code constant (`ANCHORED = ['hero','story','collection']`); the schema's `order` applies only to the free ones. | §3 |
| `socials` ★ | A list of `{platform,url,label,visible,order}`. `platform` comes from a registry (`src/cms/platforms.js`) that supplies the icon and the allowed URL hosts. | §9 |
| `videos` ★ | A list of `{youtubeId,title,description,product,visible,order}`. A pasted URL is normalized to an 11-character id. | §10 |
| `seo` ★ | `home{title,description,ogTitle,ogDescription,ogImage}` and `productTemplate{titleSuffix,fallbackImage}`. Product pages build their SEO from the product's name, line and photo. Canonical links come from `VITE_SITE_URL`. | §13 |
| `announcement` ★ | `{text,linkText,linkUrl,startsAt,endsAt,visible}` | D4.4 |

New optional fields have render-time defaults, so existing `site_content` rows validate unchanged (§9 backfill).

### 3.2 Relational tables (lifecycle, not content)

```sql
alter table admins add column role text not null default 'owner' check (role in ('owner','editor'));

content_schemas(key text primary key, schema jsonb not null)          -- emitted by npm run cms:schemas
content_revisions(id bigserial pk, key text not null references content_schemas(key), data jsonb not null,
                  created_at timestamptz not null default now(), created_by text not null,
                  source text not null check (source in ('save','restore','reset','migration')))
  create index on content_revisions (key, created_at desc);
content_heads(key text pk references content_schemas(key),
              draft_rev bigint references content_revisions(id),
              published_rev bigint references content_revisions(id),
              version int not null default 0,          -- bumped by save/restore/reset ONLY (not publish)
              updated_at timestamptz, updated_by text, published_at timestamptz, published_by text)
scheduled_publishes(id bigserial pk, rev_map jsonb not null,        -- {key: rev_id} snapshot at schedule time
                    publish_at timestamptz not null, created_by text not null,
                    status text not null default 'pending' check (status in ('pending','done','cancelled','failed')),
                    error text)
publish_jobs(id bigserial pk, requested_at timestamptz not null default now(), requested_by text not null,
             keys text[] not null, net_request_id bigint,
             status text not null check (status in ('queued','building','live','failed')),
             content_version timestamptz, run_url text, deploy_url text, error text, finished_at timestamptz)
activity_log(id bigserial pk, at timestamptz not null default now(), actor text not null, action text not null,
             entity_key text, entity_ref text, entity_label text, detail jsonb)   -- append-only
  create index on activity_log (at desc);
enquiries(id uuid pk default gen_random_uuid(), created_at timestamptz not null default now(),
          name text not null check (char_length(name) between 1 and 120),
          phone text check (phone ~ '^\+?[0-9 ]{8,16}$'), email text check (char_length(email) <= 200),
          event_date date, place text check (char_length(place) <= 200),
          items jsonb not null default '[]', note text check (char_length(note) <= 4000),
          status text not null default 'new' check (status in ('new','replied','ordered','closed')))
  create index on enquiries (created_at desc); create index on enquiries (status);
enquiry_rate(ip_hash text, window_start timestamptz, count int not null, primary key (ip_hash, window_start))

create view published_content as                                -- default (owner-rights) view, NOT security_invoker
  select h.key, r.data, h.published_at from content_heads h join content_revisions r on r.id = h.published_rev;
```

**Grants and RLS:**
- Revoke `insert/update/delete` on every table from `anon` and `authenticated`.
- Revoke `execute` on every function from `public` and `anon`. Grant `execute` on the user RPCs to `authenticated` only. `_publish`, `mark_job` and the cron functions are executable only by `postgres` and `service_role`.
- anon: `select` on `published_content` only.
- `authenticated` with `is_admin()`: `select` on revisions, heads, jobs, schedules and the activity log.
- `enquiries`: `select` only with `is_owner()`.
- Storage: upload for `is_admin()` with `bucket_id='media'`. **Delete for `is_owner()` only. No update policy**, because paths are unique per upload.
- The bucket is limited to `allowed_mime_types = ['image/webp']` and `file_size_limit = 5 MB`.

**RPCs.** All are `security definer` with `set search_path = public`, and each checks the caller's role.

| RPC | Role | Does |
|---|---|---|
| `save_draft(key, data, expected_version, source default 'save')` | editor+ | Validates with pg_jsonschema, inserts a revision, updates the head `where version = expected_version` and bumps `version`. When 0 rows are updated it raises `CONTENT_CONFLICT`. Only `source` values `save` and `reset` are allowed. |
| `publish()` | owner | Publishes **all keys whose draft differs from published**, by calling `_publish(rev_map, actor)`. With none, it raises `NO_CHANGES`. |
| `_publish(rev_map, actor)` | internal | Takes an advisory lock and sets `published_rev` for each key. It writes activity, inserts `publish_jobs(queued)`, and calls `net.http_post` to GitHub `dispatches` with `{job_id}`. It stores `net_request_id` and writes published data through to `site_content` until migration 003. |
| `schedule_publish(at)` / `cancel_schedule(id)` | owner | Snapshots the current dirty `rev_map` into `scheduled_publishes`, or cancels one. |
| `restore_revision(rev_id)` | owner | Creates a new draft revision (`source='restore'`) with that data and bumps `version`. |
| `get_heads()` | editor+ | Returns the draft and published data plus the version per key, for the admin and preview. |
| `media_usage(url)` | editor+ | Checks `jsonb_path_exists` across **draft, published and pending-scheduled revisions of every key**. |
| `set_enquiry_status(id, status)` / `delete_enquiry(id)` | owner | Changes an enquiry's status or deletes it, and logs the activity with the enquiry id only (no personal data). |
| `export_content()` | owner | Returns the heads, the current draft and published data, and the last 20 revisions per key. |
| `mark_job(id, status, …)` | service_role (Action) | Updates the job. On `live`, it also marks every earlier `queued` or `building` job whose `requested_at ≤ content_version` as `live`, because those changes are included. |

**Validation.** Supabase's pg_jsonschema provides `jsonb_matches_schema` for the check and `jsonschema_validation_errors` for the error list. The generator emits the **draft-07 subset** only: `type`, `required`, `maxLength`, `enum`, `items`, `properties`, and `pattern` restricted to Rust-regex-compatible syntax with no lookaround. Friendly field-level messages ("Product 3: price must be a number") come from the admin's existing field validation before the call. The server list is the authoritative fallback. Migration rows run the same trigger; they pass because every new field is optional.

### 3.3 Lifecycle state machine (site-wide draft set)

```
            save_draft (any key)                publish() / schedule fires
   ┌────────┐ ───────────────▶ ┌──────────────┐ ────────────────────────▶ ┌───────────┐  job live  ┌──────┐
   │ CLEAN  │                  │ UNPUBLISHED  │                           │ PUBLISHING│ ─────────▶ │ LIVE │
   │(=live) │◀── restore ──────│ CHANGES (n)  │◀──── job failed ──────────│ (job)     │            └──┬───┘
   └────────┘   (new draft)    └──────┬───────┘   (drafts stay; Retry)    └───────────┘               │
        ▲                             │ schedule_publish(at): snapshot rev_map                        │
        │                             ▼ (later saves do NOT change the snapshot; admin warns          │
        │                      ┌───────────┐  "scheduled version differs from your current draft")   │
        │                      │ SCHEDULED │── cron at publish_at → _publish(snapshot) ─────────┘     │
        │                      └───────────┘── cancel_schedule → cancelled                             │
        └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Invalid transitions, and what blocks each:**

| Transition | Blocked by |
|---|---|
| Publishing with no changes | `NO_CHANGES` |
| An editor publishing | Role check |
| A stale draft overwriting a newer one | `version` check |
| Two publishes racing | Advisory lock in `_publish` plus GitHub concurrency group `publish` (queued runs are serialized; a newer pending run replaces an older pending one, and each build fetches the latest published content) |
| A partial publish breaking references between documents | Publish is all-or-nothing across dirty keys |

**"Hidden" (brief §15)** is a per-item `hidden`/`visible` flag. Hidden items stay in drafts and revisions, and the renderers skip them.

### 3.4 Publish → live flow (all four paths)

```
publish() ─▶ dirty keys? ── none ─▶ RAISE NO_CHANGES (button already disabled: "Everything is live")
    │ validation fails on a stale draft ─▶ RAISE INVALID_CONTENT (tx rolled back; nothing published)
    ▼
_publish: heads updated, job 'queued', net.http_post(GitHub dispatches)   [async: sent after commit]
    ▼
cron dispatch-sweep (every 1 min): read net._http_response for queued jobs
    │ status ≠ 204 or no response after 2 min ─▶ job 'failed', error "Couldn't start the update" ─▶ admin Retry
    ▼
GitHub Action (concurrency: publish, cancel-in-progress: false)
    mark_job(building)
    fetch-content.js: published_content via anon REST
        │ HTTP error/timeout 20 s ─▶ exit 1 ─▶ mark_job(failed, run_url)        (live site unchanged)
        │ 0 rows and CMS_ALLOW_EMPTY≠1 ─▶ exit 1 (protects against a mis-granted view shipping defaults)
        │ one key fails apply ─▶ that key keeps bundled defaults; ::warning:: ; job live with warning
    mirror media: download bucket URLs referenced in published data → public/media/cms/, rewrite URLs
        │ referenced file missing (deleted, then an old revision restored) ─▶ warning; the item renders without that image
    vite build (bindings fill via linkedom; product-pages; sitemap)
    wrangler pages deploy ─ fail ─▶ mark_job(failed)
    mark_job(live, content_version = max(published_at), deploy_url) ─▶ admin chip "Live ✓ 12:04"
Stuck guard: job not live/failed 15 min after requested_at ─▶ admin shows "Taking longer than usual. Open run log."
```

### 3.5 Preview (brief §16)

- **What it renders:** the admin already holds the drafts it is editing. Preview opens `/?preview=1` in an iframe with Desktop 1280, Tablet 768 and Mobile 375 toggles.
- **How drafts arrive:** `main.js` sees `?preview` and waits for one `postMessage({type:'cms-preview', docs, at})` from `location.origin` (the origin is checked), with a 10 s timeout. It then runs the same `applyAll()` and `applyBindings()` used at build time, and the same renderers.
- **Banner:** "Preview. Not live. Drafts from 12:03."
- **No message within 10 s:** it shows the live content with the banner "Open preview from the admin to see drafts."
- **Bundle cost:** supabase-js is not loaded, and the public bundle adds about 1 KB.

### 3.6 Defaults and reset (brief §14)

- **Defaults registry:** the bundled `src/data/*.js`, plus new `src/data/homepage.js`, `socials.js`, `videos.js`, `seo.js` and `announcement.js`. These hold today's hard-coded text and are the only place default strings live. A unit test checks that every `data-cms` binding key exists in the defaults.
- **Reset field:** the icon appears only when a value differs from its default. The confirmation shows "Current: … → Default: …", and confirming changes the draft only.
- **Reset section:** the confirmation lists the number of fields and items that will change, then calls `save_draft(..., source='reset')`.
- **No reset-everything button.** Owner-only revision restore, with a typed confirmation, covers disaster recovery.

### 3.7 Bindings (`src/cms/bindings.js`)

| Kind | Where it's used | How it's written |
|---|---|---|
| `text` | headings, ledes, captions, addresses | `textContent`. The italic highlight comes from a separate field wrapped in `<em>` by code. |
| `attr` | `href` (CTA, socials, `tel:`, `mailto:`, maps, `wa.me`) and meta `content` | Passed through `src/cms/urls.js`. `https:` only, plus `tel:`, `mailto:` and `https://wa.me/` where declared. Social URLs are checked against the platform's allowed hosts. A rejected URL falls back to the default. |
| `jsonld` | LocalBusiness JSON-LD, including `sameAs` | Built with `JSON.stringify`, then `<` is escaped as `<`. |
| `list` | socials, phones, shops | Rendered with `h()` into a container. |

- **At build time:** the Vite `transformIndexHtml` plugin fills the bindings using **linkedom** (a new devDependency for build time only, justified because regex rewriting 40 KB of markup is fragile). The same step reorders free sections and assigns the `surface-*` classes by position.
- **At runtime:** preview uses the same map through the real DOM.

## 4. Accepted extras

1. **Enquiry inbox (D4.1, D7).**
   - **Site side:** `enquiry.js` keeps WhatsApp and email as the primary channels. It also calls `fetch(VITE_SUPABASE_URL + '/functions/v1/submit-enquiry', {method:'POST', headers:{apikey, Authorization: 'Bearer ' + anonKey}})` without awaiting it, before the WhatsApp tab opens. A failure logs `console.warn`, and the customer's flow is unaffected.
   - **The function:**
     - CORS is allowed for the site origin only.
     - The client IP comes from Supabase's `x-forwarded-for` and is hashed with an `ENQUIRY_IP_SALT` secret.
     - It checks a honeypot field, allows 5 per hour per IP hash (`enquiry_rate`), and validates lengths.
     - It inserts with the service role.
   - **Admin:** an owner-only "Enquiries" page with status filters, detail view, status changes, a "WhatsApp them" link, and CSV export.
   - **Retention:** a cron job deletes enquiries older than 18 months at 03:00 UTC nightly. Activity rows reference the enquiry id only, never the name.
   - **Form privacy line:** "We keep your enquiry for 18 months to plan your order, then delete it."
2. **Weekly backup (D4.2).**
   - A "Download backup" button calls `export_content()` and returns JSON.
   - pg_cron runs `30 0 * * 0` (Sunday 00:30 UTC, which is 06:00 IST) and calls the `weekly-backup` Edge Function, which emails the JSON through Resend (`RESEND_API_KEY` in Supabase secrets).
   - `supabase/restore-backup.mjs` loads a backup into a fresh project.
3. **Scheduled publish (D4.3).** The "Publish at…" option snapshots the `rev_map`. A cron job every 5 minutes calls `_publish(snapshot, 'system:scheduler')` for due rows. On failure it writes the status and error, and the dashboard shows an alert.
4. **Announcement bar (D4.4).** The build renders it hidden. A 10-line inline script shows it only while `startsAt ≤ now < endsAt`, so it expires on time without a rebuild. Visitors can dismiss it, and that is remembered in `localStorage` against a hash of the text.

---

## 5. Review

### Section 1: Architecture
- **OK:** Only the admin and the Action talk to Supabase. Visitors never do, except for the enquiry POST. Photos are served from the site's own CDN (mirrored at build).
- **WARNING:** Publishing now takes about 2–3 minutes (GitHub Actions spin-up plus the build). The admin shows progress (D6-4), and preview covers "see it now".
- **WARNING:** Free Supabase projects pause after 7 days without activity. A paused project stops the admin and preview. The live site keeps working, because its content and media are static. Mitigation: a daily cron in the Action pings `published_content`.
- **Scaling:** 14 products and about 11 documents, with the largest under 50 KB. That fits 100× growth. The first thing to strain is rendering very large lists in the admin; not needed now.
- **Single points of failure:** GitHub Actions (publishing is blocked, but the live site is unaffected), Supabase (the admin, preview and inbox), and the owner's login (mitigated by two owner accounts and a documented password reset).
- **Rollback:** Cloudflare Pages keeps every deployment and can roll back to any earlier one. Content can be rolled back with `restore_revision` then publish. The migrations are additive.

### Section 2: Error and rescue map
```
CODEPATH                    | WHAT CAN GO WRONG                  | ERROR (name)               | RESCUED | USER SEES
----------------------------|------------------------------------|----------------------------|---------|-----------------------------------------------
save_draft                  | version mismatch                   | CONTENT_CONFLICT (P0001)   | Y       | "Someone else changed Products at 12:03. Reload to see their changes." Edits kept in local autosave
                            | schema invalid (server)            | INVALID_CONTENT (P0001)    | Y       | server error list mapped to fields (client checks catch most first)
                            | role lacks right                   | 42501                      | Y       | "This account can't do that. Ask the owner."
                            | offline / 15 s timeout             | TypeError / AbortError     | Y       | "Not saved: no connection. Changes kept on this device." Retry
                            | JWT expired                        | PGRST301                   | Y       | silent refresh once, else a sign-in modal that keeps the form state
publish                     | no changes                         | NO_CHANGES                 | Y       | button disabled + "Everything is live"
dispatch (pg_net, async)    | GitHub 401/404/422 / no response   | job failed (sweep)         | Y       | red chip "Couldn't start the update" + Retry
Action fetch-content        | Supabase down / timeout / 0 rows   | exit 1 → mark_job(failed)  | Y       | "Update failed. The site is unchanged." + run log link
Action apply (per key)      | document can't apply               | ::warning:: ApplyError     | Y       | "Live ✓ with 1 warning: Services used defaults"
Action media mirror         | referenced file missing            | ::warning:: MediaMissing   | Y       | same warning chip; the item shows without its image
Action deploy (wrangler)    | Cloudflare API error               | exit 1 → mark_job(failed)  | Y       | failed chip + run log
Action mark_job itself      | Supabase unreachable at the end    | job stays 'building'       | Y       | the stuck guard at 15 min: "Taking longer than usual. Open run log."
photo upload                | undecodable / HEIC unsupported     | DOMException → NOT_IMAGE   | Y       | "This file isn't a photo we can read. Use JPG, PNG or WebP."
                            | > 20 MB input                      | FILE_TOO_LARGE             | Y       | "Photo is larger than 20 MB."
                            | storage 403/413                    | StorageApiError            | Y       | "Upload failed: not allowed or storage full."
media delete                | in use                             | IN_USE (pre-check)         | Y       | confirmation listing the places it's used
                            | editor tries delete                | 42501 (storage policy)     | Y       | delete button hidden for editors; the API refuses anyway
preview                     | no postMessage in 10 s             | PREVIEW_TIMEOUT            | Y       | banner "Open preview from the admin to see drafts"
submit-enquiry              | rate limited / honeypot / invalid  | 429 / 400                  | Y       | nothing; the customer's WhatsApp flow is unaffected
                            | function down                      | FetchError                 | Y*      | nothing; enquiry not stored (*accepted: WhatsApp or email is the record)
scheduled publish cron      | _publish raises                    | scheduled_publishes.failed | Y       | dashboard alert "Scheduled publish at 00:00 failed: …" + Publish now
weekly-backup               | Resend error                       | activity 'backup_failed'   | Y       | dashboard tile "Last backup email failed" + Download backup
login                       | wrong password                     | invalid_credentials        | Y       | "Email or password is wrong"
```
That's 23 rows. Two catch-alls in today's code get replaced: `loadRemoteContent`'s catch-and-warn, and `save` showing the raw `error.message`. Client messages never include SQL or stack traces. Technical detail goes to `console.error` and the Action log.

Errors raised inside a transaction are **not** written to `activity_log`, because the rollback removes the row. Conflicts and failed saves show only in the client. The activity log records only operations that succeeded.

### Section 3: Security and threat model
| Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Direct table writes with an admin JWT (skipping validation) | Med | High | Writes revoked; only `security definer` RPCs with validation can write |
| Editor escalates (publish, restore, delete media, read personal data) | Low | Med | Role checks in the RPCs; owner-only storage delete; owner-only select on enquiries; no update policy on media |
| Anonymous access to RPCs (Supabase grants functions to `anon` by default) | Med | High | `revoke execute … from public, anon`; explicit grants; RLS matrix test |
| View leaks or empties | Low | High | `published_content` is an owner-rights view exposing published data only; the build fails on 0 rows |
| XSS through CMS text | Med | High | `text` bindings use `textContent`; `<em>` comes from code; JSON-LD escapes `<`; renderers use `h()` |
| Malicious URLs (`javascript:`, `data:`, look-alike hosts) | Med | High | Allowlist in `urls.js` at the admin, the RPC schema pattern (`^https://`) and render time; socials checked against platform hosts |
| Unsafe uploads (SVG script, polyglots) | Med | Med | Decoded and re-encoded to WebP by canvas, so the original bytes are never stored; the bucket accepts webp only, up to 5 MB |
| GitHub token leak | Low | High | Fine-grained PAT for **one repo**, permission Contents: write (required for `repository_dispatch`), with an expiry; stored in Supabase Vault and never in the browser; rotation documented |
| Cloudflare API token in the Action | Low | Med | A GitHub encrypted secret scoped to Pages:Edit for one account |
| `mark_job` forgery | Low | Low | Needs the service-role key, which exists only in GitHub secrets |
| Enquiry spam and personal data | High (spam) | Med | Honeypot, 5 per hour per salted IP hash, length checks, owner-only read, 18-month purge, privacy line |
| Preview message spoofing | Low | Low | `event.origin === location.origin`; affects only the viewer's own iframe |
| CSRF | N/A | – | Bearer JWT, not cookies |
| SQL injection | Low | High | Parameterized RPCs; no dynamic SQL |
| Brute-force login | Med | High | Supabase Auth rate limits; 12-character minimum passwords; leaked-password protection turned on; `/admin` noindex through `_headers` |
| Audit trail | – | – | `activity_log` is written only inside the security-definer RPCs and triggers; append-only |

**Dependencies.** New devDependencies: `linkedom` (build-time HTML), `puppeteer-core` (E2E), `wrangler` (deploy, run in the Action with `npx`). There are **no new runtime dependencies**, and supabase-js becomes admin-only.

### Section 4: Data flows and interaction edge cases

**Save:** input → field validation (client) → `save_draft` → pg_jsonschema → revision → head (`version` check) → activity.

| Input case | Result |
|---|---|
| Nil document | Rejected |
| Empty list | Allowed; the section shows its empty state or hides |
| Wrong type | `INVALID_CONTENT` |
| Too long | `maxLength` (headings 120, ledes 400) |
| Bengali or emoji | Allowed; lengths are counted in code points |
| Stale version | `CONTENT_CONFLICT` |

**Async ordering.** The invariant: after all publish runs finish, the live site equals the latest published heads.

| Schedule | What happens | Why it's safe |
|---|---|---|
| 1 | Publish A (job 1) and publish B (job 2) arrive while run 1 builds. GitHub keeps one pending run, and run 2 fetches after B. | Its `content_version` covers both, so `mark_job` marks jobs 1 and 2 live. |
| 2 | Run 1 fetched before B and finishes after B was queued. | Run 1 marks only jobs with `requested_at ≤ its content_version`, so job 2 stays queued until run 2 deploys the newer content. |
| 3 | Run 2 finishes before run 1. | Impossible: the concurrency group serializes runs. |

**Regression proof:** unit-test `mark_job`'s inclusion rule with synthetic job rows and timestamps. There's no real-time race test against GitHub.

**Interaction edge cases:**

| Interaction | Edge case | How it's handled |
|---|---|---|
| Save | Double click | Button disabled plus the version check |
| Save | Navigate away mid-edit | `beforeunload` warning and a local autosave every 5 s, recovered with a banner (D6-2). Autosave is localStorage only and never writes to the database. |
| Save | Session expired | Sign-in modal over the form |
| Publish | Double click | Advisory lock plus `NO_CHANGES` |
| Publish | Tab closed while building | Job continues; status shown on the next visit |
| Upload | HEIC photo from a phone | `createImageBitmap` where supported, else `NOT_IMAGE` |
| Upload | 30 photos at once | Sequential queue with per-file results |
| Reorder | On a phone | Up and down buttons, keyboard accessible; drag is an enhancement |
| Delete category | Products still in it | Blocked: "7 products use this category. Move them to: [select], then delete." |
| Delete product | Used in sets, story or videos | Confirmation lists where it's used; confirming removes those references from the drafts, and the all-keys publish keeps everything consistent |
| Change slug | Page may be shared | Warning: "Links already shared to /p/old-name/ will stop working." No redirects (cut in revision 2). |
| Empty list | 0 items | "No products yet. + Add product" |
| Preview | Slow connection | Drafts come from the admin's memory, so there is no network wait. The site's own assets load normally. |
| Schedule | Draft changed after scheduling | Warning; the snapshot stays unchanged |
| Restore | Old revision refers to deleted photos | Warning in the restore confirmation: "2 photos in this version were deleted and won't show" |

### Section 5: Code quality
- **One schema source:** `schemas.js` generates both the admin forms and `content_schemas`. Friendly messages come from the field definitions. The duplicated rules in `admin.js:155` become generated.
- **One apply path:** `src/cms/apply.js` is used by the build (Node), main.js, preview and tests. The runtime fetch in `remote.js` is deleted at cutover.
- **One binding map:** `bindings.js` is shared by the build plugin and preview.
- **Structure:** `src/cms/` (apply, bindings, urls, youtube, platforms, published, schema-gen), `supabase/migrations/NNN_*.sql`, `supabase/functions/*` and `.github/workflows/publish.yml`.
- **Refactor first:** `admin.js` `field()` (lines 218–327) branches about 12 ways. Turn it into a type → renderer map before adding types (T4).
- **Cut in revision 2 as unapproved scope:** slug redirects, per-product SEO overrides, the "Live:" value under every field, and list search and paging for content items. Paging stays for the activity log and enquiries only (brief §26).

### Section 6: Tests
The runner is built-in `node --test`, so no dependency is added. E2E uses `puppeteer-core`. There is one **staging** setup: a Supabase project, a Cloudflare Pages project and the same repo's `staging` branch, with the workflow taking the target from the dispatch payload.

```
NEW THING                         TYPE          HAPPY                          FAILURE                          EDGE
schema-gen                        unit          every key → draft-07 subset    unknown field type throws        nested lists; patterns compile in Rust-compatible form
urls.js policy                    unit          https / tel / mailto / wa.me   javascript:, data:, http:, bad host  whitespace, IDN host
youtube normalize                 unit          watch / youtu.be / shorts      non-YouTube rejected             ids with - and _
apply.js per key                  unit          applies                        bad doc keeps bundled value      empty lists
bindings (linkedom)               unit          fills text/attr/jsonld         missing key → default            "<script>" stays text; "</script>" escaped in JSON-LD
section order + surfaces          unit          free sections reorder          anchored can't move              all free sections hidden
mark_job inclusion rule           unit (SQL fn) job ≤ version marked live      later job stays queued           equal timestamps
save_draft / publish / restore    integration   rev, head, activity            CONTENT_CONFLICT, INVALID, NO_CHANGES  editor publish → 42501
RLS + grants matrix               integration   anon reads published only      anon can't call any RPC; editor can't read enquiries or delete media  no update policy on storage
dispatch sweep                    integration   204 → stays queued             401 → failed                     no response after 2 min → failed
submit-enquiry                    integration   inserted                       honeypot, 6th/hour → 429         4001-character note rejected
purge / prune crons               integration   old rows gone                  –                                exact 18-month boundary; published revisions kept
fetch-content.js                  integration   writes published.json          down → exit 1; 0 rows → exit 1   CMS_ALLOW_EMPTY=1 allows empty
E2E admin → public (staging)      e2e           per brief §32 list, asserted   invalid login rejected; logout;  admin at 375 px
                                                on the public staging URL      /admin data blocked without a session
                                                after the Action run
```

**The brief §32 checklist, each asserted on the public staging site after the rebuild:**
- An updated product appears, and a deleted product disappears.
- A new shop appears, and a removed shop disappears.
- Social link changes show in the footer and the reels section.
- A replaced image shows.
- Homepage changes appear.
- A reset to default restores the default text.

**Extra checks:**
- **2am Friday:** publish from a phone-sized viewport, then fail the Action (a bad Cloudflare token on staging). The admin shows "failed" and the live site is unchanged.
- **Hostile QA:** `javascript:alert(1)` in every URL field, and `<img onerror>` in every text field.
- **Chaos:** Supabase paused during a run. The run fails and the site is untouched.
- **Flakiness:** E2E polls `publish_jobs`, with no fixed sleeps. Cron functions are called directly.

### Section 7: Performance
- **Public site:** it gets faster. The runtime fetch (up to 3.5 s), the per-visit REST call and supabase-js all go away, and images come from the same CDN.
- **Indexes:** as in §3.2. The activity log and enquiries page 50 rows at a time.
- **Revision growth:** a realistic estimate is about 20 saves a day at an average of 15 KB, around 110 MB a year raw, or roughly 30–40 MB after TOAST compression. That is well under the 500 MB free tier. Autosave never writes to the database. A monthly prune keeps every published revision plus the last 50 drafts per key (T16, P2).
- **Slowest paths:**
  1. Publish to live: about 2–3 minutes.
  2. `media_usage`: about 11 heads × 3 revisions scanned, under 50 ms.
  3. Upload: 3 WebP sizes, about 1–2 s per photo.
- **Image variants:** `media/photos/<uuid>-{400,800,1600}.webp`. `photoSrcset` handles cms ids with all three sizes. Legacy uploads with only the 1600 size fall back to a single-entry srcset.
- **CI budget:** GitHub Actions allows 2,000 free minutes a month on private repos. At about 3 minutes per run, that's roughly 650 publishes a month.
- **Verify before relying on it:** Cloudflare Pages free-plan deploy limits for Direct Upload (T2).

### Section 8: Observability
- **Dashboard:** `activity_log` feeds a "Recent changes" panel filtered by actor, action, entity and IST time.
- **Publish status chip:** comes from `publish_jobs`, with a link to the GitHub run log and to the deployment.
- **Health tiles:**
  - last successful publish
  - scheduled publishes
  - last backup email
  - enquiries in the last 7 days
  - unpublished changes
  - last keep-alive ping
- **Alerts:** GitHub emails the repo owner about failed workflow runs. Add the owner as a repo collaborator with notifications on. The admin shows a red chip on failure and the stuck guard at 15 minutes.
- **Runbook (in `ADMIN-SETUP.md`):**
  - publish failed
  - GitHub token expired
  - Supabase paused
  - locked out
  - restore from a backup file
  - roll back a deployment in Cloudflare

### Section 9: Deployment and rollout
1. **T1:** freeze and back up, then `git init` with a baseline commit, push to a private GitHub repo, and tell the other editor to commit instead of editing blind.
2. Migrations 001 and 002: roles, tables, `content_schemas` (generated first), views, RPCs, grants and storage policies. Then back up `site_content` into one `source='migration'` revision per key, with `draft_rev = published_rev`, and check that the counts match. **The old admin is frozen from here until cutover.**
3. Set up the pipeline on **staging**: the Action, Cloudflare Pages, the Vault token, and the cron sweep. Build in shadow mode and check that `published.json` equals the `site_content` export.
4. Point production at the pipeline: add the Cloudflare Pages project and the custom domain, with `_redirects` (`/admin /admin.html 200`) and `_headers` (noindex on `/admin*`, plus security headers).
5. **Cutover:** deploy the new site (no runtime fetch, preview, bindings) and the new admin. Unfreeze admin edits.
6. Configure Resend and the backup and purge crons.
7. Migration 003, one week later: stop writing `site_content` and drop it.

**Rollback:**
- Up to step 5: point DNS back at the Vercel deployment. It still reads `site_content`, which `_publish` keeps updated with **published data only**.
- After step 5: roll back to an earlier Cloudflare Pages deployment. For content, restore a revision and publish.

**Post-deploy checks:**
- **Within 5 minutes:** zero console errors on `/` and `/p/gach-kouto/`, `/admin` noindex header present, and a login works.
- **Within 1 hour:** one real publish round trip from the owner's phone, and the Sunday backup test sent manually.

### Section 10: Long-term trajectory
- **Reversibility: 4/5.** The migrations are additive, Pages keeps its deployment history, and the content is portable JSON.
- **Debt:**
  1. The `data-cms` bindings, guarded by a unit test.
  2. Supabase-specific pieces (pg_net, pg_cron, Vault, pg_jsonschema), all in migrations.
  3. The 2–3 minute publish latency.
  4. Hosting moved to Cloudflare, so the Vercel config is retired.
- **Next:** testimonials and offers are new keys; collections reference product ids; a blog generalizes `product-pages.js` into pages built from documents.
- **Retrospective:** the enquiry inbox introduces the first personal data (D7). The Hobby-plan finding (D9) mattered more than any of the extras: the site was hosted on a plan its business doesn't qualify for.

### Section 11: Design and UX (admin)
**Information architecture**, a sidebar on desktop and a bottom sheet on phones:
- Dashboard
- Homepage (Hero, Sections, Announcement)
- Products
- Categories
- Bridal sets
- Gallery
- Media library
- Videos
- Enquiries (owner only)
- Contact & business (Shops, Phones, About, Payments)
- Social links
- SEO
- Activity
- Settings (Backup)

**Header:** the status chip, "3 unpublished changes", **Preview**, and **Publish all changes ▾** (Publish now or Publish at…).

```
 Login ─▶ Dashboard ─▶ Section ─▶ Item editor ─[Save draft]─▶ toast "Saved 12:03 · not live yet"
                                    └─[Preview]─▶ iframe (D/T/M) ◀─ postMessage drafts
 Publish all changes ─▶ confirm ("Publishing: Products, Homepage, Social links") ─▶ chip
     queued ─▶ building (~2–3 min, run log) ─▶ Live ✓ 12:06 | Failed ✕ [Retry] [Run log]
```

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Section list | skeleton | "No products yet. + Add product" | named error + Retry | – | – |
| Save draft | spinner | – | field errors / conflict banner | "Saved · not live yet" | – |
| Publish | "Building… about 2–3 min" | "Everything is live" | "Update failed. Site unchanged." Retry | "Live ✓ 12:06" | "Live ✓ with 1 warning" |
| Media library | grid skeleton | "Upload your first photo" | per-file errors | thumbnails | "12 of 14 uploaded, 2 failed" |
| Preview | skeleton + banner | – | "Open preview from the admin" | – | – |
| Enquiries | skeleton | "No enquiries yet. They'll appear here." | Retry | – | paged |

- **Brand:** the admin uses the site's tokens. Paper workspace, ink text, sindoor for primary and destructive actions, gold only for the Live chip. Cormorant for titles and Jakarta for UI text. Transitions only, capped at 150 ms.
- **Accessibility:** labelled controls, up/down reorder, focus moved to the first error, 44 px touch targets, a working 375 px layout, and AA contrast checked with the project's existing contrast script.
- **Touches:** a "Set to default" icon only where the value differs, Noto Serif Bengali in Bengali fields, and a sticky Save/Publish bar on phones.

Recommend `/plan-design-review` for the admin before implementation.

---

## 6. What already exists and is reused
- `h()` and all renderers.
- `CONTENT_APPLY`, which becomes `apply.js`.
- The `schemas.js` field system and the `admin.js` editors and `validate()`.
- In-browser WebP resizing.
- The `site_content` data, backed up into revisions.
- The `is_admin()` pattern.
- `product-pages.js` and `VITE_SITE_URL`.
- The headless-Chrome audit scripts.
- `ADMIN-SETUP.md`.

## 7. NOT in scope
| Item | Answer | Rationale |
|---|---|---|
| TypeScript migration | Cut (D3.1) | Content validity comes from the schema. |
| Role management screen | Not chosen (D3.2) | Two owners. |
| Dedicated Stores module | Not chosen (D3.3) | Shops are covered in settings. |
| Media table and orphan cleanup | Declined (D6) | Alt text lives on each reference; usage is computed on demand. |
| Vercel hosting | Replaced (D9) | The Hobby plan doesn't allow commercial use, and hooks and webhooks need Git or Pro. |
| Slug redirects, per-product SEO overrides, "Live:" value under fields, content list search and paging | Cut in revision 2 | No recorded decision; none needed for 14 products. |
| Editing self-hosted MP4 reels in the CMS | Not requested | The brief covers YouTube only. |
| Global "reset everything" | Omitted | Revision restore covers recovery. |

## 8. Dream state delta
**The 12-month ideal:**
- The owner runs the shop from `/admin`: content, seasonal launches, enquiries through to orders.
- The site is static, fast, indexed per product and legitimately hosted.
- Every change is reversible and attributed.

**Still missing after this plan:** order and payment tracking beyond enquiry status, customer accounts, and multi-language copy. The architecture blocks none of them.

## 9. Failure modes registry
```
CODEPATH            | FAILURE MODE                     | RESCUED | TEST | USER SEES                        | LOGGED
--------------------|----------------------------------|---------|------|----------------------------------|----------------------
save_draft          | concurrent edit                  | Y       | Y    | conflict banner                  | client console
save_draft          | invalid content                  | Y       | Y    | field errors                     | client console
dispatch            | GitHub rejects / no response     | Y       | Y    | failed chip + Retry              | publish_jobs.error
Action              | Supabase down / 0 rows           | Y       | Y    | failed chip, site unchanged      | run log + job
Action              | out-of-order completion          | Y       | Y    | correct final content            | job content_version
Action              | mark_job unreachable             | Y       | Y    | stuck guard 15 min               | run log
Action              | media missing                    | Y       | Y    | "live with warning"              | run log warning
upload              | bad file / too big / 403         | Y       | Y    | named message                    | console
media delete        | in use / editor                  | Y       | Y    | confirmation / hidden button     | activity (on delete)
preview             | no drafts message                | Y       | Y    | banner                           | –
enquiry insert      | function down                    | Y*      | Y    | nothing (WhatsApp unaffected)    | console.warn
scheduled publish   | _publish raises                  | Y       | Y    | dashboard alert                  | scheduled_publishes
backup email        | Resend error                     | Y       | Y    | dashboard tile                   | activity
Supabase paused     | inactivity                       | Y       | Y    | site fine; admin "paused" notice | keep-alive run log
login               | wrong password                   | Y       | Y    | "Email or password is wrong"     | Supabase auth log
```
Critical gaps: **0.** One non-critical gap is accepted: a stored enquiry is lost if the function is down (*). WhatsApp or email remains the customer's actual record, by design (D4.1).

## 10. Implementation tasks
- [~] **T1 (P1, human ~2h / CC ~15m)**: Freeze and back up. `git init`, a baseline commit, a private GitHub repo and push; brief the other editor. *Verify:* `git log` shows the baseline; the repo is private. **Status:** local git baseline done; the private GitHub repo and push still need the owner.
- [~] **T2 (P1, human ~4h / CC ~20m)**: Hosting: create the Cloudflare Pages project (staging and production), add `public/_redirects` and `_headers`, and **confirm the free-plan Direct Upload limits** from Cloudflare's docs. *Verify:* a manual `wrangler pages deploy` of the current build serves `/`, `/p/gach-kouto/`, `/admin` (noindex). **Status:** `_headers` and `.htaccess` written; the Cloudflare project still needs an account.
- [x] **T3 (P1, human ~4h / CC ~20m)**: `src/cms/schema-gen.js` and `npm run cms:schemas` (draft-07 subset, Rust-safe patterns). *Verify:* unit tests; every key has a schema; the schemas load in pg_jsonschema on staging. **Status:** done: `npm run cms:schemas`, with a self-check that the defaults pass.
- [ ] **T4 (P1, human ~4h / CC ~20m)**: Refactor `admin.js` `field()` into a type → renderer map. *Verify:* the 9 existing sections render and save identically in demo mode (puppeteer snapshot).
- [~] **T5 (P1, human ~1d / CC ~45m)**: Migrations 001/002: roles, tables, owner-rights view, RPCs, `_publish`, grants and revokes, storage policies (owner-only delete, no update, webp only, 5 MB), and the backfill. *Verify:* `node --test test/sql` on staging: the RLS and grants matrix, the RPC paths, and count parity. **Status:** migrations 001–003 written; not yet run on staging.
- [~] **T6 (P1, human ~1d / CC ~40m)**: Admin lifecycle: save draft with version, autosave and leave guard, Publish all, Publish at…, status chip plus stuck guard, restore with a missing-photo warning, reset field and section. *Verify:* E2E conflict, autosave recovery, publish round trip on staging. **Status:** draft save with conflict check, local backup, Publish, status chip, Retry and preview done; revision restore UI not built yet.
- [ ] **T7 (P1, human ~1d / CC ~40m)**: New documents and defaults (`homepage`, `socials`, `videos`, `seo`, `announcement`, and in `settings` the phones, shops and about), plus `platforms.js`, `urls.js` and `youtube.js`. *Verify:* unit test that the defaults equal today's rendered text; URL and YouTube unit tests.
- [ ] **T8 (P1, human ~1d / CC ~40m)**: `bindings.js`, `data-cms` attributes, the linkedom `transformIndexHtml` fill (text, attr, jsonld, list), section order and surfaces. *Verify:* the built HTML with defaults matches today's text; the bindings unit tests.
- [x] **T9 (P1, human ~4h / CC ~20m)**: `src/cms/apply.js` and `published.js` (static import with a defaults fallback). Remove the runtime fetch at cutover. Point `product-pages.js` at the applied data. *Verify:* no Supabase request on the public page; `/p/` titles reflect published data. **Status:** done.
- [~] **T10 (P1, human ~1d / CC ~45m)**: `.github/workflows/publish.yml` (dispatch plus a daily keep-alive, concurrency `publish`), `fetch-content.js` (fails on error or 0 rows), the media mirror, `mark_job` calls, the pg_net dispatch plus the Vault token, and the sweep cron. *Verify:* a staging publish goes live; a bad Cloudflare token gives `failed` with a run link; the `mark_job` inclusion unit tests. **Status:** workflow, `fetch-content`, media mirror and `mark-job` written; not yet run in CI.
- [x] **T11 (P1, human ~3h / CC ~20m)**: Preview: `?preview` postMessage handshake, the banner, and the admin iframe with D/T/M toggles. *Verify:* E2E: the draft shows in preview and not on the public site. **Status:** done, verified in demo mode.
- [ ] **T12 (P1, human ~4h / CC ~25m)**: Media library: list and search the bucket, 3-size upload, alt text and caption on references, `media_usage`, delete with confirmation (owner only), and the srcset variant scheme with a legacy fallback. *Verify:* E2E upload, reuse, and the delete-in-use warning; the editor can't delete.
- [ ] **T13 (P2, human ~3h / CC ~15m)**: List editor: up/down reorder, duplicate, set primary image; category delete with reassignment; product delete with reference cleanup; slug-change warning. *Verify:* E2E per brief §32 Products and Categories.
- [~] **T14 (P1, human ~1d / CC ~45m)**: Enquiry inbox: the `submit-enquiry` function (CORS, salted IP hash, `enquiry_rate`), the non-blocking call in `enquiry.js` with the `place` field, the owner-only admin page with CSV, the privacy line, the purge and rate-purge crons. *Verify:* integration tests (honeypot, rate limit, the 18-month boundary, editor denied). **Status:** Edge Function and client written; the admin inbox page is not built yet.
- [ ] **T15 (P2, human ~4h / CC ~20m)**: Backups: `export_content()`, a Download button, `weekly-backup` through Resend (`30 0 * * 0`), and `restore-backup.mjs`. *Verify:* restore into an empty staging project; the Action builds from it.
- [ ] **T16 (P2, human ~1h / CC ~10m)**: Monthly revision prune. *Verify:* SQL test that published and scheduled revisions are kept.
- [x] **T17 (P2, human ~4h / CC ~20m)**: Announcement bar. *Verify:* unit test of the window boundaries; a visual check. **Status:** done, with unit tests.
- [ ] **T18 (P1, human ~4h / CC ~25m)**: Dashboard (counts, recent activity, unpublished changes, health tiles, quick actions) and an Activity page with paging. *Verify:* E2E values match the database.
- [x] **T19 (P1, human ~2h / CC ~15m)**: Rewrite `ADMIN-SETUP.md`: roles, GitHub, the Vault token and its rotation, Cloudflare, Resend, crons, staging, the runbook. *Verify:* follow it from zero on a fresh staging setup. **Status:** done.
- [ ] **T20 (P1, human ~1d / CC ~45m)**: The E2E suite for brief §32 against the public staging URL after the Action runs, at 1280, 768 and 375; then the final audit report per brief §34. *Verify:* all green; the report separates Implemented, Partial, Not implemented and Debt.

**Prerequisites** (accounts the owner or developer must create; these are not decisions):
- a GitHub account and private repo, plus a fine-grained PAT
- a Cloudflare account and API token
- Supabase staging and production projects
- a Resend account with a verified sender
- the site domain for `VITE_SITE_URL`
- a second owner login

## 11. Completion summary
```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | Supabase CMS already exists (9 sections);   |
  |                      | no history; blocking 3.5s fetch; stale /p/; |
  |                      | no server validation; no git; Vercel Hobby  |
  |                      | used for a commercial site                  |
  | Step 0               | Approach C; TS cut; DB roles; shops in      |
  |                      | settings; D9 pipeline → GitHub Actions +    |
  |                      | Cloudflare Pages                            |
  | Section 1  (Arch)    | 4 issues (2 warnings, mitigated)            |
  | Section 2  (Errors)  | 23 error paths mapped, 0 GAPS               |
  | Section 3  (Security)| 16 threats reviewed, 0 unmitigated High     |
  | Section 4  (Data/UX) | 15 edge cases mapped, 0 unhandled           |
  | Section 5  (Quality) | 5 issues (DRY x3, complexity, scope cuts)   |
  | Section 6  (Tests)   | Diagram produced, 0 gaps                    |
  | Section 7  (Perf)    | 2 issues (revision growth, CI budget)       |
  | Section 8  (Observ)  | 1 gap closed (failure email recipient)      |
  | Section 9  (Deploy)  | 3 risks flagged (hosting move, freeze,      |
  |                      | rollback write-through)                     |
  | Section 10 (Future)  | Reversibility: 4/5, debt items: 4           |
  | Section 11 (Design)  | 0 blocking; /plan-design-review recommended |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (8 items)                           |
  | What already exists  | written                                     |
  | Dream state delta    | written                                     |
  | Error/rescue registry| 23 rows, 0 CRITICAL GAPS                    |
  | Failure modes        | 15 total, 0 CRITICAL GAPS (1 accepted gap)  |
  | TODOS.md updates     | 0 items proposed                            |
  | Scope proposals      | 4 proposed, 4 accepted (SEL)                |
  | CEO plan             | written (~/.gstack/projects/logo/ceo-plans) |
  | Spec review          | round 1: 5/10, 40 issues → all addressed    |
  | Outside voice        | unavailable (codex not installed; native    |
  |                      | fallback tools absent)                      |
  | Lake Score           | 0/5 recommendations chose complete option   |
  | Diagrams produced    | 5 (architecture, state machine, publish     |
  |                      | flow, admin flow, error map)                |
  | Stale diagrams found | 0                                           |
  | Unresolved decisions | 0                                           |
  +====================================================================+
```
