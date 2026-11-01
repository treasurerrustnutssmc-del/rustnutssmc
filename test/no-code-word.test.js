import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CATALOG } from '../shop/catalog.js';

// The club code word did nothing once Member and Family ordering moved to Discord
// (Chris, 1 Nov 2026), and it sat in public JavaScript, so it is gone for good.
const shopHtml = readFileSync(new URL('../shop.html', import.meta.url), 'utf8');

test('the shop page has no code word box or wording', () => {
  assert.doesNotMatch(shopHtml, /code word/i);
  assert.doesNotMatch(shopHtml, /gate/i);
});

test('the code word file is gone', () => {
  assert.equal(existsSync(new URL('../shop/gate.js', import.meta.url)), false);
});

test('no design in the catalogue is marked as locked', () => {
  for (const design of CATALOG) assert.equal('gated' in design, false, design.id);
});
