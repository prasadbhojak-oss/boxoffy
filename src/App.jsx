import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════
   BOXOFFY — India Box Office Intelligence
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
const SHEETS_ID = "";   // ← PASTE YOUR SHEET ID HERE

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
        scoreboard.push({ film:r[`film${i}`], week:r[`film${i}_week`]||"",
          wkCollection:r[`film${i}_collection`]||"", total:r[`film${i}_total`]||"",
          verdict:r[`film${i}_verdict`]||"", color:r[`film${i}_color`]||"#6B7280" });
      }
      return { weekNum:r.weekNum||"", dateRange:r.dateRange||"",
        headline:r.headline||"", subline:r.subline||"",
        status:r.status||"archive", scoreboard,
        boxoffyTake:r.boxoffyTake||"", interval_take:r.intervalTake||"",
        sources:[] };
    });
  }

  const loaded = Object.keys(out);
  if (!loaded.length) return null;
  console.log(`[Boxoffy Sheets] ✓ ${loaded.join(", ")}`);
  return out;
}

// ── Preview stubs (Google Sheets disabled in preview)
const liveData = null;
const liveWeekly = null;
const liveNotes = null;
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
const YEAR_ACCENT = { 2020:"#6B7280", 2021:"#2563EB", 2022:"#D97706", 2023:"#DC2626", 2024:"#7C3AED", 2025:"#059669", 2026:"#E8261A" };
const YEARS = [2020,2021,2022,2023,2024,2025,2026];
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

/* ── BOX OFFICE DATA ─────────────────────────────────────── */
const DATA = {
  2020: [
    { title:"Tanhaji: The Unsung Warrior", language:"Hindi", director:"Om Raut", releaseDate:"Jan 2020", totalCollection:"369 Cr", totalNum:369, indiaNet:"279 Cr", overseas:"90 Cr", weeksInTop10:8, status:"OTT", budget:"150 Cr", verdict:"Blockbuster" },
    { title:"Darbar", language:"Tamil", director:"A.R. Murugadoss", releaseDate:"Jan 2020", totalCollection:"250 Cr", totalNum:250, indiaNet:"165 Cr", overseas:"85 Cr", weeksInTop10:5, status:"OTT", budget:"180 Cr", verdict:"Average" },
    { title:"Baaghi 3", language:"Hindi", director:"Ahmed Khan", releaseDate:"Mar 2020", totalCollection:"137 Cr", totalNum:137, indiaNet:"112 Cr", overseas:"25 Cr", weeksInTop10:2, status:"OTT", budget:"97 Cr", verdict:"Hit" },
    { title:"Street Dancer 3D", language:"Hindi", director:"Remo D'Souza", releaseDate:"Jan 2020", totalCollection:"76 Cr", totalNum:76, indiaNet:"64 Cr", overseas:"12 Cr", weeksInTop10:3, status:"OTT", budget:"90 Cr", verdict:"Flop" },
    { title:"Malang", language:"Hindi", director:"Mohit Suri", releaseDate:"Feb 2020", totalCollection:"61 Cr", totalNum:61, indiaNet:"52 Cr", overseas:"9 Cr", weeksInTop10:3, status:"OTT", budget:"60 Cr", verdict:"Average" },
    { title:"Shubh Mangal Zyada Saavdhan", language:"Hindi", director:"Hitesh Kewalya", releaseDate:"Feb 2020", totalCollection:"61 Cr", totalNum:61, indiaNet:"55 Cr", overseas:"6 Cr", weeksInTop10:3, status:"OTT", budget:"50 Cr", verdict:"Average" },
    { title:"Thappad", language:"Hindi", director:"Anubhav Sinha", releaseDate:"Feb 2020", totalCollection:"46 Cr", totalNum:46, indiaNet:"40 Cr", overseas:"6 Cr", weeksInTop10:3, status:"OTT", budget:"30 Cr", verdict:"Hit" },
    { title:"Love Aaj Kal", language:"Hindi", director:"Imtiaz Ali", releaseDate:"Feb 2020", totalCollection:"36 Cr", totalNum:36, indiaNet:"30 Cr", overseas:"6 Cr", weeksInTop10:2, status:"OTT", budget:"60 Cr", verdict:"Disaster" },
    { title:"Angrezi Medium", language:"Hindi", director:"Homi Adajania", releaseDate:"Mar 2020", totalCollection:"16 Cr", totalNum:16, indiaNet:"13 Cr", overseas:"3 Cr", weeksInTop10:1, status:"OTT", budget:"50 Cr", verdict:"Flop" },
    { title:"Haathi Mere Saathi", language:"Hindi", director:"Prabhu Solomon", releaseDate:"Mar 2021", totalCollection:"35 Cr", totalNum:35, indiaNet:"28 Cr", overseas:"7 Cr", weeksInTop10:2, status:"OTT", budget:"80 Cr", verdict:"Flop" },
  ],
  2021: [
    { title:"Pushpa: The Rise", language:"Telugu", director:"Sukumar", releaseDate:"Dec 2021", totalCollection:"365 Cr", totalNum:365, indiaNet:"250 Cr", overseas:"115 Cr", weeksInTop10:14, status:"OTT", budget:"200 Cr", verdict:"Blockbuster" },
    { title:"Sooryavanshi", language:"Hindi", director:"Rohit Shetty", releaseDate:"Nov 2021", totalCollection:"294 Cr", totalNum:294, indiaNet:"196 Cr", overseas:"98 Cr", weeksInTop10:8, status:"OTT", budget:"185 Cr", verdict:"Hit" },
    { title:"Spider-Man: No Way Home (Hindi)", language:"Hindi", director:"Jon Watts", releaseDate:"Dec 2021", totalCollection:"230 Cr", totalNum:230, indiaNet:"210 Cr", overseas:"20 Cr", weeksInTop10:10, status:"OTT", budget:"—", verdict:"Blockbuster" },
    { title:"Master", language:"Tamil", director:"Lokesh Kanagaraj", releaseDate:"Jan 2021", totalCollection:"215 Cr", totalNum:215, indiaNet:"140 Cr", overseas:"75 Cr", weeksInTop10:6, status:"OTT", budget:"100 Cr", verdict:"Blockbuster" },
    { title:"Radhe Shyam", language:"Telugu", director:"Radha Krishna Kumar", releaseDate:"Mar 2022", totalCollection:"200 Cr", totalNum:200, indiaNet:"130 Cr", overseas:"70 Cr", weeksInTop10:3, status:"OTT", budget:"300 Cr", verdict:"Disaster" },
    { title:"Annaatthe", language:"Tamil", director:"Siva", releaseDate:"Nov 2021", totalCollection:"185 Cr", totalNum:185, indiaNet:"120 Cr", overseas:"65 Cr", weeksInTop10:5, status:"OTT", budget:"180 Cr", verdict:"Average" },
    { title:"83", language:"Hindi", director:"Kabir Khan", releaseDate:"Dec 2021", totalCollection:"175 Cr", totalNum:175, indiaNet:"100 Cr", overseas:"75 Cr", weeksInTop10:4, status:"OTT", budget:"180 Cr", verdict:"Disaster" },
    { title:"Bell Bottom", language:"Hindi", director:"Ranjit Tewari", releaseDate:"Aug 2021", totalCollection:"55 Cr", totalNum:55, indiaNet:"30 Cr", overseas:"25 Cr", weeksInTop10:3, status:"OTT", budget:"100 Cr", verdict:"Flop" },
    { title:"Shershaah", language:"Hindi", director:"Vishnuvardhan", releaseDate:"Aug 2021", totalCollection:"0 Cr", totalNum:0, indiaNet:"OTT Premiere", overseas:null, weeksInTop10:2, status:"OTT", budget:"60 Cr", verdict:"OTT Hit" },
    { title:"Satyameva Jayate 2", language:"Hindi", director:"Milap Zaveri", releaseDate:"Nov 2021", totalCollection:"32 Cr", totalNum:32, indiaNet:"27 Cr", overseas:"5 Cr", weeksInTop10:2, status:"OTT", budget:"90 Cr", verdict:"Disaster" },
  ],
  2022: [
    { title:"RRR", language:"Telugu", director:"S.S. Rajamouli", releaseDate:"Mar 2022", totalCollection:"1,200 Cr", totalNum:1200, indiaNet:"800 Cr", overseas:"400 Cr", weeksInTop10:20, status:"OTT", budget:"550 Cr", verdict:"All-Time Blockbuster", note:"Oscar nomination · Global phenomenon · Netflix smash",
      ott:{ platform:"Netflix", debutViews:"7.1M (Wk1)", debutHours:"25.5M hrs", lifetimeViews:"43.65M", lifetimeHours:"~130M hrs", globalRank:"#1 Non-English (peak)", countries:22, rightsDeal:"₹325 Cr", ottNote:"Most-watched Indian film on Netflix ever · #1 for 1,095+ days" }},
    { title:"K.G.F: Chapter 2", language:"Kannada", director:"Prashanth Neel", releaseDate:"Apr 2022", totalCollection:"1,200 Cr", totalNum:1200, indiaNet:"850 Cr", overseas:"350 Cr", weeksInTop10:18, status:"OTT", budget:"100 Cr", verdict:"All-Time Blockbuster",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:15, rightsDeal:"₹320 Cr", ottNote:"Prime Video India — platform does not publish weekly view counts" }},
    { title:"Ponniyin Selvan I", language:"Tamil", director:"Mani Ratnam", releaseDate:"Sep 2022", totalCollection:"500 Cr", totalNum:500, indiaNet:"320 Cr", overseas:"180 Cr", weeksInTop10:10, status:"OTT", budget:"500 Cr", verdict:"Blockbuster",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:8, rightsDeal:"₹110 Cr", ottNote:"Prime Video — viewership data not publicly disclosed" }},
    { title:"Vikram", language:"Tamil", director:"Lokesh Kanagaraj", releaseDate:"Jun 2022", totalCollection:"425 Cr", totalNum:425, indiaNet:"275 Cr", overseas:"150 Cr", weeksInTop10:10, status:"OTT", budget:"150 Cr", verdict:"Blockbuster",
      ott:{ platform:"Disney+ Hotstar", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:6, rightsDeal:"₹70 Cr", ottNote:"Hotstar — viewership data not publicly disclosed" }},
    { title:"Brahmastra Part One", language:"Hindi", director:"Ayan Mukerji", releaseDate:"Sep 2022", totalCollection:"431 Cr", totalNum:431, indiaNet:"260 Cr", overseas:"171 Cr", weeksInTop10:8, status:"OTT", budget:"410 Cr", verdict:"Hit",
      ott:{ platform:"Disney+ Hotstar", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:5, rightsDeal:"₹150 Cr", ottNote:"Hotstar — viewership data not publicly disclosed" }},
    { title:"The Kashmir Files", language:"Hindi", director:"Vivek Agnihotri", releaseDate:"Mar 2022", totalCollection:"342 Cr", totalNum:342, indiaNet:"252 Cr", overseas:"90 Cr", weeksInTop10:12, status:"OTT", budget:"15 Cr", verdict:"Blockbuster",
      ott:{ platform:"ZEE5", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:4, rightsDeal:"₹90 Cr", ottNote:"ZEE5 — viewership data not publicly disclosed" }},
    { title:"Drishyam 2", language:"Hindi", director:"Abhishek Pathak", releaseDate:"Nov 2022", totalCollection:"300 Cr", totalNum:300, indiaNet:"248 Cr", overseas:"52 Cr", weeksInTop10:9, status:"OTT", budget:"40 Cr", verdict:"Blockbuster",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:4, rightsDeal:"₹60 Cr", ottNote:"Prime Video — viewership data not publicly disclosed" }},
    { title:"Bhool Bhulaiyaa 2", language:"Hindi", director:"Anees Bazmee", releaseDate:"May 2022", totalCollection:"266 Cr", totalNum:266, indiaNet:"228 Cr", overseas:"38 Cr", weeksInTop10:8, status:"OTT", budget:"80 Cr", verdict:"Blockbuster",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 10 India (peak)", countries:3, rightsDeal:"₹55 Cr", ottNote:"Netflix — debut predates Netflix's weekly public reporting system" }},
    { title:"Beast", language:"Tamil", director:"Nelson Dilipkumar", releaseDate:"Apr 2022", totalCollection:"235 Cr", totalNum:235, indiaNet:"130 Cr", overseas:"105 Cr", weeksInTop10:5, status:"OTT", budget:"180 Cr", verdict:"Flop",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:0, rightsDeal:"₹40 Cr", ottNote:"Prime Video — viewership data not publicly disclosed" }},
    { title:"Gangubai Kathiawadi", language:"Hindi", director:"Sanjay Leela Bhansali", releaseDate:"Feb 2022", totalCollection:"209 Cr", totalNum:209, indiaNet:"130 Cr", overseas:"79 Cr", weeksInTop10:7, status:"OTT", budget:"150 Cr", verdict:"Hit",
      ott:{ platform:"Netflix", debutViews:"5.1M (6 days)", debutHours:"13.8M hrs", lifetimeViews:"~12M", lifetimeHours:"~35M hrs", globalRank:"#2 Non-English (peak)", countries:12, rightsDeal:"₹110 Cr", ottNote:"Netflix — strong debut; set benchmark before Animal broke the record" }},
  ],
  2023: [
    { title:"Jawan", language:"Hindi", director:"Atlee", releaseDate:"Sep 2023", totalCollection:"1,160 Cr", totalNum:1160, indiaNet:"640 Cr", overseas:"520 Cr", weeksInTop10:16, status:"OTT", budget:"300 Cr", verdict:"All-Time Blockbuster",
      ott:{ platform:"Netflix", debutViews:"~5.2M (Wk1)", debutHours:"14.9M hrs", lifetimeViews:"~28M+", lifetimeHours:"~85M hrs", globalRank:"#1 Non-English (peak)", countries:19, rightsDeal:"₹250 Cr", ottNote:"2nd most-watched Indian film on Netflix all-time · Held #1 record before Animal" }},
    { title:"Pathaan", language:"Hindi", director:"Siddharth Anand", releaseDate:"Jan 2023", totalCollection:"1,057 Cr", totalNum:1057, indiaNet:"543 Cr", overseas:"514 Cr", weeksInTop10:14, status:"OTT", budget:"250 Cr", verdict:"All-Time Blockbuster",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:12, rightsDeal:"₹100 Cr", ottNote:"Prime Video — viewership data not publicly disclosed" }},
    { title:"Animal", language:"Hindi", director:"Sandeep Reddy Vanga", releaseDate:"Dec 2023", totalCollection:"917 Cr", totalNum:917, indiaNet:"554 Cr", overseas:"363 Cr", weeksInTop10:14, status:"OTT", budget:"100 Cr", verdict:"All-Time Blockbuster",
      ott:{ platform:"Netflix", debutViews:"6.2M (3 days)", debutHours:"20.8M hrs", lifetimeViews:"~22M+", lifetimeHours:"~66M hrs", globalRank:"#4 Global (peak)", countries:17, rightsDeal:"₹130 Cr", ottNote:"Held all-time Indian Netflix debut record until Dhurandhar (2026)" }},
    { title:"Salaar: Part 1", language:"Telugu", director:"Prashanth Neel", releaseDate:"Dec 2023", totalCollection:"770 Cr", totalNum:770, indiaNet:"450 Cr", overseas:"320 Cr", weeksInTop10:10, status:"OTT", budget:"200 Cr", verdict:"Blockbuster",
      ott:{ platform:"Netflix", debutViews:"3.5M (10 days)", debutHours:"10.3M hrs", lifetimeViews:"~10M+", lifetimeHours:"~30M hrs", globalRank:"#1 Non-English (peak)", countries:9, rightsDeal:"₹250 Cr", ottNote:"Netflix rights for all languages except Hindi" }},
    { title:"Gadar 2", language:"Hindi", director:"Anil Sharma", releaseDate:"Aug 2023", totalCollection:"691 Cr", totalNum:691, indiaNet:"527 Cr", overseas:"164 Cr", weeksInTop10:12, status:"OTT", budget:"60 Cr", verdict:"All-Time Blockbuster",
      ott:{ platform:"ZEE5", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:5, rightsDeal:"₹90 Cr", ottNote:"ZEE5 — viewership data not publicly disclosed" }},
    { title:"Jailer", language:"Tamil", director:"Nelson Dilipkumar", releaseDate:"Aug 2023", totalCollection:"645 Cr", totalNum:645, indiaNet:"400 Cr", overseas:"245 Cr", weeksInTop10:10, status:"OTT", budget:"175 Cr", verdict:"Blockbuster",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:8, rightsDeal:"₹100 Cr", ottNote:"Prime Video — viewership data not publicly disclosed" }},
    { title:"Leo", language:"Tamil", director:"Lokesh Kanagaraj", releaseDate:"Oct 2023", totalCollection:"620 Cr", totalNum:620, indiaNet:"390 Cr", overseas:"230 Cr", weeksInTop10:8, status:"OTT", budget:"250 Cr", verdict:"Blockbuster",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 10 India (peak)", countries:6, rightsDeal:"₹120 Cr", ottNote:"Netflix — debut predates wider weekly public reporting" }},
    { title:"Dunki", language:"Hindi", director:"Rajkumar Hirani", releaseDate:"Dec 2023", totalCollection:"466 Cr", totalNum:466, indiaNet:"225 Cr", overseas:"241 Cr", weeksInTop10:6, status:"OTT", budget:"200 Cr", verdict:"Hit",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 10 India (peak)", countries:7, rightsDeal:"₹120 Cr", ottNote:"Netflix — viewership data not publicly disclosed for this title" }},
    { title:"Ponniyin Selvan II", language:"Tamil", director:"Mani Ratnam", releaseDate:"Apr 2023", totalCollection:"350 Cr", totalNum:350, indiaNet:"220 Cr", overseas:"130 Cr", weeksInTop10:6, status:"OTT", budget:"500 Cr", verdict:"Flop",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:4, rightsDeal:"₹80 Cr", ottNote:"Prime Video — viewership data not publicly disclosed" }},
    { title:"Rocky Aur Rani Kii Prem Kahaani", language:"Hindi", director:"Karan Johar", releaseDate:"Jul 2023", totalCollection:"300 Cr", totalNum:300, indiaNet:"158 Cr", overseas:"142 Cr", weeksInTop10:7, status:"OTT", budget:"150 Cr", verdict:"Hit",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:5, rightsDeal:"₹75 Cr", ottNote:"Prime Video — viewership data not publicly disclosed" }},
  ],
  2024: [
    { title:"Pushpa 2: The Rule", language:"Telugu", director:"Sukumar", releaseDate:"Dec 2024", totalCollection:"1,800 Cr", totalNum:1800, indiaNet:"1,255 Cr", overseas:"545 Cr", weeksInTop10:12, status:"OTT", budget:"500 Cr", verdict:"All-Time Blockbuster", note:"All-time Indian box office record",
      ott:{ platform:"Netflix", debutViews:"5.8M (4 days)", debutHours:"21.8M hrs", lifetimeViews:"~30M+", lifetimeHours:"~110M hrs", globalRank:"#2 Non-English (peak)", countries:19, rightsDeal:"₹275 Cr", ottNote:"Reloaded version with 23 min extra footage — biggest South Indian OTT debut on Netflix" }},
    { title:"Stree 2", language:"Hindi", director:"Amar Kaushik", releaseDate:"Aug 2024", totalCollection:"672 Cr", totalNum:672, indiaNet:"617 Cr", overseas:"55 Cr", weeksInTop10:14, status:"OTT", budget:"70 Cr", verdict:"All-Time Blockbuster",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:10, rightsDeal:"₹150 Cr", ottNote:"Prime Video exclusive · Platform does not publish weekly view data · Huge demand on rental before free streaming" }},
    { title:"Kalki 2898 AD", language:"Telugu", director:"Nag Ashwin", releaseDate:"Jun 2024", totalCollection:"650 Cr", totalNum:650, indiaNet:"450 Cr", overseas:"200 Cr", weeksInTop10:12, status:"OTT", budget:"600 Cr", verdict:"Blockbuster",
      ott:{ platform:"Netflix + Prime Video", debutViews:"4.5M (Hindi, Wk1)", debutHours:"13.1M hrs", lifetimeViews:"~15M+", lifetimeHours:"~45M hrs", globalRank:"#2 Non-English (peak)", countries:14, rightsDeal:"₹375 Cr", ottNote:"Highest OTT rights deal ever for an Indian film · Split: Netflix (Hindi) + Prime (Telugu/Tamil)" }},
    { title:"Singham Again", language:"Hindi", director:"Rohit Shetty", releaseDate:"Nov 2024", totalCollection:"290 Cr", totalNum:290, indiaNet:"240 Cr", overseas:"50 Cr", weeksInTop10:8, status:"OTT", budget:"350 Cr", verdict:"Average",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:6, rightsDeal:"₹100 Cr", ottNote:"Prime Video — viewership data not publicly disclosed" }},
    { title:"Devara Part 1", language:"Telugu", director:"Koratala Siva", releaseDate:"Oct 2024", totalCollection:"265 Cr", totalNum:265, indiaNet:"180 Cr", overseas:"85 Cr", weeksInTop10:8, status:"OTT", budget:"200 Cr", verdict:"Average",
      ott:{ platform:"Netflix", debutViews:"2.2M (no Hindi, Wk1)", debutHours:"6.4M hrs", lifetimeViews:"~7M+", lifetimeHours:"~21M hrs", globalRank:"#6 Non-English (peak)", countries:8, rightsDeal:"₹150 Cr", ottNote:"Debuted without Hindi version · Added later; significantly boosted cumulative numbers" }},
    { title:"Vettaiyan", language:"Tamil", director:"T.J. Gnanavel", releaseDate:"Oct 2024", totalCollection:"185 Cr", totalNum:185, indiaNet:"120 Cr", overseas:"65 Cr", weeksInTop10:7, status:"OTT", budget:"150 Cr", verdict:"Average",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 10 India (peak)", countries:5, rightsDeal:"₹75 Cr", ottNote:"Netflix — detailed debut week data not available" }},
    { title:"Lucky Baskhar", language:"Telugu", director:"Venky Atluri", releaseDate:"Oct 2024", totalCollection:"130 Cr", totalNum:130, indiaNet:"95 Cr", overseas:"35 Cr", weeksInTop10:8, status:"OTT", budget:"60 Cr", verdict:"Hit",
      ott:{ platform:"Netflix", debutViews:"5.1M (Wk1)", debutHours:"~15M hrs", lifetimeViews:"~12M+", lifetimeHours:"~36M hrs", globalRank:"#1 Non-English (peak)", countries:11, rightsDeal:"₹60 Cr", ottNote:"Breakout OTT performer · Topped Netflix non-English charts for 2 weeks · Surprise digital blockbuster" }},
    { title:"Game Changer", language:"Telugu", director:"Shankar", releaseDate:"Dec 2024", totalCollection:"220 Cr", totalNum:220, indiaNet:"155 Cr", overseas:"65 Cr", weeksInTop10:5, status:"OTT", budget:"400 Cr", verdict:"Disaster",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 10 India (peak)", countries:5, rightsDeal:"₹160 Cr", ottNote:"Prime Video — platform's biggest flop acquisition of 2024" }},
    { title:"Mufasa: The Lion King (Hindi)", language:"Hindi", director:"Barry Jenkins", releaseDate:"Dec 2024", totalCollection:"95 Cr", totalNum:95, indiaNet:"85 Cr", overseas:"10 Cr", weeksInTop10:6, status:"OTT", budget:"—", verdict:"Average",
      ott:{ platform:"Disney+ Hotstar", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:4, rightsDeal:"N/A", ottNote:"Disney content — streams exclusively on Hotstar in India" }},
    { title:"The Sabarmati Report", language:"Hindi", director:"Dheeraj Sarna", releaseDate:"Nov 2024", totalCollection:"82 Cr", totalNum:82, indiaNet:"78 Cr", overseas:"4 Cr", weeksInTop10:7, status:"OTT", budget:"40 Cr", verdict:"Hit",
      ott:{ platform:"ZEE5", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:3, rightsDeal:"₹30 Cr", ottNote:"ZEE5 — viewership data not publicly disclosed" }},
  ],
  2025: [
    { title:"Dhurandhar", language:"Hindi", director:"Aditya Dhar", releaseDate:"Dec 2025", totalCollection:"1,305.35 Cr", totalNum:1305.35, indiaNet:"838.5 Cr", overseas:"299.5 Cr", weeksInTop10:11, status:"OTT", budget:"300 Cr", verdict:"All-Time Blockbuster", pageUrl:"dhurandhar-box-office.html", note:"Highest-grossing Hindi film of all time. Day 100 on Mar 13 2026. Re-releasing 1000 screens globally.",
      ott:{ platform:"Netflix", ottDate:"Jan 30, 2026", debutViews:"7.6M (Wk1) / 8.2M (Wk2) / 23M (6 wks total)", debutHours:"21.6M hrs (Wk1) / 28.1M hrs (Wk2) / 70.6M hrs total", lifetimeViews:"23M (6 weeks)", lifetimeHours:"70.6M+ hours", globalRank:"#1 Non-English Wk1 & Wk2", countries:22, rightsDeal:"₹285 Cr", ottNote:"Most-watched Indian film on Netflix ever. Beat Animal 6.2M Wk1 record. 22 countries peak. Still trending Top 10 India Wk6. D1 OTT deal: ₹285 Cr (not ₹175 Cr — updated per Sacnilk). GCC ban applies: no UAE/Qatar/Oman/Bahrain/Saudi data." }},
    { title:"Chhaava", language:"Hindi", director:"Laxman Utekar", releaseDate:"Feb 2025", totalCollection:"₹807.91 Cr", totalNum:807.91, indiaNet:"601.54 Cr", overseas:"91 Cr", weeksInTop10:10, status:"OTT", budget:"150 Cr", verdict:"Blockbuster",
      ott:{ platform:"Netflix", debutViews:"2.2M (Wk1)", debutHours:"5.9M hrs", lifetimeViews:"~5.5M (2 weeks)", lifetimeHours:"~15M hrs", globalRank:"#4 Non-English (peak)", countries:11, rightsDeal:"₹100 Cr", ottNote:"Low debut attributed to massive theatrical run fatigue; bounced 50% in Wk2 · #1 in India & Pakistan" }},
    { title:"Housefull 5", language:"Hindi", director:"Tarun Mansukhani", releaseDate:"Jun 2025", totalCollection:"235 Cr", totalNum:235, indiaNet:"205 Cr", overseas:"30 Cr", weeksInTop10:5, status:"OTT", budget:"170 Cr", verdict:"Blockbuster",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 10 India (peak)", countries:5, rightsDeal:"₹75 Cr", ottNote:"Netflix — viewership data not publicly disclosed" }},
    { title:"Raid 2", language:"Hindi", director:"Rajkumar Gupta", releaseDate:"May 2025", totalCollection:"210 Cr", totalNum:210, indiaNet:"185 Cr", overseas:"25 Cr", weeksInTop10:6, status:"OTT", budget:"100 Cr", verdict:"Blockbuster",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:6, rightsDeal:"₹65 Cr", ottNote:"Prime Video — viewership data not publicly disclosed" }},
    { title:"Sky Force", language:"Hindi", director:"Abhishek Anil Kapur", releaseDate:"Jan 2025", totalCollection:"195 Cr", totalNum:195, indiaNet:"167 Cr", overseas:"28 Cr", weeksInTop10:6, status:"OTT", budget:"70 Cr", verdict:"Hit",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 10 India (peak)", countries:6, rightsDeal:"₹55 Cr", ottNote:"Netflix — viewership data not publicly disclosed" }},
    { title:"Retro", language:"Tamil", director:"Karthik Subbaraj", releaseDate:"Apr 2025", totalCollection:"130 Cr", totalNum:130, indiaNet:"88 Cr", overseas:"42 Cr", weeksInTop10:4, status:"OTT", budget:"120 Cr", verdict:"Average",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:3, rightsDeal:"₹40 Cr", ottNote:"Netflix — viewership data not publicly disclosed" }},
    { title:"Baby John", language:"Hindi", director:"Kalees", releaseDate:"Dec 2025", totalCollection:"78 Cr", totalNum:78, indiaNet:"68 Cr", overseas:"10 Cr", weeksInTop10:4, status:"OTT", budget:"150 Cr", verdict:"Disaster",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:2, rightsDeal:"₹55 Cr", ottNote:"Prime Video — one of the biggest OTT loss-makers of 2025" }},
    { title:"Saiyaara", language:"Hindi", director:"Mohit Suri", releaseDate:"Jul 2025", totalCollection:"579 Cr", totalNum:579, indiaNet:"409 Cr", overseas:"167 Cr", weeksInTop10:9, status:"OTT", budget:"45 Cr", verdict:"All-Time Blockbuster", note:"Biggest Indian romantic film ever · Debut leads Ahaan Panday & Aneet Padda · ROI 640%",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:3, rightsDeal:"₹35 Cr", ottNote:"Netflix — viewership data not publicly disclosed" }},

    { title:"Tu Meri Main Tera Main Tera Tu Meri", language:"Hindi", director:"Sameer Vidwans", releaseDate:"Dec 2025", totalCollection:"56 Cr", totalNum:56, indiaNet:"39 Cr", overseas:"10 Cr", weeksInTop10:2, status:"OTT", budget:"90 Cr", verdict:"Flop", note:"Kartik Aaryan & Ananya Panday. Released Dec 25, 2025. Overshadowed by Dhurandhar wave. Amazon Prime Feb 2026.",
      weeklyCollection:0, weekNum:0, daysInRelease:15, lastWeekRank:null, weeklyNote:"Released Dec 25, 2025. Closed at ₹39 Cr India net vs ₹90 Cr budget. Flop." },
    { title:"Deva", language:"Hindi", director:"Rosshan Andrrews", releaseDate:"Jan 2025", totalCollection:"49 Cr", totalNum:49, indiaNet:"44 Cr", overseas:"5 Cr", weeksInTop10:3, status:"OTT", budget:"100 Cr", verdict:"Flop",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:2, rightsDeal:"₹30 Cr", ottNote:"Netflix — viewership data not publicly disclosed" }},
    { title:"Pushpa 2 Re-release", language:"Telugu", director:"Sukumar", releaseDate:"Jan 2025", totalCollection:"85 Cr", totalNum:85, indiaNet:"65 Cr", overseas:"20 Cr", weeksInTop10:3, status:"OTT", budget:"—", verdict:"Rerun",
      ott:{ platform:"Netflix", debutViews:"Already on platform", debutHours:"Already on platform", lifetimeViews:"~30M+ (cumulative)", lifetimeHours:"~110M hrs (cumulative)", globalRank:"Still charting in 2025", countries:15, rightsDeal:"₹275 Cr (original deal)", ottNote:"Re-release boosted already record-high Netflix numbers further" }},
  ],
  2026: [
    // ── ACTIVE IN CINEMAS THIS WEEK (ranked by this week's collection) ──
    { title:"Border 2",             language:"Hindi",   director:"Anurag Singh",      releaseDate:"Jan 23, 2026", totalCollection:"481.76 Cr",totalNum:481.76,indiaNet:"424 Cr", overseas:"57.71 Cr",weeksInTop10:7, status:"OTT",     budget:"275 Cr", verdict:"Super Hit",
      weeklyCollection:0, weekNum:8, daysInRelease:51, lastWeekRank:1, weeklyNote:"CLOSED. Final: ₹424 Cr India net / ₹481.76 Cr WW. OTT: Netflix Mar 20, 2026 — same day as Dhurandhar 2 release. Budget ₹275 Cr. ROI ~114%. Border 3 confirmed by makers.", wkTrend:"closed",
      ott:{ platform:"Netflix", ottDate:"Mar 20, 2026", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"₹225 Cr (confirmed)", ottNote:"Netflix confirmed Mar 20 2026. Premieres same day as Dhurandhar 2 theatrical release. Non-theatrical total ₹495 Cr." }},
    { title:"O'Romeo",              language:"Hindi",   director:"Vishal Bhardwaj",   releaseDate:"Feb 13, 2026", totalCollection:"~₹110 Cr",totalNum:110,indiaNet:"80.90 Cr",overseas:"~₹29 Cr",weeksInTop10:3, status:"OTT",     budget:"150 Cr", verdict:"Flop",
      weeklyCollection:0, weekNum:5, daysInRelease:29, lastWeekRank:2, weeklyNote:"CLOSED. Final: ~₹80.9 Cr India net / ~₹110 Cr WW. Budget ₹150 Cr. Recovered ~54% of cost. Confirmed Flop. Shahid Kapoor + Vishal Bhardwaj 4th collab — their highest India gross but still a loss. OTT: Amazon Prime Video.", wkTrend:"closed",
      ott:{ platform:"Amazon Prime Video", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"~₹50 Cr (est.)", ottNote:"Amazon Prime Video confirmed. Wikipedia article confirms post-theatrical rights to Prime. Expected April 2026." }},
    { title:"Mardaani 3",           language:"Hindi",   director:"Abhiraj Minawala",  releaseDate:"Jan 30, 2026", totalCollection:"₹75.10 Cr",totalNum:75.10,indiaNet:"50.78 Cr", overseas:"9 Cr",    weeksInTop10:6, status:"OTT",     budget:"65 Cr",  verdict:"Flop",
      weeklyCollection:0, weekNum:7, daysInRelease:44, lastWeekRank:3, weeklyNote:"CLOSED. Final: ₹50.78 Cr India net / ₹75.10 Cr WW. Budget ₹65 Cr. Flop verdict (hat-trick of failures for Rani Mukerji franchise per Koimoi). OTT: Amazon Prime Video ~Mar 27.", wkTrend:"closed",
      ott:{ platform:"Amazon Prime Video", ottDate:"~Mar 27, 2026", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"~₹30 Cr (est.)", ottNote:"Amazon Prime Video. Expected ~Mar 27 2026. YRF franchise — Netflix deal likely; OTT premiere expected Mar/Apr 2026" }},
    { title:"Assi",                 language:"Hindi",   director:"Anubhav Sinha",     releaseDate:"Feb 20, 2026", totalCollection:"11.5 Cr",  totalNum:11.5, indiaNet:"9.8 Cr",    overseas:"1 Cr",    weeksInTop10:0, status:"Closing", budget:"40 Cr",  verdict:"Flop",
      weeklyCollection:0, weekNum:3, daysInRelease:16, lastWeekRank:5, weeklyNote:"Wk 3 trickle. Total ~₹9.5 Cr net. Taapsee courtroom drama — no WOM. Budget ₹40 Cr, confirmed Flop. Closing.", wkTrend:"down",
      ott:{ platform:"ZEE5 (expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"~₹10 Cr (est.)", ottNote:"Social drama — likely ZEE5 or Netflix; OTT in 3–4 weeks" }},
    { title:"Do Deewane Sehar Mein",language:"Hindi",   director:"Ravi Udyawar",      releaseDate:"Feb 20, 2026", totalCollection:"9 Cr",    totalNum:9,    indiaNet:"7 Cr",    overseas:"2 Cr",    weeksInTop10:0, status:"Closed",  budget:"50 Cr",  verdict:"Flop",
      weeklyCollection:0, weekNum:3, daysInRelease:15, lastWeekRank:6, weeklyNote:"Closed. ₹7 Cr net / ₹9 Cr WW. Bhansali production but poor run — budget ₹50 Cr, confirmed Flop.", wkTrend:"down",
      ott:{ platform:"TBD (Prime/Netflix expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"~₹15 Cr (est.)", ottNote:"Bhansali Productions — Netflix deal likely; premiere expected in 3–4 weeks" }},
    { title:"Tu Yaa Main",          language:"Hindi",   director:"Bejoy Nambiar",     releaseDate:"Feb 13, 2026", totalCollection:"8 Cr",    totalNum:8,    indiaNet:"6.4 Cr",  overseas:"0.8 Cr",  weeksInTop10:0, status:"Closed",  budget:"40 Cr",  verdict:"Disaster",
      weeklyCollection:0, weekNum:3, daysInRelease:21, lastWeekRank:7, weeklyNote:"Closed. ₹6.4 Cr net. Shanaya Kapoor debut — worst major-studio launch of 2026.", wkTrend:"down",
      ott:{ platform:"TBD (Prime/Netflix expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"~₹8 Cr (est.)", ottNote:"Expected OTT in 2–3 weeks given theatrical disaster" }},
    { title:"The Kerala Story 2: Goes Beyond", language:"Hindi", director:"Kamakhya Narayan Singh", releaseDate:"Feb 27, 2026", totalCollection:"~₹46 Cr", totalNum:46, indiaNet:"~39 Cr",      overseas:"~₹1.93 Cr", weeksInTop10:3, status:"Running",  budget:"28 Cr",  verdict:"Average",
      weeklyCollection:2, weekNum:3, daysInRelease:15, lastWeekRank:2, weeklyNote:"Day 14: ~₹39 Cr net / ~₹46 Cr WW. Budget recovered, slim profit. Day 1 legal issues hurt opening badly. Closing before Dhurandar 2 on Mar 19. OTT platform TBD. Plus/Average verdict — borderline hit.andhar 2. Hit (₹56 Cr) is unlikely. net — clean 2-week window before Dhurandhar 2.", wkTrend:"new",
      ott:{ platform:"ZEE5 (expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"~₹8 Cr (est.)", ottNote:"Controversial sequel — released Feb 27 after HC lifted stay. Tracking towards profit on low budget." }},
    // ── CLOSED / OTT ──
    { title:"Dhurandhar",           language:"Hindi",   director:"Aditya Dhar",       releaseDate:"Dec 5, 2025",  totalCollection:"1,355 Cr", totalNum:1355, indiaNet:"838.5 Cr",  overseas:"299 Cr",  weeksInTop10:12, status:"OTT",    budget:"225 Cr", verdict:"All-Time Blockbuster", pageUrl:"dhurandhar-box-office.html", note:"₹893 Cr India net · WW #1 Hindi film ever · 59 days on BMS trending",
      weeklyCollection:0, weekNum:12, daysInRelease:78, lastWeekRank:null, weeklyNote:"Theatrical run concluded. On Netflix. Biggest Hindi film ever.",
      ott:{ platform:"Netflix", debutViews:"7.6M (3 days) → 15.8M (10 days)", debutHours:"21.6M hrs (Wk1) · 28.1M hrs (Wk2)", lifetimeViews:"~16M+", lifetimeHours:"~50M hrs", globalRank:"#1 Non-English (2 weeks)", countries:22, rightsDeal:"₹175 Cr", ottNote:"Biggest Indian post-theatrical OTT debut ever · #1 India, Pakistan, UAE, Qatar, Oman, Bahrain, Mauritius" }},
    { title:"MSVP (Mana ShankaraVaraprasad Garu)", language:"Telugu", director:"Anil Ravipudi", releaseDate:"Jan 23, 2026", totalCollection:"438 Cr", totalNum:438, indiaNet:"320 Cr", overseas:"56 Cr", weeksInTop10:4, status:"OTT", budget:"275 Cr", verdict:"Blockbuster", note:"Chiranjeevi & Nayanthara — now on OTT",
      weeklyCollection:0, weekNum:4, daysInRelease:29, lastWeekRank:null, weeklyNote:"Concluded theatrical run. On OTT.",
      ott:{ platform:"TBD (Prime/Netflix expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"~₹100 Cr (est.)", ottNote:"OTT premiere expected" }},
    { title:"The Raja Saab",        language:"Telugu",  director:"Maruthi Dasari",    releaseDate:"Jan 12, 2026", totalCollection:"300 Cr",  totalNum:300,  indiaNet:"217 Cr",  overseas:"43 Cr",   weeksInTop10:5, status:"OTT",    budget:"200 Cr", verdict:"Blockbuster",
      weeklyCollection:0, weekNum:6, daysInRelease:40, lastWeekRank:null, weeklyNote:"Closed. On OTT.",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 India (peak)", countries:7, rightsDeal:"₹80 Cr", ottNote:"Prime Video — viewership data not publicly disclosed" }},
    { title:"Anaganaga Oka Raju",   language:"Telugu",  director:"Maruthi Dasari",    releaseDate:"Jan 9, 2026",  totalCollection:"208 Cr",  totalNum:208,  indiaNet:"146 Cr",  overseas:"34 Cr",   weeksInTop10:5, status:"OTT",    budget:"400 Cr", verdict:"Disaster",
      weeklyCollection:0, weekNum:6, daysInRelease:43, lastWeekRank:null, weeklyNote:"Closed. On OTT. Biggest loss of early 2026.",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:3, rightsDeal:"₹90 Cr", ottNote:"Netflix — biggest OTT loss-maker of early 2026; ₹400 Cr budget vs ₹208 Cr WW gross" }},
    { title:"Ikkis",                language:"Hindi",   director:"Sriram Raghavan",   releaseDate:"Jan 1, 2026",  totalCollection:"41 Cr",   totalNum:41,   indiaNet:"35 Cr",   overseas:"3 Cr",    weeksInTop10:2, status:"OTT",    budget:"60 Cr",  verdict:"Flop",     note:"Dharmendra's final film",
      weeklyCollection:0, weekNum:3, daysInRelease:51, lastWeekRank:null, weeklyNote:"Closed. First flop of 2026.",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:2, rightsDeal:"₹15 Cr", ottNote:"Prime Video — Dharmendra's final film" }},
    { title:"Landlord",             language:"Kannada", director:"Nithish Sahadev",   releaseDate:"Jan 14, 2026", totalCollection:"60 Cr",   totalNum:60,   indiaNet:"37 Cr",   overseas:"17 Cr",   weeksInTop10:4, status:"OTT",    budget:"8 Cr",   verdict:"Blockbuster", note:"₹8 Cr budget → ₹60 Cr WW · Best ROI of 2026",
      weeklyCollection:0, weekNum:4, daysInRelease:38, lastWeekRank:null, weeklyNote:"Closed. Biggest ROI film of 2026.",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 10 India (peak)", countries:4, rightsDeal:"₹15 Cr", ottNote:"Prime Video — ₹8 Cr budget film became sleeper OTT hit; outstanding ROI story" }},
    { title:"Vadh 2",               language:"Hindi",   director:"Rajkumar Gupta",    releaseDate:"Feb 7, 2026",  totalCollection:"6 Cr",    totalNum:6,    indiaNet:"5 Cr",    overseas:"0.5 Cr",  weeksInTop10:0, status:"OTT",    budget:"30 Cr",  verdict:"Disaster",
      weeklyCollection:0, weekNum:1, daysInRelease:14, lastWeekRank:null, weeklyNote:"Closed already. Opened ₹0.5 Cr Day 1. Franchise goodwill exhausted.",
      ott:{ platform:"ZEE5 (expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"~₹5 Cr (est.)", ottNote:"Expected on ZEE5 in 4–6 weeks" }},
    // ── REGIONAL: TELUGU (Tollywood) ──
    { title:"Mana ShankaraVaraprasad Garu", language:"Telugu", director:"Anil Ravipudi", releaseDate:"Jan 12, 2026",
      totalCollection:"300 Cr", totalNum:300, indiaNet:"215 Cr", overseas:"43 Cr", weeksInTop10:5,
      status:"OTT", budget:"180 Cr", verdict:"Blockbuster",
      note:"Sankranthi winner. Chiranjeevi + Nayanthara. ₹215 Cr India net. WW ₹300 Cr. On Zee5.",
      weeklyCollection:0, weekNum:6, daysInRelease:40, lastWeekRank:null,
      weeklyNote:"Theatrical closed. Final: ₹215 Cr India net · ₹300 Cr WW. Chiranjeevi's biggest Telugu hit. Streamed on Zee5 from Feb 11.",
      ott:{ platform:"Zee5", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 Zee5 Telugu (launch week)", countries:8, rightsDeal:"Record Zee5 deal (undisclosed)", ottNote:"Zee5 India — record deal for Telugu film. Dubbed in Hindi, Tamil, Kannada, Malayalam. Industry Hit verdict." }},
    { title:"The Raja Saab", language:"Telugu", director:"Maruthi Dasari", releaseDate:"Jan 9, 2026",
      totalCollection:"208 Cr", totalNum:208, indiaNet:"146 Cr", overseas:"34 Cr", weeksInTop10:4,
      status:"OTT", budget:"400 Cr", verdict:"Disaster",
      note:"Prabhas horror comedy. ₹400 Cr budget, ₹208 Cr WW. DISASTER — biggest 2026 Telugu flop.",
      weeklyCollection:0, weekNum:6, daysInRelease:43, lastWeekRank:null,
      weeklyNote:"Closed. ₹146 Cr India net on ₹400 Cr budget = massive disaster. Prabhas' lowest since Adipurush.",
      ott:{ platform:"JioHotstar", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 5 Hotstar Telugu (launch)", countries:6, rightsDeal:"₹160 Cr (pre-sold)", ottNote:"JioHotstar India — rights sold pre-release at ₹160 Cr, streaming from Feb 6. Despite poor theatrical run, OTT deal protected producers." }},
    { title:"Anaganaga Oka Raju", language:"Telugu", director:"Maari", releaseDate:"Jan 14, 2026",
      totalCollection:"82 Cr", totalNum:82, indiaNet:"34 Cr", overseas:"20 Cr", weeksInTop10:3,
      status:"OTT", budget:"20 Cr", verdict:"Blockbuster",
      note:"Naveen Polishetty comedy. ₹20 Cr budget, ₹82 Cr WW. ROI Blockbuster.",
      weeklyCollection:0, weekNum:5, daysInRelease:38, lastWeekRank:null,
      weeklyNote:"Closed theatrical. On Netflix from Feb 11. ₹34 Cr India net on ₹20 Cr budget — excellent ROI.",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 5 Netflix Telugu", countries:5, rightsDeal:"₹19 Cr", ottNote:"Netflix India South — acquired for ₹19 Cr. Naveen Polishetty's most profitable film per rupee invested." }},
    { title:"Nari Nari Naduma Murari", language:"Telugu", director:"Ram Abbaraju", releaseDate:"Jan 14, 2026",
      totalCollection:"64 Cr", totalNum:64, indiaNet:"26 Cr", overseas:"20 Cr", weeksInTop10:3,
      status:"OTT", budget:"50 Cr", verdict:"Hit",
      note:"Sharwanand romantic comedy. ₹64 Cr WW. Hit verdict.",
      weeklyCollection:0, weekNum:5, daysInRelease:38, lastWeekRank:null,
      weeklyNote:"Theatrical closed. ₹64 Cr WW on ₹50 Cr budget. Sharwanand comeback hit. On Prime Video.",
      ott:{ platform:"Amazon Prime Video", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 5 Prime Telugu", countries:4, rightsDeal:"~₹18 Cr (est.)", ottNote:"Prime Video India South — Sharwanand–Samyuktha Menon rom-com. Strong family audiences." }},

    // ── REGIONAL: TAMIL (Kollywood) ──
    { title:"Parasakthi", language:"Tamil", director:"Sudha Kongara", releaseDate:"Jan 10, 2026",
      totalCollection:"87 Cr", totalNum:87, indiaNet:"53 Cr", overseas:"23 Cr", weeksInTop10:4,
      status:"OTT", budget:"200 Cr", verdict:"Flop",
      note:"Sivakarthikeyan political drama. ₹87 Cr WW on ₹200 Cr budget. Underperformer.",
      weeklyCollection:0, weekNum:6, daysInRelease:42, lastWeekRank:null,
      weeklyNote:"Closed. Final ₹87 Cr WW on ₹200 Cr budget — FLOP. Strong critical reception but mass audiences didn't connect. On Zee5.",
      ott:{ platform:"Zee5", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 5 Zee5 Tamil", countries:5, rightsDeal:"~₹30 Cr (est.)", ottNote:"Zee5 India — Sudha Kongara period drama. Streamed from Feb 7. Tamil Nadu political controversy added buzz on OTT." }},
    { title:"With Love", language:"Tamil", director:"Madhan", releaseDate:"Feb 6, 2026",
      totalCollection:"39 Cr", totalNum:39, indiaNet:"30 Cr", overseas:"3.5 Cr", weeksInTop10:4,
      status:"OTT", budget:"4 Cr", verdict:"Blockbuster",
      note:"Abishan Jeevinth & Anaswara Rajan. ₹30 Cr India net on ₹4 Cr budget = 644% ROI. #2 highest-grossing Tamil film 2026. On Netflix from Mar 6.",
      weeklyCollection:0, weekNum:4, daysInRelease:29, lastWeekRank:2,
      weeklyNote:"Wk 2: ₹3 Cr. ₹20 Cr India net running — solid Hold. Valentine's release benefiting from word of mouth.",
      ott:{ platform:"Amazon Prime Video (expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:2, rightsDeal:"~₹8 Cr (est.)", ottNote:"Tamil romantic drama — strong Kerala + TN collections. Expected Prime Video premiere." }},
    { title:"Thaai Kizhavi", language:"Tamil", director:"Sivakumar Murugesan", releaseDate:"Feb 27, 2026", totalCollection:"~₹58 Cr", totalNum:58, indiaNet:"~43 Cr", overseas:"~₹9.6 Cr", weeksInTop10:3, status:"Running", budget:"9 Cr", verdict:"Super Hit",
      weeklyCollection:3, weekNum:3, daysInRelease:15, lastWeekRank:2, weeklyNote:"Day 13: ~₹41.16 Cr net (Sacnilk). Budget ₹9 Cr. ROI 357%. Super Hit. #2 Tamil grosser 2026. Chasing Parasakthi for #1.", wkTrend:"stable",
      ott:{ platform:"TBD", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:1, rightsDeal:"N/A", ottNote:"Tamil comedy drama — Radhika Sarathkumar. 238% ROI in 9 days. 2nd highest-grossing Tamil film of 2026." }},
    { title:"Funky", language:"Telugu", director:"Vamshi Paidipally", releaseDate:"Feb 13, 2026",
      totalCollection:"12 Cr", totalNum:12, indiaNet:"9 Cr", overseas:"3 Cr", weeksInTop10:1,
      status:"Running", budget:"40 Cr", verdict:"Flop",
      note:"₹9 Cr India net in 8 days. FLOP on ₹40 Cr budget.",
      weeklyCollection:1.5, weekNum:1, daysInRelease:8, lastWeekRank:0,
      weeklyNote:"Week 1 end: ₹9 Cr India net — tracking to FLOP. Valentine's competition from O Romeo and Hindi releases.",
      ott:{ platform:"TBD (Prime/Netflix expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:1, rightsDeal:"~₹5 Cr (est.)", ottNote:"Telugu release — poor theatrical debut." }},

    // ── REGIONAL: MALAYALAM (Mollywood) ──
    { title:"Chatha Pacha: The Ring of Rowdies", language:"Malayalam", director:"Adhvaith Nayar", releaseDate:"Jan 22, 2026",
      totalCollection:"33 Cr", totalNum:33, indiaNet:"16 Cr", overseas:"15 Cr", weeksInTop10:4,
      status:"OTT", budget:"15 Cr", verdict:"Blockbuster",
      note:"Mammootty wrestling comedy. ₹33 Cr WW on ₹15 Cr budget. BLOCKBUSTER ROI.",
      weeklyCollection:0, weekNum:4, daysInRelease:30, lastWeekRank:null,
      weeklyNote:"Closed theatrical. ₹16 Cr India net · ₹33 Cr WW on ₹15 Cr budget. Massive Kerala + strong overseas. Mollywood's #1 of 2026 so far.",
      ott:{ platform:"Netflix", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 5 Netflix Malayalam", countries:5, rightsDeal:"~₹8 Cr (est.)", ottNote:"Netflix India — Mammootty ensemble comedy about Fort Kochi wrestlers. Strong diaspora numbers." }},

    // ── REGIONAL: KANNADA (Sandalwood) ──
    { title:"Landlord", language:"Kannada", director:"Jadesh Kumar Hampi", releaseDate:"Jan 23, 2026",
      totalCollection:"7 Cr", totalNum:7, indiaNet:"5 Cr", overseas:"1 Cr", weeksInTop10:1,
      status:"OTT", budget:"5 Cr", verdict:"Hit",
      note:"Duniya Vijay rural drama. ₹7 Cr WW. Kannada #1 of 2026 (limited release).",
      weeklyCollection:0, weekNum:4, daysInRelease:29, lastWeekRank:null,
      weeklyNote:"Closed. ₹5 Cr India net on ₹5 Cr budget. Karnataka-circuit hit. Kannada's biggest 2026 release so far.",
      ott:{ platform:"Amazon Prime Video (expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:1, rightsDeal:"~₹2 Cr (est.)", ottNote:"Sandalwood rural action-drama. Limited release, strong Karnataka single-screen performance." }},

    // ── HOLLYWOOD / FOREIGN FILMS ──
    // BOG-style fields: bogRank, bogRankChange, usWeekend, usCumulative, intlCumulative, wwCumulative, indiaGross, indiaNet, theaterCount, theaterChange, perTheater, distributor, cinemascor, rtScore
    { title:"Wuthering Heights",    language:"Hollywood", director:"Emerald Fennell",  releaseDate:"Feb 13, 2026",
      totalCollection:"18 Cr", totalNum:18, indiaNetStr:"2.5 Cr", overseas:"1,298 Cr", weeksInTop10:2, status:"Running", budget:"725 Cr", verdict:"Hit",
      note:"Margot Robbie · Jacob Elordi · Warner Bros. ₹152 Cr WW ($152M global) in 10 days.",
      weeklyCollection:1.2, weekNum:2, daysInRelease:10, lastWeekRank:1,
      weeklyNote:"WW $152M in 10 days. US $60M · Intl $92M. India: ₹2.5 Cr net (niche). Valentine's #1 globally.",
      bogRank:2, bogRankChange:0, usWeekend:14.0, usCumulative:60.0, intlCumulative:92.0, wwCumulative:152.0,
      theaterCount:3682, theaterChange:0, perTheater:3802, distributor:"Warner Bros.", cinemaScore:"B", rtScore:64,
      indiaGross:3.0, indiaNet:2.5, indiaWeekend:0.5, indiaWeekNo:2,
      ott:{ platform:"TBD (Prime/Netflix expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:79, rightsDeal:"~₹5 Cr (est.)", ottNote:"Emerald Fennell's prestige romance. $80M budget · $100M P&A. Needs ~$360M global to break even." }},
    { title:"GOAT",                 language:"Hollywood", director:"Tyree Dillihay",   releaseDate:"Feb 13, 2026",
      totalCollection:"5 Cr",  totalNum:5,  indiaNetStr:"0.75 Cr", overseas:"588 Cr",  weeksInTop10:2, status:"Running", budget:"830 Cr", verdict:"Hit",
      note:"Sony Animation · Stephen Curry produced. $102M WW in 10 days. US #1 Weekend 2.",
      weeklyCollection:0.8, weekNum:2, daysInRelease:10, lastWeekRank:2,
      weeklyNote:"WW $102M — beats $80M budget. US $58.3M · Intl $43.7M. India ₹0.75 Cr net (very limited).",
      bogRank:1, bogRankChange:1, usWeekend:17.0, usCumulative:58.3, intlCumulative:43.7, wwCumulative:102.0,
      theaterCount:3863, theaterChange:0, perTheater:4401, distributor:"Sony Pictures", cinemaScore:"A", rtScore:91,
      indiaGross:0.9, indiaNet:0.75, indiaWeekend:0.2, indiaWeekNo:2,
      ott:{ platform:"Netflix (expected May 2026)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:42, rightsDeal:"~₹20 Cr (est.)", ottNote:"Sony Animation original — basketball-themed. Stephen Curry produced. 'A' CinemaScore = strong legs expected." }},
    { title:"Avatar: Fire & Ash",   language:"Hollywood", director:"James Cameron",    releaseDate:"Dec 19, 2025",
      totalCollection:"235 Cr", totalNum:235, indiaNetStr:"193 Cr", overseas:"10,815 Cr", weeksInTop10:10, status:"OTT", budget:"2,200 Cr", verdict:"Hit",
      note:"India Gross ₹235 Cr · #6 Hollywood all-time India · WW $1.5B+",
      weeklyCollection:1.5, weekNum:10, daysInRelease:65, lastWeekRank:10,
      weeklyNote:"Final weeks. India ₹235 Cr gross lifetime. WW $1.5B+. On Disney+ Hotstar.",
      bogRank:10, bogRankChange:-1, usWeekend:1.8, usCumulative:399.4, intlCumulative:858.0, wwCumulative:1299.0,
      theaterCount:1335, theaterChange:-315, perTheater:1348, distributor:"20th Century Studios", cinemaScore:"A", rtScore:77,
      indiaGross:235, indiaNet:193, indiaWeekend:1.5, indiaWeekNo:10,
      ott:{ platform:"Disney+ Hotstar", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"Top 10 Global (peak)", countries:12, rightsDeal:"~₹80 Cr (est.)", ottNote:"Hotstar India — Day 1 India: ₹25 Cr gross. #6 Hollywood all-time India." }},
    { title:"Zootopia 2",           language:"Hollywood", director:"Byron Howard / Jason Hand", releaseDate:"Nov 26, 2025",
      totalCollection:"21 Cr", totalNum:21, indiaNetStr:"15 Cr", overseas:"10,150 Cr", weeksInTop10:13, status:"OTT", budget:"1,341 Cr", verdict:"Super Hit",
      note:"India Gross ₹21 Cr · WW $1.36B ($423M domestic + $875M intl)",
      weeklyCollection:0.3, weekNum:13, daysInRelease:89, lastWeekRank:9,
      weeklyNote:"Final stretch. $423M US · $875M intl · $1.36B WW. India ₹21 Cr gross — modest vs global scale.",
      bogRank:9, bogRankChange:-1, usWeekend:2.3, usCumulative:423.9, intlCumulative:875.0, wwCumulative:1298.9,
      theaterCount:1820, theaterChange:-380, perTheater:1264, distributor:"Walt Disney", cinemaScore:"A+", rtScore:88,
      indiaGross:21, indiaNet:15, indiaWeekend:0.3, indiaWeekNo:13,
      ott:{ platform:"Disney+ Hotstar", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"#1 Animated 2025 (global)", countries:15, rightsDeal:"~₹30 Cr (est.)", ottNote:"Disney+ Hotstar — India underperformed vs global blockbuster status." }},
    { title:"Captain America: Brave New World", language:"Hollywood", director:"Julius Onah", releaseDate:"Feb 13, 2026 (India)",
      totalCollection:"46 Cr", totalNum:46, indiaNetStr:"38 Cr", overseas:"2,508 Cr", weeksInTop10:3, status:"OTT", budget:"1,886 Cr", verdict:"Flop",
      note:"India ₹38 Cr net · MCU underperformance · WW $350M",
      weeklyCollection:0, weekNum:5, daysInRelease:7, lastWeekRank:null,
      weeklyNote:"MCU fatigue — India net ₹38 Cr, global WW $350M on $220M budget. FLOP verdict.",
      bogRank:null, bogRankChange:null, usWeekend:0, usCumulative:200.0, intlCumulative:150.0, wwCumulative:350.0,
      theaterCount:0, theaterChange:0, perTheater:0, distributor:"Disney / Marvel", cinemaScore:"B+", rtScore:71,
      indiaGross:46, indiaNet:38, indiaWeekend:0, indiaWeekNo:5,
      ott:{ platform:"Disney+ Hotstar", debutViews:"N/A", debutHours:"N/A", lifetimeViews:"N/A", lifetimeHours:"N/A", globalRank:"N/A", countries:3, rightsDeal:"~₹15 Cr (est.)", ottNote:"Hotstar India — significant MCU underperformance." }},
    { title:"Scream 7",             language:"Hollywood", director:"Kevin Williamson", releaseDate:"Feb 27, 2026",
      totalCollection:"—", totalNum:0, indiaNetStr:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"665 Cr", verdict:"Upcoming",
      note:"Feb 27 — Paramount. Jenna Ortega returns. Horror franchise.",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null,
      weeklyNote:"Releases Feb 27. Horror franchise — limited India appeal expected. US tracking: $35-45M opening.",
      bogRank:null, bogRankChange:null, usWeekend:null, usCumulative:null, intlCumulative:null, wwCumulative:null,
      theaterCount:3500, theaterChange:0, perTheater:null, distributor:"Paramount", cinemaScore:null, rtScore:null,
      indiaGross:null, indiaNet:null, indiaWeekend:null, indiaWeekNo:0,
      ott:{ platform:"TBD (Prime/Netflix expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"TBD", ottNote:"Horror franchise — Netflix deal likely for India post-theatrical." }},
    // ── UPCOMING ──
    { title:"Dhurandhar: The Revenge", language:"Hindi", director:"Aditya Dhar", releaseDate:"Mar 19, 2026", eventTier:"event", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"350 Cr", verdict:"Upcoming", pageUrl:"dhurandhar-2-box-office.html",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null,
      weeklyNote:"Mar 13 Boxoffy Verified: ₹24.76 Cr premiere gross (no blocks) / ₹29.69 Cr with blocks · 4.84L tickets / 9,128 shows · ATP ₹414 · OG ₹25 Cr all-India premiere record BROKEN · WW advance ~₹60 Cr · US $982K+ premiere (678 locations) · NA OW nearing $2M · BMS 7.5k–10k tickets/hr (Taran Adarsh) · Yami Gautam confirmed in cast · Runtime 3h55m · Premieres Mar 18 5PM · Regular India bookings not yet open.",
      openingPrediction:{ low:85, mid:100, high:120, allLanguages:110, basis:"Boxoffy AI Calc — post-trailer advance booking data", note:"Boxoffy AI Calc: ₹15–20 Cr Nett from paid previews (up to ₹30 Cr possible). ₹80–100 Cr Day1 net. ₹350–400 Cr Eid weekend India. ₹500–600 Cr WW 4-day. ₹1,000 Cr India lifetime. ₹1,700–2,000 Cr WW. BMS velocity: 7.5k–10k tickets/hr. ₹4.39 Cr premiere gross in first 2hrs. 1.1L+ premiere tickets. Day1 net floor: ₹85–90 Cr (Boxoffy floor). US: $982K+ premiere pre-sales (678 locations) / NA OW $2M+. OG record BROKEN. WW advance ~₹60 Cr. India regular bookings not yet open — will surge further." },
      ott:{ platform:"Netflix", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"₹150 Cr (confirmed)", ottNote:"Netflix deal confirmed pre-release — sequel to the biggest Indian OTT debut ever" },
      xChatter:[
        { handle:"@rohitjswl01", name:"Rohit Jaiswal", role:"Trade Analyst", color:"#1D4ED8", post:"#Dhurandhar2 Day 1 NET floor is ₹85–90 Cr India. Solo release + Eid + trailer storm = historic opening. Advance booking pace: ALL-TIME. Day1 realistic range ₹90–100 Cr. #BoxOffice", date:"Mar 8, 2026" },
        { handle:"@SumitkadeI", name:"Sumit Kadel", role:"Trade Analyst", color:"#7C3AED", post:"Paid previews alone could hit ₹15–30 Cr Nett. Showcasing is HUGE. ₹80–100 Cr Day1 · ₹1,000 Cr India lifetime. This is history.", date:"Mar 6, 2026" },
        { handle:"@taran_adarsh", name:"Taran Adarsh", role:"Film Critic & Trade", color:"#DC2626", post:"#Dhurandhar2 ALL-TIME RECORD 🔥 Biggest Bollywood premiere advance EVER — breaks Stree 2's ₹8.50 Cr record! ₹9 Cr net premiere gross in 24 hrs. ₹13.26 Cr incl block seats. WW advance ₹34.5 Cr. 10 days still to go. Simply UNSTOPPABLE.", date:"Mar 8, 2026" },
        { handle:"@NishitShawHere", name:"Nishit Shaw", role:"Trade / Overseas", color:"#059669", post:"Dhurandhar 1 — Canada's biggest Indian film ever at $7.71M. Australia best at A$2.46M. Part 2 will be pure CARNAGE.", date:"Mar 7, 2026" },
        { handle:"@Its_CineHub", name:"CineHub", role:"Film Culture", color:"#D97706", post:"The advance booking storm for #Dhurandhar2 is unlike anything since Baahubali 2. ₹100 Cr opening is not a ceiling — it's the FLOOR.", date:"Mar 8, 2026" },
      ]},
    { title:"Toxic: A Fairytale for Grown-ups", language:"Kannada", director:"Geetu Mohandas", releaseDate:"Jun 4, 2026", eventTier:"tentpole", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"300 Cr", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"⚠️ Postponed from Mar 19 to Jun 4, 2026. Makers cited Middle East business concerns amid regional unrest.",
      ott:{ platform:"Amazon Prime Video (expected)", debutViews:"TBD", debutHours:"TBD", lifetimeViews:"TBD", lifetimeHours:"TBD", globalRank:"TBD", countries:0, rightsDeal:"~₹100 Cr (est.)", ottNote:"Yash comeback — OTT rights deal not yet confirmed" }},

    // ── MARCH 2026 ──
    { title:"Awarapan 2", language:"Hindi", director:"TBC", releaseDate:"Apr 3, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Emraan Hashmi sequel to 2007 cult classic. Almost 20 years in the making." },
    { title:"The Paradise", language:"Telugu", director:"Srikanth Odela", releaseDate:"Mar 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Nani in a period drama set in 1980s Secunderabad — marginalized tribe vs systemic oppression. Dir: Srikanth Odela (Dasara)." },
    { title:"Swayambhu", language:"Telugu", director:"TBC", releaseDate:"Apr 10, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Nikhil Siddhartha & Nabha Natesh. Action-period. Apr 10 release." },

    // ── APRIL 2026 ──
    { title:"Bhooth Bangla", language:"Hindi", director:"Priyadarshan", releaseDate:"Apr 10, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"120 Cr", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"TEASER OUT Mar 12 — 55M views in 24 hrs, #2 YouTube India trending (Komal Nahta: ICONIC). Akshay Kumar, Paresh Rawal, Tabu, Wamiqa Gabbi, Rajpal Yadav, Asrani. Horror-comedy. Priyadarshan reunion with Akshay after 14 years (Khatta Meetha 2010). Music: Pritam. Trailer attaching to Dhurandhar 2 from Mar 19. Preponed from May 15 → Apr 10. Produced by Balaji Motion Pictures. Boxoffy note: Will face D2 screen hangover — limited multiplexes through Apr 18." },
    // Tu Meri Main Tera = Dec 25 2025 release, ₹39 Cr India net, Flop — removed from 2026 upcoming
    // Saiyaara was a 2025 film (Jul 18 2025, ₹579 Cr WW) — removed from 2026 upcoming
    { title:"Alpha", language:"Hindi", director:"Shiv Rawail", releaseDate:"Jul 10, 2026", eventTier:"major", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"RELEASE DATE LOCKED: Jul 10, 2026 (YRF official, Mar 9). Moved from Apr 17 to avoid clash with Salman's Battle of Galwan. FIRST female-led YRF Spy Universe film (7th instalment). Cast: Alia Bhatt · Sharvari · Bobby Deol (antagonist, teased War 2 post-credits) · Anil Kapoor (Vikrant Kaul) · Hrithik Roshan (special cameo as Kabir Dhaliwal). Director: Shiv Rawail (The Railway Men). Raw/gritty aesthetic vs earlier glossy Spy Universe films. New poster Mar 9: Alia bruised, battle-hardened. VFX-heavy post-production caused all three delays (Dec 2025 → Apr → Jul). YRF confirmed theatrical-only; dismissed OTT rumours." },
    { title:"Battle of Galwan", language:"Hindi", director:"Apoorva Lakhia", releaseDate:"Aug 14, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Salman Khan, Chitrangada Singh. War drama on 2020 Galwan Valley clash. Moved from Apr 17 → Aug 14, 2026. Clashes with Naagzilla (Kartik Aaryan) on Independence Day weekend." },
    { title:"KD – The Devil", language:"Kannada", director:"TBC", releaseDate:"Apr 14, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Dhruva Sarja, Rachita Ram. Action-drama. Pan-India Kannada biggie. Apr 14." },
    { title:"Ginny Weds Sunny 2", language:"Hindi", director:"TBC", releaseDate:"Apr 24, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Avinash Tiwari, Medha Shankar. Netflix romcom sequel. Apr 24." },

    // ── MAY 2026 ──
    { title:"Ek Din", language:"Hindi", director:"TBC", releaseDate:"May 1, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Sai Pallavi, Junaid Khan. Remake of 2016 Thai film 'One Day'. May 1." },
    { title:"Raja Shivaji", language:"Hindi/Marathi", director:"Riteish Deshmukh", releaseDate:"May 1, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Riteish Deshmukh directs & stars. Historical epic shot in Hindi & Marathi simultaneously. May 1." },
    { title:"Bandar", language:"Hindi", director:"Anurag Kashyap", releaseDate:"May 22, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Bobby Deol. Anurag Kashyap's latest. May 22." },
    { title:"NTR – Neel", language:"Telugu", director:"TBC", releaseDate:"2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Jr NTR's next after RRR. Massive pan-India expectations. Date TBC." },
    { title:"Peddi", language:"Telugu", director:"TBC", releaseDate:"2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Ram Charan's next post-RRR. High anticipation. Date TBC." },

    // ── JUNE 2026 ──
    { title:"Hai Jawani Toh Ishq Hona Hai", language:"Hindi", director:"David Dhawan", releaseDate:"Jun 5, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Varun Dhawan, Mrunal Thakur, Pooja Hegde. David Dhawan directorial. Jun 5." },
    { title:"Cocktail 2", language:"Hindi", director:"Homi Adajania", releaseDate:"Jun 19, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"ANNOUNCED TODAY Mar 13 — Release date Jun 19, 2026 confirmed. First-look posters out. Teaser dropping in theatres Mar 18 (with D2 paid previews). Shahid Kapoor, Rashmika Mandanna, Kriti Sanon. Sequel to 2012 cult romantic drama. Dir: Homi Adajania (same as Cocktail). Produced by Maddock Films (Dinesh Vijan) + Luv Ranjan. Written by Luv Ranjan. Shoot wrapped early 2026. Modern love triangle. Rashmika's first post-wedding film." },
    { title:"Welcome to the Jungle", language:"Hindi", director:"TBC", releaseDate:"Jun 26, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Akshay Kumar. Next instalment of Welcome franchise. Jun 26." },
    { title:"Dragon", language:"Telugu/Hindi", director:"TBC", releaseDate:"Jun 25, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Pan-India action. Jun 25." },

    // ── JULY 2026 ──
    { title:"Dhamaal 4", language:"Hindi", director:"TBC", releaseDate:"Jul 3, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Ajay Devgn comedy franchise. Fourth instalment. Jul 3." },
    { title:"King", language:"Hindi", director:"Siddharth Anand", releaseDate:"Dec 24, 2026", eventTier:"tentpole", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Shah Rukh Khan, Deepika Padukone. Siddharth Anand (Pathaan, War) directs. Christmas 2026." },

    // ── AUGUST 2026 ──
    { title:"Love & War", language:"Hindi", director:"Sanjay Leela Bhansali", releaseDate:"Jan/Feb 2027 (expected)", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Ranbir Kapoor, Alia Bhatt, Vicky Kaushal. SLB's epic war-romance. Shoot wraps Jun 2026, heavy VFX needed. Now targeting Jan/Feb 2027 (Republic Day or Valentine's). 2026 release unlikely." },
    // ── 2027 RELEASES ──
    { title:"Varanasi", language:"Telugu (Pan-India)", director:"SS Rajamouli", releaseDate:"Apr 7, 2027", eventTier:"event", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"1,000–1,200 Cr", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"RELEASE DATE CONFIRMED: Apr 7, 2027 (Ugadi/Gudi Padwa). SS Rajamouli's next after RRR (global phenomenon, Oscar winner). Cast: Mahesh Babu (dual role: Rudhra + Lord Rama) · Priyanka Chopra Jonas (Mandakini — Telugu debut, away from Hindi cinema 7 yrs) · Prithviraj Sukumaran (Kumbha, antagonist). Music: MM Keeravani (Oscar: Naatu Naatu). Budget: ₹1,000–1,200 Cr — most expensive Indian film ever (revenue-share model with cast). IMAX: First Indian film in IMAX 1.43:1 landscape format. TEASER GLOBAL ROLLOUT: Nov 15, 2025 — GlobeTrotter event Ramoji Film City (40,000+ fans, 100×132 ft IMAX screen; covered by Polygon, CinemaBlend, DiscussingFilm, Variety, Inverse) · Jan 5, 2026 — Premiere at Le Grand Rex Paris (world's largest cinema hall) — FIRST Indian film screened there. International reaction: called 'Rajamouli's boldest cinematic universe yet'. James Cameron (Dec 2025 video call) offered to shoot second-unit sequences. STORY: Spans 512 CE to year 2071 (asteroid threat) — Africa, Antarctica, underground Varanasi caves, incorporates actual Ramayana episode. Single film ~3 hrs (NOT two parts — Rajamouli confirmed to ScreenRant). Priyanka Chopra on Fallon: '14 months filming, 6 more to go = 20 months total'. Mahesh Babu wrapped Georgia schedule Mar 10, 2026 — Antarctica next (4th feature film ever to shoot there, 1st Indian). DEALS: Netflix global digital rights (record-breaking). Phars Films ₹160 Cr overseas rights offer (highest-ever Indian film). SkyBlue Cinematix worldwide brand integration deal. 120+ countries theatrical release planned." },
    { title:"Bhediya 2", language:"Hindi", director:"Amar Kaushik", releaseDate:"Aug 14, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Varun Dhawan returns as the werewolf. Maddock Horror Comedy Universe. Aug 14." },
    { title:"Naagzilla", language:"Hindi", director:"TBC", releaseDate:"Aug 14, 2026", eventTier:"tentpole", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Kartik Aaryan as shape-shifting snake (Ichhadhari Naag). Aug 14 — confirmed I-Day clash with Battle of Galwan (Salman Khan) and Bhediya 2." },
    { title:"Fauji / Fauzi", language:"Hindi", director:"TBC", releaseDate:"Aug 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Prabhas. Expected Aug/I-Day 2026 window. Details TBC." },
    { title:"Billa Ranga Baasha", language:"Kannada", director:"TBC", releaseDate:"2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Kiccha Sudeep. Pan-India Kannada biggie. Date TBC." },
    { title:"Khalifa", language:"Malayalam", director:"TBC", releaseDate:"2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Prithviraj Sukumaran. Mollywood biggie. Date TBC." },
    { title:"Patriot", language:"Malayalam", director:"TBC", releaseDate:"2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Mammootty, Mohanlal, Fahadh Faasil, Kunchacko Boban. Pan-Malayalam event film. Date TBC." },
    { title:"Kattalan", language:"Malayalam/Pan-India", director:"Paul George", releaseDate:"2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Antony Varghese. Pan-Indian action thriller. Cubes Entertainments. Date TBC." },

    // ── DIWALI / Q4 2026 ──
    { title:"Ramayana: Part One", language:"Hindi", director:"Nitesh Tiwari", releaseDate:"Diwali 2026", eventTier:"event", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"PART 1 EDIT LOCKED. VFX underway (DNEG — 8x Oscar winner). Part 2 ALREADY SHOOTING — Ranbir started Mumbai schedule, Sunny Deol joins Mar 20. Teaser premiered at GlobeTrotter event Nov 15 2025, Ramoji Film City. Trailer eyeing San Diego Comic-Con July 2026 for global platform. Release: Diwali 2026 (Nov 8 expected) / Part 2 Diwali 2027. Budget: ₹835–1,600 Cr (most expensive Indian film ever). Stars: Ranbir Kapoor (Ram) · Yash (Ravana, co-producer) · Sai Pallavi (Sita) · Sunny Deol (Hanuman) · Ravi Dubey (Lakshman) · Arun Govil (Dasharatha) · Lara Dutta (Kaikeyi). Music: AR Rahman + Hans Zimmer. IMAX format — first Indian film in 1.43:1 IMAX. Produced: Prime Focus Studios (Namit Malhotra) + Monster Mind Creations.",
      xChatter:[
        { handle:"@taran_adarsh", name:"Taran Adarsh", role:"Film Critic & Trade", color:"#DC2626", post:"#Ramayana is not just a film — it is a cinematic event. Nitesh Tiwari + Ranbir Kapoor + Yash + Sai Pallavi. Diwali 2026 is already booked.", date:"2025" },
        { handle:"@rohitjswl01", name:"Rohit Jaiswal", role:"Trade Analyst", color:"#1D4ED8", post:"Ramayana Part 1 is the most anticipated Indian film since Baahubali 2. ₹500 Cr opening weekend is in the conversation. India will stop.", date:"Jan 2026" },
        { handle:"@kooimoi", name:"Koimoi", role:"Trade Publication", color:"#7C3AED", post:"Ranbir as Ram, Yash as Ravana — the casting alone is a cultural moment. Ramayana could redefine the scale ceiling for Indian cinema.", date:"2025" },
      ]},
    { title:"Drishyam 3", language:"Hindi/Malayalam", director:"TBC", releaseDate:"Oct 2, 2026", eventTier:"tentpole", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Ajay Devgn returns as Vijay Salgaonkar. Gandhi Jayanti weekend. Oct 2.",
      xChatter:[
        { handle:"@taran_adarsh", name:"Taran Adarsh", role:"Film Critic & Trade", color:"#DC2626", post:"Drishyam 3 — Ajay Devgn is back as Vijay Salgaonkar. Gandhi Jayanti 2026. The franchise has never disappointed.", date:"2025" },
        { handle:"@rohitjswl01", name:"Rohit Jaiswal", role:"Trade Analyst", color:"#1D4ED8", post:"Drishyam franchise = guaranteed ₹200 Cr+ India. Part 3 with the goodwill of Parts 1 & 2? Could be their biggest yet.", date:"2025" },
      ]},
    { title:"Mirzapur – The Film", language:"Hindi", director:"TBC", releaseDate:"Sep 4, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Amazon Prime megahit Mirzapur comes to the big screen. Sep 4." },
    { title:"Chamunda", language:"Hindi", director:"TBC", releaseDate:"Dec 4, 2026", totalCollection:"—", totalNum:0, indiaNet:"—", overseas:null, weeksInTop10:0, status:"Upcoming", budget:"TBC", verdict:"Upcoming",
      weeklyCollection:0, weekNum:0, daysInRelease:0, lastWeekRank:null, weeklyNote:"Maddock Horror Comedy Universe. Dec 4." },
  ],
};


/* ── US BOX OFFICE WEEKLY DATA ───────────────────────────── */
const US_BO_WEEKLY = {
    "Week 11, 2026": {
    dateRange: "Mar 13–15, 2026",
    headline: "Hoppers Holds + Reminders of Him Opens — Pre-Dhurandhar 2 Calm",
    subline: "Reminders of Him (Colleen Hoover #3) tracking $13M+ · A24's Undertone $9M+ (Friday 13th horror) · Hoppers $27M (Wk2) · Project Hail Mary looms next week",
    source: "Deadline · Boxoffice Pro · Gold Derby · The Wrap · The Numbers (projections as of Mar 13)",
    chart: [
      { rank:1,  title:"Hoppers",            studio:"Disney/Pixar",   weekend:"$27M (proj)",  weekendNum:27,   total:"$72M (proj)",   totalNum:72,    weeks:2, theaters:4000, change:"-40%",  genre:"Animation",    rtScore:"94%", admitsNote:"Spring break tailwind begins" },
      { rank:2,  title:"Reminders of Him",   studio:"Universal",      weekend:"$13M (proj)",  weekendNum:13,   total:"$13M (proj)",   totalNum:13,    weeks:1, theaters:3402, change:"NEW",   genre:"Romance/Drama",rtScore:"81%", admitsNote:"Colleen Hoover #3. $1.9M Thu previews." },
      { rank:3,  title:"Undertone",          studio:"A24",            weekend:"$9M (proj)",   weekendNum:9,    total:"$9M (proj)",    totalNum:9,     weeks:1, theaters:2750, change:"NEW",   genre:"Horror",       rtScore:"89%", admitsNote:"$500K budget. Friday 13th timing. $1M Thu." },
      { rank:4,  title:"Scream 7",           studio:"Paramount",      weekend:"$8M (proj)",   weekendNum:8,    total:"$102M (proj)",  totalNum:102,   weeks:3, theaters:3243, change:"-53%",  genre:"Horror",       rtScore:"81%", admitsNote:"Crosses $100M domestic this weekend" },
      { rank:5,  title:"GOAT",               studio:"Sony",           weekend:"$5M (proj)",   weekendNum:5,    total:"$82M (proj)",   totalNum:82,    weeks:4, theaters:2946, change:"-29%",  genre:"Animation",    rtScore:"88%", admitsNote:"Solid legs for family film" },
      { rank:6,  title:"The Bride!",         studio:"Warner Bros.",   weekend:"$3M (proj)",   weekendNum:3,    total:"$12M (proj)",   totalNum:12,    weeks:2, theaters:3304, change:"-70%",  genre:"Horror/Drama", rtScore:"68%", admitsNote:"Maggie Gyllenhaal. Bombed. -70% drop." },
      { rank:7,  title:"Wuthering Heights",  studio:"Warner Bros.",   weekend:"$3M (proj)",   weekendNum:3,    total:"$78M (proj)",   totalNum:78,    weeks:4, theaters:2800, change:"-40%",  genre:"Romance",      rtScore:"79%", admitsNote:"Strong legs for prestige romance" },
      { rank:8,  title:"Crime 101",          studio:"Amazon MGM",     weekend:"$2M (proj)",   weekendNum:2,    total:"$33M (proj)",   totalNum:33,    weeks:4, theaters:2000, change:"-38%",  genre:"Crime",        rtScore:"72%", admitsNote:"Steady holdover" },
      { rank:9,  title:"Send Help",          studio:"Focus Features", weekend:"$1.5M (proj)", weekendNum:1.5,  total:"$50M (proj)",   totalNum:50,    weeks:6, theaters:1600, change:"-35%",  genre:"Comedy",       rtScore:"83%", admitsNote:"Quiet long-legger" },
      { rank:10, title:"Slanted",            studio:"Bleecker Street",weekend:"$1M (proj)",   weekendNum:1,    total:"$1M (proj)",    totalNum:1,     weeks:1, theaters:588,  change:"LTD",   genre:"Drama",        rtScore:"91%", admitsNote:"SXSW prize winner. Limited." },
    ]
  },

  "Week 10, 2026": {
    dateRange: "Mar 6–8, 2026",
    headline: "Pixar Back With a Bang — Hoppers Leads Strong $91M Weekend",
    subline: "Best Pixar original opening since Coco (2017) · Scream 7 crosses $90M domestic · The Bride! bombs",
    source: "Box Office Mojo · Variety · Deadline · BoxofficePro",
    chart: [
      { rank:1,  title:"Hoppers",           studio:"Disney/Pixar",   weekend:"$41.2M",  weekendNum:41.2,  total:"$41.2M",  totalNum:41.2,   weeks:1,  theaters:4000, change:"NEW",   genre:"Animation", rtScore:"94%", admitsNote:"~4.7M admits est." },
      { rank:2,  title:"Scream 7",          studio:"Paramount",      weekend:"$16.3M",  weekendNum:16.3,  total:"$92.3M",  totalNum:92.3,   weeks:2,  theaters:3540, change:"-74%",  genre:"Horror",    rtScore:"81%", admitsNote:"~1.9M admits est." },
      { rank:3,  title:"The Bride!",        studio:"Warner Bros.",   weekend:"$8.1M",   weekendNum:8.1,   total:"$8.1M",   totalNum:8.1,    weeks:1,  theaters:3200, change:"NEW",   genre:"Horror/Drama", rtScore:"68%", admitsNote:"~0.9M admits est." },
      { rank:4,  title:"GOAT",              studio:"Sony",           weekend:"$7.0M",   weekendNum:7.0,   total:"$77.1M",  totalNum:77.1,   weeks:3,  theaters:3707, change:"-27%",  genre:"Animation", rtScore:"88%", admitsNote:"~0.8M admits est." },
      { rank:5,  title:"Wuthering Heights", studio:"Warner Bros.",   weekend:"$4.8M",   weekendNum:4.8,   total:"$75.0M",  totalNum:75.0,   weeks:3,  theaters:3221, change:"-51%",  genre:"Romance",   rtScore:"79%", admitsNote:"~0.5M admits est." },
      { rank:6,  title:"Crime 101",         studio:"Amazon MGM",     weekend:"$3.2M",   weekendNum:3.2,   total:"$31.5M",  totalNum:31.5,   weeks:3,  theaters:2607, change:"-36%",  genre:"Crime",     rtScore:"72%", admitsNote:"~0.4M admits est." },
      { rank:7,  title:"EPiC: Elvis Presley in Concert", studio:"NEON", weekend:"$2.8M", weekendNum:2.8, total:"$9.4M", totalNum:9.4,  weeks:2,  theaters:1963, change:"+19%",  genre:"Concert",   rtScore:"N/A", admitsNote:"~0.3M admits est." },
      { rank:8,  title:"Send Help",         studio:"Focus Features", weekend:"$2.1M",   weekendNum:2.1,   total:"$48.2M",  totalNum:48.2,   weeks:5,  theaters:1820, change:"-38%",  genre:"Comedy",    rtScore:"83%", admitsNote:"~0.2M admits est." },
      { rank:9,  title:"Peaky Blinders: The Immortal Man", studio:"Netflix/Mubi", weekend:"$1.4M", weekendNum:1.4, total:"$1.4M", totalNum:1.4, weeks:1, theaters:412, change:"LTD", genre:"Crime Drama", rtScore:"92%", admitsNote:"Limited" },
      { rank:10, title:"Avatar: Fire & Ash", studio:"Disney",        weekend:"$1.1M",   weekendNum:1.1,   total:"$426.0M", totalNum:426.0,  weeks:12, theaters:980,  change:"-22%",  genre:"Sci-Fi",    rtScore:"79%", admitsNote:"~0.1M admits est." },
    ]
  }
};


/* ── EDITORIALS — FROM THE DESK stacked list ────────────────────
   Add newest article at the TOP of the array.
   Top 3 show as numbered rows ①②③. Rest go to ARCHIVE.
   Fields: tag, headline, dek (lead only), author, date, readTime, url
─────────────────────────────────────────────────────────────── */
const EDITORIALS = [
  {
    tag: "US BOX OFFICE",
    headline: "Dhurandhar 2 Has Already Eaten the US Chart. $3.65M and Counting.",
    dek: "$982K+ premiere · $1.8M opening day · $3.65M weekend advance · Fastest Indian film to $1M NA · Boxoffy predicts #4 finish on the US Top 10 alongside Project Hail Mary.",
    author: "The Boxoffy Team",
    date: "Mar 13, 2026",
    readTime: "3 min read",
    url: "dhurandhar2-us-boxoffice.html",
  },
  {
    tag: "ADVANCE BOOKING",
    headline: "Dhurandhar 2 The Revenge Advance Booking — ₹29.69 Crore and the OG Record Is BROKEN",
    dek: "4.84 lakh tickets. 9,128 shows. WW advance ~₹60 Cr. US $982K+. Taran Adarsh: 7,500–10,000 tickets/hr on BMS. The OG ₹25 Cr all-India premiere record: GONE.",
    author: "The Boxoffy Team",
    date: "Mar 13, 2026",
    readTime: "2 min read",
    url: "dhurandhar2-advance-article.html",
  },
  {
    tag: "DEEP DIVE",
    headline: "Bollywood Box Office Explained — How Producers, Distributors & Exhibitors Share Your Ticket Money",
    dek: "Who keeps your ₹300 PVR ticket? The complete guide to how Indian cinema's money chain works — from the producer's budget to PVR vs Raj Mandir revenue splits, the MG model, and why Week 1 changes everything.",
    author: "The Boxoffy Team",
    date: "Mar 10, 2026",
    readTime: "15 min read",
    url: "india-boxoffice-how-it-works.html",
  },
  {
    tag: "ANALYSIS",
    headline: "Dhurandhar 2 The Revenge Pre-Release Analysis — Ladies and Gentlemen, You Are STILL Not Ready",
    dek: "₹80–100 Cr Day 1. 5 languages. The biggest commercial bet Indian cinema has made since Pushpa 2. Boxoffy's full pre-release breakdown.",
    author: "The Boxoffy Team",
    date: "Mar 8, 2026",
    readTime: "6 min read",
    url: "dhurandhar2-editorial.html",
  },
  {
    tag: "PRICING ANALYSIS",
    headline: "Dhurandhar 2 Is Not Just Bigger. It Is Priced Bigger.",
    dek: "From ₹307 to ₹414 ATP — a 34.9% jump in pricing power. What equal footfalls would mean for the gross. The ATP math, seat mix logic, and why runtime changes everything.",
    author: "The Boxoffy Team",
    date: "Mar 13, 2026",
    readTime: "5 min read",
    url: "dhurandhar-comparison.html",
  },
];

/* ── FEATURED EDITORIAL ─────────────────────────────────────────
   Update this object each time you publish a new piece.
   Set to null to hide the strip entirely.
─────────────────────────────────────────────────────────────── */
const FEATURED_EDITORIAL = {
  tag: "BREAKING",
  headline: "OG Record Gone. D2 Advance ₹29.69 Cr — 6 Days to History.",
  dek: "4.84 lakh tickets. WW advance ~₹60 Cr. Taran Adarsh: UNSTOPPABLE. Nishit Shaw: overseas will EXCEED Part 1. The countdown to March 19 is on.",
  author: "Boxoffy Editorial",
  date: "Mar 13, 2026",
  readTime: "6 min read",
  // url: opens article in new tab. Set to null to navigate to section instead.
  url: "dhurandhar2-editorial.html",
};

const YEAR_NOTES = {
  2020: "COVID-19 shut theatres from March 2020. Only Jan–Feb films had a full run; the rest went direct to OTT.",
  2021: "Theatres ran at 50% capacity for most of the year. Pushpa: The Rise showed pan-India appeal was still very much alive.",
  2022: "Box office roared back. RRR & KGF Chapter 2 both crossed ₹1,200 Cr WW — a watershed moment for Indian cinema globally.",
  2023: "Unprecedented year — five films crossed ₹600 Cr. Jawan, Pathaan, Animal and Gadar 2 rewrote Hindi film records.",
  2024: "Pushpa 2 shattered every record at ₹1,800 Cr WW. Stree 2 delivered the surprise of the year at ₹672 Cr.",
  2025: "Dhurandhar became the highest-grossing Hindi film ever. Chhaava dominated the first quarter with ₹807.91 Cr WW. Dhurandhar: The Revenge advance crosses ₹60 Cr WW with OG record BROKEN.",
  2026: "Live data — Week 12, Mar 13, 2026. D2 advance: ₹29.69 Cr (with blocks) / ₹24.76 Cr (no blocks) / 4.84L tickets / OG record BROKEN / WW ~₹60 Cr. Border 2 → Netflix Mar 20. O Romeo CLOSED (Flop ₹80.9 Cr). D1 Day 100 re-release today. D2 releases Mar 19.",
};

/* ── ARTICLES DATA ────────────────────────────────────────── */
// url: null = Boxoffy original (opens in-page modal), string = opens external source in new tab
const ARTICLES = {
  Bollywood: [
    { tag:"BREAKING", time:"Now", hot:true, source:"Bollywood Hungama",
      url:"https://www.bollywoodhungama.com/news/bollywood/cocktail-2-first-look-drop-march-18-likely-attached-paid-previews-dhurandhar-revenge/",
      headline:"Cocktail 2 First Look Teaser Drops March 18 — Attached to Dhurandhar 2 Paid Previews",
      summary:"Maddock Films released character posters of Shahid Kapoor, Kriti Sanon and Rashmika Mandanna today (Mar 13). The teaser will premiere in cinemas on Mar 18 alongside Dhurandhar 2 paid previews — same date Ranveer Singh and Shahid Kapoor screen together for the first time since Padmaavat." },
    { tag:"Bhooth Bangla", time:"3h ago", hot:true, source:"Box Office Worldwide",
      url:"https://boxofficeworldwide.com/movies-latest-news/bhooth-bangla-teaser-55-million-views-youtube-india-no-2/",
      headline:"Bhooth Bangla Teaser Hits 55M Views — #2 on YouTube India for 24+ Hours",
      summary:"Akshay Kumar and Priyadarshan's reunion horror-comedy teaser has crossed 55 million views and held #2 on YouTube India trending for over 24 hours. Komal Nahta called it 'ICONIC'. Trailer attached to Dhurandhar 2 prints from Mar 19. Cast: Akshay Kumar, Tabu, Paresh Rawal, Rajpal Yadav, Wamiqa Gabbi. Apr 10, 2026 release." },
    { tag:"D2 Screens", time:"5h ago", hot:true, source:"Sacnilk",
      url:"https://sacnilk.com/news/Dhurandhar_2_The_Revenge_Euphoria_To_Hit_Bhooth_Bangla_as_Jio_Studios_Demand_6Week_Exclusive_Release_In_Single_Screens",
      headline:"Jio Studios Demands 6-Week Exclusive Single-Screen Run for Dhurandhar 2 — Bhooth Bangla Could Be Hit",
      summary:"Jio Studios has reportedly asked single-screen exhibitors to dedicate all shows to Dhurandhar 2 for 6 weeks — a highly unusual demand (norm is 1–3 weeks). Raja Shivaji gets additional 2-week exclusive ask. Bhooth Bangla (Apr 10) faces potential screen shortage if demand is met." },
    { tag:"D2 Preview", time:"8h ago", hot:true, source:"Boxoffy Verified",
      url:"/dhurandhar2-advance-article.html",
      headline:"D2 Advance: ₹29.69 Cr India · 4.84L Tickets · OG Record BROKEN · WW ~₹60 Cr",
      summary:"Mar 13, 12PM data: ₹24.76 Cr premiere gross (no blocks), ₹29.69 Cr with blocks, 4.84 lakh tickets across 9,128 shows. OG all-India premiere record (₹25 Cr) officially broken. US $982K+ premiere / $1.8M opening day / $3.65M weekend advance. Regular India show bookings yet to open." },
    { tag:"Alpha", time:"2d ago", hot:false, source:"Bollywood Hungama",
      url:"https://www.bollywoodhungama.com/news/bollywood/alia-bhatt-sharvari-starrer-alpha-locks-july-10-2026-theatrical-release/",
      headline:"Alpha Locks July 10, 2026 — Moved From Apr 17 to Avoid Battle of Galwan Clash",
      summary:"YRF officially announced Jul 10 release (Mar 9). Alia Bhatt confirmed on Instagram: #ALPHA 10.07.2026. First female-led YRF Spy Universe film. Cast: Alia Bhatt, Sharvari, Bobby Deol (villain), Anil Kapoor, Hrithik Roshan (cameo). Director: Shiv Rawail. VFX-heavy — third delay since Dec 2025." },
    { tag:"Analysis", time:"3d ago", hot:false, source:null, url:"/dhurandhar-comparison.html",
      headline:"Boxoffy: D2 Is Not Just Bigger. It Is Priced Bigger. The ATP Math Explained.",
      summary:"From ₹307 to ₹414 ATP — a 34.9% pricing jump. Equal footfalls would imply ₹874 Cr India domestic for D2. We break down seat mix, runtime economics, yield optimization and why the ₹3,100 luxury ticket is not the whole story." }
  ],
  OTT: [
    { tag:"LIVE Mar 20", time:"Now", hot:true, source:"India TV News",
      url:"https://www.indiatvnews.com/entertainment/ott/border-2-ott-release-date-know-when-and-where-to-stream-sunny-deol-varun-dhawan-war-drama-online-2026-03-13-1033679",
      headline:"Border 2 Arrives on Netflix March 20 — Same Day as Dhurandhar 2's Wide Release",
      summary:"Sunny Deol's ₹481.76 Cr WW blockbuster hits Netflix tomorrow (Mar 20), sharing the date with Dhurandhar 2's full release. Netflix confirmed the date on-platform; official poster still awaited from makers. Budget ₹275 Cr. Verdict: Super Hit. Border 3 already confirmed." },
    { tag:"Netflix Mar 27", time:"6h ago", hot:true, source:"Sacnilk",
      url:"https://www.sacnilk.com/news/Mardaani_3_OTT_Release_Date_Rani_Mukerjis_Action_Thriller_Set_for_Netflix_Premiere",
      headline:"Mardaani 3 Streams on Netflix March 27 — 56-Day Theatrical Window Respected",
      summary:"YRF's cop thriller closes its theatrical run at ₹50.78 Cr net / ₹75.10 Cr WW and heads to Netflix Mar 27, midnight IST. Exactly 8 weeks after Jan 30 release. Franchise's third instalment beat the original (₹35.65 Cr net) handily. Streaming in Hindi + South Indian dubbed versions." },
    { tag:"JioHotstar", time:"10h ago", hot:false, source:"Boxoffy",
      url:null,
      headline:"Dhurandhar 2 OTT Deal: JioHotstar at ₹130 Cr — Streaming Window Expected Late May",
      summary:"Unlike Part 1's Netflix deal (₹175 Cr), D2 lands on JioHotstar in a reported ₹130 Cr arrangement. Reflects shorter post-theatrical window and makers' confidence in a sustained theatrical run. Streaming premiere expected late May–early June 2026, giving roughly 8–10 weeks of pure theatrical." },
    { tag:"Panchayat S5", time:"1d ago", hot:true, source:"Prime Video / TVF",
      url:"https://theindianeye.com/2025/07/08/prime-videos-panchayat-season-4-achieves-record-breaking-success-season-5-confirmed-for-2026/",
      headline:"Panchayat Season 5 Confirmed for 2026 — TVF Returns to Phulera After Record S4",
      summary:"Prime Video officially confirmed Panchayat Season 5 is in development after Season 4 (Jun 24, 2025) trended #1 in India and Top 10 in 42 countries. Streamed across 95% of India's pin codes in Week 1. Full cast returns: Jitendra Kumar, Neena Gupta, Raghubir Yadav, Sanvikaa. No release date yet but 2026 confirmed." },
    { tag:"Analysis", time:"2d ago", hot:false, source:null, url:null,
      headline:"Boxoffy OTT Watch: Netflix Dominates Q1 2026 as Prime Holds with Panchayat, JioHotstar Bets on IPL",
      summary:"Border 2 (Netflix Mar 20) + Mardaani 3 (Netflix Mar 27) gives the platform back-to-back big arrivals in the same week. JioHotstar counters with D2's OTT deal + IPL. Prime Video holds steady on Panchayat loyalty. The streaming war in India's Q1 2026 is being decided by theatrical spillover." }
  ],
  TV: [
    { tag:"BARC Wk8", time:"4d ago", hot:true, source:"Filmy Masala Now",
      url:"https://www.filmymasalanow.in/hindi-t-v-serials-trp/",
      headline:"BARC Week 8 2026: Kyunki Saas Bhi Kabhi Bahu Thi 2 Holds #1 — Tum Se Tum Tak Continues Strong",
      summary:"Star Plus dominates with Kyunki S2 at #1. Anupamaa solid at #2. Colors' Naagin 7 holds top 3. ZEE TV's Tum Se Tum Tak and Ganga Mai Ki Betiyaan performing strongly. IPL expected to dent GEC prime-time numbers from late March onwards as cricket eyeballs shift to JioHotstar." },
    { tag:"IPL Alert", time:"Now", hot:true, source:"Boxoffy",
      url:null,
      headline:"IPL 2026 Begins March 22 — Hindi GEC Channels Brace for Prime-Time Ratings Drop",
      summary:"IPL Season 19 kicks off Mar 22 exclusively on JioHotstar. Star Plus, Colors, Zee TV historically see 15–25% GEC prime-time drops during IPL months. The 10-week tournament runs until end of May. Drama serials shifting to 9–10 PM slots to avoid direct competition with 7:30 PM matches." },
    { tag:"Panchayat S5", time:"1d ago", hot:false, source:"Prime Video",
      url:"https://theindianeye.com/2025/07/08/prime-videos-panchayat-season-4-achieves-record-breaking-success-season-5-confirmed-for-2026/",
      headline:"Panchayat Season 5 in 2026 — The Show That Proved OTT Originals Beat Linear TV",
      summary:"TVF's Panchayat S4 (Jun 2025) trended Top 10 in 42 countries and across 95% of India's pin codes. S5 confirmed. The series has effectively migrated India's most loyal drama audience from Saturday night Star Plus to Prime Video appointment viewing — a structural shift for the GEC business." },
    { tag:"Filmfare 2026", time:"3d ago", hot:false, source:"Bollywood Hungama",
      url:"https://www.bollywoodhungama.com/news/bollywood/",
      headline:"71st Filmfare Awards — Dhurandhar Leads Nominations; Cross-Industry Competition Highest Ever",
      summary:"Dhurandhar (2025) leads Hindi film nominations. First time Telugu and Hindi films battle across all major categories in a single year — reflecting 2025's pan-India box office reality. Ceremony date to be announced post-IPL season." },
    { tag:"Analysis", time:"5d ago", hot:false, source:null, url:null,
      headline:"Boxoffy TV Watch: The GEC Squeeze — Why Star Plus Needs a Blockbuster and OTT Has Already Won Thursday Nights",
      summary:"Appointment viewing has decisively moved to OTT for the 18–35 demographic. GEC channels now fight for 35+ audiences and rural markets. With IPL arriving and Panchayat S5 confirmed, the platform war in India enters its most competitive phase yet." }
  ]
};

// Source → badge colour map
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

/* ── FOOTNOTE REGISTRY ──────────────────────────────────────────
   All external sources cited on Boxoffy are referenced by footnote
   number only in the UI — source names do not appear inline.
────────────────────────────────────────────────────────────────── */
const FOOTNOTES = [
  { n:1,  label:"Trade industry data sources (domestic box office collection tracking)" },
  { n:2,  label:"Industry publication — film trade analytics & box office reporting" },
  { n:3,  label:"Multiplex industry body — all-India average ticket price data" },
  { n:4,  label:"Annual Indian theatrical market report — gross collections & admissions 2025" },
  { n:5,  label:"Multiplex chain quarterly financial results (Q2 & Q3 FY26) — ATP & footfall data" },
  { n:6,  label:"Boxoffy AI Calc — opening projections derived from advance booking velocity, screen count & historical comp analysis" },
  { n:7,  label:"Central Board of Indirect Taxes & Customs — GST rate notifications" },
  { n:8,  label:"GST Council press releases — rate revision announcements" },
  { n:9,  label:"Film certification board records — runtime, certificate, release details" },
  { n:10, label:"Overseas box office tracking services — North America, Australia, UK pre-sales" },
  { n:11, label:"Online ticketing platform — advance booking velocity & premiere data" },
  { n:12, label:"OTT platform viewership disclosures — debut week hours & rankings" },
];

// Map source string → footnote number(s)
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

// Superscript footnote reference — renders as ¹ ² etc.
function Fn({ n, style = {} }) {
  if (!n) return null;
  const sup = String(n).split("").map(d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[parseInt(d)]).join("");
  return (
    <sup style={{
      fontFamily:"'DM Sans',sans-serif", fontSize:8, color:"#9CA3AF",
      letterSpacing:0, verticalAlign:"super", lineHeight:0,
      cursor:"default", userSelect:"none",
      ...style,
    }} title={FOOTNOTES.find(f=>f.n===n)?.label || ""}>{sup}</sup>
  );
}

// FootnotesBar — renders the full footnote list, used at bottom of panels/sections
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
        const sup = String(f.n).split("").map(d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[parseInt(d)]).join("");
        return (
          <span key={f.n} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#B0A8A0", lineHeight:1.6 }}>
            <span style={{ color:"#9CA3AF", fontWeight:700 }}>{sup}</span> {f.label}
          </span>
        );
      })}
    </div>
  );
}

/* ── WEEKLY COMMENTARY DATA ────────────────────────────────── */
const WEEKLY_COMMENTARY = [
  {
    weekNum: "Week 12, 2026",
    dateRange: "Mar 7 – Mar 13, 2026",
    headline: "OG Record BROKEN — Dhurandhar 2 Rewrites Every Premiere Benchmark",
    subline: "₹29.69 Cr (with blocks) · 4.84L tickets · WW ~₹60 Cr · US $982K+ · Taran Adarsh: 7,500–10,000 tickets/hr on BMS · 6 days to release",
    status: "current",
    scoreboard: [
      { film:"Dhurandhar 2: The Revenge", week:"6 days to release", wkCollection:"—", total:"Premiere advance ₹24.76 Cr (no blocks) / ₹29.69 Cr with blocks · WW ~₹60 Cr", verdict:"OG all-India premiere record BROKEN ✅ | Day 1 target ₹85–100 Cr+", color:"#C8201A" },
      { film:"Thaai Kizhavi", week:"Wk 3 (Day 15)", wkCollection:"~₹3 Cr (Wk3)", total:"~₹43 Cr net / ~₹58 Cr WW", verdict:"Super Hit — ROI 357% — #2 Tamil 2026", color:"#16A34A" },
      { film:"The Kerala Story 2", week:"Wk 3 (Day 15)", wkCollection:"~₹2 Cr (Wk3)", total:"~₹39 Cr net / ~₹46 Cr WW", verdict:"Average — budget recovered — closing before D2", color:"#D97706" },
      { film:"O'Romeo", week:"Wk 5 (CLOSED)", wkCollection:"~₹33 lakh (Day 25)", total:"₹80.90 Cr net / ~₹110 Cr WW", verdict:"FLOP — ₹150 Cr budget, 54% recovered. OTT: Amazon Prime", color:"#EF4444" },
      { film:"Border 2", week:"CLOSED → OTT", wkCollection:"—", total:"₹424 Cr net / ₹481.76 Cr WW", verdict:"Super Hit — OTT Netflix Mar 20. Border 3 confirmed.", color:"#16A34A" },
      { film:"Mardaani 3", week:"OTT (Amazon)", wkCollection:"—", total:"₹50.78 Cr net / ₹75.10 Cr WW", verdict:"Flop — Amazon Prime ~Mar 27", color:"#EF4444" },
      { film:"120 Bahadur", week:"Wk 1 (NEW)", wkCollection:"₹8.6 Cr WW Day 1 (early)", total:"₹8.6 Cr (Day 1)", verdict:"Flop — Sriram Raghavan. Budget ₹50 Cr. Slow start.", color:"#EF4444" },
      { film:"Dhurandhar (re-release)", week:"Day 100 (TODAY)", wkCollection:"1,000 screens globally", total:"₹838.5 Cr net / ₹1,305.35 Cr WW", verdict:"All-Time Blockbuster — Final theatrical run before sequel", color:"#B8860B" },
    ],
    sources: [
      {
        name:"Taran Adarsh",
        handle:"@taran_adarsh",
        color:"#DC2626",
        quote:"DHURANDHAR 2 SIMPLY UNSTOPPABLE — OG Record BROKEN",
        analysis:"Taran Adarsh confirmed on X that Dhurandhar 2 paid preview bookings opened at a blazing 7,500 to 10,000 tickets per hour on BookMyShow — a pace he called simply UNSTOPPABLE. The film crossed ₹24.76 crore premiere gross without blocked seats, shattering Pawan Kalyan's OG record of ₹25 crore which was the highest all-India premiere collection ever. With blocked seats the total stands at ₹29.69 crore. US premiere advance crossed $982K across 678 locations, overtaking Animal's all-time Bollywood US premiere record. Worldwide advance is approximately ₹60 crore, and India's regular show bookings have not even opened yet — that surge is still ahead."
      },
      {
        name:"Nishit Shaw",
        handle:"@NishitShawHere",
        color:"#059669",
        quote:"Overseas will EXCEED Part 1 — pure CARNAGE in North America",
        analysis:"Trade and overseas analyst Nishit Shaw confirmed that Dhurandhar 2 premiere advance in North America is nearing $2 million for the opening weekend — a historic pace for a Hindi film. PLF and IMAX Wednesday shows in the US and Canada have already sold out across multiple locations (Variety). He noted that Part 1 set all-time records for a Hindi film in Canada ($7.71M) and Australia (A$2.46M), and current tracking puts Part 2 30 to 40 percent higher across all key overseas markets. The WW advance of ₹60 crore is the highest for any Bollywood premiere in history."
      },
      {
        name:"Sacnilk / Box Office India",
        handle:"@sacnilk",
        color:"#0369A1",
        quote:"4.84 lakh tickets / 9,128 shows / ATP ₹414 — Boxoffy Verified Mar 13",
        analysis:"Sacnilk's real-time tracking as of March 13 at 12 PM confirms 4,84,627 tickets sold across 9,128 premiere shows in India. The average ticket price of ₹414 reflects the premium pricing strategy — INOX Mumbai Recliner Prime at ₹2,900 vs AGS Cinemas Chennai at ₹59, a remarkable price spread that maximises both revenue and volume. PVR INOX CEO Gautam Dutta confirmed 1.5 lakh+ tickets in PVR INOX alone, calling it a big screen celebration. Dhurandhar 1 completed its 100th day on March 13 and simultaneously re-released across 1,000 screens globally — the first time in Indian cinema history that a prequel has run continuously until its sequel's launch."
      },
    ],
    interval_take: "The week belonged entirely to Dhurandhar 2. Every day brought a new record. The OG premiere record — long held by Pawan Kalyan's OG — is gone. The Stree 2 Bollywood premiere record was already broken earlier this week. The worldwide advance is ₹60 crore and climbing, with India's regular show bookings not yet open. Taran Adarsh called the velocity UNSTOPPABLE. Nishit Shaw says overseas will exceed Part 1. Boxoffy's floor remains ₹85–90 Cr Day 1 net. The rest of the market is in standby — 120 Bahadur released today to little fanfare, O Romeo has quietly closed at ₹80.9 Cr as a confirmed Flop, and Border 2 moves to Netflix on March 20. The industry holds its breath for March 18 previews.",
    nextWeek: "Mar 18 — Dhurandhar 2 paid previews (5PM). Mar 19 — Dhurandhar 2 worldwide release (Eid + Gudi Padwa + Ugadi). Border 2 on Netflix. Aadu 3 (Malayalam) also releasing. This is the biggest Indian opening since Baahubali 2.",
  },
  {
    weekNum: "Week 11, 2026",
    dateRange: "Feb 28 – Mar 6, 2026",
    headline: "Dhurandhar 2 Advance Storm Begins — 3.56L Tickets in 4 Days",
    subline: "Kerala Story 2 opens despite legal battles · Thaai Kizhavi surprises with word of mouth · D2 advance breaks Stree 2 premiere record",
    status: "archived",
    scoreboard: [
      { film:"Dhurandhar 2: The Revenge", week:"Advance opens", wkCollection:"—", total:"₹19.01 Cr premiere gross (no blocks) / ₹24.2 Cr with blocks · 3.56L tickets", verdict:"Stree 2 premiere record broken · OG record within ₹1.99 Cr", color:"#C8201A" },
      { film:"The Kerala Story 2", week:"Wk 1", wkCollection:"₹22.9 Cr (Wk1)", total:"₹22.9 Cr", verdict:"Average — legal issues hurt Day 1. Budget ₹28 Cr. Break-even zone.", color:"#D97706" },
      { film:"Thaai Kizhavi", week:"Wk 1", wkCollection:"₹23.25 Cr (Wk1)", total:"₹23.25 Cr", verdict:"Super Hit — ₹9 Cr budget, 158% ROI in week 1 alone", color:"#16A34A" },
      { film:"O'Romeo", week:"Wk 3 (Day 17)", wkCollection:"₹3.55 Cr (Wk3)", total:"₹65.15 Cr net", verdict:"Confirmed Flop — crawling to ₹70 Cr", color:"#EF4444" },
      { film:"Border 2", week:"Wk 7 (closing)", wkCollection:"~₹1.43 Cr (Wk6)", total:"₹424 Cr net / ₹481.76 Cr WW", verdict:"Blockbuster — final screens before OTT Mar 20", color:"#16A34A" },
      { film:"Mardaani 3", week:"OTT bound", wkCollection:"~₹1.2 Cr (Wk5)", total:"₹50.57 Cr net", verdict:"Below Average — Amazon Prime ~Mar 27", color:"#EF4444" },
    ],
    sources: [
      {
        name:"Box Office India",
        handle:"@Box_Off_India",
        color:"#1F2937",
        quote:"Kerala Story 2 clears legal hurdle — opens to mixed collections",
        analysis:"Box Office India reported that The Kerala Story 2 was affected by a Kerala High Court stay order on its release morning, limiting shows to after 6PM on Day 1. This severely dented what could have been a stronger opening. The film still managed ₹0.75 Cr on Day 1 and jumped to ₹4.65 Cr on Day 2 — showing genuine audience demand once the legal cloud lifted. BOI noted that Thaai Kizhavi's ₹2.65 Cr Day 1 from a ₹9 Cr budget was a very strong start for a Tamil comedy drama, with positive word-of-mouth driving the film up 88% on Day 2 to ₹5 Cr."
      },
      {
        name:"Sacnilk",
        handle:"@sacnilk",
        color:"#0369A1",
        quote:"D2 advance: 3.56L tickets in 4 days — Stree 2 premiere record BROKEN",
        analysis:"Sacnilk tracked Dhurandhar 2's advance booking surge from the moment trailer and paid preview announcement went live on March 7. Within 24 hours, the premiere gross crossed ₹9 crore — smashing Stree 2's Bollywood premiere record of ₹8.75 Cr. By March 11 at 2PM, the figure had reached ₹19.01 Cr without blocks and ₹24.2 Cr with blocks, with 3.56 lakh tickets across 8,371 shows. The PVR INOX CEO Gautam Dutta confirmed 1.5 lakh+ tickets in PVR INOX chains alone. The US opened at $1.12M for Day 1 and $2.16M for the opening weekend in advance."
      },
    ],
    interval_take: "Week 11 was the week the Dhurandhar 2 machine switched on. The moment the trailer dropped and paid preview bookings opened on March 7, Sacnilk clocked 7,500–10,000 tickets per hour on BookMyShow — a pace comparable to Baahubali 2's legendary booking velocity. The domestic market itself was quiet: Kerala Story 2 opened amid legal drama, Thaai Kizhavi emerged as the week's pleasant surprise, and O Romeo limped toward its Flop conclusion. But all of it was background noise. The trade, exhibitors, and audiences were already mentally in March 19.",
    nextWeek: "Mar 13 — D2 advance continues building. Dhurandhar re-release (Day 100). Kerala Story 2 Wk 3. Thaai Kizhavi Wk 3. 120 Bahadur releases.",
  },
  {
    weekNum: "Week 7, 2026",
    dateRange: "Feb 15 – Feb 21, 2026",
    headline: "Valentine's Fizzle: O Romeo Confirmed Flop, New Releases Disappoint",
    subline: "A quiet mid-Feb window with no clear winner — trade eyes March 19 mega-clash",
    status: "archived",
    scoreboard: [
      { film:"Border 2", week:"Wk 4", wkCollection:"~₹24 Cr", total:"~₹481 Cr", verdict:"Blockbuster ↓ winding down", color:"#16A34A" },
      { film:"O Romeo", week:"Wk 1→2", wkCollection:"₹47.1 Cr (Wk1) + ₹7 Cr (2nd wknd)", total:"~₹55 Cr", verdict:"FLOP — needs ₹130 Cr to break even", color:"#DC2626" },
      { film:"Mardaani 3", week:"Wk 3", wkCollection:"~₹9 Cr", total:"~₹48 Cr", verdict:"Below avg — nearing Mardaani 2 record", color:"#D97706" },
      { film:"Tu Yaa Main", week:"Wk 2", wkCollection:"₹4 Cr total lifetime", total:"₹4 Cr", verdict:"FLOP — Shanaya Kapoor debut misfires", color:"#DC2626" },
      { film:"Do Deewane Sehar Mein", week:"Wk 1 (Day 2)", wkCollection:"₹2.6 Cr (2 days)", total:"₹2.6 Cr", verdict:"Slow start — needs weekend surge", color:"#D97706" },
      { film:"Assi", week:"Wk 1 (Day 2)", wkCollection:"₹2.3 Cr (2 days)", total:"₹2.3 Cr", verdict:"Struggling — social drama needs WOM miracle", color:"#D97706" },
    ],
    sources: [
      {
        name:"Box Office India",
        handle:"@Box_Off_India",
        color:T.text,
        quote:"O Romeo Is A Flop — Tu Yaa Main No Better",
        analysis:"BOI's blunt verdict on O Romeo: despite Vishal Bhardwaj's pedigree and a ₹130 Cr budget, the film opened at ₹8.5 Cr and collapsed sharply on weekdays. The trade site noted that \"these sort of male leads in commercial genres will not be able to bring an audience\" — a broader indictment of the mid-budget commercial space. Week 1 at ₹47 Cr puts it well short of the ₹80+ Cr needed for any hope of a hit. On the new releases, BOI was equally direct: Do Deewane Sehar Mein at ₹1.25 Cr and Assi at ~₹1 Cr on Day 1 were both \"expected\" given \"nothing much in them to get the audience to the theatres.\" Border 2's Week 4 number came in around ₹24 Cr, confirming steady decline from its ₹224 Cr Week 1 peak — but the film has crossed ₹478 Cr WW and is a confirmed Blockbuster."
      },
      {
        name:"Koimoi",
        handle:"@Koimoi",
        color:"#7C3AED",
        quote:"O'Romeo is a FLOP — film will crawl to ₹60 Cr nett with no competition till March 19",
        analysis:"Koimoi's analysis highlighted the sharp irony of O Romeo's trajectory — Shahid Kapoor delivered his highest post-pandemic opening (₹28 Cr opening weekend), but weekday holds were brutal: Monday fell 46% to ₹4.85 Cr. The outlet noted that the ₹130 Cr budget makes recovery mathematically near-impossible, and pointed to a BOGO (Buy One Get One) promotional push in week 2 as a sign of commercial distress. On Mardaani 3, Koimoi tracked the franchise record angle — Rani Mukerji's cop thriller is poised to surpass Mardaani 2's ₹47.51 Cr lifetime collection, making it the highest-grossing film in the franchise despite never matching its predecessors' multiples. The outlet was mildly optimistic on Assi, citing potential for a Kashmir Files-style word-of-mouth surge given the subject matter, though opening numbers left little room for error."
      },
      {
        name:"Sacnilk / Trade",
        handle:"@sacnilk",
        color:"#0369A1",
        quote:"Do Deewane Seher Mein and Assi score poor opening day — both films fall short of even low trade expectations",
        analysis:"Sacnilk's data confirmed what advance bookings had telegraphed: Do Deewane Seher Mein (₹1.35 Cr Day 1) and Assi (₹1 Cr Day 1) both underperformed in a window that should have been theirs to own. The Bhansali-backed romantic drama had a PVR app tie-up that padded its opening number — without which, Sacnilk's analysis suggests the two films were essentially in the same bracket. The site noted that Assi's subject matter (rape survivor's legal fight; title refers to the 80 rape cases filed daily in India) resonated better in South Indian markets — Chennai saw nearly 20% occupancy vs single-digit numbers in Hindi belt metros. Overall, the Hindi box office in Week 7 collected a modest total — Border 2 continued to be the sole engine, and the market is effectively paused until the March 19 Dhurandhar 2 vs Toxic mega-clash."
      },
    ],
    interval_take: "The Valentine's weekend delivered the clearest proof yet that Bollywood's mid-budget commercial space is broken. O Romeo — Vishal Bhardwaj, Shahid Kapoor, ₹130 Cr — couldn't find its audience. Tu Yaa Main launched Shanaya Kapoor to the weakest debut of 2026. And the new week brought Do Deewane Sehar Mein and Assi into a market that's already switched off until March 19. Border 2 cruises to ₹480 Cr+ in relative peace — proof that when a film genuinely connects, nothing stops it. The industry is in a holding pattern. All eyes on the Dhurandhar 2 vs Toxic collision in 26 days.",
    nextWeek: "Mar 18 — Dhurandhar 2 paid previews. Mar 19 — Dhurandhar 2 worldwide release. Kerala Story 2 final weekend. All other films fade for the biggest Hindi opening ever.",
  },
  {
    weekNum: "Week 6, 2026",
    dateRange: "Feb 8 – Feb 14, 2026",
    headline: "Valentine's Eve: O Romeo Arrives, Border 2 Crosses ₹320 Cr",
    subline: "Shahid Kapoor's Vishal Bhardwaj reunion opens strong — but weekday test looms",
    status: "archived",
    scoreboard: [
      { film:"Border 2", week:"Wk 3", wkCollection:"₹23.35 Cr", total:"₹318.55 Cr", verdict:"Solid Blockbuster — steady decline", color:"#16A34A" },
      { film:"O Romeo", week:"Wk 1 (Day 1–2)", wkCollection:"₹21.15 Cr (2 days)", total:"₹21.15 Cr", verdict:"Decent Valentine's launch — WD test next", color:"#D97706" },
      { film:"Mardaani 3", week:"Wk 2", wkCollection:"₹14.6 Cr", total:"₹45.9 Cr", verdict:"Below avg but holding — franchise record near", color:"#D97706" },
      { film:"Tu Yaa Main", week:"Wk 1", wkCollection:"₹3.97 Cr total", total:"₹3.97 Cr", verdict:"DISASTER — worst debut of 2026", color:"#DC2626" },
    ],
    sources: [
      {
        name:"Box Office India",
        handle:"@Box_Off_India",
        color:T.text,
        quote:"Border 2 Week Four Collections — Mardaani 3 Week Three Collections",
        analysis:"BOI reported Border 2's Week 3 at ₹23.35 Cr — a significant step down from Week 2's ₹70.15 Cr and Week 1's ₹224.25 Cr, but entirely expected. The film was crossing ₹320 Cr domestic in its third weekend, a number that firmly establishes it as one of the biggest Hindi films of recent years. BOI's reading of O Romeo's Valentine's opening: the ₹8.5 Cr Day 1 was \"decent\" but not the number needed for a film of this scale — the Saturday jump to ₹12.65 Cr was more encouraging, but Sunday's dip to ₹9 Cr signalled that the Valentine's spike was a one-day event, not a trend."
      },
      {
        name:"Koimoi",
        handle:"@Koimoi",
        color:"#7C3AED",
        quote:"Tu Yaa Main: Shanaya Kapoor's debut turns into 2026's first true disaster",
        analysis:"Koimoi covered Tu Yaa Main's brutal opening with a bluntness the numbers demanded. The Shanaya Kapoor debut opened at ₹0.6 Cr — one of the worst debuts for a major studio release in recent memory. The outlet pointed to a combination of poor marketing, weak buzz, and a competitive calendar as key factors. The trade analysis noted that the romantic genre needs stars with proven drawing power to work in a post-Stree 2 market where audiences are selective. Koimoi also tracked O Romeo's Day 4 milestone — crossing Mardaani 3's total in just four days — as a bright spot, though the budget gap between the two films meant the achievement was relative."
      },
      {
        name:"Sacnilk / Trade",
        handle:"@sacnilk",
        color:"#0369A1",
        quote:"O Romeo records Shahid Kapoor's highest post-pandemic opening weekend at ₹30 Cr",
        analysis:"Sacnilk's data showed O Romeo opening at ₹8.5 Cr on Day 1, jumping to ₹12.65 Cr on Valentine's Day (Saturday), then pulling back to ₹9 Cr on Sunday — a ₹30.15 Cr opening weekend that represents Shahid Kapoor's biggest post-COVID-era opening. The site noted strong occupancy in urban multiplexes and particularly strong night shows (24.97% Hindi occupancy) on the Valentine's Friday. The Mardaani 3 tracking showed the Week 2 performance holding better than feared — ₹14.6 Cr in Week 2 vs ₹31 Cr in Week 1 represents a 53% hold, which Sacnilk noted is healthier than most comparable films in that budget range."
      },
    ],
    interval_take: "Week 6 belonged to Valentine's weekend mechanics. O Romeo got the seasonal lift it needed — Vishal Bhardwaj's craft and Shahid Kapoor's intensity earning genuine critical praise — but the numbers told a cautious story. The opening weekend at ₹30 Cr was Shahid's best in years, and immediately revealed the gap between audience appreciation and commercial scale. Tu Yaa Main was the week's real shock: a film in 2026 opening at ₹60 lakh is a marketing and casting failure more than a content one. Border 2's continued trajectory towards ₹350 Cr+ remains the dominant story of early 2026.",
    nextWeek: "O Romeo weekday verdict · New releases: Do Deewane Sehar Mein, Assi · Border 2 & Mardaani 3 week 4 & 3",
  },
  {
    weekNum: "Week 5, 2026",
    dateRange: "Feb 1 – Feb 7, 2026",
    headline: "Border 2 Crosses ₹300 Cr, Mardaani 3 Surprises, Vadh 2 Sinks",
    subline: "Patriotic sequel confirms blockbuster status — Rani Mukerji holds her own",
    status: "archived",
    scoreboard: [
      { film:"Border 2", week:"Wk 2", wkCollection:"₹70.15 Cr", total:"₹294.4 Cr", verdict:"Blockbuster — ₹300 Cr crossed", color:"#16A34A" },
      { film:"Mardaani 3", week:"Wk 1+", wkCollection:"₹31 Cr (Wk1)", total:"₹31 Cr", verdict:"Below avg but positive WOM building", color:"#D97706" },
      { film:"Vadh 2", week:"Wk 1", wkCollection:"₹2.5 Cr total", total:"₹2.5 Cr", verdict:"DISASTER — franchise goodwill exhausted", color:"#DC2626" },
    ],
    sources: [
      {
        name:"Box Office India",
        handle:"@Box_Off_India",
        color:T.text,
        quote:"Border 2 joins the elite ₹300 Cr club in its second week",
        analysis:"BOI's Week 2 report on Border 2 noted the film crossing ₹300 Cr domestic nett in 13 days — a milestone only a handful of Hindi films have achieved. The site reported Week 2 at ₹70.15 Cr, a significant drop from Week 1's ₹224.25 Cr but still extremely healthy by industry standards. BOI was characteristically direct about Vadh 2: opening at ₹0.5 Cr with Sanjay Mishra and Neena Gupta reprising their roles from the 2022 surprise hit, the sequel \"exhausted whatever goodwill the original had built\" with no fresh angle to justify a return trip to theatres."
      },
      {
        name:"Koimoi",
        handle:"@Koimoi",
        color:"#7C3AED",
        quote:"Mardaani 3: Rani Mukerji delivers franchise's strongest content; numbers should follow with WOM",
        analysis:"Koimoi was notably bullish on Mardaani 3's prospects despite the opening numbers. The ₹4 Cr Day 1 and ₹31 Cr Week 1 were below the ₹75 Cr budget threshold, but Koimoi's analysts noted that YRF social dramas often have longer legs than typical commercial entertainers. The analysis pointed to strong critical reception and positive audience reports as factors that could sustain collections into a third and fourth week. The site also noted that Mardaani 3 had clearly outperformed the opening days of Mardaani 1 and 2, even if the budget math remained challenging."
      },
      {
        name:"Sacnilk / Trade",
        handle:"@sacnilk",
        color:"#0369A1",
        quote:"Border 2 Week 2 data: ₹70.15 Cr with ₹22.5 Cr second Sunday — content-driven hold",
        analysis:"Sacnilk's data confirmed Border 2's Saturday-Sunday second weekend spike (₹17.75 Cr Sat + ₹22.5 Cr Sun) as evidence of genuine audience momentum rather than opening-week hype. The site noted the film's strong hold in mass markets — particularly Tier 2 and Tier 3 cities — and noted that the Dhurandhar-style patriotic/action wave was continuing to resonate with Hindi belt audiences. Sacnilk tracked Vadh 2's opening at ₹0.5 Cr as a reflection of the broader reality that sequel premiums don't apply unless the original had genuine blockbuster scale."
      },
    ],
    interval_take: "Week 5 confirmed Border 2's place in 2026's box office conversation. The Sunny Deol and Varun Dhawan-led sequel isn't just performing — it's proving that the patriotic, ensemble-cast formula that Dhurandhar pioneered has a genuine mass audience. Mardaani 3 represents a more nuanced story: solid craft, strong performance, and a subject (child trafficking) that Rani Mukerji handles with conviction, but in a market where the audience needs more than a reason to respect a film — they need a reason to rush to the cinema on opening day. That gap is now Bollywood's central problem.",
    nextWeek: "Border 2 Wk 3 · Mardaani 3 Wk 2 · Valentine's releases: O Romeo, Tu Yaa Main",
  },
  {
    weekNum: "Week 10, 2026",
    dateRange: "Mar 1 – Mar 7, 2026",
    headline: "The Calm Before the Storm — All Eyes on March 19",
    subline: "Dhurandhar 2 trailer out · Boxoffy AI Calc: ₹15–30 Cr Nett paid previews · ₹4.39 Cr advance in 2hrs · 1.1L+ premiere tickets · BMS: 7.5k–10k/hr · ₹80–100 Cr Day1 · US $565K Day1 · Mar 19.",
    status: "archived",
    scoreboard: [
      { film:"Border 2", week:"Wk 7 (Day 44+)", wkCollection:"₹1.43 Cr (Wk6)", total:"₹424 Cr net / ₹481.76 Cr WW", verdict:"Blockbuster — final days. Border 3 announced.", color:"#16A34A" },
      { film:"The Kerala Story 2", week:"Wk 2 (Day 10)", wkCollection:"₹9.97 Cr (Wk2 ongoing)", total:"₹32.87 Cr net / ₹34.80 Cr WW", verdict:"Plus — budget recovered + profit. 11 days to Dhurandhar 2.", color:"#22C55E" },
      { film:"O'Romeo", week:"Wk 4 (Day 24)", wkCollection:"₹0.65 Cr (Wk4 trickle)", total:"₹68.20 Cr net / ₹80.73 Cr WW gross", verdict:"Confirmed Flop — ₹68 Cr vs ₹130 Cr. Amazon Prime OTT. Final days.", color:"#EF4444" },
      { film:"Mardaani 3", week:"Wk 6 (OTT)", wkCollection:"OTT — Netflix", total:"₹50.57 Cr net", verdict:"Below Average — Now on Netflix India.", color:"#EF4444" },
      { film:"Assi", week:"Wk 3 (closing)", wkCollection:"~₹22 lakh (Day 15)", total:"~₹9.8 Cr net", verdict:"Flop vs ₹40 Cr budget — final days in theatres.", color:"#EF4444" },
      { film:"Dhurandhar 2: The Revenge", week:"12 days to release", wkCollection:"—", total:"India: ₹4 Cr advance in 2hrs · 1.1L+ premiere tickets · US: $565K Day1 · $1M wknd", verdict:"Boxoffy AI Calc: ₹1,000 Cr India / ₹1,700–2,000 Cr WW. BMS: 7.5k–10k tickets/hr. ₹100 Cr opening targeted.", color:"#D97706" },
    ],
    sources: [
      { name:"Boxoffy AI Calc", note:"Pre-Toxic-postponement: ₹65–70 Cr Day 1. After Toxic pulled out Mar 4: upgraded to ₹85–90 Cr Day 1 net India. Post-trailer: ₹90–100 Cr in play.", url:"https://x.com/rohitjswl01",
        handle:"analyst-1", color:"#0369A1",
        quote:"current scenario and solo release will ensure that film touches ₹85cr–₹90cr on Day one here in India.. Nett Collections.",
        analysis:"Rohit Jaiswal (@rohitjswl01) posted this revision immediately on March 4 when Toxic confirmed its postponement to June 4 — before the trailer was even out. His framing is always in nett collections, not gross, which makes his numbers the cleanest benchmark in the trade. Pre-clash he had the film at ₹65–70 Cr Day 1 net; solo release upgraded it to ₹85–90 Cr net. Post-trailer and post-booking storm on Mar 7, the implied floor moved toward ₹90–100 Cr. On Dhurandhar 1, Jaiswal documented in real-time on X: '₹1300+ CRORE WORLDWIDE. ₹1000+ CRORE INDIA. HISTORY MADE. Dhurandhar doesn't just break records it obliterates them.' He later posted, 'Running strong even in its 8th weekend, fuelled purely by audience madness and iron-solid word of mouth' as the film crossed ₹890 Cr net India. His sequential precision across both films makes him the most reliable number for a conservative opening floor estimate."
      },
      { name:"Boxoffy AI Calc", note:"₹15–20 Cr Nett paid previews (up to ₹30 Cr) · ₹80–100 Cr Day1 · ₹350–400 Cr India 4-day Eid · ₹500–600 Cr WW 4-day · ₹1,000 Cr India lifetime · ₹1,700–2,000 Cr WW lifetime", url:"https://x.com/SumitkadeI",
        handle:"analyst-2", color:"#7C3AED",
        quote:"Showcasing is HUGE.. Collection from Paid Previews can reach upto 30 Cr nett as well. #Dhurandhar2",
        analysis:"Sumit Kadel (@SumitkadeI) added a new layer post-trailer on Mar 6–7: his paid preview call of ₹15–20 Cr Nett, potentially ₹30 Cr — which would shatter all paid preview records in Hindi cinema history. His full prediction remains the boldest in the industry: ₹80–100 Cr Day 1 net, ₹350–400 Cr 4-day India Eid weekend, ₹500–600 Cr WW 4-day weekend, ₹1,000 Cr India net lifetime, ₹1,700–2,000 Cr WW. He called the trailer 'ELECTRIFYING' and predicted 7–10 lakh tickets at national multiplex chains before release day — a target being hit within hours of Mar 7 booking opening. On Dhurandhar 1 at Day 39: 'DHURANDHAR DOES THE UNTHINKABLE — ₹1300 CRORE CLUB CREATED. This is not a record, it's a reset of the ceiling.' For the sequel he is projecting the ceiling to move again — to ₹2,000 Cr WW, which would make it the highest-grossing Indian film of all time."
      },
      { name:"Boxoffy AI Calc", note:"'Boxoffice Tsunami this March' · 7.5k–10k tickets/hr on BMS · ₹4 Cr in 2 hrs national chains · 1.1L+ premiere tickets · 35K+ tickets in opening session", url:"https://x.com/taran_adarsh",
        handle:"analyst-3", color:"#DC2626",
        quote:"DHURANDHAR THE REVENGE ADVANCE BOOKINGS GO ON A RAMPAGE… trending on #BMS, selling a staggering 7.5k tickets per hour. Amazing, isn't it?",
        analysis:"Taran Adarsh (@taran_adarsh) has been the loudest institutional voice on this campaign. When first-look posters arrived he called it 'THE BIGGEST HINDI FILM OF ALL TIME RETURNS' and declared: 'Get ready for a Boxoffice Tsunami this March.' On Mar 7, he posted live updates the moment advance booking opened: 7,500–10,000 tickets per hour on BMS, ₹4 Cr collected from PVR/INOX/Cinepolis in under 2 hours, 35,000+ national multiplex tickets in the opening hours, 1.1 lakh+ total premiere tickets sold — calling it unprecedented organic demand with no corporate or fan-club bulk booking. His Dhurandhar 1 coverage set the benchmark: Week 1 ₹188.60 Cr total at Wed, Week 2 delivering a historic ₹261.50 Cr cumulative (₹479.50 Cr by Day 14), Day 11 at ₹31.80 Cr exceeding Day 1 at ₹28.60 Cr — 'that says it all.' Adarsh's authority comes from official trade data access; when he confirms a number it has institutional weight."
      },
      { name:"Boxoffy AI Calc", note:"Tracked Dhurandhar 1: Canada $7.71M all-time record; Australia A$2.46M 10-day record; BMS 10M+ tickets; 'Part Two will be pure Carnage!'", url:"https://x.com/NishitShawHere",
        handle:"analyst-4", color:"#15803D",
        quote:"#Dhurandhar Canada Gross: $7.71M The Biggest Indian Blockbuster ever in the region beating #Animal ($7.09M) Part Two will be pure Carnage!",
        analysis:"Nishit Shaw (@NishitShawHere) is the most overseas-data-focused of the major trade analysts and his Dhurandhar 1 tracking set the global context for the sequel. His X posts confirmed Dhurandhar 1 as the biggest Indian film ever in Canada at $7.71M (beating Animal's $7.09M record) and Australia with a blockbuster second weekend of A$1.25M — 10-day total A$2.46M, highest Indian film of the year beating Kantara Chapter 1 at A$1.82M. On the domestic milestone he posted: '#Dhurandhar 10M+ tickets sold on BookMyShow. All Time Blockbuster!' His verdict on the sequel when the Canada record fell: 'Part Two will be pure Carnage!' Shaw also maintains the definitive national chain advance booking rankings list for Bollywood 2025 (Chhaava 221K tickets, Saiyaara 193K, Sikandar 143K etc.) — Dhurandhar 2 is live contention to top that list with its organic booking storm on Mar 7. He is the validator to watch once international numbers start rolling in post-March 19."
      },
      { name:"Boxoffy AI Calc", note:"High-engagement Bollywood hype account · 95.7K views Dhurandhar/Animal post · Covers franchise buzz, trailer reactions, advance booking energy", url:"https://x.com/Its_CineHub",
        handle:"analyst-5", color:"#D97706",
        quote:"If you think #Animal or #Dhurandhar are VIOLENT & BRUTAL FILM then you need to watch this FILM",
        analysis:"CineHub (@Its_CineHub) operates as a high-engagement Bollywood cultural and hype account rather than a numbers-data analyst — their strength is audience sentiment, franchise energy, and real-time reaction content. Their Feb 16 post drawing a violent-cinema comparison between Dhurandhar, Animal, and a third title garnered 95.7K views and 1.5K reposts, signalling significant reach among the core multiplex-going audience. For Dhurandhar 2 specifically, their account has been amplifying the advance booking mania, trailer reactions, and the franchise hype. Their audience skews younger and more fandom-driven than institutional trade accounts — making them a useful proxy for cultural penetration beyond the trade bubble. On the prior week they were bullish on King (SRK, Siddharth Anand), calling it his 'SEXIEST avatar ever on the big screen.' For the Week 10 box office picture, CineHub's signal is clear: the anticipation for Dhurandhar 2 among their engaged base of Bollywood fans is at maximum levels."
      },
    ],
    boxoffyTake: "Five of the sharpest voices in Indian box office trade have spoken — and they are in rare unanimous agreement. Rohit Jaiswal (@rohitjswl01) upgraded his Day 1 net forecast from ₹65–70 Cr to ₹85–90 Cr the moment Toxic postponed on March 4, posting 'current scenario and solo release will ensure that film touches ₹85–₹90 cr on Day one.' Sumit Kadel (@SumitkadeI) went biggest post-trailer, adding a new paid preview call on Mar 6: '₹15–20 Cr Nett from PP is on the cards — showcasing is HUGE, could reach up to ₹30 Cr Nett.' For the full run he predicts ₹80–100 Cr Day1, ₹350–400 Cr India Eid weekend, ₹500–600 Cr WW 4-day, ₹1,000 Cr India lifetime, ₹1,700–2,000 Cr WW — numbers that would make it the highest-grossing Indian film ever. Taran Adarsh (@taran_adarsh) reported live from BMS on Mar 7: 7.5k–10k tickets/hour, ₹4.39 Cr from national chains in 2 hours, 1.1 lakh+ premiere tickets sold organically — calling it unprecedented. Nishit Shaw (@NishitShawHere) set the overseas context: Dhurandhar 1 was Canada's biggest ever Indian film at $7.71M, Australia's best at A$2.46M over 10 days, BMS 10M+ tickets — his verdict on Part 2 was simply 'pure Carnage.' CineHub (@Its_CineHub) captured the cultural temperature: their franchise comparison post got 95.7K views, signalling the film has moved beyond trade circles into mainstream audience frenzy. The numbers on the ground back all five up — India premiere gross ₹4.39 Cr in 2 hours, US $400K+ premiere pre-sales, $565K Day1 booked, $1M opening weekend locked, new 'Super Blockbuster Plus' pricing tier created, runtime ~3h55m. Meanwhile Kerala Story 2 continues its solid run on Day 10 — ₹32.87 Cr net on a ₹28 Cr budget, the Plus verdict firmly locked. The Hit target of ₹56 Cr remains a stretch with Dhurandhar 2 arriving in 11 days.",
    interval_take: "Week 10 will be remembered as the week Indian cinema held its breath. Every active release — O Romeo, Mardaani 3, Kerala Story 2, Assi — is either wrapping up or in its final days. The multiplex industry is clearing screens, calibrating pricing tiers, and preparing for what five major trade analysts are collectively calling a ₹85–100 Cr opening day. Rohit Jaiswal's conservatively precise ₹85–90 Cr net floor, Sumit Kadel's historic ₹1,700–2,000 Cr WW lifetime call, Taran Adarsh's 7.5k tickets/hour BMS live data, Nishit Shaw's 'pure Carnage' overseas signal, and CineHub's 95.7K-view audience heat check — they all point the same direction. March 19 may be the biggest single day in the history of Indian cinema. The industry is ready. The question now is just one: does the content match the hype?",
    nextWeek: "March 18 — Dhurandhar 2: The Revenge paid previews from 5 PM nationwide. March 19 — Worldwide release. Day 1 numbers expected by 11 PM IST. ₹100 Cr opening being targeted.",
  },
];


function NavBar({ activeSection, setActiveSection }) {

  return (
    <div style={{ position:"sticky", top:0, zIndex:100 }}>

      <nav style={{
        background:"#FFFFFF",
        borderBottom:`2px solid ${T.accent}`,
        display:"flex", alignItems:"center",
        padding:"0 24px", gap:0,
        boxShadow:"0 1px 8px rgba(0,0,0,0.08)",
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"baseline", gap:0, marginRight:32, paddingTop:4, paddingBottom:4, flexShrink:0 }}>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:24, color:"#111827", letterSpacing:"-0.02em", lineHeight:1 }}>BOXOF</span>
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:24, color:T.accent, letterSpacing:"-0.02em", lineHeight:1 }}>FY</span>
          <span style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:400, fontSize:10, color:"#9CA3AF", marginLeft:10, letterSpacing:"0.2em", textTransform:"uppercase", alignSelf:"center" }}>India</span>
        </div>

        {/* Vertical divider */}
        <div style={{ width:1, height:20, background:"#E5E7EB", marginRight:24, flexShrink:0 }} />

        {/* Nav links */}
        {["Box Office","Bollywood","OTT","TV","Weekly"].map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{
            background:"transparent", border:"none", cursor:"pointer",
            fontFamily:"'DM Sans', sans-serif", fontWeight:600, fontSize:13,
            color: activeSection === s ? "#111827" : "#9CA3AF",
            padding:"18px 14px",
            borderBottom: activeSection === s ? `2px solid ${T.accent}` : "2px solid transparent",
            marginBottom:"-2px",
            letterSpacing:"0.04em", transition:"color 0.15s",
            flexShrink:0,
          }}>{s}</button>
        ))}

        {/* Right side — static update stamp */}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:0, flexShrink:0 }}>

          {/* Week indicator */}
          <div style={{
            display:"flex", flexDirection:"column", alignItems:"flex-end",
            borderRight:`1px solid #E5E7EB`, paddingRight:12, marginRight:12,
          }}>
            <span style={{
              fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700,
              fontSize:13, color:T.accent, letterSpacing:"0.03em",
            }}>WEEK 12 · 2026</span>
            <span style={{
              fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#9CA3AF",
              letterSpacing:"0.1em", textTransform:"uppercase",
            }}>Box Office Period</span>
          </div>

          {/* Last Updated */}
          <div style={{
            display:"flex", flexDirection:"column", alignItems:"flex-end",
          }}>
            <span style={{
              fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700,
              fontSize:13, color:"#374151", letterSpacing:"0.03em",
            }}>Sat, 8 Mar 2026 · 12:00 AM IST</span>
            <span style={{
              fontFamily:"'DM Sans', sans-serif", fontSize:8, color:"#9CA3AF",
              letterSpacing:"0.1em", textTransform:"uppercase",
            }}>Last Updated</span>
          </div>

        </div>
      </nav>
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
  const [activeWeek, setActiveWeek] = useState(0);
  const week = WEEKLY_COMMENTARY[activeWeek];
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
        {(liveWeekly || WEEKLY_COMMENTARY).map((w, i) => (
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

        <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:24, alignItems:"start" }}>
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
        display:"grid", gridTemplateColumns:"repeat(4, 1fr)",
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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:0, borderTop:`1px solid #DBEAFE`, borderBottom:`1px solid #DBEAFE` }}>
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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8, marginBottom:12 }}>
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

  const handleRowClick = () => {
    if (!canExpand) return;
    if (!expanded) { setExpanded(true); }
    else { setExpanded(false); }
  };

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
        <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", justifyContent:"center", gap:4 }}>
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
        </div>

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
  const isHollywood = movie.language === "Hollywood";

  // Bar width for this week's collection vs max (Border 2 at 24 Cr)
  const maxWk = 24;
  const barPct = movie.weeklyCollection > 0 ? Math.min((movie.weeklyCollection / maxWk) * 100, 100) : 0;

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
        <div style={{ padding:"10px 14px", borderRight:`1px solid ${T.border}` }}>
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
          {movie.weeklyNote && (
            <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10.5, color:T.textMid, marginTop:4, lineHeight:1.5, fontStyle:"italic" }}>
              {movie.weeklyNote}
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
          {/* Mini bar */}
          {barPct > 0 && (
            <div style={{ marginTop:6, height:3, background:T.border, borderRadius:2, width:"80%", maxWidth:200 }}>
              <div style={{ height:"100%", width:`${barPct}%`, background: isNew ? "#16A34A" : T.accent, borderRadius:2, transition:"width 0.4s" }} />
            </div>
          )}
        </div>

        {/* This week */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 14px", borderRight:`1px solid ${T.border}`, textAlign:"right" }}>
          {movie.weeklyCollection > 0
            ? <>
                <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:20, color: isNew ? "#16A34A" : T.accent, lineHeight:1 }}>₹{movie.weeklyCollection} Cr</div>
                <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, marginTop:2, letterSpacing:"0.06em", textTransform:"uppercase" }}>Wk {movie.weekNum}</div>
              </>
            : <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted }}>
                {movie.status === "Upcoming" ? "Mar 19" : "Closed"}
              </div>
          }
        </div>

        {/* India net total */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 14px", borderRight:`1px solid ${T.border}`, textAlign:"right" }}>
          <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:17, color:T.text, lineHeight:1 }}>{movie.indiaNet}</div>
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

        {/* Budget / status */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 10px", textAlign:"center" }}>
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

  const isRunning  = movie.status === "Running";
  const isUpcoming = movie.status === "Upcoming";
  const isOTT      = movie.status === "OTT";

  // BOG uses very light alternating rows, bold rank on left
  const rowBg     = exp ? "#EFF6FF" : isRunning ? "#FFFFFF" : isUpcoming ? "#FFFEF5" : "#FAFAFA";
  const accentCol = isRunning ? "#1D4ED8" : isUpcoming ? "#B45309" : "#9CA3AF";
  const rankCol   = rank === 1 ? "#C41A1A" : rank <= 3 ? "#1D4ED8" : "#374151";

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
          display:"flex", flexDirection:"column", justifyContent:"center",
          padding:"7px 14px", borderRight:"1px solid #F0EDE8",
          overflow:"hidden",
        }}>
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
        </div>

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
          display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:20,
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

  return (
    <div style={{ animation:"fadeIn 0.2s ease both" }}>
      {/* Week header */}
      <div style={{ padding:"10px 20px", background:"#111827", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
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

      {/* Column headers */}
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

      {/* Rows */}
      {weekData.chart.map((film, i) => (
        <div key={i} style={{
          display:"grid",
          gridTemplateColumns:"36px 28px 1fr 100px 110px 80px 70px 60px",
          borderBottom:`1px solid ${T.border}`,
          background: film.rank === 1 ? "#FFFDF5" : i % 2 === 0 ? T.surface : "#FAFAF9",
          alignItems:"center",
          minHeight:48,
        }}>
          {/* Rank */}
          <div style={{ textAlign:"center", padding:"0 4px" }}>
            {film.rank <= 3
              ? <span style={{ fontSize:18 }}>{["🥇","🥈","🥉"][film.rank-1]}</span>
              : <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:18, color:getRankColor(film.rank) }}>#{film.rank}</span>
            }
          </div>
          {/* Rank move */}
          <div style={{ textAlign:"center", padding:"0 2px" }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:getChangeColor(film.change), fontWeight:700, letterSpacing:"0.04em" }}>
              {film.change === "NEW" ? "★" : film.change === "LTD" ? "L" : film.change}
            </span>
          </div>
          {/* Film info */}
          <div style={{ padding:"8px 12px" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, color:T.text, lineHeight:1.1 }}>
              {film.title}
            </div>
            <div style={{ display:"flex", gap:6, marginTop:2, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted }}>{film.studio}</span>
              <span style={{ background:"#F3F4F6", border:`1px solid ${T.border}`, fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, padding:"1px 5px", borderRadius:2 }}>{film.genre}</span>
              {film.rtScore && film.rtScore !== "N/A" && (
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#DC2626", fontWeight:700 }}>🍅 {film.rtScore}</span>
              )}
            </div>
          </div>
          {/* Weekend */}
          <div style={{ padding:"0 8px", textAlign:"right" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17, color: film.rank === 1 ? T.accent : T.text }}>
              {film.weekend}
            </div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:1 }}>
              Wk {film.weeks} · {film.theaters.toLocaleString()} thtr
            </div>
          </div>
          {/* Cumulative */}
          <div style={{ padding:"0 8px", textAlign:"right" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, color:T.text }}>{film.total}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:1 }}>Domestic Total</div>
          </div>
          {/* Theaters */}
          <div style={{ padding:"0 8px", textAlign:"right" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:14, color:T.text }}>{film.theaters.toLocaleString()}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted }}>Locations</div>
          </div>
          {/* Change */}
          <div style={{ padding:"0 8px", textAlign:"right" }}>
            <span style={{
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13,
              color: getChangeColor(film.change),
            }}>{film.change}</span>
          </div>
          {/* Admits */}
          <div style={{ padding:"0 8px", textAlign:"right" }}>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted, lineHeight:1.3 }}>{film.admitsNote}</div>
          </div>
        </div>
      ))}

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
            BOXOFFY · WKD 8 · FEB 22–23, 2026
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
        ? <USBoTop10 weekData={US_BO_WEEKLY["Week 10, 2026"]} />
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
          {upcoming.length > 0 && <>
            <BogDivider
              label="Upcoming Releases"
              color="#B45309" bg="#FFFEF5" dotColor="#D97706"
            />
            {upcoming.map((m, i) => (
              <BogRow key={m.title} movie={m} viewMode={viewMode} rank={i+1} isNew={false} />
            ))}
          </>}

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

function BoxOfficeSection({ onNavigate }) {
  const [year, setYear] = useState(2026);
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("collection");
  const [view, setView] = useState("weekly"); // "weekly" | "alltime"
  const movies = (liveData || DATA)[year] || [];
  const accent = YEAR_ACCENT[year];

  // Weekly chart: sort by this week's collection (active films first, then OTT, then upcoming)
  // Hollywood films are separated out into their own section
  const weeklyChartMovies = year === 2026
    ? [...movies].filter(m => m.language !== "Hollywood").sort((a,b) => {
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
    { label:"BMS Ticket Velocity", val:"7,500–10,000 / hr", src:"6" },
    { label:"Premiere Gross (2 hrs)", val:"₹4.39 Cr", src:"1" },
    { label:"Premiere Tickets Sold", val:"1.1 Lakh+", src:"2" },
    { label:"Housefull Shows", val:"26 confirmed", src:"Sacnilk" },
    { label:"Premiere Shows India", val:"3,979", src:"Koimoi" },
    { label:"US Premiere Pre-Sales", val:"$400K+", src:"10" },
    { label:"US Day 1 Booked", val:"$565K", src:"Venky BO" },
    { label:"US Weekend Pre-Sales", val:"$1 Million", src:"Venky BO" },
  ];

  const analysts = [
    {
      name:"Boxoffy AI Calc", handle:"analyst-2", accentColor:"#7C3AED",
      badge:"Most Bullish", badgeBg:"#EDE9FE", badgeColor:"#5B21B6",
      quote:"Showcasing is HUGE.. Collection from Paid Previews can reach upto ₹30 Cr nett as well. #Dhurandhar2",
      lines:[
        "Paid Previews: ₹15–20 Cr Nett floor · up to ₹30 Cr ceiling",
        "Day 1: ₹80–100 Cr net",
        "Eid 4-Day India: ₹350–400 Cr",
        "WW 4-Day: ₹500–600 Cr",
        "India Lifetime: ₹1,000 Cr",
        "WW Lifetime: ₹1,700–2,000 Cr",
      ],
    },
    {
      name:"Boxoffy AI Calc", handle:"analyst-1", accentColor:"#1D4ED8",
      badge:"Conservative Floor", badgeBg:"#DBEAFE", badgeColor:"#1E40AF",
      quote:"Current scenario and solo release will ensure that film touches ₹85–₹90 cr on Day one.",
      lines:[
        "Upgraded Day 1 to ₹85–90 Cr net after Toxic postponed",
        "Post-trailer storm: floor moving toward ₹90–100 Cr",
        "Quotes nett collections — cleanest benchmark in trade",
      ],
    },
    {
      name:"Boxoffy AI Calc", handle:"analyst-3", accentColor:"#B45309",
      badge:"Live Data Reporter", badgeBg:"#FEF3C7", badgeColor:"#92400E",
      quote:"DHURANDHAR THE REVENGE ADVANCE BOOKINGS GO ON A RAMPAGE... trending on BMS, selling 7.5k tickets per hour.",
      lines:[
        "7,500–10,000 tickets/hr on BookMyShow — Mar 7 live data",
        "₹4.39 Cr premiere gross from national chains in under 2 hrs",
        "1.1 Lakh+ premiere tickets — purely organic, zero fan-club bulk",
        "35,000+ national multiplex tickets in opening session",
      ],
    },
    {
      name:"Boxoffy AI Calc", handle:"analyst-4", accentColor:"#0F766E",
      badge:"Overseas Specialist", badgeBg:"#D1FAE5", badgeColor:"#065F46",
      quote:"Part Two will be pure Carnage!",
      lines:[
        "Dhurandhar 1: Canada all-time Indian film record — $7.71M",
        "Australia: A$2.46M in 10 days — highest Indian film of 2025",
        "BMS: Part 1 sold 10M+ tickets — All-Time Blockbuster confirmed",
        "US $400K+ premiere pre-sales, Day1 $565K, weekend $1M locked",
      ],
    },
    {
      name:"Boxoffy AI Calc", handle:"analyst-5", accentColor:"#9D174D",
      badge:"Audience Pulse", badgeBg:"#FCE7F3", badgeColor:"#9D174D",
      quote:"The franchise energy is at a level this industry hasn't seen since KGF 2.",
      lines:[
        "Franchise comparison post: 95,700 views + 1,500 reposts",
        "Cultural penetration beyond trade circles",
        "Verdict: Anticipation at maximum levels",
      ],
    },
  ];

  return (
    <div>
      {/* ── FROM THE DESK — stacked editorial articles ──────────── */}
      {year === 2026 && showWeekly && (
        <EditorialSection onNavigate={onNavigate} />
      )}

      {/* ── WEEKLY HEADLINE BANNER ──────────────────────────────────── */}
      {year === 2026 && showWeekly && (
        <>
          {/* Banner strip — white surface, red left border, editorial feel */}
          <div
            onClick={() => setShowHeadlineModal(true)}
            style={{
              background:T.surface,
              borderLeft:`5px solid ${T.accent}`,
              borderBottom:`1px solid ${T.border}`,
              padding:"20px 28px 18px 24px",
              cursor:"pointer",
              display:"flex", alignItems:"flex-start", justifyContent:"space-between",
              gap:24, flexWrap:"wrap",
            }}
            onMouseEnter={e => e.currentTarget.style.background=T.surfaceAlt}
            onMouseLeave={e => e.currentTarget.style.background=T.surface}
          >
            {/* Left — label + headline */}
            <div style={{ flex:1, minWidth:260 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
                <span style={{
                  fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9,
                  letterSpacing:"0.14em", textTransform:"uppercase",
                  color:T.accent, background:"#FEE2E2",
                  padding:"2px 8px", borderRadius:2,
                }}>WEEK 12 · LEAD STORY</span>
                <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted }}>Fri, 13 Mar 2026</span>
              </div>
              <div style={{
                fontFamily:"'Barlow Condensed', sans-serif",
                fontWeight:800,
                fontSize:"clamp(20px, 2.6vw, 30px)",
                color:T.text,
                lineHeight:1.1,
                letterSpacing:"-0.01em",
                marginBottom:9,
              }}>
                Dhurandhar 2 Rewrites History.{" "}
                <span style={{ color:T.accent }}>OG Premiere Record BROKEN. ₹29.69 Cr.</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted }}>
                  Ranveer Singh · Aditya Dhar · 4.84L tickets · 9,128 shows · Mar 19
                </span>
                <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMid, fontWeight:600 }}>
                  Boxoffy AI Calc ↗
                </span>
              </div>
            </div>

            {/* Right — 4 key numbers, static, clean */}
            <div style={{ display:"flex", gap:0, borderLeft:`1px solid ${T.border}`, flexShrink:0 }}>
              {[
                { label:"Premiere Gross (verified)", val:"₹24.76 Cr", sub:"No blocks · Mar 13 · Boxoffy" },
                { label:"With Blocks (verified)", val:"₹29.69 Cr", sub:"India premiere · OG record BROKEN" },
                { label:"WW Advance (so far)", val:"~₹60 Cr", sub:"India + overseas · Outlook India" },
                { label:"US Premiere Advance", val:"$982K+", sub:"678 locations · NA OW ~$2M" },
              ].map((s,i) => (
                <div key={i} style={{
                  padding:"0 18px", borderRight:`1px solid ${T.border}`, textAlign:"right",
                }}>
                  <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:19, color:T.accent, lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, marginTop:3, letterSpacing:"0.08em", textTransform:"uppercase" }}>{s.label}</div>
                  <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMid, marginTop:1 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ARTICLE MODAL — fully light, editorial ─────────────── */}
          {showHeadlineModal && (
            <div
              onClick={() => setShowHeadlineModal(false)}
              style={{
                position:"fixed", inset:0, zIndex:500,
                background:"rgba(17,24,39,0.45)",
                display:"flex", alignItems:"flex-start", justifyContent:"center",
                overflowY:"auto", padding:"40px 16px 60px",
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  background:T.surface,
                  maxWidth:800, width:"100%",
                  borderRadius:3,
                  overflow:"hidden",
                  boxShadow:"0 8px 48px rgba(17,24,39,0.18)",
                }}
              >
                {/* Article header — white with red accent bar */}
                <div style={{ borderTop:`5px solid ${T.accent}`, padding:"28px 36px 22px", borderBottom:`1px solid ${T.border}`, position:"relative" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                    <span style={{ fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", color:T.accent, background:"#FEE2E2", padding:"2px 8px", borderRadius:2 }}>BOXOFFY ANALYSIS</span>
                    <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted }}>BREAKING · Mar 13, 2026</span>
                  </div>
                  <h1 style={{
                    fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800,
                    fontSize:"clamp(26px,3.6vw,42px)", color:T.text,
                    lineHeight:1.05, letterSpacing:"-0.02em", margin:"0 0 12px",
                  }}>
                    Indian Box Office — Left, Right, Centre.<br/>
                    All Eyes on <span style={{ color:T.accent }}>Dhurandhar: The Revenge.</span>
                  </h1>
                  <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:T.textMuted, display:"flex", gap:12, flexWrap:"wrap" }}>
                    <span>Ranveer Singh · Dir. Aditya Dhar</span>
                    <span style={{ color:T.border }}>|</span>
                    <span>Jio Studios &amp; B62 Studios</span>
                    <span style={{ color:T.border }}>|</span>
                    <span>March 19, 2026 · Eid + Gudi Padwa + Ugadi</span>
                  </div>
                  <button
                    onClick={() => setShowHeadlineModal(false)}
                    style={{
                      position:"absolute", top:24, right:24,
                      background:"transparent", border:`1px solid ${T.border}`,
                      color:T.textMuted, fontSize:14, borderRadius:3,
                      width:30, height:30, cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:"'DM Sans', sans-serif",
                    }}
                  >✕</button>
                </div>

                {/* Article body */}
                <div style={{ padding:"28px 36px", display:"flex", flexDirection:"column", gap:28 }}>

                  {/* Lede paragraph */}
                  <p style={{
                    fontFamily:"'DM Sans', sans-serif", fontSize:15, color:T.textMid,
                    lineHeight:1.8, margin:0,
                    borderLeft:`3px solid ${T.border}`, paddingLeft:16,
                  }}>
                    With Border 2 closing at ₹481 Cr WW and every other 2026 release either
                    wrapping up or confirmed flop, the multiplex calendar has effectively been
                    cleared. Every screen manager, distributor, and trade analyst is pointing
                    the same direction — <strong style={{ color:T.text }}>March 19</strong>.
                    The sequel to the highest-grossing Hindi film of all time arrives on an
                    Eid + Gudi Padwa + Ugadi triple-holiday weekend. One question drives the
                    entire industry: <em>can the content match a once-in-a-decade booking storm?</em>
                  </p>

                  {/* BMS Advance Data — clean table style */}
                  <div>
                    <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:17, color:T.text, letterSpacing:"0.04em", textTransform:"uppercase", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:3, height:18, background:T.accent, borderRadius:2 }} />
                      BookMyShow Advance Data — 7 March 2026
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:1, border:`1px solid ${T.border}`, borderRadius:3, overflow:"hidden" }}>
                      {bmsStats.map((s,i) => (
                        <div key={i} style={{
                          background: i % 2 === 0 ? T.surface : T.surfaceAlt,
                          padding:"12px 16px",
                          borderRight:`1px solid ${T.border}`,
                          borderBottom:`1px solid ${T.border}`,
                        }}>
                          <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:20, color:T.accent, lineHeight:1 }}>{s.val}</div>
                          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.text, fontWeight:600, marginTop:3 }}>{s.label}</div>
                          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, marginTop:2, letterSpacing:"0.04em" }}>{[].concat(s.src.split(",")).map(n=>parseInt(n.trim())).filter(Boolean).map(n=><Fn key={n} n={n} />)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Full prediction grid */}
                  <div>
                    <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:17, color:T.text, letterSpacing:"0.04em", textTransform:"uppercase", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:3, height:18, background:T.accent, borderRadius:2 }} />
                      Full Prediction Range
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(170px, 1fr))", gap:8 }}>
                      {[
                        { label:"Paid Previews", val:"₹15–30 Cr", sub:"Mar 18 from 5 PM · Boxoffy AI Calc" },
                        { label:"Opening Day Net", val:"₹85–100 Cr", sub:"Net India · Boxoffy AI Calc" },
                        { label:"Eid 4-Day India", val:"₹350–400 Cr", sub:"Boxoffy AI Calc" },
                        { label:"WW 4-Day Weekend", val:"₹500–600 Cr", sub:"Boxoffy AI Calc" },
                        { label:"India Lifetime", val:"₹1,000 Cr", sub:"Boxoffy AI Calc" },
                        { label:"WW Lifetime", val:"₹1,700–2,000 Cr", sub:"Would be all-time Indian record" },
                        { label:"India Screens", val:"5,500+", sub:"Pan-India · 5 languages" },
                        { label:"US Premiere Tickets", val:"14,399", sub:"472 locations" },
                        { label:"Netflix OTT Deal", val:"₹150 Cr", sub:"6–8 week theatrical window" },
                        { label:"Runtime", val:"~3h 55m", sub:"Longest Hindi film · 21st century" },
                        { label:"Super Blockbuster+", val:"₹350–₹2,500", sub:"New premium pricing tier" },
                        { label:"Music Rights", val:"₹45 Cr", sub:"T-Series · Shashwat Sachdev" },
                      ].map((s,i) => (
                        <div key={i} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:3, padding:"11px 14px" }}>
                          <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:20, color:T.accent, lineHeight:1 }}>{s.val}</div>
                          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.text, fontWeight:600, marginTop:3 }}>{s.label}</div>
                          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:T.textMuted, marginTop:2 }}>{s.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Analyst voices */}
                  <div>
                    <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:17, color:T.text, letterSpacing:"0.04em", textTransform:"uppercase", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:3, height:18, background:T.accent, borderRadius:2 }} />
                      What the Analysts Are Saying
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                      {analysts.map((a, i) => (
                        <div key={i} style={{ border:`1px solid ${T.border}`, borderRadius:3, overflow:"hidden" }}>
                          {/* Analyst header row */}
                          <div style={{
                            background:T.surfaceAlt, padding:"10px 16px",
                            display:"flex", alignItems:"center", gap:10,
                            borderBottom:`1px solid ${T.border}`,
                          }}>
                            <div style={{ width:3, height:20, background:a.accentColor, borderRadius:2, flexShrink:0 }} />
                            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:16, color:T.text }}>{a.name}</span>
                            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted }}>{a.handle}</span>
                            <span style={{
                              marginLeft:"auto", flexShrink:0,
                              background:a.badgeBg, color:a.badgeColor,
                              fontFamily:"'DM Sans', sans-serif", fontWeight:700,
                              fontSize:9, letterSpacing:"0.06em", textTransform:"uppercase",
                              padding:"2px 8px", borderRadius:2,
                            }}>{a.badge}</span>
                          </div>
                          {/* Quote + bullets */}
                          <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                            <div style={{
                              fontFamily:"'DM Sans', sans-serif", fontSize:12.5, color:T.textMid,
                              fontStyle:"italic", lineHeight:1.6,
                              borderLeft:`2px solid ${a.accentColor}`, paddingLeft:12,
                            }}>"{a.quote}"</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              {a.lines.map((l,j) => (
                                <div key={j} style={{ display:"flex", gap:8 }}>
                                  <span style={{ color:T.accent, fontSize:10, marginTop:3, flexShrink:0 }}>▸</span>
                                  <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12.5, color:T.textMid, lineHeight:1.55 }}>{l}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer close */}
                  <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:20, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted }}>
                      Trade & industry data
                    </span>
                    <button onClick={() => setShowHeadlineModal(false)} style={{
                      background:T.accent, color:"#fff", border:"none",
                      fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:11,
                      padding:"9px 24px", borderRadius:2, cursor:"pointer",
                      letterSpacing:"0.08em", textTransform:"uppercase",
                    }}>Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Section title bar */}
      <div style={{
        borderBottom:`2px solid ${T.border}`,
        padding:"20px 24px 16px",
        display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12,
      }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <div style={{ width:4, height:22, background:T.accent, borderRadius:2 }} />
            <h2 style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:28, color:T.text, letterSpacing:"-0.01em", lineHeight:1 }}>
              BOX OFFICE CHART
            </h2>
          </div>
          <p style={{ fontFamily:"'DM Sans', sans-serif", fontSize:13, color:T.textMuted, marginLeft:12 }}>
            {showWeekly ? "Week 12, 2026 — Ranked by this week's collection · All active films listed · Mar 7–13" : "Top Indian films by worldwide gross · Industry tracking data"}
          </p>
        </div>
        {topFilm && (
          <div style={{ display:"flex", gap:16 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:20, color:T.accent }}>
                ₹{totalWW.toLocaleString("en-IN")} Cr
              </div>
              <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted, letterSpacing:"0.06em", textTransform:"uppercase" }}>
                {year} Combined WW
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Year tabs */}
      <div style={{ padding:"12px 24px", borderBottom:`1px solid ${T.border}`, display:"flex", gap:4, flexWrap:"wrap", alignItems:"center", background:T.surfaceAlt }}>
        <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted, fontWeight:600, marginRight:6, letterSpacing:"0.08em", textTransform:"uppercase" }}>Year:</span>
        {YEARS.map(y => {
          const ya = YEAR_ACCENT[y];
          const active = y === year;
          return (
            <button key={y} onClick={() => { setYear(y); setFilter("All"); setSortBy("collection"); setView(y === 2026 ? "weekly" : "alltime"); }} style={{
              fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:15,
              background: active ? T.text : "transparent",
              color: active ? "#fff" : T.textMid,
              border: `1px solid ${active ? T.text : T.border}`,
              borderRadius:3, padding:"4px 12px", cursor:"pointer",
              transition:"all 0.15s",
              position:"relative",
            }}>
              {y}
              {y === 2026 && <span style={{ position:"absolute", top:-6, right:-4, background:T.accent, color:"#fff", fontSize:7, fontFamily:"'DM Sans',sans-serif", fontWeight:800, padding:"1px 4px", borderRadius:2, letterSpacing:"0.05em" }}>LIVE</span>}
            </button>
          );
        })}

        <div style={{ width:1, height:20, background:T.border, margin:"0 8px" }} />

        {/* 2026-specific: Weekly / All-Time toggle */}
        {year === 2026 && (
          <>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" }}>View:</span>
            {[["weekly","📊 Weekly Chart"],["alltime","🏆 All-Time Rank"]].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                fontFamily:"'DM Sans', sans-serif", fontWeight:view===v ? 700 : 500, fontSize:12,
                background: view===v ? T.accent : "transparent",
                color: view===v ? "#fff" : T.textMid,
                border:`1px solid ${view===v ? T.accent : T.border}`,
                borderRadius:3, padding:"4px 10px", cursor:"pointer", transition:"all 0.15s",
              }}>{label}</button>
            ))}
            <div style={{ width:1, height:20, background:T.border, margin:"0 8px" }} />
          </>
        )}

        {!showWeekly && (
          <>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" }}>Lang:</span>
            {LANGUAGES.map(l => (
              <button key={l} onClick={() => setFilter(l)} style={{
                fontFamily:"'DM Sans', sans-serif", fontWeight:filter === l ? 700 : 500, fontSize:12,
                background: filter === l ? T.accent : "transparent",
                color: filter === l ? "#fff" : T.textMid,
                border:`1px solid ${filter === l ? T.accent : T.border}`,
                borderRadius:3, padding:"4px 10px", cursor:"pointer", transition:"all 0.15s",
              }}>{l}</button>
            ))}
            <div style={{ marginLeft:"auto", display:"flex", gap:4 }}>
              {["collection","weeks"].map(s => (
                <button key={s} onClick={() => setSortBy(s)} style={{
                  fontFamily:"'DM Sans', sans-serif", fontWeight:sortBy===s ? 700 : 500, fontSize:11,
                  background: sortBy===s ? T.text : "transparent",
                  color: sortBy===s ? "#fff" : T.textMid,
                  border:`1px solid ${sortBy===s ? T.text : T.border}`,
                  borderRadius:3, padding:"4px 10px", cursor:"pointer", transition:"all 0.15s",
                  letterSpacing:"0.04em",
                }}>↕ {s === "collection" ? "Collection" : "Weeks"}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Year note */}
      {(liveNotes || YEAR_NOTES)[year] && (
        <div style={{
          background: year === 2020 || year === 2021 ? "#FFF3CD" : year === 2026 ? "#FFF5F5" : "#F0FDF4",
          borderLeft:`4px solid ${year === 2020 || year === 2021 ? T.gold : year === 2026 ? T.accent : T.green}`,
          padding:"10px 24px",
          fontFamily:"'DM Sans', sans-serif", fontSize:12, color:T.textMid,
          borderBottom:`1px solid ${T.border}`,
        }}>{(liveNotes || YEAR_NOTES)[year]}</div>
      )}

      {/* ── LIVE STATUS STRIP (2026 only — static, no API calls) ── */}
      {year === 2026 && (
        <div style={{ borderBottom:`1px solid ${T.border}`, background:T.surfaceAlt }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 24px", flexWrap:"wrap" }}>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:9, color:"#4ADE80", fontWeight:800, letterSpacing:"0.15em", textTransform:"uppercase" }}>
              ● LIVE
            </span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, color:T.textMuted }}>
              Week 12 · Mar 13, 2026 · Data current as of Fri 13 Mar 2026
            </span>
            <span style={{ background:T.surface, border:`1px solid ${T.border}`, fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMid, padding:"2px 8px", borderRadius:2 }}>
              D2: ₹29.69 Cr premiere (OG BROKEN)
            </span>
            <span style={{ background:T.surface, border:`1px solid ${T.border}`, fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMid, padding:"2px 8px", borderRadius:2 }}>
              Border 2 → Netflix Mar 20
            </span>
            <span style={{ marginLeft:"auto", fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted, fontStyle:"italic" }}>
              Data: Sacnilk · Koimoi · Box Office India
            </span>
          </div>
        </div>
      )}

      {/* ── WEEKLY CHART VIEW ── */}
      {showWeekly ? (
        <div style={{ animation:"fadeIn 0.25s ease both" }}>
          {/* Weekly chart header */}
          <div style={{
            display:"grid", gridTemplateColumns:"36px 28px 1fr 120px 120px 110px 80px",
            background:T.surfaceAlt, borderBottom:`2px solid ${T.borderDark}`, padding:"8px 0",
          }}>
            {[
              ["#","center"],
              ["±","center"],
              ["FILM · DIRECTOR · THIS WEEK'S NOTE","16px"],
              ["THIS WEEK","right"],
              ["INDIA NET","right"],
              ["WORLDWIDE","right"],
              ["BUDGET/STATUS","center"],
            ].map(([label, align], i) => (
              <div key={i} style={{
                fontFamily:"'DM Sans', sans-serif", fontWeight:700, fontSize:9,
                color:T.textMuted, letterSpacing:"0.1em", textTransform:"uppercase",
                padding:`0 ${align === "center" ? "4px" : "14px"}`,
                textAlign:align,
                borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
              }}>{label}</div>
            ))}
          </div>

          {/* Active films section */}
          <div style={{ padding:"6px 12px 4px", background:"#F0FDF4", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#16A34A", display:"inline-block", flexShrink:0 }} />
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, fontWeight:700, color:"#16A34A", letterSpacing:"0.1em", textTransform:"uppercase" }}>
              NOW IN CINEMAS — {weeklyChartMovies.filter(m => m.status === "Running").length} ACTIVE INDIAN RELEASES · RANKED BY THIS WEEK'S COLLECTION
            </span>
          </div>

          {weeklyChartMovies.filter(m => m.status === "Running").map((m, i) => (
            <WeeklyChartRow key={m.title} movie={m} rank={i+1} prevRank={m.lastWeekRank} />
          ))}

          {/* Closed / OTT divider */}
          <div style={{ padding:"6px 12px 4px", background:T.surfaceAlt, borderBottom:`1px solid ${T.border}`, borderTop:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, fontWeight:700, color:T.textMuted, letterSpacing:"0.1em", textTransform:"uppercase" }}>
              ◎ RECENTLY CLOSED / MOVED TO OTT
            </span>
          </div>
          {weeklyChartMovies.filter(m => m.status === "OTT").map((m, i) => (
            <WeeklyChartRow key={m.title} movie={m} rank={"—"} prevRank={null} />
          ))}

          {/* Upcoming divider */}
          <div style={{ padding:"6px 12px 4px", background:"#FFFBF0", borderBottom:`1px solid ${T.border}`, borderTop:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:T.gold, display:"inline-block", flexShrink:0 }} />
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, fontWeight:700, color:T.gold, letterSpacing:"0.1em", textTransform:"uppercase" }}>
              ▶ UPCOMING — NEXT MAJOR RELEASES
            </span>
          </div>
          {weeklyChartMovies.filter(m => m.status === "Upcoming").map((m, i) => (
            <WeeklyChartRow key={m.title} movie={m} rank={"—"} prevRank={null} />
          ))}

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
            display:"grid", gridTemplateColumns:"44px 1fr 130px 120px 105px 100px 88px",
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
            Boxoffy Original · India Box Office Intelligence · boxoffy.com
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
const OTT_CHARTS = {
  updatedDate: "Mar 13, 2026",
  weekRange: "Mar 2–8, 2026",
  india: {
    platform: "Netflix India",
    source: "Sacnilk / Netflix Tudum",
    sourceUrl: "https://sacnilk.com/news/Accused_On_Netflix_Hits_Jackpot_With_15_Million_Views_In_2_Weeks_Dhurandhar_Remains_In_Top_10_Worldwide",
    films: [
      { rank:1, title:"Accused",             lang:"Hindi",   weeks:2,  note:"15M+ views in 2 wks · Trending top 10 in 72 countries", hot:true },
      { rank:2, title:"Dhurandhar",          lang:"Hindi",   weeks:6,  note:"23M views total · 101.3M viewing hours · 6 wks Global top 10", hot:true },
      { rank:3, title:"Chatha Pacha",        lang:"Malayalam", weeks:2, note:"Trending Middle East — Bahrain, Kuwait, Qatar, UAE" },
      { rank:4, title:"Tere Ishk Mein",      lang:"Hindi",   weeks:6,  note:"6 weeks on chart · subcontinent hold" },
      { rank:5, title:"Firebreak",           lang:"Intl",    weeks:3,  note:"#1 in 26 countries globally · Spanish survival thriller" },
      { rank:6, title:"Anaganaga Oka Raju",  lang:"Telugu",  weeks:3,  note:"India-only trending" },
      { rank:7, title:"Dum Laga Ke Haisha",  lang:"Hindi",   weeks:3,  note:"2015 classic resurging · Valentine's Week trigger" },
      { rank:8, title:"Thalaivar Thambi Thalaimaiyil", lang:"Tamil", weeks:3, note:"India + Sri Lanka audience" },
      { rank:9, title:"De De Pyaar De 2",    lang:"Hindi",   weeks:8,  note:"8-week run · India, Bangladesh, Pakistan" },
      { rank:10, title:"Padmaavat",          lang:"Hindi",   weeks:1,  note:"Library re-entry — D2 franchise buzz trigger" },
    ],
  },
  global: {
    platform: "Netflix Global · Non-English Films",
    source: "Netflix Tudum (Official)",
    sourceUrl: "https://www.netflix.com/tudum/articles/top-10-march-2-2026",
    films: [
      { rank:1, title:"Accused",       lang:"Hindi · India",    views:"7.6M", note:"#1 in 5 countries · Top 10 in 72 countries", hot:true },
      { rank:2, title:"Firebreak",     lang:"Spanish · Spain",  views:"4.6M", note:"#1 in 26 countries · 91 countries top 10" },
      { rank:3, title:"Dhurandhar",    lang:"Hindi · India",    views:"3.6M (Wk6)", note:"6 consecutive weeks · 101M+ hours total", hot:true },
      { rank:4, title:"Chatha Pacha",  lang:"Malayalam · India",views:"~2M",  note:"Middle East + India trending" },
      { rank:5, title:"De De Pyaar De 2", lang:"Hindi · India", views:"~1.8M",note:"8-week run · Trending India / Pakistan / Bangladesh" },
      { rank:6, title:"Tere Ishk Mein",  lang:"Hindi · India",  views:"~1.5M",note:"6 weeks global chart presence" },
      { rank:7, title:"Thalaivar Thambi Thalaimaiyil", lang:"Tamil · India", views:"~1.2M", note:"3 weeks · India + Sri Lanka" },
      { rank:8, title:"Anaganaga Oka Raju", lang:"Telugu · India", views:"~1M", note:"India regional chart" },
      { rank:9, title:"Dum Laga Ke Haisha", lang:"Hindi · India",  views:"~0.9M", note:"Library title resurging" },
      { rank:10, title:"Padmaavat",         lang:"Hindi · India",  views:"~0.7M", note:"Library re-entry" },
    ],
  },
};

/* ── OTT RANKINGS SECTION ────────────────────────────────────── */
function OTTRankingsSection() {
  const [tab, setTab] = React.useState("india");
  const chart = tab === "india" ? OTT_CHARTS.india : OTT_CHARTS.global;
  const isGlobal = tab === "global";

  return (
    <div style={{ background:T.surface, borderBottom:`2px solid ${T.border}` }}>

      {/* ── Header ── */}
      <div style={{
        padding:"10px 24px",
        display:"flex", alignItems:"center", gap:0,
        borderBottom:`2px solid ${T.ink || "#0D0D0D"}`,
      }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:11, color:T.text, letterSpacing:"0.22em", textTransform:"uppercase" }}>
          OTT CHARTS
        </span>
        <span style={{ flex:1 }} />
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted }}>
          Week {OTT_CHARTS.weekRange} · {OTT_CHARTS.updatedDate}
        </span>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display:"flex", borderBottom:`1px solid ${T.border}` }}>
        {[
          { key:"india",  label:"🇮🇳  Netflix India Top 10" },
          { key:"global", label:"🌍  Global Non-English Top 10" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
              fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase",
              padding:"9px 20px", border:"none", cursor:"pointer",
              borderBottom: tab === key ? `2px solid ${T.blue}` : "2px solid transparent",
              background: tab === key ? "#EFF6FF" : T.surface,
              color: tab === key ? T.blue : T.textMuted,
              transition:"all 0.12s",
            }}
          >{label}</button>
        ))}
        <div style={{ flex:1 }} />
        <a
          href={chart.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, letterSpacing:"0.06em", padding:"9px 16px", textDecoration:"none" }}
        >Source: {chart.source} ↗</a>
      </div>

      {/* ── Chart rows ── */}
      <div>
        {chart.films.map((film, i) => (
          <div
            key={i}
            style={{
              display:"flex", alignItems:"center", gap:14,
              padding:"9px 24px",
              borderBottom: i < chart.films.length - 1 ? `1px solid ${T.border}` : "none",
              background: film.hot ? "#FFFDF8" : T.surface,
              borderLeft: film.hot ? `3px solid ${T.blue}` : `3px solid transparent`,
            }}
          >
            {/* Rank */}
            <div style={{
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
              fontSize: film.rank <= 3 ? 18 : 14,
              color: film.rank === 1 ? "#B8860B" : film.rank <= 3 ? T.blue : T.textMuted,
              width:22, flexShrink:0, textAlign:"center",
            }}>{film.rank}</div>

            {/* Divider */}
            <div style={{ width:1, height:26, background:T.border, flexShrink:0 }} />

            {/* Title + lang */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{
                fontFamily:"'Barlow Condensed',sans-serif", fontWeight: film.hot ? 800 : 700,
                fontSize:15, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
              }}>{film.title}</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:1 }}>
                {film.lang}
              </div>
            </div>

            {/* Note */}
            <div style={{
              fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted,
              textAlign:"right", maxWidth:220, lineHeight:1.4,
              display:"none",
            }} className="ott-note">{film.note}</div>

            {/* Views (global only) or weeks (india) */}
            <div style={{ flexShrink:0, textAlign:"right" }}>
              {isGlobal ? (
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:14, color:T.blue }}>
                  {film.views}
                </div>
              ) : (
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted }}>
                  Wk {film.weeks}
                </div>
              )}
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, marginTop:1 }}>
                {film.note.split(" · ")[0]}
              </div>
            </div>

            {/* Hot badge */}
            {film.hot && (
              <div style={{
                fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:8,
                letterSpacing:"0.14em", textTransform:"uppercase",
                background:"#1A3A6B", color:"#93C5FD",
                padding:"2px 6px", borderRadius:2, flexShrink:0,
              }}>HOT</div>
            )}
          </div>
        ))}
      </div>
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

/* ── FROM THE DESK — stacked editorial list ─────────────────── */
function EditorialSection({ onNavigate }) {
  const TAG_COLORS = {
    "ANALYSIS":         { bg:"#1E3A5F",  text:"#93C5FD"  },
    "ADVANCE BOOKING":  { bg:"#1A2F1A",  text:"#6EE7B7"  },
    "DEEP DIVE":        { bg:"#1C2B3A",  text:"#7DD3FC"  },
    "US BOX OFFICE":    { bg:"#1A3A6B",  text:"#93C5FD"  },
    "PRICING ANALYSIS": { bg:"#2D1B4E",  text:"#C4B5FD"  },
    "INTERVIEW":        { bg:"#1A3A1A",  text:"#86EFAC"  },
    "OPINION":          { bg:"#3B1F1F",  text:"#FCA5A5"  },
    "EXCLUSIVE":        { bg:"#2D1B4E",  text:"#C4B5FD"  },
    "REPORT":           { bg:"#1A2F1A",  text:"#6EE7B7"  },
    "BREAKING":         { bg:"#7F1D1D",  text:"#FCA5A5"  },
  };

  // Sort newest first — array position is tiebreaker within same date
  const parseDate = (d) => { try { return new Date(d); } catch(e) { return new Date(0); } };
  const sorted = [...EDITORIALS].sort((a, b) => {
    const diff = parseDate(b.date) - parseDate(a.date);
    if (diff !== 0) return diff;
    return EDITORIALS.indexOf(a) - EDITORIALS.indexOf(b); // earlier in array = more recent
  });

  const TagPill = ({ tag, small }) => {
    const s = TAG_COLORS[tag] || TAG_COLORS["ANALYSIS"];
    return (
      <span style={{
        background:s.bg, color:s.text,
        fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
        fontSize: small ? 8 : 9, letterSpacing:"0.14em", textTransform:"uppercase",
        padding: small ? "1px 5px" : "2px 7px", borderRadius:2, flexShrink:0,
        whiteSpace:"nowrap",
      }}>{tag}</span>
    );
  };

  const openArticle = (item) => {
    if (item.url) window.open(item.url, "_blank", "noopener");
    else if (onNavigate && item.section) onNavigate(item.section);
  };

  const nums = ["①","②","③","④","⑤","⑥","⑦","⑧"];

  return (
    <div style={{ background:T.surface, borderTop:`1px solid ${T.border}` }}>

      {/* ── Section header — Variety style: label left, count right ── */}
      <div style={{
        padding:"10px 28px",
        display:"flex", alignItems:"center", gap:0,
        borderBottom:`2px solid ${T.ink || "#0D0D0D"}`,
      }}>
        <span style={{
          fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
          fontSize:11, color:T.text, letterSpacing:"0.22em", textTransform:"uppercase",
        }}>FROM THE DESK</span>
        <span style={{ flex:1 }} />
        <span style={{
          fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMuted,
        }}>{EDITORIALS.length} pieces · Boxoffy Editorial</span>
      </div>

      {/* ── All articles — clean numbered list ── */}
      {sorted.map((item, i) => {
        const isLead = i === 0;
        return (
          <div
            key={i}
            onClick={() => openArticle(item)}
            style={{
              display:"flex", alignItems:"center", gap:16,
              padding: isLead ? "18px 28px" : "12px 28px",
              borderBottom:`1px solid ${T.border}`,
              borderLeft: isLead ? `3px solid ${T.accent}` : `3px solid transparent`,
              background: isLead ? "#FFFDF8" : T.surface,
              cursor:"pointer", transition:"background 0.12s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = isLead ? "#FFF4F0" : "#FAFAF8"}
            onMouseLeave={e => e.currentTarget.style.background = isLead ? "#FFFDF8" : T.surface}
          >
            {/* Issue number */}
            <div style={{
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900,
              fontSize: isLead ? 20 : 14,
              color: isLead ? T.accent : T.textMuted,
              opacity: isLead ? 1 : 0.5,
              flexShrink:0, width:20, textAlign:"center", lineHeight:1,
            }}>{nums[i] || String(i+1)}</div>

            {/* Divider */}
            <div style={{ width:1, height: isLead ? 40 : 28, background:T.border, flexShrink:0 }} />

            {/* Tag */}
            <TagPill tag={item.tag} small={!isLead} />

            {/* Headline + dek (lead only) */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{
                fontFamily:"'Barlow Condensed',sans-serif",
                fontWeight: isLead ? 800 : 700,
                fontSize: isLead ? 17 : 14,
                color:T.text, lineHeight:1.2,
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

            {/* Meta — right side */}
            <div style={{ flexShrink:0, textAlign:"right" }}>
              {isLead && (
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700, color:T.textMid, marginBottom:2 }}>
                  {item.author}
                </div>
              )}
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:T.textMuted, letterSpacing:"0.04em" }}>
                {item.date} · {item.readTime}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ flexShrink:0, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:16, color:T.accent }}>→</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── HEADER SNAPSHOT CARDS ──────────────────────────────────── */
function HeaderSnapshotCards({ activeSection }) {
  const [daysLeft, setDaysLeft] = useState(null);
  useEffect(() => {
    const calc = () => {
      const target = new Date("2026-03-19T00:00:00");
      const diff = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24));
      setDaysLeft(diff > 0 ? diff : 0);
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, []);

  const CARDS = {
    "Box Office": [
      { type:"stat",      label:"WEEK 10 · #1 FILM",    value:"Kerala Story 2",sub:"₹32.87 Cr net · Wk 2 · Plus verdict",      accent:T.green,   icon:"🏆" },
      { type:"stat",      label:"2026 YTD COMBINED",     value:"₹1,567 Cr",   sub:"Verified tracked releases · Week 10",         accent:T.blue,    icon:"📊" },
      { type:"stat",      label:"ALL-TIME RECORD",       value:"₹1,800 Cr",   sub:"Pushpa 2 · Will Ramayana break it?",         accent:T.gold,    icon:"⚡" },
      { type:"countdown", label:"NEXT BIG RELEASE",      value:daysLeft != null ? `${daysLeft}` : "—", valueSuffix:" days",
                          sub:"Dhurandhar 2 · Mar 19, 2026",                                                                     accent:T.accent,  icon:"🎬", pulse:true },
    ],
    "Weekly": [
      { type:"stat",      label:"THIS WEEK · LEADER",    value:"Kerala Story 2",sub:"₹25.65 Cr net · Wk 2 · +39% weekend hold",   accent:T.green,   icon:"🏆" },
      { type:"stat",      label:"BIGGEST DROP",          value:"Border 2",     sub:"Closing · ₹481 Cr WW final",                accent:T.textMuted,icon:"📉" },
      { type:"stat",      label:"OTT THIS WEEK",         value:"With Love",    sub:"Netflix from Mar 6 · ₹39 Cr WW · 644% ROI",accent:T.purple,  icon:"📺" },
      { type:"countdown", label:"COUNTDOWN",             value:daysLeft != null ? `${daysLeft}` : "—", valueSuffix:" days",
                          sub:"Dhurandhar 2 · Mar 19 · Eid",                                                                     accent:T.accent,  icon:"🎬", pulse:true },
    ],
  };
  const cards = (CARDS[activeSection] || CARDS["Box Office"]);

  return (
    <div style={{ display:"flex", gap:0, borderLeft:`1px solid ${T.border}`, flexShrink:0 }}>
      {cards.map((card, i) => (
        <div key={i} style={{ position:"relative", textAlign:"right", padding:"4px 18px 8px", borderRight:`1px solid ${T.border}`, minWidth:148 }}>
          <div style={{ position:"absolute", top:0, right:0, left:0, height:2, background:card.pulse ? `linear-gradient(90deg,transparent,${card.accent})` : card.accent, opacity:0.8 }} />
          <div style={{ fontSize:12, marginBottom:2, opacity:0.7 }}>{card.icon}</div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:8, fontWeight:700, color:T.textMuted, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:3 }}>{card.label}</div>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"flex-end", gap:1 }}>
            <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:card.type==="countdown"?28:20, color:card.accent, lineHeight:1, ...(card.pulse?{animation:"pulseFade 2s ease-in-out infinite"}:{}) }}>{card.value}</span>
            {card.valueSuffix && <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:card.accent, fontWeight:700 }}>{card.valueSuffix}</span>}
          </div>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.textMid, marginTop:2, lineHeight:1.3 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ── COOKIE CONSENT HELPERS ─────────────────────────────────
   Key: boxoffy_cookie_consent
   Values: "accepted" | "declined" | null (not yet decided)
   GA4 only fires after "accepted" is stored.
──────────────────────────────────────────────────────────── */
const CONSENT_KEY = "boxoffy_cookie_consent";

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
    <div style={{ maxWidth:720, margin:"0 auto", padding:"40px 32px 80px",
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
          Boxoffy.com · Last updated: March 13, 2026 · Effective date: March 13, 2026
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
   Mailchimp embedded form — posts to boxoffy.us16.list-manage.com via hidden
   iframe so there's no redirect or new tab opened on the user's screen.
   Fields: EMAIL, FNAME (first name), MMERGE3 (language preference)
   ─────────────────────────────────────────────────────────────────────────── */
const MAILCHIMP_ACTION_URL = "https://boxoffy.us16.list-manage.com/subscribe/post?u=306da5d11e109c71055a97422&id=9e4b95b96f&f_id=003e1fe1f0";

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
      // Hidden iframe trick — Mailchimp's response is swallowed silently,
      // never shown to the user or opened in a new tab
      const iframeId = "mc-hidden-iframe";
      let iframe = document.getElementById(iframeId);
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = iframeId;
        iframe.name = iframeId;
        iframe.style.display = "none";
        document.body.appendChild(iframe);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = MAILCHIMP_ACTION_URL;
      form.target = iframeId;
      form.style.display = "none";

      const fields = { EMAIL: email, FNAME: name, MMERGE3: lang };
      Object.entries(fields).forEach(([k, v]) => {
        const input = document.createElement("input");
        input.name  = k;
        input.value = v;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
      setStatus("success");
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
      // EmailJS — replace the 3 IDs below after setting up emailjs.com account
      // Template vars to map: {{from_name}}, {{from_email}}, {{phone}}, {{message}}
      const SERVICE_ID  = "YOUR_EMAILJS_SERVICE_ID";
      const TEMPLATE_ID = "YOUR_EMAILJS_TEMPLATE_ID";
      const PUBLIC_KEY  = "YOUR_EMAILJS_PUBLIC_KEY";

      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id:  SERVICE_ID,
          template_id: TEMPLATE_ID,
          user_id:     PUBLIC_KEY,
          template_params: {
            from_name:  form.name,
            from_email: form.email,
            phone:      form.phone || "Not provided",
            message:    form.message,
            reply_to:   form.email,
          },
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
      <div style={{ maxWidth:1160, margin:"0 auto", padding:"48px 32px 56px" }}>

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

        <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:48 }}>

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
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
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

export default function App() {
  const [activeSection, setActiveSection] = useState("Box Office");
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [cookieConsent, setCookieConsent] = useState(getConsent);

  // Fire GA4 on mount if already consented from a previous visit
  useEffect(() => {
    if (getConsent() === "accepted") loadGA4();
  }, []);

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
    activeSection === "Bollywood" ? "Bollywood" :
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
        * { box-sizing: border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:${T.bg}; }
        ::-webkit-scrollbar-thumb { background:${T.borderDark}; border-radius:3px; }
        button { cursor:pointer; }
        button:hover { filter: brightness(0.92); }
      `}</style>

      <NavBar activeSection={activeSection} setActiveSection={setActiveSection} />

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
            India Box Office Intelligence
          </p>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:10 }}>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, color:T.textMid, borderLeft:`2px solid ${T.accent}`, paddingLeft:8, lineHeight:1.5 }}>
              {activeSection === "Box Office" && "Box Office · Verified worldwide data · 2020–2026"}
              {activeSection === "Bollywood" && "Trade news · Releases · Controversy · Analysis"}
              {activeSection === "OTT" && "Netflix · Prime Video · JioCinema · Hotstar · SonyLIV"}
              {activeSection === "TV" && "TRP ratings · Reality · Drama serials · Channel intelligence"}
              {activeSection === "Weekly" && "Weekly Box Office Commentary · Boxoffy"}
            </span>
          </div>
        </div>

        {/* ── Snapshot Cards ─────────────────────────────────────── */}
        <HeaderSnapshotCards activeSection={activeSection} />
      </div>


      {/* Content */}
      <div style={{ maxWidth:1160, margin:"0 auto", background:T.surface, boxShadow:"0 0 0 1px #E2E5EA", animation:"fadeIn 0.3s ease both" }}>
        {activeSection === "Box Office" && <BoxOfficeSection onNavigate={setActiveSection} />}
        {activeSection === "Weekly" && <WeeklyCommentarySection />}
        {newsCategory && newsCategory === "OTT" && <OTTRankingsSection />}
        {newsCategory && <NewsSection category={newsCategory} />}
      </div>

      {/* Contact Section */}
      <ContactSection />

      {/* Footer */}
      <div style={{ background:"#F9FAFB", color:T.textMuted, fontFamily:"'DM Sans', sans-serif", fontSize:11, padding:"24px 32px", borderTop:`2px solid ${T.accent}` }}>
        <div style={{ maxWidth:1160, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:0, marginBottom:10 }}>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:20, color:T.text, letterSpacing:"-0.02em" }}>BOXOF</span>
            <span style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:20, color:T.accent, letterSpacing:"-0.02em" }}>FY</span>
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:10, color:T.textMuted, marginLeft:10, letterSpacing:"0.18em", textTransform:"uppercase" }}>India Box Office Intelligence</span>
          </div>
          <div style={{ display:"flex", gap:24, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
            {["Box Office","Bollywood","OTT","TV","Weekly"].map(s => (
              <span key={s}
                onClick={() => { setActiveSection(s); window.scrollTo({top:0,behavior:"smooth"}); }}
                onMouseEnter={e => e.target.style.color=T.accent}
                onMouseLeave={e => e.target.style.color=T.textMuted}
                style={{ color:T.textMuted, fontSize:11, fontWeight:600, letterSpacing:"0.06em", cursor:"pointer", transition:"color 0.15s" }}
              >{s}</span>
            ))}
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
              <span style={{ fontSize:11 }}>© 2026 Boxoffy.com · India Box Office Intelligence · Box office data from industry tracking sources · Current as of Mar 13, 2026 · All figures in ₹ Crores</span>
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
