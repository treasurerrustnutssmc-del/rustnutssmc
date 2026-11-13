import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The home page has a Get the app section that stays hidden until launch day. The note above it is
// what whoever switches it on will read, so it has to give the club's launch rule as it stands:
// launch day is the day both stores approve (Jeff, 14/11/2026), not the day Apple approves.
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const found = home.match(/<!-- GET THE APP:[\s\S]*?-->\s*<section[^>]*>/);

test('the Get the app note gives the launch rule: both stores, not Apple alone', () => {
  assert.ok(found, 'index.html has the GET THE APP note straight above its section');
  const note = found[0].replace(/\s+/g, ' ');
  assert.match(note, /kept hidden until launch day, the day both stores approve/);
  assert.doesNotMatch(note, /until Apple approves/i);
});
