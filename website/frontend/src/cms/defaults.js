// Today's bundled content as {key: document}: the reset target, the backfill check and the
// fallback when nothing has been published.
import { SECTIONS } from '../admin/schemas.js';

export const DEFAULT_DOCS = {
  ...Object.fromEntries(SECTIONS.map((s) => [s.key, s.defaults()])),
};
