# Deployment guide

**Current status: NOT DEPLOYED.** There is no GitHub remote, hosting account or Supabase project yet.

The pipeline is written as `.github/workflows/publish.yml` and has never run. Do a first run on a **staging** setup before production.

## Initial setup
1. Create these under **the client's** accounts:
   - a private GitHub repository
   - a Supabase project (region Mumbai)
   - Cloudflare Pages **or** Hostinger
2. Push the `website` folder:
   ```bash
   git remote add origin [REPO URL]
   git push -u origin main
   ```
   Then protect `main` (require pull requests, no bypass).

## Install dependencies
```bash
npm install
```
Use `npm ci` in CI. The workflow uses Node 22.

## Environment variables
See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md). Locally, run `cp .env.example .env` and fill it in. In CI, set the GitHub Environment variables.

## Database setup
Follow [DATABASE_GUIDE.md](DATABASE_GUIDE.md):
1. Enable the extensions.
2. Run the SQL files in order.
3. Add the owner.
4. Set up publishing:
   ```sql
   select vault.create_secret('[SECRET]', 'github_dispatch_token');
   update cms_config set github_repo = '[OWNER/REPO]', target = 'production', pat_expires_on = '[DATE]';
   ```

## Storage setup
`schema.sql` creates the public `media` bucket, and `001_cms.sql` limits it to WebP files under 5 MB. Nothing else is needed. See [MEDIA_STORAGE_GUIDE.md](MEDIA_STORAGE_GUIDE.md).

## Auth setup (Supabase → Authentication)
- Set **Site URL** to the live address.
- Add `[site]/admin` and `[site]/account` to **Redirect URLs**.
- Enable the **Email** provider.
- For customer sign-in emails, connect an SMTP service (for example Resend). **NOT CONFIGURED.**

## Enquiry function (optional)
```bash
supabase functions deploy submit-enquiry --no-verify-jwt
supabase secrets set ALLOWED_ORIGINS=[SITE ORIGIN] IP_SALT=[SECRET]
```

## Build
```bash
npm run build
```
Without `frontend/src/data/published.json`, the build uses the default content. In CI, `node scripts/fetch-content.mjs` runs first.

To view the build locally:
```bash
npm run preview
```
There is **no `npm run start`**.

## Production deployment
You don't deploy by hand. The workflow runs when:
- the owner presses **Publish** in the admin
- code is pushed to `main`
- it is run by hand from the Actions tab

It fetches the published content, builds, and deploys to:
- **Cloudflare Pages** (`DEPLOY_TARGET=cloudflare`): `wrangler pages deploy dist`
- **Hostinger/SFTP** (`DEPLOY_TARGET=sftp`): rsync to `SFTP_DIR.next`, then an atomic folder swap. The previous version is kept as `SFTP_DIR.prev`.

**Never deploy production from a laptop.** A manual upload skips the published content.

## Domain configuration
[TO BE COMPLETED]
- **Cloudflare:** Pages project → Custom domains.
- **Hostinger:** point the domain at the hosting plan and set `SFTP_DIR` to its `public_html`.

Then set `SITE_URL` and `ALLOWED_ORIGINS` to the final address.

## Post-deployment verification
- [ ] `/` loads with no console errors, and `/p/gach-kouto/` opens that product.
- [ ] `/admin` loads, and the owner can sign in.
- [ ] Editing, saving and publishing works: the top bar shows **Live ✓**, and the change is visible on the site.
- [ ] `/robots.txt` and `/sitemap.xml` exist (`sitemap.xml` only when `SITE_URL` is set).
- [ ] An enquiry appears in the `enquiries` table, and its tracking link opens (if configured).
- [ ] The response headers include `X-Frame-Options: SAMEORIGIN`, and `/admin` sends `X-Robots-Tag: noindex`.
