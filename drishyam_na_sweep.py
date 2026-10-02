#!/usr/bin/env python3
"""
Boxoffy - Drishyam: The Conclusion - North America seat sweep  (v2)
Run:  python drishyam_na_sweep.py

v2 fixes, both confirmed against live responses by probe.py:
  * Fandango 403 -> load the film page first so Akamai sets its cookies,
    then reuse that session for every API call.
  * Cineplex "0 theatres" -> the payload is favourite/nearby/otherTheatres,
    keyed theatreId / theatreName with city+province under .location.
  * Format is real now: variants[].filmFormatHeader plus the amenity names.

Writes into ./intel/na-2026-10-02/ . Stdlib only. Python 3.8+.
"""

import json, os, csv, time, gzip, io, datetime
import urllib.request, urllib.error, http.cookiejar

DATE = "2026-10-02"
FID  = "247556"
CPX_FILM = "62159"
CPX_KEY  = "477f072109904a55927ba2c3bf9f77e3"
OUT   = os.path.join("intel", "na-2026-10-02")
PAUSE = 0.35

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
API_HDR = {
    "User-Agent": UA, "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate",
    "Referer": f"https://www.fandango.com/drishyam-the-conclusion-2026-{FID}/movie-times",
    "Origin": "https://www.fandango.com",
    "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Site": "same-origin",
}

ZIPS = {
 "LA":        ["91744","92805","91745","90630","92618","91767","91406","90703","92683","91789"],
 "DFW":       ["75024","75035","75063","76013","75093","75252","75038","75075","76006","75287"],
 "SF Bay":    ["94538","95035","94085","94566","95133","94587","94536","95054","94555","94560"],
 "NY/NJ":     ["08873","07302","11375","08837","07666","10016","08820","07030","11354","08854"],
 "Atlanta":   ["30097","30022","30043","30350","30024","30092","30075","30044"],
 "Seattle":   ["98052","98007","98375","98033","98011","98034","98201","98003"],
 "N Carolina":["27560","28277","27519","27703","28273","27613","27265","28226"],
 "Florida":   ["33331","32819","33647","33029","34747","33162","33351","33584","32828","33496"],
 "Chicago":   ["60563","60540","60169","60089"],
 "Houston":   ["77450","77494","77082","77584"],
 "DC":        ["20171","22031","20850","20147"],
 "Boston":    ["01803","02451","01720"],
 "Phoenix":   ["85226","85248"],
 "Detroit":   ["48377","48375"],
}

LOG = []
def log(*a):
    s = " ".join(str(x) for x in a); LOG.append(s)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get(url, hdrs, tries=3):
    """Returns (status, parsed_json_or_None)."""
    for a in range(tries):
        try:
            with opener.open(urllib.request.Request(url, headers=hdrs), timeout=30) as r:
                if r.status == 204:
                    return 204, None
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                txt = raw.decode("utf-8", "replace").strip()
                return r.status, (json.loads(txt) if txt else None)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and a < tries - 1:
                time.sleep(2 * (a + 1)); continue
            return e.code, None
        except Exception as e:
            if a < tries - 1:
                time.sleep(1.5 * (a + 1)); continue
            log(f"  EXC {type(e).__name__}: {e}")
            return 0, None
    return 0, None


def warm_session():
    """Akamai hands out cookies on the film page. Without them the API 403s."""
    h = dict(API_HDR)
    h["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    h["Sec-Fetch-Dest"] = "document"; h["Sec-Fetch-Mode"] = "navigate"
    h.pop("Origin", None); h.pop("Referer", None)
    st, _ = get(f"https://www.fandango.com/drishyam-the-conclusion-2026-{FID}/movie-times", h)
    log(f"session warm-up: HTTP {st}; cookies = {[c.name for c in jar]}")
    return st == 200


def chain_of(name):
    n = (name or "").lower()
    for k, v in (("amc", "AMC"), ("regal", "Regal"), ("cinemark", "Cinemark"),
                 ("cinepolis", "Cinepolis"), ("cinépolis", "Cinepolis"),
                 ("marcus", "Marcus"), ("harkins", "Harkins"), ("alamo", "Alamo"),
                 ("studio movie grill", "SMG"), ("ipic", "iPic"),
                 ("showcase", "Showcase"), ("bow tie", "Bow Tie"),
                 ("b&b", "B&B"), ("megaplex", "Megaplex")):
        if k in n:
            return v
    return "Independent/Desi"


def parse_fandango(payload, metro, zipc, theatres, shows):
    """Shape: theaterShowtimes.theaters[] -> variants[] -> amenityGroups[] -> showtimes[]"""
    ts = (payload or {}).get("theaterShowtimes") or {}
    found = 0
    for th in ts.get("theaters") or []:
        tid = th.get("id") or th.get("theaterId")
        name = th.get("name") or ""
        if not tid or not name:
            continue
        found += 1
        if tid not in theatres:
            theatres[tid] = {"theatreId": tid, "name": name, "chain": chain_of(name),
                             "metro": metro, "zipFound": zipc,
                             "pageUrl": th.get("theaterPageUrl", ""),
                             "isTicketing": th.get("isTicketing", "")}
        for var in th.get("variants") or []:
            fmt = var.get("filmFormatHeader") or ""
            for grp in var.get("amenityGroups") or []:
                ams = ", ".join(a.get("name", "") for a in (grp.get("amenities") or []))
                for st in grp.get("showtimes") or []:
                    shows.append({
                        "theatreId": tid, "theatre": name, "chain": chain_of(name),
                        "metro": metro, "format": fmt, "amenities": ams,
                        "reservedSeating": grp.get("hasReservedSeating", ""),
                        "time": st.get("date", ""), "dateLocal": st.get("dateLocal", ""),
                        "isSoldOut": st.get("isSoldOut", ""),
                        "hash": st.get("showtimeHashCode", ""),
                    })
    return found


def sweep_fandango():
    theatres, shows = {}, []
    for metro, zips in ZIPS.items():
        for z in zips:
            url = (f"https://www.fandango.com/napi/theaterShowtimeGroupings/{FID}/{DATE}"
                   f"?isdesktop=true&postalCode={z}&zip={z}&isDesktopMOP=true")
            st, data = get(url, API_HDR)
            time.sleep(PAUSE)
            if st != 200 or not data:
                log(f"FANDANGO {metro} {z} HTTP {st}")
                continue
            n = parse_fandango(data, metro, z, theatres, shows)
            log(f"FANDANGO {metro} {z} -> {n} theatres (running total {len(theatres)})")
        print(f"  {metro}: {len(theatres)} theatres so far", flush=True)
    return theatres, shows


def seat_maps(shows):
    uniq = {}
    for s in shows:
        if s["hash"]:
            uniq.setdefault(s["hash"], None)
    log(f"seat maps to fetch: {len(uniq)}")
    for i, h in enumerate(list(uniq), 1):
        st, d = get(f"https://www.fandango.com/napi/seatMap/{h}", API_HDR)
        time.sleep(PAUSE)
        if st == 200 and isinstance(d, dict):
            uniq[h] = (d.get("totalSeatCount", ""), d.get("totalAvailableSeatCount", ""))
        else:
            log(f"  seatmap {h[:18]} HTTP {st}")
        if i % 25 == 0:
            print(f"  seat maps {i}/{len(uniq)}", flush=True)
    for s in shows:
        t, a = uniq.get(s["hash"]) or ("", "")
        s["seatsTotal"], s["seatsAvail"] = t, a
    return shows


def sweep_cineplex():
    hdr = {"Ocp-Apim-Subscription-Key": CPX_KEY, "User-Agent": UA,
           "Accept": "application/json", "Accept-Encoding": "gzip, deflate"}
    base = "https://apis.cineplex.com/prod/cpx/theatrical/api/v1"
    st, data = get(f"{base}/theatres?language=en", hdr)
    if st != 200 or not isinstance(data, dict):
        log(f"CINEPLEX theatres HTTP {st}"); return [], []
    tl = []
    for key in ("favouriteTheatres", "nearbyTheatres", "otherTheatres"):
        tl += data.get(key) or []
    log(f"CINEPLEX master list: {len(tl)} theatres")

    # the showtimes endpoint param name is uncertain - settle it on the first theatre
    param = None
    if tl:
        probe_id = tl[0].get("theatreId")
        for cand in ("locationId", "theatreId"):
            s2, _ = get(f"{base}/showtimes?language=en&filmId={CPX_FILM}"
                        f"&date={DATE}&{cand}={probe_id}", hdr)
            log(f"CINEPLEX param probe {cand}={probe_id} -> HTTP {s2}")
            time.sleep(PAUSE)
            if s2 in (200, 204):
                param = cand
                if s2 == 200:
                    break
    param = param or "locationId"
    log(f"CINEPLEX using param '{param}'")

    rows, raw = [], []
    for t in tl:
        tid = t.get("theatreId")
        if tid is None:
            continue
        s2, d = get(f"{base}/showtimes?language=en&filmId={CPX_FILM}"
                    f"&date={DATE}&{param}={tid}", hdr)
        time.sleep(PAUSE)
        if s2 == 204 or not d:
            continue                       # not playing here - normal
        loc = t.get("location") or {}
        raw.append({"theatreId": tid, "theatre": t.get("theatreName", ""), "payload": d})
        n = 0
        for exp in iter_cpx(d):
            n += 1
            rows.append({"theatreId": tid, "theatre": t.get("theatreName", ""),
                         "city": loc.get("city", ""), "province": loc.get("provinceCode", ""),
                         "time": exp.get("time", ""), "format": exp.get("format", ""),
                         "seatsAvail": exp.get("seatsAvail", "")})
        if n:
            log(f"CINEPLEX {t.get('theatreName','')} ({loc.get('city','')}) -> {n} shows")
    return rows, raw


def iter_cpx(node, fmt=""):
    """Cineplex nests experiences/sessions differently per response; walk for
    anything carrying a start time, carrying the nearest format label down."""
    if isinstance(node, dict):
        f = (node.get("experienceTypeName") or node.get("experienceType")
             or node.get("vistaFormatName") or node.get("formatName") or fmt)
        if any(k in node for k in ("showStartDateTime", "startTime", "showtime", "sessionTime")):
            yield {"time": (node.get("showStartDateTime") or node.get("startTime")
                            or node.get("showtime") or node.get("sessionTime") or ""),
                   "format": f,
                   "seatsAvail": node.get("seatsAvailable", node.get("seatsRemaining", ""))}
        for v in node.values():
            yield from iter_cpx(v, f)
    elif isinstance(node, list):
        for v in node:
            yield from iter_cpx(v, fmt)


def write_csv(path, rows, cols):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def main():
    os.makedirs(OUT, exist_ok=True)
    log(f"RUN {datetime.datetime.now().isoformat()}  date={DATE}")
    print("Warming Fandango session...", flush=True)
    if not warm_session():
        print("  WARNING: film page did not return 200; API calls may 403", flush=True)
    print("Fandango sweep...", flush=True)
    theatres, shows = sweep_fandango()
    print(f"  {len(theatres)} theatres, {len(shows)} showtimes", flush=True)
    print("Seat maps...", flush=True)
    shows = seat_maps(shows)
    print("Cineplex (Canada)...", flush=True)
    ca_rows, ca_raw = sweep_cineplex()
    print(f"  {len(ca_rows)} Canadian showtimes", flush=True)

    json.dump({"theatres": list(theatres.values()), "shows": shows},
              open(os.path.join(OUT, "fandango_raw.json"), "w"), indent=1)
    json.dump(ca_raw, open(os.path.join(OUT, "cineplex_raw.json"), "w"), indent=1)
    write_csv(os.path.join(OUT, "fandango_theatres.csv"), list(theatres.values()),
              ["theatreId", "name", "chain", "metro", "zipFound", "isTicketing", "pageUrl"])
    write_csv(os.path.join(OUT, "fandango_shows.csv"), shows,
              ["theatreId", "theatre", "chain", "metro", "format", "amenities",
               "reservedSeating", "time", "dateLocal", "isSoldOut",
               "seatsTotal", "seatsAvail", "hash"])
    write_csv(os.path.join(OUT, "cineplex_shows.csv"), ca_rows,
              ["theatreId", "theatre", "city", "province", "time", "format", "seatsAvail"])

    tot = sum(int(s["seatsTotal"]) for s in shows if str(s.get("seatsTotal", "")).isdigit())
    av  = sum(int(s["seatsAvail"]) for s in shows if str(s.get("seatsAvail", "")).isdigit())
    fmts = {}
    for s in shows:
        fmts[s["format"] or "(none)"] = fmts.get(s["format"] or "(none)", 0) + 1
    chains = {}
    for t in theatres.values():
        chains[t["chain"]] = chains.get(t["chain"], 0) + 1
    S = [f"US theatres      {len(theatres)}",
         f"US showtimes     {len(shows)}",
         f"US seats read    {tot}",
         f"US seats sold    {tot-av}" if tot else "US seats sold    n/a",
         f"US occupancy     {((tot-av)/tot*100):.1f}%" if tot else "US occupancy     n/a",
         f"sold-out shows   {sum(1 for s in shows if s.get('isSoldOut') is True)}",
         f"Canada showtimes {len(ca_rows)}",
         f"Canada theatres  {len(set(r['theatreId'] for r in ca_rows))}",
         "", "theatres by chain:  " + ", ".join(f"{k} {v}" for k, v in
                                                sorted(chains.items(), key=lambda x: -x[1])),
         "shows by format:    " + ", ".join(f"{k} {v}" for k, v in
                                            sorted(fmts.items(), key=lambda x: -x[1]))]
    LOG.extend(["", "SUMMARY"] + S)
    open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8").write("\n".join(LOG))
    print("\n".join(S))
    print(f"\nWritten to {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
