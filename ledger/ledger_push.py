#!/usr/bin/env python3
"""BOXOFFY LEDGER -> Google Sheet "Boxoffy Ledger" (viewing copy).  15 Nov 2026

Sends ledger rows the sheet does not have yet to the sheet's own Apps Script web app
(ledger\\ledger-sheet-script.gs, pasted once into the sheet: Extensions > Apps Script).
The CSV stays the master; the sheet is a copy you can open on your phone.

The web-app address is read from ledger\\push-url.txt (kept out of git) or the
BOXOFFY_LEDGER_URL user variable; it is long and unguessable and acts as the key.
Optional passphrase: BOXOFFY_LEDGER_TOKEN, matching Script Property LEDGER_TOKEN.
If no address is set it says so and exits quietly. Progress is kept in ledger\\.pushed
(number of CSV rows already in the sheet). Never prints the URL or the passphrase.
"""
import csv, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ledger as L

MARK = os.path.join(HERE, ".pushed")
CHUNK = 1500


def main():
    url, tok = os.environ.get("BOXOFFY_LEDGER_URL"), os.environ.get("BOXOFFY_LEDGER_TOKEN", "")
    f = os.path.join(HERE, "push-url.txt")          # kept out of git (.gitignore)
    if not url and os.path.exists(f):
        url = open(f, encoding="utf-8").read().strip()
    if not url:
        print("PUSH skipped: sheet link not set up yet (ledger\\push-url.txt)")
        return 0
    rows = L.load()
    done = int(open(MARK).read().strip() or 0) if os.path.exists(MARK) else 0
    todo = rows[done:]
    if not todo:
        print("PUSH nothing new (%d rows in sheet)" % done); return 0
    for i in range(0, len(todo), CHUNK):
        part = [[r.get(c, "") for c in L.COLS] for r in todo[i:i + CHUNK]]
        body = json.dumps({"token": tok, "cols": L.COLS, "rows": part}).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        try:
            res = json.loads(urllib.request.urlopen(req, timeout=120).read().decode("utf-8"))
        except Exception as e:
            print("PUSH failed after %d rows: %s" % (done, type(e).__name__)); return 1
        if not res.get("ok"):
            print("PUSH refused by the sheet: %s" % str(res.get("error", ""))[:80]); return 1
        done += len(part)
        open(MARK, "w").write(str(done))
    print("PUSH ok: %d new rows · sheet now has %d" % (len(todo), done))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
