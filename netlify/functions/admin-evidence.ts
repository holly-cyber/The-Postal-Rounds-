/** GET /api/admin/evidence/:id/:kind — a private GPX file or photo. Admin only. */
import type { Config, Context } from '@netlify/functions';
import { error, isAdmin } from '../../src/server/http.ts';
import { evidenceStore } from '../../src/server/store.ts';

export default async (req: Request, context: Context) => {
  if (!isAdmin(req)) return error(401, 'Admin token required.');
  const { id, kind } = context.params;
  if (!/^[0-9a-f-]{36}$/.test(id ?? '') || (kind !== 'gpx' && kind !== 'photo')) return error(404, 'Not found.');

  const found = await evidenceStore().getWithMetadata(`${id}/${kind}`, { type: 'arrayBuffer' });
  if (!found) return error(404, 'Not found.');

  const type = String(found.metadata?.type ?? 'application/octet-stream');
  return new Response(found.data, {
    headers: {
      'content-type': type,
      'cache-control': 'private, no-store',
      'content-disposition': kind === 'gpx' ? `attachment; filename="round-${id}.gpx"` : 'inline',
      'x-content-type-options': 'nosniff',
    },
  });
};

export const config: Config = { path: '/api/admin/evidence/:id/:kind', method: 'GET' };
