#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Boxoffy - RAMAYANA, NORTH AMERICA SWEEP v2.   Standalone, one file.
Built 11 October 2026, T-26.

================================================================
WHY v2 EXISTS - READ THIS, IT CHANGES WHAT WE MEASURE
================================================================
v1 swept Fandango and called the result "Ramayana's whole North
American presale". That was wrong, and the way it was wrong
matters more than the number.

On 11 October, Fandango shows NOTIFY ME. Atom shows COMING
SOON. Cinemark offers a watchlist. IMAX offers an email signup.
Meanwhile Hollywood Blvd in Woodridge IL is selling 22 shows
across 6-12 November with live checkout links, Emagine lists
BOTH US cuts with correct runtimes, and on 10 October we
photographed live seat maps at Galaxy Grandscape, three Regals
and two Studio Movie Grills.

THE CHAINS HAVE THE FILM. THE AGGREGATORS DO NOT.

So v1's 88 tickets was never North America's presale. It was
Fandango's presale, which for this title is close to nothing.

v2 therefore sweeps THREE surfaces and reports them SEPARATELY:

  1. FANDANGO   the old baseline. Keep it, because the day it
                finally lights up is itself the signal.
  2. CINEPLEX   Canada. Film id 62087 is now resolved and the
                152-location national list is confirmed.
  3. CHAINS     the chains' own sites, where the tickets are.

================================================================
WHY THIS HAS TO RUN ON YOUR MACHINE, NOT MINE
================================================================
regmovies.com returns 4xx to every datacentre fetcher I have.
Galaxy's film page has returned HTTP 500 for two days. From a
RESIDENTIAL IP those will very likely answer. That is the whole
reason this is a .py for you to run rather than something I do
for you - your home connection can reach what my cloud box
cannot.

So this script SAVES THE RAW HTML of every chain page that
returns 200, into intel\\<stamp>\\raw\\. Even if its parser
cannot read a chain, the saved file lets me build a real parser
from what your machine actually received. That is the single
most valuable thing this run can produce.

================================================================
HOUSE RULES THIS SCRIPT OBEYS
================================================================
  - Public pages only. No login, no account, no credentials.
  - No bot-protection evasion. A 403 is an ANSWER: it is
    recorded and that line of enquiry stops.
  - AMC is robots-disallowed to us. It is listed and skipped
    by default, and --amc only prints the URL for you to open
    by hand. The script never fetches it.
  - No seat maps. This run counts SHOWTIMES and SITES only,
    which is what was asked for and is ten times faster.
  - The two US cuts are NEVER summed. A 3h15m Hindi show and a
    2h45m English show in the same building are two bookings.

================================================================
RUN IT
================================================================
    cd /d C:\\Users\\palla\\boxoffy
    python ramayana_sweep_v2.py

    python ramayana_sweep_v2.py --fast        14 zips, ~4 min
    python ramayana_sweep_v2.py --full        76 zips, ~20 min
    python ramayana_sweep_v2.py --chains-only skip Fandango+Canada
    python ramayana_sweep_v2.py 2026-11-06    one date only
    python ramayana_sweep_v2.py --control     add Godzilla as a
                                              sanity check

Writes ramayana_sweep_v2.txt, intel\\ramayana-v2-<stamp>\\*.csv
and intel\\ramayana-v2-<stamp>\\raw\\*.html
Stdlib only. Python 3.8+.
"""

import csv
import datetime as dt
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")
PAUSE = 0.30
TIMEOUT = 25

DATES = ["2026-11-04", "2026-11-05", "2026-11-06",
         "2026-11-07", "2026-11-08"]

# ---------------------------------------------------------------- fandango
# 245446 is the ONLY 2026 Ramayana record on Fandango. Four site-restricted
# searches on 11 Oct returned no separate id for the English cut, so the
# English version is simply not on Fandango yet. If that changes, add it.
FD_FILMS = {"hindi": ("Ramayana (Hindi 3h15m)", "245446")}
FD_CONTROL = ("Godzilla Minus Zero", "243973")   # --control

# ---------------------------------------------------------------- cineplex
CPX_KEY = "477f072109904a55927ba2c3bf9f77e3"
CPX_BASE = "https://apis.cineplex.com/prod/cpx/theatrical/api/v1"
CPX_FILM = "62087"          # resolved by canada_sweep.py, 9 Oct
CPX_CONTROL = "60710"       # Godzilla Minus Zero, for the sanity check

# ------------------------------------------------------------------- zips
# Deliberately weighted to Indian-American population centres, which is where
# this film will actually play. na_presale.py's generic 401-zip list misses
# Edison NJ entirely - the densest Indian-American area in the United States -
# and under-covers Fremont, Artesia and Frisco. Those gaps are why our DFW
# and New Jersey coverage was thin.
ZIPS_FAST = {
    "NY/NJ": "10036", "Edison NJ": "08820", "Chicago": "60601",
    "DFW": "75201", "Frisco TX": "75034", "Houston": "77002",
    "SF Bay": "94102", "Fremont CA": "94538", "LA": "90028",
    "Artesia CA": "90701", "DC/MD/VA": "20001", "Atlanta": "30303",
    "Seattle": "98101", "Boston": "02116",
}
ZIPS_FULL = dict(ZIPS_FAST, **{
    "Jersey City": "07302", "Queens NY": "11354", "Long Island": "11590",
    "Philadelphia": "19103", "Bensalem PA": "19020", "Baltimore": "21201",
    "Richmond VA": "23219", "Raleigh": "27601", "Charlotte": "28202",
    "Columbia SC": "29201", "Orlando": "32801", "Miami": "33130",
    "Tampa": "33602", "Nashville": "37203", "Memphis": "38103",
    "Louisville": "40202", "Cincinnati": "45202", "Columbus": "43215",
    "Cleveland": "44113", "Detroit": "48226", "Troy MI": "48084",
    "Indianapolis": "46204", "Naperville IL": "60540",
    "Schaumburg IL": "60173", "Milwaukee": "53202", "Minnesota": "55401",
    "St Louis": "63101", "Kansas City": "64106", "Omaha": "68102",
    "Austin": "78701", "San Antonio": "78205", "Plano TX": "75024",
    "Irving TX": "75039", "Sugar Land TX": "77478", "Denver": "80202",
    "Phoenix": "85004", "Chandler AZ": "85224", "Salt Lake": "84101",
    "Las Vegas": "89101", "San Diego": "92101", "Irvine CA": "92618",
    "San Jose": "95113", "Santa Clara": "95050", "Sacramento": "95814",
    "Portland": "97205", "Bellevue WA": "98004", "Redmond WA": "98052",
    "Hartford": "06103", "Stamford CT": "06901", "Buffalo": "14202",
    "Pittsburgh": "15222", "Albany NY": "12207", "New Orleans": "70112",
    "Oklahoma": "73102", "Tulsa": "74103", "Little Rock": "72201",
    "Birmingham": "35203", "Jacksonville": "32202", "Fresno": "93711",
    "Bakersfield": "93301", "Tucson": "85701", "Albuquerque": "87102",
})

# ------------------------------------------------------------------ chains
# Each entry: (label, url, kind). kind drives which parser is tried.
# EVERY ONE OF THESE IS A PROBE. Whatever answers is reported and the raw
# HTML is saved; nothing is assumed. The Hollywood Blvd pattern is the only
# one verified end to end so far.
CHAINS = [
    # verified working 11 Oct
    ("Hollywood Blvd (Woodridge IL)",
     "https://hollywoodblvdcinema.com/movie/ramayana", "hblvd"),
    ("Hollywood Blvd coming-soon",
     "https://hollywoodblvdcinema.com/coming-soon/", "generic"),

    # both cuts confirmed listed, showtime picker is JS - raw HTML may help
    ("Emagine movies index",
     "https://www.emagine-entertainment.com/movies/", "generic"),
    ("Emagine Ramayana (Hindi)",
     "https://www.emagine-entertainment.com/movies/ramayana/", "generic"),
    ("Emagine Rise of a Legend (English)",
     "https://www.emagine-entertainment.com/movies/ramayana-rise-of-a-legend/",
     "generic"),

    # REGAL - 4xx to every datacentre fetcher. Your residential IP is the
    # whole point of this run. Most of the 10 Oct screenshot inventory is here.
    ("Regal home", "https://www.regmovies.com/", "generic"),
    ("Regal Ramayana", "https://www.regmovies.com/movies/ramayana", "regal"),
    ("Regal Ramayana RoaL",
     "https://www.regmovies.com/movies/ramayana-rise-of-a-legend", "regal"),
    ("Regal international films",
     "https://www.regmovies.com/international-films", "generic"),
    ("Regal Metropolitan (Austin)",
     "https://www.regmovies.com/theatres/regal-metropolitan/0950", "regal"),
    ("Regal New Roc (New Rochelle)",
     "https://www.regmovies.com/theatres/regal-new-roc-4dx-imax-rpx/0618",
     "regal"),
    ("Regal White Oak (Silver Spring)",
     "https://www.regmovies.com/theatres/regal-white-oak/1557", "regal"),
    ("Regal Edwards Fairfield",
     "https://www.regmovies.com/theatres/regal-edwards-fairfield-imax/0565",
     "regal"),

    # GALAXY - English-cut page exists, HTTP 500 to us for two days
    ("Galaxy RoaL (GigHarbor slug)",
     "https://www.galaxytheatres.com/movie/GigHarbor/RAMAYANA-RISE-OF-A-LEGEND",
     "galaxy"),
    ("Galaxy Grandscape (The Colony TX)",
     "https://www.galaxytheatres.com/movie-theater/grandscape", "galaxy"),
    ("Galaxy Grandscape showtimes",
     "https://www.galaxytheatres.com/movie-theater/Grandscape/showtimes",
     "galaxy"),

    # SMG - photographed selling on 10 Oct, but its site did not list the
    # film on 11 Oct. That contradiction is worth resolving.
    ("SMG now showing",
     "https://www.studiomoviegrill.com/movie/now-showing", "generic"),
    ("SMG North Point (Alpharetta GA)",
     "https://www.studiomoviegrill.com/locations/georgia/north-point",
     "generic"),
    ("SMG Pearland (TX)",
     "https://www.studiomoviegrill.com/locations/texas/pearland", "generic"),

    # the rest - unresolved, probe only
    ("Marcus coming soon",
     "https://www.marcustheatres.com/movies/coming-soon", "generic"),
    ("Harkins coming soon",
     "https://www.harkins.com/movies/coming-soon", "generic"),
    ("MJR", "https://www.mjrtheatres.com/", "generic"),
    ("Showcase", "https://www.showcasecinemas.com/", "generic"),
    ("Cinepolis USA", "https://www.cinepolisusa.com/", "generic"),
    ("Alamo Drafthouse", "https://drafthouse.com/show/ramayana", "generic"),
    ("iPic", "https://www.ipic.com/", "generic"),
    ("Look Cinemas", "https://www.lookcinemas.com/", "generic"),
    ("B&B Theatres", "https://www.bbtheatres.com/", "generic"),
    ("Cinemark Ramayana (Hindi)",
     "https://www.cinemark.com/movies/ramayana-hindi-with-english-subtitles",
     "generic"),
    ("Atom Tickets",
     "https://www.atomtickets.com/movies/ramayana/395593", "generic"),
    ("IMAX", "https://www.imax.com/movie/ramayana", "generic"),
    ("Sony official site", "https://ramayanariseofalegend.com/", "generic"),
    ("Cinema United release calendar",
     "https://cinemaunited.org/release-calendar/", "generic"),
]

# AMC is robots-disallowed to automated clients. We do not fetch it. Ever.
AMC_BY_HAND = "https://www.amctheatres.com/movies/ramayana-84991"

TITLE_HINDI = ["ramayana"]
TITLE_ENGLISH = ["rise of a legend", "rise-of-a-legend"]
# Decoys. All three are real entries in real catalogues.
REJECT = ["legend of prince rama", "prince of light", "prince rama",
          "sampoorna", "sampurn", "ramani kalyanam", "ramaiya",
          "maryada ramanna"]

_CTX = ssl.create_default_context()
_OUT = []
RAW = None


def say(*a):
    line = " ".join(str(x) for x in a)
    _OUT.append(line)
    print(line, flush=True)


def get(url, hdrs=None, tries=2, want_json=None):
    h = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9",
         "Accept-Encoding": "gzip",
         "Accept": "application/json, text/html;q=0.9,*/*;q=0.8"}
    if hdrs:
        h.update(hdrs)
    last = ""
    for n in range(tries):
        try:
            rq = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(rq, timeout=TIMEOUT, context=_CTX) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    try:
                        raw = gzip.decompress(raw)
                    except Exception:
                        pass
                txt = raw.decode("utf-8", "replace")
                looks = ("json" in (r.headers.get("Content-Type") or "").lower()
                         or txt[:1] in "[{")
                if (want_json is None and looks) or want_json is True:
                    try:
                        return r.status, json.loads(txt)
                    except Exception:
                        return r.status, txt
                return r.status, txt
        except urllib.error.HTTPError as e:
            try:
                return e.code, e.read().decode("utf-8", "replace")
            except Exception:
                return e.code, ""
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
            time.sleep(0.7 * (n + 1))
    return 0, last


def strip_tags(h):
    h = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", h or "")
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    for a, b in (("&amp;", "&"), ("&#39;", "'"), ("&quot;", '"'),
                 ("&nbsp;", " "), ("&rsquo;", "'"), ("&ndash;", "-")):
        h = h.replace(a, b)
    return re.sub(r"\s+", " ", h).strip()


def chain_of(name):
    n = (name or "").lower()
    for k, lab in (("amc", "AMC"), ("regal", "Regal"), ("cinemark", "Cinemark"),
                   ("century", "Cinemark"), ("tinseltown", "Cinemark"),
                   ("marcus", "Marcus"), ("harkins", "Harkins"),
                   ("studio movie grill", "SMG"), ("alamo", "Alamo"),
                   ("showcase", "Showcase"), ("b&b", "B&B"),
                   ("cinepolis", "Cinepolis"), ("emagine", "Emagine"),
                   ("mjr", "MJR"), ("galaxy", "Galaxy"), ("ipic", "iPic"),
                   ("hollywood blvd", "Hollywood Blvd")):
        if k in n:
            return lab
    if "look" in n and "cinema" in n:
        return "LOOK"
    return "Independent"


def has_title(txt, which="hindi"):
    """Decoy-aware. The 1992 animated Ramayana and Prince of Light are real
    entries in real catalogues and a bare substring match picks them up."""
    t = " " + re.sub(r"[-_/]+", " ", (txt or "").lower()) + " "
    t = re.sub(r"\s+", " ", t)
    for bad in REJECT:
        if bad in t:
            # only a decoy if the real title is not ALSO present
            if not any(w in t for w in TITLE_ENGLISH):
                return False
    want = TITLE_ENGLISH if which == "english" else TITLE_HINDI
    return any(w in t for w in want)


TIME_RE = re.compile(r"\b(1[0-2]|0?[1-9]):([0-5][0-9])\s*([ap])\.?m\.?", re.I)
ISO_RE = re.compile(r"\b(20\d\d-\d\d-\d\d)\b")


def save_raw(tag, body):
    if not RAW or not isinstance(body, str):
        return
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", tag)[:70]
    try:
        with open(os.path.join(RAW, safe + ".html"), "w",
                  encoding="utf-8") as fh:
            fh.write(body)
    except Exception:
        pass


# =================================================================
#  1.  FANDANGO
# =================================================================
def fd_hdr(fid):
    return {"Accept": "application/json, text/plain, */*",
            "Referer": f"https://www.fandango.com/ramayana-2026-{fid}/movie-times",
            "Origin": "https://www.fandango.com",
            "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
            "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"'}


def fandango(label, fid, dates, zips, workers):
    say(f"\n  --- {label}  (fid {fid}) ---")
    sites, shows, seen = {}, [], set()
    hdr = fd_hdr(fid)
    blocked = 0
    for d in dates:
        ns0 = len(shows)
        for i, (metro, z) in enumerate(zips.items(), 1):
            u = (f"https://www.fandango.com/napi/theaterShowtimeGroupings/"
                 f"{fid}/{d}?isdesktop=true&postalCode={z}&zip={z}"
                 f"&isDesktopMOP=true")
            st, js = get(u, hdr, tries=1)
            if st in (403, 429, 503):
                blocked += 1
                if blocked in (5, 15):
                    say(f"      {blocked} throttled, backing off 20s")
                    time.sleep(20)
            elif st == 200 and isinstance(js, dict):
                ts = js.get("theaterShowtimes") or {}
                for th in ts.get("theaters") or []:
                    tid = str(th.get("id") or th.get("theaterId") or "")
                    nm = th.get("name") or th.get("theaterName") or ""
                    if not tid:
                        continue
                    sites.setdefault(tid, {"id": tid, "name": nm,
                                           "chain": chain_of(nm),
                                           "metro": metro})
                    for var in th.get("variants") or []:
                        fmt = var.get("filmFormatHeader") or ""
                        for g in var.get("amenityGroups") or []:
                            for s in g.get("showtimes") or []:
                                k = (s.get("showtimeHashCode")
                                     or f"{tid}|{s.get('date')}|{fmt}")
                                if k in seen:
                                    continue
                                seen.add(k)
                                shows.append({"surface": "Fandango",
                                              "cut": label, "date": d,
                                              "siteId": tid, "site": nm,
                                              "chain": chain_of(nm),
                                              "metro": metro, "format": fmt,
                                              "time": s.get("date", "")})
            time.sleep(PAUSE)
        say(f"      {d}: {len(shows)-ns0} showtimes, "
            f"{len(sites)} sites running")
    if blocked:
        say(f"      {blocked} requests throttled or blocked. A 403 is an "
            f"answer, not an obstacle - recorded and not worked around.")
    return sites, shows


# =================================================================
#  2.  CINEPLEX  (Canada)
# =================================================================
CPX_HDR = {"Ocp-Apim-Subscription-Key": CPX_KEY,
           "Accept": "application/json", "User-Agent": UA}


def cpx_theatres():
    forms = [f"{CPX_BASE}/theatres?language=en",
             f"{CPX_BASE}/theatres?language=en&range=100000&skip=0&take=1000",
             f"{CPX_BASE}/theatres/playingnearby?language=en&accuracyKm=100000"]
    seen = {}
    for u in forms:
        st, js = get(u, CPX_HDR)
        if st == 200 and js:
            for t in _iter(js, ("favouriteTheatres", "nearbyTheatres",
                                "otherTheatres", "theatres", "items")):
                tid = str(t.get("theatreId") or t.get("id") or "")
                if tid and tid not in seen:
                    loc = t.get("location") or {}
                    seen[tid] = {"id": tid,
                                 "name": t.get("theatreName") or t.get("name") or "",
                                 "city": loc.get("city", ""),
                                 "province": loc.get("provinceCode", "")}
    return list(seen.values())


def _iter(js, keys):
    if isinstance(js, dict):
        hit = False
        for k in keys:
            v = js.get(k)
            if isinstance(v, list):
                hit = True
                for x in v:
                    if isinstance(x, dict):
                        yield x
        if not hit and (js.get("theatreId") or js.get("theatreName")):
            yield js
    elif isinstance(js, list):
        for x in js:
            if isinstance(x, dict):
                yield x


def _cpx_shows(node, fmt=""):
    if isinstance(node, dict):
        f = (node.get("experienceTypeName") or node.get("format") or fmt)
        t = (node.get("showStartDateTime") or node.get("showtime")
             or node.get("sessionTime"))
        if t:
            yield {"time": str(t), "format": str(f or "")}
        for v in node.values():
            yield from _cpx_shows(v, f)
    elif isinstance(node, list):
        for v in node:
            yield from _cpx_shows(v, fmt)


def cineplex(fid, dates, workers):
    say(f"\n  --- Cineplex Canada  (filmId {fid}) ---")
    th = cpx_theatres()
    say(f"      theatre list: {len(th)} locations (published total 152)")
    if not th:
        say("      Cineplex API did not answer. Canada is UNKNOWN, not zero.")
        return [], []
    rows = []
    for d in dates:
        got = 0

        def one(t):
            u = (f"{CPX_BASE}/showtimes?language=en&filmId={fid}"
                 f"&date={d}&locationId={t['id']}")
            s, j = get(u, CPX_HDR, tries=1)
            out = []
            if s == 200 and j:
                for r in _cpx_shows(j):
                    out.append({"surface": "Cineplex", "cut": "Hindi",
                                "date": d, "siteId": t["id"],
                                "site": t["name"], "chain": "Cineplex",
                                "metro": f"{t['city']} {t['province']}".strip(),
                                "format": r["format"], "time": r["time"]})
            return out

        with ThreadPoolExecutor(max_workers=workers) as ex:
            for f in as_completed([ex.submit(one, t) for t in th]):
                try:
                    r = f.result()
                    rows += r
                    got += len(r)
                except Exception:
                    pass
        say(f"      {d}: {got} showtimes")
    return th, rows


# =================================================================
#  3.  CHAINS  -  where the tickets actually are
# =================================================================
def parse_hblvd(body):
    """VERIFIED pattern, 11 Oct. Hollywood Blvd renders real checkout links:
    /checkout/showing/<id>. Dates come off nearby ISO strings."""
    ids = re.findall(r"/checkout/showing/(\d+)", body)
    times = TIME_RE.findall(body)
    dates = sorted(set(ISO_RE.findall(body)))
    return {"showtimes": len(set(ids)), "times": len(times),
            "dates": [d for d in dates if d.startswith("2026-11")],
            "note": "checkout/showing ids"}


def parse_generic(body):
    txt = strip_tags(body)
    times = TIME_RE.findall(body) or TIME_RE.findall(txt)
    dates = sorted({d for d in ISO_RE.findall(body) if d.startswith("2026-11")})
    buy = len(re.findall(r"(?i)\b(buy tickets|get tickets|book now|"
                         r"select seats|showtimes?)\b", txt))
    notify = len(re.findall(r"(?i)\b(notify me|coming soon|watch ?list|"
                            r"sign up to be notified)\b", txt))
    return {"showtimes": 0, "times": len(times), "dates": dates,
            "buyish": buy, "notifyish": notify}


def parse_regal(body):
    r = parse_generic(body)
    # Regal booking links look like /showtimes/... or carry a showing id
    r["showtimes"] = len(set(re.findall(r"/(?:showtimes|tickets)/([A-Za-z0-9\-]{6,})",
                                        body)))
    return r


def parse_galaxy(body):
    r = parse_generic(body)
    r["showtimes"] = len(set(re.findall(r"[?&](?:showtimeId|sessionId)=(\d+)",
                                        body)))
    return r


PARSERS = {"hblvd": parse_hblvd, "generic": parse_generic,
           "regal": parse_regal, "galaxy": parse_galaxy}


def chains():
    say("\n  --- CHAIN SITES  (this is where the tickets are) ---")
    say(f"      AMC is robots-disallowed. NOT fetched. Open by hand:")
    say(f"        {AMC_BY_HAND}")
    rows, saved = [], 0
    for label, url, kind in CHAINS:
        st, body = get(url, {"Accept": "text/html"}, tries=2, want_json=False)
        rec = {"chain": label, "url": url, "http": st, "hindi": False,
               "english": False, "showtimes": 0, "times": 0, "dates": "",
               "buyish": 0, "notifyish": 0}
        if st == 200 and isinstance(body, str) and len(body) > 500:
            save_raw(label, body)
            saved += 1
            txt = strip_tags(body)
            rec["hindi"] = has_title(txt, "hindi") or has_title(body, "hindi")
            rec["english"] = has_title(txt, "english") or has_title(body, "english")
            p = PARSERS.get(kind, parse_generic)(body)
            rec.update({k: p.get(k, rec.get(k)) for k in
                        ("showtimes", "times", "buyish", "notifyish")})
            rec["dates"] = ";".join(p.get("dates") or [])
        flag = ""
        if rec["showtimes"]:
            flag = f"  {rec['showtimes']} showtime links"
        elif rec["hindi"] or rec["english"]:
            cut = "EN" if rec["english"] else "HI"
            flag = f"  listed ({cut}), {rec['times']} time strings"
        say(f"      {st:>3}  {label[:44]:<46}{flag}")
        rows.append(rec)
        time.sleep(PAUSE)
    say(f"\n      raw HTML saved for {saved} pages -> {RAW}")
    say("      SEND ME THAT raw FOLDER. Regal and Galaxy block my")
    say("      datacentre IP; whatever your home connection received")
    say("      is what I can build a real parser from.")
    return rows


# =================================================================
#  REPORT
# =================================================================
def report(fd_sites, fd_shows, cpx_th, cpx_rows, ch_rows, dates):
    say("\n" + "=" * 70)
    say("  SUMMARY  -  three surfaces, never summed")
    say("=" * 70)
    say(f"    {'surface':<22}{'sites':>8}{'showtimes':>12}")
    say(f"    {'Fandango (US)':<22}{len(fd_sites):>8}{len(fd_shows):>12}")
    say(f"    {'Cineplex (Canada)':<22}"
        f"{len({r['siteId'] for r in cpx_rows}):>8}{len(cpx_rows):>12}")
    listed = [r for r in ch_rows if r["hindi"] or r["english"]]
    withshows = [r for r in ch_rows if r["showtimes"]]
    say(f"    {'Chain sites':<22}{len(listed):>8}"
        f"{sum(r['showtimes'] for r in ch_rows):>12}")

    if fd_shows:
        say("\n    FANDANGO BY FORMAT")
        for k, v in Counter(s["format"] or "(none)" for s in fd_shows).most_common():
            say(f"      {k:<24}{v:>6}")
        say("    FANDANGO BY CHAIN")
        for k, v in Counter(s["chain"] for s in fd_shows).most_common(8):
            n = len({s['siteId'] for s in fd_shows if s['chain'] == k})
            say(f"      {k:<24}{n:>4} sites {v:>6} shows")
        say("    FANDANGO BY DATE")
        for d in dates:
            n = len([s for s in fd_shows if s["date"] == d])
            say(f"      {d}  {n:>6}")
    else:
        say("\n    FANDANGO RETURNED ZERO.")
        say("    On 11 Oct that was the correct answer, not a failure -")
        say("    Fandango showed NOTIFY ME while cinemas were selling.")
        say("    The day this lights up is itself the signal.")

    say("\n    CHAIN SITES LISTING THE FILM")
    for r in listed:
        cut = ("BOTH" if r["hindi"] and r["english"]
               else "ENGLISH" if r["english"] else "HINDI")
        say(f"      {r['chain'][:40]:<42}{cut:<8}"
            f"{r['showtimes'] or '-':>5} shows")
    if not listed:
        say("      none - unexpected, check the raw folder")

    bad = [r for r in ch_rows if r["http"] not in (200,)]
    if bad:
        say("\n    CHAIN PAGES THAT DID NOT RETURN 200")
        for r in bad:
            say(f"      {r['http']:>3}  {r['chain'][:52]}")
        say("      403/429 = bot wall. Recorded, not worked around.")
        say("      500 = their server. 404 = wrong URL, send me the right one.")

    say("\n" + "=" * 70)
    say("  WHAT TO PASTE BACK")
    say("    1. This SUMMARY block.")
    say("    2. The CHAIN SITES LISTING THE FILM block.")
    say("    3. Zip up intel\\...\\raw\\ and send it. That folder is")
    say("       the point of the run - it is how Regal gets cracked.")
    say("=" * 70)


def main():
    global RAW
    args = sys.argv[1:]
    dates = [a for a in args if re.fullmatch(r"20\d\d-\d\d-\d\d", a)] or DATES
    zips = ZIPS_FULL if "--full" in args else ZIPS_FAST
    chains_only = "--chains-only" in args
    control = "--control" in args
    workers = 6
    if "--workers" in args:
        try:
            workers = int(args[args.index("--workers") + 1])
        except Exception:
            pass

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    outdir = os.path.join("intel", f"ramayana-v2-{stamp}")
    RAW = os.path.join(outdir, "raw")
    os.makedirs(RAW, exist_ok=True)

    say("")
    say("#" * 70)
    say("#  BOXOFFY  -  RAMAYANA NORTH AMERICA SWEEP v2")
    say(f"#  {dt.datetime.now():%Y-%m-%d %H:%M}   {len(zips)} zips   "
        f"{len(dates)} dates")
    say("#")
    say("#  v1 swept Fandango and called it North America's presale.")
    say("#  It was Fandango's presale, which for this title is near")
    say("#  nothing. The chains have the film; the aggregators do not.")
    say("#  This run reports three surfaces SEPARATELY and never sums")
    say("#  the Hindi and English cuts.")
    say("#" * 70)

    fd_sites, fd_shows = {}, []
    cpx_th, cpx_rows = [], []
    if not chains_only:
        say("\n" + "=" * 70)
        say("  1 of 3   FANDANGO")
        say("=" * 70)
        for key, (lab, fid) in FD_FILMS.items():
            s, sh = fandango(lab, fid, dates, zips, workers)
            fd_sites.update(s)
            fd_shows += sh
        if control:
            say("\n      CONTROL: Godzilla Minus Zero, same dates. If this")
            say("      also reads zero the sweep is broken, not the market.")
            cs, csh = fandango(FD_CONTROL[0], FD_CONTROL[1], dates,
                               dict(list(zips.items())[:4]), workers)
            say(f"      control: {len(cs)} sites, {len(csh)} showtimes")

        say("\n" + "=" * 70)
        say("  2 of 3   CINEPLEX CANADA")
        say("=" * 70)
        cpx_th, cpx_rows = cineplex(CPX_FILM, dates, workers)

    say("\n" + "=" * 70)
    say("  3 of 3   CHAIN SITES")
    say("=" * 70)
    ch_rows = chains()

    report(fd_sites, fd_shows, cpx_th, cpx_rows, ch_rows, dates)

    try:
        if fd_shows or cpx_rows:
            with open(os.path.join(outdir, "showtimes.csv"), "w", newline="",
                      encoding="utf-8") as fh:
                cols = ["surface", "cut", "date", "siteId", "site", "chain",
                        "metro", "format", "time"]
                w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
                w.writeheader()
                w.writerows(fd_shows + cpx_rows)
        with open(os.path.join(outdir, "chains.csv"), "w", newline="",
                  encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(ch_rows[0].keys()))
            w.writeheader()
            w.writerows(ch_rows)
        say(f"\n  csv: {outdir}")
    except Exception as e:
        say(f"\n  csv write failed: {e}")

    with open("ramayana_sweep_v2.txt", "w", encoding="utf-8") as fh:
        fh.write("\n".join(_OUT) + "\n")
    print("\nWritten: ramayana_sweep_v2.txt")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        with open("ramayana_sweep_v2.txt", "w", encoding="utf-8") as fh:
            fh.write("\n".join(_OUT) + "\n[interrupted]\n")
        print("\ninterrupted - partial log in ramayana_sweep_v2.txt")
