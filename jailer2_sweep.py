#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Boxoffy - JAILER 2, NORTH AMERICA FULL SWEEP.  Standalone, one file.
Built 12 October 2026.  Release Thursday 15 October 2026.  T-3.

================================================================
WHAT THIS IS
================================================================
Fandango + seat maps + Cineplex + the Canadian Indian-only
independents + US chain probes, in one run, for a TAMIL film.

We already have a baseline: a read taken 3 October at 23:22
(T-12) found 101 sites, 272 showtimes, 26,805 seats and 635
tickets sold at 2.4%. This run is the T-3 follow-up, and
because there is an earlier read on disk the script will
compute VELOCITY - tickets per hour since the last read -
which is the number that actually forecasts an opening.

================================================================
WHY A TAMIL FILM NEEDS A DIFFERENT SWEEP
================================================================
This is the whole point of building a separate script.

CANADA. Cineplex carries Hindi and Punjabi. It does NOT
reliably carry Tamil. The 3 Oct read confirmed it: "Canada
skipped: no cineplex filmId for this listing." For Drishyam
that was a footnote. For a Rajinikanth film it is a hole in
the middle of the map, because Canadian Tamil audiences are
large and they are served by four Indian-only independents in
the GTA - Albion, Woodside, York, Central Parkway - plus Cine
Starz. None of those has an API. All of them are readable
through CinemaClock, which is the only Canadian source that
labels film language.

So if we sweep Canada the way we swept it for Drishyam, we
will report zero and be wrong. This script reads the
independents directly.

US. The 3 Oct read showed Cinemark at 76 of 101 sites - this
film lives on Cinemark, not AMC or Regal, which had 2 and 3
sites between them. That is the opposite of a Hindi tentpole
and it means Cinemark's own site is the one that matters if
Fandango goes dark the way it did on Ramayana.

================================================================
WHAT IT REPORTS
================================================================
  sites · showtimes · seats on sale · TICKETS SOLD · sell-through
  sold-out shows · seat maps read as a % of showtimes
  by format · by chain · by metro · by time of day
  velocity vs the last read on disk
  observed presale gross at a stated ATP
  Canada, separately, never merged into the US number

================================================================
HOUSE RULES
================================================================
  - Public pages only. No login, no credentials.
  - No bot-protection evasion. A 403 is an ANSWER.
  - AMC is robots-disallowed. Listed, never fetched.
  - Never books, never holds a seat, never posts.
  - Blank seat maps are BLANK, not zero. They are counted as
    unread and the sell-through is computed only over seats we
    actually read.
  - Canada is never summed into the US figure.

================================================================
RUN IT
================================================================
    cd /d C:\\Users\\palla\\boxoffy
    python jailer2_sweep.py

    python jailer2_sweep.py --fast          14 zips, ~6 min
    python jailer2_sweep.py --no-seats      footprint only, fast
    python jailer2_sweep.py 2026-10-15      day one only
    python jailer2_sweep.py --workers 10
    python jailer2_sweep.py --resume        retry failed seat maps

Writes jailer2_sweep.txt and intel\\jailer2-v2-<stamp>\\
Stdlib only. Python 3.8+.
"""

import csv
import datetime as dt
import glob
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
TIMEOUT = 25

FILM = "Jailer 2"
FID = "247862"                 # Fandango, verified in india_na_slate.json

# ⚠️ 14 OCTOBER IS THE PREMIERE DATE AND IT USED TO BE MISSING FROM THIS LIST.
# The 3 Oct run swept 15-18 Oct only. That is why our 635 tickets and
# VenkyBO's 25,465 were never comparable: he was counting PREMIERE NIGHT
# (Wed 14 Oct) and we were counting the regular Thursday-onward dates.
# US premieres Wed 14 Oct; India and US wide Thu 15 Oct.
# Never drop 2026-10-14 from this list. Every published Jailer 2 presale
# figure in the trade - Venky, TrackTollywood, Sacnilk, ETV - is the
# premiere bucket. A sweep that skips it is not reading the same film.
PREMIERE_DATE = "2026-10-14"
DATES = [PREMIERE_DATE, "2026-10-15", "2026-10-16", "2026-10-17",
         "2026-10-18"]

# ATP. Tamil releases in the US price ABOVE a standard Hollywood ticket but
# below a Hindi tentpole in the big metros. These are the slate's numbers and
# they are an ASSUMPTION - the report says so every time it prints a dollar.
ATP = {"Standard": 16.50, "3D": 18.00, "Premium Format": 21.00, "IMAX": 23.00}

# PREMIERE ATP is a different animal and is NOT an assumption of ours - it is
# BACKED OUT of a published figure. VenkyBO, 10 Oct: $704,382 across 25,465
# tickets = $27.66 per ticket, 1.68x our regular-date Standard assumption.
# Premiere shows are special-event priced and Tamil premieres in the US are
# routinely $25-35. Apply this tier to 14 Oct ONLY.
PREMIERE_ATP_OBSERVED = 27.66
PREMIERE_ATP = {"Standard": 27.66, "3D": 29.00, "Premium Format": 32.00,
                "IMAX": 35.00}

# The published series we are measuring ourselves against. All VenkyBO
# (@Venky_BO), USA ONLY, PREMIERE SHOWS ONLY. Single-sourced: Sacnilk,
# TrackTollywood and ETV are all downstream of him, so three outlets
# agreeing is still one source. Label it every time.
VENKY_SERIES = [
    # date,        gross,    locations, shows, tickets
    ("2026-10-04",   45805,   54,   None,  None),
    ("2026-10-07",  469981,  375,   791, 16721),
    ("2026-10-10",  704382,  412,   961, 25465),
]

# Jailer (2023) at the same stage, same source, same basis. This is the only
# honest benchmark we have; Box Office Mojo has NO domestic data for Jailer
# (2023) at all, so do not cite Mojo for it.
JAILER1 = {
    "t2_gross": 663817, "t2_loc": 285, "t2_shows": 690, "t2_tix": 30201,
    "final_gross": 802628, "final_loc": 340, "final_shows": 815,
    "final_tix": 37116, "premiere_night": 948000,
    "na_lifetime_low": 6.8e6, "na_lifetime_high": 7.0e6,
}

CPX_KEY = "477f072109904a55927ba2c3bf9f77e3"
CPX_BASE = "https://apis.cineplex.com/prod/cpx/theatrical/api/v1"

# ---------------------------------------------------------------- zips
# Weighted to TAMIL population centres, which are not the same as the Hindi
# ones. The 3 Oct read's hottest metros were SF Bay 4.6%, Hartford/CT 8.9%,
# NY/NJ 5.1%, Austin 4.0% - a South Indian tech-corridor pattern. Edison NJ,
# Fremont, Santa Clara, Plano and Cary NC matter far more here than Delhi-
# diaspora zips do.
ZIPS_FAST = {
    "SF Bay": "94102", "Fremont CA": "94538", "San Jose": "95113",
    "Santa Clara": "95050", "DFW": "75201", "Plano TX": "75024",
    "Austin": "78701", "NY/NJ": "10036", "Edison NJ": "08820",
    "Chicago": "60601", "Seattle": "98101", "Bellevue WA": "98004",
    "Raleigh/Cary": "27511", "Hartford CT": "06103",
}
ZIPS_FULL = dict(ZIPS_FAST, **{
    "Houston": "77002", "Sugar Land TX": "77478", "Irving TX": "75039",
    "Atlanta": "30303", "Alpharetta GA": "30009", "DC/MD/VA": "20001",
    "Ashburn VA": "20147", "Baltimore": "21201", "Boston": "02116",
    "Nashua NH": "03060", "Philadelphia": "19103", "Detroit": "48226",
    "Troy MI": "48084", "Columbus": "43215", "Indianapolis": "46204",
    "Minnesota": "55401", "St Louis": "63101", "Kansas City": "64106",
    "Denver": "80202", "Phoenix": "85004", "Chandler AZ": "85224",
    "Las Vegas": "89101", "San Diego": "92101", "Irvine CA": "92618",
    "LA": "90028", "Artesia CA": "90701", "Sacramento": "95814",
    "Fresno": "93711", "Portland": "97205", "Salt Lake": "84101",
    "Charlotte": "28202", "Orlando": "32801", "Tampa": "33602",
    "Miami": "33130", "Jacksonville": "32202", "Pittsburgh": "15222",
    "Cleveland": "44113", "Milwaukee": "53202", "Omaha": "68102",
    "Oklahoma": "73102", "New Orleans": "70112", "Memphis": "38103",
    "Louisville": "40202", "Richmond VA": "23219", "Buffalo": "14202",
    "Albany NY": "12207", "Queens NY": "11354", "Long Island": "11590",
    "Stamford CT": "06901", "Tucson": "85701", "Albuquerque": "87102",
})

# ------------------------------------------- Canada, the Tamil-aware part
CC = "https://www.cinemaclock.com"
CC_INDIE = [
    ("Woodside Cinemas (Agincourt ON)", "woodside"),
    ("York Cinemas (Richmond Hill ON)", "york-cinemas"),
    ("Central Parkway (Mississauga ON)", "central-parkway-cinemas"),
    ("Albion Cinemas (Etobicoke ON)", "albion-cinemas"),
    ("Cineplex Scarborough", "cineplex-scarborough-town-centre"),
    ("Cineplex Strawberry Hill (Surrey BC)", "cineplex-strawberry-hill"),
]
CC_MARKETS = [("Toronto", "toronto-on"), ("Brampton", "brampton-on"),
              ("Mississauga", "mississauga-on"), ("Scarborough", "scarborough-on"),
              ("Surrey", "surrey-bc"), ("Vancouver", "vancouver-bc"),
              ("Calgary", "calgary-ab"), ("Edmonton", "edmonton-ab"),
              ("Ottawa", "ottawa-on"), ("Montreal", "montreal-qc")]
CINESTARZ = ["deluxewoodbine", "mississauga", "brossard", "lasalle"]

# ------------------------------------------------------------ US chains
US_CHAINS = [
    ("Cinemark Jailer 2", "https://www.cinemark.com/movies/jailer-2"),
    ("Cinemark Jailer 2 Tamil",
     "https://www.cinemark.com/movies/jailer-2-tamil-with-english-subtitles"),
    ("Regal Jailer 2", "https://www.regmovies.com/movies/jailer-2"),
    ("Marcus coming soon", "https://www.marcustheatres.com/movies/coming-soon"),
    ("Harkins coming soon", "https://www.harkins.com/movies/coming-soon"),
    ("Atom Tickets search", "https://www.atomtickets.com/search?q=jailer"),
    ("Emagine movies", "https://www.emagine-entertainment.com/movies/"),
    ("Galaxy Theatres", "https://www.galaxytheatres.com/"),
]
AMC_BY_HAND = "https://www.amctheatres.com/ (robots-disallowed, open by hand)"

TITLE = ["jailer 2", "jailer2", "jailer ii"]
# The 2023 original is the decoy here, and it still plays festivals/reissues.
REJECT = ["jailer (2023)", "jailer 2023"]

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
        except Exception:
            time.sleep(0.7 * (n + 1))
    return 0, ""


def strip_tags(h):
    h = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", h or "")
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    for a, b in (("&amp;", "&"), ("&#39;", "'"), ("&quot;", '"'),
                 ("&nbsp;", " ")):
        h = h.replace(a, b)
    return re.sub(r"\s+", " ", h).strip()


def chain_of(name):
    n = (name or "").lower()
    for k, lab in (("amc", "AMC"), ("regal", "Regal"), ("cinemark", "Cinemark"),
                   ("century", "Cinemark"), ("tinseltown", "Cinemark"),
                   ("cut! by", "Cinemark"), ("marcus", "Marcus"),
                   ("harkins", "Harkins"), ("studio movie grill", "SMG"),
                   ("alamo", "Alamo"), ("showcase", "Showcase"),
                   ("cinepolis", "Cinepolis"), ("emagine", "Emagine"),
                   ("mjr", "MJR"), ("galaxy", "Galaxy"), ("ipic", "iPic"),
                   ("b&b", "B&B")):
        if k in n:
            return lab
    if "look" in n and "cinema" in n:
        return "LOOK"
    return "Independent"


def has_title(txt):
    t = " " + re.sub(r"[-_/]+", " ", (txt or "").lower()) + " "
    t = re.sub(r"\s+", " ", t)
    for bad in REJECT:
        if bad in t and not any(w in t for w in ("jailer 2", "jailer2")):
            return False
    return any(w in t for w in TITLE)


def num(v):
    try:
        return int(float(v))
    except Exception:
        return 0


# =================================================================
#  1.  FANDANGO  footprint
# =================================================================
API_HDR = {"Accept": "application/json, text/plain, */*",
           "Referer": f"https://www.fandango.com/jailer-2-2026-{FID}/movie-times",
           "Origin": "https://www.fandango.com",
           "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
           "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"'}


def warm():
    st, _ = get("https://www.fandango.com/", {"Accept": "text/html"},
                want_json=False)
    say(f"  session warm-up HTTP {st}")


def footprint(date, zips, pause):
    sites, shows, seen = {}, [], set()
    blocked = 0
    for i, (metro, z) in enumerate(zips.items(), 1):
        u = (f"https://www.fandango.com/napi/theaterShowtimeGroupings/"
             f"{FID}/{date}?isdesktop=true&postalCode={z}&zip={z}"
             f"&isDesktopMOP=true")
        st, js = get(u, API_HDR, tries=1)
        if st in (403, 429, 503):
            blocked += 1
            if blocked in (5, 15, 30):
                say(f"      {blocked} throttled, backing off 20s")
                time.sleep(20)
        elif st == 200 and isinstance(js, dict):
            ts = js.get("theaterShowtimes") or {}
            for th in ts.get("theaters") or []:
                tid = str(th.get("id") or th.get("theaterId") or "")
                nm = th.get("name") or th.get("theaterName") or ""
                if not tid:
                    continue
                sites.setdefault(tid, {"theatreId": tid, "name": nm,
                                       "chain": chain_of(nm), "metro": metro})
                for var in th.get("variants") or []:
                    fmt = var.get("filmFormatHeader") or "Standard"
                    for g in var.get("amenityGroups") or []:
                        for s in g.get("showtimes") or []:
                            h = s.get("showtimeHashCode") or ""
                            key = h or f"{tid}|{s.get('date')}|{fmt}"
                            if key in seen:
                                continue
                            seen.add(key)
                            shows.append({
                                "date": date, "theatreId": tid, "theatre": nm,
                                "chain": chain_of(nm), "metro": metro,
                                "format": fmt, "time": s.get("date", ""),
                                "isSoldOut": s.get("isSoldOut", ""),
                                "hash": h, "seatsTotal": "", "seatsAvail": ""})
        if i % 20 == 0 or i == len(zips):
            say(f"      [{i:>3}/{len(zips)}] {len(sites)} sites, "
                f"{len(shows)} showtimes")
        time.sleep(pause)
    if blocked:
        say(f"      {blocked} throttled/blocked. Recorded, not worked around.")
    return sites, shows


# =================================================================
#  2.  SEAT MAPS  -  the ticket count
# =================================================================
SEAT_RX = [re.compile(r'"seatsTotal"\s*:\s*(\d+).{0,200}?"seatsAvailable"\s*:\s*(\d+)', re.S),
           re.compile(r'"totalSeats"\s*:\s*(\d+).{0,200}?"availableSeats"\s*:\s*(\d+)', re.S)]


def seatmap(h):
    u = f"https://www.fandango.com/napi/seatmap/{h}"
    st, js = get(u, API_HDR, tries=1)
    if st != 200:
        return None
    body = js if isinstance(js, str) else json.dumps(js)
    tot = av = None
    for rx in SEAT_RX:
        m = rx.search(body)
        if m:
            tot, av = int(m.group(1)), int(m.group(2))
            break
    if tot is None:
        seats = re.findall(r'"status"\s*:\s*"(\w+)"', body)
        if seats:
            tot = len(seats)
            av = len([s for s in seats if s.lower() in ("available", "open")])
    if tot is None:
        return None
    return tot, av


def read_seats(shows, workers, pause):
    uniq = {s["hash"]: s for s in shows if s.get("hash")}
    say(f"      {len(shows)} showtimes, {len(uniq)} unique seat maps to read")
    cache, failed = {}, 0

    def one(h):
        return h, seatmap(h)

    done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(one, h) for h in uniq]
        for f in as_completed(futs):
            try:
                h, r = f.result()
            except Exception:
                continue
            done += 1
            if r:
                cache[h] = r
            if done % 100 == 0:
                say(f"      {done}/{len(uniq)} read, {len(cache)} with seats")
            time.sleep(pause)
    failed = len(uniq) - len(cache)
    for s in shows:
        r = cache.get(s.get("hash"))
        if r:
            s["seatsTotal"], s["seatsAvail"] = r[0], r[1]
    if failed:
        say(f"      WARNING {failed} seat maps did not return. Those rows are")
        say(f"      BLANK, NOT ZERO, and are excluded from the sell-through.")
    return failed


# =================================================================
#  3.  CANADA  -  Tamil-aware, not Cineplex-only
# =================================================================
def canada():
    say("\n  --- CANADA ---")
    say("      Cineplex carries Hindi and Punjabi, NOT reliably Tamil.")
    say("      So Cineplex alone would report zero and be wrong. Reading")
    say("      the Indian-only independents through CinemaClock too.")
    rows = []

    hdr = {"Ocp-Apim-Subscription-Key": CPX_KEY, "Accept": "application/json"}
    st, js = get(f"{CPX_BASE}/movies?language=en", hdr)
    cpx_id = None
    if st == 200 and js:
        blob = json.dumps(js).lower()
        m = re.search(r'"filmid"\s*:\s*"?(\d+)"?[^}]{0,300}?jailer\s*2', blob)
        if not m:
            m = re.search(r'jailer\s*2[^}]{0,300}?"filmid"\s*:\s*"?(\d+)"?', blob)
        cpx_id = m.group(1) if m else None
    say(f"      Cineplex catalogue HTTP {st}   "
        f"Jailer 2 filmId: {cpx_id or 'NOT LISTED'}")
    if not cpx_id:
        say("      Not listed is the EXPECTED answer for a Tamil title and")
        say("      is a finding, not a failure. Do not report it as zero")
        say("      Canadian showtimes - report it as not carried.")

    for label, slug in CC_INDIE:
        hit = False
        for path in (f"/movie-theaters/{slug}", f"/theatres/{slug}"):
            s, body = get(CC + path, want_json=False)
            if s == 200 and isinstance(body, str):
                txt = strip_tags(body)
                if has_title(txt):
                    hit = True
                    i = txt.lower().find("jailer")
                    win = txt[max(0, i - 150): i + 400]
                    n = len(re.findall(r"\b\d{1,2}:\d{2}\s*[ap]\.?m", win, re.I))
                    rows.append({"venue": label, "shows": n, "src": "CinemaClock"})
                break
        say(f"      {'LISTED ' if hit else '       '}{label}")
    for label, slug in CC_MARKETS:
        s, body = get(CC + f"/{slug}/movies-now-playing", want_json=False)
        if s == 200 and isinstance(body, str) and has_title(strip_tags(body)):
            say(f"      LISTED  {label} (market page)")
    return cpx_id, rows


# =================================================================
#  4.  US CHAIN PROBES
# =================================================================
def us_chains():
    say("\n  --- US CHAIN PROBES ---")
    say(f"      AMC not fetched: {AMC_BY_HAND}")
    out = []
    for label, url in US_CHAINS:
        st, body = get(url, {"Accept": "text/html"}, tries=1, want_json=False)
        listed = (st == 200 and isinstance(body, str)
                  and has_title(strip_tags(body)))
        if st == 200 and isinstance(body, str) and RAW:
            try:
                with open(os.path.join(RAW, re.sub(r"\W+", "_", label)[:50]
                                       + ".html"), "w", encoding="utf-8") as fh:
                    fh.write(body)
            except Exception:
                pass
        say(f"      {st:>3}  {label:<34}{'  LISTED' if listed else ''}")
        out.append({"chain": label, "url": url, "http": st, "listed": listed})
        time.sleep(0.3)
    return out


# =================================================================
#  VELOCITY  -  compare against the last read on disk
# =================================================================
def baseline(date):
    cands = sorted(glob.glob(os.path.join("intel", f"jailer2*{date}*")))
    for d in reversed(cands):
        p = os.path.join(d, "fandango_shows.csv")
        if not os.path.exists(p):
            continue
        try:
            rows = list(csv.DictReader(open(p, encoding="utf-8")))
        except Exception:
            continue
        sold = sum(num(r.get("seatsTotal")) - num(r.get("seatsAvail"))
                   for r in rows if num(r.get("seatsTotal")))
        if sold:
            ts = os.path.getmtime(p)
            return {"folder": d, "sold": sold, "when": ts,
                    "shows": len(rows),
                    "sites": len({r.get("theatreId") for r in rows})}
    return None


def reconcile(sites, shows, sold, gross):
    """Measure our premiere-night read against VenkyBO's published series.

    The point is NOT to agree with him. The point is to know, in numbers,
    what share of the circuit our zip-list sampling actually sees - so that
    when we publish a figure of our own we can say 'this is 23% coverage'
    instead of pretending it is the market.
    """
    vd, vg, vloc, vsh, vtix = VENKY_SERIES[-1]
    say("\n" + "=" * 70)
    say("  RECONCILIATION vs VenkyBO (@Venky_BO), published " + vd)
    say("  USA ONLY. PREMIERE SHOWS ONLY. SINGLE-SOURCED.")
    say("=" * 70)
    rows = [("locations", len(sites), vloc),
            ("shows", len(shows), vsh),
            ("tickets", sold, vtix),
            ("gross $", int(gross), vg)]
    say(f"    {'':<12}{'ours':>12}{'Venky':>12}{'cover':>9}")
    for lab, ours, theirs in rows:
        if not theirs:
            continue
        say(f"    {lab:<12}{ours:>12,}{theirs:>12,}"
            f"{ours/theirs*100:>8.1f}%")
    if vtix and sold:
        say(f"\n    our implied ATP   ${gross/max(sold,1):.2f}")
        say(f"    his implied ATP   ${vg/vtix:.2f}")
    say("")
    say("    READ THE COVERAGE COLUMN BEFORE PUBLISHING ANYTHING. We sweep")
    say("    a zip list, not the country. A low percentage is a statement")
    say("    about our sampling, NOT a claim that his number is wrong.")
    say("    Where ours EXCEEDS his, that is the interesting case: it means")
    say("    we are seeing showtimes his read does not include.")

    # His own velocity, from his own series. Useful because it is the only
    # multi-point series anyone has published for this film.
    say("\n    HIS SERIES (his numbers, his basis)")
    for i, (d, g, loc, sh, tix) in enumerate(VENKY_SERIES):
        extra = ""
        if i:
            pg, pd = VENKY_SERIES[i - 1][1], VENKY_SERIES[i - 1][0]
            days = (dt.date.fromisoformat(d)
                    - dt.date.fromisoformat(pd)).days or 1
            extra = f"   +${(g-pg)/days:,.0f}/day"
        shs = f"{sh:>4}" if sh else "   -"
        txs = f"{tix:>6,}" if tix else "     -"
        say(f"      {d}  ${g:>8,}  {loc or 0:>4} loc  "
            f"{shs} sh  {txs} tix{extra}")
    say("    Tickets +52% between 7 and 10 Oct against shows +21%. Shows")
    say("    are filling, not just being added. That is the strong signal")
    say("    in his series and it is independent of his ATP.")

    say("\n    JAILER (2023) AT THE SAME STAGE - same source, same basis")
    j = JAILER1
    say(f"      T-2 premiere advance  ${j['t2_gross']:,}  "
        f"{j['t2_loc']} loc  {j['t2_shows']} sh  {j['t2_tix']:,} tix")
    say(f"      final premiere adv    ${j['final_gross']:,}  "
        f"{j['final_loc']} loc  {j['final_shows']} sh  "
        f"{j['final_tix']:,} tix")
    say(f"      premiere night        ${j['premiere_night']:,}")
    say(f"      NA lifetime           ${j['na_lifetime_low']/1e6:.1f}-"
        f"{j['na_lifetime_high']/1e6:.1f}M  (Venky $6.84M, Sacnilk $7.25M,")
    say("                            The Numbers $4.09M - CONTESTED, and")
    say("                            Box Office Mojo has NO domestic data")
    say("                            for Jailer 2023. Never cite Mojo here.")
    say("")
    say("    ⚠️ THE HEAD-TO-HEAD - AND THE STAGES DO NOT MATCH:")
    d_g = (vg / j["t2_gross"] - 1) * 100
    d_t = (vtix / j["t2_tix"] - 1) * 100
    d_l = (vloc / j["t2_loc"] - 1) * 100
    say(f"      gross     {d_g:+.0f}%")
    say(f"      locations {d_l:+.0f}%")
    say(f"      TICKETS   {d_t:+.0f}%")
    say(f"      ATP       ${vg/vtix:.2f} vs ${j['t2_gross']/j['t2_tix']:.2f}")
    say("")
    say("      ⚠️ DO NOT PUBLISH THAT TICKET GAP AS A CLEAN COMPARISON.")
    say("      Venky's 10 Oct post says '4 Days Till Premieres', so the")
    say("      Jailer 2 read is T-4. The Jailer 2023 row above is T-2.")
    say("      Jailer 2 still has two selling days the benchmark has")
    say("      already banked, and those two days were worth a LOT to")
    say("      Jailer 2023:")
    add_t = j["final_tix"] - j["t2_tix"]
    add_g = j["final_gross"] - j["t2_gross"]
    say(f"        its last 2 days added {add_t:,} tickets / ${add_g:,}")
    say(f"        T-2 was only {j['t2_tix']/j['final_tix']*100:.0f}% of its "
        f"final premiere advance")
    say("      So the fair statement is: at T-4, with two days still to")
    say("      run, Jailer 2 is AHEAD on dollars and footprint and BEHIND")
    say("      on bodies. The dollar lead is price inflation plus a wider")
    say("      release rather than stronger demand - but the ticket gap")
    say("      is NOT yet a final verdict and may close. Say both halves.")
    say("      To settle it, re-read when Venky posts his T-2 figure and")
    say("      compare that to the Jailer 2023 T-2 row directly.")
    say("=" * 70)


def report(date, sites, shows, failed, cpx_id, ca_rows, base):
    read = [s for s in shows if num(s.get("seatsTotal"))]
    tot = sum(num(s["seatsTotal"]) for s in read)
    av = sum(num(s["seatsAvail"]) for s in read)
    sold = tot - av
    so = len([s for s in read if num(s["seatsTotal"]) and num(s["seatsAvail"]) == 0])

    say("\n" + "=" * 70)
    say(f"  {FILM} · {date} · PRESALE")
    say("=" * 70)
    say(f"    sites                 {len(sites):>9,}")
    say(f"    showtimes             {len(shows):>9,}")
    say(f"    seat maps read        {len(read):>9,}   "
        f"{len(read)/max(len(shows),1)*100:.1f}% of showtimes")
    say(f"    seats on sale         {tot:>9,}")
    say(f"    TICKETS SOLD          {sold:>9,}   "
        f"{sold/max(tot,1)*100:.1f}% of those seats")
    say(f"    sold-out shows        {so:>9,}")
    if failed:
        say(f"    ⚠️ {failed} seat maps BLANK, not zero. Excluded from the")
        say(f"       percentage above. Re-run with --resume to retry.")

    if base:
        hrs = max((time.time() - base["when"]) / 3600.0, 0.1)
        d = sold - base["sold"]
        say("")
        say(f"    VELOCITY vs {os.path.basename(base['folder'])}")
        say(f"      then {base['sold']:,} tickets / {base['sites']} sites / "
            f"{base['shows']} shows")
        say(f"      now  {sold:,} tickets / {len(sites)} sites / "
            f"{len(shows)} shows")
        say(f"      {d:+,} tickets in {hrs:.1f} h = {d/hrs:+.1f} per hour")
        if d > 0 and len(sites) > base["sites"]:
            say("      Sites AND tickets both up - the circuit is still")
            say("      being added to. Expect the footprint to keep moving.")
    else:
        say("\n    No earlier read with seat data on disk. This is the")
        say("    baseline; velocity needs a second run.")

    for lab, key in (("BY FORMAT", "format"), ("BY CHAIN", "chain"),
                     ("BY METRO", "metro")):
        say(f"\n    {lab}")
        agg = defaultdict(lambda: [set(), 0, 0, 0])
        for s in shows:
            a = agg[s.get(key) or "(none)"]
            a[0].add(s["theatreId"])
            a[1] += 1
            a[2] += num(s.get("seatsTotal"))
            a[3] += num(s.get("seatsTotal")) - num(s.get("seatsAvail")) \
                if num(s.get("seatsTotal")) else 0
        for k, v in sorted(agg.items(), key=lambda x: -x[1][3])[:15]:
            pct = f"{v[3]/v[2]*100:5.1f}%" if v[2] else "    -"
            say(f"      {k[:22]:<24}{len(v[0]):>4} sites {v[1]:>5} sh "
                f"{v[2]:>8,} seats {v[3]:>6,} sold {pct}")

    say("\n    BY TIME OF DAY (per-hour density so wide buckets do not lie)")
    buckets = [("6-12", 6, 12), ("12-4pm", 12, 16), ("4-7pm", 16, 19),
               ("7-9pm", 19, 21), ("9pm+", 21, 24)]
    for lab, a, b in buckets:
        sel = []
        for s in shows:
            m = re.search(r"T(\d{2}):", s.get("time", "") or "")
            if m and a <= int(m.group(1)) < b:
                sel.append(s)
        t = sum(num(s.get("seatsTotal")) for s in sel)
        sd = sum(num(s.get("seatsTotal")) - num(s.get("seatsAvail"))
                 for s in sel if num(s.get("seatsTotal")))
        say(f"      {lab:<10}{len(sel):>5} sh ({len(sel)/max(b-a,1):>5.0f}/hr) "
            f"{t:>8,} seats {sd:>6,} sold "
            f"{sd/t*100 if t else 0:5.1f}%")

    is_prem = (date == PREMIERE_DATE)
    table = PREMIERE_ATP if is_prem else ATP
    gross = 0
    for s in read:
        p = table.get(s.get("format"), table["Standard"])
        gross += (num(s["seatsTotal"]) - num(s["seatsAvail"])) * p
    say("\n    === DOLLARS ON WHAT WE MEASURED ===")
    if is_prem:
        say("    PREMIERE TIER. This date is premiere night and is priced")
        say("    as a special event, not as a regular show.")
        say(f"    ATP BACKED OUT of VenkyBO 10 Oct "
            f"(${VENKY_SERIES[-1][1]:,} / {VENKY_SERIES[-1][4]:,} tix")
        say(f"    = ${PREMIERE_ATP_OBSERVED:.2f}), not assumed by us:")
    else:
        say("    REGULAR TIER. ATP ASSUMED by us:")
    say("      " + " · ".join(f"{k} ${v:.2f}" for k, v in table.items()))
    say(f"    observed presale gross  ${gross:,.0f}")
    if is_prem:
        say("    The per-ticket figure is observed; the format spread above")
        say("    Standard is still ours. Say which is which if published.")
    else:
        say("    That is an assumption, not a price we read. Say so if")
        say("    published. Do NOT apply the premiere ATP to this date.")

    if is_prem:
        reconcile(sites, shows, sold, gross)

    say("\n    === CANADA, REPORTED SEPARATELY ===")
    say(f"    Cineplex filmId: {cpx_id or 'NOT CARRIED (expected for Tamil)'}")
    if ca_rows:
        for r in ca_rows:
            say(f"      LISTED  {r['venue']:<40}{r['shows']} time strings")
        say("    Canada is a FOOTPRINT read only. Cineplex exposes")
        say("    seatsAvailable but never seatsTotal, and the independents")
        say("    publish no seat data at all, so there is no Canadian")
        say("    ticket count and we must never print one.")
    else:
        say("      no Canadian venue listed it in this pass")
    say("=" * 70)


def main():
    global RAW
    args = sys.argv[1:]
    dates = [a for a in args if re.fullmatch(r"20\d\d-\d\d-\d\d", a)] or DATES
    zips = ZIPS_FAST if "--fast" in args else ZIPS_FULL
    do_seats = "--no-seats" not in args
    workers = 8
    pause = 0.12
    if "--workers" in args:
        try:
            workers = int(args[args.index("--workers") + 1])
        except Exception:
            pass

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    say("")
    say("#" * 70)
    say(f"#  BOXOFFY  -  {FILM.upper()} NORTH AMERICA SWEEP")
    say(f"#  {dt.datetime.now():%Y-%m-%d %H:%M}   fandango {FID}   "
        f"{len(zips)} zips")
    say("#")
    say("#  TAMIL FILM. Cineplex carries Hindi and Punjabi, so Canada")
    say("#  runs through the GTA Indian-only independents instead.")
    say("#  Baseline on disk: 3 Oct, 101 sites / 272 shows / 635 sold -")
    say("#  but that run swept 15-18 Oct ONLY and MISSED PREMIERE NIGHT.")
    say("#  So it is NOT comparable to any published presale figure.")
    say(f"#  Premiere date {PREMIERE_DATE} is now first in the list and")
    say("#  gets its own ATP tier. Compare premiere to premiere only.")
    if PREMIERE_DATE not in dates:
        say("#")
        say("#  ⚠️ YOU PASSED DATES ON THE COMMAND LINE AND PREMIERE NIGHT")
        say(f"#     {PREMIERE_DATE} IS NOT AMONG THEM. The reconciliation")
        say("#     against the published figures will be SKIPPED. That is")
        say("#     fine for a regular-date read and wrong for anything you")
        say("#     intend to publish as 'presales'.")
    say("#" * 70)
    warm()

    for date in dates:
        outdir = os.path.join("intel", f"jailer2-v2-{date}-{stamp}")
        RAW = os.path.join(outdir, "raw")
        os.makedirs(RAW, exist_ok=True)
        say(f"\n=== {FILM} · {date} -> {outdir}")

        base = baseline(date)
        sites, shows = footprint(date, zips, pause)
        say(f"  {len(sites)} sites, {len(shows)} showtimes")

        failed = 0
        if do_seats and shows:
            say("  Seat maps...")
            failed = read_seats(shows, workers, pause)

        cpx_id, ca_rows = canada()
        ch = us_chains()
        report(date, sites, shows, failed, cpx_id, ca_rows, base)

        try:
            with open(os.path.join(outdir, "fandango_shows.csv"), "w",
                      newline="", encoding="utf-8") as fh:
                cols = ["date", "theatreId", "theatre", "chain", "metro",
                        "format", "time", "isSoldOut", "seatsTotal",
                        "seatsAvail", "hash"]
                w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
                w.writeheader()
                w.writerows(shows)
            with open(os.path.join(outdir, "chains.csv"), "w", newline="",
                      encoding="utf-8") as fh:
                w = csv.DictWriter(fh, fieldnames=list(ch[0].keys()))
                w.writeheader()
                w.writerows(ch)
        except Exception as e:
            say(f"  csv write failed: {e}")

    say("\n  PASTE BACK the PRESALE block and the VELOCITY block.")
    with open("jailer2_sweep.txt", "w", encoding="utf-8") as fh:
        fh.write("\n".join(_OUT) + "\n")
    print("\nWritten: jailer2_sweep.txt")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        with open("jailer2_sweep.txt", "w", encoding="utf-8") as fh:
            fh.write("\n".join(_OUT) + "\n[interrupted]\n")
        print("\ninterrupted - partial log in jailer2_sweep.txt")
