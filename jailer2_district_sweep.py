#!/usr/bin/env python3
"""
Boxoffy - JAILER 2 opening-day sweep via District, ALL LANGUAGES.

    python jailer2_district_sweep.py                 opening day, 15 Oct
    python jailer2_district_sweep.py --core          50 cities, fast read
    python jailer2_district_sweep.py 2026-10-16      Friday instead
    python jailer2_district_sweep.py list            print District's catalogue
    python jailer2_district_sweep.py --ids           resolve Jailer 2 ids and stop

WHAT THIS IS
------------
District server-renders the whole session grid for a city into __NEXT_DATA__,
so one request per city returns every cinema, every show, seats total, seats
available, and the per-class PRICE. That makes the advance gross exact rather
than estimated. No booking funnel is touched, nothing is held, nothing is
posted. GET only.

WHY THIS ONE IS DIFFERENT FROM THE DRISHYAM SWEEP
-------------------------------------------------
Jailer 2 is a FOUR-LANGUAGE release - Tamil, Telugu, Hindi, Kannada - and
District gives each language its own movie id. Sweeping one id reads one
language and silently misses three. So this script DISCOVERS every Jailer 2
id from District's own catalogue first, then sweeps each one, and reports
per language as well as in total.

Hardcoding the ids would have been faster and would have broken the moment
District added the Kannada track.
"""

import os, re, csv, json, gzip, io, sys, time, datetime, collections
import urllib.request, urllib.error, http.cookiejar

FILM_KEY   = "jailer2"
DATE_LABEL = "2026-10-15"          # Thursday release
RELEASE    = "2026-10-15"

_args = [a for a in sys.argv[1:] if a]
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
LIST_ONLY = bool(_args) and _args[0].lower() == "list"
IDS_ONLY  = "--ids" in _args
_dates = [a for a in _args if DATE_RE.match(a)]
if _dates: DATE_LABEL = _dates[0]

OUT     = os.path.join("intel", f"{FILM_KEY}-{DATE_LABEL}")
RUN_UTC = datetime.datetime.utcnow()
PAUSE   = 0.8

# ── Languages we expect. The script does not trust this list; it only uses it
#    to LABEL what it finds. A language District carries that is not here will
#    still be swept and will be labelled from the slug.
LANG_HINTS = {
    "tamil": "Tamil", "telugu": "Telugu", "hindi": "Hindi",
    "kannada": "Kannada", "malayalam": "Malayalam",
}

# ── CALIBRATION. One real point, ours, from the Drishyam opening day.
#    advance 6,36,693 seats / Rs 26.97 Cr chain advance gross -> Rs 62.00 Cr
#    day-one India net. That is 2.30x on advance gross, Rs 974 per advance seat.
#    Both are printed, both are labelled, and the report says plainly why they
#    do not transfer cleanly to a Tamil-led release.
CAL = {"film":"Drishyam: The Conclusion", "date":"2026-10-02",
       "adv_seats":636693, "adv_chain_seats":421153,
       "adv_chain_gross_cr":26.97, "day1_net_cr":62.00}
CAL_MULT    = CAL["day1_net_cr"] / CAL["adv_chain_gross_cr"]      # 2.30
CAL_PER_SEAT= CAL["day1_net_cr"]*1e7 / CAL["adv_seats"]           # 974

CITIES_CORE = [
    "chennai", "coimbatore", "madurai", "tiruchirappalli", "salem", "erode",
    "tirunelveli", "vellore", "thanjavur", "tiruppur",
    "bengaluru", "mysuru", "mangaluru", "hubballi", "belagavi",
    "hyderabad", "visakhapatnam", "vijayawada", "guntur", "warangal",
    "mumbai", "new-delhi", "pune", "kolkata", "ahmedabad", "jaipur",
    "lucknow", "chandigarh", "indore", "bhopal", "nagpur", "surat",
    "kochi", "thiruvananthapuram", "kozhikode", "thrissur",
    "noida", "gurgaon", "ghaziabad", "thane", "navi-mumbai",
    "patna", "ranchi", "bhubaneswar", "guwahati", "kanpur", "varanasi",
    "ludhiana", "dehradun", "raipur",
]
CITIES_EXTRA = [
    # Tamil Nadu depth - this is the core market and it is mostly tier 2/3
    "tirupur", "dindigul", "karur", "namakkal", "hosur", "cuddalore",
    "kanchipuram", "nagercoil", "pollachi", "sivakasi", "rajapalayam",
    "villupuram", "tiruvannamalai", "krishnagiri", "pudukkottai",
    "virudhunagar", "theni", "ramanathapuram", "ariyalur", "perambalur",
    # Karnataka / Kerala / AP-TG depth
    "davanagere", "shivamogga", "tumakuru", "ballari", "kalaburagi", "udupi",
    "kollam", "kottayam", "alappuzha", "kannur", "palakkad",
    "tirupati", "nellore", "kurnool", "anantapur", "rajahmundry", "kakinada",
    "karimnagar", "nizamabad", "khammam",
    # Hindi belt, for the Hindi track
    "prayagraj", "gorakhpur", "bareilly", "aligarh", "moradabad", "jhansi",
    "jalandhar", "patiala", "mohali", "panipat", "rohtak", "jammu",
    "ajmer", "kota", "bikaner", "jabalpur", "ujjain", "gwalior", "jodhpur",
    "udaipur", "kalyan", "solapur", "kolhapur", "nashik", "aurangabad",
    "amravati", "jalgaon", "vadodara", "rajkot", "bhavnagar", "goa",
    "cuttack", "muzaffarpur", "gaya", "dhanbad", "asansol", "durgapur",
    "siliguri", "jamshedpur", "agra", "meerut", "faridabad", "amritsar",
]
def _dedupe(seq):
    seen, out = set(), []
    for x in seq:
        if x not in seen: seen.add(x); out.append(x)
    return out
CITIES = _dedupe(CITIES_CORE if "--core" in sys.argv else CITIES_CORE + CITIES_EXTRA)

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
    # The Windows console is cp1252 and the report prints an emoji, so an
    # unguarded print() raises UnicodeEncodeError and kills the run AFTER the
    # CSV is written but BEFORE RUN.txt - which is exactly what happened on
    # the 15 Oct pass. jailer2_bms_sweep.py already had this guard; this file
    # did not. Never print untrusted-width text to a console without it.
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
            # 403 is an ANSWER. It means District does not want to serve this
            # client. We record it and move on. We never try to defeat it.
            if e.code in (429, 503) and a < tries - 1:
                time.sleep(3 * (a + 1)); continue
            return e.code, ""
        except Exception:
            if a < tries - 1: time.sleep(2 * (a + 1)); continue
            return 0, ""
    return 0, ""

NEXT_RE = re.compile(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)
def next_data(html):
    m = NEXT_RE.search(html)
    if not m: return None
    try: return json.loads(m.group(1))
    except Exception: return None

def mins_to_show(ts):
    t = None
    for fmt in ("%Y-%m-%dT%H:%M:%S","%Y-%m-%dT%H:%M","%Y-%m-%d %H:%M:%S","%Y-%m-%d %H:%M"):
        try:
            t = datetime.datetime.strptime(ts[:19].rstrip("Z"), fmt); break
        except (ValueError, TypeError): continue
    return 99999 if t is None else int((t - RUN_UTC).total_seconds() // 60)

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
                        st, sa, pr = ar.get("sTotal") or 0, ar.get("sAvail") or 0, ar.get("price") or 0
                        gross += (st - sa) * pr
                        classes.append(f"{ar.get('label','')}:{st-sa}/{st}@{pr}")
                    m = mins_to_show(s.get("showTime") or "")
                    out.append({
                        "lang": lang,
                        "cinemaId": c.get("id"), "cinema": info.get("name") or info.get("label") or "",
                        "chain": info.get("chainKey") or "", "city": info.get("city") or "",
                        "state": info.get("state") or "", "pincode": info.get("pincode") or "",
                        "audi": s.get("audi") or "", "format": s.get("scrnFmt") or "",
                        "showTime": s.get("showTime") or "", "minsToShow": m,
                        "started": "Y" if m < 0 else "N",
                        "seatStatus": s.get("seatStatus") or "",
                        "seatsTotal": tot, "seatsAvail": av, "sold": tot - av,
                        "grossRs": gross, "classes": "; ".join(classes),
                        "sessionId": s.get("encSessionId") or f"{c.get('id')}-{s.get('sid')}-{s.get('showTime')}",
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

def catalogue():
    rows = catalogue_raw()
    log(f"District is carrying {len(rows)} films:\n")
    for slug, mid in sorted(rows): log(f'    ("{slug}", "{mid}"),')

def resolve_jailer():
    """Find EVERY Jailer 2 entry District carries, one per language.
    Returns [(slug, movieId, languageLabel)]."""
    rows = catalogue_raw()
    hits = [(s, m) for s, m in rows if "jailer" in s.lower()]
    out = []
    for slug, mid in hits:
        low = slug.lower()
        if not re.search(r"jailer[-_]?2|jailer-two|rajini", low):
            # Jailer (2023) may still be listed. Keep it out of the sweep but
            # say so, because an unexplained missing id looks like a bug.
            out.append((slug, mid, "SKIP: looks like the 2023 Jailer"))
            continue
        lang = next((v for k, v in LANG_HINTS.items() if k in low), None)
        out.append((slug, mid, lang or "UNLABELLED"))
    return out

# ── On the 13 Oct run BOTH Jailer 2 ids came back UNLABELLED, because neither
#    slug carries a language word ("jailer-2" and "rajini-the-jailer-2"). The
#    two tracks were then merged under one label, and the Hindi/chain section
#    printed "No Hindi track found" while the Hindi track was sitting in the
#    data as the second id. The footprint identifies it unambiguously, so we
#    relabel AFTER the sweep from where the shows actually are.
LANG_BY_STATE = {
    "Tamil":     {"tamil-nadu", "puducherry"},
    "Telugu":    {"telangana", "andhra-pradesh"},
    "Malayalam": {"kerala"},
    "Kannada":   {"karnataka"},
    "Hindi":     {"gujarat", "uttar-pradesh", "delhi", "haryana", "rajasthan",
                  "madhya-pradesh", "maharashtra", "punjab", "bihar",
                  "uttarakhand", "chhattisgarh", "jharkhand", "assam",
                  "west-bengal", "jammu-and-kashmir"},
}

def infer_language(track_rows):
    """Name an UNLABELLED track from the states its shows are in. Returns
    (label, confidence_note). Never silently guesses - the caller prints it."""
    if not track_rows: return "UNLABELLED (no shows)", ""
    seats = collections.Counter()
    for r in track_rows:
        seats[(r["state"] or "?").lower()] += r["seatsTotal"]
    total = sum(seats.values()) or 1
    score = {}
    for lang, states in LANG_BY_STATE.items():
        score[lang] = sum(v for k, v in seats.items() if k in states) / total
    ranked = sorted(score.items(), key=lambda x: -x[1])
    best, share = ranked[0]
    runner, rshare = ranked[1]
    # An ORIGINAL plays nationally, so a raw share test mis-reads it: the real
    # 13 Oct Tamil track sat at 54% of seats in Tamil states, which no sensible
    # absolute threshold catches without also swallowing genuine mixtures. What
    # separates them is the MARGIN over the runner-up - 54 vs 16 is a clear
    # plurality, 30 vs 30 is not.
    if share < 0.40 or (share - rshare) < 0.15:
        top = ", ".join(f"{k} {v/total*100:.0f}%" for k, v in seats.most_common(4))
        return "UNLABELLED (mixed)", (
            f"no clear plurality - best {best} {share*100:.0f}% vs "
            f"{runner} {rshare*100:.0f}%; states: {top}")
    return best, (f"{share*100:.0f}% of seats in {best} states; "
                  f"next best {runner} {rshare*100:.0f}%")

def main():
    if LIST_ONLY:
        catalogue(); return
    os.makedirs(OUT, exist_ok=True)
    log(f"RUN {datetime.datetime.now().isoformat()}   JAILER 2   show date {DATE_LABEL}")
    log("District, server rendered, one request per city PER LANGUAGE.")
    log("GET only. Nothing booked, nothing held, nothing posted.\n")

    st, _ = get("https://www.district.in/movies")
    log(f"session warm-up: HTTP {st}, cookies={[c.name for c in jar]}\n")
    time.sleep(PAUSE)

    log("[1] resolving every Jailer 2 id District carries")
    found = resolve_jailer()
    if not found:
        log("  NOTHING FOUND. Either District has not listed Jailer 2 yet, or the")
        log("  catalogue page did not render. Run with 'list' and look for it by eye.")
        log("  Do not assume zero demand from a zero here - assume zero listing.")
        return
    tracks = []
    for slug, mid, lang in found:
        if lang.startswith("SKIP"):
            log(f"  {slug:<44}{mid:<10}{lang}"); continue
        log(f"  {slug:<44}{mid:<10}{lang}")
        tracks.append((slug, mid, lang))
    if not tracks:
        log("\n  Jailer entries exist but none look like Jailer 2. Stopping."); return
    log(f"\n  {len(tracks)} language track(s) to sweep: "
        + ", ".join(t[2] for t in tracks))
    if IDS_ONLY:
        log("\n--ids given, stopping before the sweep."); return
    log(f"  {len(CITIES)} cities x {len(tracks)} tracks = "
        f"{len(CITIES)*len(tracks)} requests, about "
        f"{len(CITIES)*len(tracks)*(PAUSE+0.6)/60:.0f} minutes.\n")

    seen, rows = set(), []
    for slug, mid, lang in tracks:
        log(f"[2] {lang}  ({slug})")
        got_any = False
        for city in CITIES:
            url = (f"https://www.district.in/movies/{slug}"
                   f"-movie-tickets-in-{city}-{mid}?fromdate={DATE_LABEL}")
            code, html = get(url, referer="https://www.district.in/movies")
            if code != 200 or not html:
                if code == 403:
                    log(f"    {city:<22} HTTP 403 - District declined. Recorded, not retried.")
                elif code != 404:
                    log(f"    {city:<22} HTTP {code}")
                time.sleep(PAUSE); continue
            data = next_data(html)
            if not data:
                log(f"    {city:<22} no __NEXT_DATA__"); time.sleep(PAUSE); continue
            got = [r for r in sessions_from(data, lang)
                   if r["showTime"][:10] == DATE_LABEL]
            # Dedupe key INCLUDES the language. A shared `seen` keyed on the
            # session id alone lets the first language track swallow a genuine
            # second-language show whenever District reuses an id, or whenever
            # encSessionId is absent and the fallback key collides.
            new = [r for r in got if (mid, r["sessionId"]) not in seen]
            for r in new:
                r["track"] = f"{slug}|{mid}"   # keeps the two ids apart even
                seen.add((mid, r["sessionId"])) # when both labels say UNLABELLED
                rows.append(r)
            if new:
                got_any = True
                t = sum(r["seatsTotal"] for r in new); s2 = sum(r["sold"] for r in new)
                log(f"    {city:<22}{len({r['cinemaId'] for r in new}):>4} cin "
                    f"{len(new):>4} shows {t:>7,} seats {s2:>6,} sold "
                    f"{(s2/t*100 if t else 0):>5.1f}%")
            time.sleep(PAUSE)
        if not got_any:
            log(f"    no shows anywhere for {lang} on {DATE_LABEL}.")
            log(f"    That is a FINDING, not a failure - report it as not listed,")
            log(f"    not as zero demand.")
        log("")

    if not rows:
        log("No sessions anywhere. Nothing to report. Do not publish a zero.")
        open(os.path.join(OUT,"RUN.txt"),"w",encoding="utf-8").write("\n".join(LOG)); return

    # ── Relabel any UNLABELLED track from its own footprint, per track id, so
    #    two ids can never share one label. On 13 Oct this is what separated
    #    the Tamil original from the Hindi version.
    by_track = collections.defaultdict(list)
    for r in rows: by_track[r.get("track", "?")].append(r)
    if any(r["lang"].startswith("UNLABELLED") for r in rows):
        log("=== LANGUAGE RELABELLING (slug carried no language word) ===")
        for tk, trows in by_track.items():
            if not trows[0]["lang"].startswith("UNLABELLED"): continue
            lab, why = infer_language(trows)
            for r in trows: r["lang"] = lab
            log(f"  {tk:<42}-> {lab}")
            if why: log(f"      {why}")
        log("  Inferred from where the shows ARE, not from the slug. If a call")
        log("  above looks wrong, trust the BY STATE table and say UNLABELLED.")
        log("")

    cols = ["lang","track","city","state","chain","cinema","cinemaId","pincode","audi","format",
            "showTime","minsToShow","started","seatStatus","seatsTotal","seatsAvail",
            "sold","grossRs","classes","sessionId"]
    with open(os.path.join(OUT,"district_shows.csv"),"w",newline="",encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader(); [w.writerow(r) for r in rows]
    json.dump(rows, open(os.path.join(OUT,"district_raw.json"),"w"), indent=1)

    report(rows)
    open(os.path.join(OUT,"RUN.txt"),"w",encoding="utf-8").write("\n".join(LOG))
    log(f"\nWritten to {OUT}")

def report(rows):
    tot  = sum(r["seatsTotal"] for r in rows)
    sold = sum(r["sold"] for r in rows)
    gross= sum(r["grossRs"] for r in rows)
    cin  = len({r["cinemaId"] for r in rows})
    log("=" * 68)
    log(f"  JAILER 2 - ALL LANGUAGES - {DATE_LABEL} - District only")
    log("=" * 68)
    log(f"  cinemas         {cin:>12,}")
    log(f"  shows           {len(rows):>12,}")
    log(f"  seats on sale   {tot:>12,}")
    log(f"  seats sold      {sold:>12,}")
    log(f"  occupancy       {(sold/tot*100 if tot else 0):>11.1f}%")
    log(f"  advance gross   Rs {gross/1e7:>9.2f} Cr")
    log(f"  average ticket  Rs {(gross/sold if sold else 0):>9.0f}")

    def group(field, title, limit=None):
        g = collections.defaultdict(lambda: [0,0,0,set()])
        for r in rows:
            v = g[r[field] or "?"]
            v[0]+=r["seatsTotal"]; v[1]+=r["sold"]; v[2]+=r["grossRs"]; v[3].add(r["cinemaId"])
        log(f"\n=== BY {title} ===")
        for k,v in sorted(g.items(), key=lambda x:-x[1][1])[:limit] if limit else sorted(g.items(), key=lambda x:-x[1][1]):
            log(f"  {str(k)[:24]:<26}{len(v[3]):>4} cin {v[1]:>8,} sold "
                f"{(v[1]/v[0]*100 if v[0] else 0):>5.1f}%  Rs {v[2]/1e7:>6.2f} Cr")

    group("lang","LANGUAGE")
    group("state","STATE", 12)
    group("chain","CHAIN")
    group("city","CITY", 15)

    # ── the Hindi question, answered from the data rather than from a rumour
    log("\n=== THE HINDI / NATIONAL CHAIN QUESTION ===")
    hindi = [r for r in rows if r["lang"] == "Hindi"]
    if not hindi:
        log("  No Hindi track found at all on this date.")
    else:
        nat = {"PVR","INOX","PVRINOX","CINEPOLIS","CARNIVAL"}
        inchain = [r for r in hindi if (r["chain"] or "").upper().replace(" ","") in nat]
        log(f"  Hindi shows total            {len(hindi):>8,}")
        log(f"  of those in PVR/INOX/Cinepolis {len(inchain):>6,}  "
            f"({len(inchain)/len(hindi)*100:.1f}%)")
        log("  Trade reported the Hindi version would miss PVR INOX and Cinepolis")
        log("  over a four-week OTT window. The line above is the actual answer.")
        log("  A low number corroborates the report. Say which it is.")

    # ── opening-day prediction
    log("\n" + "=" * 68)
    log("  OPENING DAY PREDICTION")
    log("=" * 68)
    log(f"  Calibrated on ONE point - our own {CAL['film']} read of {CAL['date']}:")
    log(f"    {CAL['adv_seats']:,} advance seats, Rs {CAL['adv_chain_gross_cr']} Cr chain")
    log(f"    advance gross, actual day one Rs {CAL['day1_net_cr']} Cr India net.")
    log(f"    -> {CAL_MULT:.2f}x on advance gross, Rs {CAL_PER_SEAT:,.0f} per advance seat.")
    log("")
    a = gross/1e7 * CAL_MULT
    b = sold * CAL_PER_SEAT / 1e7
    log(f"  Method A, advance gross x {CAL_MULT:.2f}      Rs {a:>7.2f} Cr")
    log(f"  Method B, seats x Rs {CAL_PER_SEAT:,.0f}          Rs {b:>7.2f} Cr")
    log(f"  Midpoint                            Rs {(a+b)/2:>7.2f} Cr")
    log("")
    # Why the two methods disagree, said in advance so it is not mistaken
    # for a bug when it happens. It WILL happen on a Tamil release.
    cal_atp = CAL["adv_chain_gross_cr"]*1e7 / CAL["adv_chain_seats"]
    obs_atp = gross/sold if sold else 0
    log(f"  The two methods disagree by {abs(a-b)/max(a,b,1e-9)*100:.0f}%. That gap is the")
    log(f"  ticket price, not an error: Rs {obs_atp:,.0f} observed here against")
    log(f"  Rs {cal_atp:,.0f} in the calibration film's chain advance.")
    if obs_atp < cal_atp:
        log("  Cheaper tickets than the calibration -> method A (gross-based)")
        log("  reads LOW and method B (seat-based) is the better floor here.")
    else:
        log("  Dearer tickets than the calibration -> method B (seat-based)")
        log("  reads LOW and method A (gross-based) is the better floor here.")
    log("")
    log("  ⚠️ READ THIS BEFORE PUBLISHING EITHER NUMBER.")
    log("  The calibration is a HINDI film with uncapped multiplex pricing on a")
    log("  holiday Friday. Jailer 2 is Tamil-led. Three things break the transfer:")
    log("    1. Tamil Nadu caps ticket prices, so the same seat yields less and")
    log("       the gross-based method A will read LOW.")
    log("    2. TN single screens take a much larger walk-up share, so advance")
    log("       understates the day more than it did for Drishyam.")
    log("    3. District is not the whole market. BookMyShow and the chains'")
    log("       own counters are not in this number at all.")
    log("  Treat the two methods as a FLOOR and a direction, publish a band, and")
    log("  say the basis. Do not print the midpoint as a forecast on its own.")
    tn = [r for r in rows if "tamil" in (r["state"] or "").lower()]
    if tn:
        tg = sum(r["grossRs"] for r in tn)
        log(f"\n  Tamil Nadu is {tg/gross*100 if gross else 0:.1f}% of the advance gross and")
        log(f"  {sum(r['sold'] for r in tn)/sold*100 if sold else 0:.1f}% of the seats. The higher that")
        log(f"  seat share runs against the gross share, the more the price cap is")
        log(f"  biting and the more method A understates.")

    log("\n=== PLAYED vs STILL SELLING ===")
    done = [r for r in rows if r["started"]=="Y"]; live=[r for r in rows if r["started"]!="Y"]
    for lab,g in (("already started",done),("still on sale",live)):
        t=sum(r["seatsTotal"] for r in g); s=sum(r["sold"] for r in g)
        log(f"  {lab:<18}{len(g):>6} shows {t:>9,} seats {s:>8,} sold "
            f"{(s/t*100 if t else 0):>5.1f}%")

    def ist_h(r):
        try: hh,mm = int(r["showTime"][11:13]), int(r["showTime"][14:16])
        except (ValueError, IndexError): return None
        return ((hh*60+mm)+330)//60 % 24
    log("\n=== BY TIME OF DAY (IST) ===")
    for lab,a_,b_ in [("before 7am",0,7),("7-10am",7,10),("10am-1pm",10,13),
                      ("1-4pm",13,16),("4-7pm",16,19),("7-10pm",19,22),("10pm+",22,24)]:
        g=[r for r in rows if ist_h(r) is not None and a_<=ist_h(r)<b_]
        t=sum(r["seatsTotal"] for r in g); s=sum(r["sold"] for r in g)
        log(f"  {lab:<12}{len(g):>6} shows {t:>9,} seats {s:>8,} sold "
            f"{(s/t*100 if t else 0):>5.1f}%")
    log("  Early-morning shows are the Tamil opening-day signature. A thick")
    log("  'before 7am' block selling out is the strongest single indicator")
    log("  that the fan turnout is real.")

    group("format","FORMAT")

if __name__ == "__main__":
    main()
