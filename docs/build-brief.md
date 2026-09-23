# Build Brief — Shap Postal Round Website

Holly's content and scope brief (September 2026). This is the working spec for the site.
Provenance tags: `[CONV]` from the planning conversation; `[RESEARCH]` from web research;
`[UNVERIFIED]` asserted but not confirmed — check before publishing.

## Principles (non-negotiable)

1. **Zero café admin.** No bookings, discounts, free food or posting obligations. All web admin and contact routes go to Holly, not the café. `[CONV]`
2. **Not a race.** Inclusive first; timing is a parkrun-style courtesy, not an organised event. `[CONV]`
3. **Café owner not personally prominent**, but the family's postal heritage is acknowledged. `[CONV]`
4. **Respect the land and rights of way.** Stay on public footpaths; no shortcuts across private land. `[CONV]`
5. **Safety without a disclaimer tone** — warm, clear, honest about the terrain. `[CONV]`
6. **Gender-neutral "postie"** in general copy; "postman" only for Stuart Lewis specifically. `[CONV]`
7. **Low maintenance / static-first.** Runs for months without a developer. `[CONV]`
8. Reuse the first-draft page and its palette (from the cover of *The Postal Paths*). `[CONV]`
9. **Always credit Alan Cleaver**, who has given permission to use his words with attribution. `[CONV]`

## Site map

Home · The Story · The Route · Safety & Respect · Log Your Round (+ round book) · FAQ · Contact · Privacy. `[CONV]`

## MVP features

- Static content pages; copy editable as plain files.
- Two GPX downloads — **long round ~14.73 miles by GPS (often quoted as 15)** and **short "winter" round ~10.3 miles** — with a "follow this route / stay on public footpaths" note. `[CONV]`
- Route map(s). Cleaver's Google map only with his permission. `[CONV]`
- Contact form → Holly (Netlify Forms). `[CONV]`
- Moderated round book: name/nickname, date, long/short, time, GPX or activity link, optional photo, consent to display. Holly approves. `[CONV]`
- Link to the café's existing Instagram; no new social accounts. `[CONV]`
- Finisher pin/badge collected in person at the café with a finisher photo. `[CONV]`

Later (optional): sortable leaderboard, finishers' stories, printable "postal passport", Tuesday app deep-link (must stay optional), souvenir shop.

## Content facts

- Stuart Lewis was the last to walk the ~15-mile Shap round on foot, until June 1976. Quote (verified, Cleaver): *"It broke my heart. I loved the walk and went out in all weathers. There wasn't a day when we didn't complete the round even in mist, snow and ice."* `[RESEARCH]`
- *The Postal Paths: Rediscovering Britain's Forgotten Trails And The People Who Walked Them* (Monoray, 2025). `[RESEARCH]`
- The café is run by Stuart's family, who ran Shap's post office and sorting office for generations; it keeps an original post office counter and memorabilia. Do not name the owner. `[CONV]`
- Cleaver: the historic round ran "through Swindale, over Ralfland Fell and back through Wet Sleddale", with an extra ~3 miles to Mosedale for the six weeks a year the shepherd was resident. `[RESEARCH]`
- Long round: steady run ~3–3.5 h; walkers allow a full day; the historic round took 5–6 h. `[CONV]`
- Short round omits summer-only cottages; Cleaver quotes ~8 miles historically. `[CONV]`
- **Shap Abbey reroute:** the Coast to Coast has been rerouted with new bridges and some old signs removed. Do not shortcut straight up from the abbey across the fields — follow the current right of way. Parish Crag Bridge (18th-century packhorse bridge) over Swindale Beck. `[CONV]`/`[RESEARCH]`
- Territorial buzzard in Swindale — transient, keep as an editable seasonal note. `[CONV]`/`[UNVERIFIED]`
- Safety: café flyer wording; AdventureSmart's three questions verbatim; MWIS forecast; whistle/torch, six blasts or flashes repeated each minute; not an organised event. Liability line needs brief advice. `[RESEARCH]`
- Respect: Countryside Code — Respect · Protect · Enjoy. `[RESEARCH]`

## Route sources (added September 2026)

Photos in `docs/research/`:

- **Café's illustrated map, "The Postman's Route"** (hand-drawn watercolour, 9 numbered stops): 1 Birchwood Cafe (parking on the A6) → past the Goggleby Stone → 2 Shap Abbey → 3 Tailbert Farm (Keld signpost) → 4/5 Swindale Foot Farm and Truss Gap (Swindale Head nearby; numbering of 4 and 5 is hard to read in the photo) → 6 Mosedale Cottage bothy → 7 Sleddale Hall → Green Farm → 8 Thorney Bank Farm → 9 Stepps Hall → cross the river to the A6 → café. "Shorter route via Ralfland Fell" dotted from Truss Gap to Sleddale Hall. Scroll: **24 km, 600 metres of climb, OS map OL5 + compass.** Flyer text: "Until 1976 the local postman would deliver mail to the remote farms and homes around Shap on foot. A tough 15 miles, in all weather, six days a week. The Postman's Route is as challenging today, passing through some of Britain's most beautiful scenery and notable landmarks. If you wish to accept this challenge please ensure you leave early, be fit and well prepared for all eventualities. Good luck and enjoy this route that commemorates the posties who served their communities over the years." `[CONV]`
- **Alan Cleaver's route sheet, "Shap Postal Path"** (start/finish Birchwood Cafe; 15 miles; four to five hours, "tough in places"; OS OL5). Steps: 1 road to Shap Abbey; 2 west out of the abbey across a boggy field to a tarmac road; 3 road to Tailbert Farm, through the farm to the deserted Tailbert Head; 4 down into Swindale, cross to the road, deliver along it, double back to Truss Gap, climb Gouther Crag onto Ralfland Fell, take a bearing over the fell to Wet Sleddale; 5 drop to Sleddale Hall (Uncle Monty's cottage, *Withnail & I*); 6 terrace path to Thorneybank and back to Shap. **Green additional route:** Mosedale Cottage (now a bothy), shepherd resident six weeks a year, "an additional three miles but worth the walk if you are fit enough!" Thanks to Stuart Lewis and Jean Scott-Smith for help plotting. Includes an OS map extract — **Ordnance Survey copyright, do not publish.** `[RESEARCH]`

- **OS Maps GPX, "Shap Postman's Round"** (`public/gpx/shap-postal-long-round.gpx`, copy in `tests/fixtures/real-long-round.gpx`): the long round, **23.7 km, 570 m ascent**, planned route (no timestamps). Starts and finishes at 54.530675, −2.677442 (now `BIRCHWOOD` in config). Goes Shap Abbey → Tailbert → Swindale Foot → Truss Gap → Swindale Head → Mosedale Cottage (54.4779, −2.7813, out and back a little) → Flatbed Bridge → Wet Sleddale → Sleddale Hall → Thorney Bank → Stepps Hall → A6 → café. No short-round GPX yet. `[CONV]`
- **Jude's *Fellrunner* article, "The Postman's Round"** (`docs/research/fellrunner-article-postmans-round.docx`): tagline "Tougher than it looks. Traversing three remote Lake District valleys." Café grid ref NY 56268 15254; old post office counter and **old post office clock** (check your time against it); Goggleby Stone is a 10-ft prehistoric monolith; Shap Abbey 12th century; Tailbert Head ruin, once home of the reclusive Mary Burgess; seldom-used path to Swindale Foot Farm (bracken in summer); lower valley path to Swindale Head; old bridleway round the valley head past abandoned farmsteads; up to Mosedale by old path or scrambling beside waterfalls with deep pools; Mosedale Cottage the most remote bothy in the Lake District (shepherds, slate-quarry workers); retrace, cross Mosedale Beck at Flatbed Bridge, steep boggy climb to head of Wet Sleddale; site of the postman's sentry-box shelter (gone); under Scam Matthew (519 m) to Sleddale Hall (18th century, Crow Crag in *Withnail and I*); terraced track to Green Farm; postbox at Thorney Bank Farm; river on the right, concrete road, follow the river to Stepps Hall; **stepping stones — impassable in spate, use the road from Thorney Bank to the A6**; lane or fields to the A6, left, north to the café. Article says to add your time to "the leaderboard in the village café", which conflicts with zero café admin — the site's round book is online. `[CONV]`

Reading of the two: long round = with the Mosedale loop (café map's 24 km ≈ the brief's 14.73 mi); short round = Ralfland Fell shortcut (≈ 10.3 mi by GPS). Cleaver's "15 miles" is the historic figure. Confirm against Jude's GPX.

The café map photos have glare and are rotated: fine for reference, not for publishing. A flat scan is still needed if the café wants it on the site.

Cleaver's sheet is titled **"Shap Postal Path"**, which supports that name.

## Decisions since the brief

- **Name: "The Postman's Challenge"**, byline "Take on the last post round in Shap, Cumbria" (Holly, Sept 2026). "Loneliest" dropped.
- **Jude's *Fellrunner* article is the voice of the site** (Holly: "the heart and soul of the challenge"): her tagline, her words on why local runners share the round, her stop-by-stop route guide and sign-off. Credited to "Jude, Shap fell runner" — surname to confirm with Holly.

- **Café owner Stacy is now named** (Holly, Sept 2026): "Stacy's story" on the home page and the new /birchwood-cafe/ page. Wording is drafted only from facts in this brief (family ran the post office and sorting office; post sorted at six each morning; her father one of the last postmen on the round; counter, clock, memorabilia). **Check with Stacy before launch.**
- **Instagram:** the café's account is @birchwoodcafeshap (found publicly). Home and café pages link to it with a photo strip; hashtag suggested: #ThePostmansChallenge. Showing the café's actual latest posts needs a feed widget or an Instagram access token.

## Naming

Recommended: **The Shap Postal Round**. Strong alternative: **The Shap Postal Path**. Use "loneliest" with caution: it may deter solo walkers, especially women, and the documented "loneliest round in England" phrase comes from the *Post Office Magazine*, August 1936, about the Keld–Tan Hill postman in Yorkshire, not Shap. `[CONV]`/`[RESEARCH]`

## Publish-blockers

- `[UNVERIFIED]` Shap chapter title in *The Postal Paths* — check the book.
- `[UNVERIFIED]` "1956 Westmorland Gazette called it the loneliest round" — likely conflated with the 1936 Yorkshire article. Do not publish.
- Confirm distances and the on-the-ground line against the final GPX; confirm the current Shap Abbey right of way.
- Written attribution wording from Alan Cleaver; Google map permission if embedding.
- Liability wording reviewed.

## Open decisions

Final name · launch date (Oct/Nov) · leaderboard from day one · pin/badge design and supply · "Postman's Special" menu mention · Cleaver's Google map · liability wording · timing with Jude's *Fellrunner* article (Winter edition).

## Assets still needed

GPX for both rounds (Jude's recce) · hero/gallery photos with credits · archival post office photos · scan of the café's hand-drawn map · Cleaver's written attribution · café Instagram handle.

## Hosting caveat

Netlify accounts created after 4 September 2025 are on a credit-based free plan (~300 credits/month). Confirm which plan Holly's account is on. Netlify Forms are free up to 100 submissions/month.
