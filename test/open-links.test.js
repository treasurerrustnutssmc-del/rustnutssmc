import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Links under /open/ open the members' app (app repo: src/domain/appLinks.ts, app.json). Anyone
// without the app lands on open/index.html. The phones check the .well-known files before they
// trust the app with these links.

test('the "this opens in the app" page is here, kept out of search, and names no store', () => {
  assert.ok(existsSync('open/index.html'));
  const html = readFileSync('open/index.html', 'utf8');
  assert.ok(html.includes('<meta name="robots" content="noindex" />'), 'noindex');
  assert.ok(html.includes('<nav class="nav-links">'), 'site nav');
  assert.ok(html.includes('href="../styles.css"'), 'site styles');
  assert.ok(html.includes('class="display"'), 'stencil heading');
  assert.ok(!/apps\.apple\.com|play\.google\.com|itunes\.apple\.com|app store|google play|play store/i.test(html), 'no store links or names before launch');
  assert.ok(!readFileSync('sitemap.xml', 'utf8').includes('/open/'), 'not in the sitemap');
});

test('GitHub Pages serves the .well-known folder (Jekyll skips dot-folders otherwise)', () => {
  const config = readFileSync('_config.yml', 'utf8');
  assert.match(config, /^include:\s*\[\s*["']?\.well-known["']?\s*\]\s*$/m);
  assert.ok(!existsSync('.nojekyll'), 'the rest of the site builds as before');
});

test('Android: assetlinks.json trusts only the club app, signed by Play or by the upload key', { skip: !existsSync('.well-known/assetlinks.json') }, () => {
  const links = JSON.parse(readFileSync('.well-known/assetlinks.json', 'utf8'));
  assert.equal(links.length, 1);
  const [s] = links;
  assert.deepEqual(s.relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(s.target.namespace, 'android_app');
  assert.equal(s.target.package_name, 'au.com.rustnutssmc.app');
  // From Play Console › App integrity › App signing (read 14/11/2026): Play's app signing key in
  // use (store installs), its quantum-ready set, and the upload key (the EAS keystore, which also
  // signs the android-preview test builds).
  const keys = s.target.sha256_cert_fingerprints;
  for (const f of keys) assert.match(f, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  assert.equal(new Set(keys).size, keys.length, 'no repeats');
  assert.ok(keys.includes('05:14:BE:E4:FD:BE:57:7E:DE:DB:EB:48:EF:BB:84:AE:88:24:90:66:26:B4:04:1C:2C:FD:04:9E:96:66:83:A6'), 'Play app signing key');
  assert.ok(keys.includes('CE:3B:9A:AA:EE:C8:8F:98:9B:7E:F8:ED:76:94:12:89:C4:B5:E1:87:0B:12:8A:6E:4D:8B:84:AD:84:D1:15:23'), 'upload key (EAS)');
});

test('iPhone: once published, the association file opens only /open links in the club app', { skip: !existsSync('.well-known/apple-app-site-association') }, () => {
  const aasa = JSON.parse(readFileSync('.well-known/apple-app-site-association', 'utf8'));
  const [d] = aasa.applinks.details;
  assert.equal(aasa.applinks.details.length, 1);
  assert.equal(d.appIDs.length, 1);
  assert.match(d.appIDs[0], /^[A-Z0-9]{10}\.au\.com\.rustnutssmc\.app$/);
  assert.deepEqual(d.components.map((c) => c['/']), ['/open', '/open/*']);
});
