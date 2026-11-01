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

// The Road Rules' public face, also generated from the app repo: Chris's diagrams only. The full
// written rules members sign stay in the app.
test('the illustrated Road Rules page has all 17 diagrams beside it and the home page links to it', () => {
  const html = readFileSync('app/road-rules.html', 'utf8');
  assert.ok(html.includes('<link rel="canonical" href="https://www.rustnutssmc.com.au/app/road-rules.html" />'));
  const images = [...html.matchAll(/<img src="(road-rules\/[a-z0-9-]+\.png)"/g)].map((m) => m[1]);
  assert.equal(images.length, 17);
  for (const src of images) assert.ok(existsSync(`app/${src}`), src);
  assert.ok(!/apps\.apple\.com|play\.google\.com|app store|google play|play store/i.test(html), 'no store links or names');
  assert.ok(!html.includes('Pack safety comes before ego'), 'none of the written rules');
  assert.ok(readFileSync('index.html', 'utf8').includes('href="app/road-rules.html"'), 'the Club Documents card');
});
