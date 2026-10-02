#!/usr/bin/env python3
"""
Boxoffy - MIDDLE EAST probe.  Run this FIRST.   python middle_east_probe.py

Same play that fixed the North America sweep today: find out what each chain
actually serves before writing a line of parser.  This hits a spread of
candidate endpoints for every major Gulf chain, records what comes back, and
writes middle_east_probe.txt.  Send me that file and I build the real sweeper from it.

Nothing here is a guess I will act on blind - that is the whole point.
Stdlib only.  Python 3.8+.  Takes about two minutes.
"""

import json, os, re, gzip, io, time, datetime
import urllib.request, urllib.error, http.cookiejar

FILM = "drishyam"          # what we grep bodies for
DATE = "2026-10-02"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
HDR = {"User-Agent": UA,
       "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
       "Accept-Language": "en-US,en;q=0.9",
       "Accept-Encoding": "gzip, deflate"}

OUT = []
def say(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True); OUT.append(s)

jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def hit(label, url, hdrs=None, snip=900):
    h = dict(HDR); h.update(hdrs or {})
    try:
        with op.open(urllib.request.Request(url, headers=h), timeout=25) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                except Exception: pass
            body = raw.decode("utf-8", "replace")
            ct = (r.headers.get("Content-Type") or "").split(";")[0]
            isj = "json" in ct or body.lstrip()[:1] in "[{"
            found = FILM in body.lower()
            say(f"\n### {label}")
            say(f"    {url}")
            say(f"    HTTP {r.status}  {ct}  {len(body):,} bytes  json={isj}  mentions_drishyam={found}")
            if isj:
                say("    " + body[:snip].replace("\n", " "))
            else:
                # for HTML, surface the bits that reveal the real API
                for pat, tag in ((r'"buildId"\s*:\s*"([^"]+)"', "NEXT buildId"),
                                 (r'__NEXT_DATA__', "has __NEXT_DATA__"),
                                 (r'window\.__NUXT__', "has __NUXT__"),
                                 (r'(https?://[a-z0-9.\-]*api[a-z0-9.\-/]*)', "api url"),
                                 (r'/graphql', "graphql"),
                                 (rf'([a-z0-9\-/]*{FILM}[a-z0-9\-/]*)', "film slug")):
                    m = re.findall(pat, body, re.I)
                    if m:
                        uniq = list(dict.fromkeys(m))[:6]
                        say(f"    {tag}: {uniq}")
            return body
    except urllib.error.HTTPError as e:
        say(f"\n### {label}\n    {url}\n    HTTP {e.code}")
    except Exception as e:
        say(f"\n### {label}\n    {url}\n    {type(e).__name__}: {e}")
    return None


# Each tuple: label, url.  Several candidates per chain on purpose - we only
# need one of them to answer.
TARGETS = [
    # ---------- VOX, the big one: UAE, KSA, Qatar, Bahrain, Kuwait, Oman, Egypt, Lebanon
    ("VOX UAE site",          "https://uae.voxcinemas.com/movies"),
    ("VOX UAE movies json",   "https://uae.voxcinemas.com/movies?format=json"),
    ("VOX UAE showtimes",     f"https://uae.voxcinemas.com/showtimes?d={DATE}"),
    ("VOX UAE showtimes json",f"https://uae.voxcinemas.com/showtimes?d={DATE}&format=json"),
    ("VOX UAE api movies",    "https://uae.voxcinemas.com/api/movies"),
    ("VOX KSA site",          "https://ksa.voxcinemas.com/movies"),
    ("VOX KSA showtimes json",f"https://ksa.voxcinemas.com/showtimes?d={DATE}&format=json"),
    ("VOX QAT showtimes json",f"https://qat.voxcinemas.com/showtimes?d={DATE}&format=json"),
    ("VOX BAH showtimes json",f"https://bah.voxcinemas.com/showtimes?d={DATE}&format=json"),
    ("VOX KWT showtimes json",f"https://kwt.voxcinemas.com/showtimes?d={DATE}&format=json"),
    ("VOX OMN showtimes json",f"https://omn.voxcinemas.com/showtimes?d={DATE}&format=json"),
    ("VOX LEB showtimes json",f"https://leb.voxcinemas.com/showtimes?d={DATE}&format=json"),
    ("VOX EGY showtimes json",f"https://egy.voxcinemas.com/showtimes?d={DATE}&format=json"),

    # ---------- Reel Cinemas, UAE
    ("Reel site",             "https://www.reelcinemas.com/en/movies"),
    ("Reel ae site",          "https://www.reelcinemas.ae/"),
    ("Reel api movies",       "https://www.reelcinemas.com/api/movies"),

    # ---------- Novo, UAE + Qatar + Bahrain
    ("Novo site",             "https://www.novocinemas.com/"),
    ("Novo api movies",       "https://api.novocinemas.com/api/movies"),
    ("Novo uae movies",       "https://www.novocinemas.com/en-ae/movies"),

    # ---------- Saudi
    ("Muvi site",             "https://www.muvicinemas.com/en/movies"),
    ("Muvi api",              "https://www.muvicinemas.com/api/movies"),
    ("AMC Saudi",             "https://www.amccinemas.com/en/movies"),
    ("Empire KSA",            "https://www.empire.sa/"),

    # ---------- Kuwait / Lebanon / Oman / Bahrain independents
    ("Cinescape KW",          "https://www.cinescape.com.kw/"),
    ("Grand Cinemas LB",      "https://www.grandcinemas.com/"),
    ("Cinepolis Gulf",        "https://cinepolisgulf.com/"),
    ("Roxy UAE",              "https://www.theroxycinemas.com/"),

    # ---------- aggregators, often the cheapest route to a whole market
    ("Platinumlist UAE",      "https://dubai.platinumlist.net/movies"),
]


def main():
    say(f"PROBE {datetime.datetime.now().isoformat()}   target date {DATE}")
    say("Looking for: which chains serve JSON, and which already list the film.\n")
    for label, url in TARGETS:
        hit(label, url)
        time.sleep(0.4)

    say("\n\n=== WHAT I NEED FROM THIS ===")
    say("1. Which labels came back HTTP 200 with json=True")
    say("2. Which came back mentions_drishyam=True")
    say("3. Any 'api url' or 'NEXT buildId' lines - those name the real endpoint")
    say("4. Anything that 403s, so I know to warm a session first like Fandango")

    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "middle_east_probe.txt")
    open(p, "w", encoding="utf-8").write("\n".join(OUT))
    say(f"\nWritten to {p}")


if __name__ == "__main__":
    main()
