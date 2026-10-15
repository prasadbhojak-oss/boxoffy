#!/usr/bin/env python3
"""
Boxoffy - DECEMBER PRESALE SWEEP            python presale_sweep.py

DUNESDAY - Avengers: Doomsday and Dune Part Three, both 18 Dec 2026.
US (Fandango) + Canada (Cineplex). Tracks cumulative tickets sold across the
presale window and is built to land a final clean read BEFORE the first show
of each film starts.

RUN DAYS vs SHOW DATES - DO NOT CONFUSE THESE
  You RUN this on 13-16 Dec. What it SWEEPS is the show dates of the opening
  frame, 14-21 Dec. Pointing the sweep at 13-16 Dec would return almost
  nothing, because on most of those dates there is nothing playing yet.

THE TWO FILMS DO NOT SHARE A DEADLINE
  Doomsday: 18 Dec, 4,000+ theatres, no preview date announced. Its clean
  presale window runs right up to the first 18 Dec show.
  Dune Part Three: 18 Dec wide, BUT IMAX insider screenings start 14 Dec.
  So Dune's first show goes live on the 14th, not the 18th. Every Dune read
  after that is contaminated: those screenings have played, their seat maps
  are being withdrawn, and the number becomes a floor. Land the final clean
  Dune read on 13 Dec.

  Dune also holds a three-week IMAX exclusivity over Doomsday in the US, so
  Doomsday has NO IMAX inventory in this window. Do not read the format
  split as a demand signal - it is a contract.

WHY THIS IS NOT na_sweep.py
  na_sweep reads a day that is already playing. Fandango pulls a show's seat
  map the moment that show starts, so a single read there is a FLOOR and you
  need na_rollup.py to union the day.

  Presales are the opposite. Every show is in the future, nothing is being
  withdrawn, so one read IS the cumulative total sold to that minute. No
  roll-up. What matters instead is the DELTA between reads - that is the
  sales velocity, and it is the only thing that forecasts an opening.

  The moment the first show starts, that stops being true. This script
  refuses to call a read "clean presale" past that point (see --final).

THE SCALE PROBLEM, AND THE PANEL
  Two wide releases x ~4,500 sites x 4 dates is tens of thousands of seat
  maps per pass. At a polite request rate that is hours, and Akamai starts
  throttling long before the end.

  So: footprint nationwide (cheap, one call per postcode), seat maps on a
  LOCKED PANEL of sites. The panel is chosen once, written to disk, and
  reused by every later read. A panel that drifts between reads makes every
  delta meaningless - that is the whole point of locking it.

  Panel numbers are a SAMPLE. Scale them if you want a national estimate,
  label it as an estimate, and never publish the panel figure as the
  national one.

FILM IDS ARE NOT GUESSED
  Fandango and Cineplex ids change per title and are not derivable. Fill
  them into FILMS below, or run --find to have the script look for them and
  print what it found. If --find comes up empty it says so and tells you
  where to read the id off by hand. It never invents one.

    python presale_sweep.py --find                 resolve film ids, exit
    python presale_sweep.py                        all films, 13-16 Dec
    python presale_sweep.py --film doomsday        one film
    python presale_sweep.py --date 2026-12-16      one date
    python presale_sweep.py --no-seats             footprint only, fast
    python presale_sweep.py --panel 500            set panel size (first run)
    python presale_sweep.py --panel-reset          rebuild the panel
    python presale_sweep.py --resume               retry failed seat maps
    python presale_sweep.py --final                assert pre-first-show
    python presale_sweep.py --compare              velocity vs previous read

Writes intel/presale/<film>/<date>/read-<YYYYmmdd-HHMM>/ .
Stdlib only. Python 3.8+. Windows-safe.
"""

import json, os, csv, sys, re, time, gzip, io, datetime, collections, threading
import urllib.request, urllib.error, urllib.parse, http.cookiejar
from concurrent.futures import ThreadPoolExecutor

# ----------------------------------------------------------------- films
# fandango: the 6-digit id in the film page URL, e.g.
#   fandango.com/avengers-doomsday-2026-<ID>/movie-times
# cineplex: numeric filmId used by apis.cineplex.com showtimes
# Leave "" and the script will refuse to sweep that film and tell you why.
FILMS = {
    "doomsday": {"title": "Avengers: Doomsday", "fandango": "", "cineplex": "",
                 "release": "2026-12-18",
                 "note": "no IMAX in this window (Dune holds 3-week exclusivity)"},
    "dune3":    {"title": "Dune Part Three", "fandango": "", "cineplex": "",
                 "release": "2026-12-18",
                 "note": "IMAX insider screenings from 14 Dec - clean presale "
                         "window closes then, not on the 18th"},
}

CPX_KEY = "477f072109904a55927ba2c3bf9f77e3"
CPX_BASE = "https://apis.cineplex.com/prod/cpx/theatrical/api/v1"

# SHOW dates of the opening frame - not the days you run this on.
# 14-16: Dune IMAX insider screenings. 17: previews, if any appear.
# 18: opening day. 19-21: first weekend.
DATES_DEFAULT = ["2026-12-14", "2026-12-15", "2026-12-16", "2026-12-17",
                 "2026-12-18", "2026-12-19", "2026-12-20", "2026-12-21"]

PAUSE = 0.40
TIMEOUT = 12
PANEL_DEFAULT = 400
ROOT = os.path.join("intel", "presale")

# ----------------------------------------------------------------- args
_args = sys.argv[1:]

def _flag(name, cast=None, default=None):
    if name not in _args: return default
    i = _args.index(name)
    if cast is None: return True
    try: return cast(_args[i + 1])
    except (IndexError, ValueError): return default

FIND        = "--find" in _args
NO_SEATS    = "--no-seats" in _args
RESUME      = "--resume" in _args
FINAL       = "--final" in _args
COMPARE     = "--compare" in _args
PANEL_RESET = "--panel-reset" in _args
PANEL_N     = max(50, min(2000, _flag("--panel", int, PANEL_DEFAULT)))
WORKERS     = max(1, min(12, _flag("--workers", int, 5)))
ONE_FILM    = _flag("--film", str, None)
_dates      = [a for a in _args if re.match(r"^\d{4}-\d{2}-\d{2}$", a)]
_dflag      = _flag("--date", str, None)
if _dflag and re.match(r"^\d{4}-\d{2}-\d{2}$", _dflag): _dates = [_dflag]
DATES       = _dates or DATES_DEFAULT

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

LOG = []
def log(*a):
    LOG.append(" ".join(str(x) for x in a))

def say(*a):
    s = " ".join(str(x) for x in a)
    LOG.append(s); print(s, flush=True)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get(url, hdrs, tries=3, want_json=True):
    """Proven transport from na_sweep.py. Returns (status, payload)."""
    for a in range(tries):
        try:
            with opener.open(urllib.request.Request(url, headers=hdrs), timeout=TIMEOUT) as r:
                if r.status == 204:
                    return 204, None
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                txt = raw.decode("utf-8", "replace").strip()
                if not want_json:
                    return r.status, txt
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


def hdr_for(fid):
    return {
        "User-Agent": UA, "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate",
        "Referer": f"https://www.fandango.com/movie-{fid}/movie-times",
        "Origin": "https://www.fandango.com",
        "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
        "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"',
        "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    }


def warm_session(fid=None):
    """Akamai hands out the cookies the napi endpoints require. Without them
    every API call 403s. Warm on the film page when we have an id, else home."""
    h = {"User-Agent": UA,
         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
         "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate",
         "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate"}
    url = "https://www.fandango.com/"
    st, _ = get(url, h, want_json=False)
    say(f"  session warm-up {url} -> HTTP {st}; cookies {[c.name for c in jar]}")
    return st == 200


# ----------------------------------------------------------------- geography
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
    return "Independent"


def fmt_bucket(fmt, amen):
    """Premium is where a tentpole's money actually is, so keep it separate."""
    s = f"{fmt} {amen}".lower()
    if "imax" in s: return "IMAX"
    if "dolby" in s: return "Dolby"
    if "4dx" in s or "screenx" in s or "d-box" in s: return "4DX/ScreenX"
    if "prime" in s or "xd" in s or "ultrascreen" in s or "big d" in s: return "PLF"
    if "3d" in s: return "3D"
    return "Standard"


# ----------------------------------------------------------------- find ids
def find_fandango(title):
    """Try to read the film id off Fandango's own search page. The id is the
    6-digit tail of the film page path. Reports what it finds; invents nothing."""
    q = urllib.parse.quote(title)
    h = {"User-Agent": UA,
         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
         "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate"}
    out = []
    for url in (f"https://www.fandango.com/search?q={q}",
                f"https://www.fandango.com/search/?q={q}"):
        st, html = get(url, h, want_json=False)
        if st != 200 or not html:
            say(f"    {url} -> HTTP {st}")
            continue
        for slug, fid in re.findall(r"/([a-z0-9\-]+?)-(\d{6})/movie-times", html):
            if (slug, fid) not in out:
                out.append((slug, fid))
        if out:
            break
    return out


def find_cineplex(title):
    """Cineplex's own film list. We only ever verified /theatres and
    /showtimes, so these paths are a probe: whatever answers is reported,
    nothing is assumed."""
    h = {"Ocp-Apim-Subscription-Key": CPX_KEY, "User-Agent": UA,
         "Accept": "application/json"}
    hits = []
    for path in ("/films?language=en", "/movies?language=en",
                 "/films/nowplaying?language=en", "/films/comingsoon?language=en"):
        st, js = get(CPX_BASE + path, h)
        say(f"    {path} -> HTTP {st}{'' if st == 200 else ''}")
        if st != 200 or not js:
            continue
        for node in walk_dicts(js):
            nm = str(node.get("filmName") or node.get("name") or node.get("title") or "")
            fid = node.get("filmId") or node.get("id")
            if nm and fid and token_match(title, nm):
                if (nm, str(fid)) not in hits:
                    hits.append((nm, str(fid)))
    return hits


def walk_dicts(node):
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from walk_dicts(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk_dicts(v)


def token_match(title, candidate):
    t = set(re.findall(r"[a-z0-9]+", title.lower())) - {"the", "part", "a", "of"}
    c = set(re.findall(r"[a-z0-9]+", candidate.lower()))
    return bool(t) and len(t & c) >= max(1, len(t) - 1)


def do_find():
    say("RESOLVING FILM IDS")
    say("  Nothing here is written to the config for you - copy what looks")
    say("  right into FILMS at the top of this file, then re-run.\n")
    warm_session()
    for key, f in FILMS.items():
        say(f"  {key}  ({f['title']})")
        say("   fandango:")
        hits = find_fandango(f["title"])
        if hits:
            for slug, fid in hits[:8]:
                say(f"     {fid}   /{slug}-{fid}/movie-times")
        else:
            say("     nothing found. Open the film page in a browser and read")
            say("     the 6-digit number out of the URL by hand.")
        say("   cineplex:")
        hits = find_cineplex(f["title"])
        if hits:
            for nm, fid in hits[:8]:
                say(f"     {fid}   {nm}")
        else:
            say("     nothing found on the paths we know. Canada will be")
            say("     skipped for this film until a filmId is filled in.")
        say("")


# ----------------------------------------------------------------- fandango
def parse(payload, metro, zipc, theatres, shows, seen):
    """theaterShowtimes.theaters[] -> variants[] -> amenityGroups[] -> showtimes[]
    Postcodes overlap 3-4x, so dedupe on the showtime hash or nothing adds up."""
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
                    if key in seen:
                        continue
                    seen.add(key)
                    shows.append({"theatreId": tid, "theatre": nm, "chain": chain_of(nm),
                                  "metro": metro, "format": fmt, "amenities": ams,
                                  "bucket": fmt_bucket(fmt, ams),
                                  "time": st.get("date", ""),
                                  "dateLocal": st.get("dateLocal", ""),
                                  "isSoldOut": st.get("isSoldOut", ""),
                                  "seatsTotal": "", "seatsAvail": "", "hash": h})
                    ns += 1
    return nt, ns


def sweep_fandango(fid, date):
    theatres, shows, seen = {}, [], set()
    hdrs = hdr_for(fid)
    bad = [0]
    npc = sum(len(v) for v in ZIPS.values()); i = 0
    for metro, zl in ZIPS.items():
        for z in zl:
            i += 1
            url = (f"https://www.fandango.com/napi/theaterShowtimeGroupings/{fid}/{date}"
                   f"?isdesktop=true&postalCode={z}&zip={z}&isDesktopMOP=true")
            t0 = time.time()
            st, js = get(url, hdrs)
            dt = time.time() - t0
            if st != 200 or js is None:
                log(f"FANDANGO {metro} {z} HTTP {st}")
                print(f"  [{i:>3}/{npc}] {metro:<16}{z}  HTTP {st}  {dt:4.1f}s", flush=True)
                if st in (403, 429, 503):
                    bad[0] += 1
                    if bad[0] in (5, 15, 30):
                        print(f"        ^ {bad[0]} throttled. Backing off 20s.", flush=True)
                        time.sleep(20)
            else:
                nt, ns = parse(js, metro, z, theatres, shows, seen)
                print(f"  [{i:>3}/{npc}] {metro:<16}{z}  +{nt:<3}th +{ns:<4}sh  "
                      f"running {len(theatres)} / {len(shows)}  {dt:4.1f}s", flush=True)
            time.sleep(PAUSE)
    return theatres, shows


# ----------------------------------------------------------------- panel
def panel_path(key):
    return os.path.join(ROOT, key, "panel.json")


def load_panel(key):
    p = panel_path(key)
    if PANEL_RESET or not os.path.exists(p):
        return None
    try:
        d = json.load(open(p, encoding="utf-8"))
        return set(d["theatreIds"]), d
    except Exception:
        return None


def build_panel(key, theatres, shows):
    """Pick the panel ONCE, by showtime count, tie-broken on theatreId so the
    choice is deterministic. Written to disk and reused by every later read:
    a panel that moves between reads turns every delta into noise."""
    cnt = collections.Counter(s["theatreId"] for s in shows)
    ranked = sorted(cnt.items(), key=lambda x: (-x[1], x[0]))
    ids = [t for t, _ in ranked[:PANEL_N]]
    meta = {"theatreIds": ids, "size": len(ids),
            "built": datetime.datetime.now().isoformat(timespec="seconds"),
            "builtFromDate": DATES[0], "selection": "top sites by showtime count",
            "nationalSitesAtBuild": len(theatres)}
    os.makedirs(os.path.dirname(panel_path(key)), exist_ok=True)
    json.dump(meta, open(panel_path(key), "w"), indent=1)
    say(f"  panel built: {len(ids)} of {len(theatres)} sites, locked to "
        f"{panel_path(key)}")
    return set(ids), meta


# ----------------------------------------------------------------- seat maps
_gate = threading.Lock()
_next = [0.0]

def throttled_get(url, hdrs):
    """One shared rate limit across all workers, so N threads is not N times
    the request rate at Akamai."""
    with _gate:
        wait = _next[0] - time.time()
        if wait > 0: time.sleep(wait)
        _next[0] = max(time.time(), _next[0]) + PAUSE
    return get(url, hdrs)


def seat_maps(shows, fid, outdir):
    uniq = [s for s in shows if s["hash"]]
    hashes = list(dict.fromkeys(s["hash"] for s in uniq))
    hdrs = hdr_for(fid)
    ckpt = os.path.join(outdir, "_seatcache.json")
    cache = {}
    if RESUME and os.path.exists(ckpt):
        try:
            cache = {k: tuple(v) for k, v in json.load(open(ckpt, encoding="utf-8")).items()}
            print(f"  resuming: {len(cache)} seat maps already read", flush=True)
        except Exception as ex:
            print(f"  checkpoint unreadable ({ex}); starting fresh", flush=True)
    todo = [h for h in hashes if h not in cache]
    t0 = time.time()
    print(f"  {len(uniq)} panel showtimes, {len(hashes)} unique seat maps "
          f"({len(todo)} to read) · {WORKERS} workers · "
          f"~{len(todo)*(PAUSE+0.5)/WORKERS/60:.0f} min", flush=True)

    lock, done, fails = threading.Lock(), [0], [0]

    def one(h):
        st, js = throttled_get(f"https://www.fandango.com/napi/seatMap/{h}", hdrs)
        v = ((js or {}).get("totalSeatCount", ""),
             (js or {}).get("totalAvailableSeatCount", "")) if st == 200 else ("", "")
        with lock:
            if st == 200: cache[h] = v      # failures stay OUT of the cache so
            else: fails[0] += 1             # --resume retries only those
            done[0] += 1
            n = done[0]
            if n % 50 == 0 or n == len(todo):
                el = time.time() - t0
                print(f"  {n}/{len(todo)} seat maps · {el/60:.1f} min · "
                      f"~{el/n*(len(todo)-n)/60:.1f} min left · {fails[0]} failed",
                      flush=True)
            if n % 100 == 0:
                try: json.dump(cache, open(ckpt, "w"))
                except Exception: pass

    if todo:
        with ThreadPoolExecutor(max_workers=WORKERS) as ex:
            list(ex.map(one, todo))
    try: json.dump(cache, open(ckpt, "w"))
    except Exception: pass
    if fails[0]:
        say(f"  WARNING {fails[0]} of {len(todo)} seat maps failed - those rows "
            f"are blank, not zero. Re-run --resume to retry just them.")
    for s in uniq:
        s["seatsTotal"], s["seatsAvail"] = cache.get(s["hash"], ("", ""))
    return shows


# ----------------------------------------------------------------- cineplex
def sweep_cineplex(cpx_film, date):
    """Cineplex publishes seatsAvail but NOT seatsTotal. So occupancy is not
    computable in Canada - but the DROP in seatsAvail between two reads is
    tickets sold in that interval, with no capacity needed. That is what the
    --compare pass uses, and it is the honest Canadian number."""
    if not cpx_film:
        say("  Canada skipped: no cineplex filmId configured for this film.")
        return []
    hdr = {"Ocp-Apim-Subscription-Key": CPX_KEY, "User-Agent": UA,
           "Accept": "application/json"}
    st, data = get(f"{CPX_BASE}/theatres?language=en", hdr)
    if st != 200 or not data:
        say(f"  CINEPLEX theatre list HTTP {st} - Canada missing from this read.")
        return []
    tl = []
    for k in ("favouriteTheatres", "nearbyTheatres", "otherTheatres"):
        tl += data.get(k) or []
    say(f"  CINEPLEX {len(tl)} theatres in master list")
    rows = []
    for t in tl:
        tid = t.get("theatreId") or t.get("id")
        nm = t.get("theatreName") or t.get("name") or ""
        loc = t.get("location") or {}
        if not tid:
            continue
        s2, js = get(f"{CPX_BASE}/showtimes?language=en&filmId={cpx_film}"
                     f"&date={date}&locationId={tid}", hdr)
        if s2 == 200 and js:
            n = 0
            for row in iter_cpx(js, ""):
                row.update({"theatreId": str(tid), "theatre": nm,
                            "city": loc.get("city", ""),
                            "province": loc.get("provinceCode", "")})
                row["key"] = f"{tid}|{row['time']}|{row['format']}"
                rows.append(row); n += 1
            if n:
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
                   "seatsAvail": node.get("seatsAvailable",
                                          node.get("seatsRemaining", ""))}
        for v in node.values():
            yield from iter_cpx(v, f)
    elif isinstance(node, list):
        for v in node:
            yield from iter_cpx(v, fmt)


# ----------------------------------------------------------------- report
def num(v):
    try: return int(float(v))
    except Exception: return 0


def first_show_utc(shows):
    """Earliest showtime in this read. Fandango 'time' is an ISO stamp."""
    best = None
    for s in shows:
        t = s.get("time") or ""
        m = re.match(r"(\d{4}-\d\d-\d\d)[T ](\d\d):(\d\d)", t)
        if not m:
            continue
        try:
            d = datetime.datetime.strptime(f"{m.group(1)} {m.group(2)}:{m.group(3)}",
                                           "%Y-%m-%d %H:%M")
        except ValueError:
            continue
        if best is None or d < best:
            best = d
    return best


def report(title, date, theatres, shows, panel_ids, ca, panel_meta):
    p = [s for s in shows if s["theatreId"] in panel_ids] if panel_ids else shows
    tot = sum(num(s["seatsTotal"]) for s in p)
    av = sum(num(s["seatsAvail"]) for s in p)
    sold = tot - av
    mapped = [s for s in p if num(s["seatsTotal"])]

    say(f"\n=== {title} · {date} ===")
    say(f"  NATIONAL FOOTPRINT (all sites, no seat maps)")
    say(f"    sites           {len(theatres):>8,}")
    say(f"    showtimes       {len(shows):>8,}")
    for k, v in collections.Counter(s["bucket"] for s in shows).most_common():
        say(f"      {k:<14}{v:>6,} shows")

    say(f"\n  PANEL (locked, {len(panel_ids) if panel_ids else 0} sites)")
    say(f"    showtimes       {len(p):>8,}")
    say(f"    with seat map   {len(mapped):>8,}")
    if not tot:
        say("    no seat data in this read - nothing to report as sold.")
    else:
        say(f"    seats on sale   {tot:>8,}")
        say(f"    TICKETS SOLD    {sold:>8,}   {sold/tot*100:.1f}% of panel seats")
        say(f"    sold-out shows  "
            f"{sum(1 for s in p if str(s.get('isSoldOut','')).lower()=='true'):>8,}")
        say("    This is a cumulative presale total, not a floor: nothing has")
        say("    played yet, so no seat map has been withdrawn.")

        def group(field, label, limit=None):
            g = collections.defaultdict(lambda: [set(), 0, 0, 0])
            for s in p:
                v = g[s[field] or "?"]
                v[0].add(s["theatreId"]); v[1] += 1
                v[2] += num(s["seatsTotal"]); v[3] += num(s["seatsAvail"])
            say(f"\n    BY {label}")
            for k, v in sorted(g.items(), key=lambda x: -(x[1][2] - x[1][3]))[:limit]:
                sd = v[2] - v[3]
                say(f"      {str(k)[:20]:<22}{len(v[0]):>4} sites{v[1]:>6} sh"
                    f"{v[2]:>9,} seats{sd:>8,} sold"
                    f"{(sd/v[2]*100 if v[2] else 0):>6.1f}%")
        group("bucket", "FORMAT")
        group("chain", "CHAIN")
        group("metro", "METRO", 15)

        say("\n    PANEL IS A SAMPLE. To talk nationally, scale by sites or")
        say(f"    showtimes ({len(shows)}/{len(p)} = "
            f"{(len(shows)/len(p) if p else 0):.2f}x) and LABEL IT AN ESTIMATE.")

    say(f"\n  CANADA (Cineplex)")
    if ca:
        cav = sum(num(r["seatsAvail"]) for r in ca)
        say(f"    sites {len({r['theatreId'] for r in ca})}   showtimes {len(ca)}"
            f"   seats still available {cav:,}")
        for k, v in collections.Counter(r["province"] for r in ca).most_common():
            say(f"      {k or '?':<4}{v:>5} shows")
        say("    Cineplex gives seats AVAILABLE but not seats TOTAL, so Canadian")
        say("    occupancy is not computable. The fall in this number between")
        say("    two reads IS tickets sold - run --compare.")
    else:
        say("    no Canadian rows in this read.")

    fs = first_show_utc(shows)
    if fs:
        now = datetime.datetime.now()
        hrs = (fs - now).total_seconds() / 3600
        say(f"\n  FIRST SHOW IN THIS READ  {fs:%Y-%m-%d %H:%M} (venue-local stamps)")
        if hrs > 0:
            say(f"  {hrs:.1f}h away. Still clean presale.")
        else:
            say(f"  !! {abs(hrs):.1f}h AGO. The presale window has closed for the")
            say(f"  !! earliest shows and Fandango has begun withdrawing their")
            say(f"  !! seat maps, so this read is a FLOOR, not a presale total.")


# ----------------------------------------------------------------- compare
def read_dirs(key, date):
    d = os.path.join(ROOT, key, date)
    if not os.path.isdir(d):
        return []
    rs = [os.path.join(d, x) for x in sorted(os.listdir(d)) if x.startswith("read-")]
    return [r for r in rs if os.path.exists(os.path.join(r, "fandango_shows.csv"))]


def load_rows(path):
    try:
        return list(csv.DictReader(open(path, encoding="utf-8")))
    except Exception:
        return []


def do_compare():
    """Velocity. Two reads, same locked panel, difference is tickets sold in
    between. Ordered by directory name, which is the read timestamp."""
    for key, f in FILMS.items():
        if ONE_FILM and key != ONE_FILM:
            continue
        for date in DATES:
            rs = read_dirs(key, date)
            if len(rs) < 2:
                say(f"{f['title']} {date}: {len(rs)} read(s) - need 2 to compare.")
                continue
            a, b = rs[-2], rs[-1]
            ra = {r["hash"]: r for r in load_rows(os.path.join(a, "fandango_shows.csv")) if r.get("hash")}
            rb = {r["hash"]: r for r in load_rows(os.path.join(b, "fandango_shows.csv")) if r.get("hash")}
            common = [h for h in rb if h in ra
                      and num(ra[h]["seatsTotal"]) and num(rb[h]["seatsTotal"])]
            sa = sum(num(ra[h]["seatsTotal"]) - num(ra[h]["seatsAvail"]) for h in common)
            sb = sum(num(rb[h]["seatsTotal"]) - num(rb[h]["seatsAvail"]) for h in common)
            say(f"\n=== {f['title']} · {date} · VELOCITY ===")
            say(f"  {os.path.basename(a)} -> {os.path.basename(b)}")
            say(f"  shows in both reads with seat maps  {len(common):,}")
            say(f"  sold then {sa:,}  ->  sold now {sb:,}   {sb-sa:+,}")
            new = [h for h in rb if h not in ra]
            if new:
                say(f"  {len(new)} showtimes are NEW since the last read "
                    f"(added inventory, excluded from the delta above)")
            ta = _stamp(a); tb = _stamp(b)
            if ta and tb and tb > ta:
                hrs = (tb - ta).total_seconds() / 3600
                say(f"  {hrs:.1f}h apart -> {(sb-sa)/hrs:,.0f} tickets/hour on the panel")
            # Canada: no capacity, so measure the fall in availability
            ca_a = {r["key"]: r for r in load_rows(os.path.join(a, "cineplex_shows.csv")) if r.get("key")}
            ca_b = {r["key"]: r for r in load_rows(os.path.join(b, "cineplex_shows.csv")) if r.get("key")}
            ck = [k for k in ca_b if k in ca_a]
            if ck:
                aa = sum(num(ca_a[k]["seatsAvail"]) for k in ck)
                bb = sum(num(ca_b[k]["seatsAvail"]) for k in ck)
                say(f"  CANADA {len(ck):,} shows in both reads: available "
                    f"{aa:,} -> {bb:,}, so {aa-bb:+,} seats taken")
                say("  (measured from availability, no capacity assumed)")


def _stamp(path):
    m = re.search(r"read-(\d{8})-(\d{4})$", path)
    if not m:
        return None
    try:
        return datetime.datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M")
    except ValueError:
        return None


# ----------------------------------------------------------------- main
def main():
    if FIND:
        do_find()
        open("presale_find.txt", "w", encoding="utf-8").write("\n".join(LOG))
        return
    if COMPARE:
        do_compare()
        open("presale_compare.txt", "w", encoding="utf-8").write("\n".join(LOG))
        return

    todo = [(k, v) for k, v in FILMS.items() if not ONE_FILM or k == ONE_FILM]
    ready = [(k, v) for k, v in todo if v["fandango"]]
    for k, v in todo:
        if not v["fandango"]:
            say(f"SKIPPING {v['title']}: no fandango id in FILMS. "
                f"Run --find, or read it off the film page URL.")
    if not ready:
        say("\nNothing to sweep. Fill in at least one fandango id and re-run.")
        return

    npc = sum(len(v) for v in ZIPS.values())
    say(f"RUN {datetime.datetime.now().isoformat(timespec='seconds')}")
    say(f"  films {[v['title'] for _, v in ready]}")
    for _, v in ready:
        if v.get("note"):
            say(f"    {v['title']}: {v['note']}")
    say(f"  dates {DATES}   postcodes {npc}   panel {PANEL_N}   workers {WORKERS}")
    say(f"  est footprint time ~{len(ready)*len(DATES)*npc*(PAUSE+0.6)/60:.0f} min"
        f"{' (seat maps skipped)' if NO_SEATS else ' plus seat maps'}")
    warm_session()

    for key, f in ready:
        for date in DATES:
            stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M")
            outdir = os.path.join(ROOT, key, date, f"read-{stamp}")
            os.makedirs(outdir, exist_ok=True)
            say(f"\n### {f['title']} · {date} -> {outdir}")
            theatres, shows = sweep_fandango(f["fandango"], date)
            say(f"  {len(theatres)} sites, {len(shows)} unique showtimes")
            # footprint hits disk before the slow part, so a stall still leaves data
            json.dump({"theatres": list(theatres.values()), "shows": shows},
                      open(os.path.join(outdir, "_footprint.json"), "w"), indent=1)

            pan = load_panel(key)
            if pan:
                panel_ids, panel_meta = pan
                known = panel_ids & set(theatres)
                say(f"  panel loaded: {len(panel_ids)} sites, {len(known)} present "
                    f"in this read")
                if len(known) < len(panel_ids) * 0.9:
                    say(f"  !! {len(panel_ids)-len(known)} panel sites are missing from")
                    say(f"  !! this read. Deltas against earlier reads will understate.")
            else:
                panel_ids, panel_meta = build_panel(key, theatres, shows)

            if NO_SEATS:
                say("  seat maps skipped (--no-seats)")
            else:
                sub = [s for s in shows if s["theatreId"] in panel_ids]
                say(f"  seat maps for {len(sub)} panel showtimes "
                    f"of {len(shows)} national")
                seat_maps(sub, f["fandango"], outdir)

            ca = sweep_cineplex(f["cineplex"], date)
            say(f"  {len(ca)} Canadian showtimes")

            for path, cols, rows in (
                ("fandango_theatres.csv",
                 ["theatreId","name","chain","metro","zipFound","pageUrl"],
                 list(theatres.values())),
                ("fandango_shows.csv",
                 ["theatreId","theatre","chain","metro","format","amenities","bucket",
                  "time","dateLocal","isSoldOut","seatsTotal","seatsAvail","hash"],
                 shows),
                ("cineplex_shows.csv",
                 ["theatreId","theatre","city","province","time","format",
                  "seatsAvail","key"], ca)):
                with open(os.path.join(outdir, path), "w", newline="",
                          encoding="utf-8") as fh:
                    w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
                    w.writeheader()
                    for r in rows: w.writerow(r)

            report(f["title"], date, theatres, shows, panel_ids, ca, panel_meta)

            if FINAL:
                fs = first_show_utc(shows)
                tag = "FINAL_PRESALE"
                if fs and fs <= datetime.datetime.now():
                    tag = "NOT_CLEAN_PRESALE - first show already started"
                open(os.path.join(outdir, "FINAL.txt"), "w",
                     encoding="utf-8").write(tag)
                say(f"  tagged: {tag}")

            open(os.path.join(outdir, "RUN.txt"), "w",
                 encoding="utf-8").write("\n".join(LOG))
            say(f"  written to {outdir}")


if __name__ == "__main__":
    main()
