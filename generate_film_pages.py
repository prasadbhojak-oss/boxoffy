"""
BOXOFFY — Film Page Generator
Run locally: python generate_film_pages.py
Reads: src/data/films.json
Writes: public/{slug}-box-office.html for every film with a pageUrl
"""
import json, re, os, sys

DATA_PATH   = "src/data/films.json"
OUTPUT_DIR  = "public"
BRAND_RED   = "#C8201A"
BRAND_NAVY  = "#0D1B2A"

def verdict_color(v):
    if "All-Time Blockbuster" in v: return ("#FEF3C7", "#92400E", "#FCD34D")
    if "Blockbuster" in v:          return ("#D1FAE5", "#065F46", "#6EE7B7")
    if "Super Hit" in v:            return ("#DCFCE7", "#166534", "#86EFAC")
    if "Hit" in v:                  return ("#DBEAFE", "#1E40AF", "#93C5FD")
    if "Average" in v:              return ("#F3F4F6", "#374151", "#D1D5DB")
    if "OTT" in v:                  return ("#EDE9FE", "#5B21B6", "#C4B5FD")
    if "Flop" in v:                 return ("#FEE2E2", "#991B1B", "#FCA5A5")
    if "Disaster" in v:             return ("#FCE7F3", "#9D174D", "#F9A8D4")
    return ("#F3F4F6", "#374151", "#D1D5DB")

def stat_block(label, value, accent="#374151"):
    if not value or value in ("—", "0", "₹0 Cr", "", None): return ""
    return f"""
    <div style="text-align:center;padding:12px 8px;">
      <div style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;color:{accent};line-height:1">{value}</div>
      <div style="font-family:'DM Sans',sans-serif;font-size:10px;color:#6B7280;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">{label}</div>
    </div>"""

def generate_page(film):
    title       = film.get("title", "Unknown")
    language    = film.get("language", "")
    director    = film.get("director", "")
    cast        = ", ".join(film.get("cast", [])[:5])
    date        = film.get("releaseDate", "")
    budget      = film.get("budget", "—")
    india_net   = film.get("indiaNet", "—")
    ww_gross    = film.get("wwGross", "—")
    overseas    = film.get("overseas", "—")
    verdict     = film.get("verdict", "—")
    dist        = film.get("distributor", "")
    od          = film.get("openingDay", "—")
    ow          = film.get("openingWeekend", "—")
    wk1         = film.get("week1", "—")
    poster      = film.get("posterUrl", "")
    note        = film.get("note", "")
    ott         = film.get("ott", {}) or {}
    ott_platform= ott.get("platform", "") if isinstance(ott, dict) else ""

    vbg, vcol, vborder = verdict_color(verdict)
    slug = film.get("pageUrl", "")

    # Day-wise box office if available from betaBreakdown
    daywise_html = ""
    bb = film.get("betaBreakdown", {})
    if isinstance(bb, dict) and bb.get("confirmed_daywise"):
        dw = bb["confirmed_daywise"]
        days_html = ""
        for i in range(8):
            key = f"D{i}_nett"
            if key in dw and dw[key]:
                days_html += f"""<div style="text-align:center;padding:8px 6px;border-right:0.5px solid #F3F4F6">
                  <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;color:#111827">₹{dw[key]} Cr</div>
                  <div style="font-family:'DM Sans',sans-serif;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em">D{i}</div>
                </div>"""
        if days_html:
            daywise_html = f"""
  <div style="margin:24px 0;background:#fff;border:0.5px solid #E5E7EB;border-radius:8px;overflow:hidden">
    <div style="padding:10px 14px;border-bottom:0.5px solid #E5E7EB;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:#374151;letter-spacing:.06em;text-transform:uppercase">Day-wise collection</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr))">{days_html}</div>
  </div>"""

    poster_html = ""
    if poster:
        poster_html = f'<img src="{poster}" alt="{title} poster" style="width:100%;max-width:180px;border-radius:6px;display:block;margin:0 auto 16px" loading="lazy" onerror="this.style.display=\'none\'">'

    brs = film.get("brs", {})
    brs_html = ""
    if isinstance(brs, dict) and brs.get("score"):
        sc = brs["score"]
        lbl = brs.get("label","")
        prov = "⚡" if brs.get("audienceWeek") == 1 else "✅"
        sc_col = "#15803D" if sc >= 80 else "#B45309" if sc >= 65 else "#B91C1C"
        sc_bg  = "#F0FDF4" if sc >= 80 else "#FFFBEB" if sc >= 65 else "#FEF2F2"
        brs_html = f"""
  <div style="display:inline-flex;align-items:center;gap:6px;background:{sc_bg};border:0.5px solid #D1D5DB;border-radius:6px;padding:6px 12px;margin-bottom:12px">
    <span style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:18px;color:{sc_col}">{sc}</span>
    <div>
      <div style="font-family:'DM Sans',sans-serif;font-size:9px;font-weight:700;color:{sc_col};letter-spacing:.1em;text-transform:uppercase">Boxoffy Review Score {prov}</div>
      <div style="font-family:'DM Sans',sans-serif;font-size:11px;color:{sc_col}">{lbl}</div>
    </div>
  </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title} Box Office Collection | Boxoffy</title>
  <meta name="description" content="{title} total box office collection — India nett {india_net}, worldwide {ww_gross}. {verdict} verdict. Verified data on Boxoffy.">
  <meta property="og:title" content="{title} Box Office Collection | Boxoffy">
  <meta property="og:description" content="{title} — India net {india_net} · WW {ww_gross} · {verdict}">
  <meta property="og:type" content="article">
  <link rel="canonical" href="https://boxoffy.com/{slug}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:'DM Sans',sans-serif;background:#F9FAFB;color:#111827;line-height:1.6}}
    a{{color:{BRAND_RED};text-decoration:none}}
    a:hover{{text-decoration:underline}}
    .container{{max-width:720px;margin:0 auto;padding:0 16px 48px}}
    .nav{{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1.5px solid #111827;margin-bottom:28px}}
    .nav-logo{{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;color:#111827;text-decoration:none}}
    .nav-logo span{{color:{BRAND_RED}}}
    .nav-back{{font-size:12px;color:#6B7280;margin-left:auto}}
    .verdict-pill{{display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border:0.5px solid {vborder};background:{vbg};color:{vcol}}}
    .stat-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));border:0.5px solid #E5E7EB;border-radius:8px;overflow:hidden;background:#fff;margin:20px 0}}
    .stat-grid > div{{border-right:0.5px solid #E5E7EB}}
    .meta-row{{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}}
    .tag{{font-size:10px;font-weight:600;padding:2px 7px;border-radius:3px;background:#F3F4F6;color:#374151;letter-spacing:.05em}}
    h1{{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:32px;color:#111827;line-height:1.1;margin:10px 0 8px}}
    .section-title{{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#374151;margin:24px 0 10px;padding-bottom:4px;border-bottom:1.5px solid #E5E7EB}}
    .detail-table{{width:100%;border-collapse:collapse;font-size:13px}}
    .detail-table td{{padding:8px 0;border-bottom:0.5px solid #F3F4F6;vertical-align:top}}
    .detail-table td:first-child{{color:#6B7280;width:140px;font-size:12px}}
    .footer{{margin-top:40px;padding-top:16px;border-top:0.5px solid #E5E7EB;font-size:11px;color:#9CA3AF;text-align:center}}
  </style>
</head>
<body>
<div class="container">
  <nav class="nav">
    <a href="/" class="nav-logo">BOXOF<span>FY</span></a>
    <span class="nav-back"><a href="/">← Back to charts</a></span>
  </nav>

  <div>
    {poster_html}
    <div class="meta-row">
      <span class="tag">{language}</span>
      {f'<span class="tag">{date}</span>' if date else ''}
      {f'<span class="tag">{dist}</span>' if dist else ''}
    </div>
    <h1>{title}</h1>
    <div style="margin-bottom:12px">
      <span class="verdict-pill">{verdict}</span>
    </div>
    {brs_html}

    <div class="stat-grid">
      {stat_block("India Nett", india_net, BRAND_RED)}
      {stat_block("Worldwide", ww_gross, BRAND_NAVY)}
      {stat_block("Overseas", overseas, "#1D4ED8")}
      {stat_block("Budget", budget, "#374151")}
      {stat_block("Opening Day", f"₹{od} Cr" if od and od != "—" else "—", "#15803D")}
      {stat_block("Opening Weekend", f"₹{ow} Cr" if ow and ow != "—" else "—", "#0369A1")}
      {stat_block("Week 1", f"₹{wk1} Cr" if wk1 and wk1 != "—" else "—", "#7C3AED")}
    </div>

    {daywise_html}

    <div class="section-title">Film Details</div>
    <table class="detail-table">
      <tr><td>Director</td><td>{director or "—"}</td></tr>
      <tr><td>Cast</td><td>{cast or "—"}</td></tr>
      <tr><td>Language</td><td>{language or "—"}</td></tr>
      <tr><td>Release Date</td><td>{date or "—"}</td></tr>
      <tr><td>Distributor</td><td>{dist or "—"}</td></tr>
      {f'<tr><td>OTT Platform</td><td>{ott_platform}</td></tr>' if ott_platform else ''}
    </table>

    {f'<div class="section-title">Boxoffy Note</div><p style="font-size:14px;color:#374151;line-height:1.7">{note}</p>' if note else ''}

    <div class="section-title">Box Office Breakdown</div>
    <table class="detail-table">
      <tr><td>India Nett</td><td style="font-weight:600">{india_net}</td></tr>
      <tr><td>Worldwide Gross</td><td>{ww_gross}</td></tr>
      <tr><td>Overseas</td><td>{overseas}</td></tr>
      <tr><td>Budget</td><td>{budget}</td></tr>
      <tr><td>Opening Day</td><td>{f"₹{od} Cr" if od and od != "—" else "—"}</td></tr>
      <tr><td>Opening Weekend</td><td>{f"₹{ow} Cr" if ow and ow != "—" else "—"}</td></tr>
      <tr><td>Week 1</td><td>{f"₹{wk1} Cr" if wk1 and wk1 != "—" else "—"}</td></tr>
    </table>

    <p style="margin-top:28px;font-size:12px;color:#9CA3AF">
      Data sourced from Box Office India, Film Information, Sacnilk, and Koimoi. 
      Collection figures are India nett unless stated otherwise.
      <a href="/brs-methodology">About BRS scoring →</a>
    </p>
  </div>

  <div class="footer">
    <a href="/">boxoffy.com</a> · India's box office, verified numbers, honest verdicts.
  </div>
</div>
</body>
</html>"""

if __name__ == "__main__":
    with open(DATA_PATH, encoding="utf-8") as f:
        films_data = json.load(f)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    generated = 0
    skipped   = 0

    for year, film_list in films_data.items():
        if not isinstance(film_list, list):
            continue
        for film in film_list:
            page_url = film.get("pageUrl", "")
            if not page_url or not page_url.endswith(".html"):
                skipped += 1
                continue
            html = generate_page(film)
            out_path = os.path.join(OUTPUT_DIR, page_url)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(html)
            generated += 1

    print(f"Generated {generated} pages → {OUTPUT_DIR}/")
    print(f"Skipped {skipped} films (no pageUrl)")
