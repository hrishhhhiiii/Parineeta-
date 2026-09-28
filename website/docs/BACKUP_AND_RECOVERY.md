# Backup and recovery

| Item | Available | Configured | Recommended but not configured |
|---|---|---|---|
| Code history | Git | **Local only**, on the developer's computer | Push to the client's private GitHub repository |
| Content history | Every save is a revision in `content_revisions` (the last 180 days, plus the last 20 per section). The owner can restore one from **History** in the admin. | Once Supabase is set up | — |
| Content export | `export_content()` RPC (owner) | Once Supabase is set up | A "Download backup" button, and the weekly backup email planned in CMS-PLAN.md: **NOT IMPLEMENTED** |
| Database backups | Supabase's own daily backups (plan-dependent) | Not verified | Check what your Supabase plan includes, and take manual dumps |
| Uploaded photos | Copies of **published** photos end up in each built site | Not automatic | Periodically download the `media` bucket |
| Hosting rollback | Cloudflare Pages deployment history, or `SFTP_DIR.prev` on Hostinger | When hosting is set up | — |

**No automated off-site backup is configured.**

## Code backup
Once the repository is on GitHub:
```bash
git clone [REPO URL]
```
Until then, **the only copy is on the developer's computer.** This is a handover blocker.

## Database backup
- **Manual dump:**
  ```bash
  supabase db dump --db-url [CONNECTION STRING] -f backup.sql
  ```
  The connection string is under Supabase → Project Settings → Database. It contains the database password, so treat it as **[SECRET]**.
- **Content only:** as the owner, call `export_content()` (from the SQL editor, `select export_content();`) and save the JSON.
- **Enquiries contain customers' personal data.** Store dumps privately.

## Media backup
Download the `media` bucket from Supabase → Storage, or use the Supabase CLI or S3 API. Built-in media is already in Git.

## Environment recovery
None of the values are stored in the repository. To rebuild them, use [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) as the checklist and get fresh values:
- Supabase URL and anon key from the dashboard
- a **new** GitHub token (store it in Vault)
- a new Cloudflare token or SSH key
- a new `IP_SALT`

## Disaster recovery (rebuild from nothing)
1. Clone the repository, then run `npm install`, `npm test` and `npm run build`. This proves the code works.
2. Create a Supabase project and run the SQL as in [DATABASE_GUIDE.md](DATABASE_GUIDE.md). Restore the database dump if you have one. Otherwise the site starts again from its built-in default content.
3. Re-upload the media bucket files.
4. Recreate the GitHub Environments, the Vault token and `cms_config`.
5. Set up hosting and the domain ([DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)), then run the workflow.
6. Re-add admins, then sign in, publish and check the site.

The recovery process has **not been tested** (TO BE COMPLETED).
