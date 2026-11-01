import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

// Keeps the home page light on phone data: every image the page itself loads stays small,
// the theme song (downloaded only when someone presses play) stays a sensible size, and
// nothing points at a file that has left the repo.
const root = new URL('..', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const KB = 1024;

const imageRefs = () => {
  const refs = new Set();
  for (const m of html.matchAll(/url\(["']?([^"')]+\.(?:jpg|jpeg|png|webp|gif))["']?\)/g)) refs.add(m[1]);
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) refs.add(m[1]);
  return [...refs].filter((r) => !r.startsWith('http'));
};

test('every image the home page loads exists and is under 150 KB', () => {
  const refs = imageRefs();
  assert.ok(refs.length >= 6, `found only ${refs.length} image references`);
  for (const r of refs) {
    const p = new URL(r, root);
    assert.ok(existsSync(p), `${r} is missing`);
    assert.ok(statSync(p).size <= 150 * KB, `${r} is ${Math.round(statSync(p).size / KB)} KB`);
  }
});

test('the theme song is served under 6.5 MB and is not preloaded', () => {
  assert.match(html, /<audio[^>]+preload="none"/);
  const size = statSync(new URL('rust-til-dust.mp3', root)).size;
  assert.ok(size <= 6.5 * KB * KB, `rust-til-dust.mp3 is ${(size / KB / KB).toFixed(1)} MB`);
});

test('the old 1.6 MB badge PNG is gone and nothing links it', () => {
  assert.ok(!existsSync(new URL('final-badge.png', root)), 'final-badge.png still in the repo');
  assert.ok(!html.includes('final-badge.png'));
});
