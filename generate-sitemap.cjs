#!/usr/bin/env node
/**
 * Boxoffy Sitemap Generator — v4
 * ────────────────────────────────
 * v4 rewrite. Three bugs in v3, all of them live in Search Console:
 *
 *  1. PHANTOM URLS.  v3 built film URLs from films.json with
 *       const slug = film.pageUrl || `${slugify(film.title)}-box-office.html`
 *     — inventing a slug when pageUrl was absent and publishing it without
 *     checking a file existed. films.json is rewritten weekly; every title that
 *     arrived without a pageUrl, or later changed name or left the file, became
 *     a permanent 404 in Google's index. That is the mechanism behind the
 *     "Not found (404)" count going 4 → 35 between 29 Jun and 21 Aug 2026.
 *     v4 enumerates the filesystem. A URL cannot enter the sitemap unless the
 *     file is on disk.
 *
 *  2. 203 PAGES MISSING.  The editorial list was hardcoded at 23 entries, so
 *     every new article, all 37 production-house pages and all the actor pages
 *     were absent. v4 picks up everything that exists and is indexable.
 *
 *  3. EVERY URL A REDIRECT HOP.  BASE was 'https://boxoffy.com' while
 *     vercel.json 301s that host to www. All 1,098 URLs redirected. v4 emits
 *     the canonical www host, matching robots.txt and the page canonicals.
 *
 * v4 also honours noindex: a page marked noindex is excluded, so pages held
 * back for data review resolve and pass link equity without being submitted.
 *
 * Usage: node generate-sitemap.cjs [--dry]
 */

const fs   = require('fs');
const path = require('path');

const ROOT   = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DIST   = path.join(ROOT, 'dist');
const DRY    = process.argv.includes('--dry');

const BASE  = 'https://www.boxoffy.com';
const TODAY = new Date().toISOString().slice(0, 10);

const DATA       = readJSON(path.join(ROOT, 'src/data/films.json')) || {};
const EDITORIALS = readJSON(path.join(ROOT, 'src/data/editorials.json')) || [];

/** Never submit these even though they exist. */
const EXCLUDE = new Set(['boxoffy-admin.html', 'boxoffy-contest-wireframe.html', '404.html']);

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function verdictPriority(verdict) {
  const v = String(verdict || '').toLowerCase();
  if (v.includes('all-time') || v.includes('all time')) return '0.85';
  if (v.includes('blockbuster') || v.includes('super hit')) return '0.75';
  if (v.includes('hit')) return '0.65';
  return '0.55';
}

function urlEntry(loc, mod, freq, pri, news) {
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${mod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>${news || ''}
  </url>`;
}

function newsEntry(date, title) {
  return `
    <news:news>
      <news:publication><news:name>Boxoffy</news:name><news:language>en</news:language></news:publication>
      <news:publication_date>${date}</news:publication_date>
      <news:title>${esc(title)}</news:title>
    </news:news>`;
}

/* ── index films.json by the page each row points at ─────────────────── */

const filmBySlug = new Map();
for (const [year, rows] of Object.entries(DATA)) {
  if (!Array.isArray(rows)) continue;
  for (const film of rows) {
    const slug = String(film.pageUrl || '').replace(/^\//, '').trim();
    if (!slug) continue;                       // no invented slugs — see bug 1
    if (!filmBySlug.has(slug)) filmBySlug.set(slug, { film, year: parseInt(year, 10) });
  }
}

/* ── index editorials by target page, for news tags and real dates ───── */

const editorialBySlug = new Map();
for (const e of Array.isArray(EDITORIALS) ? EDITORIALS : []) {
  const slug = String(e.url || '').replace(/^\//, '').trim();
  if (slug) editorialBySlug.set(slug, e);
}

/* ── classify each file on disk ──────────────────────────────────────── */

const NOINDEX = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i;

function classify(file, html) {
  const year = filmBySlug.get(file);
  const ed   = editorialBySlug.get(file);

  if (ed) {
    const date = String(ed.date || TODAY).slice(0, 10);
    const ageDays = (Date.now() - new Date(date).getTime()) / 86400000;
    return {
      kind: 'editorial',
      mod : date,
      freq: ageDays < 14 ? 'daily' : ageDays < 90 ? 'weekly' : 'monthly',
      pri : ageDays < 14 ? '0.95' : ageDays < 90 ? '0.8' : '0.6',
      // Google News only cares about the last couple of days; tagging older
      // pieces as news is noise, so it is scoped rather than blanket.
      news: ageDays < 3 ? newsEntry(date, ed.headline || file) : '',
    };
  }

  if (/^india-box-office-\d{4}\.html$/.test(file)) {
    const y = parseInt(file.match(/(\d{4})/)[1], 10);
    const current = y === new Date().getFullYear();
    return { kind: 'year-archive', mod: current ? TODAY : `${y}-12-31`,
             freq: current ? 'daily' : 'yearly', pri: current ? '0.9' : '0.7' };
  }

  if (/-production-house\.html$/.test(file)) {
    return { kind: 'production-house', mod: TODAY, freq: 'monthly', pri: '0.6' };
  }

  if (/^actor-/.test(file)) {
    return { kind: 'actor', mod: TODAY, freq: 'monthly', pri: '0.7' };
  }

  if (year) {
    const { film, year: y } = year;
    const running = film.status === 'Running';
    return {
      kind: 'film',
      mod : running || y >= 2026 ? TODAY : `${y}-12-31`,
      freq: running ? 'daily' : y >= 2025 ? 'weekly' : y >= 2020 ? 'monthly' : 'yearly',
      pri : verdictPriority(film.verdict),
    };
  }

  return { kind: 'other', mod: TODAY, freq: 'monthly', pri: '0.5' };
}

/* ── build ───────────────────────────────────────────────────────────── */

const files = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html')).sort();
const counts = {}, skipped = { excluded: [], noindex: [] };
const entries = [];

for (const file of files) {
  if (EXCLUDE.has(file)) { skipped.excluded.push(file); continue; }

  const html = fs.readFileSync(path.join(PUBLIC, file), 'utf8');
  if (NOINDEX.test(html)) { skipped.noindex.push(file); continue; }

  const c = classify(file, html);
  counts[c.kind] = (counts[c.kind] || 0) + 1;
  entries.push({ file, ...c });
}

// Highest priority first, so the important pages sit at the top of the file.
entries.sort((a, b) => parseFloat(b.pri) - parseFloat(a.pri) || a.file.localeCompare(b.file));

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <!--
    Boxoffy Sitemap v4 · generated ${TODAY}
    Built from files on disk. A URL cannot appear here unless the page exists
    and is indexable. Pages marked noindex are deliberately excluded.
  -->
${urlEntry(`${BASE}/`, TODAY, 'daily', '1.0')}`;

for (const e of entries) xml += urlEntry(`${BASE}/${e.file}`, e.mod, e.freq, e.pri, e.news);

xml += `\n\n</urlset>\n`;

if (!DRY) {
  fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), xml);
  if (fs.existsSync(DIST)) fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
}

/* ── report ──────────────────────────────────────────────────────────── */

console.log('');
console.log('sitemap.xml v4' + (DRY ? '  [DRY RUN — nothing written]' : ''));
console.log('─'.repeat(60));
console.log(`host                  ${BASE}   (canonical, no redirect hop)`);
console.log(`html files on disk    ${files.length}`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(20)}${v}`);
}
console.log(`total URLs            ${entries.length + 1}  (incl. homepage)`);
if (skipped.noindex.length)  console.log(`excluded — noindex    ${skipped.noindex.length}`);
if (skipped.excluded.length) console.log(`excluded — always     ${skipped.excluded.join(' ')}`);
console.log('');
console.log(`Submit: ${BASE}/sitemap.xml`);
console.log('');
