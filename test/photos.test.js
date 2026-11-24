import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { albumsHtml, homePhotosHtml, loadPhotos, photosHtml } from '../app/site-api.js';

const photo = (over = {}) => ({
  id: '11111111-2222-4333-8444-555555555555',
  url: 'https://x.supabase.co/storage/v1/object/sign/chat-media/club/a.jpg?token=abc',
  width: 1200,
  height: 900,
  caption: 'Spring run <Lorne> & back',
  taken_at: '2026-10-13T06:10:00+00:00',
  ...over,
});

test('photosHtml: one figure per photo, escaped caption as alt and caption, lazy, sized, opens the full photo', () => {
  const html = photosHtml([photo(), photo({ id: '2', caption: null, url: 'https://x.supabase.co/b.jpg' })]);
  assert.equal(html.match(/<figure class="photo-item">/g).length, 2);
  assert.match(html, /<a href="https:\/\/x\.supabase\.co\/storage\/v1\/object\/sign\/chat-media\/club\/a\.jpg\?token=abc" target="_blank" rel="noopener">/);
  assert.match(html, /alt="Spring run &lt;Lorne&gt; &amp; back" loading="lazy" decoding="async" width="1200" height="900"/);
  assert.match(html, /<figcaption>Spring run &lt;Lorne&gt; &amp; back<\/figcaption>/);
  assert.equal(html.match(/figcaption/g).length, 2, 'no caption, no figcaption');
  assert.match(html, /alt="Rustnuts club photo"/);
});

test('photosHtml: only https links are shown, odd rows are skipped, nothing gives an empty string', () => {
  assert.equal(photosHtml([]), '');
  assert.equal(photosHtml(null), '');
  assert.equal(photosHtml([photo({ url: 'javascript:alert(1)' })]), '');
  assert.equal(photosHtml([photo({ url: 'http://evil.example/a.jpg' })]), '');
  assert.equal(photosHtml([{ id: 'x' }, 'junk', photo({ taken_at: 7 })]), '');
  assert.equal(photosHtml([photo(), { id: 'y', url: 'https://ok.example/a.jpg', taken_at: 'z', width: 'wide' }]).match(/photo-item/g).length, 2);
  assert.equal(photosHtml([photo({ width: 0, height: -1 })]).includes('width='), false, 'no size when unknown');
});

test('homePhotosHtml: the first eight only', () => {
  const many = Array.from({ length: 12 }, (_, i) => photo({ id: `p${i}` }));
  assert.equal(homePhotosHtml(many).match(/photo-item/g).length, 8);
  assert.equal(photosHtml(many).match(/photo-item/g).length, 12);
});

test('loadPhotos: the app feed, or [] on any failure so the strip stays hidden', async () => {
  const ok = async () => ({ ok: true, json: async () => ({ photos: [photo(), { id: 'bad' }] }) });
  assert.equal((await loadPhotos(ok)).length, 1);
  assert.deepEqual(await loadPhotos(async () => ({ ok: false, status: 503, json: async () => ({ error: 'down' }) })), []);
  assert.deepEqual(await loadPhotos(async () => { throw new Error('offline'); }), []);
  assert.deepEqual(await loadPhotos(async () => ({ ok: true, json: async () => ({}) })), []);
});

test('the home page has the hidden photos strip wired to the feed, and every page links to photos.html', () => {
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(home, /<section class="block photos" id="photos" hidden>/);
  assert.match(home, /id="photo-grid"/);
  assert.match(home, /href="photos\.html" class="btn btn-ghost"/);
  assert.match(home, /loadPhotos\(\)\.then/);
  for (const page of ['index.html', 'charity.html', 'shop.html', 'resources.html', 'constitution.html']) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
    assert.ok(html.includes('href="photos.html"'), `${page} links to the photos page`);
  }
  const photos = readFileSync(new URL('../photos.html', import.meta.url), 'utf8');
  assert.match(photos, /photosHtml\(list\)/);
  assert.match(photos, /facebook\.com\/RustnutsSMC\/photos_albums/, 'the West albums stay reachable');
  assert.match(photos, /recordVisit\(\)/);
});

// The club gallery (app spec 2026-11-23-club-gallery-design.md): albums, videos and download links.
const video = (over = {}) => photo({
  id: 'v1', kind: 'video', url: 'https://media.example.workers.dev/v/v1.jpg', video: 'https://media.example.workers.dev/v/v1.mp4',
  download: 'https://media.example.workers.dev/v/v1.mp4?download=1', caption: 'Burnout', album: null, album_date: null, ...over,
});

test('photosHtml: a video shows its still with a play mark and carries its video for the viewer', () => {
  const html = photosHtml([video()]);
  assert.match(html, /<figure class="photo-item is-video"/);
  assert.match(html, /data-video="https:\/\/media\.example\.workers\.dev\/v\/v1\.mp4"/);
  assert.match(html, /<span class="play-mark" aria-hidden="true">/);
  assert.match(html, /aria-label="Play the video: Burnout"/);
  assert.equal(photosHtml([video({ video: 'javascript:alert(1)' })]).includes('data-video'), false, 'only https videos');
});

test('photosHtml: each photo and video has a download link when the feed gives one', () => {
  const html = photosHtml([photo({ download: 'https://x.supabase.co/a.jpg?download=rustnuts.jpg' }), video()]);
  assert.equal(html.match(/class="photo-download"/g).length, 2);
  assert.match(html, /href="https:\/\/x\.supabase\.co\/a\.jpg\?download=rustnuts\.jpg" class="photo-download" download/);
  assert.equal(photosHtml([photo()]).includes('photo-download'), false, 'none without one');
});

test('photosHtml: an album filter shows only that album; Club life is the ones with none', () => {
  const list = [photo({ id: 'a', album: 'Run to Lorne', album_date: '2026-11-09' }), photo({ id: 'b', album: null }), video({ album: 'Run to Lorne', album_date: '2026-11-09' })];
  assert.equal(photosHtml(list, Infinity, 'Run to Lorne').match(/photo-item/g).length, 2);
  assert.equal(photosHtml(list, Infinity, '').match(/photo-item/g).length, 1);
  assert.equal(photosHtml(list).match(/photo-item/g).length, 3);
});

test('albumsHtml: All, then each ride album newest first with its date, then Club life; none when there is only one', () => {
  const list = [
    photo({ id: 'a', album: 'Run to Lorne', album_date: '2026-11-09' }),
    photo({ id: 'b', album: 'Big 4 <weekend>', album_date: '2026-11-21' }),
    photo({ id: 'c', album: null }),
    photo({ id: 'd', album: 'Run to Lorne', album_date: '2026-11-09' }),
  ];
  const html = albumsHtml(list);
  const labels = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['All', 'Big 4 &lt;weekend&gt; · 21/11/2026', 'Run to Lorne · 09/11/2026', 'Club life']);
  assert.match(html, /aria-pressed="true"[^>]*>All</);
  assert.equal(albumsHtml([photo()]), '', 'one album: no chips');
});

test('photos.html has the album chips, a viewer that plays videos, and every photo’s download link', () => {
  const page = readFileSync(new URL('../photos.html', import.meta.url), 'utf8');
  assert.match(page, /id="photo-albums"/);
  assert.match(page, /<dialog class="viewer" id="viewer"/);
  assert.match(page, /<video[^>]*controls/);
  assert.match(page, /albumsHtml\(list\)/);
});
