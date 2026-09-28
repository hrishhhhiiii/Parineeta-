# Troubleshooting

### Website won't build
- **Problem:** `npm run build` fails.
- **Cause:** usually a syntax error in `frontend/src/`, or in CI, `fetch-content.mjs` exiting ("published_content returned 0 rows" or an HTTP error).
- **Solution:**
  1. Run `npm test` and `npm run build` locally and read the first error.
  2. In CI, open the run log. Zero rows means the Supabase view is empty or not readable by `anon`, so check the grants in `001_cms.sql`.
  3. Set `CMS_ALLOW_EMPTY=1` only if you really mean to build with the default content.

### Admin shows "Admin not connected yet"
- **Cause:** `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` was missing when the site was built.
- **Solution:** add them to `.env` locally, or to the CI build step (see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)), and rebuild.

### Admin login doesn't work
- **Cause:** a wrong password; the user doesn't exist in Supabase Auth; or the email isn't in `admins`. In the last case sign-in works, but loading fails with "not allowed".
- **Solution:**
  - Use **Forgot password?**.
  - Create the user in Supabase → Authentication.
  - Add the email to `admins` with a role.

### "Could not load" after signing in
- **Cause:** the migrations haven't been run, so `get_heads` is missing.
- **Solution:** run the SQL files in order ([DATABASE_GUIDE.md](DATABASE_GUIDE.md)).

### Save fails with "Some values are not allowed"
- **Cause:** server validation (`content_schemas`) rejected the data, often because `schemas.js` changed without regenerating `002_schemas.sql`.
- **Solution:** run `npm run cms:schemas`, then run the new `002_schemas.sql`.

### Save fails with "Someone else saved this section"
- **Cause:** another admin saved it first.
- **Solution:** copy your edits, reload, and reapply them.

### Product doesn't appear on the site
- **Cause, one of:**
  - it wasn't published
  - it's marked hidden
  - its category code doesn't match any category
  - the build failed
- **Solution:** check the top bar, since it needs to say **Live ✓** after your publish. Then untick **Hide from the site** and check the category.

### Publish stuck, or "Update failed"
- **Cause:**
  - The GitHub token is missing or expired (the bar shows "Couldn't start the update", with a 401).
  - `cms_config.github_repo` is wrong.
  - The build or deploy step failed.
- **Solution:** open **Run log**. Then rotate the token in Vault (`vault.update_secret`) and update `pat_expires_on`, or fix the step that failed. After that, press **Retry update**.

### Image doesn't upload
- **Cause:** Supabase isn't set up, the account isn't an admin, or the file is over 5 MB after conversion. (Uploads are always converted to WebP, and the bucket accepts only WebP.)
- **Solution:** check the admin role, and use a smaller photo.

### Photo missing on the live site
- **Cause:** the file was deleted from storage, but content still uses it (there's a warning in the run log).
- **Solution:** choose a new photo and publish.

### Social link, store, video or homepage text doesn't update
- **Cause:**
  - it was saved but not published
  - the build failed
  - for social links: the link isn't `https://` on that platform's own site (for example a shortened link), so it's left out
  - for videos: the link isn't a YouTube link
- **Solution:**
  - Publish and wait for **Live ✓**.
  - Paste the full link from the address bar of the profile or video page.
  - For stores: check the shop isn't hidden, and that the map search is filled in.

### Google still shows the old title or description
- **Cause:** Google updates its copy on its own schedule, often days or weeks later.
- **Solution:** check the page's source (it should show the new title), then wait. You can ask Google to re-crawl in Google Search Console, which is [TO BE COMPLETED]: it isn't set up.

### Enquiries aren't recorded, or tracking says "not found"
- **Cause, one of:**
  - `VITE_ENQUIRY_URL` isn't set
  - the function isn't deployed
  - the site's address isn't in `ALLOWED_ORIGINS`
  - the rate limit was hit (5 per visitor per hour, 60 per hour for the site)
  - the enquiry is older than 18 months
- **Solution:** check the function logs in Supabase → Edge Functions.

### Customer sign-in email never arrives
- **Cause:** Supabase's built-in email is heavily rate-limited, and no SMTP service is set up.
- **Solution:** connect an SMTP service (for example Resend) in Supabase → Authentication → SMTP. Add `[site]/account` to Redirect URLs.

### Deployment fails
- **Cause:**
  - **Cloudflare:** the token is missing or lacks *Pages: Edit*, or `CF_PROJECT` is wrong.
  - **SFTP:** the key, host or port is wrong, or the host has no SSH and rsync.
- **Solution:** fix the GitHub Environment values and re-run the workflow. The live site stays unchanged until a deploy succeeds.
