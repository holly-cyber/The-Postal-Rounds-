/**
 * GET  /api/rounds  — public leaderboard (public fields only).
 * POST /api/rounds  — log a round (multipart form). GPX is re-checked here.
 */
import type { Config, Context } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { LIMITS } from '../../src/lib/config.ts';
import { toPublic } from '../../src/lib/rounds.ts';
import { error, hashIp, json } from '../../src/server/http.ts';
import { InvalidSubmission, isBot, prepare } from '../../src/server/submission.ts';
import { evidenceStore, listRounds, rateStore, roundsStore } from '../../src/server/store.ts';

/** Timestamps of this IP's accepted submissions within the rate window. */
async function recentSubmissions(key: string): Promise<number[]> {
  const seen = ((await rateStore().get(key, { type: 'json' })) as number[] | null) ?? [];
  return seen.filter((t) => Date.now() - t < LIMITS.rateWindowMs);
}

async function submit(req: Request, context: Context): Promise<Response> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.startsWith('multipart/form-data')) return error(415, 'Send the form as multipart/form-data.');

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error(400, 'We couldn’t read that form. If you attached large files, try smaller ones.');
  }

  if (isBot(form)) return json({ ok: true }, 201);

  // Only accepted submissions count, so a typo doesn't use up someone's allowance.
  const ipKey = hashIp(context.ip || 'unknown');
  const recent = await recentSubmissions(ipKey);
  if (recent.length >= LIMITS.ratePerWindow) {
    return error(429, 'Too many submissions from here — try again in an hour.');
  }

  const id = randomUUID();
  let prepared;
  try {
    prepared = await prepare(form, id);
  } catch (e) {
    if (e instanceof InvalidSubmission) return error(400, e.message);
    throw e;
  }
  const { entry, gpxBytes, photo, gpxResult } = prepared;

  const evidence = evidenceStore();
  if (gpxBytes) {
    await evidence.set(`${id}/gpx`, new Blob([gpxBytes]), { metadata: { type: 'application/gpx+xml' } });
  }
  if (photo) {
    await evidence.set(`${id}/photo`, new Blob([photo.bytes]), { metadata: { type: photo.type } });
  }
  await roundsStore().setJSON(id, entry);
  await rateStore().setJSON(ipKey, [...recent, Date.now()]);

  return json(
    {
      ok: true,
      entry: toPublic(entry),
      checks: gpxResult?.checks ?? null,
    },
    201,
  );
}

export default async (req: Request, context: Context) => {
  if (req.method === 'GET') {
    const rows = await listRounds();
    return json({ rounds: rows.map(toPublic) });
  }
  if (req.method === 'POST') return submit(req, context);
  return error(405, 'Method not allowed.');
};

export const config: Config = { path: '/api/rounds' };
