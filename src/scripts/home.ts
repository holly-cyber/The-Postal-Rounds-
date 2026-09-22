import { LIMITS } from '../lib/config.ts';
import { GpxError, parseGpx, type GpxCheck } from '../lib/gpx.ts';
import {
  formatDate,
  formatDuration,
  isConfirmed,
  sortForView,
  statusLabel,
  todayInShap,
  type PublicRound,
  type View,
} from '../lib/rounds.ts';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/* ---------- GPX instant feedback ---------- */

function renderChecks(checks: GpxCheck[], km: number): string {
  const passed = checks.every((c) => c.pass);
  const items = checks
    .map(
      (c) =>
        `<li class="${c.pass ? 'pass' : 'fail'}"><span aria-hidden="true">${c.pass ? '✓' : '✗'}</span> ` +
        `<strong>${esc(c.label)}</strong> — ${esc(c.detail)}<span class="sr-only">${c.pass ? ' (passed)' : ' (not passed)'}</span></li>`,
    )
    .join('');
  const head = passed
    ? `<p class="verdict pass">Looks like the round — ${km.toFixed(1)} km. You'll show as <strong>GPX checked</strong>.</p>`
    : `<p class="verdict fail">This track doesn't pass every check. You can still submit — it'll wait for a manual check.</p>`;
  return `${head}<ul class="checks">${items}</ul>`;
}

const gpxInput = $<HTMLInputElement>('#f-gpx');
const gpxOut = $('#gpx-result');
gpxInput.addEventListener('change', async () => {
  gpxOut.innerHTML = '';
  const file = gpxInput.files?.[0];
  if (!file) return;
  if (file.size > LIMITS.gpxMaxBytes) {
    gpxOut.innerHTML = `<p class="verdict fail">That file is over 10 MB.</p>`;
    return;
  }
  try {
    const result = parseGpx(await file.text());
    gpxOut.innerHTML = renderChecks(result.checks, result.km);
    if (result.startDate) {
      const date = $<HTMLInputElement>('#f-date');
      if (!date.value && result.startDate <= todayInShap()) date.value = result.startDate;
    }
    if (result.elapsedSecs) {
      const h = $<HTMLInputElement>('#f-hours');
      const m = $<HTMLInputElement>('#f-minutes');
      if (!h.value && !m.value) {
        const mins = Math.round(result.elapsedSecs / 60);
        h.value = String(Math.floor(mins / 60));
        m.value = String(mins % 60);
      }
    }
  } catch (e) {
    gpxOut.innerHTML = `<p class="verdict fail">${esc(e instanceof GpxError ? e.message : 'We couldn’t read that file.')}</p>`;
  }
});

/* ---------- Note counter, date max ---------- */

const note = $<HTMLTextAreaElement>('#f-note');
const noteCount = $('#note-count');
note.addEventListener('input', () => {
  noteCount.textContent = `${LIMITS.noteMax - note.value.length} characters left`;
});
$<HTMLInputElement>('#f-date').max = todayInShap();

/* ---------- Upload preparation (stay under Netlify's request size limit) ---------- */

async function gzip(file: File): Promise<Blob> {
  if (typeof CompressionStream === 'undefined') return file;
  const stream = file.stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, LIMITS.photoMaxEdgePx / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return out ?? file;
  } catch {
    return file;
  }
}

/* ---------- Submit ---------- */

const form = $<HTMLFormElement>('#round-form');
const status = $('#form-status');

function showStatus(kind: 'ok' | 'err', html: string) {
  status.className = `status ${kind}`;
  status.innerHTML = html;
}

function clientErrors(fd: FormData, gpx?: File, photo?: File): string | null {
  const name = String(fd.get('name') ?? '').trim();
  if (!name) return 'Please add your name.';
  if (!fd.get('date')) return 'Please add the date of your round.';
  if (String(fd.get('date')) > todayInShap()) return 'The date can’t be in the future.';
  const secs = Number(fd.get('hours') || 0) * 3600 + Number(fd.get('minutes') || 0) * 60;
  if (!secs) return 'Please add your time.';
  const link = String(fd.get('link') ?? '').trim();
  if (link && !link.startsWith('https://')) return 'The link must start with https://';
  if (!gpx && !link && !photo) return 'Add a GPX file, a link or a photo as evidence.';
  if (gpx && gpx.size > LIMITS.gpxMaxBytes) return 'The GPX file is over 10 MB.';
  if (photo && photo.size > LIMITS.photoMaxBytes) return 'The photo is over 8 MB.';
  if (photo && !(LIMITS.photoTypes as readonly string[]).includes(photo.type)) return 'Photos must be JPEG, PNG or WebP.';
  return null;
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const fd = new FormData(form);
  const gpx = gpxInput.files?.[0];
  const photo = $<HTMLInputElement>('#f-photo').files?.[0];
  fd.delete('gpx');
  fd.delete('photo');

  const problem = clientErrors(fd, gpx, photo);
  if (problem) {
    showStatus('err', esc(problem));
    return;
  }

  button.disabled = true;
  showStatus('ok', 'Sending…');
  try {
    let size = 0;
    if (gpx) {
      const z = await gzip(gpx);
      size += z.size;
      fd.append('gpx', z, 'round.gpx.gz');
    }
    if (photo) {
      const p = await shrinkPhoto(photo);
      size += p.size;
      fd.append('photo', p, p === photo ? photo.name : 'photo.jpg');
    }
    if (size > LIMITS.uploadBudgetBytes) {
      showStatus('err', 'Those files are too big to send together. Try a smaller photo, or just the GPX.');
      return;
    }

    const res = await fetch('/api/rounds', { method: 'POST', body: fd });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      showStatus('err', esc(body.error ?? 'Something went wrong. Please try again.'));
      return;
    }
    const entry = body.entry as PublicRound | undefined;
    const msg = entry?.gpxChecked
      ? 'You’re in the round book — <strong>GPX checked</strong>.'
      : 'You’re in the round book. We’ll check your evidence soon — until then it shows as <strong>Waiting for check</strong>.';
    showStatus('ok', `${msg} <a href="#roundbook">See the round book</a>.`);
    form.reset();
    gpxOut.innerHTML = '';
    noteCount.textContent = `${LIMITS.noteMax} characters left`;
    await loadRounds();
  } catch {
    showStatus('err', 'We couldn’t reach the server. Check your connection and try again.');
  } finally {
    button.disabled = false;
  }
});

/* ---------- Round book ---------- */

let rounds: PublicRound[] = [];
let view: View = 'date';
const rbBody = $('#rb-body');
const rbNote = $('#rb-note');
const panel = $('#rb-panel');

function row(r: PublicRound, i: number): string {
  const confirmed = isConfirmed(r);
  const name = r.link
    ? `<a href="${esc(r.link)}" rel="nofollow noopener ugc" target="_blank">${esc(r.name)}<span class="sr-only"> (opens activity link)</span></a>`
    : esc(r.name);
  return `<tr>
    ${view === 'date' ? '' : `<td class="pos">${i + 1}</td>`}
    <td><span class="who">${name}</span>${r.note ? `<span class="rb-note">${esc(r.note)}</span>` : ''}</td>
    <td>${r.mode === 'run' ? 'Run' : 'Walk'}</td>
    <td class="num">${formatDuration(r.secs)}</td>
    <td>${formatDate(r.date)}</td>
    <td><span class="pill ${confirmed ? 'ok' : 'wait'}">${statusLabel(r)}</span></td>
  </tr>`;
}

function render() {
  const rows = sortForView(rounds, view);
  rbNote.textContent =
    view === 'date'
      ? 'Everyone who has logged the round, newest first.'
      : `Only rounds with a checked GPX or verified evidence count here.`;
  if (!rows.length) {
    rbBody.innerHTML =
      view === 'date'
        ? '<p>No rounds logged yet. Be the first!</p>'
        : `<p>No checked ${view === 'run' ? 'runs' : 'walks'} yet.</p>`;
    return;
  }
  rbBody.innerHTML = `<div class="table-wrap"><table class="rb-table">
    <caption class="sr-only">${view === 'date' ? 'Rounds by date' : view === 'run' ? 'Fastest runs' : 'Fastest walks'}</caption>
    <thead><tr>${view === 'date' ? '' : '<th scope="col">#</th>'}<th scope="col">Name</th><th scope="col">Mode</th><th scope="col">Time</th><th scope="col">Date</th><th scope="col">Status</th></tr></thead>
    <tbody>${rows.map(row).join('')}</tbody></table></div>`;
}

async function loadRounds() {
  try {
    const res = await fetch('/api/rounds', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    rounds = (await res.json()).rounds as PublicRound[];
    render();
  } catch {
    rbBody.innerHTML = '<p>The round book couldn’t be loaded just now.</p>';
  }
}

const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role=tab]')];
function select(tab: HTMLButtonElement, focus = false) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  }
  panel.setAttribute('aria-labelledby', tab.id);
  view = tab.dataset.view as View;
  if (focus) tab.focus();
  render();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(t));
  t.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k !== 'ArrowRight' && k !== 'ArrowLeft' && k !== 'Home' && k !== 'End') return;
    e.preventDefault();
    const next =
      k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : (i + (k === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    select(tabs[next], true);
  });
});

loadRounds();
