/**
 * GET    /api/admin/signups      — every launch day sign-up. Admin only.
 * DELETE /api/admin/signups/:id  — remove one. Admin only.
 */
import type { Config, Context } from '@netlify/functions';
import { error, isAdmin, json } from '../../src/server/http.ts';
import { listSignups, signupsStore } from '../../src/server/store.ts';

export default async (req: Request, context: Context) => {
  if (!isAdmin(req)) return error(401, 'Admin token required.');
  const id = context.params.id;

  if (req.method === 'GET' && !id) return json({ signups: await listSignups() });

  if (req.method === 'DELETE' && id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return error(404, 'Not found.');
    await signupsStore().delete(id);
    return json({ ok: true });
  }

  return error(405, 'Method not allowed.');
};

export const config: Config = { path: ['/api/admin/signups', '/api/admin/signups/:id'], method: ['GET', 'DELETE'] };
