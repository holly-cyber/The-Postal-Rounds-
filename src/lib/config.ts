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
    summary: 'The full round, including the extra loop up Swindale to Mosedale Cottage. About 600 metres of climb. A steady run takes around 3 to 3½ hours; walkers should allow a full day.',
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
    summary: 'Leaves out Mosedale and cuts straight from Truss Gap over Ralfland Fell to Wet Sleddale, as the postie did when there was no post for the shepherd. A good first go before the long round.',
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
  /** Set when a stop is on one round only. */
  onlyOn?: RoundId;
  /**
   * Where the stop sits on the sketch map (SVG units, 600 × 620 viewBox) and where its
   * label goes. Birchwood is drawn as a postbox; the rest as circles. Omit `map` for
   * stops that are not marked on the sketch.
   */
  map?: { x: number; y: number; label: string; lx: number; ly: number; bold?: boolean; anchor?: 'start' | 'end' };
}

/**
 * The stops, in walking order, following the café's illustrated map ("The Postman's Route")
 * and Alan Cleaver's route notes. The rounds split after Truss Gap.
 */
export const STOPS: Stop[] = [
  {
    name: 'Birchwood Cafe',
    html: 'Park in Shap and start on Main Street. Alan Cleaver recommends eating at Birchwood before you set off. Head out of the village and follow the road to Shap Abbey, past the Goggleby Stone.',
    map: { x: 481, y: 139, label: 'Birchwood Cafe', lx: 470, ly: 176, bold: true, anchor: 'end' },
  },
  {
    name: 'Shap Abbey',
    html: 'Cross the Lowther and head west out of the abbey, over a boggy field, to reach a tarmac road. <strong>The Coast to Coast path has been rerouted here with new bridges, and some old signs are gone.</strong> Follow the current right of way rather than cutting straight up across the fields.',
    map: { x: 337, y: 161, label: 'Shap Abbey', lx: 262, ly: 150 },
  },
  {
    name: 'Tailbert Farm',
    html: 'Follow the road to Tailbert Farm. The path goes through the farm and out the other side to the now deserted Tailbert Head.',
    map: { x: 156, y: 248, label: 'Tailbert', lx: 166, ly: 244 },
  },
  {
    name: 'Swindale Foot',
    html: 'Follow the path down into Swindale and cross the valley to reach the road.',
    map: { x: 108, y: 362, label: 'Swindale Foot', lx: 118, ly: 358 },
  },
  {
    name: 'Truss Gap',
    html: 'The postie delivered to the homes along the valley road towards Swindale Head, then doubled back to Truss Gap. <strong>This is where the rounds split.</strong>',
    map: { x: 60, y: 424, label: 'Truss Gap', lx: 70, ly: 420 },
  },
  {
    name: 'Mosedale Cottage',
    onlyOn: 'long',
    html: 'For six weeks of the year a shepherd lived at Mosedale Cottage, now a bothy, and the postie had to take up any post addressed to him. Follow the valley past Swindale Head and the waterfalls to the cottage, then cross the beck and head over to Wet Sleddale. About three extra miles, and worth it if you’re fit enough.',
    map: { x: 34, y: 560, label: 'Mosedale Cottage', lx: 22, ly: 600 },
  },
  {
    name: 'Over Ralfland Fell',
    onlyOn: 'short',
    html: 'Climb Gouther Crag onto Ralfland Fell. This is the true postie’s path: the postman’s own shortcut to Wet Sleddale, once marked with wooden staves to find the driest line, even in snow. The staves are long gone, so take a bearing.',
    map: { x: 102, y: 506, label: 'Ralfland Fell', lx: 112, ly: 500 },
  },
  {
    name: 'Sleddale Hall',
    html: 'Drop down into Wet Sleddale by Sleddale Hall, Uncle Monty’s cottage in the film <em>Withnail and I</em>.',
    map: { x: 180, y: 548, label: 'Sleddale Hall', lx: 190, ly: 580 },
  },
  {
    name: 'Thorney Bank',
    html: 'Follow the terrace path above Wet Sleddale, past Green Farm, to Thorney Bank and the Victorian postbox emptied on the round.',
    map: { x: 330, y: 517, label: 'Thorney Bank', lx: 250, ly: 506 },
  },
  {
    name: 'Stepps Hall and home',
    html: 'Carry on past Stepps Hall, cross the river and climb to the A6, then turn back into Shap. Finish at Birchwood Cafe, and log your round.',
    map: { x: 440, y: 496, label: 'Stepps Hall', lx: 400, ly: 478 },
  },
];

/** "Route at a glance" facts on the home page. */
export const FACTS: [string, string][] = [
  ['Start and finish', 'Birchwood Cafe, Main Street, Shap'],
  ['Long round', `About ${ROUNDS.long.miles} miles / ${ROUNDS.long.km} km, 600 m of climb`],
  ['Short “winter” round', `About ${ROUNDS.short.miles} miles / ${ROUNDS.short.km} km`],
  ['Time', 'Allow a full day walking (tough in places); 3 to 3½ hours at a steady run'],
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
