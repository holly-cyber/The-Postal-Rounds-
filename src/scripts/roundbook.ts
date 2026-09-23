/**
 * The round book page: round records, a filterable leaderboard (round, walk/run,
 * category, age group) and everyone newest first. Filters are kept in the URL so a
 * view can be shared, e.g. /round-book/?round=long&mode=run&sex=F&age=40-49
 */
import { ROUNDS, type RoundId } from '../lib/config.ts';
import {
  AGE_LABELS,
  categoryLabel,
  formatDate,
  formatDuration,
  isAgeGroup,
  leaderboard,
  sortForView,
  type BoardFilter,
  type Mode,
  type PublicRound,
} from '../lib/rounds.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let entries: PublicRound[] = [];

// ---------- Filter state (from and to the URL) ----------

function readFilter(): BoardFilter {
  const q = new URLSearchParams(location.search);
  const round = q.get('round') === 'short' ? 'short' : 'long';
  const mode = q.get('mode') === 'walk' ? 'walk' : 'run';
  const sexQ = q.get('sex');
  const sex = sexQ === 'F' || sexQ === 'M' ? sexQ : 'all';
  const ageQ = q.get('age') ?? '';
  const age = isAgeGroup(ageQ) ? ageQ : 'all';
  return { round, mode, sex, age };
}

let filter = readFilter();

function writeFilter() {
  const q = new URLSearchParams();
  if (filter.round !== 'long') q.set('round', filter.round);
  if (filter.mode !== 'run') q.set('mode', filter.mode);
  if (filter.sex !== 'all') q.set('sex', filter.sex);
  if (filter.age !== 'all') q.set('age', filter.age);
  const qs = q.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function syncControls() {
  document.querySelectorAll<HTMLButtonElement>('button[data-f]').forEach((b) => {
    const key = b.dataset.f as 'round' | 'mode' | 'sex';
    b.setAttribute('aria-pressed', String(String(filter[key]) === b.dataset.v));
  });
  $<HTMLSelectElement>('f-age').value = filter.age;
}

document.querySelectorAll<HTMLButtonElement>('button[data-f]').forEach((b) =>
  b.addEventListener('click', () => {
    const key = b.dataset.f as 'round' | 'mode' | 'sex';
    filter = { ...filter, [key]: b.dataset.v } as BoardFilter;
    writeFilter();
    syncControls();
    renderBoard();
  }),
);
$<HTMLSelectElement>('f-age').addEventListener('change', (e) => {
  const v = (e.target as HTMLSelectElement).value;
  filter = { ...filter, age: isAgeGroup(v) ? v : 'all' };
  writeFilter();
  renderBoard();
});

// ---------- Small DOM helpers ----------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function evidenceCell(r: PublicRound): HTMLTableCellElement {
  const td = el('td');
  const tag = (t: string, c: string) => td.appendChild(el('span', `tag ${c}`, t));
  if (r.verified) tag('Verified', 'v');
  if (r.gpxChecked) tag('GPX checked', 'g');
  if (!r.verified && !r.gpxChecked) tag('Waiting for check', 'p');
  if (r.link && /^https:\/\//i.test(r.link)) {
    const a = el('a', 'sub', 'Activity');
    a.href = r.link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow ugc';
    td.append(document.createElement('br'), a);
  }
  return td;
}

function nameCell(r: PublicRound): HTMLTableCellElement {
  const td = el('td');
  td.appendChild(el('div', 'who', r.name || 'Someone'));
  if (r.note) {
    const q = el('div', 'sub', `“${r.note}”`);
    q.style.fontStyle = 'italic';
    td.appendChild(q);
  }
  return td;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const roundName = (id: RoundId) => (id === 'short' ? 'Short' : 'Long');
const modeWord = (m: Mode) => (m === 'run' ? 'run' : 'walk');

// ---------- Round records ----------

function renderRecords() {
  const box = $('records');
  box.textContent = '';
  const slots: [RoundId, Mode][] = [
    ['long', 'run'],
    ['long', 'walk'],
    ['short', 'run'],
    ['short', 'walk'],
  ];
  for (const [round, mode] of slots) {
    const best = leaderboard(entries, { round, mode, sex: 'all', age: 'all' })[0];
    const card = el('a', `stamp record${best ? '' : ' vacant'}`);
    card.href = `?round=${round}&mode=${mode}#board`;
    card.style.textDecoration = 'none';
    card.appendChild(el('p', 'record-what', `${ROUNDS[round].name.replace(/^The /, '')} · fastest ${modeWord(mode)}`));
    if (best) {
      card.appendChild(el('p', 'record-time', formatDuration(best.secs)));
      card.appendChild(el('p', 'record-who', best.name));
      card.appendChild(el('p', 'record-when', formatDate(best.date)));
    } else {
      card.appendChild(el('p', 'record-time', 'Up for grabs'));
      card.appendChild(el('p', 'record-when', 'Post a checked round to set the first time.'));
    }
    box.appendChild(card);
  }
}

// ---------- Leaderboard ----------

function describe(f: BoardFilter): string {
  const who = f.sex === 'F' ? 'Female ' : f.sex === 'M' ? 'Male ' : '';
  const age = f.age !== 'all' ? `, ${AGE_LABELS[f.age]}` : '';
  const what = f.mode === 'run' ? 'runners' : 'walkers';
  return `${cap(`${who}${what}${age}`)} · ${cap(ROUNDS[f.round].name.replace(/^The /, ''))}`;
}

function renderBoard() {
  const rows = $('board-rows');
  rows.textContent = '';
  const list = leaderboard(entries, filter);
  const label = describe(filter);
  $('board-caption').textContent = `Leaderboard: ${label}`;
  $('board-summary').textContent = `${label} · ${list.length} ${list.length === 1 ? 'round' : 'rounds'}`;
  const empty = $('board-empty');
  empty.hidden = list.length > 0;
  if (!list.length) {
    empty.textContent = `No checked ${filter.mode === 'run' ? 'runs' : 'walks'} here yet. Post yours with a GPX file to take the top spot.`;
  }
  list.forEach((r, i) => {
    const tr = el('tr', i < 3 ? `top${i + 1}` : '');
    const pos = el('td', 'pos');
    if (i < 3) pos.appendChild(el('span', 'medal', String(i + 1)));
    else pos.textContent = String(i + 1);
    tr.append(
      pos,
      nameCell(r),
      el('td', 'cat', categoryLabel(r) || '–'),
      el('td', 'time', formatDuration(r.secs)),
      el('td', '', formatDate(r.date)),
      evidenceCell(r),
    );
    rows.appendChild(tr);
  });
}

// ---------- Everyone, newest first ----------

function renderEveryone() {
  const rows = $('everyone-rows');
  rows.textContent = '';
  const list = sortForView(entries, 'date');
  $('everyone-count').textContent = list.length
    ? `${list.length} ${list.length === 1 ? 'round' : 'rounds'} posted so far.`
    : '';
  const empty = $('everyone-empty');
  empty.hidden = list.length > 0;
  if (!list.length) empty.textContent = 'No rounds posted yet. Be the first name in the book.';
  for (const r of list) {
    const tr = el('tr');
    tr.append(
      nameCell(r),
      el('td', '', `${roundName(r.round)} · ${r.mode === 'run' ? 'Ran' : 'Walked'}${r.km ? `, ${r.km} km` : ''}`),
      el('td', 'cat', categoryLabel(r) || '–'),
      el('td', 'time', formatDuration(r.secs)),
      el('td', '', formatDate(r.date)),
      evidenceCell(r),
    );
    rows.appendChild(tr);
  }
}

// ---------- Load ----------

async function load() {
  try {
    const res = await fetch('/api/rounds', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    entries = (await res.json()).rounds as PublicRound[];
    renderRecords();
    renderBoard();
    renderEveryone();
  } catch {
    for (const id of ['board-empty', 'everyone-empty']) {
      const e = $(id);
      e.hidden = false;
      e.textContent = 'The round book couldn’t load. Reload the page to try again.';
    }
    $('records').textContent = '';
  }
}

syncControls();
load();
