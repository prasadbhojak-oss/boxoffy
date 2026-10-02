#!/usr/bin/env node
/**
 * Boxoffy Link & Data Integrity Check
 * ────────────────────────────────────
 * Exits non-zero when anything here would produce a 404, a wrong sitemap entry
 * or a silent deploy gap. Run it before every commit and in CI.
 *
 *   node check-links.cjs            # fail on errors, report warnings
 *   node check-links.cjs --strict   # fail on warnings too
 *
 * Why it exists: between 29 Jun and 21 Aug 2026 the Search Console "Not found
 * (404)" count went 4 → 35 without anyone noticing, because nothing checked
 * that a published URL still resolved. films.json is rewritten weekly; the
 * sitemap and the breadcrumbs are derived from it; nothing guaranteed the two
 * stayed in step. This is that guarantee.
 *
 * Checks
 *   E1  internal <a href> targets that do not exist
 *   E2  editorials.json url with no page on disk
 *   E3  films.json pageUrl with no page on disk
 *   E4  sitemap URL with no page on disk
 *   E5  sitemap URL pointing at a noindex page
 *   E6  sitemap host is not the canonical www host
 *   W1  page in public/ missing from dist/ (the silent-copy trap)
 *   W2  public/ and dist/ copies differ
 *   W3  released film still marked Upcoming or carrying no figure
 *   W4  films.json row with no pageUrl (these become phantom sitemap URLs)
 */

const fs   = require('fs');
const path = require('path');

const ROOT   = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DIST   = path.join(ROOT, 'dist');
const STRICT = process.argv.includes('--strict');
const CANONICAL_HOST = 'https://www.boxoffy.com';

const errors = [], warnings = [];
const err  = (code, msg) => errors.push(`${code}  ${msg}`);
const warn = (code, msg) => warnings.push(`${code}  ${msg}`);

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const have = new Set(fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html')));
const NOINDEX = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i;

/* ── E1 · internal links ─────────────────────────────────────────────── */

const linkRe = /href="\/?([a-z0-9][a-z0-9\-._]*\.html)(?:#[^"]*)?"/gi;
let e1 = 0;
for (const file of have) {
  const html = fs.readFileSync(path.join(PUBLIC, file), 'utf8');
  const seen = new Set();
  let m;
  while ((m = linkRe.exec(html))) {
    const t = m[1];
    if (have.has(t) || seen.has(t)) continue;
    seen.add(t);
    err('E1', `${file} links to ${t} — no such page`);
    e1++;
  }
}

/* ── E2 · editorials.json ────────────────────────────────────────────── */

const eds = readJSON(path.join(ROOT, 'src/data/editorials.json'));
if (Array.isArray(eds)) {
  for (const e of eds) {
    const u = String(e.url || '').replace(/^\//, '').trim();
    if (!u) { err('E2', `editorials.json entry has no url: "${e.headline}"`); continue; }
    if (!have.has(u)) err('E2', `editorials.json → ${u} — no such page ("${e.headline}")`);
  }
}

/* ── E3 / W4 · films.json ────────────────────────────────────────────── */

const films = readJSON(path.join(ROOT, 'src/data/films.json')) || {};
const now = Date.now();
let noPageUrl = 0;
for (const [year, rows] of Object.entries(films)) {
  if (!Array.isArray(rows)) continue;
  for (const f of rows) {
    const slug = String(f.pageUrl || '').replace(/^\//, '').trim();
    if (!slug) { noPageUrl++; continue; }
    if (!have.has(slug)) err('E3', `films.json ${year} "${f.title}" → ${slug} — no such page`);

    // W3 · released but still flagged as not out, or carrying no figure.
    // Only a firm date counts. "Jul 2026 (TBC)", "Diwali 2026", "TBD 2026" are
    // placeholders, and JS Date parses several of them into real dates, which
    // would fire this warning on films that genuinely have not opened.
    const raw  = String(f.releaseDate || '');
    const firm = /^\s*(?:[A-Z][a-z]{2}\s+\d{1,2},\s*\d{4}|\d{4}-\d{2}-\d{2})/.test(raw)
                 && !/\b(TBC|TBD|TBA)\b/i.test(raw);
    const d = firm ? new Date(raw) : NaN;
    if (!isNaN(d) && d.getTime() < now) {
      const figure = String(f.indiaNet == null ? '' : f.indiaNet).trim();
      if (/^upcoming$/i.test(String(f.status || '')))
        warn('W3', `${year} "${f.title}" released ${f.releaseDate} but status is still Upcoming`);
      else if (!figure || figure === '—' || figure === '-')
        warn('W3', `${year} "${f.title}" released ${f.releaseDate} with no indiaNet figure`);
    }
  }
}
if (noPageUrl) warn('W4', `${noPageUrl} films.json rows have no pageUrl — these cannot be linked or sitemapped`);

/* ── E4 / E5 / E6 · sitemap ──────────────────────────────────────────── */

const smPath = path.join(PUBLIC, 'sitemap.xml');
if (fs.existsSync(smPath)) {
  const sm = fs.readFileSync(smPath, 'utf8');
  const locs = [...sm.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g)].map(m => m[1]);
  for (const loc of locs) {
    if (!loc.startsWith(CANONICAL_HOST)) {
      err('E6', `sitemap URL is not on ${CANONICAL_HOST} (redirect hop): ${loc}`);
      continue;
    }
    const rel = loc.slice(CANONICAL_HOST.length).replace(/^\//, '');
    if (!rel) continue;                       // homepage
    if (!have.has(rel)) { err('E4', `sitemap lists ${rel} — no such page`); continue; }
    const html = fs.readFileSync(path.join(PUBLIC, rel), 'utf8');
    if (NOINDEX.test(html)) err('E5', `sitemap lists ${rel} — page is marked noindex`);
  }
} else {
  err('E4', 'public/sitemap.xml is missing');
}

/* ── W1 / W2 · public ↔ dist ─────────────────────────────────────────── */

if (fs.existsSync(DIST)) {
  let missing = 0, differ = 0;
  for (const file of have) {
    const d = path.join(DIST, file);
    if (!fs.existsSync(d)) {
      missing++;
      if (missing <= 10) warn('W1', `dist/ is missing ${file} — it will 404 in production`);
      continue;
    }
    if (fs.readFileSync(path.join(PUBLIC, file), 'utf8') !== fs.readFileSync(d, 'utf8')) {
      differ++;
      if (differ <= 10) warn('W2', `public/ and dist/ differ for ${file}`);
    }
  }
  if (missing > 10) warn('W1', `…and ${missing - 10} more pages missing from dist/`);
  if (differ > 10)  warn('W2', `…and ${differ - 10} more pages differing between public/ and dist/`);
}

/* ── report ──────────────────────────────────────────────────────────── */

const line = s => console.log(s);
line('');
line('Boxoffy link & data integrity check');
line('─'.repeat(66));
line(`pages checked   ${have.size}`);
line(`errors          ${errors.length}`);
line(`warnings        ${warnings.length}`);
line('');

if (errors.length) {
  line('ERRORS — these are live 404s or wrong sitemap entries');
  for (const e of errors.slice(0, 60)) line('  ' + e);
  if (errors.length > 60) line(`  …and ${errors.length - 60} more`);
  line('');
}
if (warnings.length) {
  line('WARNINGS');
  for (const w of warnings.slice(0, 40)) line('  ' + w);
  if (warnings.length > 40) line(`  …and ${warnings.length - 40} more`);
  line('');
}

if (errors.length) {
  line('FAILED — fix the errors above before committing.');
  process.exit(1);
}
if (STRICT && warnings.length) {
  line('FAILED (--strict) — warnings treated as errors.');
  process.exit(1);
}
line('PASSED — every internal link, editorial url and sitemap entry resolves.');
line('');
