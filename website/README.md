# Parineeta website

The website for Parineeta (পরিণীতা), hand-painted Bengali wedding heirlooms from Patuli, West Bengal.

**Live:** https://parineeta-sable.vercel.app

## What it does
- **Customers** browse the products. They add pieces to the cart, then buy by UPI or bank transfer. The order is sent to the shop on WhatsApp. Customers don't need an account.
- **The shop** signs in at `/admin`. Staff edit products, prices, photos and the other page sections, then press **Publish**. The website updates in about 2 minutes.

## How it fits together
```
Admin (/admin) ──save──▶ Supabase (content and photos)
       │
       └─Publish──▶ GitHub Actions ──▶ Vercel rebuilds the site with the published content
```
| Service | Used for |
|---|---|
| **Vercel** | Hosts the site and rebuilds it on every push to `main` and every Publish |
| **Supabase** | Stores the admin's content and photos (project `ipvvqlgthfarugsjvpnv`) |
| **Clerk** | Staff sign-in to `/admin` |
| **GitHub** | The code. `.github/workflows/publish.yml` connects Publish to Vercel |

## Folders
| Folder | Holds |
|---|---|
| `frontend/` | The website: the storefront (`index.html`), the admin panel (`admin.html`) and staff sign-in (`login.html`) |
| `scripts/` | Build helpers. They fetch the published content and report Publish progress back to the admin |
| `database/` | The Supabase database definition. `SETUP_ALL.sql` rebuilds it from scratch and matches the live database |

## Commands (run in `frontend/`)
| Command | Does |
|---|---|
| `npm install` | Installs everything (first time only) |
| `npm run dev` | Runs the site locally. `/admin.html?demo` runs the admin without signing in |
| `npm run build` | Builds the site into `dist/` |

Local setup: copy `frontend/.env.example` to `frontend/.env` and fill in the Clerk key.

## Adding shop staff
In Supabase → SQL Editor, `owner` can publish, and `editor` can only save drafts:
```sql
insert into admins (email, role) values ('name@example.com', 'owner') on conflict (email) do update set role = excluded.role;
```
The person then signs in at `/admin` with that email.
