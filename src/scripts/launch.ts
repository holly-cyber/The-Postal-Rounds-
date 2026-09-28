/**
 * Launch day sign-up: saves to /api/launch-signup (listed in /admin) and copies it to the Netlify
 * form `launch-signup` for email alerts. Without JavaScript the form posts to Netlify Forms only.
 */
const form = document.querySelector<HTMLFormElement>('#signup');
const statusEl = document.querySelector<HTMLElement>('#signup-status');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  button.disabled = true;
  button.textContent = 'Signing you up…';
  if (statusEl) statusEl.textContent = '';

  const data = new FormData(form);
  let res: Response;
  try {
    res = await fetch('/api/launch-signup', { method: 'POST', body: data });
  } catch {
    // Our API couldn't be reached: fall back to the plain Netlify form so the sign-up isn't lost.
    form.submit();
    return;
  }

  if (!res.ok) {
    const msg = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
    if (statusEl) statusEl.textContent = msg ?? 'That didn’t go through. Try again in a moment.';
    button.disabled = false;
    button.textContent = 'Count me in';
    return;
  }

  // Copy to Netlify Forms for the email alert; the sign-up is already saved, so don't wait on errors.
  const body = new URLSearchParams();
  data.forEach((v, k) => typeof v === 'string' && body.append(k, v));
  await fetch('/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }).catch(() => {});
  location.href = '/launch/thanks/';
});
