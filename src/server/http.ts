import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export const error = (status: number, message: string) => json({ error: message }, status);

const digest = (s: string) => createHash('sha256').update(s).digest();

/** True if the request carries `Authorization: Bearer <ADMIN_TOKEN>`. */
export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const header = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return false;
  return timingSafeEqual(digest(m[1].trim()), digest(expected));
}

/** Keyed hash of an IP for rate limiting, so stored values can't be reversed without the secret. */
export function hashIp(ip: string): string {
  const key = process.env.ADMIN_TOKEN ?? 'shap-postal-round';
  return createHmac('sha256', key).update(ip).digest('hex').slice(0, 32);
}
