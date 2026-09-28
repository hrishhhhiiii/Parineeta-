// Content published from the admin, baked in at build time by scripts/fetch-content.mjs.
// When the file is absent (local dev, first build) the glob is empty and the defaults stand.
import { applyAll } from './apply.js';

const file = Object.values(import.meta.glob('../data/published.json', { eager: true, import: 'default' }))[0];

export const PUBLISHED = file?.docs || {};
export const CONTENT_VERSION = file?.seq ?? null;

export function applyPublished() {
  return applyAll(PUBLISHED);
}
