#!/usr/bin/env python3
"""
Boxoffy - MIDDLE EAST sweep (VOX Cinemas)      python middle_east_sweep.py

Built from what the browser actually showed, not from guesses:

  * VOX is server rendered.  /showtimes?m=<slug>&d=<date> returns the WHOLE
    country's grid in one request - 182 showtimes for the UAE in a single call.
    No per-postcode crawling like Fandango.
  * It sits behind Akamai, which is why plain Python got connection resets.
    Same fix as Fandango: load the homepage first so Akamai sets its cookies,
    then reuse that session.
  * Page structure, confirmed on the live DOM:
        section.showtimes > article.movie-compare[data-slug]
          > div.dates            h3 = cinema name
            > ol.showtimes
              > li               text = experience (STANDARD, MAX, GOLD, ...)
                > ol > li[data-id] > a.action.showtime  = the time
  * Seat counts are NOT available.  VOX only reveals the seat map after you
    enter the booking funnel and identify yourself, so this counts cinemas,
    screens, experiences and showtimes - not tickets sold.  See NOTE below.

Writes into ./intel/me-<date>/ .  Stdlib only.  Python 3.8+.  Under a minute.
"""

import os, csv, re, gzip, io, time, json, datetime
import urllib.request, urllib.error, http.cookiejar
from html.parser import HTMLParser

DATE  = "2026-10-02"
TITLE = "drishyam"          # substring used to find the film on each site
OUT   = os.path.join("intel", f"me-{DATE}")
PAUSE = 0.6

# VOX country sites.  Ones that do not resolve are skipped and reported.
COUNTRIES = [
    ("uae", "United Arab Emirates"), ("ksa", "Saudi Arabia"),
    ("qat", "Qatar"), ("kwt", "Kuwait"), ("bhr", "Bahrain"),
    ("bah", "Bahrain alt"), ("omn", "Oman"), ("oma", "Oman alt"),
    ("leb", "Lebanon"), ("lbn", "Lebanon alt"), ("egy", "Egypt"),
    ("jor", "Jordan"),
]

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
BASE_HDR = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none", "Sec-Fetch-User": "?1",
}

LOG = []
def log(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True); LOG.append(s)

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def get(url, referer=None, tries=3):
    h = dict(BASE_HDR)
    if referer:
        h["Referer"] = referer; h["Sec-Fetch-Site"] = "same-origin"
    for a in range(tries):
        try:
            with opener.open(urllib.request.Request(url, headers=h), timeout=30) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
                    except Exception: pass
                return r.status, raw.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and a < tries - 1:
                time.sleep(2 * (a + 1)); continue
            return e.code, ""
        except Exception as e:
            if "getaddrinfo" in str(e):
                return -1, ""                      # host does not exist
            if a < tries - 1:
                time.sleep(2 * (a + 1)); continue
            return 0, ""
    return 0, ""


TIME_RE = re.compile(r"^\d{1,2}:\d{2}\s*(am|pm)$", re.I)

class Grid(HTMLParser):
    """Pulls cinema / experience / showtime out of the VOX showtimes page."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows, self.cinemas = [], []
        self.cinema = ""; self.fmt = ""
        self.in_h3 = False; self.in_show = False
        self.cur = None

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "h3":
            self.in_h3 = True; self._h3 = ""
        elif tag == "a" and "showtime" in (d.get("class") or ""):
            self.in_show = True
            self.cur = {"bookingId": d.get("data-id", ""),
                        "url": d.get("href", ""), "time": ""}

    def handle_endtag(self, tag):
        if tag == "h3" and self.in_h3:
            self.in_h3 = False
            name = " ".join(self._h3.split())
            if name:
                self.cinema = name; self.fmt = ""
                if name not in self.cinemas:
                    self.cinemas.append(name)
        elif tag == "a" and self.in_show:
            self.in_show = False
            if self.cur and self.cur["time"]:
                self.cur["cinema"] = self.cinema
                self.cur["experience"] = self.fmt or "Standard"
                self.rows.append(self.cur)
            self.cur = None

    def handle_data(self, data):
        t = " ".join(data.split())
        if not t:
            return
        if self.in_h3:
            self._h3 += " " + t
        elif self.in_show and self.cur is not None:
            self.cur["time"] += t
        elif self.cinema and len(t) <= 32 and not TIME_RE.match(t):
            # the label sitting just above a block of times is the experience
            if re.fullmatch(r"[A-Za-z0-9 &'\-\.]+", t):
                self.fmt = t


def find_slug(host, body):
    """The film's slug on this country's site."""
    hits = re.findall(r'/movies/([a-z0-9\-]*%s[a-z0-9\-]*)' % TITLE, body, re.I)
    if hits:
        # prefer the hindi listing when several language versions are up
        hits = list(dict.fromkeys(hits))
        for h in hits:
            if "hindi" in h:
                return h
        return hits[0]
    return None


def sweep_country(cc, label):
    host = f"https://{cc}.voxcinemas.com"
    st, body = get(host + "/")
    if st == -1:
        log(f"{cc:<4} {label:<22} no such site, skipped"); return None
    if st != 200 or not body:
        log(f"{cc:<4} {label:<22} HTTP {st} on homepage, skipped"); return None
    cookies = [c.name for c in jar]
    time.sleep(PAUSE)

    slug = find_slug(host, body)
    if not slug:
        st2, listing = get(host + "/movies/whatson", referer=host + "/")
        slug = find_slug(host, listing) if st2 == 200 else None
        time.sleep(PAUSE)
    if not slug:
        log(f"{cc:<4} {label:<22} film not listed"); return None

    url = f"{host}/showtimes?m={slug}&d={DATE}"
    st3, page = get(url, referer=host + f"/movies/{slug}")
    if st3 != 200 or not page:
        log(f"{cc:<4} {label:<22} HTTP {st3} on showtimes"); return None

    g = Grid(); g.feed(page)
    for r in g.rows:
        r["country"] = label; r["cc"] = cc; r["slug"] = slug
    log(f"{cc:<4} {label:<22} {len(g.cinemas):>3} cinemas  {len(g.rows):>4} showtimes  "
        f"slug={slug}  cookies={len(cookies)}")
    return {"cc": cc, "country": label, "slug": slug,
            "cinemas": g.cinemas, "rows": g.rows, "bytes": len(page)}


def main():
    os.makedirs(OUT, exist_ok=True)
    log(f"RUN {datetime.datetime.now().isoformat()}   date={DATE}   film~'{TITLE}'")
    log("VOX Cinemas, server rendered, one request per country.\n")

    all_rows, summary, raw = [], [], {}
    for cc, label in COUNTRIES:
        res = sweep_country(cc, label)
        if res:
            all_rows += res["rows"]
            summary.append((label, cc, len(res["cinemas"]), len(res["rows"])))
            raw[cc] = res
        time.sleep(PAUSE)

    cols = ["country", "cc", "cinema", "experience", "time", "bookingId", "url", "slug"]
    with open(os.path.join(OUT, "vox_showtimes.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in all_rows: w.writerow(r)

    seen, crows = set(), []
    for r in all_rows:
        k = (r["country"], r["cinema"])
        if k in seen: continue
        seen.add(k)
        crows.append({"country": r["country"], "cc": r["cc"], "cinema": r["cinema"],
                      "shows": sum(1 for x in all_rows
                                   if x["country"] == r["country"] and x["cinema"] == r["cinema"])})
    with open(os.path.join(OUT, "vox_cinemas.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["country", "cc", "cinema", "shows"])
        w.writeheader()
        for r in crows: w.writerow(r)

    json.dump(raw, open(os.path.join(OUT, "vox_raw.json"), "w"), indent=1)

    fmts = {}
    for r in all_rows:
        fmts[r["experience"]] = fmts.get(r["experience"], 0) + 1
    log("\nSUMMARY")
    log(f"  {'country':<24}{'cinemas':>8}{'showtimes':>11}")
    for label, cc, nc, ns in summary:
        log(f"  {label:<24}{nc:>8}{ns:>11}")
    log(f"  {'TOTAL':<24}{len(crows):>8}{len(all_rows):>11}")
    log("\n  experiences: " + ", ".join(f"{k} {v}" for k, v in
                                        sorted(fmts.items(), key=lambda x: -x[1])))
    log("\nNOTE: VOX does not publish seat availability outside the booking")
    log("funnel, so this is a footprint read - cinemas, screens, experiences,")
    log("showtimes. It is not a tickets-sold read like North America.")

    open(os.path.join(OUT, "RUN.txt"), "w", encoding="utf-8").write("\n".join(LOG))
    log(f"\nWritten to {OUT}")


if __name__ == "__main__":
    main()
