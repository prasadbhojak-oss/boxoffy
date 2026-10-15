#!/usr/bin/env python3
"""
Boxoffy - RAMAYANA, NORTH AMERICA, NOV 4 PREMIERES. ONE SCAN.

    python ramayana_na_nov4.py

That is the whole command. Defaults are 2026-11-04 and both film cuts.
Prints THREE numbers: showtimes, screens, first show in Eastern time.
Everything else is behind --verbose or in the CSVs it writes.

WHAT IT SWEEPS IN ONE PASS
  1. Fandango, 401 US postcodes. This is the one that matters, because
     Fandango aggregates AMC, Regal, Cinemark, Marcus, Harkins, B&B,
     Cinepolis, Showcase, Alamo, Studio Movie Grill, Emagine, MJR, LOOK
     and the independents. One API, every major US chain.
  2. Cineplex, every Canadian site, film id resolved by title at runtime
     rather than hardcoded - we have never had a Ramayana Cineplex id.
  3. BOTH CUTS. The Hindi 3h15m and the English 2h45m are separate
     listings with separate ids. na_presale.py swept fid 245446 only,
     which is the Hindi cut, so every North America number we have ever
     published for this film is a floor for that reason alone. This
     script discovers sibling ids and sweeps all of them.

✅ AMC IS NEVER FETCHED. amctheatres.com is robots-disallowed and
   block_amc() below refuses the host at the HTTP layer, so it cannot
   happen by accident. We still GET AMC's showtimes - through Fandango,
   which publishes them. That is the whole point of going via Fandango.

✅ GET ONLY. No POST anywhere in this file. Nothing is reserved, held,
   added to a cart or booked. A seat map is not even read - this script
   counts shows and screens, which needs no seat data at all.

✅ A 403 IS AN ANSWER. Throttles are counted and printed. The script
   backs off, it does not rotate agents or route around anything.

HOW "SCREENS" IS COUNTED - read this before quoting the number
  Fandango does not publish auditorium ids, so screens cannot be read
  directly. They are INFERRED from overlap: two showtimes at the same
  site whose runtimes overlap must be in two different auditoriums. The
  script sweeps each site's showtime list and takes the maximum number
  simultaneously running. That is a FLOOR, not a count - a site playing
  one show at 3pm and another at 7pm on two different screens reads as
  one screen here, and correctly so, because nothing in the data says
  otherwise.
  It also prints the distinct (site x format) count as a cross-check.
  If the two disagree badly, say so rather than picking the bigger one.

Stdlib only. Python 3.8+. Windows-safe.
"""

import json, os, csv, sys, re, time, gzip, io, datetime, collections
import urllib.request, urllib.error, urllib.parse, http.cookiejar

# ----------------------------------------------------------------- config
DATE_DEFAULT = "2026-11-04"          # Nov 4 premieres

# Known listings. 245446 is VERIFIED off the live Fandango page, 15 Oct 2026.
# The English cut's id is NOT known - as of 15 Oct no US platform we can read
# carries it. discover_ids() looks for it every run; if it appears, it is
# swept automatically and the report says so.
CUTS = {
    "245446": {"label": "Hindi 3h15m", "runtime": 195},
}
RUNTIME_DEFAULT = 195                # minutes, the Hindi cut
TURNAROUND = 25                      # minutes between shows in one auditorium

CPX_KEY  = "477f072109904a55927ba2c3bf9f77e3"
CPX_BASE = "https://apis.cineplex.com/prod/cpx/theatrical/api/v1"
TIMEOUT  = 12
PAUSE    = 0.40                      # polite; it is ~401 calls a cut

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

# ----------------------------------------------------------------- args
_a = sys.argv[1:]
def flag(name, cast=None, default=None):
    if name not in _a: return default
    i = _a.index(name)
    if cast is None: return True
    try: return cast(_a[i + 1])
    except (IndexError, ValueError): return default

DATES   = [x for x in _a if re.match(r"^\d{4}-\d{2}-\d{2}$", x)] or [DATE_DEFAULT]
VERBOSE = "--verbose" in _a or "-v" in _a
NO_CA   = "--no-canada" in _a
EXTRA   = [x for x in (flag("--fid", str, "") or "").split(",") if x.strip()]
OUTDIR  = flag("--out", str, None) or os.path.join("intel", "ramayana-na")

for f in EXTRA:
    CUTS.setdefault(f.strip(), {"label": f"manual {f.strip()}",
                                "runtime": RUNTIME_DEFAULT})

LOG = []
def say(*x):
    s = " ".join(str(i) for i in x); LOG.append(s); print(s, flush=True)
def vsay(*x):
    s = " ".join(str(i) for i in x); LOG.append(s)
    if VERBOSE: print(s, flush=True)

# ----------------------------------------------------------------- http
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

BLOCKED_HOSTS = ("amctheatres.com", "www.amctheatres.com")

def block_amc(url):
    """Hard guard. amctheatres.com is robots-disallowed. This is not a
    politeness setting that a future edit can quietly flip - any URL on
    that host raises instead of being requested."""
    host = (urllib.parse.urlparse(url).hostname or "").lower()
    if any(host == b or host.endswith("." + b) for b in BLOCKED_HOSTS):
        raise RuntimeError(f"refusing {host}: robots-disallowed. "
                           f"AMC showtimes come via Fandango instead.")

STATS = collections.Counter()

def get(url, hdrs, tries=3, want_json=True):
    block_amc(url)
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers=hdrs)   # GET. always.
            with opener.open(req, timeout=TIMEOUT) as r:
                if r.status == 204:
                    STATS["204"] += 1; return 204, None
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                txt = raw.decode("utf-8", "replace").strip()
                STATS["200"] += 1
                return r.status, (txt if not want_json
                                  else (json.loads(txt) if txt else None))
        except urllib.error.HTTPError as e:
            STATS[str(e.code)] += 1
            if e.code in (429, 503) and n < tries - 1:
                time.sleep(2 * (n + 1)); continue
            return e.code, None
        except Exception:
            STATS["err"] += 1
            if n < tries - 1:
                time.sleep(1.5 * (n + 1)); continue
            return 0, None
    return 0, None

def api_hdr(fid):
    return {"User-Agent": UA, "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Referer": f"https://www.fandango.com/ramayana-2026-{fid}/movie-times",
            "Origin": "https://www.fandango.com",
            "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
            "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"',
            "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin"}

HTML_HDR = {"User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate"}

def warm():
    st, _ = get("https://www.fandango.com/ramayana-2026-245446/movie-times",
                HTML_HDR, want_json=False)
    vsay(f"  session warm-up HTTP {st}; cookies {[c.name for c in jar]}")
    if not [c for c in jar]:
        say("  WARNING no cookies set. The napi calls will probably 403.")
    return st

# -------------------------------------------------- discover the second cut
def discover_ids():
    """The English 2h45m cut has its own Fandango id and we do not know it.
    Two routes, and the script REPORTS what each returned rather than
    silently finding nothing - a silent zero here is how we swept one cut
    for three weeks without noticing."""
    found = {}
    st, html = get("https://www.fandango.com/ramayana-2026-245446/movie-overview",
                   HTML_HDR, want_json=False)
    vsay(f"  discovery: overview page HTTP {st}")
    if st == 200 and html:
        for slug, fid in set(re.findall(
                r'/([a-z0-9\-]*ramayan[a-z0-9\-]*?-(\d{6}))/', html, re.I)):
            found[fid] = slug
    st2, js = get("https://www.fandango.com/napi/search?q=ramayana", api_hdr("245446"))
    vsay(f"  discovery: search endpoint HTTP {st2}")
    if st2 == 200 and js:
        for fid in set(re.findall(r'(\d{6})', json.dumps(js))):
            found.setdefault(fid, "search")
    new = {f: s for f, s in found.items() if f not in CUTS}
    if new:
        say(f"  DISCOVERED {len(new)} further Ramayana listing(s): "
            + ", ".join(f"{f} ({s})" for f, s in new.items()))
        say("  Sweeping them too. CHECK whether one is the English 2h45m cut.")
        for f, s in new.items():
            rt = 165 if "english" in s.lower() else RUNTIME_DEFAULT
            CUTS[f] = {"label": f"discovered {s}", "runtime": rt}
    else:
        say("  No second Ramayana listing found. Sweeping the Hindi cut only,")
        say("  so every number below is a FLOOR for the full release.")
    return CUTS

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
 "Philadelphia":["19406","19087","19002","19103","08002","19355","19382","08054","19020","19106","19130","19147","19111","19152","19064","19083","19446","19454","08034","08043","08077","19320","19335","19401","19425"],
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
                     ("century","Cinemark"),("tinseltown","Cinemark"),
                     ("cut! by","Cinemark"),("marcus","Marcus"),
                     ("harkins","Harkins"),("studio movie grill","SMG"),
                     ("alamo","Alamo"),("showcase","Showcase"),("b&b","B&B"),
                     ("cinepolis","Cinepolis"),("emagine","Emagine"),
                     ("mjr","MJR"),("phoenix","Phoenix Big"),
                     ("moviemax","MovieMax"),("megaplex","Megaplex"),
                     ("santikos","Santikos"),("malco","Malco"),
                     ("cmx","CMX"),("landmark","Landmark")):
        if key in n: return lab
    if "look" in n and "cinema" in n: return "LOOK"
    return "Independent"

# ----------------------------------------------------------------- fandango
def parse(payload, metro, zipc, date, fid, theatres, shows, seen):
    nt = ns = 0
    ts = (payload or {}).get("theaterShowtimes") or {}
    for th in ts.get("theaters") or []:
        tid = str(th.get("id") or th.get("theaterId") or "")
        nm = th.get("name") or th.get("theaterName") or ""
        if not tid: continue
        if tid not in theatres:
            theatres[tid] = {"theatreId": tid, "name": nm, "chain": chain_of(nm),
                             "metro": metro, "zipFound": zipc, "country": "US"}
            nt += 1
        for var in th.get("variants") or []:
            fmt = var.get("filmFormatHeader") or ""
            for grp in var.get("amenityGroups") or []:
                for st in grp.get("showtimes") or []:
                    local = st.get("dateLocal", "") or ""
                    # The napi call is per-date but has bled a day either side
                    # before. Filter on the LOCAL date or a 3pm ET premiere
                    # ends up counted under the 5th.
                    if local and not local.startswith(date):
                        continue
                    h = st.get("showtimeHashCode", "")
                    key = h or f"{tid}|{local}|{fmt}|{fid}"
                    if key in seen: continue
                    seen.add(key)
                    shows.append({"src": "fandango", "fid": fid,
                                  "cut": CUTS[fid]["label"],
                                  "theatreId": tid, "theatre": nm,
                                  "chain": chain_of(nm), "metro": metro,
                                  "country": "US", "format": fmt,
                                  "dateLocal": local,
                                  "time": st.get("date", ""),
                                  "isSoldOut": st.get("isSoldOut", "")})
                    ns += 1
    return nt, ns

def sweep_fandango(date, fid):
    """Prints one line per postcode, ALWAYS. The first version of this file
    hid the progress line behind --verbose, so a run with no flags printed
    nothing for the whole 401-postcode loop and looked hung. It was not hung;
    it was silent. Never do that again - a long sweep must prove it is alive."""
    theatres, shows, seen = {}, [], set()
    hdr = api_hdr(fid)
    npc = sum(len(v) for v in ZIPS.values()); i = 0; bad = 0
    consec = 0                 # consecutive refusals from the very first call
    t0 = time.time()
    for metro, zl in ZIPS.items():
        for z in zl:
            i += 1
            url = (f"https://www.fandango.com/napi/theaterShowtimeGroupings/"
                   f"{fid}/{date}?isdesktop=true&postalCode={z}&zip={z}"
                   f"&isDesktopMOP=true")
            st, js = get(url, hdr)
            el = time.time() - t0
            eta = (npc - i) * (el / i) / 60 if i else 0
            if st != 200 or js is None:
                consec += 1
                say(f"  [{i:>3}/{npc}] {metro:<16}{z}  HTTP {st:<4}"
                    f"  {len(theatres):>4}th {len(shows):>5}sh  ~{eta:.0f}m left")
                if st in (403, 429, 503):
                    bad += 1
                    if bad in (5, 15, 30):
                        say(f"        ^ {bad} throttled. Backing off 20s. "
                            f"A 403 is an answer, not an obstacle.")
                        time.sleep(20)
                # EARLY ABORT. If the first dozen calls are all refused, the
                # remaining 373 will be too, and at up to 40s each that is a
                # four-hour grind for nothing. Stop and say so.
                if consec >= 12 and not shows and "--force" not in _a:
                    say("")
                    say(f"  STOPPING: the first {consec} requests were all refused "
                        f"or empty.")
                    say(f"  HTTP so far: " + ", ".join(f"{k} {v}" for k, v
                                                       in sorted(STATS.items())))
                    say("  Either Fandango is declining this client, or there is")
                    say("  nothing listed for this film and date yet. Both are")
                    say(f"  answers. Re-run with --force to grind all {npc}")
                    say("  anyway, or with --verbose to see each response.")
                    return theatres, shows
            else:
                consec = 0
                nt, ns = parse(js, metro, z, date, fid, theatres, shows, seen)
                say(f"  [{i:>3}/{npc}] {metro:<16}{z}  +{nt:<3}th +{ns:<4}sh"
                    f"  {len(theatres):>4}th {len(shows):>5}sh  ~{eta:.0f}m left")
            time.sleep(PAUSE)
    return theatres, shows

# ----------------------------------------------------------------- cineplex
def cineplex_film_ids():
    """We have never had a Ramayana Cineplex id, so resolve it by title.
    /movies is the right path - /films 404s, which cost us a run once."""
    hdr = {"Ocp-Apim-Subscription-Key": CPX_KEY, "User-Agent": UA,
           "Accept": "application/json"}
    st, js = get(f"{CPX_BASE}/movies?language=en", hdr)
    if st != 200 or not js:
        say(f"  CINEPLEX catalogue HTTP {st} - Canada not readable this run.")
        return [], hdr
    ids = []
    def walk(n):
        if isinstance(n, dict):
            t = str(n.get("filmTitle") or n.get("title") or n.get("name") or "")
            fid = n.get("filmId") or n.get("id")
            if fid and "ramayan" in t.lower():
                # 1992's "Ramayana: The Legend of Prince Rama" is a DIFFERENT
                # film and gets screened by community groups in Canada. Do not
                # let it into the count.
                if "prince rama" in t.lower() or "legend of prince" in t.lower():
                    say(f"  SKIPPING Cineplex '{t}' (id {fid}) - that is the "
                        f"1992 animated film, not the Tiwari one.")
                else:
                    ids.append((str(fid), t))
            for v in n.values(): walk(v)
        elif isinstance(n, list):
            for v in n: walk(v)
    walk(js)
    ids = list(dict.fromkeys(ids))
    if ids:
        say("  Cineplex listing(s): " + ", ".join(f"{i} {t!r}" for i, t in ids))
    else:
        say("  Cineplex carries no Ramayana listing. Canada = 0, and that is a")
        say("  reading, not a gap. Cineplex had 7 Indian films in its 256-film")
        say("  catalogue at last check and all were Hindi, so a listing is")
        say("  plausible later - rerun nearer release.")
    return ids, hdr

def sweep_cineplex(date):
    ids, hdr = cineplex_film_ids()
    if not ids: return {}, []
    st, data = get(f"{CPX_BASE}/theatres?language=en", hdr)
    if st != 200 or not data:
        say(f"  CINEPLEX theatre list HTTP {st} - Canada missing."); return {}, []
    tl = []
    for k in ("favouriteTheatres", "nearbyTheatres", "otherTheatres"):
        tl += data.get(k) or []
    theatres, shows = {}, []
    say(f"  {len(tl)} Canadian sites x {len(ids)} listing(s) to check")
    n = 0
    for t in tl:
        tid = t.get("theatreId") or t.get("id")
        nm = t.get("theatreName") or t.get("name") or ""
        loc = t.get("location") or {}
        if not tid: continue
        n += 1
        if n % 10 == 0 or n == 1:
            say(f"  [{n:>3}/{len(tl)}] {str(nm)[:30]:<32}"
                f"{len(shows):>5} shows so far")
        for cfid, ctitle in ids:
            s2, js = get(f"{CPX_BASE}/showtimes?language=en&filmId={cfid}"
                         f"&date={date}&locationId={tid}", hdr)
            if s2 == 200 and js:
                for row in iter_cpx(js, ""):
                    when = str(row["time"])
                    if when and date not in when:
                        continue
                    theatres.setdefault(str(tid), {
                        "theatreId": str(tid), "name": nm,
                        "chain": "Cineplex", "metro": loc.get("city", ""),
                        "zipFound": "", "country": "CA"})
                    shows.append({"src": "cineplex", "fid": cfid,
                                  "cut": ctitle, "theatreId": str(tid),
                                  "theatre": nm, "chain": "Cineplex",
                                  "metro": loc.get("city", ""), "country": "CA",
                                  "format": row["format"], "dateLocal": when,
                                  "time": when, "isSoldOut": ""})
            time.sleep(PAUSE)
    return theatres, shows

def iter_cpx(node, fmt):
    if isinstance(node, dict):
        f = node.get("experienceTypeName") or node.get("format") or fmt
        if node.get("showStartDateTime") or node.get("showtime") or node.get("sessionTime"):
            yield {"time": (node.get("showStartDateTime") or node.get("showtime")
                            or node.get("sessionTime") or ""), "format": f}
        for v in node.values(): yield from iter_cpx(v, f)
    elif isinstance(node, list):
        for v in node: yield from iter_cpx(v, fmt)

# ----------------------------------------------------------------- screens
def parse_local(s):
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})", str(s) or "")
    if not m: return None
    return datetime.datetime(*[int(g) for g in m.groups()])

# US daylight saving ends Sun 1 Nov 2026, so 4 Nov is EST = UTC-5, not EDT.
# Getting this wrong moves every premiere by an hour.
EST = datetime.timezone(datetime.timedelta(hours=-5))

def parse_abs(s):
    """Only returns something when the string carries a UTC offset. A naive
    local time cannot be converted to Eastern without knowing the site's
    timezone, and guessing one is how a 3pm ET claim turns into noon."""
    s = str(s or "")
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})"
                  r"(?::\d{2})?(Z|[+-]\d{2}:?\d{2})", s)
    if not m: return None
    g = [int(x) for x in m.groups()[:5]]
    off = m.group(6)
    if off == "Z":
        tz = datetime.timezone.utc
    else:
        off = off.replace(":", "")
        sign = 1 if off[0] == "+" else -1
        tz = datetime.timezone(sign * datetime.timedelta(
            hours=int(off[1:3]), minutes=int(off[3:5])))
    return datetime.datetime(*g, tzinfo=tz)

def first_show_et(shows):
    """Earliest showtime expressed in Eastern. Returns (time, n_with_offset,
    n_total) so the caller can say how much of the board it actually saw."""
    aware = []
    for s in shows:
        for field in ("time", "dateLocal"):
            d = parse_abs(s.get(field))
            if d: aware.append(d.astimezone(EST)); break
    return (min(aware) if aware else None), len(aware), len(shows)

def screens_by_overlap(shows):
    """Two showtimes at one site whose runtimes overlap cannot share an
    auditorium. Max simultaneous = minimum screens. This is a FLOOR."""
    per = collections.defaultdict(list)
    for s in shows:
        t = parse_local(s.get("dateLocal") or s.get("time"))
        if t is None: continue
        rt = CUTS.get(s.get("fid"), {}).get("runtime", RUNTIME_DEFAULT)
        per[s["theatreId"]].append((t, t + datetime.timedelta(minutes=rt + TURNAROUND)))
    total, detail = 0, {}
    for tid, spans in per.items():
        ev = []
        for a, b in spans:
            ev.append((a, 1)); ev.append((b, -1))
        ev.sort(key=lambda x: (x[0], -x[1]))
        cur = best = 0
        for _, d in ev:
            cur += d; best = max(best, cur)
        detail[tid] = best; total += best
    return total, detail

def main():
    say("RAMAYANA - NORTH AMERICA SWEEP")
    say(f"dates {DATES}   out {OUTDIR}")
    say("AMC blocked at the HTTP layer; its showtimes arrive via Fandango.")
    say("GET only. Nothing is held, reserved or booked.\n")
    warm()
    discover_ids()
    say(f"  sweeping {len(CUTS)} cut(s): "
        + ", ".join(f"{k} ({v['label']})" for k, v in CUTS.items()) + "\n")

    for date in DATES:
        theatres, shows = {}, []
        for fid in list(CUTS):
            say(f"Fandango · cut {fid} ({CUTS[fid]['label']}) · {date} ...")
            th, sh = sweep_fandango(date, fid)
            theatres.update(th); shows += sh
            say(f"  {len(th):,} sites, {len(sh):,} showtimes on this cut")
        if not NO_CA:
            say(f"Cineplex · Canada · {date} ...")
            cth, csh = sweep_cineplex(date)
            theatres.update(cth); shows += csh
            say(f"  {len(cth):,} Canadian sites, {len(csh):,} showtimes")

        scr, _ = screens_by_overlap(shows)
        fmt_pairs = len({(s["theatreId"], s["format"]) for s in shows})
        et_first, n_off, n_all = first_show_et(shows)
        loc_first = min((t for t in (parse_local(s.get("dateLocal") or s.get("time"))
                                     for s in shows) if t), default=None)

        os.makedirs(OUTDIR, exist_ok=True)
        with open(os.path.join(OUTDIR, f"shows-{date}.csv"), "w",
                  newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, extrasaction="ignore", fieldnames=[
                "src","fid","cut","country","chain","theatre","theatreId",
                "metro","format","dateLocal","time","isSoldOut"])
            w.writeheader()
            for r in shows: w.writerow(r)

        say("\n" + "=" * 46)
        say(f"RAMAYANA · NORTH AMERICA · {date}")
        say("=" * 46)
        say(f"  SHOWTIMES {len(shows):>14,}")
        say(f"  SCREENS   {scr:>14,}")
        if et_first:
            say(f"  FIRST SHOW{et_first.strftime('%H:%M') + ' ET':>14}")
        elif loc_first:
            say(f"  FIRST SHOW{loc_first.strftime('%H:%M') + ' local':>14}")
            say("             (no UTC offsets in the feed, so this is site-local,")
            say("              NOT Eastern. Do not quote it as an ET time.)")
        else:
            say(f"  FIRST SHOW {'n/a':>13}")
        say("=" * 46)
        if et_first and n_off < n_all:
            say(f"  ET time derived from {n_off:,} of {n_all:,} showtimes that "
                f"carry a UTC offset.")

        if not shows:
            say("  ZERO. Nothing is listed for this date yet. That is a")
            say("  reading, not a failure - check the HTTP tally below. If it")
            say("  is all 200s, the listings genuinely do not exist yet.")
        else:
            say(f"  sites {len(theatres):,} · screens cross-check: "
                f"{fmt_pairs:,} site x format pairs")
            if fmt_pairs > scr * 1.5:
                say("  ^ those two disagree by more than half. Quote the")
                say("    overlap floor and say it is a floor.")
            say(f"  US {sum(1 for s in shows if s['country']=='US'):,} · "
                f"CA {sum(1 for s in shows if s['country']=='CA'):,}")
            if VERBOSE:
                for lab, key in (("CHAIN","chain"), ("CUT","cut"), ("FORMAT","format")):
                    say(f"\n  BY {lab}")
                    c = collections.Counter(s[key] or "?" for s in shows)
                    for k, v in c.most_common():
                        say(f"    {str(k)[:28]:<30}{v:>7,}")
        say(f"\n  HTTP: " + ", ".join(f"{k} {v}" for k, v in sorted(STATS.items())))
        say(f"  shows CSV -> {os.path.join(OUTDIR, f'shows-{date}.csv')}")

    with open(os.path.join(OUTDIR, "RUN.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(LOG))

if __name__ == "__main__":
    main()
