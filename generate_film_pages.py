#!/usr/bin/env python3
"""
BOXOFFY — Film Page Generator (FIXED)
Run from repo root:  python generate_film_pages_FIXED.py
Reads : src/data/films.json
Writes: public/{slug}-box-office.html for EVERY film that has data
        + writes slugs back into films.json so chart links always match filenames

KEY FIXES vs old version:
  1. Auto-assigns a pageUrl slug to any film missing one (instead of skipping it).
  2. Skips ONLY genuinely data-less upcoming films (no ghost pages).
  3. Writes films.json back so App.jsx chart links resolve to real files (no 404).
"""
import json, re, os, sys

DATA_PATH  = "src/data/films.json"
OUTPUT_DIR = "public"

# ---------- helpers ----------
def slugify(title):
    s = title.lower()
    s = s.replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s + "-box-office.html"

def verdict_palette(v):
    v = (v or "")
    if "All-Time Blockbuster" in v: return ("#FEF3C7","#92400E","#FCD34D")
    if "Blockbuster" in v:          return ("#D1FAE5","#065F46","#6EE7B7")
    if "Super Hit" in v:            return ("#DCFCE7","#166534","#86EFAC")
    if "Hit" in v:                  return ("#DBEAFE","#1E40AF","#93C5FD")
    if "OTT" in v:                  return ("#EDE9FE","#5B21B6","#C4B5FD")
    if "Average" in v:              return ("#F3F4F6","#374151","#D1D5DB")
    if "Disaster" in v:             return ("#FCE7F3","#9D174D","#F9A8D4")
    if "Flop" in v:                 return ("#FEE2E2","#991B1B","#FCA5A5")
    return ("#F3F4F6","#374151","#D1D5DB")

def has_data(f):
    """A film 'has data' if it carries any collection figure or an OTT/verdict marker."""
    if f.get("totalNum"): return True
    if f.get("indiaNet") and str(f.get("indiaNet")).strip() not in ("", "0", "₹0 Cr", "—"): return True
    v = (f.get("verdict") or "")
    if v and v not in ("—", "Coming Soon", ""): return True
    if f.get("ott"): return True
    return False

def stat(label, value, accent="#111827"):
    if not value or str(value).strip() in ("—","0","₹0 Cr","",None,"None"): return ""
    return (f'<div style="text-align:center;padding:12px 8px">'
            f'<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:900;font-size:22px;color:{accent};line-height:1">{value}</div>'
            f'<div style="font-family:\'DM Sans\',sans-serif;font-size:10px;color:#6B7280;letter-spacing:.08em;text-transform:uppercase;margin-top:3px">{label}</div>'
            f'</div>')

def esc(s):
    return (str(s or "")).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

# ---------- page template ----------
def build_page(f, year, siblings):
    title    = f.get("title","Unknown")
    lang     = f.get("language","")
    director = f.get("director","")
    cast     = f.get("cast","")
    verdict  = f.get("verdict","")
    indiaNet = f.get("indiaNet","")
    ww       = f.get("wwGross") or f.get("totalCollection") or ""
    overseas = f.get("overseas","")
    budget   = f.get("budget","")
    status   = f.get("status","")
    note     = f.get("note","")
    poster   = f.get("poster","")
    slug     = f.get("pageUrl")
    vbg,vfg,vbd = verdict_palette(verdict)

    poster_html = (f'<img src="{esc(poster)}" alt="{esc(title)} poster" style="width:150px;border-radius:8px;display:block" />'
                   if poster else
                   '<div style="width:150px;height:220px;border-radius:8px;background:#1f2937;display:flex;align-items:center;justify-content:center;color:#6B7280;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;text-align:center;padding:10px">'+esc(title)+'</div>')

    stats = "".join([
        stat("Worldwide", ww, "#111827"),
        stat("India Net", indiaNet, "#C8201A"),
        stat("Overseas", overseas, "#374151"),
        stat("Budget", budget, "#374151"),
    ])

    note_html = (f'<div style="margin:22px 0;padding:16px 18px;background:#FBFAF8;border-left:3px solid #C8201A;border-radius:0 8px 8px 0;font-family:\'DM Sans\',sans-serif;font-size:14.5px;line-height:1.6;color:#374151">{esc(note)}</div>'
                 if note else "")

    ott = f.get("ott") or {}
    ott_html = ""
    if ott:
        plat = ott.get("platform","") if isinstance(ott,dict) else ""
        date = ott.get("ottDate","") or (ott.get("date","") if isinstance(ott,dict) else "")
        views= ott.get("debutViews","") if isinstance(ott,dict) else ""
        rows = "".join(f'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E7E3DC"><span style="color:#6B7280;font-size:13px">{esc(k)}</span><span style="font-weight:700;font-size:13px">{esc(v)}</span></div>'
                       for k,v in [("Platform",plat),("Digital release",date),("Debut views",views)] if v)
        if rows:
            ott_html = f'<h2 style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;margin:26px 0 10px">OTT / Streaming</h2><div>{rows}</div>'

    # related films (same year, has slug, not this film)
    rel=[]
    for s in siblings:
        if s.get("pageUrl") and s.get("title")!=title and has_data(s):
            rel.append(s)
        if len(rel)>=6: break
    rel_html=""
    if rel:
        cards="".join(
            f'<a href="/{s["pageUrl"]}" style="text-decoration:none;color:inherit"><div style="border:1px solid #E7E3DC;border-radius:8px;padding:10px;background:#fff"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:800;font-size:15px;color:#111827;line-height:1.05">{esc(s["title"])}</div><div style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#6B7280;margin-top:4px">{esc(s.get("language",""))} · {esc(s.get("verdict","") or s.get("indiaNet",""))}</div></div></a>'
            for s in rel)
        rel_html=f'<h2 style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;margin:26px 0 10px">More from {esc(year)}</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">{cards}</div>'

    share_txt = f"{title} box office: {indiaNet or ww or ''} — via Boxoffy".strip(" —")
    from urllib.parse import quote
    share_url = f"https://www.boxoffy.com/{slug}"
    wa = "https://wa.me/?text="+quote(share_txt+" "+share_url)
    xs = "https://twitter.com/intent/tweet?text="+quote(share_txt)+"&url="+quote(share_url)

    return f'''<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{esc(title)} Box Office Collection{(" — "+esc(indiaNet)+" India Net") if indiaNet else ""} | Boxoffy</title>
<meta name="description" content="{esc(title)} ({esc(year)}) box office collection: India net {esc(indiaNet or "n/a")}, worldwide {esc(ww or "n/a")}. Verdict: {esc(verdict or "n/a")}. Director {esc(director or "n/a")}. Verified data on Boxoffy." />
<link rel="canonical" href="{share_url}" />
<meta property="og:title" content="{esc(title)} Box Office Collection | Boxoffy" />
<meta property="og:description" content="India net {esc(indiaNet or "n/a")} · Worldwide {esc(ww or "n/a")} · {esc(verdict or "")}" />
<meta property="og:type" content="article" /><meta name="twitter:card" content="summary" />
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
  *{{box-sizing:border-box}} body{{margin:0;background:#FBFAF8;color:#111827;font-family:'DM Sans',sans-serif}}
  a{{color:#C8201A}} .wrap{{max-width:900px;margin:0 auto;padding:20px}}
  .topbar{{background:#0D1B2A;color:#fff;padding:10px 20px;font-family:'Barlow Condensed',sans-serif;font-weight:800;letter-spacing:.12em}}
  .topbar a{{color:#fff;text-decoration:none}}
  .hero{{display:flex;gap:22px;background:linear-gradient(135deg,#141c2b,#0e131d);border-radius:12px;padding:24px;color:#fff;align-items:flex-start}}
  .hero h1{{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:34px;margin:0 0 6px;line-height:1}}
  .badge{{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:11px;padding:4px 10px;border-radius:20px;background:{vbg};color:{vfg};border:1px solid {vbd};margin-top:8px}}
  .meta{{font-family:'IBM Plex Mono',monospace;font-size:12px;color:#9db2c8;margin-top:8px;line-height:1.6}}
  .statbar{{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;background:#fff;border:1px solid #E7E3DC;border-radius:10px;margin:16px 0}}
  .crumb{{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#6B7280;margin:14px 0}}
  .sharebar{{display:flex;gap:8px;margin:20px 0}}
  .sharebar a{{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;padding:8px 14px;border:1px solid #E7E3DC;border-radius:6px;text-decoration:none;color:#111827}}
  footer{{border-top:1px solid #E7E3DC;margin-top:30px;padding:18px 0;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#6B7280}}
  @media(max-width:640px){{.hero{{flex-direction:column;align-items:center;text-align:center}}.statbar{{grid-template-columns:repeat(2,1fr)}}}}
</style></head><body>
<div class="topbar"><a href="/">BOXOFFY</a></div>
<div class="wrap">
  <div class="crumb"><a href="/">Home</a> › <a href="/india-box-office-{esc(year)}.html">{esc(year)}</a> › {esc(title)}</div>
  <div class="hero">
    <div>{poster_html}</div>
    <div>
      <h1>{esc(title)}</h1>
      <div class="meta">{esc(lang)}{(" · Dir. "+esc(director)) if director else ""}{(" · "+esc(status)) if status else ""}</div>
      {("<span class='badge'>"+esc(verdict)+"</span>") if verdict else ""}
      {("<div class='meta'>Cast: "+esc(cast)+"</div>") if cast else ""}
    </div>
  </div>
  <div class="statbar">{stats or '<div style="padding:16px;color:#6B7280;font-size:13px">Box office figures updating.</div>'}</div>
  {note_html}
  {ott_html}
  <div class="sharebar"><a href="{wa}">WhatsApp</a><a href="{xs}">Share on X</a></div>
  {rel_html}
  <footer>BOXOFFY · Box-office intelligence, calibrated · All figures approximate, compiled from BOI/Sacnilk · <a href="/">boxoffy.com</a></footer>
</div>
</body></html>'''

# ---------- main ----------
def main():
    if not os.path.exists(DATA_PATH):
        print("ERROR: %s not found. Run from repo root." % DATA_PATH); sys.exit(1)
    with open(DATA_PATH, encoding="utf-8") as fh:
        data = json.load(fh)

    years = {y:films for y,films in data.items() if isinstance(films,list)}
    generated=slugs_added=skipped=0
    used_slugs={}

    for year,films in years.items():
        for f in films:
            # skip ONLY dataless upcoming
            if not has_data(f):
                skipped+=1; continue
            # assign slug if missing
            if not f.get("pageUrl"):
                base=slugify(f["title"])
                s=base; n=2
                while s in used_slugs:            # de-dupe collisions
                    s=base.replace("-box-office.html", f"-{n}-box-office.html"); n+=1
                f["pageUrl"]=s; slugs_added+=1
            used_slugs[f["pageUrl"]]=True

    # generate after all slugs assigned (so related-links resolve)
    for year,films in years.items():
        for f in films:
            if not f.get("pageUrl"): continue
            html=build_page(f,year,films)
            with open(os.path.join(OUTPUT_DIR,f["pageUrl"]),"w",encoding="utf-8") as out:
                out.write(html)
            generated+=1

    # WRITE films.json BACK so chart links match generated filenames
    with open(DATA_PATH,"w",encoding="utf-8") as fh:
        json.dump(data,fh,ensure_ascii=False,indent=2)

    print(f"Generated {generated} pages -> {OUTPUT_DIR}/")
    print(f"Assigned {slugs_added} new slugs (written back to films.json)")
    print(f"Skipped {skipped} dataless upcoming films (correct)")

if __name__=="__main__":
    main()
