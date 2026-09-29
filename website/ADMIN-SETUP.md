# Parineeta shop admin: setup and runbook

The admin lives at **/admin**. The owner edits there and saves **drafts**. Nothing reaches the website until someone presses **Publish**.

Publishing rebuilds the static site with the new content. This takes about 2 minutes, and the admin shows the progress. Visitors never talk to Supabase, except when they send an enquiry.

```
Admin (Save draft, Publish) → Supabase → GitHub Action (fetch content, build) → Cloudflare Pages or Hostinger
```

## Accounts you need
- **Supabase:** two projects, `parineeta-staging` and `parineeta-prod`, both in region Mumbai (ap-south-1). The free plan is enough.
- **GitHub:** a **private** repository holding this `website` folder.
- **Hosting:** Cloudflare Pages (free, commercial use allowed), or any host with SSH/SFTP such as Hostinger.
- **Owner logins:** two, so the owner can never be locked out.

## 1. Database (do this on staging first, then on production)
1. In **Database → Extensions**, enable `pg_net`, `pg_cron` and `pg_jsonschema`.
2. In the **SQL Editor**, run these files in order:
   1. `database/schema.sql`
   2. `database/migrations/001_cms.sql`
   3. `database/migrations/002_schemas.sql`
   4. `database/migrations/003_backfill.sql`
   5. `database/migrations/004_customer_accounts.sql`
   6. `database/migrations/005_customer_carts.sql`
   7. `database/migrations/006_clerk.sql` (after the Clerk setup below)
   8. `database/migrations/007_orders.sql`
3. Add admins. `owner` can publish, restore and read enquiries. `editor` can only save drafts.
   ```sql
   insert into admins (email, role) values ('owner@example.com', 'owner') on conflict (email) do update set role = excluded.role;
   ```
4. Connect publishing:
   ```sql
   select vault.create_secret('<github token>', 'github_dispatch_token');
   update cms_config set github_repo = '<owner>/<repo>', target = 'production', pat_expires_on = '<token expiry date>';
   ```
   Use `target = 'staging'` on the staging project.

   **The GitHub token:**
   - Create it at *GitHub → Settings → Developer settings → Fine-grained tokens*.
   - Give it access to **this one repository only**, with **Contents: Read and write**.
   - It expires. Before `pat_expires_on`, create a new one, run `select vault.update_secret((select id from vault.secrets where name = 'github_dispatch_token'), '<new token>');`, and update the date.
5. When you change the admin's fields (`frontend/src/admin/schemas.js`), run `npm run cms:schemas`, then run the regenerated `002_schemas.sql`.

## Sign-in (Clerk)
Clerk runs sign-in for customers, editors and owners. Supabase stays the database and accepts Clerk's session token.
1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com). Use a development instance for staging and a production instance for the live site.
   - Under *User & authentication*, turn on **Email** with **verification required**, plus **Password**, **Email verification code** and **Google** as you like.
   - Keep **Allow users to delete their accounts** on, because *Delete my account* on `/account` uses it.
2. In Clerk, open *Integrations → Supabase* and activate it. This adds the `role: authenticated` claim Supabase needs. Copy the **Clerk domain** it shows.
3. In Supabase, open *Authentication → Sign In / Providers → Third-party auth*, add **Clerk**, and paste that domain.
4. In Clerk, open *Sessions → Customize session token* and add the email. Admin roles and "my enquiries" match on it:
   ```json
   { "email": "{{user.primary_email_address}}" }
   ```
5. Run `database/migrations/006_clerk.sql`. It changes the carts table from `005_customer_carts.sql`, so run 005 first if you haven't. Otherwise it stops with `relation "public.customer_carts" does not exist`. Nothing is applied when it fails, and both files are safe to run again.
6. Put the **publishable key** (`pk_…`, from *API keys*) in `frontend/.env` and the Vercel project settings as `VITE_CLERK_PUBLISHABLE_KEY`. Never use the secret key (`sk_…`) in the website.

People who had a Supabase login create a Clerk account with the same email. Staff keep their role, because the `admins` table is matched by email.

## Payment receipts (email and WhatsApp)
Every checkout is saved as an order in **Orders** in the admin (owner only). Receipts go to the customer and the shop at two moments:
- **Order placed** with UPI, bank transfer or the payment page: an "awaiting confirmation" receipt.
- **Mark as paid** in the admin, after the money is in your bank account: a "payment received" receipt. *Send receipt again* resends it.

Each message links to a private page, `/receipt.html#…`, where the customer can view and download the receipt. A channel that isn't set up is skipped, and the admin shows what was sent and what failed.

1. Run `database/migrations/007_orders.sql`.
2. Deploy the functions:
   ```bash
   supabase functions deploy place-order --no-verify-jwt
   supabase functions deploy confirm-payment --no-verify-jwt
   ```
   `confirm-payment` checks that the caller is the owner through the database, using their Clerk token.
3. Common secrets: `supabase secrets set SITE_URL=https://yourdomain.in ALLOWED_ORIGINS=https://yourdomain.in IP_SALT=<random text>`
4. **Email (Resend):** create an account at resend.com and verify your domain. Then:
   ```bash
   supabase secrets set RESEND_API_KEY=re_… RECEIPT_FROM="Parineeta <receipts@yourdomain.in>" ADMIN_EMAIL=owner@example.com
   ```
   `ADMIN_EMAIL` can be several addresses, separated by commas. Customers who leave no email only get WhatsApp.
5. **WhatsApp (Cloud API):**
   - In Meta Business Suite, set up the WhatsApp Cloud API with a business number. It must be a different number from the one that receives the shop's copies.
   - Create a permanent access token, and note the **Phone number ID**.
   - In WhatsApp Manager, create two **Utility** templates in English. Meta must approve them before messages send.
     - `parineeta_payment_pending`: *Parineeta order {{1}}: payment of {{2}} from {{3}} is awaiting confirmation. Your receipt: {{4}}*
     - `parineeta_payment_received`: *Parineeta order {{1}}: payment of {{2}} from {{3}} was received on {{4}}. Thank you! Your receipt: {{5}}*
   - Then set the secrets. `ADMIN_WHATSAPP` takes one or more numbers, separated by commas:
     ```bash
     supabase secrets set WHATSAPP_TOKEN=… WHATSAPP_PHONE_NUMBER_ID=… ADMIN_WHATSAPP=91XXXXXXXXXX
     ```
   - Meta charges per business-initiated message, roughly ₹0.1 to ₹0.8 each.
6. Set `VITE_ORDER_URL=https://<project>.supabase.co/functions/v1/place-order` in `frontend/.env` and the Vercel project settings.

Each visitor can place 5 orders per hour, with a limit of 60 per hour for the whole site, so the functions can't be used to send spam. Orders are kept as payment records and are not deleted automatically.

## 2. Enquiry inbox (optional)
1. Deploy the function:
   ```bash
   supabase functions deploy submit-enquiry --no-verify-jwt
   ```
2. Set its secrets:
   ```bash
   supabase secrets set ALLOWED_ORIGINS=https://yourdomain.in IP_SALT=<random text>
   ```
3. Set `VITE_ENQUIRY_URL=https://<project>.supabase.co/functions/v1/submit-enquiry` as a GitHub variable (step 3).

Enquiries are deleted automatically after 18 months. Each visitor can send 5 per hour, with a limit of 60 per hour for the whole site.

## 3. GitHub repository
1. Protect `main`: *Settings → Branches → require pull requests*, **with no bypass**.
2. Create two **Environments**, `production` and `staging`. Give each one its own values:

| Kind | Name | Value |
|---|---|---|
| variable | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | from Supabase → Project Settings → API (the anon key is public) |
| variable | `SITE_URL` | e.g. `https://parineeta365.in` |
| variable | `DEPLOY_TARGET` | `cloudflare` or `sftp` |
| variable | `VITE_ENQUIRY_URL` | optional, from step 2 |
| Cloudflare | `CF_PROJECT`, `CLOUDFLARE_ACCOUNT_ID` (variables), `CLOUDFLARE_API_TOKEN` (secret) | token with *Cloudflare Pages: Edit* |
| SFTP | `SFTP_HOST`, `SFTP_PORT`, `SFTP_USER`, `SFTP_DIR` (variables), `SFTP_KEY` (secret, a private SSH key) | Hostinger: *Advanced → SSH access* |

Never put the Supabase `service_role` key in GitHub. The workflow doesn't need it: each publish sends a one-time secret that only works for its own job.

## 4. Hosting
- **Cloudflare Pages:**
  - Create a Direct Upload project named after `CF_PROJECT`.
  - The first publish deploys it.
  - `frontend/public/_headers` sets security headers and `noindex` on `/admin`.
  - To roll back, open the Pages dashboard, go to *Deployments*, and choose *Rollback*.
- **Hostinger (SFTP):**
  - `SFTP_DIR` is the folder the domain serves, e.g. `/home/u123/domains/yourdomain.in/public_html`.
  - The workflow uploads to `…/public_html.next`, then swaps it with the live folder, so visitors never see a half-updated site.
  - `frontend/public/.htaccess` handles `/admin` and the headers.
  - To roll back, over SSH run `mv public_html public_html.bad && mv public_html.prev public_html`.
- **Moving hosts later:** set up the other target's variables, then change `DEPLOY_TARGET`. Nothing else changes.

## 5. Daily use
- **Save** stores a draft. The admin also keeps unsaved edits on this device, so closing the tab loses nothing.
- **Preview** shows the website with your drafts, at Desktop, Tablet and Mobile sizes. The public site is not affected.
- **Publish** (owner only) sends every saved draft live together. The top bar goes from *Updating the website…* to *Live ✓*.
- If an update fails, the bar says so and links to the run log. Nothing on the live site changes. Press **Retry update**.
- If two people edit the same section, the second save is refused with a message, instead of silently overwriting the first person's work.

## Runbook
| Problem | What to do |
|---|---|
| "Publishing isn't connected yet" | The Vault token or `cms_config.github_repo` is missing (step 1.4). |
| "Couldn't start the update (GitHub answered 401)" | The token expired or was revoked. Rotate it (step 1.4). |
| Stuck on "Taking longer than usual" | Open the run log. After 30 minutes the job is marked failed and **Retry update** appears. |
| The build fails at "fetch-content" with 0 rows | `published_content` is empty or not readable by `anon`. Check the grants in `001_cms.sql`. |
| Photo missing from storage (a warning in the run log) | A photo was deleted but an old revision still uses it. Pick a new photo and publish again. |
| Supabase project paused | The daily keep-alive job should prevent this. Restore the project from the Supabase dashboard. |

**Rules:**
- **Never deploy production from a laptop.** Push to `main`, or press Publish, and the workflow does the rest.
- Try changes on staging first: push to the `staging` branch and use the staging project's admin.

## Local development
- `npm run dev`, then open `/admin.html?demo` for an in-memory admin. Save, Publish and Preview all work there. `/account.html?demo` shows a sample customer page. Neither needs Clerk.
- `npm test` runs the CMS unit tests.
- `SUPABASE_URL=… SUPABASE_ANON_KEY=… npm run cms:fetch` downloads the published content, so a local build matches the live site.
