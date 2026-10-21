#!/usr/bin/env python3
"""
Boxoffy - BOOKMYSHOW SWEEP, any film, all languages. Generalised engine.

    python bms_sweep.py --film ramayana            India release date
    python bms_sweep.py --film ramayana 20261020   a specific show date
    python bms_sweep.py --film ramayana --ids      find the ET codes, stop
    python bms_sweep.py --film ramayana --core     metros + big states only
    python bms_sweep.py --film jailer2 --core
    python bms_sweep.py regions madurai            look up a region code

Generalised from jailer2_bms_sweep.py on 19 Oct, the same way district_sweep.py
replaced jailer2_district_sweep.py. SAME ENGINE, SAME PARSE, SAME REPORT - the
only thing that moved into a registry is the film. jailer2_bms_sweep.py is left
on disk untouched as the record of the Jailer 2 run; nothing in this project
deletes its own history.

Every warning in the original header still applies in full and is reproduced
below. The region-cookie trap in particular has not gone away.

READ THIS FIRST. IT IS NOT THE DISTRICT SWEEP.
---------------------------------------------
District gives us exact seats sold and an advance gross. BookMyShow does NOT.
Verified against the live Chennai page for Jailer 2 on 15 Oct: every seat field
on the page is a LABEL, not a count.

    "seatAvalibility": "SOLD OUT"      <- BMS's own spelling, keep the typo
    "seatAvalibility": "ALMOST FULL"
    "seatAvalibility": "FILLING FAST"
    "seatAvalibility": "AVAILABLE"

There is no seatsTotal, no seatsAvail, no seat layout and no occupancy figure
anywhere outside the booking funnel. So this script CANNOT produce seats sold,
CANNOT produce an advance gross, and must never be used to predict an opening
day in rupees. For those, run district_sweep.py.

WHAT IT IS WORTH, AND IT IS A LOT
---------------------------------
BookMyShow carries the single screens and small-town chains District does not
list. So BMS is our only honest read on the FOOTPRINT of a release:

    shows, venues, screens, formats, cities, states, languages
    the real ticket price per seat class, in rupees
    the share of shows already flagged SOLD OUT
    the early-morning FDFS block

RUN BOTH. THEY MEASURE DIFFERENT THINGS.
District = seats and money, on the venues it carries.
BookMyShow = the true footprint, with no seats.
Neither is a substitute for the other and neither total should be added to the
other - the same venue appears on both, so a sum double-counts it.

HARD RULES
----------
  - Public pages only. No login, no account, no credentials.
  - GET only. Nothing booked, nothing held, nothing posted, no funnel entry.
  - A 403 is an ANSWER, not an obstacle. Recorded, never worked around.
  - Generous pacing. BMS sits behind Cloudflare and we are a guest.

MECHANICS THAT WILL BITE YOU IF YOU CHANGE THIS FILE
----------------------------------------------------
1. THE REGION COMES FROM A COOKIE, NOT THE URL. This is the big one. The
   region segment in the path is cosmetic. A fetch of
       /buytickets/jailer-2-coimbatore/movie-ZZZZ-ET00518674-MT/20261015
   returned HTTP 200 with 2.11 MB of CHENNAI data, because the cookie said
   Chennai. The same garbage code returned near-identical byte counts for
   chennai, coimbatore and mumbai. A sweep that trusts the URL would quietly
   report Chennai's numbers for twenty-three cities.
   So: we set the rgn cookie per region, then VERIFY by reading the region back
   out of the page's own cache key, and refuse the row if it does not match.

2. The payload is inline. There is no showtimes XHR - the data ships in
   window.__INITIAL_STATE__ with the document. One request per region.

3. Each language is a SEPARATE event code, and they surface in DIFFERENT
   markets. Jailer 2's Telugu code only ever appeared on the Hyderabad page.
   Hardcoding one code silently drops the rest, so codes are discovered across
   DISCOVERY_MARKETS using the film's own match/reject patterns.

4. Thane, Navi Mumbai and Kalyan are INSIDE region MUMBAI. Noida, Gurgaon,
   Ghaziabad and Faridabad are INSIDE region NCR. Mohali is inside CHD.
   Sweeping them separately double-counts the same shows. They are absent from
   the region table on purpose - do not add them.

5. Tiruchirappalli (TRII) and Trichy (TRIC) are BOTH live regions for the same
   city. We sweep TRII only, for the same reason.

Writes intel/<film>-bms-<date>/ . Stdlib only. Python 3.8+. Windows-safe.
"""

import os, re, csv, io, sys, json, gzip, time, datetime, collections
import urllib.request, urllib.error, urllib.parse

# ───────────────────────────────────────────────────────── film registry
# "match" runs against the BMS href. "reject" keeps a same-named older film
# out. "keep" RESCUES a slug that matched reject - it is a safety net, not a
# filter, which is the same contract district_sweep.py uses.
# "core" is the --core region list. It is per film ON PURPOSE: a Tamil-led
# release and a Hindi-led one do not have the same short list, and using
# Jailer 2's Tamil-Nadu-weighted core for a Hindi release would report a
# national footprint off a southern sample.
FILMS = {
    "ramayana": {
        "film": "Ramayana: Rise of a Legend",
        "release": "20261105",
        "slug": "ramayana",
        "match": r"ramayan",
        # The 1992 animated Ramayana: The Legend of Prince Rama still lists,
        # and the television serials re-release constantly. Note that Sony's
        # CHINESE title for our film is "Ramayana: The Legend of the Prince",
        # which is one word away from the 1992 film - that is a China title
        # and must never be used to match an Indian listing.
        "reject": r"legend[-_]?of[-_]?(the[-_]?)?prince|prince[-_]?rama|1992"
                  r"|sampoorn|lav[-_]?kush|ramayan[-_]?the[-_]?legend"
                  r"|uttar[-_]?ramayan|serial",
        "keep": r"rise[-_]?of[-_]?a[-_]?legend|rise[-_]?of[-_]?legend",
        "core": ["mumbai", "national-capital-region-ncr", "bengaluru",
                 "hyderabad", "chennai", "kolkata", "pune", "ahmedabad",
                 "lucknow", "jaipur", "chandigarh", "indore", "kochi",
                 "vizag", "surat", "nagpur", "patna", "bhopal", "vadodara",
                 "coimbatore", "thiruvananthapuram", "vijayawada",
                 "bhubaneswar", "guwahati", "kanpur", "varanasi"],
        "note": "Hindi-led, six languages (hi/te/ta/kn/ml/en). India advance "
                "booking opens 20 Oct for a 5 Nov release. Expect the Hindi "
                "code to dominate and the dubs to surface in their own "
                "markets - check Hyderabad and Kochi before concluding a "
                "language is absent.",
    },
    "jailer2": {
        "film": "Jailer 2",
        "release": "20261015",
        "slug": "jailer-2",
        "match": r"jailer",
        "reject": r"jailer[-_]?2023|jailer[-_]?1",
        "keep": r"jailer[-_]?2|jailer[-_]?two",
        "core": None,   # None = the original Tamil-Nadu-weighted CORE below
        "note": "Tamil-led. Telugu code only ever appeared on Hyderabad.",
    },
}

_args      = [a for a in sys.argv[1:] if a]
DATE_RE    = re.compile(r"^\d{8}$")
_dates     = [a for a in _args if DATE_RE.match(a)]
IDS_ONLY   = "--ids" in _args
CORE_ONLY  = "--core" in _args
LOOKUP     = _args[0].lower() == "regions" if _args else False

def _flag(name, default=""):
    if name not in _args: return default
    i = _args.index(name)
    return _args[i + 1] if i + 1 < len(_args) else default

FILM_KEY = (_flag("--film") or "").lower()
if not LOOKUP and FILM_KEY not in FILMS:
    sys.exit("--film must be one of: " + ", ".join(FILMS))
_F         = FILMS.get(FILM_KEY, FILMS["ramayana"])
FILM       = _F["film"]
RELEASE    = _F["release"]
SLUG_HINT  = _F["slug"]
MATCH_RE   = re.compile(_F["match"], re.I)
REJECT_RE  = re.compile(_F["reject"], re.I) if _F.get("reject") else None
KEEP_RE    = re.compile(_F["keep"], re.I) if _F.get("keep") else None
DATE       = _dates[0] if _dates else RELEASE

OUT        = os.path.join("intel", f"{FILM_KEY}-bms-{DATE}")
PAUSE      = 1.6                   # BMS is behind Cloudflare. Be a good guest.

BASE       = "https://in.bookmyshow.com"

# ── The four fullness labels BMS publishes, worst-filled to best. The spelling
#    of the field name is BMS's own and includes their typo. Do not "fix" it.
LABELS     = ["SOLD OUT", "ALMOST FULL", "FILLING FAST", "AVAILABLE"]
LABEL_RANK = {l: i for i, l in enumerate(LABELS)}

# ── REGION TABLE, read off BMS's own /api/explore/v1/discover/regions on
#    13 Oct 2026 (2,080 regions in the full table). These are verified, not
#    guessed. The old mumb/ncr/bang/hyd/chen folklore was wrong: Mumbai is
#    MUMBAI, not mumb.
#    slug -> (REGIONCODE, display name, state)
REGIONS = {
  # ---- Tamil Nadu. This is the market. It is mostly tier 2 and tier 3.
  "chennai":           ("CHEN",  "Chennai",            "Tamil Nadu"),
  "coimbatore":        ("COIM",  "Coimbatore",         "Tamil Nadu"),
  "madurai":           ("MADU",  "Madurai",            "Tamil Nadu"),
  "tiruchirappalli":   ("TRII",  "Tiruchirappalli",    "Tamil Nadu"),
  "salem":             ("SALM",  "Salem",              "Tamil Nadu"),
  "erode":             ("EROD",  "Erode",              "Tamil Nadu"),
  "tirunelveli":       ("TIRV",  "Tirunelveli",        "Tamil Nadu"),
  "vellore":           ("VELL",  "Vellore",            "Tamil Nadu"),
  "thanjavur":         ("TANJ",  "Thanjavur",          "Tamil Nadu"),
  "tiruppur":          ("TIRP",  "Tiruppur",           "Tamil Nadu"),
  "hosur":             ("HSUR",  "Hosur",              "Tamil Nadu"),
  "dindigul":          ("DIND",  "Dindigul",           "Tamil Nadu"),
  "karur":             ("KARU",  "Karur",              "Tamil Nadu"),
  "namakkal":          ("NMKL",  "Namakkal",           "Tamil Nadu"),
  "nagercoil":         ("NAGE",  "Nagercoil",          "Tamil Nadu"),
  "cuddalore":         ("CUDD",  "Cuddalore",          "Tamil Nadu"),
  "kanchipuram":       ("KNPM",  "Kanchipuram",        "Tamil Nadu"),
  "villupuram":        ("VILL",  "Villupuram",         "Tamil Nadu"),
  "tiruvannamalai":    ("TVNM",  "Tiruvannamalai",     "Tamil Nadu"),
  "krishnagiri":       ("KRHN",  "Krishnagiri",        "Tamil Nadu"),
  "pudukkottai":       ("PUDH",  "Pudukkottai",        "Tamil Nadu"),
  "virudhunagar":      ("VIRU",  "Virudhunagar",       "Tamil Nadu"),
  "theni":             ("THEN",  "Theni",              "Tamil Nadu"),
  "sivakasi":          ("SIV",   "Sivakasi",           "Tamil Nadu"),
  "rajapalayam":       ("RAYM",  "Rajapalayam",        "Tamil Nadu"),
  "pollachi":          ("POLL",  "Pollachi",           "Tamil Nadu"),
  "ramanathapuram":    ("RAPU",  "Ramanathapuram",     "Tamil Nadu"),
  "ariyalur":          ("ARIY",  "Ariyalur",           "Tamil Nadu"),
  "perambalur":        ("PERA",  "Perambalur",         "Tamil Nadu"),
  # ---- Karnataka
  "bengaluru":         ("BANG",  "Bengaluru",          "Karnataka"),
  "mysuru":            ("MYS",   "Mysuru",             "Karnataka"),
  "hubballi":          ("HUBL",  "Hubballi",           "Karnataka"),
  "belagavi":          ("BELG",  "Belagavi",           "Karnataka"),
  "tumakuru":          ("TUMK",  "Tumakuru",           "Karnataka"),
  "bellary":           ("BLRY",  "Bellary",            "Karnataka"),
  "kalaburagi":        ("GULB",  "Kalaburagi",         "Karnataka"),
  "davanagere":        ("DAVA",  "Davanagere",         "Karnataka"),
  "shivamogga":        ("SHIA",  "Shivamogga",         "Karnataka"),
  "udupi":             ("UDUP",  "Udupi",              "Karnataka"),
  # ---- Telugu states
  "hyderabad":         ("HYD",   "Hyderabad",          "Telangana"),
  "vizag":             ("VIZA",  "Visakhapatnam",      "Andhra Pradesh"),
  "vijayawada":        ("VIJA",  "Vijayawada",         "Andhra Pradesh"),
  "guntur":            ("GUNT",  "Guntur",             "Andhra Pradesh"),
  "warangal":          ("WAR",   "Warangal",           "Telangana"),
  "tirupati":          ("TIRU",  "Tirupati",           "Andhra Pradesh"),
  "nellore":           ("NELL",  "Nellore",            "Andhra Pradesh"),
  "kurnool":           ("KURN",  "Kurnool",            "Andhra Pradesh"),
  "anantapur":         ("ANAN",  "Anantapur",          "Andhra Pradesh"),
  "rajamahendravaram": ("RJMU",  "Rajahmundry",        "Andhra Pradesh"),
  "kakinada":          ("KAKI",  "Kakinada",           "Andhra Pradesh"),
  "karimnagar":        ("KARIM", "Karimnagar",         "Telangana"),
  "nizamabad":         ("NIZA",  "Nizamabad",          "Telangana"),
  "khammam":           ("KHAM",  "Khammam",            "Telangana"),
  # ---- Kerala
  "kochi":             ("KOCH",  "Kochi",              "Kerala"),
  "thiruvananthapuram":("TRIV",  "Thiruvananthapuram", "Kerala"),
  "kozhikode":         ("KOZH",  "Kozhikode",          "Kerala"),
  "thrissur":          ("THSR",  "Thrissur",           "Kerala"),
  "kollam":            ("KOLM",  "Kollam",             "Kerala"),
  "kottayam":          ("KTYM",  "Kottayam",           "Kerala"),
  "alappuzha":         ("ALPZ",  "Alappuzha",          "Kerala"),
  "kannur":            ("KANN",  "Kannur",             "Kerala"),
  "palakkad":          ("PLKK",  "Palakkad",           "Kerala"),
  # ---- Metros and the Hindi belt. NOTE: Thane / Navi Mumbai / Kalyan are
  #      inside MUMBAI, and Noida / Gurgaon / Ghaziabad / Faridabad are inside
  #      NCR. Adding them separately double-counts. Mohali is inside CHD.
  "mumbai":            ("MUMBAI","Mumbai",             "Maharashtra"),
  "national-capital-region-ncr": ("NCR", "Delhi-NCR",  "Delhi"),
  "pune":              ("PUNE",  "Pune",               "Maharashtra"),
  "kolkata":           ("KOLK",  "Kolkata",            "West Bengal"),
  "ahmedabad":         ("AHD",   "Ahmedabad",          "Gujarat"),
  "surat":             ("SURT",  "Surat",              "Gujarat"),
  "vadodara":          ("VAD",   "Vadodara",           "Gujarat"),
  "rajkot":            ("RAJK",  "Rajkot",             "Gujarat"),
  "jaipur":            ("JAIP",  "Jaipur",             "Rajasthan"),
  "lucknow":           ("LUCK",  "Lucknow",            "Uttar Pradesh"),
  "chandigarh":        ("CHD",   "Chandigarh",         "Punjab"),
  "indore":            ("IND",   "Indore",             "Madhya Pradesh"),
  "bhopal":            ("BHOP",  "Bhopal",             "Madhya Pradesh"),
  "nagpur":            ("NAGP",  "Nagpur",             "Maharashtra"),
  "nashik":            ("NASK",  "Nashik",             "Maharashtra"),
  "patna":             ("PATN",  "Patna",              "Bihar"),
  "ranchi":            ("RANC",  "Ranchi",             "Jharkhand"),
  "bhubaneswar":       ("BHUB",  "Bhubaneswar",        "Odisha"),
  "guwahati":          ("GUW",   "Guwahati",           "Assam"),
  "kanpur":            ("KANP",  "Kanpur",             "Uttar Pradesh"),
  "varanasi":          ("VAR",   "Varanasi",           "Uttar Pradesh"),
  "ludhiana":          ("LUDH",  "Ludhiana",           "Punjab"),
  "amritsar":          ("AMRI",  "Amritsar",           "Punjab"),
  "jalandhar":         ("JALA",  "Jalandhar",          "Punjab"),
  "dehradun":          ("DEH",   "Dehradun",           "Uttarakhand"),
  "raipur":            ("RAIPUR","Raipur",             "Chhattisgarh"),
  "goa":               ("GOA",   "Goa",                "Goa"),
  "agra":              ("AGRA",  "Agra",               "Uttar Pradesh"),
  "meerut":            ("MERT",  "Meerut",             "Uttar Pradesh"),
  "prayagraj":         ("ALLH",  "Prayagraj",          "Uttar Pradesh"),
  "jamshedpur":        ("JMDP",  "Jamshedpur",         "Jharkhand"),
  "siliguri":          ("SILI",  "Siliguri",           "West Bengal"),
  "jammu":             ("JAMM",  "Jammu",              "Jammu and Kashmir"),
}

# The Tamil Nadu + metro subset, for a 10-minute read instead of a 30-minute one
_CORE_TN = [s for s, (c, n, st) in REGIONS.items()
            if st == "Tamil Nadu"] + ["bengaluru", "mysuru", "hyderabad",
            "vizag", "vijayawada", "kochi", "mumbai",
            "national-capital-region-ncr", "pune", "kolkata", "ahmedabad",
            "lucknow"]
# Per film, falling back to the Tamil-weighted list. Unknown slugs are dropped
# rather than crashing the run, and named so a typo is visible.
_core = _F.get("core") or _CORE_TN
_bad  = [s for s in _core if s not in REGIONS]
if _bad:
    print("  NOTE: --core slugs not in the region table, ignored: %s" % ", ".join(_bad))
CORE = [s for s in _core if s in REGIONS]

# Markets whose explore pages we scan for language-specific event codes.
# Jailer 2's Telugu version (ET00518675) only showed up on the Hyderabad page.
DISCOVERY_MARKETS = ["mumbai", "national-capital-region-ncr", "chennai",
                     "hyderabad", "bengaluru", "kochi"]

LANG_HINTS = {"telugu": "Telugu", "hindi": "Hindi", "kannada": "Kannada",
              "malayalam": "Malayalam", "tamil": "Tamil"}

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
HDR = {"User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none", "Sec-Fetch-User": "?1"}

LOG = []
def log(*a):
    s = " ".join(str(x) for x in a)
    try: print(s, flush=True)
    except UnicodeEncodeError:            # Windows console, non-UTF8 codepage
        print(s.encode("ascii", "replace").decode("ascii"), flush=True)
    LOG.append(s)

# ── Cookies are managed by hand, not by HTTPCookieProcessor, because we have to
#    OVERRIDE one of them (rgn) per region and a cookiejar fights that.
COOKIES = {}

def set_region_cookie(code, name, slug, state):
    COOKIES["rgn"] = urllib.parse.quote(json.dumps({
        "GeoHash": "", "Lat": "", "Long": "", "countryCode": "IN",
        "regionCode": code, "regionCodeSlug": code.lower(),
        "regionName": name, "regionNameSlug": slug,
        "stateCode": "", "stateName": state,
        "subCode": "", "subName": "", "subtitle": ""}, separators=(",", ":")))

def cookie_header():
    return "; ".join(f"{k}={v}" for k, v in COOKIES.items())

def get(path, referer=None):
    """One attempt. A failure is data, not something to push through."""
    url = path if path.startswith("http") else BASE + path
    h = dict(HDR)
    if COOKIES: h["Cookie"] = cookie_header()
    if referer: h["Referer"] = referer; h["Sec-Fetch-Site"] = "same-origin"
    try:
        req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, timeout=45) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                except Exception: pass
            for sc in r.headers.get_all("Set-Cookie") or []:
                nv = sc.split(";")[0]
                if "=" in nv:
                    k, v = nv.split("=", 1)
                    if k.strip() != "rgn":      # never let the server clobber ours
                        COOKIES[k.strip()] = v
            return r.status, raw.decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        # A 403 is an ANSWER. BMS sits behind Cloudflare and is entitled to
        # refuse an unauthenticated client. We record it and move on. We never
        # try to defeat it, rotate identity, or route around it.
        return e.code, ""
    except Exception as ex:
        return 0, f"{type(ex).__name__}: {ex}"

# ── __INITIAL_STATE__ extraction. The blob is ~2 MB, so a lazy regex is both
#    slow and wrong. Match braces properly, respecting strings and escapes.
STATE_MARK = "window.__INITIAL_STATE__"

def initial_state(html):
    i = html.find(STATE_MARK)
    if i < 0: return None
    j = html.find("{", i)
    if j < 0: return None
    depth, in_str, esc = 0, False, False
    for k in range(j, len(html)):
        c = html[k]
        if in_str:
            if esc: esc = False
            elif c == "\\": esc = True
            elif c == '"': in_str = False
            continue
        if c == '"': in_str = True
        elif c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try: return json.loads(html[j:k+1])
                except Exception: return None
    return None

CACHEKEY_RE = re.compile(r"fetchPrimaryDynamic-(ET\d{8})---(\d{8})-([A-Z]+)")

def check_region(html, want_code, want_et, want_date):
    """THE GUARD. The URL's region segment is cosmetic and a wrong one still
    returns HTTP 200 with another city's data. The page states which region it
    actually served in its own cache key, so we read that back and compare.
    Returns (ok, found_code, note)."""
    keys = set(CACHEKEY_RE.findall(html))
    if not keys:
        return False, None, "no cache key in page - shape changed, or no shows"
    for et, date, code in keys:
        if code == want_code and et == want_et and date == want_date:
            return True, code, ""
    et0, d0, c0 = sorted(keys)[0]
    return False, c0, f"page served {c0}/{et0}/{d0}, we asked {want_code}/{want_et}/{want_date}"

# ── Walk the widget tree. Venues and shows are at different depths and the
#    seat-category objects are NOT nested inside their show, so shows are
#    attributed to the nearest enclosing venue (reliable - it IS nesting) and
#    categories to the most recent show in document order (a HEURISTIC, and the
#    report prints a diagnostic so you can see whether it held).
def harvest(state, lang, region_code, city, stateName):
    rows, cats = [], []
    root = None
    api = (state or {}).get("showtimesFunctionalApi") or {}
    for k, v in (api.get("queries") or {}).items():
        if k.startswith("fetchPrimaryDynamic"):
            root = ((v or {}).get("data") or {}).get("data"); break
    if root is None: return rows, cats

    ctx = {"venue": ("", ""), "show": None}

    def walk(o, depth):
        if o is None or depth > 24: return
        if isinstance(o, list):
            for x in o: walk(x, depth + 1)
            return
        if not isinstance(o, dict): return

        prev_venue = ctx["venue"]
        _v = venue_of(o)
        if _v: ctx["venue"] = _v

        if o.get("sessionId") and o.get("showTime"):
            # the show object may carry its own venue; that beats the
            # enclosing one, which is only a fallback
            vc, vn = _v if _v else ctx["venue"]
            if vc or vn: VENUE_HITS["shows_with_venue"] += 1
            row = {
                "lang": lang, "regionCode": region_code, "city": city,
                "state": stateName, "venueCode": vc, "venueName": vn,
                "chain": chain_of(vn),
                "sessionId": str(o.get("sessionId") or ""),
                "availStatus": str(o.get("availStatus") or ""),
                "showTime": str(o.get("showTime") or ""),
                "showTimeCode": str(o.get("showTimeCode") or ""),
                "showDateTime": str(o.get("showDateTime") or ""),
                "showDateCode": str(o.get("showDateCode") or ""),
                "cutOffDateTime": str(o.get("cutOffDateTime") or ""),
                "coupleSeats": "Y" if o.get("coupleSeats") else "N",
                "attributes": str(o.get("attributes") or ""),
                "nCat": 0, "worstLabel": "", "minPrice": "", "maxPrice": "",
                "soldOutCats": 0,
            }
            rows.append(row)
            ctx["show"] = row

        if "seatAvalibility" in o:
            label = str(o.get("seatAvalibility") or "").upper().strip()
            price = parse_price(o.get("seatCost"))
            vc, vn = ctx["venue"]
            host = ctx["show"]
            cats.append({
                "lang": lang, "regionCode": region_code, "city": city,
                "state": stateName, "venueCode": vc, "venueName": vn,
                "sessionId": host["sessionId"] if host else "",
                "showTime": host["showTime"] if host else "",
                "seatType": str(o.get("seatType") or ""),
                "seatCostRs": price if price is not None else "",
                "label": label,
            })
            if host is not None:
                host["nCat"] += 1
                if label == "SOLD OUT": host["soldOutCats"] += 1
                if label in LABEL_RANK and (
                        host["worstLabel"] == ""
                        or LABEL_RANK[label] < LABEL_RANK.get(host["worstLabel"], 9)):
                    host["worstLabel"] = label
                if price is not None:
                    lo = host["minPrice"]; hi = host["maxPrice"]
                    host["minPrice"] = price if lo == "" else min(lo, price)
                    host["maxPrice"] = price if hi == "" else max(hi, price)

        for v in o.values(): walk(v, depth + 1)
        ctx["venue"] = prev_venue

    walk(root, 0)
    return rows, cats

PRICE_RE = re.compile(r"(\d+(?:\.\d+)?)")
def parse_price(s):
    if s is None: return None
    m = PRICE_RE.search(str(s).replace(",", ""))
    return float(m.group(1)) if m else None

CHAINS = [("PVR INOX", ("pvr inox",)), ("PVR", ("pvr",)), ("INOX", ("inox",)),
          ("Cinepolis", ("cinepolis",)), ("Carnival", ("carnival",)),
          ("Miraj", ("miraj",)), ("Mukta A2", ("mukta",)),
          ("Rajhans", ("rajhans",)), ("Asian", ("asian",)),
          ("AMB", ("amb cinemas",)), ("Prasads", ("prasads",)),
          ("Sathyam/SPI", ("sathyam", "spi ", "escape", "luxe")),
          ("Rohini", ("rohini",)), ("Kasi/AGS", ("ags", "kasi")),
          ("Cinepriya", ("cinepriya",)), ("Mayajaal", ("mayajaal",)),
          ("Vettri", ("vettri",)), ("Rakki", ("rakki",)),
          ("KG", ("kg cinemas",)), ("Broadway", ("broadway",))]
# ── Venue identity. BMS has moved these fields before, so accept any of
#    the spellings we have seen, accept EITHER half (a code with no name is
#    still a usable identity for dedupe), and accept a nested {"venue":{...}}.
#    VENUE_HITS lets the report tell the difference between "no venues" and
#    "we failed to read the venues", which is the distinction that was
#    missing when this broke.
VENUE_CODE_KEYS = ("venueCode","VenueCode","venue_code","venueId","VenueId",
                   "vcode","venueCd")
VENUE_NAME_KEYS = ("venueName","VenueName","venue_name","venueTitle",
                   "vname","venueDisplayName")
VENUE_HITS = {"objects": 0, "shows_with_venue": 0}

def venue_of(o):
    """(code, name) if this object identifies a venue, else None."""
    code = next((str(o[k]).strip() for k in VENUE_CODE_KEYS
                 if o.get(k) not in (None, "")), "")
    name = next((str(o[k]).strip() for k in VENUE_NAME_KEYS
                 if o.get(k) not in (None, "")), "")
    if not code and not name:
        v = o.get("venue") or o.get("Venue")
        if isinstance(v, dict):
            code = str(v.get("code") or v.get("venueCode") or v.get("id") or "").strip()
            name = str(v.get("name") or v.get("venueName") or v.get("title") or "").strip()
    if code or name:
        VENUE_HITS["objects"] += 1
        return (code, name)
    return None

def chain_of(name):
    low = (name or "").lower()
    for label, keys in CHAINS:
        if any(k in low for k in keys): return label
    return "Independent / single screen"

# ── event code discovery
ET_HREF_RE = re.compile(r'href="([^"]*?(ET\d{8})[^"]*?)"', re.I)

def discover_codes():
    """Find every event code BMS carries for this film. Each language is its
    own code and they surface in different markets, so we scan several."""
    found = {}
    for slug in DISCOVERY_MARKETS:
        code, name, st = REGIONS[slug][0], REGIONS[slug][1], REGIONS[slug][2]
        set_region_cookie(code, name, slug, st)
        status, html = get(f"/explore/movies-{slug}")
        if status != 200 or not html:
            log(f"    {slug:<14} HTTP {status}" +
                ("  (403 = BMS declined. Recorded, not retried.)" if status == 403 else ""))
            time.sleep(PAUSE); continue
        hits = 0
        for href, et in ET_HREF_RE.findall(html):
            low = href.lower()
            if not MATCH_RE.search(low): continue
            # reject unless keep rescues it - same contract as district_sweep
            if REJECT_RE and REJECT_RE.search(low) and not (
                    KEEP_RE and KEEP_RE.search(low)):
                continue
            lang = next((v for k, v in LANG_HINTS.items() if k in low), None)
            prev = found.get(et)
            if prev is None or (prev[1] is None and lang):
                found[et] = (href, lang)
            hits += 1
        log(f"    {slug:<14} HTTP 200   {hits} {FILM} link(s)")
        time.sleep(PAUSE)
    out = []
    for et, (href, lang) in sorted(found.items()):
        m = re.search(r"/movies/(?:[a-z\-]+/)?([a-z0-9\-]+)/ET", href, re.I)
        slug = m.group(1) if m else SLUG_HINT
        out.append((et, slug, lang or "UNLABELLED"))
    return out

# ─────────────────────────────────────────────────────────────── main
def main():
    if LOOKUP:
        q = (_args[1].lower() if len(_args) > 1 else "")
        log(f"region lookup for '{q}':")
        for s, (c, n, st) in sorted(REGIONS.items()):
            if q in s or q in n.lower():
                log(f"    {s:<32}{c:<8}{n}  ({st})")
        log("\n  Not listed? The full table is BMS's own:")
        log("    https://in.bookmyshow.com/api/explore/v1/discover/regions")
        log("  2,080 regions. Add the slug and code to REGIONS at the top.")
        return

    os.makedirs(OUT, exist_ok=True)
    date_fmt = f"{DATE[6:8]}-{DATE[4:6]}-{DATE[0:4]}"
    log(f"RUN {datetime.datetime.now().isoformat()}")
    log(f"{FILM}   BookMyShow   show date {date_fmt}  ({DATE})")
    log("GET only. Nothing booked, nothing held, nothing posted.")
    log("FOOTPRINT AND FULLNESS LABELS ONLY. No seats, no gross. See the")
    log("header of this file for why, and district_sweep.py for seats.\n")

    log("[0] warm-up")
    set_region_cookie("CHEN", "Chennai", "chennai", "Tamil Nadu")
    st, _ = get("/explore/movies-chennai")
    log(f"    HTTP {st}   cookies now: {sorted(COOKIES)}")
    if st == 403:
        log("    403 on the public listing page. That is the answer for the")
        log("    anonymous path and we stop. We do not work around bot")
        log("    protection. Try again from an Indian IP, or use District.")
        finish(); return
    if st != 200:
        log("    could not reach BMS. Nothing to sweep."); finish(); return
    time.sleep(PAUSE)

    log(f"\n[1] discovering every {FILM} event code, one per language")
    codes = discover_codes()
    if not codes:
        log(f"    NOTHING FOUND. Either BMS has not listed {FILM} yet or the")
        log("    page shape changed. Do NOT read a zero here as zero demand -")
        log("    read it as zero listing, and check by eye before publishing.")
        finish(); return
    for et, slug, lang in codes:
        log(f"    {et}   {slug:<24}{lang}")

    regions = CORE if CORE_ONLY else list(REGIONS)
    seen_slugs = set(); regions = [r for r in regions
                                   if not (r in seen_slugs or seen_slugs.add(r))]
    log(f"\n    {len(codes)} code(s) x {len(regions)} regions = "
        f"{len(codes)*len(regions)} requests, about "
        f"{len(codes)*len(regions)*(PAUSE+1.1)/60:.0f} minutes.")
    if IDS_ONLY:
        log("\n--ids given, stopping before the sweep."); finish(); return

    rows, cats, rejected, blanks = [], [], [], []
    _raw = gzip.open(os.path.join(OUT, "bms_payload.jsonl.gz"), "wt",
                     encoding="utf-8")
    for et, slug, lang in codes:
        log(f"\n[2] {lang}   {et}")
        for rslug in regions:
            rcode, rname, rstate = REGIONS[rslug]
            set_region_cookie(rcode, rname, rslug, rstate)
            url = (f"/movies/{rcode.lower()}/{slug}-{rslug}"
                   f"/buytickets/{et}/{DATE}")
            status, html = get(url, referer=f"{BASE}/explore/movies-{rslug}")
            if status != 200 or not html:
                if status == 403:
                    log(f"    {rname:<22} HTTP 403 - declined. Recorded, not retried.")
                elif status != 404:
                    log(f"    {rname:<22} HTTP {status}")
                time.sleep(PAUSE); continue

            ok, got, note = check_region(html, rcode, et, DATE)
            if not ok:
                if "no cache key" in note:
                    blanks.append((lang, rname))
                else:
                    rejected.append((lang, rname, note))
                    log(f"    {rname:<22} REJECTED - {note}")
                time.sleep(PAUSE); continue

            state = initial_state(html)
            if state is None:
                log(f"    {rname:<22} could not parse __INITIAL_STATE__")
                time.sleep(PAUSE); continue
            try:
                _raw.write(json.dumps({"lang": lang, "et": et,
                    "regionCode": rcode, "city": rname, "state": rstate,
                    "payload": state}, ensure_ascii=False) + "\n")
            except Exception as _e:
                log(f"    (raw payload not saved for {rname}: {_e})")
            r, c = harvest(state, lang, rcode, rname, rstate)
            r = [x for x in r if x["showDateCode"] in ("", DATE)]
            rows += r; cats += c
            if r:
                so = sum(1 for x in r if x["worstLabel"] == "SOLD OUT")
                _nv = len({(x['venueCode'], x['venueName']) for x in r
                           if x['venueCode'] or x['venueName']})
                _vs = f"{_nv:>4} ven" if _nv else "   ? ven"
                log(f"    {rname:<22}{_vs} "
                    f"{len(r):>5} shows   {so:>4} with a sold-out class")
            else:
                blanks.append((lang, rname))
            time.sleep(PAUSE)

    _raw.close()

    if not rows:
        log("\nNo shows anywhere. Nothing to report. Do not publish a zero -")
        log("check one city by eye in a browser first.")
        finish(); return

    cols = ["lang","regionCode","city","state","chain","venueCode","venueName",
            "sessionId","showTime","showTimeCode","showDateTime","showDateCode",
            "cutOffDateTime","attributes","coupleSeats","availStatus",
            "nCat","worstLabel","soldOutCats","minPrice","maxPrice"]
    with open(os.path.join(OUT,"bms_shows.csv"),"w",newline="",encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader(); [w.writerow(r) for r in rows]
    ccols = ["lang","regionCode","city","state","venueCode","venueName",
             "sessionId","showTime","seatType","seatCostRs","label"]
    with open(os.path.join(OUT,"bms_seat_classes.csv"),"w",newline="",encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=ccols, extrasaction="ignore")
        w.writeheader(); [w.writerow(r) for r in cats]
    json.dump({"shows":rows,"classes":cats},
              open(os.path.join(OUT,"bms_raw.json"),"w"), indent=1)

    report(rows, cats, rejected, blanks, date_fmt)
    finish()

# ─────────────────────────────────────────────────────────────── report
def report(rows, cats, rejected, blanks, date_fmt):
    ven = {(r["regionCode"], r["venueCode"], r["venueName"]) for r in rows
           if r["venueCode"] or r["venueName"]}
    VENUE_OK = bool(ven)
    log("\n" + "=" * 70)
    log(f"  {FILM.upper()} - BOOKMYSHOW - {date_fmt} - ALL LANGUAGES")
    log("=" * 70)
    log(f"  shows            {len(rows):>10,}")
    if VENUE_OK:
        log(f"  venues           {len(ven):>10,}")
    else:
        log(f"  venues            NOT RESOLVED")
        log("")
        log("  *** THE VENUE FIELDS CAME BACK EMPTY ON EVERY ROW. ***")
        log("  No venue count is printed, because the only number we could")
        log("  print is the city count wearing a different label - which is")
        log("  exactly what this report did on 20 October, twice, and both")
        log("  figures reached a published page.")
        log("")
        log("  The raw payload is saved at bms_payload.jsonl.gz. Fix the key")
        log("  names in venue_of() and re-parse that file. Do NOT re-sweep")
        log("  BookMyShow to recover this.")
        log("  Venue identity is also what dedupes BMS against District, so")
        log("  until it resolves the two platforms cannot be combined at all.")
    log(f"  cities with shows{len({r['city'] for r in rows}):>10,}")
    log(f"  states           {len({r['state'] for r in rows}):>10,}")
    log(f"  seat classes read{len(cats):>10,}")
    log("\n  THERE IS NO SEAT COUNT AND NO GROSS IN THIS REPORT. BookMyShow")
    log("  does not publish either outside the booking funnel. Everything")
    log("  below is footprint and fullness labels.")

    # ---- the pairing diagnostic. Say whether the heuristic held.
    dist = collections.Counter(r["nCat"] for r in rows)
    orphan = sum(1 for c in cats if not c["sessionId"])
    log("\n=== IS THE SHOW-TO-SEAT-CLASS PAIRING TRUSTWORTHY? ===")
    log("  Seat-class objects are not nested inside their show in BMS's")
    log("  payload, so each class is attributed to the most recent show in")
    log("  document order. That is a HEURISTIC. Here is how it did:")
    for n in sorted(dist)[:8]:
        log(f"    {dist[n]:>6} shows carry {n} seat class(es)")
    log(f"    {orphan:>6} seat classes could not be attached to any show")
    zero = dist.get(0, 0)
    if zero > len(rows) * 0.15:
        log("  ⚠️ MORE THAN 15% OF SHOWS GOT NO SEAT CLASS. The pairing has")
        log("  probably broken - BMS likely changed the widget order. Use the")
        log("  show counts and availStatus below, which do NOT depend on it,")
        log("  and treat every price and label figure as unsafe until checked.")
    else:
        log("  Looks sane. Prices and labels below can be used, with the")
        log("  caveat that they are an attribution, not a field BMS nests.")

    def group(field, title, limit=None):
        g = collections.defaultdict(lambda: [0, 0, set(), 0])
        for r in rows:
            v = g[r[field] or "?"]
            v[0] += 1
            if r["worstLabel"] == "SOLD OUT": v[1] += 1
            v[2].add((r["regionCode"], r["venueCode"]))
            if r["worstLabel"] in ("SOLD OUT", "ALMOST FULL"): v[3] += 1
        log(f"\n=== BY {title} ===")
        log(f"  {'':<26}{'ven':>5}{'shows':>8}{'sold out':>10}{'+almost':>9}")
        items = sorted(g.items(), key=lambda x: -x[1][0])
        for k, v in (items[:limit] if limit else items):
            log(f"  {str(k)[:24]:<26}{len(v[2]):>5}{v[0]:>8,}{v[1]:>10,}"
                f"{v[3]:>9,}")

    group("lang", "LANGUAGE")
    group("state", "STATE", 14)
    group("city", "CITY", 18)
    if VENUE_OK:
        group("chain", "CHAIN")
    else:
        log("\n=== BY CHAIN === withheld")
        log("  chain_of() reads the venue NAME, and the name is empty, so")
        log("  every row would fall through to 'Independent / single screen'.")
        log("  That is a default, not a finding. Withheld until venues parse.")

    # ---- the fullness picture, which is what BMS is actually for
    log("\n=== FULLNESS LABELS (BMS's own four values) ===")
    lab = collections.Counter(c["label"] for c in cats)
    tot = sum(lab.values()) or 1
    for l in LABELS:
        log(f"  {l:<16}{lab.get(l,0):>8,}  {lab.get(l,0)/tot*100:>5.1f}% of seat classes")
    other = {k: v for k, v in lab.items() if k not in LABEL_RANK}
    if other:
        log(f"  NEW LABELS NOT IN OUR LIST: {other}")
        log("  BMS has added a label. Add it to LABELS before trusting the mix.")

    log("\n=== availStatus, BMS's OWN SHOW-LEVEL CODE ===")
    st = collections.Counter(r["availStatus"] for r in rows)
    for k in sorted(st):
        log(f"  availStatus {k or '(blank)':<10}{st[k]:>8,} shows  "
            f"{st[k]/len(rows)*100:>5.1f}%")
    log("  We have NOT established what 0/1/2/3 mean. Chennai on 13 Oct read")
    log("  0:358  1:184  2:118  3:100 across 760 shows, and 358 sold-out shows")
    log("  in one city would have exceeded the national housefull count being")
    log("  reported that day - so 0 is almost certainly NOT 'sold out'.")
    log("  The mapping is printed because it is BMS's own field, not because we")
    log("  know how to read it. Use the word labels above, not these integers,")
    log("  and do not publish a figure derived from them.")

    # ---- prices, which ARE real rupees
    pr = [c["seatCostRs"] for c in cats if isinstance(c["seatCostRs"], float)]
    if pr:
        pr.sort()
        log("\n=== TICKET PRICES (real, from the page, in rupees) ===")
        log(f"  classes priced   {len(pr):>8,}")
        log(f"  min / median / max   Rs {pr[0]:,.0f} / {pr[len(pr)//2]:,.0f} / {pr[-1]:,.0f}")
        tn = [c["seatCostRs"] for c in cats
              if c["state"] == "Tamil Nadu" and isinstance(c["seatCostRs"], float)]
        rest = [c["seatCostRs"] for c in cats
                if c["state"] != "Tamil Nadu" and isinstance(c["seatCostRs"], float)]
        if tn and rest:
            tn.sort(); rest.sort()
            log(f"  Tamil Nadu median    Rs {tn[len(tn)//2]:,.0f}   ({len(tn):,} classes)")
            log(f"  rest of India median Rs {rest[len(rest)//2]:,.0f}   ({len(rest):,} classes)")
            log("  That gap is the TN price cap, and it is the reason a gross")
            log("  estimate built on a Hindi film's ticket price reads high here.")

    # ---- dayparts. Equal-width buckets, because unequal ones lie.
    log("\n=== BY TIME OF DAY (IST, from BMS's own showTime) ===")
    def hour_of(r):
        m = re.match(r"(\d{1,2}):(\d{2})\s*([AaPp])", r["showTime"] or "")
        if not m: return None
        h = int(m.group(1)) % 12
        return h + (12 if m.group(3).lower() == "p" else 0)
    buckets = [("midnight-4am",0,4),("4am-7am",4,7),("7am-10am",7,10),
               ("10am-1pm",10,13),("1pm-4pm",13,16),("4pm-7pm",16,19),
               ("7pm-10pm",19,22),("10pm-midnight",22,24)]
    for lab_, a, b in buckets:
        g = [r for r in rows if hour_of(r) is not None and a <= hour_of(r) < b]
        if not g: continue
        so = sum(1 for r in g if r["worstLabel"] == "SOLD OUT")
        log(f"  {lab_:<16}{len(g):>7,} shows   {so:>5,} sold out  "
            f"{so/len(g)*100:>5.1f}%   {len(g)/(b-a):>7.1f}/hr")
    log("  The 4am-7am block is the Tamil opening-day signature. A thick")
    log("  early band selling out is the strongest single sign the fan")
    log("  turnout is real - and it is exactly the band District under-lists,")
    log("  because those shows are single screens that do not sell there.")

    # ---- what this is actually good for, and what it is not
    log("\n" + "=" * 70)
    log("  HOW TO USE THIS, AND HOW NOT TO")
    log("=" * 70)
    log("  USE IT FOR: screen count, show count, city and state spread, the")
    log("  format mix, real ticket prices, and the share of shows already")
    log("  carrying a sold-out seat class. These are measurements.")
    log("")
    log("  DO NOT turn any of it into seats or rupees. There is no capacity")
    log("  figure on the page, so 'sold out' tells you a class is gone, not")
    log("  how many seats it held. A 40-seat recliner class and a 900-seat")
    log("  single screen both read SOLD OUT.")
    log("")
    log("  THE ONE COMPARISON WORTH PUBLISHING: set this show count against")
    log("  District's. District is the seat and gross source; BMS reaches the")
    log("  single screens District does not list. The gap between the two is")
    log("  itself the finding for a Tamil release, and it is the honest way to")
    log("  say that a District-only number under-reads Tamil Nadu.")
    if rejected:
        log(f"\n  ⚠️ {len(rejected)} region(s) REJECTED by the region guard:")
        for lang, city, note in rejected[:12]:
            log(f"      {lang:<12}{city:<20}{note}")
        log("  These were dropped, not guessed. A rejected region means BMS")
        log("  served another city's data - the exact bug the guard exists for.")
    if blanks:
        log(f"\n  {len(blanks)} region/language pair(s) returned no shows:")
        bl = collections.defaultdict(list)
        for lang, city in blanks: bl[lang].append(city)
        for lang, cities in bl.items():
            log(f"      {lang}: {len(cities)} city(ies) - "
                + ", ".join(cities[:8]) + ("..." if len(cities) > 8 else ""))
        log("  Not listed is NOT zero demand. Say 'not listed' when writing.")

    log("\n  GRADE THIS LATER")
    log("    1. BMS show count vs District's, same date - how big is the gap")
    log("    2. whether the sold-out share at T-2 predicted the actual day one")
    log("    3. whether the show-to-seat-class pairing held (diagnostic above)")
    log("    4. what availStatus 0/1/2/3 actually mean, once settled")

def finish():
    try:
        open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8").write("\n".join(LOG))
        log(f"\nWritten to {OUT}")
    except Exception as e:
        log(f"\ncould not write the log: {e}")

if __name__ == "__main__":
    main()
