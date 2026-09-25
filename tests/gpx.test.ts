import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { GpxError, parseGpx, parsePoints } from '../src/lib/gpx.ts';
import { prepare, InvalidSubmission } from '../src/server/submission.ts';
import { leaderboard, categoryLabel, type PublicRound } from '../src/lib/rounds.ts';
import { LONG_WIGGLE, SHORT_WIGGLE, roundTrack, toGpx } from './make-gpx.ts';

const passing = toGpx(roundTrack(LONG_WIGGLE, true));
/** A round that cuts over Ralfland Fell and skips Mosedale. It no longer counts. */
const skipsMosedale = toGpx(roundTrack(SHORT_WIGGLE));

test('a full round passes every check', () => {
  const r = parseGpx(passing, 'long');
  assert.equal(r.passed, true, JSON.stringify(r.checks));
  assert.ok(r.km >= 21, `km ${r.km}`);
  assert.equal(r.elapsedSecs, 4 * 3600);
  assert.equal(r.startDate, '2026-09-12');
});

test('a short walk fails west, south and distance', () => {
  const pts = roundTrack().filter((p) => p.lon > -2.71 && p.lat > 54.505);
  const r = parseGpx(toGpx(pts), 'long');
  const failed = r.checks.filter((c) => !c.pass).map((c) => c.id).sort();
  assert.deepEqual(failed, ['distance', 'mosedale', 'south', 'west']);
});

test('a loop started elsewhere fails start and finish', () => {
  const pts = roundTrack();
  const shifted = [...pts.slice(400), ...pts.slice(0, 400)];
  const r = parseGpx(toGpx(shifted), 'long');
  assert.equal(r.checks.find((c) => c.id === 'start')!.pass, false);
  assert.equal(r.checks.find((c) => c.id === 'finish')!.pass, false);
});

test('handles self-closing points, single quotes, namespaces and route points', () => {
  const ten = (f: (i: number) => string) => Array.from({ length: 10 }, (_, i) => f(i)).join('');
  const rte = `<gpx><rte>${ten((i) => `<rtept lon='-2.68' lat='54.5${i}'/>`)}</rte></gpx>`;
  assert.equal(parsePoints(rte).length, 10);
  const ns = `<gpx><trk><trkseg>${ten((i) => `<gx:trkpt lat="1.${i}" lon="2"></gx:trkpt>`)}</trkseg></trk></gpx>`;
  assert.equal(parsePoints(ns).length, 10);
  const few = `<gpx><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2"/></trkseg></trk></gpx>`;
  assert.throws(() => parsePoints(few), /planned route/);
});

test('rejects non-GPX input', () => {
  assert.throws(() => parseGpx('hello', 'long'), GpxError);
  assert.throws(() => parseGpx('<gpx></gpx>', 'long'), GpxError);
});

test('a round that skips Mosedale over Ralfland Fell fails', () => {
  const r = parseGpx(skipsMosedale, 'long');
  assert.deepEqual(r.checks.filter((c) => !c.pass).map((c) => c.id), ['distance', 'mosedale']);
});

test('the OS Maps route follows the round but is refused as a planned route (no timings)', () => {
  const real = readFileSync(new URL('./fixtures/real-long-round.gpx', import.meta.url), 'utf8');
  const r = parseGpx(real, 'long');
  assert.equal(r.passed, false);
  assert.deepEqual(r.checks.filter((c) => !c.pass).map((c) => c.id), ['recorded'], JSON.stringify(r.checks));
  assert.equal(r.km, 23.7);
  assert.ok(r.startKm < 0.05 && r.finishKm < 0.05);
  assert.equal(r.elapsedSecs, null);
});

function baseForm(): FormData {
  const f = new FormData();
  f.set('name', 'Test Walker');
  f.set('email', 'walker@example.com');
  f.set('round', 'long');
  f.set('mode', 'walk');
  f.set('consent', 'yes');
  f.set('date', '2026-09-12');
  f.set('hours', '4');
  f.set('minutes', '30');
  return f;
}
const now = new Date('2026-09-22T12:00:00Z');

test('server: gzipped GPX is re-checked and marked gpxChecked', async () => {
  const f = baseForm();
  f.set('gpx', new Blob([gzipSync(passing)]), 'round.gpx.gz');
  const { entry } = await prepare(f, '00000000-0000-0000-0000-000000000000', now);
  assert.equal(entry.gpxChecked, true);
  assert.equal(entry.secs, 4.5 * 3600);
  assert.ok(entry.km! >= 15);
});

test('server: time is optional and falls back to the GPX elapsed time', async () => {
  const f = baseForm();
  f.delete('hours');
  f.delete('minutes');
  f.set('gpx', new Blob([passing]), 'round.gpx');
  const { entry } = await prepare(f, 'x', now);
  assert.equal(entry.secs, 4 * 3600);
  const g = baseForm();
  g.delete('hours');
  g.delete('minutes');
  g.set('link', 'https://example.com');
  assert.equal((await prepare(g, 'x', now)).entry.secs, 0);
});

test('server: requires consent and a valid round', async () => {
  const noConsent = baseForm();
  noConsent.delete('consent');
  noConsent.set('link', 'https://example.com');
  await assert.rejects(prepare(noConsent, 'x', now), /tick the box/);
  const badRound = baseForm();
  badRound.set('round', 'toString');
  badRound.set('link', 'https://example.com');
  await assert.rejects(prepare(badRound, 'x', now), /isn’t recognised/);
  const shortRound = baseForm();
  shortRound.set('round', 'short');
  shortRound.set('link', 'https://example.com');
  await assert.rejects(prepare(shortRound, 'x', now), /isn’t recognised/);
});

test('server: round defaults to the one round, and a GPX that skips Mosedale waits for a check', async () => {
  const f = baseForm();
  f.delete('round');
  f.set('gpx', new Blob([skipsMosedale]), 'round.gpx');
  const { entry } = await prepare(f, 'x', now);
  assert.equal(entry.round, 'long');
  assert.equal(entry.gpxChecked, false);
});

test('server: link-only entry waits for a check', async () => {
  const f = baseForm();
  f.set('link', 'https://www.strava.com/activities/1');
  const { entry } = await prepare(f, 'x', now);
  assert.equal(entry.gpxChecked, false);
  assert.equal(entry.verified, false);
  assert.equal(entry.km, null);
});

test('server: rejects missing evidence, http links, future dates, bad photos', async () => {
  await assert.rejects(prepare(baseForm(), 'x', now), InvalidSubmission);

  const http = baseForm();
  http.set('link', 'http://example.com');
  await assert.rejects(prepare(http, 'x', now), /https/);

  const future = baseForm();
  future.set('date', '2026-09-23');
  future.set('link', 'https://example.com');
  await assert.rejects(prepare(future, 'x', now), /future/);

  const photo = baseForm();
  photo.set('photo', new Blob(['not an image']), 'x.jpg');
  await assert.rejects(prepare(photo, 'x', now), /JPEG/);

  const longName = baseForm();
  longName.set('name', 'x'.repeat(41));
  longName.set('link', 'https://example.com');
  await assert.rejects(prepare(longName, 'x', now), /Name/);
});

test('server: accepts a real PNG header', async () => {
  const f = baseForm();
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  f.set('photo', new Blob([png]), 'x.png');
  const { entry, photo } = await prepare(f, 'id', now);
  assert.equal(photo!.type, 'image/png');
  assert.equal(entry.files.photo!.key, 'id/photo');
});

test('server: category and age group are optional and validated', async () => {
  const f = baseForm();
  f.set('link', 'https://example.com');
  const none = (await prepare(f, 'x', now)).entry;
  assert.equal(none.sex, null);
  assert.equal(none.ageGroup, null);
  f.set('sex', 'F');
  f.set('ageGroup', '40-44');
  const some = (await prepare(f, 'x', now)).entry;
  assert.equal(some.sex, 'F');
  assert.equal(some.ageGroup, '40-44');
  assert.equal(categoryLabel(some), 'Female 40–44');
  f.set('sex', 'X');
  await assert.rejects(prepare(f, 'x', now), /female, male/);
  f.set('sex', 'M');
  f.set('ageGroup', '40-49');
  await assert.rejects(prepare(f, 'x', now), /age group/);
});

test('leaderboard filters by mode, category and age, fastest first', () => {
  const base: PublicRound = { name: '', round: 'long', mode: 'run', sex: null, ageGroup: null, date: '2026-09-01', secs: 0, km: 23.7, gpxChecked: true, verified: false, link: null, note: null };
  const rows: PublicRound[] = [
    { ...base, name: 'A', secs: 4 * 3600, sex: 'F', ageGroup: '40-44' },
    { ...base, name: 'B', secs: 3 * 3600, sex: 'M', ageGroup: '25-29' },
    { ...base, name: 'C', secs: 3.5 * 3600, sex: 'F', ageGroup: '25-29' },
    { ...base, name: 'D', secs: 2 * 3600, gpxChecked: false },
    { ...base, name: 'E', secs: 3 * 3600, mode: 'walk', sex: 'F' },
    { ...base, name: 'G', secs: 3.2 * 3600 },
  ];
  const names = (f: Parameters<typeof leaderboard>[1]) => leaderboard(rows, f).map((r) => r.name);
  assert.deepEqual(names({ round: 'long', mode: 'run', sex: 'all', age: 'all' }), ['B', 'G', 'C', 'A']);
  assert.deepEqual(names({ round: 'long', mode: 'run', sex: 'F', age: 'all' }), ['C', 'A']);
  assert.deepEqual(names({ round: 'long', mode: 'run', sex: 'all', age: '25-29' }), ['B', 'C']);
  assert.deepEqual(names({ round: 'long', mode: 'walk', sex: 'F', age: 'all' }), ['E']);
});

test('age groups are 5-year bands from under 20 to 80 and over', async () => {
  const { AGE_GROUPS } = await import('../src/lib/rounds.ts');
  assert.equal(AGE_GROUPS.length, 14);
  assert.deepEqual(AGE_GROUPS.slice(0, 3).map(([k]) => k), ['U20', '20-24', '25-29']);
  assert.deepEqual(AGE_GROUPS.at(-1), ['80+', '80 and over']);
});

test('server: email is required, kept privately, and never public', async () => {
  const f = baseForm();
  f.delete('email');
  f.set('link', 'https://example.com');
  await assert.rejects(prepare(f, 'x', now), /email/);
  f.set('email', 'not-an-email');
  await assert.rejects(prepare(f, 'x', now), /email/);
  f.set('email', 'Walker@Example.com');
  const { entry } = await prepare(f, 'x', now);
  assert.equal(entry.email, 'walker@example.com');
  const { toPublic } = await import('../src/lib/rounds.ts');
  assert.equal('email' in toPublic(entry), false);
});

test('a timed round that is impossibly fast, or runs backwards in time, is not a recorded activity', () => {
  const inAnHour = toGpx(roundTrack(LONG_WIGGLE, true), undefined, 3600);
  const fast = parseGpx(inAnHour, 'long');
  assert.equal(fast.checks.find((c) => c.id === 'recorded')!.pass, false);
  const gpx = toGpx(roundTrack(LONG_WIGGLE, true));
  const times = [...gpx.matchAll(/<time>([^<]+)<\/time>/g)].map((m) => m[1]).reverse();
  let n = 0;
  const backwards = gpx.replace(/<time>[^<]+<\/time>/g, () => `<time>${times[n++]}</time>`);
  assert.equal(parseGpx(backwards, 'long').checks.find((c) => c.id === 'recorded')!.pass, false);
});

test('server: a planned route with no timings is refused', async () => {
  const route = readFileSync(new URL('./fixtures/real-long-round.gpx', import.meta.url), 'utf8');
  const f = baseForm();
  f.set('gpx', new Blob([route]), 'route.gpx');
  await assert.rejects(prepare(f, 'x', now), /planned route/);
});
