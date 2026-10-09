/**
 * GPX parsing and round checks, shared by the browser (instant feedback)
 * and the Netlify function (the check that counts).
 *
 * Deliberately DOM-free: a small tag scanner works identically in the
 * browser and in Node, where there is no DOMParser.
 */
import { BIRCHWOOD, GPX_RULES as R, LIMITS, ROUNDS, ROUTE_CHECKPOINTS, type LatLon, type RoundId } from './config.ts';

export interface GpxPoint extends LatLon {
  time?: number;
}

export interface GpxCheck {
  /** 'route', 'west', 'south' and 'mosedale' are older checks, still found on entries posted before Oct 2026. */
  id: 'recorded' | 'start' | 'finish' | 'distance' | 'checkpoints' | 'route' | 'west' | 'south' | 'mosedale';
  label: string;
  pass: boolean;
  detail: string;
}

export interface GpxResult {
  points: number;
  km: number;
  startKm: number;
  finishKm: number;
  minLat: number;
  minLon: number;
  /** Seconds between first and last timestamp, if the file has times. */
  elapsedSecs: number | null;
  /** True when (almost) every point has a timestamp, i.e. a recorded activity, not a planned route. */
  timed: boolean;
  /** ISO date (YYYY-MM-DD) of the first timestamp, if any. */
  startDate: string | null;
  checks: GpxCheck[];
  passed: boolean;
}

export class GpxError extends Error {}

const MAX_POINTS = 500_000;

/** Great-circle distance in km. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`).exec(tag);
  return m ? m[2] : null;
}

/** Extract track points (falling back to route points) from GPX text. */
export function parsePoints(text: string): GpxPoint[] {
  if (!/<gpx[\s>]/i.test(text)) throw new GpxError('That file isn’t a readable GPX file.');

  const scan = (kind: 'trkpt' | 'rtept'): GpxPoint[] => {
    const out: GpxPoint[] = [];
    // Matches <trkpt …/> or <trkpt …> … </trkpt>, with or without a namespace prefix.
    const re = new RegExp(
      `<(?:[\\w-]+:)?${kind}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${kind}>)`,
      'gi',
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const lat = Number(attr(m[1], 'lat'));
      const lon = Number(attr(m[1], 'lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      const p: GpxPoint = { lat, lon };
      const t = m[2] && /<(?:[\w-]+:)?time>([^<]+)</i.exec(m[2]);
      if (t) {
        const ms = Date.parse(t[1].trim());
        if (Number.isFinite(ms)) p.time = ms;
      }
      out.push(p);
      if (out.length > MAX_POINTS) throw new GpxError('This GPX has too many points.');
    }
    return out;
  };

  let pts = scan('trkpt');
  if (!pts.length) pts = scan('rtept');
  if (pts.length < R.minPoints) {
    throw new GpxError('The GPX file has no track points. Export the recorded activity, not a planned route.');
  }
  return pts;
}

const fmtKm = (km: number) => `${km.toFixed(1)} km`;

/**
 * Is this a recorded activity rather than a planned route? Planned routes (OS Maps, Komoot,
 * route builders) have no timestamps. Recorded activities time every point, the times run
 * forwards, and the pace is something a person on foot could do.
 */
function recordedCheck(pts: GpxPoint[], times: number[], km: number, elapsedSecs: number | null): GpxCheck {
  const fail = (detail: string): GpxCheck => ({ id: 'recorded', label: 'A recorded activity', pass: false, detail });
  if (times.length < pts.length * 0.9 || !elapsedSecs) {
    return fail('No timings in this file, so it looks like a planned route. Upload the GPX of your recorded activity.');
  }
  let backwards = 0;
  let tooFast = 0;
  let steps = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1].time;
    const b = pts[i].time;
    if (a === undefined || b === undefined) continue;
    steps++;
    if (b < a) backwards++;
    else if (b > a && (haversineKm(pts[i - 1], pts[i]) / ((b - a) / 3_600_000)) > R.maxSegmentKmh) tooFast++;
  }
  if (backwards > steps * 0.01) return fail('The timings in this file run backwards, so it can’t be checked.');
  if (elapsedSecs < LIMITS.minSecs || elapsedSecs > LIMITS.maxSecs) {
    return fail('The recorded time doesn’t look right for the round.');
  }
  const avgKmh = km / (elapsedSecs / 3600);
  if (avgKmh > R.maxAverageKmh || tooFast > steps * 0.02) {
    return fail('Too fast for a round on foot. Upload the GPX of your walk or run.');
  }
  return { id: 'recorded', label: 'A recorded activity', pass: true, detail: 'Timed from start to finish' };
}

// ---------- Checkpoints ----------

/** Flat x/y in km around Shap: accurate to well under 1% over the round. */
const KM_PER_LAT = 110.574;
const KM_PER_LON = 111.32 * Math.cos((BIRCHWOOD.lat * Math.PI) / 180);
type XY = [number, number];
const xy = (lat: number, lon: number): XY => [lon * KM_PER_LON, lat * KM_PER_LAT];

/** Distance (km) from p to the segment a–b. Segments bridge GPS dropouts, so a gap still counts. */
function segKm(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** The track as flat points, thinned to one every ~10 m. */
function thin(pts: GpxPoint[]): XY[] {
  const out: XY[] = [xy(pts[0].lat, pts[0].lon)];
  for (const p of pts) {
    const q = xy(p.lat, p.lon);
    const last = out[out.length - 1];
    if (Math.hypot(q[0] - last[0], q[1] - last[1]) >= 0.01) out.push(q);
  }
  return out;
}

/** First segment index at or after `from` that passes within `km` of p, or -1. */
function firstNear(track: XY[], p: XY, km: number, from = 0): number {
  if (track.length === 1) return segKm(p, track[0], track[0]) <= km ? 0 : -1;
  for (let i = Math.max(0, from); i < track.length - 1; i++) if (segKm(p, track[i], track[i + 1]) <= km) return i;
  return -1;
}

const listNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** Every checkpoint, in the round's order, each within the margin. */
function checkpointsCheck(track: XY[]): GpxCheck {
  const label = 'Passes the checkpoints in order';
  const missed: string[] = [];
  const outOfOrder: string[] = [];
  let at = 0;
  for (const c of ROUTE_CHECKPOINTS) {
    const p = xy(c.lat, c.lon);
    const i = firstNear(track, p, R.checkpointRadiusKm, at);
    if (i >= 0) at = i;
    else if (firstNear(track, p, R.checkpointRadiusKm) >= 0) outOfOrder.push(c.name);
    else missed.push(c.name);
  }
  const n = ROUTE_CHECKPOINTS.length;
  if (missed.length) {
    return { id: 'checkpoints', label, pass: false, detail: `Didn’t pass ${listNames(missed)}` };
  }
  if (outOfOrder.length) {
    return {
      id: 'checkpoints', label, pass: false,
      detail: `Passed every checkpoint, but not in the round’s order (${ROUTE_CHECKPOINTS[0].name} first, ${ROUTE_CHECKPOINTS[n - 1].name} last)`,
    };
  }
  return { id: 'checkpoints', label, pass: true, detail: `Passed all ${n} checkpoints, from ${ROUTE_CHECKPOINTS[0].name} to ${ROUTE_CHECKPOINTS[n - 1].name}` };
}

/** Run the round checks for the chosen round against a list of points. */
export function checkPoints(pts: GpxPoint[], round: RoundId): GpxResult {
  const rules = ROUNDS[round];
  let km = 0;
  let minLat = Infinity;
  let minLon = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.lat < minLat) minLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (i > 0) km += haversineKm(pts[i - 1], p);
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  const startKm = haversineKm(first, BIRCHWOOD);
  const finishKm = haversineKm(last, BIRCHWOOD);

  const times = pts.map((p) => p.time).filter((t): t is number => t !== undefined);
  const elapsedSecs =
    times.length >= 2 ? Math.max(0, Math.round((times[times.length - 1] - times[0]) / 1000)) : null;
  const startDate = times.length ? new Date(times[0]).toISOString().slice(0, 10) : null;

  const recorded = recordedCheck(pts, times, km, elapsedSecs);
  const track = thin(pts);
  const checks: GpxCheck[] = [
    recorded,
    {
      id: 'start',
      label: 'Starts in Shap',
      pass: startKm <= R.startRadiusKm,
      detail: `Starts ${fmtKm(startKm)} from Birchwood (limit ${R.startRadiusKm} km)`,
    },
    {
      id: 'finish',
      label: 'Finishes in Shap',
      pass: finishKm <= R.finishRadiusKm,
      detail: `Finishes ${fmtKm(finishKm)} from Birchwood (limit ${R.finishRadiusKm} km)`,
    },
    {
      id: 'distance',
      label: `Distance ${(Math.round(km * 10) / 10).toFixed(1)} km`,
      pass: km >= rules.minDistanceKm,
      detail: `Needs at least ${rules.minDistanceKm} km for ${rules.name.toLowerCase()}`,
    },
    checkpointsCheck(track),
  ];

  return {
    points: pts.length,
    km: Math.round(km * 10) / 10,
    startKm: Math.round(startKm * 100) / 100,
    finishKm: Math.round(finishKm * 100) / 100,
    minLat,
    minLon,
    elapsedSecs,
    timed: times.length >= pts.length * 0.9 && !!elapsedSecs,
    startDate,
    checks,
    passed: checks.every((c) => c.pass),
  };
}

/** Parse GPX text and check it against the round. Throws GpxError if unreadable. */
export function parseGpx(text: string, round: RoundId): GpxResult {
  return checkPoints(parsePoints(text), round);
}
