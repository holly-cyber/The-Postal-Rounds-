import type { StoredRound } from '../lib/rounds.ts';
import { categoryLabel, formatDate, formatDuration } from '../lib/rounds.ts';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const KEY = 'shap-admin-token';
let token = '';
try {
  token = sessionStorage.getItem(KEY) ?? '';
} catch {}

let rounds: StoredRound[] = [];
const photoUrls: string[] = [];

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) {
    signOut('That password wasn’t accepted.');
    throw new Error('unauthorised');
  }
  return res;
}

function signOut(message = '') {
  token = '';
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  $('#panel').hidden = true;
  $('#login').hidden = false;
  $('#login-status').textContent = message;
  $<HTMLInputElement>('#token').focus();
}

function entryHtml(r: StoredRound): string {
  const checks = r.gpx
    ? `<ul class="checks">${r.gpx.checks
        .map(
          (c) =>
            `<li class="${c.pass ? 'pass' : 'fail'}"><span aria-hidden="true">${c.pass ? '✓' : '✗'}</span> ${esc(c.label)} — ${esc(c.detail)}<span class="sr-only">${c.pass ? ' (passed)' : ' (not passed)'}</span></li>`,
        )
        .join('')}</ul>
       <p class="meta">${r.gpx.points} points${r.gpx.elapsedSecs ? ` · GPX elapsed ${formatDuration(r.gpx.elapsedSecs)}` : ''}${r.gpx.startDate ? ` · GPX date ${formatDate(r.gpx.startDate)}` : ''}</p>`
    : '';
  return `<article class="card entry" data-id="${r.id}">
    <h2>${esc(r.name)}</h2>
    <p class="meta">${r.round === 'short' ? 'Short round' : 'Long round'} · ${r.mode === 'run' ? 'Run' : 'Walk'}${categoryLabel(r) ? ` · ${categoryLabel(r)}` : ''} · ${formatDuration(r.secs)} · ${formatDate(r.date)}${r.km !== null ? ` · ${r.km} km` : ''} · submitted ${new Date(r.createdAt).toLocaleString('en-GB')}</p>
    <p>${r.verified ? '<span class="tag v">Verified</span>' : ''}${r.gpxChecked ? '<span class="tag g">GPX checked</span>' : ''}${!r.verified && !r.gpxChecked ? '<span class="tag p">Waiting for check</span>' : ''}</p>
    ${r.link ? `<p>Link: <a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${esc(r.link)}</a></p>` : ''}
    ${r.note ? `<p>Note: “${esc(r.note)}”</p>` : ''}
    ${checks}
    <div class="photo-slot"></div>
    <div class="buttons">
      <button class="btn small" data-act="verify">${r.verified ? 'Unverify' : 'Verify'}</button>
      ${r.files.gpx ? '<button class="btn small ghost" data-act="gpx">Download GPX</button>' : ''}
      ${r.files.photo ? '<button class="btn small ghost" data-act="photo">Show photo</button>' : ''}
      <button class="btn small danger" data-act="remove">Remove</button>
    </div>
  </article>`;
}

function render() {
  const all = $<HTMLInputElement>('#show-all').checked;
  const rows = all ? rounds : rounds.filter((r) => !r.verified && !r.gpxChecked);
  const pending = rounds.filter((r) => !r.verified && !r.gpxChecked).length;
  $('#summary').textContent = `${pending} waiting for a check · ${rounds.length} entries in total.`;
  $('#list').innerHTML = rows.length ? rows.map(entryHtml).join('') : '<p>Nothing waiting. 🎉</p>';
}

async function load() {
  const res = await api('/api/admin/rounds');
  rounds = (await res.json()).rounds;
  photoUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  render();
}

$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  token = $<HTMLInputElement>('#token').value.trim();
  if (!token) return;
  try {
    await load();
  } catch {
    return;
  }
  try {
    sessionStorage.setItem(KEY, token);
  } catch {}
  $<HTMLInputElement>('#token').value = '';
  $('#login-status').textContent = '';
  $('#login').hidden = true;
  $('#panel').hidden = false;
});

$('#show-all').addEventListener('change', render);
$('#refresh').addEventListener('click', () => load().catch(() => {}));
$('#logout').addEventListener('click', () => signOut());

$('#list').addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
  if (!btn) return;
  const card = btn.closest<HTMLElement>('[data-id]')!;
  const id = card.dataset.id!;
  const r = rounds.find((x) => x.id === id);
  if (!r) return;
  const act = btn.dataset.act;
  btn.disabled = true;
  try {
    if (act === 'verify') {
      await api(`/api/rounds/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ verified: !r.verified }),
      });
      await load();
    } else if (act === 'remove') {
      if (!confirm(`Remove ${r.name}'s round and its evidence? This can't be undone.`)) return;
      await api(`/api/rounds/${id}`, { method: 'DELETE' });
      await load();
    } else if (act === 'gpx' || act === 'photo') {
      const res = await api(`/api/admin/evidence/${id}/${act}`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      photoUrls.push(url);
      if (act === 'gpx') {
        const a = document.createElement('a');
        a.href = url;
        a.download = `round-${r.date}-${r.name.replace(/[^\w-]+/g, '_')}.gpx`;
        a.click();
      } else {
        card.querySelector('.photo-slot')!.innerHTML = `<img class="photo" src="${url}" alt="Evidence photo from ${esc(r.name)}" />`;
      }
    }
  } catch {
    /* 401 already handled; other errors leave the list as it was */
  } finally {
    btn.disabled = false;
  }
});

if (token) {
  load()
    .then(() => {
      $('#login').hidden = true;
      $('#panel').hidden = false;
    })
    .catch(() => {});
}
