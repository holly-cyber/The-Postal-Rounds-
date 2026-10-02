/**
 * Builds synthetic GPX tracks for tests and local end-to-end checks.
 *   node --experimental-strip-types tests/make-gpx.ts   → writes tests/fixtures/*.gpx
 */
import { writeFileSync } from 'node:fs';
import { BIRCHWOOD, ROUTE_CHECKPOINTS, type LatLon } from '../src/lib/config.ts';
import { ROUTE_LINE } from '../src/lib/route.ts';
import { haversineKm } from '../src/lib/gpx.ts';

/**
 * Test tracks built from the official route (src/lib/route.ts): densified to a point every ~20 m
 * and nudged by a few metres either side, like a real watch recording.
 */
function densify(line: LatLon[], jitterKm = 0.012): LatLon[] {
  const out: LatLon[] = [];
  let n = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const steps = Math.max(1, Math.ceil(haversineKm(a, b) / 0.02));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const j = Math.sin(n++ * 0.7) * jitterKm;
      out.push({ lat: a.lat + (b.lat - a.lat) * t + j / 111, lon: a.lon + (b.lon - a.lon) * t + j / 64 });
    }
  }
  out.push({ ...line[line.length - 1] });
  return out;
}

const LINE: LatLon[] = ROUTE_LINE.map(([lat, lon]) => ({ lat, lon }));
const nearest = (p: LatLon) => LINE.reduce((bi, q, i) => (haversineKm(q, p) < haversineKm(LINE[bi], p) ? i : bi), 0);
const at = (name: string) => nearest(ROUTE_CHECKPOINTS.find((c) => c.name === name)!);

/** The full round, as walked. */
export const roundTrack = (): LatLon[] => densify(LINE);

/** Cuts straight from Swindale Head to Sleddale Hall, skipping Mosedale Cottage. */
export const skipsMosedaleTrack = (): LatLon[] =>
  densify([...LINE.slice(0, at('Swindale Head') + 1), ...LINE.slice(at('Sleddale Hall'))]);

/** The round walked backwards. */
export const reversedTrack = (): LatLon[] => densify([...LINE].reverse());

/** Out to Swindale Foot, then straight back to Shap. */
export const incompleteTrack = (): LatLon[] => densify([...LINE.slice(0, at('Swindale Foot') + 1), BIRCHWOOD]);

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
  out('round-long.gpx', toGpx(roundTrack()));
  out('round-skips-mosedale.gpx', toGpx(skipsMosedaleTrack(), undefined, 3 * 3600));
  out('round-incomplete.gpx', toGpx(incompleteTrack(), undefined, 2 * 3600));
  console.log('Wrote tests/fixtures/round-long.gpx, round-skips-mosedale.gpx and round-incomplete.gpx');
}
