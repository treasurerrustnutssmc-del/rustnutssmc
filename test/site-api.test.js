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
  const { RIDE_LABELS, rideToEvent, loadRides } = await import('../app/site-api.js');
  assert.deepEqual(Object.keys(RIDE_LABELS), ['north', 'west', 'club', 'supported', 'non_nuts']);
  const timed = rideToEvent({
    id: 'r1', title: 'West Sunday Run', starts_at: '2026-11-08T22:00:00+00:00', ends_at: '2026-11-09T02:00:00+00:00',
    all_day: false, category: 'west', location: 'Bacchus Marsh', notes: 'Meet 9am', cancelled_at: null,
  });
  assert.deepEqual(timed, {
    id: 'r1',
    summary: 'West Sunday Run',
    start: { dateTime: '2026-11-08T22:00:00+00:00' },
    end: { dateTime: '2026-11-09T02:00:00+00:00' },
    description: 'Where: Bacchus Marsh\nMeet 9am\nLabel: West',
    cancelled: false,
  });
  const allDay = rideToEvent({ id: 'r2', title: 'Not Dead Yet Run', starts_at: '2026-12-05T13:00:00+00:00', ends_at: null, all_day: true, category: 'club', location: null, notes: null, cancelled_at: '2026-11-01T00:00:00+00:00' });
  assert.equal(allDay.summary, 'CANCELLED: Not Dead Yet Run');
  assert.deepEqual(allDay.start, { date: '2026-12-05' });
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
