import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StoredRound } from '../src/lib/rounds.ts';
import { toPublic } from '../src/lib/rounds.ts';
import { InvalidSubmission } from '../src/server/submission.ts';
import { applyAdminPatch } from '../src/server/verify.ts';

const now = new Date('2026-11-02T10:00:00Z');
const entry = (over: Partial<StoredRound> = {}): StoredRound => ({
  id: '00000000-0000-0000-0000-000000000001', createdAt: '2026-10-31T21:00:00Z', consentedAt: '2026-10-31T21:00:00Z',
  email: 'pat@example.com', name: 'Pat Postie', round: 'long', mode: 'run', sex: null, ageGroup: null,
  date: '2026-10-31', secs: 2 * 3600 + 10 * 60, km: 23.1, gpxChecked: false, verified: false, verifiedAt: null,
  link: null, note: null, gpx: null, files: {}, ...over,
});

test('verifying with minutes added counts the round and adds the time to the GPX time', () => {
  const v = applyAdminPatch(entry(), { verified: true, addMins: 4, reason: 'Watch started late' }, now);
  assert.equal(v.verified, true);
  assert.equal(v.verifiedAt, now.toISOString());
  assert.equal(v.secs, 2 * 3600 + 14 * 60);
  assert.deepEqual(v.adjustment, { gpxSecs: 2 * 3600 + 10 * 60, addedSecs: 240, reason: 'Watch started late', at: now.toISOString() });
});

test('saving again replaces the added time rather than adding twice', () => {
  const once = applyAdminPatch(entry(), { verified: true, addMins: 4 }, now);
  const twice = applyAdminPatch(once, { verified: true, addMins: 5 }, now);
  assert.equal(twice.secs, 2 * 3600 + 15 * 60);
  assert.equal(twice.adjustment?.gpxSecs, 2 * 3600 + 10 * 60);
});

test('undoing the verify restores the GPX time', () => {
  const v = applyAdminPatch(entry(), { verified: true, addMins: 4 }, now);
  const u = applyAdminPatch(v, { verified: false }, now);
  assert.equal(u.verified, false);
  assert.equal(u.verifiedAt, null);
  assert.equal(u.secs, 2 * 3600 + 10 * 60);
  assert.equal(u.adjustment, undefined);
});

test('verifying without a change keeps the recorded time and stores no adjustment', () => {
  const v = applyAdminPatch(entry(), { verified: true }, now);
  assert.equal(v.secs, 2 * 3600 + 10 * 60);
  assert.equal(v.adjustment, undefined);
});

test('bad patches are refused', () => {
  for (const bad of [{}, { verified: 'yes' }, { verified: true, addMins: -1 }, { verified: true, addMins: 61 }, { verified: true, addMins: 2.5 }]) {
    assert.throws(() => applyAdminPatch(entry(), bad, now), InvalidSubmission, JSON.stringify(bad));
  }
});

test('the adjustment never reaches the public API', () => {
  const v = applyAdminPatch(entry(), { verified: true, addMins: 4, reason: 'private' }, now);
  assert.ok(!('adjustment' in toPublic(v)));
});
