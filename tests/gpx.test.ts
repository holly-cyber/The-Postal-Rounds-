import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { GpxError, parseGpx, parsePoints } from '../src/lib/gpx.ts';
import { prepare, InvalidSubmission } from '../src/server/submission.ts';
import { roundTrack, toGpx } from './make-gpx.ts';

const passing = toGpx(roundTrack());

test('a full round passes every check', () => {
  const r = parseGpx(passing);
  assert.equal(r.passed, true, JSON.stringify(r.checks));
  assert.ok(r.km >= 15, `km ${r.km}`);
  assert.equal(r.elapsedSecs, 4 * 3600);
  assert.equal(r.startDate, '2026-09-12');
});

test('a short walk fails west, south and distance', () => {
  const pts = roundTrack().filter((p) => p.lon > -2.71);
  const r = parseGpx(toGpx(pts));
  const failed = r.checks.filter((c) => !c.pass).map((c) => c.id).sort();
  assert.deepEqual(failed, ['distance', 'south', 'west']);
});

test('a loop started elsewhere fails start and finish', () => {
  const pts = roundTrack();
  const shifted = [...pts.slice(400), ...pts.slice(0, 400)];
  const r = parseGpx(toGpx(shifted));
  assert.equal(r.checks.find((c) => c.id === 'start')!.pass, false);
  assert.equal(r.checks.find((c) => c.id === 'finish')!.pass, false);
});

test('handles self-closing points, single quotes, namespaces and route points', () => {
  const t = `<gpx><rte><rtept lon='-2.68' lat='54.53'/><rtept lat="54.52" lon="-2.69"/></rte></gpx>`;
  assert.equal(parsePoints(t).length, 2);
  const ns = `<g:gpx xmlns:g="x"><g:trk><g:trkseg><g:trkpt lat="1" lon="2"></g:trkpt><g:trkpt lat="1.1" lon="2"/></g:trkseg></g:trk></g:gpx>`;
  assert.throws(() => parsePoints(ns)); // not a <gpx> root without prefix — rejected
  const ok = `<gpx><trk><trkseg><gx:trkpt lat="1" lon="2"></gx:trkpt><gx:trkpt lat="1.1" lon="2"/></trkseg></trk></gpx>`;
  assert.equal(parsePoints(ok).length, 2);
});

test('rejects non-GPX input', () => {
  assert.throws(() => parseGpx('hello'), GpxError);
  assert.throws(() => parseGpx('<gpx></gpx>'), GpxError);
});

function baseForm(): FormData {
  const f = new FormData();
  f.set('name', 'Test Walker');
  f.set('mode', 'walk');
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
