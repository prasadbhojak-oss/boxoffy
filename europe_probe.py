#!/usr/bin/env python3
"""
Boxoffy - EUROPE probe.  Run this FIRST.              python europe_probe.py

Same play that cracked VOX, District and Fandango: find out what each chain
actually serves before a line of parser gets written.  Hits a spread of
candidate endpoints for every major European chain, records exactly what
comes back, and writes europe_probe.txt.  Send me that file and I build the
real sweeper from it.

WHY THIS EXISTS, AND WHY IT IS NOT A SWEEP YET
  We have never counted Europe.  Not once.  Every Europe number Boxoffy has
  published came from reported overseas figures, not from our own seat-level
  read.  That is a real hole and it is worth closing.

  But Europe is not the Middle East.  VOX cracked in one insight - it is
  server rendered and one request returns a whole country's grid.  Europe is
  chain by chain and country by country: the UK alone is Cineworld, Vue,
  Odeon and Showcase as four separate problems.  Writing four parsers blind,
  against endpoints I have never seen respond, is exactly how you get a
  script that returns confident zeros.

  So this probe goes wide and shallow on purpose.  It answers one question
  per chain: IS THERE A MACHINE-READABLE SURFACE HERE, and what shape is it.

WHAT IT DOES
  * Loads each chain's homepage FIRST so any Akamai/Cloudflare cookie is set,
    then reuses that session - the fix that made VOX and Fandango work.
  * Tries the obvious API paths, then the HTML listing pages.
  * For every hit it records status, content type, size, whether the body
    parses as JSON, whether it mentions our probe film, and - for JSON - the
    top-level keys, so I can see the shape without the whole payload.
  * Flags anything that looks like a film id or a showtime structure.

PROBE FILM
  Drishyam: The Conclusion, deliberately.  It opened 2 October and is in its
  second week, so it IS playing across the UK and Europe right now.  Probing
  with Ramayana would be useless - nothing is on sale yet, and an empty
  response would tell us nothing about whether the endpoint works.

Nothing here is a guess I will act on blind - that is the whole point.
Stdlib only.  Python 3.8+.  Takes roughly four to six minutes.
"""

import json, os, re, gzip, io, time, datetime
import urllib.request, urllib.error, http.cookiejar

FILM = "drishyam"
DATE = "2026-10-10"            # Saturday, week 2 - showtimes definitely exist
DATE_SLASH = "10/10/2026"
DATE_COMPACT = "20261010"
OUT = []

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")
HDR = {"User-Agent": UA,
       "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
       "Accept-Language": "en-GB,en;q=0.9",
       "Accept-Encoding": "gzip, deflate"}

TIMEOUT = 20
PAUSE = 0.45                   # polite; this is reconnaissance, not a crawl


def say(*a):
    s = " ".join(str(x) for x in a)
    try:
        print(s, flush=True)
    except UnicodeEncodeError:
        print(s.encode("ascii", "replace").decode(), flush=True)
    OUT.append(s)


jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

STATS = {"ok": 0, "json": 0, "film": 0, "fail": 0, "blocked": 0}


def hit(label, url, hdrs=None, snip=900):
    h = dict(HDR)
    h.update(hdrs or {})
    try:
        with op.open(urllib.request.Request(url, headers=h), timeout=TIMEOUT) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                try:
                    raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                except Exception:
                    pass
            body = raw.decode("utf-8", "replace")
            ct = (r.headers.get("Content-Type") or "").split(";")[0]
            isj = "json" in ct or body.lstrip()[:1] in "[{"
            found = FILM in body.lower()
            STATS["ok"] += 1
            STATS["json"] += bool(isj)
            STATS["film"] += bool(found)
            say(f"\n### {label}")
            say(f"    {url}")
            say(f"    HTTP {r.status}  {ct}  {len(body):,} bytes  "
                f"json={isj}  mentions_{FILM}={found}")

            if isj:
                try:
                    js = json.loads(body)
                    if isinstance(js, dict):
                        say(f"    TOP-LEVEL KEYS: {list(js.keys())[:25]}")
                        for k, v in list(js.items())[:6]:
                            if isinstance(v, list) and v and isinstance(v[0], dict):
                                say(f"      {k}[0] keys: {list(v[0].keys())[:20]}")
                    elif isinstance(js, list) and js and isinstance(js[0], dict):
                        say(f"    LIST OF {len(js)}, [0] keys: {list(js[0].keys())[:20]}")
                except ValueError:
                    say("    (looked like json, did not parse)")
                say("    " + body[:snip].replace("\n", " "))
            else:
                # HTML: surface the bits that tell me if it is parseable
                ids = re.findall(r'data-(?:film|movie|session|showtime)-?id="([^"]{1,24})"', body)[:8]
                slugs = re.findall(r'/(?:film|movie|movies|films)/([a-z0-9\-]{4,50})', body.lower())[:10]
                nxt = "__NEXT_DATA__" in body or "__NUXT__" in body
                say(f"    html: data-ids={ids}  next/nuxt_payload={nxt}")
                if slugs:
                    say(f"    film slugs seen: {sorted(set(slugs))[:10]}")
                if found:
                    i = body.lower().find(FILM)
                    say("    CONTEXT: ..." + body[max(0, i - 220):i + 260].replace("\n", " ") + "...")
            return body
    except urllib.error.HTTPError as e:
        STATS["fail"] += 1
        if e.code in (403, 401, 429):
            STATS["blocked"] += 1
        say(f"\n### {label}")
        say(f"    {url}")
        say(f"    HTTP {e.code} {e.reason}"
            + ("   <-- bot wall, needs the homepage-cookie trick or is a no" if e.code in (403, 429) else ""))
    except Exception as e:
        STATS["fail"] += 1
        say(f"\n### {label}")
        say(f"    {url}")
        say(f"    FAILED {type(e).__name__}: {e}")
    return ""


# Chains whose homepage we load first, to collect whatever cookie the CDN wants.
WARM = [
    "https://www.cineworld.co.uk", "https://www.myvue.com", "https://www.odeon.co.uk",
    "https://www.showcasecinemas.co.uk", "https://www.picturehouses.com",
    "https://www.omniplex.ie", "https://www.cinestar.de", "https://www.uci-kinowelt.de",
    "https://www.cinemaxx.de", "https://www.kinopolis.de", "https://www.cineplex.de",
    "https://www.pathe.nl", "https://kinepolis.nl", "https://kinepolis.be",
    "https://www.cinemacity.pl", "https://www.cinesa.es", "https://www.ucicinemas.it",
    "https://www.pathe.fr", "https://www.ugc.fr", "https://www.finnkino.fi",
    "https://www.filmstaden.se", "https://www.cineplexx.at", "https://www.nos.pt",
]


TARGETS = [
    # ================================================================
    # TIER 1 - UNITED KINGDOM.  By far the biggest Indian-film market in
    # Europe. If only one country ever gets a real parser, it is this one.
    # ================================================================

    # ---- Cineworld. The main Bollywood exhibitor in the UK, and part of the
    #      Cinema City group, so whatever works here probably also works in
    #      Poland, Czechia, Hungary, Romania, Israel and Bulgaria. Highest
    #      value target on this entire list.
    ("UK Cineworld site",        "https://www.cineworld.co.uk/films"),
    ("UK Cineworld films api",   "https://www.cineworld.co.uk/uk/data-api-service/v1/quickbook/10108/films/until/2026-11-30?attr=&lang=en_GB"),
    ("UK Cineworld cinemas api", "https://www.cineworld.co.uk/uk/data-api-service/v1/quickbook/10108/cinemas/with-event/until/2026-11-30?attr=&lang=en_GB"),
    ("UK Cineworld showtimes",   f"https://www.cineworld.co.uk/uk/data-api-service/v1/quickbook/10108/film-events/in-group/10108?lang=en_GB&dt={DATE}"),
    ("UK Cineworld search",      "https://www.cineworld.co.uk/search?q=drishyam"),

    # ---- Vue. Second UK chain, books Indian titles heavily.
    ("UK Vue films",             "https://www.myvue.com/film"),
    ("UK Vue api films",         "https://www.myvue.com/data/films/"),
    ("UK Vue api filmswithshowings", "https://www.myvue.com/data/filmswithshowings/10002"),
    ("UK Vue api cinemas",       "https://www.myvue.com/data/cinemas/"),

    # ---- Odeon. AMC-owned. Their UK API has historically been the same
    #      shape as AMC's, which we already understand.
    ("UK Odeon films",           "https://www.odeon.co.uk/films/"),
    ("UK Odeon api films",       "https://www.odeon.co.uk/api/gateway/graphql"),
    ("UK Odeon ocapi films",     "https://vwc.odeon.co.uk/WSVistaWebClient/ocapi/v1/browsing/master-data/films"),
    ("UK Odeon ocapi showtimes", f"https://vwc.odeon.co.uk/WSVistaWebClient/ocapi/v1/browsing/master-data/showtimes/by-business-date/{DATE}"),
    ("UK Odeon sitemap films",   "https://www.odeon.co.uk/sitemap-films.xml"),

    # ---- Showcase, Picturehouse, Everyman, Curzon
    ("UK Showcase films",        "https://www.showcasecinemas.co.uk/movies"),
    ("UK Showcase api",          "https://www.showcasecinemas.co.uk/api/movies"),
    ("UK Picturehouse films",    "https://www.picturehouses.com/movies"),
    ("UK Picturehouse api",      "https://www.picturehouses.com/api/get-movies"),
    ("UK Everyman films",        "https://www.everymancinema.com/whats-on"),
    ("UK Curzon films",          "https://www.curzon.com/films/"),

    # ---- Ireland
    ("IE Omniplex films",        "https://www.omniplex.ie/whatson"),
    ("IE Omniplex api",          "https://www.omniplex.ie/api/movies"),
    ("IE Odeon films",           "https://www.odeoncinemas.ie/films/"),

    # ================================================================
    # TIER 2 - GERMANY.  The biggest continental European market for Hindi
    # film, mostly through CineStar and UCI.
    # ================================================================
    ("DE CineStar site",         "https://www.cinestar.de/filme"),
    ("DE CineStar api movies",   "https://www.cinestar.de/api/v1/de/movie"),
    ("DE CineStar api program",  f"https://www.cinestar.de/api/v1/de/show?date={DATE}"),
    ("DE UCI site",              "https://www.uci-kinowelt.de/filme"),
    ("DE UCI api",               "https://www.uci-kinowelt.de/api/films"),
    ("DE UCI ocapi films",       "https://vwc.uci-kinowelt.de/WSVistaWebClient/ocapi/v1/browsing/master-data/films"),
    ("DE Cinemaxx site",         "https://www.cinemaxx.de/filme"),
    ("DE Cinemaxx api",          "https://www.cinemaxx.de/api/v1/movies"),
    ("DE Kinopolis site",        "https://www.kinopolis.de/filme"),
    ("DE Kinopolis api",         "https://www.kinopolis.de/api/movies"),
    ("DE Cineplex.de site",      "https://www.cineplex.de/filme/"),
    ("DE Cineplex.de api",       "https://www.cineplex.de/api/movies"),
    # German aggregator - often far easier than the chains themselves
    ("DE kino.de search",        "https://www.kino.de/suche/?q=drishyam"),
    ("DE filmstarts search",     "https://www.filmstarts.de/suche/?q=drishyam"),

    # ================================================================
    # TIER 3 - NETHERLANDS, BELGIUM.  Small but real Hindi markets.
    # ================================================================
    ("NL Pathe site",            "https://www.pathe.nl/films"),
    ("NL Pathe api shows",       f"https://www.pathe.nl/api/shows?date={DATE}"),
    ("NL Pathe api movies",      "https://www.pathe.nl/api/movies"),
    ("NL Kinepolis site",        "https://kinepolis.nl/films"),
    ("NL Kinepolis api",         "https://kinepolis.nl/api/films"),
    ("BE Kinepolis site",        "https://kinepolis.be/nl/films"),
    ("NL Vue site",              "https://www.vuecinemas.nl/films"),

    # ================================================================
    # TIER 4 - the rest.  Thinner for Indian film, but cheap to probe now
    # and I would rather know than assume.
    # ================================================================
    # Poland / CEE - same Cinema City group as UK Cineworld
    ("PL Cinema City site",      "https://www.cinema-city.pl/kina"),
    ("PL Cinema City api films", "https://www.cinema-city.pl/pl/data-api-service/v1/quickbook/10103/films/until/2026-11-30?attr=&lang=pl_PL"),
    ("PL Multikino site",        "https://multikino.pl/filmy"),

    # Spain
    ("ES Cinesa site",           "https://www.cinesa.es/peliculas/"),
    ("ES Cinesa ocapi films",    "https://vwc.cinesa.es/WSVistaWebClient/ocapi/v1/browsing/master-data/films"),
    ("ES Yelmo site",            "https://www.yelmocines.es/cartelera"),

    # Italy
    ("IT UCI site",              "https://www.ucicinemas.it/film/"),
    ("IT UCI api",               "https://www.ucicinemas.it/rest/v3/movies/"),
    ("IT The Space site",        "https://www.thespacecinema.it/film"),

    # France
    ("FR Pathe site",            "https://www.pathe.fr/films"),
    ("FR Pathe api",             "https://www.pathe.fr/api/films"),
    ("FR UGC site",              "https://www.ugc.fr/films.html"),
    ("FR Allocine search",       "https://www.allocine.fr/rechercher/?q=drishyam"),

    # Nordics
    ("FI Finnkino site",         "https://www.finnkino.fi/movies"),
    ("FI Finnkino xml events",   "https://www.finnkino.fi/xml/Events/"),
    ("FI Finnkino xml schedule", f"https://www.finnkino.fi/xml/Schedule/?dt={DATE_SLASH}"),
    ("SE Filmstaden site",       "https://www.filmstaden.se/filmer/"),
    ("SE Filmstaden api",        "https://www.filmstaden.se/api/v2/movie"),
    ("NO Nordisk Film Kino",     "https://www.nfkino.no/filmer"),
    ("DK Nordisk Film Bio",      "https://www.nfbio.dk/film"),

    # Switzerland / Austria
    ("CH Pathe site",            "https://www.pathe.ch/fr/films"),
    ("AT Cineplexx site",        "https://www.cineplexx.at/filme/"),
    ("AT Cineplexx api",         "https://www.cineplexx.at/api/movies"),

    # Portugal
    ("PT NOS site",              "https://nos.pt/cinemas/filmes"),
    ("PT NOS api",               "https://nos.pt/cinemas/api/movies"),
]


def main():
    t0 = time.time()
    say("=" * 70)
    say("  BOXOFFY - EUROPE PROBE")
    say(f"  {datetime.datetime.now().isoformat(timespec='seconds')}")
    say(f"  probe film: {FILM}   probe date: {DATE}")
    say(f"  {len(WARM)} homepages to warm, {len(TARGETS)} endpoints to try")
    say("=" * 70)

    say("\n--- warming sessions so the CDN cookies are set ---")
    for u in WARM:
        try:
            with op.open(urllib.request.Request(u, headers=HDR), timeout=TIMEOUT) as r:
                say(f"  {r.status}  {u}")
        except urllib.error.HTTPError as e:
            say(f"  {e.code}  {u}   <-- bot wall at the front door")
        except Exception as e:
            say(f"  ---  {u}   {type(e).__name__}")
        time.sleep(0.25)
    say(f"  cookies collected: {len(jar)}")

    say("\n--- endpoints ---")
    for label, url in TARGETS:
        hit(label, url)
        time.sleep(PAUSE)

    say("\n" + "=" * 70)
    say("  SUMMARY")
    say(f"    responded 200      {STATS['ok']}")
    say(f"    returned json      {STATS['json']}")
    say(f"    mentioned {FILM:<9s}{STATS['film']}")
    say(f"    failed             {STATS['fail']}")
    say(f"    of which blocked   {STATS['blocked']}  (403/429 - bot wall)")
    say(f"    elapsed            {time.time() - t0:.0f}s")
    say("")
    say("  WHAT HAPPENS NEXT")
    say("    Send me europe_probe.txt. The ones that matter are any endpoint")
    say("    that returned JSON, and any that mentioned the film - those are")
    say("    the chains I can build a real parser against. Chains that only")
    say("    served HTML behind a bot wall may need a different approach or")
    say("    may simply not be worth the effort.")
    say("")
    say("    My expectation, to be tested: Cineworld's data-api-service is the")
    say("    best bet, because that same API shape covers the whole Cinema City")
    say("    group - UK, Poland, Czechia, Hungary, Romania, Israel, Bulgaria.")
    say("    One parser, seven countries. Odeon's Vista ocapi endpoints are the")
    say("    second bet, and Finnkino publishes open XML, which would make")
    say("    Finland trivially easy and is a good sanity check that the")
    say("    pipeline works end to end.")
    say("=" * 70)

    with open("europe_probe.txt", "w", encoding="utf-8") as fh:
        fh.write("\n".join(OUT))
    say("\nWritten: europe_probe.txt")


if __name__ == "__main__":
    main()
