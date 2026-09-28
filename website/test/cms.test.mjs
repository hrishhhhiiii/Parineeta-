import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementActive } from '../frontend/src/data/announcement.js';
import { safeHref } from '../frontend/src/cms/urls.js';
import { buildSchemas, validate } from '../scripts/cms-schemas.mjs';
import { DEFAULT_DOCS } from '../frontend/src/cms/defaults.js';
import { applyAll } from '../frontend/src/cms/apply.js';
import { PRODUCTS } from '../frontend/src/data/products.js';

test('announcement window', () => {
  const a = { text: 'Puja orders close soon', visible: true, startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-20T00:00:00Z' };
  assert.equal(announcementActive(a, new Date('2026-08-31T23:59:59Z')), false);
  assert.equal(announcementActive(a, new Date('2026-09-01T00:00:00Z')), true);
  assert.equal(announcementActive(a, new Date('2026-09-19T23:59:59Z')), true);
  assert.equal(announcementActive(a, new Date('2026-09-20T00:00:00Z')), false);
  assert.equal(announcementActive({ ...a, visible: false }, new Date('2026-09-05')), false);
  assert.equal(announcementActive({ ...a, text: '  ' }, new Date('2026-09-05')), false);
});

test('safeHref rejects script and http links', () => {
  assert.equal(safeHref('javascript:alert(1)'), '');
  assert.equal(safeHref('http://example.com'), '');
  assert.equal(safeHref('//evil.com'), '');
  assert.equal(safeHref('https://example.com/a'), 'https://example.com/a');
  assert.equal(safeHref('#collection'), '#collection');
  assert.equal(safeHref('/p/topor/'), '/p/topor/');
  assert.equal(safeHref('tel:+91 90641 88260'), '');
  assert.equal(safeHref('tel:+91 90641 88260', { tel: true }), 'tel:+91 90641 88260');
});

test('every default document passes its schema', () => {
  for (const [key, schema] of Object.entries(buildSchemas())) {
    assert.deepEqual(validate(schema, DEFAULT_DOCS[key]), [], key);
  }
});

test('schema rejects a string price and a bad slug', () => {
  const s = buildSchemas().products;
  const p = structuredClone(DEFAULT_DOCS.products);
  p[0].priceFrom = '500';
  p[1].id = 'Bad Slug';
  const errs = validate(s, p);
  assert.ok(errs.some((e) => e.includes('priceFrom')));
  assert.ok(errs.some((e) => e.includes('[1].id')));
});

test('applyAll keeps defaults for a broken document and applies the rest', () => {
  const before = PRODUCTS.length;
  const applied = applyAll({ categories: 'not-an-array', announcement: { text: 'Hi', visible: true } });
  assert.deepEqual(applied, ['announcement']);
  assert.equal(PRODUCTS.length, before);
});

import { youtubeId, socialUrlOk } from '../frontend/src/data/homepage.js';

test('youtubeId accepts ids and every link form, rejects others', () => {
  const id = 'dQw4w9WgXcQ';
  for (const v of [id, `https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}`, `https://youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`]) assert.equal(youtubeId(v), id, v);
  assert.equal(youtubeId('https://evil.com/watch?v=dQw4w9WgXcQ'), '');
  assert.equal(youtubeId('not a video'), '');
});

test('social links must be https on the platform domain', () => {
  assert.equal(socialUrlOk('instagram', 'https://www.instagram.com/parineeta_365/'), true);
  assert.equal(socialUrlOk('instagram', 'http://www.instagram.com/x'), false);
  assert.equal(socialUrlOk('instagram', 'https://instagram.com.evil.net/x'), false);
  assert.equal(socialUrlOk('facebook', 'https://www.instagram.com/x'), false);
});
