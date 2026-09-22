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
  /** A GPX must start this close to Birchwood. */
  startRadiusKm: 1.0,
  /** …and finish this close to Birchwood. */
  finishRadiusKm: 1.0,
  /** Minimum recorded distance for a GPX to pass (full loop is ~18 km). */
  minDistanceKm: 15,
  /** The track must reach west of this longitude (Swindale). */
  westOfLon: -2.735,
  /** The track must reach south of this latitude (Wet Sleddale). */
  southOfLat: 54.5,
  /** Fewer points than this is a planned route, not a recorded activity. */
  minPoints: 10,
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
  /** Sanity bounds on a reported time (a time is optional; 0 means none given). */
  minSecs: 45 * 60,
  maxSecs: 24 * 60 * 60,
  /** Earliest accepted round date. */
  earliestDate: '1950-01-01',
  /** Rate limit: accepted submissions per IP per window. */
  ratePerWindow: 5,
  rateWindowMs: 60 * 60 * 1000,
} as const;

export interface Stop {
  /** Heading in the stops list. */
  name: string;
  /** Description in the stops list. Trusted HTML (it only comes from this file). */
  html: string;
  /**
   * Where the stop sits on the sketch map (SVG units, 600 × 620 viewBox) and where its
   * label goes. Birchwood is drawn as a postbox; the rest as circles. Omit `map` for
   * stops that are not marked on the sketch.
   */
  map?: { x: number; y: number; label: string; lx: number; ly: number; bold?: boolean };
}

/** The eight stops, in walking order, from Alan Cleaver's mapping of the round. */
export const STOPS: Stop[] = [
  {
    name: 'Birchwood Cafe',
    html: 'Start on Main Street. Head north out of the village and take the lane west towards Shap Abbey.',
    map: { x: 481, y: 139, label: 'Birchwood Cafe', lx: 390, ly: 128, bold: true },
  },
  {
    name: 'Shap Abbey',
    html: 'Cross the Lowther by the wooden-sided bridge. From the abbey, take the footpath west over the fields, which can be very wet, until you meet the concrete water-board road.',
    map: { x: 337, y: 161, label: 'Shap Abbey', lx: 345, ly: 185 },
  },
  {
    name: 'Tailbert',
    html: 'Follow the road south, then west to the isolated farm at Tailbert. Take a bearing south-west and drop into Swindale.',
    map: { x: 156, y: 248, label: 'Tailbert', lx: 166, ly: 244 },
  },
  {
    name: 'Truss Gap, Swindale',
    html: 'Follow the valley road to Truss Gap Farm. The postman sometimes went on to Swindale Head and Mosedale Cottage when there was post for them.',
    map: { x: 60, y: 424, label: 'Truss Gap', lx: 70, ly: 420 },
  },
  {
    name: 'Over Glede Howe',
    html: 'Cross Swindale Beck and climb the fell. This is the true postman’s path: his own shortcut, once marked with wooden staves to find the driest line, even in snow. The staves are long gone, so take a bearing.',
    map: { x: 102, y: 506, label: 'Glede Howe', lx: 112, ly: 500 },
  },
  {
    name: 'Sleddale Hall',
    html: 'Drop south off the fell to the farmhouse made famous by the film <em>Withnail and I</em>.',
    map: { x: 180, y: 548, label: 'Sleddale Hall', lx: 120, ly: 580 },
  },
  {
    name: 'Thorney Bank postbox',
    html: 'Follow the path east above Wet Sleddale to Thorney Bank and the Victorian postbox the postman emptied on his round.',
    map: { x: 330, y: 517, label: 'Thorney Bank postbox', lx: 338, ly: 506 },
  },
  {
    name: 'Back to Birchwood Cafe',
    html: 'Take the road east to the A6 and turn north back into Shap. Finish where you started, then log your round.',
  },
];

/** "Route at a glance" facts in the hero. */
export const FACTS: [string, string][] = [
  ['Start and finish', 'Birchwood Cafe, Main Street, Shap'],
  ['Distance', 'About 11 miles / 18 km'],
  ['Time', '4 to 5 hours walking'],
  ['Terrain', 'Fields, lanes and open, pathless fell'],
  ['Map', 'OS Explorer OL5'],
  ['Last walked by post', '1976'],
];
