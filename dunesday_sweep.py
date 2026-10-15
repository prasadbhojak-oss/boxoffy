#!/usr/bin/env python3
"""
Boxoffy - DUNESDAY PRESALE SWEEP            python dunesday_sweep.py --film X

Same engine as na_sweep.py, repointed at the 18 Dec 2026 collision:
Avengers: Doomsday and Dune: Part Three. Nothing about the collection
method has changed - same 385 postcodes, same Fandango seat maps, same
Cineplex pass for every Canadian province, same hash dedupe.

WHAT IS DIFFERENT FROM na_sweep.py, AND IT MATTERS
  na_sweep reads a day that is already playing. Fandango pulls a show's
  seat map the moment that show starts, so a single read is a FLOOR and
  na_rollup.py exists to union the day.

  Presales are the opposite. Every show is in the future, nothing is being
  withdrawn, so ONE READ IS THE CUMULATIVE TOTAL SOLD to that minute. No
  roll-up needed. What forecasts an opening is the DELTA between two reads,
  so this version diffs itself against the previous read of the same film
  and date automatically - there is no hardcoded baseline to go stale.

THE TWO FILMS DO NOT SHARE A DEADLINE
  doomsday     18 Dec, 4,000+ sites, no announced previews. Clean presale
               right up to the first 18 Dec show.
  dune3        18 Dec wide. Holds a 3-week IMAX exclusivity over Doomsday,
               so Doomsday has NO IMAX inventory in this window. That is a
               contract, not a demand signal - do not read it as weakness.
  dune-insider IMAX insider screenings from 14 Dec. These are a SEPARATE
               Fandango listing, and they are the reason Dune's clean
               presale window closes on 13 Dec, not the 18th. Land the
               final clean Dune read on 13 Dec.

NON-NATIONAL CHAINS
  The Sep/Oct probe rounds settled this: outside Fandango and Cineplex,
  no North American circuit exposes seat counts. Marcus, Harkins, B&B,
  Emagine and the rest are footprint only. For a Hindi release that gap
  was real money, because desi single screens sell off Fandango. For a
  Disney and a Warner tentpole almost the whole circuit IS on Fandango,
  so the hole here is far smaller - but it is still a hole, and the
  totals below are what Fandango can see, not the country.

    python dunesday_sweep.py --film doomsday
    python dunesday_sweep.py --film dune3 2026-12-18 2026-12-19
    python dunesday_sweep.py --film dune-insider 2026-12-14
    python dunesday_sweep.py --film doomsday --no-seats     footprint only
    python dunesday_sweep.py --film dune3 --workers 8       faster seat pass
    python dunesday_sweep.py --film dune3 --resume          retry failed maps

Writes into ./intel/<film>-<date>/ , preserving any earlier read of the
same date as <film>-<date>-prev-HHMM so deltas survive. Stdlib only. 3.8+.
"""

import json, os, csv, sys, re, time, gzip, io, datetime, collections, threading, glob
import urllib.request, urllib.error, http.cookiejar
from concurrent.futures import ThreadPoolExecutor

_args   = sys.argv[1:]
def _flag(name, cast=None, default=None):
    """--name value  /  --name"""
    if name not in _args: return default
    i = _args.index(name)
    if cast is None: return True
    try: return cast(_args[i + 1])
    except (IndexError, ValueError): return default

NO_SEATS = "--no-seats" in _args
RESUME   = "--resume" in _args
WORKERS  = max(1, min(12, _flag("--workers", int, 5)))
_dates   = [a for a in _args if re.match(r"^\d{4}-\d{2}-\d{2}$", a)]

# Verified 3 Oct 2026: fandango ids read off the live film pages, cineplex
# ids off apis.cineplex.com /movies (NOT /films, which 404s).
FILMS = {
    "doomsday":     {"title": "Avengers: Doomsday",
                     "slug": "avengers-doomsday-2026-237176",
                     "fid": "237176", "cpx": "34362",
                     "note": "no IMAX this window - Dune holds 3-week exclusivity"},
    "dune3":        {"title": "Dune: Part Three",
                     "slug": "dune-part-three-2026-244800",
                     "fid": "244800", "cpx": "37998",
                     "note": "wide release listing"},
    "dune-insider": {"title": "Dune: Part Three Insider Screenings",
                     "slug": "dune-part-three-insider-screenings-2026-246861",
                     "fid": "246861", "cpx": "",
                     "note": "separate listing, plays from 14 Dec - after this "
                             "starts, Dune reads stop being clean presale"},
}
FILM = _flag("--film", str, None)
if FILM not in FILMS:
    sys.exit("--film must be one of: " + ", ".join(FILMS) +
             "\n  e.g. python dunesday_sweep.py --film doomsday")
F = FILMS[FILM]
FID = F["fid"]
CPX_FILM = F["cpx"]

# Show dates of the opening frame. These are what gets SWEPT - not the days
# you run this on. You run it 13-16 Dec; it reads the shows below.
DATES = _dates or ["2026-12-17", "2026-12-18", "2026-12-19", "2026-12-20"]

# Set per date inside main(); every collector below reads these two, exactly
# as they did in na_sweep.py, so none of the proven code needed touching.
DATE = DATES[0]
OUT = os.path.join("intel", f"{FILM}-{DATE}")

CPX_KEY  = "477f072109904a55927ba2c3bf9f77e3"
PAUSE = 0.40
TIMEOUT = 12          # fail fast; a stalled socket used to look like a hang

# No hardcoded baseline in this version. na_sweep.py carried NA Update 8 as a
# frozen dict because it graded one film against one published read. Here the
# whole point is movement across many reads of the same future date, so the
# baseline is discovered: the most recent earlier read of this film and date,
# found on disk. Same date, same film, so it is never a cross-day comparison -
# the apples-to-oranges trap that na_sweep had to shout about cannot arise.
def load_baseline(film, date):
    """Most recent intel/<film>-<date>-prev-* read, as a totals dict."""
    pat = os.path.join("intel", f"{film}-{date}-prev-*")
    cands = sorted(d for d in glob.glob(pat) if os.path.isdir(d))
    for d in reversed(cands):
        p = os.path.join(d, "fandango_shows.csv")
        if not os.path.exists(p):
            continue
        try:
            rows = list(csv.DictReader(open(p, encoding="utf-8")))
        except Exception:
            continue
        th = {r["theatreId"] for r in rows if r.get("theatreId")}
        tot = sum(num(r.get("seatsTotal")) for r in rows)
        av = sum(num(r.get("seatsAvail")) for r in rows)
        ca = ca_avail = 0
        cp = os.path.join(d, "cineplex_shows.csv")
        if os.path.exists(cp):
            try:
                crows = list(csv.DictReader(open(cp, encoding="utf-8")))
                ca = len(crows)
                ca_avail = sum(num(r.get("seatsAvail")) for r in crows)
            except Exception: pass
        return {"label": os.path.basename(d), "theatres": len(th),
                "shows": len(rows), "seats": tot, "sold": tot - av,
                "occ": ((tot - av) / tot * 100) if tot else 0.0,
                "ca_shows": ca, "ca_avail": ca_avail}
    return None

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
API_HDR = {
    "User-Agent": UA, "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate",
    "Referer": f"https://www.fandango.com/{F['slug']}/movie-times",
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
    st, _ = get(f"https://www.fandango.com/{F['slug']}/movie-times", h)
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


_gate = threading.Lock()
_next = [0.0]

def throttled_get(url, hdrs):
    """One shared rate limit across every worker, so N threads do not mean
    N times the request rate at Akamai. Spacing stays PAUSE overall."""
    with _gate:
        wait = _next[0] - time.time()
        if wait > 0: time.sleep(wait)
        _next[0] = max(time.time(), _next[0]) + PAUSE
    return get(url, hdrs)


CKPT = "_seatcache.json"

def _load_ckpt():
    p = os.path.join(OUT, CKPT)
    if RESUME and os.path.exists(p):
        try:
            d = json.load(open(p, encoding="utf-8"))
            print(f"  resuming: {len(d)} seat maps already read", flush=True)
            return {k: tuple(v) for k, v in d.items()}
        except Exception as ex:
            print(f"  checkpoint unreadable ({ex}); starting fresh", flush=True)
    return {}


def seat_maps(shows):
    uniq = [s for s in shows if s["hash"]]
    hashes = list(dict.fromkeys(s["hash"] for s in uniq))
    cache = _load_ckpt()
    todo = [h for h in hashes if h not in cache]
    t0 = time.time()
    print(f"  {len(uniq)} showtimes, {len(hashes)} unique seat maps "
          f"({len(todo)} to read) · {WORKERS} workers "
          f"· ~{len(todo)*PAUSE/WORKERS/60 + len(todo)*0.5/WORKERS/60:.0f} min", flush=True)

    lock, done, fails = threading.Lock(), [0], [0]

    def one(h):
        st, js = throttled_get(f"https://www.fandango.com/napi/seatMap/{h}", API_HDR)
        v = ((js or {}).get("totalSeatCount", ""),
             (js or {}).get("totalAvailableSeatCount", "")) if st == 200 else ("", "")
        with lock:
            if st == 200: cache[h] = v          # failures stay OUT of the cache,
            else: fails[0] += 1                 # so --resume retries just them
            done[0] += 1
            n = done[0]
            if n % 50 == 0 or n == len(todo):
                el = time.time() - t0
                eta = el / n * (len(todo) - n)
                print(f"  {n}/{len(todo)} seat maps · {el/60:.1f} min elapsed · "
                      f"~{eta/60:.1f} min left · {fails[0]} failed", flush=True)
            if n % 100 == 0:
                try: json.dump(cache, open(os.path.join(OUT, CKPT), "w"))
                except Exception: pass

    if todo:
        with ThreadPoolExecutor(max_workers=WORKERS) as ex:
            list(ex.map(one, todo))

    try: json.dump(cache, open(os.path.join(OUT, CKPT), "w"))
    except Exception: pass
    if fails[0]:
        log(f"seat maps: {fails[0]} of {len(todo)} failed and are blank in the CSV")
        print(f"  WARNING {fails[0]} seat maps failed - those rows have no seat counts. "
              f"Re-run with --resume to retry only those.", flush=True)
    for s in uniq:
        s["seatsTotal"], s["seatsAvail"] = cache.get(s["hash"], ("", ""))
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


def report(theatres, shows, ca, base=None):
    tot = sum(num(s["seatsTotal"]) for s in shows)
    av  = sum(num(s["seatsAvail"]) for s in shows)
    sold = tot - av
    def line(*a): log(*a); print(*a, flush=True)

    def d(now, then, pct=True):
        """Delta against the previous read, or a dash when there isn't one."""
        if not base or not then:
            return "  (first read of this date)"
        if pct:
            return f"  (was {then:,}, {now/then-1:+.0%})"
        return f"  (was {then:,}, {now-then:+,})"

    line(f"\n=== {F['title']} · {DATE} · US TOTALS ===")
    if base:
        line(f"  diffed against {base['label']} - same film, same show date,")
        line(f"  so this is pure movement, not a calendar artefact.")
    else:
        line(f"  no earlier read of this date on disk. This run becomes the")
        line(f"  baseline; the next one will diff against it.")
    line(f"  theatres        {len(theatres):>8,}{d(len(theatres), base and base['theatres'])}")
    line(f"  showtimes       {len(shows):>8,}{d(len(shows), base and base['shows'])}")
    if tot:
        line(f"  seats on sale   {tot:>8,}{d(tot, base and base['seats'])}")
        line(f"  TICKETS SOLD    {sold:>8,}{d(sold, base and base['sold'], pct=False)}")
        line(f"  occupancy       {sold/tot*100:>7.1f}%"
             f"{'  (was %.1f%%)' % base['occ'] if base else ''}")
        line(f"  Presale, so nothing has played and no seat map has been")
        line(f"  withdrawn: this is a cumulative total, not a floor.")
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
    nonnat = [s for s in shows if s["chain"] not in ("AMC", "Regal", "Cinemark")]
    nn_sites = len({s["theatreId"] for s in nonnat})
    nn_tot = sum(num(s["seatsTotal"]) for s in nonnat)
    nn_sold = nn_tot - sum(num(s["seatsAvail"]) for s in nonnat)
    line(f"  EVERYTHING ELSE  {nn_sites} sites, {len(nonnat):,} shows, {nn_tot:,} seats, "
         f"{nn_sold:,} sold, {(nn_sold/nn_tot*100 if nn_tot else 0):.1f}%")
    line(f"  Marcus, Harkins, B&B, Emagine and the independents are in that")
    line(f"  second line ONLY where they sell through Fandango. The probe")
    line(f"  rounds found no other NA circuit exposes seat counts, so any")
    line(f"  site selling only on its own website is invisible here.")

    group("format", "FORMAT")
    prem = sum(1 for s in shows if (s.get("format") or "").lower() not in ("standard", ""))
    line(f"  -> non-Standard showtimes: {prem} of {len(shows)} "
         f"({(prem/len(shows)*100 if shows else 0):.1f}%)")
    imax = sum(1 for s in shows
               if "imax" in f"{s.get('format','')} {s.get('amenities','')}".lower())
    line(f"  -> IMAX showtimes: {imax}")
    if FILM == "doomsday" and imax == 0:
        line(f"     Zero IMAX is EXPECTED: Dune holds a 3-week IMAX")
        line(f"     exclusivity. Contract, not demand.")
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
    if not CPX_FILM:
        line("  no cineplex filmId for this listing - Canada not swept.")
    elif not ca:
        line("  no Canadian rows returned in this read.")
    else:
        cav = sum(num(r.get("seatsAvail")) for r in ca)
        line(f"  theatres {len({r['theatreId'] for r in ca})}   showtimes {len(ca)}"
             f"{d(len(ca), base and base['ca_shows'], pct=False)}")
        line(f"  seats still available {cav:,}")
        if base and base.get("ca_avail"):
            taken = base["ca_avail"] - cav
            line(f"  was {base['ca_avail']:,} available, so {taken:+,} seats taken")
            line(f"  since that read. THIS is the Canadian ticket number.")
        for k, v in collections.Counter(r["province"] for r in ca).most_common():
            line(f"    {k or '?':<4}{v:>5}")
        line("  Cineplex publishes seats AVAILABLE but not seats TOTAL, so")
        line("  Canadian occupancy is NOT computable. The fall in the number")
        line("  above between two reads IS tickets sold, and needs no")
        line("  capacity assumption. That is the honest Canadian figure -")
        line("  do not scale it from showtime share.")


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


def first_show(shows):
    """Earliest showtime in this read, so we can say whether the presale
    window is still open. Once the first show starts, Fandango begins pulling
    seat maps and the total silently becomes a floor."""
    best = None
    for s in shows:
        m = re.match(r"(\d{4}-\d\d-\d\d)[T ](\d\d):(\d\d)", s.get("dateLocal") or s.get("time") or "")
        if not m:
            continue
        try:
            dt = datetime.datetime.strptime(f"{m.group(1)} {m.group(2)}:{m.group(3)}",
                                            "%Y-%m-%d %H:%M")
        except ValueError:
            continue
        if best is None or dt < best:
            best = dt
    return best


def main():
    global DATE, OUT
    npc = sum(len(v) for v in ZIPS.values())
    print(f"{F['title']}  ({FILM})", flush=True)
    print(f"  fandango {FID}   cineplex {CPX_FILM or 'n/a'}", flush=True)
    print(f"  {F['note']}", flush=True)
    print(f"  dates {DATES}   {npc} postcodes   workers {WORKERS}", flush=True)
    print(f"Warming Fandango session...", flush=True)
    if not warm_session():
        print("  WARNING: film page did not return 200; API calls may 403", flush=True)

    for date in DATES:
        DATE = date
        OUT = os.path.join("intel", f"{FILM}-{DATE}")
        if not RESUME:
            archive_previous()          # keeps the old read as -prev-HHMM
        os.makedirs(OUT, exist_ok=True)
        base = load_baseline(FILM, DATE)   # newest -prev-* read, or None
        log(f"RUN {datetime.datetime.now().isoformat()}  film={FILM} date={DATE}  "
            f"{npc} postcodes  workers={WORKERS}"
            f"{'  NO-SEATS' if NO_SEATS else ''}{'  RESUMED' if RESUME else ''}")
        print(f"\n### {F['title']} · {DATE} -> {OUT}", flush=True)
        theatres, shows = sweep_fandango()
        print(f"  {len(theatres)} theatres, {len(shows)} unique showtimes", flush=True)
        if not shows:
            print("  NOTHING RETURNED. Either presales for this date are not", flush=True)
            print("  open yet, or the film id is wrong. Not a zero - a blank.", flush=True)
        # footprint lands on disk before the slow part, so a stall still leaves data
        json.dump({"theatres": list(theatres.values()), "shows": shows},
                  open(os.path.join(OUT, "_footprint.json"), "w"), indent=1)
        if NO_SEATS:
            print("Seat maps skipped (--no-seats).", flush=True)
        else:
            print("Seat maps...", flush=True)
            shows = seat_maps(shows)
        print("Cineplex (Canada)...", flush=True)
        ca = sweep_cineplex() if CPX_FILM else []
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

        report(theatres, shows, ca, base)

        fs = first_show(shows)
        if fs:
            hrs = (fs - datetime.datetime.now()).total_seconds() / 3600
            if hrs > 0:
                log(f"  first show {fs:%Y-%m-%d %H:%M}, {hrs:.0f}h away - clean presale")
                print(f"  first show {fs:%Y-%m-%d %H:%M}, {hrs:.0f}h away - clean presale",
                      flush=True)
            else:
                for m in (f"  !! first show was {abs(hrs):.0f}h AGO. Seat maps for started",
                          f"  !! shows are already gone, so this total is a FLOOR, not a",
                          f"  !! presale figure. Do not publish it as tickets sold."):
                    log(m); print(m, flush=True)

        open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8").write("\n".join(LOG))
        print(f"Written to {OUT}", flush=True)


if __name__ == "__main__":
    main()
