/**
 * Every tunable number for the Shap Postal Round lives here.
 * The browser (instant GPX feedback, sketch map) and the Netlify functions
 * (the real check) both import this file, so a change here changes both.
 *
 * Refine these from a real GPX of the round.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

/** Birchwood Cafe, Main Street, Shap CA10 3NJ. APPROXIMATE — confirm from a GPX. */
export const BIRCHWOOD: LatLon = { lat: 54.5315, lon: -2.68 };

export const ROUND = {
  /** Nominal loop length shown on the site. */
  nominalKm: 18,
  /** A GPX must start this close to Birchwood. */
  startRadiusKm: 1,
  /** …and finish this close to Birchwood. */
  finishRadiusKm: 1,
  /** Minimum recorded distance for a GPX to pass. */
  minDistanceKm: 15,
  /** The track must reach west of this longitude (Swindale). */
  westOfLon: -2.735,
  /** The track must reach south of this latitude (Wet Sleddale). */
  southOfLat: 54.5,
} as const;

/** Form and upload limits. The server enforces these; the browser mirrors them. */
export const LIMITS = {
  nameMax: 40,
  noteMax: 140,
  linkMax: 500,
  gpxMaxBytes: 10 * 1024 * 1024,
  photoMaxBytes: 8 * 1024 * 1024,
  photoTypes: ['image/jpeg', 'image/png', 'image/webp'],
  /** Photos are resized in the browser to this longest edge before upload. */
  photoMaxEdgePx: 2048,
  /**
   * Netlify functions accept roughly 6 MB per request (less once base64-encoded),
   * so the browser gzips the GPX and shrinks the photo to stay under this.
   */
  uploadBudgetBytes: 4 * 1024 * 1024,
  /** Sanity bounds on the reported time. */
  minSecs: 45 * 60,
  maxSecs: 24 * 60 * 60,
  /** Earliest accepted round date. */
  earliestDate: '1950-01-01',
  /** Rate limit: submissions per IP per window. */
  ratePerWindow: 5,
  rateWindowMs: 60 * 60 * 1000,
} as const;

export interface Stop extends LatLon {
  n: number;
  name: string;
  note: string;
  /** Short label for the sketch map, and which side of the dot it sits. */
  label?: string;
  side?: 'left' | 'right' | 'above' | 'below';
}

/**
 * The eight stops, in walking order. Coordinates are APPROXIMATE and the notes
 * are DRAFT — replace both with the prototype / book text and a real GPX.
 */
export const STOPS: Stop[] = [
  { n: 1, name: 'Birchwood Cafe, Shap', lat: 54.5315, lon: -2.68, label: 'Birchwood Cafe', side: 'above', note: 'Start and finish. The sorting office end of the day — and a cup of tea.' },
  { n: 2, name: 'Keld', lat: 54.5255, lon: -2.6935, side: 'below', note: 'The hamlet by the Lowther, with its little chapel.' },
  { n: 3, name: 'Shap Abbey', lat: 54.5295, lon: -2.7045, side: 'above', note: 'The ruined abbey tower in the valley bottom.' },
  { n: 4, name: 'Swindale Foot', lat: 54.521, lon: -2.728, side: 'left', note: 'Into Swindale along the beck.' },
  { n: 5, name: 'Swindale', lat: 54.508, lon: -2.748, side: 'left', note: 'The furthest west the round goes.' },
  { n: 6, name: 'Over to Wet Sleddale', lat: 54.498, lon: -2.738, label: 'Over the fell', side: 'left', note: 'The climb across the fell between the two valleys.' },
  { n: 7, name: 'Wet Sleddale', lat: 54.494, lon: -2.72, side: 'below', note: 'Sleddale Hall and the reservoir — the southern end of the round.' },
  { n: 8, name: 'Back to Shap', lat: 54.515, lon: -2.692, side: 'right', note: 'Down the lane and home along Main Street.' },
];

export const OS_MAP = 'OS Explorer OL5';
