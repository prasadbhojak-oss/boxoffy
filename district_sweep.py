#!/usr/bin/env python3
"""
Boxoffy - DISTRICT SWEEP, any film, all languages. Generalised engine.

    python district_sweep.py --film prahaar 2026-10-16
    python district_sweep.py --film nayinaveli 2026-10-16
    python district_sweep.py --film jailer2 2026-10-16
    python district_sweep.py --film prahaar --core 2026-10-16   fast, 50 cities
    python district_sweep.py list                   District's whole catalogue
    python district_sweep.py --film prahaar --ids   resolve ids and stop

Replaces jailer2_district_sweep.py, which was one film hardcoded. Same engine,
same session-grid parse, same report. Two real bugs fixed - read both.

⚠️ FIX 1 - THE DATE FILTER WAS DROPPING EVERY EARLY-MORNING SHOW
----------------------------------------------------------------
District's showTime is UTC. Proved it off the 15 Oct Jailer 2 CSV: raw hours
19:00-23:59 contain ZERO shows, which is 00:30-05:29 IST - exactly when Indian
cinemas are shut - while the busiest raw hours are 13:00 and 16:00 UTC, i.e.
18:30 and 21:30 IST, the evening and night peaks. If showTime were IST there
would be no shows between 7pm and midnight, which is absurd.

The old filter was:

    if r["showTime"][:10] == DATE_LABEL          # WRONG

A 4:00 AM IST show on 16 Oct carries the UTC stamp 2026-10-15T22:30, so its
first ten characters read 2026-10-15 and the row was silently DISCARDED. Every
show before 05:30 IST was thrown away on every run we have ever done.

For a Rajinikanth release that is the FDFS block - the single most important
part of a Tamil opening day, and the thing we kept writing about. Our 15 Oct
Jailer 2 read of 5,429 shows is missing it, and that is also why the report
said "already started 0 shows".

This file converts to IST first and filters on the IST date. The old numbers
are floors, by an unknown amount until a sweep is re-run.

⚠️ FIX 2 - A UNICODE CRASH ON THE WINDOWS CONSOLE
--------------------------------------------------
log() printed an emoji straight to a cp1252 console, which raised
UnicodeEncodeError and killed the 15 Oct run AFTER the CSV was written but
BEFORE RUN.txt. Guarded here.

GET only. Nothing booked, held or posted. A 403 is an ANSWER, not an obstacle.
Stdlib only. Python 3.8+. Windows-safe.
"""

import os, re, csv, json, gzip, io, sys, time, datetime, collections
import urllib.request, urllib.error, http.cookiejar

# ───────────────────────────────────────────────────────────── film registry
# "match" is a regex run against District's own slugs. Keep it loose enough to
# survive a spelling the trade has not settled - Nayi Naveli is spelt Nayyi
# Navelli on its own Wikipedia page, and District may use either.
# "reject" keeps an older film of a similar name out of the sweep.
FILMS = {
    "drishyam": {
        "title": "Drishyam: The Conclusion",
        # Broad match so we cannot miss it, then rejects for the other
        # Drishyams, then "keep" to protect a slug that happens to carry both
        # a number and the word conclusion.
        "match": r"drishyam",
        "reject": r"drishyam[-_]?[23]\b|^drishyam$|malayalam|2015|2022",
        "keep": r"conclusion",
        "release": "2026-10-02",
        "note": "Hindi, released 2 Oct. There are FOUR Drishyams - the 2015 "
                "original, Drishyam 2 (2022), Drishyam 3 (Malayalam, May "
                "2026) and this one. Only this one has 'conclusion' in the "
                "title, which is what the keep pattern protects. "
                "District baselines already on disk for the trend: "
                "2 Oct (day 1) and 5 Oct (day 4).",
    },
    "jailer2": {
        "title": "Jailer 2",
        "match": r"jailer[-_]?2|jailer-two|rajini.*jailer",
        "reject": r"^jailer$|jailer-2023",
        "release": "2026-10-15",
        "note": "Tamil-led, four languages. District carries only TWO ids and "
                "bundles the Telugu dub inside the Tamil listing - BookMyShow "
                "splits them properly. Do not publish District's language "
                "split for this film.",
    },
    "prahaar": {
        "title": "Prahaar: The Untold Story of Ujjwal Nikam",
        "match": r"prahaar|ujjwal[-_]?nikam|nikam",
        "reject": r"prahaar-1991|prahar-the-final-attack",
        "release": "2026-10-16",
        "note": "Hindi. Rajkummar Rao as Ujjwal Nikam, dir Avinash Arun, "
                "Dinesh Vijan / Maddock. Opens into Jailer 2's day two. "
                "Prahaar (1991, Nana Patekar) is a DIFFERENT film - the "
                "reject pattern keeps it out.",
    },
    "nayinaveli": {
        "title": "Nayi Naveli",
        "match": r"nay+i+[-_]?nave+l+i+|nayyi|navelli",
        "reject": r"",
        "release": "2026-10-16",
        "note": "Hindi. Yami Gautam, dir Balaji Mohan, Aanand L. Rai / "
                "Colour Yellow + Amazon MGM, distributed by PVR Inox "
                "Pictures. Title is spelt Nayyi Navelli on its own Wikipedia "
                "page and Nayi Naveli in the trade, so the match pattern "
                "accepts both. Being a PVR Inox release, expect a multiplex "
                "footprint - the opposite shape to Jailer 2's Hindi track.",
    },
}

# ───────────────────────────────────────────────────────────────────── args
_a = [x for x in sys.argv[1:] if x]
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
LIST_ONLY = bool(_a) and _a[0].lower() == "list"
IDS_ONLY = "--ids" in _a
CORE = "--core" in _a

def flag(name, cast=None, default=None):
    if name not in _a: return default
    i = _a.index(name)
    if cast is None: return True
    try: return cast(_a[i + 1])
    except (IndexError, ValueError): return default

FILM_KEY = (flag("--film", str, "") or "").lower()
if not LIST_ONLY and FILM_KEY not in FILMS:
    sys.exit("--film must be one of: " + ", ".join(FILMS)
             + "\n  or: python district_sweep.py list")
F = FILMS.get(FILM_KEY, {})
_d = [x for x in _a if DATE_RE.match(x)]
DATE_LABEL = _d[0] if _d else F.get("release", "")
if not LIST_ONLY and not DATE_LABEL:
    sys.exit("give a date, e.g. 2026-10-16")

OUT = os.path.join("intel", f"{FILM_KEY}-{DATE_LABEL}")
PAUSE = 0.8
IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
NOW_UTC = datetime.datetime.now(datetime.timezone.utc)

LANG_HINTS = {"tamil": "Tamil", "telugu": "Telugu", "hindi": "Hindi",
              "kannada": "Kannada", "malayalam": "Malayalam",
              "marathi": "Marathi", "bengali": "Bengali"}

CITIES_CORE = [
    "chennai","coimbatore","madurai","tiruchirappalli","salem","erode",
    "tirunelveli","vellore","thanjavur","tiruppur",
    "bengaluru","mysuru","mangaluru","hubballi","belagavi",
    "hyderabad","visakhapatnam","vijayawada","guntur","warangal",
    "mumbai","new-delhi","pune","kolkata","ahmedabad","jaipur",
    "lucknow","chandigarh","indore","bhopal","nagpur","surat",
    "kochi","thiruvananthapuram","kozhikode","thrissur",
    "noida","gurgaon","ghaziabad","thane","navi-mumbai",
    "patna","ranchi","bhubaneswar","guwahati","kanpur","varanasi",
    "ludhiana","dehradun","raipur",
]
CITIES_EXTRA = [
    "tirupur","dindigul","karur","namakkal","hosur","cuddalore","kanchipuram",
    "nagercoil","pollachi","sivakasi","rajapalayam","villupuram",
    "tiruvannamalai","krishnagiri","pudukkottai","virudhunagar","theni",
    "ramanathapuram","ariyalur","perambalur",
    "davanagere","shivamogga","tumakuru","ballari","kalaburagi","udupi",
    "kollam","kottayam","alappuzha","kannur","palakkad",
    "tirupati","nellore","kurnool","anantapur","rajahmundry","kakinada",
    "karimnagar","nizamabad","khammam",
    "prayagraj","gorakhpur","bareilly","aligarh","moradabad","jhansi",
    "jalandhar","patiala","mohali","panipat","rohtak","jammu",
    "ajmer","kota","bikaner","jabalpur","ujjain","gwalior","jodhpur","udaipur",
    "kalyan","solapur","kolhapur","nashik","aurangabad","amravati","jalgaon",
    "vadodara","rajkot","bhavnagar","goa","cuttack","muzaffarpur","gaya",
    "dhanbad","asansol","durgapur","siliguri","jamshedpur","agra","meerut",
    "faridabad","amritsar",
]
def _dedupe(s):
    seen, out = set(), []
    for x in s:
        if x not in seen: seen.add(x); out.append(x)
    return out
CITIES = _dedupe(CITIES_CORE if CORE else CITIES_CORE + CITIES_EXTRA)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
HDR = {"User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate",
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
  "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none", "Sec-Fetch-User": "?1"}

LOG = []
def log(*a):
    # FIX 2. cp1252 consoles cannot encode the emoji this report prints, and an
    # unguarded print() took the whole 15 Oct run down after the CSV was saved.
    s = " ".join(str(x) for x in a)
    try:
        print(s, flush=True)
    except UnicodeEncodeError:
        print(s.encode("ascii", "replace").decode("ascii"), flush=True)
    LOG.append(s)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def get(url, referer=None, tries=3):
    h = dict(HDR)
    if referer: h["Referer"] = referer; h["Sec-Fetch-Site"] = "same-origin"
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
            if a < tries - 1: time.sleep(2 * (a + 1)); continue
            return 0, ""
    return 0, ""

NEXT_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)
def next_data(html):
    m = NEXT_RE.search(html)
    if not m: return None
    try: return json.loads(m.group(1))
    except Exception: return None

# ───────────────────────────────────────────── FIX 1: UTC -> IST, done once
def parse_utc(ts):
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M",
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.datetime.strptime(
                str(ts)[:19].rstrip("Z"), fmt).replace(
                    tzinfo=datetime.timezone.utc)
        except (ValueError, TypeError):
            continue
    return None

def to_ist(ts):
    d = parse_utc(ts)
    return d.astimezone(IST) if d else None

def sessions_from(data, lang):
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
                    tot, av = s.get("total") or 0, s.get("avail") or 0
                    gross, classes = 0, []
                    for ar in s.get("areas") or []:
                        st, sa = ar.get("sTotal") or 0, ar.get("sAvail") or 0
                        pr = ar.get("price") or 0
                        gross += (st - sa) * pr
                        classes.append(f"{ar.get('label','')}:{st-sa}/{st}@{pr}")
                    raw = s.get("showTime") or ""
                    ist = to_ist(raw)
                    utc = parse_utc(raw)
                    mins = (int((utc - NOW_UTC).total_seconds() // 60)
                            if utc else 99999)
                    out.append({
                        "lang": lang,
                        "cinemaId": c.get("id"),
                        "cinema": info.get("name") or info.get("label") or "",
                        "chain": info.get("chainKey") or "",
                        "city": info.get("city") or "",
                        "state": info.get("state") or "",
                        "pincode": info.get("pincode") or "",
                        "audi": s.get("audi") or "", "format": s.get("scrnFmt") or "",
                        "showTimeUTC": raw,
                        "showTimeIST": ist.strftime("%Y-%m-%dT%H:%M") if ist else "",
                        "istDate": ist.strftime("%Y-%m-%d") if ist else "",
                        "istHour": ist.hour if ist else "",
                        "minsToShow": mins, "started": "Y" if mins < 0 else "N",
                        "seatStatus": s.get("seatStatus") or "",
                        "seatsTotal": tot, "seatsAvail": av, "sold": tot - av,
                        "soldOut": 1 if (tot > 0 and av == 0) else 0,
                        "grossRs": gross, "classes": "; ".join(classes),
                        "sessionId": s.get("encSessionId")
                                     or f"{c.get('id')}-{s.get('sid')}-{raw}",
                    })
    return out

def catalogue_raw():
    st, html = get("https://www.district.in/movies")
    if st != 200 or not html:
        log(f"could not read the catalogue (HTTP {st})"); return []
    hits = re.findall(r"/movies/([a-z0-9\-]+)-movie-tickets-(MV\d+)", html, re.I)
    seen, rows = set(), []
    for slug, mid in hits:
        if mid in seen: continue
        seen.add(mid); rows.append((slug, mid))
    return rows

def resolve(film):
    """Every District id whose slug matches this film. Prints the rejects too -
    a silently missing id is indistinguishable from a bug."""
    rows = catalogue_raw()
    pat = re.compile(film["match"], re.I)
    rej = re.compile(film["reject"], re.I) if film.get("reject") else None
    kp = re.compile(film["keep"], re.I) if film.get("keep") else None
    out = []
    for slug, mid in rows:
        if not pat.search(slug): continue
        if rej and rej.search(slug) and not (kp and kp.search(slug)):
            out.append((slug, mid, "SKIP: matches the reject pattern")); continue
        lang = next((v for k, v in LANG_HINTS.items() if k in slug.lower()), None)
        out.append((slug, mid, lang or "UNLABELLED"))
    return out

# ─────────────────────────────────────────── venues whose seat data is junk
# These report near-identical high occupancy for EVERY film we sweep, which is
# a default or stale seat state passed through by District, not demand:
#   New Kohinoor, Jodhpur   744/1,140 = 65.3% for BOTH Prahaar and Nayi Naveli,
#                           byte identical on two different films.
#   APR Cinemas, Gaya       83.5% for Prahaar, 83.5% for Nayi Naveli,
#                           85.8% for Jailer 2.
# On Nayi Naveli these two plus three of the same profile were 34% of every
# ticket sold nationally, which put four fake cities at the top of the hot
# list. They are NOT dropped - that would hide a real booking if one of them
# ever is real - they are flagged, excluded from a second set of totals, and
# the report prints both so the reader chooses.
ARTEFACT_VENUES = [
    "apr cinemas", "new kohinoor",                      # proven on 2+ films
    "bharat cineplex", "apsra", "delite theatre",       # same profile, unproven
]
def is_artefact(name):
    n = (name or "").lower()
    return any(k in n for k in ARTEFACT_VENUES)

LANG_BY_STATE = {
    "Tamil": {"tamil-nadu", "puducherry"},
    "Telugu": {"telangana", "andhra-pradesh"},
    "Malayalam": {"kerala"},
    "Kannada": {"karnataka"},
    "Hindi": {"gujarat","uttar-pradesh","delhi","haryana","rajasthan",
              "madhya-pradesh","maharashtra","punjab","bihar","uttarakhand",
              "chhattisgarh","jharkhand","assam","west-bengal",
              "jammu-and-kashmir"},
}

def infer_language(rows):
    if not rows: return "UNLABELLED (no shows)", ""
    seats = collections.Counter()
    for r in rows: seats[(r["state"] or "?").lower()] += r["seatsTotal"]
    total = sum(seats.values()) or 1
    score = {l: sum(v for k, v in seats.items() if k in s) / total
             for l, s in LANG_BY_STATE.items()}
    ranked = sorted(score.items(), key=lambda x: -x[1])
    best, share = ranked[0]; runner, rshare = ranked[1]
    if share < 0.40 or (share - rshare) < 0.15:
        top = ", ".join(f"{k} {v/total*100:.0f}%" for k, v in seats.most_common(4))
        return "UNLABELLED (mixed)", (f"no clear plurality - best {best} "
            f"{share*100:.0f}% vs {runner} {rshare*100:.0f}%; states: {top}")
    return best, (f"{share*100:.0f}% of seats in {best} states; next best "
                  f"{runner} {rshare*100:.0f}%")

def main():
    if LIST_ONLY:
        rows = catalogue_raw()
        log(f"District is carrying {len(rows)} films:\n")
        for slug, mid in sorted(rows): log(f'    ("{slug}", "{mid}"),')
        return
    os.makedirs(OUT, exist_ok=True)
    log(f"RUN {datetime.datetime.now().isoformat()}")
    log(f"{F['title']}   ({FILM_KEY})   IST show date {DATE_LABEL}")
    log("District, server rendered, one request per city PER LANGUAGE.")
    log("Times are converted UTC -> IST and filtered on the IST date.")
    log("GET only. Nothing booked, nothing held, nothing posted.")
    if F.get("note"): log(f"\nNOTE: {F['note']}")

    st, _ = get("https://www.district.in/movies")
    log(f"\nsession warm-up: HTTP {st}, cookies={[c.name for c in jar]}\n")
    time.sleep(PAUSE)

    log("[1] resolving every District id for this film")
    found = resolve(F)
    if not found:
        log("  NOTHING FOUND. Either District has not listed it yet, or the")
        log("  catalogue did not render, or the match pattern is too narrow.")
        log(f"  pattern was: {F['match']}")
        log("  Run 'python district_sweep.py list' and look for it by eye.")
        log("  A zero here means NOT LISTED, never zero demand.")
        return
    tracks = []
    for slug, mid, lang in found:
        log(f"  {slug:<46}{mid:<10}{lang}")
        if not lang.startswith("SKIP"): tracks.append((slug, mid, lang))
    if not tracks:
        log("\n  every match was rejected. Stopping."); return
    log(f"\n  {len(tracks)} track(s): " + ", ".join(t[2] for t in tracks))
    if IDS_ONLY:
        log("\n--ids given, stopping before the sweep."); return
    log(f"  {len(CITIES)} cities x {len(tracks)} tracks = "
        f"{len(CITIES)*len(tracks)} requests, about "
        f"{len(CITIES)*len(tracks)*(PAUSE+0.6)/60:.0f} minutes.\n")

    seen, rows, dropped = set(), [], 0
    for slug, mid, lang in tracks:
        log(f"[2] {lang}  ({slug})")
        got_any = False
        for city in CITIES:
            url = (f"https://www.district.in/movies/{slug}"
                   f"-movie-tickets-in-{city}-{mid}?fromdate={DATE_LABEL}")
            code, html = get(url, referer="https://www.district.in/movies")
            if code != 200 or not html:
                if code == 403:
                    log(f"    {city:<22} HTTP 403 - declined. Recorded, not retried.")
                elif code != 404:
                    log(f"    {city:<22} HTTP {code}")
                time.sleep(PAUSE); continue
            data = next_data(html)
            if not data:
                log(f"    {city:<22} no __NEXT_DATA__"); time.sleep(PAUSE); continue
            all_rows = sessions_from(data, lang)
            # FIX 1: filter on the IST date, not the raw UTC string
            got = [r for r in all_rows if r["istDate"] == DATE_LABEL]
            dropped += len(all_rows) - len(got)
            new = [r for r in got if (mid, r["sessionId"]) not in seen]
            for r in new:
                r["track"] = f"{slug}|{mid}"
                seen.add((mid, r["sessionId"])); rows.append(r)
            if new:
                got_any = True
                t = sum(r["seatsTotal"] for r in new)
                s2 = sum(r["sold"] for r in new)
                so = sum(r["soldOut"] for r in new)
                log(f"    {city:<22}{len({r['cinemaId'] for r in new}):>4} cin "
                    f"{len(new):>4} sh {t:>7,} seats {s2:>6,} sold "
                    f"{(s2/t*100 if t else 0):>5.1f}% {so:>3} s/out")
            time.sleep(PAUSE)
        if not got_any:
            log(f"    no shows anywhere for {lang} on {DATE_LABEL}.")
            log(f"    Report that as NOT LISTED, not as zero demand.")
        log("")

    if not rows:
        log("No sessions anywhere. Nothing to report. Do not publish a zero.")
        open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8").write("\n".join(LOG))
        return
    log(f"  {dropped:,} session(s) fell on another IST date and were excluded.")
    log(f"  The OLD script filtered on the raw UTC string instead, which threw")
    log(f"  away every show before 05:30 IST. That is the FDFS block.\n")

    by_track = collections.defaultdict(list)
    for r in rows: by_track[r.get("track", "?")].append(r)
    if any(r["lang"].startswith("UNLABELLED") for r in rows):
        log("=== LANGUAGE RELABELLING (slug carried no language word) ===")
        for tk, trows in by_track.items():
            if not trows[0]["lang"].startswith("UNLABELLED"): continue
            lab, why = infer_language(trows)
            for r in trows: r["lang"] = lab
            log(f"  {tk:<44}-> {lab}")
            if why: log(f"      {why}")
        log("  Inferred from where the shows ARE. A single-language Hindi film")
        log("  should come back Hindi with a large margin; if it does not,")
        log("  something is wrong with the id resolution, not the inference.\n")

    cols = ["lang","track","city","state","chain","cinema","cinemaId","pincode",
            "audi","format","showTimeUTC","showTimeIST","istDate","istHour",
            "minsToShow","started","seatStatus","seatsTotal","seatsAvail",
            "sold","soldOut","grossRs","classes","sessionId"]
    with open(os.path.join(OUT, "district_shows.csv"), "w", newline="",
              encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader(); [w.writerow(r) for r in rows]
    report(rows)
    open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8").write("\n".join(LOG))
    log(f"\nWritten to {OUT}")

def report(rows):
    tot = sum(r["seatsTotal"] for r in rows)
    sold = sum(r["sold"] for r in rows)
    gross = sum(r["grossRs"] for r in rows)
    so = sum(r["soldOut"] for r in rows)
    log("=" * 68)
    log(f"  {F['title'].upper()}  ·  {DATE_LABEL} IST  ·  District only")
    log("=" * 68)
    log(f"  cinemas         {len({r['cinemaId'] for r in rows}):>12,}")
    log(f"  shows           {len(rows):>12,}")
    log(f"  shows SOLD OUT  {so:>12,}   {so/len(rows)*100:.1f}% of shows")
    log(f"  seats on sale   {tot:>12,}")
    log(f"  seats sold      {sold:>12,}")
    log(f"  occupancy       {(sold/tot*100 if tot else 0):>11.1f}%")
    log(f"  advance gross   Rs {gross/1e7:>9.2f} Cr")
    log(f"  average ticket  Rs {(gross/sold if sold else 0):>9.0f}")

    # ---- the artefact check, run on every film from now on
    bad = [r for r in rows if is_artefact(r["cinema"])]
    if bad:
        ct = sum(r["seatsTotal"] for r in bad); cs = sum(r["sold"] for r in bad)
        log(f"\n  ⚠️ ARTEFACT-VENUE CHECK")
        log(f"  {len(bad)} show(s) at {len({r['cinemaId'] for r in bad})} known-bad "
            f"venue(s): {cs:,} of {sold:,} seats sold = {cs/sold*100 if sold else 0:.1f}%")
        for cid in {r["cinemaId"] for r in bad}:
            v = [r for r in bad if r["cinemaId"] == cid]
            vt = sum(r["seatsTotal"] for r in v); vs = sum(r["sold"] for r in v)
            log(f"      {v[0]['cinema'][:34]:<36}{v[0]['city'][:12]:<13}"
                f"{len(v):>3}sh {vs:>6,}/{vt:>7,} {vs/vt*100 if vt else 0:>5.1f}%")
        log(f"  occupancy WITHOUT them   {(sold-cs)/(tot-ct)*100 if tot-ct else 0:>10.2f}%")
        log(f"  These venues report the same high occupancy for every film we")
        log(f"  sweep. Quote the cleaned figure, and keep them out of any")
        log(f"  city hot-list - on Nayi Naveli they put four fake cities on top.")
    else:
        log(f"\n  artefact-venue check: none of the known-bad venues appear.")

    def group(field, title, limit=None):
        g = collections.defaultdict(lambda: [0, 0, 0, 0, set()])
        for r in rows:
            v = g[r[field] or "?"]
            v[0] += r["seatsTotal"]; v[1] += r["sold"]; v[2] += r["grossRs"]
            v[3] += r["soldOut"]; v[4].add(r["cinemaId"])
        log(f"\n=== BY {title} ===")
        items = sorted(g.items(), key=lambda x: -x[1][1])
        for k, v in (items[:limit] if limit else items):
            log(f"  {str(k)[:24]:<26}{len(v[4]):>4} cin {v[1]:>8,} sold "
                f"{(v[1]/v[0]*100 if v[0] else 0):>5.1f}%  Rs {v[2]/1e7:>6.2f} Cr"
                f"  {v[3]:>4} s/out")
    group("lang", "LANGUAGE")
    group("state", "STATE", 12)
    group("chain", "CHAIN", 20)
    group("city", "CITY", 15)
    group("format", "FORMAT")

    log("\n=== BY TIME OF DAY (IST, converted from UTC) ===")
    for lab, a, b in (("before 7am",0,7),("7-10am",7,10),("10am-1pm",10,13),
                      ("1-4pm",13,16),("4-7pm",16,19),("7-10pm",19,22),
                      ("10pm+",22,24)):
        g = [r for r in rows if isinstance(r["istHour"], int)
             and a <= r["istHour"] < b]
        if not g: continue
        t = sum(r["seatsTotal"] for r in g); s = sum(r["sold"] for r in g)
        log(f"  {lab:<12}{len(g):>6} sh {t:>9,} seats {s:>8,} sold "
            f"{(s/t*100 if t else 0):>5.1f}%  {sum(r['soldOut'] for r in g):>4} s/out")
    log("  This table is now trustworthy. Previously the early rows were")
    log("  missing entirely because of the date-filter bug above.")

    log("\n=== PLAYED vs STILL SELLING ===")
    for lab, g in (("already started", [r for r in rows if r["started"] == "Y"]),
                   ("still on sale", [r for r in rows if r["started"] != "Y"])):
        t = sum(r["seatsTotal"] for r in g); s = sum(r["sold"] for r in g)
        log(f"  {lab:<18}{len(g):>6} sh {t:>9,} seats {s:>8,} sold "
            f"{(s/t*100 if t else 0):>5.1f}%")

    log("\n  WHAT THIS IS NOT")
    log("  District is a subset of the market - on Jailer 2 it carried about")
    log("  36% of the tickets Sacnilk reported. Use it for occupancy, the")
    log("  chain question and real ticket prices. Do not publish its total as")
    log("  the film's advance.")

if __name__ == "__main__":
    main()
