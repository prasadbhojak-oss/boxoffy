#!/usr/bin/env node
/**
 * Boxoffy Sitemap Generator — v3
 * ────────────────────────────────
 * Builds sitemap.xml with:
 *   1. Homepage
 *   2. All hand-crafted editorial articles
 *   3. ALL generated film pages (films with totalNum > 0)
 *
 * Usage: node generate-sitemap.cjs
 */

const fs   = require('fs');
const path = require('path');

const TODAY   = new Date().toISOString().slice(0, 10);
const BASE    = 'https://boxoffy.com';
const DATA    = JSON.parse(fs.readFileSync('./src/data/films.json', 'utf8'));

const HAND_CRAFTED = new Set([
  'dhurandhar-2-box-office.html','dhurandhar-box-office.html',
  'dhurandhar2-advance-article.html','dhurandhar2-us-boxoffice.html',
  'dhurandhar-comparison.html','dhurandhar-2-vs-pushpa-2-box-office.html',
  'dhurandhar-box-office-d1-vs-d2.html','dhurandhar-2-1000-crore.html',
  'dhurandhar-the-revenge-ode.html','dhurandhar2-editorial.html',
  'bhooth-bangla-box-office-preview.html','bhooth-bangla-trailer-review.html',
  'india-all-time-box-office.html','india-boxoffice-how-it-works.html',
  'ott-releases.html','ramayana-part-one-box-office.html',
]);

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}

function urlEntry(loc, mod, freq, pri, news='') {
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${mod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>${news}
  </url>`;
}

function newsEntry(date, title) {
  const safe = title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `
    <news:news>
      <news:publication><news:name>Boxoffy</news:name><news:language>en</news:language></news:publication>
      <news:publication_date>${date}</news:publication_date>
      <news:title>${safe}</news:title>
    </news:news>`;
}

function verdictPriority(verdict) {
  if (!verdict) return '0.5';
  const v = verdict.toLowerCase();
  if (v.includes('all-time')) return '0.85';
  if (v.includes('blockbuster') || v.includes('super hit')) return '0.75';
  if (v.includes('hit')) return '0.65';
  return '0.55';
}

// ── 1. Editorial pages ────────────────────────────────────────────────────────
let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <!--
    Boxoffy Sitemap v3 · ${TODAY}
    Editorial articles + all generated film pages with real data
  -->

  <!-- HOMEPAGE -->
${urlEntry(`${BASE}/`, TODAY, 'daily', '1.0')}

  <!-- EDITORIAL ARTICLES -->
${urlEntry(`${BASE}/music-top-10-hindi-april-2026.html`, '2026-04-14', 'weekly', '0.8', newsEntry('2026-04-14','Hindi Music Top 10 — April 2026: The Dhurandhar Effect'))}
${urlEntry(`${BASE}/bhooth-bangla-box-office-preview.html`, TODAY, 'daily', '0.9', newsEntry('2026-04-14','Bhooth Bangla Box Office Preview — D1 Prediction'))}
${urlEntry(`${BASE}/bhooth-bangla-trailer-review.html`, '2026-04-06', 'weekly', '0.7', newsEntry('2026-04-06','Bhooth Bangla Trailer Review — The OG Cast Is Back'))}
${urlEntry(`${BASE}/dhurandhar-2-box-office.html`, TODAY, 'daily', '0.9', newsEntry('2026-03-19','Dhurandhar 2 Box Office Collection Day-Wise Tracker'))}
${urlEntry(`${BASE}/dhurandhar-2-1000-crore.html`, '2026-04-14', 'weekly', '0.9', newsEntry('2026-04-10','Dhurandhar 2 — ₹1,000 Crore Hindi Nett. Monumental.'))}
${urlEntry(`${BASE}/dhurandhar-2-vs-pushpa-2-box-office.html`, '2026-04-14', 'weekly', '0.8', newsEntry('2026-03-25','Dhurandhar 2 vs Pushpa 2 — Full Box Office Comparison'))}
${urlEntry(`${BASE}/dhurandhar-box-office-d1-vs-d2.html`, '2026-04-14', 'weekly', '0.8', newsEntry('2026-03-19','Dhurandhar vs Dhurandhar 2 — Day-Wise Comparison'))}
${urlEntry(`${BASE}/dhurandhar-comparison.html`, '2026-04-14', 'weekly', '0.7', newsEntry('2026-03-13','Dhurandhar 2 Is Not Just Bigger. It Is Priced Bigger.'))}
${urlEntry(`${BASE}/dhurandhar2-us-boxoffice.html`, '2026-04-14', 'weekly', '0.8', newsEntry('2026-03-13','Dhurandhar 2 North America — $27M All-Time Record'))}
${urlEntry(`${BASE}/dhurandhar2-advance-article.html`, '2026-04-14', 'monthly', '0.7', newsEntry('2026-03-09','Dhurandhar 2 Pre-Release Analysis'))}
${urlEntry(`${BASE}/dhurandhar2-editorial.html`, '2026-03-08', 'monthly', '0.6', newsEntry('2026-03-08','Dhurandhar 2 The Revenge Pre-Release Analysis'))}
${urlEntry(`${BASE}/dhurandhar-the-revenge-ode.html`, '2026-04-07', 'monthly', '0.7', newsEntry('2026-04-07','An Ode to Dhurandhar: The Revenge — Seven Chapters'))}
${urlEntry(`${BASE}/dhurandhar-box-office.html`, TODAY, 'monthly', '0.8', newsEntry('2026-01-15','Dhurandhar Box Office Collection — ₹840 Cr All-Time Blockbuster'))}
${urlEntry(`${BASE}/india-boxoffice-how-it-works.html`, '2026-04-14', 'monthly', '0.8', newsEntry('2026-03-10','India Box Office — Nett, Gross and Verdicts Explained'))}
${urlEntry(`${BASE}/india-all-time-box-office.html`, '2026-04-14', 'monthly', '0.8', newsEntry('2026-03-15','All-Time Highest Grossing Indian Films Worldwide'))}
${urlEntry(`${BASE}/100-crore-day-one-club-box-office.html`, '2026-03-15', 'monthly', '0.7', newsEntry('2026-03-15','The ₹100 Crore Day 1 Club — Every Indian Film That Made It'))}
${urlEntry(`${BASE}/ott-releases.html`, '2026-04-14', 'weekly', '0.8', newsEntry('2026-04-14','OTT India Apr 13–19 — Euphoria S3, Toaster, Matka King'))}
${urlEntry(`${BASE}/ramayana-part-one-box-office.html`, '2026-03-30', 'monthly', '0.7', newsEntry('2026-03-30','Ramayana: Part One Box Office Preview'))}
${urlEntry(`${BASE}/why-indian-cinema-never-has-a-number-2.html`, '2026-03-22', 'monthly', '0.6', newsEntry('2026-03-22','Why Indian Cinema Will Never Have a Number 2'))}

  <!-- GENERATED FILM PAGES -->`;

// ── 2. Generated film pages ───────────────────────────────────────────────────
let filmCount = 0;
for (const [year, films] of Object.entries(DATA)) {
  for (const film of films) {
    const total = parseFloat(film.totalNum) || 0;
    if (total <= 0 || film.verdict === 'Upcoming' || film.status === 'Upcoming') continue;

    const slug = film.pageUrl || `${slugify(film.title)}-box-office.html`;
    if (HAND_CRAFTED.has(slug)) continue;

    const yr   = parseInt(year);
    const freq = yr >= 2025 ? 'weekly' : yr >= 2020 ? 'monthly' : 'yearly';
    const mod  = yr >= 2025 ? TODAY : yr >= 2020 ? `${year}-12-31` : `${year}-12-31`;
    const pri  = verdictPriority(film.verdict);

    xml += urlEntry(`${BASE}/${slug}`, mod, freq, pri);
    filmCount++;
  }
}

xml += `\n\n</urlset>\n`;

fs.writeFileSync('./public/sitemap.xml', xml);

const editorialCount = 19;
console.log(`\n✅ sitemap.xml generated`);
console.log(`   Editorial pages: ${editorialCount}`);
console.log(`   Generated film pages: ${filmCount}`);
console.log(`   Total URLs: ${editorialCount + 1 + filmCount}`);
console.log(`\n   Submit to GSC: https://boxoffy.com/sitemap.xml`);
console.log(`   Submit to Bing: https://www.bing.com/webmasters`);
