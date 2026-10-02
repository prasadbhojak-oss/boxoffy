#!/usr/bin/env python3
"""
Boxoffy - 10 second diagnostic. Figures out WHY the sweep got 403s.
Run:  python probe.py
Writes probe.txt next to itself. Send me that file.
"""
import json, http.cookiejar, urllib.request, urllib.error, gzip, io, os

OUT = []
def say(*a):
    s = " ".join(str(x) for x in a)
    print(s); OUT.append(s)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

BROWSER = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Referer": "https://www.fandango.com/drishyam-the-conclusion-2026-247556/movie-times",
    "Origin": "https://www.fandango.com",
    "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Connection": "keep-alive",
}

jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def fetch(url, hdrs, label):
    req = urllib.request.Request(url, headers=hdrs)
    try:
        with op.open(req, timeout=30) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
            body = raw.decode("utf-8", "replace")
            say(f"\n--- {label}: HTTP {r.status}  {len(body)} bytes  ct={r.headers.get('Content-Type')}")
            say(body[:1800])
            return body
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            if e.headers.get("Content-Encoding") == "gzip":
                raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
        except Exception:
            pass
        say(f"\n--- {label}: HTTP {e.code}  {len(raw)} bytes")
        say(raw.decode("utf-8", "replace")[:1200])
    except Exception as e:
        say(f"\n--- {label}: EXCEPTION {type(e).__name__}: {e}")
    return None


say("STEP 1 - visit the Fandango film page to pick up cookies")
page_hdr = dict(BROWSER)
page_hdr["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
page_hdr["Sec-Fetch-Dest"] = "document"; page_hdr["Sec-Fetch-Mode"] = "navigate"
page_hdr.pop("Origin", None); page_hdr.pop("Referer", None)
body = fetch("https://www.fandango.com/drishyam-the-conclusion-2026-247556/movie-times",
             page_hdr, "film page")
say(f"\ncookies now held: {[c.name for c in jar]}")
if body:
    for probe in ("theaterShowtimeGroupings", "showtimeHashCode", "247556", "__NEXT_DATA__"):
        say(f"  page contains {probe!r}: {probe in body}")

say("\n\nSTEP 2 - the napi endpoint WITH those cookies and full browser headers")
fetch("https://www.fandango.com/napi/theaterShowtimeGroupings/247556/2026-10-02"
      "?isdesktop=true&postalCode=75024&zip=75024&isDesktopMOP=true",
      BROWSER, "napi theaterShowtimeGroupings")

say("\n\nSTEP 3 - bare request, no cookies, for comparison")
jar2 = http.cookiejar.CookieJar()
op2 = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar2))
try:
    r = op2.open(urllib.request.Request(
        "https://www.fandango.com/napi/theaterShowtimeGroupings/247556/2026-10-02"
        "?isdesktop=true&postalCode=75024&zip=75024&isDesktopMOP=true",
        headers={"User-Agent": UA}), timeout=30)
    say(f"bare request: HTTP {r.status}")
except urllib.error.HTTPError as e:
    say(f"bare request: HTTP {e.code}")
except Exception as e:
    say(f"bare request: {type(e).__name__}: {e}")

say("\n\nSTEP 4 - Cineplex theatres, raw")
fetch("https://apis.cineplex.com/prod/cpx/theatrical/api/v1/theatres?language=en",
      {"Ocp-Apim-Subscription-Key": "477f072109904a55927ba2c3bf9f77e3",
       "User-Agent": UA, "Accept": "application/json"}, "cineplex theatres")

say("\n\nSTEP 5 - Cineplex showtimes for one Toronto-area location")
fetch("https://apis.cineplex.com/prod/cpx/theatrical/api/v1/showtimes"
      "?language=en&filmId=62159&date=2026-10-02&locationId=7021",
      {"Ocp-Apim-Subscription-Key": "477f072109904a55927ba2c3bf9f77e3",
       "User-Agent": UA, "Accept": "application/json"}, "cineplex showtimes")

open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "probe.txt"),
     "w", encoding="utf-8").write("\n".join(OUT))
say(f"\n\nWritten to probe.txt")
