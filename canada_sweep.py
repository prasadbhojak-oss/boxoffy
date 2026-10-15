#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Boxoffy - CANADA sweep.  Comprehensive, standalone, one file.
Built 10 October 2026.

================================================================
WHY THIS FILE EXISTS, AND WHAT IT IS HONEST ABOUT
================================================================
Until now "Canada" in our pipeline meant one function inside
na_presale.py that hit apis.cineplex.com and hoped. That covered
Cineplex and nothing else. For a Hollywood film that is roughly
fine. For an INDIAN film it is not, and the reason is specific:

  Cineplex carries Hindi and Punjabi. It does NOT reliably carry
  Tamil, Telugu or Malayalam. Those titles play at four
  Indian-only independents in the GTA - Albion, Woodside, York,
  Central Parkway - plus Cine Starz. None of them has an API.
  None of them appears in our old sweep. For a South Indian
  release, our Canada number was not low. It was INVISIBLE.

And Canada is not a rounding error. Measured off Bollywood
Hungama's Canada-separate daily tables:

  Canada is 25-40% of the US+Canada gross for a HINDI film
  Canada is 10-25% for a Telugu film
  Canadian per-screen runs about 4x the US per-screen

Drishyam: The Conclusion did USD 1.14M in Canada on 74-78
screens against USD 1.68M in the US. That is 40.5% of North
America sitting in a territory we were sampling with one API.

So this file does FOUR things, in one pass:

  1. CINEPLEX properly - enumerates the FULL national theatre
     list (target 152 locations, 1,595 screens), not just
     whatever "nearby" returns from a datacentre IP.
  2. THE OTHER CHAINS - Landmark (36/299), Imagine (11/72),
     Cine Starz (8). Imagine has a clean dated endpoint. The
     other two are PROBED, not assumed.
  3. THE INDEPENDENTS - the four Indian-only GTA houses, read
     through CinemaClock, which is the only Canadian source
     that labels film language.
  4. A CONTROL FILM - every run also looks for a film that is
     definitely playing right now. Without that, a row of zeros
     is ambiguous: broken endpoints and a genuinely unlisted
     film look identical. With it, a zero becomes a FINDING.

================================================================
MERGING INTO NORTH AMERICA LATER
================================================================
sweep() returns rows in the SAME schema na_presale.py already
writes to cineplex_shows.csv, plus three added columns
(chain, lang, source). So folding this into the NA sweep is a
drop-in: import canada_sweep, call sweep(), concat. Nothing in
here needs na_presale.py to run, and nothing in na_presale.py
needs to change to accept it. That is deliberate - Canada ships
standalone first, proves itself, then merges.

================================================================
THE ONE THING CANADA CANNOT GIVE US
================================================================
NO TICKET COUNT. Cineplex exposes seatsAvailable but never
seatsTotal, so there is no denominator and occupancy cannot be
computed. Every other Canadian surface is worse - most publish
showtimes only. So Canada gives us FOOTPRINT (sites, screens,
showtimes, formats, languages) and never a seat number. This
script will not print a Canadian ticket figure or a Canadian
dollar figure, because it cannot honestly produce one. If you
ever see one in our output, it was fabricated.

================================================================
RUN IT
================================================================
    cd /d C:\\Users\\palla\\boxoffy
    python canada_sweep.py

    python canada_sweep.py --probe-only      endpoints only, fast
    python canada_sweep.py --film ramayana   (default)
    python canada_sweep.py --film control    just the control
    python canada_sweep.py --no-control      skip the control
    python canada_sweep.py 2026-11-06        override dates
    python canada_sweep.py --workers 8

Writes  canada_sweep.txt  and  intel\\canada-<film>-<stamp>\\*.csv
"""

import csv
import datetime as dt
import gzip
import io
import json
import os
import re
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")

# Cineplex runs Azure API Management. This key is lifted from their own
# public web bundle (next-static-files/_next/static/chunks/*.js). It is a
# client-side key shipped to every browser that loads cineplex.com, not a
# secret. Do not put it anywhere public anyway.
CPX_KEY = "477f072109904a55927ba2c3bf9f77e3"
CPX_BASE = "https://apis.cineplex.com/prod/cpx/theatrical/api/v1"

PAUSE = 0.25
TIMEOUT = 25

# ------------------------------------------------------------------ films
#
# reject[] matters more than you would think. There is a 1992 animated
# "Ramayana: The Legend of Prince Rama" in both CinemaClock and Tribute
# (Tribute id 170283), Cineplex has /movie/the-prince-of-light-the-legend-
# of-ramayana, and there is a charity screening of the 1992 film at
# Cineplex Square One in the index right now. Any of those will match a
# naive "ramayana" substring search and give us a phantom footprint.

FILMS = {
    "ramayana": {
        "title": "Ramayana: Rise of a Legend",
        "must": ["ramayana"],
        "nice": ["rise", "legend"],
        "reject": ["legend of prince rama", "prince of light", "prince rama",
                   "sampoorna", "ramayan "],
        "lang": "Hindi",
        # Sony: worldwide outside India 6 Nov. India 8 Nov via Dharma.
        # The international date is TWO DAYS AHEAD of India. No Canadian
        # site states a Canada-specific date, so 6 Nov is inferred from
        # the global date. We sweep the neighbours rather than guess.
        "dates": ["2026-11-04", "2026-11-05", "2026-11-06",
                  "2026-11-07", "2026-11-08"],
        "slugs": ["ramayana", "ramayana-hindi-west",
                  "ramayana-rise-of-a-legend",
                  "ramayana-rise-of-a-legend-hindi-west"],
        "tribute": "ramayana-rise-of-a-legend",
        "expect": 0,
    },
    "control": {
        "title": "Drishyam: The Conclusion",
        # "conclusion" is required, which is what keeps this off the 2015
        # Drishyam (/movie/drishyam-hindi-west) and off Drishyam 3, the
        # Malayalam film that the-numbers conflates with this one.
        "must": ["drishyam", "conclusion"],
        "nice": [],
        "reject": [],
        "lang": "Hindi",
        "dates": [],          # filled with today/tomorrow at runtime
        "slugs": ["drishyam-the-conclusion", "drishyam-the-conclusion-hindi-west"],
        "tribute": "drishyam-the-conclusion",
        # Verified playing 9-10 Oct at Cineplex Strawberry Hill (38
        # showtimes over 7 days), Landmark chain-wide, Albion, York,
        # Central Parkway, 12 showtimes Toronto, 13 Brampton.
        # Opened on 74-78 Canadian screens.
        "expect": 40,
    },
}

INDIAN_LANGS = ["Hindi", "Punjabi", "Tamil", "Telugu", "Malayalam",
                "Gujarati", "Kannada", "Marathi", "Bengali", "Sinhala"]

# ------------------------------------------------------- markets + venues
#
# Eleven markets, chosen because they are where Indian films actually
# play in Canada. Brampton alone carried 13 showtimes of the control
# film - the highest Indian-title count of any Canadian market.

CC_MARKETS = [
    ("Toronto",     "toronto-on"),
    ("Brampton",    "brampton-on"),
    ("Mississauga", "mississauga-on"),
    ("Scarborough", "scarborough-on"),
    ("Surrey",      "surrey-bc"),
    ("Vancouver",   "vancouver-bc"),
    ("Calgary",     "calgary-ab"),
    ("Edmonton",    "edmonton-ab"),
    ("Winnipeg",    "winnipeg-mb"),
    ("Ottawa",      "ottawa-on"),
    ("Montreal",    "montreal-qc"),
]

# The four Indian-only independents. No online ticketing at all - York
# and Central Parkway list a phone infoline. CinemaClock is the only way
# to read them, which is exactly why CinemaClock is the spine here and
# not an afterthought.
CC_INDIE = [
    ("Albion Cinemas (Etobicoke)",      "albion-cinemas"),
    ("Woodside Cinemas (Agincourt)",    "woodside"),
    ("York Cinemas (Richmond Hill)",    "york-cinemas"),
    ("Central Parkway (Mississauga)",   "central-parkway-cinemas"),
    ("Cineplex Strawberry Hill (Surrey)", "cineplex-strawberry-hill"),
    ("SilverCity Brampton",             "silvercity-brampton-cinemas"),
]

CINESTARZ = ["deluxewoodbine", "sthubert", "chateauguay", "brossard",
             "lasalle", "boucherville", "gatineau", "mississauga"]

IMAGINE = ["carlton", "promenade", "elginmills", "market-square",
           "st-jacobs", "windsor", "brantford", "cornwall",
           "port-hope", "owen-sound", "sarnia"]

# Landmark is Vista underneath - its booking URLs carry the canonical
# cinemaId / filmId / sessionId / externalSessionId quadruple. But no
# /WSVistaWebClient/, RESTTicketing or ocapi path is exposed on the
# public site, and the front end is Angular-templated ({{item.Title}}),
# which means a JSON feed exists somewhere. These are the candidates.
# EVERY ONE OF THESE IS A GUESS. Whatever answers is reported; nothing
# is assumed.
LANDMARK_PROBES = [
    "https://www.landmarkcinemas.com/api/now-playing",
    "https://www.landmarkcinemas.com/api/films",
    "https://www.landmarkcinemas.com/api/sessions",
    "https://www.landmarkcinemas.com/showtimes/api/films",
    "https://www.landmarkcinemas.com/WSVistaWebClient/ocapi/v1/browsing/master-data/showtimes",
    "https://www.landmarkcinemas.com/WSVistaWebClient/RESTTicketing.svc/GetFilmsBySite",
    "https://web1.landmarkcinemas.com/api/films",
    "https://web5.landmarkcinemas.com/api/films",
    "https://pc.landmarkcinemas.com/api/films",
    "https://cms.landmarkcinemas.com/api/films",
    "https://filmdb.landmarkcinemas.com/",
]

_LOCK = threading.Lock()
_OUT = []


def say(*a):
    line = " ".join(str(x) for x in a)
    with _LOCK:
        _OUT.append(line)
        print(line, flush=True)


# ------------------------------------------------------------------- http
_CTX = ssl.create_default_context()


def get(url, hdrs=None, tries=2, want_json=None):
    """Returns (status, body). body is a dict/list if JSON parsed, else str.
    status 0 means the request never completed - that is a different fact
    from a 404 and it is reported as such."""
    h = {"User-Agent": UA, "Accept-Language": "en-CA,en;q=0.9",
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
                ct = (r.headers.get("Content-Type") or "").lower()
                looks_json = "json" in ct or txt[:1] in "[{"
                if (want_json is None and looks_json) or want_json is True:
                    try:
                        return r.status, json.loads(txt)
                    except Exception:
                        return r.status, txt
                return r.status, txt
        except urllib.error.HTTPError as e:
            try:
                b = e.read().decode("utf-8", "replace")
            except Exception:
                b = ""
            return e.code, b
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
            time.sleep(0.6 * (n + 1))
    return 0, last


# ---------------------------------------------------------------- matcher
def matches(cfg, cand):
    """Tight on purpose. must[] all have to be present, reject[] kills it.
    This is what keeps the 1992 animated Ramayana out of our footprint."""
    c = " " + re.sub(r"[^a-z0-9 ]+", " ", (cand or "").lower()) + " "
    c = re.sub(r"\s+", " ", c)
    if not c.strip():
        return False
    for bad in cfg.get("reject", []):
        if bad.lower() in c:
            return False
    for m in cfg["must"]:
        if m.lower() not in c:
            return False
    return True


def lang_of(txt):
    for L in INDIAN_LANGS:
        if re.search(r"\b" + L + r"\b", txt or "", re.I):
            return L
    return ""


def strip_tags(html):
    h = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html or "")
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    h = (h.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"')
          .replace("&nbsp;", " ").replace("&rsquo;", "'").replace("&ndash;", "-"))
    return re.sub(r"\s+", " ", h).strip()


TIME_RE = re.compile(r"\b(1[0-2]|0?[1-9])[:.]([0-5][0-9])\s*([ap])\.?m\.?\b", re.I)


def find_times(txt):
    out = []
    for h, m, ap in TIME_RE.findall(txt or ""):
        hh = int(h) % 12 + (12 if ap.lower() == "p" else 0)
        out.append(f"{hh:02d}:{m}")
    return sorted(set(out))


# =================================================================
#  A.  CINEPLEX  -  152 locations, 1,595 screens, ~75% of the market
# =================================================================
CPX_HDR = {"Ocp-Apim-Subscription-Key": CPX_KEY,
           "Accept": "application/json", "User-Agent": UA}


def cpx_theatres():
    """The old sweep used /theatres?language=en alone, which buckets into
    favourite / nearby / other and is geolocated off the CALLER's IP. Run
    from a datacentre that is not a national list. So we try several
    forms and take the union, then say out loud how close we got to 152."""
    forms = [
        f"{CPX_BASE}/theatres?language=en",
        f"{CPX_BASE}/theatres?language=en&range=100000&skip=0&take=1000",
        f"{CPX_BASE}/theatres?language=en-us&range=100000&skip=0&take=1000",
        f"{CPX_BASE}/theatres/playingnearby?language=en&accuracyKm=100000",
        "https://www.cineplex.com/api/v1/theatres?language=en-us"
        "&range=100000&skip=0&take=1000",
    ]
    seen, best = {}, None
    for u in forms:
        st, js = get(u, CPX_HDR)
        n0 = len(seen)
        if st == 200 and js:
            for t in _iter_theatres(js):
                tid = str(t.get("theatreId") or t.get("id") or "")
                if tid and tid not in seen:
                    loc = t.get("location") or {}
                    seen[tid] = {
                        "theatreId": tid,
                        "theatre": t.get("theatreName") or t.get("name") or "",
                        "city": loc.get("city") or t.get("city") or "",
                        "province": (loc.get("provinceCode") or loc.get("province")
                                     or t.get("provinceCode") or ""),
                    }
        say(f"    {st:>3}  +{len(seen)-n0:<4} {u.replace(CPX_BASE,'…v1')[:88]}")
        if st == 200 and best is None:
            best = u
    say(f"\n    CINEPLEX THEATRE LIST: {len(seen)} locations")
    if len(seen) == 0:
        say("    Zero. The API did not answer at all - everything below")
        say("    for Cineplex is therefore unknown, not absent.")
    elif len(seen) < 100:
        say(f"    Expected ~152. We got {len(seen)}, so this list is")
        say("    PARTIAL and geolocated. Any Cineplex count below is a")
        say("    FLOOR, not a total. Say so if we publish it.")
    else:
        say("    That is close to the published 152 - treat as national.")
    return list(seen.values())


def _iter_theatres(js):
    if isinstance(js, dict):
        hit = False
        for k in ("favouriteTheatres", "nearbyTheatres", "otherTheatres",
                  "theatres", "items", "data", "results"):
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


def cpx_resolve(cfg):
    """Find the numeric Cineplex film id. Indian titles use a language +
    region slug suffix - drishyam-the-conclusion-HINDI-WEST - so the slug
    guesses in FILMS reflect that. The catalogue endpoint is the reliable
    route; cineplex.com itself is robots-hostile."""
    forms = [
        f"{CPX_BASE}/movies?language=en",
        f"{CPX_BASE}/movies/bookable?language=en",
        f"{CPX_BASE}/movies?language=en-us&movieType=1&showTimeType=0"
        f"&showtimeStatus=0&skip=0&take=500",
        "https://www.cineplex.com/api/v1/movies?language=en-us&movieType=1"
        "&showTimeType=0&showtimeStatus=0&skip=0&take=500",
    ]
    cat = []
    for u in forms:
        st, js = get(u, CPX_HDR)
        got = list(_iter_movies(js)) if st == 200 and js else []
        say(f"    {st:>3}  {len(got):<5} {u.replace(CPX_BASE,'…v1')[:88]}")
        cat += got
    if not cat:
        say("    Catalogue empty. Cannot resolve a Cineplex film id.")
        return None, None, cat
    hits = []
    for m in cat:
        nm = (m.get("name") or m.get("title") or m.get("filmName")
              or m.get("movieName") or "")
        fid = m.get("filmId") or m.get("id") or m.get("movieId")
        if fid and matches(cfg, nm):
            hits.append((str(fid), nm))
    rej = [m.get("name") or m.get("title") or ""
           for m in cat
           if "ramayan" in str(m.get("name") or m.get("title") or "").lower()
           and not matches(cfg, m.get("name") or m.get("title") or "")]
    if rej:
        say(f"    collision guard rejected: {'; '.join(sorted(set(rej))[:5])}")
    if not hits:
        say(f"    '{cfg['title']}' is NOT in the Cineplex catalogue "
            f"({len(cat)} titles read).")
        return None, None, cat
    say(f"    MATCH  filmId {hits[0][0]}   {hits[0][1]}")
    for f, n in hits[1:]:
        say(f"    also   filmId {f}   {n}   <- ambiguous, check this")
    return hits[0][0], hits[0][1], cat


def _iter_movies(js):
    if isinstance(js, dict):
        hit = False
        for k in ("movies", "films", "items", "data", "results"):
            v = js.get(k)
            if isinstance(v, list):
                hit = True
                for x in v:
                    if isinstance(x, dict):
                        yield x
        if not hit and (js.get("filmId") or js.get("name") or js.get("title")):
            yield js
    elif isinstance(js, list):
        for x in js:
            if isinstance(x, dict):
                yield x


def _cpx_shows(node, fmt=""):
    if isinstance(node, dict):
        f = (node.get("experienceTypeName") or node.get("experienceType")
             or node.get("format") or node.get("vistaFormat") or fmt)
        t = (node.get("showStartDateTime") or node.get("showtime")
             or node.get("sessionTime") or node.get("startTime"))
        if t:
            yield {"time": str(t), "format": str(f or ""),
                   "seatsAvail": node.get("seatsAvailable",
                                          node.get("seatsRemaining", "")),
                   "showtimeId": str(node.get("showtimeId")
                                     or node.get("sessionId") or "")}
        for v in node.values():
            yield from _cpx_shows(v, f)
    elif isinstance(node, list):
        for v in node:
            yield from _cpx_shows(v, fmt)


def cpx_sweep(fid, theatres, date, workers):
    """Probe a national form first. 152 theatres x 5 dates is 760 calls;
    if filmId+date alone answers, that is 5. Worth one request to find out."""
    nat = (f"{CPX_BASE}/showtimes?language=en&filmId={fid}&date={date}")
    st, js = get(nat, CPX_HDR)
    if st == 200 and js:
        rows = list(_cpx_shows(js))
        if len(rows) > 3:
            say(f"      national form answered: {len(rows)} showtimes in 1 call")
            for r in rows:
                r.setdefault("theatreId", "")
                r.setdefault("theatre", "")
                r.setdefault("city", "")
                r.setdefault("province", "")
            return rows
    say(f"      national form gave {st}/{0 if not js else 'thin'} - "
        f"walking {len(theatres)} theatres")
    out = []

    def one(t):
        u = (f"{CPX_BASE}/showtimes?language=en&filmId={fid}"
             f"&date={date}&locationId={t['theatreId']}")
        s, j = get(u, CPX_HDR, tries=1)
        got = []
        if s == 200 and j:
            for r in _cpx_shows(j):
                r.update(t)
                got.append(r)
        return got

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(one, t) for t in theatres]
        for i, f in enumerate(as_completed(futs), 1):
            try:
                out += f.result()
            except Exception:
                pass
            if i % 40 == 0:
                say(f"      {i}/{len(theatres)} theatres, {len(out)} showtimes")
    return out


# =================================================================
#  B.  CINEMACLOCK  -  the spine.  Only Canadian source that
#      labels film LANGUAGE, and the only way to read the four
#      Indian-only independents, which have no ticketing at all.
# =================================================================
CC = "https://www.cinemaclock.com"


def cc_market(cfg, label, slug):
    rows, tried = [], []
    for path in (f"/{slug}/movies-now-playing", f"/{slug}/now-playing",
                 f"/{slug}/movie-theaters"):
        st, body = get(CC + path, want_json=False)
        tried.append(f"{st} {path}")
        if st != 200 or not isinstance(body, str):
            continue
        txt = strip_tags(body)
        # CinemaClock prints "Title (Hindi) 2nd week, 12 showtimes"
        for mt in re.finditer(r"[^.]{0,120}", txt):
            pass
        for chunk in re.split(r"(?<=showtimes)|(?<=showtime)", txt):
            if matches(cfg, chunk):
                n = re.search(r"(\d+)\s+showtime", chunk)
                w = re.search(r"(\d+)(?:st|nd|rd|th)\s+week", chunk)
                rows.append({"market": label, "shows": int(n.group(1)) if n else 0,
                             "week": w.group(1) if w else "",
                             "lang": lang_of(chunk)})
        if rows:
            break
    return rows, tried


def cc_theatre(cfg, label, slug):
    for path in (f"/movie-theaters/{slug}", f"/theatres/{slug}"):
        st, body = get(CC + path, want_json=False)
        if st != 200 or not isinstance(body, str):
            continue
        txt = strip_tags(body)
        if not matches(cfg, txt):
            return {"venue": label, "status": "not listed", "http": st,
                    "times": [], "lang": ""}
        # narrow to the neighbourhood of the title before reading times
        i = 0
        for m in cfg["must"]:
            j = txt.lower().find(m.lower())
            if j > -1:
                i = j
                break
        win = txt[max(0, i - 200): i + 700]
        return {"venue": label, "status": "LISTED", "http": st,
                "times": find_times(win), "lang": lang_of(win)}
    return {"venue": label, "status": "unreachable", "http": 0,
            "times": [], "lang": ""}


# =================================================================
#  C / D / E.  THE OTHER CHAINS
# =================================================================
def imagine(cfg, date):
    """Imagine Cinemas runs on Omniterm (Markham ON). Its endpoint takes
    an ISO date as schdate= - the cleanest dated showtime endpoint of any
    non-Cineplex Canadian chain. Verified pattern, unverified per-location
    slugs, so each one reports its own status."""
    out = []
    for loc in IMAGINE:
        for u in (f"https://omniwebticketing8.com/imaginecinemas/{loc}"
                  f"?schdate={date}",
                  f"https://imaginecinemas.com/cinema/{loc}/"):
            st, body = get(u, want_json=False)
            if st == 200 and isinstance(body, str):
                txt = strip_tags(body)
                if matches(cfg, txt):
                    out.append({"venue": f"Imagine {loc}", "http": st,
                                "times": find_times(txt), "url": u})
                break
        time.sleep(PAUSE)
    return out


def cinestarz(cfg):
    """Self-hosted on Theater Toolkit. Heavy Tamil/Telugu/Malayalam
    programming - Deluxe Woodbine alone was carrying four South Indian
    titles this week. This is exactly the inventory Cineplex misses."""
    out = []
    for loc in CINESTARZ:
        for u in (f"https://www.cinestarz.ca/movie-theater/{loc}",
                  f"https://www.cinestarz.ca/movie-theater/{loc}/movies"):
            st, body = get(u, want_json=False)
            if st == 200 and isinstance(body, str):
                txt = strip_tags(body)
                if matches(cfg, txt):
                    out.append({"venue": f"Cine Starz {loc}", "http": st,
                                "times": find_times(txt), "url": u})
                break
        time.sleep(PAUSE)
    return out


def landmark(cfg):
    """36 locations, 299 screens, Kinepolis-owned, #2 in Canada, and it
    WAS carrying the control film chain-wide this week. Booking URLs are
    pure Vista (cinemaId/filmId/sessionId/externalSessionId) but no Vista
    web service is exposed publicly. So: probe for the JSON feed behind
    the Angular templating, and fall back to the HTML listing pages."""
    found, listed = [], None
    for u in LANDMARK_PROBES:
        st, js = get(u, tries=1)
        kind = ("json" if isinstance(js, (dict, list))
                else "html" if st == 200 else "-")
        say(f"    {st:>3}  {kind:<5} {u[:92]}")
        if st == 200 and isinstance(js, (dict, list)):
            found.append(u)
    for u in ("https://www.landmarkcinemas.com/now-playing/",
              "https://www.landmarkcinemas.com/coming-soon/"):
        st, body = get(u, want_json=False)
        if st == 200 and isinstance(body, str):
            txt = strip_tags(body)
            if matches(cfg, txt):
                i = txt.lower().find(cfg["must"][0])
                win = txt[max(0, i - 150): i + 400]
                listed = {"url": u, "lang": lang_of(win),
                          "snippet": win[:220]}
                say(f"    LISTED on {u.rsplit('/',2)[-2]}  {listed['lang']}")
                break
            say(f"    not listed on {u.rsplit('/',2)[-2]}")
    return found, listed


def tribute(cfg):
    """Tribute.ca is the forward calendar. It had Ramayana dated 6 Nov
    2026 when CinemaClock did not. It does NOT label language, and it
    carries the 1992 animated film as id 170283 - hence reject[]."""
    out = {"listed": False, "date": "", "url": "", "shows": 0}
    for u in ("https://www.tribute.ca/movies/coming-soon/",
              "https://www.tribute.ca/movies/coming-soon/2/",
              f"https://www.tribute.ca/showtimes/movie/all/{cfg.get('tribute','')}/"):
        st, body = get(u, want_json=False)
        if st != 200 or not isinstance(body, str):
            continue
        txt = strip_tags(body)
        if matches(cfg, txt):
            i = txt.lower().find(cfg["must"][0])
            win = txt[max(0, i - 120): i + 320]
            d = re.search(r"\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
                          r"[a-z]*\.?\s+\d{1,2},?\s+20\d\d)\b", win)
            out = {"listed": True, "date": d.group(1) if d else "",
                   "url": u, "shows": len(find_times(win))}
            break
    return out


# =================================================================
#  REPORT
# =================================================================
def run(key, cfg, dates, workers, probe_only, do_control):
    say("=" * 72)
    say(f"  {cfg['title']}")
    say(f"  dates: {', '.join(dates) if dates else '(none)'}")
    say("=" * 72)

    res = {"film": cfg["title"], "dates": dates}

    say("\n--- CINEPLEX: national theatre list " + "-" * 32)
    th = cpx_theatres()

    say("\n--- CINEPLEX: resolve film id " + "-" * 38)
    fid, fname, cat = cpx_resolve(cfg)
    res["cpx_fid"] = fid
    res["cpx_name"] = fname
    res["cpx_theatres"] = len(th)
    res["cpx_catalogue"] = len(cat)

    cpx_rows = []
    if fid and th and not probe_only:
        for d in dates:
            say(f"\n    showtimes {d}")
            r = cpx_sweep(fid, th, d, workers)
            for x in r:
                x["date"] = d
                x["chain"] = "Cineplex"
                x["lang"] = cfg.get("lang", "")
                x["source"] = "apis.cineplex.com"
            say(f"      {d}: {len(r)} showtimes at "
                f"{len({x.get('theatreId') for x in r if x.get('theatreId')})} sites")
            cpx_rows += r
    elif not fid:
        say("\n    No film id, so no Cineplex showtime pass. That is the")
        say("    expected shape for a film that is not yet on sale.")
    res["cpx_shows"] = len(cpx_rows)

    say("\n--- LANDMARK: probe for the JSON behind Vista " + "-" * 21)
    lm_json, lm_listed = landmark(cfg)
    res["landmark_json"] = lm_json
    res["landmark_listed"] = lm_listed

    say("\n--- CINEMACLOCK: markets " + "-" * 43)
    cc_rows = []
    for label, slug in CC_MARKETS:
        rows, tried = cc_market(cfg, label, slug)
        if rows:
            tot = sum(r["shows"] for r in rows)
            lg = rows[0]["lang"] or "?"
            say(f"    {label:<13} LISTED   {tot:>3} showtimes   "
                f"{lg}   wk {rows[0]['week'] or '?'}")
            cc_rows += rows
        else:
            say(f"    {label:<13} not listed   [{tried[0] if tried else '-'}]")
        time.sleep(PAUSE)
    res["cc_markets"] = cc_rows

    say("\n--- CINEMACLOCK: the Indian-only independents " + "-" * 21)
    say("    These four have NO online ticketing. If a South Indian")
    say("    title is playing Canada and these are blank, we are blind.")
    indie = []
    for label, slug in CC_INDIE:
        r = cc_theatre(cfg, label, slug)
        indie.append(r)
        mark = "LISTED " if r["status"] == "LISTED" else "       "
        say(f"    {mark}{label:<36} {r['status']:<12} "
            f"{len(r['times'])} times {r['lang']}")
        time.sleep(PAUSE)
    res["indies"] = indie

    say("\n--- CINE STARZ " + "-" * 52)
    cs = cinestarz(cfg)
    for r in cs:
        say(f"    LISTED {r['venue']:<28} {len(r['times'])} times")
    if not cs:
        say("    not listed at any Cine Starz location")
    res["cinestarz"] = cs

    say("\n--- IMAGINE (Omniterm, dated endpoint) " + "-" * 28)
    im = []
    if dates and not probe_only:
        im = imagine(cfg, dates[0])
        for r in im:
            say(f"    LISTED {r['venue']:<28} {len(r['times'])} times")
        if not im:
            say(f"    not listed at any Imagine location for {dates[0]}")
    else:
        say("    skipped (no date / probe-only)")
    res["imagine"] = im

    say("\n--- TRIBUTE.CA forward calendar " + "-" * 35)
    tb = tribute(cfg)
    if tb["listed"]:
        say(f"    LISTED   date on page: {tb['date'] or '(none printed)'}")
        say(f"    {tb['url']}")
    else:
        say("    not listed")
    res["tribute"] = tb

    # ---------------------------------------------------------- verdict
    sites = len({x.get("theatreId") for x in cpx_rows if x.get("theatreId")})
    cc_tot = sum(r["shows"] for r in cc_rows)
    indie_hits = sum(1 for r in indie if r["status"] == "LISTED")

    say("\n" + "=" * 72)
    say(f"  VERDICT  -  {cfg['title']}")
    say("=" * 72)
    say(f"    Cineplex film id          {fid or 'NOT IN CATALOGUE'}")
    say(f"    Cineplex locations read   {len(th)}  (published total 152)")
    say(f"    Cineplex showtimes        {len(cpx_rows):,}  at {sites} sites")
    say(f"    CinemaClock showtimes     {cc_tot:,}  across "
        f"{len(cc_rows)} of {len(CC_MARKETS)} markets")
    say(f"    Indian-only indies        {indie_hits} of {len(CC_INDIE)} listed")
    say(f"    Cine Starz                {len(cs)} locations")
    say(f"    Imagine                   {len(im)} locations")
    say(f"    Landmark                  "
        f"{'LISTED' if lm_listed else 'not listed'}"
        f"   json feeds found: {len(lm_json)}")
    say(f"    Tribute forward calendar  "
        f"{'listed ' + (tb['date'] or '') if tb['listed'] else 'not listed'}")

    total = len(cpx_rows) + cc_tot
    exp = cfg.get("expect", 0)
    say("")
    if total == 0 and exp == 0:
        say("    ZERO EVERYWHERE, AND ZERO IS WHAT WE EXPECTED.")
        say("    Read the control block below before believing it.")
    elif total == 0 and exp > 0:
        say(f"    ZERO - BUT THIS FILM SHOULD BE ON ~{exp}+ SCREENS.")
        say("    That is a BROKEN SWEEP, not an empty market. Do not")
        say("    publish anything off this run.")
    elif total < exp:
        say(f"    {total} showtimes, but we expected at least ~{exp}.")
        say("    Treat this as a FLOOR and say so if we publish it.")
    else:
        say(f"    {total:,} showtimes found. Footprint is real.")

    say("")
    say("    NO TICKET COUNT. Cineplex gives seatsAvailable and never")
    say("    seatsTotal, so there is no denominator and no occupancy.")
    say("    Canada is a footprint read only. Any Canadian ticket or")
    say("    dollar figure in our output would be fabricated.")
    say("=" * 72)

    res["rows"] = cpx_rows
    return res


def write_csvs(key, res, stamp):
    d = os.path.join("intel", f"canada-{key}-{stamp}")
    os.makedirs(d, exist_ok=True)
    cols = ["date", "theatreId", "theatre", "city", "province", "chain",
            "time", "format", "seatsAvail", "showtimeId", "lang", "source"]
    with open(os.path.join(d, "cineplex_shows.csv"), "w", newline="",
              encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in res.get("rows", []):
            w.writerow(r)
    with open(os.path.join(d, "cinemaclock_markets.csv"), "w", newline="",
              encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["market", "shows", "week", "lang"],
                           extrasaction="ignore")
        w.writeheader()
        for r in res.get("cc_markets", []):
            w.writerow(r)
    with open(os.path.join(d, "independents.csv"), "w", newline="",
              encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["venue", "status", "http", "times", "lang"])
        for r in res.get("indies", []):
            w.writerow([r["venue"], r["status"], r["http"],
                        ";".join(r["times"]), r["lang"]])
    with open(os.path.join(d, "summary.json"), "w", encoding="utf-8") as fh:
        json.dump({k: v for k, v in res.items() if k != "rows"}, fh,
                  indent=2, default=str)
    return d


def main():
    args = [a for a in sys.argv[1:]]
    probe_only = "--probe-only" in args
    no_control = "--no-control" in args
    workers = 6
    if "--workers" in args:
        try:
            workers = int(args[args.index("--workers") + 1])
        except Exception:
            pass
    film = "ramayana"
    if "--film" in args:
        try:
            film = args[args.index("--film") + 1]
        except Exception:
            pass
    if film not in FILMS:
        print("--film must be one of: " + ", ".join(FILMS))
        return 1
    dates = [a for a in args if re.fullmatch(r"20\d\d-\d\d-\d\d", a)]

    today = dt.date.today()
    FILMS["control"]["dates"] = [today.isoformat(),
                                 (today + dt.timedelta(days=1)).isoformat()]

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    say("")
    say("#" * 72)
    say("#  BOXOFFY  -  CANADA SWEEP")
    say(f"#  {dt.datetime.now():%Y-%m-%d %H:%M}   workers {workers}"
        f"{'   PROBE ONLY' if probe_only else ''}")
    say("#")
    say("#  Cineplex 152/1595 - Landmark 36/299 - Imagine 11/72 -")
    say("#  Cine Starz 8 - plus 4 Indian-only GTA independents that")
    say("#  have no API and no online ticketing at all.")
    say("#")
    say("#  Canada is 25-40% of US+Canada for a Hindi film and 10-25%")
    say("#  for Telugu. Per-screen runs about 4x the US. It is not a")
    say("#  rounding error and it was not being measured properly.")
    say("#" * 72)

    out = {}
    tgt = dates or FILMS[film]["dates"]
    out[film] = run(film, FILMS[film], tgt, workers, probe_only, not no_control)
    folder = write_csvs(film, out[film], stamp)

    if film != "control" and not no_control:
        say("\n")
        say("#" * 72)
        say("#  CONTROL FILM")
        say("#  Drishyam: The Conclusion opened 2 Oct on 74-78 Canadian")
        say("#  screens and was verified playing at Cineplex Strawberry")
        say("#  Hill, Landmark chain-wide, Albion, York and Central")
        say("#  Parkway as of 9 Oct.")
        say("#")
        say("#  IF THE CONTROL ALSO COMES BACK ZERO, THE SWEEP IS")
        say("#  BROKEN AND THE TARGET'S ZERO MEANS NOTHING.")
        say("#" * 72)
        out["control"] = run("control", FILMS["control"],
                             FILMS["control"]["dates"], workers,
                             probe_only, False)
        write_csvs("control", out["control"], stamp)

        t = out[film]
        c = out["control"]
        tt = t["cpx_shows"] + sum(r["shows"] for r in t["cc_markets"])
        cc = c["cpx_shows"] + sum(r["shows"] for r in c["cc_markets"])
        say("\n" + "=" * 72)
        say("  TARGET vs CONTROL  -  this is the only line that matters")
        say("=" * 72)
        say(f"    target   {FILMS[film]['title'][:40]:<42} {tt:>6} showtimes")
        say(f"    control  {FILMS['control']['title'][:40]:<42} {cc:>6} showtimes")
        say("")
        if cc == 0:
            say("    CONTROL IS ZERO. The pipeline is broken or blocked.")
            say("    Every zero in this run is MEANINGLESS. Fix the")
            say("    endpoints before drawing any conclusion.")
        elif tt == 0:
            say("    Control reads fine, target is zero. So the target")
            say("    genuinely is NOT ON SALE IN CANADA. That is a")
            say("    finding and it is publishable.")
        else:
            say(f"    Both read. Target is {tt/cc*100:.0f}% of the control's")
            say("    footprint. Control opened on 74-78 screens, so that")
            say("    ratio is a rough screen-count read.")
        say("=" * 72)

    say(f"\n  csv + json:  {folder}")
    say("  full log:    canada_sweep.txt")
    say("")
    say("  PASTE BACK: the VERDICT block, and the TARGET vs CONTROL")
    say("  block. Those two are enough for me to work from.")

    with open("canada_sweep.txt", "w", encoding="utf-8") as fh:
        fh.write("\n".join(_OUT) + "\n")
    print("\nWritten: canada_sweep.txt")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        with open("canada_sweep.txt", "w", encoding="utf-8") as fh:
            fh.write("\n".join(_OUT) + "\n[interrupted]\n")
        print("\ninterrupted - partial log in canada_sweep.txt")
