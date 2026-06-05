#!/usr/bin/env node
/**
 * TMDB Poster Lookup — Local Run
 *
 * Pulls poster_path values for a list of Hindi films from TMDB's search API.
 * Idempotent and resumable: writes after each film, so a crash doesn't lose progress.
 *
 * What it does per film:
 *   1. GET /search/movie?query=TITLE&year=YEAR&language=hi-IN
 *   2. Pick the first match where year matches within ±1
 *   3. Extract tmdb_id + poster_path
 *   4. Write to output CSV (and to films-with-posters.json for diff visibility)
 *
 * What it does NOT do:
 *   - Mutate films.json (you do that after reviewing output)
 *   - Make any subjective decisions (year-mismatch beyond ±1 = NO_MATCH, no fallback)
 *
 * Setup:
 *   1. Save this file to C:\Users\palla\boxoffy\scripts\tmdb-poster-lookup.js
 *   2. Save the input file (films-needing-posters.json from Claude) to C:\Users\palla\boxoffy\data\films-needing-posters.json
 *   3. Open PowerShell in C:\Users\palla\boxoffy
 *   4. Set token:  $env:TMDB_BEARER="eyJ..."
 *   5. Run:  node scripts/tmdb-poster-lookup.js
 *
 * Outputs:
 *   - data/films-poster-results.json  (full results, one object per input film)
 *   - data/films-poster-results.csv   (same data as CSV for spreadsheet review)
 *
 * Pacing:
 *   - 250ms between requests (~4 req/sec). 294 films = ~75 seconds + lookups.
 *   - TMDB rate limit is 50 req/sec, so we're well under.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const INPUT = path.join(REPO_ROOT, 'data', 'films-needing-posters.json');
const OUT_JSON = path.join(REPO_ROOT, 'data', 'films-poster-results.json');
const OUT_CSV = path.join(REPO_ROOT, 'data', 'films-poster-results.csv');

const TOKEN = process.env.TMDB_BEARER || '';
const REQ_DELAY_MS = 250;

if (!TOKEN) {
  console.error('ERROR: TMDB_BEARER env var not set.');
  console.error('  PowerShell:  $env:TMDB_BEARER="eyJ..."');
  console.error('  Then re-run.');
  process.exit(1);
}

if (!fs.existsSync(INPUT)) {
  console.error(`ERROR: Input file not found: ${INPUT}`);
  console.error('  Save Claude\'s films-needing-posters.json there first.');
  process.exit(1);
}

// Helpers
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Load input
const films = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
console.log(`Loaded ${films.length} films to look up.`);

// Load existing results for resume capability
let results = [];
if (fs.existsSync(OUT_JSON)) {
  results = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
  console.log(`Resuming: ${results.length} films already processed.`);
}
const doneKeys = new Set(results.map(r => `${r.title}::${r.year}`));

// TMDB search
async function searchTMDB(title, year) {
  const q = encodeURIComponent(title);
  const url = `https://api.themoviedb.org/3/search/movie?query=${q}&year=${year}&include_adult=false&language=en-US`;
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'accept': 'application/json' }
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

// Pick best match
function pickMatch(searchResult, wantYear, wantTitle) {
  if (!searchResult || searchResult.error) return { reason: searchResult?.error || 'SEARCH_ERROR' };
  const results = searchResult.results || [];
  if (results.length === 0) return { reason: 'NO_RESULTS' };

  // Filter to year ±1
  const yearMatches = results.filter(r => {
    if (!r.release_date) return false;
    const y = parseInt(r.release_date.slice(0, 4));
    return Math.abs(y - parseInt(wantYear)) <= 1;
  });

  if (yearMatches.length === 0) {
    // Year drift — flag, don't auto-accept
    return {
      reason: 'YEAR_MISMATCH',
      candidates_found: results.length,
      first_candidate_year: results[0].release_date?.slice(0, 4) || 'unknown',
    };
  }

  // Prefer Hindi-language match if multiple
  const hindi = yearMatches.filter(r => r.original_language === 'hi');
  const pick = hindi[0] || yearMatches[0];

  return {
    tmdb_id: pick.id,
    poster_path: pick.poster_path || null,
    matched_title: pick.title,
    matched_year: pick.release_date?.slice(0, 4),
    original_language: pick.original_language,
    poster_missing_on_tmdb: !pick.poster_path,
  };
}

// Main loop
async function main() {
  let processed = 0;
  let withPoster = 0;
  let noMatch = 0;
  let noPoster = 0;

  for (const film of films) {
    const key = `${film.title}::${film.year}`;
    if (doneKeys.has(key)) {
      processed++;
      continue;
    }

    const searchRes = await searchTMDB(film.title, film.year);
    const pick = pickMatch(searchRes, film.year, film.title);

    const record = {
      title: film.title,
      year: film.year,
      director: film.director || '',
      ...pick,
    };
    results.push(record);
    processed++;

    if (record.poster_path) withPoster++;
    else if (record.poster_missing_on_tmdb) noPoster++;
    else noMatch++;

    // Write after each film — resumable
    fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));

    if (processed % 10 === 0) {
      console.log(`  ${processed}/${films.length} · with_poster=${withPoster} · no_poster=${noPoster} · no_match=${noMatch}`);
    }

    await new Promise(r => setTimeout(r, REQ_DELAY_MS));
  }

  // Final CSV write
  const headers = ['title', 'year', 'director', 'tmdb_id', 'poster_path', 'matched_title', 'matched_year', 'original_language', 'reason'];
  const lines = [headers.join(',')];
  for (const r of results) {
    lines.push(headers.map(h => csvEscape(r[h] ?? '')).join(','));
  }
  fs.writeFileSync(OUT_CSV, lines.join('\n') + '\n');

  console.log(`\nDONE.`);
  console.log(`  Total processed: ${results.length}`);
  console.log(`  With poster:     ${results.filter(r => r.poster_path).length}`);
  console.log(`  No poster:       ${results.filter(r => r.poster_missing_on_tmdb).length}`);
  console.log(`  No match:        ${results.filter(r => !r.tmdb_id).length}`);
  console.log(`\nOutput files:`);
  console.log(`  ${OUT_JSON}`);
  console.log(`  ${OUT_CSV}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(2); });
