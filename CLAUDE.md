# The Shap Postal Round

Public site for the last walked postal round in Shap, Cumbria, from Alan Cleaver's
*The Postal Paths* (Monoray, 2025). People walk or run the ~18 km loop from Birchwood
Cafe (Main Street, Shap CA10 3NJ), upload a GPX file or other evidence, and appear in a
dated round book (leaderboard).

The design source of truth is the prototype `reference/shap-postal-round.html`
(not yet committed). Port from it; don't redesign. Fonts Alegreya / Alegreya Sans;
palette fell `#2E4A2B`, moss `#6F8B3F`, pillar-box red `#C4241C`, paper `#EEF1E8`;
light and dark themes.

## Stack

- Astro (static output, TypeScript, no UI framework). Pages in `src/pages/`.
- Netlify Functions (v2, `netlify/functions/`) for the API under `/api/*`.
- Netlify Blobs for storage. No external database.
- GitHub → Netlify builds from `main`.

## Where things live

| What | Where |
|---|---|
| **All tunable constants** — Birchwood coordinates, check radii/thresholds, upload limits, rate limit, the 8 route stops (incl. sketch-map label placement) | `src/lib/config.ts` |
| **GPX parser + the five checks** (shared by browser and server; DOM-free) | `src/lib/gpx.ts` |
| Entry shapes, `toPublic()`, sorting for the three leaderboard views | `src/lib/rounds.ts` |
| Server-side form validation (the check that counts) | `src/server/submission.ts` |
| Blob stores, admin-token check | `src/server/store.ts`, `src/server/http.ts` |
| Home page / admin page | `src/pages/index.astro`, `src/pages/admin.astro` |
| Browser logic (instant GPX feedback, upload, leaderboard; admin) | `src/scripts/home.ts`, `src/scripts/admin.ts` |
| Sketch map (drawn from `STOPS`) | `src/components/SketchMap.astro` |

## API

- `GET /api/rounds` — public fields only: name, mode, date, secs, km, gpxChecked, verified, link, note. Never ids, IPs or file keys.
- `POST /api/rounds` — multipart. Validates everything, re-runs the GPX checks server-side (never trusts the client), stores JSON in the `rounds` store and files in `evidence` (`<id>/gpx`, `<id>/photo`). Honeypot field `website`. Rate limit: 5 accepted submissions per IP per hour (hashed IP in the `ratelimit` store; IPs are never stored in entries).
- `PATCH /api/rounds/:id` `{ "verified": bool }` and `DELETE /api/rounds/:id` — `Authorization: Bearer $ADMIN_TOKEN`.
- `GET /api/admin/rounds`, `GET /api/admin/evidence/:id/:kind` — admin only. GPX files and photos are never publicly served.

`/admin` is unlinked, `noindex`, and asks for the token in a password prompt (kept in sessionStorage for the tab).

**Request size:** Netlify functions accept ~6 MB per request. The browser gzips GPX files (server detects and unzips, 10 MB limit on the unzipped file) and resizes photos to 2048 px JPEG, so a normal submission is well under 1 MB.

**Status labels:** gpxChecked → "GPX checked"; verified → "Verified"; neither → "Waiting for check". Fastest runs/walks show only gpxChecked or verified entries.

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

Check with Holly before creating repos or Netlify sites, setting env var values, or making the repo public.
