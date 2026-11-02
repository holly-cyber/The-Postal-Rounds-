/**
 * A round added by hand in /admin (POST /api/admin/rounds): for a round whose GPX can't carry the
 * time, e.g. a route export with no timestamps, where the time is known another way (a running
 * partner's recorded activity). The entry is stored verified, with the reason kept admin-only.
 * A GPX is optional; when given, its route checks are run and kept for /admin like any other.
 */
import { gunzipSync } from 'node:zlib';
import { LIMITS } from '../lib/config.ts';
import { GpxError, parseGpx, type GpxResult } from '../lib/gpx.ts';
import { isAgeGroup, todayInShap, type Mode, type Sex, type StoredRound } from '../lib/rounds.ts';
import { InvalidSubmission } from './submission.ts';

const fail = (msg: string): never => {
  throw new InvalidSubmission(msg);
};
const clean = (v: FormDataEntryValue | null) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
const isFile = (v: FormDataEntryValue | null): v is File => v !== null && typeof v !== 'string' && v.size > 0;

const REASON_MAX = 300;

/** "2:41", "2:41:30" or "2h 41m" → seconds; NaN if it isn't a time. */
export function parseTime(s: string): number {
  const t = s.trim().toLowerCase();
  let m = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(t);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0);
  m = /^(\d{1,2})\s*h\s*(?:([0-5]?\d)\s*m)?\s*(?:([0-5]?\d)\s*s)?$/.exec(t);
  if (m) return Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return NaN;
}

export interface PreparedManual {
  entry: StoredRound;
  gpxBytes?: Uint8Array<ArrayBuffer>;
  gpxResult?: GpxResult;
}

export async function prepareManual(form: FormData, id: string, now = new Date()): Promise<PreparedManual> {
  const name = clean(form.get('name'));
  if (name.length < 1 || name.length > LIMITS.nameMax) fail(`Name must be 1–${LIMITS.nameMax} characters.`);

  const email = clean(form.get('email')).toLowerCase();
  if (email && (email.length > LIMITS.emailMax || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) fail('That email address doesn’t look right.');

  const mode = clean(form.get('mode'));
  if (mode !== 'walk' && mode !== 'run') fail('Choose walked or ran.');

  const sexRaw = clean(form.get('sex'));
  if (sexRaw && sexRaw !== 'F' && sexRaw !== 'M') fail('Choose female, male or not said.');
  const ageRaw = clean(form.get('ageGroup'));
  if (ageRaw && !isAgeGroup(ageRaw)) fail('Choose an age group from the list.');

  const date = clean(form.get('date'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) fail('Add the date of the round.');
  if (date > todayInShap(now)) fail('That date is in the future.');
  if (date < LIMITS.earliestDate) fail('That date is too far back.');

  const secs = parseTime(clean(form.get('time')));
  if (!Number.isFinite(secs)) fail('Add the time as hours:minutes, e.g. 2:41 or 2:41:30.');
  if (secs < LIMITS.minSecs || secs > LIMITS.maxSecs) fail('That time doesn’t look right for the round.');

  const reason = clean(form.get('reason')).slice(0, REASON_MAX);
  if (!reason) fail('Add a reason, e.g. how the time was confirmed.');

  const noteRaw = clean(form.get('note'));
  if (noteRaw.length > LIMITS.noteMax) fail(`Keep the note to ${LIMITS.noteMax} characters.`);

  // Optional GPX: a route export (no timings) is fine here; its route checks are still run.
  let gpxBytes: Uint8Array<ArrayBuffer> | undefined;
  let gpxResult: GpxResult | undefined;
  const gpxFile = form.get('gpx');
  if (isFile(gpxFile)) {
    let raw: Uint8Array<ArrayBuffer> = new Uint8Array(await gpxFile.arrayBuffer());
    if (raw[0] === 0x1f && raw[1] === 0x8b) {
      try {
        raw = new Uint8Array(gunzipSync(raw, { maxOutputLength: LIMITS.gpxMaxBytes }));
      } catch {
        fail('The GPX file is too large or damaged (10 MB maximum).');
      }
    }
    if (raw.byteLength > LIMITS.gpxMaxBytes) fail('The GPX file is too large (10 MB maximum).');
    try {
      gpxResult = parseGpx(new TextDecoder().decode(raw), 'long');
    } catch (e) {
      fail(e instanceof GpxError ? e.message : 'We couldn’t read that GPX file.');
    }
    gpxBytes = raw;
  }

  const at = now.toISOString();
  const entry: StoredRound = {
    id,
    createdAt: at,
    consentedAt: at,
    ...(email ? { email } : {}),
    name,
    round: 'long',
    mode: mode as Mode,
    sex: (sexRaw || null) as Sex | null,
    ageGroup: ageRaw && isAgeGroup(ageRaw) ? ageRaw : null,
    date,
    secs,
    km: gpxResult ? gpxResult.km : null,
    gpxChecked: false,
    verified: true,
    verifiedAt: at,
    manual: { reason, at },
    link: null,
    note: noteRaw || null,
    gpx: gpxResult
      ? { points: gpxResult.points, elapsedSecs: gpxResult.elapsedSecs, startDate: gpxResult.startDate, checks: gpxResult.checks }
      : null,
    files: {},
  };
  if (gpxBytes) entry.files.gpx = { key: `${id}/gpx`, bytes: gpxBytes.byteLength };
  return { entry, gpxBytes, gpxResult };
}
