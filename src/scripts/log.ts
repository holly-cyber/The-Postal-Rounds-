/**
 * Post your round page: instant GPX feedback and sending the entry to POST /api/rounds.
 * The round book itself lives on /round-book/ (src/scripts/roundbook.ts).
 */
import { BIRCHWOOD, LIMITS, ROUNDS, type RoundId } from '../lib/config.ts';
import { GpxError, checkPoints, parsePoints, type GpxPoint, type GpxResult } from '../lib/gpx.ts';
import { formatDate, formatDuration, todayInShap, type Mode, type PublicRound } from '../lib/rounds.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let gpxText: string | null = null;

const chosenRound = () =>
  (document.querySelector<HTMLInputElement>('input[name=round]:checked')?.value ?? 'long') as RoundId;

const today = todayInShap();
$<HTMLInputElement>('date').max = today;

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
  head.textContent = r.passed ? `Route checked: this is ${name}.` : `This track doesn’t look like ${name} yet.`;
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
    ul.appendChild(li);
  });
  card.appendChild(ul);

  if (r.passed) {
    const frank = document.createElement('div');
    frank.className = 'frank';
    frank.setAttribute('aria-hidden', 'true');
    frank.style.setProperty('--n', String(r.checks.length));
    const round = chosenRound() === 'long' ? 'LONG ROUND' : 'SHORT ROUND';
    for (const [tag, t] of [['span', 'SHAP'], ['strong', 'CHECKED'], ['span', round]] as const) {
      const e = document.createElement(tag);
      e.textContent = t;
      frank.appendChild(e);
    }
    card.appendChild(frank);
  } else {
    const p = document.createElement('p');
    p.className = 'hint';
    p.style.margin = '0.6rem 0 0';
    p.textContent = 'You can still post your round. It will show as waiting for a check.';
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

/** Date from the file's metadata, for GPX files without timed track points. */
function metadataDate(text: string): string | null {
  const t = text.match(/<metadata>[\s\S]*?<time>\s*([^<]+?)\s*<\/time>/i)?.[1];
  const ms = t ? Date.parse(t) : NaN;
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
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

    // Which round? Pick the one the track passes; the long round wins if both do.
    const long = checkPoints(gpxPoints, 'long');
    const short = checkPoints(gpxPoints, 'short');
    // If neither passes, go by distance: nearer to 23.7 km is the long round, nearer to 16.6 km the short.
    const byDistance: RoundId =
      Math.abs(long.km - ROUNDS.long.km) <= Math.abs(long.km - ROUNDS.short.km) ? 'long' : 'short';
    const round: RoundId = long.passed ? 'long' : short.passed ? 'short' : long.km >= 8 ? byDistance : chosenRound();
    const filled: string[] = [];
    if (long.passed || short.passed || long.km >= 8) {
      setRadio('round', round);
      flash(document.querySelector('[aria-labelledby=roundlbl]'));
      filled.push(ROUNDS[round].name.replace(/^The /, 'the '));
    }
    const parsed = round === 'long' ? long : round === 'short' ? short : checkPoints(gpxPoints, round);

    const mode = guessMode(gpxText, parsed);
    if (mode) {
      setRadio('mode', mode);
      flash(document.querySelector('[aria-labelledby=modelbl]'));
      filled.push(mode === 'run' ? 'ran' : 'walked');
    }
    const date = parsed.startDate ?? metadataDate(gpxText);
    if (date && date <= today) {
      $<HTMLInputElement>('date').value = date;
      flash($('date'));
      filled.push(formatDate(date));
    }
    if (parsed.elapsedSecs) {
      const mins = Math.round(parsed.elapsedSecs / 60);
      $<HTMLInputElement>('hh').value = String(Math.floor(mins / 60));
      $<HTMLInputElement>('mm').value = String(mins % 60).padStart(2, '0');
      flash(document.querySelector('.time'));
      filled.push(formatDuration(parsed.elapsedSecs));
    }

    showGpx(parsed);
    const missing: string[] = [];
    if (!mode) missing.push('whether you walked or ran');
    if (!date) missing.push('the date');
    if (!parsed.elapsedSecs) missing.push('your time');
    let msg = filled.length
      ? `Filled in from your GPX: ${filled.join(', ')}. Check it’s right and change anything that isn’t.`
      : '';
    if (missing.length) {
      const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)}` : missing[0];
      msg += `${msg ? ' ' : ''}${
        parsed.elapsedSecs ? '' : 'This GPX has no timings in it, so it may be a planned route rather than your recorded activity. '
      }Please add ${list} yourself.`;
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
  if (!f) return;
  if (f.size > LIMITS.gpxMaxBytes) {
    gpxError('That file is over 10 MB. Export a GPX without extra sensor data.');
    return;
  }
  gpxText = await f.text();
  checkGpx(true);
});

document.querySelectorAll<HTMLInputElement>('input[name=round]').forEach((r) =>
  r.addEventListener('change', () => checkGpx(false)),
);

/* Photo: show it as a little snapshot. */
let snapUrl: string | null = null;
$<HTMLInputElement>('photo').addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (snapUrl) URL.revokeObjectURL(snapUrl);
  snapUrl = f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null;
  $('snap').hidden = !snapUrl;
  if (snapUrl) $<HTMLImageElement>('snap-img').src = snapUrl;
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
  if (!$<HTMLInputElement>('consent').checked) {
    return focusErr('Please tick the box to agree to your round appearing in the round book.', 'consent');
  }
  if (photo && photo.size > LIMITS.photoMaxBytes) return focusErr('That photo is over 8 MB.', 'photo');
  if (photo && !(LIMITS.photoTypes as readonly string[]).includes(photo.type)) {
    return focusErr('Photos must be JPEG, PNG or WebP.', 'photo');
  }

  const fd = new FormData(form); // name, mode, date, hours, minutes, link, note, website
  const submit = $<HTMLButtonElement>('submit');
  submit.disabled = true;
  setMsg('Posting your round…');
  submit.textContent = 'Posting…';
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
      setMsg(body.error ?? 'Your round couldn’t be posted. Try again in a moment.', true);
      return;
    }
    const entry = body.entry as PublicRound | undefined;
    showPosted(entry, name);
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
    : `Well delivered, ${name}. You ${how}${time}. You’re in the book now and will show as checked once we’ve looked at your evidence.`;
  $<HTMLAnchorElement>('posted-link').href = checked ? `/round-book/?round=${round}&mode=${mode}#board` : '/round-book/#everyone';
  $('posted-year').textContent = String(new Date().getFullYear());

  form.reset();
  gpxText = null;
  gpxPoints = [];
  $('gpxres').textContent = '';
  setPostbox();
  $('snap').hidden = true;
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
  $<HTMLInputElement>('date').value = '';
  $<HTMLInputElement>('name').focus();
});
