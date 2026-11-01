import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The home page once carried a hand-kept list of older calendar events and their colours. Colours
// now come from each event's "Label:" tag, which the club app reads too, so the list stays gone.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the home page has no hand-kept event colour list', () => {
  assert.doesNotMatch(html, /EVENT_LABELS/);
  assert.doesNotMatch(html, /\|Heathcote Loop/);
  assert.doesNotMatch(html, /function eventKey/);
});

test('the Label tag reader is still there', () => {
  assert.match(html, /function labelFromDescription/);
  assert.match(html, /LABEL_ALIASES/);
});
