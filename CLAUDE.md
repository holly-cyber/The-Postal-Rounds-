# The Shap Postal Round

Public heritage site for the last walked postal round in Shap, Cumbria, from Alan Cleaver's
*The Postal Paths* (Monoray, 2025). People walk or run the long (~14.7 mi) or short "winter"
(~10.3 mi) round from Birchwood Cafe (Main Street, Shap CA10 3NJ), upload a GPX file or other
evidence, and appear in a dated round book (leaderboard).

**Scope, principles and content facts: `docs/build-brief.md`.** Read it before changing copy.
The big ones: zero admin for the café (contact routes to Holly, never the café); not a race;
café owner not named; "postie" in general copy, "postman" only for Stuart Lewis; always credit
Alan Cleaver; don't publish anything marked `[UNVERIFIED]` there.

Visual design grew from the prototype `reference/shap-postal-round.html`. Current look (Holly's call,
Sept 2026): white page, self-hosted Inter (text) and Inter Tight (headings) via @fontsource-variable;
palette fell `#2E4A2B`, moss `#6F8B3F`, pillar-box red `#C4241C`; light and dark themes.

## Stack

- Astro (static output, TypeScript, no UI framework). Pages in `src/pages/`.
- Netlify Functions (v2, `netlify/functions/`) for the API under `/api/*`.
- Netlify Blobs for storage. No external database.
- GitHub → Netlify builds from `main`.

## Where things live

| What | Where |
|---|---|
| **All tunable constants** — site name/strapline, Instagram, pins flag, Birchwood coordinates, the two rounds (distances, GPX file names, per-round check thresholds), upload limits, rate limit, the 8 stops (text + sketch-map positions), home facts, route notices | `src/lib/config.ts` |
| **Editable page text** (story, safety & respect, FAQ, privacy) | `src/content/pages/*.md` |
| GPX downloads (buttons appear once the files exist) | `public/gpx/` |
| **GPX parser + the five checks** (shared by browser and server; DOM-free) | `src/lib/gpx.ts` |
| Entry shapes, `toPublic()`, sorting for the three leaderboard views | `src/lib/rounds.ts` |
| Server-side form validation (the check that counts) | `src/server/submission.ts` |
| Blob stores, admin-token check | `src/server/store.ts`, `src/server/http.ts` |
| Pages: home, story, route, safety, log (entry form), round-book (records + filterable leaderboard + everyone), FAQ, contact (Netlify Forms), privacy, admin | `src/pages/` |
| Browser logic: entry form (`log.ts`), round book with URL-shareable filters (`roundbook.ts`), admin | `src/scripts/` |
| Sketch map (drawn from `STOPS`) | `src/components/SketchMap.astro` |
| **Photos**: originals in `src/assets/photos/` (never `public/` — Astro optimises imported photos to AVIF/WebP). Which photo goes where, alt text, captions, crop focus | `src/lib/photos.ts` |
| Home hero | `src/components/Hero.astro` |

## API

- `GET /api/rounds` — public fields only: name, round, mode, sex, ageGroup, date, secs, km, gpxChecked, verified, link, note. Never ids, IPs or file keys.
- `POST /api/rounds` — multipart. Requires `round` (long|short) and `consent=yes`; optional `sex` (F|M) and `ageGroup` (5-year bands: U20, 20-24 … 75-79, 80+). Validates everything, re-runs the GPX checks server-side (never trusts the client), stores JSON in the `rounds` store and files in `evidence` (`<id>/gpx`, `<id>/photo`). Honeypot field `website`. Rate limit: 5 accepted submissions per IP per hour (IP HMAC-hashed with ADMIN_TOKEN in the `ratelimit` store; IPs are never stored in entries).
- `PATCH /api/rounds/:id` `{ "verified": bool }` and `DELETE /api/rounds/:id` — `Authorization: Bearer $ADMIN_TOKEN`.
- `GET /api/admin/rounds`, `GET /api/admin/evidence/:id/:kind` — admin only. GPX files and photos are never publicly served.

`/admin` is unlinked, `noindex`, and asks for the token in a password prompt (kept in sessionStorage for the tab).

**Request size:** Netlify functions accept ~6 MB per request. The browser gzips GPX files (server detects and unzips, 10 MB limit on the unzipped file) and resizes photos to 2048 px JPEG, so a normal submission is well under 1 MB.

**Leaderboard:** `leaderboard()` in `src/lib/rounds.ts` filters by round, walk/run, category (overall/F/M) and age group; only checked or verified rounds with a time are ranked. Category and age group are optional, so entries without them appear in Overall only.

**Evidence tags:** "Verified", "GPX checked", or "Waiting for check" when neither. Fastest runs/walks are per round and show only gpxChecked or verified entries with a time. Time is optional; if blank, the GPX elapsed time is used.

## Develop

```sh
npm install
npm test              # GPX checks + server validation (node --test)
npm run fixtures      # regenerate tests/fixtures/*.gpx from config.ts
ADMIN_TOKEN=dev netlify dev   # http://localhost:8888, Blobs run in a local sandbox
npm run build         # astro check + astro build → dist/
```

Note: in agent shells Astro 7 backgrounds `astro dev` itself; run netlify dev with
`env -u AI_AGENT -u CLAUDECODE`. Edge-function setup needs Deno (`npm i -g deno` if the download is blocked).

## Deploy

`netlify.toml`: build `npm run build`, publish `dist`, functions `netlify/functions`.

1. Push to `main` on GitHub; Netlify builds from `main`.
2. First time: `netlify init` to link the repo to a site, then `netlify env:set ADMIN_TOKEN <value>` (ask Holly for the value; never commit it).
3. `netlify deploy --prod` or push to `main` to deploy.
4. Contact form: in the Netlify UI, enable form detection (Forms) and add an email notification to Holly.

Check with Holly before creating repos or Netlify sites, setting env var values, or making the repo public.
