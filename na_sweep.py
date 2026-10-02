#!/usr/bin/env python3
"""
Boxoffy - NORTH AMERICA nationwide seat sweep        python na_sweep.py

One script, replacing drishyam_na_sweep.py + topup.py + analyse.py.

  * 385 postcodes across all 50 states, DC and the Indian-diaspora belts,
    against the 253 the two-step covered. AMC, Regal, Cinemark and the
    independents, read from Fandango seat maps.
  * Cineplex for every Canadian province.
  * Everything deduped on the showtime hash. Postcodes overlap 3-4x, so
    summing raw rows inflates seats; this never does.
  * Prints the full roll-up itself - totals, chains, formats, metros,
    states, daypart, Canada - diffed against NA Update 3.

    python na_sweep.py                 opening day, 2 Oct
    python na_sweep.py 2026-10-03      Saturday

Writes into ./intel/na-<date>/ . Stdlib only. Python 3.8+. 12-18 minutes.
"""

import json, os, csv, sys, re, time, gzip, io, datetime, collections
import urllib.request, urllib.error, http.cookiejar

DATE = sys.argv[1] if len(sys.argv) > 1 else "2026-10-02"
FID  = "247556"
CPX_FILM = "62159"
CPX_KEY  = "477f072109904a55927ba2c3bf9f77e3"
OUT   = os.path.join("intel", f"na-{DATE}")
PAUSE = 0.40
TIMEOUT = 12          # fail fast; a stalled socket used to look like a hang

# NA Update 3, published 1 Oct - what we grade movement against
U3 = {"theatres": 350, "shows": 813, "seats": 77075, "sold": 8954, "occ": 11.6,
      "chain_sites": 306, "chain_seats": 69452, "chain_sold": 8130,
      "amc": 137, "cinemark": 96, "regal": 73,
      "ca_theatres": 48, "ca_shows": 132}

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

# ---------------------------------------------------------------- geography
ZIPS = {
 "LA":           ["91744","92805","91745","90630","92618","91767","91406","90703","92683","91789",
                  "92831","91301","90501","92551","93065","91311","92509","90805","92604","91214","92677","90802","93003","92374"],
 "SF Bay":       ["94538","95035","94085","94566","95133","94587","94536","95054","94555","94560",
                  "94539","95131","94301","94577","95014","94102","94553","95123","94501","95050","94904","95020","94589"],
 "Sacramento":   ["95630","95814","95758","95678","95826"],
 "San Diego":    ["92126","92127","92101","92122","92078"],
 "Fresno/Cent CA":["93720","93291","93311"],
 "DFW":          ["75024","75035","75063","76013","75093","75252","75038","75075","76006","75287",
                  "75034","75070","76210","75010","75013","75080","76092","75234","75201","76051","75056","76244","75248"],
 "Houston":      ["77450","77494","77082","77584","77096","77479","77024","77069","77381","77002","77379","77546","77036"],
 "Austin":       ["78717","78759","78613","78745","78660"],
 "San Antonio":  ["78258","78249","78209"],
 "NY/NJ":        ["08873","07302","11375","08837","07666","10016","08820","07030","11354","08854",
                  "07310","08901","07102","11101","10704","08540","07728","11691","10001","11235",
                  "07047","08816","10977","11803","10583","08831","07410","11530","10956","08648"],
 "Upstate NY":   ["14221","14623","12110","13057","12866"],
 "Philadelphia": ["19406","19087","19002","19103","08002","19355","19382","08054","19020"],
 "Boston":       ["01803","02451","01720","02140","01701","02062","01890","02339","02215","01821","01960","02368"],
 "Hartford/CT":  ["06032","06103","06810","06511"],
 "Baltimore/DC": ["20171","22031","20850","20147","20852","22102","20902","22314","20705","21029",
                  "21045","21201","20874","22182","20109","21703"],
 "Richmond/VA":  ["23060","23455","23234","22408"],
 "N Carolina":   ["27560","28277","27519","27703","28273","27613","27265","28226","27587","27502",
                  "28105","27410","27606","28078","27617","28412","27455","28806"],
 "S Carolina":   ["29212","29464","29681"],
 "Georgia":      ["30097","30022","30043","30350","30024","30092","30075","30044","30076","30328",
                  "30062","30309","30518","30189","31907","30907","30016","30269"],
 "Florida":      ["33331","32819","33647","33029","34747","33162","33351","33584","32828","33496",
                  "33324","33186","33612","32792","33069","34211","33606","32256","32216","33409",
                  "34292","33919","33076","34787","33411"],
 "Chicago":      ["60563","60540","60169","60089","60504","60532","60103","60201","60611","60559",
                  "60446","60010","60074","60453","60139","60564"],
 "Detroit":      ["48377","48375","48098","48167","48316","48108","48073","48170","48322"],
 "Ohio":         ["43016","43240","44141","44114","45040","45202","43235","44236","45458","44122","45069"],
 "Indiana":      ["46032","46204","46835","46385"],
 "Wisconsin":    ["53045","53202","53719","53158"],
 "Minnesota":    ["55344","55425","55113","55439","55901","55304"],
 "Missouri/KS":  ["63017","63101","66210","64114","65804","66061","66215"],
 "Iowa/Nebraska":["50266","50010","68130","68505"],
 "Dakotas/MT":   ["57106","58103","59102"],
 "Colorado":     ["80021","80112","80202","80027","80920","80537","80134"],
 "Utah":         ["84070","84101","84604"],
 "Arizona":      ["85226","85248","85308","85382","85004","85281","85718","85249"],
 "Nevada":       ["89135","89109","89502"],
 "New Mexico":   ["87114","88001"],
 "Seattle":      ["98052","98007","98375","98033","98011","98034","98201","98003","98004","98040",
                  "98008","98102","98272","98296","99206","98029","98074"],
 "Portland/OR":  ["97006","97223","97201","97477"],
 "Idaho/WY":     ["83704","82001"],
 "Tennessee":    ["37067","37203","38120","37922","37402","37043"],
 "Kentucky":     ["40222","40503"],
 "Alabama/MS":   ["35242","36830","39232"],
 "Louisiana/AR": ["70130","70503","72223"],
 "Oklahoma":     ["73134","74136"],
 "Pittsburgh":   ["15237","15222","15108"],
 "Alaska/Hawaii":["99508","96814"],
 "Rhode I/NH/ME/VT":["02903","03079","04101","05403"],
 "Delaware/WV":  ["19711","25304"],
}

PROV = ["ON","BC","AB","QC","MB","SK","NS","NB","NL","PE"]

LOG = []
def log(*a):
    s = " ".join(str(x) for x in a); LOG.append(s)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get(url, hdrs, tries=3):
    for a in range(tries):
        try:
            with opener.open(urllib.request.Request(url, headers=hdrs), timeout=TIMEOUT) as r:
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
        except Exception:
            if a < tries - 1:
                time.sleep(1.5 * (a + 1)); continue
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
    if "amc" in n: return "AMC"
    if "regal" in n: return "Regal"
    if "cinemark" in n or "century" in n or "tinseltown" in n or "cut! by" in n: return "Cinemark"
    if "marcus" in n: return "Marcus"
    if "harkins" in n: return "Harkins"
    if "studio movie grill" in n: return "SMG"
    if "alamo" in n: return "Alamo"
    if "showcase" in n: return "Showcase"
    if "b&b" in n or "b & b" in n: return "B&B"
    if "cinepolis" in n or "cinépolis" in n: return "Cinepolis"
    if "look" in n and "cinema" in n: return "LOOK"
    if "emagine" in n: return "Emagine"
    if "mjr" in n: return "MJR"
    return "Independent/Desi"


def parse(payload, metro, zipc, theatres, shows, seen_hash):
    """theaterShowtimes.theaters[] -> variants[] -> amenityGroups[] -> showtimes[]"""
    nt = ns = 0
    ts = (payload or {}).get("theaterShowtimes") or {}
    for th in ts.get("theaters") or []:
        tid = str(th.get("id") or th.get("theaterId") or "")
        nm = th.get("name") or th.get("theaterName") or ""
        if not tid:
            continue
        if tid not in theatres:
            theatres[tid] = {"theatreId": tid, "name": nm, "chain": chain_of(nm),
                             "metro": metro, "zipFound": zipc,
                             "pageUrl": th.get("theaterPageUrl", "")}
            nt += 1
        for var in th.get("variants") or []:
            fmt = var.get("filmFormatHeader") or ""
            for grp in var.get("amenityGroups") or []:
                ams = ", ".join(a.get("name", "") for a in (grp.get("amenities") or []))
                for st in grp.get("showtimes") or []:
                    h = st.get("showtimeHashCode", "")
                    key = h or f"{tid}|{st.get('date')}|{fmt}"
                    if key in seen_hash:
                        continue
                    seen_hash.add(key)
                    shows.append({"theatreId": tid, "theatre": nm, "chain": chain_of(nm),
                                  "metro": metro, "format": fmt, "amenities": ams,
                                  "time": st.get("date", ""), "dateLocal": st.get("dateLocal", ""),
                                  "isSoldOut": st.get("isSoldOut", ""),
                                  "seatsTotal": "", "seatsAvail": "", "hash": h})
                    ns += 1
    return nt, ns


def sweep_fandango():
    theatres, shows, seen = {}, [], set()
    bad = [0]
    npc = sum(len(v) for v in ZIPS.values()); i = 0
    for metro, zl in ZIPS.items():
        for z in zl:
            i += 1
            url = (f"https://www.fandango.com/napi/theaterShowtimeGroupings/{FID}/{DATE}"
                   f"?isdesktop=true&postalCode={z}&zip={z}&isDesktopMOP=true")
            t0 = time.time()
            st, js = get(url, API_HDR)
            dt = time.time() - t0
            if st != 200 or js is None:
                log(f"FANDANGO {metro} {z} HTTP {st}")
                print(f"  [{i:>3}/{npc}] {metro:<16}{z}  HTTP {st}  {dt:4.1f}s", flush=True)
                if st in (403, 429, 503):
                    bad[0] += 1
                    if bad[0] in (5, 15, 30):
                        print(f"        ^ {bad[0]} throttled responses. Backing off 20s.", flush=True)
                        time.sleep(20)
            else:
                nt, ns = parse(js, metro, z, theatres, shows, seen)
                log(f"FANDANGO {metro} {z} +{nt} theatres +{ns} shows")
                print(f"  [{i:>3}/{npc}] {metro:<16}{z}  +{nt:<3}th +{ns:<4}sh  "
                      f"running {len(theatres)} / {len(shows)}  {dt:4.1f}s", flush=True)
            time.sleep(PAUSE)
    return theatres, shows


def seat_maps(shows):
    cache, done, t0 = {}, 0, time.time()
    uniq = [s for s in shows if s["hash"]]
    print(f"  {len(uniq)} showtimes, {len(set(s['hash'] for s in uniq))} unique seat maps "
          f"to read (~{len(set(s['hash'] for s in uniq))*0.45/60:.0f} min)", flush=True)
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
            el = time.time() - t0
            eta = el / done * (len(uniq) - done)
            print(f"  {done}/{len(uniq)} seat maps · {el/60:.1f} min elapsed · "
                  f"~{eta/60:.1f} min left", flush=True)
    return shows


def sweep_cineplex():
    hdr = {"Ocp-Apim-Subscription-Key": CPX_KEY, "User-Agent": UA, "Accept": "application/json"}
    base = "https://apis.cineplex.com/prod/cpx/theatrical/api/v1"
    st, data = get(f"{base}/theatres?language=en", hdr)
    if st != 200 or not data:
        log(f"CINEPLEX theatre list HTTP {st}"); return []
    tl = []
    for key in ("favouriteTheatres", "nearbyTheatres", "otherTheatres"):
        tl += data.get(key) or []
    log(f"CINEPLEX {len(tl)} theatres in master list")
    rows = []
    for t in tl:
        tid = t.get("theatreId") or t.get("id")
        nm = t.get("theatreName") or t.get("name") or ""
        loc = t.get("location") or {}
        if not tid:
            continue
        s2, js = get(f"{base}/showtimes?language=en&filmId={CPX_FILM}&date={DATE}"
                     f"&locationId={tid}", hdr)
        done_cp = len(rows)
        if s2 == 200 and js:
            n = 0
            for row in iter_cpx(js, ""):
                row.update({"theatreId": tid, "theatre": nm,
                            "city": loc.get("city", ""), "province": loc.get("provinceCode", "")})
                rows.append(row); n += 1
            if n:
                log(f"CINEPLEX {nm} ({loc.get('city','')}) -> {n} shows")
                print(f"  CPX {nm[:38]:<40}{n:>3} shows", flush=True)
        time.sleep(PAUSE)
    return rows


def iter_cpx(node, fmt):
    if isinstance(node, dict):
        f = node.get("experienceTypeName") or node.get("format") or fmt
        if node.get("showStartDateTime") or node.get("showtime") or node.get("sessionTime"):
            yield {"time": (node.get("showStartDateTime") or node.get("showtime")
                            or node.get("sessionTime") or ""),
                   "format": f,
                   "seatsAvail": node.get("seatsAvailable", node.get("seatsRemaining", ""))}
        for v in node.values():
            yield from iter_cpx(v, f)
    elif isinstance(node, list):
        for v in node:
            yield from iter_cpx(v, fmt)


def num(v):
    try: return int(float(v))
    except Exception: return 0


def report(theatres, shows, ca):
    tot = sum(num(s["seatsTotal"]) for s in shows)
    av  = sum(num(s["seatsAvail"]) for s in shows)
    sold = tot - av
    def line(*a): log(*a); print(*a, flush=True)
    line("\n=== US TOTALS ===")
    line(f"  theatres        {len(theatres):>8,}   (U3 {U3['theatres']}, {len(theatres)/U3['theatres']-1:+.0%})")
    line(f"  showtimes       {len(shows):>8,}   (U3 {U3['shows']}, {len(shows)/U3['shows']-1:+.0%})")
    if tot:
        line(f"  seats on sale   {tot:>8,}   (U3 {U3['seats']:,}, {tot/U3['seats']-1:+.0%})")
        line(f"  seats sold      {sold:>8,}   (U3 {U3['sold']:,}, {sold/U3['sold']-1:+.0%})")
        line(f"  occupancy       {sold/tot*100:>7.1f}%   (U3 {U3['occ']}%)")
    line(f"  sold-out shows  {sum(1 for s in shows if str(s.get('isSoldOut','')).lower()=='true'):>8,}")

    def group(field, title, limit=None, base=None):
        g = collections.defaultdict(lambda: [set(), 0, 0, 0])
        for s in shows:
            v = g[s[field] or "?"]
            v[0].add(s["theatreId"]); v[1] += 1
            v[2] += num(s["seatsTotal"]); v[3] += num(s["seatsAvail"])
        line(f"\n=== BY {title} ===")
        items = sorted(g.items(), key=lambda x: -(x[1][2] - x[1][3]))
        for k, v in (items[:limit] if limit else items):
            s_ = v[2] - v[3]
            line(f"  {k[:22]:<24}{len(v[0]):>5} sites{v[1]:>6} shows{v[2]:>9,} seats"
                 f"{s_:>8,} sold{(s_/v[2]*100 if v[2] else 0):>6.1f}%")
        return g

    gc = group("chain", "CHAIN")
    nat = [set(), 0, 0, 0]
    for c in ("AMC", "Regal", "Cinemark"):
        if c in gc:
            nat[0] |= gc[c][0]; nat[1] += gc[c][1]; nat[2] += gc[c][2]; nat[3] += gc[c][3]
    ns = nat[2] - nat[3]
    line(f"\n  NATIONAL CHAINS  {len(nat[0])} sites, {nat[1]:,} shows, {nat[2]:,} seats, "
         f"{ns:,} sold, {(ns/nat[2]*100 if nat[2] else 0):.1f}%")
    line(f"  U3 national chains {U3['chain_sites']} sites, {U3['chain_seats']:,} seats, "
         f"{U3['chain_sold']:,} sold, 11.7%")

    group("format", "FORMAT")
    prem = sum(1 for s in shows if (s.get("format") or "").lower() not in ("standard", ""))
    line(f"  -> non-Standard showtimes: {prem} of {len(shows)} "
         f"({(prem/len(shows)*100 if shows else 0):.1f}%)   (U3 1.1%)")
    group("metro", "METRO", 20)

    line("\n=== BY TIME OF DAY (local) ===")
    def hour(s):
        m = re.search(r"T(\d\d):", s.get("dateLocal", "") or "")
        return int(m.group(1)) if m else None
    for lab, a, b in (("before noon",0,12),("12-4pm",12,16),("4-7pm",16,19),
                      ("7-9pm",19,21),("9pm+",21,24)):
        g = [s for s in shows if hour(s) is not None and a <= hour(s) < b]
        t = sum(num(s["seatsTotal"]) for s in g); sd = t - sum(num(s["seatsAvail"]) for s in g)
        line(f"  {lab:<12}{len(g):>6} shows{t:>9,} seats{sd:>8,} sold"
             f"{(sd/t*100 if t else 0):>6.1f}%")

    line("\n=== CANADA ===")
    line(f"  theatres {len({r['theatreId'] for r in ca})} (U3 {U3['ca_theatres']})   "
         f"showtimes {len(ca)} (U3 {U3['ca_shows']})")
    for k, v in collections.Counter(r["province"] for r in ca).most_common():
        line(f"    {k or '?':<4}{v:>5}")


def archive_previous():
    """Never clobber an earlier read. If OUT already holds data, move it aside
    with its own timestamp so the baseline we published against survives."""
    if not os.path.isdir(OUT) or not os.listdir(OUT):
        return
    stamp = datetime.datetime.fromtimestamp(
        max(os.path.getmtime(os.path.join(OUT, f)) for f in os.listdir(OUT))
    ).strftime("%H%M")
    dest = f"{OUT}-prev-{stamp}"
    n = 1
    while os.path.exists(dest):
        n += 1; dest = f"{OUT}-prev-{stamp}-{n}"
    os.rename(OUT, dest)
    print(f"  previous read preserved as {dest}", flush=True)


def main():
    archive_previous()
    os.makedirs(OUT, exist_ok=True)
    npc = sum(len(v) for v in ZIPS.values())
    log(f"RUN {datetime.datetime.now().isoformat()}  date={DATE}  {npc} postcodes")
    print(f"Warming Fandango session...", flush=True)
    if not warm_session():
        print("  WARNING: film page did not return 200; API calls may 403", flush=True)
    print(f"Fandango sweep over {npc} postcodes, {len(ZIPS)} markets...", flush=True)
    theatres, shows = sweep_fandango()
    print(f"  {len(theatres)} theatres, {len(shows)} unique showtimes", flush=True)
    print("Seat maps...", flush=True)
    shows = seat_maps(shows)
    print("Cineplex (Canada)...", flush=True)
    ca = sweep_cineplex()
    print(f"  {len(ca)} Canadian showtimes", flush=True)

    json.dump({"theatres": list(theatres.values()), "shows": shows},
              open(os.path.join(OUT, "fandango_raw.json"), "w"), indent=1)
    for path, cols, rows in (
        ("fandango_theatres.csv", ["theatreId","name","chain","metro","zipFound","pageUrl"],
         list(theatres.values())),
        ("fandango_shows.csv", ["theatreId","theatre","chain","metro","format","amenities",
                                "time","dateLocal","isSoldOut","seatsTotal","seatsAvail","hash"],
         shows),
        ("cineplex_shows.csv", ["theatreId","theatre","city","province","time","format","seatsAvail"],
         ca)):
        with open(os.path.join(OUT, path), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
            w.writeheader()
            for r in rows: w.writerow(r)

    report(theatres, shows, ca)
    open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8").write("\n".join(LOG))
    print(f"\nWritten to {OUT}", flush=True)


if __name__ == "__main__":
    main()
