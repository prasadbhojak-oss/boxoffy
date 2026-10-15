#!/usr/bin/env python3
"""
Boxoffy - NORTH AMERICA GAP PROBE.  Run this FIRST.    python na_probe2.py

WHAT THIS IS FOR
  na_sweep.py reads Fandango (US) and Cineplex (Canada).  That is 389 theatres.
  This probe finds out what we are MISSING - the chains that refuse Fandango and
  sell only from their own site, and the desi single screens where a Hindi
  tentpole actually makes its money.

  This is a probe, not a sweeper.  It does not count a single ticket.  It asks
  each target one question: do you serve machine-readable showtimes, and do you
  publish seats available?  The second half is the whole game.  A chain that
  lists showtimes but hides its seat map buys us FOOTPRINT, not MONEY, and is
  not worth a parser.  That is the call Australia failed - 32 chains, zero seat
  fields, no sweeper written.

  Blind endpoint guessing failed on NA v1 and Middle East v1.  Probing first
  cracked VOX, District and Cineworld.  Same play here.

WHAT IT ALSO DOES
  Reads our existing fandango_theatres.csv and tells you, per brand, how many
  sites we ALREADY have.  Any second sweep that re-reads a theatre Fandango
  already gave us double-counts it, which would be worse than not running at all.

  And it fingerprints the ticketing PLATFORM behind each site.  This is where the
  leverage is: Vista, Veezi, Boxoffice and Agile power dozens of chains between
  them.  One Vista reader covers every Vista chain.  If the probe says eleven of
  these sites run Vista, I write one parser, not eleven.

Stdlib only.  Python 3.8+.  Windows-safe.  Takes about four minutes.
Writes intel/na_probe2.txt - send me that file and I build the real sweeper.
"""

import csv, glob, gzip, io, json, os, re, socket, sys, time, datetime
import urllib.request, urllib.error, http.cookiejar

FILM_WORDS = ("drishyam",)
DATE = "2026-10-03"          # Saturday - a full day still on sale
PAUSE = 0.45
TIMEOUT = 20
OUT = []

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
HDR = {"User-Agent": UA,
       "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
       "Accept-Language": "en-US,en;q=0.9",
       "Accept-Encoding": "gzip, deflate"}

jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

FINDINGS = []     # (chain, country, sites, label, url, status, json?, film?, seats?, platform)


def say(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True)
    OUT.append(s)


# ---------------------------------------------------------------- platform sniff
# One parser per platform, not one per chain. This is the whole reason the probe
# bothers to look at homepages at all.
PLATFORMS = (
    ("VISTA",      r"WSVistaWebClient|vista(?:entertainment|cloud)|/ocapi/v1/"),
    ("VEEZI",      r"veezi|siteToken"),
    ("BOXOFFICE",  r"boxoffice(?:ticketing|media)?\.com|boxofficeapi"),
    ("AGILE",      r"agiletix|agileticketing"),
    ("ROLLER",     r"roller\.app|rollerdigital"),
    ("SHOWTIMES1", r"us\.showtimes|showtimes\.com/api"),
    ("TICKETOR",   r"ticketor\.com"),
    ("SIMPLE",     r"simpleticket|simpletix"),
    ("NEXTJS",     r"__NEXT_DATA__|\"buildId\""),
    ("NUXT",       r"window\.__NUXT__"),
    ("SHOPIFY/WP", r"wp-content|wp-json"),
)
SEAT_RE = re.compile(
    r"seatsAvailable|seatsRemaining|availableSeats|SeatsAvailable|seats_available"
    r"|RemainingSeats|AvailableSeats|seatsLeft|OccupiedSeats|SeatStatus"
    r"|\"available\"\s*:\s*\d+|percentSold", re.I)
API_RE = re.compile(r"https?://[a-z0-9.\-]*(?:api|ticket|book)[a-z0-9.\-]*"
                    r"(?:/[a-z0-9\-_./]{0,50})?", re.I)


def sniff_platform(body):
    hits = [n for n, p in PLATFORMS if re.search(p, body, re.I)]
    return "+".join(hits) if hits else "-"


def hit(chain, country, sites, label, url, hdrs=None, snip=700, quiet=False):
    h = dict(HDR); h.update(hdrs or {})
    try:
        with op.open(urllib.request.Request(url, headers=h), timeout=TIMEOUT) as r:
            raw = r.read(400_000)
            if r.headers.get("Content-Encoding") == "gzip":
                try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                except Exception: pass
            body = raw.decode("utf-8", "replace")
            ct = (r.headers.get("Content-Type") or "").split(";")[0]
            isj = "json" in ct or body.lstrip()[:1] in "[{"
            film = any(w in body.lower() for w in FILM_WORDS)
            seat = bool(SEAT_RE.search(body))
            plat = sniff_platform(body)
            FINDINGS.append((chain, country, sites, label, url, r.status,
                             isj, film, seat, plat))
            say(f"\n### [{country}] {chain} - {label}")
            say(f"    {url}")
            say(f"    HTTP {r.status}  {ct}  {len(body):,}B  json={isj}  "
                f"film={film}  SEATS={seat}  platform={plat}")
            if seat:
                m = SEAT_RE.search(body)
                a = max(0, m.start() - 120)
                say(f"    >> SEAT FIELD CONTEXT: ...{body[a:m.end()+160]}...".replace("\n", " "))
            if isj and not quiet:
                say("    " + body[:snip].replace("\n", " "))
                try:
                    j = json.loads(body)
                    if isinstance(j, dict):
                        say(f"    TOP KEYS: {list(j)[:25]}")
                    elif isinstance(j, list) and j and isinstance(j[0], dict):
                        say(f"    LIST[{len(j)}] ITEM KEYS: {list(j[0])[:25]}")
                except Exception: pass
            elif not quiet:
                api = [u for u in dict.fromkeys(API_RE.findall(body))
                       if "google" not in u and "facebook" not in u][:6]
                if api: say(f"    api urls: {api}")
                bid = re.search(r'"buildId"\s*:\s*"([^"]+)"', body)
                if bid: say(f"    NEXT buildId: {bid.group(1)}")
                slug = re.findall(r"[a-z0-9\-/]*drishyam[a-z0-9\-/]*", body, re.I)
                if slug: say(f"    film slug: {list(dict.fromkeys(slug))[:4]}")
            return body
    except urllib.error.HTTPError as e:
        FINDINGS.append((chain, country, sites, label, url, e.code,
                         False, False, False, "-"))
        say(f"\n### [{country}] {chain} - {label}\n    {url}\n    HTTP {e.code}")
    except (urllib.error.URLError, socket.timeout, ConnectionError) as e:
        FINDINGS.append((chain, country, sites, label, url, 0,
                         False, False, False, "-"))
        say(f"\n### [{country}] {chain} - {label}\n    {url}\n    {type(e).__name__}: {e}")
    except Exception as e:
        FINDINGS.append((chain, country, sites, label, url, 0,
                         False, False, False, "-"))
        say(f"\n### [{country}] {chain} - {label}\n    {url}\n    {type(e).__name__}: {e}")
    return None


# ------------------------------------------------------------------- the targets
# (chain, country, approx US/CA sites, host, [(label, path), ...])
# approx sites is my estimate of the chain's size, so we can rank what is worth
# building. It is NOT a count of sites playing the film - the probe tells us that.
#
# Ordered by how much Hindi product each one books. The desi group at the bottom
# is small in site count and large in money, which is exactly backwards from how
# a footprint-first sweep would prioritise it.
VISTA_PATHS = [
    ("vista cinemas",   "/WSVistaWebClient/RESTData.svc/cinemas"),
    ("vista ocapi",     "/WSVistaWebClient/ocapi/v1/browsing/master-data/showtimes"),
]
TARGETS = [
    # ---- US chains that sell direct and are NOT Fandango partners
    ("Harkins",        "US", 35, "https://www.harkins.com", [
        ("home",         "/"),
        ("api movies",   "/api/movies"),
        ("showtimes",    f"/showtimes?date={DATE}"),
    ] + VISTA_PATHS),
    ("Marcus",         "US", 80, "https://www.marcustheatres.com", [
        ("home",         "/"),
        ("api movies",   "/api/movies"),
        ("movies page",  "/movies"),
    ] + VISTA_PATHS),
    ("B&B Theatres",   "US", 55, "https://www.bbtheatres.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
        ("showtimes",    "/showtimes"),
    ] + VISTA_PATHS),
    ("Malco",          "US", 35, "https://www.malco.com", [
        ("home",         "/"),
        ("api films",    "/api/films"),
        ("showtimes",    "/showtimes"),
    ] + VISTA_PATHS),
    ("Studio Movie Grill", "US", 30, "https://www.studiomoviegrill.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
        ("showtimes",    "/showtimes"),
    ]),
    ("Premiere Cinemas", "US", 20, "https://www.pccmovies.com", [
        ("home",         "/"),
        ("showtimes",    "/showtimes"),
    ]),
    ("CMX Cinemas",    "US", 30, "https://cmxcinemas.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
    ] + VISTA_PATHS),
    ("Santikos",       "US", 10, "https://www.santikos.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
    ]),
    ("Look Dine-In",   "US", 12, "https://www.lookcinemas.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
    ]),
    ("Megaplex",       "US", 16, "https://www.megaplextheatres.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
    ] + VISTA_PATHS),
    ("NCG Cinema",     "US", 40, "https://www.ncgmovies.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
    ]),
    ("GQT Movies",     "US", 30, "https://www.gqtmovies.com", [("home", "/")]),
    ("Alamo Drafthouse", "US", 40, "https://drafthouse.com", [
        ("home",         "/"),
        ("api v2",       "/s/mother/v2/schedule/market/dallas"),
        ("graphql",      "/graphql"),
    ]),
    ("Flix Brewhouse", "US", 10, "https://www.flixbrewhouse.com", [("home", "/")]),
    ("Silverspot",     "US", 10, "https://silverspot.net", [("home", "/")]),
    ("Maya Cinemas",   "US",  8, "https://www.mayacinemas.com", [("home", "/")]),
    ("Regency",        "US", 20, "https://www.regencymovies.com", [("home", "/")]),
    ("Bow Tie",        "US", 20, "https://www.bowtiecinemas.com", [("home", "/")]),
    ("Emagine",        "US", 25, "https://www.emagine-entertainment.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
    ] + VISTA_PATHS),

    # ---- THE DESI CIRCUIT. Small chains, disproportionate share of Hindi gross.
    # If a second sweeper is worth building at all, it is worth building for these.
    ("Phoenix Big Cinemas", "US", 12, "https://phoenixbigcinemas.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
        ("showtimes",    "/showtimes"),
    ]),
    ("FunAsia (DFW)",  "US",  4, "https://www.funasia.net", [
        ("home",         "/"),
        ("movies",       "/movies"),
        ("tickets",      "/tickets"),
    ]),
    ("MovieMax / desi", "US", 6, "https://www.moviemaxcinemas.com", [("home", "/")]),
    ("Cinemark-free indie: Cine Lounge", "US", 8,
     "https://www.cineloungecinemas.com", [("home", "/")]),

    # ---- CANADA beyond Cineplex. Landmark is the real hole: ~40 sites, strong
    # Indian bookings in Alberta, BC and the GTA, and zero Cineplex overlap.
    ("Landmark Cinemas", "CA", 40, "https://www.landmarkcinemas.com", [
        ("home",         "/"),
        ("api movies",   "/api/movies"),
        ("showtimes",    f"/showtimes/{DATE}"),
    ] + VISTA_PATHS),
    ("Imagine Cinemas", "CA", 20, "https://imaginecinemas.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
    ]),
    ("Cinestarz",      "CA", 10, "https://www.cinestarz.ca", [("home", "/")]),
    ("Golden/Woodside GTA", "CA", 6, "https://www.goldencinemas.ca", [("home", "/")]),
    ("Rainbow Cinemas", "CA", 12, "https://www.rainbowcinemas.ca", [("home", "/")]),
    ("Magic Lantern",  "CA",  8, "https://www.magiclantern.ca", [("home", "/")]),

    # ---- AGGREGATORS. One of these can replace a dozen parsers, the way
    # Platinumlist nearly handed us the whole Gulf in one request.
    ("Atom Tickets",   "US", 0, "https://www.atomtickets.com", [
        ("home",         "/"),
        ("search api",   "/api/gateway/movies/search?query=drishyam"),
        ("movies",       "/movies"),
    ]),
    ("MovieTickets.com", "US", 0, "https://www.movietickets.com", [
        ("home",         "/"),
        ("api",          "/api/movies"),
    ]),
    ("Showtimes.com",  "US", 0, "https://www.showtimes.com", [("home", "/")]),
    ("Veezi platform", "US", 0, "https://ticketing.useast.veezi.com", [
        ("sessions probe", "/sessions/"),
    ]),
]


# ---------------------------------------------------------------- dedupe context
def coverage_report():
    """What Fandango already gave us. A second sweeper must not re-read these."""
    cands = sorted(glob.glob(os.path.join("intel", "na-*", "fandango_theatres.csv")))
    if not cands:
        say("\n(no fandango_theatres.csv found under intel/na-* - run na_sweep.py")
        say(" first, or ignore: the dedupe table is context, not a dependency)")
        return
    path = cands[-1]
    try:
        rows = list(csv.DictReader(open(path, encoding="utf-8")))
    except Exception as e:
        say(f"\n(could not read {path}: {e})")
        return
    say(f"\n=== ALREADY COVERED BY FANDANGO  ({os.path.dirname(path)}, "
        f"{len(rows)} theatres) ===")
    say("    Any site below is already in our numbers. The second sweeper must")
    say("    skip it or we count the same ticket twice.")
    brands = {}
    for t in TARGETS:
        if t[2] == 0:            # aggregators are not chains - nothing to dedupe
            continue
        key = t[0].split(" ")[0].split("/")[0].lower()
        brands[key] = (t[0], t[2])
    counts = {}
    for r in rows:
        nm = (r.get("name") or "").lower()
        # A site Fandango already tagged AMC / Cinemark / Regal belongs to that
        # chain whatever else its name contains. Without this guard "AMC Landmark
        # 8" counts as a Landmark site and "Regal Natomas" as an Atom site, and
        # the gap table understates every real hole.
        if (r.get("chain") or "") in ("AMC", "Cinemark", "Regal"):
            continue
        for key, (chain, sites) in brands.items():
            if len(key) > 3 and re.search(r"\b" + re.escape(key), nm):
                counts[chain] = counts.get(chain, 0) + 1
    if not counts:
        say("    none of the probe targets appear in the Fandango set - every")
        say("    target below is a clean gap")
    for chain, n in sorted(counts.items(), key=lambda x: -x[1]):
        tot = dict((t[0], t[2]) for t in TARGETS).get(chain, 0)
        gap = max(0, tot - n) if tot else 0
        say(f"    {chain:<24} {n:>3} of ~{tot:<4} sites  -> ~{gap} possibly missing")
    say("\n    NOTE: a low count can mean two different things and they matter")
    say("    very differently. Either the chain only booked that many sites for")
    say("    this film (fine, nothing missing), or our zip seeds never reached")
    say("    its home markets (a real hole). I will separate the two from the")
    say("    probe output, not guess here.")


def summary():
    say("\n" + "=" * 72)
    say("SUMMARY - what is worth building")
    say("=" * 72)
    ok = [f for f in FINDINGS if f[5] == 200]
    seats = [f for f in ok if f[8]]
    jsons = [f for f in ok if f[6]]
    films = [f for f in ok if f[7]]
    say(f"  requests 200           : {len(ok)} of {len(FINDINGS)}")
    say(f"  returned JSON          : {len(jsons)}")
    say(f"  mention the film       : {len(films)}")
    say(f"  EXPOSE SEAT COUNTS     : {len(seats)}   <- the only line that matters")

    if seats:
        say("\n  SEAT DATA FOUND AT:")
        seen = set()
        for f in seats:
            if f[0] in seen: continue
            seen.add(f[0])
            say(f"    [{f[1]}] {f[0]:<22} ~{f[2]} sites   via {f[3]}  ({f[9]})")
        say("\n  These are worth a parser. Occupancy here converts to money the")
        say("  same way Fandango does.")
    else:
        say("\n  NO seat fields on any homepage response. That is NOT the final")
        say("  answer - most chains only expose seats on the seat-map call, two")
        say("  clicks past a showtime id. It means the probe has to go one level")
        say("  deeper on whichever hosts returned JSON, which is what I use the")
        say("  'api urls' and 'platform' lines below to target.")

    plats = {}
    for f in ok:
        if f[9] and f[9] != "-":
            for p in f[9].split("+"):
                plats.setdefault(p, set()).add(f[0])
    if plats:
        say("\n  PLATFORMS - one parser each, not one per chain:")
        for p, chains in sorted(plats.items(), key=lambda x: -len(x[1])):
            say(f"    {p:<12} {len(chains):>2} chains: {', '.join(sorted(chains))[:150]}")
        say("\n  Whichever platform covers the most sites is the first thing I")
        say("  write. That is the difference between one week of parsers and one")
        say("  afternoon.")

    dead = sorted({f[0] for f in FINDINGS} - {f[0] for f in ok})
    if dead:
        say(f"\n  no usable response at all: {', '.join(dead)}")
        say("  Some of these are Cloudflare, not absence. I will tell them apart.")


def main():
    say(f"NA GAP PROBE  {datetime.datetime.now().isoformat()}   target date {DATE}")
    say("Covered today by na_sweep.py: Fandango (US) + Cineplex (CA), 389 theatres.")
    say("This probe asks what is OUTSIDE that, and whether it publishes seats.")
    say("Seat fields watched: seatsAvailable / seatsRemaining / availableSeats /")
    say("RemainingSeats / seatsLeft / percentSold.")
    coverage_report()

    n = sum(len(t[4]) for t in TARGETS)
    say(f"\n{len(TARGETS)} targets, {n} requests, about {int(n * (PAUSE + 1.1) / 60) + 1} minutes.\n")

    for chain, country, sites, host, paths in TARGETS:
        for label, p in paths:
            hit(chain, country, sites, label, host + p)
            time.sleep(PAUSE)

    summary()

    say("\n" + "=" * 72)
    say("WHAT I NEED FROM THIS FILE")
    say("  1. every SEATS=True line - that chain is worth a parser")
    say("  2. every platform= hit - tells me how many chains one parser buys")
    say("  3. every 'api urls' line on an HTML page - the real endpoint behind it")
    say("  4. every film=True - confirms the film is actually booked there, so I")
    say("     am not building a reader for a chain that never played it")
    say("=" * 72)

    os.makedirs("intel", exist_ok=True)
    path = os.path.join("intel", "na_probe2.txt")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(OUT))
    print(f"\nWritten to {path}  -  send me this file", flush=True)


if __name__ == "__main__":
    main()
