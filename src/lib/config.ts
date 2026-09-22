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

/** Site-wide names and links. Change the name here and it changes everywhere. */
export const SITE = {
  name: 'Shap Postal Path',
  strapline: 'The loneliest postal path',
  placement:
    'A low-level heritage round through the quiet Far Eastern Fells of the Lake District, starting and finishing at Birchwood Cafe in Shap.',
  /** Café Instagram URL. Leave empty to hide the link. */
  instagram: '',
  /** Finisher pins: set to true once pins are stocked at the café. */
  pinsAvailable: false,
} as const;

/** Birchwood Cafe, Main Street, Shap CA10 3NJ. APPROXIMATE — confirm from a GPX. */
export const BIRCHWOOD: LatLon = { lat: 54.5315, lon: -2.68 };

/** Checks every GPX must pass, whichever round. */
export const GPX_RULES = {
  /** A GPX must start this close to Birchwood. */
  startRadiusKm: 1.0,
  /** …and finish this close to Birchwood. */
  finishRadiusKm: 1.0,
  /** Longitude the track must reach west of, when a round requires Swindale. */
  westOfLon: -2.735,
  /** Latitude the track must reach south of, when a round requires Wet Sleddale. */
  southOfLat: 54.5,
  /** Fewer points than this is a planned route, not a recorded activity. */
  minPoints: 10,
} as const;

export type RoundId = 'long' | 'short';

export interface RoundInfo {
  id: RoundId;
  name: string;
  /** Distances by GPS, as quoted on the site. PROVISIONAL until the final GPX. */
  miles: number;
  km: number;
  summary: string;
  /** GPX download in /public/gpx/. The button only appears once the file exists. */
  gpxFile: string;
  /** Minimum recorded distance for a GPX of this round to pass. PROVISIONAL. */
  minDistanceKm: number;
  requireSwindale: boolean;
  requireWetSleddale: boolean;
}

export const ROUNDS: Record<RoundId, RoundInfo> = {
  long: {
    id: 'long',
    name: 'The long round',
    miles: 14.7,
    km: 23.7,
    summary: 'The full postie’s round, often quoted as 15 miles. A steady run takes around 3 to 3½ hours; walkers should allow a full day.',
    gpxFile: 'shap-postal-long-round.gpx',
    minDistanceKm: 21,
    requireSwindale: true,
    requireWetSleddale: true,
  },
  short: {
    id: 'short',
    name: 'The short “winter” round',
    miles: 10.3,
    km: 16.6,
    summary: 'The round as walked out of season, leaving out the summer-only cottages. A good first go before the long round.',
    gpxFile: 'shap-postal-short-round.gpx',
    minDistanceKm: 15,
    requireSwindale: true,
    requireWetSleddale: true,
  },
};

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
    html: 'Cross the Lowther by the wooden-sided bridge. <strong>The Coast to Coast path has been rerouted here with new bridges, and some old signs are gone.</strong> Don’t shortcut straight up from the abbey across the fields: follow the current right of way west until you meet the concrete water-board road.',
    map: { x: 337, y: 161, label: 'Shap Abbey', lx: 345, ly: 185 },
  },
  {
    name: 'Tailbert',
    html: 'Follow the road south, then west to the isolated farm at Tailbert. Take a bearing south-west and drop into Swindale.',
    map: { x: 156, y: 248, label: 'Tailbert', lx: 166, ly: 244 },
  },
  {
    name: 'Truss Gap, Swindale',
    html: 'Follow the valley road to Truss Gap Farm. The postie sometimes went on to Swindale Head and Mosedale Cottage when there was post for them; the shepherd at Mosedale was only resident six weeks a year.',
    map: { x: 60, y: 424, label: 'Truss Gap', lx: 70, ly: 420 },
  },
  {
    name: 'Over Glede Howe',
    html: 'Cross Swindale Beck and climb the fell. This is the true postie’s path: the postman’s own shortcut, once marked with wooden staves to find the driest line, even in snow. The staves are long gone, so take a bearing.',
    map: { x: 102, y: 506, label: 'Glede Howe', lx: 112, ly: 500 },
  },
  {
    name: 'Sleddale Hall',
    html: 'Drop south off the fell to the farmhouse made famous by the film <em>Withnail and I</em>.',
    map: { x: 180, y: 548, label: 'Sleddale Hall', lx: 120, ly: 580 },
  },
  {
    name: 'Thorney Bank postbox',
    html: 'Follow the path east above Wet Sleddale to Thorney Bank and the Victorian postbox emptied on the round.',
    map: { x: 330, y: 517, label: 'Thorney Bank postbox', lx: 338, ly: 506 },
  },
  {
    name: 'Back to Birchwood Cafe',
    html: 'Take the road east to the A6 and turn north back into Shap. Finish where you started, then log your round.',
  },
];

/** "Route at a glance" facts on the home page. */
export const FACTS: [string, string][] = [
  ['Start and finish', 'Birchwood Cafe, Main Street, Shap'],
  ['Long round', `About ${ROUNDS.long.miles} miles / ${ROUNDS.long.km} km`],
  ['Short “winter” round', `About ${ROUNDS.short.miles} miles / ${ROUNDS.short.km} km`],
  ['Time', 'A full day walking; 3 to 3½ hours at a steady run'],
  ['Terrain', 'Fields, lanes and rough, often pathless fell'],
  ['Map', 'OS Explorer OL5'],
  ['Last walked by post', '1976'],
];

/**
 * Current notices shown on the route page. Seasonal and temporary: edit or delete freely.
 */
export const NOTICES: string[] = [
  'Near Shap Abbey the Coast to Coast path has been rerouted with new bridges, and some old signs have been removed. Follow the current right of way; don’t cut straight up from the abbey across the fields.',
  'A buzzard has been defending its territory in Swindale. Give it room, and keep moving.',
];
