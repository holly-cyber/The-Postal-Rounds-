/** Shared shapes and helpers for round entries (browser + functions). */
import type { GpxCheck } from './gpx.ts';

export type Mode = 'walk' | 'run';

/** What GET /api/rounds returns for each entry — nothing else leaves the server. */
export interface PublicRound {
  name: string;
  mode: Mode;
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
    mode: r.mode,
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

export function sortForView<T extends PublicRound>(rows: T[], view: View): T[] {
  if (view === 'date') {
    return [...rows].sort((a, b) => b.date.localeCompare(a.date));
  }
  return rows
    .filter((r) => r.mode === view && r.secs > 0 && isConfirmed(r))
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
