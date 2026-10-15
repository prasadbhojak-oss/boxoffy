#!/usr/bin/env python3
"""
Boxoffy - DUNESDAY PRESALE, SEATS AND PREDICTION

    python dunesday_seats.py --film doomsday 2026-12-18

Dates are REQUIRED. Seat maps ALWAYS run. There is no --no-seats flag in
this script, by design: a presale read without seat counts cannot predict
anything, and the previous version let that mistake happen quietly.

WHAT IT GIVES YOU
  1. TICKETS SOLD, observed, on every showtime it could read. In presales
     nothing has played, so no seat map has been withdrawn and this is a
     true cumulative total - not the floor that na_sweep has to report.
  2. VELOCITY, if an earlier read of the same film and date is on disk:
     tickets/hour on the showtimes present in BOTH reads, with newly
     added inventory excluded so it cannot inflate the rate.
  3. A PRESALE PROJECTION, in dollars, as a band - with every assumption
     named and printed, because two of them are guesses and you will be
     asked about them.

SPEED - READ THIS BEFORE COMPLAINING IT IS SLOW
  na_sweep spaced every request 0.40s behind ONE global gate. For 964
  Drishyam showtimes that was 6 minutes. For 22,211 Doomsday showtimes it
  is 2.5 HOURS, and the old ETA line lied about it because it divided by
  --workers while the gate did not scale with workers.

  This version uses an ADAPTIVE gate: it starts at 0.12s, widens by 1.5x
  whenever Fandango throttles, narrows back toward 0.08s on a clean run,
  and reports MEASURED requests/sec with a truthful ETA. Expect roughly
  25-45 min for 22,000 seat maps instead of 150. If you see the interval
  climbing in the progress line, it is backing off on purpose - let it.

    --workers N      parallel readers (default 10)
    --pace S         starting gate interval (default 0.12)
    --resume         retry only the seat maps that failed last time
    --atp-std / --atp-3d / --atp-prem    override the price assumptions
    --footprint-only deliberately skip seats (named so it cannot be
                     mistaken for the default - you will get no tickets)

Writes intel/<film>-<date>/ , preserving the previous read as -prev-HHMM.
Stdlib only. Python 3.8+. Windows-safe.
"""

import json, os, csv, sys, re, time, gzip, io, datetime, collections, threading, glob
import urllib.request, urllib.error, http.cookiejar
from concurrent.futures import ThreadPoolExecutor

# ----------------------------------------------------------------- config
FILMS = {
    "doomsday":     {"title": "Avengers: Doomsday",
                     "slug": "avengers-doomsday-2026-237176",
                     "fid": "237176", "cpx": "34362"},
    "dune3":        {"title": "Dune: Part Three",
                     "slug": "dune-part-three-2026-244800",
                     "fid": "244800", "cpx": "37998"},
    "dune-insider": {"title": "Dune: Part Three Insider Screenings",
                     "slug": "dune-part-three-insider-screenings-2026-246861",
                     "fid": "246861", "cpx": ""},
}

# ASSUMPTIONS. Both of these are guesses and both are printed in the report.
# ATP: 2026 US average ticket price with format upcharges. Change with flags.
ATP = {"Standard": 12.50, "3D": 15.50, "Premium Format": 18.50}

# Share of final OPENING WEEKEND tickets that are already sold at the moment
# of the read. We have NO measured figure for a Marvel tentpole - the $43.21
# factor we calibrated on Drishyam was a same-day walk-up factor and does not
# transfer. So the report prints a SENSITIVITY TABLE across this range
# instead of pretending to one number.
PRESALE_SHARE = (0.10, 0.15, 0.20, 0.25, 0.30)

CPX_KEY = "477f072109904a55927ba2c3bf9f77e3"
CPX_BASE = "https://apis.cineplex.com/prod/cpx/theatrical/api/v1"
TIMEOUT = 12

# ----------------------------------------------------------------- args
_args = sys.argv[1:]

def _flag(name, cast=None, default=None):
    if name not in _args: return default
    i = _args.index(name)
    if cast is None: return True
    try: return cast(_args[i + 1])
    except (IndexError, ValueError): return default

FILM = _flag("--film", str, None)
if FILM not in FILMS:
    sys.exit("--film must be one of: " + ", ".join(FILMS))
F = FILMS[FILM]
FID, CPX_FILM = F["fid"], F["cpx"]

DATES = [a for a in _args if re.match(r"^\d{4}-\d{2}-\d{2}$", a)]
if not DATES:
    sys.exit("Give at least one date, e.g.\n"
             "  python dunesday_seats.py --film doomsday 2026-12-18\n"
             "There is no default: a four-date default is what cost an hour "
             "of footprint passes last time.")

WORKERS = max(1, min(24, _flag("--workers", int, 10)))
PACE0   = max(0.05, min(1.0, _flag("--pace", float, 0.12)))
RESUME  = "--resume" in _args
FOOTPRINT_ONLY = "--footprint-only" in _args
for k, v in (("--atp-std", "Standard"), ("--atp-3d", "3D"), ("--atp-prem", "Premium Format")):
    x = _flag(k, float, None)
    if x: ATP[v] = x

PAUSE_SWEEP = 0.40        # the postcode walk stays polite; it is only 385 calls
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

LOG = []
def log(*a): LOG.append(" ".join(str(x) for x in a))
def say(*a):
    s = " ".join(str(x) for x in a); LOG.append(s); print(s, flush=True)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

API_HDR = {
    "User-Agent": UA, "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate",
    "Referer": f"https://www.fandango.com/{F['slug']}/movie-times",
    "Origin": "https://www.fandango.com",
    "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
}


def get(url, hdrs, tries=3, want_json=True):
    for a in range(tries):
        try:
            with opener.open(urllib.request.Request(url, headers=hdrs), timeout=TIMEOUT) as r:
                if r.status == 204: return 204, None
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                txt = raw.decode("utf-8", "replace").strip()
                return r.status, (txt if not want_json else (json.loads(txt) if txt else None))
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
    h = {"User-Agent": UA,
         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
         "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate",
         "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate"}
    st, _ = get(f"https://www.fandango.com/{F['slug']}/movie-times", h, want_json=False)
    say(f"  session warm-up HTTP {st}; cookies {[c.name for c in jar]}")
    return bool([c for c in jar])


# ----------------------------------------------------------------- geography
ZIPS = {
 "LA":["91744","92805","91745","90630","92618","91767","91406","90703","92683","91789","92831","91301","90501","92551","93065","91311","92509","90805","92604","91214","92677","90802","93003","92374"],
 "SF Bay":["94538","95035","94085","94566","95133","94587","94536","95054","94555","94560","94539","95131","94301","94577","95014","94102","94553","95123","94501","95050","94904","95020","94589"],
 "Sacramento":["95630","95814","95758","95678","95826"],
 "San Diego":["92126","92127","92101","92122","92078"],
 "Fresno/Cent CA":["93720","93291","93311"],
 "DFW":["75024","75035","75063","76013","75093","75252","75038","75075","76006","75287","75034","75070","76210","75010","75013","75080","76092","75234","75201","76051","75056","76244","75248"],
 "Houston":["77450","77494","77082","77584","77096","77479","77024","77069","77381","77002","77379","77546","77036"],
 "Austin":["78717","78759","78613","78745","78660"],
 "San Antonio":["78258","78249","78209"],
 "NY/NJ":["08873","07302","11375","08837","07666","10016","08820","07030","11354","08854","07310","08901","07102","11101","10704","08540","07728","11691","10001","11235","07047","08816","10977","11803","10583","08831","07410","11530","10956","08648"],
 "Upstate NY":["14221","14623","12110","13057","12866"],
 # Philadelphia was under-covered at 5 sites in the 3 Oct read while Boston
 # returned 32. These are added city and suburban codes, not a demand change -
 # any metro comparison against the old read is NOT like for like.
 "Philadelphia":["19406","19087","19002","19103","08002","19355","19382","08054","19020",
                 "19106","19130","19147","19111","19152","19064","19083","19446","19454",
                 "08034","08043","08077","19320","19335","19401","19425"],
 "Boston":["01803","02451","01720","02140","01701","02062","01890","02339","02215","01821","01960","02368"],
 "Hartford/CT":["06032","06103","06810","06511"],
 "Baltimore/DC":["20171","22031","20850","20147","20852","22102","20902","22314","20705","21029","21045","21201","20874","22182","20109","21703"],
 "Richmond/VA":["23060","23455","23234","22408"],
 "N Carolina":["27560","28277","27519","27703","28273","27613","27265","28226","27587","27502","28105","27410","27606","28078","27617","28412","27455","28806"],
 "S Carolina":["29212","29464","29681"],
 "Georgia":["30097","30022","30043","30350","30024","30092","30075","30044","30076","30328","30062","30309","30518","30189","31907","30907","30016","30269"],
 "Florida":["33331","32819","33647","33029","34747","33162","33351","33584","32828","33496","33324","33186","33612","32792","33069","34211","33606","32256","32216","33409","34292","33919","33076","34787","33411"],
 "Chicago":["60563","60540","60169","60089","60504","60532","60103","60201","60611","60559","60446","60010","60074","60453","60139","60564"],
 "Detroit":["48377","48375","48098","48167","48316","48108","48073","48170","48322"],
 "Ohio":["43016","43240","44141","44114","45040","45202","43235","44236","45458","44122","45069"],
 "Indiana":["46032","46204","46835","46385"],
 "Wisconsin":["53045","53202","53719","53158"],
 "Minnesota":["55344","55425","55113","55439","55901","55304"],
 "Missouri/KS":["63017","63101","66210","64114","65804","66061","66215"],
 "Iowa/Nebraska":["50266","50010","68130","68505"],
 "Dakotas/MT":["57106","58103","59102"],
 "Colorado":["80021","80112","80202","80027","80920","80537","80134"],
 "Utah":["84070","84101","84604"],
 "Arizona":["85226","85248","85308","85382","85004","85281","85718","85249"],
 "Nevada":["89135","89109","89502"],
 "New Mexico":["87114","88001"],
 "Seattle":["98052","98007","98375","98033","98011","98034","98201","98003","98004","98040","98008","98102","98272","98296","99206","98029","98074"],
 "Portland/OR":["97006","97223","97201","97477"],
 "Idaho/WY":["83704","82001"],
 "Tennessee":["37067","37203","38120","37922","37402","37043"],
 "Kentucky":["40222","40503"],
 "Alabama/MS":["35242","36830","39232"],
 "Louisiana/AR":["70130","70503","72223"],
 "Oklahoma":["73134","74136"],
 "Pittsburgh":["15237","15222","15108"],
 "Alaska/Hawaii":["99508","96814"],
 "Rhode I/NH/ME/VT":["02903","03079","04101","05403"],
 "Delaware/WV":["19711","25304"],
}


def chain_of(name):
    n = (name or "").lower()
    for key, lab in (("amc","AMC"),("regal","Regal"),("cinemark","Cinemark"),
                     ("century","Cinemark"),("tinseltown","Cinemark"),("cut! by","Cinemark"),
                     ("marcus","Marcus"),("harkins","Harkins"),("studio movie grill","SMG"),
                     ("alamo","Alamo"),("showcase","Showcase"),("b&b","B&B"),
                     ("cinepolis","Cinepolis"),("emagine","Emagine"),("mjr","MJR")):
        if key in n: return lab
    if "look" in n and "cinema" in n: return "LOOK"
    return "Independent"


def num(v):
    try: return int(float(v))
    except Exception: return 0


# ----------------------------------------------------------------- footprint
def parse(payload, metro, zipc, theatres, shows, seen):
    nt = ns = 0
    ts = (payload or {}).get("theaterShowtimes") or {}
    for th in ts.get("theaters") or []:
        tid = str(th.get("id") or th.get("theaterId") or "")
        nm = th.get("name") or th.get("theaterName") or ""
        if not tid: continue
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
                    if key in seen: continue
                    seen.add(key)
                    shows.append({"theatreId": tid, "theatre": nm, "chain": chain_of(nm),
                                  "metro": metro, "format": fmt, "amenities": ams,
                                  "time": st.get("date", ""),
                                  "dateLocal": st.get("dateLocal", ""),
                                  "isSoldOut": st.get("isSoldOut", ""),
                                  "seatsTotal": "", "seatsAvail": "", "hash": h})
                    ns += 1
    return nt, ns


def sweep_fandango(date):
    theatres, shows, seen = {}, [], set()
    bad = 0
    npc = sum(len(v) for v in ZIPS.values()); i = 0
    for metro, zl in ZIPS.items():
        for z in zl:
            i += 1
            url = (f"https://www.fandango.com/napi/theaterShowtimeGroupings/{FID}/{date}"
                   f"?isdesktop=true&postalCode={z}&zip={z}&isDesktopMOP=true")
            st, js = get(url, API_HDR)
            if st != 200 or js is None:
                print(f"  [{i:>3}/{npc}] {metro:<16}{z}  HTTP {st}", flush=True)
                if st in (403, 429, 503):
                    bad += 1
                    if bad in (5, 15, 30):
                        print(f"        ^ {bad} throttled. Backing off 20s.", flush=True)
                        time.sleep(20)
            else:
                nt, ns = parse(js, metro, z, theatres, shows, seen)
                print(f"  [{i:>3}/{npc}] {metro:<16}{z}  +{nt:<3}th +{ns:<4}sh  "
                      f"running {len(theatres)} / {len(shows)}", flush=True)
            time.sleep(PAUSE_SWEEP)
    return theatres, shows


# ------------------------------------------------- adaptive seat-map reader
class Gate:
    """One shared pace for every worker, but it MOVES. Widens on throttling,
    narrows on clean runs. na_sweep's fixed 0.40s gate is what made 22,000
    seat maps a 2.5-hour job, and its ETA divided by --workers while the gate
    did not, so the estimate was wrong by the worker count."""
    def __init__(self, pace):
        self.lock = threading.Lock()
        self.pace = pace
        self.next = 0.0
        self.ok_streak = 0

    def wait(self):
        with self.lock:
            now = time.time()
            if self.next < now: self.next = now
            t = self.next
            self.next += self.pace
        d = t - time.time()
        if d > 0: time.sleep(d)

    def throttled(self):
        with self.lock:
            self.pace = min(1.0, self.pace * 1.5)
            self.ok_streak = 0
            return self.pace

    def ok(self):
        with self.lock:
            self.ok_streak += 1
            if self.ok_streak >= 200 and self.pace > 0.08:
                self.pace = max(0.08, self.pace * 0.9)
                self.ok_streak = 0


def seat_maps(shows, outdir):
    uniq = [s for s in shows if s["hash"]]
    hashes = list(dict.fromkeys(s["hash"] for s in uniq))
    ckpt = os.path.join(outdir, "_seatcache.json")
    cache = {}
    if RESUME and os.path.exists(ckpt):
        try:
            cache = {k: tuple(v) for k, v in json.load(open(ckpt, encoding="utf-8")).items()}
            say(f"  resuming: {len(cache):,} seat maps already read")
        except Exception as e:
            say(f"  checkpoint unreadable ({e}); starting fresh")
    todo = [h for h in hashes if h not in cache]
    gate = Gate(PACE0)
    say(f"  {len(uniq):,} showtimes, {len(hashes):,} unique seat maps, "
        f"{len(todo):,} to read")
    say(f"  {WORKERS} workers, starting pace {PACE0}s -> about "
        f"{len(todo)*PACE0/60:.0f} min if nothing throttles")
    t0 = time.time()
    lock, done, fails, thr = threading.Lock(), [0], [0], [0]

    def one(h):
        gate.wait()
        st, js = get(f"https://www.fandango.com/napi/seatMap/{h}", API_HDR, tries=2)
        if st == 200 and js is not None:
            v = (js.get("totalSeatCount", ""), js.get("totalAvailableSeatCount", ""))
            gate.ok()
        else:
            v = None
            if st in (403, 429, 503):
                p = gate.throttled(); thr[0] += 1
            else:
                thr[0] += 0
        with lock:
            if v is not None: cache[h] = v
            else: fails[0] += 1
            done[0] += 1
            n = done[0]
            if n % 250 == 0 or n == len(todo):
                el = time.time() - t0
                rate = n / el if el else 0
                left = (len(todo) - n) / rate / 60 if rate else 0
                say(f"  {n:,}/{len(todo):,} · {el/60:.1f} min · {rate:.1f} req/s · "
                    f"~{left:.0f} min left · pace {gate.pace:.2f}s · "
                    f"{fails[0]} failed · {thr[0]} throttled")
            if n % 1000 == 0:
                try: json.dump(cache, open(ckpt, "w"))
                except Exception: pass

    if todo:
        with ThreadPoolExecutor(max_workers=WORKERS) as ex:
            list(ex.map(one, todo))
    try: json.dump(cache, open(ckpt, "w"))
    except Exception: pass
    if fails[0]:
        say(f"  WARNING {fails[0]:,} seat maps failed. Those rows are BLANK, "
            f"not zero. Re-run with --resume to retry only those.")
    for s in uniq:
        s["seatsTotal"], s["seatsAvail"] = cache.get(s["hash"], ("", ""))
    return shows


# ----------------------------------------------------------------- canada
def sweep_cineplex(date):
    if not CPX_FILM:
        say("  Canada skipped: no cineplex filmId for this listing."); return []
    hdr = {"Ocp-Apim-Subscription-Key": CPX_KEY, "User-Agent": UA, "Accept": "application/json"}
    st, data = get(f"{CPX_BASE}/theatres?language=en", hdr)
    if st != 200 or not data:
        say(f"  CINEPLEX theatre list HTTP {st} - Canada missing."); return []
    tl = []
    for k in ("favouriteTheatres", "nearbyTheatres", "otherTheatres"):
        tl += data.get(k) or []
    rows = []
    for t in tl:
        tid = t.get("theatreId") or t.get("id")
        nm = t.get("theatreName") or t.get("name") or ""
        loc = t.get("location") or {}
        if not tid: continue
        s2, js = get(f"{CPX_BASE}/showtimes?language=en&filmId={CPX_FILM}"
                     f"&date={date}&locationId={tid}", hdr)
        if s2 == 200 and js:
            for row in iter_cpx(js, ""):
                row.update({"theatreId": str(tid), "theatre": nm,
                            "city": loc.get("city", ""),
                            "province": loc.get("provinceCode", "")})
                row["key"] = f"{tid}|{row['time']}|{row['format']}"
                rows.append(row)
        time.sleep(PAUSE_SWEEP)
    return rows


def iter_cpx(node, fmt):
    if isinstance(node, dict):
        f = node.get("experienceTypeName") or node.get("format") or fmt
        if node.get("showStartDateTime") or node.get("showtime") or node.get("sessionTime"):
            yield {"time": (node.get("showStartDateTime") or node.get("showtime")
                            or node.get("sessionTime") or ""), "format": f,
                   "seatsAvail": node.get("seatsAvailable", node.get("seatsRemaining", ""))}
        for v in node.values(): yield from iter_cpx(v, f)
    elif isinstance(node, list):
        for v in node: yield from iter_cpx(v, fmt)


# ----------------------------------------------------------------- baseline
def load_baseline(film, date):
    cands = sorted(d for d in glob.glob(os.path.join("intel", f"{film}-{date}-prev-*"))
                   if os.path.isdir(d))
    for d in reversed(cands):
        p = os.path.join(d, "fandango_shows.csv")
        if not os.path.exists(p): continue
        try: rows = list(csv.DictReader(open(p, encoding="utf-8")))
        except Exception: continue
        mapped = {r["hash"]: r for r in rows if r.get("hash") and num(r.get("seatsTotal"))}
        if not mapped:
            continue      # a footprint-only read has nothing to diff tickets against
        ca_av = 0
        cp = os.path.join(d, "cineplex_shows.csv")
        if os.path.exists(cp):
            try: ca_av = sum(num(r.get("seatsAvail"))
                             for r in csv.DictReader(open(cp, encoding="utf-8")))
            except Exception: pass
        m = re.search(r"-prev-(\d{4})$", d)
        return {"label": os.path.basename(d), "mapped": mapped,
                "ca_avail": ca_av, "hhmm": m.group(1) if m else None,
                "mtime": os.path.getmtime(p)}
    return None


# ----------------------------------------------------------------- report
def report(date, theatres, shows, ca, base):
    mapped = [s for s in shows if num(s["seatsTotal"])]
    tot = sum(num(s["seatsTotal"]) for s in mapped)
    av = sum(num(s["seatsAvail"]) for s in mapped)
    sold = tot - av
    cover = len(mapped) / len(shows) if shows else 0

    say(f"\n=== {F['title']} · {date} · PRESALE ===")
    say(f"  sites                {len(theatres):>9,}")
    say(f"  showtimes            {len(shows):>9,}")
    say(f"  seat maps read       {len(mapped):>9,}   {cover*100:.1f}% of showtimes")
    if not mapped:
        say("  NO SEAT DATA. Nothing below can be computed."); return
    say(f"  seats on sale        {tot:>9,}")
    say(f"  TICKETS SOLD         {sold:>9,}   {sold/tot*100:.1f}% of those seats")
    say(f"  sold-out shows       "
        f"{sum(1 for s in shows if str(s.get('isSoldOut','')).lower()=='true'):>9,}")
    say("  Presale: nothing has played, no seat map withdrawn, so this is a")
    say("  cumulative total rather than a floor.")

    # ---- velocity
    if base:
        common = [s for s in mapped if s["hash"] in base["mapped"]]
        then = sum(num(base["mapped"][s["hash"]]["seatsTotal"])
                   - num(base["mapped"][s["hash"]]["seatsAvail"]) for s in common)
        now = sum(num(s["seatsTotal"]) - num(s["seatsAvail"]) for s in common)
        hrs = (time.time() - base["mtime"]) / 3600
        say(f"\n  === VELOCITY vs {base['label']} ===")
        say(f"  showtimes in both reads {len(common):>8,}")
        say(f"  sold then {then:,} -> now {now:,}   {now-then:+,}")
        new = len(mapped) - len(common)
        if new:
            say(f"  {new:,} newly mapped showtimes excluded from that delta, so")
            say(f"  added inventory cannot inflate the rate.")
        if hrs > 0.2:
            rate = (now - then) / hrs
            say(f"  {hrs:.1f}h apart -> {rate:,.0f} tickets/hour")
            dleft = (datetime.datetime.strptime(date, "%Y-%m-%d")
                     - datetime.datetime.now()).total_seconds() / 86400
            if dleft > 14:
                say(f"  {dleft:.0f} days out. NO extrapolation printed on purpose:")
                say(f"  multiplying an hourly rate by 75 days gives a number in")
                say(f"  the tens of millions of tickets, which is garbage. The")
                say(f"  rate is a pulse reading, not a forecast. Extrapolation")
                say(f"  starts making sense inside the last fortnight, when the")
                say(f"  curve is steep but short.")
            elif dleft > 0:
                say(f"  {dleft:.1f} days out. At a FLAT rate that adds")
                say(f"  {rate*24*dleft:,.0f} more tickets - flat is conservative,")
                say(f"  because presales accelerate into the final days.")
    else:
        say(f"\n  no earlier read with seat data on disk, so no velocity yet.")
        say(f"  This read is the baseline. Run again in a few hours.")

    # ---- breakdowns
    def group(field, label, limit=None):
        g = collections.defaultdict(lambda: [set(), 0, 0, 0])
        for s in mapped:
            v = g[s[field] or "?"]
            v[0].add(s["theatreId"]); v[1] += 1
            v[2] += num(s["seatsTotal"]); v[3] += num(s["seatsAvail"])
        say(f"\n  BY {label}")
        for k, v in sorted(g.items(), key=lambda x: -(x[1][2] - x[1][3]))[:limit]:
            sd = v[2] - v[3]
            say(f"    {str(k)[:20]:<22}{len(v[0]):>5} sites{v[1]:>7,} sh"
                f"{v[2]:>10,} seats{sd:>9,} sold"
                f"{(sd/v[2]*100 if v[2] else 0):>6.1f}%")
        return g
    group("format", "FORMAT")
    group("chain", "CHAIN")
    group("metro", "METRO", 15)

    say("\n  BY TIME OF DAY (local, per-hour density so wide buckets do not lie)")
    def hour(s):
        m = re.search(r"T(\d\d):", s.get("dateLocal", "") or "")
        return int(m.group(1)) if m else None
    for lab, a, b in (("6-12",6,12),("12-4pm",12,16),("4-7pm",16,19),
                      ("7-9pm",19,21),("9pm+",21,24),("after midnight",0,6)):
        g = [s for s in mapped if hour(s) is not None and a <= hour(s) < b]
        t = sum(num(s["seatsTotal"]) for s in g)
        sd = t - sum(num(s["seatsAvail"]) for s in g)
        span = b - a
        say(f"    {lab:<16}{len(g):>7,} sh ({len(g)/span:>6.0f}/hr){t:>10,} seats"
            f"{sd:>9,} sold{(sd/t*100 if t else 0):>6.1f}%")

    # ---- money
    say(f"\n  === DOLLARS ON WHAT WE MEASURED ===")
    gross = 0.0
    for s in mapped:
        p = ATP.get(s["format"], ATP["Standard"])
        gross += (num(s["seatsTotal"]) - num(s["seatsAvail"])) * p
    say(f"  ATP assumed: " + ", ".join(f"{k} ${v:.2f}" for k, v in ATP.items())
        + "   (ASSUMPTION - override with --atp-* flags)")
    say(f"  observed presale gross  ${gross:,.0f}")
    if cover < 0.98:
        say(f"  seat coverage is {cover*100:.1f}%, so scaled to all showtimes")
        say(f"  that is about ${gross/cover:,.0f} - an ESTIMATE, label it as one.")

    say(f"\n  === WHAT THIS IMPLIES FOR THE OPENING ===")
    say(f"  We have NO measured presale-to-final ratio for a Marvel title.")
    say(f"  The $43.21 factor we calibrated on Drishyam was a same-day")
    say(f"  walk-up factor and does not transfer. So this is a sensitivity")
    say(f"  table, not a forecast. Pick a row only if you can defend it.")
    say(f"    {'presale is':<14}{'implied 3-day gross':>22}")
    for sh in PRESALE_SHARE:
        say(f"    {sh*100:>4.0f}% of final{gross/cover/sh:>22,.0f}")
    say(f"  Publish the measured presale number. Do not publish a row of")
    say(f"  this table as our estimate until we have calibrated the ratio.")

    # ---- canada
    say(f"\n  === CANADA ===")
    if not ca:
        say("  no Canadian rows in this read.")
    else:
        cav = sum(num(r.get("seatsAvail")) for r in ca)
        say(f"  sites {len({r['theatreId'] for r in ca})}   showtimes {len(ca):,}"
            f"   seats available {cav:,}")
        if base and base.get("ca_avail"):
            say(f"  was {base['ca_avail']:,} available -> {base['ca_avail']-cav:+,} "
                f"seats taken since {base['label']}")
            say(f"  That subtraction IS the Canadian ticket count. No capacity")
            say(f"  assumed, nothing scaled from showtime share.")
        else:
            say(f"  Cineplex gives availability but not capacity, so occupancy")
            say(f"  is not computable. The DROP between two reads is the ticket")
            say(f"  number - this read is the baseline for it.")
        for k, v in collections.Counter(r["province"] for r in ca).most_common():
            say(f"    {k or '?':<4}{v:>6,}")


def archive_previous(out):
    if not os.path.isdir(out) or not os.listdir(out): return
    stamp = datetime.datetime.fromtimestamp(
        max(os.path.getmtime(os.path.join(out, f)) for f in os.listdir(out))
    ).strftime("%H%M")
    dest = f"{out}-prev-{stamp}"; n = 1
    while os.path.exists(dest):
        n += 1; dest = f"{out}-prev-{stamp}-{n}"
    os.rename(out, dest)
    print(f"  previous read preserved as {dest}", flush=True)


def main():
    npc = sum(len(v) for v in ZIPS.values())
    say(f"{F['title']}  ({FILM})   fandango {FID}   cineplex {CPX_FILM or 'n/a'}")
    say(f"dates {DATES}   {npc} postcodes   {WORKERS} workers   pace {PACE0}s")
    if FOOTPRINT_ONLY:
        say("--footprint-only: NO seat maps, so NO ticket numbers. You asked.")
    print("Warming Fandango session...", flush=True)
    if not warm_session():
        print("  WARNING no cookies; the napi calls will 403", flush=True)

    for date in DATES:
        out = os.path.join("intel", f"{FILM}-{date}")
        if not RESUME: archive_previous(out)
        os.makedirs(out, exist_ok=True)
        base = load_baseline(FILM, date)
        log(f"RUN {datetime.datetime.now().isoformat()} film={FILM} date={date} "
            f"workers={WORKERS} pace={PACE0}"
            f"{' FOOTPRINT-ONLY' if FOOTPRINT_ONLY else ' SEATS'}"
            f"{' RESUMED' if RESUME else ''}")
        say(f"\n### {F['title']} · {date} -> {out}")
        theatres, shows = sweep_fandango(date)
        say(f"  {len(theatres):,} sites, {len(shows):,} showtimes")
        if not shows:
            say("  NOTHING RETURNED - presales not open for this date, or bad id.")
        json.dump({"theatres": list(theatres.values()), "shows": shows},
                  open(os.path.join(out, "_footprint.json"), "w"), indent=1)
        if not FOOTPRINT_ONLY and shows:
            say("Seat maps...")
            shows = seat_maps(shows, out)
        say("Cineplex (Canada)...")
        ca = sweep_cineplex(date)
        say(f"  {len(ca):,} Canadian showtimes")

        for path, cols, rows in (
            ("fandango_theatres.csv", ["theatreId","name","chain","metro","zipFound","pageUrl"],
             list(theatres.values())),
            ("fandango_shows.csv", ["theatreId","theatre","chain","metro","format","amenities",
                                    "time","dateLocal","isSoldOut","seatsTotal","seatsAvail","hash"],
             shows),
            ("cineplex_shows.csv", ["theatreId","theatre","city","province","time","format",
                                    "seatsAvail","key"], ca)):
            with open(os.path.join(out, path), "w", newline="", encoding="utf-8") as fh:
                w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
                w.writeheader()
                for r in rows: w.writerow(r)

        report(date, theatres, shows, ca, base)
        open(os.path.join(out, "RUN.txt"), "w", encoding="utf-8").write("\n".join(LOG))
        say(f"Written to {out}")


if __name__ == "__main__":
    main()
