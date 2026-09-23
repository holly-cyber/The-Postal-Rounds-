/**
 * Photos used on the site, with alt text and captions. Server-side only (used by .astro pages).
 * Originals live in src/assets/photos/; Astro resizes and converts them at build time.
 *
 * To swap a photo, change the import. To caption it differently, change `caption`.
 * CHECK: captions naming a place are best guesses from the photos. Holly to confirm.
 */
import type { ImageMetadata } from 'astro';

import heroImg from '../assets/photos/runner-with-letter-valley.jpg';
import abbeyFrost from '../assets/photos/shap-abbey-frost-red-van.jpg';
import abbeySummer from '../assets/photos/shap-abbey-summer.jpg';
import goggleby from '../assets/photos/goggleby-stone-runner.jpg';
import swindaleOverlook from '../assets/photos/swindale-overlook.jpg';
import snowFarm from '../assets/photos/white-farmhouse-snowy-valley.jpg';
import farmhouseSnow from '../assets/photos/farmhouse-snowy-fell.jpg';
import mosedaleGroup from '../assets/photos/group-at-mosedale-cottage.jpg';
import bothyInside from '../assets/photos/inside-mosedale-bothy.jpg';
import waterfall from '../assets/photos/waterfall-gorge.jpg';
import waterfallRunner from '../assets/photos/waterfall-runner.jpg';
import fellGroup from '../assets/photos/group-on-the-fell.jpg';
import reservoir from '../assets/photos/wet-sleddale-reservoir-view.jpg';
import snowyTrack from '../assets/photos/snowy-track-walker.jpg';
import snowyRunner from '../assets/photos/snowy-track-runner.jpg';
import posties from '../assets/photos/posties-at-stone-ruin.jpg';
import letterSummit from '../assets/photos/runner-with-letter-summit.jpg';
import autumnValley from '../assets/photos/autumn-valley.jpg';
import wall from '../assets/photos/dry-stone-wall.jpg';

export interface Photo {
  src: ImageMetadata;
  /** Describes what's in the picture, for screen readers. */
  alt: string;
  /** Shown under the photo. Optional. */
  caption?: string;
  /** CSS object-position for crops, e.g. '30% 50%' to keep a subject in frame. */
  focus?: string;
}

/** Photographer credit shown under the hero. Leave empty until known. */
export const PHOTO_CREDIT = '';

export const HERO: Photo = {
  src: heroImg,
  alt: 'A runner in a red vest and postie’s cap bounds down a green fellside holding a letter, with a wide valley of farms and woods below.',
  focus: '28% 45%',
};

/** "The round in pictures" on the home page, in walking order. */
export const GALLERY: Photo[] = [
  { src: abbeyFrost, alt: 'The ruined tower of Shap Abbey on a frosty morning, a red van crossing the bridge.', caption: 'Shap Abbey on a frosty morning' },
  { src: goggleby, alt: 'A runner passes a huge standing stone in a frosty field under a blue sky.', caption: 'Past the Goggleby Stone' },
  { src: swindaleOverlook, alt: 'A runner stands on a rocky knoll looking down a long green valley.', caption: 'Looking into Swindale' },
  { src: waterfall, alt: 'A tall waterfall pours into a dark pool between mossy crags.', caption: 'Waterfalls on the way to Mosedale' },
  { src: mosedaleGroup, alt: 'Four runners stand outside a small white cottage on the open fell.', caption: 'Mosedale Cottage, now a bothy' },
  { src: snowyTrack, alt: 'A walker follows a snowy track between stone walls into a white valley.', caption: 'The winter round' },
  { src: reservoir, alt: 'Brown autumn fellside falling away to a blue reservoir far below.', caption: 'Above Wet Sleddale' },
  { src: posties, alt: 'Two women in postie caps deliver letters at the doorway of a ruined stone building.', caption: 'Special delivery', focus: '50% 47%' },
];

/** One photo per stop on the route page, keyed by the stop name in config.ts. */
export const STOP_PHOTOS: Record<string, Photo> = {
  'Birchwood Cafe': { src: goggleby, alt: 'A runner passes the Goggleby Stone in a frosty field.', caption: 'The Goggleby Stone, on the way out of Shap' },
  'Shap Abbey': { src: abbeySummer, alt: 'A runner photographs the tower of Shap Abbey beside an old stone bridge.', caption: 'Shap Abbey' },
  'Swindale Foot': { src: swindaleOverlook, alt: 'A runner looks down a long green valley from a rocky knoll.', caption: 'Dropping into Swindale' },
  'Truss Gap': { src: snowFarm, alt: 'A white farmhouse in a wooded valley under snow-capped fells.', caption: 'Swindale in winter' },
  'Mosedale Cottage': { src: mosedaleGroup, alt: 'Four runners outside Mosedale Cottage, a small white bothy on the fell.', caption: 'Mosedale Cottage' },
  'Over Ralfland Fell': { src: fellGroup, alt: 'Four runners and a dog stand on rough open fell with hills behind.', caption: 'Up on the fell' },
  'Thorney Bank': { src: reservoir, alt: 'Autumn fellside above Wet Sleddale reservoir.', caption: 'Above Wet Sleddale' },
};

/** Banner photos for inner pages. */
export const PAGE_PHOTOS = {
  story: { src: posties, alt: 'Two women in postie caps deliver letters at a ruined stone building.', focus: '50% 40%' },
  route: { src: autumnValley, alt: 'An autumn valley of bracken and green fields under a blue sky.', focus: '50% 60%' },
  safety: { src: snowyRunner, alt: 'A runner on a snowy fell track under a pale sky.', focus: '55% 50%' },
  roundbook: { src: fellGroup, alt: 'Four runners and a dog on open fell, with hills behind.', focus: '50% 45%' },
  log: { src: letterSummit, alt: 'A runner in a postie’s cap leaps along a grassy ridge holding a letter aloft.', focus: '40% 18%' },
  faq: { src: wall, alt: 'A dry stone wall with snowy fells beyond.', focus: '50% 40%' },
  contact: { src: farmhouseSnow, alt: 'A stone farmhouse beneath a snow-dusted fell.', focus: '50% 40%' },
} satisfies Record<string, Photo>;

export const STORY_PHOTOS: Photo[] = [
  { src: bothyInside, alt: 'Runners inside a whitewashed bothy with a table and an old range.', caption: 'Inside Mosedale bothy' },
  { src: waterfallRunner, alt: 'A runner climbs beside a rocky waterfall.', caption: 'Swindale’s waterfalls' },
];
