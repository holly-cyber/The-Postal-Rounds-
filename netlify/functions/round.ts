/**
 * PATCH  /api/rounds/:id  { verified: boolean, addMins?, reason? }  — admin only (see src/server/verify.ts).
 * DELETE /api/rounds/:id                         — admin only; removes evidence too.
 */
import type { Config, Context } from '@netlify/functions';
import type { StoredRound } from '../../src/lib/rounds.ts';
import { error, isAdmin, json } from '../../src/server/http.ts';
import { evidenceStore, roundsStore } from '../../src/server/store.ts';
import { InvalidSubmission } from '../../src/server/submission.ts';
import { applyAdminPatch } from '../../src/server/verify.ts';

export default async (req: Request, context: Context) => {
  if (!isAdmin(req)) return error(401, 'Admin token required.');

  const id = context.params.id;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return error(404, 'Not found.');

  const store = roundsStore();
  const entry = (await store.get(id, { type: 'json' })) as StoredRound | null;
  if (!entry) return error(404, 'Not found.');

  if (req.method === 'PATCH') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error(400, 'Send JSON.');
    }
    let next: StoredRound;
    try {
      next = applyAdminPatch(entry, body);
    } catch (e) {
      if (e instanceof InvalidSubmission) return error(400, e.message);
      throw e;
    }
    await store.setJSON(id, next);
    return json({ ok: true, entry: next });
  }

  if (req.method === 'DELETE') {
    const evidence = evidenceStore();
    await Promise.all([evidence.delete(`${id}/gpx`), evidence.delete(`${id}/photo`)]);
    await store.delete(id);
    return json({ ok: true });
  }

  return error(405, 'Method not allowed.');
};

export const config: Config = { path: '/api/rounds/:id', method: ['PATCH', 'DELETE'] };
