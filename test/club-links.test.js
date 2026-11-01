import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = (key) => {
  const m = html.match(new RegExp(`<!-- club-links:${key}:start[^>]*-->([\\s\\S]*?)<!-- club-links:${key}:end -->`));
  assert.ok(m, `the ${key} block is there`);
  return m[1];
};

test('the podcast and socials blocks are generated from the club app and are plain https links', () => {
  for (const key of ['podcast', 'follow']) {
    const links = [...block(key).matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
    assert.ok(links.length >= 3, `${key} has links`);
    for (const [, href] of links) assert.match(href, /^https:\/\//, href);
    assert.equal(html.match(new RegExp(`club-links:${key}:start`, 'g')).length, 1, 'one block each');
  }
  assert.match(block('podcast'), /open\.spotify\.com/);
  assert.match(block('follow'), /linktr\.ee\/rustnutssmc/);
  assert.ok(!/discord/.test(block('follow')), 'the members’ Discord invite is not on the public page');
  assert.ok(html.includes('<a href="mailto:rustnutssmc@outlook.com">Email Us</a>'), 'the email link stays hand-written');
});
