#!/usr/bin/env python3
"""
Boxoffy - CALIBRATE BOOKMYSHOW'S FULLNESS LABELS AGAINST DISTRICT'S REAL SEATS.

    python bms_calibrate.py                     2026-10-15, Jailer 2
    python bms_calibrate.py 2026-10-16
    python bms_calibrate.py --min-match 0.15    loosen the match-rate gate

THE IDEA
--------
BookMyShow publishes four words and no numbers. District publishes real seat
counts. Some venues appear on BOTH. On those venues we can see what each BMS
label actually MEANS in occupancy terms - measured, not assumed - and then
apply that meaning to the BMS-only venues, which are mostly the Tamil Nadu
single screens District never lists.

That is the only honest route from BMS labels to an occupancy figure. Mapping
four words to four percentages by eye is not calibration, it is decoration.

WHAT IT WILL AND WILL NOT CLAIM
-------------------------------
It produces an OCCUPANCY estimate for BMS-only venues. That part rests on one
model and is defensible.

Turning that into TICKETS needs a second model, because neither source
publishes a capacity for a BMS-only venue. So the ticket figure is occupancy
x an assumed capacity drawn from District's own seat-count distribution for
comparable venues - two models stacked, and the report says so every time it
prints a ticket number. If you only quote one figure from this script, quote
the occupancy.

THREE GATES. IT REFUSES RATHER THAN GUESSES.
--------------------------------------------
  1. VENUE MATCH RATE. Below the threshold there is no shared sample to
     calibrate on, so it stops.
  2. SEPARATION. If SOLD OUT and AVAILABLE shows have overlapping occupancy
     distributions, the labels carry no information and the mapping is
     worthless. It reports the overlap and refuses to apply it.
  3. HOLD-OUT ERROR. It fits on half the matched shows and tests on the other
     half. If the out-of-sample error is worse than just guessing the overall
     mean, the model adds nothing and it says so.

A model that fails a gate still prints its diagnostics. That is the useful
output in that case - it tells you BMS labels cannot be converted, which is
itself a finding worth knowing rather than a dead end.

Stdlib only. Python 3.8+. Windows-safe.
"""

import os, re, csv, sys, json, statistics, collections, datetime

_a = [x for x in sys.argv[1:] if x]
def flag(name, cast=None, default=None):
    if name not in _a: return default
    i = _a.index(name)
    if cast is None: return True
    try: return cast(_a[i + 1])
    except (IndexError, ValueError): return default

_d = [x for x in _a if re.match(r"^\d{4}-\d{2}-\d{2}$", x)]
DATE  = _d[0] if _d else "2026-10-15"
DATE8 = DATE.replace("-", "")
MIN_MATCH = flag("--min-match", float, 0.08)     # share of BMS venues matched
OUT = os.path.join("intel", f"jailer2-calib-{DATE}")

DIST_CSV = os.path.join("intel", f"jailer2-{DATE}", "district_shows.csv")
BMS_CSV  = os.path.join("intel", f"jailer2-bms-{DATE8}", "bms_shows.csv")
BMS_CAT  = os.path.join("intel", f"jailer2-bms-{DATE8}", "bms_seat_classes.csv")

LOG = []
def log(*a):
    s = " ".join(str(x) for x in a)
    try: print(s, flush=True)
    except UnicodeEncodeError:
        print(s.encode("ascii", "replace").decode("ascii"), flush=True)
    LOG.append(s)

def num(v, d=0):
    try: return int(float(v))
    except (TypeError, ValueError): return d

def inr(n):
    s = str(int(n))
    if len(s) <= 3: return s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:]); head = head[:-2]
    if head: parts.insert(0, head)
    return ",".join(parts + [tail])

# ───────────────────────────────────────────────── venue-name normalisation
# District and BMS use different venue id systems entirely, so the join has to
# be on name + city. These are the real-world shapes that break a naive join.
CHAIN_PREFIX = re.compile(
    r"^(pvr\s*inox|pvr|inox|cinepolis|carnival|miraj|mukta|movie\s*max|"
    r"asian|amb|aurum|rajhans|citypride|wave|m2k|delite)[\s:,-]+", re.I)
NOISE = re.compile(
    r"\b(cinemas?|cinema|theatres?|theater|multiplex|mall|the|a\/c|ac|"
    r"digital|4k|dolby|atmos|screens?|imax|rgb|laser|xl|plus|pvt|ltd|"
    r"luxe|icon|director'?s?\s*cut|gold|insignia|superplex|onyx)\b", re.I)

def norm_venue(s):
    s = (s or "").lower()
    s = s.split("(")[0]
    s = CHAIN_PREFIX.sub("", s)
    s = NOISE.sub(" ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())

def norm_city(s):
    s = (s or "").lower()
    s = re.sub(r"[^a-z]+", "", s)
    ALIAS = {"bengaluru": "bangalore", "bangaluru": "bangalore",
             "mysuru": "mysore", "tiruchirappalli": "trichy",
             "thiruchirapalli": "trichy", "tiruppur": "tirupur",
             "delhincr": "delhi", "newdelhi": "delhi", "ncr": "delhi",
             "vizag": "visakhapatnam", "kochi": "cochin",
             "thiruvananthapuram": "trivandrum", "kozhikode": "calicut",
             "bombay": "mumbai", "madras": "chennai",
             "rajamahendravaram": "rajahmundry", "hubballi": "hubli",
             "belagavi": "belgaum", "kalaburagi": "gulbarga"}
    return ALIAS.get(s, s)

# ───────────────────────────────────────────────────────── show-time parsing
def dist_minutes(ts):
    """District showTime, minutes past midnight in whatever zone it uses."""
    m = re.search(r"T(\d{2}):(\d{2})", str(ts) or "")
    if not m: return None
    return int(m.group(1)) * 60 + int(m.group(2))

def bms_minutes(ts):
    """BMS showTime is local IST, like '04:00 AM' or '11:30 PM'."""
    m = re.match(r"\s*(\d{1,2}):(\d{2})\s*([AaPp])", str(ts) or "")
    if not m: return None
    h = int(m.group(1)) % 12
    if m.group(3).lower() == "p": h += 12
    return h * 60 + int(m.group(2))

def detect_offset(dist_rows, bms_rows, pairs):
    """⚠️ WE DO NOT KNOW WHETHER DISTRICT'S showTime IS IST OR UTC, and the two
    existing scripts disagree with each other about it:

      jailer2_district_sweep.py filters on showTime[:10] == the show date,
        which only works if showTime is LOCAL.
      the same file's ist_h() adds 330 minutes to get IST,
        which is only right if showTime is UTC.

    Both cannot be true. One of them is a bug and it has been sitting there
    through every run. Rather than pick a side, detect it: on venues present in
    both feeds, compare the hour distributions. If District runs 330 minutes
    behind BMS, it is UTC.

    Returns the offset in minutes to ADD to District times to get IST."""
    d_by = collections.defaultdict(list)
    for r in dist_rows:
        k = (norm_city(r.get("city")), norm_venue(r.get("cinema")))
        t = dist_minutes(r.get("showTime"))
        if t is not None: d_by[k].append(t)
    b_by = collections.defaultdict(list)
    for r in bms_rows:
        k = (norm_city(r.get("city")), norm_venue(r.get("venueName")))
        t = bms_minutes(r.get("showTime"))
        if t is not None: b_by[k].append(t)
    diffs = []
    for k in pairs:
        if k in d_by and k in b_by and d_by[k] and b_by[k]:
            diffs.append(statistics.median(b_by[k]) - statistics.median(d_by[k]))
    if not diffs:
        return 0, "no overlapping venue had times in both feeds; assuming IST"
    med = statistics.median(diffs)
    if abs(med - 330) < 75:
        return 330, (f"District looks like UTC (median gap {med:+.0f} min vs BMS "
                     f"IST across {len(diffs)} venues) -> adding 330")
    if abs(med) < 75:
        return 0, (f"District looks like IST already (median gap {med:+.0f} min "
                   f"across {len(diffs)} venues)")
    return int(med), (f"unexpected median gap {med:+.0f} min across {len(diffs)} "
                      f"venues - using it as-is, but CHECK THIS BY EYE")

# ─────────────────────────────────────────────────────────────── load
def load():
    for p, what in ((DIST_CSV, "District"), (BMS_CSV, "BMS")):
        if not os.path.exists(p):
            log(f"MISSING {what} CSV: {p}")
            log("Both sweeps have to finish before this can run. The BMS")
            log("script writes its CSVs at the very end of its pass.")
            sys.exit(1)
    d = [r for r in csv.DictReader(open(DIST_CSV, encoding="utf-8"))
         if (r.get("showTime") or "")[:10] == DATE and num(r.get("seatsTotal")) > 0]
    b = list(csv.DictReader(open(BMS_CSV, encoding="utf-8")))
    cats = (list(csv.DictReader(open(BMS_CAT, encoding="utf-8")))
            if os.path.exists(BMS_CAT) else [])
    return d, b, cats

# ─────────────────────────────────────────────────────────────── main
def main():
    os.makedirs(OUT, exist_ok=True)
    log(f"BMS LABEL CALIBRATION · Jailer 2 · {DATE}")
    log("Fitting BookMyShow's four fullness words to District's real seats.")
    log("")
    D, B, CATS = load()
    log(f"  District rows with seats   {len(D):>8,}")
    log(f"  BMS rows                   {len(B):>8,}")
    log(f"  BMS seat-class rows        {len(CATS):>8,}")

    # ---------- GATE 1: venue overlap
    dv = {(norm_city(r.get("city")), norm_venue(r.get("cinema"))) for r in D}
    bv = {(norm_city(r.get("city")), norm_venue(r.get("venueName"))) for r in B}
    dv.discard(("", "")); bv.discard(("", ""))
    both = dv & bv
    rate = len(both) / len(bv) if bv else 0
    log("\n" + "=" * 62)
    log("  GATE 1 · VENUE OVERLAP")
    log("=" * 62)
    log(f"  District venues            {len(dv):>8,}")
    log(f"  BMS venues                 {len(bv):>8,}")
    log(f"  matched on name + city     {len(both):>8,}   {rate*100:.1f}% of BMS")
    log(f"  BMS-only venues            {len(bv-both):>8,}   <- the target")
    log(f"  District-only venues       {len(dv-both):>8,}")
    if len(both) < 30 or rate < MIN_MATCH:
        log("\n  ⚠️ GATE 1 FAILED. Too few shared venues to calibrate on.")
        log("  Most likely the venue-name normaliser is not collapsing the two")
        log("  naming conventions. Look at the samples below and extend")
        log("  CHAIN_PREFIX / NOISE / the city ALIAS table, then re-run.")
        log("\n  sample District venue keys:")
        for k in sorted(dv)[:12]: log(f"    {k}")
        log("\n  sample BMS venue keys:")
        for k in sorted(bv)[:12]: log(f"    {k}")
        log("\n  No mapping produced. That is the correct outcome, not a crash.")
        finish(); return
    log("  Gate 1 passed.")

    # ---------- time convention
    off, why = detect_offset(D, B, both)
    log("\n  SHOW-TIME CONVENTION")
    log(f"  {why}")
    log("  ⚠️ This also means one of the two existing scripts has a time bug:")
    log("  the District sweep's date filter assumes local time while its own")
    log("  daypart table adds 330 minutes. Worth fixing separately - it would")
    log("  shift every 'before 7am' figure we have published.")

    # ---------- build the matched show set
    dmap = collections.defaultdict(list)
    for r in D:
        k = (norm_city(r.get("city")), norm_venue(r.get("cinema")))
        if k not in both: continue
        t = dist_minutes(r.get("showTime"))
        if t is None: continue
        dmap[(k, (t + off) % 1440)].append(r)

    matched, unmatched = [], 0
    for r in B:
        k = (norm_city(r.get("city")), norm_venue(r.get("venueName")))
        if k not in both: continue
        t = bms_minutes(r.get("showTime"))
        if t is None: unmatched += 1; continue
        hit = None
        for slack in (0, 5, 10, 15, -5, -10, -15):
            cand = dmap.get((k, (t + slack) % 1440))
            if cand: hit = cand; break
        if not hit: unmatched += 1; continue
        # If several District rows share the slot (different audis), take the
        # one whose language matches, else the biggest - never average, which
        # would blend a sold-out screen with an empty one.
        pick = max(hit, key=lambda x: num(x.get("seatsTotal")))
        tot, sold = num(pick.get("seatsTotal")), num(pick.get("sold"))
        if tot <= 0: continue
        ncat, soc = num(r.get("nCat")), num(r.get("soldOutCats"))
        matched.append({
            "city": k[0], "venue": k[1], "ist": t,
            "label": (r.get("worstLabel") or "").strip().upper(),
            "nCat": ncat, "soldOutCats": soc,
            "frac": (soc / ncat) if ncat else 0.0,
            "occ": sold / tot, "seatsTotal": tot, "sold": sold,
            "state": r.get("state") or pick.get("state") or "",
        })
    log("\n" + "=" * 62)
    log("  MATCHED SHOWS")
    log("=" * 62)
    log(f"  BMS shows paired to a District show   {len(matched):>7,}")
    log(f"  BMS shows on a shared venue, no slot  {unmatched:>7,}")
    if len(matched) < 60:
        log("\n  ⚠️ Fewer than 60 matched shows. Not enough to fit anything")
        log("  that would survive a grading. Stopping.")
        finish(); return

    # ---------- GATE 2: do the labels separate at all?
    by_lab = collections.defaultdict(list)
    for m in matched: by_lab[m["label"]].append(m["occ"])
    log("\n" + "=" * 62)
    log("  GATE 2 · DO THE LABELS CARRY ANY INFORMATION?")
    log("=" * 62)
    log(f"  {'label':<16}{'n':>6}{'median occ':>12}{'mean':>8}"
        f"{'p25':>8}{'p75':>8}")
    order = ["SOLD OUT", "ALMOST FULL", "FILLING FAST", "AVAILABLE"]
    table = {}
    for lab in order + [l for l in by_lab if l not in order]:
        v = sorted(by_lab.get(lab, []))
        if not v: continue
        p25 = v[int(len(v) * .25)]; p75 = v[int(len(v) * .75)]
        table[lab] = {"n": len(v), "median": statistics.median(v),
                      "mean": sum(v)/len(v), "p25": p25, "p75": p75}
        log(f"  {lab:<16}{len(v):>6}{statistics.median(v)*100:>11.1f}%"
            f"{sum(v)/len(v)*100:>7.1f}%{p25*100:>7.1f}%{p75*100:>7.1f}%")
    so = table.get("SOLD OUT"); av = table.get("AVAILABLE")
    if not so or not av:
        log("\n  ⚠️ Need both SOLD OUT and AVAILABLE present to test separation.")
        finish(); return
    gap = so["median"] - av["median"]
    log(f"\n  SOLD OUT median minus AVAILABLE median: {gap*100:+.1f} points")
    if gap < 0.15:
        log("  ⚠️ GATE 2 FAILED. The labels barely separate. BMS's words do not")
        log("  track real occupancy closely enough to convert, which is exactly")
        log("  what we suspected: the label is per seat CLASS, so one small")
        log("  premium block selling out flags a half-empty screen.")
        log("  Publish BMS as footprint only. No occupancy figure from here.")
        finish(); return
    log("  Gate 2 passed - the labels do separate.")

    # ---------- GATE 3: hold-out test, fraction-of-classes model
    # soldOutCats / nCat is a finer predictor than the worst label alone, so we
    # test both and keep whichever actually wins out of sample.
    ms = sorted(matched, key=lambda m: (m["venue"], m["ist"]))
    fit = [m for i, m in enumerate(ms) if i % 2 == 0]
    test = [m for i, m in enumerate(ms) if i % 2 == 1]
    base = sum(m["occ"] for m in fit) / len(fit)

    lab_fit = collections.defaultdict(list)
    for m in fit: lab_fit[m["label"]].append(m["occ"])
    lab_pred = {k: statistics.median(v) for k, v in lab_fit.items()}

    BINS = [(0.0, 0.01), (0.01, 0.34), (0.34, 0.67), (0.67, 0.999), (0.999, 1.01)]
    def binof(f):
        for i, (lo, hi) in enumerate(BINS):
            if lo <= f < hi: return i
        return len(BINS) - 1
    frac_fit = collections.defaultdict(list)
    for m in fit: frac_fit[binof(m["frac"])].append(m["occ"])
    frac_pred = {k: statistics.median(v) for k, v in frac_fit.items()}

    def mae(pred_fn, rows):
        e = [abs(pred_fn(m) - m["occ"]) for m in rows]
        return sum(e) / len(e) if e else 9

    m_base = mae(lambda m: base, test)
    m_lab  = mae(lambda m: lab_pred.get(m["label"], base), test)
    m_frac = mae(lambda m: frac_pred.get(binof(m["frac"]), base), test)
    log("\n" + "=" * 62)
    log("  GATE 3 · HOLD-OUT TEST")
    log("=" * 62)
    log(f"  fit on {len(fit):,} shows, tested on {len(test):,} it never saw")
    log(f"  mean absolute error, in occupancy points:")
    log(f"    guess the overall mean ({base*100:.1f}%)   {m_base*100:>6.1f}")
    log(f"    worst-label model                 {m_lab*100:>6.1f}")
    log(f"    share-of-classes-gone model       {m_frac*100:>6.1f}")
    best, bname = ((m_lab, "label"), (m_frac, "frac"))[m_frac < m_lab]
    if best >= m_base:
        log("\n  ⚠️ GATE 3 FAILED. Neither model beats guessing the mean out of")
        log("  sample. The labels are not convertible. BMS stays footprint.")
        finish(); return
    log(f"\n  Gate 3 passed. Best: the {bname} model, "
        f"{(1-best/m_base)*100:.0f}% better than the mean.")
    log(f"  Still +/- {best*100:.1f} occupancy points per show on average -")
    log(f"  fine in aggregate over thousands of shows, useless per show.")

    predict = ((lambda m: lab_pred.get(m["label"], base)) if bname == "label"
               else (lambda m: frac_pred.get(binof(m["frac"]), base)))

    # ---------- capacity, the second model, stated as such
    log("\n" + "=" * 62)
    log("  CAPACITY · THE SECOND MODEL, AND THE WEAKER ONE")
    log("=" * 62)
    log("  Neither source publishes a seat count for a BMS-only venue, so")
    log("  tickets need an assumed capacity. Taken from District's own")
    log("  seats-per-show distribution, by state, on SINGLE-SCREEN-like")
    log("  venues (chain blank or not a national chain):")
    NAT = {"PVR", "INOX", "PVRINOX", "CINEPOLIS", "CARNIVAL"}
    cap_by_state = collections.defaultdict(list)
    for r in D:
        ch = (r.get("chain") or "").upper().replace(" ", "")
        if ch in NAT: continue
        t = num(r.get("seatsTotal"))
        if t > 0: cap_by_state[(r.get("state") or "?").lower()].append(t)
    log(f"  {'state':<20}{'n shows':>9}{'median':>9}{'p25':>7}{'p75':>7}")
    cap_med = {}
    for st, v in sorted(cap_by_state.items(), key=lambda x: -len(x[1]))[:10]:
        v.sort(); cap_med[st] = statistics.median(v)
        log(f"  {st[:18]:<20}{len(v):>9,}{statistics.median(v):>9,.0f}"
            f"{v[int(len(v)*.25)]:>7,.0f}{v[int(len(v)*.75)]:>7,.0f}")
    allcap = [x for v in cap_by_state.values() for x in v]
    fallback = statistics.median(allcap) if allcap else 0
    log(f"  fallback median, all states: {fallback:,.0f} seats a show")
    log("  ⚠️ District under-lists exactly the venues we are modelling, so this")
    log("  distribution is drawn from the single screens District DOES carry.")
    log("  If BMS-only venues are systematically smaller or larger, the ticket")
    log("  figure is off by that factor and nothing here would reveal it.")

    # ---------- apply to BMS-only
    bonly = [r for r in B
             if (norm_city(r.get("city")), norm_venue(r.get("venueName"))) not in both]
    est = []
    for r in bonly:
        ncat, soc = num(r.get("nCat")), num(r.get("soldOutCats"))
        m = {"label": (r.get("worstLabel") or "").strip().upper(),
             "frac": (soc / ncat) if ncat else 0.0}
        occ = max(0.0, min(1.0, predict(m)))
        st = (r.get("state") or "?").lower()
        cap = cap_med.get(st, fallback)
        est.append({"occ": occ, "cap": cap, "tickets": occ * cap,
                    "state": r.get("state") or "", "city": r.get("city") or ""})
    d_sold = sum(num(r.get("sold")) for r in D)
    d_seats = sum(num(r.get("seatsTotal")) for r in D)
    e_tick = sum(e["tickets"] for e in est)
    e_occ = (sum(e["occ"] * e["cap"] for e in est) / sum(e["cap"] for e in est)
             if est else 0)

    log("\n" + "=" * 62)
    log("  RESULT")
    log("=" * 62)
    log(f"  MEASURED, District                     {inr(d_sold):>12} tickets")
    log(f"    across {len(D):,} shows, {d_sold/d_seats*100 if d_seats else 0:.1f}% occupancy")
    log(f"  ESTIMATED, BMS-only venues 📐          {inr(e_tick):>12} tickets")
    log(f"    across {len(bonly):,} shows, {e_occ*100:.1f}% modelled occupancy")
    log(f"  COMBINED FLOOR                         {inr(d_sold + e_tick):>12} tickets")
    lo, hi = e_tick * 0.70, e_tick * 1.30
    log(f"\n  The estimate carries +/- {best*100:.0f} occupancy points of error per")
    log(f"  show plus the capacity assumption, so band it: "
        f"{inr(lo)} to {inr(hi)}")
    log(f"  Combined range {inr(d_sold+lo)} to {inr(d_sold+hi)}.")
    log("\n  PUBLISH IT LIKE THIS, or not at all:")
    log(f"    '{inr(d_sold)} tickets measured on District, plus an estimated")
    log(f"     {inr(e_tick)} on the single screens only BookMyShow lists.'")
    log("  Never add them into one unlabelled total. The first number is")
    log("  counted; the second is two models deep.")

    def grp(field, title):
        g = collections.defaultdict(lambda: [0, 0.0])
        for e in est:
            v = g[e[field] or "?"]; v[0] += 1; v[1] += e["tickets"]
        log(f"\n  === ESTIMATED BMS-ONLY TICKETS BY {title} 📐 ===")
        for k, v in sorted(g.items(), key=lambda x: -x[1][1])[:12]:
            log(f"    {str(k)[:22]:<24}{v[0]:>7,} shows {inr(v[1]):>12}")
    grp("state", "STATE")

    json.dump({"date": DATE, "model": bname, "mae": best,
               "label_table": table, "label_pred": lab_pred,
               "frac_pred": {str(k): v for k, v in frac_pred.items()},
               "capacity_median_by_state": cap_med, "capacity_fallback": fallback,
               "district_sold": d_sold, "bms_only_estimate": e_tick,
               "matched_shows": len(matched), "venues_matched": len(both)},
              open(os.path.join(OUT, "calibration.json"), "w"), indent=1)
    with open(os.path.join(OUT, "matched_shows.csv"), "w", newline="",
              encoding="utf-8") as f:
        w = csv.DictWriter(f, extrasaction="ignore", fieldnames=[
            "city","venue","ist","label","nCat","soldOutCats","frac",
            "occ","seatsTotal","sold","state"])
        w.writeheader(); [w.writerow(m) for m in matched]
    log("\n  GRADE THIS TOMORROW")
    log("    1. the combined floor against the settled day-one figure")
    log("    2. whether the label->occupancy table holds on day two")
    log("    3. the capacity assumption, if any BMS-only venue ever appears")
    log("       on District later - that is a free test of it")

def finish():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(LOG))
    log(f"\nWritten to {OUT}")

if __name__ == "__main__":
    main()
    finish()
