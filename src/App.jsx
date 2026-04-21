import React, { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════
   BOXOFFY — Box Office Intelligence
   Inspired by The Verge / Deadline / Variety
   Fonts: Barlow Condensed (headlines) + DM Sans (body)
═══════════════════════════════════════════════════════════ */

/* ── GOOGLE SHEETS CMS ──────────────────────────────────────────
   Paste your Google Sheet ID here to go live.
   Leave blank to use hardcoded data (fallback mode).

   HOW TO GET YOUR SHEET ID:
   Open your Google Sheet → look at the URL:
   https://docs.google.com/spreadsheets/d/YOUR_ID_IS_HERE/edit
   Copy the long string between /d/ and /edit

   SHEET TABS REQUIRED: Films | Year_Notes | Articles |
                         Weekly_Commentary | Analyst_Predictions
   See SHEETS_SETUP.md in the sheets-export/ folder for full guide.
──────────────────────────────────────────────────────────────── */
const SHEETS_ID = "1j7TrH2hVR9WjiMX2eExM4vgyjcedm2BJ9sF2D38_3Bk";   // ← PASTE YOUR SHEET ID HERE

const SHEETS_BASE = SHEETS_ID
  ? `https://docs.google.com/spreadsheets/d/${SHEETS_ID}/gviz/tq?tqx=out:csv&sheet=`
  : null;

// ── CSV parser (handles quoted fields with commas) ──
function parseCSVRow(line) {
  const result = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur=""; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i]||"").trim(); });
    return obj;
  });
}
async function fetchTab(tab) {
  if (!SHEETS_BASE) return null;
  try {
    const r = await fetch(`${SHEETS_BASE}${encodeURIComponent(tab)}`, { cache:"no-cache" });
    return r.ok ? parseCSV(await r.text()) : null;
  } catch { return null; }
}

// ── Row → film object ──
function rowToFilm(row) {
  const parseBool = v => v === "true" || v === true;
  const parseNullInt = v => (v !== "" && v != null) ? parseInt(v) : null;
  const parseNullFloat = v => (v !== "" && v != null) ? parseFloat(v) : null;
  return {
    title:row.title||"", language:row.language||"Hindi", director:row.director||"",
    releaseDate:row.releaseDate||"", totalCollection:row.totalCollection||"—",
    totalNum:parseFloat(row.totalNum)||0, indiaNet:row.indiaNet||"—",
    overseas:row.overseas||null, weeksInTop10:parseInt(row.weeksInTop10)||0,
    status:row.status||"OTT", budget:row.budget||"—", verdict:row.verdict||"—",
    note:row.note||undefined,
    weeklyCollection:parseFloat(row.weeklyCollection)||0,
    weekNum:parseInt(row.weekNum)||0, daysInRelease:parseInt(row.daysInRelease)||0,
    weeklyNote:row.weeklyNote||"",
    ww:row.ww||null,
    wwGross:row.wwGross||null,
    lastWeekCollection:parseNullFloat(row.lastWeekCollection),
    lastWeekRange:row.lastWeekRange||null,
    lastWeekRank:parseNullInt(row.lastWeekRank),
    showInMainChart:parseBool(row.showInMainChart),
    bogRank:parseNullInt(row.bogRank),
    estimated:parseBool(row.estimated),
    pageUrl:row.pageUrl||null,
    posterUrl:row.posterUrl||null,
    studio:row.studio||null,
    betaModel:parseBool(row.betaModel),
    wkTrend:row.wkTrend||null,
    openingPrediction: row.op_low ? {
      low:parseFloat(row.op_low), mid:parseFloat(row.op_mid),
      high:parseFloat(row.op_high), allLanguages:parseFloat(row.op_allLang)||0,
      basis:row.op_basis||"Boxoffy AI Calc", note:row.op_note||"",
    } : undefined,
  };
}

// ── Main loader — fetches all tabs in parallel ──
async function loadFromSheets() {
  if (!SHEETS_BASE) return null;
  const [films, notes, articles, weekly] = await Promise.all([
    fetchTab("Films"), fetchTab("Year_Notes"),
    fetchTab("Articles"), fetchTab("Weekly_Commentary"),
  ]);

  const out = {};

  if (films?.length) {
    // rawFilms: used for overlay merge against bundled JSON (only overrides matching titles)
    out.rawFilms = films.map(rowToFilm);
    // year-keyed structure: used when Sheet is the sole data source
    const d = {};
    films.forEach(r => {
      const y = parseInt(r.year); if (!y) return;
      if (!d[y]) d[y] = [];
      d[y].push(rowToFilm(r));
    });
    out.data = d;
  }

  if (notes?.length) {
    out.yearNotes = {};
    notes.forEach(r => { if (r.year && r.note) out.yearNotes[parseInt(r.year)] = r.note; });
  }

  if (articles?.length) {
    const cats = { Bollywood:[], OTT:[], TV:[] };
    articles.forEach(r => {
      if (!cats[r.category]) return;
      cats[r.category].push({
        tag:r.tag||"", time:r.time||"", hot:r.hot==="true",
        source:r.source||null, url:r.url||null,
        headline:r.headline||"", summary:r.summary||"",
      });
    });
    out.articles = cats;
  }

  if (weekly?.length) {
    out.weeklyCommentary = weekly.map(r => {
      const scoreboard = [];
      for (let i=1;i<=6;i++) {
        if (!r[`film${i}`]) continue;
        // field names match ScoreboardRow props: film, wkCollection, total
        scoreboard.push({
          film:r[`film${i}`],
          week:r[`film${i}_week`]||"",
          wkCollection:r[`film${i}_collection`]||"",
          total:r[`film${i}_total`]||"",
          verdict:r[`film${i}_verdict`]||"",
          color:r[`film${i}_color`]||"#6B7280",
        });
      }
      // sources: comma-separated string in sheet → array of name-only objects
      const srcArr = r.sources
        ? r.sources.split(",").map(s => ({ name:s.trim(), handle:"", quote:"", analysis:"", color:"#6B7280" }))
        : [];
      return {
        weekNum:r.weekNum||"", dateRange:r.dateRange||"",
        headline:r.headline||"", subline:r.subline||"",
        status:r.status||"archive", scoreboard,
        boxoffyTake:r.boxoffyTake||"",
        interval_take:r.intervalTake||r.interval_take||"",
        nextWeek:r.nextWeek||"",
        sources:srcArr,
      };
    });
  }

  const loaded = Object.keys(out);
  if (!loaded.length) return null;
  console.log(`[Boxoffy Sheets] ✓ ${loaded.join(", ")}`);
  return out;
}

// ── Merge Sheet override into bundled JSON ──
// Sheet contains only Running/active films. Bundled JSON has all historical data.
// For each film in Sheet, find matching film in bundled by title and override live fields.
function mergeSheetsIntoData(bundledData, rawFilms) {
  if (!rawFilms?.length) return bundledData;
  const overrides = {};
  rawFilms.forEach(f => { if (f.title) overrides[f.title.toLowerCase()] = f; });

  const merged = {};
  Object.entries(bundledData).forEach(([year, films]) => {
    merged[year] = films.map(f => {
      const ov = overrides[f.title?.toLowerCase()];
      return ov ? { ...f, ...ov } : f;
    });
  });

  // Add Sheet-only films not yet in bundled JSON (brand-new releases)
  const bundledTitles = new Set(
    Object.values(bundledData).flat().map(f => f.title?.toLowerCase())
  );
  const newFilms = rawFilms.filter(f => f.title && !bundledTitles.has(f.title.toLowerCase()));
  if (newFilms.length) {
    const yr = String(new Date().getFullYear());
    if (!merged[yr]) merged[yr] = [];
    merged[yr] = [...newFilms, ...merged[yr]];
  }
  return merged;
}

// ── Live data layer — starts as null, populated from Sheets on mount ──
// Components subscribe via useSheetData() to re-render when data arrives.
let liveData = null;
let liveWeekly = null;
const _sheetCallbacks = new Set();
function useSheetData() {
  const [, forceUpdate] = React.useState(0);
  React.useEffect(() => {
    const fn = () => forceUpdate(n => n + 1);
    _sheetCallbacks.add(fn);
    return () => _sheetCallbacks.delete(fn);
  }, []);
}
function triggerSheetRefresh() {
  _sheetCallbacks.forEach(fn => fn());
}
const T = {
  bg:         "#F4F5F7",
  surface:    "#FFFFFF",
  surfaceAlt: "#F0F2F5",
  border:     "#E2E5EA",
  borderDark: "#C8CDD6",
  text:       "#111827",
  textMid:    "#374151",
  textMuted:  "#6B7280",
  accent:     "#E8261A",   // cinematic red — kept
  accentDark: "#B81D12",
  gold:       "#D4920A",
  goldLight:  "#F5C518",
  green:      "#15803D",
  blue:       "#1D4ED8",
  purple:     "#6D28D9",
  ink:        "#111827",
};

// year accent colors (for tabs)
const YEAR_ACCENT = {
  2010:"#78716C", 2011:"#78716C", 2012:"#78716C", 2013:"#78716C", 2014:"#78716C",
  2015:"#78716C", 2016:"#78716C", 2017:"#78716C", 2018:"#78716C", 2019:"#78716C",
  2020:"#6B7280", 2021:"#2563EB", 2022:"#D97706", 2023:"#DC2626", 2024:"#7C3AED", 2025:"#059669", 2026:"#E8261A",
};
const YEARS         = [2020,2021,2022,2023,2024,2025,2026];
const ARCHIVE_YEARS = [2019,2018,2017,2016,2015,2014,2013,2012,2011,2010];
const LANGUAGES = ["All","Hindi","Tamil","Telugu","Kannada","Malayalam","Hollywood"];

const VERDICT_CFG = {
  "All-Time Blockbuster": { bg:"#FEF3C7", color:"#92400E", border:"#FCD34D" },
  "Blockbuster":          { bg:"#D1FAE5", color:"#065F46", border:"#6EE7B7" },
  "Super Hit":            { bg:"#DCFCE7", color:"#166534", border:"#86EFAC" },
  "Hit":                  { bg:"#DBEAFE", color:"#1E40AF", border:"#93C5FD" },
  "Average":              { bg:"#F3F4F6", color:"#374151", border:"#D1D5DB" },
  "Flop":                 { bg:"#FEE2E2", color:"#991B1B", border:"#FCA5A5" },
  "Disaster":             { bg:"#FCE7F3", color:"#9D174D", border:"#F9A8D4" },
  "OTT Hit":              { bg:"#EDE9FE", color:"#5B21B6", border:"#C4B5FD" },
  "Rerun":                { bg:"#F9FAFB", color:"#6B7280", border:"#E5E7EB" },
  "Upcoming":             { bg:"#FFF7ED", color:"#9A3412", border:"#FED7AA" },
  "Pending":              { bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE" },
};

/* ── EVENT TIER CONFIG ───────────────────────────────────── */
const EVENT_TIER = {
  event: {
    label: "⚡ EVENT FILM",
    badgeBg: "#7C1D1D", badgeText: "#FFD700",
    borderColor: "#FFD700",
    rowBg: "#FFFBEB",
    rowBgHov: "#FEF3C7",
  },
  tentpole: {
    label: "🎬 TENTPOLE",
    badgeBg: "#1E3A5F", badgeText: "#93C5FD",
    borderColor: "#3B82F6",
    rowBg: "#EFF6FF",
    rowBgHov: "#DBEAFE",
  },
};

/* ── DATA IMPORTS ────────────────────────────────────────────────────────────
   Film and editorial data extracted to /src/data/ for maintainability.
   Edit JSON files directly — no need to touch App.jsx for data updates.
   ─────────────────────────────────────────────────────────────────────────── */
import DATA               from "./data/films.json";
import US_BO_WEEKLY       from "./data/us-bo-weekly.json";
import EDITORIALS         from "./data/editorials.json";
import YEAR_NOTES         from "./data/year-notes.json";
import ARTICLES           from "./data/articles.json";

// ── TMDB poster support ─────────────────────────────────────────────────────
const TMDB_BEARER = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2YWM1OTY0NzEyZTA0NGRmMmJjMmFiYzFlMTFlZGMyYyIsIm5iZiI6MTc3Mzg4NTMxMS42MzIsInN1YiI6IjY5YmI1NzdmYjgyMzJhNzc5MjIxZWZjOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.QxWkqL_4_3PfTnIVgcZYE0zlXQd9M2y5QL-oWNwq6dE";
const tmdbPosterCache = {};
function useTMDBPoster(title, year) {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    if (!title) return;
    const key = title + (year || "");
    if (tmdbPosterCache[key] !== undefined) { setUrl(tmdbPosterCache[key]); return; }
    const qs = "https://api.themoviedb.org/3/search/multi?query=" + encodeURIComponent(title) + (year ? "&year=" + year : "") + "&language=en-US&page=1";
    fetch(qs, {
      headers: { "Authorization": "Bearer " + TMDB_BEARER, "accept": "application/json" }
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      const hit = (d.results || []).find(function(r) { return r.poster_path; });
      const posterUrl = hit ? "https://image.tmdb.org/t/p/w92" + hit.poster_path : null;
      tmdbPosterCache[key] = posterUrl;
      setUrl(posterUrl);
    })
    .catch(function() { tmdbPosterCache[key] = null; });
  }, [title, year]);
  return url;
}
import FOOTNOTES          from "./data/footnotes.json";
import WEEKLY_COMMENTARY  from "./data/weekly-commentary.json";
import HISTORICAL_DATA    from "./data/films-historical.json";

/* ── SOURCE COLORS ── */
const SOURCE_COLORS = {
  "Box Office India":   { bg:"#1A1714", fg:"#fff" },
  "Sacnilk":            { bg:"#0369A1", fg:"#fff" },
  "Koimoi":             { bg:"#7C3AED", fg:"#fff" },
  "Bollywood Hungama":  { bg:"#DC2626", fg:"#fff" },
  "Variety":            { bg:"#111827", fg:"#fff" },
  "Deadline":           { bg:"#111827", fg:"#FACC15" },
  "The Hindu":          { bg:"#B91C1C", fg:"#fff" },
  "Economic Times":     { bg:"#1D4ED8", fg:"#fff" },
  "Pinkvilla":          { bg:"#DB2777", fg:"#fff" },
  "Mint Lounge":        { bg:"#065F46", fg:"#fff" },
  "Film Companion":     { bg:"#4F46E5", fg:"#fff" },
  "BARC India":         { bg:"#1E3A5F", fg:"#fff" },
  "India Today":        { bg:"#DC2626", fg:"#fff" },
  "Hindustan Times":    { bg:"#0F172A", fg:"#fff" },
  "Boxoffy":            { bg:"#E8261A", fg:"#fff" },
};

/* ── SOURCE → FOOTNOTE MAP ── */
const SOURCE_FN = {
  "Sacnilk":           1, "Box Office India":     1, "Bollymoviereviewz":   1,
  "Koimoi":            2, "Bollywood Hungama":    2, "Pinkvilla":           2,
  "Boxoffy AI Calc":   6, "Boxoffy":              6,
  "Venky BO":         10, "Box Office Mojo":      10, "The Numbers":        10,
  "Deadline":         10, "Variety":              10,
  "CBIC":              7, "PIB":                  8, "GST Council":         8,
  "BookMyShow":       11, "BMS":                  11,
  "Ormax":             4, "Ormax Media":          4,
  "Business Standard": 5, "Upstox":               5,
  "Wikipedia":         9, "CBFC":                 9,
  "MAI":               3, "Multiplex Association":3,
};

// Superscript footnote reference
/* ── MOBILE HOOK ─────────────────────────────────────────────── */
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

function Fn({ n, style = {} }) {
  if (!n) return null;
  const sup = String(n).split("").map(d => "\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079"[parseInt(d)]).join("");
  return (
    <sup style={{
      fontFamily:"'DM Sans',sans-serif", fontSize:8, color:"#9CA3AF",
      letterSpacing:0, verticalAlign:"super", lineHeight:0,
      cursor:"default", userSelect:"none",
      ...style,
    }} title={FOOTNOTES.find(f=>f.n===n)?.label || ""}>{sup}</sup>
  );
}

/* ── SHARE SHEET ─────────────────────────────────────────────── */
/* ── SHARE PANEL (inline — no fixed positioning) ── */
function SharePanel({ movie, onClose }) {
  const [copied, setCopied] = React.useState(null);

  const title   = movie.title || "";
  const wk      = movie.weeklyCollection > 0 ? "₹" + movie.weeklyCollection + " Cr" : "";
  const total   = movie.indiaNet || (movie.totalNum > 0 ? "₹" + movie.totalNum + " Cr" : "");
  const verdict = movie.verdict || "";
  const wkNum   = movie.weekNum > 0 ? "Wk " + movie.weekNum : "";
  const pageUrl = "https://boxoffy.com";   // always link to live weekly chart, not static film pages

  const tX       = title + (wk ? " — " + wk + " this week" : "") + (total ? " · " + total + " total" : "") + (verdict ? ". " + verdict + "." : "") + " #BoxOffice #Bollywood\n" + pageUrl;
  const tThreads = title + (wk ? " collected " + wk + " this week" : "") + (total ? " · " + total + " total" : "") + (verdict ? " · " + verdict : "") + "\n\nFull data & BCM model → " + pageUrl;
  const tFB      = title + (wkNum ? " (" + wkNum + ")" : "") + (wk ? "\nThis week: " + wk : "") + (total ? "\nTotal India nett: " + total : "") + (verdict ? "\nVerdict: " + verdict : "") + "\n\nBoxoffy — India Box Office Intelligence\n" + pageUrl;
  const tIG      = title + (wk ? " | " + wk + " this week" : "") + (total ? " | " + total + " total" : "") + (verdict ? "\n\n" + verdict + " 🎬" : "") + "\n\nTrack every rupee → boxoffy.com\n.\n.\n.\n#BoxOffice #Bollywood #IndianCinema #Boxoffy";
  const tWA      = "*" + title + "*" + (wkNum ? " · " + wkNum : "") + "\n" + (wk ? "This week: *" + wk + "*\n" : "") + (total ? "India nett: *" + total + "*\n" : "") + (verdict ? "Verdict: *" + verdict + "*\n" : "") + "\nBoxoffy → " + pageUrl;

  const platforms = [
    { id:"x",       label:"X / Twitter", icon:"𝕏", color:"#000",    text:tX,       openUrl:"https://twitter.com/intent/tweet?text=" + encodeURIComponent(tX),              canOpen:true  },
    { id:"threads", label:"Threads",     icon:"@", color:"#000",    text:tThreads, openUrl:"https://www.threads.net/intent/post?text=" + encodeURIComponent(tThreads),      canOpen:true  },
    { id:"fb",      label:"Facebook",    icon:"f", color:"#1877F2", text:tFB,      openUrl:"https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(pageUrl),   canOpen:true  },
    { id:"wa",      label:"WhatsApp",    icon:"W", color:"#25D366", text:tWA,      openUrl:"https://wa.me/?text=" + encodeURIComponent(tWA),                                canOpen:true  },
    { id:"ig",      label:"Instagram",   icon:"IG",color:"#E1306C", text:tIG,      canOpen:false },
    { id:"link",    label:"Copy Link",   icon:"🔗",color:"#374151", text:pageUrl,  canOpen:false },
  ];

  const copy = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  };

  return (
    <div style={{ background:"#F8F9FA", borderTop:`2px solid ${T.border}`, padding:"12px 14px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:15, color:T.text, letterSpacing:"0.06em", textTransform:"uppercase" }}>
          Share · {title.length > 22 ? title.slice(0,22)+"…" : title}
        </span>
        <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:18, color:T.textMuted, padding:"0 4px", lineHeight:1 }}>&times;</button>
      </div>

      {/* Quick-tap row for open-able platforms */}
      <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        {platforms.filter(p => p.canOpen).map(p => (
          <a key={p.id} href={p.openUrl} target="_blank" rel="noopener noreferrer" style={{
            display:"inline-flex", alignItems:"center", gap:5,
            background:p.color, color:"#fff",
            fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:12,
            padding:"7px 14px", borderRadius:4, textDecoration:"none", flexShrink:0,
          }}>
            <span style={{ fontSize:13, lineHeight:1 }}>{p.icon}</span>
            {p.label}
          </a>
        ))}
        <button onClick={() => copy("link", pageUrl)} style={{
          display:"inline-flex", alignItems:"center", gap:5,
          background: copied === "link" ? "#D1FAE5" : "#F3F4F6",
          color: copied === "link" ? "#065F46" : "#374151",
          fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:12,
          padding:"7px 14px", borderRadius:4, border:"none", cursor:"pointer", flexShrink:0,
        }}>
          🔗 {copied === "link" ? "Copied!" : "Copy Link"}
        </button>
      </div>

      {/* Copy-text rows for Instagram + all platforms */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {platforms.filter(p => !p.canOpen).map(p => (
          <div key={p.id} style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:5, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", padding:"7px 10px", gap:8, borderBottom:`1px solid #F3F4F6` }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:12, color:T.text, flex:1 }}>
                {p.label} <span style={{ color:T.textMuted, fontWeight:400, fontSize:10 }}>— copy caption</span>
              </span>
              <button onClick={() => copy(p.id, p.text)} style={{
                fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:11,
                background: copied === p.id ? "#D1FAE5" : "#F3F4F6",
                color: copied === p.id ? "#065F46" : "#374151",
                border:"none", borderRadius:4, padding:"4px 10px", cursor:"pointer",
              }}>{copied === p.id ? "✓ Copied!" : "Copy"}</button>
            </div>
            <div style={{ padding:"6px 10px 8px", fontFamily:"'DM Sans',sans-serif", fontSize:10.5, color:T.textMuted, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
              {p.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function FootnotesBar({ ns }) {
  const items = (ns || FOOTNOTES.map(f=>f.n)).map(n => FOOTNOTES.find(f=>f.n===n)).filter(Boolean);
  if (!items.length) return null;
  return (
    <div style={{
      borderTop:`1px solid ${T.border}`,
      padding:"8px 18px 6px",
      display:"flex", flexWrap:"wrap", gap:"4px 16px",
    }}>
      {items.map(f => {
        const sup = String(f.n).split("").map(d => "\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079"[parseInt(d)]).join("");
        return (
          <span key={f.n} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#B0A8A0", lineHeight:1.6 }}>
            <span style={{ color:"#9CA3AF", fontWeight:700 }}>{sup}</span> {f.label}
          </span>
        );
      })}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   INSTANT SEARCH — Google-style
   Client-side fuzzy search across all films in DATA.
   Results appear instantly as user types.
   Keyboard: ↑↓ navigate · Enter go · Esc close
   ═══════════════════════════════════════════════════════════════ */

// Flatten DATA into a searchable array once at module level
const SEARCH_INDEX = (() => {
  const list = [];
  Object.entries(DATA).forEach(([year, films]) => {
    if (!Array.isArray(films)) return;
    films.forEach(f => {
      if (!f.title || !f.pageUrl) return;
      list.push({
        title:    f.title,
        language: f.language || "",
        director: f.director || "",
        cast:     (Array.isArray(f.cast) ? f.cast : [f.cast || ""]).join(" "),
        year:     year,
        verdict:  f.verdict || "",
        indiaNet: f.indiaNet || "",
        pageUrl:  f.pageUrl,
        posterUrl:f.posterUrl || "",
        // pre-lowercase for fast matching
        _q: (f.title + " " + (f.director||"") + " " + (Array.isArray(f.cast) ? f.cast.join(" ") : (f.cast||""))).toLowerCase(),
      });
    });
  });
  return list;
})();

function highlight(text, query) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background:"#FEF3C7", color:"#92400E", borderRadius:2, padding:"0 1px" }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

function SearchBar() {
  const [query,   setQuery]   = React.useState("");
  const [results, setResults] = React.useState([]);
  const [active,  setActive]  = React.useState(-1);
  const [open,    setOpen]    = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef(null);
  const dropRef  = React.useRef(null);
  const isMobile = useIsMobile();

  // Search on every keystroke — instant, no debounce needed for 549 films
  React.useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setActive(-1);
      return;
    }
    // Score: title match scores higher than cast/director
    const scored = SEARCH_INDEX
      .map(f => {
        const titleIdx = f.title.toLowerCase().indexOf(q);
        const qIdx     = f._q.indexOf(q);
        if (qIdx === -1) return null;
        const score = titleIdx === 0 ? 100 : titleIdx > -1 ? 80 : 40;
        return { ...f, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || b.year.localeCompare(a.year))
      .slice(0, 8);
    setResults(scored);
    setOpen(scored.length > 0);
    setActive(-1);
  }, [query]);

  // Keyboard navigation
  function onKeyDown(e) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(a => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = active >= 0 ? results[active] : results[0];
      if (target) navigate(target.pageUrl);
    } else if (e.key === "Escape") {
      close();
    }
  }

  function navigate(url) {
    window.location.href = "/" + url;
  }

  function close() {
    setOpen(false);
    setQuery("");
    setActive(-1);
    inputRef.current?.blur();
  }

  // Close on outside click
  React.useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const VERDICT_COLORS = {
    "All-Time Blockbuster": "#92400E",
    "Blockbuster":          "#065F46",
    "Super Hit":            "#166534",
    "Hit":                  "#1E40AF",
    "Average":              "#374151",
    "Flop":                 "#991B1B",
    "Disaster":             "#9D174D",
  };

  const inputW = isMobile ? "100%" : focused || query ? 260 : 180;

  return (
    <div style={{ position:"relative", flexShrink:0 }}>
      {/* Input */}
      <div style={{
        display:"flex", alignItems:"center",
        background: focused ? "#fff" : "#FFF5F5",
        border:`1px solid ${focused ? "#C8201A" : "#FBBFBB"}`,
        borderRadius:6, padding:"5px 10px", gap:6,
        width: inputW, transition:"all 0.2s ease",
        boxShadow: focused ? "0 0 0 3px rgba(200,32,26,0.12)" : "0 0 0 1px rgba(200,32,26,0.06)",
      }}>
        {/* Search icon */}
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ flexShrink:0, opacity: focused ? 0.7 : 0.4 }}>
          <circle cx="9" cy="9" r="6" stroke="#374151" strokeWidth="2"/>
          <path d="M13.5 13.5L17 17" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search films, directors..."
          style={{
            border:"none", outline:"none", background:"transparent",
            fontFamily:"'DM Sans', sans-serif", fontSize:13,
            color:"#111827", width:"100%",
            "::placeholder": { color:"#9CA3AF" },
          }}
        />
        {/* Clear button */}
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }}
            style={{ background:"none", border:"none", padding:0, cursor:"pointer",
                     color:"#9CA3AF", fontSize:14, lineHeight:1, flexShrink:0 }}>✕</button>
        )}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div ref={dropRef} style={{
          position:"absolute", top:"calc(100% + 8px)",
          right: isMobile ? "auto" : 0,
          left: isMobile ? 0 : "auto",
          width: isMobile ? "calc(100vw - 32px)" : 360,
          background:"#fff",
          border:"0.5px solid #E5E7EB",
          borderRadius:8,
          boxShadow:"0 8px 32px rgba(0,0,0,0.12)",
          zIndex:9999,
          overflow:"hidden",
          animation:"fadeIn 0.12s ease",
        }}>
          {/* Result rows */}
          {results.map((film, i) => (
            <div key={film.pageUrl}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(-1)}
              onClick={() => navigate(film.pageUrl)}
              style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"10px 12px",
                background: i === active ? "#FFF5F5" : "#fff",
                borderBottom: i < results.length - 1 ? "0.5px solid #F3F4F6" : "none",
                cursor:"pointer",
                borderLeft: i === active ? "3px solid #C8201A" : "3px solid transparent",
                transition:"background 0.08s",
              }}>
              {/* Poster thumbnail */}
              <div style={{
                width:32, height:48, flexShrink:0, borderRadius:3, overflow:"hidden",
                background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                {film.posterUrl ? (
                  <img src={film.posterUrl} alt={film.title}
                    style={{ width:"100%", height:"100%", objectFit:"cover" }}
                    onError={e => { e.target.style.display="none"; }}
                  />
                ) : (
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:9,
                    fontWeight:800, color:"#9CA3AF" }}>
                    {film.title.split(" ").map(w=>w[0]).join("").slice(0,3).toUpperCase()}
                  </span>
                )}
              </div>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800,
                  fontSize:15, color:"#111827", lineHeight:1.2,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>
                  {highlight(film.title, query.trim())}
                </div>
                <div style={{
                  fontFamily:"'DM Sans', sans-serif", fontSize:11, color:"#6B7280",
                  marginTop:2, display:"flex", alignItems:"center", gap:6,
                }}>
                  <span>{film.language}</span>
                  <span style={{ color:"#D1D5DB" }}>·</span>
                  <span>{film.year}</span>
                  {film.director && <>
                    <span style={{ color:"#D1D5DB" }}>·</span>
                    <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {highlight(film.director, query.trim())}
                    </span>
                  </>}
                </div>
              </div>
              {/* Right: verdict + collection */}
              <div style={{ flexShrink:0, textAlign:"right" }}>
                {film.verdict && film.verdict !== "—" && (
                  <div style={{
                    fontSize:9, fontWeight:700, color: VERDICT_COLORS[film.verdict] || "#374151",
                    letterSpacing:"0.05em", textTransform:"uppercase", lineHeight:1,
                  }}>{film.verdict.replace("All-Time ","")}</div>
                )}
                {film.indiaNet && film.indiaNet !== "—" && (
                  <div style={{
                    fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700,
                    fontSize:13, color:"#C8201A", marginTop:2,
                  }}>{film.indiaNet}</div>
                )}
              </div>
            </div>
          ))}

          {/* Footer */}
          <div style={{
            padding:"8px 12px", background:"#F9FAFB",
            borderTop:"0.5px solid #F3F4F6",
            display:"flex", alignItems:"center", justifyContent:"space-between",
          }}>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:"#9CA3AF" }}>
              {results.length} result{results.length !== 1 ? "s" : ""} · ↑↓ navigate · Enter open
            </span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:"#9CA3AF" }}>
              Esc to close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBar({ activeSection, setActiveSection, setForceAllTime }) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const navLinks = ["Box Office","OTT","TV","Weekly"];

  return (
    <div style={{ position:"sticky", top:0, zIndex:100 }}>
      <nav style={{
        background:"#FFFFFF",
        borderBottom:`2px solid ${T.accent}`,
        display:"flex", alignItems:"center",
        padding: isMobile ? "0 16px" : "0 24px",
        gap:0,
        boxShadow:"0 1px 8px rgba(0,0,0,0.08)",
        minHeight: isMobile ? 48 : "auto",
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"baseline", gap:0, marginRight: isMobile ? 0 : 32, paddingTop:4, paddingBottom:4, flexShrink:0 }}>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize: isMobile ? 20 : 24, color:"#111827", letterSpacing:"-0.02em", lineHeight:1 }}>BOXOF</span>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize: isMobile ? 20 : 24, color:T.accent, letterSpacing:"-0.02em", lineHeight:1 }}>FY</span>
          {!isMobile && <span style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:400, fontSize:10, color:"#9CA3AF", marginLeft:10, letterSpacing:"0.2em", textTransform:"uppercase", alignSelf:"center" }}>Box Office</span>}
        </div>

        {/* Desktop nav */}
        {!isMobile && <>
          <div style={{ width:1, height:20, background:"#E5E7EB", marginRight:24, flexShrink:0 }} />
          {navLinks.map(s => {
            const extLink = s === "OTT" ? "/ott-releases.html" : s === "TV" ? "/tv-ratings.html" : null;
            if (extLink) return (
              <a key={s} href={extLink} style={{
                fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:13,
                color:"#9CA3AF", textDecoration:"none",
                padding:"18px 14px",
                borderBottom:"2px solid transparent",
                marginBottom:"-2px", letterSpacing:"0.04em", transition:"color 0.15s", flexShrink:0,
                display:"inline-block",
              }}
                onMouseEnter={e => { e.currentTarget.style.color="#111827"; }}
                onMouseLeave={e => { e.currentTarget.style.color="#9CA3AF"; }}
              >{s}</a>
            );
            return (
              <button key={s} onClick={() => setActiveSection(s)} style={{
                background:"transparent", border:"none", cursor:"pointer",
                fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:13,
                color: activeSection === s ? "#111827" : "#9CA3AF",
                padding:"18px 14px",
                borderBottom: activeSection === s ? `2px solid ${T.accent}` : "2px solid transparent",
                marginBottom:"-2px", letterSpacing:"0.04em", transition:"color 0.15s", flexShrink:0,
              }}>{s}</button>
            );
          })}
          <div style={{ width:1, height:20, background:"#E5E7EB", margin:"0 6px", flexShrink:0 }} />
          <a href="/production-houses.html" style={{
            fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:13,
            color:T.accent, textDecoration:"none",
            padding:"18px 12px", borderBottom:"2px solid transparent", marginBottom:"-2px",
            letterSpacing:"0.04em", display:"flex", alignItems:"center", gap:5, flexShrink:0,
          }}>
            Studios
            <span style={{ fontSize:9, background:T.accent, color:"#fff", padding:"1px 5px", borderRadius:2, fontWeight:800, letterSpacing:"0.1em", lineHeight:"14px" }}>30</span>
          </a>
          <a href="/india-all-time-box-office.html" style={{
            fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:13,
            color:"#9CA3AF", background:"transparent", border:"none", textDecoration:"none",
            padding:"18px 12px", borderBottom:"2px solid transparent", marginBottom:"-2px",
            letterSpacing:"0.04em", flexShrink:0, cursor:"pointer", transition:"color 0.15s",
            display:"inline-block",
          }}
            onMouseEnter={e => e.currentTarget.style.color="#111827"}
            onMouseLeave={e => e.currentTarget.style.color="#9CA3AF"}
          >All-Time</a>
          <a href="/about.html" style={{
            fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:13,
            color:"#9CA3AF", textDecoration:"none",
            padding:"18px 12px", borderBottom:"2px solid transparent", marginBottom:"-2px",
            letterSpacing:"0.04em", flexShrink:0, transition:"color 0.15s",
          }}>About</a>
          {/* Right side — search + update stamp */}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
            <SearchBar />
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", borderRight:`1px solid #E5E7EB`, paddingRight:12, marginRight:12 }}>
              <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:13, color:T.accent, letterSpacing:"0.03em" }}>WEEK 15 · 2026</span>
              <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#9CA3AF", letterSpacing:"0.1em", textTransform:"uppercase" }}>Box Office Period</span>
            </div>

          </div>
        </>}

        {/* Mobile: week badge + hamburger */}
        {isMobile && <>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:11, color:T.accent, letterSpacing:"0.06em" }}>WK13</span>
            <button onClick={() => setMenuOpen(o => !o)} style={{
              background:"transparent", border:`1px solid #E5E7EB`, borderRadius:4,
              padding:"6px 8px", cursor:"pointer", display:"flex", flexDirection:"column",
              gap:4, alignItems:"center", justifyContent:"center",
            }}>
              {menuOpen
                ? <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:16, color:"#374151", lineHeight:1 }}>✕</span>
                : <>
                    <span style={{ display:"block", width:18, height:2, background:"#374151", borderRadius:1 }} />
                    <span style={{ display:"block", width:18, height:2, background:"#374151", borderRadius:1 }} />
                    <span style={{ display:"block", width:18, height:2, background:"#374151", borderRadius:1 }} />
                  </>
              }
            </button>
          </div>
        </>}
      </nav>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <div style={{
          position:"absolute", top:"100%", left:0, right:0,
          background:"#FFFFFF", borderBottom:`2px solid ${T.accent}`,
          boxShadow:"0 4px 16px rgba(0,0,0,0.12)", zIndex:200,
        }}>
          {/* Mobile search */}
          <div style={{ padding:"10px 16px", borderBottom:"1px solid #F3F4F6" }}>
            <SearchBar />
          </div>
          {navLinks.map(s => {
            const extLink = s === "OTT" ? "/ott-releases.html" : s === "TV" ? "/tv-ratings.html" : null;
            if (extLink) return (
              <a key={s} href={extLink} style={{
                display:"block", width:"100%", textAlign:"left",
                borderBottom:"1px solid #F3F4F6",
                fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:15,
                color:"#374151", textDecoration:"none",
                padding:"14px 20px",
                borderLeft:"3px solid transparent",
              }}>{s}</a>
            );
            return (
              <button key={s} onClick={() => { setActiveSection(s); setMenuOpen(false); }} style={{
                display:"block", width:"100%", textAlign:"left",
                background: activeSection === s ? "#FFF5F5" : "transparent",
                border:"none", borderBottom:"1px solid #F3F4F6",
                fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:15,
                color: activeSection === s ? T.accent : "#374151",
                padding:"14px 20px", cursor:"pointer",
                borderLeft: activeSection === s ? `3px solid ${T.accent}` : "3px solid transparent",
              }}>{s}</button>
            );
          })}
          <a href="/production-houses.html" style={{
            display:"flex", alignItems:"center", gap:8,
            fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:15,
            color:T.accent, textDecoration:"none",
            padding:"14px 20px", borderBottom:"1px solid #F3F4F6",
            borderLeft:`3px solid ${T.accent}`,
          }}>
            Studios
            <span style={{ fontSize:9, background:T.accent, color:"#fff", padding:"1px 5px", borderRadius:2, fontWeight:800 }}>30</span>
          </a>
          <a href="/india-all-time-box-office.html" style={{
            display:"block", fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:15,
            color:"#374151", textDecoration:"none", padding:"14px 20px",
            borderBottom:"1px solid #F3F4F6", borderLeft:"3px solid transparent",
          }}>All-Time Grossers</a>
          <a href="/about.html" style={{
            display:"block", fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:15,
            color:"#374151", textDecoration:"none", padding:"14px 20px",
            borderLeft:"3px solid transparent",
          }}>About</a>
          <div style={{ padding:"10px 20px", background:"#F9FAFB", borderTop:"1px solid #F3F4F6" }}>

          </div>
        </div>
      )}
    </div>
  );
}

function VerdictPill({ verdict }) {
  const cfg = VERDICT_CFG[verdict] || VERDICT_CFG["Average"];
  return (
    <span style={{
      background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`,
      fontFamily:"'DM Sans', sans-serif", fontWeight:700,
      fontSize:10, letterSpacing:"0.05em", textTransform:"uppercase",
      borderRadius:3, padding:"2px 6px", whiteSpace:"nowrap",
    }}>{verdict}</span>
  );
}

function ScoreboardRow({ film, week, wkCollection, total, verdict, color }) {
  const isMobile = useIsMobile();
  if (isMobile) return (
    <div style={{ borderBottom:`1px solid ${T.border}`, padding:"10px 0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
        <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:16, color:T.text }}>{film}</div>
        <div style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:10, color }}>{verdict}</div>
      </div>
      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:13, color:T.accent }}>{wkCollection}</div>
        <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted }}>Total: {total}</div>
        <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted, marginLeft:"auto" }}>{week}</div>
      </div>
    </div>
  );
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"170px 70px 110px 120px 1fr",
      gap:0, borderBottom:`1px solid ${T.border}`,
      padding:"9px 0", alignItems:"center",
    }}>
      <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:14, color:T.text, paddingLeft:2 }}>{film}</div>
      <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted }}>{week}</div>
      <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:14, color:T.accent }}>{wkCollection}</div>
      <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:600, fontSize:13, color:T.textMid }}>{total}</div>
      <div style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:10, color, letterSpacing:"0.03em" }}>{verdict}</div>
    </div>
  );
}

function SourceCard({ source }) {
  const [open, setOpen] = useState(false);
  const fnNum = SOURCE_FN[source.name] || SOURCE_FN[source.handle?.replace("@","")];
  return (
    <div style={{ border:`1px solid ${T.border}`, borderTop:`3px solid ${source.color}`, background:T.surface, marginBottom:12 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 16px", cursor:"pointer" }}>
        <div style={{
          background:T.surfaceAlt, color:T.textMuted, border:`1px solid ${T.border}`,
          fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:11, letterSpacing:"0.04em",
          padding:"3px 8px", borderRadius:2, whiteSpace:"nowrap", flexShrink:0, marginTop:1,
        }}>Trade Source{fnNum ? <Fn n={fnNum} style={{color:"#9CA3AF"}} /> : ""}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:12, color:T.text, lineHeight:1.4, fontStyle:"italic" }}>
            "{source.quote}"
          </div>
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted, marginTop:3 }}>
            {open ? "▲ collapse" : "▼ read full analysis"}
          </div>
        </div>
      </div>
      {open && (
        <div style={{
          padding:"0 16px 16px", borderTop:`1px solid ${T.border}`,
          fontFamily:"'DM Sans', sans-serif", fontSize:13, color:T.textMid, lineHeight:1.8,
          animation:"fadeIn 0.2s ease both",
        }}>
          <div style={{ paddingTop:12 }}>{source.analysis}</div>
        </div>
      )}
    </div>
  );
}

function WeeklyCommentarySection() {
  useSheetData(); // re-render when live data arrives
  const [activeWeek, setActiveWeek] = useState(0);
  const weeklyData = liveWeekly || WEEKLY_COMMENTARY;
  const week = weeklyData[activeWeek];
  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom:24, borderBottom:`2px solid ${T.borderDark}`, paddingBottom:16 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:6, flexWrap:"wrap" }}>
          <h2 style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:32, color:T.text, margin:0, letterSpacing:"-0.02em" }}>
            BOX OFFICE WEEKLY
          </h2>
          <span style={{ background:T.accent, color:"#fff", fontFamily:"'DM Sans', sans-serif", fontWeight:800, fontSize:10, letterSpacing:"0.12em", padding:"3px 8px", borderRadius:2 }}>
            COMMENTARY
          </span>
        </div>
        <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, color:T.textMuted, margin:0, lineHeight:1.5 }}>
          Weekly analytical digest — trade data & commentary, plus Boxoffy's editorial take on what the numbers mean.<Fn n={1} /> <Fn n={2} />
        </p>
      </div>

      {/* Week tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:28, borderBottom:`1px solid ${T.border}`, overflowX:"auto" }}>
        {weeklyData.map((w, i) => (
          <button key={i} onClick={() => setActiveWeek(i)} style={{
            background:"transparent", border:"none", cursor:"pointer",
            padding:"10px 18px", borderBottom: i === activeWeek ? `3px solid ${T.accent}` : "3px solid transparent",
            marginBottom:"-1px", flexShrink:0,
          }}>
            <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:14, color: i === activeWeek ? T.text : T.textMuted }}>{w.weekNum}</div>
            {w.status === "current" && (
              <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.accent, fontWeight:700, letterSpacing:"0.1em" }}>● LIVE</div>
            )}
          </button>
        ))}
      </div>

      {/* Active week */}
      <div key={activeWeek} style={{ animation:"fadeIn 0.25s ease both" }}>
        {/* Masthead */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:11, color:T.textMuted, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>{week.dateRange}</div>
          <h3 style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:28, color:T.text, margin:"0 0 6px", letterSpacing:"-0.01em", lineHeight:1.1 }}>{week.headline}</h3>
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:14, color:T.textMid, fontStyle:"italic" }}>{week.subline}</div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns: typeof window !== "undefined" && window.innerWidth < 640 ? "1fr" : "1fr 320px", gap:24, alignItems:"start" }}>
          {/* Left */}
          <div>
            {/* Scoreboard */}
            <div style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, padding:"14px 16px", marginBottom:20 }}>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase", color:T.textMuted, marginBottom:10 }}>WEEK AT A GLANCE</div>
              <div style={{ display:"grid", gridTemplateColumns:"170px 70px 110px 120px 1fr", gap:0, borderBottom:`2px solid ${T.borderDark}`, paddingBottom:6, marginBottom:2 }}>
                {["FILM","WEEK","WK COLL","TOTAL","VERDICT"].map((h,i) => (
                  <div key={i} style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9, color:T.textMuted, letterSpacing:"0.1em", textTransform:"uppercase", paddingLeft: i===0?2:0 }}>{h}</div>
                ))}
              </div>
              {week.scoreboard.map((row, i) => <ScoreboardRow key={i} {...row} />)}
            </div>

            {/* Source cards */}
            <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase", color:T.textMuted, marginBottom:12 }}>
              TRADE DESK — ANALYSIS & COMMENTARY
            </div>
            {week.sources.map((s, i) => <SourceCard key={i} source={s} />)}
            <FootnotesBar ns={[1, 2, 6]} />
          </div>

          {/* Right — sticky sidebar */}
          <div style={{ position:"sticky", top:80 }}>
            {/* BOXOFFY Take */}
            <div style={{ background:"#F3F4F6", border:`1px solid ${T.border}`, padding:"20px", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.12em", color:T.text }}>BOXOF</span>
                <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.12em", color:T.accent }}>FY</span>
                <span style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9, letterSpacing:"0.15em", textTransform:"uppercase", color:T.textMuted }}>TAKE</span>
              </div>
              <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12.5, color:T.textMid, lineHeight:1.8, margin:0 }}>{week.interval_take}</p>
            </div>
            {/* Next week */}
            {week.nextWeek && (
              <div style={{ border:`1px solid ${T.border}`, background:T.surface, padding:"14px 16px" }}>
                <div style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:T.textMuted, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color:T.accent }}>▶</span> NEXT WEEK
                </div>
                <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:T.textMid, lineHeight:1.7 }}>{week.nextWeek}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



function StatusDot({ status }) {
  const color = status === "Running" ? T.green : status === "Upcoming" ? T.gold : "#9CA3AF";
  const label = status === "Running" ? "● In Cinemas" : status === "Upcoming" ? "◎ Upcoming" : "○ OTT";
  return (
    <span style={{ color, fontSize:11, fontFamily:"'DM Sans', sans-serif", fontWeight:600, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

const PLATFORM_COLOR = {
  "Netflix":                { bg:"#E50914", text:"#fff" },
  "Netflix (expected)":     { bg:"#E50914", text:"#fff" },
  "Amazon Prime Video":     { bg:"#00A8E1", text:"#fff" },
  "Amazon Prime Video (expected)": { bg:"#00A8E1", text:"#fff" },
  "Disney+ Hotstar":        { bg:"#1A3A6B", text:"#fff" },
  "ZEE5":                   { bg:"#6B21A8", text:"#fff" },
  "JioCinema":              { bg:"#EB5C27", text:"#fff" },
  "Netflix + Prime Video":  { bg:"#111", text:"#fff" },
};

/* ═══════════════════════════════════════════════════════════════
   GST / ENTERTAINMENT TAX ENGINE
   ═══════════════════════════════════════════════════════════════

   VERIFIED RATE HISTORY (India cinema tickets):
   ─────────────────────────────────────────────
   Jul 2017 – Dec 2018   Pre-GST states subsumed. GST introduced:
                          ≤₹100 tickets → 18% | >₹100 → 28%
                          Source: CBIC Notification, July 2017

   Jan 2019 – Sep 2025   GST Council cut (Notif. 27/2018-CT, 31 Dec 2018):
                          ≤₹100 tickets → 12% | >₹100 → 18%
                          Source: PIB, CBIC, confirmed by profiteering rulings

   Oct 2025 – present    GST 2.0 reform (effective Sep 22, 2025):
                          ≤₹100 tickets → 5%  | >₹100 → 18%
                          Source: GST Council announcement Aug 2025,
                          busyin.in, bajajfinserv.in, thehansindia.com

   ─────────────────────────────────────────────
   AVERAGE TICKET PRICE (ATP) BY YEAR:
   ─────────────────────────────────────────────
   2017: ~₹150 (Ormax/industry estimates, pre-GST mix)
   2018: ~₹160 (PVR FY18 ATP ₹191; INOX ₹197; blended ~₹160)
   2019: ~₹165 (PVR FY19 ATP ₹207; all-India blended)
   2020: ~₹91  (COVID — only Jan–Feb full ops; Ormax confirmed)
   2021: ~₹110 (50% capacity; PVR FY21 ₹180 multiplex, low overall)
   2022: ~₹120 (reopened; Ormax/Business Standard estimates)
   2023: ~₹130 (MAI confirmed ₹130 all-India ATP; PVR INOX ₹258)
   2024: ~₹134 (Ormax Media, BBC India coverage Oct 2025)
   2025: ~₹150 (estimate; premium format surge; PVR INOX annual report)
   2026: ~₹155 (estimate; inflation + IMAX growth)

   ─────────────────────────────────────────────
   METHODOLOGY:
   ─────────────────────────────────────────────
   India Net = post-GST (distributor's net after GST extracted)
   India Gross = India Net × (1 + effectiveGSTRate)
   GST Collected = India Gross − India Net
   GST is approx. 15–18% of Gross (depending on period/ticket mix)

   We model the ticket mix:
   • Multiplex share of India Net ≈ 65–70% (higher ticket prices → 18%)
   • Single-screen share ≈ 30–35% (≤₹100 tickets → 12%/5%)
   • Blended effective rate accounts for this mix
   ─────────────────────────────────────────────
   Sources: CBIC, PIB, Bajaj Finserv, Razorpay, Busy.in,
            Business Standard (MAI/ATP data), BBC India (Ormax),
            ClearTax, NAACP profiteering rulings, taxheal.com
   ═══════════════════════════════════════════════════════════════ */

// GST rate slabs indexed by era
const GST_ERAS = [
  {
    label:    "GST 1.0 (High)",
    period:   "Jul 2017 – Dec 2018",
    lowRate:  0.18,   // ≤₹100 tickets
    highRate: 0.28,   // >₹100 tickets
    multiPct: 0.65,   // 65% of gross from high-rate (>₹100) tickets
    source:   "CBIC Notification Jul 2017",
    note:     "Initial GST rollout replaced state entertainment taxes. High 28% rate on premium tickets.",
  },
  {
    label:    "GST 1.0 (Reduced)",
    period:   "Jan 2019 – Sep 2025",
    lowRate:  0.12,
    highRate: 0.18,
    multiPct: 0.68,
    source:   "CBIC Notif. 27/2018-CT, 31 Dec 2018",
    note:     "GST Council cut: >₹100 from 28%→18%, ≤₹100 from 18%→12%. Effective 1 Jan 2019.",
  },
  {
    label:    "GST 2.0",
    period:   "Oct 2025 – present",
    lowRate:  0.05,
    highRate: 0.18,
    multiPct: 0.70,
    source:   "GST Council Aug 2025 (eff. Sep 22, 2025)",
    note:     "GST 2.0 reform: ≤₹100 cut from 12%→5%. Multiplex >₹100 unchanged at 18%.",
  },
];

// Map a release year/month to the correct GST era
function getGSTEra(releaseDate) {
  const s = (releaseDate || "").toLowerCase();
  // Detect year
  const yearMatch = s.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 2023;
  // Detect month
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  let month = 0;
  months.forEach((m, i) => { if (s.includes(m)) month = i + 1; });
  if (!month) month = 6; // default mid-year

  if (year < 2017) return GST_ERAS[0];
  if (year === 2017 && month >= 7) return GST_ERAS[0];
  if (year === 2018) return GST_ERAS[0];
  if (year === 2025 && month >= 10) return GST_ERAS[2];
  if (year >= 2026) return GST_ERAS[2];
  return GST_ERAS[1]; // Jan 2019 – Sep 2025
}

/* ── FOOTFALL ENGINE v2 — CALIBRATED FROM VERIFIED REAL DATA ────────
   The core problem with v1: it used PVR INOX's premium multiplex ATP
   (₹293) against India Gross, which badly understated footfalls.

   CALIBRATION ANCHORS (verified from trade sources):
   ┌─────────────────────────────────────────────────────────────────┐
   │ Film            │ India Net  │ India Gross │ Footfalls │ ATP    │
   │ Dhurandhar 2025 │ ₹894 Cr   │ ₹1,056 Cr  │ 3.65 Cr   │ ₹289  │
   │ Border 2 2026   │ ₹328 Cr   │ ~₹387 Cr   │ ~1.9 Cr   │ ₹204  │
   │ All India 2025  │ ~₹11,357Cr│ ₹13,395 Cr │ 83.2 Cr   │ ₹161  │
   └─────────────────────────────────────────────────────────────────┘
   Sources:
   • Dhurandhar footfalls 3.65 Cr — Koimoi Jan 2026, Sacnilk Day 51
   • Dhurandhar India Gross ₹1,056 Cr — Wikipedia / Koimoi closing
   • Border 2 Day 20: ₹377.7 Cr net / 1.51 Cr footfalls — Sacnilk
   • All-India 2025: gross ₹13,395 Cr / 83.2 Cr footfalls → ATP ₹161
     — Ormax Media annual report via Variety, Jan 2026
   • PVR INOX Q3 FY26 ATP ₹293 — Business Standard / Upstox Feb 2026
     (this is PVR INOX's premium circuit only — NOT all-India average)
   • 2026 all-India ATP estimated ₹168 (₹161 × 4.5% YoY growth forecast)
     — PVR INOX CEO, Business Standard Dec 2025

   KEY INSIGHT:
   The ₹161 Ormax all-India ATP includes ~10,000 screens of which:
   - ~7,000 single screens at ₹80–100 pull the average DOWN sharply
   - ~1,800 PVR INOX screens average ₹293 UP
   For a blockbuster Hindi film (multiplex-heavy), the effective ATP
   is higher (~₹240–280) because single screens do less % of its BO.
   For a mass-circuit film (patriotic/action), single-screen share is
   higher → lower effective ATP (~₹200–220).

   FILM-TYPE MULTIPLIERS applied to base year ATP:
   · Multiplex-heavy (premium Hindi tentpole, Hollywood): 1.65x base
   · Balanced (mainstream Hindi blockbuster): 1.45x base
   · Mass-circuit (patriotic/rural appeal, single-screen heavy): 1.25x base
   · Regional language (South/regional, own ATP curve): 1.1x base

   This correctly gives Dhurandhar ≈ 3.6 Cr, Border 2 ≈ 1.9 Cr.
────────────────────────────────────────────────────────────────────── */

// True all-India blended ATP (₹ per ticket) — Ormax Media verified
// These are the REAL industry-wide averages including all ~10,000 screens
const FOOTFALL_ATP = {
  // year: { allIndia, pvr, singleScreen, premiumImax, note }
  2015: { allIndia:  72, pvr:155, singleScreen: 48, premiumImax:250, note:"Pre-GST · Ormax baseline" },
  2016: { allIndia:  78, pvr:165, singleScreen: 52, premiumImax:270, note:"Pre-GST era" },
  2017: { allIndia:  80, pvr:175, singleScreen: 54, premiumImax:290, note:"GST shock H2 2017" },
  2018: { allIndia:  84, pvr:185, singleScreen: 56, premiumImax:310, note:"GST 28%/18% full year" },
  2019: { allIndia:  90, pvr:200, singleScreen: 60, premiumImax:340, note:"Post-GST cut recovery" },
  2020: { allIndia:  72, pvr:150, singleScreen: 48, premiumImax:270, note:"COVID — 50% capacity cap, fewer footfalls" },
  2021: { allIndia:  78, pvr:165, singleScreen: 52, premiumImax:290, note:"COVID reopening · partial year" },
  2022: { allIndia:  90, pvr:195, singleScreen: 60, premiumImax:340, note:"Post-pandemic recovery" },
  2023: { allIndia: 130, pvr:225, singleScreen: 72, premiumImax:410, note:"MAI confirmed ₹130 all-India · Ormax" },
  2024: { allIndia: 134, pvr:245, singleScreen: 76, premiumImax:445, note:"Ormax ₹134 all-India avg · PVR FY25 ₹258" },
  2025: { allIndia: 161, pvr:278, singleScreen: 88, premiumImax:520, note:"Ormax confirmed ₹161 all-India · PVR Q3 ₹293" },
  2026: { allIndia: 168, pvr:293, singleScreen: 92, premiumImax:545, note:"₹161 × 4.5% YoY forecast · PVR Q3 FY26 ₹293" },
};

/* Film-type profiles — multipliers CALIBRATED from verified real data:
   ┌──────────────────────┬──────────┬──────────────────────────────────────────────────────┐
   │ Film type            │ Mult     │ Calibration anchor                                   │
   ├──────────────────────┼──────────┼──────────────────────────────────────────────────────┤
   │ multiplex-premium    │ 1.79x    │ Dhurandhar: ₹894Cr net → 3.53 Cr FF (target 3.5–3.65)│
   │                      │          │ Stree 2: ₹620Cr net → 2.94 Cr FF (target ~3 Cr) ✓   │
   │ mainstream-blockbstr │ 1.27x    │ Chhaava: ₹540Cr net → 3.00 Cr FF (target ~3 Cr) ✓  │
   │ mass-circuit         │ 1.19x    │ Border 2: ₹328Cr net → 1.87 Cr FF (target ~1.87) ✓  │
   │ regional-panIndia    │ 1.55x    │ Kantara Ch1: ₹700Cr net → 3.19 Cr FF (est.)         │
   └──────────────────────┴──────────┴──────────────────────────────────────────────────────┘
   Key insight: all-India ATP (Ormax ₹161 for 2025) is the correct denominator —
   NOT PVR INOX's ₹293 which is premium circuit only. The film-type multiplier
   corrects for each film's actual screen penetration mix. */
const FILM_TYPE_PROFILES = {
  "multiplex-premium": {
    label: "Premium Multiplex-Heavy",
    examples: "Dhurandhar, Stree 2, Hollywood, IMAX-driven Hindi tentpoles",
    atpMultiplier: 1.79,
    cinemaShare: { premium:0.22, standard:0.60, single:0.18 },
    calibration: "Dhurandhar ₹894Cr net → 3.53 Cr footfalls ✓ (Sacnilk / Koimoi)",
  },
  "mainstream-blockbuster": {
    label: "Mainstream Blockbuster",
    examples: "Chhaava, Jawan, Pathaan — broad Hindi, multiplex + single screen",
    atpMultiplier: 1.27,
    cinemaShare: { premium:0.12, standard:0.52, single:0.36 },
    calibration: "Chhaava ₹540Cr net → 3.00 Cr footfalls ✓",
  },
  "mass-circuit": {
    label: "Mass Circuit / Patriotic",
    examples: "Border 2, Gadar 2, Uri — strong Tier 2/3 & single-screen penetration",
    atpMultiplier: 1.19,
    cinemaShare: { premium:0.07, standard:0.43, single:0.50 },
    calibration: "Border 2 ₹328Cr net → 1.87 Cr footfalls ✓ (Sacnilk Day 20 extrapolated)",
  },
  "regional-panIndia": {
    label: "Regional Pan-India Crossover",
    examples: "Kantara, KGF, Pushpa — South language with national reach",
    atpMultiplier: 1.55,
    cinemaShare: { premium:0.10, standard:0.50, single:0.40 },
    calibration: "Kantara Ch1 gross ₹851Cr / 3.41 Cr footfalls (Sacnilk)",
  },
};

// Derive film type from movie data — drives the ATP multiplier
function getFilmType(movie) {
  const lang    = (movie.language || "").toLowerCase();
  const title   = (movie.title   || "").toLowerCase();
  const budget  = parseFloat((movie.budget || "0").replace(/[^0-9.]/g,"")) || 0;

  // Hollywood always plays premium multiplex
  if (lang === "hollywood") return "multiplex-premium";

  // Regional pan-India South crossovers
  if (["tamil","telugu","kannada","malayalam"].includes(lang)) return "regional-panIndia";

  // Mass-circuit signals: patriotic / war / rural mass titles
  const massKeywords = ["border","gadar","uri","kesari","baby","sardar"];
  if (massKeywords.some(k => title.includes(k))) return "mass-circuit";

  // High-budget premium Hindi tentpoles (Dhurandhar, Animal, Stree 2, etc.)
  // These are multiplex-dominant event films
  if (budget >= 150) return "multiplex-premium";

  // Mid-budget mainstream Hindi (Chhaava, Jawan at lower budget films)
  return "mainstream-blockbuster";
}

// Show-time pricing tiers (% of shows × relative ATP weight)
// Derived from PVR INOX dynamic pricing structure
const SHOWTIME_TIERS = [
  { label:"Morning",   time:"9–12 AM",  share:0.12, multiplier:0.78, note:"Cheapest — senior/student shows" },
  { label:"Matinee",   time:"12–4 PM",  share:0.28, multiplier:0.90, note:"Mid-pricing, family slots" },
  { label:"Evening",   time:"4–8 PM",   share:0.35, multiplier:1.05, note:"Peak demand, dynamic pricing kicks in" },
  { label:"Night",     time:"8–11 PM",  share:0.25, multiplier:1.22, note:"Premium slots, max price" },
];

// Blended show-time multiplier (weighted avg across all shows)
const SHOWTIME_BLENDED_MULT = SHOWTIME_TIERS.reduce((s, t) => s + t.share * t.multiplier, 0); // ≈ 1.003

function getAtpData(releaseDate) {
  const yearMatch = (releaseDate || "").match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 2023;
  return FOOTFALL_ATP[year] || FOOTFALL_ATP[2023];
}

function getATP(releaseDate) {
  return getAtpData(releaseDate).allIndia;
}

// Calculate footfalls with full breakdown
function calcFootfalls(movie) {
  const indiaNetNum = parseFloat((movie.indiaNet || "0").replace(/[^0-9.]/g,"")) || 0;
  if (indiaNetNum <= 0) return null;

  const era      = getGSTEra(movie.releaseDate);
  const atpData  = getAtpData(movie.releaseDate);
  const filmType = getFilmType(movie);
  const profile  = FILM_TYPE_PROFILES[filmType];

  // India Gross (inclusive of GST)
  const blendedGSTRate = (era.multiPct * era.highRate) + ((1 - era.multiPct) * era.lowRate);
  const indiaGross = indiaNetNum * (1 + blendedGSTRate);

  // Effective ATP = all-India base × film-type multiplier × show-time blended mult
  // The film-type multiplier corrects for each film's actual screen-mix
  const effectiveATP = atpData.allIndia * profile.atpMultiplier * SHOWTIME_BLENDED_MULT;

  // Total footfalls: India Gross ÷ effective ATP (₹ Cr → ₹ absolute)
  const footfalls = Math.round((indiaGross * 1e7) / effectiveATP);

  // Venue-type breakdown using cinema share from profile
  const { premium: premiumShare, standard: standardShare, single: singleShare } = profile.cinemaShare;
  const byVenue = [
    {
      type: "Premium Multiplex",
      examples: "PVR Luxe · IMAX · 4DX · Cinepolis XL",
      share: premiumShare,
      atp: Math.round(atpData.premiumImax),
      footfalls: Math.round((indiaGross * 1e7 * premiumShare) / (atpData.premiumImax * SHOWTIME_BLENDED_MULT)),
    },
    {
      type: "Standard Multiplex",
      examples: "PVR · INOX · Cinepolis · Miraj Cinemas",
      share: standardShare,
      atp: Math.round(atpData.pvr),
      footfalls: Math.round((indiaGross * 1e7 * standardShare) / (atpData.pvr * SHOWTIME_BLENDED_MULT)),
    },
    {
      type: "Single Screen",
      examples: "Standalone cinemas · Tier 2/3 cities · Touring talkies",
      share: singleShare,
      atp: Math.round(atpData.singleScreen),
      footfalls: Math.round((indiaGross * 1e7 * singleShare) / (atpData.singleScreen * SHOWTIME_BLENDED_MULT)),
    },
  ];

  // Format helpers
  const fmtFF = n => {
    if (n >= 1e7) return `${(n/1e7).toFixed(2)} Cr`;
    if (n >= 1e5) return `${(n/1e5).toFixed(1)} Lakh`;
    return n.toLocaleString("en-IN");
  };

  return {
    footfalls,
    footfallsFormatted: fmtFF(footfalls),
    indiaGross: Math.round(indiaGross * 10) / 10,
    effectiveATP: Math.round(effectiveATP),
    allIndiaATP: atpData.allIndia,
    atpMultiplier: profile.atpMultiplier,
    filmType,
    profile,
    atpData,
    byVenue,
    era,
    fmtFF,
  };
}

// Core GST calculation — returns a rich object
function calcGST(movie) {
  const indiaNetNum = parseFloat((movie.indiaNet || "0").replace(/[^0-9.]/g,"")) || 0;
  if (indiaNetNum <= 0) return null;

  const era     = getGSTEra(movie.releaseDate);
  const atpData = getAtpData(movie.releaseDate);
  const atp     = atpData.allIndia;
  const yearMatch = (movie.releaseDate || "").match(/(\d{4})/);
  const year    = yearMatch ? parseInt(yearMatch[1]) : 2023;

  // Blended effective GST rate
  // multiPct of tickets are >₹100 (highRate), rest are ≤₹100 (lowRate)
  const blendedRate = (era.multiPct * era.highRate) + ((1 - era.multiPct) * era.lowRate);

  // India Gross = India Net × (1 + blendedRate)  [GST is included in gross]
  const gstCrore = Math.round(indiaNetNum * blendedRate * 10) / 10;
  const indiaGrossCrore = Math.round((indiaNetNum + gstCrore) * 10) / 10;

  // Footfalls — delegated to calcFootfalls for full breakdown
  const ff = calcFootfalls(movie);
  const footfalls = ff ? ff.footfalls : Math.round((indiaGrossCrore * 1e7) / atp);
  const effectiveATP = ff ? ff.effectiveATP : atp;

  // Government revenue share
  const govtSharePct = Math.round((gstCrore / indiaGrossCrore) * 100);

  // Confidence level based on data quality
  const confidence = indiaNetNum > 50 ? "HIGH" : indiaNetNum > 10 ? "MEDIUM" : "LOW";

  return {
    era,
    indiaNetNum,
    indiaGrossCrore,
    gstCrore,
    blendedRate: Math.round(blendedRate * 1000) / 10,
    lowRate:     Math.round(era.lowRate * 100),
    highRate:    Math.round(era.highRate * 100),
    multiPct:    Math.round(era.multiPct * 100),
    govtSharePct,
    footfalls,
    atp: effectiveATP,  // show effective ATP in display, not raw allIndia base
    year,
    confidence,
    gstPer1CrNet: Math.round(blendedRate * 100) / 100,
  };
}

// GST confidence badge
function ConfidenceBadge({ level }) {
  const cfg = {
    HIGH:   { bg:"#DCFCE7", color:"#166534", label:"HIGH CONFIDENCE" },
    MEDIUM: { bg:"#FEF3C7", color:"#92400E", label:"ESTIMATED" },
    LOW:    { bg:"#FEE2E2", color:"#991B1B", label:"LOW DATA" },
  }[level] || { bg:"#F3F4F6", color:"#6B7280", label:"N/A" };
  return (
    <span style={{
      background:cfg.bg, color:cfg.color,
      fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:8,
      letterSpacing:"0.12em", textTransform:"uppercase",
      padding:"2px 6px", borderRadius:2,
    }}>{cfg.label}</span>
  );
}

function GSTPanel({ movie }) {
  const g = calcGST(movie);
  if (!g) return (
    <div style={{ padding:"16px 24px", background:"#FFFDF5", borderTop:`1px solid ${T.border}`, fontFamily:"'DM Sans',sans-serif", fontSize:12, color:T.textMuted }}>
      GST data unavailable — India Net figure not reported.
    </div>
  );

  return (
    <div style={{
      background:"#F0FDF4",
      borderTop:`3px solid #16A34A`,
      padding:"0 0 0",
    }}>
      {/* GST Banner */}
      <div style={{ background:"#15803D", padding:"8px 20px", display:"flex", alignItems:"center", gap:10, marginBottom:0 }}>
        <span style={{ fontSize:18 }}>🏛</span>
        <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:16, color:"#fff", letterSpacing:"0.08em", textTransform:"uppercase" }}>GST & TAX INTELLIGENCE</span>
        <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:"#BBF7D0", marginLeft:4 }}>— Verified govt. notification rates · Estimated tax collected on this film</span>
      </div>
      {/* Header bar */}
      <div style={{
        padding:"12px 20px 12px",
        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
        borderBottom:`1px solid #D1FAE5`,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{
            background:"#16A34A", color:"#fff",
            fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:12,
            letterSpacing:"0.12em", textTransform:"uppercase", padding:"3px 10px", borderRadius:2,
          }}>GST / TAX INTELLIGENCE</span>
          <ConfidenceBadge level={g.confidence} />
        </div>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#6B7280", flex:1 }}>
          Era: <strong style={{color:"#374151"}}>{g.era.label}</strong> · {g.era.period} · Govt. notification<Fn n={7} /><Fn n={8} />
        </span>
      </div>

      {/* Main numbers grid */}
      <div style={{
        display:"grid", gridTemplateColumns: typeof window !== "undefined" && window.innerWidth < 640 ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap:0, borderBottom:`1px solid #D1FAE5`,
      }}>
        {[
          { label:"Est. GST Collected", value:`₹${g.gstCrore} Cr`, sub:`${g.blendedRate}% blended rate`, accent:true },
          { label:"India Gross (est.)",  value:`₹${g.indiaGrossCrore} Cr`, sub:"Net + GST extracted", accent:false },
          { label:"Govt Revenue Share",  value:`${g.govtSharePct}%`, sub:"of every ticket sold", accent:false },
          { label:"Est. Footfalls", value: g.footfalls >= 1e7
              ? `${(g.footfalls/1e7).toFixed(1)} Cr`
              : g.footfalls >= 1e5
                ? `${(g.footfalls/1e5).toFixed(0)} Lakh`
                : `${g.footfalls.toLocaleString()}`,
            sub:`est. effective ATP ₹${g.atp} (${g.year})`, accent:false },
        ].map(({ label, value, sub, accent }, i) => (
          <div key={i} style={{
            padding:"14px 18px",
            borderRight: i < 3 ? `1px solid #D1FAE5` : "none",
            background: accent ? "#F0FDF4" : "transparent",
          }}>
            <div style={{
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
              fontSize:22, color: accent ? T.green : T.text, lineHeight:1,
            }}>{value}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#6B7280", marginTop:4, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#9CA3AF", marginTop:2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Rate breakdown + methodology */}
      <div style={{
        display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
        gap:0, padding:"12px 0",
        borderBottom:`1px solid #D1FAE5`,
      }}>
        {/* Rate slab */}
        <div style={{ padding:"0 18px", borderRight:`1px solid #D1FAE5` }}>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9, color:"#15803D", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>GST SLABS APPLIED</div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {[
              { label:`Multiplex (>₹100) · ${g.multiPct}% of gross`, rate:`${g.highRate}%`, color:"#DC2626" },
              { label:`Single screen (≤₹100) · ${100-g.multiPct}% of gross`, rate:`${g.lowRate}%`, color:"#D97706" },
              { label:`Blended effective rate`, rate:`${g.blendedRate}%`, color:"#15803D", bold:true },
            ].map(({ label, rate, color, bold }) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#374151", fontWeight: bold ? 700 : 400 }}>{label}</span>
                <span style={{
                  fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:14, color,
                  background: bold ? "#F0FDF4" : "transparent",
                  padding: bold ? "0 6px" : "0",
                  borderRadius:2,
                }}>{rate}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calculation walkthrough */}
        <div style={{ padding:"0 18px", borderRight:`1px solid #D1FAE5` }}>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9, color:"#15803D", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>HOW WE CALCULATED</div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#4B5563", lineHeight:1.7 }}>
            <div>India Net (reported) = <strong>₹{g.indiaNetNum} Cr</strong></div>
            <div>Blended GST rate = <strong>{g.blendedRate}%</strong></div>
            <div>GST = Net × rate = <strong>₹{g.gstCrore} Cr</strong></div>
            <div>Gross = Net + GST = <strong>₹{g.indiaGrossCrore} Cr</strong></div>
            <div style={{ marginTop:4, color:"#9CA3AF", fontSize:9 }}>
              GST is embedded in Gross. Distributor receives Net after GST paid to govt.
            </div>
          </div>
        </div>

        {/* Policy note */}
        <div style={{ padding:"0 18px" }}>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9, color:"#15803D", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>POLICY CONTEXT</div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#4B5563", lineHeight:1.7 }}>
            {g.era.note}
          </div>
          <div style={{ marginTop:6, fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#9CA3AF", lineHeight:1.5 }}>
            Data<Fn n={7} /><Fn n={8} /><Fn n={3} /><Fn n={4} /><Fn n={5} />
          </div>
        </div>
      </div>

      {/* ── FOOTFALL BREAKDOWN SECTION ─────────────────────────── */}
      {(() => {
        const ff = calcFootfalls(movie);
        if (!ff) return null;
        return (
          <div style={{ borderTop:`1px solid #D1FAE5`, padding:"12px 0 12px" }}>
            {/* Section header */}
            <div style={{ padding:"0 18px 10px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:3, height:16, background:"#1D4ED8", borderRadius:2 }} />
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9, color:"#1D4ED8", letterSpacing:"0.12em", textTransform:"uppercase" }}>
                  FOOTFALL INTELLIGENCE — ESTIMATED TOTAL ADMISSIONS
                </span>
              </div>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted, flex:1 }}>
                Film type: <strong style={{color:T.text}}>{ff.profile.label}</strong> · ATP base ₹{ff.allIndiaATP} × {ff.atpMultiplier}x multiplier = ₹{ff.effectiveATP} effective · {ff.atpData.note}
              </span>
            </div>

            {/* Headline total + ATP */}
            <div style={{ display:"grid", gridTemplateColumns: typeof window !== "undefined" && window.innerWidth < 640 ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap:0, borderTop:`1px solid #DBEAFE`, borderBottom:`1px solid #DBEAFE` }}>
              {[
                {
                  label:"Total Footfalls (Est.)",
                  value:ff.footfallsFormatted,
                  sub:`India theatrical admissions`,
                  accent:true,
                },
                {
                  label:"Effective ATP Used",
                  value:`₹${ff.effectiveATP}`,
                  sub:`All-India ₹${ff.allIndiaATP} × ${ff.atpMultiplier}x film-type`,
                  accent:false,
                },
                {
                  label:"PVR INOX / Multiplex",
                  value:`₹${ff.atpData.pvr}`,
                  sub:"Standard multiplex ATP (verified Q3 FY26)",
                  accent:false,
                },
                {
                  label:"Single Screen ATP",
                  value:`₹${ff.atpData.singleScreen}`,
                  sub:"Tier 2/3 cities · standalone screens",
                  accent:false,
                },
              ].map(({ label, value, sub, accent }, i) => (
                <div key={i} style={{
                  padding:"12px 18px",
                  borderRight: i < 3 ? `1px solid #DBEAFE` : "none",
                  background: accent ? "#EFF6FF" : "transparent",
                }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:20, color: accent ? "#1D4ED8" : T.text, lineHeight:1 }}>{value}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#6B7280", marginTop:4, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#9CA3AF", marginTop:2 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Venue-type breakdown */}
            <div style={{ padding:"10px 18px 4px" }}>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9, color:"#1D4ED8", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>FOOTFALL SPLIT BY VENUE TYPE</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {ff.byVenue.map((v, i) => {
                  const barPct = (v.footfalls / ff.footfalls) * 100;
                  const fmtV = ff.fmtFF(v.footfalls);
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:130, flexShrink:0 }}>
                        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.text, fontWeight:600 }}>{v.type}</div>
                        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted }}>{v.examples}</div>
                      </div>
                      <div style={{ flex:1, height:8, background:"#DBEAFE", borderRadius:4, overflow:"hidden" }}>
                        <div style={{ width:`${barPct}%`, height:"100%", background:"#1D4ED8", borderRadius:4, transition:"width 0.4s" }} />
                      </div>
                      <div style={{ width:80, textAlign:"right", flexShrink:0 }}>
                        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:14, color:"#1D4ED8" }}>{fmtV}</span>
                        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginLeft:4 }}>({Math.round(barPct)}%)</span>
                      </div>
                      <div style={{ width:55, textAlign:"right", flexShrink:0 }}>
                        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted }}>ATP ₹{v.atp}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Show-time pricing tiers */}
            <div style={{ padding:"10px 18px 2px" }}>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9, color:"#1D4ED8", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>SHOW-TIME ATP MULTIPLIERS (PVR / INOX VERIFIED PRICING STRUCTURE)</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {SHOWTIME_TIERS.map((t, i) => (
                  <div key={i} style={{
                    background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:3,
                    padding:"7px 12px", minWidth:110, flex:1,
                  }}>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16, color:"#1D4ED8", lineHeight:1 }}>{t.multiplier}x</div>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:10, color:T.text, marginTop:3 }}>{t.label}</div>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:1 }}>{t.time} · {Math.round(t.share*100)}% of shows</div>
                    <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#6B7280", marginTop:2, fontStyle:"italic" }}>{t.note}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8, fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#9CA3AF", lineHeight:1.5 }}>
                Calibration anchors: Dhurandhar 3.65 Cr footfalls<Fn n={1} /> · Border 2 1.87 Cr<Fn n={1} /> · All-India 2025 ATP ₹161<Fn n={4} /> · Multiplex chain ATP data<Fn n={5} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Disclaimer footer */}
      <div style={{ padding:"8px 18px 10px", fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#9CA3AF", lineHeight:1.6 }}>
        ⚠ These are <strong>statistical estimates</strong> calibrated against verified real-world data: Dhurandhar 3.65 Cr footfalls/₹894 Cr net, Border 2 1.87 Cr/₹328 Cr, Chhaava ~3 Cr, all-India 2025 ATP ₹161. Film-type ATP multipliers correct for each film's actual screen penetration mix. GST rates from official govt. notifications. Actual figures vary by state, exhibitor and ticket tier. For informational purposes only.
      </div>
      <FootnotesBar ns={[1, 3, 4, 5, 7, 8]} />
    </div>
  );
}


/* ── X CHATTER PANEL ─────────────────────────────────────── */
function XChatterPanel({ posts }) {
  if (!posts || posts.length === 0) return null;
  return (
    <div style={{ background:"#FAFAFA", padding:"16px 20px 16px 60px", borderTop:"1px solid #E2E5EA", animation:"fadeIn 0.2s ease both" }}>
      <div style={{ marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", color:"#374151" }}>
          𝕏 Trade & Fan Chatter
        </span>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#9CA3AF" }}>
          · Verified trade analysts & film culture accounts
        </span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {posts.map((p, i) => (
          <div key={i} style={{
            background:"#fff",
            border:"1px solid #E2E5EA",
            borderLeft:`3px solid ${p.color}`,
            borderRadius:4,
            padding:"10px 14px",
            display:"flex", gap:12, alignItems:"flex-start",
          }}>
            {/* Avatar circle */}
            <div style={{
              width:32, height:32, borderRadius:"50%", flexShrink:0,
              background:p.color, display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:13, color:"#fff",
            }}>{p.name[0]}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:12, color:"#111827" }}>{p.name}</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#6B7280" }}>{p.handle}</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:p.color, fontWeight:600,
                  background:`${p.color}18`, padding:"1px 6px", borderRadius:2 }}>{p.role}</span>
                <span style={{ marginLeft:"auto", fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#9CA3AF" }}>{p.date}</span>
              </div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#374151", lineHeight:1.55 }}>
                {p.post}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:8, fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#9CA3AF", fontStyle:"italic" }}>
        Posts are editorial summaries of trade analyst commentary — not verbatim quotes. Sources: X/Twitter public posts.
      </div>
    </div>
  );
}

function OTTPanel({ ott }) {
  if (!ott) return null;
  const pc = PLATFORM_COLOR[ott.platform] || { bg:"#374151", text:"#fff" };
  const hasNetflixData = ott.debutViews !== "N/A" && ott.debutViews !== "TBD" && ott.debutViews;

  return (
    <div style={{
      background:"#FAFAF8",
      borderTop:`2px solid ${T.border}`,
      padding:"16px 20px 16px 60px",
      animation:"fadeIn 0.2s ease both",
    }}>
      {/* Platform badge + rights deal */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
        <span style={{
          background:pc.bg, color:pc.text,
          fontFamily:"'DM Sans', sans-serif", fontWeight:800,
          fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase",
          padding:"3px 10px", borderRadius:2,
        }}>{ott.platform}</span>
        {ott.rightsDeal && ott.rightsDeal !== "N/A" && (
          <span style={{
            fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:11,
            color:T.textMid, background:"#F0EDE8",
            border:`1px solid ${T.border}`, padding:"2px 8px", borderRadius:2,
          }}>OTT Rights: {ott.rightsDeal}</span>
        )}
        {ott.countries > 0 && (
          <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted }}>
            🌍 Top 10 in <strong>{ott.countries}</strong> countries
          </span>
        )}
        {ott.globalRank && ott.globalRank !== "N/A" && ott.globalRank !== "TBD" && (
          <span style={{
            fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:10,
            color: T.accent, background:"#FEE2E2",
            border:`1px solid #FCA5A5`, padding:"2px 8px", borderRadius:2,
          }}>Peak: {ott.globalRank}</span>
        )}
      </div>

      {/* Stats grid — only show if we have Netflix data */}
      {hasNetflixData && (
        <div style={{ display:"grid", gridTemplateColumns: typeof window !== "undefined" && window.innerWidth < 640 ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap:8, marginBottom:12 }}>
          {[
            { label:"Debut Views", value:ott.debutViews, highlight:true },
            { label:"Debut Hours", value:ott.debutHours, highlight:false },
            { label:"Lifetime Views", value:ott.lifetimeViews, highlight:false },
            { label:"Lifetime Hours", value:ott.lifetimeHours, highlight:false },
          ].map((s,i) => (
            <div key={i} style={{
              background: s.highlight ? T.surfaceAlt : T.surface,
              border:`1px solid ${T.border}`,
              padding:"10px 12px", borderRadius:2,
            }}>
              <div style={{
                fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700,
                fontSize:16, color: s.highlight ? T.accent : T.text,
                lineHeight:1.1, letterSpacing:"-0.01em",
              }}>{s.value}</div>
              <div style={{
                fontFamily:"'DM Sans', sans-serif", fontSize:9,
                color: s.highlight ? "#8A857E" : T.textMuted,
                marginTop:3, textTransform:"uppercase", letterSpacing:"0.08em",
              }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Note */}
      {ott.ottNote && (
        <div style={{
          fontFamily:"'DM Sans', sans-serif", fontSize:11,
          color:T.textMid, lineHeight:1.6,
          borderLeft:`3px solid ${T.border}`, paddingLeft:10,
        }}>
          {ott.ottNote}
        </div>
      )}
    </div>
  );
}

function BoxOfficeRow({ movie, rank, maxWeeks }) {
  const [hov, setHov]       = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab]       = useState("ott"); // "ott" | "gst" | "x"
  const isTop3    = rank <= 3;
  const medals    = ["🥇","🥈","🥉"];
  const isUpcoming = movie.status === "Upcoming";
  const pct       = maxWeeks > 0 ? Math.min((movie.weeksInTop10 / maxWeeks) * 100, 100) : 0;
  const hasOTT    = !!movie.ott;
  const gst       = calcGST(movie);           // null if no India Net data
  const hasGST    = !!gst;
  const hasX      = !!(movie.xChatter && movie.xChatter.length > 0);
  const tier      = movie.eventTier ? EVENT_TIER[movie.eventTier] : null;
  const canExpand = hasOTT || hasGST || hasX;

  const isMobile = useIsMobile();
  const handleRowClick = () => {
    if (!canExpand) return;
    if (!expanded) { setExpanded(true); }
    else { setExpanded(false); }
  };

  // ── MOBILE CARD ──
  if (isMobile) return (
    <div style={{ borderBottom:`1px solid ${T.border}`, borderLeft: tier ? `3px solid ${tier.borderColor}` : "none" }}>
      <div style={{ display:"flex", alignItems:"stretch" }}>
        {/* Poster */}
        {movie.posterUrl ? (
          <img src={movie.posterUrl} alt={movie.title}
            style={{ width:56, flexShrink:0, objectFit:"cover", display:"block" }}
            onError={e => { e.target.style.display="none"; }} />
        ) : (
          <div style={{ width:56, flexShrink:0, background:T.surfaceAlt, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:10, color:T.textMuted }}>
              {(movie.title||"").split(" ").map(w=>w[0]).join("").slice(0,3).toUpperCase()}
            </span>
          </div>
        )}
        {/* Content */}
        <div onClick={handleRowClick} style={{ flex:1, minWidth:0, padding:"10px 12px", background: tier ? tier.rowBg : T.surface, cursor: canExpand ? "pointer" : "default" }}>
          {/* Row 1: rank + title + verdict */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:14, color:T.textMuted, flexShrink:0 }}>#{rank}</span>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:17, color:T.text, lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
              {movie.pageUrl ? <a href={`/${movie.pageUrl}`} style={{ color:T.text, textDecoration:"none" }} onClick={e => e.stopPropagation()}>{movie.title}</a> : movie.title}
            </span>
            <VerdictPill verdict={movie.verdict} />
              {movie.brs && <BRSBadge brs={movie.brs} compact={true} />}
          </div>
          {/* Row 2: numbers */}
          <div style={{ display:"flex", gap:10, alignItems:"baseline", marginBottom:3, flexWrap:"wrap" }}>
            {movie.totalNum > 0 && <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:20, color:T.accent, lineHeight:1 }}>₹{movie.totalCollection} <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:400, fontSize:9, color:T.textMuted }}>WW</span></span>}
            {movie.indiaNet && movie.indiaNet !== "—" && <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:600, fontSize:16, color:T.textMid }}>₹{movie.indiaNet} <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:400, fontSize:9, color:T.textMuted }}>India</span></span>}
            <StatusDot status={movie.status} />
          </div>
          {/* Row 3: meta */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:T.textMuted }}>{movie.language} · {movie.director}</span>
            {canExpand && <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color: expanded ? T.accent : T.textMuted, letterSpacing:"0.04em" }}>{expanded ? "▲" : "▼ More"}</span>}
          </div>
        </div>
      </div>
      {expanded && canExpand && (
        <div>
          <div style={{ display:"flex", gap:0, borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, background:"#F5F3F0", overflowX:"auto" }}>
            {[hasOTT && { key:"ott", label:"📺 OTT" }, hasGST && { key:"gst", label:"🏛 GST" }, hasX && { key:"x", label:"𝕏 Trade" }].filter(Boolean).map(({ key, label }) => (
              <button key={key} onClick={e => { e.stopPropagation(); setTab(key); }} style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:11, padding:"8px 16px", background: tab===key ? T.accent : "transparent", color: tab===key ? "#fff" : T.textMuted, border:"none", cursor:"pointer", borderRight:`1px solid ${T.border}`, whiteSpace:"nowrap" }}>{label}</button>
            ))}
          </div>
          {tab === "ott" && hasOTT && <OTTPanel ott={movie.ott} />}
          {tab === "gst" && hasGST && <GSTPanel movie={movie} />}
          {tab === "x" && hasX && <XChatterPanel posts={movie.xChatter} />}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ borderBottom: tier ? `2px solid ${tier.borderColor}` : `1px solid ${T.border}` }}>
      {/* ── MAIN ROW ── */}
      <div
        onClick={handleRowClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display:"grid",
          // Added 100px GST column before Weeks
          gridTemplateColumns:"44px 1fr 130px 120px 105px 100px 88px",
          gap:0,
          background: hov
            ? (tier ? tier.rowBgHov : isTop3 ? "#FFFDF5" : "#FAFAF9")
            : tier ? tier.rowBg : isTop3 ? "#FFFDF5" : T.surface,
          transition:"background 0.12s",
          opacity: isUpcoming ? 0.75 : 1,
          cursor: canExpand ? "pointer" : "default",
          borderLeft: tier ? `4px solid ${tier.borderColor}` : "none",
        }}>

        {/* Rank */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"14px 8px", borderRight:`1px solid ${T.border}` }}>
          {rank <= 3
            ? <span style={{ fontSize:20 }}>{medals[rank-1]}</span>
            : <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:20, color:T.textMuted }}>#{rank}</span>}
        </div>

        {/* Film info */}
        <div style={{ padding:"10px 14px", display:"flex", flexDirection:"row", alignItems:"center", gap:12 }}>
          {/* Poster thumbnail */}
          {movie.posterUrl ? (
            <img
              src={movie.posterUrl}
              alt={movie.title}
              style={{ width:36, height:54, objectFit:"cover", borderRadius:2, flexShrink:0, border:`1px solid ${T.border}` }}
              onError={e => { e.target.style.display='none'; }}
            />
          ) : (
            <div style={{ width:36, height:54, flexShrink:0, background:T.surfaceAlt, borderRadius:2, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:10, color:T.textMuted }}>
                {(movie.title||'').split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase()}
              </span>
            </div>
          )}
          {/* Text block */}
          <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", gap:4, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            {movie.pageUrl ? (
              <a href={`/${movie.pageUrl}`} style={{
                fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700,
                fontSize:17, color:T.text, letterSpacing:"0.01em", lineHeight:1.1,
                textDecoration:"none", borderBottom:`1px solid ${T.border}`,
                transition:"color 0.15s, border-color 0.15s",
              }}
                onMouseEnter={e => { e.target.style.color=T.accent; e.target.style.borderColor=T.accent; }}
                onMouseLeave={e => { e.target.style.color=T.text; e.target.style.borderColor=T.border; }}
              >{movie.title}</a>
            ) : (
              <span style={{
                fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700,
                fontSize:17, color:T.text, letterSpacing:"0.01em", lineHeight:1.1,
              }}>{movie.title}</span>
            )}
            {tier && (
              <span style={{
                background: tier.badgeBg, color: tier.badgeText,
                fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
                fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase",
                padding:"2px 7px", borderRadius:2,
              }}>{tier.label}</span>
            )}
            <StatusDot status={movie.status} />
            {hasOTT && movie.ott.platform && movie.ott.platform !== "TBD" && (
              <span style={{
                background: (PLATFORM_COLOR[movie.ott.platform] || {bg:"#374151"}).bg,
                color: "#fff",
                fontFamily:"'DM Sans', sans-serif", fontWeight:800,
                fontSize:8, letterSpacing:"0.1em", padding:"2px 5px", borderRadius:1, textTransform:"uppercase",
              }}>{movie.ott.platform.replace(" (expected)","").replace(" + Prime Video","").split(" ")[0]}</span>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{
              background:T.text, color:"#fff", fontFamily:"'DM Sans', sans-serif",
              fontWeight:600, fontSize:9, padding:"2px 6px", borderRadius:2, letterSpacing:"0.08em", textTransform:"uppercase",
            }}>{movie.language}</span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted }}>Dir. {movie.director} · {movie.releaseDate}</span>
            {movie.budget !== "—" && <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted }}>Budget: ₹{movie.budget}</span>}
            <VerdictPill verdict={movie.verdict} />
          </div>
          {movie.note && (
            <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.gold, fontStyle:"italic", marginTop:1 }}>
              ★ {movie.note}
            </div>
          )}
          {/* Expand / collapse hint */}
          {canExpand && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:2, flexWrap:"wrap" }}>
              <span style={{
                fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:10,
                color: expanded ? T.accent : T.textMuted,
                letterSpacing:"0.04em", transition:"color 0.15s",
              }}>
                {expanded ? "▲ Collapse" : "▼ Expand"}
              </span>
              {hasOTT && movie.ott.debutViews && movie.ott.debutViews !== "N/A" && movie.ott.debutViews !== "TBD" && (
                <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.accent, fontWeight:700 }}>
                  · {movie.ott.debutViews} OTT debut
                </span>
              )}
              {hasGST && (
                <span style={{
                  background:"#DCFCE7", color:"#15803D",
                  fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9,
                  letterSpacing:"0.08em", textTransform:"uppercase", padding:"1px 5px", borderRadius:2,
                }}>
                  GST ₹{gst.gstCrore} Cr
                </span>
              )}
            </div>
          )}
          </div>{/* end text block */}
        </div>{/* end film info */}

        {/* Worldwide */}
        <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", justifyContent:"center", borderLeft:`1px solid ${T.border}` }}>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:19, color: movie.totalNum > 0 ? T.accent : T.textMuted, letterSpacing:"-0.01em" }}>
            {movie.totalNum > 0 ? `₹${movie.totalCollection}` : "—"}
          </span>
          <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted, marginTop:2 }}>Worldwide</span>
        </div>

        {/* India Net */}
        <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", justifyContent:"center", borderLeft:`1px solid ${T.border}` }}>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:600, fontSize:17, color:T.text }}>
            {movie.totalNum > 0 && movie.indiaNet !== "—" ? `₹${movie.indiaNet}` : movie.indiaNet === "OTT Premiere" ? "OTT" : "—"}
          </span>
          <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted, marginTop:2 }}>India Net</span>
        </div>

        {/* Overseas */}
        <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", justifyContent:"center", borderLeft:`1px solid ${T.border}` }}>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:600, fontSize:17, color:T.text }}>
            {movie.overseas ? `₹${movie.overseas}` : "—"}
          </span>
          <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted, marginTop:2 }}>Overseas</span>
        </div>

        {/* ── GST COLUMN (new) ── */}
        <div style={{
          padding:"10px 12px",
          display:"flex", flexDirection:"column", justifyContent:"center",
          borderLeft:`1px solid ${T.border}`,
          background: hasGST ? (hov ? "#F0FDF4" : "#F7FEF9") : "transparent",
        }}>
          {hasGST ? (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:2 }}>
                <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:16, color:"#15803D", letterSpacing:"-0.01em" }}>
                  ₹{gst.gstCrore} Cr
                </span>
              </div>
              <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:"#6B7280", letterSpacing:"0.04em", textTransform:"uppercase" }}>
                Est. GST
              </span>
              <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:"#9CA3AF", marginTop:1 }}>
                {gst.blendedRate}% blended
              </span>
              <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#16A34A", marginTop:2, letterSpacing:"0.04em" }}>
                ↓ tap for details
              </span>
              {/* Mini confidence bar */}
              <div style={{ width:"100%", height:2, background:"#D1FAE5", borderRadius:1, marginTop:5 }}>
                <div style={{
                  width: gst.confidence === "HIGH" ? "100%" : gst.confidence === "MEDIUM" ? "60%" : "30%",
                  height:"100%", background:"#16A34A", borderRadius:1,
                }} />
              </div>
            </>
          ) : (
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:T.textMuted }}>—</span>
          )}
        </div>

        {/* Weeks */}
        <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", borderLeft:`1px solid ${T.border}` }}>
          {movie.weeksInTop10 > 0 ? (
            <>
              <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:24, color:T.accent, lineHeight:1 }}>
                {movie.weeksInTop10}
              </span>
              <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, letterSpacing:"0.05em", marginTop:2 }}>
                WKS TOP 10
              </span>
              <div style={{ width:"100%", height:3, background:T.border, borderRadius:2, marginTop:6 }}>
                <div style={{ width:`${pct}%`, height:"100%", background:T.accent, borderRadius:2 }} />
              </div>
            </>
          ) : <span style={{ color:T.textMuted, fontSize:12 }}>—</span>}
        </div>
      </div>

      {/* ── EXPANDABLE PANEL with tabs ── */}
      {expanded && canExpand && (
        <div>
          {/* Tab switcher */}
          <div style={{
            display:"flex", gap:0,
            borderTop:`1px solid ${T.border}`,
            borderBottom:`1px solid ${T.border}`,
            background:"#F5F3F0",
          }}>
            {[
              hasOTT  && { key:"ott", label:"📺 OTT / Streaming Data" },
              hasGST  && { key:"gst", label:"🏛 GST & Tax Intelligence" },
              hasX    && { key:"x",   label:"𝕏 Trade Chatter" },
            ].filter(Boolean).map(({ key, label }) => (
              <button
                key={key}
                onClick={e => { e.stopPropagation(); setTab(key); }}
                style={{
                  fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:11,
                  letterSpacing:"0.06em", textTransform:"uppercase",
                  padding:"8px 20px",
                  background: tab === key ? (key === "gst" ? "#15803D" : key === "x" ? "#111827" : T.accent) : "transparent",
                  color: tab === key ? "#fff" : T.textMuted,
                  border:"none", cursor:"pointer",
                  borderRight:`1px solid ${T.border}`,
                  transition:"all 0.12s",
                }}
              >{label}</button>
            ))}
          </div>
          {/* Panel content */}
          {tab === "ott" && hasOTT && <OTTPanel ott={movie.ott} />}
          {tab === "gst" && hasGST && <GSTPanel movie={movie} />}
          {tab === "x" && hasX && <XChatterPanel posts={movie.xChatter} />}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   BOXOFFY REVIEW SCORE (BRS)
   Three-pillar rating: Critic Consensus (30%) + Verified Audience
   Week 2+ (50%) + Box Office Signal/ROI (20%) = score /100
   Week 1 scores are provisional (⚡) — locked at Week 2 (✅)
   ═══════════════════════════════════════════════════════════════ */
function BRSBadge({ brs, compact = false }) {
  const [hov, setHov] = React.useState(false);
  if (!brs || !brs.score) return null;

  const { score, critic, audience, boSignal, label, audienceWeek,
          criticCount, audienceSource, criticSource, note } = brs;

  const provisional = audienceWeek === 1;

  const scoreColor =
    score >= 80 ? "#15803D" :
    score >= 65 ? "#B45309" : "#B91C1C";

  const scoreBg =
    score >= 80 ? "#F0FDF4" :
    score >= 65 ? "#FFFBEB" : "#FEF2F2";

  const scoreBorder =
    score >= 80 ? "#86EFAC" :
    score >= 65 ? "#FCD34D" : "#FCA5A5";

  const barStyle = (val, color) => ({
    height: 4,
    borderRadius: 2,
    background: "#E5E7EB",
    marginTop: 2,
    marginBottom: 6,
    position: "relative",
    overflow: "hidden",
  });

  const barFill = (val, color) => ({
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    width: `${val}%`,
    background: color,
    borderRadius: 2,
    transition: "width 0.3s ease",
  });

  if (compact) {
    return (
      <div style={{ position: "relative", display: "inline-block" }}
           onMouseEnter={() => setHov(true)}
           onMouseLeave={() => setHov(false)}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 2,
          background: scoreBg, border: `1px solid ${scoreBorder}`,
          borderRadius: 3, padding: "2px 6px", cursor: "default",
        }}>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: 13, color: scoreColor,
            letterSpacing: "-0.01em", lineHeight: 1,
          }}>{score}</span>
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 7, fontWeight: 700, color: scoreColor,
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>BRS</span>
          {provisional && (
            <span style={{ fontSize: 8, color: "#D97706" }}>⚡</span>
          )}
        </div>

        {/* Tooltip */}
        {hov && (
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)",
            zIndex: 999, width: 220,
            background: "#0D1117", border: `1px solid #374151`,
            borderRadius: 4, padding: "12px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,.35)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 22, color: scoreColor }}>{score}</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", marginLeft: 4 }}>
                  Boxoffy Review Score
                </span>
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700, color: scoreColor, background: scoreBg, border: `1px solid ${scoreBorder}`, padding: "2px 6px", borderRadius: 2 }}>
                {label}
              </div>
            </div>

            {/* Pillars */}
            {[
              { label: "Critic Consensus", val: critic, color: "#60A5FA", wt: "30%", src: `${criticCount} reviews · ${criticSource}` },
              { label: `Audience ${provisional ? "⚡ Week 1" : "✅ Week 2+"}`, val: audience, color: "#34D399", wt: "50%", src: audienceSource },
              { label: "BO Signal (ROI)", val: boSignal, color: "#FBBF24", wt: "20%", src: "India ROI vs budget" },
            ].map(({ label: l, val, color, wt, src }) => (
              <div key={l} style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, color: "#9CA3AF" }}>{l} <span style={{ color: "#4B5563" }}>({wt})</span></span>
                  <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, color }}>{val}</span>
                </div>
                <div style={barStyle(val, color)}>
                  <div style={barFill(val, color)} />
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 8, color: "#4B5563", marginBottom: 2 }}>{src}</div>
              </div>
            ))}

            {note && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #1F2937", fontFamily: "'DM Sans',sans-serif", fontSize: 9, color: "#9CA3AF", fontStyle: "italic" }}>
                {note}
              </div>
            )}

            {provisional && (
              <div style={{ marginTop: 6, padding: "4px 6px", background: "#451A03", borderRadius: 2, fontFamily: "'DM Sans',sans-serif", fontSize: 8, color: "#FDE68A" }}>
                ⚡ Provisional — Week 1 audience score. Will update at Week 2.
              </div>
            )}

            <div style={{ marginTop: 8, fontFamily: "'DM Sans',sans-serif", fontSize: 7, color: "#374151", textAlign: "right" }}>
              boxoffy.com/brs-methodology
            </div>
          </div>
        )}
      </div>
    );
  }

  return null; // full-size variant reserved for film pages
}

/* ═══════════════════════════════════════════════════════════════
   NATIONAL TOP 10 ROW — BCM Weekly Chart (Apr 2026+)
   Columns: Rank | Poster | Film+Studio | This Wk | Last Wk | Chg | Domestic | Global
   ═══════════════════════════════════════════════════════════════ */
function NationalTop10Row({ movie, rank }) {
  const isMobile = useIsMobile();
  const isNew    = !movie.lastWeekCollection || movie.weekNum <= 1;
  const isHolly  = movie.language === "Hollywood";
  const [shareOpen, setShareOpen] = React.useState(false);

  const chgPct = movie.lastWeekCollection > 0
    ? Math.round(((movie.weeklyCollection - movie.lastWeekCollection) / movie.lastWeekCollection) * 100)
    : null;

  const GRID_DESKTOP = "28px 38px 1fr 92px 92px 46px 106px 106px";
  const GRID_MOBILE  = "24px 34px 1fr 82px 44px 90px";

  const rankColor = rank === 1 ? "#B8860B" : rank === 2 ? "#6B7280" : rank === 3 ? "#B45309" : T.textMuted;

  const cellBase = { display:"flex", flexDirection:"column", justifyContent:"center", textAlign:"right", padding:"0 10px" };

  const atbTag = (label) => label ? (
    <span style={{ display:"inline-block", fontFamily:"'IBM Plex Mono',monospace", fontSize:7.5, fontWeight:700, letterSpacing:"0.06em", padding:"1px 5px", borderRadius:2, background:"#FEF3C7", color:"#92400E", marginTop:3 }}>{label}</span>
  ) : null;

  const topTag = (label) => label ? (
    <span style={{ display:"inline-block", fontFamily:"'IBM Plex Mono',monospace", fontSize:7.5, fontWeight:700, letterSpacing:"0.06em", padding:"1px 5px", borderRadius:2, background:"#D1FAE5", color:"#065F46", marginTop:3 }}>{label}</span>
  ) : null;

  const row = (
    <div>
      {shareOpen && <SharePanel movie={movie} onClose={() => setShareOpen(false)} />}
    <div style={{
      display:"grid",
      gridTemplateColumns: isMobile ? GRID_MOBILE : GRID_DESKTOP,
      alignItems:"center",
      borderBottom: shareOpen ? "none" : `0.5px solid ${T.border}`,
      borderLeft: isNew ? `3px solid ${T.accent}` : `3px solid transparent`,
      background: isNew ? "rgba(196,30,58,0.03)" : T.surface,
      transition:"background 0.12s",
      minHeight:60,
    }}
      onMouseEnter={e => { if (!isNew) e.currentTarget.style.background = T.surfaceAlt; }}
      onMouseLeave={e => { e.currentTarget.style.background = isNew ? "rgba(196,30,58,0.03)" : T.surface; }}
    >
      {/* Rank */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 2px" }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:20, color:rankColor, lineHeight:1 }}>{rank}</span>
        {isNew && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, fontWeight:700, color:"#fff", background:T.accent, padding:"1px 3px", borderRadius:2, marginTop:2, letterSpacing:"0.08em" }}>NEW</span>}
      </div>

      {/* Poster */}
      {movie.posterUrl
        ? <img src={movie.posterUrl} alt={movie.title} style={{ width:30, height:45, objectFit:"cover", borderRadius:3, display:"block", border:`0.5px solid ${T.border}` }} onError={e => e.target.style.display="none"} />
        : <div style={{ width:30, height:45, borderRadius:3, background:isHolly?"#1E3A5F":T.navy||"#0F2340", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:9, color:"rgba(255,255,255,0.5)" }}>
              {(movie.title||"").split(" ").map(w=>w[0]).join("").slice(0,3).toUpperCase()}
            </span>
          </div>
      }

      {/* Film + Studio */}
      <div style={{ padding:"0 10px", minWidth:0 }}>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:isMobile?12:13.5, color:T.text, lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
          {movie.pageUrl ? <a href={`/${movie.pageUrl}`} style={{ color:T.text, textDecoration:"none" }}>{movie.title}</a> : movie.title}
          {movie.weeklyNote && (movie.weeklyNote.includes("Super Sunday") || movie.weeklyNote.includes("BCM CALL")) && (
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, fontWeight:700, color:"#15803D", background:"#D1FAE5", padding:"1px 5px", borderRadius:3, flexShrink:0 }}>↗ UPSWING</span>
          )}
        </div>
        {movie.studio && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{movie.studio}</div>}
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, fontWeight:500, letterSpacing:"0.06em", textTransform:"uppercase", color:T.textMuted, marginTop:3 }}>
          {movie.language}{movie.weekNum > 0 ? ` · W${movie.weekNum}` : ""}
          {movie.verdict && ` · ${movie.verdict}`}
        </div>
        {isMobile && (
          <button onClick={() => setShareOpen(v => !v)} style={{
            marginTop:5, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:10,
            background: shareOpen ? T.accent : "#F3F4F6",
            color: shareOpen ? "#fff" : "#374151",
            border:"none", borderRadius:4, padding:"3px 10px", cursor:"pointer",
            display:"inline-flex", alignItems:"center", gap:4,
          }}>↗ Share</button>
        )}
      </div>

      {/* This Week */}
      <div style={cellBase}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:isMobile?15:17, color: movie.estimated||movie.betaModel ? "#D97706" : T.accent, lineHeight:1 }}>
          {movie.weeklyCollection > 0 ? `₹${movie.weeklyCollection} Cr` : "—"}
        </div>
        {movie.bcmConfidence && movie.weeklyCollection > 0 && (
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, fontWeight:600, color: movie.bcmConfidence >= 85 ? "#15803D" : "#D97706", marginTop:3 }}>
            {movie.bcmConfidence}% conf.
          </div>
        )}
        {(movie.estimated || movie.betaModel) && movie.weeklyCollection > 0 && (
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, color:"#D97706", marginTop:1, letterSpacing:"0.06em" }}>BCM EST.</div>
        )}
      </div>

      {/* Last Week — hidden on mobile */}
      {!isMobile && (
        <div style={cellBase}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:500, color:T.textMuted, lineHeight:1 }}>
            {movie.lastWeekCollection > 0 ? `₹${movie.lastWeekCollection} Cr` : "—"}
          </div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:8, color:T.textMuted, marginTop:3 }}>
            {movie.lastWeekRange || ""}
          </div>
        </div>
      )}

      {/* Chg % */}
      <div style={{ ...cellBase, padding:"0 6px" }}>
        {chgPct !== null
          ? <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, color: chgPct >= 0 ? "#16A34A" : "#DC2626" }}>
              {chgPct >= 0 ? `+${chgPct}` : chgPct}%
            </span>
          : <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted }}>
              {isNew ? "W1" : "—"}
            </span>
        }
      </div>

      {/* Cumulative Domestic — hidden on mobile */}
      {!isMobile && (
        <div style={cellBase}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:15, color:T.text, lineHeight:1 }}>
            {movie.indiaNet || (movie.totalNum > 0 ? `₹${movie.totalNum} Cr` : "—")}
          </div>
          {movie.domesticATB && atbTag(movie.domesticATB)}
          {movie.weeklyNote && (movie.weeklyNote.includes("called") || movie.weeklyNote.includes("BCM CALL")) && (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, color:"#065F46", background:"#D1FAE5", padding:"1px 4px", borderRadius:2, marginTop:3 }}>✓ BOXOFFY CALL</div>
          )}
        </div>
      )}

      {/* Global WW */}
      <div style={cellBase}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:isMobile?13:15, color: isHolly ? "#1D4ED8" : T.text, lineHeight:1 }}>
          {movie.ww || movie.wwGross || movie.totalCollection || "—"}
        </div>
        {movie.globalATB && topTag(movie.globalATB)}
        {isMobile && movie.indiaNet && (
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:8, color:T.textMuted, marginTop:3 }}>{movie.indiaNet}</div>
        )}
      </div>
    </div>
    </div>
  );

  return row;
}

function WeeklyChartRow({ movie, rank, prevRank }) {
  const [hov, setHov] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Rank movement
  let moveEl = null;
  if (movie.status === "Upcoming") {
    moveEl = <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, letterSpacing:"0.06em" }}>UPCOMING</span>;
  } else if (prevRank === 0 || movie.weekNum === 1) {
    moveEl = <span style={{ background:"#1A7A3C", color:"#fff", fontFamily:"'DM Sans', sans-serif", fontWeight:800, fontSize:9, padding:"2px 5px", borderRadius:2, letterSpacing:"0.06em" }}>NEW</span>;
  } else if (movie.status === "OTT" || movie.weeklyCollection === 0) {
    moveEl = <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, letterSpacing:"0.06em" }}>OTT</span>;
  } else if (prevRank === null) {
    moveEl = <span style={{ color:T.textMuted, fontSize:11 }}>—</span>;
  } else if (rank < prevRank) {
    moveEl = <span style={{ color:"#16A34A", fontSize:13, fontWeight:800 }}>▲{prevRank - rank}</span>;
  } else if (rank > prevRank) {
    moveEl = <span style={{ color:T.accent, fontSize:13, fontWeight:800 }}>▼{rank - prevRank}</span>;
  } else {
    moveEl = <span style={{ color:T.textMuted, fontSize:13 }}>—</span>;
  }

  const verdictCfg = VERDICT_CFG[movie.verdict] || VERDICT_CFG["Average"];
  const isActive = movie.status === "Running";
  const isUpcoming = movie.status === "Upcoming";
  const isNew = movie.weekNum === 1 && movie.status === "Running";
  const isEstimated = movie.estimated === true || movie.betaModel === true;
  const isHollywood = movie.language === "Hollywood";

  const isMobile = useIsMobile();

  const [shareOpen, setShareOpen] = React.useState(false);
  if (isMobile) return (
    <>
      {shareOpen && <SharePanel movie={movie} onClose={() => setShareOpen(false)} />}
      <div style={{
        borderBottom:`1px solid ${T.border}`,
        opacity: isUpcoming ? 0.55 : 1,
        borderLeft: isActive ? `3px solid ${isNew ? "#16A34A" : isHollywood ? "#2563EB" : T.accent}` : isUpcoming ? `3px solid ${T.gold}` : `3px solid transparent`,
      }}>
        <div style={{ display:"flex", gap:0, alignItems:"stretch" }}>
          {/* Poster */}
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={movie.title}
              style={{ width:52, flexShrink:0, objectFit:"cover", alignSelf:"stretch", display:"block" }}
              onError={e => { e.target.style.display="none"; }} />
          ) : (
            <div style={{ width:52, flexShrink:0, background:T.surfaceAlt, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:10, color:T.textMuted }}>
                {(movie.title||"").split(" ").map(w=>w[0]).join("").slice(0,3).toUpperCase()}
              </span>
            </div>
          )}
          {/* Main content */}
          <div style={{ flex:1, minWidth:0, padding:"10px 12px", background: isNew ? "#F0FFF4" : isUpcoming ? "#FFFBF0" : isHollywood ? "#F8FBFF" : T.surface }}>
            {/* Row 1: rank + move + title + verdict */}
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
              <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:14, color: rank <= 3 ? T.accent : T.textMuted, flexShrink:0 }}>{rank}</span>
              {moveEl && <span style={{ flexShrink:0 }}>{moveEl}</span>}
              <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:17, color:T.text, lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                {movie.pageUrl ? <a href={`/${movie.pageUrl}`} style={{ color:T.text, textDecoration:"none" }} onClick={e=>e.stopPropagation()}>{movie.title}</a> : movie.title}
              </span>
              <span style={{ background:verdictCfg.bg, color:verdictCfg.color, border:`1px solid ${verdictCfg.border}`, fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:8, letterSpacing:"0.05em", textTransform:"uppercase", borderRadius:2, padding:"2px 4px", flexShrink:0 }}>{movie.verdict}</span>
            </div>
            {/* Row 2: numbers */}
            <div style={{ display:"flex", gap:10, alignItems:"baseline", flexWrap:"wrap", marginBottom:3 }}>
              {movie.weeklyCollection > 0 && (
                <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:20, color: isEstimated ? "#D97706" : T.accent, lineHeight:1 }}>
                  {isEstimated ? "~" : ""}₹{movie.weeklyCollection} Cr
                  {isEstimated && <span style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:7, color:"#D97706", fontWeight:700, letterSpacing:"0.08em", marginLeft:4, verticalAlign:"middle" }}>EST</span>}
                </span>
              )}
              {movie.totalCollection > 0 && <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:600, fontSize:15, color:T.textMid }}>₹{movie.totalCollection} Cr</span>}
              {isUpcoming && <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted }}>{movie.releaseDate}</span>}
              {!isUpcoming && movie.daysInRelease > 0 && <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted }}>Day {movie.daysInRelease}</span>}
            </div>
            {/* Row 3: meta + actions */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:T.textMuted }}>{movie.language}{movie.weekNum > 0 ? ` · Wk ${movie.weekNum}` : ""}</span>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {movie.ott && (
                  <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }} style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:10, color: expanded ? T.accent : T.textMuted, background:"transparent", border:"none", cursor:"pointer", padding:"2px 0", letterSpacing:"0.04em" }}>
                    {expanded ? "▲" : "▼ OTT"}
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); setShareOpen(true); }} style={{
                  fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:10,
                  background:"#F3F4F6", color:"#374151",
                  border:"none", borderRadius:4, padding:"4px 10px", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:4,
                }}>↗ Share</button>
              </div>
            </div>
          </div>
        </div>
        {expanded && movie.ott && <OTTPanel ott={movie.ott} />}
      </div>
    </>
  );

  return (
    <div style={{ borderBottom:`1px solid ${T.border}`, opacity: isUpcoming ? 0.55 : 1 }}>
      <div
        onClick={() => movie.ott && setExpanded(e => !e)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display:"grid",
          gridTemplateColumns:"36px 28px 1fr 120px 120px 110px 80px",
          background: hov && !isUpcoming ? (isHollywood ? "#EFF6FF" : "#FAFAF9") : isNew ? "#F0FFF4" : isUpcoming ? "#FFFBF0" : isHollywood ? "#F8FBFF" : T.surface,
          transition:"background 0.12s",
          cursor: movie.ott ? "pointer" : "default",
          borderLeft: isActive ? `3px solid ${isNew ? "#16A34A" : isHollywood ? "#2563EB" : T.accent}` : isUpcoming ? `3px solid ${T.gold}` : isHollywood ? `3px solid #93C5FD` : `3px solid transparent`,
        }}>

        {/* Rank */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"14px 4px", borderRight:`1px solid ${T.border}` }}>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:16, color: rank <= 3 ? T.accent : T.textMuted }}>
            {rank}
          </span>
        </div>

        {/* Movement */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"0 2px", borderRight:`1px solid ${T.border}` }}>
          {moveEl}
        </div>

        {/* Film info */}
        <div style={{ padding:"8px 12px", borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"row", alignItems:"center", gap:10 }}>
          {/* Poster thumbnail */}
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={movie.title}
              style={{ width:30, height:45, objectFit:"cover", borderRadius:2, flexShrink:0, border:`1px solid ${T.border}` }}
              onError={e => { e.target.style.display='none'; }} />
          ) : (
            <div style={{ width:30, height:45, flexShrink:0, background:T.surfaceAlt, borderRadius:2, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:9, color:T.textMuted }}>
                {(movie.title||'').split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase()}
              </span>
            </div>
          )}
          <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
            {movie.pageUrl ? (
              <a href={`/${movie.pageUrl}`} style={{
                fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800,
                fontSize:16, color:T.text, lineHeight:1.1, textDecoration:"none",
                borderBottom:`1px solid ${T.border}`, transition:"color 0.15s, border-color 0.15s",
              }}
                onMouseEnter={e => { e.target.style.color=T.accent; e.target.style.borderColor=T.accent; }}
                onMouseLeave={e => { e.target.style.color=T.text; e.target.style.borderColor=T.border; }}
              >{movie.title}</a>
            ) : (
              <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:16, color:T.text, lineHeight:1.1 }}>
                {movie.title}
              </span>
            )}
            <span style={{ background:verdictCfg.bg, color:verdictCfg.color, border:`1px solid ${verdictCfg.border}`, fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9, letterSpacing:"0.05em", textTransform:"uppercase", borderRadius:2, padding:"1px 5px" }}>
              {movie.verdict}
            </span>
            {isHollywood && (
              <span style={{ background:"#1D4ED8", color:"#fff", fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9, letterSpacing:"0.07em", textTransform:"uppercase", borderRadius:2, padding:"1px 6px" }}>
                🎬 FOREIGN
              </span>
            )}
            {movie.ott && (
              <span style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, color:T.textMuted, fontFamily:"'DM Sans', sans-serif", fontSize:9, fontWeight:600, padding:"1px 5px", borderRadius:2, letterSpacing:"0.04em" }}>
                OTT ▼
              </span>
            )}
          </div>
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted }}>
            {movie.director} · {movie.language} · {movie.releaseDate}
            {movie.daysInRelease > 0 && <span style={{ marginLeft:6, color:T.textMuted }}>· Day {movie.daysInRelease}</span>}
          </div>
          {isEstimated && (
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
              <span style={{ background:"#FEF3C7", color:"#92400E", border:"1px solid #FCD34D", fontFamily:"'IBM Plex Mono', monospace", fontSize:8, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", padding:"2px 7px", borderRadius:2 }}>BOXOFFY CALL</span>
            </div>
          )}
          {movie.weeklyNote && (
            <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10.5, color:T.textMid, marginTop:4, lineHeight:1.5 }}>
              {movie.weeklyNote.length > 100 ? movie.weeklyNote.slice(0, 100).trimEnd() + "…" : movie.weeklyNote}
            </div>
          )}
          {/* Opening Day Prediction — shown for Upcoming films */}
          {movie.openingPrediction && movie.status === "Upcoming" && (
            <div style={{ marginTop:8, padding:"8px 12px", background:"#FFFBEB", border:"1px dashed #D97706", borderRadius:4 }}>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:11, color:"#92400E", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>
                🔮 BOXOFFY OPENING DAY PREDICTION
              </div>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:22, color:"#D97706", fontStyle:"italic" }}>
                    ₹{movie.openingPrediction.mid}–{movie.openingPrediction.high} Cr
                  </div>
                  <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:"#92400E", letterSpacing:"0.08em", textTransform:"uppercase" }}>All Languages</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:16, color:"#B45309", fontStyle:"italic" }}>
                    ₹{movie.openingPrediction.low}–{movie.openingPrediction.mid} Cr
                  </div>
                  <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:"#92400E", letterSpacing:"0.08em", textTransform:"uppercase" }}>Hindi Net Only</div>
                </div>
              </div>
              <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:"#78350F", fontStyle:"italic", lineHeight:1.4 }}>
                {movie.openingPrediction.note}
              </div>
              <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:"#A87840", marginTop:4 }}>
                Sources: {movie.openingPrediction.basis}
              </div>
            </div>
          )}

          </div>{/* end text block */}
        </div>{/* end film info */}

        {/* This week */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 14px", borderRight:`1px solid ${T.border}`, textAlign:"right" }}>
          {movie.weeklyCollection > 0
            ? <>
                <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize: isEstimated ? 24 : 20, color: isEstimated ? "#D97706" : isNew ? "#16A34A" : T.accent, lineHeight:1 }}>
                  ₹{movie.weeklyCollection} Cr
                </div>
                <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, fontWeight: isEstimated ? 700 : 400, color: isEstimated ? "#D97706" : T.textMuted, marginTop:2, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                  {isEstimated ? "DAY 1 CALL" : movie.weekNum === 0 ? "PREMIERE" : `Wk ${movie.weekNum}`}
                </div>
                {isEstimated && (
                  <div style={{ marginTop:3, fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#9CA3AF", letterSpacing:"0.04em" }}>
                    ₹80–₹110 Cr range
                  </div>
                )}
                {!isEstimated && movie.weekNum === 0 && (
                  <div style={{ marginTop:3, fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#9CA3AF", letterSpacing:"0.04em" }}>
                    Sacnilk · rough data
                  </div>
                )}
              </>
            : <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted }}>
                {movie.status === "Upcoming" ? "Mar 19" : "Closed"}
              </div>
          }
        </div>

        {/* India net total */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 14px", borderRight:`1px solid ${T.border}`, textAlign:"right" }}>
          <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:17, color: movie.estimated ? "#D97706" : T.text, lineHeight:1 }}>{movie.indiaNet}</div>
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, marginTop:2, letterSpacing:"0.06em", textTransform:"uppercase" }}>India Net</div>
        </div>

        {/* Worldwide total + GST + Footfalls */}
        {(() => {
          const gst = calcGST(movie);
          const ff  = calcFootfalls(movie);
          return (
            <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 14px", borderRight:`1px solid ${T.border}`, textAlign:"right" }}>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:17, color: isHollywood ? "#1D4ED8" : T.text, lineHeight:1 }}>
                {isHollywood ? movie.totalCollection : movie.totalCollection}
              </div>
              <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, marginTop:2, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                {isHollywood ? "India Gross" : "Worldwide"}
              </div>
              {gst && gst.gstCrore > 0 && (
                <div style={{ marginTop:5, paddingTop:4, borderTop:`1px dashed ${T.border}` }}>
                  <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:13, color:"#15803D", lineHeight:1 }}>
                    ₹{gst.gstCrore} Cr
                  </div>
                  <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#15803D", marginTop:1, letterSpacing:"0.05em", textTransform:"uppercase", opacity:0.85 }}>
                    GST to Govt
                  </div>
                </div>
              )}
              {ff && ff.footfalls > 0 && !isUpcoming && (
                <div style={{ marginTop:4, paddingTop:4, borderTop:`1px dashed ${T.border}` }}>
                  <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:13, color:"#1D4ED8", lineHeight:1 }}>
                    {ff.footfallsFormatted}
                  </div>
                  <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#1D4ED8", marginTop:1, letterSpacing:"0.05em", textTransform:"uppercase", opacity:0.85 }}>
                    Footfalls
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Budget / status / BRS */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", padding:"0 10px", textAlign:"center", gap:4 }}>
          {movie.brs && <BRSBadge brs={movie.brs} compact={true} />}
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted }}>₹{movie.budget}</div>
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color: isActive ? T.green : isUpcoming ? T.gold : T.textMuted, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", marginTop:2 }}>
            {movie.status}
          </div>
        </div>
      </div>

      {/* OTT Panel */}
      {expanded && movie.ott && <OTTPanel ott={movie.ott} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FOREIGN FILMS PANEL — BOG-Style Weekend Chart
   Two-panel split: India Collections (left) | US/Global (right)
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   FOREIGN FILMS — BOX OFFICE GURU–STYLE WEEKEND CHART
   Clean, light, tabular. BOG aesthetic: white surface, ruled rows,
   bold rank numbers, red accent bar, crisp mono data columns.
   Two views: 🇮🇳 India  |  🌐 US/Global
   ═══════════════════════════════════════════════════════════════════ */

// ── Helpers ──────────────────────────────────────────────────────────
const fmt$ = v => {
  if (v == null) return "—";
  if (v >= 1000) return `$${(v/1000).toFixed(2)}B`;
  return `$${v.toFixed(1)}M`;
};
const fmtInr = v => v != null ? `₹${typeof v === "number" ? v % 1 === 0 ? v : v.toFixed(2) : v} Cr` : "—";
const fmtThousands = v => v ? v.toLocaleString() : "—";

// ── Sub-components ───────────────────────────────────────────────────
function BogMoveCell({ change }) {
  if (change == null)  return <span style={{ color:"#B0A8A0", fontSize:11, fontFamily:"'DM Sans',sans-serif" }}>—</span>;
  if (change === 0)    return <span style={{ color:"#6B7280", fontSize:11, fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>—</span>;
  const up = change > 0;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:1,
      color: up ? "#16A34A" : "#DC2626",
      fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:10,
    }}>
      {up ? "▲" : "▼"}{Math.abs(change)}
    </span>
  );
}

function BogScorePill({ label, value, color }) {
  if (!value) return null;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:3,
      background: color + "15", color,
      border:`1px solid ${color}30`,
      fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9,
      padding:"1px 6px", borderRadius:2, letterSpacing:"0.04em",
      whiteSpace:"nowrap",
    }}>
      <span style={{ opacity:0.7, fontSize:8 }}>{label}</span>{value}
    </span>
  );
}

function BogStatusBadge({ status, releaseDate }) {
  if (status === "Running")  return <span style={{ background:"#DCFCE7", color:"#166534", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:8, padding:"2px 6px", borderRadius:2, letterSpacing:"0.1em", textTransform:"uppercase" }}>IN CINEMAS</span>;
  if (status === "Upcoming") return <span style={{ background:"#FEF9C3", color:"#854D0E", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:8, padding:"2px 6px", borderRadius:2, letterSpacing:"0.1em", textTransform:"uppercase" }}>Opens {releaseDate}</span>;
  return <span style={{ background:"#F3F4F6", color:"#9CA3AF", fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:8, padding:"2px 6px", borderRadius:2, letterSpacing:"0.1em", textTransform:"uppercase" }}>OTT / CLOSED</span>;
}

// ── Single chart row ─────────────────────────────────────────────────
function BogRow({ movie, viewMode, rank, isNew }) {
  const [exp, setExp] = useState(false);
  const isMobile = useIsMobile();

  const isRunning  = movie.status === "Running";
  const isUpcoming = movie.status === "Upcoming";
  const isOTT      = movie.status === "OTT";

  const rowBg     = exp ? "#EFF6FF" : isRunning ? "#FFFFFF" : isUpcoming ? "#FFFEF5" : "#FAFAFA";
  const accentCol = isRunning ? "#1D4ED8" : isUpcoming ? "#B45309" : "#9CA3AF";
  const rankCol   = rank === 1 ? "#C41A1A" : rank <= 3 ? "#1D4ED8" : "#374151";

  // ── MOBILE CARD ──
  if (isMobile) {
    const wkd  = viewMode === "india" ? fmtInr(movie.indiaWeekend)  : movie.usWeekend;
    const tot  = viewMode === "india" ? fmtInr(movie.indiaGross)    : movie.usDomestic;
    const totLabel = viewMode === "india" ? "India Gross" : "Domestic";
    return (
      <div style={{ borderBottom:"1px solid #E5E7EB", borderLeft:`3px solid ${accentCol}` }}>
        <div style={{ display:"flex", alignItems:"stretch" }}>
          {/* Poster */}
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={movie.title}
              style={{ width:50, flexShrink:0, objectFit:"cover", display:"block" }}
              onError={e => { e.target.style.display="none"; }} />
          ) : (
            <div style={{ width:50, flexShrink:0, background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:9, color:"#9CA3AF" }}>
                {(movie.title||"").split(" ").map(w=>w[0]).join("").slice(0,3).toUpperCase()}
              </span>
            </div>
          )}
          {/* Content */}
          <div onClick={() => setExp(e => !e)} style={{ flex:1, minWidth:0, padding:"9px 12px", background:rowBg, cursor:"pointer" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:16, color:rankCol, flexShrink:0 }}>{isUpcoming ? "—" : rank}</span>
              {isNew ? <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:800, fontSize:8, color:"#DC2626", letterSpacing:"0.1em" }}>NEW</span> : <BogMoveCell change={movie.bogRankChange} />}
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:17, color:T.text, lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                {movie.pageUrl ? <a href={`/${movie.pageUrl}`} style={{ color:T.text, textDecoration:"none" }} onClick={e=>e.stopPropagation()}>{movie.title}</a> : movie.title}
              </span>
              <BogStatusBadge status={movie.status} releaseDate={movie.releaseDate} />
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"baseline", marginBottom:3 }}>
              {tot && <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:20, color:"#1D4ED8" }}>{tot}</span>}
              {wkd && <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:15, color:T.textMid }}>{wkd} <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:400, fontSize:9, color:"#9CA3AF" }}>wkd</span></span>}
              {movie.cinemaScore && <BogScorePill label="CS " value={movie.cinemaScore} color={movie.cinemaScore?.startsWith("A") ? "#16A34A" : "#D97706"} />}
              {movie.rtScore && <BogScorePill label="RT " value={`${movie.rtScore}%`} color={movie.rtScore >= 75 ? "#16A34A" : movie.rtScore >= 55 ? "#D97706" : "#DC2626"} />}
            </div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#9CA3AF" }}>
              {movie.director}{isRunning && movie.theaterCount > 0 ? ` · ${fmtThousands(movie.theaterCount)} scr` : ""}
            </div>
          </div>
        </div>
        {exp && (
          <div style={{ padding:"10px 14px", background:"#F8FBFF", borderTop:"1px solid #DBEAFE" }}>
            {movie.bogNote && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#374151", lineHeight:1.7, fontStyle:"italic" }}>{movie.bogNote}</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ borderBottom:"1px solid #E5E7EB" }}>

      {/* ── Main row ─────────────────────────────────────────── */}
      <div
        onClick={() => setExp(e => !e)}
        style={{
          display:"grid",
          gridTemplateColumns: viewMode === "india"
            ? "46px 32px 1fr 88px 96px 88px 56px 48px"
            : "46px 32px 1fr 88px 96px 88px 104px 64px",
          background: rowBg,
          borderLeft:`4px solid ${accentCol}`,
          cursor:"pointer",
          minHeight:46,
          transition:"background 0.1s",
        }}
      >
        {/* Rank # */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"center",
          borderRight:"1px solid #F0EDE8",
        }}>
          <span style={{
            fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900,
            fontSize: rank <= 3 ? 24 : 18,
            color: rankCol, lineHeight:1,
          }}>{isUpcoming ? "—" : rank}</span>
        </div>

        {/* ± movement */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"center",
          borderRight:"1px solid #F0EDE8",
        }}>
          {isNew
            ? <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:800, fontSize:8, color:"#DC2626", letterSpacing:"0.1em" }}>NEW</span>
            : <BogMoveCell change={movie.bogRankChange} />
          }
        </div>

        {/* Film title + meta */}
        <div style={{
          display:"flex", flexDirection:"row", alignItems:"center",
          padding:"7px 12px", borderRight:"1px solid #F0EDE8",
          overflow:"hidden", gap:10,
        }}>
          {/* Poster thumbnail */}
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={movie.title}
              style={{ width:28, height:42, objectFit:"cover", borderRadius:2, flexShrink:0, border:"1px solid #E5E7EB" }}
              onError={e => { e.target.style.display='none'; }} />
          ) : (
            <div style={{ width:28, height:42, flexShrink:0, background:"#F3F4F6", borderRadius:2, border:"1px solid #E5E7EB", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:8, color:"#9CA3AF" }}>
                {(movie.title||'').split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase()}
              </span>
            </div>
          )}
          <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
            {movie.pageUrl ? (
              <a href={`/${movie.pageUrl}`} style={{
                fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800,
                fontSize:15, color:T.text, letterSpacing:"0.01em",
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                textDecoration:"none", borderBottom:`1px solid ${T.border}`,
                transition:"color 0.15s, border-color 0.15s",
              }}
                onMouseEnter={e => { e.target.style.color=T.accent; e.target.style.borderColor=T.accent; }}
                onMouseLeave={e => { e.target.style.color=T.text; e.target.style.borderColor=T.border; }}
              >{movie.title}</a>
            ) : (
              <span style={{
                fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800,
                fontSize:15, color:T.text, letterSpacing:"0.01em",
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
              }}>{movie.title}</span>
            )}
            <BogStatusBadge status={movie.status} releaseDate={movie.releaseDate} />
            {movie.cinemaScore && <BogScorePill label="CS " value={movie.cinemaScore} color={movie.cinemaScore?.startsWith("A") ? "#16A34A" : "#D97706"} />}
            {movie.rtScore && <BogScorePill label="RT " value={`${movie.rtScore}%`} color={movie.rtScore >= 75 ? "#16A34A" : movie.rtScore >= 55 ? "#D97706" : "#DC2626"} />}
          </div>
          <div style={{
            display:"flex", gap:6, marginTop:2, alignItems:"center",
            fontFamily:"'DM Sans', sans-serif", fontSize:10, color:"#9CA3AF",
          }}>
            <span>{movie.director}</span>
            {movie.distributor && <><span style={{ color:"#D5D0CB" }}>·</span><span>{movie.distributor}</span></>}
            {isRunning && movie.theaterCount > 0 && <><span style={{ color:"#D5D0CB" }}>·</span><span>{fmtThousands(movie.theaterCount)} screens</span></>}
          </div>
          </div>{/* end text block */}
        </div>{/* end film title cell */}

        {/* ── DATA COLUMNS: India view ── */}
        {viewMode === "india" ? <>
          {/* Wkd gross India */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", justifyContent:"center", padding:"0 12px", borderRight:"1px solid #F0EDE8" }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:14, color: isUpcoming ? "#C4BDB5" : "#374151" }}>
              {isUpcoming ? "—" : fmtInr(movie.indiaWeekend)}
            </span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#B0A8A0", letterSpacing:"0.08em", textTransform:"uppercase" }}>wkd gross</span>
          </div>
          {/* India gross (highlighted — primary metric) */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", justifyContent:"center", padding:"0 12px", borderRight:"1px solid #BFDBFE", background:"#EFF6FF" }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:16, color:"#1D4ED8" }}>
              {isUpcoming ? "TBD" : fmtInr(movie.indiaGross)}
            </span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#3B82F6", letterSpacing:"0.08em", textTransform:"uppercase" }}>india gross</span>
          </div>
          {/* India net */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", justifyContent:"center", padding:"0 12px", borderRight:"1px solid #F0EDE8" }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:14, color:"#374151" }}>
              {isUpcoming ? "—" : fmtInr(movie.indiaNet)}
            </span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#B0A8A0", letterSpacing:"0.08em", textTransform:"uppercase" }}>india net</span>
          </div>
          {/* Week # */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 6px", borderRight:"1px solid #F0EDE8" }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:13, color:"#6B7280" }}>
              {movie.indiaWeekNo > 0 ? `Wk ${movie.indiaWeekNo}` : "—"}
            </span>
          </div>
          {/* Expand toggle */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"#B0A8A0", lineHeight:1 }}>{exp ? "▲" : "▼"}</span>
          </div>
        </> : <>
          {/* US weekend */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", justifyContent:"center", padding:"0 12px", borderRight:"1px solid #F0EDE8" }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:14, color: isUpcoming ? "#C4BDB5" : "#374151" }}>
              {isUpcoming ? "—" : fmt$(movie.usWeekend)}
            </span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#B0A8A0", letterSpacing:"0.08em", textTransform:"uppercase" }}>US wkd</span>
          </div>
          {/* US cumulative */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", justifyContent:"center", padding:"0 12px", borderRight:"1px solid #F0EDE8" }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:14, color:"#374151" }}>
              {fmt$(movie.usCumulative)}
            </span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#B0A8A0", letterSpacing:"0.08em", textTransform:"uppercase" }}>domestic</span>
          </div>
          {/* International */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", justifyContent:"center", padding:"0 12px", borderRight:"1px solid #F0EDE8" }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:14, color:"#374151" }}>
              {fmt$(movie.intlCumulative)}
            </span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#B0A8A0", letterSpacing:"0.08em", textTransform:"uppercase" }}>intl</span>
          </div>
          {/* Worldwide — highlighted */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", justifyContent:"center", padding:"0 12px", borderRight:"1px solid #BFDBFE", background:"#F0F9FF" }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:16, color:"#0369A1" }}>
              {fmt$(movie.wwCumulative)}
            </span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#38BDF8", letterSpacing:"0.08em", textTransform:"uppercase" }}>worldwide</span>
          </div>
          {/* Expand toggle */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"#B0A8A0", lineHeight:1 }}>{exp ? "▲" : "▼"}</span>
          </div>
        </>}
      </div>

      {/* ── Expanded detail drawer ────────────────────────────── */}
      {exp && (
        <div style={{
          background:"#F7FBFF",
          borderLeft:"4px solid #2563EB",
          borderTop:"1px solid #DBEAFE",
          borderBottom:"1px solid #DBEAFE",
          padding:"14px 20px",
          display:"grid", gridTemplateColumns: typeof window !== "undefined" && window.innerWidth < 640 ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap:20,
        }}>

          {/* India panel */}
          <div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:800, fontSize:9, color:"#1D4ED8", letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:8, paddingBottom:5, borderBottom:"2px solid #DBEAFE" }}>🇮🇳  INDIA</div>
            {[
              ["Wkd Gross", fmtInr(movie.indiaWeekend)],
              ["Lifetime Gross", fmtInr(movie.indiaGross)],
              ["India Net", fmtInr(movie.indiaNet)],
              ["India Week", movie.indiaWeekNo > 0 ? `Week ${movie.indiaWeekNo}` : "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"3px 0", borderBottom:"1px solid #EFF6FF" }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#6B7280" }}>{k}</span>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13, color:T.text }}>{v}</span>
              </div>
            ))}
          </div>

          {/* US / Global panel */}
          <div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:800, fontSize:9, color:"#0369A1", letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:8, paddingBottom:5, borderBottom:"2px solid #BAE6FD" }}>🇺🇸  US / GLOBAL</div>
            {[
              ["US Weekend", fmt$(movie.usWeekend)],
              ["US Domestic", fmt$(movie.usCumulative)],
              ["International", fmt$(movie.intlCumulative)],
              ["Worldwide", fmt$(movie.wwCumulative)],
            ].map(([k, v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"3px 0", borderBottom:"1px solid #F0F9FF" }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#6B7280" }}>{k}</span>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13, color:T.text }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Theatrical stats */}
          <div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:800, fontSize:9, color:"#374151", letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:8, paddingBottom:5, borderBottom:"2px solid #E5E7EB" }}>🎬  THEATRICAL</div>
            {[
              ["US Screens", fmtThousands(movie.theaterCount)],
              ["Per Theater", movie.perTheater ? `$${fmtThousands(movie.perTheater)}` : "—"],
              ["Budget",      movie.budget ? `₹${movie.budget}` : "—"],
              ["Distributor", movie.distributor || "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"3px 0", borderBottom:"1px solid #F3F4F6" }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#6B7280" }}>{k}</span>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13, color:T.text, textAlign:"right", maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Boxoffy take */}
          <div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:800, fontSize:9, color:"#374151", letterSpacing:"0.16em", textTransform:"uppercase", marginBottom:8, paddingBottom:5, borderBottom:"2px solid #E5E7EB" }}>BOXOFFY NOTE</div>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.textMid, lineHeight:1.6, margin:"0 0 8px" }}>{movie.weeklyNote}</p>
            {/* Opening prediction in expanded panel */}
            {movie.openingPrediction && movie.status === "Upcoming" && (
              <div style={{ marginBottom:12, padding:"10px 12px", background:"#FFFBEB", border:"1px dashed #D97706", borderRadius:4 }}>
                <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:11, color:"#92400E", letterSpacing:"0.1em", marginBottom:6 }}>🔮 BOXOFFY OPENING DAY PREDICTION</div>
                <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:24, color:"#D97706", fontStyle:"italic" }}>₹{movie.openingPrediction.mid}–{movie.openingPrediction.high} Cr</span>
                <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:"#B45309", marginLeft:8, fontStyle:"italic" }}>all languages · ₹{movie.openingPrediction.low}–{movie.openingPrediction.mid} Cr Hindi net</span>
                <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:"#78350F", fontStyle:"italic", marginTop:6, lineHeight:1.4 }}>{movie.openingPrediction.note}</div>
                <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:"#A87840", marginTop:4 }}>Sources: {movie.openingPrediction.basis}</div>
              </div>
            )}
            {movie.ott?.platform && (
              <div style={{ background:"#F3F4F6", borderRadius:3, padding:"5px 8px" }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9, color:"#374151" }}>OTT: </span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#6B7280" }}>{movie.ott.platform}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Column header bar ────────────────────────────────────────────────
function BogColHeaders({ viewMode }) {
  const isMobile = useIsMobile();
  if (isMobile) return null;
  const cols = viewMode === "india"
    ? [
        { label:"#",           align:"center", w:"46px"  },
        { label:"±",           align:"center", w:"32px"  },
        { label:"Film",        align:"left",   w:"1fr"   },
        { label:"Wkd Gross",   align:"right",  w:"88px",  note:"India" },
        { label:"Total Gross", align:"right",  w:"96px",  note:"India ★", hi:true },
        { label:"Net",         align:"right",  w:"88px",  note:"India" },
        { label:"Wk",          align:"center", w:"56px"  },
        { label:"",            align:"center", w:"48px"  },
      ]
    : [
        { label:"#",           align:"center", w:"46px"  },
        { label:"±",           align:"center", w:"32px"  },
        { label:"Film",        align:"left",   w:"1fr"   },
        { label:"US Weekend",  align:"right",  w:"88px"  },
        { label:"Domestic",    align:"right",  w:"96px"  },
        { label:"Intl",        align:"right",  w:"88px"  },
        { label:"Worldwide",   align:"right",  w:"104px", hi:true },
        { label:"",            align:"center", w:"64px"  },
      ];

  return (
    <div style={{
      display:"grid",
      gridTemplateColumns: cols.map(c => c.w).join(" "),
      background:"#F7F5F2",
      borderBottom:`2px solid ${T.borderDark}`,
      borderTop:"1px solid #E2DED8",
    }}>
      {cols.map((col, i) => (
        <div key={i} style={{
          fontFamily:"'DM Sans', sans-serif", fontWeight:800, fontSize:9,
          color: col.hi ? "#1D4ED8" : "#6B7280",
          letterSpacing:"0.12em", textTransform:"uppercase",
          padding:"7px 0",
          paddingLeft:  col.align === "left"   ? 14 : 0,
          paddingRight: col.align === "right"  ? 12 : 0,
          textAlign: col.align,
          borderLeft: i > 0 ? "1px solid #E2DED8" : "none",
          background: col.hi ? (viewMode === "india" ? "#EFF6FF" : "#F0F9FF") : "transparent",
          position:"relative",
        }}>
          {col.label}
          {col.note && (
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:7, color: col.hi ? "#3B82F6" : "#9CA3AF", letterSpacing:"0.1em", marginTop:1 }}>
              {col.note}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Section divider ──────────────────────────────────────────────────
function BogDivider({ label, color, bg, dotColor }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:8,
      background: bg || "#F7F5F2",
      borderTop:"1px solid #E2DED8",
      borderBottom:"1px solid #E2DED8",
      padding:"5px 14px",
    }}>
      {dotColor && <span style={{ width:7, height:7, borderRadius:"50%", background:dotColor, display:"inline-block", flexShrink:0 }} />}
      <span style={{
        fontFamily:"'DM Sans', sans-serif", fontWeight:800, fontSize:9,
        color, letterSpacing:"0.14em", textTransform:"uppercase",
      }}>{label}</span>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────

/* ── US BOX OFFICE TOP 10 PANEL ─────────────────────────── */
function USBoTop10({ weekData }) {
  if (!weekData) return <div style={{ padding:24, color:T.textMuted, fontFamily:"'DM Sans',sans-serif", fontSize:12 }}>No US BO data available.</div>;

  const getRankColor = (rank) => {
    if (rank === 1) return "#D97706";
    if (rank <= 3) return "#6B7280";
    return T.textMuted;
  };
  const getChangeColor = (ch) => {
    if (!ch || ch === "NEW" || ch === "LTD") return "#16A34A";
    const n = parseFloat(ch);
    if (n > 0) return "#16A34A";
    if (n < -50) return "#DC2626";
    if (n < -20) return "#D97706";
    return "#6B7280";
  };

  const isMobile = useIsMobile();

  return (
    <div style={{ animation:"fadeIn 0.2s ease both" }}>
      {/* Week header */}
      <div style={{ padding:"10px 16px", background:"#111827", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:16, color:"#fff", letterSpacing:"0.04em", textTransform:"uppercase" }}>
            🇺🇸 US BOX OFFICE — TOP 10
          </div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#9CA3AF", marginTop:2 }}>
            {weekData.dateRange} · Sources: {weekData.source}
          </div>
        </div>
        <div style={{ flex:1 }} />
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#FCD34D", fontStyle:"italic" }}>
          {weekData.headline}
        </div>
      </div>

      {/* Column headers — desktop only */}
      {!isMobile && (
        <div style={{
          display:"grid",
          gridTemplateColumns:"36px 28px 1fr 100px 110px 80px 70px 60px",
          background:"#F5F3F0", borderBottom:`1px solid ${T.border}`,
          padding:"5px 0",
        }}>
          {["#","MV","FILM · STUDIO","WEEKEND","TOTAL","THEATERS","CHANGE","ADMITS"].map((h, i) => (
            <div key={i} style={{
              fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9,
              color:T.textMuted, letterSpacing:"0.1em", textTransform:"uppercase",
              padding:"0 8px", textAlign: i >= 3 ? "right" : "left",
            }}>{h}</div>
          ))}
        </div>
      )}

      {/* Rows */}
      {weekData.chart.map((film, i) => isMobile ? (
        /* Mobile card */
        <div key={i} style={{
          borderBottom:`1px solid ${T.border}`,
          background: film.isIndian ? "#FFFBF0" : film.rank === 1 ? "#FFFDF5" : T.surface,
          padding:"11px 14px",
          borderLeft: film.isIndian ? "3px solid #D97706" : film.rank === 1 ? `3px solid ${T.accent}` : "3px solid transparent",
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {film.rank <= 3
                ? <span style={{ fontSize:20 }}>{["🥇","🥈","🥉"][film.rank-1]}</span>
                : <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:18, color:film.isIndian ? "#D97706" : getRankColor(film.rank) }}>#{film.rank}</span>
              }
              {film.isIndian && <span style={{ fontSize:13 }}>🇮🇳</span>}
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:getChangeColor(film.change), fontWeight:700 }}>
                {film.change === "NEW" ? "★ NEW" : film.change === "LTD" ? "LIMITED" : film.change}
              </span>
            </div>
            {film.rtScore && film.rtScore !== "N/A" && (
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#DC2626", fontWeight:700 }}>🍅 {film.rtScore}</span>
            )}
          </div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:18, color: film.isIndian ? "#92400E" : T.text, lineHeight:1.1, marginBottom:5 }}>{film.title}</div>
          <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:21, color: film.rank === 1 ? T.accent : film.isIndian ? "#D97706" : T.text }}>{film.weekend}</span>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.textMuted }}>Total: {film.total}</span>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.textMuted }}>{film.theaters.toLocaleString()} thtr</span>
          </div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted }}>{film.studio} · {film.genre} · Wk {film.weeks}</div>
        </div>
      ) : (
        /* Desktop row */
        <div key={i} style={{
          display:"grid",
          gridTemplateColumns:"36px 28px 1fr 100px 110px 80px 70px 60px",
          borderBottom:`1px solid ${T.border}`,
          background: film.isIndian ? "#FFFBF0" : film.rank === 1 ? "#FFFDF5" : i % 2 === 0 ? T.surface : "#FAFAF9",
          alignItems:"center",
          minHeight:48,
          borderLeft: film.isIndian ? "3px solid #D97706" : "none",
        }}>
          <div style={{ textAlign:"center", padding:"0 4px" }}>
            {film.rank <= 3
              ? <span style={{ fontSize:18 }}>{["🥇","🥈","🥉"][film.rank-1]}</span>
              : <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:18, color: film.isIndian ? "#D97706" : getRankColor(film.rank) }}>#{film.rank}</span>
            }
          </div>
          <div style={{ textAlign:"center", padding:"0 2px" }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:getChangeColor(film.change), fontWeight:700, letterSpacing:"0.04em" }}>
              {film.change === "NEW" ? "★" : film.change === "LTD" ? "L" : film.change}
            </span>
          </div>
          <div style={{ padding:"8px 12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              {film.isIndian && <span style={{ fontSize:12, lineHeight:1 }}>🇮🇳</span>}
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, color: film.isIndian ? "#92400E" : T.text, lineHeight:1.1 }}>{film.title}</div>
            </div>
            <div style={{ display:"flex", gap:6, marginTop:2, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted }}>{film.studio}</span>
              <span style={{ background:"#F3F4F6", border:`1px solid ${T.border}`, fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, padding:"1px 5px", borderRadius:2 }}>{film.genre}</span>
              {film.rtScore && film.rtScore !== "N/A" && <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#DC2626", fontWeight:700 }}>🍅 {film.rtScore}</span>}
            </div>
          </div>
          <div style={{ padding:"0 8px", textAlign:"right" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17, color: film.isIndian ? "#D97706" : film.rank === 1 ? T.accent : T.text }}>{film.weekend}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:1 }}>Wk {film.weeks} · {film.theaters.toLocaleString()} thtr</div>
          </div>
          <div style={{ padding:"0 8px", textAlign:"right" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, color:T.text }}>{film.total}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:1 }}>Domestic Total</div>
          </div>
          <div style={{ padding:"0 8px", textAlign:"right" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:14, color:T.text }}>{film.theaters.toLocaleString()}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted }}>Locations</div>
          </div>
          <div style={{ padding:"0 8px", textAlign:"right" }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13, color:getChangeColor(film.change) }}>{film.change}</span>
          </div>
          <div style={{ padding:"0 8px", textAlign:"right" }}>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted, lineHeight:1.3 }}>{film.admitsNote}</div>
          </div>
        </div>
      ))}

      {/* India Spotlight — Indian films ranked outside the top 10 */}
      {weekData.indianSpotlight && weekData.indianSpotlight.length > 0 && (
        <div>
          <div style={{ background:"#FFFBF0", borderTop:`2px solid #D97706`, borderBottom:`1px solid #FDE68A`, padding:"6px 16px", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:14 }}>🇮🇳</span>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:11, letterSpacing:"0.18em", textTransform:"uppercase", color:"#92400E" }}>India at the US Box Office</span>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#B45309" }}>— ranked outside top 10, shown separately</span>
          </div>
          {weekData.indianSpotlight.map((film, i) => isMobile ? (
            <div key={i} style={{ borderBottom:`1px solid #FDE68A`, background:"#FFFBF0", padding:"11px 14px", borderLeft:"3px solid #D97706" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:16, color:"#D97706" }}>#{film.rank}</span>
                <span style={{ fontSize:13 }}>🇮🇳</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:getChangeColor(film.change), fontWeight:700 }}>{film.change === "NEW" ? "★ NEW" : film.change}</span>
              </div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:18, color:"#92400E", marginBottom:4 }}>{film.title}</div>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18, color:"#D97706" }}>{film.weekend}</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#92400E" }}>Total: {film.total}</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#92400E" }}>{film.theaters} thtr</span>
              </div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#B45309", marginTop:4 }}>{film.admitsNote}</div>
            </div>
          ) : (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"36px 28px 1fr 100px 110px 80px 70px 60px", borderBottom:`1px solid #FDE68A`, background:"#FFFBF0", alignItems:"center", minHeight:48, borderLeft:"3px solid #D97706" }}>
              <div style={{ textAlign:"center", padding:"0 4px" }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:18, color:"#D97706" }}>#{film.rank}</span>
              </div>
              <div style={{ textAlign:"center" }}><span style={{ fontSize:13 }}>🇮🇳</span></div>
              <div style={{ padding:"8px 12px" }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, color:"#92400E" }}>{film.title}</div>
                <div style={{ display:"flex", gap:6, marginTop:2 }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#B45309" }}>{film.studio}</span>
                  <span style={{ background:"#FEF3C7", border:"1px solid #FDE68A", fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#92400E", padding:"1px 5px", borderRadius:2 }}>{film.genre}</span>
                </div>
              </div>
              <div style={{ padding:"0 8px", textAlign:"right" }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17, color:"#D97706" }}>{film.weekend}</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#B45309", marginTop:1 }}>Wk {film.weeks} · {film.theaters} thtr</div>
              </div>
              <div style={{ padding:"0 8px", textAlign:"right" }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, color:"#92400E" }}>{film.total}</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#B45309", marginTop:1 }}>NA Cumulative</div>
              </div>
              <div style={{ padding:"0 8px", textAlign:"right" }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:14, color:"#92400E" }}>{film.theaters}</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#B45309" }}>Locations</div>
              </div>
              <div style={{ padding:"0 8px", textAlign:"right" }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13, color:getChangeColor(film.change) }}>{film.change}</span>
              </div>
              <div style={{ padding:"0 8px", textAlign:"right" }}>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#B45309", lineHeight:1.3 }}>{film.admitsNote}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding:"8px 16px", background:"#F9FAFB", borderTop:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, fontStyle:"italic" }}>
          Sources: Box Office Mojo · Variety · Deadline · BoxofficePro · The Numbers · Weekend estimates, subject to revision Monday.
        </span>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, fontStyle:"italic", marginLeft:"auto" }}>
          Admits are estimates based on avg ticket price ~$15. US Domestic = US + Canada.
        </span>
      </div>
    </div>
  );
}

function ForeignFilmsPanel({ movies }) {
  const [viewMode, setViewMode] = useState("india");

  const running  = [...movies.filter(m => m.status === "Running")].sort((a,b) => (a.bogRank||99) - (b.bogRank||99));
  const upcoming = movies.filter(m => m.status === "Upcoming");
  const otts     = [...movies.filter(m => m.status === "OTT")].sort((a,b) => b.totalNum - a.totalNum);

  return (
    <div style={{
      marginTop:20,
      border:"1px solid #E2DED8",
      borderTop:`2px solid ${T.accent}`,
      background:"#FFFFFF",
    }}>

      {/* ── Masthead ──────────────────────────────────────────── */}
      <div style={{
        background:"#F9FAFB",
        borderBottom:`1px solid ${T.border}`,
        padding:"10px 16px 8px",
        display:"flex", alignItems:"center", gap:0,
        flexWrap:"wrap",
      }}>
        {/* Title block */}
        <div style={{ marginRight:20 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:20, color:T.text, letterSpacing:"-0.01em", lineHeight:1 }}>
              FOREIGN FILMS
            </span>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13, color:T.accent, letterSpacing:"0.04em" }}>
              WEEKEND CHART
            </span>
          </div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, letterSpacing:"0.18em", textTransform:"uppercase", marginTop:2 }}>
            BOXOFFY · WKD 17 · APR 17–19, 2026
          </div>
        </div>

        {/* Divider */}
        <div style={{ width:1, height:32, background:T.border, marginRight:16 }} />

        {/* View toggle — BOG-style segmented control */}
        <div style={{ display:"flex", background:"#F3F4F6", border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden", marginRight:16 }}>
          {[
            ["india",  "🇮🇳 India"],
            ["global", "🌐 US / Global"],
          ].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:11,
              background: viewMode === mode ? T.accent : "transparent",
              color: viewMode === mode ? "#fff" : T.textMuted,
              border:"none", padding:"6px 16px",
              cursor:"pointer", letterSpacing:"0.04em",
              transition:"background 0.15s, color 0.15s",
              borderRight: mode === "india" ? `1px solid ${T.border}` : "none",
            }}>{label}</button>
          ))}
        </div>

        {/* Context label */}
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted, flex:1 }}>
          {viewMode === "india"
            ? <>All India figures in <strong style={{color:"#93C5FD"}}>₹ Crores</strong> · Gross (before tax) &amp; Net (after tax) · Industry tracking data<Fn n={1} /></>
            : <>All US/Global figures in <strong style={{color:"#93C5FD"}}>USD Millions</strong> · US Domestic = US + Canada · Overseas box office tracking<Fn n={10} /></>
          }
        </span>

        {/* Status legend */}
        <div style={{ display:"flex", gap:12, marginLeft:12 }}>
          {[["#1D4ED8","IN CINEMAS"],["#B45309","UPCOMING"],["#9CA3AF","OTT"]].map(([c,l]) => (
            <span key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ width:3, height:14, background:c, borderRadius:1, display:"inline-block" }} />
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:8, color:T.textMuted, letterSpacing:"0.1em" }}>{l}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Global view: US BO Top 10 ─────────────────────────── */}
      {viewMode === "global"
        ? <USBoTop10 weekData={US_BO_WEEKLY["Week 17, 2026"]} />
        : <>
          {/* ── Column headers ──────────────────────────────────── */}
          <BogColHeaders viewMode={viewMode} />

          {/* ── Active / In Cinemas ─────────────────────────────── */}
          {running.length > 0 && <>
            <BogDivider
              label={`Now Playing — ${running.length} Film${running.length > 1 ? "s" : ""} in US Cinemas`}
              color="#1D4ED8" bg="#F0F6FF" dotColor="#1D4ED8"
            />
            {running.map((m, i) => (
              <BogRow key={m.title} movie={m} viewMode={viewMode} rank={m.bogRank || i+1} isNew={m.bogRankChange === null && m.indiaWeekNo <= 1} />
            ))}
          </>}

          {/* ── Upcoming ──────────────────────────────────────────── */}
          {upcoming.length > 0 && (() => {
            // Group upcoming by month, sort ascending by date
            const monthOrder = {};
            upcoming.forEach(m => {
              const rd = m.releaseDate || "";
              // Parse month key for sorting
              let sortKey = "2099-12";
              let monthLabel = "TBD";
              const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              // Try YYYY-MM-DD
              const full = rd.match(/^(\d{4})-(\d{2})/);
              if (full) {
                sortKey = `${full[1]}-${full[2]}`;
                monthLabel = `${monthNames[parseInt(full[2])-1]} ${full[1]}`;
              } else {
                // Try "Apr 3, 2026" style
                const alt = rd.match(/(\w+)\s+\d+,\s+(\d{4})/);
                if (alt) {
                  const mIdx = monthNames.indexOf(alt[1].slice(0,3));
                  if (mIdx >= 0) { sortKey = `${alt[2]}-${String(mIdx+1).padStart(2,"0")}`; monthLabel = `${alt[1].slice(0,3)} ${alt[2]}`; }
                } else {
                  // Try "Aug 2026" style
                  const mOnly = rd.match(/(\w+)\s+(\d{4})/);
                  if (mOnly) {
                    const mIdx = monthNames.indexOf(mOnly[1].slice(0,3));
                    if (mIdx >= 0) { sortKey = `${mOnly[2]}-${String(mIdx+1).padStart(2,"0")}`; monthLabel = `${mOnly[1].slice(0,3)} ${mOnly[2]}`; }
                  } else if (rd.includes("Diwali")) { sortKey = "2026-11"; monthLabel = "Nov 2026"; }
                  else if (rd.includes("2027")) { sortKey = "2027-01"; monthLabel = "2027"; }
                }
              }
              if (!monthOrder[sortKey]) monthOrder[sortKey] = { label: monthLabel, films: [] };
              monthOrder[sortKey].films.push(m);
            });
            const sortedMonths = Object.keys(monthOrder).sort();
            return (
              <>
                <BogDivider label="Upcoming — 2026 Release Calendar" color="#B45309" bg="#FFFEF5" dotColor="#D97706" />
                {sortedMonths.map(key => {
                  const { label, films } = monthOrder[key];
                  return (
                    <React.Fragment key={key}>
                      {/* Month header */}
                      <div style={{
                        background:"#FFF8F0",
                        borderBottom:"1px solid #FDE8C8",
                        borderTop:"1px solid #FDE8C8",
                        padding:"6px 20px",
                        display:"flex", alignItems:"center", gap:10,
                      }}>
                        <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:15, color:"#B45309", letterSpacing:"0.04em", textTransform:"uppercase" }}>
                          {label}
                        </span>
                        <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:"#D97706" }}>
                          {films.length} film{films.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      {films.sort((a,b) => (a.releaseDate||"").localeCompare(b.releaseDate||"")).map((m, i) => (
                        <BogRow key={m.title} movie={m} viewMode={viewMode} rank={i+1} isNew={false} />
                      ))}
                    </React.Fragment>
                  );
                })}
              </>
            );
          })()}

          {/* ── OTT / Closed ──────────────────────────────────────── */}
          {otts.length > 0 && <>
            <BogDivider
              label="Closed / Moved to OTT — Ranked by India Gross"
              color="#6B7280" bg="#F9F8F6"
            />
            {otts.map((m, i) => (
              <BogRow key={m.title} movie={m} viewMode={viewMode} rank={i+1} isNew={false} />
            ))}
          </>}
        </>
      }

      {/* ── Footer attribution ────────────────────────────────── */}
      <div style={{
        display:"grid", gridTemplateColumns:"1fr 1fr",
        background:"#F7F5F2",
        borderTop:"2px solid #E2DED8",
        padding:"8px 16px", gap:16,
      }}>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#8A857E", lineHeight:1.6 }}>
          <strong style={{color:T.textMid}}>India figures</strong> — Gross = includes tax (entertainment/GST). Net = post-tax collection reported by distributors. Weekend = Sat–Sun (India). Industry tracking data.
        </div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#8A857E", lineHeight:1.6 }}>
          <strong style={{color:T.textMid}}>US/Global figures</strong> — Domestic = US + Canada. Weekend = Fri–Sun. CinemaScore = audience exit poll grade. RT = Rotten Tomatoes critics score. Overseas box office tracking. Updated Feb 23, 2026.
        </div>
      </div>
    </div>
  );
}

function HistoricalYearView({ year }) {
  const d = HISTORICAL_DATA[String(year)];
  if (!d) return (
    <div style={{ padding:"60px 24px", textAlign:"center", color:"#6B7280", fontFamily:"'DM Sans',sans-serif" }}>
      Data for {year} coming soon.
    </div>
  );
  const vc = {
    "All Time Blockbuster":"#7C3AED", "Super Blockbuster":"#7C3AED",
    "Blockbuster":"#DC2626", "Super Hit":"#D97706", "Hit":"#16A34A",
    "Semi Hit":"#2563EB", "Average":"#6B7280", "Below Average":"#6B7280",
    "Flop":"#4B5563", "Disaster":"#374151",
  };
  return (
    <div>
      {/* Year header */}
      <div style={{ background:"linear-gradient(180deg,#1a0000 0%,#0D0D0D 100%)", borderBottom:"2px solid #C8201A", padding:"22px 24px 18px" }}>
        <div style={{ display:"flex", alignItems:"flex-end", gap:16, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:"3rem", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, color:"#C8201A", lineHeight:1 }}>{year}</div>
            <div style={{ color:"#9CA3AF", fontSize:"0.82rem", marginTop:4 }}>India Box Office — Top {d.films.length} Films · Source: Box Office India</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:24, flexWrap:"wrap" }}>
            {[["#1 Film", d.yearStats.topGrosser],["Total Releases", d.yearStats.totalReleases],["Tax Era", d.yearStats.era],["Avg Ticket", `₹${d.yearStats.avgATP}`]].map(([label, val]) => (
              <div key={label} style={{ textAlign:"right" }}>
                <div style={{ color:"#6B7280", fontSize:"0.63rem", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'DM Sans',sans-serif" }}>{label}</div>
                <div style={{ color:"#F3F4F6", fontSize:"0.9rem", fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
        {d.yearStats.note && (
          <div style={{ marginTop:12, color:"#D1D5DB", fontSize:"0.78rem", fontStyle:"italic", borderTop:"1px solid #222", paddingTop:10, maxWidth:860, lineHeight:1.55 }}>
            {d.yearStats.note}
          </div>
        )}
      </div>

      {/* Films table */}
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:560 }}>
          <thead>
            <tr style={{ borderBottom:"2px solid #C8201A", background:"#0D0D0D" }}>
              {["#","Film","Director","India Nett","Verdict","Budget"].map(h => (
                <th key={h} style={{
                  padding:"10px 14px",
                  textAlign: (h==="#"||h==="India Nett"||h==="Budget") ? "center" : "left",
                  color:"#6B7280", fontSize:"0.67rem", fontFamily:"'DM Sans',sans-serif",
                  fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", whiteSpace:"nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.films.map((f, i) => (
              <tr key={f.title} style={{ borderBottom:"1px solid #1a1a1a", background: i%2===0 ? "#0D0D0D":"#111" }}
                onMouseEnter={e => e.currentTarget.style.background="#1a1a1a"}
                onMouseLeave={e => e.currentTarget.style.background = i%2===0 ? "#0D0D0D":"#111"}
              >
                {/* Rank */}
                <td style={{ padding:"11px 14px", textAlign:"center", width:40 }}>
                  <span style={{ color: f.rank<=3?"#C8201A":"#4B5563", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"1.05rem" }}>{f.rank}</span>
                </td>
                {/* Title */}
                <td style={{ padding:"11px 14px" }}>
                  <div style={{ color:"#F3F4F6", fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.05rem" }}>
                    {f.title}
                    {f.dataNote && <span title={f.dataNote} style={{ marginLeft:6, color:"#6B7280", fontSize:"0.65rem", fontStyle:"italic" }}>*</span>}
                  </div>
                  <div style={{ color:"#6B7280", fontSize:"0.72rem", marginTop:2, fontFamily:"'DM Sans',sans-serif" }}>{f.language} · {f.genre} · {f.releaseDate.slice(0,7)}</div>
                  <div style={{ color:"#4B5563", fontSize:"0.69rem", marginTop:1, fontFamily:"'DM Sans',sans-serif" }}>{f.cast.split(",").slice(0,2).join(", ")}</div>
                </td>
                {/* Director */}
                <td style={{ padding:"11px 14px", color:"#9CA3AF", fontSize:"0.8rem", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>{f.director}</td>
                {/* India Nett */}
                <td style={{ padding:"11px 14px", textAlign:"center", whiteSpace:"nowrap" }}>
                  <span style={{ color: f.indiaNetCr>=200?"#C8201A":f.indiaNetCr>=100?"#D97706":"#F3F4F6", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"1.1rem" }}>
                    ₹{f.indiaNetCr} Cr
                  </span>
                </td>
                {/* Verdict */}
                <td style={{ padding:"11px 14px", textAlign:"center" }}>
                  <span style={{ color: vc[f.verdict]||"#9CA3AF", border:`1px solid ${vc[f.verdict]||"#333"}`, padding:"2px 7px", borderRadius:3, fontSize:"0.63rem", fontFamily:"'DM Sans',sans-serif", fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase", whiteSpace:"nowrap" }}>
                    {f.verdict}
                  </span>
                </td>
                {/* Budget */}
                <td style={{ padding:"11px 14px", textAlign:"center", color:"#6B7280", fontFamily:"'DM Sans',sans-serif", fontSize:"0.8rem", whiteSpace:"nowrap" }}>
                  {f.budgetCr ? `₹${f.budgetCr} Cr` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ padding:"10px 20px", borderTop:"1px solid #1a1a1a", color:"#4B5563", fontSize:"0.68rem", fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>
        Source: Box Office India (India Nett) · Budget estimates from Film Information / Koimoi · Pre-2017 figures are pre-GST (Entertainment Tax era) — not directly comparable to post-Jul 2017 GST figures.
        {d.films.some(f => f.dataNote) && " · * = BOI restricted; cross-referenced from Koimoi/Wikipedia."}
      </div>
    </div>
  );
}


/* ── UPCOMING CALENDAR GRID ─────────────────────────────────────── */
const STUDIO_PAGES = {
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
};

const LANG_COLOR = {
  "Hindi":        { bg:"#FEE2E2", color:"#C8201A" },
  "Telugu":       { bg:"#DBEAFE", color:"#1D4ED8" },
  "Tamil":        { bg:"#D1FAE5", color:"#065F46" },
  "Kannada":      { bg:"#FEF3C7", color:"#92400E" },
  "Malayalam":    { bg:"#EDE9FE", color:"#5B21B6" },
  "Hollywood":    { bg:"#F0F9FF", color:"#0369A1" },
};

function UpcomingCalendarGrid({ movies }) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = React.useState(false);

  const PREVIEW_COUNT = isMobile ? 6 : 8;

  // Group by month
  const getMonth = (rd) => {
    if (!rd || rd === "TBC") return "TBC / Later";
    if (rd.includes("Apr")) return "April 2026";
    if (rd.includes("May")) return "May 2026";
    if (rd.includes("Jun")) return "June 2026";
    if (rd.includes("Jul")) return "July 2026";
    if (rd.includes("Aug")) return "August 2026";
    if (rd.includes("Sep")) return "September 2026";
    if (rd.includes("Oct")) return "October 2026";
    if (rd.includes("Nov")) return "November 2026";
    if (rd.includes("Dec")) return "December 2026";
    return "TBC / Later";
  };

  // Sort: TBC/Later last, within month by date string
  const sorted = [...movies].sort((a, b) => {
    const ma = getMonth(a.releaseDate), mb = getMonth(b.releaseDate);
    const ORDER = ["April 2026","May 2026","June 2026","July 2026","August 2026","September 2026","October 2026","November 2026","December 2026","TBC / Later"];
    const oi = ORDER.indexOf(ma), oj = ORDER.indexOf(mb);
    if (oi !== oj) return oi - oj;
    return (a.releaseDate || "").localeCompare(b.releaseDate || "");
  });

  const visible = expanded ? sorted : sorted.slice(0, PREVIEW_COUNT);

  // Group visible into months
  const grouped = [];
  let curMonth = null, curGroup = [];
  for (const m of visible) {
    const mo = getMonth(m.releaseDate);
    if (mo !== curMonth) {
      if (curGroup.length) grouped.push({ month: curMonth, films: curGroup });
      curMonth = mo; curGroup = [m];
    } else {
      curGroup.push(m);
    }
  }
  if (curGroup.length) grouped.push({ month: curMonth, films: curGroup });

  return (
    <div style={{ background:"#FFFBF0", borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}` }}>

      {/* Section header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px 8px", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:T.gold, display:"inline-block" }} />
          <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, fontWeight:700, color:T.gold, letterSpacing:"0.1em", textTransform:"uppercase" }}>
            UPCOMING — NEXT MAJOR RELEASES
          </span>
          <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted, background:T.surfaceAlt, border:`1px solid ${T.border}`, padding:"1px 6px", borderRadius:2 }}>
            {movies.length} films
          </span>
        </div>
        <a href="/upcoming-releases.html" style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:10, color:T.accent, textDecoration:"none", letterSpacing:"0.06em", textTransform:"uppercase" }}>
          Full Calendar ↗
        </a>
      </div>

      {/* Month groups */}
      <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:14 }}>
        {grouped.map(({ month, films }) => (
          <div key={month}>
            {/* Month label */}
            <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:11, color:T.textMuted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:7, paddingBottom:4, borderBottom:`1px solid ${T.border}` }}>
              {month}
            </div>
            {/* Film grid */}
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap:8 }}>
              {films.map(m => {
                const langCfg = LANG_COLOR[m.language] || { bg:"#F3F4F6", color:"#374151" };
                // Studio page from films.json studio field
                const studioPage = m.studio && STUDIO_PAGES[m.studio]
                  ? [m.studio, STUDIO_PAGES[m.studio]]
                  : null;
                const relDateShort = (m.releaseDate || "TBC").replace(/ 2026.*/,"").replace(/ 2027.*/,"");
                return (
                  <div key={m.title} style={{ background:"#fff", border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden", borderTop:`3px solid ${T.gold}` }}>
                    {/* Poster + title row */}
                    <div style={{ display:"flex", gap:0 }}>
                      {m.posterUrl ? (
                        <img src={m.posterUrl} alt={m.title}
                          style={{ width: isMobile ? 44 : 52, flexShrink:0, objectFit:"cover", display:"block" }}
                          onError={e => { e.target.style.display="none"; }} />
                      ) : (
                        <div style={{ width: isMobile ? 44 : 52, flexShrink:0, background:T.surfaceAlt, display:"flex", alignItems:"center", justifyContent:"center", minHeight:68 }}>
                          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:9, color:T.textMuted }}>
                            {(m.title||"").split(" ").map(w=>w[0]).join("").slice(0,3).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div style={{ flex:1, minWidth:0, padding:"7px 8px" }}>
                        {/* Title */}
                        <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize: isMobile ? 13 : 14, color:T.text, lineHeight:1.2, marginBottom:3, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
                          {m.pageUrl
                            ? <a href={`/${m.pageUrl}`} style={{ color:T.text, textDecoration:"none" }}>{m.title}</a>
                            : m.title
                          }
                        </div>
                        {/* Lang badge */}
                        <span style={{ display:"inline-block", background:langCfg.bg, color:langCfg.color, fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:8, letterSpacing:"0.06em", padding:"1px 5px", borderRadius:2 }}>
                          {m.language}
                        </span>
                      </div>
                    </div>
                    {/* Date + director + studio row */}
                    <div style={{ padding:"5px 8px", borderTop:`1px solid ${T.border}`, background:"#FAFAFA", display:"flex", alignItems:"center", justifyContent:"space-between", gap:4 }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontFamily:"'IBM Plex Mono', monospace", fontWeight:700, fontSize:9, color:T.gold, letterSpacing:"0.04em" }}>{relDateShort}</div>
                        <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.director}</div>
                      </div>
                      {/* Budget pill */}
                      {m.budget && m.budget !== "TBC" && (
                        <div style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:8, color:"#374151", background:"#F3F4F6", border:`1px solid ${T.border}`, padding:"1px 5px", borderRadius:2, flexShrink:0, whiteSpace:"nowrap" }}>
                          {m.budget.toString().startsWith("₹") || m.budget.toString().startsWith("~") ? m.budget : `₹${m.budget}`} Cr
                        </div>
                      )}
                    </div>
                    {/* Studio link */}
                    {studioPage && (
                      <div style={{ padding:"4px 8px", borderTop:`1px solid ${T.border}`, background:"#F9FAFB" }}>
                        <a href={`/${studioPage[1]}`} style={{
                          fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9,
                          color:T.accent, textDecoration:"none", letterSpacing:"0.04em",
                          display:"flex", alignItems:"center", gap:3,
                        }}>
                          <span style={{ fontSize:8 }}>🏢</span> {studioPage[0]} ↗
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* View more / less */}
      {movies.length > PREVIEW_COUNT && (
        <div style={{ padding:"8px 14px 12px", borderTop:`1px solid ${T.border}` }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              width:"100%", fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:12,
              background:T.surfaceAlt, color:T.textMid, border:`1px solid ${T.border}`,
              borderRadius:3, padding:"9px", cursor:"pointer", letterSpacing:"0.04em",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            }}
          >
            {expanded
              ? "▲ Show less"
              : `▼ Show all ${movies.length} upcoming releases`
            }
          </button>
          <div style={{ textAlign:"center", marginTop:6 }}>
            <a href="/upcoming-releases.html" style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.accent, fontWeight:700, textDecoration:"none" }}>
              View full release calendar →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── BHOOTH BANGLA POLL ─────────────────────────────────────────────────────
   Audience poll: "Will you watch Bhooth Bangla in theaters?"
   Seed model: 2,184 Yes + 616 No = 2,800 base (78% Yes), launched Apr 15 2026.
   Auto-increments ~11 votes/hr to simulate organic growth.
   localStorage prevents re-voting from same device.
   ─────────────────────────────────────────────────────────────────────────── */
function HeaderSnapshotCards({ activeSection }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, flexShrink:0, maxWidth: isMobile ? "100%" : 380 }}>
      <a href="/dhurandhar-2-vs-pushpa-2-box-office.html" style={{ textDecoration:"none", display:"block" }}>
        <div style={{
          background:"#F9FAFB", border:`0.5px solid #E5E7EB`,
          borderLeft:`4px solid #C8201A`, padding:"14px 18px",
          cursor:"pointer", display:"flex", alignItems:"center", gap:14,
        }}
          onMouseEnter={e => e.currentTarget.style.background="#FFFFFF"}
          onMouseLeave={e => e.currentTarget.style.background="#F9FAFB"}
        >
          <div style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
            <img
              src="https://image.tmdb.org/t/p/w185/ov8vrRLZGoXHpYjSY9Vpv1tHJX7.jpg"
              alt="Dhurandhar: The Revenge"
              style={{ width:42, height:63, objectFit:"cover", borderRadius:3, border:"0.5px solid #D1D5DB" }}
              onError={e => { e.target.style.background="#DBEAFE"; e.target.removeAttribute("src"); }}
            />
            <div style={{
              width:24, height:24, borderRadius:"50%", background:"#C8201A",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:8,
              color:"#FFFFFF", letterSpacing:"0.04em", flexShrink:0,
              margin:"0 -3px", zIndex:1, outline:"2px solid #F9FAFB",
            }}>VS</div>
            <img
              src="https://image.tmdb.org/t/p/w185/t5ePZYRibJ0EEK1FK3GhihVkDW5.jpg"
              alt="Pushpa 2: The Rule"
              style={{ width:42, height:63, objectFit:"cover", borderRadius:3, border:"0.5px solid #D1D5DB" }}
              onError={e => { e.target.style.background="#FEF3C7"; e.target.removeAttribute("src"); }}
            />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900,
              fontSize:"clamp(14px, 1.6vw, 16px)", color:"#111827",
              lineHeight:1.25, letterSpacing:"-0.01em",
            }}>
              Dhurandhar: The Revenge vs Pushpa 2
            </div>
            <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:"#9CA3AF", marginTop:5 }}>
              India · WW · Lifetime · Statistical Tie →
            </div>
          </div>
        </div>
      </a>

      {/* ── PINNED: Industry Report ─────────────────────────────── */}
      <a href="/india-cinema-state-2026.html" style={{ textDecoration:"none", display:"block" }}>
        <div
          onMouseEnter={e => e.currentTarget.style.background="#101828"}
          onMouseLeave={e => e.currentTarget.style.background="#0F2340"}
          style={{
            background:"#0F2340", borderLeft:"4px solid #D97706",
            padding:"13px 16px", cursor:"pointer",
            transition:"background 0.15s",
          }}
        >
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{
                fontFamily:"'IBM Plex Mono', monospace", fontWeight:700, fontSize:8,
                letterSpacing:"0.16em", textTransform:"uppercase",
                color:"#D97706", background:"rgba(217,119,6,0.15)",
                border:"1px solid rgba(217,119,6,0.4)",
                padding:"2px 7px", borderRadius:2,
              }}>📌 PINNED</span>
              <span style={{
                fontFamily:"'IBM Plex Mono', monospace", fontWeight:600, fontSize:8,
                letterSpacing:"0.1em", textTransform:"uppercase",
                color:"rgba(255,255,255,0.35)",
              }}>DATA SCIENCE</span>
            </div>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:"rgba(255,255,255,0.3)" }}>12 min →</span>
          </div>
          <div style={{
            fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900,
            fontSize:14, color:"#FFFFFF", lineHeight:1.25,
            letterSpacing:"-0.01em", marginBottom:10,
          }}>
            The State of Indian Cinema 2026: Record Revenue. Fewer Seats.
          </div>
          <div style={{ display:"flex", gap:12 }}>
            <div>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:15, color:"#FCD34D", lineHeight:1 }}>₹13,395 Cr</div>
              <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"rgba(255,255,255,0.4)", marginTop:2, letterSpacing:"0.04em", textTransform:"uppercase" }}>2025 Gross</div>
            </div>
            <div style={{ width:1, background:"rgba(255,255,255,0.1)", flexShrink:0 }} />
            <div>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:15, color:"#F87171", lineHeight:1 }}>83.2 Cr ↓</div>
              <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"rgba(255,255,255,0.4)", marginTop:2, letterSpacing:"0.04em", textTransform:"uppercase" }}>Tickets Sold</div>
            </div>
            <div style={{ width:1, background:"rgba(255,255,255,0.1)", flexShrink:0 }} />
            <div>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:15, color:"#86EFAC", lineHeight:1 }}>5</div>
              <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"rgba(255,255,255,0.4)", marginTop:2, letterSpacing:"0.04em", textTransform:"uppercase" }}>Anomalies</div>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}


function BoxOfficeSection({ onNavigate, forceAllTime, onClearForceAllTime }) {
  useSheetData(); // re-render when live data arrives
  const [year, setYear] = useState(2026);
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("collection");
  const [view, setView] = useState("weekly");
  const [showOTT, setShowOTT] = useState(false);
  const movies = (liveData || DATA)[year] || [];
  const accent = YEAR_ACCENT[year];

  // All-Time nav — fires when parent sets forceAllTime=true
  useEffect(() => {
    if (forceAllTime) {
      setView("alltime");
      setYear(2026);
      onClearForceAllTime && onClearForceAllTime();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [forceAllTime]);

  // Weekly chart: sort by this week's collection (active films first, then OTT, then upcoming)
  // Hollywood films are separated out into their own section
  const weeklyChartMovies = year === 2026
    ? [...movies].filter(m => m.language !== "Hollywood" || m.showInMainChart === true).sort((a,b) => {
        if (a.status === "Upcoming" && b.status !== "Upcoming") return 1;
        if (b.status === "Upcoming" && a.status !== "Upcoming") return -1;
        if (a.status === "OTT" && b.status !== "OTT") return 1;
        if (b.status === "OTT" && a.status !== "OTT") return -1;
        return b.weeklyCollection - a.weeklyCollection;
      })
    : [];

  // Hollywood films sorted: Running first (by weekly), then OTT (by India gross), then Upcoming
  const hollywoodMovies = year === 2026
    ? [...movies].filter(m => m.language === "Hollywood").sort((a,b) => {
        if (a.status === "Upcoming" && b.status !== "Upcoming") return 1;
        if (b.status === "Upcoming" && a.status !== "Upcoming") return -1;
        if (a.status === "OTT" && b.status !== "OTT") return 1;
        if (b.status === "OTT" && a.status !== "OTT") return -1;
        return b.totalNum - a.totalNum;
      })
    : [];

  const sorted = [...movies].sort((a,b) => sortBy === "weeks" ? b.weeksInTop10 - a.weeksInTop10 : b.totalNum - a.totalNum);
  const filtered = filter === "All" ? sorted : sorted.filter(m => m.language === filter);
  const maxWeeks = Math.max(...movies.map(m => m.weeksInTop10), 1);
  const released = movies.filter(m => m.totalNum > 0);
  const totalWW = released.reduce((s,m) => s+m.totalNum, 0);
  const topFilm = [...released].sort((a,b) => b.totalNum - a.totalNum)[0];

  // For 2026 default to weekly view
  const showWeekly = year === 2026 && view === "weekly";

  // Headline article modal state
  const [showHeadlineModal, setShowHeadlineModal] = useState(false);

  const bmsStats = [
    { label:"D0 Nett ✅",             val:"₹43 Cr",        src:"Sacnilk · Sacnilk · Pinkvilla" },
    { label:"D1 Nett ✅",             val:"₹102.55 Cr",    src:"Sacnilk · Sacnilk · Pinkvilla · IndiaTV" },
    { label:"D2 Nett ✅",             val:"₹80.72 Cr",     src:"Sacnilk · Sacnilk · IndiaTV" },
    { label:"D3 Nett ✅",             val:"₹113 Cr",       src:"Sacnilk · IndiaTV · Sacnilk — Eid Sat +40%" },
    { label:"4-Day India Nett ✅",     val:"₹454 Cr",       src:"Sacnilk confirmed D0–D4" },
    { label:"D5 Monday ✅",           val:"₹60 Cr",        src:"BOI / Sacnilk confirmed" },
    { label:"13-Day India Nett ✅",   val:"~₹895 Cr",    src:"BOI / Filmibeat · D0–D13 · D13 ₹27.75 Cr" },
    { label:"13-Day WW Gross",        val:"~₹1,420 Cr",        src:"Variety / BOI · Overseas ~₹530 Cr" },
    { label:"JioHotstar OTT Deal",    val:"₹150 Cr",       src:"Film Information · Wikipedia" },
  ];

  const analysts = [];  // Replaced by inline commentary below

  return (
    <div>
      {/* ── FROM THE DESK — stacked editorial articles ──────────── */}
      {year === 2026 && showWeekly && (
        <EditorialSection onNavigate={onNavigate} />
      )}

      

      {/* ══ YEAR / VIEW TAB BAR ═══════════════════════════════════════════ */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, position:"sticky", top:48, zIndex:50 }}>

        {/* Main year tabs */}
        <div style={{ display:"flex", alignItems:"stretch", overflowX:"auto", gap:0 }}>

          <button
            onClick={() => { setYear(2026); setView("weekly"); }}
            style={{
              fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:13,
              letterSpacing:"0.08em", textTransform:"uppercase", padding:"12px 18px",
              background: showWeekly ? T.accent : "transparent",
              color: showWeekly ? "#fff" : T.textMuted,
              border:"none", cursor:"pointer", flexShrink:0,
              borderBottom: showWeekly ? `2px solid ${T.accent}` : "2px solid transparent",
              marginBottom:"-1px", transition:"all 0.12s",
            }}
          >⚡ Weekly</button>

          <div style={{ width:1, background:T.border, margin:"8px 0", flexShrink:0 }} />

          {[...YEARS].reverse().map(y => {
            const isActive = year === y && !showWeekly;
            const acc = YEAR_ACCENT[y] || T.accent;
            return (
              <button key={y} onClick={() => { setYear(y); setView("alltime"); }} style={{
                fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:13,
                letterSpacing:"0.06em", padding:"12px 14px",
                background: isActive ? `${acc}18` : "transparent",
                color: isActive ? acc : T.textMuted,
                border:"none", cursor:"pointer", flexShrink:0,
                borderBottom: isActive ? `2px solid ${acc}` : "2px solid transparent",
                marginBottom:"-1px", transition:"all 0.12s",
              }}>{y}</button>
            );
          })}

          <div style={{ width:1, background:T.border, margin:"8px 4px", flexShrink:0 }} />
          <span style={{
            fontFamily:"'DM Sans', sans-serif", fontSize:9, fontWeight:700,
            color:T.textMuted, letterSpacing:"0.12em", textTransform:"uppercase",
            padding:"0 8px", display:"flex", alignItems:"center", flexShrink:0,
          }}>Archive</span>

          {ARCHIVE_YEARS.map(y => {
            const isActive = year === y && !showWeekly;
            return (
              <button key={y} onClick={() => { setYear(y); setView("alltime"); }} style={{
                fontFamily:"'Barlow Condensed', sans-serif", fontWeight:600, fontSize:12,
                letterSpacing:"0.04em", padding:"12px 10px",
                background: isActive ? "#F3F4F6" : "transparent",
                color: isActive ? T.text : T.textMuted,
                border:"none", cursor:"pointer", flexShrink:0,
                borderBottom: isActive ? `2px solid ${T.textMuted}` : "2px solid transparent",
                marginBottom:"-1px", transition:"all 0.12s",
              }}>{y}</button>
            );
          })}
        </div>

        {/* Filter + sort — alltime view only */}
        {!showWeekly && (
          <div style={{
            display:"flex", alignItems:"center", gap:8, padding:"8px 16px",
            background:T.surfaceAlt, borderTop:`1px solid ${T.border}`, flexWrap:"wrap",
          }}>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {LANGUAGES.map(lang => (
                <button key={lang} onClick={() => setFilter(lang)} style={{
                  fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:11,
                  padding:"4px 10px", borderRadius:3,
                  background: filter === lang ? T.text : "transparent",
                  color: filter === lang ? "#fff" : T.textMuted,
                  border:`1px solid ${filter === lang ? T.text : T.border}`,
                  cursor:"pointer", transition:"all 0.12s",
                }}>{lang}</button>
              ))}
            </div>
            <div style={{ width:1, height:20, background:T.border, margin:"0 4px" }} />
            <div style={{ display:"flex", gap:4 }}>
              {[["collection","By Collection"],["weeks","By Weeks"]].map(([key, label]) => (
                <button key={key} onClick={() => setSortBy(key)} style={{
                  fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:11,
                  padding:"4px 10px", borderRadius:3,
                  background: sortBy === key ? T.accent : "transparent",
                  color: sortBy === key ? "#fff" : T.textMuted,
                  border:`1px solid ${sortBy === key ? T.accent : T.border}`,
                  cursor:"pointer", transition:"all 0.12s",
                }}>{label}</button>
              ))}
            </div>
            <div style={{ marginLeft:"auto", display:"flex", gap:16, alignItems:"center" }}>
              {released.length > 0 && <>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:16, color:T.accent, lineHeight:1 }}>
                    ₹{Math.round(totalWW)} Cr
                  </div>
                  <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, letterSpacing:"0.08em", textTransform:"uppercase" }}>
                    {year} India Nett
                  </div>
                </div>
                {topFilm && <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:13, color:T.text, lineHeight:1 }}>{topFilm.title}</div>
                  <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, letterSpacing:"0.08em", textTransform:"uppercase" }}>#1 Film {year}</div>
                </div>}
              </>}
            </div>
          </div>
        )}
      </div>

      {/* ── WEEKLY CHART VIEW ── */}
      {showWeekly ? (
        <div style={{ animation:"fadeIn 0.25s ease both" }}>
          {/* ── NATIONAL TOP 10 — BCM Weekly Chart ── */}
          {/* Column headers */}
          <div style={{
            display: typeof window !== "undefined" && window.innerWidth < 640 ? "none" : "grid",
            gridTemplateColumns:"28px 38px 1fr 92px 92px 46px 106px 106px",
            background:T.surfaceAlt, borderBottom:`2px solid ${T.borderDark}`, padding:"6px 0",
          }}>
            {[
              ["#","center"],["","center"],
              ["Film · Studio","16px"],
              ["This Week","right"],[`Last Week`, "right"],["Chg","right"],
              ["Domestic Nett + Rank","right"],["Global WW + Rank","right"],
            ].map(([label, align], i) => (
              <div key={i} style={{ fontFamily:"'IBM Plex Mono',sans-serif", fontWeight:700, fontSize:8, color:T.textMuted, letterSpacing:"0.1em", textTransform:"uppercase", padding:`0 ${align==="center"?"4px":"10px"}`, textAlign:align }}>
                {label}
              </div>
            ))}
          </div>

          {/* Top 10 live rows */}
          <div style={{ padding:"4px 8px 2px", background:"#FEF2F2", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:T.accent, display:"inline-block", animation:"boPulse 1.8s ease-in-out infinite" }} />
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700, color:T.accent, letterSpacing:"0.08em", textTransform:"uppercase" }}>
              INDIA NATIONAL TOP 10 · WEEK 17 · APR 17–23 · BCM 13-SOURCE · <span style={{ color:"#D97706" }}>~ = BCM ESTIMATE</span>
            </span>
          </div>

          {weeklyChartMovies.filter(m => m.status === "Running").slice(0, 10).map((m, i) => (
            <NationalTop10Row key={m.title} movie={m} rank={i + 1} />
          ))}

          {/* Footer note */}
          <div style={{ padding:"8px 14px", borderTop:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted }}>
              Domestic = India nett · Global = worldwide gross · ATB = all-time rank nominal · Conf. = BCM confidence
            </span>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.textMuted, letterSpacing:"0.06em" }}>
              BOI · SACNILK · TARAN ADARSH · FILM INFO · NISHIT SHAW · PINKVILLA · HUNGAMA · RAMESH BALA · VENKY BO · COMSCORE · BOM · DEADLINE · TRACKTOLLYWOOD
            </span>
          </div>

          {/* ── RECENTLY CLOSED / MOVED TO OTT — Collapsible ── */}
          {(() => {
            const ottFilms = weeklyChartMovies.filter(m => m.status === "OTT");
            return ottFilms.length > 0 ? (
              <>
                <button
                  onClick={() => setShowOTT(v => !v)}
                  style={{
                    width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"8px 14px", background:T.surfaceAlt,
                    borderBottom:`1px solid ${T.border}`, borderTop:`1px solid ${T.border}`,
                    marginTop:4, cursor:"pointer", border:"none", textAlign:"left",
                  }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700, color:T.textMuted, letterSpacing:"0.1em", textTransform:"uppercase" }}>
                      ◎ Recently Closed · Moved to OTT
                    </span>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.textMuted, background:T.surface, border:`1px solid ${T.border}`, padding:"1px 6px", borderRadius:2 }}>
                      {ottFilms.length} titles
                    </span>
                  </div>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, fontWeight:700, color:T.textMuted, letterSpacing:"0.08em" }}>
                    {showOTT ? "HIDE ▲" : "SHOW ▼"}
                  </span>
                </button>
                {showOTT && ottFilms.map((m, i) => (
                  <WeeklyChartRow key={m.title} movie={m} rank={"—"} prevRank={null} />
                ))}
              </>
            ) : null;
          })()}

          {/* Upcoming — Calendar Grid */}
          <UpcomingCalendarGrid movies={weeklyChartMovies.filter(m => m.status === "Upcoming")} />

          {/* ════════════════════════════════════════════════════════
               BOG-STYLE FOREIGN / HOLLYWOOD SECTION
               ════════════════════════════════════════════════════════ */}
          {hollywoodMovies.length > 0 && (
            <ForeignFilmsPanel movies={hollywoodMovies} />
          )}

          <div style={{ padding:"12px 24px", borderTop:`1px solid ${T.border}`, fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted, lineHeight:1.7 }}>
            Indian film weekly collections are estimates based on industry tracking data as of Feb 21, 2026. Day 2 films show partial weekend data. "This Week" = Fri–Sat for new releases. · <strong>Foreign/Hollywood films show India Gross only</strong> (not global WW) — worldwide figures are noted in the weekly note. Click any row to expand OTT data.
          </div>
        </div>
      ) : (
        /* ── ALL-TIME / HISTORICAL TABLE VIEW ── */
        <div style={{ animation:"fadeIn 0.25s ease both" }}>
          <div style={{
            display: typeof window !== "undefined" && window.innerWidth < 640 ? "none" : "grid",
            gridTemplateColumns:"44px 1fr 130px 120px 105px 100px 88px",
            gap:0, background:T.surfaceAlt,
            borderBottom:`2px solid ${T.borderDark}`,
            padding:"8px 0",
          }}>
            {[
              ["#","center"],
              ["FILM · DIRECTOR · VERDICT","16px"],
              ["WORLDWIDE","16px"],
              ["INDIA NET","16px"],
              ["OVERSEAS","16px"],
              ["🏛 EST. GST","12px"],
              ["WKS #TOP10","center"],
            ].map(([label, pl], i) => (
              <div key={i} style={{
                fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:10,
                color: label === "EST. GST" ? "#15803D" : T.textMuted,
                letterSpacing:"0.1em", textTransform:"uppercase",
                padding:`0 ${pl}`, textAlign: pl === "center" ? "center" : "left",
                borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
                background: label === "EST. GST" ? "#F0FDF4" : "transparent",
              }}>
                {label}
                {label === "EST. GST" && <span style={{ fontSize:7, display:"block", color:"#6B7280", marginTop:1, fontWeight:400, letterSpacing:"0.06em" }}>GOVT REVENUE</span>}
              </div>
            ))}
          </div>
          <div style={{ padding:"6px 16px 6px 60px", background:"#FFFDF5", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted }}>
              ▼ Click any row · Tabs: 📺 OTT streaming data &nbsp;·&nbsp; 🏛 GST Tax Intelligence
            </span>
            <span style={{
              background:"#DCFCE7", color:"#15803D", fontFamily:"'DM Sans', sans-serif",
              fontWeight:700, fontSize:9, letterSpacing:"0.08em", textTransform:"uppercase",
              padding:"2px 6px", borderRadius:2,
            }}>GST est. · verified CBIC rate history</span>
          </div>
          {filtered.length > 0
            ? filtered.map((m,i) => <BoxOfficeRow key={`${year}-${m.title}`} movie={m} rank={i+1} maxWeeks={maxWeeks} />)
            : <div style={{ padding:"40px 24px", textAlign:"center", color:T.textMuted, fontFamily:"'DM Sans', sans-serif" }}>No {filter} films for {year}.</div>
          }
          <div style={{ padding:"12px 24px", borderTop:`1px solid ${T.border}`, fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted }}>
            All figures in ₹ Crores (Worldwide Gross). Industry tracking data, verified Feb 21, 2026 — Boxoffy.com.
          </div>
        </div>
      )}
    </div>
  );
}


/* ── ARTICLE CARD ─── */
/* ── ARTICLE MODAL (Boxoffy originals) ─────────────────────── */
function ArticleModal({ article, onClose }) {
  const srcCfg = SOURCE_COLORS[article.source] || { bg:"#1A1714", fg:"#fff" };
  // Close on backdrop click or Escape
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position:"fixed", inset:0, zIndex:9000,
        background:"rgba(10,8,6,0.75)", backdropFilter:"blur(3px)",
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:"24px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:T.surface, maxWidth:640, width:"100%",
          border:`1px solid ${T.border}`,
          borderTop:`4px solid ${T.accent}`,
          boxShadow:"0 24px 80px rgba(0,0,0,0.35)",
          position:"relative",
        }}
      >
        {/* Close btn */}
        <button
          onClick={onClose}
          style={{
            position:"absolute", top:12, right:14,
            background:"transparent", border:"none",
            fontFamily:"monospace", fontSize:18, color:T.textMuted,
            cursor:"pointer", lineHeight:1, padding:4,
          }}
          aria-label="Close"
        >✕</button>

        <div style={{ padding:"28px 32px 32px" }}>
          {/* Meta row */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            <span style={{
              background:T.accent, color:"#fff",
              fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9,
              letterSpacing:"0.12em", textTransform:"uppercase", padding:"2px 8px", borderRadius:2,
            }}>{article.tag}</span>
            <span style={{
              background:srcCfg.bg, color:srcCfg.fg,
              fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9,
              letterSpacing:"0.1em", textTransform:"uppercase", padding:"2px 8px", borderRadius:2,
            }}>BOXOFFY ORIGINAL</span>
            {article.hot && <span style={{ color:T.accent, fontSize:10, fontFamily:"'DM Sans',sans-serif", fontWeight:700 }}>🔥 TRENDING</span>}
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.textMuted, marginLeft:"auto" }}>{article.time}</span>
          </div>

          {/* Headline */}
          <h2 style={{
            fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
            fontSize:26, color:T.text, lineHeight:1.1, letterSpacing:"0.01em",
            margin:"0 0 16px",
          }}>{article.headline}</h2>

          {/* Divider */}
          <div style={{ height:2, background:T.accent, width:40, marginBottom:16 }} />

          {/* Body */}
          <p style={{
            fontFamily:"'DM Sans',sans-serif", fontSize:14,
            color:T.textMid, lineHeight:1.75, margin:"0 0 24px",
          }}>{article.summary}</p>

          {/* Footer note */}
          <div style={{
            borderTop:`1px solid ${T.border}`, paddingTop:14,
            fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.textMuted,
          }}>
            Boxoffy Original · Box Office Intelligence · boxoffy.com
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ARTICLE CARD ─────────────────────────────────────────── */
function ArticleCard({ article, size = "normal" }) {
  const [hov, setHov] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const isLarge   = size === "large";
  const isExternal = !!article.url;
  const srcCfg    = SOURCE_COLORS[article.source] || { bg:"#4A4540", fg:"#fff" };

  // External articles → open new tab; Boxoffy originals → modal
  const handleClick = () => {
    if (isExternal) {
      window.open(article.url, "_blank", "noopener,noreferrer");
    } else {
      setModalOpen(true);
    }
  };

  return (
    <>
      {modalOpen && <ArticleModal article={article} onClose={() => setModalOpen(false)} />}

      <div
        role="link"
        tabIndex={0}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={handleClick}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
        style={{
          background: T.surface,
          border:`1px solid ${T.border}`,
          borderTop: article.hot ? `3px solid ${T.accent}` : `3px solid transparent`,
          padding: isLarge ? "20px" : "16px",
          cursor:"pointer",
          transition:"box-shadow 0.15s, transform 0.15s",
          boxShadow: hov ? "0 4px 20px rgba(0,0,0,0.1)" : "none",
          transform: hov ? "translateY(-2px)" : "none",
          display:"flex", flexDirection:"column", gap:8, height:"100%",
        }}
      >
        {/* Top row: tag + time + trending */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{
              background:T.accent, color:"#fff",
              fontFamily:"'DM Sans',sans-serif", fontWeight:700,
              fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase",
              padding:"2px 7px", borderRadius:2,
            }}>{article.tag}</span>
            {/* Source attribution — footnote only, no source name */}
            {article.source && (() => {
              const fn = SOURCE_FN[article.source];
              return fn ? (
                <span style={{
                  background:T.surfaceAlt, color:T.textMuted, border:`1px solid ${T.border}`,
                  fontFamily:"'DM Sans',sans-serif", fontWeight:600,
                  fontSize:9, letterSpacing:"0.06em",
                  padding:"2px 5px", borderRadius:2,
                }}>Trade data <Fn n={fn} /></span>
              ) : null;
            })()}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {article.hot && <span style={{ color:T.accent, fontSize:10, fontFamily:"'DM Sans',sans-serif", fontWeight:700 }}>🔥</span>}
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted }}>{article.time}</span>
          </div>
        </div>

        {/* Headline */}
        <h3 style={{
          fontFamily:"'Barlow Condensed',sans-serif",
          fontWeight:700, fontSize: isLarge ? 22 : 17,
          color: hov ? T.accent : T.text,
          lineHeight:1.15, letterSpacing:"0.01em",
          transition:"color 0.15s", margin:0,
        }}>{article.headline}</h3>

        {/* Summary */}
        <p style={{
          fontFamily:"'DM Sans',sans-serif", fontSize: isLarge ? 13 : 12,
          color:T.textMid, lineHeight:1.6, margin:0,
          display: isLarge ? "block" : "-webkit-box",
          WebkitLineClamp: isLarge ? "unset" : 3,
          WebkitBoxOrient:"vertical",
          overflow: isLarge ? "visible" : "hidden",
        }}>{article.summary}</p>

        {/* CTA row */}
        <div style={{
          marginTop:"auto", paddingTop:8, borderTop:`1px solid ${T.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <span style={{
            fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:11,
            color: hov ? T.accent : T.textMid,
            letterSpacing:"0.04em", transition:"color 0.15s",
          }}>
            {isExternal ? "READ FULL REPORT ↗" : "READ ARTICLE →"}
          </span>
          {/* External link indicator */}
          {isExternal && (
            <span style={{
              fontFamily:"'DM Sans',sans-serif", fontSize:8,
              color:"#9CA3AF", letterSpacing:"0.08em", textTransform:"uppercase",
            }}>opens new tab</span>
          )}
          {!isExternal && (
            <span style={{
              background:"#FEF3C7", color:"#92400E",
              fontFamily:"'DM Sans',sans-serif", fontSize:8,
              fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
              padding:"1px 5px", borderRadius:2,
            }}>BOXOFFY EXCLUSIVE</span>
          )}
        </div>
      </div>
    </>
  );
}

function NewsSection({ category }) {
  const articles = ARTICLES[category] || [];
  const [featured, ...rest] = articles;
  const categoryColor = category === "Bollywood" ? T.accent : category === "OTT" ? T.blue : T.purple;

  if (!featured) return (
    <div style={{ padding:40, textAlign:"center", color:T.textMuted }}>No articles in this category yet.</div>
  );

  return (
    <div>
      <div style={{ padding:"20px 24px 16px", borderBottom:`2px solid ${T.border}` }}>
        <span style={{
          fontFamily:"'DM Sans', sans-serif", fontSize:11, fontWeight:700,
          letterSpacing:"0.15em", textTransform:"uppercase", color:categoryColor,
        }}>{category} News</span>
        <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:T.textMuted, marginTop:4 }}>
          Latest from India's box office and entertainment industry
        </p>
      </div>
      <div style={{ padding:24 }}>
        {/* Featured article */}
        <ArticleCard article={featured} size="large" />
        {/* Grid of remaining articles */}
        {rest.length > 0 && (
          <div style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",
            gap:16, marginTop:16,
          }}>
            {rest.map((a, i) => <ArticleCard key={i} article={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── OTT CHARTS DATA ─────────────────────────────────────────
   Source: Netflix Tudum official (week Mar 2–8, 2026) + Sacnilk India Top 10
   Update weekly. India chart = Netflix India Top 10 Movies (latest available).
   Global chart = Netflix Global Non-English Films Top 10.
──────────────────────────────────────────────────────────────── */
/* ── OTT DATA ─────────────────────────────────────────────────────────────
   Weekly update required: Netflix (Tudum official) · Trade sources for others.
   Prime/Zee5/MX do not publish official ranked charts — showing "Known Trending".
   ─────────────────────────────────────────────────────────────────────────── */

const OTT_META = {
  updatedDate: "Apr 6, 2026",
  weekRange:   "Mar 31–Apr 6, 2026",
  nextUpdate:  "Apr 13, 2026",
};

const OTT_NETFLIX = {
  movies: {
    weekRange: "Mar 31–Apr 6, 2026",
    source: "Netflix Tudum (Official) + Zee News · ZeenewsIndia confirmed Mar 24",
    sourceUrl: "https://www.netflix.com/tudum/top10/india/films",
    films: [
      { rank:1,  title:"Dhurandhar",                    trend:"same", lang:"Hindi",   weeks:11, views:"25M+ total",  note:"101.3M hrs · India’s highest Hindi film ever · 11 weeks #1", hot:true },
      { rank:2,  title:"Border 2",                      trend:"new",  lang:"Hindi",   weeks:2,  views:"~8M",         note:"New · Streamed Mar 20 · Sunny Deol, Varun Dhawan · 1971 war epic", hot:true },
      { rank:3,  title:"Peaky Blinders: The Immortal Man", trend:"new", lang:"English", weeks:2, views:"Global Top 10 · 48 countries", note:"New · Streamed Mar 20 · Cillian Murphy · WWII finale", hot:true },
      { rank:4,  title:"Made in Korea",                 trend:"same", lang:"Tamil",   weeks:4,  views:"~5M",         note:"Tamil\u2013Korean crossover · Priyanka Mohan · holding well" },
      { rank:5,  title:"With Love",                     trend:"same", lang:"Tamil",   weeks:5,  views:"~4.5M",       note:"Tamil teen rom-com · 5 weeks · Subcontinent + diaspora hold" },
      { rank:6,  title:"Accused",                       trend:"down", lang:"Hindi",   weeks:5,  views:"~4M",         note:"Karan Johar production · Top 10 in 72 countries at peak" },
      { rank:7,  title:"Anora",                         trend:"new",  lang:"English", weeks:2,  views:"~3M",         note:"Oscar Best Picture 2025 · Sean Baker · library surge post-Oscars" },
      { rank:8,  title:"Tere Ishk Mein",                trend:"down", lang:"Hindi",   weeks:9,  views:"~2.5M",       note:"9 consecutive weeks · romance drama Subcontinent hold" },
      { rank:9,  title:"Jolly LLB 3",                   trend:"down", lang:"Hindi",   weeks:12, views:"~2M",         note:"12-week marathon · Akshay Kumar courtroom comedy · tail end" },
      { rank:10, title:"Pennum Porattam",               trend:"new",  lang:"Malayalam",weeks:2, views:"~1.8M",       note:"Malayalam absurdist satire · strong Kerala + diaspora viewership" },
    ],
  },
  shows: {
    weekRange: "Mar 31–Apr 6, 2026",
    source: "Netflix Tudum (Official)",
    sourceUrl: "https://www.netflix.com/tudum/top10/india/tv",
    films: [
      { rank:1,  title:"Aspirants Season 3",    trend:"up",   lang:"Hindi",        weeks:3,  views:"~7M",         note:"TVF × Netflix · UPSC drama · became #1 show in India this week", hot:true },
      { rank:2,  title:"One Piece Season 2",    trend:"down", lang:"Intl · Dubbed", weeks:3, views:"Top 10 · 56 countries", note:"Grand Line saga · holding strong global presence", hot:true },
      { rank:3,  title:"Squid Game Season 3",   trend:"up",   lang:"Korean",       weeks:6,  views:"~5.5M",       note:"6-week India run · Korean thriller global hold", hot:true },
      { rank:4,  title:"Family Man Season 3",   trend:"same", lang:"Hindi",        weeks:10, views:"~4M",         note:"Manoj Bajpayee · 10 weeks of India chart presence" },
      { rank:5,  title:"Hello Bachhon",         trend:"same", lang:"Hindi",        weeks:4,  views:"~3.5M",       note:"TVF · Inspired by Alakh Pandey · physics teacher biopic" },
      { rank:6,  title:"Panchayat Season 4",    trend:"down", lang:"Hindi",        weeks:7,  views:"~3M",         note:"7-week India run · streaming heartland of rural India" },
      { rank:7,  title:"Virgin River Season 7", trend:"down", lang:"Intl",         weeks:4,  views:"~2.5M",       note:"Netflix’s most consistent romance · global hold" },
      { rank:8,  title:"The Night Agent S3",    trend:"down", lang:"Intl",         weeks:5,  views:"~2M",         note:"American thriller · maintaining India chart presence" },
      { rank:9,  title:"Boyfriend on Demand",   trend:"down", lang:"Korean",       weeks:4,  views:"~1.8M",       note:"Jisoo (BLACKPINK) × Seo In-guk · K-drama India crossover" },
      { rank:10, title:"Firebreak",             trend:"same", lang:"Spanish",      weeks:6,  views:"~1.5M",       note:"Survival drama · #1 in 26 countries globally at peak" },
    ],
  },
};

const OTT_PRIME = {
  movies: {
    weekRange: "Mar 31–Apr 6, 2026",
    source: "Ormax OTT Intelligence + Prime Video India blog",
    sourceUrl: "https://www.aboutamazon.in/news/entertainment/prime-video-lineup-2026",
    note: "Prime Video does not publish official weekly ranked charts. Figures from Ormax OTT Intelligence and Prime Video India trade blog.",
    films: [
      { rank:1,  title:"O'Romeo",              trend:"new",  lang:"Hindi",            weeks:2,  note:"Prime Video Mar 27 · Shahid Kapoor, Triptii Dimri · Vishal Bhardwaj · 1990s Mumbai crime drama · 5.8 IMDB", hot:true },
      { rank:2,  title:"Subedaar",              trend:"down", lang:"Hindi",             weeks:5,  note:"Anil Kapoor · sand mafia crime drama · sustained word-of-mouth" },
      { rank:3,  title:"Pretty Lethal",         trend:"new",  lang:"Hollywood",         weeks:2,  note:"New · Action thriller · Prime Video Mar 25 premiere" },
      { rank:4,  title:"Jawan",                 trend:"same", lang:"Hindi",             weeks:57, note:"Library anchor · SRK · pulling India + global diaspora viewership" },
      { rank:5,  title:"Panchayat Season 4",    trend:"down", lang:"Hindi",             weeks:14, note:"Most-watched rural comedy on Prime India · cross-platform" },
      { rank:6,  title:"Young Sherlock",        trend:"down", lang:"Intl",              weeks:4,  note:"Guy Ritchie · Hero Fiennes Tiffin · Amazon Original" },
      { rank:7,  title:"The Family Man S2",     trend:"same", lang:"Hindi",             weeks:102,note:"Library evergreen · Manoj Bajpayee · still charting" },
      { rank:8,  title:"Farzi Season 1",        trend:"same", lang:"Hindi",             weeks:152,note:"37M+ views all-time · Amazon India record · Farzi S2 in production", hot:true },
      { rank:9,  title:"KGF: Chapter 2",        trend:"same", lang:"Kannada/Hindi",     weeks:82, note:"100M+ views · Pan-India catalogue anchor" },
      { rank:10, title:"RRR",                   trend:"same", lang:"Telugu/Hindi",      weeks:102,note:"Oscar winner · one of Prime India’s top global performers" },
    ],
  },
  shows: {
    weekRange: "Mar 31–Apr 6, 2026",
    source: "Ormax OTT Intelligence",
    sourceUrl: "https://www.aboutamazon.in/news/entertainment/prime-video-lineup-2026",
    note: "Based on Ormax weekly primary research across India OTT universe.",
    films: [
      { rank:1,  title:"Mirzapur Season 3",     trend:"same", lang:"Hindi",   weeks:22, note:"All-time Prime India record · 37M+ views S3", hot:true },
      { rank:2,  title:"Aspirants Season 3",    trend:"up",   lang:"Hindi",   weeks:3,  note:"TVF × Prime · UPSC drama · also cross-charting Netflix India", hot:true },
      { rank:3,  title:"Panchayat Season 4",    trend:"down", lang:"Hindi",   weeks:14, note:"Sustained rural India + diaspora viewership" },
      { rank:4,  title:"The Family Man S3",     trend:"same", lang:"Hindi",   weeks:10, note:"Raj & DK · Manoj Bajpayee · 10-week presence" },
      { rank:5,  title:"Citadel: Honey Bunny",  trend:"same", lang:"Hindi",   weeks:17, note:"Samantha + Varun Dhawan spy action · global crossover" },
      { rank:6,  title:"Made in Heaven S2",     trend:"same", lang:"Hindi",   weeks:42, note:"Zoya Akhtar · sustained prestige viewership" },
      { rank:7,  title:"Dahaad Season 1",       trend:"up",   lang:"Hindi",   weeks:52, note:"Sonakshi Sinha · rewatch surge ahead of S2 announcement" },
      { rank:8,  title:"Farzi Season 1",        trend:"same", lang:"Hindi",   weeks:152,note:"Rewatch surge ahead of Farzi S2 currently in production" },
      { rank:9,  title:"Daldal",                trend:"down", lang:"Hindi",   weeks:10, note:"Bhumi Pednekar · serial killer crime thriller" },
      { rank:10, title:"Anarth",                trend:"new",  lang:"Hindi",   weeks:2,  note:"New horror thriller · unveiled Mar 19 · Prime Video Original" },
    ],
  },
  slate2026: [
    { title:"Farzi Season 2",       cast:"Shahid Kapoor, Vijay Sethupathi", status:"In Production", note:"Raj & DK return · biggest Prime India sequel of 2026" },
    { title:"Panchayat Season 5",   cast:"Jitendra Kumar, Neena Gupta",    status:"Announced",     note:"TVF × Prime · rural India comedy returns" },
    { title:"The Revolutionaries",  cast:"Bhuvan Bam",                     status:"Announced",     note:"Nikkhil Advani · political saga" },
    { title:"Call Me Bae Season 2", cast:"Ananya Panday, Vir Das",         status:"Announced",     note:"Dharmatic Entertainment · comedy sequel" },
    { title:"Dahaad Season 2",      cast:"Sonakshi Sinha",                 status:"Announced",     note:"Zoya Akhtar crime drama returns" },
    { title:"Matka King",           cast:"Vijay Varma",                    status:"Announced",     note:"Crime drama · Emmay Entertainment" },
    { title:"Anarth",               cast:"TBC",                            status:"Streaming",     note:"Horror thriller · streaming now on Prime Video" },
  ],
};

const OTT_ZEE5 = {
  weekRange: "Mar 31–Apr 6, 2026",
  source: "Zee5 Official + Trade Reports",
  sourceUrl: "https://www.zee5.com",
  note: "Zee5 does not publish official weekly ranked charts. Coming this week: Maamla Legal Hai Season 2 (Apr 3) and Bhabiji Ghar Par Hain: Fun on the Run (Apr 3).",
  films: [
    { rank:1,  title:"Maamla Legal Hai 2",     lang:"Hindi",   type:"Series", note:"Zee5 Apr 3 · Ravi Kishan as VD Tyagi · Kusha Kapila joins · courtroom comedy · massive opening week", hot:true },
    { rank:2,  title:"Chhaava",                lang:"Hindi",   type:"Film",   note:"Vicky Kaushal historical epic · post-theatrical streaming", hot:true },
    { rank:3,  title:"Tanaav Season 2",        lang:"Hindi",   type:"Series", note:"Kashmir conflict drama · Zee5 Original continuing run" },
    { rank:4,  title:"Aabha",                  lang:"Hindi",   type:"Series", note:"Political drama · strong female-led viewership" },
    { rank:5,  title:"Dharam Yudh",            lang:"Hindi",   type:"Series", note:"Manoj Bajpayee Zee5 Original · sustained run" },
    { rank:6,  title:"Scam 2003",              lang:"Hindi",   type:"Series", note:"Hansal Mehta · library evergreen" },
    { rank:7,  title:"Sunflower Season 2",     lang:"Hindi",   type:"Series", note:"Sunil Grover comedy series on Zee5" },
    { rank:8,  title:"The Broken News S2",     lang:"Hindi",   type:"Series", note:"Media industry thriller · Zee5 Original" },
    { rank:9,  title:"Mangal Lakshmi",         lang:"Hindi",   type:"Series", note:"Mass family viewership · linear-to-OTT crossover" },
    { rank:10, title:"Kaala Paani",            lang:"Hindi",   type:"Series", note:"Netflix crossover library title on Zee5 bundle" },
  ],
  coming: [
    { title:"Mrs. Deshpande", platform:"ZEE5", date:"Apr 10, 2026", note:"New Zee5 Original · family drama" },
    { title:"Bhabiji Ghar Par Hain: Fun on the Run", platform:"ZEE5", date:"Apr 3, 2026", note:"Comedy-drama film based on popular TV show · Aasif Sheikh, Rohitashv Gour" },
  ],
};

const OTT_MX = {
  weekRange: "Mar 31–Apr 6, 2026",
  source: "Ormax OTT Intelligence (AVOD universe)",
  sourceUrl: "https://www.mxplayer.in",
  note: "MX Player is India’s largest AVOD platform (~300M MAU). Does not publish official ranked charts.",
  films: [
    { rank:1,  title:"Aashram Season 4",        lang:"Hindi",   type:"Series", note:"Bobby Deol franchise · new 2026 season · AVOD — all-time most-watched category", hot:true },
    { rank:2,  title:"Aashram Season 3",        lang:"Hindi",   type:"Series", note:"Bobby Deol · 150M+ views all-time · rewatch driven by S4 release", hot:true },
    { rank:3,  title:"Raktanchal Season 2",     lang:"Hindi",   type:"Series", note:"Gangster drama · MX Original · consistently highest-ranked AVOD series" },
    { rank:4,  title:"Bhaukaal Season 2",       lang:"Hindi",   type:"Series", note:"UP police drama · MX Original · mass Hindi market" },
    { rank:5,  title:"Hello Mini Season 3",     lang:"Hindi",   type:"Series", note:"Psychological thriller · MX Originals female-led hit" },
    { rank:6,  title:"Queen Season 1",          lang:"Hindi",   type:"Series", note:"Ramya Krishnan political biopic · rewatch peak" },
    { rank:7,  title:"Poison Season 2",         lang:"Hindi",   type:"Series", note:"Arbaaz Khan crime drama" },
    { rank:8,  title:"Campus Beats Season 2",   lang:"Hindi",   type:"Series", note:"Youth drama · college audience stronghold" },
    { rank:9,  title:"Vikrant Rona",            lang:"Kannada", type:"Film",   note:"Kiccha Sudeep action · South cinema access on MX" },
    { rank:10, title:"Poran Jai Jaliya Re",     lang:"Bengali", type:"Series", note:"Bengali regional OTT growing fast on MX Player" },
  ],
};

const OTT_COMBINED = {
  weekRange: "Mar 31–Apr 6, 2026",
  source: "Netflix Tudum (Official) + Ormax OTT Intelligence + Trade",
  note: "Cross-platform chart is a composite — Netflix figures are official weekly views, Prime/Zee5/JioHotstar are Ormax primary research estimates.",
  films: [
    { rank:1,  title:"Vadh 2",                  platform:"Netflix",     lang:"Hindi",    type:"Film",   note:"#1 Netflix India in 24hrs · Sanjay Mishra, Neena Gupta · crime thriller · Apr 3", hot:true, tmdbYear:2026 },
    { rank:2,  title:"Maamla Legal Hai 2",       platform:"Zee5",       lang:"Hindi",    type:"Series", note:"Zee5 Apr 3 · Ravi Kishan returns as VD Tyagi · Kusha Kapila joins · biggest Zee5 comedy launch 2026", hot:true },
    { rank:3,  title:"Mardaani 3",               platform:"Netflix",    lang:"Hindi",    type:"Film",   note:"Was #1 Netflix Apr 2 · Rani Mukerji · 7.5M+ views total · YRF franchise resurgence", hot:true, tmdbYear:2026 },
    { rank:4,  title:"O\'Romeo",               platform:"Prime Video",lang:"Hindi",    type:"Film",   note:"Prime Video Mar 27 · Shahid Kapoor, Triptii Dimri · dir. Vishal Bhardwaj · 1990s Mumbai crime", hot:true, tmdbYear:2026 },
    { rank:5,  title:"Border 2",                 platform:"Netflix",    lang:"Hindi",    type:"Film",   note:"Wk3 Netflix · 6.1M views · 20.5M total viewing hrs · Sunny Deol, Varun Dhawan, Diljit", tmdbYear:2026 },
    { rank:6,  title:"Dhurandhar",               platform:"Netflix",    lang:"Hindi",    type:"Film",   note:"Wk12 · 29.3M views all-time · 7th most-watched Indian on Netflix ever · still charting", tmdbYear:2025 },
    { rank:7,  title:"Aspirants Season 3",       platform:"Netflix",    lang:"Hindi",    type:"Series", note:"TVF × Netflix · UPSC drama · #1 show India this week · also cross-charting Prime", hot:true },
    { rank:8,  title:"Sitaare Zameen Par",        platform:"SonyLIV",   lang:"Hindi",    type:"Film",   note:"SonyLIV Apr 3 · Aamir Khan · neurodivergent sports drama · ₹167 Cr theatrical hit", tmdbYear:2025 },
    { rank:9,  title:"Daredevil: Born Again S2", platform:"JioHotstar", lang:"English",  type:"Series", note:"JioHotstar Mar 24 · Marvel · most-watched international series in India Apr week 1", hot:true },
    { rank:10, title:"Subedaar",                 platform:"Prime Video",lang:"Hindi",    type:"Film",   note:"Anil Kapoor · sand mafia crime drama · sustained Prime India chart · strong word-of-mouth", tmdbYear:2026 },
  ],
};;

const OTT_CALENDAR = [
  { film:"Thaai Kizhavi",                   platform:"JioHotstar",  estreaming:"Mar 26, 2026", status:"streaming", lang:"Tamil",          note:"LIVE NOW · Tamil comedy-drama · ₹57 Cr theatrical SUPER HIT · Raadhika Sarathkumar" },
  { film:"Border 2",                         platform:"Netflix",     estreaming:"Mar 20, 2026", status:"streaming", lang:"Hindi",          note:"STREAMING · Sunny Deol, Varun Dhawan, Diljit Dosanjh · 1971 war epic" },
  { film:"Peaky Blinders: The Immortal Man", platform:"Netflix",     estreaming:"Mar 20, 2026", status:"streaming", lang:"English",        note:"STREAMING · Cillian Murphy · Tommy Shelby WWII finale" },
  { film:"Pretty Lethal",                    platform:"Prime Video", estreaming:"Mar 25, 2026", status:"streaming", lang:"Hollywood",      note:"STREAMING · Action thriller · Prime Video" },
  { film:"Happy Patel: Khatarnak Jasoos",    platform:"Netflix",     estreaming:"Apr 1, 2026",  status:"confirmed", lang:"Hindi",          note:"Vir Das + Mithila Palkar · spy-comedy · Netflix Apr 1" },
  { film:"Vadh 2",                           platform:"Netflix",     estreaming:"Apr 3, 2026",  status:"confirmed", lang:"Hindi",          note:"Sanjay Mishra + Neena Gupta · crime thriller sequel · Netflix Apr 3" },
  { film:"Bloodhounds Season 2",             platform:"Netflix",     estreaming:"Apr 3, 2026",  status:"confirmed", lang:"Korean",         note:"Korean action series sequel · Netflix Apr 3" },
  { film:"Maamla Legal Hai Season 2",        platform:"ZEE5",        estreaming:"Apr 3, 2026",  status:"confirmed", lang:"Hindi",          note:"Ravi Kishan returns · Kusha Kapila joins · courtroom comedy · ZEE5" },
  { film:"Sitaare Zameen Par",               platform:"SonyLIV",     estreaming:"Apr 3, 2026",  status:"confirmed", lang:"Hindi",          note:"Aamir Khan + Genelia Deshmukh · spiritual successor to Taare Zameen Par · SonyLIV" },
  { film:"Dhurandhar 2: The Revenge",        platform:"JioHotstar",  estreaming:"~May 15, 2026",status:"confirmed", lang:"Hindi · Pan-India", note:"₹150 Cr deal · 8-week theatrical window · JioHotstar" },
  { film:"Ustaad Bhagat Singh",              platform:"Netflix",     estreaming:"~May 19, 2026",status:"confirmed", lang:"Telugu",         note:"Pawan Kalyan · 8-week window · ₹90 Cr deal est." },
  { film:"Farzi Season 2",                   platform:"Prime Video", estreaming:"H2 2026",      status:"announced", lang:"Hindi",          note:"Shahid Kapoor + Vijay Sethupathi · Raj & DK · currently in production" },
];

const OTT_EDITORIAL = [
  {
    week:      "Week 14 · Mar 24–30, 2026",
    headline:  "Prime Video Goes Big. Very Big.",
    subline:   "55 titles, a new theatrical slate, and Farzi S2. Amazon just fired back at Netflix.",
    body:      "Amazon Prime Video's 'It Starts Here' slate event on March 19 was a statement. Farzi Season 2, Panchayat Season 5, Aspirants Season 3 (already live), The Revolutionaries with Bhuvan Bam, Dahaad Season 2, Call Me Bae Season 2 — and a five-film theatrical slate including Rajkummar Rao's Raftaar. The headline from Prime's own data: over half of the most-watched Top 50 non-English titles globally in 2025 came from Prime India. And 25% of their Indian content audience is outside India. That number is the real story — Indian OTT originals are becoming a global export business.",
    intel: [
      { label:"Prime 2026 Slate",    val:"55+ titles",   note:"Hindi + Tamil + Telugu across originals and films" },
      { label:"Farzi S2",            val:"Confirmed",    note:"Shahid Kapoor + Vijay Sethupathi return · Raj & DK" },
      { label:"Global Indian Share", val:"25%",          note:"Prime Video Indian content watched outside India" },
      { label:"Non-English Top 50",  val:">50% India",   note:"India dominated Prime's global non-English chart in 2025" },
    ],
  },
  {
    week:      "Week 10 · Mar 6–12, 2026",
    headline:  "Netflix India's March is Already Full.",
    subline:   "One Piece S2, Peaky Blinders, Hello Bachhon, Boyfriend on Demand — all in 10 days.",
    body:      "Netflix crammed an extraordinary slate into the first two weeks of March. One Piece Season 2 debuted March 10 and immediately hit top 10 in 64 countries. Hello Bachhon (TVF, March 6) and Aspirants Season 3 (Prime, March 13) are competing for the same Hindi OTT prestige audience — and Aspirants is charting on both platforms simultaneously. Boyfriend on Demand with Jisoo has become the fastest-selling new K-drama premiere in India in months. Meanwhile Border 2's March 20 Netflix premiere will be a test: can a ₹424 Cr box office hit still drive OTT subscription adds when the theatrical memory is fresh?",
    intel: [
      { label:"One Piece S2",         val:"64 countries",  note:"Netflix top 10 debut · March 10" },
      { label:"Border 2 Netflix",     val:"Mar 20, 2026",  note:"Sunny Deol war drama · 8 weeks after theatrical" },
      { label:"Boyfriend on Demand",  val:"Jisoo debut",   note:"BLACKPINK K-drama × Indian audience convergence" },
      { label:"TVF on Both",          val:"Hello Bachhon", note:"TVF content now split across Netflix and Prime simultaneously" },
    ],
  },
];

/* OTT Deals — verified and estimated                                       */
const OTT_DEALS = [
  { film:"Dhurandhar",               platform:"Netflix",     deal:"₹285 Cr",       year:2025, note:"Record Hindi OTT deal · 101.3M hrs · 23M views confirmed", verified:true },
  { film:"Dhurandhar 2: The Revenge",platform:"JioHotstar",  deal:"₹150 Cr",       year:2026, note:"+ Star Gold ₹50 Cr + T-Series ₹45 Cr · Total non-theatrical ₹245 Cr", verified:true },
  { film:"Pushpa 2: The Rule",       platform:"Netflix",     deal:"₹250 Cr (est.)",year:2024, note:"Netflix India's most-watched Indian film 2025 · 50M+ views", verified:false },
  { film:"Ustaad Bhagat Singh",      platform:"Netflix",     deal:"₹90 Cr (est.)", year:2026, note:"8-week theatrical window · OTT premiere ~May 2026", verified:false },
  { film:"Jawan",                    platform:"Prime Video", deal:"₹200 Cr (est.)",year:2023, note:"SRK biggest OTT acquisition · 30M+ views", verified:false },
  { film:"Border 2",                 platform:"Netflix",     deal:"₹80 Cr (est.)", year:2026, note:"₹424 Cr theatrical · Netflix premiere March 20, 2026", verified:false },
  { film:"KGF: Chapter 2",           platform:"Prime Video", deal:"₹100 Cr (est.)",year:2022, note:"Kannada + Hindi · Pan-India catalogue anchor", verified:false },
  { film:"RRR",                      platform:"Netflix",     deal:"₹70 Cr (est.)", year:2022, note:"Oscar winner · Netflix India global performer", verified:false },
];

/* Platform Intel                                                           */
const OTT_PLATFORMS = [
  {
    id:"netflix", name:"Netflix", color:"#E50914", bg:"#1A0000",
    subscribers:"~11M India (est.)", globalSubs:"300M+ global",
    topTitle:"Dhurandhar", topStat:"101.3M hrs",
    recentDeal:"D2 sequel lost to JioHotstar", recentDealNote:"D1 record holder keeping catalogue strong",
    badge:"SVOD", badgeColor:"#E50914",
    intel:"Netflix India's 2026 is defined by content density — One Piece S2, Peaky Blinders, Border 2 and Hello Bachhon all in a single month. Dhurandhar's 101.3M hours remains their all-time Hindi record. The D2 acquisition going to JioHotstar is the first time a major Hindi franchise split platforms mid-run. Their strength: global prestige + Korean crossover + TVF originals.",
  },
  {
    id:"prime", name:"Prime Video", color:"#00A8E1", bg:"#001020",
    subscribers:"~22M India (est.)", globalSubs:"200M+ global",
    topTitle:"Mirzapur S3", topStat:"37M+ views",
    recentDeal:"55-title 2026 slate · Farzi S2 + Panchayat S5", recentDealNote:"'It Starts Here' event March 19",
    badge:"SVOD", badgeColor:"#00A8E1",
    intel:"Prime's March 19 slate event was their biggest statement yet: 55 titles, a theatrical division with 5 new films, and returning hits Farzi S2 + Panchayat S5. Their India data is striking — 25% of Indian content views come from outside India, and Indian originals make up half their global non-English Top 50. Lost Dhurandhar 2 to JioHotstar. Won Aspirants S3, Subedaar, and the entire 2026 originals calendar.",
  },
  {
    id:"jiohotstar", name:"JioHotstar", color:"#0066FF", bg:"#000A1A",
    subscribers:"~500M MAU (free)", globalSubs:"India + MENA",
    topTitle:"Dhurandhar 2", topStat:"₹150 Cr deal",
    recentDeal:"D2 + UBS · ₹150 Cr+ combined", recentDealNote:"2026's biggest OTT acquisitions",
    badge:"AVOD+SVOD", badgeColor:"#0066FF",
    intel:"JioHotstar's big 2026 bet: Dhurandhar 2 at ₹150 Cr after losing D1 to Netflix. Combined with Ustaad Bhagat Singh, they've committed ₹200 Cr+ in Q1 theatrical acquisitions. IPL + D2 is their cornerstone strategy for 2026. The free tier (Jio network) gives them 500M+ reach — converting even 5% to D2 is a massive streaming event.",
  },
  {
    id:"zee5", name:"Zee5", color:"#6B21A8", bg:"#0D001A",
    subscribers:"~15M India (est.)", globalSubs:"India + diaspora",
    topTitle:"Aashram library", topStat:"300M MAU (AVOD tier)",
    recentDeal:"Zee5 × MX Player convergence", recentDealNote:"AVOD + SVOD bundled play",
    badge:"AVOD+SVOD", badgeColor:"#6B21A8",
    intel:"Zee5's strength is regional content and the Zee TV library — Star Plus and Star Gold dramas are their daily engagement engine. Their AVOD tier (300M+ MAU shared with MX Player) gives scale. Original series like Tanaav and Jwala are building prestige credentials. The Zee5-MX Player bundled approach is creating the largest free streaming audience in India.",
  },
  {
    id:"mxplayer", name:"MX Player", color:"#F97316", bg:"#1A0800",
    subscribers:"~300M MAU (AVOD)", globalSubs:"India-centric",
    topTitle:"Aashram", topStat:"150M+ views",
    recentDeal:"MX × Zee5 AVOD partnership", recentDealNote:"India's largest free streaming combine",
    badge:"AVOD (Free)", badgeColor:"#F97316",
    intel:"Aashram is the most-watched Indian web series ever when AVOD is included — 150M+ views across all seasons. MX Player's AVOD model means no subscription barrier, making it India's true mass-market streamer. Their audience skews North India, Hindi heartland, and Tier 2-3 cities. Aashram Season 4 is their 2026 tent-pole. The MX-Zee5 partnership creates a combined free streaming footprint that dwarfs every SVOD platform in India.",
  },
  {
    id:"sonyliv", name:"SonyLIV", color:"#00B140", bg:"#001A0A",
    subscribers:"~12M India (est.)", globalSubs:"India + diaspora",
    topTitle:"Scam 1992", topStat:"Most-watched series",
    recentDeal:"ICC Cricket + Scam franchise", recentDealNote:"Sports + prestige originals",
    badge:"SVOD", badgeColor:"#00B140",
    intel:"SonyLIV's lane is prestige originals + live cricket. Scam 1992 remains their all-time benchmark. Scam 2003 extended the franchise. Relatively quiet on big theatrical film acquisitions — competing on original series quality rather than licensing spend. The Hansal Mehta partnership remains their most productive creative relationship.",
  },
];

/* ── OTT LANDING PAGE ─────────────────────────────────────────────────── */
// TMDB poster thumbnail for OTT rows
function TMDBPosterThumb({ title, year }) {
  const url = useTMDBPoster(title, year);
  return (
    <div style={{ width:36, height:50, flexShrink:0, borderRadius:3, overflow:"hidden",
      background:"#1a1a2e", display:"flex", alignItems:"center", justifyContent:"center" }}>
      {url
        ? <img src={url} alt={title} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        : <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:9, color:"#555",
            textAlign:"center", padding:2, lineHeight:1.2 }}>{title.slice(0,6)}</span>
      }
    </div>
  );
}

function OTTRankingsSection() {
  const [tab, setTab] = React.useState("combined");
  const [netflixSub, setNetflixSub] = React.useState("movies");
  const [primeSub, setPrimeSub] = React.useState("movies");
  const [activePlatform, setActivePlatform] = React.useState("netflix");
  const [editorialIdx, setEditorialIdx] = React.useState(0);

  const PLATFORM_COLOR = {
    "Netflix": "#E50914", "Prime Video": "#00A8E1", "JioHotstar": "#0066FF",
    "Zee5": "#6B21A8", "MX Player": "#F97316", "SonyLIV": "#00B140",
  };

  const navTabs = [
    { key:"combined",  label:"🔥 Most Watched" },
    { key:"netflix",   label:"🎬 Netflix" },
    { key:"prime",     label:"📦 Prime Video" },
    { key:"zee5",      label:"🔵 Zee5" },
    { key:"mx",        label:"📱 MX Player" },
    { key:"calendar",  label:"📅 Premiere Dates" },
    { key:"editorial", label:"📰 Weekly Take" },
    { key:"deals",     label:"💰 Deals" },
    { key:"platforms", label:"⚡ Platform Intel" },
  ];

  const platform = OTT_PLATFORMS.find(p => p.id === activePlatform) || OTT_PLATFORMS[0];

  // Shared row renderer
  const ChartRow = ({ film, i, total, showPlatform }) => {
    const isHot = film.hot;
    const platformCol = showPlatform ? (PLATFORM_COLOR[film.platform] || "#6B7280") : null;
    return (
      <div style={{
        display:"flex", alignItems:"center", gap:12, padding:"10px 24px",
        borderBottom: i < total-1 ? `1px solid ${T.border}` : "none",
        background: isHot ? "#FFFDF8" : T.surface,
        borderLeft: isHot ? "3px solid #E50914" : "3px solid transparent",
      }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
          fontSize: film.rank<=3?20:15, width:24, flexShrink:0, textAlign:"center",
          color: film.rank===1?"#B8860B":film.rank<=3?"#E50914":T.textMuted,
        }}>{film.rank}</div>
        {film.trend && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, fontWeight:800,
          color:film.trend==="up"?"#16A34A":film.trend==="down"?"#DC2626":film.trend==="new"?"#2563EB":"#6B7280",
          letterSpacing:"0em", lineHeight:1, marginTop:1, textAlign:"center",
        }}>{film.trend==="up"?"↑":film.trend==="down"?"↓":film.trend==="new"?"★":"→"}</div>}
        <div style={{ width:1, height:28, background:T.border, flexShrink:0 }} />
        <TMDBPosterThumb title={film.title} year={film.tmdbYear} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:isHot?800:700,
            fontSize:15, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          }}>{film.title}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2, flexWrap:"wrap" }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted }}>{film.lang}</span>
            {film.type && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, fontWeight:600, color:T.textMuted, letterSpacing:"0.08em", textTransform:"uppercase", background:T.surfaceAlt, padding:"1px 5px", borderRadius:2 }}>{film.type}</span>}
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0, minWidth:0 }}>
          {showPlatform && platformCol && (
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11,
              color:platformCol, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2,
            }}>{film.platform}</div>
          )}
          {film.views && <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:13, color:"#E50914" }}>{film.views}</div>}
          {film.weeks && !film.views && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.textMid, fontWeight:600 }}>Wk {film.weeks}</div>}
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:1,
            maxWidth:160, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          }}>{film.note?.split(" · ")[0]}</div>
        </div>
        {isHot && <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:8,
          letterSpacing:"0.14em", textTransform:"uppercase", background:"#7F1D1D",
          color:"#FCA5A5", padding:"2px 6px", borderRadius:2, flexShrink:0,
        }}>HOT</div>}
      </div>
    );
  };

  const SourceNote = ({ text, url }) => (
    <div style={{ padding:"8px 24px", background:T.surfaceAlt, borderTop:`1px solid ${T.border}` }}>
      <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, fontStyle:"italic" }}>{text}</span>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.accent, marginLeft:8 }}>Source ↗</a>}
    </div>
  );

  const SubToggle = ({ val, setVal, options }) => (
    <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, background:T.surface }}>
      {options.map(([k, label]) => (
        <button key={k} onClick={() => setVal(k)} style={{
          fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11,
          letterSpacing:"0.12em", textTransform:"uppercase", padding:"9px 20px",
          border:"none", cursor:"pointer", flexShrink:0,
          borderBottom: val===k ? `2px solid ${T.accent}` : "2px solid transparent",
          background: val===k ? "#FFF5F5" : T.surface,
          color: val===k ? T.accent : T.textMuted, transition:"all 0.12s",
        }}>{label}</button>
      ))}
    </div>
  );

  return (
    <div style={{ background:T.surface }}>

      {/* Hero stat strip */}
      <div style={{ background:"#0A0A0A", borderBottom:"1px solid #1A1A1A", padding:"18px 24px" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:14 }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:11, color:"#C8201A", letterSpacing:"0.22em", textTransform:"uppercase" }}>OTT INTELLIGENCE</span>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#4B5563" }}>India · {OTT_META.updatedDate}</span>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#374151", marginLeft:"auto" }}>Next update: {OTT_META.nextUpdate}</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:1 }}>
          {[
            { label:"All-Time Hindi Record",  val:"101.3M hrs", sub:"Dhurandhar · Netflix India 2025",   col:"#E50914" },
            { label:"Biggest Film Deal",       val:"₹285 Cr",    sub:"Dhurandhar · Netflix",               col:"#22C55E" },
            { label:"D2 OTT Deal",             val:"₹150 Cr",    sub:"Dhurandhar 2 · JioHotstar 2026",    col:"#0066FF" },
            { label:"Prime 2026 Slate",        val:"55+ Titles",  sub:"Farzi S2 · Panchayat S5 · + more",  col:"#00A8E1" },
            { label:"India AVOD Reach",        val:"~300M MAU",   sub:"MX Player + Zee5 free tier",        col:"#F97316" },
          ].map((s,i) => (
            <div key={i} style={{ background:"#111", padding:"12px 16px", borderRight:"1px solid #1A1A1A" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:22, color:s.col, lineHeight:1, marginBottom:3 }}>{s.val}</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, fontWeight:600, color:"#6B7280", letterSpacing:"0.12em", textTransform:"uppercase" }}>{s.label}</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#4B5563", marginTop:2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ borderBottom:`1px solid ${T.border}`, display:"flex", background:T.surfaceAlt, overflowX:"auto" }}>
        {navTabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11,
            letterSpacing:"0.1em", textTransform:"uppercase", padding:"10px 18px",
            border:"none", cursor:"pointer", flexShrink:0,
            borderBottom: tab===t.key ? `2px solid ${T.accent}` : "2px solid transparent",
            background: tab===t.key ? T.surface : "transparent",
            color: tab===t.key ? T.accent : T.textMuted, transition:"all 0.12s",
          }}>{t.label}</button>
        ))}
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, padding:"10px 16px", marginLeft:"auto", alignSelf:"center", flexShrink:0 }}>
          Updated {OTT_META.updatedDate}
        </span>
      </div>

      {/* COMBINED MOST WATCHED */}
      {tab === "combined" && (
        <div>
          <div style={{ padding:"12px 24px", background:T.surfaceAlt, borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:13, color:T.text, letterSpacing:"0.06em", textTransform:"uppercase" }}>Cross-Platform Most Watched</span>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted }}>· {OTT_COMBINED.weekRange}</span>
          </div>
          {OTT_COMBINED.films.map((film, i) => (
            <ChartRow key={i} film={film} i={i} total={OTT_COMBINED.films.length} showPlatform={true} />
          ))}
          <SourceNote text={OTT_COMBINED.note} url={null} />
        </div>
      )}

      {/* NETFLIX */}
      {tab === "netflix" && (
        <div>
          <SubToggle val={netflixSub} setVal={setNetflixSub} options={[["movies","🎬 Movies"],["shows","📺 Shows"]]} />
          <div style={{ padding:"8px 24px 4px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#E50914", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase" }}>Netflix India · Official Tudum · {OTT_NETFLIX.movies.weekRange}</span>
            <a href={OTT_NETFLIX.movies.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, textDecoration:"none" }}>Source ↗</a>
          </div>
          {(netflixSub === "movies" ? OTT_NETFLIX.movies.films : OTT_NETFLIX.shows.films).map((film, i) => {
            const list = netflixSub === "movies" ? OTT_NETFLIX.movies.films : OTT_NETFLIX.shows.films;
            return <ChartRow key={i} film={film} i={i} total={list.length} showPlatform={false} />;
          })}
          <SourceNote text="Netflix India Top 10 published weekly via Netflix Tudum (official). Views = millions of accounts that watched ≥70% of a film / ≥1 episode of a show in the stated week." url={OTT_NETFLIX.movies.sourceUrl} />
        </div>
      )}

      {/* PRIME VIDEO */}
      {tab === "prime" && (
        <div>
          <SubToggle val={primeSub} setVal={setPrimeSub} options={[["movies","🎬 Movies"],["shows","📺 Shows"],["slate","🗓 2026 Slate"]]} />
          <div style={{ padding:"8px 24px 4px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#00A8E1", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase" }}>Prime Video India · {OTT_PRIME.movies.weekRange}</span>
            <a href={OTT_PRIME.movies.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, textDecoration:"none" }}>Source ↗</a>
          </div>
          {primeSub === "slate" ? (
            <div>
              {OTT_PRIME.slate2026.map((s, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 24px",
                  borderBottom:`1px solid ${T.border}`, background: i%2===0 ? T.surface : T.surfaceAlt,
                  borderLeft:"3px solid #00A8E1",
                }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:15, color:T.text, flex:1 }}>{s.title}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted, textAlign:"right" }}>{s.cast}</div>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase",
                    color:"#00A8E1", border:"1px solid #00A8E1", background:"#00A8E108", padding:"2px 7px", borderRadius:2, flexShrink:0,
                  }}>{s.status}</span>
                </div>
              ))}
              <SourceNote text="Prime Video India 2026 slate announced at 'It Starts Here' event · March 19, 2026." url={OTT_PRIME.movies.sourceUrl} />
            </div>
          ) : (
            <>
              {(primeSub === "movies" ? OTT_PRIME.movies.films : OTT_PRIME.shows.films).map((film, i) => {
                const list = primeSub === "movies" ? OTT_PRIME.movies.films : OTT_PRIME.shows.films;
                return <ChartRow key={i} film={film} i={i} total={list.length} showPlatform={false} />;
              })}
              <SourceNote text={OTT_PRIME.movies.note} url={OTT_PRIME.movies.sourceUrl} />
            </>
          )}
        </div>
      )}

      {/* ZEE5 */}
      {tab === "zee5" && (
        <div>
          <div style={{ padding:"8px 24px 4px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#6B21A8", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase" }}>Zee5 India · {OTT_ZEE5.weekRange}</span>
            <a href={OTT_ZEE5.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, textDecoration:"none" }}>Zee5 ↗</a>
          </div>
          {OTT_ZEE5.films.map((film, i) => (
            <ChartRow key={i} film={film} i={i} total={OTT_ZEE5.films.length} showPlatform={false} />
          ))}
          <SourceNote text={OTT_ZEE5.note} url={null} />
        </div>
      )}

      {/* MX PLAYER */}
      {tab === "mx" && (
        <div>
          <div style={{ padding:"8px 24px 4px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#F97316", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase" }}>MX Player India · AVOD · {OTT_MX.weekRange}</span>
            <a href={OTT_MX.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, textDecoration:"none" }}>MX Player ↗</a>
          </div>
          {OTT_MX.films.map((film, i) => (
            <ChartRow key={i} film={film} i={i} total={OTT_MX.films.length} showPlatform={false} />
          ))}
          <SourceNote text={OTT_MX.note} url={null} />
        </div>
      )}

      {/* PREMIERE DATES */}
      {tab === "calendar" && (
        <div>
          <div style={{ padding:"12px 24px", background:T.surfaceAlt, borderBottom:`1px solid ${T.border}` }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:13, color:T.text, letterSpacing:"0.06em", textTransform:"uppercase" }}>OTT Premiere Dates — Confirmed & Expected</span>
          </div>
          {OTT_CALENDAR.map((c, i) => {
            const platformEntry = OTT_PLATFORMS.find(p => c.platform.includes(p.name.split(" ")[0]) || p.name.includes(c.platform));
            const col = platformEntry ? platformEntry.color : "#6B7280";
            const statusColor = c.status === "streaming" ? "#22C55E" : c.status === "confirmed" ? "#22C55E" : c.status === "expected" ? "#D97706" : "#6B7280";
            return (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:14, padding:"14px 24px",
                borderBottom:`1px solid ${T.border}`,
                borderLeft:`3px solid ${statusColor}`,
                background: i%2===0 ? T.surface : T.surfaceAlt,
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16, color:T.text }}>{c.film}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:2 }}>{c.lang} · {c.note}</div>
                </div>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11,
                  letterSpacing:"0.08em", textTransform:"uppercase",
                  color:col, border:`1px solid ${col}`, background:`${col}18`,
                  padding:"2px 8px", borderRadius:2, flexShrink:0,
                }}>{c.platform}</span>
                <div style={{ flexShrink:0, textAlign:"right", minWidth:100 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:14, color:statusColor }}>{c.estreaming}</div>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, fontWeight:600,
                    letterSpacing:"0.1em", textTransform:"uppercase",
                    color:statusColor, border:`1px solid ${statusColor}80`,
                    background:`${statusColor}12`, padding:"1px 6px", borderRadius:2,
                  }}>{c.status}</span>
                </div>
              </div>
            );
          })}
          <div style={{ padding:"10px 24px", background:T.surfaceAlt, borderTop:`1px solid ${T.border}` }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, fontStyle:"italic" }}>
              ✅ Confirmed = official announcement · ⚠️ Expected = based on standard theatrical window · 🔴 Streaming = live now. Windows: typically 6–8 weeks for mainstream films, 4 weeks for mid-budget.
            </span>
          </div>
        </div>
      )}

      {/* WEEKLY EDITORIAL */}
      {tab === "editorial" && (
        <div>
          {/* Tab selector for multiple weeks */}
          <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, background:T.surfaceAlt, overflowX:"auto" }}>
            {OTT_EDITORIAL.map((e, i) => (
              <button key={i} onClick={() => setEditorialIdx(i)} style={{
                fontFamily:"'DM Sans',sans-serif", fontWeight:editorialIdx===i?700:500, fontSize:11,
                padding:"9px 18px", border:"none", cursor:"pointer", flexShrink:0,
                borderBottom: editorialIdx===i ? `2px solid ${T.accent}` : "2px solid transparent",
                background: editorialIdx===i ? T.surface : "transparent",
                color: editorialIdx===i ? T.accent : T.textMuted, transition:"all 0.12s",
              }}>{e.week}</button>
            ))}
          </div>
          {OTT_EDITORIAL[editorialIdx] && (() => {
            const ed = OTT_EDITORIAL[editorialIdx];
            return (
              <div style={{ padding:"28px 32px", maxWidth:820 }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, fontWeight:600, color:T.accent, letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:10 }}>{ed.week} · OTT Intel</div>
                <h2 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:28, color:T.text, lineHeight:1.1, marginBottom:6 }}>{ed.headline}</h2>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:T.textMuted, marginBottom:20, fontStyle:"italic" }}>{ed.subline}</div>
                <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:T.textMid, lineHeight:1.8, marginBottom:24, borderLeft:`3px solid ${T.border}`, paddingLeft:16 }}>{ed.body}</p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
                  {ed.intel.map((item, i) => (
                    <div key={i} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:3, padding:"12px 14px" }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:20, color:T.accent, lineHeight:1 }}>{item.val}</div>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, fontWeight:600, color:T.text, letterSpacing:"0.12em", textTransform:"uppercase", marginTop:3 }}>{item.label}</div>
                      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:4 }}>{item.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* DEALS */}
      {tab === "deals" && (
        <div>
          <div style={{ padding:"12px 24px", background:T.surfaceAlt, borderBottom:`1px solid ${T.border}` }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:13, color:T.text, letterSpacing:"0.06em", textTransform:"uppercase" }}>Major OTT Acquisition Deals</span>
          </div>
          {OTT_DEALS.map((d, i) => {
            const platformEntry = OTT_PLATFORMS.find(p => p.name.includes(d.platform.split(" ")[0]));
            const col = platformEntry ? platformEntry.color : "#6B7280";
            return (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:14, padding:"14px 24px",
                borderBottom:`1px solid ${T.border}`, background: i%2===0 ? T.surface : T.surfaceAlt,
                borderLeft:`3px solid ${d.verified?"#22C55E":"#D97706"}`,
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16, color:T.text }}>{d.film}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:2 }}>{d.note}</div>
                </div>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11,
                  color:col, border:`1px solid ${col}`, background:`${col}18`,
                  padding:"2px 8px", borderRadius:2, flexShrink:0, letterSpacing:"0.06em", textTransform:"uppercase",
                }}>{d.platform}</span>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:18, color:T.accent, lineHeight:1 }}>{d.deal}</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.textMuted, marginTop:2 }}>{d.year} · {d.verified ? "✅ Verified" : "⚠️ Est."}</div>
                </div>
              </div>
            );
          })}
          <div style={{ padding:"10px 24px", background:T.surfaceAlt, borderTop:`1px solid ${T.border}` }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, fontStyle:"italic" }}>✅ Verified = confirmed via official announcements. ⚠️ Estimated = trade sources. All figures in ₹ Crores.</span>
          </div>
        </div>
      )}

      {/* PLATFORM INTEL */}
      {tab === "platforms" && (
        <div>
          <div style={{ background:"#111", borderBottom:"1px solid #1A1A1A", padding:"0 24px", display:"flex", overflowX:"auto", gap:0 }}>
            {OTT_PLATFORMS.map(p => (
              <button key={p.id} onClick={() => setActivePlatform(p.id)} style={{
                background:"transparent", border:"none",
                borderBottom:`2px solid ${activePlatform===p.id ? p.color : "transparent"}`,
                padding:"10px 18px", cursor:"pointer", flexShrink:0,
                display:"flex", alignItems:"center", gap:8, transition:"all 0.12s",
              }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:p.color }} />
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:12,
                  color: activePlatform===p.id ? p.color : "#6B7280",
                  letterSpacing:"0.06em", textTransform:"uppercase", transition:"color 0.12s",
                }}>{p.name}</span>
              </button>
            ))}
          </div>
          <div style={{ padding:"24px 28px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <div style={{ width:4, height:28, background:platform.color, borderRadius:2 }} />
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:22, color:T.text }}>{platform.name}</div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted }}>{platform.subscribers} · {platform.badge}</div>
              </div>
              <span style={{ marginLeft:"auto", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11,
                letterSpacing:"0.12em", textTransform:"uppercase",
                color:platform.badgeColor, border:`1px solid ${platform.badgeColor}`,
                background:`${platform.badgeColor}18`, padding:"3px 10px", borderRadius:2,
              }}>{platform.badge}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns: typeof window !== "undefined" && window.innerWidth < 640 ? "1fr" : "1fr 1fr", gap:12, marginBottom:20 }}>
              {[
                { label:"Top Title", val:platform.topTitle, sub:platform.topStat },
                { label:"Recent Deal", val:platform.recentDeal, sub:platform.recentDealNote },
              ].map((s,i) => (
                <div key={i} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, padding:"14px 16px", borderRadius:3 }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, fontWeight:600, color:T.textMuted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6 }}>{s.label}</div>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:17, color:T.text, lineHeight:1.1 }}>{s.val}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted, marginTop:4 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:T.textMid, lineHeight:1.8,
              borderLeft:`3px solid ${platform.color}`, paddingLeft:16,
            }}>{platform.intel}</div>
          </div>
        </div>
      )}

    </div>
  );
}




/* ── EDITORIAL ROW (numbered ①②③) ──────────────────────────── */
function FeaturedEditorialRow({ item, index, TagPill, onClick }) {
  const [hov, setHov] = useState(false);
  const isLead = index === 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:14,
        padding: isLead ? "14px 28px" : "10px 28px",
        borderBottom:`1px solid ${T.border}`,
        cursor:"pointer",
        background: hov ? "#FFF8EE" : isLead ? "#FFFDF8" : T.surface,
        transition:"background 0.15s",
        borderLeft: isLead ? `3px solid ${T.accent}` : `3px solid transparent`,
      }}
    >
      {/* Issue number */}
      <div style={{
        fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
        fontSize:isLead ? 22 : 16, color: isLead ? T.accent : T.textMuted,
        opacity: isLead ? 1 : 0.4, flexShrink:0, width:24, textAlign:"center",
        lineHeight:1,
      }}>
        {index === 0 ? "①" : index === 1 ? "②" : "③"}
      </div>

      {/* Divider */}
      <div style={{ width:1, height:isLead ? 42 : 32, background:T.border, flexShrink:0 }} />

      {/* Tag */}
      <TagPill tag={item.tag} />

      {/* Text */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          fontFamily:"'Barlow Condensed',sans-serif",
          fontWeight:800,
          fontSize: isLead ? 18 : 15,
          color: T.text, lineHeight:1.15, letterSpacing:"-0.01em",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        }}>{item.headline}</div>
        {isLead && (
          <div style={{
            fontFamily:"'DM Sans',sans-serif", fontSize:11,
            color:T.textMuted, marginTop:3, lineHeight:1.3,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          }}>{item.dek}</div>
        )}
      </div>

      {/* Meta */}
      <div style={{ flexShrink:0, textAlign:"right", borderLeft:`1px solid ${T.border}`, paddingLeft:14 }}>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700, color:T.textMid }}>{item.author}</div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:1 }}>{item.date} · {item.readTime}</div>
      </div>

      {/* Arrow */}
      <div style={{
        flexShrink:0, fontFamily:"'Barlow Condensed',sans-serif",
        fontWeight:800, fontSize:18, color:T.accent,
      }}>→</div>
    </div>
  );
}

/* ── FROM THE DESK — Magazine split, light theme ─────────────── */
function EditorialSection({ onNavigate }) {
  const [expanded, setExpanded] = React.useState(false);

  const TAG_COLORS = {
    "ANALYSIS":         { bg:"#FEF3C7", text:"#92400E" },
    "ADVANCE BOOKING":  { bg:"#DCFCE7", text:"#166534" },
    "DEEP DIVE":        { bg:"#DBEAFE", text:"#1E40AF" },
    "US BOX OFFICE":    { bg:"#EDE9FE", text:"#5B21B6" },
    "PRICING ANALYSIS": { bg:"#FCE7F3", text:"#9D174D" },
    "INTERVIEW":        { bg:"#DCFCE7", text:"#166534" },
    "OPINION":          { bg:"#FEE2E2", text:"#991B1B" },
    "EXCLUSIVE":        { bg:"#EDE9FE", text:"#5B21B6" },
    "REPORT":           { bg:"#DCFCE7", text:"#166534" },
    "BREAKING":         { bg:"#FEE2E2", text:"#991B1B" },
    "VERDICT":          { bg:"#FEE2E2", text:"#991B1B" },
    "COMPARISON":       { bg:"#DBEAFE", text:"#1E40AF" },
    "DATA ANALYSIS":    { bg:"#FEF3C7", text:"#92400E" },
    "REVIEW":           { bg:"#FEE2E2", text:"#991B1B" },
    "OTT":              { bg:"#EDE9FE", text:"#5B21B6" },
    "TV":               { bg:"#DCFCE7", text:"#166534" },
    "PREVIEW":          { bg:"#FEF3C7", text:"#92400E" },
    "SPECIAL EDITION":  { bg:"#111111", text:"#C8201A" },
  };

  const parseDate = (d) => { try { return new Date(d); } catch(e) { return new Date(0); } };
  const sorted = [...EDITORIALS].sort((a, b) => {
    const diff = parseDate(b.date) - parseDate(a.date);
    return diff !== 0 ? diff : EDITORIALS.indexOf(a) - EDITORIALS.indexOf(b);
  });

  const lead = sorted[0];
  const visible = sorted.slice(1, 6);
  const hidden  = sorted.slice(6);

  const open = (item) => {
    if (item.url) window.open(item.url, "_blank", "noopener");
    else if (onNavigate && item.section) onNavigate(item.section);
  };

  const tagStyle = (tag) => {
    const s = TAG_COLORS[tag] || TAG_COLORS["ANALYSIS"];
    return { background:s.bg, color:s.text, fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:8, letterSpacing:"0.08em", textTransform:"uppercase", padding:"2px 7px", borderRadius:2, flexShrink:0, whiteSpace:"nowrap" };
  };

  const dotStyle = (tag) => {
    const s = TAG_COLORS[tag] || TAG_COLORS["ANALYSIS"];
    return { width:6, height:6, borderRadius:"50%", flexShrink:0, background:s.text };
  };

  const Row = ({ item, faded }) => (
    <div onClick={() => open(item)}
      style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 16px", borderBottom:`1px solid ${T.border}`, background: faded ? "#FAFAFA" : T.surface, cursor:"pointer", transition:"background 0.1s" }}
      onMouseEnter={e => e.currentTarget.style.background="#F9FAFB"}
      onMouseLeave={e => e.currentTarget.style.background= faded ? "#FAFAFA" : T.surface}
    >
      <div style={dotStyle(item.tag)} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13, color:T.text, lineHeight:1.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.headline}</div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:2 }}>{item.tag} · {item.date}</div>
      </div>
      <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:13, color:T.accent, flexShrink:0 }}>→</span>
    </div>
  );

  return (
    <div style={{ background:T.surface, borderTop:`1px solid ${T.border}` }}>

      {/* Header */}
      <div style={{ padding:"9px 22px", display:"flex", alignItems:"center", borderBottom:"2px solid #111" }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:11, color:T.text, letterSpacing:"0.22em", textTransform:"uppercase" }}>From the Desk</span>
        <span style={{ flex:1 }} />
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted }}>{EDITORIALS.length} pieces</span>
      </div>

      {/* Split */}
      <div style={{ display:"flex" }}>

        {/* Left — hero */}
        {lead && (
          <div onClick={() => open(lead)}
            style={{ width:"42%", flexShrink:0, background:"#F8FAFF", borderRight:`1px solid ${T.border}`, borderLeft:`4px solid ${T.accent}`, padding:"20px 18px 18px", cursor:"pointer", display:"flex", flexDirection:"column", justifyContent:"space-between", transition:"background 0.12s" }}
            onMouseEnter={e => e.currentTarget.style.background="#EEF2FF"}
            onMouseLeave={e => e.currentTarget.style.background="#F8FAFF"}
          >
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                <span style={tagStyle(lead.tag)}>{lead.tag}</span>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:"#9CA3AF", letterSpacing:"0.12em", textTransform:"uppercase" }}>LATEST</span>
              </div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:17, color:T.text, lineHeight:1.2, margin:"10px 0 8px" }}>{lead.headline}</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.textMid, lineHeight:1.55, overflow:"hidden", maxHeight:54 }}>{lead.dek}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:14 }}>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#9CA3AF" }}>{lead.date} · {lead.readTime}</span>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11, color:T.accent, letterSpacing:"0.06em", textTransform:"uppercase" }}>Read →</span>
            </div>
          </div>
        )}

        {/* Right — list */}
        <div style={{ flex:1, minWidth:0 }}>
          {visible.map((item, i) => <Row key={i} item={item} />)}

          {/* Expanded rows */}
          <div style={{ overflow:"hidden", maxHeight: expanded ? hidden.length * 60 : 0, transition:"max-height 0.35s ease" }}>
            {hidden.map((item, i) => <Row key={i} item={item} faded />)}
          </div>

          {/* Footer */}
          {hidden.length > 0 && (
            <div onClick={() => setExpanded(e => !e)}
              style={{ padding:"9px 16px", borderTop:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8, cursor:"pointer", transition:"background 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.background="#F9FAFB"}
              onMouseLeave={e => e.currentTarget.style.background=T.surface}
            >
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted }}>
                {expanded ? `Showing all ${EDITORIALS.length}` : `Showing ${visible.length + 1} of ${EDITORIALS.length}`}
              </span>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:10, letterSpacing:"0.06em", textTransform:"uppercase", color:T.accent }}>
                {expanded ? "Collapse ↑" : "View All ↓"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── HEADER SNAPSHOT CARDS ──────────────────────────────────── */

function getConsent() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}
function setConsent(val) {
  try { localStorage.setItem(CONSENT_KEY, val); } catch {}
}

function loadGA4() {
  if (typeof window === "undefined") return;
  if (window.__ga4Loaded) return;
  window.__ga4Loaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=G-K6C9EVRFH4";
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", "G-K6C9EVRFH4", { anonymize_ip: true });
}

/* ── COOKIE BANNER ───────────────────────────────────────── */
function CookieBanner({ onConsent }) {
  const [visible, setVisible] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  React.useEffect(() => {
    if (!getConsent()) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    setConsent("accepted");
    loadGA4();
    setVisible(false);
    onConsent("accepted");
  };
  const decline = () => {
    setConsent("declined");
    setVisible(false);
    onConsent("declined");
  };

  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:8000,
      background:"#0D0D0D", borderTop:`3px solid ${T.accent}`,
      boxShadow:"0 -4px 24px rgba(0,0,0,0.35)",
      fontFamily:"'DM Sans',sans-serif",
      animation:"slideUp 0.3s ease",
    }}>
      <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{ maxWidth:1160, margin:"0 auto", padding:"18px 32px" }}>

        {/* Main row */}
        <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
          {/* Icon + text */}
          <div style={{ flex:1, minWidth:260 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <span style={{ fontSize:18 }}>🍪</span>
              <span style={{
                fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
                fontSize:13, letterSpacing:"0.12em", textTransform:"uppercase",
                color:"#fff",
              }}>Cookie Preferences</span>
            </div>
            <p style={{ fontSize:12, color:"#9CA3AF", lineHeight:1.65, margin:0 }}>
              Boxoffy uses Google Analytics to understand how visitors use the site.
              No personal data is sold or shared with advertisers.{" "}
              <button
                onClick={() => setShowDetails(d => !d)}
                style={{ background:"none", border:"none", color:T.accent, fontSize:12,
                         cursor:"pointer", padding:0, textDecoration:"underline" }}
              >{showDetails ? "Hide details" : "Learn more"}</button>
            </p>
          </div>

          {/* Buttons */}
          <div style={{ display:"flex", gap:10, flexShrink:0 }}>
            <button onClick={decline} style={{
              padding:"9px 22px", fontSize:12, fontWeight:600,
              fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.08em",
              textTransform:"uppercase", border:"1px solid #374151",
              background:"transparent", color:"#9CA3AF", cursor:"pointer",
              borderRadius:2, transition:"all 0.15s",
            }}
              onMouseEnter={e => { e.target.style.borderColor="#6B7280"; e.target.style.color="#fff"; }}
              onMouseLeave={e => { e.target.style.borderColor="#374151"; e.target.style.color="#9CA3AF"; }}
            >Decline</button>
            <button onClick={accept} style={{
              padding:"9px 28px", fontSize:12, fontWeight:700,
              fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.08em",
              textTransform:"uppercase", border:"none",
              background:T.accent, color:"#fff", cursor:"pointer",
              borderRadius:2, transition:"opacity 0.15s",
            }}
              onMouseEnter={e => e.target.style.opacity="0.88"}
              onMouseLeave={e => e.target.style.opacity="1"}
            >Accept Cookies</button>
          </div>
        </div>

        {/* Expandable details */}
        {showDetails && (
          <div style={{
            marginTop:14, paddingTop:14, borderTop:"1px solid #1F2937",
            display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",
            gap:16,
          }}>
            {[
              { name:"Essential cookies", desc:"Session management and site functionality. Always active. Cannot be disabled.", always:true },
              { name:"Analytics (Google Analytics 4)", desc:"Anonymous usage statistics — pages visited, time on site, device type. No personal identifiers.", always:false },
              { name:"Future cookies", desc:"Boxoffy may add additional cookies as the site grows. You will be asked again if new cookie types are introduced.", always:false, na:true },
            ].map(c => (
              <div key={c.name} style={{ display:"flex", gap:10 }}>
                <div style={{
                  width:18, height:18, borderRadius:9, flexShrink:0, marginTop:2,
                  background: c.na ? "#374151" : c.always ? T.accent : "#15803D",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:10, color:"#fff", fontWeight:700,
                }}>{c.na ? "–" : "✓"}</div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:"#E5E7EB", marginBottom:2 }}>{c.name}</div>
                  <div style={{ fontSize:10, color:"#9CA3AF", lineHeight:1.6 }}>{c.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ gridColumn:"1/-1", fontSize:10, color:"#6B7280", marginTop:4 }}>
              By using Boxoffy.com you acknowledge our{" "}
              <span
                style={{ color:T.accent, cursor:"pointer", textDecoration:"underline" }}
                onClick={() => { decline(); /* navigate to privacy */ window.location.hash="#privacy"; }}
              >Privacy Policy</span>.
              Consent is stored in your browser and can be changed at any time via the Cookie Settings link in the footer.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── PRIVACY POLICY PAGE ─────────────────────────────────── */
function PrivacyPolicyPage({ onBack }) {
  React.useEffect(() => { window.scrollTo({ top:0, behavior:"smooth" }); }, []);
  const P = ({ children }) => (
    <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"#3B3530",
                lineHeight:1.8, marginBottom:14 }}>{children}</p>
  );
  const H = ({ children }) => (
    <h3 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
                 fontSize:14, letterSpacing:"0.14em", textTransform:"uppercase",
                 color:T.text, marginBottom:8, marginTop:24 }}>{children}</h3>
  );

  return (
    <div style={{ maxWidth:720, margin:"0 auto", padding: typeof window !== "undefined" && window.innerWidth < 640 ? "24px 16px 48px" : "40px 32px 80px",
                  fontFamily:"'DM Sans',sans-serif" }}>
      <button onClick={onBack} style={{
        background:"none", border:"none", cursor:"pointer", padding:"0 0 24px",
        fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:12,
        letterSpacing:"0.14em", textTransform:"uppercase", color:T.textMuted,
        display:"flex", alignItems:"center", gap:6,
      }}>← Back to Boxoffy</button>

      <div style={{ borderBottom:`2px solid ${T.text}`, paddingBottom:20, marginBottom:32 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
                      fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase",
                      color:T.accent, marginBottom:10 }}>Legal</div>
        <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
                     fontSize:36, color:T.text, lineHeight:1.1, marginBottom:8 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize:12, color:T.textMuted }}>
          Boxoffy.com · Last updated: March 22, 2026 · Effective date: March 13, 2026
        </p>
      </div>

      <H>Who We Are</H>
      <P>Boxoffy.com ("Boxoffy", "we", "our") is an independent India box office intelligence platform operated as a media and data publication. Our registered contact email is info@boxoffy.com. We are not affiliated with any film production house, studio, distributor or exhibitor.</P>

      <H>What Data We Collect and Why</H>
      <P><strong>Analytics data (with your consent):</strong> If you accept cookies, we use Google Analytics 4 (GA4) to collect anonymous usage data — pages visited, time spent, device type, browser, and approximate geographic region (country/city level only). We have enabled IP anonymisation on all GA4 configurations. This data helps us understand how people use Boxoffy so we can improve it. We do not use this data for advertising or sell it to third parties.</P>
      <P><strong>Contact form data:</strong> If you use the Contact Us form, we collect your name, email address, organisation name (optional), and message. This data is used solely to respond to your enquiry and is not stored beyond what is necessary for that purpose.</P>
      <P><strong>Newsletter subscriptions:</strong> If you subscribe to the Boxoffy newsletter, we store your email address to send you the weekly Boxoffy Brief. You can unsubscribe at any time via the link in any email we send.</P>
      <P><strong>Essential data (no consent required):</strong> Like all websites, Boxoffy's hosting infrastructure (Vercel) logs basic request data (IP address, timestamp, page requested) for security and performance purposes. This is a standard server-side function and is not used for tracking individual users.</P>

      <H>Cookies We Use</H>
      <P><strong>Essential cookies:</strong> Required for the site to function correctly. These include session management cookies set by our hosting provider (Vercel). These cannot be disabled.</P>
      <P><strong>Analytics cookies (consent required):</strong> Google Analytics 4 sets cookies (_ga, _ga_*, _gid) to distinguish users and track sessions anonymously. These are only set after you click "Accept Cookies" on our consent banner. If you click "Decline", no analytics cookies are set and GA4 does not load.</P>
      <P><strong>Other cookies:</strong> Boxoffy may introduce additional cookies in the future — for example, advertising or personalisation cookies if we introduce those features. If we do, we will update this policy and request fresh consent before any new cookie types are set.</P>

      <H>Your Rights Under the DPDP Act 2023</H>
      <P>Under India's Digital Personal Data Protection Act 2023 ("DPDP Act"), you have the right to access the personal data we hold about you, correct inaccurate data, withdraw consent at any time, and request erasure of your data. To exercise any of these rights, email us at info@boxoffy.com with the subject line "Data Rights Request".</P>
      <P><strong>Withdrawing cookie consent:</strong> You can withdraw your analytics consent at any time by clicking "Cookie Settings" in the website footer. This will clear stored consent and reload the banner, giving you the option to change your preference.</P>

      <H>Data Storage and Third Parties</H>
      <P>Analytics data is processed by Google LLC under Google's privacy terms. Google Analytics data is stored on Google's servers, which may be located outside India. Google acts as a data processor on our behalf. You can review Google's privacy policy at policies.google.com/privacy. Newsletter data is processed by Resend Inc. under their data processing terms. No other third parties receive your personal data from Boxoffy.</P>

      <H>Data Retention</H>
      <P>Google Analytics data is retained for 14 months (Google's default). Contact form enquiries are retained for up to 12 months. Newsletter subscriber data is retained until you unsubscribe. Server access logs are retained for up to 30 days.</P>

      <H>Children's Privacy</H>
      <P>Boxoffy is a general audience entertainment data platform. We do not knowingly collect personal data from children under the age of 18. In accordance with the DPDP Act 2023, we do not target, track or display behavioural advertising to minors.</P>

      <H>Changes to This Policy</H>
      <P>We may update this Privacy Policy from time to time. The "Last updated" date at the top of this page will reflect any changes. Continued use of Boxoffy.com after an update constitutes acceptance of the revised policy.</P>

      <H>Contact Us</H>
      <P>For privacy-related enquiries, data rights requests, or to report a concern, contact us at{" "}
        <a href="mailto:info@boxoffy.com" style={{ color:T.accent, textDecoration:"none", fontWeight:600 }}>info@boxoffy.com</a>.
        We aim to respond within 5 business days.
      </P>

      <div style={{ marginTop:36, padding:"16px 20px", background:"#F9FAFB",
                    borderLeft:`3px solid ${T.accent}`, fontSize:12, color:T.textMuted,
                    lineHeight:1.7 }}>
        This Privacy Policy is governed by the laws of India. Any disputes arising from this policy shall be subject to the jurisdiction of the courts of India. This policy is intended to comply with the Digital Personal Data Protection Act 2023 (No. 22 of 2023) and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules 2021.
      </div>
    </div>
  );
}


/* ── NEWSLETTER POPUP ─────────────────────────────────────────────────────────
   Posts to /api/subscribe (Vercel serverless) which forwards to Resend.
   API key lives in Vercel env vars — never exposed to the browser.
   Audience ID: 6fc2744e-1719-4693-91a9-770d9e0eea36
   ─────────────────────────────────────────────────────────────────────────── */

function SubscribePopup({ onClose }) {
  const [name,   setName]   = useState("");
  const [email,  setEmail]  = useState("");
  const [lang,   setLang]   = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error

  const languages = ["Hindi / Bollywood", "South Indian", "Hollywood", "All Languages"];

  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSubmit() {
    if (!name || !name.trim()) { setStatus("error"); return; }
    if (!email || !email.includes("@")) { setStatus("error"); return; }
    setStatus("submitting");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: name.trim(),
          language: lang || "All Languages",
        }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(10,8,6,0.72)",
      backdropFilter:"blur(4px)", zIndex:9000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#FFFFFF", maxWidth:420, width:"100%",
        borderTop:`4px solid ${T.accent}`, boxShadow:"0 24px 64px rgba(0,0,0,0.3)",
        padding:"36px 32px 28px", position:"relative",
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position:"absolute", top:12, right:14, background:"none", border:"none",
          fontSize:18, color:T.textMuted, cursor:"pointer", lineHeight:1,
        }}>✕</button>

        {/* Badge */}
        <div style={{
          display:"inline-block", fontFamily:"'Barlow Condensed',sans-serif",
          fontSize:9, fontWeight:800, letterSpacing:"0.2em", textTransform:"uppercase",
          color:T.accent, background:"rgba(200,32,26,0.08)", border:`1px solid ${T.accent}`,
          padding:"3px 10px", marginBottom:14,
        }}>Boxoffy Weekly</div>

        <div style={{
          fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
          fontSize:26, color:T.text, lineHeight:1.1, marginBottom:10,
        }}>
          India's sharpest box office<br/>intel. Every week. Free.
        </div>

        <p style={{
          fontFamily:"'DM Sans',sans-serif", fontSize:13, color:T.textMid,
          lineHeight:1.65, marginBottom:22,
        }}>
          Opening day predictions · Advance booking breakdowns · OTT numbers ·
          Verdict calls before anyone else. No noise. No filler.
        </p>

        {status === "success" ? (
          <div style={{
            background:"#F0FFF4", border:"1px solid #6EE7B7", padding:"20px 24px",
            fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"#065F46",
            textAlign:"center", fontWeight:600, lineHeight:1.6,
          }}>
            🎬 You're on the list.<br/>
            <span style={{ fontSize:12, fontWeight:400 }}>First digest lands Monday. No spam, no PR fluff — just the numbers that matter.</span>
          </div>
        ) : (
          <>
            {/* Name */}
            <input
              type="text"
              placeholder="First name"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                width:"100%", padding:"11px 14px", border:`1px solid ${T.border}`,
                fontFamily:"'DM Sans',sans-serif", fontSize:13, outline:"none",
                background:T.bg, color:T.text, marginBottom:8, boxSizing:"border-box",
              }}
            />
            {/* Email + Submit */}
            <div style={{ display:"flex", gap:0, marginBottom:8 }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setStatus("idle"); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={{
                  flex:1, padding:"11px 14px", border:`1px solid ${status==="error"?"#EF4444":T.border}`,
                  borderRight:"none", fontFamily:"'DM Sans',sans-serif", fontSize:14,
                  outline:"none", background:T.bg, color:T.text,
                }}
              />
              <button onClick={handleSubmit} disabled={status==="submitting"} style={{
                background: status==="submitting" ? T.textMuted : T.accent,
                color:"#fff", border:"none",
                padding:"11px 20px", fontFamily:"'Barlow Condensed',sans-serif",
                fontWeight:800, fontSize:13, letterSpacing:"0.1em", textTransform:"uppercase",
                cursor: status==="submitting" ? "not-allowed" : "pointer", whiteSpace:"nowrap",
              }}>{status==="submitting" ? "..." : "Subscribe"}</button>
            </div>
            {/* Language preference */}
            <select
              value={lang}
              onChange={e => setLang(e.target.value)}
              style={{
                width:"100%", padding:"10px 14px", border:`1px solid ${T.border}`,
                fontFamily:"'DM Sans',sans-serif", fontSize:12, color: lang ? T.text : T.textMuted,
                background:T.bg, outline:"none", marginBottom:8, boxSizing:"border-box",
              }}
            >
              <option value="">I follow... (select cinema preference)</option>
              {languages.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            {status === "error" && (
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#EF4444", marginBottom:4 }}>
                Please enter your first name and a valid email address.
              </div>
            )}
          </>
        )}

        <div style={{
          fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted,
          marginTop:14, letterSpacing:"0.04em",
        }}>
          No spam. Unsubscribe any time. Boxoffy.com
        </div>
      </div>
    </div>
  );
}

/* ── CONTACT SECTION ────────────────────────────────────────── */
function ContactSection() {
  const [form, setForm]     = useState({ name:"", email:"", phone:"", message:"", honeypot:"" });
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [submitTime]        = useState(Date.now()); // bot check: real humans take >3s to fill

  const handleChange = (field, val) => setForm(f => ({ ...f, [field]:val }));

  const handleSubmit = async () => {
    // ── Bot protection checks ──────────────────────────────────────────────
    // 1. Honeypot — bots fill hidden fields, humans never see them
    if (form.honeypot) return;
    // 2. Time check — bots submit instantly, real humans take at least 3 seconds
    if (Date.now() - submitTime < 3000) return;
    // ── Validation ────────────────────────────────────────────────────────
    if (!form.name || !form.email || !form.message) { setStatus("error"); return; }
    if (!form.email.includes("@")) { setStatus("error"); return; }

    setStatus("submitting");

    try {
      // Resend API — via Vercel serverless function /api/contact
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:    form.name,
          email:   form.email,
          phone:   form.phone || "Not provided",
          message: form.message,
        }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        throw new Error("EmailJS failed");
      }
    } catch {
      // Fallback — pre-fill mailto so nothing is lost
      const subject = encodeURIComponent(`Boxoffy enquiry from ${form.name}`);
      const body    = encodeURIComponent(
        `Name: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone || "N/A"}\n\n${form.message}`
      );
      window.location.href = `mailto:info@boxoffy.com?subject=${subject}&body=${body}`;
      setStatus("success");
    }
  };

  const inputStyle = {
    width:"100%", padding:"11px 14px", border:`1px solid ${T.border}`,
    fontFamily:"'DM Sans',sans-serif", fontSize:13, color:T.text,
    background:"#FFFFFF", outline:"none", marginBottom:12, boxSizing:"border-box",
  };
  const labelStyle = {
    fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:700,
    letterSpacing:"0.12em", textTransform:"uppercase", color:T.textMuted,
    display:"block", marginBottom:4,
  };

  return (
    <div style={{ background:T.bg, borderTop:`2px solid ${T.border}` }}>
      <div style={{ maxWidth:1160, margin:"0 auto", padding: typeof window !== "undefined" && window.innerWidth < 640 ? "32px 16px 40px" : "48px 32px 56px" }}>

        {/* Heading */}
        <div style={{ maxWidth:640, marginBottom:36 }}>
          <div style={{
            fontFamily:"'Barlow Condensed',sans-serif", fontSize:10, fontWeight:700,
            letterSpacing:"0.22em", textTransform:"uppercase", color:T.accent, marginBottom:10,
          }}>Get In Touch</div>
          <div style={{
            fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
            fontSize:"clamp(24px,3vw,36px)", color:T.text, lineHeight:1.1, marginBottom:12,
          }}>
            Numbers to share? Question to ask?<br/>We're listening.
          </div>
          <p style={{
            fontFamily:"'DM Sans',sans-serif", fontSize:14, color:T.textMid, lineHeight:1.7,
          }}>
            Studios, distributors, PR teams, press, or just a film nerd with a correction — 
            drop us a note. You can also reach us directly at{' '}
            <a href="mailto:info@boxoffy.com" style={{ color:"#C8201A", fontWeight:600, textDecoration:"none" }}>info@boxoffy.com</a>.
          </p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns: typeof window !== "undefined" && window.innerWidth < 640 ? "1fr" : "minmax(0,1fr) minmax(0,1fr)", gap: typeof window !== "undefined" && window.innerWidth < 640 ? 24 : 48 }}>

          {/* Left — form */}
          <div>
            {status === "success" ? (
              <div style={{
                background:"#F0FFF4", border:"1px solid #6EE7B7",
                padding:"32px 24px", textAlign:"center",
              }}>
                <div style={{ fontSize:32, marginBottom:10 }}>✓</div>
                <div style={{
                  fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
                  fontSize:22, color:"#065F46", marginBottom:8,
                }}>Message received.</div>
                <div style={{
                  fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#047857",
                }}>We'll get back to you within 24–48 hours.</div>
              </div>
            ) : (
              <>
                {status === "error" && (
                  <div style={{
                    background:"#FEF2F2", border:"1px solid #FECACA",
                    padding:"10px 14px", marginBottom:16,
                    fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#B91C1C",
                  }}>
                    Please fill in your name, a valid email, and a message.
                  </div>
                )}

                {/* Honeypot — hidden from real users, bots fill this */}
                <input
                  type="text" name="website" tabIndex={-1} autoComplete="off"
                  value={form.honeypot} onChange={e => handleChange("honeypot", e.target.value)}
                  style={{ position:"absolute", left:"-9999px", opacity:0, height:0, width:0 }}
                  aria-hidden="true"
                />

                {/* Name + Phone side by side */}
                <div style={{ display:"grid", gridTemplateColumns: typeof window !== "undefined" && window.innerWidth < 640 ? "1fr" : "1fr 1fr", gap:12 }}>
                  <div>
                    <label style={labelStyle}>Name *</label>
                    <input
                      type="text" placeholder="Your name"
                      value={form.name} onChange={e => handleChange("name", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input
                      type="tel" placeholder="+91 98765 43210"
                      value={form.phone} onChange={e => handleChange("phone", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Email */}
                <label style={labelStyle}>Email *</label>
                <input
                  type="email" placeholder="your@email.com"
                  value={form.email} onChange={e => handleChange("email", e.target.value)}
                  style={inputStyle}
                />

                {/* Message */}
                <label style={labelStyle}>Message *</label>
                <textarea
                  placeholder="What's on your mind?"
                  value={form.message} onChange={e => handleChange("message", e.target.value)}
                  rows={5}
                  style={{ ...inputStyle, resize:"vertical", lineHeight:1.6, marginBottom:16 }}
                />

                <button onClick={handleSubmit} disabled={status === "submitting"} style={{
                  background: status === "submitting" ? T.textMuted : T.accent,
                  color:"#fff", border:"none",
                  padding:"13px 28px", fontFamily:"'Barlow Condensed',sans-serif",
                  fontWeight:800, fontSize:14, letterSpacing:"0.1em", textTransform:"uppercase",
                  cursor: status === "submitting" ? "not-allowed" : "pointer", width:"100%",
                  opacity: status === "submitting" ? 0.7 : 1,
                }}>
                  {status === "submitting" ? "Sending..." : "Send Message →"}
                </button>

                <div style={{
                  fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted,
                  marginTop:10, letterSpacing:"0.03em",
                }}>
                  We respond within 24–48 hours. No spam, ever.
                </div>
              </>
            )}
          </div>

          {/* Right — info cards */}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {[
              {
                icon:"📊",
                title:"Studios & Distributors",
                body:"Share verified opening day, weekly, or lifetime figures. We publish with full attribution and will not cite unverified numbers.",
              },
              {
                icon:"✏️",
                title:"Data Corrections",
                body:"Spotted an error in our charts or articles? Send us the correct figure with a source link and we'll update within 24 hours.",
              },
              {
                icon:"🎬",
                title:"Press & Media",
                body:"Accredited journalists and content creators — reach out for press credentials, data partnerships or attribution requests.",
              },
              {
                icon:"🤝",
                title:"Partnerships",
                body:"Interested in data licensing, co-branded content or integration with Boxoffy intelligence? We'd love to talk.",
              },
            ].map((card, i) => (
              <div key={i} style={{
                display:"flex", gap:16, padding:"16px 18px",
                background:"#FFFFFF", border:`1px solid ${T.border}`,
                borderLeft:`3px solid ${T.accent}`,
              }}>
                <span style={{ fontSize:20, flexShrink:0, marginTop:2 }}>{card.icon}</span>
                <div>
                  <div style={{
                    fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
                    fontSize:15, color:T.text, marginBottom:4,
                  }}>{card.title}</div>
                  <div style={{
                    fontFamily:"'DM Sans',sans-serif", fontSize:12,
                    color:T.textMid, lineHeight:1.6,
                  }}>{card.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


function StudiosBanner() {
  const studios = [
    { name:"YRF", sub:"Spy Universe" },
    { name:"Dharma", sub:"₹2,000 Cr" },
    { name:"Maddock", sub:"HCU · 10/10" },
    { name:"Jio Studios", sub:"Dhurandhar" },
    { name:"Mythri", sub:"Pushpa ₹1,800 Cr" },
    { name:"Hombale", sub:"KGF + Salaar" },
    { name:"Excel", sub:"₹2,400 Cr" },
    { name:"B62", sub:"Aditya Dhar" },
  ];
  return (
    <div style={{ background:"#0D0D0D", borderTop:`4px solid ${T.accent}`, padding:"36px 32px 40px" }}>
      <div style={{ maxWidth:1160, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:10, fontWeight:700, color:T.accent, letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:6 }}>Boxoffy · Production Intelligence</div>
            <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:"clamp(28px, 4vw, 48px)", color:"#FFFFFF", lineHeight:0.95, letterSpacing:"-0.02em" }}>
              30 Indian Studios.<br/><span style={{ color:T.accent }}>One place.</span>
            </div>
            <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:14, color:"#9CA3AF", marginTop:10, maxWidth:480, lineHeight:1.6 }}>
              Valuations, ownership, franchise IP, 2026 slate and Boxoffy intelligence on every major Hindi, Telugu, Tamil, Malayalam and Kannada production house.
            </div>
          </div>
          <a href="/production-houses.html" style={{ display:"inline-flex", alignItems:"center", gap:10, background:T.accent, color:"#fff", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:16, letterSpacing:"0.1em", textTransform:"uppercase", textDecoration:"none", padding:"14px 28px", borderRadius:2, flexShrink:0 }}>
            Explore All Studios →
          </a>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:24 }}>
          {studios.map(s => (
            <div key={s.name} style={{ background:"#1A1A1A", border:"1px solid #2A2A2A", borderRadius:2, padding:"8px 14px", display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:14, color:"#F3F4F6", letterSpacing:"0.04em" }}>{s.name}</span>
              <span style={{ fontFamily:"'IBM Plex Mono', monospace", fontSize:9, color:"#6B7280", letterSpacing:"0.08em" }}>{s.sub}</span>
            </div>
          ))}
          <div style={{ background:"transparent", border:"1px solid #2A2A2A", borderRadius:2, padding:"8px 14px", display:"flex", alignItems:"center" }}>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:"#6B7280", fontStyle:"italic" }}>+ 22 more studios</span>
          </div>
        </div>
        <div style={{ display:"flex", borderTop:"1px solid #1F1F1F", paddingTop:16, flexWrap:"wrap", gap:24 }}>
          {[["3 CONFIRMED","Dharma · Excel · Bhansali — transaction-verified"],["₹2,400 Cr","Excel — highest indie valuation in Indian cinema"],["5 languages","Hindi · Telugu · Tamil · Malayalam · Kannada"]].map(([val,lbl]) => (
            <div key={val}>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:900, fontSize:18, color:"#E8C547" }}>{val}</div>
              <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:"#4B5563", marginTop:2 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState("Box Office");
  const [forceAllTime, setForceAllTime] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [cookieConsent, setCookieConsent] = useState(getConsent);
  useEffect(() => {
    if (getConsent() === "accepted") loadGA4();
  }, []);

  // ── Google Sheets live data — fetch on mount if SHEETS_ID is set ──
  useSheetData();
  useEffect(() => {
    if (!SHEETS_ID) return;
    loadFromSheets().then(out => {
      if (!out) return;
      if (out.rawFilms) liveData = mergeSheetsIntoData(DATA, out.rawFilms);
      if (out.weeklyCommentary?.length) liveWeekly = out.weeklyCommentary;
      triggerSheetRefresh();
      console.log("[Boxoffy] Live data loaded from Google Sheets ✓");
    }).catch(e => console.warn("[Boxoffy] Sheets fetch failed, using bundled data:", e));
  }, []);

  // Dynamic document title per section — helps Google index section-level content
  useEffect(() => {
    const titles = {
      "Box Office":  "India Box Office 2026 — Live Rankings & Verdicts | Boxoffy",
      "Weekly":      "Weekly Box Office Report India 2026 | Boxoffy",
      "US Box Office":"Indian Films US Box Office 2026 — Chart & Records | Boxoffy",
      "Historical":  "Bollywood Box Office History 2010–2026 | Boxoffy",
      "OTT":         "OTT Releases India 2026 — Netflix, Prime, JioHotstar | Boxoffy",
    };
    document.title = titles[activeSection] || "Boxoffy — India Box Office Intelligence";
  }, [activeSection]);

  const handleConsent = (val) => setCookieConsent(val);

  const resetCookies = () => {
    try { localStorage.removeItem(CONSENT_KEY); } catch {}
    setCookieConsent(null);
    window.__ga4Loaded = false;
  };

  // Show subscribe popup after 18 seconds, once per session
  useEffect(() => {
    const seen = sessionStorage.getItem("boxoffy_sub_seen");
    if (seen) return;
    const timer = setTimeout(() => {
      setShowSubscribe(true);
      sessionStorage.setItem("boxoffy_sub_seen", "1");
    }, 18000);
    return () => clearTimeout(timer);
  }, []);

  const newsCategory =
    activeSection === "OTT" ? "OTT" :
    activeSection === "TV" ? "TV" : null;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"'DM Sans', sans-serif" }}>

      {/* Cookie consent banner — shows if no decision yet */}
      {!cookieConsent && <CookieBanner onConsent={handleConsent} />}

      {/* Subscribe popup */}
      {showSubscribe && <SubscribePopup onClose={() => setShowSubscribe(false)} />}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes boPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        * { box-sizing: border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:${T.bg}; }
        ::-webkit-scrollbar-thumb { background:${T.borderDark}; border-radius:3px; }
        button { cursor:pointer; }
        button:hover { filter: brightness(0.92); }
      `}</style>

      <NavBar activeSection={activeSection} setActiveSection={setActiveSection} setForceAllTime={setForceAllTime} />

      {/* Privacy Policy overlay — replaces main content when active */}
      {showPrivacy ? (
        <PrivacyPolicyPage onBack={() => setShowPrivacy(false)} />
      ) : (
      <div id="main-content">

      {/* Hero masthead */}
      <div style={{
        background:"#FFFFFF",
        padding:"20px 32px 18px",
        borderBottom:`1px solid ${T.border}`,
        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16,
      }}>
        <div>
          <div style={{ display:"flex", alignItems:"baseline", gap:0, marginBottom:6 }}>
            <span style={{
              fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800,
              fontSize:"clamp(38px, 5vw, 64px)", color:T.text,
              letterSpacing:"-0.03em", lineHeight:0.9,
            }}>BOXOF</span>
            <span style={{
              fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800,
              fontSize:"clamp(38px, 5vw, 64px)", color:T.accent,
              letterSpacing:"-0.03em", lineHeight:0.9,
            }}>FY</span>
          </div>
          <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, color:T.textMuted, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:500 }}>
            Box Office Intelligence
          </p>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:10 }}>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:T.textMid, borderLeft:`2px solid ${T.accent}`, paddingLeft:8, lineHeight:1.5 }}>
              {activeSection === "Box Office" && "Box Office · Verified worldwide data · 2020–2026"}
              {activeSection === "OTT" && "Netflix · Prime Video · JioCinema · Hotstar · SonyLIV"}
              {activeSection === "TV" && "TRP ratings · Reality · Drama serials · Channel intelligence"}
              {activeSection === "Weekly" && "Weekly Box Office Commentary · Boxoffy"}
            </span>
          </div>
        </div>

        {/* ── Snapshot Cards ── */}
        <HeaderSnapshotCards activeSection={activeSection} />


      </div>


      {/* Content */}
      <div style={{ maxWidth:1160, margin:"0 auto", background:T.surface, boxShadow:"0 0 0 1px #E2E5EA", animation:"fadeIn 0.3s ease both" }}>
        {activeSection === "Box Office" && <BoxOfficeSection onNavigate={setActiveSection} forceAllTime={forceAllTime} onClearForceAllTime={() => setForceAllTime(false)} />}
        {activeSection === "Weekly" && <WeeklyCommentarySection />}
        {newsCategory && newsCategory === "OTT" && <OTTRankingsSection />}
        {newsCategory && <NewsSection category={newsCategory} />}
      </div>

      {/* Studios Discovery Banner */}
      <StudiosBanner />

      {/* Contact Section */}
      <ContactSection />

      {/* Footer */}
      <div style={{ background:"#F9FAFB", color:T.textMuted, fontFamily:"'DM Sans', sans-serif", fontSize:11, padding:"24px 32px", borderTop:`2px solid ${T.accent}` }}>
        <div style={{ maxWidth:1160, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:0, marginBottom:10 }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:20, color:T.text, letterSpacing:"-0.02em" }}>BOXOF</span>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:20, color:T.accent, letterSpacing:"-0.02em" }}>FY</span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted, marginLeft:10, letterSpacing:"0.18em", textTransform:"uppercase" }}>Box Office Intelligence</span>
          </div>
          <div style={{ display:"flex", gap:24, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
            {["Box Office","OTT","TV","Weekly"].map(s => {
              const extLink = s === "OTT" ? "/ott-releases.html" : s === "TV" ? "/tv-ratings.html" : null;
              if (extLink) return (
                <a key={s} href={extLink}
                  onMouseEnter={e => e.currentTarget.style.color=T.accent}
                  onMouseLeave={e => e.currentTarget.style.color=T.textMuted}
                  style={{ color:T.textMuted, fontSize:11, fontWeight:600, letterSpacing:"0.06em", cursor:"pointer", transition:"color 0.15s", textDecoration:"none" }}
                >{s}</a>
              );
              return (
                <span key={s}
                  onClick={() => { setActiveSection(s); window.scrollTo({top:0,behavior:"smooth"}); }}
                  onMouseEnter={e => e.target.style.color=T.accent}
                  onMouseLeave={e => e.target.style.color=T.textMuted}
                  style={{ color:T.textMuted, fontSize:11, fontWeight:600, letterSpacing:"0.06em", cursor:"pointer", transition:"color 0.15s" }}
                >{s}</span>
              );
            })}
            <span style={{ color:T.border }}>·</span>
            <a
              href="/production-houses.html"
              onMouseEnter={e => e.target.style.color=T.accent}
              onMouseLeave={e => e.target.style.color=T.textMuted}
              style={{ color:T.textMuted, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textDecoration:"none", transition:"color 0.15s" }}
            >Studios</a>
            <span style={{ color:T.border }}>·</span>
            <a
              href="/about.html"
              onMouseEnter={e => e.target.style.color=T.accent}
              onMouseLeave={e => e.target.style.color=T.textMuted}
              style={{ color:T.textMuted, fontSize:11, fontWeight:600, letterSpacing:"0.06em", textDecoration:"none", transition:"color 0.15s" }}
            >About</a>
            <span style={{ color:T.border }}>·</span>
            <span
              onClick={() => setShowSubscribe(true)}
              onMouseEnter={e => e.target.style.color=T.accent}
              onMouseLeave={e => e.target.style.color=T.textMuted}
              style={{ color:T.textMuted, fontSize:11, fontWeight:600, letterSpacing:"0.06em", cursor:"pointer", transition:"color 0.15s" }}
            >📧 Subscribe</span>
            <span style={{ color:T.border }}>·</span>
            <a
              href="mailto:info@boxoffy.com"
              onMouseEnter={e => e.target.style.color=T.accent}
              onMouseLeave={e => e.target.style.color=T.textMuted}
              style={{ color:T.textMuted, fontSize:11, fontWeight:600, letterSpacing:"0.04em", textDecoration:"none", transition:"color 0.15s" }}
            >info@boxoffy.com</a>
            <span style={{ color:T.border }}>·</span>
            <span
              onClick={() => { setShowPrivacy(true); window.scrollTo({top:0,behavior:"smooth"}); }}
              onMouseEnter={e => e.target.style.color=T.accent}
              onMouseLeave={e => e.target.style.color=T.textMuted}
              style={{ color:T.textMuted, fontSize:11, fontWeight:600, letterSpacing:"0.06em", cursor:"pointer", transition:"color 0.15s" }}
            >Privacy Policy</span>
            <span style={{ color:T.border }}>·</span>
            <span
              onClick={resetCookies}
              onMouseEnter={e => e.target.style.color=T.accent}
              onMouseLeave={e => e.target.style.color=T.textMuted}
              style={{ color:T.textMuted, fontSize:11, fontWeight:600, letterSpacing:"0.06em", cursor:"pointer", transition:"color 0.15s" }}
              title="Change your cookie preferences"
            >🍪 Cookie Settings</span>
          </div>
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:12, display:"flex", flexDirection:"column", gap:10 }}>

            {/* Legal Disclaimer */}
            <div style={{
              background:"#F3F4F6", borderLeft:`3px solid ${T.border}`,
              padding:"10px 14px", fontSize:10, color:T.textMuted,
              lineHeight:1.75, fontFamily:"'DM Sans',sans-serif",
            }}>
              <span style={{ fontWeight:700, color:T.text, display:"block", marginBottom:4, fontSize:10, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                Data Disclaimer &amp; Legal Notice
              </span>
              Boxoffy.com is an independent box office intelligence platform that aggregates, analyses and presents publicly available entertainment industry data sourced from third-party trade publications, ticketing platforms and industry analysts including but not limited to Box Office India, Sacnilk, Venky Box Office and Koimoi. All box office figures, advance booking data, verdict calls, predictions and editorial analysis published on this website represent estimates based on available information at the time of publication and are not official figures unless expressly stated otherwise. Boxoffy.com does not represent, warrant or guarantee the absolute accuracy, completeness or timeliness of any data presented herein.{" "}
              <strong style={{ color:T.text }}>Boxoffy.com is not affiliated with, endorsed by, or acting on behalf of any film production house, studio, distributor or exhibitor.</strong>{" "}
              Opinions, predictions and editorial commentary published on this platform constitute the views of the Boxoffy editorial team and are protected expression under Article 19(1)(a) of the Constitution of India. Nothing published on Boxoffy.com is intended to defame, disparage or make false factual claims against any individual, company or film production. In the event any content is alleged to be inaccurate, please contact{" "}
              <a href="mailto:info@boxoffy.com" style={{ color:T.accent, textDecoration:"none" }}>info@boxoffy.com</a>{" "}
              and we will review and correct verified errors promptly. Boxoffy.com operates as a news aggregator and commentary platform and claims the protections available to intermediaries and media publishers under Section 79 of the Information Technology Act, 2000, the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the fair dealing provisions of Section 52 of the Copyright Act, 1957. All rights reserved. Unauthorised reproduction of original editorial content is prohibited.
            </div>

            {/* Copyright strip */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, color:T.textMuted, lineHeight:1.8 }}>
              <span style={{ fontSize:11 }}>© 2026 Boxoffy.com · Box Office Intelligence · Box office data from industry tracking sources · Current as of Mar 13, 2026 · All figures in ₹ Crores</span>
              <a
                href="mailto:info@boxoffy.com"
                onMouseEnter={e => e.target.style.color=T.accent}
                onMouseLeave={e => e.target.style.color=T.textMuted}
                style={{ color:T.textMuted, fontSize:11, fontWeight:500, textDecoration:"none", letterSpacing:"0.04em", flexShrink:0, transition:"color 0.15s" }}
              >info@boxoffy.com</a>
            </div>
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
