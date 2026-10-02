#!/usr/bin/env python3
"""
Boxoffy - Drishyam: The Conclusion - North America COVERAGE TOP-UP
Run this AFTER drishyam_na_sweep.py has finished.  Run:  python topup.py

Why this exists
---------------
Update 1 (29 Sep) read 239 postcodes.  The v2 sweep reads 93.  Fewer postcodes
means fewer theatres discovered, so comparing 93-postcode totals against the
355-theatre Update 2 number would read as "screens were lost" when it is only
"we looked in fewer places".  This pass adds the missing geography.

It is additive and idempotent:
  * skips any theatre already present in fandango_theatres.csv
  * skips any showtime hash already present in fandango_shows.csv
  * appends to those same two CSVs and writes RUN-topup.txt

Stdlib only.  Python 3.8+.
"""

import json, os, csv, time, gzip, io, datetime
import urllib.request, urllib.error, http.cookiejar

DATE = "2026-10-02"
FID  = "247556"
OUT  = os.path.join("intel", "na-2026-10-02")
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

# ---- the geography the 93-postcode run does not reach -----------------------
# More depth inside the 14 metros already swept, plus the secondary diaspora
# markets that Update 1's 239-postcode read covered.
ZIPS = {
 # deeper inside existing metros
 "LA":        ["92831","91301","90501","92551","93065","91311","92509","90805"],
 "DFW":       ["75034","75070","76210","75010","75013","75080","76092","75234"],
 "SF Bay":    ["94539","95131","94301","94577","95014","94102","94553","95123"],
 "NY/NJ":     ["07310","08901","07102","11101","10704","08540","07728","11691"],
 "Atlanta":   ["30076","30328","30062","30309","30518","30189"],
 "Seattle":   ["98004","98040","98008","98102","98272","98296"],
 "N Carolina":["27587","27502","28105","27410","27606","28078"],
 "Florida":   ["33324","33186","33612","32792","33069","34211","33606","32256"],
 "Chicago":   ["60504","60532","60103","60201","60611","60559","60446","60010"],
 "Houston":   ["77096","77479","77024","77069","77381","77002"],
 "DC":        ["20852","22102","20902","22314","20705","21029"],
 "Boston":    ["02140","01701","02062","01890","02339"],
 "Phoenix":   ["85004","85281","85308","85382"],
 "Detroit":   ["48098","48167","48316","48108"],
 # secondary markets not in the 93
 "Philadelphia": ["19406","19087","19002","19103","08002"],
 "Minneapolis":  ["55344","55425","55113","55439"],
 "Denver":       ["80021","80112","80202","80027"],
 "Portland":     ["97006","97223","97201"],
 "San Diego":    ["92126","92127","92101"],
 "Austin":       ["78717","78759","78613"],
 "San Antonio":  ["78258","78249"],
 "Nashville":    ["37067","37203"],
 "Charlotte NC": ["28202"],
 "Columbus":     ["43016","43240"],
 "Cleveland":    ["44141","44114"],
 "Pittsburgh":   ["15237","15222"],
 "Indianapolis": ["46032","46204"],
 "Milwaukee":    ["53045","53202"],
 "St Louis":     ["63017","63101"],
 "Kansas City":  ["66210","64114"],
 "Salt Lake":    ["84070","84101"],
 "Las Vegas":    ["89135","89109"],
 "Sacramento":   ["95630","95814"],
 "Hartford":     ["06032","06103"],
 "Baltimore":    ["21045","21201"],
 "Richmond":     ["23060"],
 "Virginia Bch": ["23455"],
 "Jacksonville": ["32256"],
 "New Orleans":  ["70130"],
 "Oklahoma City":["73134"],
 "Omaha":        ["68130"],
 "Buffalo":      ["14221"],
 "Rochester":    ["14623"],
 "Albany":       ["12110"],
 "Providence":   ["02903"],
 "Orlando extra":["32751"],
 "Tampa extra":  ["33511"],
 "Memphis":      ["38120"],
 "Louisville":   ["40222"],
 "Cincinnati":   ["45040"],
 "Des Moines":   ["50266"],
 "Madison":      ["53719"],
 "Raleigh extra":["27617"],
}

LOG = []
def log(*a):
    s = " ".join(str(x) for x in a); LOG.append(s)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get(url, hdrs, tries=3):
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
    h = dict(API_HDR)
    h["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    h["Sec-Fetch-Dest"] = "document"; h["Sec-Fetch-Mode"] = "navigate"
    h.pop("Origin", None); h.pop("Referer", None)
    st, _ = get(f"https://www.fandango.com/drishyam-the-conclusion-2026-{FID}/movie-times", h)
    log(f"session warm-up: HTTP {st}; cookies = {[c.name for c in jar]}")
    return st == 200


def chain_of(name):
    n = (name or "").lower()
    if "amc" in n: return "AMC"
    if "regal" in n: return "Regal"
    if "cinemark" in n or "century" in n or "tinseltown" in n: return "Cinemark"
    if "marcus" in n: return "Marcus"
    if "harkins" in n: return "Harkins"
    if "studio movie grill" in n: return "SMG"
    if "b&b" in n or "b & b" in n: return "B&B"
    if "cinepolis" in n or "cinépolis" in n: return "Cinepolis"
    if "look" in n and "cinema" in n: return "LOOK"
    return "Other"


def parse(payload, metro, zipc, theatres, shows, known_th, known_hash):
    """theaterShowtimes.theaters[] -> variants[] -> amenityGroups[] -> showtimes[]"""
    new_t = new_s = 0
    ts = (payload or {}).get("theaterShowtimes") or {}
    for th in ts.get("theaters") or []:
        tid = str(th.get("id") or th.get("theaterId") or th.get("theaterid") or "")
        nm = th.get("name") or th.get("theaterName") or ""
        if not tid:
            continue
        if tid not in known_th and tid not in theatres:
            theatres[tid] = {"theatreId": tid, "name": nm, "chain": chain_of(nm),
                             "metro": metro, "zipFound": zipc,
                             "isTicketing": th.get("isTicketing", ""),
                             "pageUrl": th.get("theaterPageUrl", "")}
            new_t += 1
        for var in th.get("variants") or []:
            fmt = var.get("filmFormatHeader") or ""
            for grp in var.get("amenityGroups") or []:
                ams = ", ".join(a.get("name", "") for a in (grp.get("amenities") or []))
                res = grp.get("hasReservedSeating", "")
                for st in grp.get("showtimes") or []:
                    h = st.get("showtimeHashCode", "")
                    if h and h in known_hash:
                        continue
                    if h:
                        known_hash.add(h)
                    shows.append({"theatreId": tid, "theatre": nm, "chain": chain_of(nm),
                                  "metro": metro, "format": fmt, "amenities": ams,
                                  "reservedSeating": res,
                                  "time": st.get("date", ""), "dateLocal": st.get("dateLocal", ""),
                                  "isSoldOut": st.get("isSoldOut", ""),
                                  "seatsTotal": "", "seatsAvail": "", "hash": h})
                    new_s += 1
    return new_t, new_s


def main():
    if not os.path.isdir(OUT):
        print(f"ERROR: {OUT} not found. Run drishyam_na_sweep.py first.")
        return

    # what the main sweep already has
    known_th, known_hash = set(), set()
    tpath = os.path.join(OUT, "fandango_theatres.csv")
    spath = os.path.join(OUT, "fandango_shows.csv")
    if os.path.exists(tpath):
        with open(tpath, encoding="utf-8") as f:
            known_th = {r["theatreId"] for r in csv.DictReader(f) if r.get("theatreId")}
    if os.path.exists(spath):
        with open(spath, encoding="utf-8") as f:
            known_hash = {r["hash"] for r in csv.DictReader(f) if r.get("hash")}
    print(f"already on file: {len(known_th)} theatres, {len(known_hash)} showtimes")
    log(f"TOPUP {datetime.datetime.now().isoformat()}  baseline "
        f"{len(known_th)} theatres / {len(known_hash)} showtimes")

    print("Warming Fandango session...", flush=True)
    if not warm_session():
        print("  WARNING: film page did not return 200; API calls may 403", flush=True)

    npc = sum(len(v) for v in ZIPS.values())
    print(f"Top-up sweep over {npc} new postcodes in {len(ZIPS)} markets...", flush=True)
    theatres, shows = {}, []
    i = 0
    for metro, zl in ZIPS.items():
        for z in zl:
            i += 1
            url = (f"https://www.fandango.com/napi/theaterShowtimeGroupings/{FID}/{DATE}"
                   f"?isdesktop=true&postalCode={z}&zip={z}&isDesktopMOP=true")
            st, js = get(url, API_HDR)
            if st != 200 or js is None:
                log(f"FANDANGO {metro} {z} HTTP {st}")
            else:
                nt, ns = parse(js, metro, z, theatres, shows, known_th, known_hash)
                log(f"FANDANGO {metro} {z} +{nt} theatres +{ns} shows")
            if i % 20 == 0:
                print(f"  {i}/{npc} postcodes, {len(theatres)} new theatres, "
                      f"{len(shows)} new shows", flush=True)
            time.sleep(PAUSE)
    print(f"  discovery done: {len(theatres)} new theatres, {len(shows)} new showtimes",
          flush=True)

    # seat maps for the new showtimes only
    print("Seat maps for new showtimes...", flush=True)
    cache, done = {}, 0
    uniq = [s for s in shows if s["hash"]]
    for s in uniq:
        h = s["hash"]
        if h not in cache:
            st, js = get(f"https://www.fandango.com/napi/seatMap/{h}", API_HDR)
            cache[h] = ((js or {}).get("totalSeatCount", ""),
                        (js or {}).get("totalAvailableSeatCount", "")) if st == 200 else ("", "")
            time.sleep(PAUSE)
        s["seatsTotal"], s["seatsAvail"] = cache[h]
        done += 1
        if done % 25 == 0:
            print(f"  {done}/{len(uniq)} seat maps", flush=True)

    # append
    tcols = ["theatreId", "name", "chain", "metro", "zipFound", "isTicketing", "pageUrl"]
    scols = ["theatreId", "theatre", "chain", "metro", "format", "amenities",
             "reservedSeating", "time", "dateLocal", "isSoldOut",
             "seatsTotal", "seatsAvail", "hash"]
    for path, cols, rows in ((tpath, tcols, list(theatres.values())), (spath, scols, shows)):
        exists = os.path.exists(path)
        with open(path, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
            if not exists:
                w.writeheader()
            for r in rows:
                w.writerow(r)

    json.dump({"theatres": list(theatres.values()), "shows": shows},
              open(os.path.join(OUT, "fandango_topup_raw.json"), "w"), indent=1)

    tot = sum(int(s["seatsTotal"]) for s in shows if str(s["seatsTotal"]).isdigit())
    av  = sum(int(s["seatsAvail"]) for s in shows if str(s["seatsAvail"]).isdigit())
    S = [f"new theatres     {len(theatres)}",
         f"new showtimes    {len(shows)}",
         f"new seats        {tot}",
         (f"new seats sold   {tot-av}" if tot else "new seats sold   n/a"),
         (f"new occupancy    {((tot-av)/tot*100):.1f}%" if tot else "new occupancy    n/a"),
         f"combined theatres  {len(known_th)+len(theatres)}",
         f"combined showtimes {len(known_hash)}"]
    log("\nTOPUP SUMMARY"); [log(x) for x in S]
    open(os.path.join(OUT, "RUN-topup.txt"), "w", encoding="utf-8").write("\n".join(LOG))
    print("\n".join(S))
    print(f"\nAppended to {tpath} and {spath}. Log: RUN-topup.txt")


if __name__ == "__main__":
    main()
