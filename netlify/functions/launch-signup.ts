/** POST /api/launch-signup — sign up for launch day (form fields as on /launch/). Stored privately. */
import type { Config, Context } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { LIMITS } from '../../src/lib/config.ts';
import { error, hashIp, json } from '../../src/server/http.ts';
import { isSignupBot, prepareSignup } from '../../src/server/signup.ts';
import { InvalidSubmission } from '../../src/server/submission.ts';
import { rateStore, signupsStore } from '../../src/server/store.ts';

export default async (req: Request, context: Context) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error(400, 'We couldn’t read that form. Reload the page and try again.');
  }
  if (isSignupBot(form)) return json({ ok: true }, 201);

  // Same allowance as round entries, counted separately.
  const ipKey = `signup-${hashIp(context.ip || 'unknown')}`;
  const seen = ((await rateStore().get(ipKey, { type: 'json' })) as number[] | null) ?? [];
  const recent = seen.filter((t) => Date.now() - t < LIMITS.rateWindowMs);
  if (recent.length >= LIMITS.ratePerWindow) return error(429, 'Too many sign-ups from here — try again in an hour.');

  const id = randomUUID();
  let signup;
  try {
    signup = prepareSignup(form, id);
  } catch (e) {
    if (e instanceof InvalidSubmission) return error(400, e.message);
    throw e;
  }
  await signupsStore().setJSON(id, signup);
  await rateStore().setJSON(ipKey, [...recent, Date.now()]);
  return json({ ok: true }, 201);
};

export const config: Config = { path: '/api/launch-signup', method: 'POST' };
