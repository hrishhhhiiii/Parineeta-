# Environment variables

These are all the variables the code actually reads (found by searching `src`, `build`, `scripts`, `supabase` and `.github`). **No values are stored in this documentation.**

## Build-time (Vite): bundled into the browser, so they must be public values only

| Variable | Purpose | Required | Public/Private | Where to obtain |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL, used by the admin and account pages | Yes, for the admin and accounts | Public | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (protected by RLS) | Yes, for the admin and accounts | Public | Same place, the **anon public** key |
| `VITE_SITE_URL` | Live address, no trailing slash. Adds canonical links, absolute social images and `sitemap.xml`. | Recommended | Public | Your domain [TO BE COMPLETED] |
| `VITE_ENQUIRY_URL` | The `submit-enquiry` Edge Function URL. Turns on the enquiry inbox and tracking links. | Optional | Public | `https://<project>.supabase.co/functions/v1/submit-enquiry` |

Locally they go in `website/.env` (copy `.env.example`). In CI the workflow maps GitHub variables to them: `SITE_URL` → `VITE_SITE_URL`, `SUPABASE_URL` → `VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY` → `VITE_SUPABASE_ANON_KEY`, `ENQUIRY_URL` → `VITE_ENQUIRY_URL`.

## Build scripts (Node, in CI)

| Variable | Purpose | Required | Public/Private | Where to obtain |
|---|---|---|---|---|
| `SUPABASE_URL` | Used by `fetch-content.mjs` and `mark-job.mjs` | Yes | Public | GitHub Environment variable |
| `SUPABASE_ANON_KEY` | Same scripts | Yes | Public | GitHub Environment variable |
| `CMS_ALLOW_EMPTY` | Set to `1` to allow a build with no published content | No | n/a | Only set it deliberately |
| `JOB_ID`, `JOB_SECRET`, `RUN_URL`, `DEPLOY_URL` | Set automatically by the workflow from the dispatch payload | Automatic | `JOB_SECRET` is masked | Not set by hand |

## GitHub (Settings → Environments → `production` / `staging`)

| Name | Kind | Purpose | Private? |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL`, `ENQUIRY_URL` (optional) | Variable | See above | Public values |
| `DEPLOY_TARGET` | Variable | `cloudflare` (the default) or `sftp` | Public |
| `CF_PROJECT`, `CLOUDFLARE_ACCOUNT_ID` | Variable | Cloudflare Pages target | Public |
| `CLOUDFLARE_API_TOKEN` | **Secret** | Deploys to Pages | **[SECRET]** |
| `SFTP_HOST`, `SFTP_PORT`, `SFTP_USER`, `SFTP_DIR` | Variable | Hostinger or SFTP target | Public |
| `SFTP_KEY` | **Secret** | SSH private key for the host | **[PRIVATE KEY]** |

## Supabase Edge Function secrets (`supabase secrets set`)

| Name | Purpose | Private? |
|---|---|---|
| `ALLOWED_ORIGINS` | Comma-separated site origins allowed to post enquiries | Public |
| `IP_SALT` | Random text used to hash visitor IPs | **[SECRET]** |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Provided by Supabase automatically | **The service role key is [SECRET]. NEVER COMMIT IT and never put it in GitHub or the browser.** |

## Supabase Vault (inside the database)
- `github_dispatch_token`: a fine-grained GitHub token (this repository only, Contents: read and write). **[SECRET]**. It expires, and its expiry date is recorded in `cms_config.pat_expires_on`.

## Git safety (checked 2026-09-28)
- `.gitignore` excludes `.env`, `.env.local` and all `.env.*` files, except `.env.example`.
- A search of all commits found **no committed secrets**, and `.env` has never been committed.
