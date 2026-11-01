import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auDate, documentBlocks, documentContentsHtml, documentHtml, documentMetaLine, loadDocuments, DOCUMENT_WORDS } from '../app/site-api.js';

const BODY = '# STATUS AND PURPOSE\n\nThis complete v4 consolidates\nthe draft.\n\n- Legal name: Rustnuts <SMC> Inc\n- ABN 13 188 715 331\n\n# MEMBERSHIP\nOne line.\n';

test('the library text comes apart the way the app reads it', () => {
  assert.deepEqual(documentBlocks(BODY), [
    { kind: 'heading', text: 'STATUS AND PURPOSE' },
    { kind: 'para', text: 'This complete v4 consolidates the draft.' },
    { kind: 'bullet', text: 'Legal name: Rustnuts <SMC> Inc' },
    { kind: 'bullet', text: 'ABN 13 188 715 331' },
    { kind: 'heading', text: 'MEMBERSHIP' },
    { kind: 'para', text: 'One line.' },
  ]);
  assert.deepEqual(documentBlocks('#\n-\n\n'), [], 'bare markers are empty blocks and are dropped');
  assert.deepEqual(documentBlocks(null), []);
});

test('the text becomes safe HTML with anchored headings and grouped bullets', () => {
  const html = documentHtml(BODY);
  assert.equal(html, [
    '<h2 id="s1">STATUS AND PURPOSE</h2>',
    '<p>This complete v4 consolidates the draft.</p>',
    '<ul><li>Legal name: Rustnuts &lt;SMC&gt; Inc</li><li>ABN 13 188 715 331</li></ul>',
    '<h2 id="s2">MEMBERSHIP</h2>',
    '<p>One line.</p>',
  ].join('\n'));
  assert.equal(documentContentsHtml(BODY), '<ol><li><a href="#s1">STATUS AND PURPOSE</a></li><li><a href="#s2">MEMBERSHIP</a></li></ol>');
  assert.equal(documentContentsHtml('just words'), '');
  assert.equal(documentHtml(documentBlocks(BODY)), html, 'blocks parsed once can be passed to both renderers');
  assert.equal(documentContentsHtml(documentBlocks(BODY)), documentContentsHtml(BODY));
});

test('dates show DD/MM/YYYY and the meta line carries only the facts recorded', () => {
  assert.equal(auDate('2026-10-25'), '25/10/2026');
  assert.equal(auDate('2026-10-24T20:30:00+00:00'), '25/10/2026', 'a timestamp is read in Melbourne time');
  assert.equal(documentMetaLine({ label: 'v4', published_at: '2026-10-25T03:00:00+00:00', approving_body: null, approved_on: null, commences_on: null }),
    'v4 · Published 25/10/2026');
  assert.equal(documentMetaLine({ label: 'v4', published_at: '2026-10-25T03:00:00+00:00', approving_body: 'full_members', approved_on: '2026-11-15', commences_on: '2026-12-01' }),
    'v4 · Published 25/10/2026 · Approved by Full Members’ vote 15/11/2026, in force from 01/12/2026');
  assert.equal(documentMetaLine({ label: '', published_at: null, approving_body: 'made_up', approved_on: '2026-11-15', commences_on: null }), '', 'an unknown body is not shown');
});

test('loading the documents keeps only well-formed rows and never throws', async () => {
  const good = { kind: 'constitution', title: 'Constitution', label: 'v4', body: '# A', published_at: '2026-10-25T03:00:00+00:00', approving_body: null, approved_on: null, commences_on: null };
  const ok = async () => ({ ok: true, json: async () => ({ documents: [good, { kind: 'constitution', title: 'Blank', label: 'v1', body: '  ' }, { kind: 'constitution', title: 'No label', label: 7, body: '# A' }, 'junk', null] }) });
  assert.deepEqual(await loadDocuments(ok), [good]);
  assert.deepEqual(await loadDocuments(async () => ({ ok: false, json: async () => ({}) })), []);
  assert.deepEqual(await loadDocuments(async () => { throw new Error('offline'); }), []);
  assert.deepEqual(await loadDocuments(async () => ({ ok: true, json: async () => ({ documents: 'nope' }) })), []);
  assert.ok(DOCUMENT_WORDS.offline.includes('PDF'));
});

test('the Constitution page reads from the app, keeps the PDF as its fallback, and the home page points at it', () => {
  const page = readFileSync('constitution.html', 'utf8');
  assert.ok(page.includes('<link rel="canonical" href="https://www.rustnutssmc.com.au/constitution.html" />'));
  assert.ok(page.includes("from './app/site-api.js'"));
  assert.ok(page.includes('href="Rustnuts Constitution.pdf"'), 'the PDF stays as the fallback and the download');
  assert.ok(page.includes('<nav class="nav-links">') && page.includes('class="nav-mobile"'));
  assert.ok(!/apps\.apple\.com|play\.google\.com|app store|google play|play store/i.test(page), 'nothing about the stores before launch');
  const home = readFileSync('index.html', 'utf8');
  assert.ok(home.includes('href="constitution.html"'), 'the Constitution card opens the page');
  assert.ok(readFileSync('sitemap.xml', 'utf8').includes('https://www.rustnutssmc.com.au/constitution.html'));
});
