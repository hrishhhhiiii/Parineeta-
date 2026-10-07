// The admin can be open on a phone and a laptop at once. When one device saves a section the other
// already had open, the two sets of edits are merged here instead of the save being refused.
// base = the section as this device last loaded or saved it, mine = this device's edits,
// theirs = what the other device saved since.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Items with an id (products, collections) are matched by id; others by their content.
const itemKey = (it) => (it && typeof it === 'object' && it.id ? `id:${it.id}` : JSON.stringify(it));

export function mergeEdits(kind, base, mine, theirs) {
  if (kind !== 'list') {
    // One form: each field this device changed wins; every other field keeps the other device's value.
    const out = { ...(theirs || {}) };
    for (const k of new Set([...Object.keys(base || {}), ...Object.keys(mine || {})])) {
      if (same(mine?.[k], base?.[k])) continue;
      if (mine?.[k] === undefined) delete out[k];
      else out[k] = mine[k];
    }
    return out;
  }
  base = base || [];
  theirs = theirs || [];
  const baseBy = new Map(base.map((it) => [itemKey(it), it]));
  const mineBy = new Map(mine.map((it) => [itemKey(it), it]));
  const out = theirs
    // Drop what this device deleted, unless the other device changed that item meanwhile.
    .filter((it) => {
      const k = itemKey(it);
      return mineBy.has(k) || !baseBy.has(k) || !same(baseBy.get(k), it);
    })
    // Items this device edited take this device's version.
    .map((it) => {
      const k = itemKey(it);
      const m = mineBy.get(k);
      return m && baseBy.has(k) && !same(m, baseBy.get(k)) ? m : it;
    });
  // Items this device added go in at the same place they had here.
  mine.forEach((it, i) => {
    const k = itemKey(it);
    if (!baseBy.has(k) && !out.some((x) => itemKey(x) === k)) out.splice(Math.min(i, out.length), 0, it);
  });
  return out;
}
