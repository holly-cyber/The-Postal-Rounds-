/**
 * Admin change to one stored round: PATCH /api/rounds/:id.
 *
 * `{ verified: true, addMins?: number, reason?: string }` verifies a round by hand (it then counts
 * in the round book even though the GPX didn't pass the route check). `addMins` adds whole minutes
 * to the time the GPX recorded, for a watch started late; it always applies to the GPX's own time,
 * so saving twice never adds twice. `{ verified: false }` takes the round back to its GPX time and
 * clears the hand check.
 */
import type { StoredRound } from '../lib/rounds.ts';
import { InvalidSubmission } from './submission.ts';

/** Most minutes an admin can add to a GPX time. */
export const MAX_ADD_MINS = 60;
const REASON_MAX = 300;

const fail = (m: string): never => {
  throw new InvalidSubmission(m);
};

export function applyAdminPatch(entry: StoredRound, body: unknown, now = new Date()): StoredRound {
  const b = (body ?? {}) as { verified?: unknown; addMins?: unknown; reason?: unknown };
  if (typeof b.verified !== 'boolean') fail('Send { "verified": true | false }.');

  // The time the GPX recorded: kept on the adjustment once there is one, else the entry's time.
  const gpxSecs = entry.adjustment?.gpxSecs ?? entry.secs;
  const next: StoredRound = { ...entry };

  if (!b.verified) {
    next.verified = false;
    next.verifiedAt = null;
    next.secs = gpxSecs;
    delete next.adjustment;
    return next;
  }

  const addMins = b.addMins === undefined || b.addMins === null || b.addMins === '' ? 0 : Number(b.addMins);
  if (!Number.isInteger(addMins) || addMins < 0 || addMins > MAX_ADD_MINS) {
    fail(`Minutes to add must be a whole number from 0 to ${MAX_ADD_MINS}.`);
  }
  const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, REASON_MAX) : '';

  next.verified = true;
  next.verifiedAt = now.toISOString();
  next.secs = gpxSecs + addMins * 60;
  if (addMins || reason) {
    next.adjustment = { gpxSecs, addedSecs: addMins * 60, reason: reason || null, at: now.toISOString() };
  } else {
    delete next.adjustment;
  }
  return next;
}
