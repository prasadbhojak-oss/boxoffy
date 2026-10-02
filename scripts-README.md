# Boxoffy data-collection scripts

Built and validated 1 October 2026. All stdlib-only Python 3.8+, run from the
boxoffy folder; each writes into `intel/<market>-<date>/`.

| Script | Market | What it returns |
|---|---|---|
| `india_district_sweep.py` | India | **Exact seats sold and advance gross.** District server-renders the full session grid per city: `total`, `avail` and per-class prices on every show. 50 cities, one request each. The most valuable of these. |
| `drishyam_na_sweep.py` | US + Canada | Fandango seat maps across 93 postcodes plus Cineplex listings. Warms an Akamai session first or everything 403s. |
| `topup.py` | US | Coverage pass — 160 more postcodes, appends and dedupes against the main sweep. Run it after `drishyam_na_sweep.py` or the theatre count reads low. |
| `analyse.py` | US + Canada | Roll-up for the two above. Dedupes on showtime hash (postcodes overlap ~3-4x), splits by chain, format, metro and the Update-2 baseline. |
| `middle_east_sweep.py` | Gulf | VOX across 8 country sites. Server-rendered, one request per country. Footprint only — VOX does not publish seat availability outside the booking funnel. |
| `middle_east_probe.py` | Gulf | Endpoint discovery for the other Gulf chains. Run before extending the sweep. |
| `probe.py` | US | The original 10-second diagnostic that found the Fandango 403 and the Cineplex payload shape. |

## Hard-won notes

- **Probe before you sweep.** Both the NA v1 and the ME v1 failed on guessed
  endpoints. A browser session reading the live network tab settles it in minutes.
- **District stores `showTime` in UTC.** Add 5:30 for IST or your daypart
  analysis will say India has no evening shows.
- **Postcode sweeps duplicate.** Fandango returned 2,250 rows for 502 real
  showtimes. Always dedupe on the showtime hash before summing seats.
- **Change the film:** `MOVIE_ID` / `MOVIE_SLUG` in the India script, `FID` in
  the NA script, `TITLE` in the Gulf script.
