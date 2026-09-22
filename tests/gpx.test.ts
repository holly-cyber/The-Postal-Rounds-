import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { GpxError, parseGpx, parsePoints } from '../src/lib/gpx.ts';
import { prepare, InvalidSubmission } from '../src/server/submission.ts';
import { LONG_WIGGLE, SHORT_WIGGLE, roundTrack, toGpx } from './make-gpx.ts';

const passing = toGpx(roundTrack(LONG_WIGGLE));
const shortRound = toGpx(roundTrack(SHORT_WIGGLE));

test('a full long round passes every check', () => {
  const r = parseGpx(passing, 'long');
  assert.equal(r.passed, true, JSON.stringify(r.checks));
  assert.ok(r.km >= 21, `km ${r.km}`);
  assert.equal(r.elapsedSecs, 4 * 3600);
  assert.equal(r.startDate, '2026-09-12');
});

test('a short walk fails west, south and distance', () => {
  const pts = roundTrack().filter((p) => p.lon > -2.71 && p.lat > 54.505);
  const r = parseGpx(toGpx(pts), 'short');
  const failed = r.checks.filter((c) => !c.pass).map((c) => c.id).sort();
  assert.deepEqual(failed, ['distance', 'south', 'west']);
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

test('the short round passes as short but not as long', () => {
  assert.equal(parseGpx(shortRound, 'short').passed, true);
  const asLong = parseGpx(shortRound, 'long');
  assert.deepEqual(asLong.checks.filter((c) => !c.pass).map((c) => c.id), ['distance']);
});

function baseForm(): FormData {
  const f = new FormData();
  f.set('name', 'Test Walker');
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
  await assert.rejects(prepare(badRound, 'x', now), /long or short/);
});

test('server: a short-round GPX is checked against the short round', async () => {
  const f = baseForm();
  f.set('round', 'short');
  f.set('gpx', new Blob([shortRound]), 'round.gpx');
  const { entry } = await prepare(f, 'x', now);
  assert.equal(entry.round, 'short');
  assert.equal(entry.gpxChecked, true);
  const g = baseForm();
  g.set('gpx', new Blob([shortRound]), 'round.gpx');
  assert.equal((await prepare(g, 'x', now)).entry.gpxChecked, false);
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
