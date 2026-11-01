import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadNews, newsHtml } from '../app/site-api.js';

const notice = (over = {}) => ({
  id: '11111111-2222-4333-8444-555555555555',
  title: 'Toy run, Sunday 7 December',
  body: 'Bring a new <toy> & meet at 9am.',
  link: 'https://www.rustnutssmc.com.au/charity.html',
  created_at: '2026-10-29T06:30:00+00:00',
  ...over,
});

test('newsHtml: one card per notice, escaped, dated the Melbourne way, link only when https', () => {
  const html = newsHtml([notice(), notice({ id: '21111111-2222-4333-8444-555555555555', title: 'Open day', link: null })]);
  assert.match(html, /<article class="news-item">/);
  assert.match(html, /<h3>Toy run, Sunday 7 December<\/h3>/);
  assert.match(html, /Bring a new &lt;toy&gt; &amp; meet at 9am\./);
  assert.match(html, /<time datetime="2026-10-29T06:30:00\+00:00">29\/10\/2026<\/time>/);
  assert.match(html, /<a class="news-more" href="https:\/\/www\.rustnutssmc\.com\.au\/charity\.html" target="_blank" rel="noopener">More<\/a>/);
  assert.equal(html.match(/news-more/g).length, 1, 'the open day has no link');
  assert.equal(newsHtml([notice({ link: 'http://evil.example' })]).includes('news-more'), false, 'http is not shown');
  assert.equal(newsHtml([notice({ link: 'javascript:alert(1)' })]).includes('href'), false);
});

test('newsHtml: nothing to show gives an empty string, and odd rows are skipped', () => {
  assert.equal(newsHtml([]), '');
  assert.equal(newsHtml(null), '');
  assert.equal(newsHtml([{ title: 'no body' }, 'junk', notice({ body: '   ' })]), '');
  assert.equal(newsHtml([notice(), { id: 'x', title: 7, body: 'y', created_at: 'z' }]).match(/news-item/g).length, 1);
});

test('loadNews: the app feed, or [] on any failure so the strip stays hidden', async () => {
  const ok = async () => ({ ok: true, json: async () => ({ news: [notice()] }) });
  assert.equal((await loadNews(ok)).length, 1);
  assert.deepEqual(await loadNews(async () => ({ ok: false, status: 503, json: async () => ({ error: 'down' }) })), []);
  assert.deepEqual(await loadNews(async () => { throw new Error('offline'); }), []);
  assert.deepEqual(await loadNews(async () => ({ ok: true, json: async () => ({}) })), []);
});

test('the home page has a hidden news strip wired to the feed', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<section class="block news" id="news" hidden>/);
  assert.match(html, /id="news-grid"/);
  assert.match(html, /loadNews\(\)\.then/);
  assert.ok(html.indexOf('id="news"') < html.indexOf('id="sponsors"'), 'news sits before the sponsors strip');
  assert.ok(html.indexOf('id="causes"') < html.indexOf('id="news"'), 'and after the causes');
});
