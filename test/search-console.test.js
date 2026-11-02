import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Google Play asks the club's organisation account to prove it owns this website. The treasurer
// Google account (treasurer.rustnutssmc@gmail.com) verified it in Search Console with this home
// page tag on 2 Nov 2026. Removing the tag un-verifies the club's Play account, so it stays for good.
// Other verification tags (for example Chris's own Search Console) can sit beside it.
const CLUB_TOKEN = 'DVFApd8NRBnaIIrKkoTkRhVFHJYR7G4CWoaJGSLJ5nY';
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const head = home.slice(0, home.indexOf('</head>'));

test("the home page keeps the club treasurer's Search Console tag in its head", () => {
  assert.ok(head.length > 0, 'index.html has a </head>');
  assert.match(head, new RegExp(`<meta name="google-site-verification" content="${CLUB_TOKEN}" />`));
});
