#!/usr/bin/env python3
"""
Boxoffy - JAILER 2, DAY ONE. District + BookMyShow in one command, full scale.

    python jailer2_day1.py                  one full pass, both sources
    python jailer2_day1.py --loop 45        a pass every 45 min, all day
    python jailer2_day1.py --core           fast read, TN + metros
    python jailer2_day1.py --no-run         re-aggregate the last pass only
    python jailer2_day1.py 2026-10-16       a different show date

It drives jailer2_district_sweep.py and jailer2_bms_sweep.py, then prints the
three numbers you asked for:

    TICKETS SOLD  ·  SHOWS SOLD OUT  ·  SHOWS

⚠️ THE ONE THING THAT MAKES A DAY-ONE SWEEP DIFFERENT FROM AN ADVANCE SWEEP
--------------------------------------------------------------------------
On release day, shows PLAY and then DISAPPEAR. Once a 6am show has finished,
District stops publishing its seat map and BMS drops the session. So a single
sweep at 11pm does not read the day - it reads whatever is still on sale at
11pm, which on a Rajinikanth Thursday is a fraction of it.

Every number our advance sweeps produced was safe because nothing had played.
Today that assumption is gone. One pass at the end of the day would undercount
tickets by most of the morning, and it would do it silently.

So this script keeps a LEDGER on disk, keyed per show, holding the HIGHEST sold
figure ever observed for that show. Shows that vanish keep their last known
value instead of falling out of the total. Run it several times through the day
- that is what --loop is for - and the ledger accumulates into a real daily
total rather than a snapshot.

    first pass 07:00  ->  the 4am and 6am FDFS shows, still listed
    pass at    13:00  ->  morning shows gone from the feed, kept in the ledger
    pass at    23:00  ->  the evening shows, added on top

A ledger total is still a FLOOR. A show that sold out after our last look at it
is recorded at the level we last saw. Start early, run often, and the floor
rises toward the truth.

WHERE EACH NUMBER COMES FROM - DO NOT MIX THESE UP
--------------------------------------------------
TICKETS SOLD   District only. District publishes seatsTotal and seatsAvail per
               show, so this is counted, not modelled. BookMyShow publishes NO
               seat counts at all - only four fullness words - so it cannot
               contribute a single ticket to this figure.
SHOWS SOLD OUT Both, counted differently and reported separately, because the
               two sources mean different things by it. See the note below.
SHOWS          Both, reported SEPARATELY and never added together. The two
               overlap heavily on multiplexes and use different venue ids, so
               a sum would double-count. The honest figure is the larger of
               the two as a floor, and the gap between them is itself the
               story for a Tamil release.

GET only. Nothing booked, held or posted - both child scripts enforce that.
A 403 is an answer. Stdlib only. Python 3.8+. Windows-safe.
"""

import os, re, csv, sys, json, time, subprocess, datetime, collections

FILM = "Jailer 2"
HERE = os.path.dirname(os.path.abspath(__file__))

_args = [a for a in sys.argv[1:] if a]
def flag(name, cast=None, default=None):
    if name not in _args: return default
    i = _args.index(name)
    if cast is None: return True
    try: return cast(_args[i + 1])
    except (IndexError, ValueError): return default

_d = [a for a in _args if re.match(r"^\d{4}-\d{2}-\d{2}$", a)]
DATE   = _d[0] if _d else "2026-10-15"          # Thursday release
DATE8  = DATE.replace("-", "")
CORE   = "--core" in _args
NO_RUN = "--no-run" in _args
LOOP   = flag("--loop", int, 0)
ONLY   = (flag("--only", str, "") or "").lower()   # district | bms | ""

OUT      = os.path.join("intel", f"jailer2-day1-{DATE}")
LEDGER_P = os.path.join(OUT, "ledger.json")
DIST_CSV = os.path.join("intel", f"jailer2-{DATE}", "district_shows.csv")
BMS_CSV  = os.path.join("intel", f"jailer2-bms-{DATE8}", "bms_shows.csv")

LOG = []
def log(*a):
    s = " ".join(str(x) for x in a)
    try: print(s, flush=True)
    except UnicodeEncodeError:
        print(s.encode("ascii", "replace").decode("ascii"), flush=True)
    LOG.append(s)

def inr(n):
    """Indian digit grouping. 1234567 -> 12,34,567. Printing a lakh figure in
    thousands separators is how a number gets misread by a factor of ten."""
    s = str(int(n))
    if len(s) <= 3: return s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:]); head = head[:-2]
    if head: parts.insert(0, head)
    return ",".join(parts + [tail])

def num(v):
    try: return int(float(v))
    except (TypeError, ValueError): return 0

# ───────────────────────────────────────────────── run the two child sweeps
def run_child(script, arg, label):
    """Streams the child's output line by line as it happens.

    ⚠️ The first version of this used subprocess.run(capture_output=True),
    which holds EVERYTHING until the child exits. District takes 15-20 minutes
    at full scale and BMS longer, so the terminal printed one line and then sat
    silent for half an hour. It was working the whole time and looked dead.
    Never capture a long child's output - stream it.

    -u on the child matters too: when a Python process writes to a pipe its
    stdout goes block-buffered, so even a child that flushes diligently can
    arrive in 8KB lumps. -u forces it through unbuffered."""
    path = os.path.join(HERE, script)
    if not os.path.exists(path):
        log(f"  {label}: {script} not found next to this file. Skipped.")
        return False
    cmd = [sys.executable, "-u", path, arg] + (["--core"] if CORE else [])
    log(f"  {label} starting: {' '.join(os.path.basename(c) for c in cmd)}")
    log(f"  (its own progress follows, prefixed {label[:4]}| - if this stops")
    log(f"   moving for more than a couple of minutes, THEN it is stuck)")
    t0 = time.time()
    tail = collections.deque(maxlen=4)
    try:
        p = subprocess.Popen(cmd, cwd=os.getcwd(), stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, text=True,
                             errors="replace", bufsize=1)
    except Exception as e:
        log(f"  {label} could not start: {e}"); return False
    try:
        for line in p.stdout:
            line = line.rstrip()
            if not line: continue
            tail.append(line)
            # echoed live, but kept out of LOG - the child writes its own
            # RUN.txt and duplicating 800 lines here helps nobody
            try: print(f"  {label[:4]}| {line}", flush=True)
            except UnicodeEncodeError:
                print(f"  {label[:4]}| "
                      + line.encode("ascii", "replace").decode("ascii"), flush=True)
    except KeyboardInterrupt:
        p.terminate(); log(f"\n  {label} interrupted by you."); raise
    p.wait()
    if p.returncode != 0:
        log(f"  {label} exited {p.returncode}. Last lines:")
        for l in tail: log(f"      ! {l[:120]}")
    log(f"  {label} done in {(time.time()-t0)/60:.1f} min, exit {p.returncode}")
    return p.returncode == 0

# ───────────────────────────────────────────────────────────────── ledger
def load_ledger():
    if os.path.exists(LEDGER_P):
        try:
            d = json.load(open(LEDGER_P, encoding="utf-8"))
            return d.get("shows", {}), d.get("passes", [])
        except Exception as e:
            log(f"  ledger unreadable ({e}); starting a new one")
    return {}, []

def save_ledger(shows, passes):
    os.makedirs(OUT, exist_ok=True)
    json.dump({"film": FILM, "date": DATE, "shows": shows, "passes": passes},
              open(LEDGER_P, "w", encoding="utf-8"), indent=0)

def merge_district(ledger, stamp):
    """District rows carry real seat counts. Keep the MAX sold ever seen per
    show - never overwrite a higher earlier figure with a lower later one,
    which is exactly what a naive re-read would do once a show has played."""
    if not os.path.exists(DIST_CSV):
        log(f"  no District CSV at {DIST_CSV}"); return 0, 0
    rows = list(csv.DictReader(open(DIST_CSV, encoding="utf-8")))
    added = raised = 0
    for r in rows:
        if (r.get("showTime") or "")[:10] != DATE:
            continue
        k = "D|" + (r.get("track") or "") + "|" + (r.get("sessionId") or "")
        tot, sold = num(r.get("seatsTotal")), num(r.get("sold"))
        av = num(r.get("seatsAvail"))
        full = 1 if (tot > 0 and av == 0) else 0
        e = ledger.get(k)
        if e is None:
            ledger[k] = {"src": "district", "lang": r.get("lang", ""),
                         "state": r.get("state", ""), "city": r.get("city", ""),
                         "chain": r.get("chain", ""), "venue": r.get("cinema", ""),
                         "vid": r.get("cinemaId", ""), "fmt": r.get("format", ""),
                         "showTime": r.get("showTime", ""),
                         "seatsTotal": tot, "sold": sold, "gross": num(r.get("grossRs")),
                         "soldOut": full, "firstSeen": stamp, "lastSeen": stamp}
            added += 1
        else:
            if sold > e["sold"]:
                e["sold"] = sold; e["gross"] = num(r.get("grossRs")); raised += 1
            e["seatsTotal"] = max(e["seatsTotal"], tot)
            e["soldOut"] = max(e["soldOut"], full)
            e["lastSeen"] = stamp
    return added, raised

def merge_bms(ledger, stamp):
    """BMS has no seat counts. It contributes shows, venues and sold-out
    LABELS only. Nothing here ever touches the ticket total."""
    if not os.path.exists(BMS_CSV):
        log(f"  no BMS CSV at {BMS_CSV}"); return 0
    rows = list(csv.DictReader(open(BMS_CSV, encoding="utf-8")))
    added = 0
    for r in rows:
        k = ("B|" + (r.get("lang") or "") + "|" + (r.get("regionCode") or "")
             + "|" + (r.get("venueCode") or "") + "|" + (r.get("sessionId") or ""))
        ncat, socat = num(r.get("nCat")), num(r.get("soldOutCats"))
        # FULLY sold out means every priced class is gone. The child script's
        # own report counts worstLabel == "SOLD OUT", which fires when ONE
        # class of five has gone - a far weaker claim. Both are kept.
        e = ledger.get(k)
        rec = {"src": "bms", "lang": r.get("lang", ""),
               "state": r.get("state", ""), "city": r.get("city", ""),
               "chain": r.get("chain", ""), "venue": r.get("venueName", ""),
               "vid": r.get("venueCode", ""), "fmt": r.get("attributes", ""),
               "showTime": r.get("showTime", ""),
               "nCat": ncat, "soldOutCats": socat,
               "anyClassGone": 1 if (r.get("worstLabel") == "SOLD OUT") else 0,
               "fullySoldOut": 1 if (ncat > 0 and socat >= ncat) else 0,
               "firstSeen": stamp, "lastSeen": stamp}
        if e is None:
            ledger[k] = rec; added += 1
        else:
            e["soldOutCats"]   = max(e.get("soldOutCats", 0), socat)
            e["nCat"]          = max(e.get("nCat", 0), ncat)
            e["anyClassGone"]  = max(e.get("anyClassGone", 0), rec["anyClassGone"])
            e["fullySoldOut"]  = max(e.get("fullySoldOut", 0), rec["fullySoldOut"])
            e["lastSeen"]      = stamp
    return added

# ───────────────────────────────────────────────────────────────── report
def report(ledger, passes):
    D = [e for e in ledger.values() if e["src"] == "district"]
    B = [e for e in ledger.values() if e["src"] == "bms"]

    sold   = sum(e["sold"] for e in D)
    seats  = sum(e["seatsTotal"] for e in D)
    gross  = sum(e.get("gross", 0) for e in D)
    d_full = sum(e["soldOut"] for e in D)
    b_full = sum(e.get("fullySoldOut", 0) for e in B)
    b_any  = sum(e.get("anyClassGone", 0) for e in B)
    shows  = max(len(D), len(B))

    log("\n" + "=" * 60)
    log(f"  {FILM.upper()} · DAY ONE · {DATE}")
    log("=" * 60)
    log(f"  TICKETS SOLD   {inr(sold):>20}")
    log(f"  SHOWS SOLD OUT {inr(d_full + b_full):>20}")
    log(f"  SHOWS          {inr(shows):>20}")
    log("=" * 60)

    if not D and not B:
        log("  NOTHING IN THE LEDGER. Neither sweep returned rows. That is")
        log("  either 'not listed yet' or a blocked read - check the child")
        log("  logs. Do not publish a zero from this.")
        return

    log(f"\n  passes merged {len(passes)}: " + ", ".join(passes[-6:]))
    if len(passes) < 2:
        log("  ⚠️ ONE PASS ONLY. On release day that is a snapshot, not a day.")
        log("  Shows that have already played are not in the feeds, so this")
        log("  ticket total is missing every show that finished before the")
        log("  sweep. Run again through the day - the ledger accumulates.")

    log("\n  --- TICKETS: DISTRICT ONLY, AND WHY ---")
    log(f"  shows with seat data   {inr(len(D)):>14}")
    log(f"  seats on sale          {inr(seats):>14}")
    log(f"  tickets sold           {inr(sold):>14}")
    log(f"  occupancy              {(sold/seats*100 if seats else 0):>13.1f}%")
    log(f"  gross observed         Rs {gross/1e7:>11.2f} Cr")
    log(f"  average ticket         Rs {(gross/sold if sold else 0):>11.0f}")
    log("  BookMyShow contributes ZERO tickets here, by design. It publishes")
    log("  four fullness words and no seat counts, so it cannot be converted")
    log("  into seats or rupees without inventing a capacity.")

    log("\n  --- SOLD OUT: TWO DEFINITIONS, BOTH REPORTED ---")
    log(f"  District, every seat gone        {inr(d_full):>10}"
        f"   of {inr(len(D))} shows")
    log(f"  BMS, every priced class gone     {inr(b_full):>10}"
        f"   of {inr(len(B))} shows")
    log(f"  BMS, at least one class gone     {inr(b_any):>10}"
        f"   of {inr(len(B))} shows")
    log("  The third line is the loosest and the biggest. A 40-seat recliner")
    log("  class going on a 900-seat screen trips it. The child script's own")
    log("  report uses that definition, so its sold-out figure runs high -")
    log("  quote the 'every priced class gone' line instead, and say which")
    log("  definition you used.")
    if b_any and b_full / max(b_any, 1) < 0.5:
        log(f"  Here the loose count is {b_any/max(b_full,1):.1f}x the strict one.")
        log("  That gap is big enough to change a headline. Be careful.")

    log("\n  --- SHOWS: DO NOT ADD THESE TOGETHER ---")
    log(f"  District shows   {inr(len(D)):>10}   venues {len({e['vid'] for e in D}):>6,}")
    log(f"  BMS shows        {inr(len(B)):>10}   venues {len({(e['city'],e['vid']) for e in B}):>6,}")
    log("  These overlap heavily on multiplexes and the two use different")
    log("  venue id systems, so there is no safe way to union them here.")
    log(f"  Published figure: {inr(shows)} shows, as a FLOOR, being the larger")
    log("  of the two. The GAP between them is the real finding for a Tamil")
    log("  release - BMS reaches the single screens District never lists.")
    if len(D) and len(B):
        log(f"  BMS is {len(B)/len(D):.2f}x District's show count on the same date.")

    def group(rows, field, title, limit=None, seatful=True):
        g = collections.defaultdict(lambda: [0, 0, 0, 0, set()])
        for e in rows:
            v = g[e.get(field) or "?"]
            v[0] += 1
            v[1] += e.get("sold", 0)
            v[2] += e.get("seatsTotal", 0)
            v[3] += e.get("soldOut", 0) or e.get("fullySoldOut", 0)
            v[4].add(e.get("vid"))
        log(f"\n  === BY {title} ===")
        if seatful:
            log(f"    {'':<20}{'ven':>5}{'shows':>8}{'sold':>12}{'occ':>7}{'s/out':>7}")
        else:
            log(f"    {'':<20}{'ven':>5}{'shows':>8}{'sold out':>10}")
        items = sorted(g.items(), key=lambda x: -x[1][1] if seatful else -x[1][0])
        for k, v in (items[:limit] if limit else items):
            if seatful:
                log(f"    {str(k)[:18]:<20}{len(v[4]):>5}{v[0]:>8,}"
                    f"{inr(v[1]):>12}{(v[1]/v[2]*100 if v[2] else 0):>6.1f}%{v[3]:>7,}")
            else:
                log(f"    {str(k)[:18]:<20}{len(v[4]):>5}{v[0]:>8,}{v[3]:>10,}")

    if D:
        group(D, "lang",  "LANGUAGE · District, with seats")
        group(D, "state", "STATE · District, with seats", 10)
        group(D, "chain", "CHAIN · District, with seats", 10)
    if B:
        group(B, "lang",  "LANGUAGE · BMS, footprint only", None, False)
        group(B, "state", "STATE · BMS, footprint only", 10, False)

    # dayparts off District, where we have seats
    log("\n  === BY TIME OF DAY (IST) · District ===")
    def ist_h(e):
        t = e.get("showTime") or ""
        try: hh, mm = int(t[11:13]), int(t[14:16])
        except (ValueError, IndexError): return None
        return ((hh * 60 + mm) + 330) // 60 % 24
    for lab, a, b in (("before 7am",0,7),("7-10am",7,10),("10am-1pm",10,13),
                      ("1-4pm",13,16),("4-7pm",16,19),("7-10pm",19,22),
                      ("10pm+",22,24)):
        g = [e for e in D if ist_h(e) is not None and a <= ist_h(e) < b]
        if not g: continue
        t = sum(e["seatsTotal"] for e in g); s = sum(e["sold"] for e in g)
        so = sum(e["soldOut"] for e in g)
        log(f"    {lab:<12}{len(g):>6} shows {inr(t):>12} seats "
            f"{inr(s):>12} sold {(s/t*100 if t else 0):>5.1f}%  {so:>5} s/out")
    log("    The before-7am block is the Tamil opening-day signature, and it")
    log("    is the one most likely to be missing from a late pass - those")
    log("    shows finish first and leave the feed first.")

    log("\n  WHAT THIS IS AND IS NOT")
    log("    It is a measured floor for District's footprint plus BMS's.")
    log("    It is NOT the India day-one number. Counter sales at the cinema,")
    log("    chain apps and every platform neither source lists are outside")
    log("    it entirely, and on a Tamil release that is a large share.")
    log("    Publish it as 'tickets sold across District and BookMyShow',")
    log("    never as 'Jailer 2 day one'.")

def one_pass():
    stamp = datetime.datetime.now().strftime("%H:%M")
    log(f"\n### PASS {stamp} · {FILM} · {DATE}"
        + ("  [--core]" if CORE else "  [full scale]"))
    if not NO_RUN:
        if ONLY in ("", "district"):
            run_child("jailer2_district_sweep.py", DATE, "District")
        if ONLY in ("", "bms"):
            run_child("jailer2_bms_sweep.py", DATE8, "BookMyShow")
    else:
        log("  --no-run: re-aggregating the CSVs already on disk.")
    ledger, passes = load_ledger()
    before = len(ledger)
    a, r = merge_district(ledger, stamp)
    b = merge_bms(ledger, stamp)
    passes.append(stamp)
    save_ledger(ledger, passes)
    log(f"  ledger {before:,} -> {len(ledger):,} shows "
        f"(+{a:,} District, +{b:,} BMS, {r:,} sold figures raised)")
    report(ledger, passes)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(LOG))

def main():
    log(f"{FILM} · DAY ONE · show date {DATE}")
    log("District gives tickets. BMS gives footprint. Neither is the market.")
    log("GET only; nothing booked, held or posted.")
    if LOOP:
        log(f"--loop {LOOP}: a pass every {LOOP} min. Ctrl-C to stop; the")
        log("ledger is saved after every pass, so stopping loses nothing.")
    while True:
        one_pass()
        if not LOOP: break
        log(f"\n  sleeping {LOOP} min ...")
        try: time.sleep(LOOP * 60)
        except KeyboardInterrupt:
            log("\n  stopped. Ledger is on disk."); break

if __name__ == "__main__":
    main()
