"""
BOXOFFY — TMDB Poster Fetcher
Run locally: python fetch_posters.py
Reads:  src/data/films.json
Writes: src/data/films.json (updated with posterUrl for each film)

Requires: pip install requests
"""

import json, time, requests, re, os

# ── CONFIG ────────────────────────────────────────────────────
BEARER   = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2YWM1OTY0NzEyZTA0NGRmMmJjMmFiYzFlMTFlZGMyYyIsIm5iZiI6MTc3Mzg4NTMxMS42MzIsInN1YiI6IjY5YmI1NzdmYjgyMzJhNzc5MjIxZWZjOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.QxWkqL_4_3PfTnIVgcZYE0zlXQd9M2y5QL-oWNwq6dE"
BASE     = "https://api.themoviedb.org/3"
IMG_BASE = "https://image.tmdb.org/t/p/w300"   # w300 = good quality, reasonable size
DATA     = "src/data/films.json"
DELAY    = 0.26  # seconds between requests — stays under TMDB rate limit (40/10s)

HEADERS = {
    "Authorization": f"Bearer {BEARER}",
    "accept": "application/json",
}

# ── LANGUAGE CODE MAP ─────────────────────────────────────────
LANG_MAP = {
    "Hindi":      "hi",
    "Telugu":     "te",
    "Tamil":      "ta",
    "Malayalam":  "ml",
    "Kannada":    "kn",
    "Hollywood":  "en",
    "Marathi":    "mr",
    "Punjabi":    "pa",
    "Bengali":    "bn",
}

def clean_year(date_str):
    """Extract 4-digit year from releaseDate string"""
    m = re.search(r'(\d{4})', str(date_str))
    return m.group(1) if m else None

def search_tmdb(title, year, lang_code):
    """Search TMDB for a film, return poster_path or None"""
    # Try with year first
    try:
        r = requests.get(f"{BASE}/search/movie", headers=HEADERS, params={
            "query":               title,
            "year":                year,
            "language":            "en-US",
            "include_adult":       False,
        }, timeout=8)
        r.raise_for_status()
        results = r.json().get("results", [])
        if results:
            return results[0].get("poster_path")
    except Exception:
        pass

    # Fallback: search without year
    try:
        r = requests.get(f"{BASE}/search/movie", headers=HEADERS, params={
            "query":   title,
            "language":"en-US",
        }, timeout=8)
        r.raise_for_status()
        results = r.json().get("results", [])
        if results:
            return results[0].get("poster_path")
    except Exception:
        pass

    return None

def run():
    # Load films.json
    with open(DATA, encoding="utf-8") as f:
        films = json.load(f)

    total    = sum(len(v) for v in films.values() if isinstance(v, list))
    updated  = 0
    already  = 0
    failed   = 0
    count    = 0

    print(f"=== BOXOFFY TMDB POSTER FETCHER ===")
    print(f"Films to process: {total}")
    print(f"Estimated time:   ~{round(total * DELAY / 60, 1)} minutes\n")

    for year in sorted(films.keys()):
        fl = films[year]
        if not isinstance(fl, list):
            continue

        for film in fl:
            count += 1
            title = film.get("title", "")

            # Skip if already has a poster
            if film.get("posterUrl") and "tmdb.org" in str(film.get("posterUrl", "")):
                already += 1
                continue

            lang      = film.get("language", "Hindi")
            lang_code = LANG_MAP.get(lang, "hi")
            yr        = clean_year(film.get("releaseDate", year))

            poster_path = search_tmdb(title, yr, lang_code)
            time.sleep(DELAY)

            if poster_path:
                film["posterUrl"] = f"{IMG_BASE}{poster_path}"
                updated += 1
                print(f"  [{count:>3}/{total}] ✅  {title[:50]}")
            else:
                failed += 1
                print(f"  [{count:>3}/{total}] ❌  {title[:50]} (not found)")

            # Save progress every 50 films in case of interruption
            if count % 50 == 0:
                with open(DATA, "w", encoding="utf-8") as f:
                    json.dump(films, f, ensure_ascii=False, indent=2)
                print(f"\n  💾 Progress saved ({count}/{total})\n")

    # Final save
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(films, f, ensure_ascii=False, indent=2)

    print(f"\n=== DONE ===")
    print(f"Updated:        {updated}")
    print(f"Already had:    {already}")
    print(f"Not found:      {failed}")
    print(f"Total films:    {total}")
    print(f"\nNext step: python generate_film_pages.py")
    print(f"Then:       git add -A && git commit -m 'feat: TMDB posters' && npm run build && vercel --prod")

if __name__ == "__main__":
    run()
