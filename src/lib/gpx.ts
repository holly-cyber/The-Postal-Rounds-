/**
 * GPX parsing and round checks, shared by the browser (instant feedback)
 * and the Netlify function (the check that counts).
 *
 * Deliberately DOM-free: a small tag scanner works identically in the
 * browser and in Node, where there is no DOMParser.
 */
import { BIRCHWOOD, GPX_RULES as R, ROUNDS, type LatLon, type RoundId } from './config.ts';

export interface GpxPoint extends LatLon {
  time?: number;
}

export interface GpxCheck {
  id: 'start' | 'finish' | 'distance' | 'west' | 'south' | 'mosedale';
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

  const reachedWest = minLon <= R.westOfLon;
  const reachedSouth = minLat <= R.southOfLat;
  const reachedMosedale = minLat <= R.mosedaleSouthOfLat;
  const all: (GpxCheck | null)[] = [
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
    !rules.requireSwindale ? null : {
      id: 'west',
      label: 'Reaches Swindale',
      pass: reachedWest,
      detail: reachedWest ? 'Reached Swindale' : 'Didn’t get far enough west',
    },
    !rules.requireWetSleddale ? null : {
      id: 'south',
      label: 'Reaches Wet Sleddale',
      pass: reachedSouth,
      detail: reachedSouth ? 'Reached Wet Sleddale' : 'Didn’t get far enough south',
    },
    !rules.requireMosedale ? null : {
      id: 'mosedale',
      label: 'Reaches Mosedale Cottage',
      pass: reachedMosedale,
      detail: reachedMosedale ? 'Reached Mosedale Cottage' : 'Didn’t reach Mosedale Cottage',
    },
  ];
  const checks = all.filter((c): c is GpxCheck => c !== null);

  return {
    points: pts.length,
    km: Math.round(km * 10) / 10,
    startKm: Math.round(startKm * 100) / 100,
    finishKm: Math.round(finishKm * 100) / 100,
    minLat,
    minLon,
    elapsedSecs,
    startDate,
    checks,
    passed: checks.every((c) => c.pass),
  };
}

/** Parse GPX text and check it against the round. Throws GpxError if unreadable. */
export function parseGpx(text: string, round: RoundId): GpxResult {
  return checkPoints(parsePoints(text), round);
}
