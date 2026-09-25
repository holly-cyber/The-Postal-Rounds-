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
  name: 'The Postman’s Challenge',
  strapline: 'Take on the loneliest post round, in Shap, Cumbria',
  placement:
    'A low-level heritage round through the quiet Far Eastern Fells of the Lake District, starting and finishing at Birchwood Cafe in Shap.',
  /** Café Instagram. Leave the URL empty to hide Instagram links and sections. */
  instagram: 'https://www.instagram.com/birchwoodcafeshap/',
  instagramHandle: '@birchwoodcafeshap',
  /** Hashtag we invite people to use when they share their round. */
  hashtag: '#ThePostmansChallenge',
  /** Where to buy Alan Cleaver's The Postal Paths. Leave empty to hide the buy buttons. */
  bookUrl: 'https://amzn.eu/d/09Do8TS7',
  /** Finisher pins: set to true once pins are stocked at the café. */
  pinsAvailable: false,
} as const;

/** Birchwood Cafe, Main Street, Shap CA10 3NJ (NY 56268 15254). Start point of the OS Maps GPX of the round. */
export const BIRCHWOOD: LatLon = { lat: 54.530675, lon: -2.677442 };

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
  /** Latitude the track must reach south of, when a round requires Mosedale Cottage (at 54.4779). */
  mosedaleSouthOfLat: 54.481,
  /** Faster than this on average (km/h, including stops) is not a round on foot. */
  maxAverageKmh: 18,
  /** Stretches faster than this (km/h) look like a vehicle; a few GPS jumps are allowed. */
  maxSegmentKmh: 40,
  /** Fewer points than this is a planned route, not a recorded activity. */
  minPoints: 10,
} as const;

/** One round now (the short round was removed, Sept 2026). The id stays 'long' so stored entries still match. */
export type RoundId = 'long';

export interface RoundInfo {
  id: RoundId;
  name: string;
  /** Distances by GPS, as quoted on the site. Long round confirmed from the OS Maps GPX (23.7 km, 570 m ascent). */
  miles: number;
  km: number;
  summary: string;
  /** GPX download in /public/gpx/. The button only appears once the file exists. */
  gpxFile: string;
  /** Minimum recorded distance for a GPX of this round to pass. PROVISIONAL. */
  minDistanceKm: number;
  requireSwindale: boolean;
  requireWetSleddale: boolean;
  requireMosedale: boolean;
}

export const ROUNDS: Record<RoundId, RoundInfo> = {
  long: {
    id: 'long',
    name: 'The Shap round',
    miles: 14.7,
    km: 23.7,
    summary: 'Out through Swindale to Mosedale Cottage and home through Wet Sleddale. About 600 metres of climb. A steady run takes around 3 to 3½ hours; walkers should allow a full day.',
    gpxFile: 'shap-postal-long-round.gpx',
    minDistanceKm: 21,
    requireSwindale: true,
    requireWetSleddale: true,
    requireMosedale: true,
  },
};

/** Form and upload limits. The server enforces these; the browser mirrors them. */
export const LIMITS = {
  nameMax: 40,
  emailMax: 254,
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
  map?: { x: number; y: number; label: string; lx: number; ly: number; bold?: boolean; anchor?: 'start' | 'end' };
}

/**
 * The stops, in walking order, following the café's illustrated map ("The Postman's Route").
 * Words are Jude's, from her Fellrunner article (docs/research).
 */
export const STOPS: Stop[] = [
  {
    name: 'Birchwood Cafe',
    html: 'Start at Birchwood Cafe in the middle of Shap village (NY 56268 15254). This is where water bottles can be filled and pre-run sustenance purchased over the old post office counter. Be sure to check your time against the old post office clock that hangs on the wall. Head for Shap Abbey via the ancient Goggleby Stone: a 10-foot prehistoric monolith standing alone in its field, and a great opportunity to survey the eastern fells and your route to come.',
    map: { x: 481, y: 139, label: 'Birchwood Cafe', lx: 470, ly: 176, bold: true, anchor: 'end' },
  },
  {
    name: 'Shap Abbey',
    html: 'A picturesque ruin of a 12th-century monastery in a lovely secluded valley beside the River Lowther. From the abbey take the path over the fields to meet the road, then across the moorland to Tailbert Farm. <strong>The Coast to Coast path has been rerouted here with new bridges, and some old signs are gone: follow the current right of way rather than cutting straight across the fields.</strong>',
    map: { x: 337, y: 161, label: 'Shap Abbey', lx: 262, ly: 150 },
  },
  {
    name: 'Tailbert Farm',
    html: 'Make your way through the farmyard (better get a mooooove on) and continue to Tailbert Head, the one-time home of the reclusive Mary Burgess. Now a delightful ruin, it opens up views of Swindale.',
    map: { x: 156, y: 248, label: 'Tailbert', lx: 166, ly: 244 },
  },
  {
    name: 'Swindale Foot',
    html: 'Next take the seldom-used footpath to Swindale Foot Farm. This section may present more of a challenge in high summer, when the bracken is high.',
    map: { x: 108, y: 362, label: 'Swindale Foot', lx: 118, ly: 358 },
  },
  {
    name: 'Truss Gap',
    html: 'Leave Swindale Foot by a short stretch of road and head towards Truss Gap House. Swindale is one of the quietest, most secluded valleys in the eastern Lake District, known for tranquil, untouched landscapes and pioneering wildlife conservation. From here, take the lower path along the valley across the open meadows to reach Swindale Head.',
    map: { x: 60, y: 424, label: 'Truss Gap', lx: 70, ly: 420 },
  },
  {
    name: 'Mosedale Cottage',
    html: 'Swindale Head Farm is a dramatic gateway to the head of the valley. The old bridleway contours round it, passing long-abandoned homes and farmsteads, and from here the route becomes wilder as it climbs to the remote Mosedale valley. Use the old footpath or pick your way up beside the waterfalls: a spectacular but hidden series of cascades with deep pools that make a swim irresistible on a hot day. It’s a scrambly ascent with no definitive path, but well worth the mini detour. Once you’ve plateaued in Mosedale, a rugged and bleakly beautiful glacial glen, continue along the old and now gnarly track to Mosedale Cottage, the most remote bothy in the Lake District, once home to shepherds and to workers at the nearby slate quarry.<br><br>Now reverse your route for a little while, then head east to cross Mosedale Beck at Flatbed Bridge. You’ll almost certainly have wet feet by now, so don’t be worried by the short, steep climb through boggy ground to the head of Wet Sleddale. It didn’t get that name for nothing. Just be glad you’re not the postman and have to do it all again tomorrow. There used to be a small sentry-box shelter here where he could eat his pack-up, but it has long since blown away. A variable track skirts under the summit of Scam Matthew (519 m) and gradually descends to Sleddale Hall.',
    map: { x: 34, y: 560, label: 'Mosedale Cottage', lx: 22, ly: 600 },
  },
  {
    name: 'Sleddale Hall',
    html: 'A remote 18th-century farmhouse, famous as Crow Crag Farm in the cult classic <em>Withnail and I</em>, and now a major pilgrimage site.',
    map: { x: 180, y: 548, label: 'Sleddale Hall', lx: 190, ly: 580 },
  },
  {
    name: 'Thorney Bank',
    html: 'Leave Sleddale Hall along the terraced track and join the tarmac road at Green Farm, continuing past the postbox at Thorney Bank Farm.',
    map: { x: 330, y: 517, label: 'Thorney Bank', lx: 250, ly: 506 },
  },
  {
    name: 'Stepps Hall and home',
    html: 'Only one more letter to drop off now. Keeping the river on your right-hand side, cross the concrete road and follow the river until you reach your final delivery: Stepps Hall. Cross the river at the stepping stones <strong>(if the river is in spate they may be uncrossable: follow the road from Thorney Bank to the A6 instead)</strong> and continue up the lane or across the fields to the A6. Turn left and head north back to Birchwood Cafe. Take a note of your time and post your round. It’s now time to sit down, relax and replenish.',
    map: { x: 440, y: 496, label: 'Stepps Hall', lx: 400, ly: 478 },
  },
];

/** "Route at a glance" facts on the home page. */
export const FACTS: [string, string][] = [
  ['Start and finish', 'Birchwood Cafe, Main Street, Shap (NY 56268 15254)'],
  ['The round', `About ${ROUNDS.long.miles} miles / ${ROUNDS.long.km} km, 600 m of climb`],
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
