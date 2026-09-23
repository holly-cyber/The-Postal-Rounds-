/** Shared shapes and helpers for round entries (browser + functions). */
import type { RoundId } from './config.ts';
import type { GpxCheck } from './gpx.ts';

export type Mode = 'walk' | 'run';

/** Optional round book category. Entries without one appear in Overall only. */
export type Sex = 'F' | 'M';
export const SEX_LABELS: Record<Sex, string> = { F: 'Female', M: 'Male' };

/** Optional age group, by age on the day of the round. */
export const AGE_GROUPS = [
  ['U20', 'Under 20'],
  ['20-39', '20–39'],
  ['40-49', '40–49'],
  ['50-59', '50–59'],
  ['60-69', '60–69'],
  ['70+', '70 and over'],
] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number][0];
export const AGE_LABELS = Object.fromEntries(AGE_GROUPS) as Record<AgeGroup, string>;
export const isAgeGroup = (v: string): v is AgeGroup => AGE_GROUPS.some(([k]) => k === v);

/** What GET /api/rounds returns for each entry — nothing else leaves the server. */
export interface PublicRound {
  name: string;
  round: RoundId;
  mode: Mode;
  sex: Sex | null;
  ageGroup: AgeGroup | null;
  date: string;
  secs: number;
  km: number | null;
  gpxChecked: boolean;
  verified: boolean;
  link: string | null;
  note: string | null;
}

/** The full record kept in the `rounds` blob store. Admin only. */
export interface StoredRound extends PublicRound {
  id: string;
  createdAt: string;
  /** When the entrant agreed to their name, date, time and note being shown publicly. */
  consentedAt: string;
  verifiedAt: string | null;
  gpx: {
    points: number;
    elapsedSecs: number | null;
    startDate: string | null;
    checks: GpxCheck[];
  } | null;
  files: {
    gpx?: { key: string; bytes: number };
    photo?: { key: string; type: string; bytes: number };
  };
}

export function toPublic(r: StoredRound): PublicRound {
  return {
    name: r.name,
    round: r.round ?? 'long',
    mode: r.mode,
    sex: r.sex ?? null,
    ageGroup: r.ageGroup ?? null,
    date: r.date,
    secs: r.secs,
    km: r.km,
    gpxChecked: r.gpxChecked,
    verified: r.verified,
    link: r.link,
    note: r.note,
  };
}

export function formatDuration(secs: number): string {
  if (!secs) return '–';
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (m === 60) return `${h + 1}h 00m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Counts towards the fastest-time tables. */
export const isConfirmed = (r: Pick<PublicRound, 'gpxChecked' | 'verified'>) =>
  r.gpxChecked || r.verified;

export type View = 'date' | 'run' | 'walk';

/** Rows for a leaderboard view. Fastest views are per round (long or short). */
export function sortForView<T extends PublicRound>(rows: T[], view: View, round: RoundId = 'long'): T[] {
  if (view === 'date') {
    return [...rows].sort((a, b) => b.date.localeCompare(a.date));
  }
  return rows
    .filter((r) => r.mode === view && r.round === round && r.secs > 0 && isConfirmed(r))
    .sort((a, b) => a.secs - b.secs || a.date.localeCompare(b.date));
}

/** Today's date in Shap, as YYYY-MM-DD. */
export function todayInShap(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Short category label for the round book, e.g. "Female 40–49", "Male", "40–49". */
export function categoryLabel(r: Pick<PublicRound, 'sex' | 'ageGroup'>): string {
  return [r.sex ? SEX_LABELS[r.sex] : '', r.ageGroup ? AGE_LABELS[r.ageGroup] : ''].filter(Boolean).join(' ');
}

export interface BoardFilter {
  round: RoundId;
  mode: Mode;
  sex: Sex | 'all';
  age: AgeGroup | 'all';
}

/**
 * Leaderboard rows: checked (GPX or verified) rounds with a time, for one round and mode,
 * optionally narrowed by category and age group, fastest first.
 */
export function leaderboard<T extends PublicRound>(rows: T[], f: BoardFilter): T[] {
  return rows
    .filter(
      (r) =>
        r.round === f.round &&
        r.mode === f.mode &&
        r.secs > 0 &&
        isConfirmed(r) &&
        (f.sex === 'all' || r.sex === f.sex) &&
        (f.age === 'all' || r.ageGroup === f.age),
    )
    .sort((a, b) => a.secs - b.secs || a.date.localeCompare(b.date));
}
