#!/usr/bin/env node
/**
 * Boxoffy Sitemap Generator — Session C
 * Reads src/data/pages-manifest.json and rebuilds sitemap.xml
 * with all hand-crafted pages + all generated film pages.
 *
 * Usage: node generate-sitemap.cjs
 * Run from project root: C:\Users\palla\boxoffy\
 */

const fs   = require('fs');
const path = require('path');

const TODAY    = new Date().toISOString().slice(0, 10);
const MANIFEST = JSON.parse(fs.readFileSync('./src/data/pages-manifest.json', 'utf8'));

// Priority by verdict
function priority(verdict) {
  if (!verdict) return '0.6';
  const v = verdict.toLowerCase();
  if (v.includes('all-time blockbuster')) return '0.9';
  if (v.includes('blockbuster'))          return '0.8';
  if (v.includes('super hit'))            return '0.8';
  if (v.includes('hit'))                  return '0.7';
  return '0.6';
}

// Change frequency by year
function changefreq(year) {
  const currentYear = new Date().getFullYear();
  if (parseInt(year) >= currentYear) return 'weekly';
  if (parseInt(year) === currentYear - 1) return 'monthly';
  return 'yearly';
}

function url(loc, lastmod, freq, pri, newsBlock = '') {
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>${newsBlock}
  </url>`;
}

function newsBlock(pubDate, title) {
  return `
    <news:news>
      <news:publication>
        <news:name>Boxoffy</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</news:title>
    </news:news>`;
}

// ── Build sitemap ──────────────────────────────────────────────
let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">

  <!-- ═══ HOMEPAGE ═══ -->
${url('https://boxoffy.com/', TODAY, 'daily', '1.0')}

  <!-- ═══ HAND-CRAFTED FILM TRACKER PAGES ═══ -->
${url(
  'https://boxoffy.com/dhurandhar-2-box-office.html',
  TODAY, 'daily', '0.9',
  newsBlock('2026-03-01', 'Dhurandhar 2 Box Office Collection — Live Tracker | ₹29.69 Cr Advance | OG Record BROKEN')
)}
${url(
  'https://boxoffy.com/dhurandhar-box-office.html',
  TODAY, 'weekly', '0.9',
  newsBlock('2026-01-15', 'Dhurandhar Box Office Collection — ₹1,305 Cr WW | All-Time Hindi Record')
)}

  <!-- ═══ EDITORIAL / ANALYSIS ARTICLES ═══ -->
${url(
  'https://boxoffy.com/dhurandhar2-editorial.html',
  TODAY, 'weekly', '0.8',
  newsBlock('2026-03-08', 'Dhurandhar 2 The Revenge Pre-Release Analysis — You Are STILL Not Ready')
)}
${url(
  'https://boxoffy.com/dhurandhar2-advance-article.html',
  TODAY, 'weekly', '0.8',
  newsBlock('2026-03-09', 'Dhurandhar 2 Advance Booking — ₹29.69 Crore, OG Record BROKEN, WW ₹60 Crore')
)}
${url(
  'https://boxoffy.com/dhurandhar2-us-boxoffice.html',
  TODAY, 'weekly', '0.8',
  newsBlock('2026-03-13', 'Dhurandhar The Revenge Running Riot in North American Box Office — Heading for $12M Opening')
)}
${url(
  'https://boxoffy.com/dhurandhar-comparison.html',
  TODAY, 'weekly', '0.7',
  newsBlock('2026-03-13', 'Dhurandhar 2 Is Not Just Bigger. It Is Priced Bigger.')
)}

  <!-- ═══ DEEP DIVE / EVERGREEN ═══ -->
${url(
  'https://boxoffy.com/india-boxoffice-how-it-works.html',
  TODAY, 'monthly', '0.8',
  newsBlock('2026-03-10', 'From Script to Screen — How Indian Box Office Really Works')
)}

  <!-- ═══ SITE PAGES ═══ -->
${url('https://boxoffy.com/about.html', '2026-03-01', 'monthly', '0.4')}

  <!-- ═══ GENERATED FILM PAGES (${MANIFEST.length} films · 2020–2026) ═══ -->`;

// Add all generated film pages
for (const film of MANIFEST) {
  const loc   = `https://boxoffy.com/${film.slug}`;
  const pri   = priority(film.verdict);
  const freq  = changefreq(film.year);
  const lmod  = parseInt(film.year) >= 2025 ? TODAY : `${film.year}-12-31`;
  const title = `${film.title} Box Office Collection — ${film.verdict} | Boxoffy`;

  xml += url(loc, lmod, freq, pri);
}

xml += `\n\n</urlset>`;

// Write sitemap
fs.writeFileSync('./public/sitemap.xml', xml);

const totalUrls = 9 + MANIFEST.length;
console.log(`\n✅ sitemap.xml generated`);
console.log(`   Hand-crafted pages: 9`);
console.log(`   Generated film pages: ${MANIFEST.length}`);
console.log(`   Total URLs: ${totalUrls}`);
console.log(`   Output: public/sitemap.xml`);
