import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The club colours and fonts come from the app's theme: `npm run build:site` in the app repo writes
// them into styles.css between the brand markers. These checks keep that block whole and in use.
const css = readFileSync('styles.css', 'utf8');
const block = css.slice(css.indexOf('/* brand:start'), css.indexOf('/* brand:end */'));

test('styles.css carries the generated brand block with the club colours, ride colours and fonts', () => {
  assert.ok(block.length > 0 && css.indexOf('/* brand:start') < css.indexOf('/* brand:end */'), 'markers in order');
  assert.ok(block.includes(':root{'));
  for (const v of ['--ink', '--steel', '--bone', '--bone-dim', '--bone-mute', '--red', '--red-bright', '--red-text', '--ride-west-bg', '--ride-north-bg', '--stencil', '--body']) {
    assert.ok(new RegExp(`^  ${v}:.+;$`, 'm').test(block), v);
  }
  assert.equal((css.match(/:root\{/g) ?? []).length, 1, 'one :root, the generated one');
});

test('the font-face name matches the stack the brand block names, and the body uses the brand font', () => {
  const family = /@font-face\{\s*font-family:"([^"]+)"/.exec(css)?.[1];
  assert.ok(family, 'a font-face for the club typeface');
  assert.ok(new RegExp(`--stencil:"${family}"`).test(block), 'the --stencil stack starts with the font-face name');
  assert.ok(/body\{\s*font-family:var\(--body\);/.test(css));
  const pages = readdirSync('.').filter((f) => f.endsWith('.html')).concat(readdirSync('app').filter((f) => f.endsWith('.html')).map((f) => `app/${f}`));
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    assert.ok(!/font-family:\s*"?Helvetica/.test(html), `${page}: typed-out body font; use var(--body)`);
    assert.ok(!html.includes('"Rustnuts Stencil"'), `${page}: old font-face name`);
  }
});
