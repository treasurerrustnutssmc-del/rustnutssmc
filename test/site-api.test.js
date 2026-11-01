import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, WORDS, enquiryProblem, loadSponsors, sendEnquiry, sponsorsHtml } from '../app/site-api.js';

const ok = { name: 'Sam Rider', email: 'sam@example.com', chapter: 'west', about: '' };

test('the form checks in the app order, with the app words', () => {
  assert.equal(enquiryProblem(ok), null);
  assert.equal(enquiryProblem({ ...ok, name: ' ' }), WORDS.noName);
  assert.equal(enquiryProblem({ ...ok, name: 'x'.repeat(81) }), WORDS.longName);
  assert.equal(enquiryProblem({ ...ok, email: 'sam@example' }), WORDS.badEmail);
  assert.equal(enquiryProblem({ ...ok, chapter: 'south' }), WORDS.noChapter);
  assert.equal(enquiryProblem({ ...ok, about: 'x'.repeat(601) }), WORDS.longAbout);
  assert.deepEqual(CHAPTERS, ['west', 'north', 'either']);
});

test('sending posts the trimmed form with the honeypot and reads the answer', async () => {
  const calls = [];
  const fetchOk = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ ok: true }) }; };
  assert.deepEqual(await sendEnquiry({ ...ok, name: ' Sam Rider ', about: ' Street Glide ' }, fetchOk), { ok: true });
  assert.ok(calls[0].url.endsWith('/site-api/enquiry'));
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: 'Sam Rider', email: 'sam@example.com', chapter: 'west', about: 'Street Glide', website: '' });
  const busy = async () => ({ ok: false, status: 429, json: async () => ({ error: 'Too many enquiries just now. Try again later, or email the club.' }) });
  assert.deepEqual(await sendEnquiry(ok, busy), { ok: false, error: 'Too many enquiries just now. Try again later, or email the club.' });
  const down = async () => { throw new Error('offline'); };
  assert.deepEqual(await sendEnquiry(ok, down), { ok: false, error: WORDS.offline });
  const bad = await sendEnquiry({ ...ok, email: 'nope' }, async () => { throw new Error('should not be called'); });
  assert.deepEqual(bad, { ok: false, error: WORDS.badEmail });
});

test('sponsor cards escape text, drop unsafe links and keep the strip empty when there is nothing', () => {
  assert.equal(sponsorsHtml([]), '');
  assert.equal(sponsorsHtml(undefined), '');
  const html = sponsorsHtml([
    { id: '1', name: 'Dead Set <Safety>', blurb: 'Hi-vis & gear', url: 'https://deadset.example', logo: 'https://x.supabase.co/signed/a.png' },
    { id: '2', name: 'SVEA', blurb: null, url: 'javascript:alert(1)', logo: null },
  ]);
  assert.ok(html.includes('Dead Set &lt;Safety&gt;'));
  assert.ok(html.includes('Hi-vis &amp; gear'));
  assert.ok(html.includes('href="https://deadset.example"'));
  assert.ok(html.includes('rel="noopener sponsored"'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('<div class="sponsor"><h3>SVEA</h3></div>'));
});

test('loading sponsors never throws', async () => {
  assert.deepEqual(await loadSponsors(async () => ({ ok: true, json: async () => ({ sponsors: [{ id: '1', name: 'X' }] }) })), [{ id: '1', name: 'X' }]);
  assert.deepEqual(await loadSponsors(async () => ({ ok: false })), []);
  assert.deepEqual(await loadSponsors(async () => { throw new Error('offline'); }), []);
});

test('an app ride becomes the calendar event shape the home page already understands', async () => {
  const { RIDE_LABELS, rideToEvent, loadRides, melbourneDate } = await import('../app/site-api.js');
  assert.deepEqual(Object.keys(RIDE_LABELS), ['north', 'west', 'club', 'supported', 'non_nuts']);
  const timed = rideToEvent({
    id: 'r1', title: 'West Sunday Run', starts_at: '2026-11-08T22:00:00+00:00', ends_at: '2026-11-09T02:00:00+00:00',
    all_day: false, category: 'west', location: 'Bacchus Marsh', notes: 'Meet 9am\nLabel: North', cancelled_at: null,
  });
  assert.deepEqual(timed, {
    id: 'r1',
    summary: 'West Sunday Run',
    start: { dateTime: '2026-11-08T22:00:00+00:00' },
    end: { dateTime: '2026-11-09T02:00:00+00:00' },
    description: 'Label: West\nWhere: Bacchus Marsh\nMeet 9am',
    cancelled: false,
  });
  // An all-day ride is stored as Melbourne midnight, which comes back in UTC the evening before.
  assert.equal(melbourneDate('2026-12-04T13:00:00+00:00'), '2026-12-05');
  assert.equal(melbourneDate('2026-07-04T14:00:00+00:00'), '2026-07-05');
  assert.equal(melbourneDate('nope'), null);
  const allDay = rideToEvent({ id: 'r2', title: 'Not Dead Yet Run', starts_at: '2026-12-04T13:00:00+00:00', ends_at: '2026-12-05T13:00:00+00:00', all_day: true, category: 'club', location: null, notes: null, cancelled_at: '2026-11-01T00:00:00+00:00' });
  assert.equal(allDay.summary, 'CANCELLED: Not Dead Yet Run');
  assert.deepEqual(allDay.start, { date: '2026-12-05' });
  assert.deepEqual(allDay.end, { date: '2026-12-06' });
  assert.equal(allDay.description, 'Label: Rustnuts');
  assert.equal(allDay.cancelled, true);
  assert.equal(rideToEvent({ id: 'x', title: 'Odd', starts_at: '2026-12-05T13:00:00+00:00', category: 'mystery' }), null);
  assert.equal(rideToEvent(null), null);

  const okFetch = async (url) => { assert.ok(url.endsWith('/site-api/rides')); return { ok: true, json: async () => ({ rides: [{ id: 'r3', title: 'North Pub Run', starts_at: '2026-11-15T00:00:00+00:00', ends_at: null, all_day: false, category: 'north', location: null, notes: null, cancelled_at: null }, { id: 'bad' }] }) }; };
  const events = await loadRides(okFetch);
  assert.equal(events.length, 1);
  assert.equal(events[0].description, 'Label: North');
  assert.deepEqual(await loadRides(async () => ({ ok: false, json: async () => ({}) })), []);
  assert.deepEqual(await loadRides(async () => { throw new Error('offline'); }), []);
});

// ---------------------------------------------------------------------------
// Charity ride sign-ups (charity.html)
// ---------------------------------------------------------------------------
import { SIGNUP_WORDS, charityRideHtml, charitySignupProblem, loadCharityRides, sendCharitySignup, signupFromForm } from '../app/site-api.js';

const ride = {
  ride_id: '2d1f1d2e-9f4a-4c1a-8f2b-0c1d2e3f4a5b', title: 'Toy Run', starts_at: '2027-12-05T00:00:00+00:00', all_day: false,
  location: 'Hoppers Crossing', cause: 'Royal Children’s Hospital', about: 'Bring a <toy>', closes_on: '2027-12-03',
  jobs: ['BBQ', 'Marshal'], places: 60, places_left: 12, open: true,
};
const form = { ride: ride.ride_id, name: 'Sam Rider', email: 'sam@example.com', phone: '', riding: true, pillion: false, guests: 0, guestNames: '', job: '', notes: '' };

test('the sign-up form checks in the app order, with the app words', () => {
  assert.equal(charitySignupProblem(form, ride.jobs), null);
  assert.equal(charitySignupProblem({ ...form, ride: 'nope' }, ride.jobs), SIGNUP_WORDS.notOnWebsite);
  assert.equal(charitySignupProblem({ ...form, name: ' ' }, ride.jobs), SIGNUP_WORDS.noName);
  assert.equal(charitySignupProblem({ ...form, name: 'x'.repeat(81) }, ride.jobs), SIGNUP_WORDS.longName);
  assert.equal(charitySignupProblem({ ...form, email: 'sam@example' }, ride.jobs), SIGNUP_WORDS.badEmail);
  assert.equal(charitySignupProblem({ ...form, phone: '0'.repeat(31) }, ride.jobs), SIGNUP_WORDS.longPhone);
  assert.equal(charitySignupProblem({ ...form, riding: false }, ride.jobs), SIGNUP_WORDS.nothingPicked);
  assert.equal(charitySignupProblem({ ...form, riding: false, pillion: true, job: 'BBQ' }, ride.jobs), SIGNUP_WORDS.pillionNeedsRider);
  assert.equal(charitySignupProblem({ ...form, guests: 11 }, ride.jobs), SIGNUP_WORDS.guests);
  assert.equal(charitySignupProblem({ ...form, guests: 1.5 }, ride.jobs), SIGNUP_WORDS.guests);
  assert.equal(charitySignupProblem({ ...form, job: 'Cook' }, ride.jobs), SIGNUP_WORDS.jobNotListed);
  assert.equal(charitySignupProblem({ ...form, notes: 'x'.repeat(201) }, ride.jobs), SIGNUP_WORDS.tooLong);
  assert.equal(charitySignupProblem({ ...form, riding: false, job: 'BBQ' }, ride.jobs), null);
});

test('a form element becomes the form the function expects', () => {
  const data = new Map([['ride', ride.ride_id], ['name', ' Sam '], ['email', 'SAM@example.com'], ['phone', '0400 000 000'],
    ['riding', 'on'], ['pillion', null], ['guests', '2'], ['guestNames', 'Kim, Lee'], ['job', 'BBQ'], ['notes', ''], ['website', '']]);
  assert.deepEqual(signupFromForm(data), {
    ride: ride.ride_id, name: ' Sam ', email: 'SAM@example.com', phone: '0400 000 000', riding: true, pillion: false, guests: 2,
    guestNames: 'Kim, Lee', job: 'BBQ', notes: '', website: '',
  });
  assert.equal(signupFromForm(new Map([['guests', 'two']])).guests, Number.NaN);
  assert.equal(signupFromForm(new Map([['guests', '']])).guests, 0, 'a full ride leaves guests out: none');
  assert.equal(signupFromForm(new Map()).guests, 0);
});

test('sending posts the trimmed sign-up with the honeypot and reads the answer', async () => {
  const calls = [];
  const fetchOk = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ ok: true }) }; };
  assert.deepEqual(await sendCharitySignup({ ...form, name: ' Sam Rider ', guests: 1, guestNames: ' Kim ', job: 'BBQ', website: '' }, ride.jobs, fetchOk), { ok: true });
  assert.ok(calls[0].url.endsWith('/site-api/charity-signup'));
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    ride: ride.ride_id, name: 'Sam Rider', email: 'sam@example.com', phone: '', riding: true, pillion: false, guests: 1, guestNames: 'Kim', job: 'BBQ', notes: '', website: '',
  });
  const full = async () => ({ ok: false, status: 400, json: async () => ({ error: SIGNUP_WORDS.full }) });
  assert.deepEqual(await sendCharitySignup(form, ride.jobs, full), { ok: false, error: SIGNUP_WORDS.full });
  const down = async () => { throw new Error('offline'); };
  assert.deepEqual(await sendCharitySignup(form, ride.jobs, down), { ok: false, error: SIGNUP_WORDS.offline });
  const bad = await sendCharitySignup({ ...form, email: 'nope' }, ride.jobs, async () => { throw new Error('should not be called'); });
  assert.deepEqual(bad, { ok: false, error: SIGNUP_WORDS.badEmail });
});

test('a ride card escapes text, shows the day in DD/MM/YYYY, and a closed or full ride gets no form', () => {
  const html = charityRideHtml(ride);
  assert.ok(html.includes('Bring a &lt;toy&gt;'));
  assert.ok(html.includes('Royal Children’s Hospital'));
  assert.ok(html.includes('05/12/2027'));
  assert.ok(html.includes('Hoppers Crossing'));
  assert.ok(html.includes('12 places left'));
  assert.ok(html.includes('Closes 03/12/2027'));
  assert.ok(html.includes('<form'));
  assert.ok(html.includes(`value="${ride.ride_id}"`));
  assert.ok(html.includes('<option value="BBQ">BBQ</option>'));
  assert.ok(!html.includes('<script'));
  const closed = charityRideHtml({ ...ride, open: false });
  assert.ok(!closed.includes('<form'));
  assert.ok(closed.includes(SIGNUP_WORDS.closed));
  const full = charityRideHtml({ ...ride, places_left: 0 });
  assert.ok(full.includes('<form'), 'a full ride still takes helpers');
  assert.ok(full.includes('Full'));
  const noJobsFull = charityRideHtml({ ...ride, places_left: 0, jobs: [] });
  assert.ok(!noJobsFull.includes('<form'));
  assert.ok(noJobsFull.includes(SIGNUP_WORDS.full));
  const noLimit = charityRideHtml({ ...ride, places: null, places_left: null, jobs: [], location: null, about: null, closes_on: null });
  assert.ok(noLimit.includes('<form'));
  assert.ok(!noLimit.includes('places left'));
  assert.ok(!noLimit.includes('<select'));
  assert.equal(charityRideHtml(null), '');
  assert.ok(charityRideHtml({ ...ride, starts_at: 'not a date' }).includes('<form'), 'a bad date never blanks the page');
});

test('loading charity rides never throws and keeps only well-formed rides', async () => {
  assert.deepEqual(await loadCharityRides(async () => { throw new Error('offline'); }), []);
  assert.deepEqual(await loadCharityRides(async () => ({ ok: false })), []);
  const good = async () => ({ ok: true, json: async () => ({ rides: [ride, { nope: true }, null] }) });
  assert.deepEqual(await loadCharityRides(good), [ride]);
});
