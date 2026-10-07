// "3D models" in the admin: every 3D model on the website, which products use it, switching a model
// off (its products then show photos only), moving products between models, and uploading the shop's
// own models (.glb files). Saved in the "models" section (plus Products, when products are moved).
// Database: migrations/012_models.sql.
import { SHAPES } from './schemas.js';
import { customKind } from '../data/shapes.js';

const MAX_MB = 20;

export function modelsView({ h, toast, sb, ctx, slugify, changed, saveAll, undoAll, edited }) {
  const models = ctx.data.models;
  models.off ||= [];
  models.custom ||= [];
  const products = () => ctx.data.products || [];
  const kindOf = (p) => p.model?.kind || 'kunke';
  const nameOf = (p) => `${p.en || p.id || 'New product'}${p.hidden ? ' (hidden)' : ''}`;
  const body = h('div', { class: 'mdl' });

  /** Every model: uploaded ones first, then the built-in shapes. */
  const all = () => [
    ...models.custom.map((m) => ({ key: customKind(m.id), name: m.name || m.id, custom: m, on: !m.hidden })),
    ...SHAPES.filter(([k]) => k !== 'none').map(([k, label]) => ({ key: k, name: label, on: !models.off.includes(k) })),
  ];
  const usersOf = (key) => products().filter((p) => kindOf(p) === key);

  const setKind = (p, kind) => {
    p.model = kind === 'none' || kind.startsWith('custom:') ? { kind } : { ...(p.model || {}), kind };
  };

  const change = () => {
    edited();
    paint();
  };

  /* ---------- the picture of each model (drawn in 3D, once, then kept) ---------- */
  const pictures = new Map();
  function picture(m) {
    const img = h('img', { class: 'mdl__img', alt: '', width: 360, height: 440 });
    const fake = { id: `admin-shape-${m.custom ? `custom-${m.custom.id}` : m.key}`, styles: ['sindoor'], model: { kind: m.key, file: m.custom?.file } };
    if (!pictures.has(fake.id)) {
      pictures.set(fake.id, import('../three/thumbs.js').then(({ getThumb }) => getThumb(fake, 'sindoor')).catch(() => null));
    }
    pictures.get(fake.id).then((url) => {
      if (url) img.src = url;
      else img.replaceWith(h('span', { class: 'mdl__img mdl__img--none', text: '🧊' }));
    });
    return img;
  }

  /* ---------- one model ---------- */
  function card(m) {
    const users = usersOf(m.key);
    const others = products().filter((p) => kindOf(p) !== m.key);
    const toggle = h('input', {
      type: 'checkbox', checked: m.on, 'aria-label': `${m.name} on the website`,
      onchange: (e) => {
        if (m.custom) m.custom.hidden = !e.target.checked;
        else models.off = e.target.checked ? models.off.filter((k) => k !== m.key) : [...new Set([...models.off, m.key])];
        change();
      },
    });
    return h('article', { class: `card mdl__card${m.on ? '' : ' is-off'}` },
      h('div', { class: 'mdl__media' }, picture(m)),
      h('div', { class: 'mdl__body' },
        h('div', { class: 'mdl__head' },
          h('h2', { text: m.name }),
          h('span', { class: `mdl__tag${m.custom ? ' is-custom' : ''}`, text: m.custom ? 'Your upload' : 'Built-in' })),
        h('label', { class: 'switch' }, toggle, h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
          h('span', { class: 'switch__text', text: m.on ? 'On the website' : 'Off: its products show photos only' })),
        h('p', { class: 'mdl__label', text: users.length ? `Used by ${users.length} product${users.length > 1 ? 's' : ''}` : 'Not used by any product' }),
        users.length ? h('div', { class: 'chips' }, ...users.map((p) => h('button', {
          type: 'button', class: 'chip mdl__chip', title: 'Take this product off this model (it shows photos only)',
          'aria-label': `${nameOf(p)}: take off this model`,
          onclick: () => { setKind(p, 'none'); change(); },
        }, nameOf(p), h('span', { 'aria-hidden': 'true', text: ' ✕' })))) : null,
        others.length ? h('label', { class: 'field mdl__use' },
          h('span', { class: 'field__label', text: 'Use this model for a product' }),
          h('select', {
            class: 'input',
            onchange: (e) => {
              const p = products().find((x) => x.id === e.target.value);
              if (p) { setKind(p, m.key); change(); }
            },
          }, h('option', { value: '', text: '— choose a product —' }), ...others.map((p) => h('option', { value: p.id, text: nameOf(p) })))) : null,
        m.custom ? h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Rename', onclick: () => {
            const next = prompt('New name for this model:', m.custom.name || '');
            if (next && next.trim()) { m.custom.name = next.trim(); change(); }
          } }),
          h('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Delete', onclick: () => {
            const n = users.length;
            if (!confirm(`Delete “${m.name}”?${n ? `\n\n${n} product${n > 1 ? 's use' : ' uses'} it and will show photos only until you pick another model.` : ''}\n\nYou can undo until you save.`)) return;
            users.forEach((p) => setKind(p, 'none'));
            models.custom = models.custom.filter((x) => x !== m.custom);
            change();
          } })) : null));
  }

  /* ---------- upload ---------- */
  function uploadCard() {
    const name = h('input', { class: 'input', type: 'text', placeholder: 'e.g. Gach kouto (scanned)', maxlength: 60 });
    const file = h('input', { class: 'input', type: 'file', accept: '.glb,model/gltf-binary' });
    const msg = h('p', { class: 'form-msg', role: 'status' });
    const btn = h('button', { type: 'button', class: 'btn btn--gold', text: 'Upload model' });
    btn.addEventListener('click', async () => {
      const f = file.files[0];
      msg.textContent = '';
      if (!f) return (msg.textContent = 'Choose a .glb file first.');
      if (!/\.glb$/i.test(f.name)) return (msg.textContent = 'Only .glb files work. In Blender: File → Export → glTF 2.0, format “glTF Binary (.glb)”.');
      if (f.size > MAX_MB * 1024 * 1024) return (msg.textContent = `That file is ${(f.size / 1048576).toFixed(1)} MB. The limit is ${MAX_MB} MB: export it with fewer polygons or smaller textures.`);
      btn.disabled = true;
      btn.textContent = 'Checking the file…';
      try {
        // Make sure it opens as a 3D model before it goes up.
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        await new GLTFLoader().parseAsync(await f.arrayBuffer(), '');
        btn.textContent = 'Uploading…';
        const label = name.value.trim() || f.name.replace(/\.glb$/i, '');
        const slug = slugify(label).slice(0, 40) || 'model';
        const path = `models/${Date.now()}-${slug}.glb`;
        const { error } = await sb.storage.from('media').upload(path, f, { contentType: 'model/gltf-binary', cacheControl: '31536000' });
        if (error) throw error;
        const url = sb.storage.from('media').getPublicUrl(path).data.publicUrl;
        models.custom = [{ id: `${slug}-${Date.now().toString(36)}`, name: label, file: url, hidden: false }, ...models.custom];
        change();
        toast(`“${label}” uploaded. Pick the products that use it below, then press Save.`);
      } catch (err) {
        const text = String(err?.message || err);
        msg.textContent = /mime|not supported|exceeded|too large|payload/i.test(text)
          ? 'The storage does not accept 3D files yet: run 012_models.sql in Supabase once, then try again.'
          : /glTF|JSON|Unexpected|magic|Invalid/i.test(text) ? 'This file did not open as a 3D model. Export it again as glTF Binary (.glb).'
            : `Could not upload: ${text}`;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Upload model';
      }
    });
    return h('section', { class: 'card mdl__upload' },
      h('h2', { text: 'Add your own 3D model' }),
      h('p', { class: 'muted', text: `A .glb file up to ${MAX_MB} MB: from a 3D-scan phone app (Polycam, Luma, Kiri), Blender, or a 3D maker. Your model keeps its own colours; the colourway buttons on the website don't repaint it.` }),
      h('div', { class: 'rv-form__row' },
        h('label', { class: 'field' }, h('span', { class: 'field__label', text: 'Name' }), name),
        h('label', { class: 'field' }, h('span', { class: 'field__label', text: '3D file (.glb)' }), file)),
      h('div', { class: 'row' }, btn), msg);
  }

  /* ---------- products showing photos only ---------- */
  function photosOnly() {
    const on = new Set(all().filter((m) => m.on).map((m) => m.key));
    const list = products().filter((p) => !on.has(kindOf(p)));
    if (!list.length) return null;
    return h('section', { class: 'card mdl__none' },
      h('h2', { text: `Showing photos only (${list.length})` }),
      h('p', { class: 'muted', text: 'These products have no 3D model on the website: set to None, or their model is switched off or deleted. Use “Use this model for a product” on a model below to give one a 3D model.' }),
      h('div', { class: 'chips' }, ...list.map((p) => h('span', { class: 'chip mdl__chip is-static', text: nameOf(p) }))));
  }

  function paint() {
    const dirty = changed('models') || changed('products');
    body.replaceChildren(
      h('div', { class: 'sec-head' },
        h('div', {}, h('h1', { text: '3D models' }), h('p', { class: 'muted', text: 'Every 3D model on the website and where it is used. Switch one off and its products show their photos instead. Changes here go live with “Put changes live”.' })),
        h('div', { class: `savebar${dirty ? ' is-dirty' : ''}` },
          h('span', { class: 'savebar__state', text: dirty ? 'You have changes. Press Save.' : '' }),
          dirty ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Undo changes', onclick: () => { undoAll(); } }) : null,
          h('button', { type: 'button', class: 'btn btn--gold', text: 'Save changes', disabled: !dirty, onclick: () => saveAll() }))),
      uploadCard(),
      photosOnly(),
      h('div', { class: 'mdl__grid' }, ...all().map(card)));
  }

  paint();
  return body;
}
