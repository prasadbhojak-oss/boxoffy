#!/usr/bin/env python3
"""
Boxoffy - WHY ARE BMS VENUE FIELDS BLANK? A 30-second probe.

    python bms_venue_probe.py                 Chennai, Tamil, 15 Oct
    python bms_venue_probe.py hyderabad       somewhere else

THE PROBLEM THIS DIAGNOSES
--------------------------
Today's BMS sweep returned 8,820 shows and EVERY ONE has a blank venueCode and
venueName. The progress lines said "1 ven" for every region, which is how it
showed up - Chennai cannot have 1,006 shows in one venue.

The cause is in jailer2_bms_sweep.py, harvest(), line 365:

    if o.get("venueCode") and o.get("venueName"):

That demands BOTH keys on the SAME object. If BMS now carries the code and the
name on different nodes, or has renamed either key, the condition never fires,
ctx["venue"] stays ("","") and every row inherits blanks. Nothing errors. The
sweep looks like it worked.

I am not going to guess the new key names and patch blind - that is how you get
a fix that silently half-works. This probe fetches ONE region page and prints
the ANCESTOR CHAIN above a real session node, with the keys each level actually
carries. Then the fix is a one-liner we can verify.

GET only, one request, public page. A 403 is an answer - it prints it and stops.
Stdlib only. Windows-safe.
"""

import os, re, sys, json, gzip, io, urllib.request, urllib.error, urllib.parse

REGION = (sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-")
          else "chennai")
DATE   = next((a for a in sys.argv[1:] if re.match(r"^\d{8}$", a)), "20261015")
ET     = next((a for a in sys.argv[1:] if a.upper().startswith("ET")), "ET00518674")

# region code table, same values the sweep uses
CODES = {"chennai": ("CHEN", "Chennai", "Tamil Nadu"),
         "coimbatore": ("COIM", "Coimbatore", "Tamil Nadu"),
         "madurai": ("MADU", "Madurai", "Tamil Nadu"),
         "hyderabad": ("HYD", "Hyderabad", "Telangana"),
         "bengaluru": ("BANG", "Bengaluru", "Karnataka"),
         "kochi": ("KOCH", "Kochi", "Kerala"),
         "mumbai": ("MUMBAI", "Mumbai", "Maharashtra")}
if REGION not in CODES:
    sys.exit(f"pick one of: {', '.join(CODES)}")
CODE, NAME, STATE = CODES[REGION]

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
BASE = "https://in.bookmyshow.com"
COOKIES = {"rgn": urllib.parse.quote(json.dumps(
    {"GeoHash": "", "Lat": "", "Long": "", "countryCode": "IN",
     "regionCode": CODE, "regionCodeSlug": CODE.lower(), "regionName": NAME,
     "regionNameSlug": REGION, "stateCode": "", "stateName": STATE,
     "subCode": "", "subName": "", "subtitle": ""}, separators=(",", ":")))}

def out(*a):
    s = " ".join(str(x) for x in a)
    try: print(s, flush=True)
    except UnicodeEncodeError:
        print(s.encode("ascii", "replace").decode("ascii"), flush=True)

def get(path):
    h = {"User-Agent": UA, "Accept": "text/html,*/*;q=0.8",
         "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate",
         "Cookie": "; ".join(f"{k}={v}" for k, v in COOKIES.items())}
    try:
        with urllib.request.urlopen(
                urllib.request.Request(BASE + path, headers=h), timeout=45) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
            for sc in r.headers.get_all("Set-Cookie") or []:
                nv = sc.split(";")[0]
                if "=" in nv:
                    k, v = nv.split("=", 1)
                    if k.strip() != "rgn": COOKIES[k.strip()] = v
            return r.status, raw.decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as ex:
        return 0, f"{type(ex).__name__}: {ex}"

def initial_state(html):
    i = html.find("window.__INITIAL_STATE__")
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
                try: return json.loads(html[j:k + 1])
                except Exception: return None
    return None

out(f"BMS VENUE PROBE · {NAME} ({CODE}) · {ET} · {DATE}")
out("One GET on a public page. Nothing booked or held.\n")
out("[1] warm-up")
st, _ = get("/explore/home/chennai")
out(f"    HTTP {st}   cookies: {sorted(COOKIES)}")
out("\n[2] the showtimes page")
st, html = get(f"/buytickets/jailer-2-{REGION}/movie-{CODE.lower()}-{ET}-MT/{DATE}")
out(f"    HTTP {st}   {len(html):,} bytes")
if st != 200 or not html:
    out("    That is the answer, not an obstacle. Nothing more to probe.")
    sys.exit(0)

state = initial_state(html)
if state is None:
    out("    __INITIAL_STATE__ not found or unparseable - BMS changed the page.")
    sys.exit(0)

api = (state or {}).get("showtimesFunctionalApi") or {}
root = None
for v in api.values():
    if isinstance(v, dict) and ((v or {}).get("data") or {}).get("data"):
        root = ((v or {}).get("data") or {}).get("data"); break
if root is None:
    out("    showtimesFunctionalApi has no data.data - the harvest root moved.")
    out(f"    top-level keys present: {sorted(state)[:20]}")
    sys.exit(0)
out("    root located under showtimesFunctionalApi -> data -> data")

# ---- walk, recording the ancestor chain for the first few session nodes
out("\n[3] ANCESTOR CHAIN ABOVE THE FIRST SESSION NODES")
out("    Each line is one level, outermost first. This is where a venue")
out("    code and name must be coming from.\n")
found = [0]
VENUEISH = re.compile(r"venue|cinema|theat|screen|audi", re.I)

def walk(o, chain):
    if found[0] >= 3: return
    if isinstance(o, list):
        for x in o: walk(x, chain)
        return
    if not isinstance(o, dict): return
    if o.get("sessionId") and o.get("showTime"):
        found[0] += 1
        out(f"  --- SESSION {found[0]}: sessionId={o.get('sessionId')} "
            f"showTime={o.get('showTime')}")
        for depth, node in enumerate(chain + [o]):
            keys = sorted(node.keys())
            hits = [k for k in keys if VENUEISH.search(k)]
            out(f"    L{depth:<2} {len(keys):>3} keys"
                + (f"   VENUE-ISH: {hits}" if hits else ""))
            for k in hits:
                v = node.get(k)
                if not isinstance(v, (dict, list)):
                    out(f"         {k} = {v!r}")
                else:
                    out(f"         {k} = <{type(v).__name__}> "
                        f"{sorted(v)[:8] if isinstance(v, dict) else len(v)}")
        out("")
        return
    for v in o.values(): walk(v, chain + [o])

walk(root, [])
if not found[0]:
    out("    No node carried both sessionId and showTime. The show shape changed.")

# ---- every key anywhere that looks venue-ish, with a sample value
out("[4] EVERY VENUE-ISH KEY ANYWHERE IN THE PAYLOAD")
seen = {}
def scan(o, d=0):
    if d > 26: return
    if isinstance(o, list):
        for x in o[:60]: scan(x, d + 1)
        return
    if not isinstance(o, dict): return
    for k, v in o.items():
        if VENUEISH.search(k) and k not in seen and not isinstance(v, (dict, list)):
            seen[k] = v
    for v in o.values(): scan(v, d + 1)
scan(root)
for k in sorted(seen):
    out(f"    {k:<28} e.g. {str(seen[k])[:60]!r}")
if not seen:
    out("    none at all - venues may now sit outside this payload entirely")

out("\n[5] WHAT TO DO WITH THIS")
out("    Look at section 3. If a level above the session carries a venue id")
out("    under a NEW name, or carries the id without the name, then the fix in")
out("    jailer2_bms_sweep.py harvest() is to stop requiring both keys on one")
out("    object - track them independently:")
out("")
out("        vc = o.get('venueCode') or o.get('<new id key>')")
out("        vn = o.get('venueName') or o.get('<new name key>')")
out("        if vc: ctx['venue'] = (str(vc), ctx['venue'][1])")
out("        if vn: ctx['venue'] = (ctx['venue'][0], str(vn))")
out("")
out("    Paste sections 3 and 4 back to me and I will patch it exactly rather")
out("    than guessing. The calibration needs venue identity to join on, so")
out("    this is the blocker for it - nothing else is.")
