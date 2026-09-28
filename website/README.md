# Parineeta website

This is the website for Parineeta (পরিণীতা), which sells hand-painted Bengali wedding heirlooms from Patuli, West Bengal. It is a static Vite + three.js site with a Supabase-backed admin panel. Admin changes are published by a GitHub Actions build.

**Status:** it runs locally. Supabase, GitHub and hosting are **NOT CONFIGURED** yet (see [docs/CLIENT_HANDOVER.md](docs/CLIENT_HANDOVER.md)).

```text
Parineeta
│
├── Setup ........ npm install  ·  cp .env.example .env
├── Development .. npm run dev  (/, /admin.html?demo, /account.html?demo)  ·  npm test
├── Environment .. docs/ENVIRONMENT_VARIABLES.md
├── Database ..... supabase/  ·  docs/DATABASE_GUIDE.md
├── Deployment ... .github/workflows/publish.yml  ·  docs/DEPLOYMENT_GUIDE.md
└── Documentation  docs/
```

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build into `dist/` (also writes `/p/<id>/` pages, `robots.txt`, `sitemap.xml`) |
| `npm run preview` | Serves `dist/` locally |
| `npm test` | CMS unit tests |
| `npm run cms:schemas` | Regenerates `database/migrations/002_schemas.sql` from `frontend/src/admin/schemas.js` |
| `npm run cms:fetch` | Downloads published content into `frontend/src/data/published.json` (needs `SUPABASE_URL` and `SUPABASE_ANON_KEY`) |

## Documentation

| For | Document |
|---|---|
| Shop owner | [Client handover](docs/CLIENT_HANDOVER.md) · [Admin guide](docs/ADMIN_GUIDE.md) |
| Developer | [Developer handover](docs/DEVELOPER_HANDOVER.md) · [Database](docs/DATABASE_GUIDE.md) · [Environment variables](docs/ENVIRONMENT_VARIABLES.md) · [Media and storage](docs/MEDIA_STORAGE_GUIDE.md) |
| Operations | [Deployment](docs/DEPLOYMENT_GUIDE.md) · [Backup and recovery](docs/BACKUP_AND_RECOVERY.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [Admin setup runbook](ADMIN-SETUP.md) |
| Design history | [CMS plan](docs/CMS-PLAN.md) |
