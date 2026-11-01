// Writes sitemap.xml from the pages in this repo: every .html at the root that does not ask
// search engines to stay away (a <meta name="robots" content="noindex…">), dated by its last
// commit. The app/ pages stay out until the app launches (test/app-pages.test.js). Run `npm run build:sitemap` after adding or changing a page;
// test/sitemap.test.js fails when the committed sitemap is behind.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SITE = 'https://www.rustnutssmc.com.au/';

const SETTINGS = {
  'index.html': { changefreq: 'weekly', priority: '1.0' },
  'charity.html': { changefreq: 'weekly', priority: '0.7' },
  'shop.html': { changefreq: 'monthly', priority: '0.6' },
  'resources.html': { changefreq: 'monthly', priority: '0.6' },
  'constitution.html': { changefreq: 'monthly', priority: '0.6' },
};
const DEFAULT = { changefreq: 'monthly', priority: '0.5' };

const htmlIn = (root, dir) => readdirSync(new URL(dir, root)).filter((f) => f.endsWith('.html')).map((f) => `${dir}${f}`);
const noindex = (root, page) => /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(readFileSync(new URL(page, root), 'utf8'));

/** Public pages, home first, then the rest by path. */
export function publicPages(root) {
  const all = htmlIn(root, '').filter((p) => !noindex(root, p));
  return ['index.html', ...all.filter((p) => p !== 'index.html').sort()];
}

/** YYYY-MM-DD of the page's last commit (today when it is not committed yet). */
export function lastChanged(root, page) {
  const cwd = fileURLToPath(root);
  const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', page], { cwd, encoding: 'utf8' }).trim();
  return out || new Date().toISOString().slice(0, 10);
}

export function sitemapXml(root) {
  const urls = publicPages(root).map((page) => {
    const s = SETTINGS[page] ?? DEFAULT;
    const loc = page === 'index.html' ? SITE : SITE + page;
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastChanged(root, page)}</lastmod>\n    <changefreq>${s.changefreq}</changefreq>\n    <priority>${s.priority}</priority>\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = new URL('..', import.meta.url);
  writeFileSync(new URL('sitemap.xml', root), sitemapXml(root));
  console.log(`Wrote sitemap.xml with ${publicPages(root).length} pages`);
}
