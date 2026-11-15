#!/usr/bin/env python3
"""BOXOFFY LEDGER - our own permanent record of every box office number.  15 Nov 2026

One CSV, one row per film x market x day (or weekend / week / to-date / presale),
append-only. Every scheduled task writes here BEFORE it touches a page, and every
comparison ("Ramayana Day 10 vs <new film> Day 10") reads from here first.

    ledger\\boxoffy-ledger.csv        the ledger (git keeps every version)
    ledger\\films.csv                 film list: key, title, language, release dates

COMMANDS
  python ledger.py add rows.jsonl [--by "task name"]   append rows (JSON lines), skips exact repeats
  python ledger.py film ramayana                      everything we hold for one film
  python ledger.py day ramayana India 10              Day 10 in one market, best figure first
  python ledger.py compare ramayana jailer-2 India 1-10   day-by-day side by side
  python ledger.py best [--film ramayana]             one best row per film/market/scope/metric/date
  python ledger.py stats                              row counts
  python ledger.py check                              validate the whole file

ROW FIELDS (rows.jsonl - one JSON object per line)
  film       film key, lower-case slug: ramayana, jailer-2, king   (required)
  title      display title (only needed the first time a film appears)
  market     India | North America | United States | Canada | the UK | UAE | Germany |
             Worldwide | Overseas | ...                                      (required)
  date       YYYY-MM-DD the day the figure is FOR (end date for a weekend/week/period)
  start      YYYY-MM-DD first day, for weekend/week/period/to_date rows
  day_no     1 = release day (previews = 0), for scope "day"
  scope      day | weekend | week | period | to_date | lifetime | presale | listing   (required)
  metric     nett | gross | tickets | shows | cinemas | occupancy | rank | theaters  (required)
  value      number                                                         (required)
  unit       INR_cr | USD | EUR | GBP | AUD | NZD | AED | MYR | SGD | THB | tickets | count | pct | rank
  usd        US$ equivalent when the SOURCE gave it or the rate is ours and stated in note
  source     who published it: "Box Office India", "Comscore", "Sony", "The Numbers",
             "industry figure", "Boxoffy seat count", "Boxoffy chart sheet" ...
  source_type official | studio | industry | ours | archive                 (required)
  status     final | estimate | partial | live                              (default final)
  note       short, plain
NEVER edit or delete a row. A newer figure is a new row; "best" picks it.
"""
import csv, json, os, sys, datetime, re

HERE = os.path.dirname(os.path.abspath(__file__))
LEDGER = os.path.join(HERE, "boxoffy-ledger.csv")
FILMS = os.path.join(HERE, "films.csv")
COLS = ["film", "title", "market", "date", "start", "day_no", "scope", "metric", "value", "unit", "usd",
        "source", "source_type", "status", "note", "recorded_at", "recorded_by"]
FILM_COLS = ["film", "title", "language", "release_india", "release_na", "notes"]
SCOPES = {"day", "weekend", "week", "period", "to_date", "lifetime", "presale", "listing"}
METRICS = {"nett", "gross", "tickets", "shows", "cinemas", "occupancy", "rank", "theaters", "admits"}
TYPES = ["official", "studio", "industry", "ours", "archive"]          # trust order, best first
STATUS = ["final", "estimate", "partial", "live"]
UNITS = {"INR_cr", "USD", "EUR", "GBP", "AUD", "NZD", "AED", "SAR", "QAR", "KWD", "OMR", "BHD", "MYR", "SGD",
         "THB", "NPR", "CAD", "PHP", "VND", "IDR", "tickets", "count", "pct", "rank"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def load(path=LEDGER):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def key(r):  # exact-repeat key (recorded_at/by excluded)
    return tuple(str(r.get(c, "")).strip() for c in COLS[:15])


def norm(r, by):
    r = {c: ("" if r.get(c) is None else r.get(c)) for c in COLS}
    r["film"] = slug(str(r["film"]))
    r["status"] = r["status"] or "final"
    v = float(r["value"])
    r["value"] = ("%.6f" % v).rstrip("0").rstrip(".")
    if r["usd"] not in ("", None):
        r["usd"] = ("%.2f" % float(r["usd"])).rstrip("0").rstrip(".")
    if r["day_no"] not in ("", None):
        r["day_no"] = str(int(float(r["day_no"])))
    r["recorded_at"] = r["recorded_at"] or datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    r["recorded_by"] = r["recorded_by"] or by
    return r


def problems(r):
    p = []
    for c in ("film", "market", "scope", "metric", "value", "source_type"):
        if str(r.get(c, "")).strip() == "":
            p.append("missing " + c)
    if r.get("scope") and r["scope"] not in SCOPES: p.append("scope " + r["scope"])
    if r.get("metric") and r["metric"] not in METRICS: p.append("metric " + r["metric"])
    if r.get("source_type") and r["source_type"] not in TYPES: p.append("source_type " + r["source_type"])
    if r.get("status") and r["status"] not in STATUS: p.append("status " + r["status"])
    if r.get("unit") and r["unit"] not in UNITS: p.append("unit " + r["unit"])
    for c in ("date", "start"):
        if r.get(c):
            try: datetime.date.fromisoformat(r[c])
            except ValueError: p.append("bad " + c)
    if r.get("scope") == "day" and not r.get("date"): p.append("day row needs date")
    return p


def add_rows(rows, by="manual"):
    have = {key(r) for r in load()}
    new, bad = [], []
    for i, r in enumerate(rows):
        try:
            n = norm(r, by)
        except (ValueError, TypeError) as e:
            bad.append((i, "value: %s" % e)); continue
        pr = problems(n)
        if pr:
            bad.append((i, ", ".join(pr))); continue
        if key(n) in have:
            continue
        have.add(key(n)); new.append(n)
        if r.get("title"):
            film_seen(n["film"], r.get("title"), r.get("language", ""), r.get("release_india", ""), r.get("release_na", ""))
    exists = os.path.exists(LEDGER)
    with open(LEDGER, "a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        if not exists: w.writeheader()
        w.writerows(new)
    return new, bad


def film_seen(film, title, lang="", rel_in="", rel_na=""):
    fl = load(FILMS)
    if any(x["film"] == film for x in fl):
        return
    exists = os.path.exists(FILMS)
    with open(FILMS, "a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FILM_COLS)
        if not exists: w.writeheader()
        w.writerow({"film": film, "title": title, "language": lang, "release_india": rel_in, "release_na": rel_na, "notes": ""})


def rank(r):  # lower = better: final/estimate before partial/live, then source trust, then status
    t = TYPES.index(r["source_type"]) if r["source_type"] in TYPES else 9
    s = STATUS.index(r["status"]) if r["status"] in STATUS else 9
    return (0 if s < 2 else 1, t, s)


def best(rows):
    """one row per film/market/scope/metric/unit/date(/day): best source, then newest."""
    groups = {}
    for r in rows:
        g = (r["film"], r["market"], r["scope"], r["metric"], r["unit"], r["date"], r["start"], r["day_no"])
        groups.setdefault(g, []).append(r)
    out = []
    for g, rs in groups.items():
        rs = sorted(rs, key=lambda r: r["recorded_at"], reverse=True)   # newest first, so ties go to the newest
        top = min(rs, key=rank)
        out.append(top)
    return out


def fmt(r):
    v = float(r["value"])
    u = r["unit"]
    s = ("₹%.2f Cr" % v) if u == "INR_cr" else ("$%s" % f"{v:,.0f}") if u == "USD" else ("%s %s" % (f"{v:,.2f}".rstrip("0").rstrip("."), u))
    if r["usd"] and u != "USD": s += " ($%s)" % f"{float(r['usd']):,.0f}"
    return s


def show(rows):
    for r in sorted(rows, key=lambda r: (r["market"], r["scope"], r["date"], r["day_no"] or "")):
        d = ("Day %s " % r["day_no"]) if r["day_no"] else ""
        rng = (r["start"] + " to ") if r["start"] else ""
        print("%-14s %-8s %-6s %s%s%-10s %-22s %-9s %-8s %s%s" % (
            r["market"][:14], r["scope"], r["metric"], d, rng, r["date"], fmt(r), r["source_type"], r["status"],
            r["source"], (" · " + r["note"]) if r["note"] else ""))


def main(a):
    if not a or a[0] in ("-h", "--help"):
        print(__doc__); return 0
    cmd = a[0]
    if cmd == "add":
        by = a[a.index("--by") + 1] if "--by" in a else "manual"
        rows = [json.loads(l) for l in open(a[1], encoding="utf-8") if l.strip()]
        new, bad = add_rows(rows, by)
        print("LEDGER add: %d new, %d already there, %d rejected" % (len(new), len(rows) - len(new) - len(bad), len(bad)))
        for i, why in bad[:30]:
            print("  rejected line %d: %s" % (i + 1, why))
        return 1 if bad else 0
    rows = load()
    if cmd == "stats":
        films = {r["film"] for r in rows}
        print("rows %d · films %d · markets %d" % (len(rows), len(films), len({r['market'] for r in rows})))
        by = {}
        for r in rows: by[r["source_type"]] = by.get(r["source_type"], 0) + 1
        print("by source type:", by)
        return 0
    if cmd == "check":
        bad = [(i + 2, problems(r)) for i, r in enumerate(rows) if problems(r)]
        dup = len(rows) - len({key(r) for r in rows})
        print("rows %d · bad %d · exact repeats %d" % (len(rows), len(bad), dup))
        for ln, p in bad[:20]: print("  line %d: %s" % (ln, ", ".join(p)))
        return 1 if bad or dup else 0
    if cmd == "film":
        show([r for r in rows if r["film"] == slug(a[1])]); return 0
    if cmd == "best":
        f = slug(a[a.index("--film") + 1]) if "--film" in a else None
        show(best([r for r in rows if not f or r["film"] == f])); return 0
    if cmd == "day":
        f, m, n = slug(a[1]), a[2], a[3]
        rs = [r for r in rows if r["film"] == f and r["market"].lower() == m.lower() and r["scope"] == "day" and r["day_no"] == n]
        show(sorted(rs, key=rank)) if rs else print("not in the ledger yet: %s %s day %s" % (f, m, n)); return 0
    if cmd == "compare":
        f1, f2, m, rg = slug(a[1]), slug(a[2]), a[3], a[4]
        lo, hi = (int(x) for x in rg.split("-"))
        b = best([r for r in rows if r["scope"] == "day" and r["market"].lower() == m.lower() and r["film"] in (f1, f2)])
        print("%-6s %-28s %-28s" % ("Day", f1, f2))
        for d in range(lo, hi + 1):
            cell = []
            for f in (f1, f2):
                rs = [r for r in b if r["film"] == f and r["day_no"] == str(d) and r["metric"] in ("nett", "gross")]
                rs.sort(key=lambda r: (r["metric"] != "nett",))
                cell.append(("%s %s %s" % (fmt(rs[0]), rs[0]["metric"], rs[0]["status"][:3])) if rs else "—")
            print("%-6s %-28s %-28s" % (d, cell[0], cell[1]))
        return 0
    print("unknown command; python ledger.py --help"); return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
