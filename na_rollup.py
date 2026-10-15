#!/usr/bin/env python3
"""
Boxoffy - NA DAY ROLL-UP.    python na_rollup.py [YYYY-MM-DD]

THE PROBLEM THIS FIXES
  Fandango withdraws a show's seat map the moment the show starts. So a single
  read can never give you a day total:

    U7, 11.33am ET   88,333 seats visible   18,516 sold
    U8,  4.23pm ET   69,033 seats visible   23,180 sold

  Nineteen thousand seats did not vanish - those shows played. Their tickets are
  real money and they are missing from the later read. Read again at 11pm and it
  gets worse, not better: by then the whole evening has played too and you are
  looking at almost nothing. The later you read, the less you see.

THE FIX
  Every read of the day is a snapshot of different shows at their last visible
  moment. Union them by the show hash and keep each show's PEAK observed sold.
  A show that played at 1pm contributes whatever the 11.33am read last saw in
  it; a 10pm show contributes the latest read. Nothing is double counted,
  because the hash identifies one showtime at one screen.

WHAT IT REPORTS, AND THE DISTINCTION THAT MATTERS
  FLOOR     peak observed sold, summed. No assumptions. We watched these
            tickets sell. The real day total cannot be below this.
  The floor is a floor and not an estimate, because a show last seen hours
  before it started kept selling after we stopped looking. Do not publish the
  floor as the day's number and do not publish an estimate as the floor.

Reads intel/na-<date>/ plus every intel/na-<date>-prev-*/ beside it.
Ordered by content, never by file mtime - copying or staging a file rewrites
mtime and would silently reorder the day.

Stdlib only. Python 3.8+. Windows-safe. Instant - it reads files, no network.
"""

import csv, glob, os, statistics, sys
from collections import Counter

DATE = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1][:2] == "20" else "2026-10-02"
ROOT = "intel"
ATP = (15, 16, 17, 18)        # NA average ticket price for a Hindi release.
                              # 99% of this slate is Standard format, so the top
                              # of this range is a ceiling, not a midpoint.
OUT = []


def say(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True); OUT.append(s)


def num(v):
    try: return int(v)
    except (TypeError, ValueError): return None


def load(d):
    p = os.path.join(d, "fandango_shows.csv")
    if not os.path.exists(p): return None
    try:
        return list(csv.DictReader(open(p, encoding="utf-8")))
    except Exception as e:
        say(f"  !! {p}: {e}"); return None


def stats(rows):
    w = [r for r in rows if num(r.get("seatsTotal")) and num(r.get("seatsAvail")) is not None]
    t = sum(num(r["seatsTotal"]) for r in w)
    s = t - sum(num(r["seatsAvail"]) for r in w)
    return len(rows), len(w), t, s


def main():
    dirs = [d for d in glob.glob(os.path.join(ROOT, f"na-{DATE}*")) if os.path.isdir(d)]
    if not dirs:
        sys.exit(f"no intel/na-{DATE}* directories found - run from the boxoffy folder")

    reads = []
    for d in sorted(dirs):
        rows = load(d)
        if rows is None:
            say(f"  skip {d} (no fandango_shows.csv)"); continue
        reads.append((d, rows) + stats(rows)[1:])

    # Order by cumulative sold. Sold rises through the day on the still-selling
    # inventory, so it orders the reads correctly where mtime cannot: staging or
    # copying a file rewrites mtime and would scramble the sequence.
    reads.sort(key=lambda x: x[4])

    say(f"NA DAY ROLL-UP  {DATE}")
    say(f"{len(reads)} reads found, ordered by cumulative sold\n")
    say(f"  {'read':<30}{'shows':>7}{'mapped':>8}{'seats':>9}{'sold':>8}{'occ':>7}")
    for d, rows, mapped, t, s in reads:
        say(f"  {os.path.basename(d):<30}{len(rows):>7}{mapped:>8}{t:>9,}{s:>8,}"
            f"{(s/t*100 if t else 0):>6.1f}%")

    peak_seats = max(r[3] for r in reads)
    last_seats = reads[-1][3]
    say(f"\n  peak seats visible in any read {peak_seats:,}; in the last read "
        f"{last_seats:,}")
    if last_seats < peak_seats:
        say(f"  {peak_seats-last_seats:,} seats of inventory had already played by the")
        say(f"  last read. That is exactly what this roll-up recovers.")

    # ── union by show hash, keep the peak
    best, seen = {}, {}
    for d, rows, *_ in reads:
        lab = os.path.basename(d)
        for r in rows:
            h = r.get("hash")
            if not h: continue
            seen[h] = r
            t, a = num(r.get("seatsTotal")), num(r.get("seatsAvail"))
            if not t or a is None: continue
            sold = t - a
            if h not in best or sold > best[h][0]:
                best[h] = (sold, t, lab, r)

    say(f"\n=== ROLL-UP ===")
    say(f"  distinct showtimes seen today   {len(seen):>7,}")
    say(f"  with a seat map in some read    {len(best):>7,}")
    say(f"  never mapped in any read        {len(seen)-len(best):>7,}")

    tot = sum(v[1] for v in best.values())
    sold = sum(v[0] for v in best.values())
    say(f"\n  seats {tot:,}   PEAK OBSERVED SOLD {sold:,}   {sold/tot*100:.1f}%")
    say(f"  best single read was {reads[-1][4]:,} -> roll-up adds {sold-reads[-1][4]:+,}")

    c = Counter(v[2] for v in best.values())
    say(f"\n  which read supplied each show's peak:")
    for d, *_ in reads:
        lab = os.path.basename(d)
        say(f"    {lab:<32}{c.get(lab,0):>5} shows")
    early = sum(c.get(os.path.basename(d), 0) for d, *_ in reads[:-1])
    if early:
        say(f"\n  {early} shows peaked in an EARLIER read, meaning we stopped")
        say(f"  watching them before they started. Whatever they sold after that")
        say(f"  is real and is not in the figure above. This is why it is a floor.")

    # never-mapped shows, imputed from their own theatre's median capacity
    miss = [r for h, r in seen.items() if h not in best]
    if miss:
        bt = {}
        for h, (s, t, lab, r) in best.items():
            bt.setdefault(r["theatreId"], []).append(t)
        glob_cap = statistics.median([v[1] for v in best.values()])
        cap = sum(statistics.median(bt[r["theatreId"]]) if r["theatreId"] in bt
                  else glob_cap for r in miss)
        say(f"\n  {len(miss)} never-mapped shows, est capacity {cap:,.0f}")
        say(f"  at the roll-up rate -> {cap*sold/tot:,.0f} tickets (imputed, not observed)")

    # Canada: Cineplex publishes seatsAvail but no seatsTotal, so free seats are
    # known and capacity is not. Sold cannot be computed. Scale by showtime share.
    ca = 0
    for d, *_ in reads:
        p = os.path.join(d, "cineplex_shows.csv")
        if os.path.exists(p):
            try: ca = max(ca, len(list(csv.DictReader(open(p, encoding="utf-8")))))
            except Exception: pass
    us_shows = len(seen)
    shr = ca / (us_shows + ca) if ca else 0.0
    say(f"\n=== CANADA ===")
    say(f"  {ca} Cineplex showtimes = {shr*100:.1f}% of NA showtimes")
    say(f"  Cineplex gives seatsAvail but NOT seatsTotal, so we know how many")
    say(f"  seats are free and not how many exist. Sold is not computable.")
    say(f"  Canada is therefore SCALED by showtime share, never counted.")

    say(f"\n=== DOLLARS ===")
    say(f"  {'ATP':<6}{'US floor':>12}{'NA floor':>12}")
    for a in ATP:
        say(f"  ${a:<5}{sold*a/1e6:>11.2f}M{sold*a/(1-shr)/1e6:>11.2f}M")
    say(f"\n  These are FLOORS. Publishing one as the day's gross understates it;")
    say(f"  publishing an estimate as a floor overstates our confidence. The")
    say(f"  honest post gives the floor as observed and the estimate as a band.")

    os.makedirs(ROOT, exist_ok=True)
    p = os.path.join(ROOT, f"na_rollup_{DATE}.txt")
    with open(p, "w", encoding="utf-8") as fh:
        fh.write("\n".join(OUT))
    print(f"\nWritten to {p}", flush=True)


if __name__ == "__main__":
    main()
