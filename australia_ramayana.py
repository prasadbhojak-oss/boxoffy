#!/usr/bin/env python3
"""
Boxoffy - RAMAYANA, AUSTRALIA AND NEW ZEALAND     python australia_ramayana.py

One file. Nothing to install, nothing to wire up.

WHAT THIS IS, HONESTLY
  We have never built an Australian parser. au_probe.py was written and never
  run, so no AU chain endpoint has ever been confirmed to respond. Writing
  four parsers blind against endpoints I have never seen answer is how you
  get a script that returns a confident zero.

  So this does BOTH jobs in one pass:
    1. PROBE   - hits every AU/NZ chain and records what actually comes back
    2. STATUS  - for anything that does respond, asks the only question that
                 matters today: is Ramayana listed, and are seats on sale

  It uses a CONTROL FILM as well as the target. If an endpoint returns
  nothing for Ramayana AND nothing for a film that is definitely playing
  right now, the endpoint is broken and we learn nothing. If it returns the
  control but not Ramayana, that is a real answer: not on sale yet.

WHAT WE ALREADY KNOW, verified 10 Oct 2026
  * AU and NZ release is THURSDAY 5 NOVEMBER 2026 - a day before the
    6 Nov international date and three days before India's 8 Nov.
    Confirmed on HOYTS' own page and on Flicks AU and Flicks NZ.
  * The official title is now RAMAYANA: RISE OF A LEGEND. Chains may list it
    under either name, so we match on both plus the Hindi-subtitle variants.
  * Sony Pictures holds global distribution outside India. The Australian
    classification applicant is Prathyangira Cinemas Pty Ltd - likely the
    local releasing agent under Sony. INFERENCE, not confirmed by trade.
  * HOYTS is the ONLY Australian chain with a live page, and it is Coming
    Soon with no sessions. Event Cinemas has nothing up at all.
  * THE FEATURE IS NOT YET CLASSIFIED IN AUSTRALIA. The only Classification
    Board record is a 34-minute promo reel, rated M for Violence. That is
    almost certainly WHY no tickets are on sale. This script checks the
    classification record too, because that is the leading indicator - when
    the full feature gets rated, listings follow within days.
  * IMAX in Australia is NOT REPORTED either way. IMAX Sydney and Melbourne
    are Event-operated and Event has no page; HOYTS has no IMAX at all. So
    there is currently zero Australian-side signal of an IMAX booking.

BENCHMARKS for whatever we eventually measure (all USD - Indian trade reports
Australian grosses in USD, not AUD, which is a trap worth remembering)
    Pushpa 2      AU opening $1.48M            NZ $0.24M
    Animal        AU opening $1.29M / 122 sites, total $3.42M
    Dangal        AU opening $0.53M,  total $1.45M
    Stree 2       AU opening $0.46M / 85 sites, total $1.54M
  A genuine pan-Indian event opens AU at roughly US$1.3-1.5M across 110-125
  locations. Totals run 2.0-2.6x the opening weekend. NZ runs at about
  15-20% of the Australian figure.

Stdlib only. Python 3.8+. Windows-safe. Takes two to four minutes.
"""

import json, os, re, gzip, io, time, datetime
import urllib.request, urllib.error, http.cookiejar

# ----------------------------------------------------------------- config
TARGET_NAMES = ["ramayana", "rise of a legend"]
CONTROL_NAMES = ["drishyam"]          # definitely playing in AU right now
AU_DATE = "2026-11-05"                # confirmed AU/NZ release, Thursday
AU_DATE_SLASH = "05/11/2026"
CONTROL_DATE = "2026-10-11"           # this Sunday, control film is in week 2

OUT = []
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")
HDR = {"User-Agent": UA,
       "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
       "Accept-Language": "en-AU,en;q=0.9",
       "Accept-Encoding": "gzip, deflate"}
TIMEOUT = 20
PAUSE = 0.45

STATS = {"ok": 0, "json": 0, "target": 0, "control": 0, "fail": 0, "blocked": 0}
FOUND_TARGET, FOUND_CONTROL, LIVE_JSON = [], [], []


def say(*a):
    s = " ".join(str(x) for x in a)
    try:
        print(s, flush=True)
    except UnicodeEncodeError:
        print(s.encode("ascii", "replace").decode(), flush=True)
    OUT.append(s)


jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def hit(label, url, hdrs=None, snip=800):
    h = dict(HDR)
    h.update(hdrs or {})
    try:
        with op.open(urllib.request.Request(url, headers=h), timeout=TIMEOUT) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                try:
                    raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                except Exception:
                    pass
            body = raw.decode("utf-8", "replace")
            low = body.lower()
            ct = (r.headers.get("Content-Type") or "").split(";")[0]
            isj = "json" in ct or body.lstrip()[:1] in "[{"
            tgt = any(n in low for n in TARGET_NAMES)
            ctl = any(n in low for n in CONTROL_NAMES)

            STATS["ok"] += 1
            STATS["json"] += bool(isj)
            STATS["target"] += bool(tgt)
            STATS["control"] += bool(ctl)
            if isj:
                LIVE_JSON.append(label)
            if tgt:
                FOUND_TARGET.append(label)
            if ctl:
                FOUND_CONTROL.append(label)

            say(f"\n### {label}")
            say(f"    {url}")
            say(f"    HTTP {r.status}  {ct}  {len(body):,} bytes  json={isj}")
            say(f"    RAMAYANA={tgt}   control(drishyam)={ctl}")

            if isj:
                try:
                    js = json.loads(body)
                    if isinstance(js, dict):
                        say(f"    TOP-LEVEL KEYS: {list(js.keys())[:25]}")
                        for k, v in list(js.items())[:6]:
                            if isinstance(v, list) and v and isinstance(v[0], dict):
                                say(f"      {k}[0] keys: {list(v[0].keys())[:20]}")
                    elif isinstance(js, list) and js and isinstance(js[0], dict):
                        say(f"    LIST OF {len(js)}, [0] keys: {list(js[0].keys())[:20]}")
                except ValueError:
                    say("    (looked like json, did not parse)")
                say("    " + body[:snip].replace("\n", " "))
            else:
                ids = re.findall(r'data-(?:film|movie|session|showtime)-?id="([^"]{1,24})"', body)[:8]
                nxt = "__NEXT_DATA__" in body or "__NUXT__" in body
                say(f"    html: data-ids={ids}  next/nuxt_payload={nxt}")

            # the thing we actually care about: context around any Ramayana hit
            if tgt:
                for n in TARGET_NAMES:
                    i = low.find(n)
                    if i >= 0:
                        say("    >>> RAMAYANA CONTEXT: ..."
                            + body[max(0, i - 260):i + 320].replace("\n", " ") + "...")
                        break
                # is anything actually bookable?
                sess = re.findall(r'(session|showtime|booking|buy[\- ]?ticket)', low)
                say(f"    >>> booking-ish words near this page: {len(sess)}")
            return body
    except urllib.error.HTTPError as e:
        STATS["fail"] += 1
        if e.code in (403, 401, 429):
            STATS["blocked"] += 1
        say(f"\n### {label}")
        say(f"    {url}")
        say(f"    HTTP {e.code} {e.reason}"
            + ("   <-- bot wall" if e.code in (403, 429) else ""))
    except Exception as e:
        STATS["fail"] += 1
        say(f"\n### {label}")
        say(f"    {url}")
        say(f"    FAILED {type(e).__name__}: {e}")
    return ""


WARM = [
    "https://www.hoyts.com.au", "https://www.eventcinemas.com.au",
    "https://villagecinemas.com.au", "https://www.readingcinemas.com.au",
    "https://www.palacecinemas.com.au", "https://www.dendy.com.au",
    "https://www.eventcinemas.co.nz", "https://www.readingcinemas.co.nz",
    "https://www.flicks.com.au",
]


TARGETS = [
    # ================================================================
    # HOYTS - the ONLY chain with a confirmed live Ramayana page as of
    # 10 Oct. Highest value target: we know the exact URL, so if its API
    # answers we can read it immediately.
    # ================================================================
    ("HOYTS ramayana page",   "https://www.hoyts.com.au/movies/ramayana-hindi-eng-sub"),
    ("HOYTS movies site",     "https://www.hoyts.com.au/movies"),
    ("HOYTS comingsoon",      "https://www.hoyts.com.au/movies/coming-soon"),
    ("HOYTS api films",       "https://www.hoyts.com.au/api/films"),
    ("HOYTS api v1 films",    "https://www.hoyts.com.au/api/v1/films"),
    ("HOYTS api movies",      "https://www.hoyts.com.au/api/movies"),
    ("HOYTS sessions",        f"https://www.hoyts.com.au/api/sessions?date={AU_DATE}"),
    ("HOYTS graphql probe",   "https://www.hoyts.com.au/graphql"),
    ("HOYTS sitemap",         "https://www.hoyts.com.au/sitemap.xml"),

    # ================================================================
    # EVENT CINEMAS - biggest AU chain AND operator of IMAX Sydney and
    # IMAX Melbourne. No Ramayana page found on 10 Oct. If one appears
    # here, that is the first real IMAX signal in Australia.
    # ================================================================
    ("Event movies",          "https://www.eventcinemas.com.au/Movies"),
    ("Event nowshowing",      "https://www.eventcinemas.com.au/Movies/NowShowing"),
    ("Event comingsoon",      "https://www.eventcinemas.com.au/Movies/ComingSoon"),
    ("Event api movies",      "https://www.eventcinemas.com.au/api/movies"),
    ("Event GetSessions",     f"https://www.eventcinemas.com.au/Session/GetSessions?date={AU_DATE}"),
    ("Event QuickBook",       "https://www.eventcinemas.com.au/QuickBook/Movies"),
    ("Event peach api",       "https://peach.eventcinemas.com.au/api/movies"),
    ("Event search ramayana", "https://www.eventcinemas.com.au/Search?q=ramayana"),
    ("Event Bollywood hub",   "https://www.eventcinemas.com.au/EventsFestivals/Bollywood"),

    # ================================================================
    # VILLAGE, READING, PALACE, DENDY and the independents that carry
    # most Indian product in Australia.
    # ================================================================
    ("Village movies",        "https://villagecinemas.com.au/movies"),
    ("Village api movies",    "https://villagecinemas.com.au/api/movies"),
    ("Village sessions",      f"https://villagecinemas.com.au/api/sessions?date={AU_DATE}"),
    ("Reading AU movies",     "https://www.readingcinemas.com.au/movies"),
    ("Reading AU api",        "https://www.readingcinemas.com.au/api/movies"),
    ("Reading AU comingsoon", "https://www.readingcinemas.com.au/coming-soon"),
    ("Palace movies",         "https://www.palacecinemas.com.au/movies/"),
    ("Dendy movies",          "https://www.dendy.com.au/movies"),
    ("Wallis SA",             "https://www.wallis.com.au/movies"),
    ("Grand Cinemas WA",      "https://www.grandcinemas.com.au/movies"),
    ("Limelight Ipswich",     "https://www.limelightcinemas.com.au/ipswich/movies"),

    # ================================================================
    # NEW ZEALAND - runs at roughly 15-20% of the Australian number.
    # ================================================================
    ("Event NZ movies",       "https://www.eventcinemas.co.nz/Movies"),
    ("Event NZ comingsoon",   "https://www.eventcinemas.co.nz/Movies/ComingSoon"),
    ("Event NZ Bollywood",    "https://www.eventcinemas.co.nz/EventsFestivals/Bollywood"),
    ("Reading NZ movies",     "https://www.readingcinemas.co.nz/movies"),
    ("Hoyts NZ",              "https://www.hoyts.co.nz/movies"),

    # ================================================================
    # AGGREGATORS - often far easier than the chains, and Flicks already
    # carries the 5 Nov date for both countries.
    # ================================================================
    ("Flicks AU ramayana",    "https://www.flicks.com.au/movie/ramayana/"),
    ("Flicks NZ ramayana",    "https://www.flicks.co.nz/movie/ramayana/"),
    ("Flicks AU comingsoon",  "https://www.flicks.com.au/coming-soon/"),

    # ================================================================
    # THE LEADING INDICATOR. The full feature is NOT yet classified in
    # Australia - only a 34-minute promo reel, rated M for Violence. No
    # classification means no sessions. When a feature-length record
    # appears here, listings follow within days. This is the single most
    # useful thing to re-check between now and 5 November.
    # ================================================================
    ("AU Classification Board", "https://www.classification.gov.au/titles/ramayana"),
]


def main():
    t0 = time.time()
    say("=" * 72)
    say("  BOXOFFY - RAMAYANA, AUSTRALIA AND NEW ZEALAND")
    say(f"  {datetime.datetime.now().isoformat(timespec='seconds')}")
    today = datetime.date.today()
    rel = datetime.date(2026, 11, 5)
    say(f"  AU/NZ release {rel}  (T-{(rel - today).days} days)")
    say(f"  target: {' / '.join(TARGET_NAMES)}")
    say(f"  control: {' / '.join(CONTROL_NAMES)} - should be playing NOW")
    say(f"  {len(WARM)} homepages to warm, {len(TARGETS)} endpoints to try")
    say("=" * 72)

    say("\n--- warming sessions so CDN cookies are set ---")
    for u in WARM:
        try:
            with op.open(urllib.request.Request(u, headers=HDR), timeout=TIMEOUT) as r:
                say(f"  {r.status}  {u}")
        except urllib.error.HTTPError as e:
            say(f"  {e.code}  {u}   <-- bot wall at the front door")
        except Exception as e:
            say(f"  ---  {u}   {type(e).__name__}")
        time.sleep(0.25)
    say(f"  cookies collected: {len(jar)}")

    say("\n--- endpoints ---")
    for label, url in TARGETS:
        hit(label, url)
        time.sleep(PAUSE)

    say("\n" + "=" * 72)
    say("  SUMMARY")
    say(f"    responded 200        {STATS['ok']}")
    say(f"    returned json        {STATS['json']}")
    say(f"    mentioned RAMAYANA   {STATS['target']}")
    say(f"    mentioned control    {STATS['control']}")
    say(f"    failed               {STATS['fail']}  (blocked {STATS['blocked']})")
    say(f"    elapsed              {time.time() - t0:.0f}s")

    say("\n  WHERE RAMAYANA APPEARED")
    if FOUND_TARGET:
        for x in FOUND_TARGET:
            say(f"    + {x}")
    else:
        say("    nowhere. If the control film also appeared nowhere, the")
        say("    endpoints are the problem. If the control DID appear, then")
        say("    Ramayana genuinely is not listed yet - which matches the")
        say("    feature being unclassified, and is a finding not a failure.")

    say("\n  MACHINE-READABLE SURFACES (json) - what I can build a parser on")
    if LIVE_JSON:
        for x in LIVE_JSON:
            say(f"    + {x}")
    else:
        say("    none. Every chain served HTML only. That means a real AU")
        say("    sweeper has to parse markup per chain, which is slower to")
        say("    build and more fragile. Worth knowing before we commit.")

    say("\n  READ THE CLASSIFICATION LINE ABOVE")
    say("    If it still shows only a 34-minute record, tickets will not be")
    say("    on sale anywhere and every zero in this run is expected.")
    say("    A feature-length record is the green light to re-run.")
    say("=" * 72)

    with open("australia_ramayana.txt", "w", encoding="utf-8") as fh:
        fh.write("\n".join(OUT))
    say("\nWritten: australia_ramayana.txt")


if __name__ == "__main__":
    main()
