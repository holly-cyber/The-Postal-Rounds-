/**
 * Post your round page: instant GPX feedback and sending the entry to POST /api/rounds.
 * The round book itself lives on /round-book/ (src/scripts/roundbook.ts).
 */
import { BIRCHWOOD, LIMITS, ROUNDS, type RoundId } from '../lib/config.ts';
import { GpxError, checkPoints, parsePoints, type GpxPoint, type GpxResult } from '../lib/gpx.ts';
import { formatDate, formatDuration, todayInShap, type Mode, type PublicRound } from '../lib/rounds.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let gpxText: string | null = null;

/** There is one round now; kept as a function so the checks read the same as before. */
const chosenRound = (): RoundId => 'long';

const today = todayInShap();

/* ---------- GPX instant feedback ---------- */

const SVG = 'http://www.w3.org/2000/svg';
let gpxPoints: GpxPoint[] = [];

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** Draw the track as a little map, with Birchwood Cafe marked. Stays on the device. */
function drawTrack(pts: GpxPoint[]): SVGSVGElement | null {
  if (pts.length < 2) return null;
  const step = Math.max(1, Math.ceil(pts.length / 600));
  const sample = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  const all = [...sample, BIRCHWOOD];
  const k = Math.cos((BIRCHWOOD.lat * Math.PI) / 180);
  const xs = all.map((p) => p.lon * k);
  const ys = all.map((p) => -p.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 320;
  const H = 200;
  const pad = 14;
  const scale = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * scale) / 2;
  const oy = (H - (y1 - y0) * scale) / 2;
  const at = (p: { lat: number; lon: number }) =>
    [ox + (p.lon * k - x0) * scale, oy + (-p.lat - y0) * scale].map((n) => n.toFixed(1));
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gpx-track', role: 'img', 'aria-label': 'Your route, drawn from your GPX file' });
  svg.appendChild(svgEl('polyline', { class: 'trace', pathLength: '1', points: sample.map((p) => at(p).join(',')).join(' ') }));
  const [hx, hy] = at(BIRCHWOOD);
  svg.appendChild(svgEl('circle', { class: 'home', cx: hx, cy: hy, r: '5' }));
  const label = svgEl('text', { class: 'home-label', x: String(+hx + 9), y: String(+hy + 4) });
  label.textContent = 'Birchwood Cafe';
  svg.appendChild(label);
  return svg;
}

function stat(value: string, unit: string) {
  const d = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = value;
  const s = document.createElement('span');
  s.textContent = unit;
  d.append(b, s);
  return d;
}

function showGpx(r: GpxResult) {
  const box = $('gpxres');
  box.textContent = '';
  const card = document.createElement('div');
  card.className = `gpx-card ${r.passed ? 'ok' : 'no'}`;

  const map = drawTrack(gpxPoints);
  if (map) card.appendChild(map);

  const stats = document.createElement('div');
  stats.className = 'gpx-stats';
  stats.appendChild(stat(r.km.toFixed(1), 'km'));
  if (r.elapsedSecs) stats.appendChild(stat(formatDuration(r.elapsedSecs), 'time'));
  if (r.startDate) stats.appendChild(stat(formatDate(r.startDate), 'date'));
  card.appendChild(stats);

  const head = document.createElement('p');
  head.className = 'gpx-head';
  const name = ROUNDS[chosenRound()].name.replace(/^The /, 'the ');
  const planned = !r.timed;
  head.textContent = r.passed
    ? `Route checked: this is ${name}.`
    : planned
      ? 'This looks like a planned route, not a recorded activity.'
      : `This track doesn’t look like ${name} yet.`;
  card.appendChild(head);

  const ul = document.createElement('ul');
  ul.className = 'deliveries';
  r.checks.forEach((c, i) => {
    const li = document.createElement('li');
    li.className = c.pass ? 'pass' : 'fail';
    li.style.setProperty('--i', String(i));
    const mark = document.createElement('span');
    mark.className = 'mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = c.pass ? '✓' : '✗';
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = c.pass ? ' (passed)' : ' (not passed)';
    li.append(mark, c.label, sr);
    if (!c.pass && c.id === 'recorded') {
      const why = document.createElement('span');
      why.className = 'why';
      why.textContent = c.detail;
      li.appendChild(why);
    }
    ul.appendChild(li);
  });
  card.appendChild(ul);

  if (r.passed) {
    const frank = document.createElement('div');
    frank.className = 'frank';
    frank.setAttribute('aria-hidden', 'true');
    frank.style.setProperty('--n', String(r.checks.length));
    for (const [tag, t] of [['span', 'SHAP'], ['strong', 'CHECKED'], ['span', 'THE ROUND']] as const) {
      const e = document.createElement(tag);
      e.textContent = t;
      frank.appendChild(e);
    }
    card.appendChild(frank);
  } else {
    const p = document.createElement('p');
    p.className = 'hint';
    p.style.margin = '0.6rem 0 0';
    p.textContent = planned
      ? 'A planned route can’t be posted. Choose the GPX of your recorded walk or run instead.'
      : 'You can still post your round, but it won’t count towards the fastest times.';
    card.appendChild(p);
  }
  box.appendChild(card);
}

function gpxError(message: string) {
  const box = $('gpxres');
  box.textContent = '';
  const d = document.createElement('div');
  d.className = 'no';
  d.textContent = message;
  box.appendChild(d);
}

/**
 * Walk or run. Apps label it in different places: <type> (Strava, Garmin), <os:activity> (OS Maps),
 * <sport>/<activity> (others), or the activity name ("Morning Run", "Afternoon Hike").
 * Strava's older numeric types: 9 = run, 10 = walk, 4 = hike. Falls back to average pace.
 */
function guessMode(text: string, r: GpxResult): Mode | null {
  const grab = (re: RegExp) => [...text.matchAll(re)].map((m) => m[1].toLowerCase()).join(' | ');
  const types = grab(/<(?:[\w-]+:)?(?:type|activity|sport|activitytype)>\s*([^<]{1,40}?)\s*</gi);
  const names = grab(/<(?:[\w-]+:)?name>\s*([^<]{1,80}?)\s*</gi);
  if (/run|jog|^9$|\| 9\b/.test(types)) return 'run';
  if (/walk|hik|trek|^(10|4)$|\| (10|4)\b/.test(types)) return 'walk';
  if (/\brun\b|\brunning\b|\bjog/.test(names)) return 'run';
  if (/\bwalk|\bhike|\bhiking|\btrek|\bramble/.test(names)) return 'walk';
  if (!r.elapsedSecs || !r.km) return null;
  // Round runners average 6–8 km/h including stops; walkers 3–4.5 km/h.
  return r.km / (r.elapsedSecs / 3600) >= 5.5 ? 'run' : 'walk';
}

function setRadio(name: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[name=${name}][value=${value}]`);
  if (input) input.checked = true;
}

/** Briefly highlight a field we filled in, so people can see what changed. */
function flash(el: Element | null) {
  if (!el) return;
  el.classList.remove('filled');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('filled');
}

/** Re-check the chosen GPX against the chosen round. On a new file, also fill in the form from it. */
function checkGpx(prefill: boolean): GpxResult | null {
  if (gpxText === null) return null;
  try {
    if (!prefill) {
      const parsed = checkPoints(gpxPoints, chosenRound());
      showGpx(parsed);
      return parsed;
    }
    gpxPoints = parsePoints(gpxText);
    const parsed = checkPoints(gpxPoints, chosenRound());
    const filled: string[] = [];

    const mode = guessMode(gpxText, parsed);
    if (mode) {
      setRadio('mode', mode);
      flash(document.querySelector('[aria-labelledby=modelbl]'));
      filled.push(mode === 'run' ? 'ran' : 'walked');
    }
    showGpx(parsed);
    // Date, time and distance are read from the GPX (the server does the same); they can't be typed in.
    let msg = '';
    if (parsed.timed && parsed.startDate && parsed.elapsedSecs) {
      msg = `From your GPX: ${formatDate(parsed.startDate)}, ${formatDuration(parsed.elapsedSecs)}, ${parsed.km.toFixed(1)} km${
        mode ? `, ${mode === 'run' ? 'ran' : 'walked'}` : ''
      }. That’s what goes in the round book.`;
      if (parsed.startDate > today) msg = 'The date in this GPX is in the future, so it can’t be posted.';
    }
    if (msg) {
      const note = document.createElement('p');
      note.className = 'gpx-filled';
      note.textContent = msg;
      $('gpxres').querySelector('.gpx-card')?.appendChild(note);
    }
    return parsed;
  } catch (err) {
    gpxError(err instanceof GpxError ? err.message : 'That file isn’t a readable GPX file.');
    return null;
  }
}

/* The postbox: lift on drag-over, swallow the letter when a file goes in. */
const postbox = $('postbox');
const setPostbox = (file?: File) => {
  postbox.classList.toggle('has-file', !!file);
  $('gpx-title').textContent = file ? file.name : 'Drop your GPX in the postbox';
  $('gpx-help').textContent = file ? 'In the post. Tap to choose a different file.' : 'or tap to choose a file. We’ll check it on the spot.';
  if (file) {
    postbox.classList.remove('dropped');
    void postbox.offsetWidth; // restart the animation
    postbox.classList.add('dropped');
  }
};
postbox.addEventListener('dragenter', () => postbox.classList.add('over'));
postbox.addEventListener('dragover', () => postbox.classList.add('over'));
for (const ev of ['dragleave', 'drop']) postbox.addEventListener(ev, () => postbox.classList.remove('over'));

$<HTMLInputElement>('gpx').addEventListener('change', async (e) => {
  gpxText = null;
  gpxPoints = [];
  $('gpxres').textContent = '';
  const f = (e.target as HTMLInputElement).files?.[0];
  setPostbox(f);
  if ($('msg').classList.contains('err')) setMsg('');
  if (!f) return;
  if (f.size > LIMITS.gpxMaxBytes) {
    gpxError('That file is over 10 MB. Export a GPX without extra sensor data.');
    return;
  }
  gpxText = await f.text();
  checkGpx(true);
});


/* ---------- Upload preparation (stay under Netlify's request size limit) ---------- */

async function gzip(file: File): Promise<Blob> {
  if (typeof CompressionStream === 'undefined') return file;
  return new Response(file.stream().pipeThrough(new CompressionStream('gzip'))).blob();
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
  const link = val('link');
  const gpxFile = $<HTMLInputElement>('gpx').files?.[0];

  const focusErr = (msg: string, id?: string) => {
    setMsg(msg, true);
    if (id) $(id).focus();
  };
  if (!name) return focusErr('Add your name so we can put you in the round book.', 'name');
  const email = val('email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return focusErr('Add your email address so we can get in touch about your round if we need to.', 'email');
  if (!gpxFile || gpxText === null || !gpxPoints.length) {
    return focusErr('Add the GPX file of your recorded walk or run. It’s how we check your round.', 'gpx');
  }
  if (link && !/^https:\/\//i.test(link)) return focusErr('Activity links must start with https://', 'link');
  const check = checkPoints(gpxPoints, chosenRound());
  if (!check.timed) {
    return focusErr('This GPX has no timings, so it looks like a planned route. Upload the GPX of your recorded walk or run instead.', 'gpx');
  }
  if (check.startDate && check.startDate > todayInShap()) return focusErr('The date in this GPX is in the future.', 'gpx');
  if (!$<HTMLInputElement>('consent').checked) {
    return focusErr('Please tick the box to agree to your round appearing in the round book.', 'consent');
  }

  const fd = new FormData(form); // name, email, mode, sex, ageGroup, link, note, consent, website
  const submit = $<HTMLButtonElement>('submit');
  submit.disabled = true;
  setMsg('Posting your round…');
  submit.textContent = 'Posting…';
  try {
    const z = await gzip(gpxFile);
    if (z.size > LIMITS.uploadBudgetBytes) {
      setMsg('That GPX file is too big to send. Export it without extra sensor data and try again.', true);
      return;
    }
    fd.append('gpx', z, 'round.gpx.gz');

    const res = await fetch('/api/rounds', { method: 'POST', body: fd });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(body.error ?? 'Your round couldn’t be posted. Try again in a moment.', true);
      return;
    }
    const entry = body.entry as PublicRound | undefined;
    showPosted(entry, name);
    copyToNetlifyForms(entry, name, email);
  } catch {
    setMsg('Your round couldn’t be posted. Try again in a moment.', true);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Post my round';
  }
});

/* ---------- Posted and delivered ---------- */

function showPosted(entry: PublicRound | undefined, name: string) {
  const round = entry?.round ?? chosenRound();
  const mode = entry?.mode ?? 'walk';
  const checked = !!(entry?.gpxChecked || entry?.verified);
  const how = `${mode === 'run' ? 'ran' : 'walked'} ${ROUNDS[round].name.replace(/^The /, 'the ')}`;
  const time = entry?.secs ? ` in ${formatDuration(entry.secs)}` : '';
  $('posted-text').textContent = checked
    ? `Well delivered, ${name}. You ${how}${time}, and your GPX is checked, so you’re on the leaderboard.`
    : `Well delivered, ${name}. You ${how}${time}. You’re in the book, but your GPX didn’t pass every route check, so this round won’t count towards the fastest times.`;
  $<HTMLAnchorElement>('posted-link').href = checked ? `/round-book/?round=${round}&mode=${mode}#board` : '/round-book/#everyone';
  $('posted-year').textContent = String(new Date().getFullYear());

  form.reset();
  gpxText = null;
  gpxPoints = [];
  $('gpxres').textContent = '';
  setPostbox();
  setMsg('');
  form.hidden = true;
  const panel = $('posted');
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  panel.focus({ preventScroll: true });
}

$('post-another').addEventListener('click', () => {
  $('posted').hidden = true;
  form.hidden = false;
  $<HTMLInputElement>('name').focus();
});

/**
 * Send a copy of the accepted round to Netlify Forms (form "round-entry" on this page), so it
 * lands in the Netlify Forms inbox and email notifications. Best effort: the round book entry is
 * already saved, so a failure here is ignored.
 */
function copyToNetlifyForms(entry: PublicRound | undefined, name: string, email: string) {
  if (!entry) return;
  const body = new URLSearchParams({
    'form-name': 'round-entry',
    name,
    email,
    mode: entry.mode === 'run' ? 'Ran' : 'Walked',
    category: entry.sex === 'F' ? 'Female' : entry.sex === 'M' ? 'Male' : '',
    ageGroup: entry.ageGroup ?? '',
    date: entry.date,
    time: entry.secs ? formatDuration(entry.secs) : '',
    km: entry.km != null ? String(entry.km) : '',
    evidence: entry.verified ? 'Verified' : entry.gpxChecked ? 'GPX checked' : 'Didn’t pass the route check',
    link: entry.link ?? '',
    note: entry.note ?? '',
  });
  fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }).catch(() => {});
}
