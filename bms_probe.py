#!/usr/bin/env python3
"""
Boxoffy - BookMyShow RECONNAISSANCE probe          python bms_probe.py

WHAT THIS IS, AND WHAT IT IS NOT
--------------------------------
This is NOT a sweep. It is a 60-second test of one question:

    does BookMyShow expose seats-total and seats-available WITHOUT
    entering the booking funnel, the way District does?

District works for us because its server renders the entire city grid into
__NEXT_DATA__, and every session in that blob carries total, avail and the
per-class prices. One request per city, nothing in the booking path touched,
and the result is an exact seat count rather than an estimate.

My expectation before running this is that BMS does NOT work that way: that
the page carries venues and showtimes but no seat counts, and that seat
layout lives behind a per-session funnel call that needs a region cookie and
a generated id. If that is what this probe finds, the honest answer is that
a District-style BMS sweep is not available to us, and the India seat number
stays District-only.

This probe exists to settle that with evidence instead of my assumption.

HARD RULES THIS SCRIPT OBEYS
----------------------------
  - Public pages only. No login, no account, no credentials of any kind.
  - No token forging, no signature guessing, no CAPTCHA handling.
  - No bot-protection evasion. A 403 is an ANSWER, not an obstacle: the probe
    records it and stops that line of enquiry.
  - It never books, never holds a seat, never posts anything.
  - Tiny request budget, generous pauses. It is a knock on the door, not a
    load test.

If the answer comes back "funnel only", we do not go further. Scraping a
per-session booking funnel across a national circuit is a different thing
from reading one server-rendered page, both in load and in what it implies,
and District plus BCM already gives us a defensible India number.

Writes intel/bms-probe-<date>/ . Stdlib only. Python 3.8+.

    python bms_probe.py                       drishyam, mumbai
    python bms_probe.py national-cinemas      try the city-list page too
"""

import os, re, io, sys, json, gzip, time, datetime, collections
import urllib.request, urllib.error, http.cookiejar

DATE = datetime.date.today().isoformat()
OUT = os.path.join("intel", f"bms-probe-{DATE}")

# BMS identifies a film by an event code (ET########). The probe tries to find
# it from the search/movies page rather than having one hardcoded, because a
# stale code would make a working endpoint look broken.
FILM_QUERY = "drishyam"
# BMS needs both the city slug and its short region code, and they are not
# derivable from each other. mumbai -> mumb, new delhi -> ncr, bengaluru ->
# bang, hyderabad -> hyd, chennai -> chen, kolkata -> kolk, pune -> pune.
# If the showtimes URL 404s, the region code is the first thing to check.
CITY = "mumbai"
REGION = "mumb"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
HDR = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none", "Sec-Fetch-User": "?1",
}
PAUSE = 2.0          # deliberately slow. This is recon, not a sweep.

LOG = []
def log(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True); LOG.append(s)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get(url, referer=None, accept=None):
    """One attempt, no retry loop. A failure here is data, not something to
    push through."""
    h = dict(HDR)
    if referer:
        h["Referer"] = referer; h["Sec-Fetch-Site"] = "same-origin"
    if accept:
        h["Accept"] = accept; h["Sec-Fetch-Dest"] = "empty"
        h["Sec-Fetch-Mode"] = "cors"
    try:
        with opener.open(urllib.request.Request(url, headers=h), timeout=30) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                except Exception: pass
            return r.status, raw.decode("utf-8", "replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        body = ""
        try: body = e.read().decode("utf-8", "replace")[:400]
        except Exception: pass
        return e.code, body, dict(getattr(e, "headers", {}) or {})
    except Exception as ex:
        return 0, f"{type(ex).__name__}: {ex}", {}


# ---------------------------------------------------------------- blob hunting
BLOB_PATTERNS = [
    ("__NEXT_DATA__",
     r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>'),
    ("window.__INITIAL_STATE__",
     r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\});?\s*</script>'),
    ("window.__INITIAL_DATA__",
     r'window\.__INITIAL_DATA__\s*=\s*(\{.*?\});?\s*</script>'),
    ("window.__PRELOADED_STATE__",
     r'window\.__PRELOADED_STATE__\s*=\s*(\{.*?\});?\s*</script>'),
    ("self.__next_f (RSC flight)",
     r'self\.__next_f\.push\((\[.*?\])\)'),
    ("ld+json",
     r'<script type="application/ld\+json"[^>]*>(.*?)</script>'),
]

# The three things a sweep actually needs. If none of these key names appear
# anywhere in the page payload, there is no seat count to read.
SEAT_KEYS = [
    "seatsAvail", "seatAvail", "availableSeats", "seatsTotal", "totalSeats",
    "seatLayout", "seatStatus", "SeatsAvail", "AvailSeats", "TotalSeats",
    "avail", "occupancy", "soldSeats", "bookedSeats",
]
SHOW_KEYS = [
    "showTime", "ShowTime", "showtimes", "sessions", "SessionId", "sessionId",
    "venue", "Venue", "cinema", "VenueCode", "venueCode",
]


def find_blobs(html):
    found = []
    for name, pat in BLOB_PATTERNS:
        for m in re.finditer(pat, html, re.S):
            txt = m.group(1)
            parsed = None
            try:
                parsed = json.loads(txt)
            except Exception:
                pass
            found.append((name, len(txt), parsed is not None))
    return found


def key_census(html):
    """Count how often each interesting key name appears in the raw payload.
    Cheap, and it answers the real question without having to map the whole
    object graph: no seat keys anywhere means no seat data on this page."""
    seats = {k: html.count(f'"{k}"') for k in SEAT_KEYS}
    shows = {k: html.count(f'"{k}"') for k in SHOW_KEYS}
    return ({k: v for k, v in seats.items() if v},
            {k: v for k, v in shows.items() if v})


def main():
    os.makedirs(OUT, exist_ok=True)
    log(f"BMS RECON  {datetime.datetime.now().isoformat()}")
    log(f"question: does BMS expose seat counts outside the booking funnel?")
    log(f"film query '{FILM_QUERY}'   city '{CITY}'   pause {PAUSE}s   no auth\n")

    # 1. can we even reach it, and what does it set on us
    log("[1] reachability and cookies")
    st, html, hdrs = get(f"https://in.bookmyshow.com/explore/movies-{CITY}")
    log(f"    explore/movies-{CITY}   HTTP {st}   {len(html):,} bytes")
    log(f"    cookies set: {[c.name for c in jar] or 'none'}")
    server = hdrs.get("Server") or hdrs.get("server") or "?"
    log(f"    Server: {server}")
    for h in ("x-akamai-transformed", "akamai-grn", "cf-ray", "x-cache"):
        if any(k.lower() == h for k in hdrs):
            log(f"    {h}: present  (edge/bot layer in front)")
    if st == 403:
        log("    403 on the public listing page. That is the answer for the")
        log("    anonymous path: BMS is refusing an unauthenticated client.")
        log("    We stop here. We do not work around bot protection.")
        finish(); return
    if st != 200 or not html:
        log("    could not read the listing page. Nothing further to test.")
        finish(); return
    time.sleep(PAUSE)

    # 2. is the film there, and what is its event code
    log("\n[2] locating the film and its event code")
    codes = collections.OrderedDict()
    for slug, code in re.findall(r"/movies/([a-z0-9\-]+)/(ET\d+)", html, re.I):
        codes.setdefault(code, slug)
    log(f"    event codes on the listing page: {len(codes)}")
    target = None
    for code, slug in codes.items():
        if FILM_QUERY.lower() in slug.lower():
            target = (slug, code); break
    if target:
        log(f"    match: {target[0]}  {target[1]}")
    else:
        log(f"    '{FILM_QUERY}' not found on the listing page.")
        if codes:
            code0, slug0 = next(iter(codes.items()))   # codes maps CODE -> slug
            target = (slug0, code0)
            log(f"    falling back to the first film found so the structural")
            log(f"    test still runs: {slug0}  {code0}")
            log(f"    (the verdict below is about PAGE SHAPE, which does not")
            log(f"     depend on which film we looked at)")
    if not target:
        log("    no event codes at all. Page shape has changed or is JS-only.")
        finish(); return
    slug, code = target
    time.sleep(PAUSE)

    # 3. THE REAL TEST: does the showtimes page carry seat counts
    log("\n[3] showtimes page - the decisive test")
    url = (f"https://in.bookmyshow.com/buytickets/{slug}-{CITY}"
           f"/movie-{REGION}-{code}-MT/{DATE.replace('-','')}")
    st, page, _ = get(url, referer=f"https://in.bookmyshow.com/explore/movies-{CITY}")
    log(f"    {url}")
    log(f"    HTTP {st}   {len(page):,} bytes")
    if st == 200 and page:
        blobs = find_blobs(page)
        if blobs:
            log("    server-rendered blobs found:")
            for name, size, ok in blobs[:8]:
                log(f"      {name:<28}{size:>9,} bytes   json-parses={ok}")
        else:
            log("    NO server-rendered data blob. Page is client-fetched.")
        seats, shows = key_census(page)
        log(f"    show/venue key hits: {shows or 'NONE'}")
        log(f"    SEAT key hits:       {seats or 'NONE'}")
        open(os.path.join(OUT, "showtimes_page.html"), "w",
             encoding="utf-8").write(page)
        log(f"    saved showtimes_page.html for inspection")
        verdict(seats, shows)
    else:
        log("    could not read the showtimes page anonymously.")
        if st == 403:
            log("    403 means the anonymous path is closed. We stop.")
    finish()


def verdict(seats, shows):
    log("\n=== VERDICT ===")
    if seats:
        log("  Seat-related keys ARE present outside the booking funnel.")
        log("  That is the good case and it is worth a second look: open")
        log("  showtimes_page.html, confirm the numbers are real per-session")
        log("  totals rather than a 'fast filling' label, and if they are,")
        log("  a District-style BMS sweep becomes buildable.")
        log("  Do NOT assume it. Verify against one cinema by eye first.")
    elif shows:
        log("  Venues and showtimes are present. Seat counts are NOT.")
        log("  This is the expected result, and it means BMS gives us the")
        log("  footprint - how many cinemas, how many shows, which formats -")
        log("  but not occupancy, without entering a per-session funnel.")
        log("  A footprint-only BMS sweep is still useful: it is a second,")
        log("  independent read on screen count and show count to set")
        log("  against District's. It is NOT a seat or gross number.")
    else:
        log("  Neither showtimes nor seats are in the served HTML. The page")
        log("  is fully client-rendered, so nothing is readable this way.")
    log("\n  India seat and gross numbers stay District-sourced either way,")
    log("  unless the good case above verifies by eye.")


def finish():
    open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8").write("\n".join(LOG))
    log(f"\nWritten to {OUT}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        FILM_QUERY = sys.argv[1]
    main()
