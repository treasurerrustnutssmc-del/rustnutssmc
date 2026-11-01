import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { recordVisit, SITE_API } from '../app/site-api.js';

const nav = (over = {}) => ({ doNotTrack: '0', globalPrivacyControl: false, sendBeacon: undefined, ...over });

test('recordVisit posts the page path once and asks for nothing back', async () => {
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init }); return { ok: true }; };
  assert.equal(recordVisit('/charity.html', fetchFn, nav()), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${SITE_API}/visit`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.keepalive, true);
  assert.deepEqual(JSON.parse(calls[0].init.body), { page: '/charity.html' });
  recordVisit('/index.html', fetchFn, nav());
  assert.deepEqual(JSON.parse(calls[1].init.body), { page: '/' });
});

test('recordVisit uses fetch even when sendBeacon exists (the beacon POST is refused by the server), and honours Do Not Track and Global Privacy Control', () => {
  const beacons = [];
  const n = nav({ sendBeacon: (url, blob) => { beacons.push({ url, type: blob.type }); return true; } });
  let fetched = 0;
  assert.equal(recordVisit('/', () => { fetched++; return Promise.resolve(); }, n), true);
  assert.equal(beacons.length, 0);
  assert.equal(fetched, 1);
  assert.equal(recordVisit('/', () => { fetched++; return Promise.resolve(); }, nav({ doNotTrack: '1' })), false);
  assert.equal(recordVisit('/', () => { fetched++; return Promise.resolve(); }, nav({ globalPrivacyControl: true })), false);
  assert.equal(fetched, 1);
});

test('recordVisit never throws', () => {
  assert.equal(recordVisit('/', () => { throw new Error('offline'); }, nav()), false);
  assert.equal(recordVisit('/', () => Promise.reject(new Error('offline')), nav()), true);
});

test('every page on the site records a visit', () => {
  const pages = readdirSync(new URL('..', import.meta.url)).filter((f) => f.endsWith('.html'));
  const appPages = readdirSync(new URL('../app', import.meta.url)).filter((f) => f.endsWith('.html'));
  assert.ok(pages.length >= 6 && appPages.length >= 4);
  for (const p of pages) assert.match(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'), /recordVisit\(\)/, p);
  for (const p of appPages) assert.match(readFileSync(new URL(`../app/${p}`, import.meta.url), 'utf8'), /recordVisit\(\)/, `app/${p}`);
});
