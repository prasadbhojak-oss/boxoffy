#!/usr/bin/env python3
"""
Boxoffy Film Page Generator
Generates individual HTML pages for all films in films.json
Run: python3 generate_film_pages.py
Output: one .html file per film in ./generated_pages/
"""

import json, re, os, math
from datetime import datetime

# ── CONFIG ────────────────────────────────────────────────────────────
INPUT_FILE  = '/mnt/user-data/outputs/films.json'
OUTPUT_DIR  = '/home/claude/generated_pages'
os.makedirs(OUTPUT_DIR, exist_ok=True)

STUDIO_PAGES = {
    "Maddock Films":              "maddock-films-production-house.html",
    "Dharma Productions":         "dharma-productions-production-house.html",
    "Yash Raj Films":             "yash-raj-films-production-house.html",
    "Excel Entertainment":        "excel-entertainment-production-house.html",
    "Red Chillies Entertainment": "red-chillies-entertainment-production-house.html",
    "Nadiadwala Grandson":        "nadiadwala-grandson-entertainment-production-house.html",
    "T-Series Films":             "t-series-films-production-house.html",
    "Hombale Films":              "hombale-films-production-house.html",
    "Mythri Movie Makers":        "mythri-movie-makers-production-house.html",
    "Sithara Entertainments":     "sithara-entertainments-production-house.html",
    "Arka Media Works":           "arka-media-works-production-house.html",
    "Sun Pictures":               "sun-pictures-production-house.html",
    "Bhansali Productions":       "bhansali-productions-production-house.html",
    "Salman Khan Films":          "salman-khan-films-production-house.html",
    "RSVP Movies":                "rsvp-movies-production-house.html",
    "Jio Studios":                "jio-studios-production-house.html",
    "DVV Entertainment":          "dvv-entertainment-production-house.html",
    "Geetha Arts":                "geetha-arts-production-house.html",
    "Lyca Productions":           "lyca-productions-production-house.html",
    "AGS Entertainment":          "ags-entertainment-production-house.html",
    "24AM Studios":               "24am-studios-production-house.html",
    "Aashirvad Cinemas":          "aashirvad-cinemas-production-house.html",
    "Aamir Khan Productions":     "aamir-khan-productions-production-house.html",
    "B62 Studios":                "b62-studios-production-house.html",
    "Ajay Devgn Ffilms":          "ajay-devgn-ffilms-production-house.html",
    "Marflix Pictures":           "marflix-pictures-production-house.html",
    "Roy Kapur Films":            "roy-kapur-films-production-house.html",
    "Passion Studios":            "passion-studios-production-house.html",
    "Applause Entertainment":     "applause-entertainment-production-house.html",
    "Dil Raju Productions":       "dil-raju-productions-production-house.html",
}

VERDICT_CFG = {
    "All-Time Blockbuster":  {"color":"#7C3AED","bg":"#F5F3FF","label":"ALL-TIME BLOCKBUSTER"},
    "Super Blockbuster":     {"color":"#7C3AED","bg":"#F5F3FF","label":"SUPER BLOCKBUSTER"},
    "Blockbuster":           {"color":"#16A34A","bg":"#F0FDF4","label":"BLOCKBUSTER"},
    "Super Hit":             {"color":"#16A34A","bg":"#F0FDF4","label":"SUPER HIT"},
    "SUPER HIT":             {"color":"#16A34A","bg":"#F0FDF4","label":"SUPER HIT"},
    "Hit":                   {"color":"#16A34A","bg":"#F0FDF4","label":"HIT"},
    "HIT":                   {"color":"#16A34A","bg":"#F0FDF4","label":"HIT"},
    "Semi Hit":              {"color":"#D97706","bg":"#FFFBEB","label":"SEMI HIT"},
    "SEMI HIT":              {"color":"#D97706","bg":"#FFFBEB","label":"SEMI HIT"},
    "Plus":                  {"color":"#D97706","bg":"#FFFBEB","label":"PLUS"},
    "PLUS":                  {"color":"#D97706","bg":"#FFFBEB","label":"PLUS"},
    "Average":               {"color":"#6B7280","bg":"#F9FAFB","label":"AVERAGE"},
    "AVERAGE":               {"color":"#6B7280","bg":"#F9FAFB","label":"AVERAGE"},
    "Below Average":         {"color":"#DC2626","bg":"#FEF2F2","label":"BELOW AVERAGE"},
    "Flop":                  {"color":"#DC2626","bg":"#FEF2F2","label":"FLOP"},
    "FLOP":                  {"color":"#DC2626","bg":"#FEF2F2","label":"FLOP"},
    "Disaster":              {"color":"#DC2626","bg":"#FEF2F2","label":"DISASTER"},
    "Upcoming":              {"color":"#D97706","bg":"#FFFBEB","label":"UPCOMING"},
}

LANG_COLOR = {
    "Hindi":    {"bg":"#FEE2E2","color":"#C8201A"},
    "Telugu":   {"bg":"#DBEAFE","color":"#1D4ED8"},
    "Tamil":    {"bg":"#D1FAE5","color":"#065F46"},
    "Kannada":  {"bg":"#FEF3C7","color":"#92400E"},
    "Malayalam":{"bg":"#EDE9FE","color":"#5B21B6"},
}

def slugify(title):
    s = title.lower()
    s = re.sub(r"['\u2019]", "", s)
    s = re.sub(r"[:\u2013\u2014&,\.\(\)]", " ", s)
    s = re.sub(r"\s+", "-", s.strip())
    s = re.sub(r"-+", "-", s)
    return s.strip("-")

def fmt_cr(val):
    if not val or val == "—": return "—"
    s = str(val).replace("₹","").replace(" Cr","").replace(",","").strip()
    try:
        n = float(s)
        if n == int(n):
            return f"₹{int(n):,} Cr"
        return f"₹{n:,.2f} Cr"
    except:
        return f"₹{val}" if not str(val).startswith("₹") else str(val)

def roi_text(budget_raw, india_net_raw):
    try:
        b = float(str(budget_raw).replace("₹","").replace(" Cr","").replace(",","").replace("~","").strip())
        n = float(str(india_net_raw).replace("₹","").replace(" Cr","").replace(",","").strip())
        roi = n / b
        if roi >= 3:   return f"{roi:.1f}× India return", "#16A34A"
        if roi >= 1.5: return f"{roi:.1f}× India return", "#D97706"
        if roi >= 1.0: return f"{roi:.1f}× India return (recovered)", "#6B7280"
        return f"{roi:.1f}× India return (loss)", "#DC2626"
    except:
        return None, None

def verdict_cfg(v):
    return VERDICT_CFG.get(v, {"color":"#6B7280","bg":"#F9FAFB","label": str(v).upper() if v else "—"})

def generate_page(film, year, all_films_by_year):
    title   = film.get('title','')
    lang    = film.get('language','Hindi')
    dir_    = film.get('director','')
    release = film.get('releaseDate','')
    ww      = film.get('totalCollection','—')
    india   = film.get('indiaNet','—')
    overseas= film.get('overseas','—')
    budget  = film.get('budget','—')
    verdict = film.get('verdict','—')
    status  = film.get('status','OTT')
    poster  = film.get('posterUrl','')
    note    = film.get('note','')
    cast_   = film.get('cast','')
    wks     = film.get('weeksInTop10',0)
    ott     = film.get('ott') or {}
    studio  = film.get('studio','')
    slug    = film.get('pageUrl', slugify(title) + '-box-office.html')
    url     = f"https://boxoffy.com/{slug}"

    vcfg = verdict_cfg(verdict)
    lcfg = LANG_COLOR.get(lang, {"bg":"#F3F4F6","color":"#374151"})
    studio_page = STUDIO_PAGES.get(studio,'')
    roi_label, roi_color = roi_text(budget, india)

    # SEO
    ww_str = f"₹{ww} Cr" if ww and ww != '—' and not str(ww).startswith('₹') else str(ww)
    india_str = f"₹{india} Cr" if india and india != '—' and not str(india).startswith('₹') else str(india)
    meta_desc = f"{title} ({year}) box office collection. {lang} film directed by {dir_}. {f'Worldwide: {ww_str}.' if ww != chr(8212) else ''} {f'India Nett: {india_str}.' if india != chr(8212) else ''} Verdict: {verdict}. Boxoffy."
    meta_kw   = f"{title} box office, {title} collection, {title} {year}, {dir_} film, {lang} box office {year}"

    # Related films from same year
    year_films = [f for f in all_films_by_year.get(str(year),[])
                  if f.get('title') != title and f.get('pageUrl') and f.get('verdict')]
    related = sorted(year_films, key=lambda x: -(x.get('totalNum') or 0))[:6]

    # Box office bar (vs all-time max 2059)
    try:
        ww_num = float(str(ww).replace(',','').replace(' Cr',''))
        bar_pct = min(ww_num / 2059 * 100, 100)
    except:
        bar_pct = 0

    # OTT section
    ott_platform = ott.get('platform','')
    ott_date     = ott.get('ottDate','')
    ott_views    = ott.get('debutViews','')
    ott_note     = ott.get('ottNote','')

    def stat_block(label, val, sub='', highlight=False):
        col = '#C8201A' if highlight else '#111827'
        return f'''<div class="stat-block">
          <div class="stat-val" style="color:{col}">{val if val and val!='—' else '—'}</div>
          <div class="stat-label">{label}</div>
          {f'<div class="stat-sub">{sub}</div>' if sub else ''}
        </div>'''

    def related_card(rf):
        rv = verdict_cfg(rf.get('verdict',''))
        rl = LANG_COLOR.get(rf.get('language','Hindi'), {"bg":"#F3F4F6","color":"#374151"})
        rp = rf.get('posterUrl','')
        return f'''<a href="/{rf['pageUrl']}" class="related-card">
          <div class="related-poster">
            {'<img src="'+rp+'" alt="'+rf['title']+'" loading="lazy" onerror="this.style.display=\'none\'">' if rp else '<div class="related-initials">'+rf['title'][:3].upper()+'</div>'}
          </div>
          <div class="related-info">
            <div class="related-title">{rf['title']}</div>
            <div class="related-verdict" style="color:{rv['color']};background:{rv['bg']}">{rv['label']}</div>
            <div class="related-lang" style="color:{rl['color']};background:{rl['bg']}">{rf.get('language','')}</div>
          </div>
        </a>'''

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <script>
  (function(){{var c=null;try{{c=localStorage.getItem("boxoffy_cookie_consent");}}catch(e){{}}
  if(c==="accepted"){{var s=document.createElement("script");s.async=true;
  s.src="https://www.googletagmanager.com/gtag/js?id=G-K6C9EVRFH4";
  document.head.appendChild(s);window.dataLayer=window.dataLayer||[];
  window.gtag=function(){{window.dataLayer.push(arguments);}};
  gtag("js",new Date());gtag("config","G-K6C9EVRFH4",{{anonymize_ip:true}});}}}})();
  </script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} Box Office Collection ({year}) | Boxoffy</title>
<meta name="description" content="{meta_desc}">
<meta name="keywords" content="{meta_kw}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta property="og:title" content="{title} Box Office Collection ({year}) | Boxoffy">
<meta property="og:description" content="{meta_desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{poster if poster else 'https://boxoffy.com/og-image.png'}">
<meta property="og:site_name" content="Boxoffy — India Box Office Intelligence">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title} Box Office ({year})">
<meta name="twitter:description" content="{meta_desc[:200]}">
<meta name="twitter:image" content="{poster if poster else 'https://boxoffy.com/og-image.png'}">
<script type="application/ld+json">{{
  "@context":"https://schema.org","@type":"Article",
  "headline":"{title} Box Office Collection",
  "description":"{meta_desc[:200]}",
  "url":"{url}",
  "datePublished":"{year}-01-01","dateModified":"2026-03-22",
  "author":{{"@type":"Organization","name":"Boxoffy","url":"https://boxoffy.com"}},
  "publisher":{{"@type":"Organization","name":"Boxoffy","url":"https://boxoffy.com"}}
}}</script>
<link rel="canonical" href="{url}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
:root{{--red:#C8201A;--ink:#111827;--muted:#6B7280;--border:#E5E7EB;--surface:#FFFFFF;--alt:#F9FAFB;--gold:#B8860B}}
html{{scroll-behavior:smooth}}
body{{background:#FAFAFA;color:var(--ink);font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;font-size:14px}}
a{{color:inherit}}

/* NAV */
.nav{{background:#fff;border-bottom:2px solid var(--red);display:flex;align-items:center;padding:0 24px;height:52px;position:sticky;top:0;z-index:100;box-shadow:0 1px 8px rgba(0,0,0,.06);gap:0;overflow-x:auto}}
.nav-logo{{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;color:var(--ink);text-decoration:none;letter-spacing:-.02em;flex-shrink:0;margin-right:24px}}
.nav-logo span{{color:var(--red)}}
.nav-links{{display:flex;gap:0;align-items:center}}
.nav-links a{{font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;color:#9CA3AF;text-decoration:none;padding:0 12px;letter-spacing:.05em;text-transform:uppercase;transition:color .15s;white-space:nowrap;line-height:52px}}
.nav-links a:hover{{color:var(--ink)}}
.nav-back{{font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;color:var(--muted);text-decoration:none;margin-left:auto;flex-shrink:0;white-space:nowrap;padding:0 0 0 16px}}
.nav-back:hover{{color:var(--red)}}

/* HERO */
.hero{{background:var(--ink);padding:0;overflow:hidden;position:relative}}
.hero-inner{{display:flex;align-items:stretch;max-width:1160px;margin:0 auto;padding:40px 32px;gap:32px}}
.hero-poster{{flex-shrink:0;width:160px}}
.hero-poster img{{width:160px;border-radius:4px;display:block;box-shadow:0 8px 32px rgba(0,0,0,.4)}}
.hero-poster-placeholder{{width:160px;height:240px;background:#1F2937;border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;color:#4B5563}}
.hero-body{{flex:1;min-width:0}}
.hero-breadcrumb{{font-family:'DM Sans',sans-serif;font-size:11px;color:#6B7280;margin-bottom:12px}}
.hero-breadcrumb a{{color:#6B7280;text-decoration:none}}
.hero-breadcrumb a:hover{{color:#9CA3AF}}
.hero-title{{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(28px,4vw,48px);color:#fff;letter-spacing:-.02em;line-height:1.05;margin-bottom:12px}}
.hero-meta{{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:20px}}
.badge{{display:inline-block;padding:2px 8px;border-radius:3px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:10px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}}
.verdict-badge{{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;padding:4px 12px;border-radius:3px;border:2px solid currentColor}}
.hero-stats{{display:flex;gap:0;flex-wrap:wrap;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;overflow:hidden;margin-top:4px}}
.hero-stat{{padding:12px 20px;border-right:1px solid rgba(255,255,255,.1);flex:1;min-width:100px}}
.hero-stat:last-child{{border-right:none}}
.hero-stat-val{{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:#fff;line-height:1}}
.hero-stat-label{{font-family:'DM Sans',sans-serif;font-size:9px;color:#9CA3AF;letter-spacing:.1em;text-transform:uppercase;margin-top:4px}}

/* MAIN */
.main{{max-width:1160px;margin:0 auto;padding:32px 32px 64px;display:grid;grid-template-columns:1fr 300px;gap:32px;align-items:start}}
.section{{margin-bottom:28px}}
.section-title{{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;color:var(--ink);letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid var(--border);padding-bottom:8px;margin-bottom:16px}}

/* STAT GRID */
.stat-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:20px}}
.stat-block{{background:var(--surface);padding:14px 16px}}
.stat-val{{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:var(--ink);line-height:1}}
.stat-label{{font-family:'DM Sans',sans-serif;font-size:9px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-top:4px}}
.stat-sub{{font-family:'DM Sans',sans-serif;font-size:10px;color:var(--muted);margin-top:3px}}

/* ROI / VERDICT BAR */
.verdict-row{{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--border);border-radius:4px;margin-bottom:16px;background:var(--surface)}}
.roi-bar-wrap{{flex:1;height:6px;background:#F3F4F6;border-radius:3px;overflow:hidden}}
.roi-bar{{height:100%;border-radius:3px;transition:width .4s ease}}

/* NOTE */
.note-box{{background:#F9FAFB;border-left:4px solid var(--red);padding:14px 16px;font-family:'DM Sans',sans-serif;font-size:13px;color:#374151;line-height:1.7;border-radius:0 4px 4px 0;margin-bottom:16px}}

/* OTT */
.ott-card{{border:1px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:16px}}
.ott-card-head{{background:#111827;padding:10px 16px;display:flex;align-items:center;gap:10px}}
.ott-platform{{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;color:#fff}}
.ott-row{{display:flex;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border);font-family:'DM Sans',sans-serif;font-size:12px}}
.ott-row:last-child{{border-bottom:none}}
.ott-label{{color:var(--muted)}}
.ott-val{{font-weight:600;color:var(--ink)}}

/* SIDEBAR */
.sidebar-card{{background:var(--surface);border:1px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:16px}}
.sidebar-head{{background:#F3F4F6;padding:8px 14px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}}
.sidebar-row{{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--border);font-family:'DM Sans',sans-serif;font-size:12px}}
.sidebar-row:last-child{{border-bottom:none}}
.sidebar-key{{color:var(--muted)}}
.sidebar-val{{font-weight:600;color:var(--ink);text-align:right}}

/* RELATED */
.related-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}}
.related-card{{background:var(--surface);border:1px solid var(--border);border-radius:4px;overflow:hidden;text-decoration:none;display:block;transition:box-shadow .15s}}
.related-card:hover{{box-shadow:0 2px 12px rgba(0,0,0,.1)}}
.related-poster{{height:90px;overflow:hidden;background:#F3F4F6;display:flex;align-items:center;justify-content:center}}
.related-poster img{{width:100%;height:100%;object-fit:cover;display:block}}
.related-initials{{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;color:#9CA3AF}}
.related-info{{padding:8px 10px}}
.related-title{{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;color:var(--ink);line-height:1.2;margin-bottom:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}}
.related-verdict{{font-family:'DM Sans',sans-serif;font-weight:700;font-size:8px;letter-spacing:.06em;text-transform:uppercase;padding:1px 5px;border-radius:2px;display:inline-block;margin-bottom:3px}}
.related-lang{{font-family:'DM Sans',sans-serif;font-weight:600;font-size:8px;letter-spacing:.06em;padding:1px 5px;border-radius:2px;display:inline-block}}

/* SHARE */
.share-bar{{display:flex;align-items:center;gap:8px;padding:14px 0;border-top:1px solid var(--border);flex-wrap:wrap;margin-top:8px}}
.share-label{{font-family:'DM Sans',sans-serif;font-weight:700;font-size:11px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase}}
.share-btn{{font-family:'DM Sans',sans-serif;font-weight:700;font-size:11px;padding:5px 14px;border-radius:3px;text-decoration:none;border:none;cursor:pointer;transition:opacity .15s}}
.share-btn:hover{{opacity:.85}}
.share-btn.wa{{background:#25D366;color:#fff}}
.share-btn.x{{background:#000;color:#fff}}
.share-btn.copy{{background:#F3F4F6;color:#374151}}

/* FOOTER */
.footer{{background:#111827;color:#9CA3AF;text-align:center;padding:28px 24px;font-family:'DM Sans',sans-serif;font-size:11px;line-height:1.8}}
.footer a{{color:#6B7280;text-decoration:none}}
.footer a:hover{{color:#9CA3AF}}

/* MOBILE */
@media(max-width:640px){{
  .hero-inner{{flex-direction:column;padding:24px 16px;gap:20px}}
  .hero-poster{{width:100px}}
  .hero-poster img{{width:100px}}
  .hero-poster-placeholder{{width:100px;height:150px;font-size:20px}}
  .hero-stats{{flex-direction:row;flex-wrap:wrap}}
  .hero-stat{{min-width:33%}}
  .main{{grid-template-columns:1fr;padding:20px 16px 40px}}
  .stat-grid{{grid-template-columns:repeat(2,1fr)}}
  .related-grid{{grid-template-columns:repeat(2,1fr)}}
  .nav{{padding:0 16px}}
  .nav-links{{display:none}}
}}
</style>
</head>
<body>

<nav class="nav">
  <a class="nav-logo" href="/"><span>BOX</span>OF<span>FY</span></a>
  <div class="nav-links">
    <a href="/#box-office">Box Office</a>
    <a href="/#weekly">Weekly</a>
    <a href="/india-all-time-box-office.html">All-Time</a>
    <a href="/production-houses.html">Studios</a>
    <a href="/about.html">About</a>
  </div>
  <a class="nav-back" href="/india-box-office-{year}.html">← {year} Chart</a>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-inner">
    <div class="hero-poster">
      {'<img src="'+poster+'" alt="'+title+' poster" loading="eager" onerror="this.outerHTML=\'<div class=hero-poster-placeholder>'+title[:3].upper()+'</div>\'">' if poster else '<div class="hero-poster-placeholder">'+title[:3].upper()+'</div>'}
    </div>
    <div class="hero-body">
      <div class="hero-breadcrumb">
        <a href="/">Boxoffy</a> › <a href="/india-box-office-{year}.html">{year}</a> › {title}
      </div>
      <h1 class="hero-title">{title}</h1>
      <div class="hero-meta">
        <span class="badge" style="background:{lcfg['bg']};color:{lcfg['color']}">{lang}</span>
        {'<span class="badge" style="background:#F3F4F6;color:#374151">'+release+'</span>' if release else ''}
        {'<span class="badge" style="background:#F3F4F6;color:#374151">Dir. '+dir_+'</span>' if dir_ else ''}
        {'<span class="badge" style="background:#F3F4F6;color:#374151">'+cast_+'</span>' if cast_ else ''}
      </div>
      <div style="margin-bottom:16px">
        <span class="verdict-badge" style="color:{vcfg['color']};border-color:{vcfg['color']};background:{vcfg['bg']}">{vcfg['label']}</span>
      </div>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-val" style="color:#4ADE80">{fmt_cr(ww) if ww and ww!='—' else '—'}</div>
          <div class="hero-stat-label">Worldwide</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-val" style="color:#93C5FD">{fmt_cr(india) if india and india!='—' else '—'}</div>
          <div class="hero-stat-label">India Nett</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-val" style="color:#FCD34D">{fmt_cr(overseas) if overseas and overseas!='—' else '—'}</div>
          <div class="hero-stat-label">Overseas</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-val" style="color:#F9A8D4">{f'₹{budget} Cr' if budget and budget!='—' and not str(budget).startswith('₹') else (str(budget) if budget and budget!='—' else '—')}</div>
          <div class="hero-stat-label">Budget</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- MAIN -->
<main class="main">

  <!-- LEFT COLUMN -->
  <div>

    <!-- Box Office Breakdown -->
    <div class="section">
      <div class="section-title">Box Office Breakdown</div>
      <div class="stat-grid">
        {stat_block("Worldwide Gross", fmt_cr(ww), "All territories", True)}
        {stat_block("India Nett", fmt_cr(india), "Post-GST distributor share")}
        {stat_block("Overseas", fmt_cr(overseas), "All international markets")}
        {stat_block("Budget", f'₹{budget} Cr' if budget and budget!='—' and not str(budget).startswith('₹') else (str(budget) if budget and budget!='—' else '—'), "Production cost estimate")}
        {stat_block("Weeks in Top 10", str(wks) if wks else '—', f'{year} India chart')}
        {stat_block("Status", status, ott_platform if ott_platform else '')}
      </div>

      <!-- ROI bar -->
      {f"""<div class="verdict-row">
        <span style="font-family:'DM Sans',sans-serif;font-weight:700;font-size:12px;color:#374151;flex-shrink:0">{vcfg['label']}</span>
        <div class="roi-bar-wrap"><div class="roi-bar" style="width:{bar_pct:.1f}%;background:{vcfg['color']}"></div></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:{roi_color or '#6B7280'};flex-shrink:0">{roi_label or ''}</span>
      </div>""" if bar_pct > 0 else ''}

      <!-- Note / editorial -->
      {f'<div class="note-box">{note}</div>' if note else ''}
    </div>

    <!-- OTT -->
    {f'''<div class="section">
      <div class="section-title">OTT Performance</div>
      <div class="ott-card">
        <div class="ott-card-head">
          <span class="ott-platform">{ott_platform}</span>
          {f'<span style="font-family:\'DM Sans\',sans-serif;font-size:11px;color:#9CA3AF">Available from {ott_date}</span>' if ott_date else ''}
        </div>
        {f'<div class="ott-row"><span class="ott-label">Debut Views</span><span class="ott-val">{ott_views}</span></div>' if ott_views else ''}
        {f'<div class="ott-row"><span class="ott-label">Note</span><span class="ott-val" style="text-align:right;max-width:220px">{ott_note}</span></div>' if ott_note else ''}
      </div>
    </div>''' if ott_platform else ''}

    <!-- Related films -->
    {f'''<div class="section">
      <div class="section-title">More from {year}</div>
      <div class="related-grid">
        {''.join(related_card(rf) for rf in related)}
      </div>
    </div>''' if related else ''}

    <!-- Share bar -->
    <div class="share-bar">
      <span class="share-label">Share</span>
      <a href="https://wa.me/?text={title}+box+office+collection+%E2%80%94+Boxoffy+{url.replace(':','%3A').replace('/','%2F')}" target="_blank" rel="noopener" class="share-btn wa">WhatsApp</a>
      <a href="https://twitter.com/intent/tweet?text={title.replace(' ','+')}+box+office+%7C+{verdict}+%7C+Boxoffy&url={url.replace(':','%3A').replace('/','%2F')}" target="_blank" rel="noopener" class="share-btn x">𝕏 Share</a>
      <button onclick="navigator.clipboard.writeText('{url}').then(()=>{{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy Link',2000)}})" class="share-btn copy">Copy Link</button>
    </div>

  </div>

  <!-- SIDEBAR -->
  <div>

    <!-- Quick facts -->
    <div class="sidebar-card">
      <div class="sidebar-head">Film Details</div>
      {''.join(f'<div class="sidebar-row"><span class="sidebar-key">{k}</span><span class="sidebar-val">{v}</span></div>' for k,v in [
        ("Language", lang),
        ("Director", dir_),
        ("Release", release),
        ("Cast", cast_[:60]+'…' if cast_ and len(cast_)>60 else cast_),
        ("Budget", f'₹{budget} Cr' if budget and budget!='—' and not str(budget).startswith('₹') else str(budget)),
        ("Verdict", verdict),
        ("OTT", ott_platform),
        ("Weeks #1", str(wks) if wks else '—'),
      ] if v and v != '—' and v != 'None')}
    </div>

    <!-- Studio link -->
    {f'''<div class="sidebar-card">
      <div class="sidebar-head">Production</div>
      <div class="sidebar-row">
        <span class="sidebar-key">Studio</span>
        <a href="/{studio_page}" style="font-weight:700;font-size:12px;color:#C8201A;text-decoration:none">{studio} ↗</a>
      </div>
    </div>''' if studio and studio_page else ''}

    <!-- Year chart link -->
    <div class="sidebar-card">
      <div class="sidebar-head">Browse</div>
      <div class="sidebar-row">
        <span class="sidebar-key">{year} India Chart</span>
        <a href="/india-box-office-{year}.html" style="font-weight:700;font-size:12px;color:#C8201A;text-decoration:none">View →</a>
      </div>
      <div class="sidebar-row">
        <span class="sidebar-key">All-Time Grossers</span>
        <a href="/india-all-time-box-office.html" style="font-weight:700;font-size:12px;color:#C8201A;text-decoration:none">View →</a>
      </div>
      <div class="sidebar-row">
        <span class="sidebar-key">Weekly Chart</span>
        <a href="/" style="font-weight:700;font-size:12px;color:#C8201A;text-decoration:none">Live →</a>
      </div>
    </div>

  </div>

</main>

<footer class="footer">
  <p style="margin-bottom:6px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;color:#E5E7EB;letter-spacing:.1em">BOXOFFY · BOX OFFICE INTELLIGENCE</p>
  <p><a href="/">Home</a> · <a href="/india-all-time-box-office.html">All-Time</a> · <a href="/production-houses.html">Studios</a> · <a href="/about.html">About</a></p>
  <p style="margin-top:8px">© 2026 Boxoffy.com · All figures in ₹ Crores · Last updated March 22, 2026</p>
</footer>

</body>
</html>'''

    return html, slug


def main():
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Build year → films lookup
    all_films_by_year = {yr: films for yr, films in data.items() if isinstance(films, list)}

    slugs_added = 0
    pages_generated = 0
    skipped_upcoming = 0

    for year, films in all_films_by_year.items():
        for film in films:
            # Skip upcoming films without data
            if film.get('status') == 'Upcoming' and not film.get('totalNum'):
                skipped_upcoming += 1
                continue

            # Assign pageUrl if missing
            if not film.get('pageUrl'):
                film['pageUrl'] = slugify(film['title']) + '-box-office.html'
                slugs_added += 1

            slug = film['pageUrl']
            html, _ = generate_page(film, year, all_films_by_year)

            out_path = os.path.join(OUTPUT_DIR, slug)
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(html)
            pages_generated += 1

    # Save updated films.json with new slugs
    with open(INPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ {pages_generated} film pages generated → {OUTPUT_DIR}/")
    print(f"   {slugs_added} new pageUrl slugs assigned and saved to films.json")
    print(f"   {skipped_upcoming} upcoming films skipped (no data yet)")


if __name__ == '__main__':
    main()
