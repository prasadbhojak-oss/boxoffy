#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Boxoffy - RAMAYANA, the TWO North American cuts.   Standalone, one file.
Built 10 October 2026, T-27 to release.

================================================================
WHY THIS EXISTS
================================================================
Sony is releasing TWO different films in the United States:

  HINDI    "Ramayana"                     3h 15m   songs + interval
  ENGLISH  "Ramayana: Rise of a Legend"   2h 45m   neither

AMC lists them as separate releases with separate runtimes.
Our pipeline has been reading ONE Fandango id - 245446 - and
every location, showtime and ticket figure we have published is
therefore the Hindi cut alone.

That is not a small gap. Every Indian film in North America has
been bidding for the same ~1,250 theatres with a South Asian
catchment; the record is Pushpa 2 at 1,245. A 2h45m English cut
with no interval books well outside that circuit. If the English
version is real and wide, it is the half of this release that
decides whether Ramayana breaks the ceiling - and it is the half
we have been blind to.

================================================================
WHAT IT DOES, IN ORDER
================================================================
1. RESOLVE. Searches Fandango for "Ramayana" and keeps every
   2026 result rather than trusting a hardcoded id. Then opens
   each candidate's overview page and reads the TITLE and the
   RUNTIME off it, because runtime is what separates the two
   cuts cleanly: 195 minutes is Hindi, 165 is English.

   It also rejects the decoys by name. There is a 1992 animated
   "Ramayana: The Legend of Prince Rama" and a "Prince of Light"
   in these catalogues, and a naive substring match on
   "ramayana" picks them up and invents a footprint.

2. FOOTPRINT. For each resolved id, sweeps one postcode per
   metro across 46 metros and counts sites, showtimes, chains
   and formats - per version, per date.

3. REPORT. Side by side. The two cuts are NEVER summed. A film
   playing a 3h15m Hindi show and a 2h45m English show in the
   same building is two bookings, and conflating them is how you
   end up reporting a width that does not exist.

================================================================
WHAT IT DELIBERATELY DOES NOT DO
================================================================
No seat maps. This is a width-and-identity question, not an
occupancy one, and seat maps are the slow part. Once this prints
the two ids, feed them to na_presale.py for the deep read:

    python na_presale.py --film in-ramayana 2026-11-06 --workers 10

================================================================
RUN IT
================================================================
    cd /d C:\\Users\\palla\\boxoffy
    python ramayana_versions.py

    python ramayana_versions.py --resolve-only     ids only, ~30s
    python ramayana_versions.py 2026-11-06         one date
    python ramayana_versions.py --all-zips         401 zips, slow
    python ramayana_versions.py --control          add Godzilla

Writes ramayana_versions.txt and intel\\ramayana-versions-<stamp>\\
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

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")
PAUSE = 0.35
TIMEOUT = 25

# Known from our own work. The resolver does not depend on these - they are
# here so the report can say "this is the one we have been sweeping".
KNOWN_HINDI_FID = "245446"

# Runtime is the cleanest discriminator we have. Sony's two US cuts are
# 3h15m and 2h45m, a 30-minute gap, so a +/- 12 minute window around each
# cannot collide.
HINDI_MIN, ENGLISH_MIN, TOL = 195, 165, 12

DEFAULT_DATES = ["2026-11-04", "2026-11-05", "2026-11-06",
                 "2026-11-07", "2026-11-08"]

# Decoys. All three are real entries in real catalogues.
REJECT = ["legend of prince rama", "prince of light", "prince rama",
          "sampoorna", "ramayan "]

# One postcode per metro. The full 401-zip list in na_presale.py is for
# counting every site; this is for comparing two versions against each
# other, and a consistent one-per-metro sample does that in a tenth of
# the calls. --all-zips switches to the full list if you want the count.
ZIPS1 = {
    "LA": "90028", "SF Bay": "94102", "Sacramento": "95814", "San Diego": "92101",
    "Fresno/Cent CA": "93711", "DFW": "75201", "Houston": "77002", "Austin": "78701",
    "San Antonio": "78205", "Chicago": "60601", "NY/NJ": "10036", "Edison NJ": "08820",
    "Philadelphia": "19103", "Boston": "02116", "DC/MD/VA": "20001", "Baltimore": "21201",
    "Atlanta": "30303", "Miami": "33130", "Orlando": "32801", "Tampa": "33602",
    "Charlotte": "28202", "Raleigh": "27601", "Nashville": "37203", "Detroit": "48226",
    "Cleveland": "44113", "Columbus": "43215", "Indianapolis": "46204", "Minnesota": "55401",
    "Milwaukee": "53202", "St Louis": "63101", "Kansas City": "64106", "Denver": "80202",
    "Phoenix": "85004", "Las Vegas": "89101", "Salt Lake": "84101", "Seattle": "98101",
    "Portland": "97205", "Oklahoma": "73102", "New Orleans": "70112", "Memphis": "38103",
    "Louisville": "40202", "Pittsburgh": "15222", "Buffalo": "14202", "Richmond": "23219",
    "Hartford": "06103", "Albuquerque": "87102",
}

_CTX = ssl.create_default_context()
_OUT = []


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
                looks = "json" in (r.headers.get("Content-Type") or "").lower() \
                        or txt[:1] in "[{"
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
    h = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", h or "")
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    h = (h.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"')
          .replace("&nbsp;", " "))
    return re.sub(r"\s+", " ", h).strip()


def chain_of(name):
    n = (name or "").lower()
    for key, lab in (("amc", "AMC"), ("regal", "Regal"), ("cinemark", "Cinemark"),
                     ("century", "Cinemark"), ("tinseltown", "Cinemark"),
                     ("cut! by", "Cinemark"), ("marcus", "Marcus"),
                     ("harkins", "Harkins"), ("studio movie grill", "SMG"),
                     ("alamo", "Alamo"), ("showcase", "Showcase"), ("b&b", "B&B"),
                     ("cinepolis", "Cinepolis"), ("emagine", "Emagine"),
                     ("mjr", "MJR"), ("galaxy", "Galaxy"), ("ipic", "iPic")):
        if key in n:
            return lab
    if "look" in n and "cinema" in n:
        return "LOOK"
    return "Independent"


# =================================================================
#  1.  RESOLVE  -  find every Ramayana id, then tell them apart
# =================================================================
def search_fandango(q):
    """Returns [(slug, fid)]. Same pattern india_na.py has proven."""
    h = {"Accept": "text/html,application/xhtml+xml"}
    out = []
    for url in (f"https://www.fandango.com/search?q={urllib.parse.quote_plus(q)}",
                f"https://www.fandango.com/search/?q={urllib.parse.quote_plus(q)}"):
        st, html = get(url, h, want_json=False)
        if st != 200 or not isinstance(html, str):
            say(f"      search '{q}' -> HTTP {st}")
            continue
        for slug, fid in re.findall(
                r"/([a-z0-9\-]+?)-(\d{6})/movie-(?:times|overview)", html):
            if (slug, fid) not in out:
                out.append((slug, fid))
        if out:
            break
    return out


RUNTIME_RE = [
    re.compile(r"(\d)\s*hr?\s*(\d{1,2})\s*min", re.I),
    re.compile(r"(\d)\s*h\s*(\d{1,2})\s*m\b", re.I),
    re.compile(r"PT(\d+)H(\d+)M"),
]


def overview(slug, fid):
    """Open the film page and read title + runtime. Runtime is what tells the
    two cuts apart; title alone is unreliable because Fandango sometimes
    carries both as plain 'Ramayana'."""
    html, st = "", 0
    for page in ("movie-overview", "movie-times"):
        u = f"https://www.fandango.com/{slug}-{fid}/{page}"
        st, body = get(u, {"Accept": "text/html"}, want_json=False)
        if st == 200 and isinstance(body, str) and len(body) > 2000:
            html, url = body, u
            break
    if not html:
        return {"slug": slug, "fid": fid, "http": st, "title": "", "minutes": None}
    txt = strip_tags(html)
    mins = None
    for rx in RUNTIME_RE:
        m = rx.search(html) or rx.search(txt)
        if m:
            mins = int(m.group(1)) * 60 + int(m.group(2))
            break
    title = ""
    for rx in (r"<title[^>]*>(.*?)</title>",
               r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',
               r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title',
               r'"name"\s*:\s*"([^"]{3,120})"\s*,\s*"@type"\s*:\s*"Movie"',
               r'"@type"\s*:\s*"Movie".{0,400}?"name"\s*:\s*"([^"]{3,120})"'):
        t = re.search(rx, html, re.I | re.S)
        if t:
            title = strip_tags(t.group(1))
            break
    title = re.sub(r"\s*[|\-]\s*(Fandango|Movie Tickets).*$", "", title,
                   flags=re.I).strip()
    lang = ""
    low = (title + " " + txt[:1500]).lower()
    if "hindi" in low:
        lang = "Hindi"
    if "english" in low and "subtitle" not in low:
        lang = lang or "English"
    return {"slug": slug, "fid": fid, "http": st, "title": title,
            "minutes": mins, "langHint": lang, "url": url}


def classify(c):
    """Runtime first, title second. 195 min is the Hindi cut, 165 the English,
    and a 30-minute gap means a +/-12 window cannot collide."""
    # Hyphens -> spaces, because the REJECT patterns are written in prose
    # but half of what we match against is a URL slug. Without this,
    # "ramayana-the-legend-of-prince-rama" sails straight past the guard.
    name = ((c.get("title") or "") + " " + (c.get("slug") or "")).lower()
    name = re.sub(r"[-_/]+", " ", name)
    name = re.sub(r"\s+", " ", name) + " "
    # The slug alone settles it when the page gives us nothing: Fandango's
    # slug for the English cut carries the full title.
    if "rise-of-a-legend" in name or "rise of a legend" in name:
        for bad in REJECT:
            if bad in name:
                return "REJECT decoy"
        return "ENGLISH"
    for bad in REJECT:
        if bad in name:
            return "REJECT decoy"
    m = c.get("minutes")
    if m is not None:
        if abs(m - HINDI_MIN) <= TOL:
            return "HINDI"
        if abs(m - ENGLISH_MIN) <= TOL:
            return "ENGLISH"
    if "rise of a legend" in name:
        return "ENGLISH"
    if c.get("langHint") == "Hindi":
        return "HINDI"
    if c.get("langHint") == "English":
        return "ENGLISH"
    return "UNKNOWN"


def resolve():
    say("=" * 70)
    say("  1 of 2   RESOLVE - which Fandango ids exist for Ramayana")
    say("=" * 70)
    cands = []
    for q in ("Ramayana", "Ramayana Rise of a Legend", "Ramayana 2026"):
        for slug, fid in search_fandango(q):
            if fid not in [c[1] for c in cands]:
                cands.append((slug, fid))
        time.sleep(PAUSE)
    if not cands:
        say("\n  Fandango search returned nothing. Either the search page")
        say("  changed shape or we are being blocked. A 403 is an answer:")
        say("  do not retry in a loop, check by hand.")
        return {}
    say(f"\n  {len(cands)} candidate id(s) from search:\n")
    found = {}
    for slug, fid in cands:
        c = overview(slug, fid)
        kind = classify(c)
        rt = f"{c['minutes']} min" if c.get("minutes") else "runtime ?"
        flag = "  <- the id we have been sweeping" if fid == KNOWN_HINDI_FID else ""
        nm = c["title"] or f"(no title)  slug={slug[:38]}"
        say(f"    {kind:<13} {fid}  {rt:<11} {nm[:52]}{flag}")
        if kind in ("HINDI", "ENGLISH") and kind not in found:
            found[kind] = c
        time.sleep(PAUSE)

    say("")
    if "HINDI" in found and "ENGLISH" in found:
        say("  BOTH CUTS RESOLVED. This is the finding - the English cut has")
        say("  its own id and our sweep has never touched it.")
    elif "HINDI" in found:
        say("  Only the Hindi cut resolved. Either the English cut has not")
        say("  been loaded into Fandango yet, or it is not a separate")
        say("  Fandango listing at all. Check AMC by hand before concluding -")
        say("  AMC is where the two runtimes were seen.")
    elif "ENGLISH" in found:
        say("  Only the English cut resolved. Unexpected - check by hand.")
    else:
        say("  Neither cut classified. Runtimes may not be on the page yet.")
        say("  Nothing below is reliable; re-run closer to release.")
    return found


# =================================================================
#  2.  FOOTPRINT  -  per version, per date
# =================================================================
def api_hdr(slug):
    return {"Accept": "application/json, text/plain, */*",
            "Referer": f"https://www.fandango.com/{slug}/movie-times",
            "Origin": "https://www.fandango.com",
            "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
            "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"'}


def footprint(cut, c, date, zips):
    sites, shows, seen = {}, [], set()
    hdr = api_hdr(f"{c['slug']}-{c['fid']}")
    bad = 0
    for i, (metro, z) in enumerate(zips.items(), 1):
        url = (f"https://www.fandango.com/napi/theaterShowtimeGroupings/"
               f"{c['fid']}/{date}?isdesktop=true&postalCode={z}&zip={z}"
               f"&isDesktopMOP=true")
        st, js = get(url, hdr, tries=1)
        if st != 200 or not isinstance(js, dict):
            bad += 1
            if bad in (5, 15, 30):
                say(f"        {bad} non-200s. Backing off 20s.")
                time.sleep(20)
        else:
            ts = js.get("theaterShowtimes") or {}
            for th in ts.get("theaters") or []:
                tid = str(th.get("id") or th.get("theaterId") or "")
                nm = th.get("name") or th.get("theaterName") or ""
                if not tid:
                    continue
                sites.setdefault(tid, {"theatreId": tid, "name": nm,
                                       "chain": chain_of(nm), "metro": metro})
                for var in th.get("variants") or []:
                    fmt = var.get("filmFormatHeader") or ""
                    for grp in var.get("amenityGroups") or []:
                        for s in grp.get("showtimes") or []:
                            h = s.get("showtimeHashCode") or \
                                f"{tid}|{s.get('date')}|{fmt}"
                            if h in seen:
                                continue
                            seen.add(h)
                            shows.append({"cut": cut, "date": date,
                                          "theatreId": tid, "theatre": nm,
                                          "chain": chain_of(nm), "metro": metro,
                                          "format": fmt,
                                          "time": s.get("date", ""),
                                          "soldOut": s.get("isSoldOut", "")})
        if i % 12 == 0 or i == len(zips):
            say(f"      [{i:>2}/{len(zips)}] {len(sites)} sites, {len(shows)} shows")
        time.sleep(PAUSE)
    return sites, shows


def main():
    args = sys.argv[1:]
    dates = [a for a in args if re.fullmatch(r"20\d\d-\d\d-\d\d", a)] or DEFAULT_DATES
    resolve_only = "--resolve-only" in args
    all_zips = "--all-zips" in args
    zips = ZIPS1
    if all_zips:
        say("  --all-zips given but this standalone carries one zip per metro.")
        say("  For the full 401-zip count use na_presale.py with the ids below.")

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    say("")
    say("#" * 70)
    say("#  BOXOFFY  -  RAMAYANA, THE TWO NORTH AMERICAN CUTS")
    say(f"#  {dt.datetime.now():%Y-%m-%d %H:%M}")
    say("#")
    say("#  Hindi   'Ramayana'                   3h 15m  songs + interval")
    say("#  English 'Ramayana: Rise of a Legend' 2h 45m  neither")
    say("#")
    say("#  We have been sweeping one id. If the English cut has its own,")
    say("#  every number we have published is the Hindi cut alone.")
    say("#" * 70)

    found = resolve()
    if resolve_only or not found:
        done(stamp, {}, {})
        return 0

    say("")
    say("=" * 70)
    say(f"  2 of 2   FOOTPRINT - {len(zips)} metros x {len(dates)} dates x "
        f"{len(found)} cut(s)")
    say("=" * 70)

    allsites, allshows = {}, {}
    for cut, c in found.items():
        allsites[cut], allshows[cut] = {}, []
        for d in dates:
            say(f"\n    {cut}  {d}   (fid {c['fid']})")
            s, sh = footprint(cut, c, d, zips)
            for k, v in s.items():
                allsites[cut].setdefault(k, v)
            allshows[cut] += sh
            say(f"      {d}: {len(s)} sites, {len(sh)} showtimes")

    report(found, allsites, allshows, dates)
    done(stamp, allsites, allshows)
    return 0


def report(found, allsites, allshows, dates):
    say("\n" + "=" * 70)
    say("  SIDE BY SIDE  -  the two cuts are never summed")
    say("=" * 70)
    say(f"    {'':<10} {'fid':>8} {'runtime':>9} {'sites':>7} {'showtimes':>10}")
    for cut in ("HINDI", "ENGLISH"):
        if cut not in found:
            say(f"    {cut:<10} {'not resolved':>36}")
            continue
        c = found[cut]
        say(f"    {cut:<10} {c['fid']:>8} {str(c.get('minutes') or '?')+' m':>9} "
            f"{len(allsites[cut]):>7} {len(allshows[cut]):>10}")

    if "HINDI" in found and "ENGLISH" in found:
        h, e = len(allsites["HINDI"]), len(allsites["ENGLISH"])
        hs = {k for k in allsites["HINDI"]}
        es = {k for k in allsites["ENGLISH"]}
        say("")
        say(f"    sites playing BOTH cuts      {len(hs & es)}")
        say(f"    Hindi only                   {len(hs - es)}")
        say(f"    English only                 {len(es - hs)}")
        say(f"    distinct sites, either cut   {len(hs | es)}")
        say("")
        say("    The 'English only' line is the one that matters. Those are")
        say("    cinemas that would not take a 3h15m subtitled Hindi film.")
        say("    Every Indian release has been fighting over the same ~1,250")
        say("    theatres; the record is Pushpa 2 at 1,245. English-only")
        say("    sites are how this film gets past that, or does not.")
        if e > 0:
            say(f"\n    English is {e/max(h,1)*100:.0f}% of the Hindi footprint.")

    for cut in found:
        if not allshows[cut]:
            continue
        say(f"\n    --- {cut}: BY CHAIN ---")
        cc = Counter(s["chain"] for s in allshows[cut])
        for k, v in cc.most_common(10):
            ns = len({s["theatreId"] for s in allshows[cut] if s["chain"] == k})
            say(f"      {k:<14} {ns:>4} sites  {v:>5} shows")
        say(f"    --- {cut}: BY FORMAT ---")
        for k, v in Counter(s["format"] or "(none)"
                            for s in allshows[cut]).most_common():
            say(f"      {k:<22} {v:>5} shows")
        say(f"    --- {cut}: BY DATE ---")
        for d in dates:
            n = len([s for s in allshows[cut] if s["date"] == d])
            ns = len({s["theatreId"] for s in allshows[cut] if s["date"] == d})
            say(f"      {d}   {ns:>4} sites  {n:>5} shows")

    say("\n" + "=" * 70)
    say("  WHAT TO DO WITH THIS")
    say("=" * 70)
    if "ENGLISH" in found:
        say(f"    Add the English id to india_na_slate.json as a SEPARATE film:")
        say(f'      "in-ramayana-en": {{"fid": "{found["ENGLISH"]["fid"]}", ...}}')
        say("    Then run na_presale.py on both for the seat-map read. Report")
        say("    them as two lines. Never one.")
    else:
        say("    No English id resolved. Before concluding it does not exist,")
        say("    open AMC by hand - AMC is where the two runtimes were seen,")
        say("    and AMC is robots-blocked to us.")
    say("")
    say("    PASTE BACK the SIDE BY SIDE block. That is all I need.")
    say("=" * 70)


def done(stamp, allsites, allshows):
    d = os.path.join("intel", f"ramayana-versions-{stamp}")
    try:
        os.makedirs(d, exist_ok=True)
        for cut, rows in (allshows or {}).items():
            if not rows:
                continue
            with open(os.path.join(d, f"shows_{cut.lower()}.csv"), "w",
                      newline="", encoding="utf-8") as fh:
                w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
        say(f"\n  csv: {d}")
    except Exception as e:
        say(f"\n  could not write csv: {e}")
    with open("ramayana_versions.txt", "w", encoding="utf-8") as fh:
        fh.write("\n".join(_OUT) + "\n")
    print("\nWritten: ramayana_versions.txt")


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        with open("ramayana_versions.txt", "w", encoding="utf-8") as fh:
            fh.write("\n".join(_OUT) + "\n[interrupted]\n")
        print("\ninterrupted - partial log in ramayana_versions.txt")
