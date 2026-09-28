# Media and storage guide

There are two kinds of media.

## 1. Built-in media (in the code)

| Folder | What it holds |
|---|---|
| `frontend/public/media/photos/` | Photos, each in three widths: `<id>-400.webp`, `<id>-800.webp` and `<id>-1600.webp` |
| `frontend/public/media/reels/` | Short films: `<id>.mp4`, plus poster images `<id>.webp`, `<id>-sm.webp` and `<id>-still.webp` |
| `frontend/public/media/textures/` | Textures used by the 3D scenes |
| `frontend/public/products/`, `frontend/public/brand/` | Product and brand images |

The film library is listed in `FILMS` in `frontend/src/data/site.js`. Adding a film means adding its files here and an entry there, which needs a developer.

## 2. Uploaded media (through the admin)
- **Provider:** Supabase Storage. **Bucket:** `media`. It is **public-read**, accepts WebP only, and has a 5 MB limit. **NOT CONFIGURED** until Supabase is set up.
- **Folder convention:** `photos/<timestamp>-<file-name>.webp`.
- **Upload process** (`uploadPhoto` in `frontend/src/admin/admin.js`): the browser resizes the photo to at most 1600 px on its longest side, converts it to WebP at 85% quality, and uploads **one** file. The field stores the photo's public URL.
- **Who can upload:** any admin (owner or editor). **Who can delete files:** owners only. Files can't be overwritten, because every upload gets a new path.

## How photos reach the live site
When publishing, `scripts/fetch-content.mjs`:
1. Downloads every bucket photo that published content refers to, into `frontend/public/media/photos/cms/<id>-{400,800,1600}.webp`. Older uploads with one size are reused for every width.
2. Replaces the URL with the id `cms/<id>`.

So visitors load photos from the website itself, never from Supabase. A photo that can't be found shows a warning in the build log and is left as a link.

## Associations
Photos are linked by value inside the content documents. There is no separate media table.
- **Products:** `products[].media[]` holds `{ type: 'photo' | 'reel', id, title }`. The first photo is the grid image.
- **Gallery:** `lookbook[]` holds `{ id, title, w, h }`.
- **Others:**
  - celebrity photos: `trust[].id`
  - services: `services[].photo`
  - story chapters: `story[].photo.id`
  - arched panels: `products[].model.image`

## Replacing, deleting and optimizing
- **Replace:** upload a new photo into the field, then save and publish. The old file stays in storage.
- **Delete:** removing a photo from content does **not** delete the file. There is **no admin screen to delete stored files yet** (TO BE COMPLETED). An owner can delete files in Supabase → Storage. First check that the file isn't used, with the RPC `media_usage(url)`.
- **Optimization:** uploads are resized and converted to WebP in the browser. Built-in photos are pre-generated in three sizes and served with `srcset`.
