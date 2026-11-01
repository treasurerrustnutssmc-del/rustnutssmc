// The website's side of the app's site-api door (the app repo's supabase/functions/site-api):
// the sponsors strip on the home page and the Ride With Us join form. Pure functions, so
// `npm test` checks them; index.html wires them to the page.

export const SITE_API = 'https://mfhbvsybudneimgbfjpy.supabase.co/functions/v1/site-api';
export const CHAPTERS = ['west', 'north', 'either'];

// The same words and order as the app and the function, so what the form says before sending
// matches what comes back if something slips past.
export const WORDS = {
  noName: 'Tell us your name.',
  longName: 'Keep your name to 80 characters.',
  badEmail: 'That email address does not look right.',
  noChapter: 'Pick a chapter: West, North or either.',
  longAbout: 'Keep it to 600 characters.',
  offline: 'Could not reach the club just now. Try again in a minute, or email rustnutssmc@outlook.com.',
  thanks: 'Thanks, your enquiry is with the chapter board. Someone will be in touch.',
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Why this form can't be sent, or null when it can. */
export function enquiryProblem(input) {
  const name = String(input.name ?? '').trim();
  if (!name) return WORDS.noName;
  if (name.length > 80) return WORDS.longName;
  const email = String(input.email ?? '').trim();
  if (email.length > 200 || !EMAIL.test(email)) return WORDS.badEmail;
  if (!CHAPTERS.includes(input.chapter)) return WORDS.noChapter;
  if (String(input.about ?? '').trim().length > 600) return WORDS.longAbout;
  return null;
}

/** Sends the form; resolves to { ok: true } or { ok: false, error }. Never throws. */
export async function sendEnquiry(input, fetchFn = fetch) {
  const problem = enquiryProblem(input);
  if (problem) return { ok: false, error: problem };
  try {
    const r = await fetchFn(`${SITE_API}/enquiry`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: String(input.name).trim(),
        email: String(input.email).trim(),
        chapter: input.chapter,
        about: String(input.about ?? '').trim(),
        website: String(input.website ?? ''),
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true };
    return { ok: false, error: typeof body.error === 'string' && body.error ? body.error : WORDS.offline };
  } catch {
    return { ok: false, error: WORDS.offline };
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeHref = (u) => (/^https?:\/\//i.test(String(u ?? '')) ? String(u) : null);

/** The sponsor cards as HTML, or '' when there's nothing to show. */
export function sponsorsHtml(sponsors) {
  if (!Array.isArray(sponsors) || sponsors.length === 0) return '';
  return sponsors.map((s) => {
    const href = safeHref(s.url);
    const logo = safeHref(s.logo);
    const inner = `${logo ? `<img src="${esc(logo)}" alt="" loading="lazy">` : ''}<h3>${esc(s.name)}</h3>${s.blurb ? `<p>${esc(s.blurb)}</p>` : ''}`;
    return href
      ? `<a class="sponsor" href="${esc(href)}" target="_blank" rel="noopener sponsored">${inner}</a>`
      : `<div class="sponsor">${inner}</div>`;
  }).join('');
}

/** Loads the sponsors; resolves to [] on any failure so the strip just stays hidden. */
export async function loadSponsors(fetchFn = fetch) {
  try {
    const r = await fetchFn(`${SITE_API}/sponsors`);
    if (!r.ok) return [];
    const body = await r.json();
    return Array.isArray(body.sponsors) ? body.sponsors : [];
  } catch {
    return [];
  }
}
