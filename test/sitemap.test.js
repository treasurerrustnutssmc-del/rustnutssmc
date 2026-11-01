import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publicPages, sitemapXml } from '../scripts/build-sitemap.mjs';

const root = new URL('..', import.meta.url);

test('every public page is in the sitemap, and nothing else', () => {
  const pages = publicPages(root);
  assert.ok(pages.includes('index.html') && pages.includes('charity.html') && pages.includes('constitution.html'));
  assert.ok(!pages.some((p) => p.startsWith('app/')), 'app pages stay out of the sitemap until launch');
  assert.ok(!pages.includes('coming-soon.html'), 'the Coming soon stub is noindex and stays out');
  const xml = readFileSync(new URL('sitemap.xml', root), 'utf8');
  const listed = [...xml.matchAll(/<loc>https:\/\/www\.rustnutssmc\.com\.au\/([^<]*)<\/loc>/g)].map((m) => m[1] || 'index.html');
  assert.deepEqual(listed.sort(), [...pages].sort(), 'run npm run build:sitemap');
});

test('the committed sitemap is what the script writes today (dates included)', () => {
  const xml = readFileSync(new URL('sitemap.xml', root), 'utf8');
  assert.equal(xml, sitemapXml(root), 'run npm run build:sitemap');
});

test('the home page is first, with the highest priority, and every entry has a date', () => {
  const xml = sitemapXml(root);
  assert.match(xml, /<loc>https:\/\/www\.rustnutssmc\.com\.au\/<\/loc>\s*<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>\s*<changefreq>weekly<\/changefreq>\s*<priority>1\.0<\/priority>/);
  const entries = xml.match(/<url>/g).length;
  assert.equal(xml.match(/<lastmod>/g).length, entries);
});

test('the Coming soon page sends old links home and asks not to be indexed', () => {
  const html = readFileSync(new URL('coming-soon.html', root), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex/);
  assert.match(html, /http-equiv="refresh" content="0;\s*url=\//);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.rustnutssmc\.com\.au\/"/);
  assert.ok(!/App Store|Google Play/.test(html));
});
