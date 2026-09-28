# Database guide (Supabase)

**Status: NOT CONFIGURED.** No Supabase project is connected yet. This guide describes the SQL split between `backend/` and `database/`, which has **not yet been run against a real project**.

## Purpose
Supabase holds:
- the admin and customer logins
- every content document as versioned revisions
- publish jobs
- the activity log
- the enquiry inbox
- uploaded photos (Storage)

The public website does **not** query it. Content is baked into the build.

## Migrations: run them in this order (SQL Editor)

| File | What it does |
|---|---|
| `database/schema.sql` | Original setup: the `site_content` and `admins` tables, `is_admin()`, the `media` bucket and its policies. **It ends by inserting the owner's email as admin, so check that line.** |
| `database/migrations/001_cms.sql` | The CMS: roles, revisions, heads, jobs, schedules, activity, enquiries, the RPCs, grants and RLS, storage limits and cron jobs |
| `database/migrations/002_schemas.sql` | **Generated** by `npm run cms:schemas`: one JSON Schema per content document |
| `database/migrations/003_backfill.sql` | Copies existing `site_content` rows into revisions. Safe to re-run. |
| `database/migrations/004_customer_accounts.sql` | Optional customer accounts |

Before running them, enable the extensions **pg_net**, **pg_cron** and **pg_jsonschema** (Database → Extensions).

There is no migration runner (the Supabase CLI `migrations` folder format is not used), so apply the files by hand, in order.

## Tables

| Table | Purpose | Important fields | Public/Private |
|---|---|---|---|
| `admins` | Who may use the admin | `email`, `role` (`owner` or `editor`) | Private |
| `site_content` | Legacy one-row-per-document content. It is still used as the backfill source. | `key`, `data` | Readable by anyone (legacy policy) |
| `cms_config` | One row of publish settings | `github_repo`, `target`, `pat_expires_on` | Private |
| `content_schemas` | Validation schema per document key | `key`, `schema` | Private |
| `content_revisions` | Every saved version of a document | `key`, `data`, `created_by`, `source` | Private (admins read) |
| `content_heads` | Current pointers per document | `draft_rev`, `published_rev`, `deployed_rev`, `version`, `published_seq` | Private (admins read) |
| `publish_jobs` | Each publish or build and its status | `status` (queued, building, live, failed), `seq`, `run_url`, `error` | Private (admins read) |
| `scheduled_publishes` | Publish-at-a-time requests (no admin UI yet) | `rev_map`, `publish_at`, `status` | Private |
| `activity_log` | Append-only audit trail | `actor`, `action`, `entity_key` | Private (admins read) |
| `enquiries` | Customer enquiries | `name`, `phone`, `email`, `items`, `status`, `status_note`, `track_hash`, `customer_id` | **Private, contains personal data.** Owner reads; customers see only their own, through RPCs. |
| `enquiry_rate` | Rate-limit counters (hashed IPs) | `ip_hash`, `window_start`, `count` | Private |

**View:** `published_content` (`key`, `data`, `published_seq`) is the only thing `anon` can read. The build reads it.

**Relationships:**
- `content_revisions.key`, `content_heads.key` → `content_schemas.key`
- the heads' `*_rev` columns → `content_revisions.id`
- `enquiries.customer_id` → `auth.users.id`

**Indexes:**
- revisions: `(key, created_at desc)`
- activity: `(at desc)`
- enquiries: `(created_at desc)`, `(status)`, `(customer_id)`, `(lower(email))`
- unique: `track_hash`

## Security model
- **RLS is on for every table.** `anon` and `authenticated` have no write access to any table. All writes go through `security definer` RPCs that check the role (`_require('editor' | 'owner')`).
- **RPCs:**

| Role | Functions |
|---|---|
| Editors and owners | `save_draft`, `get_heads`, `admin_role`, `media_usage`, `list_revisions` |
| Owners | `publish`, `redeploy`, `schedule_publish`, `cancel_schedule`, `restore_revision`, `set_enquiry_status`, `delete_enquiry`, `export_content` |
| Public (`anon`) | `mark_job` (checks a one-time per-job secret), `track_enquiry` (tracking token) |
| Signed-in customers | `my_enquiries`, `claim_enquiry`, `delete_my_account` |
| `service_role` only | `_submit_enquiry` (called by the Edge Function) |

- **Auth relationship:** admins are Supabase Auth users whose email is in `admins`. Customers are Auth users who are not in `admins`, so every admin RPC refuses them.

## Scheduled jobs (pg_cron)

| Job | When | Does |
|---|---|---|
| `cms-dispatch-sweep` | every minute | marks publish jobs failed if GitHub didn't accept the dispatch |
| `cms-scheduled-publish` | every 5 minutes | runs due scheduled publishes |
| `cms-enquiry-purge` | daily 03:00 UTC | deletes enquiries older than 18 months |
| `cms-rate-purge` | hourly | clears old rate-limit rows |
| `cms-revision-prune` | monthly | deletes revisions older than 180 days, except current ones and the last 20 per key |

## Default and seed data
- The default content is in `frontend/src/data/*.js`, not in the database.
- `003_backfill.sql` seeds revisions from any existing `site_content` rows. With none, documents start empty and the admin shows the defaults.
- Add admins:
  ```sql
  insert into admins (email, role) values ('[CLIENT EMAIL]', 'owner')
    on conflict (email) do update set role = excluded.role;
  ```
