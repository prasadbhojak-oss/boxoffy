#!/usr/bin/env python3
"""BOXOFFY LEDGER - automatic capture from everything the site already shows.  15 Nov 2026

Runs every hour from the autopilot (run-ledger.cmd). Each source below is read and
turned into ledger rows; ledger.add_rows() skips anything already recorded, so a
figure lands once, and every CHANGE to a chart lands as a new row (that is the history).

    python ledger_import.py all            every source below
    python ledger_import.py sheet board us ramayana king archive inbox

  archive   src\\data\\films.json            1990-2026 archive: opening day/weekend/week 1, lifetime, WW, overseas
  sheet     India chart Google Sheet (public CSV)   every film's India nett + WW to the sheet's "to <date>"
  board     src\\App.jsx INDIA_BOARD         homepage India board: 7 days of daily nett per film, totals
  us        src\\data\\us-bo-weekly.json     North America weekend charts: rank, weekend, total, theatres
  ramayana  public\\ramayana.html LIVE       per-country day-by-day and totals
  king      public\\king-live.json           presales listings / tickets by country
  inbox     intel\\ledger-inbox\\*.jsonl      rows dropped by scheduled tasks (moved to done\\ or bad\\)
Read-only GETs only (the sheet CSV). Stdlib only.
"""
import csv, io, json, os, re, sys, glob, shutil, datetime, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ledger as L

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
SHEET = "https://docs.google.com/spreadsheets/d/1j7TrH2hVR9WjiMX2eExM4vgyjcedm2BJ9sF2D38_3Bk/gviz/tq?tqx=out:csv&sheet=Films"
MON = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
ALIAS = {"ramayana-part-1": "ramayana", "ramayana-rise-of-a-legend": "ramayana", "ramayana-part-one": "ramayana",
         "aadarsha-kutumbam-house-no-47-ak-47": "aadarsha-kutumbam-house-no-47",
         "drishyam3-m": "drishyam-3-malayalam", "drishyam-the-conclusion": "drishyam-3-the-conclusion",
         "prahaar": "prahaar-the-ujjwal-nikam-story"}


def fk(title):
    s = L.slug(title)
    return ALIAS.get(s, s)


def num(x):
    if x is None: return None
    if isinstance(x, (int, float)): return float(x)
    m = re.search(r"-?[\d,]*\.?\d+", str(x).replace("−", "-"))
    if not m: return None
    v = float(m.group(0).replace(",", ""))
    t = str(x)[m.end():m.end() + 3].strip().upper()
    if t.startswith("M"): v *= 1e6
    elif t.startswith("K"): v *= 1e3
    elif t.startswith("B"): v *= 1e9
    return v


def d_iso(y, mon, day):
    try: return datetime.date(int(y), MON[mon[:3].lower()], int(day)).isoformat()
    except (KeyError, ValueError): return ""


def rel(s):
    s = (s or "").strip()
    if re.match(r"\d{4}-\d{2}-\d{2}$", s): return s
    m = re.match(r"(\w{3})\w* (\d{1,2}),? (\d{4})", s)
    return d_iso(m.group(3), m.group(1), m.group(2)) if m else ""


# ---------------------------------------------------------------- archive
def archive():
    d = json.load(open(P("src", "data", "films.json"), encoding="utf-8"))
    seen = {}
    for y, fl in d.items():
        for f in fl: seen.setdefault(fk(f["title"]), set()).add(y)
    rows = []
    for y, fl in d.items():
        for f in fl:
            k = fk(f["title"]); k = k if len(seen[k]) == 1 else "%s-%s" % (k, y)
            r0 = rel(f.get("releaseDate")); done = f.get("status") in ("OTT", "Ended")
            base = dict(film=k, title=f["title"], language=f.get("language", ""), release_india=r0, market="India",
                        source="Boxoffy archive (films.json)", source_type="archive", start=r0)
            def put(**kw):
                if kw.get("value") not in (None, 0, 0.0): rows.append({**base, **kw})
            put(scope="day", day_no=1, date=r0, metric="nett", unit="INR_cr", value=num(f.get("openingDay")), start="", note="opening day") if r0 else None
            put(scope="weekend", metric="nett", unit="INR_cr", value=num(f.get("openingWeekend")), note="opening weekend")
            put(scope="week", metric="nett", unit="INR_cr", value=num(f.get("week1")), note="first week")
            put(scope="lifetime" if done else "to_date", metric="nett", unit="INR_cr", value=num(f.get("totalNum")),
                status="final" if done else "estimate")
            put(scope="lifetime" if done else "to_date", market="Worldwide", metric="gross", unit="INR_cr", value=num(f.get("wwGross")),
                status="final" if done else "estimate")
            put(scope="lifetime" if done else "to_date", market="Overseas", metric="gross", unit="INR_cr", value=num(f.get("overseas")),
                status="final" if done else "estimate")
    return rows


# ---------------------------------------------------------------- sheet
def sheet(text=None):
    if text is None:
        req = urllib.request.Request(SHEET + "&cb=%d" % datetime.datetime.now().timestamp(),
                                     headers={"User-Agent": "Boxoffy-Ledger/1.0"})
        text = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    rows = []
    for f in csv.DictReader(io.StringIO(text)):
        t = (f.get("title") or "").strip()
        if not t or "DUPLICATE" in t: continue
        note = f.get("weeklyNote") or ""
        m = re.search(r"\b[Tt]o (\d{1,2}) (\w{3})|\b[Tt]o (\w{3}) (\d{1,2})", note)
        y = f.get("year") or "2026"
        dt = (d_iso(y, m.group(2), m.group(1)) if m.group(1) else d_iso(y, m.group(3), m.group(4))) if m else ""
        st = "estimate" if (f.get("estimated") or "").upper() == "TRUE" else "final"
        done = (f.get("status") or "") in ("OTT", "Ended")
        base = dict(film=fk(t), title=t, language=f.get("language", ""), release_india=rel(f.get("releaseDate")),
                    source="Boxoffy India chart sheet", source_type="industry", status=st, date=dt,
                    scope="lifetime" if done else "to_date", start=rel(f.get("releaseDate")),
                    note=("as of " + note[:60]) if note and not dt else "")
        for market, metric, col in (("India", "nett", "totalNum"), ("Worldwide", "gross", "ww")):
            v = num(f.get(col))
            if v: rows.append({**base, "market": market, "metric": metric, "unit": "INR_cr", "value": v})
    return rows


# ---------------------------------------------------------------- board
def board():
    s = open(P("src", "App.jsx"), encoding="utf-8").read()
    i = s.index("const INDIA_BOARD = {"); j = s.index("\n};", i)
    blk = s[i:j]
    m = re.search(r'date:\s*"(\w{3}) (\d{1,2}) (\w{3}) (\d{4})"', blk)
    end = datetime.date.fromisoformat(d_iso(m.group(4), m.group(3), m.group(2)))
    data = json.loads(re.search(r"rows:\s*(\[.*\])", blk, re.S).group(1))
    rows = []
    for r in data:
        base = dict(film=fk(r["title"]), title=r["title"], market="India", source="Boxoffy India board (industry figure)",
                    source_type="industry", status="estimate" if r.get("est") else "final")
        tr = r.get("trend") or []
        for i2, v in enumerate(tr):
            dn = r["day"] - (len(tr) - 1 - i2)
            if dn < 1 or v in (None, 0): continue
            rows.append({**base, "scope": "day", "metric": "nett", "unit": "INR_cr", "value": v, "day_no": dn,
                         "date": (end - datetime.timedelta(len(tr) - 1 - i2)).isoformat()})
        if r.get("total"):
            rows.append({**base, "scope": "to_date", "metric": "nett", "unit": "INR_cr", "value": r["total"], "date": end.isoformat()})
        if r.get("ww"):
            rows.append({**base, "market": "Worldwide", "scope": "to_date", "metric": "gross", "unit": "INR_cr",
                         "value": num(r["ww"]), "date": end.isoformat(), "usd": num(r.get("wwUsd"))})
    return rows


# ---------------------------------------------------------------- us
def us():
    u = json.load(open(P("src", "data", "us-bo-weekly.json"), encoding="utf-8"))
    rows = []
    for wk, w in u.items():
        m = re.search(r"(\w{3}) (\d{1,2})\s*[–-]\s*(?:(\w{3}) )?(\d{1,2}), (\d{4})", w.get("dateRange", ""))
        if not m: continue
        start = d_iso(m.group(5), m.group(1), m.group(2)); end = d_iso(m.group(5), m.group(3) or m.group(1), m.group(4))
        if end < start:  # Dec-Jan wrap not expected; guard
            continue
        studio_est = "estimate" in w.get("dateRange", "").lower()
        src = (w.get("source") or "").split("·")[0].strip()[:60] or "weekend chart"
        for c in w.get("chart", []):
            base = dict(film=fk(c["title"]), title=c["title"], market="North America", source=src,
                        source_type="studio" if studio_est else "official", date=end, start=start, note=wk)
            est = lambda x: "estimate" if (studio_est or "est" in str(x).lower()) else "final"
            v = num(c.get("weekend"))
            if v: rows.append({**base, "scope": "weekend", "metric": "gross", "unit": "USD", "value": v, "status": est(c.get("weekend"))})
            v = num(c.get("total"))
            if v: rows.append({**base, "scope": "to_date", "metric": "gross", "unit": "USD", "value": v, "status": est(c.get("total")), "start": ""})
            if c.get("theaters"):
                rows.append({**base, "scope": "weekend", "metric": "theaters", "unit": "count", "value": c["theaters"], "status": est("")})
            if c.get("rank"):
                rows.append({**base, "scope": "weekend", "metric": "rank", "unit": "rank", "value": c["rank"], "status": est("")})
    return rows


# ---------------------------------------------------------------- ramayana tracker
def js_object(s, marker):
    i = s.index(marker) + len(marker) - 1
    d, k, q, esc = 0, i, None, False
    while True:
        c = s[k]
        if q:
            if esc: esc = False
            elif c == "\\": esc = True
            elif c == q: q = None
        elif c in "\"'`": q = c
        elif c == "{": d += 1
        elif c == "}":
            d -= 1
            if d == 0: return s[i:k + 1]
        k += 1


def js_to_json(o):
    """the LIVE block is plain data written JSON-style except unquoted keys / single quotes."""
    o = re.sub(r"//[^\n]*", "", o)
    out, q, i = [], None, 0
    while i < len(o):
        c = o[i]
        if q:
            if c == "\\": out.append(o[i:i + 2]); i += 2; continue
            if c == q: out.append('"'); q = None
            elif c == '"' and q == "'": out.append('\\"')
            else: out.append(c)
        elif c in "'\"": q = c; out.append('"')
        else: out.append(c)
        i += 1
    j = "".join(out)
    j = re.sub(r"([{,]\s*)([A-Za-z_$][\w$]*)\s*:", r'\1"\2":', j)
    j = re.sub(r",\s*([}\]])", r"\1", j)
    return json.loads(j)


RAM_D1 = datetime.date(2026, 11, 5)
WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def ramayana():
    s = open(P("public", "ramayana.html"), encoding="utf-8").read()
    live = js_to_json(js_object(s, "const LIVE = {"))
    rows = []
    for c in live.get("countries", []):
        name = {"The UK": "the UK"}.get(c["c"], c["c"])
        sub = c.get("sub", "")
        m = re.search(r"to (\w{3}) (\d{1,2}) (\w{3})", sub)
        asof = d_iso(2026, m.group(3), m.group(2)) if m else ""
        stype = "studio" if re.search(r"Sony|studio", sub) else "ours" if c.get("src") == "c" else "industry"
        sst = "estimate" if re.search(r"estimate|est\.", sub) else "final"
        base = dict(film="ramayana", title="Ramayana: Part 1", release_india="2026-11-05", release_na="2026-11-04",
                    market=name, source="Ramayana tracker · " + sub[:70], source_type=stype)
        if name == "India":
            rows.append({**base, "scope": "to_date", "metric": "nett", "unit": "INR_cr", "value": num(c["show"]), "date": asof,
                         "start": "2026-11-05", "status": "estimate" if "estimate" in c.get("sm", "") else "final"})
            g = re.search(r"₹([\d,.]+) Cr gross", sub)
            if g: rows.append({**base, "scope": "to_date", "metric": "gross", "unit": "INR_cr", "value": num(g.group(1)),
                               "usd": c["v"] * 1e6, "date": asof, "start": "2026-11-05", "status": "estimate"})
        elif c.get("v") and name != "Rest of the world":
            rows.append({**base, "scope": "to_date", "metric": "gross", "unit": "USD", "value": c["v"] * 1e6, "date": asof,
                         "start": "2026-11-04" if name == "North America" else "2026-11-05", "status": sst})
        unit = c.get("unit"); days = c.get("days") or []
        if not days or not unit: continue
        cur = (RAM_D1 - datetime.timedelta(1)) if days[0]["d"] == "Wed" else RAM_D1
        first = True
        for dd in days:
            lab, wd = dd.get("l", ""), dd.get("d", "")
            if not first:
                if wd[:3] in WD and len(wd) == 3:
                    while WD[cur.weekday()] != wd: cur += datetime.timedelta(1)
                else:
                    cur += datetime.timedelta(1)
            first = False
            if dd.get("k") == "live" and not re.search(r"so far|early est", lab): continue  # advance / booked: not a day figure
            st = "partial" if "so far" in lab else "estimate" if (dd.get("k") in ("est", "live") or re.search(r"\best\b|estimate", lab)) else "final"
            ty = "studio" if "Sony" in lab else ("ours" if unit == "n" else stype if stype != "studio" else "industry")
            src = base["source"]
            if unit == "n": src = "Boxoffy seat count · " + c.get("daysTitle", "")[:50]
            elif name == "North America" and ty != "studio": ty, src = "official", "The Numbers actuals (tracker chart, rounded)"
            if unit == "inr": metric, u, v = "nett", "INR_cr", dd["v"]
            elif unit == "usd": metric, u, v = "gross", "USD", dd["v"] * 1e6
            elif unit == "k": metric, u, v = "gross", ("EUR" if "€" in c.get("daysTitle", "") else "USD"), dd["v"] * 1e3
            elif unit == "n": metric, u, v = "tickets", "tickets", dd["v"]
            else: continue
            multi = re.search(r"\+|–|-", wd)
            dn = (cur - RAM_D1).days + 1
            row = {**base, "metric": metric, "unit": u, "value": v, "status": st, "source_type": ty, "source": src,
                   "note": "%s %s" % (wd, lab)}
            if multi:
                n = 3 if "Thu–Sat" in wd else 2
                end = cur + datetime.timedelta(n - 1)
                row.update(scope="period", start=cur.isoformat(), date=end.isoformat()); cur = end
            else:
                row.update(scope="day", date=cur.isoformat(), day_no=max(dn, 0), start="")
            rows.append(row)
    return rows


# ---------------------------------------------------------------- king
def king():
    j = json.load(open(P("public", "king-live.json"), encoding="utf-8"))
    day = j["asOf"][:10]
    rows = []
    for c in j["countries"]:
        base = dict(film="king", title="King", release_india=j.get("release", ""), market={"UK": "the UK"}.get(c["name"], c["name"]),
                    date=day, source="Boxoffy listing sweep", source_type="ours")
        cins = [k for x in c.get("cities", []) for k in x.get("cin", [])]
        sell = sum(1 for k in cins if (k.get("st") or "selling") == "selling")
        lst = sum(1 for k in cins if k.get("st") == "listed") + len(c.get("listings", []))
        if sell: rows.append({**base, "scope": "listing", "metric": "cinemas", "unit": "count", "value": sell, "note": "booking open"})
        if lst: rows.append({**base, "scope": "listing", "metric": "cinemas", "unit": "count", "value": lst, "note": "listed, not open"})
        if c.get("tickets"):
            rows.append({**base, "scope": "presale", "metric": "tickets", "unit": "tickets", "value": c["tickets"], "status": "partial"})
    return rows


# ---------------------------------------------------------------- inbox
def inbox():
    box = P("intel", "ledger-inbox")
    os.makedirs(os.path.join(box, "done"), exist_ok=True); os.makedirs(os.path.join(box, "bad"), exist_ok=True)
    total = 0
    for f in sorted(glob.glob(os.path.join(box, "*.jsonl"))):
        name = os.path.splitext(os.path.basename(f))[0]
        try:
            rows = [json.loads(l) for l in open(f, encoding="utf-8-sig") if l.strip()]
            new, bad = L.add_rows(rows, by="inbox:" + name)
        except ValueError as e:
            print("  inbox %s: unreadable (%s) -> bad\\" % (name, e)); shutil.move(f, os.path.join(box, "bad")); continue
        total += len(new)
        print("  inbox %s: %d new, %d rejected" % (name, len(new), len(bad)))
        for i, why in bad[:10]: print("    line %d: %s" % (i + 1, why))
        shutil.move(f, os.path.join(box, "bad" if bad and not new else "done"))
    return total


SOURCES = {"archive": archive, "sheet": sheet, "board": board, "us": us, "ramayana": ramayana, "king": king}


def main(a):
    want = list(SOURCES) + ["inbox"] if not a or a == ["all"] else a
    print("LEDGER_IMPORT %s" % datetime.datetime.now().strftime("%Y-%m-%d %H:%M"))
    for w in want:
        if w == "inbox":
            print("inbox: %d new rows" % inbox()); continue
        try:
            rows = SOURCES[w]()
            new, bad = L.add_rows(rows, by="import:" + w)
            print("%-9s %5d read · %4d new · %d rejected" % (w, len(rows), len(new), len(bad)))
            for i, why in bad[:5]: print("    rejected %d: %s" % (i, why))
        except Exception as e:  # one broken source must not stop the others
            print("%-9s FAILED: %s" % (w, str(e)[:160]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
