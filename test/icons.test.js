import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The icon files are the app's own icon, copied here by the app's `npm run build:site`
// (rustnuts-app/scripts/build-site-icons.py renders them from assets/icon.png).
const ICONS = { 'favicon-16x16.png': 16, 'favicon-32x32.png': 32, 'apple-touch-icon.png': 180 };

const pngSize = (b) => (b.readUInt32BE(0) === 0x89504e47 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null);

test('the icon files are square PNGs of the size their tag claims, and the ICO holds 16 and 32', () => {
  for (const [file, size] of Object.entries(ICONS)) {
    assert.deepEqual(pngSize(readFileSync(new URL(`../${file}`, import.meta.url))), [size, size], file);
  }
  const ico = readFileSync(new URL('../favicon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1, 'favicon.ico is not an ICO');
  const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + i * 16] || 256);
  assert.ok(sizes.includes(16) && sizes.includes(32), `favicon.ico holds ${sizes.join(', ')}px`);
});

test('every page links the same four icon files', () => {
  const pages = [
    ...readdirSync(new URL('..', import.meta.url)).filter((f) => f.endsWith('.html')).map((f) => f),
    ...readdirSync(new URL('../app', import.meta.url)).filter((f) => f.endsWith('.html')).map((f) => `app/${f}`),
  ];
  assert.ok(pages.length >= 10);
  for (const p of pages) {
    const html = readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
    for (const file of [...Object.keys(ICONS), 'favicon.ico']) assert.ok(html.includes(`href="/${file}"`), `${p} does not link /${file}`);
  }
});
