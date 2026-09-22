/** GET /api/admin/rounds — every entry with its GPX check detail. Admin only. */
import type { Config } from '@netlify/functions';
import { error, isAdmin, json } from '../../src/server/http.ts';
import { listRounds } from '../../src/server/store.ts';

export default async (req: Request) => {
  if (!isAdmin(req)) return error(401, 'Admin token required.');
  return json({ rounds: await listRounds() });
};

export const config: Config = { path: '/api/admin/rounds', method: 'GET' };
