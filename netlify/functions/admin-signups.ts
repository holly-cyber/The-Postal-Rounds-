/**
 * GET    /api/admin/signups      — every launch day sign-up. Admin only.
 * POST   /api/admin/signups      — add one by hand (e.g. copied from the Netlify Forms inbox,
 *                                  or taken by phone). Optional `createdAt` (ISO). Admin only.
 * DELETE /api/admin/signups/:id  — remove one. Admin only.
 */
import type { Config, Context } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { error, isAdmin, json } from '../../src/server/http.ts';
import { prepareSignup } from '../../src/server/signup.ts';
import { InvalidSubmission } from '../../src/server/submission.ts';
import { listSignups, signupsStore } from '../../src/server/store.ts';

export default async (req: Request, context: Context) => {
  if (!isAdmin(req)) return error(401, 'Admin token required.');
  const id = context.params.id;

  if (req.method === 'GET' && !id) return json({ signups: await listSignups() });

  if (req.method === 'POST' && !id) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return error(400, 'We couldn’t read that form.');
    }
    form.set('understood', 'yes');
    const when = String(form.get('createdAt') ?? '');
    const at = when ? new Date(when) : new Date();
    if (Number.isNaN(at.getTime())) return error(400, 'That sign-up date isn’t valid.');
    try {
      const signup = prepareSignup(form, randomUUID(), at);
      await signupsStore().setJSON(signup.id, signup);
      return json({ ok: true, signup }, 201);
    } catch (e) {
      if (e instanceof InvalidSubmission) return error(400, e.message);
      throw e;
    }
  }

  if (req.method === 'DELETE' && id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return error(404, 'Not found.');
    await signupsStore().delete(id);
    return json({ ok: true });
  }

  return error(405, 'Method not allowed.');
};

export const config: Config = { path: ['/api/admin/signups', '/api/admin/signups/:id'], method: ['GET', 'POST', 'DELETE'] };
