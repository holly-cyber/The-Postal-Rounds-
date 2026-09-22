/**
 * Home page behaviour, ported from the prototype's inline script. Storage moved
 * server-side: the round book comes from GET /api/rounds, entries go to POST /api/rounds.
 */
import { LIMITS } from '../lib/config.ts';
import { GpxError, parseGpx, type GpxResult } from '../lib/gpx.ts';
import { formatDate, formatDuration, sortForView, todayInShap, type PublicRound, type View } from '../lib/rounds.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let parsed: GpxResult | null = null;
let entries: PublicRound[] = [];
let view: View = 'date';

const today = todayInShap();
$<HTMLInputElement>('date').max = today;

/* ---------- GPX instant feedback ---------- */

function showGpx(r: GpxResult) {
  const box = $('gpxres');
  box.textContent = '';
  const head = document.createElement('div');
  head.className = r.passed ? 'ok' : 'no';
  head.textContent = r.passed ? 'Route checked: this is the full Shap round.' : 'This track doesn’t look like the full round yet.';
  box.appendChild(head);
  const ul = document.createElement('ul');
  for (const c of r.checks) {
    const li = document.createElement('li');
    li.textContent = (c.pass ? '✓ ' : '✗ ') + c.label;
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = c.pass ? ' (passed)' : ' (not passed)';
    li.appendChild(sr);
    ul.appendChild(li);
  }
  box.appendChild(ul);
  if (!r.passed) {
    const p = document.createElement('div');
    p.className = 'hint';
    p.textContent = 'You can still add your round. It will show as waiting for a check.';
    box.appendChild(p);
  }
}

function gpxError(message: string) {
  const box = $('gpxres');
  box.textContent = '';
  const d = document.createElement('div');
  d.className = 'no';
  d.textContent = message;
  box.appendChild(d);
}

$<HTMLInputElement>('gpx').addEventListener('change', async (e) => {
  parsed = null;
  $('gpxres').textContent = '';
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  if (f.size > LIMITS.gpxMaxBytes) {
    gpxError('That file is over 10 MB. Export a GPX without extra sensor data.');
    return;
  }
  try {
    parsed = parseGpx(await f.text());
    showGpx(parsed);
    if (parsed.startDate && parsed.startDate <= today) $<HTMLInputElement>('date').value = parsed.startDate;
    if (parsed.elapsedSecs) {
      const mins = Math.round(parsed.elapsedSecs / 60);
      $<HTMLInputElement>('hh').value = String(Math.floor(mins / 60));
      $<HTMLInputElement>('mm').value = String(mins % 60).padStart(2, '0');
    }
  } catch (err) {
    gpxError(err instanceof GpxError ? err.message : 'That file isn’t a readable GPX file.');
  }
});

/* ---------- Upload preparation (stay under Netlify's request size limit) ---------- */

async function gzip(file: File): Promise<Blob> {
  if (typeof CompressionStream === 'undefined') return file;
  return new Response(file.stream().pipeThrough(new CompressionStream('gzip'))).blob();
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
    return (await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))) ?? file;
  } catch {
    return file;
  }
}

/* ---------- Submit ---------- */

function setMsg(t: string, err = false) {
  const m = $('msg');
  m.textContent = t;
  m.className = 'msg' + (err ? ' err' : '');
}

const form = $<HTMLFormElement>('f');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const val = (id: string) => $<HTMLInputElement>(id).value.trim();
  const name = val('name');
  const date = val('date');
  const link = val('link');
  const m = parseInt(val('mm'), 10) || 0;
  const gpxFile = $<HTMLInputElement>('gpx').files?.[0];
  const photo = $<HTMLInputElement>('photo').files?.[0];

  const focusErr = (msg: string, id?: string) => {
    setMsg(msg, true);
    if (id) $(id).focus();
  };
  if (!name) return focusErr('Add your name so we can put you in the round book.', 'name');
  if (!date) return focusErr('Add the date you completed the round.', 'date');
  if (date > todayInShap()) return focusErr('The date can’t be in the future.', 'date');
  if (m > 59) return focusErr('Minutes must be between 0 and 59.', 'mm');
  if (link && !/^https:\/\//i.test(link)) return focusErr('Activity links must start with https://', 'link');
  if (!gpxFile && !link && !photo) return focusErr('Add a GPX file, an activity link or a photo so we can check your round.');
  if (photo && photo.size > LIMITS.photoMaxBytes) return focusErr('That photo is over 8 MB.', 'photo');
  if (photo && !(LIMITS.photoTypes as readonly string[]).includes(photo.type)) {
    return focusErr('Photos must be JPEG, PNG or WebP.', 'photo');
  }

  const fd = new FormData(form); // name, mode, date, hours, minutes, link, note, website
  const submit = $<HTMLButtonElement>('submit');
  submit.disabled = true;
  setMsg('Adding your round…');
  try {
    let size = 0;
    if (gpxFile) {
      const z = await gzip(gpxFile);
      size += z.size;
      fd.append('gpx', z, 'round.gpx.gz');
    }
    if (photo) {
      const p = await shrinkPhoto(photo);
      size += p.size;
      fd.append('photo', p, p === photo ? photo.name : 'photo.jpg');
    }
    if (size > LIMITS.uploadBudgetBytes) {
      setMsg('Those files are too big to send together. Try a smaller photo, or just the GPX.', true);
      return;
    }

    const res = await fetch('/api/rounds', { method: 'POST', body: fd });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(body.error ?? 'Your round couldn’t be saved. Try again in a moment.', true);
      return;
    }
    const entry = body.entry as PublicRound | undefined;
    form.reset();
    parsed = null;
    $('gpxres').textContent = '';
    setMsg(
      entry?.gpxChecked
        ? 'Your round is in the book. Well delivered.'
        : 'Your round is in the book. It will show as checked once the Birchwood team has looked at your evidence.',
    );
    await load();
    $('board').scrollIntoView();
  } catch {
    setMsg('Your round couldn’t be saved. Try again in a moment.', true);
  } finally {
    submit.disabled = false;
  }
});

/* ---------- Round book ---------- */

const tabs = [...document.querySelectorAll<HTMLButtonElement>('.tabs button')];
tabs.forEach((b) =>
  b.addEventListener('click', () => {
    view = b.dataset.view as View;
    tabs.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }),
);

function render() {
  const rows = $('rows');
  rows.textContent = '';
  const list = sortForView(entries, view);
  if (view === 'date') {
    $('count').textContent = list.length
      ? `${list.length}${list.length === 1 ? ' round' : ' rounds'} completed, newest first.`
      : 'Everyone who has completed the Shap round, newest first.';
  } else {
    $('count').textContent = `Fastest checked ${view === 'run' ? 'runs' : 'walks'}. Only rounds with a checked GPX or a verified entry are ranked.`;
  }
  const empty = $('empty');
  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.textContent =
      view === 'date'
        ? 'No rounds logged yet. Be the first name in the Shap round book.'
        : `No checked ${view === 'run' ? 'runs' : 'walks'} yet. Log yours with a GPX file to take the top spot.`;
  }
  list.forEach((e, i) => {
    const tr = document.createElement('tr');
    const td = () => tr.appendChild(document.createElement('td'));
    const p = td();
    p.className = 'pos';
    p.textContent = String(i + 1);
    const w = td();
    const n = document.createElement('div');
    n.className = 'who';
    n.textContent = e.name || 'Someone';
    w.appendChild(n);
    const s = document.createElement('div');
    s.className = 'sub';
    s.textContent = (e.mode === 'run' ? 'Ran' : 'Walked') + (e.km ? `, ${e.km} km` : '');
    w.appendChild(s);
    if (e.note) {
      const q = document.createElement('div');
      q.className = 'sub';
      q.style.fontStyle = 'italic';
      q.textContent = `“${e.note}”`;
      w.appendChild(q);
    }
    td().textContent = formatDate(e.date);
    td().textContent = formatDuration(e.secs);
    const ev = td();
    const tag = (t: string, c: string) => {
      const x = document.createElement('span');
      x.className = `tag ${c}`;
      x.textContent = t;
      ev.appendChild(x);
    };
    if (e.verified) tag('Verified', 'v');
    if (e.gpxChecked) tag('GPX checked', 'g');
    if (!e.verified && !e.gpxChecked) tag('Waiting for check', 'p');
    if (e.link && /^https:\/\//i.test(e.link)) {
      const a = document.createElement('a');
      a.href = e.link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer nofollow ugc';
      a.textContent = 'Activity';
      a.className = 'sub';
      ev.appendChild(document.createElement('br'));
      ev.appendChild(a);
    }
    rows.appendChild(tr);
  });
}

async function load() {
  try {
    const res = await fetch('/api/rounds', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    entries = (await res.json()).rounds as PublicRound[];
    render();
  } catch {
    const empty = $('empty');
    empty.hidden = false;
    empty.textContent = 'The round book couldn’t load. Reload the page to try again.';
  }
}

load();
