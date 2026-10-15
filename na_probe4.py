#!/usr/bin/env python3
"""
Boxoffy - NA GAP PROBE, ROUND 3.  Narrow and targeted.    python na_probe4.py

Round 2 produced one real find, one false positive I have to own, and one miss
that was my fault.  This round chases only those.  Four jobs, ~30 requests, not
78 - because we now know where to look.

  1 HARKINS - THE FIND.  Its film pages embed a session JSON blob:
      "sessionId":"560443", "soldOut":false, "businessDate":"2026-10-02...",
      "ticketingUrl":"https://harkins.com/ticketing/theatre/10/movie/HO00015652/se..."
    Be precise about what that is and is not.  soldOut is a BOOLEAN, not a seat
    count - it tells us a show is full, not that it is 61% full.  On its own
    that is not occupancy.  But sessionId plus ticketingUrl is the route to the
    seat map, and the seat map is where real counts live.  This round follows
    that route and finds out.  ~35 Harkins sites, Arizona-heavy.

  2 LANDMARK CANADA - MY FALSE POSITIVE.  Round 2 reported SEATS=True.  It was
    wrong and I am flagging it rather than leaving it in a summary where it
    would eventually become a number in a post.  What my regex actually matched
    was Mustache template markup - {{#SoldOut}}, {{^SessionExpired}} - which is
    the empty mould, not the data poured into it.
    The lead is still real, just different: a template with per-session SoldOut
    state proves the page fills itself from a payload, so an endpoint exists.
    Client-side sites keep that endpoint in their JS bundle, so this round
    fetches the bundles and greps them.  That is how you crack a site that
    renders in the browser.  Also worth noting: a full Chrome header set turned
    Landmark's 403 into a 75KB page, so the wall was headers, not policy.

  3 SHOWTIMES.COM - MY MISS.  I guessed three zip routes and all three 404'd.
    The film page was advertising /movie-times/ the whole time and I did not
    follow it.  One line.  This is the national theatre census that tells us
    whether 382 Fandango theatres is the market or a slice of it.

  4 PHOENIX THEATREsS + THE NEWLY UNBLOCKED.  phoenixtheatres.com resolved,
    165KB.  Marcus and Megaplex opened up with browser headers but advertised
    no data routes, so for those two the question is whether the film is even
    booked before anything else is worth doing.

Stdlib only.  Python 3.8+.  Windows-safe.  Two to three minutes.
Writes intel/na_probe4.txt - send me that file.
"""

import gzip, io, json, os, re, time, datetime
import urllib.request, urllib.error, http.cookiejar
from urllib.parse import urljoin

PAUSE = 0.45
TIMEOUT = 25
OUT = []
WINS = []

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
BROWSER = {
    "User-Agent": UA,
    "Accept": ("text/html,application/xhtml+xml,application/xml;q=0.9,"
               "image/avif,image/webp,*/*;q=0.8"),
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
}

# A real seat COUNT, not a sold-out flag. Round 2 taught me to keep these apart:
# a boolean is a different product from a number and only the number is money.
COUNT_RE = re.compile(
    r"(seatsAvailable|seatsRemaining|availableSeats|RemainingSeats|seatsLeft"
    r"|SeatsAvailable|AvailableSeats|totalSeats|seatCount|capacity"
    r"|percentSold|occupancy)\"?\s*[:=]\s*\"?(\d+)", re.I)
# Seat-map payloads name individual seats and their state. If this fires we can
# count sold seats directly, which is the strongest possible result.
MAP_RE = re.compile(
    r"(\"status\"\s*:\s*\"(?:sold|taken|occupied|unavailable|available)\""
    r"|\"seatStatus\"|\"isAvailable\"|\"SeatStatus\"|\"seats\"\s*:\s*\[)", re.I)
BOOL_RE = re.compile(r"\"(soldOut|SoldOut|isSoldOut)\"\s*:\s*(true|false)", re.I)

jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def say(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True); OUT.append(s)


def get(url, ref=None, cap=900_000):
    h = dict(BROWSER)
    if ref: h["Referer"] = ref
    try:
        with op.open(urllib.request.Request(url, headers=h), timeout=TIMEOUT) as r:
            raw = r.read(cap)
            if r.headers.get("Content-Encoding") == "gzip":
                try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                except Exception: pass
            return r.status, raw.decode("utf-8", "replace"), \
                   (r.headers.get("Content-Type") or "").split(";")[0]
    except urllib.error.HTTPError as e:
        return e.code, "", ""
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}", ""


def grade(label, url, st, body, ct, show=0):
    """One honest line per request. COUNTS and MAP are money. BOOL is not."""
    say(f"\n### {label}")
    say(f"    {url}")
    if st != 200:
        say(f"    HTTP {st}" + (f"  {body[:90]}" if st == 0 else ""))
        return None
    counts = COUNT_RE.findall(body)
    mapped = bool(MAP_RE.search(body))
    bools  = BOOL_RE.findall(body)
    film   = "drishyam" in body.lower()
    say(f"    HTTP 200  {ct}  {len(body):,}B  film={film}  "
        f"COUNTS={len(counts)}  SEATMAP={mapped}  soldOutFlags={len(bools)}")
    if counts:
        say(f"    >> REAL SEAT NUMBERS: {counts[:8]}")
        WINS.append(("COUNTS", label, url))
    if mapped:
        m = MAP_RE.search(body); a = max(0, m.start() - 160)
        say(f"    >> SEAT MAP: ...{body[a:m.end()+220]}...".replace("\n", " "))
        WINS.append(("SEATMAP", label, url))
    if bools and not counts:
        say(f"    (sold-out booleans only: {bools[:4]} - a flag, not occupancy)")
    if show and body.lstrip()[:1] in "[{":
        say("    " + body[:show].replace("\n", " "))
    return body


# ───────────────────────────────────────────────────────── 1 · Harkins, the find
def part1():
    say("\n" + "=" * 72)
    say("1 - HARKINS: follow sessionId -> ticketingUrl -> seat map")
    say("    The embedded blob gives sessionId and soldOut. The question is")
    say("    whether the ticketing route behind it gives a NUMBER.")
    say("=" * 72)
    host = "https://www.harkins.com"
    pages, tick = [], []

    for slug in ("drishyam-the-conclusion", "drishyam-3", "drishyam"):
        u = f"{host}/movies/{slug}"
        st, b, ct = get(u, ref=host)
        got = grade(f"Harkins film page /{slug}", u, st, b, ct)
        if got: pages.append((slug, got))
        time.sleep(PAUSE)

    # fall back to a page we KNOW carries the blob, so the ticketing route gets
    # tested even if Harkins never booked this film
    if not any(("drishyam" in b.lower()) for _, b in pages):
        say("\n    film not found under those slugs - testing the ticketing route")
        say("    on a film Harkins definitely has, so we still learn the shape")
        st, b, ct = get(f"{host}/movies/verity", ref=host)
        if st == 200: pages.append(("verity", b))
        time.sleep(PAUSE)

    for slug, b in pages:
        ids = list(dict.fromkeys(re.findall(r'"sessionId"\s*:\s*"(\d+)"', b)))
        urls = list(dict.fromkeys(re.findall(
            r'"ticketingUrl"\s*:\s*"(https?://[^"]+)"', b)))
        say(f"\n    /{slug}: {len(ids)} sessionIds, {len(urls)} ticketingUrls")
        if ids: say(f"      sessionIds e.g. {ids[:6]}")
        if urls: say(f"      ticketingUrl e.g. {urls[0]}")
        tick += urls[:3]

    for u in list(dict.fromkeys(tick))[:4]:
        st, b, ct = get(u, ref=host)
        grade("Harkins TICKETING page", u, st, b, ct, show=400)
        time.sleep(PAUSE)
        # the seat map is usually one more hop, named in the ticketing page
        if st == 200 and b:
            for cand in list(dict.fromkeys(re.findall(
                    r'["\'](/?[a-z0-9\-_./]*(?:seat|SeatLayout|seating)'
                    r'[a-z0-9\-_./?=&]{0,60})["\']', b, re.I)))[:3]:
                cu = urljoin(u, cand)
                st2, b2, ct2 = get(cu, ref=u)
                grade("Harkins SEAT ROUTE", cu, st2, b2, ct2, show=400)
                time.sleep(PAUSE)


# ─────────────────────────────────────────────── 2 · Landmark, behind the bundle
def part2():
    say("\n" + "=" * 72)
    say("2 - LANDMARK CA: the endpoint behind the Mustache template")
    say("    Round 2's SEATS=True here was my regex hitting {{#SoldOut}} in the")
    say("    template. Wrong, and corrected. The data route is in the JS.")
    say("=" * 72)
    host = "https://www.landmarkcinemas.com"
    st, b, ct = get(host + "/")
    if st != 200:
        say(f"\n    homepage HTTP {st} - the header fix did not hold"); return
    say(f"\n    homepage 200, {len(b):,}B")

    srcs = [urljoin(host, s) for s in re.findall(
        r'<script[^>]+src=["\']([^"\']+\.js[^"\']*)["\']', b, re.I)]
    srcs = [s for s in dict.fromkeys(srcs)
            if not any(x in s.lower() for x in
                       ("google", "gtm", "facebook", "jquery", "polyfill",
                        "analytics", "hotjar", "cookie"))]
    say(f"    {len(srcs)} candidate bundles; reading up to 5")

    EP = re.compile(r"[\"'](/[a-z0-9\-_/]*(?:api|ajax|Session|Showtime|Movie|"
                    r"Cinema|Film|Seat)[a-z0-9\-_/]*)[\"']", re.I)
    found = []
    for s in srcs[:5]:
        st2, b2, _ = get(s, ref=host, cap=1_600_000)
        if st2 != 200:
            say(f"      {s.rsplit('/',1)[-1][:46]} HTTP {st2}"); continue
        eps = list(dict.fromkeys(EP.findall(b2)))
        say(f"      {s.rsplit('/',1)[-1][:46]} {len(b2):,}B  endpoints={len(eps)}")
        for e in eps[:14]: say(f"         {e}")
        found += eps
        time.sleep(PAUSE)

    # try the most promising endpoints the bundle named
    rank = sorted(dict.fromkeys(found),
                  key=lambda e: -(("session" in e.lower()) * 3
                                  + ("showtime" in e.lower()) * 3
                                  + ("seat" in e.lower()) * 4
                                  + ("api" in e.lower())))
    for e in rank[:6]:
        u = urljoin(host, e)
        st2, b2, ct2 = get(u, ref=host)
        grade("Landmark endpoint", u, st2, b2, ct2, show=450)
        time.sleep(PAUSE)


# ────────────────────────────────────────────── 3 · showtimes.com, the census
def part3():
    say("\n" + "=" * 72)
    say("3 - SHOWTIMES.COM /movie-times/ - the route I failed to follow")
    say("    No seats here ever. What it buys is a national theatre count, so")
    say("    we finally know if 382 is the market or a slice.")
    say("=" * 72)
    host = "https://www.showtimes.com"
    film = "/movies/drishyam-the-conclusion-200472"
    for lab, u in (("movie-times",    f"{host}{film}/movie-times/"),
                   ("mt + zip 75024", f"{host}{film}/movie-times/?zip=75024"),
                   ("mt + zip 08817", f"{host}{film}/movie-times/?zip=08817")):
        st, b, ct = get(u, ref=host + film)
        got = grade(f"showtimes.com {lab}", u, st, b, ct)
        if got:
            th = set(re.findall(r"/movie-theaters?/([a-z0-9\-]{4,})", got, re.I))
            names = re.findall(r'theater[^>]*>\s*([A-Z][^<]{4,44})<', got)
            say(f"    theatre slugs {len(th)}   names {len(set(names))}")
            if th: say(f"      e.g. {sorted(th)[:8]}")
            if names: say(f"      e.g. {list(dict.fromkeys(names))[:6]}")
            for r in list(dict.fromkeys(re.findall(
                    r'["\'](/[a-z0-9\-_/]*(?:showtime|movie-time|theater)'
                    r'[a-z0-9\-_/?=&]{0,50})["\']', got, re.I)))[:5]:
                say(f"      route: {r}")
        time.sleep(PAUSE)


# ──────────────────────────────────────── 4 · Phoenix + the newly unblocked
def part4():
    say("\n" + "=" * 72)
    say("4 - PHOENIX THEATRES, MARCUS, MEGAPLEX")
    say("    For Marcus and Megaplex the first question is not 'can we parse")
    say("    it' but 'did they book the film at all'. No point building either.")
    say("=" * 72)
    for chain, host in (("Phoenix Theatres", "https://www.phoenixtheatres.com"),
                        ("Marcus",   "https://www.marcustheatres.com"),
                        ("Megaplex", "https://www.megaplextheatres.com")):
        say(f"\n--- {chain} ---")
        st, b, ct = get(host + "/")
        if st != 200 or not b:
            say(f"    homepage HTTP {st}"); continue
        film = "drishyam" in b.lower()
        say(f"    homepage 200, {len(b):,}B, film_on_homepage={film}")
        links = list(dict.fromkeys(re.findall(
            r'href=["\']([^"\']*drishyam[^"\']*)["\']', b, re.I)))
        if links:
            say(f"    film links: {links[:3]}")
            for l in links[:2]:
                u = urljoin(host, l)
                st2, b2, ct2 = get(u, ref=host)
                grade(f"{chain} film page", u, st2, b2, ct2)
                time.sleep(PAUSE)
        else:
            # not on the homepage is normal; try the obvious listing routes
            for p in ("/movies", "/now-playing", "/showtimes"):
                st2, b2, ct2 = get(host + p, ref=host)
                if st2 == 200 and b2:
                    f2 = "drishyam" in b2.lower()
                    say(f"    {p}: 200, {len(b2):,}B, film={f2}")
                    if f2:
                        grade(f"{chain} listing with film", host + p, st2, b2, ct2)
                else:
                    say(f"    {p}: HTTP {st2}")
                time.sleep(PAUSE)


def main():
    say(f"NA GAP PROBE ROUND 3  {datetime.datetime.now().isoformat()}")
    say("Chasing only what round 2 actually found. Scoring rule for this run:")
    say("  COUNTS  = a real seat number        -> worth building")
    say("  SEATMAP = per-seat sold/available   -> worth building, best case")
    say("  soldOut boolean only                -> NOT occupancy, not money")
    part1(); part2(); part3(); part4()

    say("\n" + "=" * 72)
    say("SUMMARY")
    say("=" * 72)
    for kind in ("SEATMAP", "COUNTS"):
        g = [w for w in WINS if w[0] == kind]
        if g:
            say(f"\n  {kind}  ({len(g)})")
            for _, lab, u in g[:20]: say(f"    {lab:<30} {u}")
    if not WINS:
        say("\n  No seat numbers and no seat maps. Three rounds in, the finding")
        say("  is settled and worth stating in the method note: outside Fandango")
        say("  and Cineplex, North American exhibitors do not publish machine-")
        say("  readable seat availability. We can add FOOTPRINT from these")
        say("  chains - theatres and shows - and we should not imply more.")
    else:
        say("\n  Build order is whichever of these covers the most sites. I will")
        say("  cross-check each against fandango_theatres.csv before a line of")
        say("  sweeper gets written, so nothing gets counted twice.")

    os.makedirs("intel", exist_ok=True)
    p = os.path.join("intel", "na_probe4.txt")
    with open(p, "w", encoding="utf-8") as fh:
        fh.write("\n".join(OUT))
    print(f"\nWritten to {p}  -  send me this file", flush=True)


if __name__ == "__main__":
    main()
