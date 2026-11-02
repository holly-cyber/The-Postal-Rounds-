import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toPublic } from '../src/lib/rounds.ts';
import { parseTime, prepareManual } from '../src/server/manual.ts';
import { InvalidSubmission } from '../src/server/submission.ts';

const now = new Date('2026-11-02T12:00:00Z');
const form = (over: Record<string, string> = {}, gpx?: string) => {
  const f = new FormData();
  const base = { name: 'Pat Postie', mode: 'run', sex: 'F', ageGroup: '55-59', date: '2026-10-31', time: '2:41:30', reason: 'Time from a running partner' };
  for (const [k, v] of Object.entries({ ...base, ...over })) f.set(k, v);
  if (gpx) f.set('gpx', new File([gpx], 'route.gpx', { type: 'application/gpx+xml' }));
  return f;
};

test('times are read as h:mm, h:mm:ss or 2h 41m', () => {
  assert.equal(parseTime('2:41'), 2 * 3600 + 41 * 60);
  assert.equal(parseTime('2:41:30'), 2 * 3600 + 41 * 60 + 30);
  assert.equal(parseTime('2h 41m'), 2 * 3600 + 41 * 60);
  assert.ok(Number.isNaN(parseTime('two hours')));
  assert.ok(Number.isNaN(parseTime('2:75')));
});

test('a round added by hand is stored verified with the reason kept admin-only', async () => {
  const { entry, gpxBytes } = await prepareManual(form(), 'id-1', now);
  assert.equal(entry.verified, true);
  assert.equal(entry.gpxChecked, false);
  assert.equal(entry.secs, 2 * 3600 + 41 * 60 + 30);
  assert.equal(entry.date, '2026-10-31');
  assert.equal(entry.sex, 'F');
  assert.equal(entry.ageGroup, '55-59');
  assert.equal(entry.km, null);
  assert.equal(entry.email, undefined);
  assert.deepEqual(entry.manual, { reason: 'Time from a running partner', at: now.toISOString() });
  assert.equal(gpxBytes, undefined);
  const pub = toPublic(entry);
  assert.equal(pub.verified, true);
  assert.ok(!('manual' in pub) && !('email' in pub));
});

test('a route export with no timings is accepted here and its route checks are kept', async () => {
  // The official round with its timings stripped, like a route export.
  const route = readFileSync(new URL('./fixtures/round-long.gpx', import.meta.url), 'utf8').replace(/<time>[^<]*<\/time>/g, '');
  const { entry, gpxBytes } = await prepareManual(form({}, route), 'id-2', now);
  assert.ok(gpxBytes && gpxBytes.byteLength > 0);
  assert.equal(entry.files.gpx?.key, 'id-2/gpx');
  assert.ok(entry.km && entry.km > 21);
  const checks = entry.gpx!.checks;
  assert.equal(checks.find((c) => /recorded/i.test(c.label))?.pass, false);
  assert.ok(checks.filter((c) => !/recorded/i.test(c.label)).every((c) => c.pass), JSON.stringify(checks));
  assert.equal(entry.verified, true);
});

test('a hand-added round needs a name, mode, date, sensible time and a reason', async () => {
  const bads: Record<string, string>[] = [
    { name: '' }, { mode: 'cycle' }, { date: '' }, { date: '2026-11-03' }, { time: '' }, { time: '0:20' },
    { reason: '' }, { sex: 'X' }, { ageGroup: '56' }, { email: 'nope' },
  ];
  for (const bad of bads) {
    await assert.rejects(prepareManual(form(bad), 'x', now), InvalidSubmission, JSON.stringify(bad));
  }
});
