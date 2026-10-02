#!/usr/bin/env python3
"""
Boxoffy - INDIA seat sweep via District        python india_district_sweep.py

What this is
------------
District (Zomato's ticketing arm, ex Paytm Insider) server renders the ENTIRE
session grid for a city into the page's __NEXT_DATA__ blob.  Confirmed on the
live page, New Delhi, one request:

    50 cinemas, 566 sessions, 128,475 seats, 52,102 sold, 40.55% occupancy,
    and Rs 3.08 crore of advance gross.

Every session carries:
    total        seats in the auditorium
    avail        seats still free            -> sold = total - avail
    areas[]      per class: label, price, sTotal, sAvail
    audi, scrnFmt, showTime, seatStatus
and every cinema carries chainKey (PVR / INOX / ...), city, state, pincode.

So this is not an estimate and not a scrape of someone else's estimate.  It is
the exact seat count, and because the per-class prices are there, the exact
advance gross.  One HTTP request per city, no per-showtime calls, no booking
funnel touched.

Writes into ./intel/<film>-<date>/ .  Stdlib only.  Python 3.8+.  A minute or two.

    python india_district_sweep.py              -> opening day, 2 Oct
    python india_district_sweep.py 2026-10-03   -> Saturday
    python india_district_sweep.py 2026-10-04   -> Sunday
"""

import os, re, csv, json, gzip, io, sys, time, datetime, collections
import urllib.request, urllib.error, http.cookiejar

# ---------------------------------------------------------------- films
# slug and District movie id.  Add any film here, or run with "list" to have
# the script pull the current catalogue off District and print the lines for you.
FILMS = {
    "drishyam": ("drishyam-the-conclusion", "MV207254"),
    "vvan":     ("the-vvaan",               "MV183084"),
    "hanuman":  ("hanuman-ansh",            "MV225612"),
}

#   python india_district_sweep.py                       drishyam, opening day
#   python india_district_sweep.py 2026-10-03            drishyam, Saturday
#   python india_district_sweep.py vvan 2026-10-02       The Vvaan, Friday
#   python india_district_sweep.py hanuman 2026-10-03    Hanuman Ansh, Saturday
#   python india_district_sweep.py list                  print every film District lists
_args = [a for a in sys.argv[1:] if a]
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
LIST_ONLY = bool(_args) and _args[0].lower() == "list"
_dates = [a for a in _args if DATE_RE.match(a)]
_films = [a for a in _args if not DATE_RE.match(a) and a.lower() != "list"]
FILM       = (_films[0].lower() if _films else "drishyam")
DATE_LABEL = _dates[0] if _dates else "2026-10-02"
if not LIST_ONLY and FILM not in FILMS:
    print(f"Unknown film '{FILM}'. Known: {', '.join(FILMS)}")
    print("Run  python india_district_sweep.py list  to see what District is carrying.")
    sys.exit(1)
MOVIE_SLUG, MOVIE_ID = FILMS.get(FILM, ("", ""))
OUT   = os.path.join("intel", f"{FILM}-{DATE_LABEL}")
PAUSE = 0.8

CITIES = [
    "mumbai", "new-delhi", "bengaluru", "hyderabad", "chennai", "kolkata",
    "pune", "ahmedabad", "jaipur", "lucknow", "chandigarh", "indore",
    "bhopal", "nagpur", "surat", "vadodara", "rajkot", "kanpur", "patna",
    "ranchi", "bhubaneswar", "guwahati", "kochi", "coimbatore",
    "visakhapatnam", "vijayawada", "ludhiana", "amritsar", "dehradun",
    "varanasi", "agra", "meerut", "nashik", "aurangabad", "raipur",
    "gwalior", "jodhpur", "udaipur", "mysuru", "mangaluru",
    "thiruvananthapuram", "madurai", "noida", "gurgaon", "ghaziabad",
    "faridabad", "thane", "navi-mumbai", "jamshedpur", "siliguri",
]

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
HDR = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none", "Sec-Fetch-User": "?1",
}

LOG = []
def log(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True); LOG.append(s)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get(url, referer=None, tries=3):
    h = dict(HDR)
    if referer:
        h["Referer"] = referer; h["Sec-Fetch-Site"] = "same-origin"
    for a in range(tries):
        try:
            with opener.open(urllib.request.Request(url, headers=h), timeout=35) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                    except Exception: pass
                return r.status, raw.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and a < tries - 1:
                time.sleep(3 * (a + 1)); continue
            return e.code, ""
        except Exception:
            if a < tries - 1:
                time.sleep(2 * (a + 1)); continue
            return 0, ""
    return 0, ""


NEXT_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)

def next_data(html):
    m = NEXT_RE.search(html)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception:
        return None


def sessions_from(data):
    """movieSessions.<hash>.pageData.{nearbyCinemas,farCinemas}[].sessions[]"""
    try:
        ms = data["props"]["pageProps"]["data"]["serverState"]["movieSessions"]
    except Exception:
        return []
    out = []
    for blob in ms.values():
        pd = (blob or {}).get("pageData") or {}
        for bucket in ("nearbyCinemas", "farCinemas"):
            for c in pd.get(bucket) or []:
                info = c.get("cinemaInfo") or {}
                for s in (c.get("sessions") or []) + (c.get("extraSessions") or []):
                    tot = s.get("total") or 0
                    av = s.get("avail") or 0
                    gross = 0
                    classes = []
                    for ar in s.get("areas") or []:
                        st, sa = ar.get("sTotal") or 0, ar.get("sAvail") or 0
                        pr = ar.get("price") or 0
                        gross += (st - sa) * pr
                        classes.append(f"{ar.get('label','')}:{st - sa}/{st}@{pr}")
                    out.append({
                        "cinemaId": c.get("id"),
                        "cinema": info.get("name") or info.get("label") or "",
                        "chain": info.get("chainKey") or "",
                        "city": info.get("city") or "",
                        "cityKey": info.get("cityKey") or "",
                        "state": info.get("state") or "",
                        "pincode": info.get("pincode") or "",
                        "audi": s.get("audi") or "",
                        "format": s.get("scrnFmt") or "",
                        "showTime": s.get("showTime") or "",
                        "seatStatus": s.get("seatStatus") or "",
                        "seatsTotal": tot,
                        "seatsAvail": av,
                        "sold": tot - av,
                        "grossRs": gross,
                        "classes": "; ".join(classes),
                        "sessionId": s.get("encSessionId") or
                                     f"{c.get('id')}-{s.get('sid')}-{s.get('showTime')}",
                    })
    return out


def catalogue():
    """District publishes every film it carries at /movies. Print them as
    ready-made FILMS entries so a new title needs no detective work."""
    st, html = get("https://www.district.in/movies")
    if st != 200 or not html:
        print(f"could not read the catalogue (HTTP {st})"); return
    hits = re.findall(r"/movies/([a-z0-9\-]+)-movie-tickets-(MV\d+)", html, re.I)
    seen, rows = set(), []
    for slug, mid in hits:
        if mid in seen: continue
        seen.add(mid); rows.append((slug, mid))
    print(f"District is carrying {len(rows)} films. Paste any of these into FILMS:\n")
    for slug, mid in sorted(rows):
        key = slug.split("-")[0][:10]
        print(f'    "{key}": ("{slug}", "{mid}"),')


def main():
    if LIST_ONLY:
        catalogue(); return
    os.makedirs(OUT, exist_ok=True)
    log(f"RUN {datetime.datetime.now().isoformat()}   {FILM} / {MOVIE_SLUG} {MOVIE_ID}   show date {DATE_LABEL}")
    log("District, server rendered, one request per city.\n")

    st, _ = get("https://www.district.in/movies")
    log(f"session warm-up: HTTP {st}, cookies={[c.name for c in jar]}\n")
    time.sleep(PAUSE)

    seen, rows = set(), []
    for city in CITIES:
        url = (f"https://www.district.in/movies/{MOVIE_SLUG}"
               f"-movie-tickets-in-{city}-{MOVIE_ID}?fromdate={DATE_LABEL}")
        code, html = get(url, referer="https://www.district.in/movies")
        if code != 200 or not html:
            log(f"  {city:<22} HTTP {code}"); time.sleep(PAUSE); continue
        data = next_data(html)
        if not data:
            log(f"  {city:<22} no __NEXT_DATA__"); time.sleep(PAUSE); continue
        got = sessions_from(data)
        wrong = [r for r in got if r["showTime"][:10] and r["showTime"][:10] != DATE_LABEL]
        if wrong and len(wrong) == len(got):
            log(f"  {city:<22} returned {wrong[0]['showTime'][:10]}, not {DATE_LABEL} - skipped")
            time.sleep(PAUSE); continue
        got = [r for r in got if r["showTime"][:10] == DATE_LABEL]
        new = [r for r in got if r["sessionId"] not in seen]
        for r in new:
            seen.add(r["sessionId"]); rows.append(r)
        t = sum(r["seatsTotal"] for r in new)
        s = sum(r["sold"] for r in new)
        log(f"  {city:<22}{len({r['cinemaId'] for r in new}):>4} cinemas "
            f"{len(new):>5} new shows {t:>8,} seats {s:>7,} sold "
            f"{(s/t*100 if t else 0):>5.1f}%  (page had {len(got)})")
        time.sleep(PAUSE)

    cols = ["city", "state", "chain", "cinema", "cinemaId", "pincode", "audi",
            "format", "showTime", "seatStatus", "seatsTotal", "seatsAvail",
            "sold", "grossRs", "classes", "sessionId"]
    with open(os.path.join(OUT, "district_shows.csv"), "w", newline="",
              encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows: w.writerow(r)
    json.dump(rows, open(os.path.join(OUT, "district_raw.json"), "w"), indent=1)

    tot = sum(r["seatsTotal"] for r in rows)
    sold = sum(r["sold"] for r in rows)
    gross = sum(r["grossRs"] for r in rows)
    cinemas = len({r["cinemaId"] for r in rows})
    log("\n=== ALL INDIA, District only ===")
    log(f"  cinemas        {cinemas:>10,}")
    log(f"  shows          {len(rows):>10,}")
    log(f"  seats on sale  {tot:>10,}")
    log(f"  seats sold     {sold:>10,}")
    log(f"  occupancy      {(sold/tot*100 if tot else 0):>9.1f}%")
    log(f"  advance gross  Rs {gross/1e7:>7.2f} Cr")
    log(f"  average ticket Rs {(gross/sold if sold else 0):>7.0f}")

    def group(field, title, limit=None):
        g = collections.defaultdict(lambda: [0, 0, 0, set()])
        for r in rows:
            v = g[r[field] or "?"]
            v[0] += r["seatsTotal"]; v[1] += r["sold"]; v[2] += r["grossRs"]
            v[3].add(r["cinemaId"])
        log(f"\n=== BY {title} ===")
        items = sorted(g.items(), key=lambda x: -x[1][1])
        for k, v in (items[:limit] if limit else items):
            log(f"  {k[:24]:<26}{len(v[3]):>4} cin {v[1]:>8,} sold "
                f"{(v[1]/v[0]*100 if v[0] else 0):>5.1f}%  Rs {v[2]/1e7:>6.2f} Cr")

    group("chain", "CHAIN")
    group("city", "CITY", 20)
    group("state", "STATE", 15)

    log("\n=== BY TIME OF DAY ===")
    blocks = [("before noon", 0, 12), ("12-4pm", 12, 16), ("4-7pm", 16, 19),
              ("7-9pm", 19, 21), ("9pm+", 21, 24)]
    for lab, a, b in blocks:
        g = [r for r in rows if r["showTime"][11:13].isdigit()
             and a <= int(r["showTime"][11:13]) < b]
        t = sum(r["seatsTotal"] for r in g); s = sum(r["sold"] for r in g)
        log(f"  {lab:<12}{len(g):>6} shows {t:>9,} seats {s:>8,} sold "
            f"{(s/t*100 if t else 0):>5.1f}%")

    log("\n=== SEAT STATUS AS DISTRICT LABELS IT ===")
    for k, v in collections.Counter(r["seatStatus"] for r in rows).most_common():
        log(f"  {k or '(blank)':<18}{v:>6}")

    open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8").write("\n".join(LOG))
    log(f"\nWritten to {OUT}")


if __name__ == "__main__":
    main()
