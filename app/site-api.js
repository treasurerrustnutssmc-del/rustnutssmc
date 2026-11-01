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

// The ride list. The app reads the club's Google calendars every quarter hour (its sync-rides
// function) and this feed is its copy, so the website shows what the app shows: the same rides,
// the app's cancellations, and later rides made in the app. Each ride is mapped to the shape the
// home page's calendar code has always used for a Google Calendar event (summary, start, end,
// description with a "Label: West" tag), so the colours, labels and chapter lists work unchanged.
export const RIDE_LABELS = {
  north: 'North',
  west: 'West',
  club: 'Rustnuts',
  supported: 'Supported Club Rides',
  non_nuts: 'Non-Nuts Events',
};

const MELBOURNE_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' });
/** The Melbourne calendar date (YYYY-MM-DD) of an instant: the app stores an all-day ride as
 *  Melbourne midnight, which the feed returns in UTC, the evening before. */
export function melbourneDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : MELBOURNE_DATE.format(d);
}
const LABEL_TAG = /label\s*:\s*[^\n\r<]+/gi;

/** One app ride as a calendar event, or null when it is not a ride the page can show. */
export function rideToEvent(ride) {
  if (!ride || typeof ride !== 'object' || typeof ride.starts_at !== 'string' || typeof ride.title !== 'string') return null;
  const label = RIDE_LABELS[ride.category];
  if (!label) return null;
  const allDay = ride.all_day === true;
  const when = (iso) => (allDay ? { date: melbourneDate(iso) } : { dateTime: iso });
  const start = when(ride.starts_at);
  if (allDay && !start.date) return null;
  const summary = ride.cancelled_at ? `CANCELLED: ${ride.title}` : ride.title;
  // The app's category is the one label the page reads (it takes the first "Label:" tag), so it
  // goes first and any tag typed into the calendar notes is dropped rather than shown twice.
  const lines = [`Label: ${label}`];
  if (ride.location) lines.push(`Where: ${ride.location}`);
  const notes = ride.notes ? String(ride.notes).replace(LABEL_TAG, '').trim() : '';
  if (notes) lines.push(notes);
  return {
    id: ride.id,
    summary,
    start,
    end: ride.ends_at ? when(ride.ends_at) : start,
    description: lines.join('\n'),
    cancelled: Boolean(ride.cancelled_at),
  };
}

/** Loads the app's public rides as calendar events; resolves to [] on any failure, so the page
 *  falls back to the calendar worker. */
export async function loadRides(fetchFn = fetch) {
  try {
    const r = await fetchFn(`${SITE_API}/rides`);
    if (!r.ok) return [];
    const body = await r.json();
    if (!Array.isArray(body.rides)) return [];
    return body.rides.map(rideToEvent).filter(Boolean);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Charity ride sign-ups (charity.html): the rides whose organiser ticked "Take sign-ups from the
// website" in the app, and a sign-up form under each that posts into the app's sign-up sheet.
// ---------------------------------------------------------------------------

// The same words and order as the app's src/domain/websiteSignups.ts and the function.
export const SIGNUP_WORDS = {
  notOnWebsite: 'This ride isn’t taking sign-ups from the website.',
  closed: 'Sign-ups have closed.',
  noName: 'Tell us your name.',
  longName: 'Keep your name to 80 characters.',
  badEmail: 'That email address does not look right.',
  longPhone: 'Keep the phone number to 30 characters.',
  nothingPicked: 'Say you’re riding, or pick a job to help with.',
  pillionNeedsRider: 'A pillion needs a rider: say you’re riding too.',
  guests: 'Guests: 0 to 10.',
  jobNotListed: 'That job isn’t on the list.',
  tooLong: 'Keep it short: 200 characters for guests’ names, 200 for notes.',
  tooMany: 'Too many sign-ups just now. Try again later, or email the club.',
  full: 'The ride’s full.',
  offline: 'Could not reach the club just now. Try again in a minute, or email rustnutssmc@outlook.com.',
  thanks: 'You’re on the list. The organisers have your details; sign up again with the same email to change your answer.',
  none: 'No charity rides are taking sign-ups just now. Keep an eye on the calendar.',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_GUESTS = 10;

/** Why this sign-up can't be sent, or null when it can; `jobs` is the ride's helper-job list. */
export function charitySignupProblem(input, jobs) {
  if (!UUID.test(String(input.ride ?? ''))) return SIGNUP_WORDS.notOnWebsite;
  const name = String(input.name ?? '').trim();
  if (!name) return SIGNUP_WORDS.noName;
  if (name.length > 80) return SIGNUP_WORDS.longName;
  const email = String(input.email ?? '').trim();
  if (email.length > 200 || !EMAIL.test(email)) return SIGNUP_WORDS.badEmail;
  if (String(input.phone ?? '').trim().length > 30) return SIGNUP_WORDS.longPhone;
  const riding = input.riding === true;
  const job = String(input.job ?? '').trim();
  if (!riding && !job) return SIGNUP_WORDS.nothingPicked;
  if (!riding && input.pillion === true) return SIGNUP_WORDS.pillionNeedsRider;
  if (!Number.isInteger(input.guests) || input.guests < 0 || input.guests > MAX_GUESTS) return SIGNUP_WORDS.guests;
  if (job && !(Array.isArray(jobs) && jobs.includes(job))) return SIGNUP_WORDS.jobNotListed;
  if (String(input.guestNames ?? '').trim().length > 200 || String(input.notes ?? '').trim().length > 200) return SIGNUP_WORDS.tooLong;
  return null;
}

/** The fields of one sign-up form (a FormData, or anything with .get) as the input above. */
export function signupFromForm(data) {
  const text = (k) => String(data.get(k) ?? '');
  // A blank field (or one a full ride leaves out) is no guests.
  const guestsTyped = text('guests').trim() || '0';
  return {
    ride: text('ride'), name: text('name'), email: text('email'), phone: text('phone'),
    riding: data.get('riding') != null, pillion: data.get('pillion') != null,
    guests: /^\d+$/.test(guestsTyped) ? Number(guestsTyped) : Number.NaN,
    guestNames: text('guestNames'), job: text('job'), notes: text('notes'), website: text('website'),
  };
}

/** Sends the sign-up; resolves to { ok: true } or { ok: false, error }. Never throws. */
export async function sendCharitySignup(input, jobs, fetchFn = fetch) {
  const problem = charitySignupProblem(input, jobs);
  if (problem) return { ok: false, error: problem };
  const riding = input.riding === true;
  try {
    const r = await fetchFn(`${SITE_API}/charity-signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ride: String(input.ride),
        name: String(input.name).trim(),
        email: String(input.email).trim().toLowerCase(),
        phone: String(input.phone ?? '').trim(),
        riding,
        pillion: riding && input.pillion === true,
        guests: input.guests,
        guestNames: String(input.guestNames ?? '').trim(),
        job: String(input.job ?? '').trim(),
        notes: String(input.notes ?? '').trim(),
        website: String(input.website ?? ''),
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true };
    return { ok: false, error: typeof body.error === 'string' && body.error ? body.error : SIGNUP_WORDS.offline };
  } catch {
    return { ok: false, error: SIGNUP_WORDS.offline };
  }
}

const MELBOURNE_AU = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', day: '2-digit', month: '2-digit', year: 'numeric' });
const MELBOURNE_TIME = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', hour: 'numeric', minute: '2-digit' });
/** 2027-12-05 or an instant as DD/MM/YYYY (Melbourne). */
export function auDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : MELBOURNE_AU.format(d);
}

const isRide = (r) => r && typeof r === 'object' && UUID.test(String(r.ride_id)) && typeof r.title === 'string' && typeof r.starts_at === 'string' && typeof r.cause === 'string';

/** One charity ride as a card with its sign-up form, or '' when it isn't a ride the page can show. */
export function charityRideHtml(r) {
  if (!isRide(r)) return '';
  const jobs = Array.isArray(r.jobs) ? r.jobs.filter((j) => typeof j === 'string' && j.trim()) : [];
  const id = String(r.ride_id);
  const start = new Date(r.starts_at);
  const when = Number.isNaN(start.getTime()) ? '' : `${auDate(r.starts_at)}${r.all_day ? '' : ` · ${MELBOURNE_TIME.format(start)}`}`;
  const left = typeof r.places_left === 'number' ? r.places_left : null;
  const full = left !== null && left <= 0;
  const open = r.open === true;
  const chips = [
    open && r.closes_on ? `<span class="chip chip-warn">Closes ${esc(auDate(r.closes_on))}</span>` : '',
    !open ? '<span class="chip">Closed</span>' : '',
    left !== null && open ? `<span class="chip ${full ? 'chip-warn' : ''}">${full ? 'Full' : `${left} place${left === 1 ? '' : 's'} left`}</span>` : '',
  ].join('');
  // Closed: no form. Full with jobs: helpers only. Full without jobs: nothing to sign up for.
  let body;
  if (!open) body = `<p class="charity-note">${esc(SIGNUP_WORDS.closed)}</p>`;
  else if (full && jobs.length === 0) body = `<p class="charity-note">${esc(SIGNUP_WORDS.full)}</p>`;
  else body = signupFormHtml(id, jobs, full);
  return `<article class="charity-ride" id="ride-${esc(id)}">
  <div class="charity-head">
    <p class="eyebrow">${esc(when)}${r.location ? ` · ${esc(r.location)}` : ''}</p>
    <h2 class="display">${esc(r.title)}</h2>
    <p class="charity-cause">Raising money for <strong>${esc(r.cause)}</strong></p>
    <div class="chips">${chips}</div>
  </div>
  ${r.about ? `<p class="charity-about">${esc(r.about)}</p>` : ''}
  ${body}
</article>`;
}

function signupFormHtml(id, jobs, full) {
  const jobOptions = jobs.map((j) => `<option value="${esc(j)}">${esc(j)}</option>`).join('');
  return `<form class="enquiry charity-form" data-ride="${esc(id)}" data-jobs="${esc(JSON.stringify(jobs))}" novalidate>
    <input type="hidden" name="ride" value="${esc(id)}">
    ${full ? `<p class="charity-note">${esc(SIGNUP_WORDS.full)} Helpers are still welcome.</p>` : ''}
    <div class="enquiry-row">
      <label>Your name<input type="text" name="name" autocomplete="name" maxlength="80" required></label>
      <label>Email<input type="email" name="email" autocomplete="email" maxlength="200" required></label>
    </div>
    <label>Phone <span class="optional">(optional)</span><input type="tel" name="phone" autocomplete="tel" maxlength="30"></label>
    <fieldset class="enquiry-chapter charity-ride-opts">
      <legend>On the day</legend>
      <label><input type="checkbox" name="riding" ${full ? '' : 'checked'} ${full ? 'disabled' : ''}> I’m riding</label>
      <label><input type="checkbox" name="pillion" ${full ? 'disabled' : ''}> Bringing a pillion</label>
    </fieldset>
    <div class="enquiry-row">
      <label>Guests on bikes <span class="optional">(0 to ${MAX_GUESTS})</span><input type="number" name="guests" inputmode="numeric" min="0" max="${MAX_GUESTS}" value="0" ${full ? 'disabled' : ''}></label>
      <label>Guests’ names <span class="optional">(optional)</span><input type="text" name="guestNames" maxlength="200" ${full ? 'disabled' : ''}></label>
    </div>
    ${jobs.length > 0 ? `<label>Helping with <span class="optional">(optional)</span><select name="job"><option value="">Not helping</option>${jobOptions}</select></label>` : ''}
    <label>Notes <span class="optional">(optional)</span><textarea name="notes" rows="2" maxlength="200" placeholder="Arriving late, bringing the trailer"></textarea></label>
    <!-- Not for people: left empty by everyone but robots -->
    <label class="enquiry-hp" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
    <p class="enquiry-msg" role="status" aria-live="polite"></p>
    <button type="submit" class="btn btn-primary">Sign Up</button>
  </form>`;
}

/** Loads the charity rides taking website sign-ups; resolves to [] on any failure. */
export async function loadCharityRides(fetchFn = fetch) {
  try {
    const r = await fetchFn(`${SITE_API}/charity-rides`);
    if (!r.ok) return [];
    const body = await r.json();
    return Array.isArray(body.rides) ? body.rides.filter(isRide) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Club documents: the Constitution from the app's document library
// ---------------------------------------------------------------------------

export const DOCUMENT_WORDS = {
  offline: 'The club app can’t be reached just now, so here is the Constitution as a PDF.',
  publishedPrefix: 'Published',
  approvedPrefix: 'Approved by',
  commencesPrefix: 'in force from',
};

/** The approving bodies, in the app's words. */
export const APPROVING_BODIES = {
  association_general_meeting: 'Association general meeting',
  association_committee: 'Association Committee',
  full_members: 'Full Members’ vote',
  nec: 'NEC',
  chapter_board: 'Chapter Board',
};

/**
 * The library's text format, as the app reads it (rulesBlocks in the app repo): a line starting
 * "# " is a heading, "- " a bullet, a blank line ends a paragraph, other lines join a paragraph.
 */
export function documentBlocks(body) {
  const blocks = [];
  let para = [];
  const push = (kind, text) => { if (text !== '') blocks.push({ kind, text }); };
  const endPara = () => { push('para', para.join(' ')); para = []; };
  for (const raw of String(body ?? '').split(/\r\n|\r|\n/)) {
    const line = raw.trimEnd();
    const marker = line === '#' || line.startsWith('# ') ? 'heading' : line === '-' || line.startsWith('- ') ? 'bullet' : null;
    if (marker) {
      endPara();
      push(marker, line.slice(1).trim());
    } else if (line === '') {
      endPara();
    } else {
      para.push(line.trim());
    }
  }
  endPara();
  return blocks;
}

/** The line under the heading: label, publication date and the approval facts when recorded. */
export function documentMetaLine(doc) {
  const parts = [];
  if (doc.label) parts.push(doc.label);
  const date = (v) => (v ? auDate(v) : '');
  const published = date(doc.published_at);
  if (published) parts.push(`${DOCUMENT_WORDS.publishedPrefix} ${published}`);
  const body = APPROVING_BODIES[doc.approving_body];
  const approved = date(doc.approved_on);
  const commences = date(doc.commences_on);
  if (body && approved) parts.push(`${DOCUMENT_WORDS.approvedPrefix} ${body} ${approved}${commences ? `, ${DOCUMENT_WORDS.commencesPrefix} ${commences}` : ''}`);
  return parts.join(' · ');
}

/** The document's text as HTML: headings with anchors, bullets grouped into lists, paragraphs. Takes the text or its blocks. */
export function documentHtml(body) {
  const out = [];
  let list = [];
  let headings = 0;
  const endList = () => { if (list.length) { out.push(`<ul>${list.join('')}</ul>`); list = []; } };
  for (const b of Array.isArray(body) ? body : documentBlocks(body)) {
    if (b.kind === 'bullet') { list.push(`<li>${esc(b.text)}</li>`); continue; }
    endList();
    if (b.kind === 'heading') out.push(`<h2 id="s${++headings}">${esc(b.text)}</h2>`);
    else out.push(`<p>${esc(b.text)}</p>`);
  }
  endList();
  return out.join('\n');
}

/** The Contents list: one link per heading, in order. Takes the text or its blocks. */
export function documentContentsHtml(body) {
  const items = (Array.isArray(body) ? body : documentBlocks(body)).filter((b) => b.kind === 'heading').map((b, i) => `<li><a href="#s${i + 1}">${esc(b.text)}</a></li>`);
  return items.length ? `<ol>${items.join('')}</ol>` : '';
}

const isDocument = (d) => d && typeof d === 'object' && typeof d.kind === 'string' && typeof d.title === 'string' && typeof d.label === 'string' && typeof d.body === 'string' && d.body.trim() !== '';

/** Loads the club documents from the app; resolves to [] on any failure (the page then offers the PDF). */
export async function loadDocuments(fetchFn = fetch) {
  try {
    const r = await fetchFn(`${SITE_API}/documents`);
    if (!r.ok) return [];
    const body = await r.json();
    return Array.isArray(body.documents) ? body.documents.filter(isDocument) : [];
  } catch {
    return [];
  }
}

// Club news. The board writes a short notice on the app's Board screen and the feed gives the
// newest five that are less than 60 days old, with nothing personal (id, title, body, link, date).
// The home page's "Club news" strip stays hidden until there's something to show.
const isNews = (n) => n && typeof n === 'object' && typeof n.title === 'string' && n.title.trim() !== ''
  && typeof n.body === 'string' && n.body.trim() !== '' && typeof n.created_at === 'string';
const httpsHref = (u) => (/^https:\/\/\S+$/.test(String(u ?? '')) ? String(u) : null);

/** The notice cards as HTML, or '' when there's nothing to show. */
export function newsHtml(list) {
  if (!Array.isArray(list)) return '';
  const items = list.filter(isNews);
  if (items.length === 0) return '';
  return items.map((n) => {
    const href = httpsHref(n.link);
    return `<article class="news-item">`
      + `<time datetime="${esc(n.created_at)}">${esc(auDate(n.created_at))}</time>`
      + `<h3>${esc(n.title)}</h3>`
      + `<p>${esc(n.body)}</p>`
      + (href ? `<a class="news-more" href="${esc(href)}" target="_blank" rel="noopener">More</a>` : '')
      + `</article>`;
  }).join('');
}

/** Loads the news; resolves to [] on any failure so the strip just stays hidden. */
export async function loadNews(fetchFn = fetch) {
  try {
    const r = await fetchFn(`${SITE_API}/news`);
    if (!r.ok) return [];
    const body = await r.json();
    return Array.isArray(body.news) ? body.news.filter(isNews) : [];
  } catch {
    return [];
  }
}
