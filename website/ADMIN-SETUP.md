# Parineeta shop admin: one-time setup

The admin panel lives at **/admin** on the website (for example `https://parineeta.vercel.app/admin`).
The shop owner signs in there to change products, prices, photos, categories, bridal sets, reviews,
the lookbook, celebrity photos, services, the wedding story, contact details and payment details.
Changes appear on the website the next time a page loads. No rebuild or redeploy is needed.

It runs on **Supabase** (free plan is plenty). Setup takes about 10 minutes.

## 1. Create the Supabase project
1. Sign up at https://supabase.com and click **New project**. Pick region **Mumbai (ap-south-1)**.
2. When it's ready, open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**.
   - The last line adds `debrajnandi2004@gmail.com` as an admin. To add another person, run
     `insert into public.admins (email) values ('their@email.com');`

## 2. Create the owner's login
1. **Authentication → Users → Add user → Create new user**.
2. Enter the owner's email (the same one listed as admin) and a password, and tick **Auto confirm user**.
3. Under **Authentication → URL Configuration**, set **Site URL** to the live site address
   (e.g. `https://parineeta.vercel.app`). This makes "Forgot password?" emails link back correctly.

## 3. Connect the website
1. In Supabase, open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
   (The anon key is designed to be public. Never use the `service_role` key in the website.)
2. Locally: copy `.env.example` to `.env` and fill both values in.
3. On Vercel: **Project → Settings → Environment Variables**, add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy once.

## 4. First sign-in
Open `/admin`, sign in, and go through each section. Every section starts from the site's current
content and is marked **"Not saved to the live site yet"**. Press **Save changes** once on each section
you want to manage from the admin. Until a section is saved, the site keeps using the built-in version.

## Good to know
- **Photos** are resized in the browser to 1600px WebP before upload, so phone photos are fine.
- **Hidden** products, sets and reviews stay saved but don't show on the site.
- Every product needs a **3D shape** (pick the closest) and at least one **colourway**.
- If Supabase is ever down or slow (over 3.5 s), the site falls back to its built-in content.
- To try the editor locally without Supabase: `npm run dev`, then open `/admin.html?demo`
  (changes are not stored; dev only).
- Hero headline and page text written into `index.html` are not editable from the admin yet.
