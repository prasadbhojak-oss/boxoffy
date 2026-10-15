#!/usr/bin/env python3
"""
Boxoffy - NA GAP PROBE, ROUND 2.    python na_probe3.py

Round 1 result, stated plainly: 34 of 78 requests came back 200, and
  ZERO returned JSON.  ZERO exposed a seat field.
That is a real finding, not a failure, and it sets the ceiling on this whole
direction: outside Fandango and Cineplex we are likely to win FOOTPRINT (how
many theatres and shows) and not MONEY (how many seats sold).  I am not going
to pretend a second occupancy feed is coming out of here until a seat field
actually shows up.

So round 2 stops guessing endpoint names - that is what failed - and instead
reads the routes each site ADVERTISES about itself.  Four parts:

  A  SHOWTIMES.COM CENSUS ROUTE.  Round 1 found the film there, slug
     /movies/drishyam-the-conclusion-200472/.  A listings site will hand us the
     national theatre list for free.  No seats, but it settles the question
     round 1 could only pose: are we missing 67 Marcus sites because our zip
     seeds never reached Milwaukee, or because Marcus only booked 13?  Those
     two look identical in our data today and mean completely different things.

  B  ONE LEVEL DEEPER on the 13 hosts that served real HTML.  Pull the api
     paths, buildIds and film slugs out of their own markup and follow them.
     Harkins is the best single shot in the set: it is Next.js and round 1
     already caught buildId mI3Tw2f2hCL3jxCM73N4i, so /_next/data/<buildId>/
     should serve that page's props as JSON.

  C  FIX THE FOUR DEAD HOSTNAMES.  Phoenix Big Cinemas, Bow Tie, MovieMax and
     Golden failed DNS, which almost certainly means I had the domain wrong,
     not that the chain is gone.  Phoenix is a desi chain and worth the retry.

  D  RETRY THE 403s WITH BROWSER-GRADE HEADERS.  Malco, Studio Movie Grill,
     Santikos, Silverspot, Landmark CA, plus Marcus and Megaplex which served a
     212-byte edge stub.  Those sites are alive and deliberately refusing a
     bare urllib. Sometimes a full Chrome header set is the whole fix.  If it
     is not, Landmark is the only one big enough (~40 Canadian sites) to be
     worth opening by hand, and I will do that rather than build anything.

Stdlib only.  Python 3.8+.  Windows-safe.  About four minutes.
Writes intel/na_probe3.txt - send me that file.
"""

import gzip, io, json, os, re, socket, time, datetime
import urllib.request, urllib.error, http.cookiejar
from urllib.parse import urljoin, urlparse

PAUSE = 0.45
TIMEOUT = 20
OUT = []
WINS = []        # things worth acting on

BASE_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
           "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
HDR = {"User-Agent": BASE_UA,
       "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
       "Accept-Language": "en-US,en;q=0.9",
       "Accept-Encoding": "gzip, deflate"}

# The header set a real Chrome actually sends. The difference between this and
# HDR above is the entire reason some 403s turn into 200s.
BROWSER = {
    "User-Agent": BASE_UA,
    "Accept": ("text/html,application/xhtml+xml,application/xml;q=0.9,"
               "image/avif,image/webp,image/apng,*/*;q=0.8"),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "no-cache",
}

SEAT_RE = re.compile(
    r"seatsAvailable|seatsRemaining|availableSeats|SeatsAvailable|seats_available"
    r"|RemainingSeats|AvailableSeats|seatsLeft|OccupiedSeats|SeatStatus"
    r"|\"available\"\s*:\s*\d+|percentSold|soldOut|sold_out", re.I)
# Routes a page tells us about itself. This is the shift from round 1: no
# invented paths, only ones present in the markup.
SELF_RE = re.compile(
    r"""["'(]((?:https?://[a-z0-9.\-]+)?/(?:[a-z0-9\-_./]*)"""
    r"""(?:api|graphql|showtime|session|movie|film|cinema|theatre|theater)"""
    r"""[a-z0-9\-_./?=&]{0,70})["')]""", re.I)

jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def say(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True)
    OUT.append(s)


def get(url, hdrs=None, ref=None, cap=500_000):
    """Returns (status, body, content_type) - never raises."""
    h = dict(hdrs or HDR)
    if ref: h["Referer"] = ref
    try:
        with op.open(urllib.request.Request(url, headers=h), timeout=TIMEOUT) as r:
            raw = r.read(cap)
            if r.headers.get("Content-Encoding") == "gzip":
                try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                except Exception: pass
            ct = (r.headers.get("Content-Type") or "").split(";")[0]
            return r.status, raw.decode("utf-8", "replace"), ct
    except urllib.error.HTTPError as e:
        return e.code, "", ""
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}", ""


def report(label, url, st, body, ct, show=600):
    isj = "json" in (ct or "") or body.lstrip()[:1] in "[{"
    seat = bool(SEAT_RE.search(body)) if st == 200 else False
    film = "drishyam" in body.lower()
    say(f"\n### {label}")
    say(f"    {url}")
    if st != 200:
        say(f"    HTTP {st}" + (f"  {body[:90]}" if st == 0 else ""))
        return None
    say(f"    HTTP 200  {ct}  {len(body):,}B  json={isj}  film={film}  SEATS={seat}")
    if isj:
        say("    " + body[:show].replace("\n", " "))
        try:
            j = json.loads(body)
            if isinstance(j, dict): say(f"    TOP KEYS: {list(j)[:30]}")
            elif isinstance(j, list) and j and isinstance(j[0], dict):
                say(f"    LIST[{len(j)}] KEYS: {list(j[0])[:30]}")
        except Exception: pass
        WINS.append(("JSON", label, url))
    if seat:
        m = SEAT_RE.search(body)
        a = max(0, m.start() - 150)
        say(f"    >> SEAT FIELD: ...{body[a:m.end()+200]}...".replace("\n", " "))
        WINS.append(("SEATS", label, url))
    return body


def self_routes(body, base, want=10):
    """Routes the page advertises. Deduped, junk dropped, longest first -
    a deeper path is nearly always the data route and the shallow one the nav link."""
    out, seen = [], set()
    for m in SELF_RE.findall(body or ""):
        u = urljoin(base, m)
        p = urlparse(u)
        if p.netloc and urlparse(base).netloc.split(".")[-2] not in p.netloc:
            continue                       # stay on the chain's own domain
        if any(x in u.lower() for x in (".css", ".js", ".png", ".jpg", ".svg",
                                        ".woff", "facebook", "google", "twitter",
                                        "instagram", "youtube")):
            continue
        if u in seen: continue
        seen.add(u); out.append(u)
    out.sort(key=lambda u: -u.count("/"))
    return out[:want]


# ───────────────────────────────────────────────────────────── A · showtimes.com
FILM_SLUG = "/movies/drishyam-the-conclusion-200472/"
ZIPS = [("Dallas", "75024"), ("Edison NJ", "08817"), ("Chicago", "60089")]


def part_a():
    say("\n" + "=" * 72)
    say("A - SHOWTIMES.COM: is there a national theatre-list route?")
    say("    If yes, we get a true national footprint for free, which tells us")
    say("    whether our 382 Fandango theatres is the whole market or a slice.")
    say("=" * 72)
    home = "https://www.showtimes.com"
    st, body, ct = get(home + FILM_SLUG, BROWSER)
    b = report("showtimes.com film page", home + FILM_SLUG, st, body, ct)
    if b:
        # how many theatre links does the bare film page already carry?
        th = re.findall(r"/movie-theaters?/([a-z0-9\-]+)/?", b, re.I)
        say(f"    theatre links on page: {len(set(th))}  e.g. {list(dict.fromkeys(th))[:6]}")
        say(f"    self-advertised routes: {self_routes(b, home, 8)}")
    for city, z in ZIPS:
        for lab, u in (("?zip",      f"{home}{FILM_SLUG}?zip={z}"),
                       ("showtimes", f"{home}/showtimes/{z}/"),
                       ("theaters",  f"{home}/movie-theaters/{z}/")):
            st, body, ct = get(u, BROWSER, ref=home + FILM_SLUG)
            bb = report(f"showtimes.com {lab} {city} {z}", u, st, body, ct, show=300)
            if bb:
                th = set(re.findall(r"/movie-theaters?/([a-z0-9\-]+)/?", bb, re.I))
                say(f"    distinct theatre slugs: {len(th)}")
            time.sleep(PAUSE)


# ───────────────────────────────────────────────── B · deeper on the live hosts
LIVE = [
    ("Harkins",        "https://www.harkins.com"),
    ("B&B Theatres",   "https://www.bbtheatres.com"),
    ("Premiere Cin",   "https://www.pccmovies.com"),
    ("CMX",            "https://cmxcinemas.com"),
    ("NCG",            "https://www.ncgmovies.com"),
    ("GQT",            "https://www.gqtmovies.com"),
    ("Flix Brewhouse", "https://www.flixbrewhouse.com"),
    ("Regency",        "https://www.regencymovies.com"),
    ("Emagine",        "https://www.emagine-entertainment.com"),
    ("FunAsia DFW",    "https://www.funasia.net"),
    ("Imagine CA",     "https://imaginecinemas.com"),
    ("Cinestarz CA",   "https://www.cinestarz.ca"),
    ("Atom Tickets",   "https://www.atomtickets.com"),
]


def part_b():
    say("\n" + "=" * 72)
    say("B - FOLLOW EACH SITE'S OWN ROUTES, one level deep")
    say("    Round 1 guessed /api/movies and got 404 nineteen times. This reads")
    say("    the paths out of the markup instead.")
    say("=" * 72)
    for chain, host in LIVE:
        say(f"\n--- {chain} ---")
        st, body, ct = get(host + "/", BROWSER)
        if st != 200 or not body:
            say(f"    homepage HTTP {st} - skipping"); continue
        say(f"    homepage 200, {len(body):,}B")

        # Next.js data route. Highest-probability JSON in the whole probe: the
        # buildId is the key to the page's own props, served as JSON.
        bid = re.search(r'"buildId"\s*:\s*"([^"]+)"', body)
        if bid:
            say(f"    NEXT buildId {bid.group(1)}")
            for p in ("index", "movies", "showtimes"):
                u = f"{host}/_next/data/{bid.group(1)}/{p}.json"
                st2, b2, ct2 = get(u, BROWSER, ref=host)
                report(f"{chain} _next/data {p}", u, st2, b2, ct2, show=500)
                time.sleep(PAUSE)

        # the film, if the site names it anywhere
        slugs = re.findall(r'href=["\']([^"\']*drishyam[^"\']*)["\']', body, re.I)
        for s in list(dict.fromkeys(slugs))[:2]:
            u = urljoin(host, s)
            st2, b2, ct2 = get(u, BROWSER, ref=host)
            bb = report(f"{chain} FILM PAGE", u, st2, b2, ct2)
            if bb:
                say(f"    routes on film page: {self_routes(bb, host, 6)}")
            time.sleep(PAUSE)
        if not slugs:
            say("    film not linked from homepage (may still be booked - "
                "listing pages often load by script)")

        for u in self_routes(body, host, 5):
            st2, b2, ct2 = get(u, BROWSER, ref=host)
            report(f"{chain} self-route", u, st2, b2, ct2, show=400)
            time.sleep(PAUSE)


# ─────────────────────────────────────────────── C · the four dead hostnames
ALTS = [
    ("Phoenix Big Cinemas", ["https://www.phoenixtheatres.com",
                             "https://www.bigcinemas.com",
                             "https://phoenixbigcinemas.net"]),
    ("Bow Tie",             ["https://bowtiecinemas.com",
                             "https://www.bowtiecinema.com"]),
    ("MovieMax desi",       ["https://www.moviemax.com",
                             "https://moviemaxcinema.com"]),
    ("Golden GTA",          ["https://goldencinemas.com",
                             "https://www.woodsidecinemas.ca"]),
]


def part_c():
    say("\n" + "=" * 72)
    say("C - RETRY THE DEAD HOSTNAMES (DNS failure = my domain was wrong)")
    say("=" * 72)
    for chain, hosts in ALTS:
        for h in hosts:
            st, body, ct = get(h + "/", BROWSER)
            report(f"{chain} alt", h, st, body, ct, show=250)
            time.sleep(PAUSE)
            if st == 200: break


# ───────────────────────────────────────── D · the 403s and the 212-byte stubs
WALLED = [
    ("Malco",             "https://www.malco.com"),
    ("Studio Movie Grill","https://www.studiomoviegrill.com"),
    ("Santikos",          "https://www.santikos.com"),
    ("Silverspot",        "https://silverspot.net"),
    ("Landmark CA",       "https://www.landmarkcinemas.com"),
    ("Marcus",            "https://www.marcustheatres.com"),
    ("Megaplex",          "https://www.megaplextheatres.com"),
]


def part_d():
    say("\n" + "=" * 72)
    say("D - 403s AND EDGE STUBS, retried with a full Chrome header set")
    say("    A 403 means the site is alive and refusing us, which is a different")
    say("    problem from a site that has no data. Marcus and Megaplex served a")
    say("    212-byte stub to every path, which is the same refusal wearing a")
    say("    200. If headers do not fix these, no amount of parser will.")
    say("=" * 72)
    for chain, host in WALLED:
        st, body, ct = get(host + "/", BROWSER)
        b = report(f"{chain} browser-headers", host, st, body, ct, show=300)
        if b is not None and len(b) > 5000:
            say(f"    >> HEADERS FIXED IT. {len(b):,}B of real page.")
            WINS.append(("UNBLOCKED", chain, host))
            say(f"    routes: {self_routes(b, host, 6)}")
        elif b is not None:
            say(f"    still a stub ({len(b)}B) - this is a WAF, not a header problem")
        time.sleep(PAUSE)


def main():
    say(f"NA GAP PROBE ROUND 2   {datetime.datetime.now().isoformat()}")
    say("Round 1: 34/78 responded, 0 JSON, 0 seat fields.")
    say("Round 2 asks whether that was the sites or my endpoint guesses.")
    part_a(); part_b(); part_c(); part_d()

    say("\n" + "=" * 72)
    say("SUMMARY")
    say("=" * 72)
    if WINS:
        for kind in ("SEATS", "JSON", "UNBLOCKED"):
            g = [w for w in WINS if w[0] == kind]
            if g:
                say(f"\n  {kind}  ({len(g)})")
                for _, lab, u in g[:25]:
                    say(f"    {lab:<34} {u}")
        if any(w[0] == "SEATS" for w in WINS):
            say("\n  A seat field exists outside Fandango. That is the one result")
            say("  that would justify building a second money sweeper.")
        else:
            say("\n  Still no seat field anywhere. Footprint only. I will say so")
            say("  in the method note rather than imply we count these markets.")
    else:
        say("\n  Nothing new. Round 1 was the sites, not my guesses - outside")
        say("  Fandango and Cineplex this market does not publish machine data.")
        say("  That is a publishable finding and the end of this direction.")

    os.makedirs("intel", exist_ok=True)
    p = os.path.join("intel", "na_probe3.txt")
    with open(p, "w", encoding="utf-8") as fh:
        fh.write("\n".join(OUT))
    print(f"\nWritten to {p}  -  send me this file", flush=True)


if __name__ == "__main__":
    main()
