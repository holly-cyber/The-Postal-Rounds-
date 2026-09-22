/**
 * Builds synthetic GPX tracks for tests and local end-to-end checks.
 *   node --experimental-strip-types tests/make-gpx.ts   → writes tests/fixtures/*.gpx
 */
import { writeFileSync } from 'node:fs';
import { BIRCHWOOD, type LatLon } from '../src/lib/config.ts';
import { haversineKm } from '../src/lib/gpx.ts';

/** Rough waypoints of the round (approximate, for tests only). */
const WAYPOINTS: LatLon[] = [
  BIRCHWOOD,
  { lat: 54.537, lon: -2.684 }, // north out of the village
  { lat: 54.529, lon: -2.705 }, // Shap Abbey
  { lat: 54.519, lon: -2.733 }, // Tailbert
  { lat: 54.508, lon: -2.757 }, // Truss Gap
  { lat: 54.5, lon: -2.748 }, // Glede Howe
  { lat: 54.492, lon: -2.737 }, // Sleddale Hall
  { lat: 54.498, lon: -2.7 }, // Thorney Bank
  { lat: 54.505, lon: -2.672 }, // A6
];

/** A loop through the waypoints, densified, with a gentle wiggle so it measures like a real walk. */
/** Wiggle sizes that make the synthetic loop measure like each round. */
export const LONG_WIGGLE = 0.00052;
export const SHORT_WIGGLE = 0.00028;

export function roundTrack(wiggle = SHORT_WIGGLE): LatLon[] {
  const ring = [...WAYPOINTS, WAYPOINTS[0]];
  const out: LatLon[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const steps = Math.max(2, Math.ceil(haversineKm(a, b) / 0.02));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const w = Math.sin(t * Math.PI * 14) * wiggle;
      out.push({ lat: a.lat + (b.lat - a.lat) * t + w, lon: a.lon + (b.lon - a.lon) * t + w });
    }
  }
  out.push({ ...BIRCHWOOD });
  return out;
}

export function toGpx(pts: LatLon[], start = Date.parse('2026-09-12T08:00:00Z'), secs = 4 * 3600): string {
  const step = secs / (pts.length - 1);
  const trkpts = pts
    .map(
      (p, i) =>
        `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>300</ele><time>${new Date(start + i * step * 1000).toISOString()}</time></trkpt>`,
    )
    .join('\n      ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="shap-postal-round tests" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Shap Postal Round</name><trkseg>
      ${trkpts}
  </trkseg></trk>
</gpx>
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = (name: string, gpx: string) => writeFileSync(new URL(`./fixtures/${name}`, import.meta.url), gpx);
  out('round-long.gpx', toGpx(roundTrack(LONG_WIGGLE)));
  out('round-short.gpx', toGpx(roundTrack(SHORT_WIGGLE), undefined, 3 * 3600));
  // Turns back before Swindale and Wet Sleddale.
  out('round-incomplete.gpx', toGpx(roundTrack().filter((p) => p.lon > -2.71 && p.lat > 54.505), undefined, 2 * 3600));
  console.log('Wrote tests/fixtures/round-long.gpx, round-short.gpx and round-incomplete.gpx');
}
