/**
 * Boxoffy — TMDB Poster Fetcher
 * Usage: node scripts/fetch-posters.js
 *
 * Reads src/data/films.json, queries TMDB for each film,
 * writes back posterUrl field. Safe to re-run — skips films
 * that already have a posterUrl.
 */

const fs   = require('fs');
const path = require('path');

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2YWM1OTY0NzEyZTA0NGRmMmJjMmFiYzFlMTFlZGMyYyIsIm5iZiI6MTc3Mzg4NTMxMS42MzIsInN1YiI6IjY5YmI1NzdmYjgyMzJhNzc5MjIxZWZjOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.QxWkqL_4_3PfTnIVgcZYE0zlXQd9M2y5QL-oWNwq6dE';
const BASE  = 'https://api.themoviedb.org/3';
const IMG   = 'https://image.tmdb.org/t/p/w185';

// Language → TMDB language code for better matching
const LANG_MAP = {
  'Hindi':     'hi',
  'Telugu':    'te',
  'Tamil':     'ta',
  'Kannada':   'kn',
  'Malayalam': 'ml',
  'Marathi':   'mr',
  'Manipuri':  'mni',
  'Hollywood': 'en',
};

// Manual overrides for titles that TMDB indexes differently
const OVERRIDES = {
  'K.G.F: Chapter 2':            'KGF Chapter 2',
  'K.G.F: Chapter 1':            'KGF Chapter 1',
  'Ponniyin Selvan I':            'Ponniyin Selvan Part 1',
  'Ponniyin Selvan II':           'Ponniyin Selvan Part 2',
  'Brahmastra Part One':          'Brahmastra Part One: Shiva',
  'Salaar: Part 1':               'Salaar: Part 1 – Ceasefire',
  'Spider-Man: No Way Home (Hindi)': 'Spider-Man: No Way Home',
  'Mufasa: The Lion King (Hindi)': 'Mufasa: The Lion King',
  'Captain America: Brave New World': 'Captain America: Brave New World',
  'MSVP (Mana ShankaraVaraprasad Garu)': 'Mana ShankaraVaraprasad Garu',
  'Dhurandhar: The Revenge':      'Dhurandhar 2',
  'Chatha Pacha: The Ring of Rowdies': 'Chatha Pacha',
  'Krantijyoti Vidyalay Marathi Madhyam': 'Krantijyoti',
  'NTR – Neel':                   'Dragon',
  'Ustaad Bhagat Singh':          'Ustaad Bhagat Singh',
  'Anaganaga Oka Raju':           'Anaganaga Oka Raju',
  'Nari Nari Naduma Murari':      'Nari Nari Naduma Murari',
  'Mana ShankaraVaraprasad Garu': 'Mana ShankaraVaraprasad Garu',
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function searchTMDB(title, language, year) {
  const query    = OVERRIDES[title] || title;
  const langCode = LANG_MAP[language] || 'hi';

  // Try 1: with language + year
  const url1 = `${BASE}/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false${year ? `&year=${year}` : ''}`;
  const r1 = await fetch(url1, {
    headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' }
  });
  const d1 = await r1.json();
  if (d1.results && d1.results.length > 0 && d1.results[0].poster_path) {
    return d1.results[0].poster_path;
  }

  // Try 2: without year
  const url2 = `${BASE}/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`;
  const r2 = await fetch(url2, {
    headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' }
  });
  const d2 = await r2.json();
  if (d2.results && d2.results.length > 0 && d2.results[0].poster_path) {
    return d2.results[0].poster_path;
  }

  return null;
}

async function main() {
  const filePath = path.join(__dirname, '../src/data/films.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let updated = 0;
  let skipped = 0;
  let failed  = 0;

  for (const year of Object.keys(data)) {
    for (const film of data[year]) {
      if (film.posterUrl) {
        skipped++;
        continue;
      }

      // Extract year from releaseDate if possible
      const yearMatch = (film.releaseDate || '').match(/\b(20\d{2})\b/);
      const releaseYear = yearMatch ? yearMatch[1] : year;

      try {
        const posterPath = await searchTMDB(film.title, film.language, releaseYear);
        if (posterPath) {
          film.posterUrl = `${IMG}${posterPath}`;
          console.log(`✓  ${film.title} → ${film.posterUrl}`);
          updated++;
        } else {
          console.log(`✗  ${film.title} — no poster found`);
          failed++;
        }
      } catch (e) {
        console.log(`✗  ${film.title} — error: ${e.message}`);
        failed++;
      }

      // TMDB rate limit: 40 req / 10 sec → ~250ms between calls is safe
      await sleep(260);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`\nDone. Updated: ${updated} | Skipped (already had poster): ${skipped} | Failed: ${failed}`);
  console.log('films.json written.');
}

main().catch(console.error);
