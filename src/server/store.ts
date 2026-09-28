/** Netlify Blobs access. Only functions import this. */
import { getStore } from '@netlify/blobs';
import type { StoredRound } from '../lib/rounds.ts';
import type { Signup } from './signup.ts';

/** Entry JSON, keyed by entry id. */
export const roundsStore = () => getStore({ name: 'rounds', consistency: 'strong' });
/** Private GPX files and photos, keyed `<id>/gpx` and `<id>/photo`. Never served publicly. */
export const evidenceStore = () => getStore({ name: 'evidence', consistency: 'strong' });
/** Per-IP submission timestamps, keyed by a hash of the IP. */
export const rateStore = () => getStore({ name: 'ratelimit', consistency: 'strong' });

/** Launch day sign-ups, keyed by id. Private: admin only. */
export const signupsStore = () => getStore({ name: 'signups', consistency: 'strong' });

export async function listRounds(): Promise<StoredRound[]> {
  const store = roundsStore();
  const { blobs } = await store.list();
  const rows = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: 'json' }) as Promise<StoredRound | null>),
  );
  return rows
    .filter((r): r is StoredRound => r !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listSignups(): Promise<Signup[]> {
  const store = signupsStore();
  const { blobs } = await store.list();
  const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }) as Promise<Signup | null>));
  return rows
    .filter((r): r is Signup => r !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
