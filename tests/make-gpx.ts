/**
 * Builds synthetic GPX tracks for tests and local end-to-end checks.
 *   node --experimental-strip-types tests/make-gpx.ts   → writes tests/fixtures/*.gpx
 */
import { writeFileSync } from 'node:fs';
import { BIRCHWOOD, STOPS, type LatLon } from '../src/lib/config.ts';
import { haversineKm } from '../src/lib/gpx.ts';

/** A loop through the stops, densified, with a gentle wiggle so it measures like a real walk. */
export function roundTrack(wiggle = 0.0005): LatLon[] {
  const ring = [...STOPS, STOPS[0]];
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
  const full = roundTrack();
  writeFileSync(new URL('./fixtures/round-pass.gpx', import.meta.url), toGpx(full));
  // Turns back before Swindale and Wet Sleddale.
  const short = full.filter((p) => p.lon > -2.71);
  writeFileSync(new URL('./fixtures/round-short.gpx', import.meta.url), toGpx(short, undefined, 2 * 3600));
  console.log('Wrote tests/fixtures/round-pass.gpx and round-short.gpx');
}
