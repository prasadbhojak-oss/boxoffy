#!/usr/bin/env node
/**
 * Boxoffy Dead-Link Repair
 * ─────────────────────────
 * Two repairs, both re-runnable and both reported as old → new:
 *
 *  1. REMAP — links pointing at a page that never existed but has an obvious
 *     correct destination (nav links to SPA sections, the generic year index).
 *
 *  2. UNLINK — links to pages that genuinely do not exist yet, mostly unbuilt
 *     film and production-house pages on upcoming-releases.html. The anchor is
 *     replaced with its own text, so the label survives and the dead link does
 *     not. We do not invent a destination and we do not silently delete copy.
 *
 * It also reports editorials.json entries whose target page is missing; those
 * are data, not markup, so they are listed rather than edited here.
 *
 * Usage: node fix-dead-links.cjs [--dry]
 */

const fs   = require('fs');
const path = require('path');

const ROOT   = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DIST   = path.join(ROOT, 'dist');
const DRY    = process.argv.includes('--dry');

/** Dead target → real destination. */
const REMAP = {
  'articles.html'            : '/',                            // editorial stack lives in the SPA
  'editorials.html'          : '/',                            // same
  'hollywood-box-office.html': '/',                            // Hollywood section lives in the SPA
  'india-box-office.html'    : '/india-box-office-2026.html',  // generic index → current year archive
};

const have = new Set(fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html')));

const remapped = [], unlinked = [], touched = new Set();

for (const file of have) {
  const p = path.join(PUBLIC, file);
  let html = fs.readFileSync(p, 'utf8');
  const before = html;

  // 1 · remap
  for (const [dead, dest] of Object.entries(REMAP)) {
    const re = new RegExp(`href="/?${dead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g');
    if (re.test(html)) {
      html = html.replace(re, `href="${dest}"`);
      remapped.push({ file, dead, dest });
    }
  }

  // 2 · unlink anchors whose target does not exist
  html = html.replace(
    /<a\s+href="\/?([a-z0-9][a-z0-9\-._]*\.html)"([^>]*)>([\s\S]*?)<\/a>/gi,
    (m, target, attrs, text) => {
      if (have.has(target) || REMAP[target]) return m;
      // Preserve any inline style so the row does not visually shift.
      const style = (attrs.match(/style="([^"]*)"/i) || [, ''])[1];
      unlinked.push({ file, target, text: text.replace(/<[^>]+>/g, '').trim().slice(0, 40) });
      return style ? `<span style="${style}">${text}</span>` : `<span>${text}</span>`;
    }
  );

  if (html !== before) {
    touched.add(file);
    if (!DRY) {
      fs.writeFileSync(p, html, 'utf8');
      const d = path.join(DIST, file);
      if (fs.existsSync(DIST)) fs.writeFileSync(d, html, 'utf8');
    }
  }
}

/* ── editorials.json entries with no page ────────────────────────────── */

const edPath = path.join(ROOT, 'src/data/editorials.json');
let orphanEditorials = [];
try {
  const eds = JSON.parse(fs.readFileSync(edPath, 'utf8'));
  orphanEditorials = eds
    .map(e => ({ headline: e.headline, url: String(e.url || '').replace(/^\//, '') }))
    .filter(e => e.url && !have.has(e.url));
} catch { /* leave empty */ }

/* ── report ──────────────────────────────────────────────────────────── */

console.log('');
console.log('Dead-link repair' + (DRY ? '  [DRY RUN — nothing written]' : ''));
console.log('─'.repeat(66));

if (remapped.length) {
  console.log(`remapped ${remapped.length}:`);
  for (const r of remapped) console.log(`  ${r.file}\n    /${r.dead}  →  ${r.dest}`);
  console.log('');
}

if (unlinked.length) {
  const byFile = {};
  for (const u of unlinked) (byFile[u.file] = byFile[u.file] || []).push(u);
  console.log(`unlinked ${unlinked.length} (target does not exist; label kept as text):`);
  for (const [f, list] of Object.entries(byFile)) {
    console.log(`  ${f}  — ${list.length}`);
    for (const u of list) console.log(`      ${u.target.padEnd(46)} "${u.text}"`);
  }
  console.log('');
}

console.log(`files changed  ${touched.size}`);

if (orphanEditorials.length) {
  console.log('');
  console.log(`editorials.json entries whose page is missing  ${orphanEditorials.length}`);
  console.log('  (data, not markup — remove the entry or restore the page)');
  for (const e of orphanEditorials) console.log(`    ${e.url}\n      "${e.headline}"`);
}
console.log('');
