# Boxoffy as the Indian Box Office Oracle — Build Plan

Written 4 October 2026. Everything below was costed and verified on the day;
re-check the pricing and the directory requirements before you act on them.

The goal: Boxoffy answers any Indian box office question, in any language, for
any era — through an MCP server that AI assistants query, and eventually
through an X account people tag. The two are separate products on one
foundation, and the foundation is the dataset.

---

## 0. The honest starting position

The data today will not support an oracle. From the audit on 3 October:

- All 92 of the 2026 rows in `films.json` have `openingWeekend` and
  `openingDay` **empty**. Also 0 of 11 in 2025.
- `totalNum` means different things per row — Border 2's is worldwide,
  Dhamaal 4's is neither India net nor worldwide, the rest are India net.
- 68 duplicate rows across 59 slugs; MSVP appears twice.
- 8 rows publish figures from BCM-excluded sources.
- Drishyam: The Conclusion's own row is still blank.

Ask that dataset "biggest Telugu opening of 2026" and it answers wrongly, with
confidence, in public. Fixing it is step one of everything else.

**The inversion that prevents it recurring:** today `films.json` *is* the
database, which is why it rots. In the new shape it becomes a **build output**
generated from the database at deploy time. Nothing hand-edits it again.

---

## 1. What makes us the authority (not just another tracker)

Three things nobody else does. These are the product, not the row count.

**Basis discipline.** India net, India gross (×1.18 — the statutory GST
ceiling, which is why Sacnilk's 1.20 exceeds what the tax allows), overseas,
worldwide; Fri–Sun strict vs extended. Almost every argument on film twitter
is two people quoting different bases at each other. An oracle whose first move
is "those two numbers aren't comparable, and here's why" beats one that answers
faster.

**Revision history.** Sacnilk revised Drishyam's day one from ₹66.75 Cr to
₹62.00 Cr. Nobody publishes that trail. We can.

**Our own primary data.** District sweeps give exact seats sold and advance
gross per city. NA sweeps give screens, showtimes, occupancy, presales. No
competitor has seat-level primary data. It compounds — seven months in it is
thin, in three years it is unmatched and unbuyable. Every sweep is a deposit.

Plus the discipline we already run: publish an estimate, then **grade it**.
"We called ₹61 Cr, it did ₹62" is unarguable in a way speed never is.

---

## 2. Storage architecture

### The three tiers

```
boxoffy\
  harvest\                      <- RAW. append-only, never edited
    tmdb\<date>\movies.jsonl
    wikidata\<date>\films.jsonl
    wikipedia\<date>\year-lists.jsonl
    wikipedia\<date>\infoboxes.jsonl
    numbers\<date>\films.jsonl
  intel\                        <- RAW. what the sweeps already write
    doomsday-2026-12-18\*.csv
  data\
    boxoffy.db                  <- DERIVED. built by ingest, deletable
```

**Rule: raw files are the truth, `boxoffy.db` is a derived artifact you can
delete and rebuild at any time.** So back up `harvest\` and `intel\` to cloud
storage; the `.db` needs no backup. Add `data/boxoffy.db` and `harvest/` to
`.gitignore` — a 500 MB binary in git makes the repo miserable and slows
Vercel deploys.

### Why fetch and ingest are separate phases

Harvesters write JSONL only. A separate `ingest.py` reads raw and writes rows.

1. **Crash safety.** A 50-minute fetch dying at minute 45 leaves a partial
   JSONL, not a half-written database.
2. **Re-derivable.** The reconciliation rules *will* change the first time two
   tier-1 sources disagree. Re-run ingest in minutes instead of re-fetching
   60,000 films.
3. **Provenance.** The JSONL is what the source said at that minute, before
   any interpretation. When a number is challenged in public, that file is the
   receipt.

### Schema — claim-centric, not film-centric

Tables: `film`, `film_alias`, `release`, `claim`, `source`, `resolution`,
`coverage`.

The one that matters:

```sql
claim(film_id, metric, value, basis, territory, measure,
      period_start, period_end, source, source_url,
      as_of, confidence, raw_ref)
```

One row per figure **per source per as-of date**, and **nothing ever updates a
claim — you only insert.** Sacnilk's ₹66.75 Cr and its later ₹62.00 Cr are two
rows, not an edit. That gives revision history for free. A separate
`resolution` table records which claim we published and under which rule.

`source_url` and `as_of` are NOT NULL, so no figure can enter undated or
unsourced.

`source` carries the BCM tier and an excluded flag. Reminder of the hierarchy:
**Box Office India > Sacnilk > Bollywood Hungama**. Excluded by name: Koimoi,
Filmibeat, Sumit Kadel, Rohit Jaiswal, BollywoodLife, India.com, Tenvow,
Pinkvilla. Uncatalogued: VenkyBO, Gitesh Pandya / BoxOfficeGuru, Glamsham.

### Hosting and cost

SQLite is **public domain** — no licence to accept, no attribution, nothing to
pay, commercial use included. It isn't hosted; it's a file on your machine.

Serving layer options, verified 4 Oct 2026:

| | Free tier | First paid tier |
|---|---|---|
| **Turso** (hosted SQLite) | 5 GB, 500M row reads/mo, 10M writes/mo | $29/mo |
| **Cloudflare D1** (SQLite) | 5 GB, 5M rows read/day, 100k written/day | from $5/mo |
| **Neon** (Postgres) | 1 GB/project, 20 GB total, 100 CU-hours | $0.106/CU-hour |
| **Supabase** (Postgres) | 500 MB | $25/mo |

Expected database size **400–600 MB**: ~60,000 films, ~1.2M credit rows,
~600k claims, plus indexes. Two things keep it there: **never store images**
(keep TMDB poster paths, TMDB serves them free), and keep the raw JSONL as
files rather than rows.

**Recommendation: Turso.** Not for the headroom — because it *is* SQLite. Push
the same file you built locally; no schema translation, no second dialect. D1's
5 GB is equally comfortable but it hard-stops with no grace period when the
daily read cap is crossed, which is an ugly failure mode for a public MCP
server. Supabase's 500 MB is too tight, Neon's 1 GB is snug.

Running cost of the whole data stack:

```
SQLite              $0    public domain
Turso free tier     $0    until 5 GB / 500M reads a month
TMDB API            $0    attribution required in the UI
Wikidata            $0    CC0
Wikipedia           $0    CC BY-SA, attribute it
Vercel              already paying
----------------------------------------
                    $0 / month
```

Obligations: TMDB requires a visible line stating the product uses their API
but is not endorsed or certified by TMDB. Wikipedia text is CC BY-SA —
individual box office **figures** are facts and fine to use, but lifting
article prose inherits the licence. Harvest numbers and citations, not
sentences.

---

## 3. Bootstrapping the dataset

### Metadata is solved and free

TMDB publishes **daily ID export files** and `discover` filters on
`original_language`. Ten languages (`hi te ta ml kn bn mr pa gu or`), every
year back to the 1930s — call it 50,000–80,000 Indian titles. With
`append_to_response` you get credits, external IDs and images in one call per
film, including the **IMDb ID** you need for joining.

### Box office has no complete source

| Era | What's gettable | Depth |
|---|---|---|
| 2014 → now | BCM sources + our own sweeps | Day-wise, our best |
| 2000 – 2014 | Wikipedia/Wikidata cited figures, BOI | Weekend + lifetime |
| Pre-2000 | Box Office India nett and **footfalls** | Lifetime only, contested |
| Overseas/NA, all eras | The Numbers weekend charts, Mojo | Weekend, proven |

**Footfalls are the better historical metric** — inflation-proof, and the only
honest way to compare 1975 with 2026. BOI publishes them.

**The Wikipedia trick:** a large share of Wikipedia's Indian box office figures
are already cited to BOI and Sacnilk. Harvesting Wikipedia *with its
citations* gives you the figure and the attribution trail, legitimately,
without touching BOI's database directly.

### Sources already evaluated and rejected

**The Numbers' per-language index** (`the-numbers.com/language/Hindi/movies`):
1,024 Hindi films for 1957–2024, worldwide-only, and it lists *Indiana Jones
and the Temple of Doom* as 1984's top-grossing Hindi film. Language-tag
contamination. Real Hindi output is 20,000+ titles. **Do not build on it.**
Their weekend charts and per-film pages are good — the language index is not.

### The one real wall

Proprietary deep history. India nett and footfalls for pre-2000 live at Box
Office India and nowhere else in bulk. A weekend scrape of the incumbent's
database, while positioning as the authority, is the one move that can
actually hurt us — legally and reputationally. **Email BOI about a data
licence.** If they don't answer, that era ships as Wikipedia-cited figures with
the gap stated.

### The real risk is entity resolution, not bandwidth

Same title across three languages and four decades, remakes, dubbed versions,
"Part 1" conventions, Devdas existing five times. Fetching 60,000 films is an
hour; joining them correctly is the whole job.

**Mitigation: IMDb ID as the join key everywhere.** TMDB's `external_ids` gives
it, Wikidata has P345, Wikipedia infoboxes link it. Anything without one falls
back to normalised title + year + language and gets **flagged, not merged**.

A 60,000-row dump with bad joins is worse than nothing, because the first thing
rivals do is hunt for your Indiana Jones row — exactly as we found theirs.

---

## 4. The five steps

### Step 1 — Schema and storage (Friday night)

Build `boxoffy.db` with the tables above. Create `harvest\` beside `intel\`.
Nothing fetches yet.

**Done when:** every harvester has a table to write into, and `claim` inserts
are append-only with `source_url` and `as_of` non-nullable.

**Trap:** getting this wrong costs the whole weekend, because every later step
writes into it. The only step worth doing slowly.

### Step 2 — Metadata spine (Friday night → Saturday morning)

TMDB harvester: daily ID export plus `discover` across all ten languages,
every year, `append_to_response` for credits and external IDs. Raw JSONL to
`harvest\tmdb\`, then ingest.

**Done when:** ~60,000 films in `film`, the large majority carrying an IMDb ID.

**Trap:** store poster *paths*, never images.

### Step 3 — Box office harvest (Saturday)

Four harvesters run **concurrently** — Wikidata SPARQL, Wikipedia year-lists,
Wikipedia infoboxes, The Numbers. Every figure lands as a claim with its
citation.

**Done when:** 10,000+ films have at least one sourced figure, each with basis
and territory recorded.

**Trap:** a figure with no stated basis is worthless. If you can't tell whether
it's India net, gross or worldwide, write `basis = unknown` rather than
guessing. Guessing is how Border 2's worldwide number ended up in an India-net
column.

### Step 4 — Reconcile and mine our own archive (Sunday)

Join on IMDb ID; fuzzy matches flagged, not merged. Harvest the 66 editorials
and the `intel\` folders — figures already researched and graded, plus
primary seat-level data. Apply the BCM hierarchy to write `resolution` rows.
Export exceptions (failed joins; tier-1 sources disagreeing by >5%) to a Google
Sheet, adjudicate by hand, import decisions back.

**Sheets belongs here and only here** — a review surface for exceptions, never
storage. 600k claim rows will not live in a spreadsheet.

**Done when:** there's a resolved view the API can read, plus a coverage map
stating exactly what exists per era, territory and metric.

**Trap:** this is where the weekend actually gets eaten.

### Step 5 — Ship it (Sunday night → the week)

Push to Turso. Thin JSON API on Vercel, every response carrying basis, source
and as-of. Regenerate `films.json` **from the database**. Then the MCP server,
and submit it.

**Done when:** you can ask Claude about a 1994 Telugu film and get Boxoffy's
answer, attributed.

---

## 5. How the harvesters actually run

**On your machine, from a cmd window in the boxoffy root** — same as the
sweeps. The cloud container's egress blocks TMDB, Wikidata, Wikipedia, the
Wikimedia dumps and The Numbers, exactly as it blocks Fandango and District.

```
cd /d "%USERPROFILE%\boxoffy"
python sweeps\harvest\tmdb_harvest.py
python sweeps\harvest\wikidata_harvest.py
python sweeps\harvest\wikipedia_harvest.py
python sweeps\harvest\numbers_harvest.py
```

**Unlike the Fandango sweeps, these run at the same time.** Fandango sweeps
must be sequential because they hit one Akamai edge; these are four unrelated
services with four separate rate limits.

```
TMDB         ~60,000 films, 1 call each      25-50 min
Wikidata     ~100 chunked SPARQL queries      5 min
Wikipedia    ~900 year-lists + ~15k films    20-30 min
The Numbers  a few thousand films            20-30 min
```

All four in parallel: **under an hour.**

Design requirements for each harvester:

- **Checkpoint and `--resume`**, the `_seatcache.json` pattern that saved the
  seat pass. A 50-minute job will get interrupted.
- **Chunk Wikidata by year and language.** Their SPARQL endpoint times out at
  60 seconds; one "all Indian films" query will never return.
- **Wikipedia needs a descriptive User-Agent with contact details.** Their API
  policy; anonymous bulk requests get blocked.
- **Credentials from `.env.local`**, never hardcoded.

---

## 6. Film pages and discoverability — 60,000 pages

The ask: someone searching the web, or asking an AI, should always land on a
Boxoffy page. Two platform facts settle the architecture before any design
choice.

### What the platform allows (verified 4 Oct 2026)

- **Vercel caps a CLI deployment at 15,000 source files.** Deployments with
  more fail at the build step. So 60,000 pre-generated HTML files **cannot be
  committed and shipped** the way we deploy today (`vite build` then
  `vercel --prod`).
- **There is no cap on output files created during a build**, but the build
  must finish inside **45 minutes** on every plan, or it fails.
- Vercel's own recommendation for this exact case is **ISR**: prerender a
  subset at build time and generate the rest on demand.

### What Google allows

Google's scaled content abuse policy is a three-part test, and it needs all
three to bite: **volume + manipulative intent + low value**. Volume alone is
not the trigger. A database-driven site with genuinely unique data per page
scales without risk.

That is the hinge. A page carrying our own seat-level data, our graded calls
and a revision trail is genuinely unique — nobody else has it. A page that says
"Film X, 1987, Hindi, directed by Y, no box office data" repeated 45,000 times
is the thing that gets a domain demoted. Recommended mitigations are exactly
what we should do anyway: genuine uniqueness per page, real editorial
oversight, pages that answer actual search demand, and a regular audit that
prunes or noindexes thin pages that attract no traffic.

**So page creation is gated on data richness, not on having a row.**

### Tier the 60,000

| Tier | Roughly | What it has | Treatment |
|---|---|---|---|
| **A** | 2,000–5,000 | Box office + metadata + our own sweep data, graded calls, revisions | Full page, prerendered at build, in sitemap, full JSON-LD |
| **B** | 10,000–15,000 | Metadata + at least one sourced figure with a stated basis | Page, prerendered or on-demand, in sitemap |
| **C** | ~45,000 | Metadata only | On demand, `noindex, follow`, **not** in the sitemap, rolled up into hub pages until it earns a figure |

A tier C page is not wasted — it exists so a URL resolves and an AI or a user
is never dead-ended, and it carries `follow` so link equity still flows to the
hubs. It graduates to tier B the moment a sourced figure lands, which happens
automatically on the next ingest.

### How the long tail gets served without Next.js

We are on Vite, so there is no built-in ISR. The equivalent, and it is simple:
a Vercel serverless function on `/film/[slug]` that reads Turso, renders the
HTML, and returns it with

```
Cache-Control: s-maxage=86400, stale-while-revalidate=604800
```

The CDN then serves it from the edge and revalidates in the background — ISR
in practice, without migrating the stack. Tier A stays prerendered at build
because those pages must be fast and must exist even if the database is down.

### Crawl paths — 60,000 orphans get crawled by nobody

Hub pages are how crawlers and AI agents reach the long tail. We already have
the production-house pages, which is the right instinct; extend it:

- Year × language: "Telugu films of 1987"
- Star filmography, director filmography
- Production house (exists)
- Records: biggest openings, highest footfalls, biggest NA debuts
- "Highest-grossing Telugu films of the 1990s" style list pages

These are also the pages that actually rank, because they answer the questions
people really ask. The individual film page is the destination; the hub is the
road.

### URLs, sitemaps, canonicals

- **Scheme:** `/film/<slug>-<year>`, with a language segment only when there is
  a genuine collision. Devdas exists five times — the slug must disambiguate.
- **Sitemaps:** 50,000 URLs and 50 MB per sitemap file, so a **sitemap index**
  plus several sitemaps, generated from the DB. Only tiers A and B go in.
  `generate-sitemap.cjs` already exists and gets extended.
- **Canonical tag on every page**, pointing at the one true URL.
- **Fix the legacy mess first:** 7 different naming shapes across 18 weekend
  articles, and 12 URLs in `editorials.json` missing a leading slash (they 404
  from any sub-page). Add `vercel.json` redirects for the old shapes before
  adding 60,000 more URLs on top.

### The AI half — how an AI answer leads back to us

This matters more than classic SEO for our positioning, and it is not the same
work:

- **JSON-LD `Movie` schema on every page.** We already ship valid JSON-LD in
  articles, so this is an extension, not a new capability. Include name,
  alternate names, release date, language, director, cast, and box office as
  `aggregateRating`-adjacent custom properties plus plain visible figures.
- **`/llms.txt` and `/llms-full.txt`.** The emerging convention for telling AI
  crawlers what a site contains and where the structured data lives. Vercel and
  Anthropic both publish one.
- **`robots.txt` decision — allow the AI crawlers.** ClaudeBot, GPTBot,
  PerplexityBot and friends. This is a real trade: allowing them means
  citations rather than clicks. For an oracle, the citation *is* the brand, and
  being the source an AI names beats being a tab someone closes.
- **The MCP server is the direct channel**, and here is the loop that answers
  the original question: **every MCP tool response and every API response
  carries the canonical page URL for the film.** So when someone asks Claude
  about a 1994 Telugu film and gets our number, the answer comes with our link
  attached. That is the "always a way to reach us" — not scraped, not
  guessed, handed over by us with attribution built in.
- **Document the API publicly.** AI crawlers read docs pages, and a documented
  public API is itself a discovery surface.

### Build-time reality check

60,000 pages prerendered at even 20 ms each is 20 minutes, before any data
fetching — uncomfortably close to the 45-minute wall, and every deploy pays it.
Which is the second reason tiering is not a compromise: **prerender 5,000, serve
55,000 on demand**, and deploys stay in the low minutes.

## 7. The MCP server

Verified requirements, 4 Oct 2026 (see sources):

- Remote server over **HTTPS**, submitted at `claude.ai/directory/manage`
- **No authentication required for public data** — removes OAuth entirely,
  the hardest part of most submissions
- Every tool needs a `title` and a `readOnlyHint` annotation
- Needs: documentation URL, privacy policy URL, support contact, icon, and a
  **test account for reviewers**
- Any paid Claude plan can submit; auto-scanned, lists as a Community
  connector by default, some submissions get human review
- Escalations: `mcp-review@anthropic.com`

Tools to ship: `search_film`, `get_box_office` (film + territory + measure),
`get_weekend_chart`, `compare_films`, `get_record`, `get_revisions`.

**Every tool returns basis and as_of alongside the number.** Otherwise the
model reading our data states it without caveats and the mistake lands on our
name.

Do not put the Cineplex key, the TMDB token or any credential in it — security
review will catch it, and the collection method is our advantage anyway.

---

## 8. The X bot (last, not first)

Three things that will bite:

**AI-generated replies need explicit prior written approval from X**,
regardless of tier. Apply before building.

**Pricing is pay-per-use and links are punitive.** $0.015 per post, **$0.20 if
the post contains a link**, $0.005 per post read, capped at 2M reads/month.
Legacy Basic ($200/mo) and Pro ($5,000/mo) are closed to new signups;
Enterprise starts around $42,000/mo.

At 300 replies a day:

```
plain text      9,000 x $0.015  =   $135/mo
with a link     9,000 x $0.20   = $1,800/mo
```

So: **answer in plain text, link only when asked for the source.** One design
decision, 13× cost difference.

**Reputation risk is asymmetric.** One confidently wrong number in a viral
reply costs more than a hundred right ones earn. The bot answers only from the
database and says "we don't have a verified figure for that" otherwise. That
refusal is the brand, not a failure of it.

**Before automating:** when people tag us, answer manually with the API doing
the lookup. Fifty hand-checked replies teach you which questions actually get
asked and which ones the data can't answer yet.

---

## 9. Open items carried in

- Confirm whether the plaintext TMDB bearer token ever reached GitHub; rotate
  if so. It is about to make 60,000 calls.
- Decide whether VenkyBO and Gitesh Pandya / BoxOfficeGuru enter BCM 12 —
  without them, Telugu films in NA cannot be ranked.
- `films.json`: 68 duplicate rows across 59 slugs, empty opening fields,
  inconsistent `totalNum`, 8 rows on excluded sources.
- Weekend article naming: 7 shapes across 18 articles. Standardise, and
  consider `vercel.json` redirects for the old ones.
- `editorials.json` entry for `weekend-insight-september-11-13-2026.html`
  (dated 2026-09-12) sits out of date order at the bottom.

---

## 10. The claim to make publicly

Not "all movies, forever." **Stated coverage with confidence:** day-wise from
2014, weekend-level from 2000, lifetime-only before that, every figure carrying
its source and as-of date.

Publish the **coverage map alongside the dump.** Leading with "here is exactly
what we have and what we don't" is what makes a 60,000-row release
unassailable instead of a target.

And prioritise by question, not by row count. What gets asked clusters tightly:
the current release, this year's top ten, the all-time top ten, a star's
biggest opener, head-to-heads.

---

## Sources checked for this plan

- Claude connector directory submission requirements —
  https://claude.com/docs/connectors/building/submission
- X API pricing 2026 — https://postproxy.dev/blog/x-api-pricing-2026/
- Database free tiers — https://agentdeals.dev/database-pricing
- Cloudflare D1 limits —
  https://freetier.co/articles/cloudflare-d1-free-tier-limits-pricing-and-alternatives
- The Numbers Hindi language index (rejected as a source) —
  https://www.the-numbers.com/language/Hindi/movies
- Vercel deployment limits — 15,000 source files, 45-minute build, no cap on
  build output files — https://vercel.com/docs/limits
- Google scaled content abuse, the three-part test —
  https://patrickstox.com/programmatic-seo/risks/scaled-content-abuse/
