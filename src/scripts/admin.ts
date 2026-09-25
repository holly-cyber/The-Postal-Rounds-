/**
 * Round book admin: sign in with the admin token, then three views (hash routes):
 * #overview (stats and facts), #rounds (check, verify, remove) and #contacts (emails, CSV).
 */
import type { StoredRound } from '../lib/rounds.ts';
import { AGE_LABELS, categoryLabel, formatDate, formatDuration } from '../lib/rounds.ts';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const KEY = 'shap-admin-token';
let token = '';
try {
  token = sessionStorage.getItem(KEY) ?? '';
} catch {}

let rounds: StoredRound[] = [];
const blobUrls: string[] = [];
let filter: 'waiting' | 'checked' | 'all' = 'all';

const isWaiting = (r: StoredRound) => !r.verified && !r.gpxChecked;
const isCounted = (r: StoredRound) => (r.verified || r.gpxChecked) && r.secs > 0;

// ---------- API and sign in ----------

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
  $('#app').hidden = true;
  $('#login-screen').hidden = false;
  $('#login-status').textContent = message;
  $<HTMLInputElement>('#token').focus();
}

function showApp() {
  $('#login-screen').hidden = true;
  $('#app').hidden = false;
  route();
}

async function load() {
  const res = await api('/api/admin/rounds');
  if (!res.ok) {
    $('#status').textContent = 'The round book couldn’t load. Try Refresh in a moment.';
    return;
  }
  $('#status').textContent = '';
  rounds = ((await res.json()).rounds as StoredRound[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  blobUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  renderAll();
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
  showApp();
});

$('#refresh').addEventListener('click', () => load().catch(() => {}));
$('#logout').addEventListener('click', () => signOut());

// ---------- Tabs (hash routes) ----------

function route() {
  const tab = ['overview', 'rounds', 'contacts'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== tab));
  document.querySelectorAll<HTMLAnchorElement>('[data-tab]').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', route);

function renderAll() {
  renderOverview();
  renderRounds();
  renderContacts();
}

// ---------- Overview ----------

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function fastest(mode: 'run' | 'walk'): StoredRound | undefined {
  return rounds.filter((r) => r.mode === mode && isCounted(r)).sort((a, b) => a.secs - b.secs)[0];
}

function renderOverview() {
  const total = rounds.length;
  const runs = rounds.filter((r) => r.mode === 'run').length;
  const walks = total - runs;
  const waiting = rounds.filter(isWaiting).length;
  const km = rounds.reduce((s, r) => s + (r.km ?? 0), 0);
  const people = new Set(rounds.map((r) => (r.email || r.name).toLowerCase())).size;

  const tiles: [string, string, string?][] = [
    [String(total), 'rounds posted'],
    [String(people), 'people'],
    [String(runs), `runs (${pct(runs, total)})`],
    [String(walks), `walks (${pct(walks, total)})`],
    [String(waiting), 'didn’t pass the check', waiting ? 'alert' : undefined],
    [`${Math.round(km).toLocaleString('en-GB')} km`, 'walked and run in total'],
  ];
  $('#ov-tiles').innerHTML = tiles
    .map(([n, l, cls], i) =>
      i === 4 && waiting
        ? `<a class="tile ${cls}" href="#rounds"><span class="n">${esc(n)}</span><span class="l">${esc(l)} →</span></a>`
        : `<div class="tile${cls ? ` ${cls}` : ''}"><span class="n">${esc(n)}</span><span class="l">${esc(l)}</span></div>`,
    )
    .join('');

  // Rounds posted by month, last 12 months.
  const months: { key: string; label: string; n: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      n: 0,
    });
  }
  for (const r of rounds) {
    const m = months.find((x) => x.key === r.date.slice(0, 7));
    if (m) m.n++;
  }
  const max = Math.max(1, ...months.map((m) => m.n));
  $('#ov-months').innerHTML =
    months
      .map((m, i) => {
        const h = `${Math.round((m.n / max) * 100)}%`;
        return `<div class="col${i === months.length - 1 ? ' last' : ''}" tabindex="0" style="--h:${h}" aria-label="${esc(m.label)}: ${m.n} ${m.n === 1 ? 'round' : 'rounds'}" title="${esc(m.label)}: ${m.n}">
          <span class="val">${m.n}</span><div class="bar" style="height:${m.n ? h : '0'}"></div></div>`;
      })
      .join('');
  $('#ov-months-axis').innerHTML = months.map((m) => `<span>${esc(m.label)}</span>`).join('');

  // Records and facts.
  const fr = fastest('run');
  const fw = fastest('walk');
  const runTimes = rounds.filter((r) => r.mode === 'run' && isCounted(r)).map((r) => r.secs);
  const walkTimes = rounds.filter((r) => r.mode === 'walk' && isCounted(r)).map((r) => r.secs);
  const byDate = [...rounds].sort((a, b) => a.date.localeCompare(b.date));
  const records: [string, string][] = [
    ['Fastest run', fr ? `${formatDuration(fr.secs)} · ${fr.name}` : 'Up for grabs'],
    ['Fastest walk', fw ? `${formatDuration(fw.secs)} · ${fw.name}` : 'Up for grabs'],
    ['Average run', runTimes.length ? formatDuration(Math.round(avg(runTimes))) : '–'],
    ['Average walk', walkTimes.length ? formatDuration(Math.round(avg(walkTimes))) : '–'],
    ['First round', byDate[0] ? formatDate(byDate[0].date) : '–'],
    ['Latest round', byDate.at(-1) ? formatDate(byDate.at(-1)!.date) : '–'],
  ];
  $('#ov-records').innerHTML = records.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');

  // Who's doing it.
  const f = rounds.filter((r) => r.sex === 'F').length;
  const m = rounds.filter((r) => r.sex === 'M').length;
  const ages = new Map<string, number>();
  for (const r of rounds) if (r.ageGroup) ages.set(r.ageGroup, (ages.get(r.ageGroup) ?? 0) + 1);
  const topAge = [...ages.entries()].sort((a, b) => b[1] - a[1])[0];
  const checked = rounds.filter((r) => r.gpxChecked).length;
  const people2: [string, string][] = [
    ['Female', `${f} (${pct(f, total)})`],
    ['Male', `${m} (${pct(m, total)})`],
    ['Not said', `${total - f - m} (${pct(total - f - m, total)})`],
    ['Most common age group', topAge ? `${(AGE_LABELS as Record<string, string>)[topAge[0]] ?? topAge[0]} (${topAge[1]})` : '–'],
    ['GPX checked', `${checked} (${pct(checked, total)})`],
  ];
  $('#ov-people').innerHTML = people2.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');

  // Latest five.
  $('#ov-latest').innerHTML = rounds.length
    ? rounds
        .slice(0, 5)
        .map(
          (r) =>
            `<li><strong>${esc(r.name)}</strong><span>${r.mode === 'run' ? 'Ran' : 'Walked'} · ${formatDuration(r.secs)} · ${formatDate(r.date)}</span></li>`,
        )
        .join('')
    : '<li class="muted">No rounds yet.</li>';
}

// ---------- Rounds ----------

function entryHtml(r: StoredRound): string {
  const checks = r.gpx
    ? `<ul class="checks">${r.gpx.checks
        .map(
          (c) =>
            `<li class="${c.pass ? 'pass' : 'fail'}" title="${esc(c.detail)}"><span aria-hidden="true">${c.pass ? '✓' : '✗'}</span> ${esc(c.label)}<span class="sr-only">${c.pass ? ' (passed)' : ` (not passed: ${esc(c.detail)})`}</span></li>`,
        )
        .join('')}</ul>`
    : '<p class="meta">No GPX file.</p>';
  const tags = `${r.verified ? '<span class="tag v">Verified</span>' : ''}${r.gpxChecked ? '<span class="tag g">GPX checked</span>' : ''}${isWaiting(r) ? '<span class="tag p">Didn’t pass the check</span>' : ''}`;
  return `<article class="entry" data-id="${r.id}">
    <div class="entry-head"><h2>${esc(r.name)}</h2>${tags}</div>
    <p class="meta">${r.mode === 'run' ? 'Ran' : 'Walked'} · ${formatDuration(r.secs)} · ${formatDate(r.date)}${r.km !== null ? ` · ${r.km} km` : ''}${categoryLabel(r) ? ` · ${categoryLabel(r)}` : ''} · posted ${new Date(r.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
    ${r.email ? `<p><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></p>` : ''}
    ${r.link ? `<p>Activity: <a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${esc(r.link)}</a></p>` : ''}
    ${r.note ? `<p>“${esc(r.note)}”</p>` : ''}
    ${checks}
    <div class="photo-slot"></div>
    <div class="buttons">
      ${r.files.gpx ? '<button class="btn small ghost" data-act="gpx">Download GPX</button>' : ''}
      ${r.files.photo ? '<button class="btn small ghost" data-act="photo">Show photo</button>' : ''}
      <button class="btn small danger" data-act="remove">Remove</button>
    </div>
  </article>`;
}

function matches(r: StoredRound, q: string) {
  return !q || r.name.toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q);
}

function renderRounds() {
  const q = $<HTMLInputElement>('#rd-search').value.trim().toLowerCase();
  const rows = rounds
    .filter((r) => (filter === 'waiting' ? isWaiting(r) : filter === 'checked' ? !isWaiting(r) : true))
    .filter((r) => matches(r, q));
  const waiting = rounds.filter(isWaiting).length;
  $('#rd-summary').textContent = `${waiting} didn’t pass the route check · ${rounds.length} ${rounds.length === 1 ? 'round' : 'rounds'} in total.`;
  $('#rd-list').innerHTML = rows.length
    ? rows.map(entryHtml).join('')
    : `<p class="muted">${filter === 'waiting' && !q ? 'Every round passed the route check.' : 'No rounds match.'}</p>`;
}

document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) =>
  b.addEventListener('click', () => {
    filter = b.dataset.filter as typeof filter;
    document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderRounds();
  }),
);
$('#rd-search').addEventListener('input', renderRounds);

$('#rd-list').addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
  if (!btn) return;
  const card = btn.closest<HTMLElement>('[data-id]')!;
  const id = card.dataset.id!;
  const r = rounds.find((x) => x.id === id);
  if (!r) return;
  const act = btn.dataset.act;
  btn.disabled = true;
  try {
    if (act === 'remove') {
      if (!confirm(`Remove ${r.name}'s round and its evidence? This can't be undone.`)) return;
      await api(`/api/rounds/${id}`, { method: 'DELETE' });
      await load();
    } else if (act === 'gpx' || act === 'photo') {
      const res = await api(`/api/admin/evidence/${id}/${act}`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      blobUrls.push(url);
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

// ---------- Contacts ----------

interface Contact {
  name: string;
  email: string;
  rounds: number;
  latest: string;
  best: number;
}

function contacts(): Contact[] {
  const map = new Map<string, Contact>();
  for (const r of rounds) {
    if (!r.email) continue;
    const key = r.email.toLowerCase();
    const c = map.get(key) ?? { name: r.name, email: r.email, rounds: 0, latest: r.date, best: 0 };
    c.rounds++;
    if (r.date >= c.latest) {
      c.latest = r.date;
      c.name = r.name;
    }
    if (r.secs && (!c.best || r.secs < c.best)) c.best = r.secs;
    map.set(key, c);
  }
  return [...map.values()].sort((a, b) => b.latest.localeCompare(a.latest));
}

function renderContacts() {
  const q = $<HTMLInputElement>('#ct-search').value.trim().toLowerCase();
  const list = contacts().filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  $('#ct-rows').innerHTML = list
    .map(
      (c) =>
        `<tr><td>${esc(c.name)}</td><td><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></td><td>${c.rounds}</td><td>${formatDate(c.latest)}</td><td>${formatDuration(c.best)}</td></tr>`,
    )
    .join('');
  $('#ct-empty').hidden = list.length > 0;
}

$('#ct-search').addEventListener('input', renderContacts);

$('#ct-copy').addEventListener('click', async () => {
  const emails = contacts().map((c) => c.email).join(', ');
  const btn = $<HTMLButtonElement>('#ct-copy');
  try {
    await navigator.clipboard.writeText(emails);
    btn.textContent = 'Copied';
  } catch {
    prompt('Copy these email addresses:', emails);
  }
  setTimeout(() => (btn.textContent = 'Copy all emails'), 2000);
});

$('#ct-csv').addEventListener('click', () => {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['Name', 'Email', 'Rounds', 'Latest round', 'Best time'], ...contacts().map((c) => [c.name, c.email, c.rounds, c.latest, c.best ? formatDuration(c.best) : ''])];
  const blob = new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `postmans-challenge-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// ---------- Start ----------

if (token) {
  load()
    .then(showApp)
    .catch(() => {});
}
