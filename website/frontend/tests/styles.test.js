// Guards for the stylesheets themselves.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const dirs = ['../src/styles/', '../src/admin/', '../src/login/'];
const sheets = dirs.flatMap((d) => readdirSync(new URL(d, import.meta.url)).filter((f) => f.endsWith('.css')).map((f) => [d + f, readFileSync(new URL(d + f, import.meta.url), 'utf8')]));

describe('stylesheets', () => {
  // The build's CSS minifier keeps only the LAST of `backdrop-filter` and `-webkit-backdrop-filter` when both
  // are written. Written standard-first, the standard one was dropped, and Chrome, Edge and Firefox (which
  // only read the standard one) showed every blurred surface see-through: page text ran behind the top bar.
  it.each(sheets)('%s: the standard backdrop-filter comes after its -webkit- twin', (name, css) => {
    expect(css).not.toMatch(/(^|[\s;{])backdrop-filter:[^;}]*;\s*-webkit-backdrop-filter:/);
  });
});
