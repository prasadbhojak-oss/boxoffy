#!/usr/bin/env node
/**
 * Boxoffy Year-Archive Page Generator — v1
 * ─────────────────────────────────────────
 * Builds india-box-office-<YEAR>.html for every year present in films.json.
 *
 * Why this exists
 *   films.json covers 37 years. Only 10 year pages (2010–2019) were ever
 *   committed. The other 27 are the single largest source of broken internal
 *   links on the site (48 of 77) and 8 of the 35 URLs in the Search Console
 *   "Not found (404)" report. india-box-office-2026.html alone is linked from
 *   29 film pages.
 *
 * Data-integrity mode (IMPORTANT)
 *   Years whose archive rows are demonstrably unreliable are generated in
 *   REVIEW mode: verdict column and verdict-derived stats are suppressed and
 *   the page is marked noindex,follow. The 404 is fixed and breadcrumb equity
 *   still flows, but Google is not fed classifications we cannot stand behind.
 *   See REVIEW_THRESHOLD below. Nothing is fabricated to fill a column.
 *
 * Usage
 *   node generate-year-pages.cjs              # write missing pages only
 *   node generate-year-pages.cjs --all        # rewrite every year page
 *   node generate-year-pages.cjs --nav-only   # only refresh the year nav strip
 *   node generate-year-pages.cjs --dry        # report, write nothing
 *
 * Writes to public/ and mirrors into dist/ when dist/ exists.
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = __dirname;
const PUBLIC  = path.join(ROOT, 'public');
const DIST    = path.join(ROOT, 'dist');
const DATA    = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/films.json'), 'utf8'));
const NOTES   = readJSON(path.join(ROOT, 'src/data/year-notes.json')) || {};

const ARG      = process.argv.slice(2);
const ALL      = ARG.includes('--all');
const NAV_ONLY = ARG.includes('--nav-only');
const DRY      = ARG.includes('--dry');

const BASE  = 'https://www.boxoffy.com';
const TODAY = new Date().toISOString().slice(0, 10);

/* Years whose archive rows are under review.
   Trigger: >60% of the year's films carry "All-Time Blockbuster".
   Observed 1990–2009 at 68–91%, which is not a real distribution — the rows
   were seeded from a curated "biggest films of the year" list and every row
   inherited the same verdict. Several are also filed under the wrong year.
   Until the archive is deduped and re-verdicted these pages stay noindex. */
const REVIEW_THRESHOLD = 0.60;

/* Hero notes for years where year-notes.json is stale or absent are derived
   from the data itself. We never write narrative we cannot source. */
const STALE_NOTES = new Set(['2025', '2026']);

const VERDICT_COLOR = {
  'all-time blockbuster': '#7C3AED',
  'all time blockbuster': '#7C3AED',
  'blockbuster'         : '#15803D',
  'super hit'           : '#047857',
  'hit'                 : '#16A34A',
  'semi hit'            : '#0891B2',
  'plus'                : '#0891B2',
  'average'             : '#B8860B',
  'below average'       : '#D97706',
  'flop'                : '#DC2626',
  'disaster'            : '#991B1B',
  'ott hit'             : '#6366F1',
  'ott premiere'        : '#6366F1',
  'rerun'               : '#6B6457',
  'upcoming'            : '#6B6457',
  'tracking'            : '#6B6457',
};

/* ── helpers ─────────────────────────────────────────────────────────── */

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Parse "₹315.49 Cr" / "279 Cr" / "~₹16.4 Cr" → 315.49. Returns null if absent. */
function crore(v) {
  if (v == null) return null;
  const m = String(v).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/** Display a nett figure exactly as held, only adding ₹ when it is missing. */
function nett(m) {
  const raw = String(m.indiaNet == null ? '' : m.indiaNet).trim();
  if (!raw || raw === '—' || raw === '-') return '—';
  return /^₹/.test(raw) ? raw : (/^[~\d]/.test(raw) ? '₹' + raw.replace(/^~\s*/, '') : raw);
}

function verdictColor(v) {
  return VERDICT_COLOR[String(v || '').trim().toLowerCase()] || '#6B6457';
}

/** Release month as "2015-07" when the date parses, else "". */
function relMonth(m) {
  const d = new Date(m.releaseDate);
  return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function castLine(m) {
  const c = m.cast;
  if (Array.isArray(c)) return c.slice(0, 3).join(', ');
  return typeof c === 'string' ? c : '';
}

function era(year) {
  const y = parseInt(year, 10);
  if (y < 2017) return { label: 'Entertainment Tax Era', note: 'Pre-GST era: Entertainment Tax varied by state (0%–110%). Figures are India Nett and not directly comparable to post-Jul 2017 GST-era collections.' };
  if (y === 2017) return { label: 'GST Transition Year', note: 'GST replaced Entertainment Tax from 1 July 2017. Figures either side of that date are not directly comparable.' };
  return { label: 'GST Era', note: 'GST-era India Nett. Comparable with 2018 onward; not directly comparable with pre-Jul 2017 figures.' };
}

/* ── per-year analysis ───────────────────────────────────────────────── */

function analyse(year, rows) {
  const ranked = rows
    .map(m => ({ m, n: crore(m.totalNum != null ? m.totalNum : m.indiaNet) }))
    .filter(x => x.n != null && x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map(x => x.m);

  const atbb = rows.filter(m => /^all[- ]time blockbuster$/i.test(String(m.verdict || '').trim())).length;
  const atbbShare = rows.length ? atbb / rows.length : 0;
  const review = atbbShare > REVIEW_THRESHOLD;

  const count = v => ranked.filter(m => new RegExp(`^${v}$`, 'i').test(String(m.verdict || '').trim())).length;

  // Best ROI, only where both nett and budget are present and parse.
  let bestRoi = null;
  for (const m of ranked) {
    const n = crore(m.totalNum != null ? m.totalNum : m.indiaNet);
    const b = crore(m.budget);
    if (n && b && b > 0) {
      const r = n / b;
      if (!bestRoi || r > bestRoi.r) bestRoi = { m, r, n, b };
    }
  }

  // Freshness is derived from the data, never from the clock.
  // "newest" = most recent release that has actually happened.
  // "unfigured" = released, but still carrying no collection figure — the real
  // staleness signal for a running year, since release dates go stale silently
  // while an empty indiaNet does not.
  const now = Date.now();
  let newest = null, unfigured = [];
  for (const m of rows) {
    const d = new Date(m.releaseDate);
    if (isNaN(d) || d.getTime() > now) continue;
    if (!newest || d > newest) newest = d;
    const figure = String(m.indiaNet == null ? '' : m.indiaNet).trim();
    if (!figure || figure === '—' || figure === '-' || /^upcoming$/i.test(String(m.status || ''))) {
      unfigured.push(m.title);
    }
  }

  return {
    ranked,
    total: rows.length,
    review,
    atbbShare,
    blockbusters: count('all[- ]time blockbuster') + count('blockbuster'),
    hits: count('super hit') + count('hit') + count('semi hit'),
    flops: count('flop') + count('disaster'),
    bestRoi,
    newest,
    unfigured,
  };
}

/* ── page fragments ──────────────────────────────────────────────────── */

function yearNav(years, current) {
  const decades = {};
  for (const y of years) {
    const d = Math.floor(parseInt(y, 10) / 10) * 10;
    (decades[d] = decades[d] || []).push(y);
  }
  const groups = Object.keys(decades).sort((a, b) => b - a).map(d => {
    const btns = decades[d].sort((a, b) => b - a).map(y =>
      `<a href="india-box-office-${y}.html" class="year-nav-btn${y === current ? ' current' : ''}">${y}</a>`
    ).join('');
    return `<span class="year-nav-decade">${d}s</span>${btns}`;
  }).join('<div class="year-nav-divider"></div>');

  return `<div class="year-nav">
  <span class="year-nav-label">Archives:</span>
  ${groups}
  <div class="year-nav-divider"></div>
  <a href="/" class="back-home">← Live</a>
</div>`;
}

function statBoxes(a, year) {
  const [f1, f2, f3] = a.ranked;
  const box = (cls, label, val, sub) =>
    `    <div class="adv-box ${cls}">
      <div class="adv-lbl">${esc(label)}</div>
      <div class="adv-val">${esc(val)}</div>
      <div class="adv-sub">${esc(sub)}</div>
    </div>`;

  const boxes = [];
  if (f1) boxes.push(box('s-red', '#1 Film', f1.title, `${nett(f1)} India Nett`));
  boxes.push(box('s-gold', 'Films Tracked', String(a.total), 'Rows in the Boxoffy archive for this year'));
  boxes.push(box('s-blue', 'Tax Regime', era(year).label, era(year).label === 'GST Era' ? 'GST-era India Nett' : 'Nett ≠ GST-era nett'));
  if (f2) boxes.push(box('s-orange', '#2 Film', f2.title, nett(f2)));
  if (f3) boxes.push(box('s-purple', '#3 Film', f3.title, nett(f3)));
  if (a.review) {
    boxes.push(box('s-green', 'Archive Status', 'Under review', 'Verdicts withheld — see note below'));
  } else if (a.bestRoi) {
    boxes.push(box('s-green', 'Best Return', a.bestRoi.m.title, `${a.bestRoi.r.toFixed(1)}× on ${esc(String(a.bestRoi.m.budget))}`));
  }
  return `<div class="adv-row">\n${boxes.join('\n')}</div>`;
}

function heroNote(year, a) {
  const note = NOTES[year];
  if (note && !STALE_NOTES.has(year)) return esc(note);

  const [f1, f2, f3] = a.ranked;
  const parts = [];
  if (f1) parts.push(`${f1.title} leads the year at ${nett(f1)} India nett`);
  if (f2) parts.push(`${f2.title} ${nett(f2)}`);
  if (f3) parts.push(`${f3.title} ${nett(f3)}`);
  let s = parts.length ? parts.join(' · ') + '.' : `${a.total} films tracked for ${year}.`;

  if (year === String(new Date().getFullYear()) && a.newest) {
    s += ` Archive rows current to ${a.newest.toISOString().slice(0, 10)}.`;
  }
  return esc(s);
}

/** The honest disclosure block. Renders only when there is something to disclose. */
function provenanceNote(year, a) {
  const bits = [];

  if (a.review) {
    bits.push(`<strong>Verdict classifications for ${year} are withheld.</strong> ${Math.round(a.atbbShare * 100)}% of the archive rows for this year carry an identical “All-Time Blockbuster” classification, which is not a real distribution — these rows were seeded from a curated list of the year’s biggest films and inherited one verdict. Some titles are also filed under the wrong release year. Collection figures are shown as held; verdicts are not shown until the archive is re-verified.`);
  }
  if (a.total < 15) {
    bits.push(`<strong>Coverage for ${year} is incomplete.</strong> ${a.total} film${a.total === 1 ? '' : 's'} tracked, against 30–60 in a typical recent year. This is a gap in the archive, not a quiet year.`);
  }
  if (a.unfigured && a.unfigured.length) {
    const shown = a.unfigured.slice(0, 6).join(', ');
    const more  = a.unfigured.length > 6 ? ` and ${a.unfigured.length - 6} more` : '';
    bits.push(`<strong>${a.unfigured.length} released film${a.unfigured.length === 1 ? ' has' : 's have'} no collection figure recorded for ${year}</strong> — ${esc(shown)}${more}. ${a.unfigured.length === 1 ? 'It is' : 'They are'} excluded from the ranking below rather than shown at zero.${a.newest ? ` Most recent release held for ${year}: ${a.newest.toISOString().slice(0, 10)}.` : ''}`);
  }

  if (!bits.length) return '';
  return `
  <div class="provenance">
    <div class="prov-label">What is missing from this page</div>
    ${bits.map(b => `<p>${b}</p>`).join('\n    ')}
  </div>`;
}

function filmRows(a) {
  return a.ranked.map((m, i) => {
    const rank = i + 1;
    const nettColor = rank === 1 ? '#C8201A' : rank <= 3 ? '#D97706' : 'inherit';
    const meta = [m.language, m.genre, relMonth(m)].filter(Boolean).join(' · ');
    const cast = castLine(m);
    const verdictCell = a.review ? '' :
      `\n      <td class="verdict-cell"><span class="verdict-badge" style="color:${verdictColor(m.verdict)};border-color:${verdictColor(m.verdict)}">${esc(m.verdict || '—')}</span></td>`;
    const title = m.pageUrl
      ? `<a href="${esc(String(m.pageUrl).replace(/^\//, ''))}" style="color:inherit;text-decoration:none">${esc(m.title)}</a>`
      : esc(m.title);

    return `    <tr class="film-row">
      <td class="rank-cell" style="color:#C8201A">${rank}</td>
      <td class="title-cell">
        <div class="film-title">${title}</div>
        <div class="film-meta-row">${esc(meta)}</div>
        <div class="film-cast">${esc(cast)}</div>
      </td>
      <td class="director-cell">${esc(m.director || '—')}</td>
      <td class="nett-cell"><span class="nett-val" style="color:${nettColor}">${nett(m)}</span></td>${verdictCell}
      <td class="budget-cell">${esc(m.budget || '—')}</td>
      <td class="ott-cell">${esc(m.ott || '—')}</td>
    </tr>`;
  }).join('\n');
}

/* ── the page ────────────────────────────────────────────────────────── */

function buildPage(year, rows, allYears) {
  const a    = analyse(year, rows);
  const f1   = a.ranked[0];
  const E    = era(year);
  const url  = `${BASE}/india-box-office-${year}.html`;
  const n    = a.ranked.length;
  const lead = f1 ? `#1: ${f1.title} ${nett(f1)}.` : '';

  const title = `India Box Office ${year} — Top Films, Collections${a.review ? '' : ' &amp; Verdicts'} | Boxoffy`;
  const desc  = `India box office ${year} — collection data for ${n} tracked film${n === 1 ? '' : 's'}. ${lead} Ranked by India nett.`;
  const robots = a.review ? 'noindex, follow' : 'index, follow, max-snippet:-1, max-image-preview:large';

  const ld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: `India Box Office ${year} — Top Films and Collections`,
    description: desc, url,
    datePublished: `${year}-12-31`, dateModified: TODAY,
    image: `${BASE}/og-image.png`,
    author:    { '@type': 'Organization', name: 'Boxoffy', url: BASE },
    publisher: { '@type': 'Organization', name: 'Boxoffy', url: BASE,
                 logo: { '@type': 'ImageObject', url: `${BASE}/og-image.png`, width: 1200, height: 630 } },
    about: { '@type': 'Thing', name: `Indian Cinema ${year}`, description: `India box office collections ${year}` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Boxoffy', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Box Office Archives', item: `${BASE}/#archives` },
      { '@type': 'ListItem', position: 3, name: `India Box Office ${year}`, item: url },
    ],
  };

  const shareText = encodeURIComponent(`India Box Office ${year} — Collections | Boxoffy`);
  const shareUrl  = encodeURIComponent(url);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google Consent Mode v2 — defaults DENIED, must run before AdSense/GA4 -->
<script>
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
(function(){var c=null;try{c=localStorage.getItem("boxoffy_cookie_consent");}catch(e){}
if(c==="accepted"){gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});}})();
</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4390119818827949" crossorigin="anonymous"></script>

  <!-- Google Analytics — consent-gated (DPDP Act 2023 compliant) -->
  <script>
  (function(){
    var c=null;try{c=localStorage.getItem("boxoffy_cookie_consent");}catch(e){}
    if(c==="accepted"){
      var s=document.createElement("script");s.async=true;
      s.src="https://www.googletagmanager.com/gtag/js?id=G-K6C9EVRFH4";
      document.head.appendChild(s);
      window.dataLayer=window.dataLayer||[];
      window.gtag=function(){window.dataLayer.push(arguments);};
      gtag("js",new Date());gtag("config","G-K6C9EVRFH4",{anonymize_ip:true});
    }
  })();
  </script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
<meta property="og:title" content="India Box Office ${year} — Top Films &amp; Collections | Boxoffy">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Boxoffy — India Box Office Intelligence">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_IN">
<meta property="article:section" content="Box Office Archives">
<meta property="article:tag" content="India Box Office ${year}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="India Box Office ${year} — Top Films &amp; Collections">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${BASE}/og-image.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
<link rel="canonical" href="${url}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0D0D0D;--paper:#F7F3EC;--red:#C8201A;--gold:#B8860B;--gold-light:#E8C547;--muted:#6B6457;--rule:#D4C9B4;--surface:#FFFFFF;--green:#15803D}
html{scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}

.nav{background:#fff;padding:0 32px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;border-bottom:3px solid var(--red);height:52px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.nav-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;color:var(--ink);letter-spacing:-.02em;text-decoration:none}
.nav-logo span{color:var(--red)}
.nav-links{display:flex;gap:20px;align-items:center}
.nav-links a{font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;color:#6B7280;text-decoration:none;letter-spacing:.05em;text-transform:uppercase;transition:color .15s}
.nav-links a:hover,.nav-links a.active{color:var(--red)}

.hero{background:var(--ink);position:relative;overflow:hidden;border-bottom:4px solid var(--red)}
.hero-texture{position:absolute;inset:0;background:repeating-linear-gradient(-45deg,transparent,transparent 38px,rgba(200,32,26,.04) 38px,rgba(200,32,26,.04) 39px)}
.hero-inner{position:relative;max-width:1100px;margin:0 auto;padding:52px 32px 40px}
.hero-eyebrow{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.archive-badge{background:var(--red);color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:11px;letter-spacing:.2em;text-transform:uppercase;padding:4px 12px;border-radius:2px}
.era-badge{background:#D97706;color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:2px}
.review-badge{background:#6B6457;color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:2px}
.hero-meta{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:#6B7280;letter-spacing:.1em;text-transform:uppercase}
.hero-year{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(80px,14vw,150px);color:#fff;line-height:.85;letter-spacing:-.03em;margin-bottom:8px}
.hero-year span{color:var(--red)}
.hero-subtitle{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:clamp(16px,2.8vw,26px);color:#9CA3AF;letter-spacing:.04em;margin-bottom:12px}
.hero-note{font-family:'DM Sans',sans-serif;font-size:13px;color:#D1D5DB;line-height:1.6;max-width:760px;margin-bottom:32px;font-style:italic}

.adv-row{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid rgba(255,255,255,.08)}
@media(max-width:768px){.adv-row{grid-template-columns:repeat(3,1fr)}}
@media(max-width:480px){.adv-row{grid-template-columns:repeat(2,1fr)}}
.adv-box{padding:16px 18px;border-right:1px solid rgba(255,255,255,.07);position:relative}
.adv-box:last-child{border-right:none}
.adv-box::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.s-red::before{background:var(--red)}.s-gold::before{background:var(--gold)}.s-green::before{background:#16A34A}.s-blue::before{background:#3B82F6}.s-orange::before{background:#F59E0B}.s-purple::before{background:#8B5CF6}
.adv-lbl{font-family:'DM Sans',sans-serif;font-size:8px;font-weight:700;color:#6B7280;letter-spacing:.16em;text-transform:uppercase;margin-bottom:5px}
.adv-val{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:18px;line-height:1.1;color:#fff}
.s-red .adv-val{color:#FCA5A5}.s-gold .adv-val{color:var(--gold-light)}
.adv-sub{font-family:'DM Sans',sans-serif;font-size:9px;color:#4B5563;margin-top:3px}

.year-nav{background:#111;border-bottom:1px solid #222;padding:12px 32px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.year-nav-label{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:700;color:#6B7280;letter-spacing:.1em;text-transform:uppercase;margin-right:6px}
.year-nav-decade{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:700;color:#4B5563;letter-spacing:.1em;text-transform:uppercase;margin:0 2px 0 6px}
.year-nav-btn{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;color:#9CA3AF;text-decoration:none;padding:3px 9px;border:1px solid #333;border-radius:3px;transition:all .15s}
.year-nav-btn:hover{color:#fff;border-color:#555;background:#1a1a1a}
.year-nav-btn.current{background:var(--red);color:#fff;border-color:var(--red)}
.year-nav-divider{width:1px;height:18px;background:#333;margin:0 4px}
.back-home{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:#6B7280;text-decoration:none;letter-spacing:.06em;text-transform:uppercase;margin-left:auto;transition:color .15s}
.back-home:hover{color:#C8201A}

.content{max-width:1100px;margin:0 auto;padding:40px 32px 80px}
.sec-head{display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:2px solid var(--rule);margin-bottom:24px;margin-top:40px}
.sec-eyebrow{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
.sec-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:var(--ink)}

.highlights-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:32px}
.highlight-card{background:var(--surface);border:1px solid var(--rule);padding:20px;border-top:3px solid var(--red)}
.hl-label{font-family:'DM Sans',sans-serif;font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px}
.hl-val{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:var(--ink);line-height:1.1;margin-bottom:4px}
.hl-sub{font-family:'DM Sans',sans-serif;font-size:11px;color:var(--muted)}

.provenance{background:#FFF8E7;border:1px solid var(--rule);border-left:4px solid var(--gold);padding:18px 20px;margin:24px 0}
.prov-label{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:10px}
.provenance p{font-family:'DM Sans',sans-serif;font-size:13px;line-height:1.65;color:#3F3A30;margin-bottom:10px;max-width:76ch}
.provenance p:last-child{margin-bottom:0}

.table-wrap{background:var(--surface);border:1px solid var(--rule);overflow-x:auto}
table{width:100%;border-collapse:collapse;min-width:760px}
thead th{background:var(--ink);color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:12px 14px;text-align:left;white-space:nowrap}
thead th.center{text-align:center}
.film-row{border-bottom:1px solid var(--rule)}
.film-row:last-child{border-bottom:none}
.film-row:nth-child(even){background:#FCFAF6}
td{padding:12px 14px;vertical-align:top;font-family:'DM Sans',sans-serif;font-size:13px}
.rank-cell{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:18px;text-align:center;width:48px}
.film-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;color:var(--ink);line-height:1.2}
.film-meta-row{font-size:11px;color:var(--muted);margin-top:2px}
.film-cast{font-size:11px;color:#8A8474;margin-top:2px}
.director-cell{font-size:12px;color:var(--muted);white-space:nowrap}
.nett-cell{text-align:center;white-space:nowrap}
.nett-val{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px}
.verdict-cell{text-align:center}
.verdict-badge{display:inline-block;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border:1px solid;border-radius:2px;white-space:nowrap}
.budget-cell{text-align:center;font-size:12px;color:var(--muted);white-space:nowrap}
.ott-cell{font-size:12px;color:var(--muted)}
.table-footer{padding:14px 16px;border-top:1px solid var(--rule);font-family:'DM Sans',sans-serif;font-size:11px;color:var(--muted);line-height:1.6;background:#FCFAF6}

.share-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:32px;padding-top:20px;border-top:1px solid var(--rule)}
.share-label{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.14em;text-transform:uppercase}
.share-btn{font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;text-decoration:none;padding:7px 14px;border:1px solid var(--rule);border-radius:3px;color:var(--ink);background:var(--surface);cursor:pointer;transition:all .15s}
.share-btn:hover{border-color:var(--red);color:var(--red)}

.footer{background:var(--ink);color:#9CA3AF;padding:32px;text-align:center;font-family:'DM Sans',sans-serif;font-size:12px;line-height:1.7}
.footer a{color:#9CA3AF}
a:focus-visible,button:focus-visible{outline:2px solid var(--red);outline-offset:2px}
@media(max-width:640px){.hero-inner,.content,.year-nav,.nav{padding-left:16px;padding-right:16px}.nav-links{gap:12px}}
</style>
</head>
<body>

<nav class="nav">
  <a href="/" class="nav-logo">BOX<span>OFFY</span></a>
  <div class="nav-links">
    <a href="/">Box Office</a>
    <a href="/about.html">About</a>
    <a href="/india-boxoffice-how-it-works.html">How BO Works</a>
    <a href="/#archives" class="active">Archives</a>
  </div>
</nav>

<section class="hero">
  <div class="hero-texture"></div>
  <div class="hero-inner">
    <div class="hero-eyebrow">
      <span class="archive-badge">📁 Archive</span>
      <span class="era-badge">${E.label}</span>
      ${a.review ? '<span class="review-badge">Verdicts under review</span>' : ''}
      <span class="hero-meta">Boxoffy Archive · India Nett</span>
    </div>
    <div class="hero-year">${year.slice(0, 2)}<span>${year.slice(2)}</span></div>
    <div class="hero-subtitle">India Box Office — ${n} Film${n === 1 ? '' : 's'} Ranked by India Nett</div>
    <p class="hero-note">${heroNote(year, a)}</p>
    ${statBoxes(a, year)}
  </div>
</section>

${yearNav(allYears, year)}

<main class="content">

  <nav aria-label="breadcrumb" style="margin-bottom:24px;font-family:'DM Sans',sans-serif;font-size:12px;color:var(--muted)">
    <a href="/" style="color:var(--muted);text-decoration:none">Boxoffy</a>
    <span style="margin:0 6px">›</span>
    <a href="/#archives" style="color:var(--muted);text-decoration:none">Archives</a>
    <span style="margin:0 6px">›</span>
    <span style="color:var(--ink);font-weight:600">${year}</span>
  </nav>
${provenanceNote(year, a)}
${a.review ? '' : `
  <div class="sec-head">
    <div>
      <div class="sec-eyebrow">Year In Review</div>
      <div class="sec-title">${year} — Key Stats</div>
    </div>
  </div>
  <div class="highlights-grid">
    <div class="highlight-card">
      <div class="hl-label">Blockbusters</div>
      <div class="hl-val">${a.blockbusters} film${a.blockbusters === 1 ? '' : 's'}</div>
      <div class="hl-sub">Blockbuster or All-Time Blockbuster in the archive</div>
    </div>
    <div class="highlight-card">
      <div class="hl-label">Hits</div>
      <div class="hl-val">${a.hits} film${a.hits === 1 ? '' : 's'}</div>
      <div class="hl-sub">Hit, Super Hit or Semi Hit</div>
    </div>
    <div class="highlight-card">
      <div class="hl-label">Flops + Disasters</div>
      <div class="hl-val">${a.flops} film${a.flops === 1 ? '' : 's'}</div>
      <div class="hl-sub">Tracked titles only — not the full year's release slate</div>
    </div>
    ${a.bestRoi ? `<div class="highlight-card">
      <div class="hl-label">Best Return</div>
      <div class="hl-val">${esc(a.bestRoi.m.title)}</div>
      <div class="hl-sub">${nett(a.bestRoi.m)} nett on ${esc(String(a.bestRoi.m.budget))} · ${a.bestRoi.r.toFixed(1)}× return</div>
    </div>` : ''}
  </div>`}

  <div class="sec-head" style="margin-top:16px">
    <div>
      <div class="sec-eyebrow">Boxoffy Archive</div>
      <div class="sec-title">${year} — ${n} Film${n === 1 ? '' : 's'} by India Nett</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Film · Cast</th>
          <th>Director</th>
          <th class="center">India Nett</th>${a.review ? '' : '\n          <th class="center">Verdict</th>'}
          <th class="center">Budget</th>
          <th>OTT</th>
        </tr>
      </thead>
      <tbody>
${filmRows(a)}
      </tbody>
    </table>
    <div class="table-footer">
      Source: Box Office India · Bollywood Hungama · Sacnilk · Film Information. Budget figures are reported estimates. OTT platform at time of original streaming release.
      · ${esc(E.note)}
    </div>
  </div>

<div class="share-bar">
  <span class="share-label">Share</span>
  <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" rel="noopener" class="share-btn">WhatsApp</a>
  <a href="https://twitter.com/intent/tweet?text=${shareText}&amp;url=${shareUrl}" target="_blank" rel="noopener" class="share-btn">𝕏</a>
  <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener" class="share-btn">Facebook</a>
</div>

</main>

<footer class="footer">
  <p style="margin-bottom:8px;font-size:13px;color:#9CA3AF;font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:.1em">BOXOFFY · BOX OFFICE INTELLIGENCE</p>
  <p>Data: <a href="https://boxofficeindia.com" target="_blank" rel="noopener">Box Office India</a> · Bollywood Hungama · Sacnilk · Film Information &nbsp;·&nbsp; <a href="/about.html">About</a> &nbsp;·&nbsp; <a href="/india-boxoffice-how-it-works.html">How BO Works</a> &nbsp;·&nbsp; <a href="/">Live</a></p>
  <p style="margin-top:8px">© 2026 Boxoffy.com · All figures in ₹ Crores · Pre-2017 figures are pre-GST</p>
</footer>

</body>
</html>`;
}

/* ── year-nav refresh for pages that already exist ───────────────────── */

function refreshNav(file, year, allYears) {
  const p = path.join(PUBLIC, file);
  if (!fs.existsSync(p)) return false;
  const src = fs.readFileSync(p, 'utf8');
  const re  = /<div class="year-nav">[\s\S]*?<\/div>\s*(?=<!--|<main)/;
  if (!re.test(src)) return false;

  let out = src.replace(re, yearNav(allYears, year) + '\n\n');

  // The decade label style is new; add it next to the existing nav rule if absent.
  if (!out.includes('.year-nav-decade')) {
    out = out.replace(
      '.year-nav-btn{',
      ".year-nav-decade{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:700;color:#4B5563;letter-spacing:.1em;text-transform:uppercase;margin:0 2px 0 6px}\n.year-nav-btn{"
    );
  }
  if (out === src) return false;
  if (!DRY) write(file, out);
  return true;
}

/* ── io ──────────────────────────────────────────────────────────────── */

function write(file, html) {
  fs.writeFileSync(path.join(PUBLIC, file), html, 'utf8');
  if (fs.existsSync(DIST)) fs.writeFileSync(path.join(DIST, file), html, 'utf8');
}

/* ── main ────────────────────────────────────────────────────────────── */

const years = Object.keys(DATA).filter(y => /^\d{4}$/.test(y)).sort();
const created = [], updated = [], navFixed = [], review = [], skipped = [];

for (const year of years) {
  const file = `india-box-office-${year}.html`;
  const exists = fs.existsSync(path.join(PUBLIC, file));

  if (NAV_ONLY) {
    if (exists && refreshNav(file, year, years)) navFixed.push(year);
    continue;
  }
  if (exists && !ALL) {
    if (refreshNav(file, year, years)) navFixed.push(year);
    skipped.push(year);
    continue;
  }

  const rows = DATA[year] || [];
  if (!rows.length) { skipped.push(year + ' (no rows)'); continue; }

  const a = analyse(year, rows);
  if (a.review) review.push(year);
  const html = buildPage(year, rows, years);
  if (!DRY) write(file, html);
  (exists ? updated : created).push(year);
}

/* ── report ──────────────────────────────────────────────────────────── */

const line = s => console.log(s);
line('');
line('Boxoffy year-archive generator' + (DRY ? '  [DRY RUN — nothing written]' : ''));
line('─'.repeat(64));
line(`years in films.json     ${years.length}  (${years[0]}–${years[years.length - 1]})`);
if (created.length) line(`created                 ${created.length}  ${created.join(' ')}`);
if (updated.length) line(`rewritten               ${updated.length}  ${updated.join(' ')}`);
if (navFixed.length) line(`year-nav refreshed      ${navFixed.length}  ${navFixed.join(' ')}`);
if (skipped.length) line(`left alone              ${skipped.length}  ${skipped.join(' ')}`);
if (review.length) {
  line('');
  line(`noindex — verdicts withheld pending archive review:`);
  line(`  ${review.join(' ')}`);
  line(`  Reason: >${REVIEW_THRESHOLD * 100}% of rows share one "All-Time Blockbuster" verdict.`);
  line(`  These pages resolve and pass link equity, but are not indexed.`);
  line(`  Remove them from review by fixing the archive, then re-running with --all.`);
}
line('');
if (!DRY) line(`Written to public/${fs.existsSync(DIST) ? ' and dist/' : ''}. Run generate-sitemap.cjs next.`);
line('');
