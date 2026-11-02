/**
 * GET  /api/admin/rounds — every entry with its GPX check detail. Admin only.
 * POST /api/admin/rounds — add a round by hand (multipart; see src/server/manual.ts). Admin only.
 */
import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { error, isAdmin, json } from '../../src/server/http.ts';
import { prepareManual } from '../../src/server/manual.ts';
import { evidenceStore, listRounds, roundsStore } from '../../src/server/store.ts';
import { InvalidSubmission } from '../../src/server/submission.ts';

export default async (req: Request) => {
  if (!isAdmin(req)) return error(401, 'Admin token required.');
  if (req.method === 'GET') return json({ rounds: await listRounds() });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error(400, 'We couldn’t read that form.');
  }
  const id = randomUUID();
  try {
    const { entry, gpxBytes } = await prepareManual(form, id);
    if (gpxBytes) {
      await evidenceStore().set(`${id}/gpx`, new Blob([gpxBytes]), { metadata: { type: 'application/gpx+xml' } });
    }
    await roundsStore().setJSON(id, entry);
    return json({ ok: true, entry }, 201);
  } catch (e) {
    if (e instanceof InvalidSubmission) return error(400, e.message);
    throw e;
  }
};

export const config: Config = { path: '/api/admin/rounds', method: ['GET', 'POST'] };
