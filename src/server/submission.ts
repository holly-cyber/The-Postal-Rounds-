/** Validates a POST /api/rounds form and turns it into a stored entry. */
import { gunzipSync } from 'node:zlib';
import { LIMITS } from '../lib/config.ts';
import { GpxError, parseGpx, type GpxResult } from '../lib/gpx.ts';
import { todayInShap, type Mode, type StoredRound } from '../lib/rounds.ts';

export class InvalidSubmission extends Error {}

const fail = (msg: string): never => {
  throw new InvalidSubmission(msg);
};

// Strip control characters and collapse whitespace.
const clean = (v: FormDataEntryValue | null) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';

const isFile = (v: FormDataEntryValue | null): v is File =>
  v !== null && typeof v !== 'string' && v.size > 0;

function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export interface Prepared {
  entry: StoredRound;
  gpxBytes?: Uint8Array<ArrayBuffer>;
  photo?: { bytes: Uint8Array<ArrayBuffer>; type: string };
  gpxResult?: GpxResult;
}

/** The honeypot is filled in: pretend all is well and store nothing. */
export const isBot = (form: FormData) => clean(form.get('website')) !== '';

export async function prepare(form: FormData, id: string, now = new Date()): Promise<Prepared> {
  const name = clean(form.get('name'));
  if (name.length < 1 || name.length > LIMITS.nameMax) fail(`Name must be 1–${LIMITS.nameMax} characters.`);

  const mode = clean(form.get('mode'));
  if (mode !== 'walk' && mode !== 'run') fail('Choose walked or ran.');

  const date = clean(form.get('date'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) fail('Add the date you completed the round.');
  if (date > todayInShap(now)) fail('The date can’t be in the future.');
  if (date < LIMITS.earliestDate) fail('That date is too far back.');

  // Time is optional. If left blank we fall back to the GPX's elapsed time (below).
  const hours = Number(clean(form.get('hours')) || '0');
  const minutes = Number(clean(form.get('minutes')) || '0');
  if (!Number.isInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0) {
    fail('Enter your time in whole hours and minutes.');
  }
  if (minutes > 59) fail('Minutes must be between 0 and 59.');
  let secs = hours * 3600 + minutes * 60;

  const linkRaw = clean(form.get('link'));
  let link: string | null = null;
  if (linkRaw) {
    let url: URL | null = null;
    try {
      url = new URL(linkRaw);
    } catch {
      /* handled below */
    }
    if (!url || url.protocol !== 'https:' || linkRaw.length > LIMITS.linkMax) fail('Activity links must start with https://');
    link = url!.toString();
  }

  const noteRaw = clean(form.get('note'));
  if (noteRaw.length > LIMITS.noteMax) fail(`Keep the note to ${LIMITS.noteMax} characters.`);
  const note = noteRaw || null;

  // GPX: may arrive gzipped from the browser. Size limit applies to the unzipped file.
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
      gpxResult = parseGpx(new TextDecoder().decode(raw));
    } catch (e) {
      fail(e instanceof GpxError ? e.message : 'We couldn’t read that GPX file.');
    }
    gpxBytes = raw;
  }

  let photo: Prepared['photo'];
  const photoFile = form.get('photo');
  if (isFile(photoFile)) {
    if (photoFile.size > LIMITS.photoMaxBytes) fail('The photo is too large (8 MB maximum).');
    const bytes = new Uint8Array(await photoFile.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type || !(LIMITS.photoTypes as readonly string[]).includes(type)) fail('Photos must be JPEG, PNG or WebP.');
    photo = { bytes, type: type! };
  }

  if (!gpxBytes && !link && !photo) fail('Add a GPX file, an activity link or a photo so we can check your round.');

  if (!secs && gpxResult?.elapsedSecs) secs = gpxResult.elapsedSecs;
  if (secs && (secs < LIMITS.minSecs || secs > LIMITS.maxSecs)) fail('That time doesn’t look right for the round.');

  const entry: StoredRound = {
    id,
    createdAt: now.toISOString(),
    name,
    mode: mode as Mode,
    date,
    secs,
    km: gpxResult ? gpxResult.km : null,
    gpxChecked: gpxResult?.passed ?? false,
    verified: false,
    verifiedAt: null,
    link,
    note,
    gpx: gpxResult
      ? {
          points: gpxResult.points,
          elapsedSecs: gpxResult.elapsedSecs,
          startDate: gpxResult.startDate,
          checks: gpxResult.checks,
        }
      : null,
    files: {},
  };
  if (gpxBytes) entry.files.gpx = { key: `${id}/gpx`, bytes: gpxBytes.byteLength };
  if (photo) entry.files.photo = { key: `${id}/photo`, type: photo.type, bytes: photo.bytes.byteLength };

  return { entry, gpxBytes, photo, gpxResult };
}
