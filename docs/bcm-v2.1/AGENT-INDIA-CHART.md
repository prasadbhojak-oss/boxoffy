# BOXOFFY — India National Chart Update Agent ("INCU Skill")
**Version:** v1.5 (corrected workflow + chart column mapping) · bcm-v2.1 reconciliation engine · LIVE Sheet contract (read 2026-05-17, "Boxoffy Live Data")
**Status:** Operating procedure. The reconciliation runs inside a Claude session on your trigger.
**Policy change 2026-05-23 (PM-4):** corrected workflow from "click-URLs" to BCM JSON paste into admin portal (matches actual admin code behavior); documented chart display column mapping; locked rolling-week math. v1.4 Hollywood scan + recency backfill. v1.3 MIN-10 shape. v1.2 floors + OTT flips. v1.1 auto-add. See POLICY HISTORY at end of doc.

---

## HONEST ARCHITECTURE (read once, it's the whole truth)

**Read path — WORKS NOW.** Claude reads the live Sheet via the Google Drive connector (`get_file_metadata` / `read_file_content` on file `1j7TrH2hVR9WjiMX2eExM4vgyjcedm2BJ9sF2D38_3Bk`). Proven 2026-05-17.

**Write path — via your Apps Script, not direct.** This environment has NO Google Sheets write tool. It cannot write cells, attended or unattended. What DOES work: your already-deployed Apps Script web app (GET API). The agent generates a pre-filled `bulkUpdate` URL; you click it once. The Sheet updates; the site live-reads the Sheet; **no deploy, no repo, no git.**

**Trigger — you fire it.** The BCM web-scan needs a live Claude session. A scheduler can't run it. So updates happen when you send the trigger phrase (at your 8am/12am/4am cadence or any time), NOT silently at 4am. This is a hard tool limit, stated plainly, not a design choice.

**Net for you per run:** fire trigger → Claude reads live Sheet + web-scans BCM + reconciles → Claude posts the reconciled chart + ONE click-to-apply URL → you glance, click → done. ~20 seconds. The weekend grind (scanning, reconciling, formatting, the four-field math, commentary) is gone. The deploy is gone (site reads Sheet live). Only the trigger + one click remain.

---

## LIVE DATA CONTRACT (verified from the real Sheet)

### `Films` tab — 29 columns (exact order)
```
year, title, language, status, weeklyCollection, indiaNet, wwGross, ww,
totalCollection, totalNum, weekNum, daysInRelease, lastWeekCollection,
lastWeekRange, lastWeekRank, weeksInTop10, verdict, weeklyNote,
showInMainChart, bogRank, estimated, pageUrl, posterUrl, studio,
budget, director, releaseDate, screencount, occupancy
```
Agent maintains per film (leaves the rest untouched — they are your curation fields):
- `weeklyCollection` — CURRENT week nett only (₹Cr, number). NEVER cumulative. (DATA_REGISTRY standing rule.)
- `indiaNet` — India lifetime nett (₹Cr, number)
- `totalNum` — India lifetime nett mirror (keep == indiaNet)
- `ww` — worldwide lifetime (number, Cr)
- `wwGross` / `totalCollection` — display string e.g. "~₹249.85 Cr WW" (keep numerically consistent with `ww`)
- `weekNum` — week number of run (integer)
- `daysInRelease` — total days since release (integer)
- `lastWeekCollection` — prior week's full nett (for WoW)
- `verdict` — Boxoffy band (see verdict ladder below)
- `weeklyNote` — rolling signal commentary (Boxoffy voice, ≤ ~240 chars)
- `estimated` — TRUE if any day in the week window is a live-day BCM estimate; FALSE if all reconciled actuals
Ranking: DO NOT rank. Apps Script `getFilms` sorts by `weeklyCollection` desc server-side.
Status enum (DATA_REGISTRY): Running / Closing / Closed / OTT / Upcoming. Agent only touches Running rows; never flips status without explicit instruction.

### `Weekly_Commentary` tab — flat 26 columns
```
weekNum, dateRange, headline, subline, status, film1, film1_week,
film1_collection, film1_total, film1_verdict, film1_color, film2, ...film3...,
intervalTake, nextWeek, sources
```
Agent updates the row whose `status` is `live`/`current`: headline, subline, film1-3 spotlight (top 3 by weeklyCollection), intervalTake (Boxoffy analytical voice), nextWeek, sources (BCM sources actually consulted this run). Color stays `#6B7280` unless instructed.

---

## BCM RECONCILIATION (locked methodology)

Source hierarchy when sources conflict (DATA_REGISTRY canonical order):
1. Box Office India (BOI) — canonical India nett, conservative
2. Koimoi closing — final figures (×0.92 if outlier-high)
3. Sacnilk day-wise — granular, ×0.95 Hindi deflator (known ~13% Hindi over-attribution)
4. Bollywood Hungama — consensus cross-ref
5. Pinkvilla — consensus anchor (aligns with BOI historically)
6. Box Office Worldwide — WW
7. Filmibeat — occupancy only
8. Trade analyst X (Taran Adarsh, Sumit Kadel, Rohit Jaiswal) — predictions only, attributed
9-12. Overseas trackers, OTT disclosures, ticketing velocity, CBFC (context)

Locked rules:
- BOI + Pinkvilla = consensus spine. Need ≥3 INDEPENDENT sources for an ACTUAL national claim, else label ESTIMATE (`estimated=TRUE`).
- Sacnilk Hindi ×0.95. Koimoi outlier-high ×0.92. WW from BOW/Sacnilk distributor data.
- **Week window logic (the core of your spec):** determine today. Days of the current week that are COMPLETE → reconciled ACTUALS. TODAY (live, incomplete) → BCM ESTIMATE, flagged. `weeklyCollection` = sum of (actuals so far this week) + (today's BCM estimate). Example fired Sunday: weeklyCollection = Fri actual + Sat actual + Sun estimate; `estimated=TRUE` because Sun is an estimate.
- `daysInRelease` recomputed from `releaseDate` to today. `weekNum` = ceil(daysInRelease / 7).
- `indiaNet`/`totalNum` += this week's delta vs `lastWeekCollection` carry.
- Verdict ladder (Boxoffy bands, India nett vs budget context): DISASTER / FLOP / Below Average / Average / Plus / HIT / Super Hit / Blockbuster / ALL-TIME BLOCKBUSTER. Re-derive only if a band boundary is clearly crossed; otherwise keep curated verdict.

---

## OPERATING PROCEDURE — Steps 1-5

### STEP 1 — Read live state + establish window
- Read the Sheet (Drive connector). Parse `Films` Running rows + the live `Weekly_Commentary` row.
- Determine today (CST per your workflow). Mark each day of current week ACTUAL (complete) vs LIVE (today, estimate).

### STEP 2 — Scan new releases (web) + auto-add

**MANDATORY query set (run all, don't shortcut):**
- `[weekend dates] box office collection India Sacnilk` (general Bollywood + regional)
- `Box Office India day wise` (BOI direct)
- `Pinkvilla Bollywood Hungama box office`
- `Hollywood new release India [date] box office` ← **EXPLICIT Hollywood query** (Disney/WB/Universal/Sony/Paramount Friday wide releases often have minimal Indian trade press pre-release)
- `Sacnilk latest movies collection` (one-shot listing covers everything currently in cinemas)
- per new title `[title] day 1 day 2 collection`

The Hollywood query is non-skippable. Major studio Memorial Day / July 4 / Christmas Friday slates have been historically missed when relying on Indian trade press alone (e.g. Mandalorian and Grogu May 22 2026 first-run miss).

For each new release found:
  - **If title already exists in Sheet** (case-insensitive match on `title` + `year`) → reconcile only (existing flow).
  - **If title NOT in Sheet** → AUTO-ADD via `addFilm` Apps Script action using NEW FILM AUTO-ADD DEFAULTS (Step 2.5).
- Auto-added rows go to `status=Running`, `showInMainChart=TRUE` — they appear on the live chart immediately and rank by reconciled `weeklyCollection`.
- HARD STOP: if a new release has ZERO BCM sources (only blog mentions, no Sacnilk/BOI/Pinkvilla/BH/Koimoi) → SKIP auto-add, log in summary.

### STEP 2.5 — NEW FILM AUTO-ADD DEFAULTS

When the agent auto-adds a new film, it populates the 29-column Films row as follows:

| Column | Source / Default |
|---|---|
| `year` | release year from web scan |
| `title` | canonical from BOI/Sacnilk; honor DATA_REGISTRY name normalization |
| `language` | from web scan (Hindi/Tamil/Telugu/Malayalam/Kannada/English/Marathi) |
| `status` | `Running` |
| `weeklyCollection` | reconciled BCM week-to-date |
| `indiaNet` | reconciled BCM lifetime (= week-to-date for new film) |
| `totalNum` | mirror of `indiaNet` |
| `ww` | reconciled WW lifetime (number, Cr) |
| `wwGross` / `totalCollection` | display string e.g. "~₹X Cr WW" |
| `weekNum` | 1 |
| `daysInRelease` | days since `releaseDate` |
| `lastWeekCollection` | 0 |
| `lastWeekRange` | blank |
| `lastWeekRank` | blank |
| `weeksInTop10` | 1 if reconciled wkColl ranks top 10, else 0 |
| `verdict` | Boxoffy band (DISASTER / FLOP / Below Avg / Avg / Plus / HIT / Super Hit / BB / ATBB) |
| `weeklyNote` | Boxoffy-voice signal commentary, ≤240 chars |
| `showInMainChart` | `TRUE` |
| `bogRank` | blank (Apps Script server-sorts) |
| `estimated` | `TRUE` until all days reconciled actual |
| `pageUrl` | **BLANK** — PB generates film page via `generate_film_pages.py` later, then fills via admin portal |
| `posterUrl` | TMDB best-effort via `tmdb-poster-lookup.js` lookup pattern; BLANK if no match |
| `studio` | best-effort web scan (Wikipedia / Sacnilk); HONOR DATA_REGISTRY canonical (B62 Studios, not B62; etc.) |
| `budget` | BLANK (rarely disclosed at launch) |
| `director` | best-effort web scan; honor DATA_REGISTRY name normalization |
| `releaseDate` | ISO format YYYY-MM-DD from web scan |
| `screencount` | from Sacnilk first-day report; blank if unavailable |
| `occupancy` | 0 (not a chart-ranking input) |

Auto-add HARD STOPs (additional to general list below):
- DATA_REGISTRY has a canonical name for the film that differs from web scan → STOP, use canonical.
- Web scan returns conflicting studio names across sources → use most-cited; flag in summary; PB corrects via admin portal.
- Title matches existing row but year differs (possible remake/dup) → STOP, ask PB whether new row or merge.

---

### STEP 3 — Scan holdovers (web)
- For every Running film: `[title] week [N] collection [dates]`. Pull per-source nett per day this week.

### STEP 4 — Reconcile (deterministic, locked BCM)
- Per film: apply deflators, BOI/PV spine, ≥3-source ACTUAL vs ESTIMATE, week-window sum, recompute weekNum/daysInRelease/indiaNet/totalNum/ww, verdict check, generate weeklyNote.
- Build top-3 spotlight for Weekly_Commentary from reconciled weeklyCollection desc.

### STEP 4.5 — CHART INCLUSION (aging-off + status flips)

After reconciliation, before emitting, apply CHART INCLUSION rules to determine `showInMainChart` and propose `status` flips.

**Language-scale weekly floor (DECENT-COLLECTION test):**

| Language | Floor (current-week nett) |
|---|---|
| Hindi (wide) | ≥ ₹1.00 Cr / wk |
| Tamil, Telugu | ≥ ₹0.75 Cr / wk |
| Marathi, Bengali, Punjabi | ≥ ₹0.75 Cr / wk |
| Malayalam, Kannada | ≥ ₹0.40 Cr / wk |
| Hollywood (India market) | ≥ ₹0.75 Cr / wk |

These floors mirror the BCM verdict ladder — a Hit-trajectory film holds the floor through its theatrical run; locked-verdict long-tail films fall below it. Test is applied against the RECONCILED current-week weeklyCollection (not last week's).

**Escape valves (KEEP on chart regardless of floor):**
- First 2 weeks since release — every new film stays on chart through end of W2 (auto-add candidates always qualify here).
- One-week grace: if `lastWeekCollection` ≥ floor but current week dropped below, KEEP for one more week with a `weeklyNote` flag ("borderline — chart review next week").

**One-way rule:** Agent only flips `showInMainChart` TRUE→FALSE per this rule. NEVER flips FALSE→TRUE except via MIN-10 backfill (below). PB's manual offs (e.g. Vaazha 2 despite ₹3 Cr/wk Telugu boost) are respected — Sheet remains source of truth.

**MIN-10 BACKFILL (chart shape rule, recency-weighted):**

The chart ALWAYS renders ≥10 films. After applying floors, count `showInMainChart=TRUE` rows:
- If count ≥ 10 → no action, chart renders all qualifying films in rank order.
- If count < 10 → backfill from the floor-failed pool using **RECENCY-FIRST, then GROSS** ordering, until count = 10. Backfilled rows get a `weeklyNote` suffix "(chart backfill — below language floor)".

**Backfill eligibility (ALL must hold):**
- `daysInRelease ≤ 35` (recency cutoff — faded long-tail excluded regardless of locked verdict; PHM at D58, films past their first month are ineligible)
- `indiaNet ≥ ₹10 Cr` OR `daysInRelease ≤ 14` ("small scale" exclusion — films that haven't accumulated traction in first 2 weeks excluded; new releases within their first 2 weeks are always eligible regardless of lifetime)
- NOT OTT-flipped (theatrical concluded)
- NOT `Disaster`-locked with `weeklyCollection < ₹0.10 Cr`

**Backfill ordering within eligible pool:**
1. Sort by `daysInRelease` ASC (most recent first)
2. Within same release window, sort by `weeklyCollection` DESC (highest gross first)
3. Pick top N to reach count=10

**Rationale:** Chart purpose is current relevance. A 4-week-old Hit holding ₹0.5 Cr/wk has more editorial value than a 9-week-old Blockbuster locked at ₹0.18 Cr/wk. PB framed (v1.4 cutover): "Top 10 should always be recent and holdovers not faded holdovers unless they are grossing." The floor decides organic qualifiers; recency-weighted backfill decides shape.

Ranking on the live chart is always by reconciled `weeklyCollection` desc (the bogRank Apps Script sort already does this). The MIN-10 rule only affects which 10+ rows are flagged TRUE — not their order.

**Status flips (theatrical → OTT):**

Agent AUTO-PROPOSES a `status=OTT` + `showInMainChart=FALSE` flip when ALL of:
- Current `status=Running`
- Reconciled current-week weekly < 50% of language floor (well below decent threshold)
- OTT release detected in web scan (any platform — Netflix, JioHotstar, Prime, ZEE5, SonyLIV) OR `daysInRelease > 56` with weekly trending toward zero
- Lifetime verdict locked (no band boundary crossings in last 2 weeks)

Proposed status flips appear in run summary under STATUS FLIP CANDIDATES.
- In `update india chart dry` → proposals shown only, no URLs.
- In `update india chart` (live) → flips included in bulkUpdate URL automatically. Override via reply `skip flip [film]` before clicking.

When flipping to OTT: also update `weeklyNote` to capture the OTT platform + date (e.g. "OTT JioHotstar May 14 — theatrical concluded ₹X Cr nett · ₹Y Cr WW").

---

### STEP 5 — Emit click-to-apply + summary

**CORRECTED WORKFLOW (v1.5):** The original procedure called for "click-to-apply URLs". The admin portal actually uses POST (`ppost` helper) not GET, so paste-URLs were never the real workflow — they were a mis-documentation of how the 5 prior successful runs actually executed. The correct workflow uses the admin's BCM JSON paste path plus the WUZ wizard for new films.

**Emit the following three blocks in chat:**

1. **BCM JSON BLOB** — PB pastes into admin portal's "BCM Paste" tab (`#bp` textarea), clicks Apply.
   - Structure:
     ```json
     {
       "updates": [
         {"title": "<film>", "fields": {"weeklyCollection": <num>, "indiaNet": <num>, "lastWeekCollection": <num>, "weekNum": <num>, "daysInRelease": <num>, "verdict": "<band>", "weeklyNote": "<note>", "showInMainChart": "TRUE|FALSE"}}
       ],
       "weeklyUpdate": {
         "weekNum": "<N>",
         "fields": {"headline": "<...>", "subline": "<...>", "intervalTake": "<...>", "film1": "<title>", "film1_collection": "<...>", "film1_total": "<...>", "film1_verdict": "<...>", "film2": ..., "film3": ...}
       }
     }
     ```
   - Admin parses, runs `ppost(bulkUpdate, updates=...)` and `ppost(updateWeek, weekNum=..., fields=...)` automatically.

2. **NEW FILM ENTRIES** — one per auto-add candidate. PB opens admin's "Weekly Update Wizard" (WUZ) tab, clicks "+ Add New Film", fills the form per the values below, queues each, then clicks "Apply All".
   - Per-film fields the agent emits (matching WUZ form fields):
     - title, language, genre, weeklyCollection, indiaNet, daysInRelease, weekNum, verdict, weeklyNote
   - WUZ derives `pageUrl` automatically: `title.toLowerCase().replace(/[^a-z0-9]+/g,"-") + "-box-office.html"`. Agent need not emit pageUrl.
   - WUZ tries `addFilm` → falls back to `createFilm` → then `insertFilm` → then displays manual-paste instructions if all Apps Script actions fail.
   - **Honesty flag:** if WUZ falls back to manual instructions, PB pastes the row directly into the Sheet's Films tab (open Sheet, scroll to bottom, add row). This is a known limitation, not an agent failure.

3. **RUN SUMMARY** — the reconciled chart table, auto-add list, aged-off list, status flips, ESTIMATE-flagged count, hard-stops fired. Posted as the user-facing dry-run-style output ABOVE the JSON blob so PB can verify before pasting.

HARD STOPs (agent pauses, asks PB):
- New WIDE release <2 independent sources → still emit as ESTIMATE, flag in summary, continue.
- New release with ZERO BCM sources (only blog mentions) → SKIP auto-add, log in run summary, continue.
- Holdover implies >40% single-week swing on 1 source → flag for override, emit ESTIMATE meanwhile.
- A DATA_REGISTRY STANDING EDITORIAL RULE would break (GCC ban on Dhurandhar GCC markets; weeklyCollection cumulative; status enum; B62 Studios; Shashwat Sachdev; producer order) → STOP.
- Reconciled number would move indiaNet by >15% in one run → STOP, show working, confirm.
- Auto-add title clashes with existing row but year differs (potential dup/remake) → STOP, ask PB.

---

## RUN SUMMARY (returned every trigger)
```
INDIA CHART — [Week N] — [date] — fired [time CST]
Window: Fri ACTUAL · Sat ACTUAL · Sun ESTIMATE (live)
Sources hit: BOI, Sacnilk, Pinkvilla, BH, Koimoi [+overseas]
Auto-added: A   Reconciled: R   Aged off chart: O   Status flips: F   ESTIMATE-flagged: E   Skipped: S
HARD-STOPs: [none | detail]
STATUS FLIP CANDIDATES: [film] Running→OTT (reason) · ...
Top 5 (by reconciled weeklyCollection): 1)… 2)… 3)… 4)… 5)…
ADD    → [addFilm URLs in order]
UPDATE → [one bulkUpdate URL — includes showInMainChart flips + status flips]
WEEKLY → [one updateWeek URL]
Click in order (ADD → UPDATE → WEEKLY). No deploy.
```

---

## CHART DISPLAY COLUMN MAPPING (website rendering contract)

The live Boxoffy chart renders in this column order:

| Col | Header | Sheet field | Notes |
|---|---|---|---|
| 1 | Number | (computed rank) | by `weeklyCollection` desc, server-sort via `bogRank` |
| 2 | Film | `title` | with `language` chip |
| 3 | Studio | `studio` | Auto-add fills from web scan; honor DATA_REGISTRY canonical names |
| 4 | This Week | `weeklyCollection` | Current week's running total in ₹Cr nett (current-week-only, never cumulative) |
| 5 | Last Week | `lastWeekCollection` | Previous week's final total in ₹Cr nett |
| 6 | Chg | (computed) | `(weeklyCollection / lastWeekCollection - 1) * 100`. For week-rollover-Friday only, use D1-vs-D1 comparison: `(this_Fri_nett / prior_Fri_nett - 1) * 100`. "NEW" for first-week films, "—" if last week unavailable. |
| 7 | Domestic Nett + Rank | `indiaNet` + (computed rank) | India lifetime nett ₹Cr; rank = language-year position (e.g. "#1 Tamil 2026") or all-time milestone where applicable |
| 8 | Global WW + Rank | `ww` + (computed rank) | Worldwide lifetime ₹Cr; rank context where relevant |

**Rolling-week math (locked, never deviate):**
- Standard Indian BO week: Friday-to-Thursday (D1 = release-day Friday for Friday-launches; D1 = Thursday for Thursday-launches like Drishyam 3).
- `weekNum`: 1 for D1-D7, 2 for D8-D14, 3 for D15-D21, etc.
- `daysInRelease`: integer days since `releaseDate`, inclusive of release day (`= today - releaseDate + 1`).
- On weekly rollover (Friday for Friday-launch films): `lastWeekCollection ← weeklyCollection_prior`, `lastWeekRange ← prior week's date range`, `weeklyCollection ← today's D1-only number`, `weekNum ← weekNum + 1`.
- **Append behavior on each agent fire:** within the same week, each fire ADDS that day's actual to `weeklyCollection` (rolling sum). On week-rollover Friday, `weeklyCollection` RESETS to that Friday's number alone. The agent reconciles from BCM sources every time, so prior Sheet values are a checkpoint but not the source of truth — BOI/Pinkvilla/Sacnilk re-reads always win.

---

## TRIGGER PHRASES
- `update india chart` — full Steps 1-5, current week, **auto-add new + reconcile + emit ADD/UPDATE/WEEKLY URLs**
- `update india chart dry` — Steps 1-4 only, show reconciled chart + proposed auto-adds, NO URLs (pure preview)
- `update india chart [film]` — single-film refresh (existing rows only)
- `update india chart no-add` — full run with auto-add DISABLED (legacy v1.0 behavior, reconcile only)

Fire at your cadence (Thu/Fri night CST, then 8am/12am/4am or whenever). Each run reconciles the current week to-date AND adds any new releases discovered in the web scan.

---

## SECURITY NOTE (do when convenient, not blocking)
Apps Script `TOKEN = "boxoffy2026"` is hardcoded and web app is "Anyone". Anyone with the URL can write your live chart. After this is proven working, rotate TOKEN in the Apps Script project to a non-obvious value and update the admin portal. Flagged, not urgent.

With v1.1 auto-add enabled, the surface widens slightly: anyone with the token can now also INSERT rows, not just update them. Token rotation moves up the priority list (still not urgent, still your call).

---

## POLICY HISTORY

### v1.5 — 2026-05-23 (PM-4) — Corrected workflow + chart column mapping
Three fixes after PB asked for chart-format matching and "append on fire" behavior, which led to reading the admin portal source for the first time.

**Fix 1 — Workflow was mis-documented since v1.0.** Original procedure said "click-to-apply URLs". Apps Script web app is POST-only (admin uses `ppost`). The 5 prior "successful runs" actually used BCM JSON paste in the admin portal, not URLs. Corrected STEP 5 to reflect actual workflow: BCM JSON blob (updates + weeklyUpdate) pasted into admin's `#bp` textarea, plus new films handled through the WUZ wizard with its addFilm/createFilm/insertFilm fallback chain.

**Fix 2 — Chart column mapping documented.** Live chart renders Number / Film / Studio / This Week / Last Week / Chg / Domestic Nett+Rank / Global WW+Rank. Mapping to Sheet fields locked in new section. Chg formula documented for both full-week comparison and rollover-Friday D1-vs-D1 case.

**Fix 3 — Rolling-week math made explicit.** Friday rollover behavior was implicit in BCM v1.3 but not spelled out. Added: weekNum/daysInRelease formulas, `weeklyCollection` reset on rollover, `lastWeekCollection`/`lastWeekRange` propagation. Confirmed "append on each fire" = within-week rolling sum from BCM reconciliation (not literal append of new value to existing).

### v1.4 — 2026-05-23 (PM-3) — Hollywood scan + recency-weighted backfill
Two procedure fixes after PB caught The Mandalorian and Grogu missing from the v1.3 dry run.

**Fix 1 — STEP 2 Hollywood blind spot.** Original query set was Sacnilk + Pinkvilla + Bollywood Hungama focused, which underweight Disney/WB/Universal Friday wide releases that have minimal Indian trade press pre-launch. Added mandatory explicit `Hollywood new release India [date] box office` query and `Sacnilk latest movies collection` one-shot listing to the scan set. Queries are now non-skippable.

**Fix 2 — MIN-10 backfill recency-weighted.** v1.3 backfilled by raw weeklyCollection desc, which surfaced Project Hail Mary (D58, Blockbuster locked, ₹0.18 Fri) over Michael (D29, Hit, ₹0.15 Fri). PB framed: "Top 10 should always be recent and holdovers not faded holdovers unless they are grossing." New backfill eligibility: `daysInRelease ≤ 35` (recency cutoff) AND `indiaNet ≥ ₹10 Cr OR daysInRelease ≤ 14` (small-scale exclusion). Ordering: recency ASC first, then weekly DESC within same window. PHM and similar faded long-tail Blockbusters now excluded from backfill regardless of locked verdict.

### v1.3 — 2026-05-23 (PM-2) — MIN-10 chart shape
Added MIN-10 BACKFILL rule to STEP 4.5. Floor-based aging-off in v1.2 produced a 9-film chart on Fri May 22 dry run; PB framed: "we need to always have a Top 10." Backfill picks highest current-week weeklyCollection from the floor-failed pool until count=10. OTT-flipped films are never eligible (theatrical concluded). Disaster-locked films <₹0.10 Cr never eligible (no editorial value). Backfilled rows get a weeklyNote suffix flagging the exception. Chart shape is now decoupled from the floor — the floor decides which films are "organically qualifying"; MIN-10 decides shape.

### v1.2 — 2026-05-23 (PM) — Chart aging-off + OTT status flips
Added STEP 4.5 to enforce language-scale weekly floors for `showInMainChart` inclusion (Hindi ≥ ₹1 Cr/wk, big regional + Hollywood ≥ ₹0.75 Cr/wk, small regional ≥ ₹0.40 Cr/wk). Rationale: v1.1 dry run kept old Hollywood films (PHM, Mummy, TDWP2) on chart at <₹0.5 Cr/wk because procedure had no aging-off rule. PB framed: "keep on similar lines as our overall Hindi/regional calculations — if collecting decent keep them." Floors aligned with BCM verdict ladder so the chart inclusion test matches the same instinct that drives verdict bands.

Also added automatic OTT status-flip proposal for films with OTT release detected in web scan OR >56 days with weekly trending to zero. Lifetime verdict must be locked (no band boundary crossings in 2 weeks) before flip is proposed.

Protections retained:
- One-way rule on `showInMainChart` — agent only TRUE→FALSE; PB's manual offs respected.
- New release escape valve (W1–W2 always on chart).
- One-week grace period on borderline drops.
- Status flips proposed in dry runs, auto-applied in live runs, overridable via `skip flip [film]` before click.

### v1.1 — 2026-05-23 (AM) — Auto-add enabled
Reverses the v1.0 "agent never calls addFilm" rule. Rationale: PB framed INCU as the Boxoffy editorial-time-saver Skill — manual admin-portal entry was the curation gate but cost ~5 min per new release × ~5 releases per week. Trade-off accepted: initial card on homepage may show placeholder poster and blank pageUrl until TMDB resolves or PB generates the film page; correctable via admin portal post-add (Sheet is source of truth; edits propagate live).

Protections retained:
- DATA_REGISTRY editorial rules still enforced (canonical studio/composer names; GCC ban; status enum).
- HARD STOPs still apply (zero-source films skipped; >40% single-source swings flagged; >15% indiaNet movement stopped).
- Apps Script auth token unchanged (still `boxoffy2026`).
- Trigger model unchanged — PB still fires `update india chart`; no unattended runs.
- Legacy mode preserved via `update india chart no-add` trigger.

### v1.0 — 2026-05-17 — Initial build
- Read path via Google Drive connector. Write path via Apps Script `bulkUpdate` + `updateWeek`.
- Curation boundary: agent NEVER calls `addFilm`. PB added new films via admin portal Friday; agent reconciled them on subsequent runs.
- Five successful live runs (May 17 × 2, May 22 × 3) before v1.1 cutover.
