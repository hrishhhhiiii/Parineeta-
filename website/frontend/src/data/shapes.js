// 3D models the admin manages under "3D models": built-in shapes that are switched off, and the
// shop's own uploaded models (.glb files). Products point at a model by its kind: a built-in shape
// key ("kunke") or "custom:<id>" for an uploaded one. Filled from published content (cms/apply.js).
export const MODELS = {
  off: [], // built-in shape keys switched off: products using them show photos only
  custom: [], // { id, name, file, hidden }
};

export const customKind = (id) => `custom:${id}`;
export const isCustomKind = (kind) => typeof kind === 'string' && kind.startsWith('custom:');
/** The uploaded model a kind points at, if it is still available on the site. */
export const customModel = (kind) => (isCustomKind(kind) ? MODELS.custom.find((m) => customKind(m.id) === kind && m.file && !m.hidden) : null);
