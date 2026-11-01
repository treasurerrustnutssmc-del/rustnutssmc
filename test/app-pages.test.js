import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// The members' app's public pages under app/ are generated from the app repo (`npm run build:site`
// there): one source, two homes. These checks keep the copies here honest.
const PAGES = ['privacy', 'posting-rules', 'support', 'delete-account'];
// The welcome guide names the stores, so it stays off the site until the app launches.

test('every app page is here, wears the site shell, and names its club-domain address', () => {
  for (const slug of PAGES) {
    const path = `app/${slug}.html`;
    assert.ok(existsSync(path), path);
    const html = readFileSync(path, 'utf8');
    assert.ok(html.includes('<nav class="nav-links">'), `${slug}: site nav`);
    assert.ok(html.includes('href="../styles.css"'), `${slug}: site styles`);
    assert.ok(html.includes(`<link rel="canonical" href="https://www.rustnutssmc.com.au/app/${slug}.html" />`), `${slug}: canonical`);
    assert.ok(html.includes('class="display"'), `${slug}: stencil heading`);
  }
});

test('the app pages say nothing about the stores and stay out of the nav and sitemap until launch', () => {
  for (const slug of PAGES) {
    const html = readFileSync(`app/${slug}.html`, 'utf8');
    assert.ok(!/apps\.apple\.com|play\.google\.com|itunes\.apple\.com|app store|google play|play store/i.test(html), `${slug}: no store links or names`);
  }
  assert.ok(!existsSync('app/guide.html'), 'the welcome guide waits for launch');
  for (const page of ['index.html', 'shop.html', 'resources.html', 'charity.html', 'sitemap.xml']) {
    const html = readFileSync(page, 'utf8');
    assert.ok(!/app\/(privacy|posting-rules|support|guide|delete-account)\.html/.test(html), `${page}: no link to the app pages yet`);
  }
});
