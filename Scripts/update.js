#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════╗
 * ║         BOXOFFY UPDATE ENGINE  v1.0                   ║
 * ║  Semi-automated data reconciliation tool              ║
 * ║  Sources: BOI · Sacnilk · BOGuru · AddaToday ·       ║
 * ║           Pinkvilla · Koimoi                          ║
 * ║  Analysts: Sumit Kadel · Jaiswal · Nishit · Taran    ║
 * ╚═══════════════════════════════════════════════════════╝
 * 
 * USAGE:
 *   node update.js              → Full audit + diff preview
 *   node update.js --apply      → Apply approved changes to App.jsx
 *   node update.js --open       → Open all source URLs in browser
 *   node update.js --analysts   → Open analyst X/Twitter profiles
 *   node update.js --trigger    → Generate BO Trigger summary
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONFIG = {
  // Path to your App.jsx — update this if needed
  APP_JSX_PATH: path.resolve(__dirname, '../src/App.jsx'),
  
  // Log directory
  LOGS_DIR: path.resolve(__dirname, 'logs'),
  
  // Data cache directory  
  DATA_DIR: path.resolve(__dirname, 'data'),

  // Source URLs to open for manual review
  SOURCES: {
    boxofficeindia: {
      name: 'Box Office India',
      url: 'https://www.boxofficeindia.com/box-office.php',
      type: 'primary',
      trustLevel: 'HIGH',
      bestFor: ['verdicts', 'weekly totals', 'final collections'],
    },
    sacnilk: {
      name: 'Sacnilk',
      url: 'https://www.sacnilk.com/entertainmenttopbar/Box_Office_Collection?hl=en',
      type: 'primary',
      trustLevel: 'HIGH',
      bestFor: ['day-wise', 'occupancy', 'advance booking', 'OTT dates'],
    },
    boxofficeguru: {
      name: 'Box Office Guru (International)',
      url: 'https://www.boxofficeguru.com/',
      type: 'international',
      trustLevel: 'HIGH',
      bestFor: ['worldwide gross', 'overseas numbers'],
    },
    addatoday: {
      name: 'Adda Today',
      url: 'https://www.addatoday.com/box-office/',
      type: 'primary',
      trustLevel: 'MEDIUM',
      bestFor: ['advance booking', 'D2 previews', 'screen count'],
    },
    pinkvilla: {
      name: 'Pinkvilla',
      url: 'https://www.pinkvilla.com/box-office',
      type: 'secondary',
      trustLevel: 'MEDIUM',
      bestFor: ['OTT announcements', 'upcoming releases', 'cast updates'],
    },
    koimoi: {
      name: 'Koimoi',
      url: 'https://www.koimoi.com/box-office/',
      type: 'secondary',
      trustLevel: 'MEDIUM',
      bestFor: ['records', 'milestones', 'advance booking records'],
    },
  },

  // X/Twitter analyst accounts
  ANALYSTS: {
    sumitKadel: {
      name: 'Sumit Kadel',
      handle: '@SumitKadel_',
      url: 'https://x.com/SumitKadel_',
      specialty: 'South Indian BO, Bollywood collections',
    },
    rohitJaiswal: {
      name: 'Rohit Jaiswal',
      handle: '@rohit_jaiswal_',
      url: 'https://x.com/rohit_jaiswal_',
      specialty: 'Breaking collection figures, Bollywood',
    },
    nishitShaw: {
      name: 'Nishit Shaw',
      handle: '@NishitShaw',
      url: 'https://x.com/NishitShaw',
      specialty: 'Detailed breakdowns, multiplexes',
    },
    taranAdarsh: {
      name: 'Taran Adarsh',
      handle: '@taran_adarsh',
      url: 'https://x.com/taran_adarsh',
      specialty: 'Trade analyst, verdicts, official numbers',
    },
  },

  // Data priority hierarchy (index 0 = highest priority)
  PRIORITY: ['boxofficeindia', 'sacnilk', 'boxofficeguru', 'addatoday', 'koimoi', 'pinkvilla'],
};

// ─── TERMINAL COLORS ─────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

const bold = (s) => `${C.bright}${s}${C.reset}`;
const red = (s) => `${C.red}${s}${C.reset}`;
const green = (s) => `${C.green}${s}${C.reset}`;
const yellow = (s) => `${C.yellow}${s}${C.reset}`;
const cyan = (s) => `${C.cyan}${s}${C.reset}`;
const magenta = (s) => `${C.magenta}${s}${C.reset}`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString();
  const logFile = path.join(CONFIG.LOGS_DIR, `update-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, `[${ts}] ${msg}\n`);
}

function readAppJsx() {
  if (!fs.existsSync(CONFIG.APP_JSX_PATH)) {
    console.error(red(`✗ App.jsx not found at: ${CONFIG.APP_JSX_PATH}`));
    console.error(yellow('  → Edit CONFIG.APP_JSX_PATH in update.js to point to your App.jsx'));
    process.exit(1);
  }
  return fs.readFileSync(CONFIG.APP_JSX_PATH, 'utf8');
}

function parseFilmsFromAppJsx(content) {
  // Extract the FILMS array from App.jsx
  const films = [];
  
  // Match film objects - looks for id, title, indiaNet patterns
  const filmBlockRegex = /\{\s*id:\s*['"]([^'"]+)['"]\s*,[\s\S]*?(?=\n\s*\{|\n\s*\];)/g;
  
  // More targeted: extract key fields per film
  const lines = content.split('\n');
  let inFilmsArray = false;
  let currentFilm = null;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('const FILMS') || line.includes('const films')) {
      inFilmsArray = true;
    }
    
    if (inFilmsArray) {
      if (line.includes('{')) depth += (line.match(/\{/g) || []).length;
      if (line.includes('}')) depth -= (line.match(/\}/g) || []).length;
      
      // Start of film object (depth 2 = inside array, inside object)
      const idMatch = line.match(/id:\s*['"]([^'"]+)['"]/);
      if (idMatch && depth <= 3) {
        if (currentFilm) films.push(currentFilm);
        currentFilm = { id: idMatch[1], _lineStart: i };
      }
      
      if (currentFilm) {
        const titleMatch = line.match(/title:\s*['"]([^'"]+)['"]/);
        const netMatch = line.match(/indiaNet:\s*['"]([^'"]+)['"]/);
        const wwMatch = line.match(/worldwide:\s*['"]([^'"]+)['"]/);
        const statusMatch = line.match(/status:\s*['"]([^'"]+)['"]/);
        const verdictMatch = line.match(/verdict:\s*['"]([^'"]+)['"]/);
        const weeklyMatch = line.match(/weeklyCollection:\s*['"]([^'"]+)['"]/);
        const ottMatch = line.match(/ottPlatform:\s*['"]([^'"]+)['"]/);
        const ottDateMatch = line.match(/ottDate:\s*['"]([^'"]+)['"]/);
        
        if (titleMatch) currentFilm.title = titleMatch[1];
        if (netMatch) currentFilm.indiaNet = netMatch[1];
        if (wwMatch) currentFilm.worldwide = wwMatch[1];
        if (statusMatch) currentFilm.status = statusMatch[1];
        if (verdictMatch) currentFilm.verdict = verdictMatch[1];
        if (weeklyMatch) currentFilm.weeklyCollection = weeklyMatch[1];
        if (ottMatch) currentFilm.ottPlatform = ottMatch[1];
        if (ottDateMatch) currentFilm.ottDate = ottDateMatch[1];
      }
      
      // End of FILMS array
      if (depth === 0 && inFilmsArray) {
        if (currentFilm) films.push(currentFilm);
        break;
      }
    }
  }
  
  return films;
}

function loadPendingUpdates() {
  const pendingPath = path.join(CONFIG.DATA_DIR, 'pending-updates.json');
  if (!fs.existsSync(pendingPath)) return [];
  return JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
}

function savePendingUpdates(updates) {
  fs.writeFileSync(
    path.join(CONFIG.DATA_DIR, 'pending-updates.json'),
    JSON.stringify(updates, null, 2)
  );
}

function loadUpdateHistory() {
  const histPath = path.join(CONFIG.DATA_DIR, 'update-history.json');
  if (!fs.existsSync(histPath)) return [];
  return JSON.parse(fs.readFileSync(histPath, 'utf8'));
}

function saveUpdateHistory(history) {
  fs.writeFileSync(
    path.join(CONFIG.DATA_DIR, 'update-history.json'),
    JSON.stringify(history, null, 2)
  );
}

function openUrl(url) {
  try {
    const platform = process.platform;
    if (platform === 'win32') execSync(`start "" "${url}"`);
    else if (platform === 'darwin') execSync(`open "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch (e) {
    console.log(yellow(`  → Could not auto-open. Visit manually: ${url}`));
  }
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function divider(char = '─', len = 60) {
  return char.repeat(len);
}

// ─── APPLY CHANGES TO APP.JSX ────────────────────────────────────────────────

function applyChangesToAppJsx(updates) {
  let content = readAppJsx();
  let appliedCount = 0;
  const results = [];

  for (const update of updates) {
    if (update.status !== 'APPROVED') continue;

    const { filmId, field, oldValue, newValue } = update;

    // Build the regex to find and replace the specific field for this film
    // Strategy: find the film's id, then find the field nearby and replace
    const fieldPatterns = {
      indiaNet: /indiaNet:\s*['"]([^'"]*)['"]/,
      worldwide: /worldwide:\s*['"]([^'"]*)['"]/,
      status: /status:\s*['"]([^'"]*)['"]/,
      verdict: /verdict:\s*['"]([^'"]*)['"]/,
      weeklyCollection: /weeklyCollection:\s*['"]([^'"]*)['"]/,
      ottPlatform: /ottPlatform:\s*['"]([^'"]*)['"]/,
      ottDate: /ottDate:\s*['"]([^'"]*)['"]/,
    };

    const pattern = fieldPatterns[field];
    if (!pattern) {
      results.push({ filmId, field, success: false, reason: 'Unknown field' });
      continue;
    }

    // Find the film block and replace within it
    // We do this by finding id: 'filmId' then the next occurrence of the field
    const filmIdPattern = new RegExp(`id:\\s*['"]${filmId}['"]`);
    const filmStart = content.search(filmIdPattern);
    
    if (filmStart === -1) {
      results.push({ filmId, field, success: false, reason: 'Film not found in App.jsx' });
      continue;
    }

    // Find the end of this film object (next film or end of array)
    const nextFilmPattern = /(?:id:\s*['"][^'"]+['"])/g;
    nextFilmPattern.lastIndex = filmStart + 1;
    const nextMatch = nextFilmPattern.exec(content);
    const filmEnd = nextMatch ? nextMatch.index : content.length;

    const filmBlock = content.slice(filmStart, filmEnd);
    const fieldMatch = filmBlock.match(pattern);
    
    if (!fieldMatch) {
      results.push({ filmId, field, success: false, reason: `Field '${field}' not found in film block` });
      continue;
    }

    const oldFieldStr = fieldMatch[0];
    const newFieldStr = oldFieldStr.replace(pattern, (_, __) => {
      return oldFieldStr.replace(/['"][^'"]*['"]$/, `'${newValue}'`);
    });

    // More precise replacement
    const exactOld = `${field}: '${oldValue}'`;
    const exactNew = `${field}: '${newValue}'`;
    const exactOldDouble = `${field}: "${oldValue}"`;
    const exactNewDouble = `${field}: "${newValue}"`;

    if (content.includes(exactOld)) {
      // Only replace within this film's block
      const before = content.slice(0, filmStart);
      const block = content.slice(filmStart, filmEnd);
      const after = content.slice(filmEnd);
      const newBlock = block.replace(exactOld, exactNew);
      content = before + newBlock + after;
      appliedCount++;
      results.push({ filmId, field, success: true });
    } else if (content.includes(exactOldDouble)) {
      const before = content.slice(0, filmStart);
      const block = content.slice(filmStart, filmEnd);
      const after = content.slice(filmEnd);
      const newBlock = block.replace(exactOldDouble, exactNewDouble);
      content = before + newBlock + after;
      appliedCount++;
      results.push({ filmId, field, success: true });
    } else {
      results.push({ filmId, field, success: false, reason: `Could not match exact value '${oldValue}' in film block` });
    }
  }

  if (appliedCount > 0) {
    // Backup before writing
    const backupPath = `${CONFIG.APP_JSX_PATH}.backup-${Date.now()}`;
    fs.copyFileSync(CONFIG.APP_JSX_PATH, backupPath);
    console.log(cyan(`  💾 Backup saved: ${path.basename(backupPath)}`));
    
    fs.writeFileSync(CONFIG.APP_JSX_PATH, content);
    log(`Applied ${appliedCount} changes to App.jsx`);
  }

  return { appliedCount, results };
}

// ─── COMMANDS ────────────────────────────────────────────────────────────────

async function cmdOpenSources() {
  console.log('\n' + bold('📰 Opening all source URLs in browser...') + '\n');
  
  for (const [key, source] of Object.entries(CONFIG.SOURCES)) {
    const trust = source.trustLevel === 'HIGH' ? green('●HIGH') : yellow('●MED');
    console.log(`  ${trust} ${bold(source.name)}`);
    console.log(`     ${C.cyan}${source.url}${C.reset}`);
    console.log(`     Best for: ${source.bestFor.join(', ')}`);
    openUrl(source.url);
    await new Promise(r => setTimeout(r, 800)); // stagger opens
  }
  
  console.log('\n' + green('✓ Opened all sources. Review manually, then run:'));
  console.log('  ' + bold('node update.js --input') + ' to enter the data you found\n');
}

async function cmdOpenAnalysts() {
  console.log('\n' + bold('🐦 Opening analyst X/Twitter profiles...') + '\n');
  
  for (const [key, analyst] of Object.entries(CONFIG.ANALYSTS)) {
    console.log(`  ${bold(analyst.name)} ${C.cyan}${analyst.handle}${C.reset}`);
    console.log(`     Specialty: ${analyst.specialty}`);
    openUrl(analyst.url);
    await new Promise(r => setTimeout(r, 800));
  }
  
  console.log('\n' + yellow('📌 Reminder: Analyst posts need manual reading.'));
  console.log('   Look for collection confirmations & verdict calls.\n');
}

async function cmdInputData() {
  console.log('\n' + bold('📝 DATA INPUT MODE') + '\n');
  console.log('Enter updates you found from your source review.');
  console.log('Format: filmId · field · newValue · source\n');
  
  const content = readAppJsx();
  const films = parseFilmsFromAppJsx(content);
  
  if (films.length === 0) {
    console.log(yellow('⚠  Could not parse films from App.jsx.'));
    console.log('   Make sure APP_JSX_PATH is correct in update.js\n');
    return;
  }

  console.log(cyan('Current films in App.jsx:\n'));
  films.forEach((f, i) => {
    const verdict = f.verdict ? ` · ${f.verdict}` : '';
    const net = f.indiaNet ? ` · ${f.indiaNet}` : '';
    console.log(`  ${String(i+1).padStart(2)}. ${bold(f.title || f.id)}${net}${verdict} [${f.status || '?'}]`);
  });

  const updates = loadPendingUpdates();
  let addMore = true;

  while (addMore) {
    console.log('\n' + divider());
    
    const filmNum = await prompt('\nFilm number (or "done" to finish): ');
    if (filmNum.toLowerCase() === 'done' || filmNum === '') break;
    
    const filmIdx = parseInt(filmNum) - 1;
    if (isNaN(filmIdx) || filmIdx < 0 || filmIdx >= films.length) {
      console.log(red('  Invalid film number'));
      continue;
    }
    
    const film = films[filmIdx];
    console.log(bold(`\nUpdating: ${film.title || film.id}`));
    console.log(`Current values:`);
    console.log(`  indiaNet:        ${film.indiaNet || '—'}`);
    console.log(`  worldwide:       ${film.worldwide || '—'}`);
    console.log(`  weeklyCollection:${film.weeklyCollection || '—'}`);
    console.log(`  status:          ${film.status || '—'}`);
    console.log(`  verdict:         ${film.verdict || '—'}`);
    console.log(`  ottPlatform:     ${film.ottPlatform || '—'}`);
    console.log(`  ottDate:         ${film.ottDate || '—'}`);
    
    const fields = ['indiaNet', 'worldwide', 'weeklyCollection', 'status', 'verdict', 'ottPlatform', 'ottDate', 'done'];
    
    let fieldDone = false;
    while (!fieldDone) {
      console.log(`\n  Fields: ${fields.slice(0, -1).map((f, i) => `${i+1}.${f}`).join(' | ')} | done`);
      const fieldInput = await prompt('  Field to update: ');
      
      if (fieldInput.toLowerCase() === 'done' || fieldInput === '') {
        fieldDone = true;
        break;
      }
      
      let fieldName;
      if (!isNaN(parseInt(fieldInput))) {
        fieldName = fields[parseInt(fieldInput) - 1];
      } else {
        fieldName = fieldInput;
      }
      
      if (fieldName === 'done' || !fields.includes(fieldName)) {
        if (fieldName !== 'done') console.log(red('  Unknown field'));
        fieldDone = true;
        break;
      }
      
      const oldValue = film[fieldName] || '';
      const newValue = await prompt(`  New value for ${bold(fieldName)} (was: "${oldValue}"): `);
      
      if (!newValue) continue;
      
      const sourceOptions = Object.entries(CONFIG.SOURCES).map(([k, v]) => k);
      console.log(`  Sources: ${sourceOptions.map((s, i) => `${i+1}.${s}`).join(' | ')}`);
      const sourceInput = await prompt('  Source: ');
      let sourceName = sourceInput;
      if (!isNaN(parseInt(sourceInput))) {
        sourceName = sourceOptions[parseInt(sourceInput) - 1] || sourceInput;
      }
      
      const update = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        filmId: film.id,
        filmTitle: film.title,
        field: fieldName,
        oldValue,
        newValue,
        source: sourceName,
        timestamp: new Date().toISOString(),
        status: 'PENDING', // PENDING → APPROVED → APPLIED
      };
      
      updates.push(update);
      console.log(green(`  ✓ Queued: ${film.title} · ${fieldName}: "${oldValue}" → "${newValue}" [${sourceName}]`));
    }
  }

  savePendingUpdates(updates);
  console.log(green(`\n✓ ${updates.filter(u => u.status === 'PENDING').length} pending updates saved.`));
  console.log(`  Run ${bold('node update.js --review')} to review & approve before applying.\n`);
}

async function cmdReview() {
  const updates = loadPendingUpdates();
  const pending = updates.filter(u => u.status === 'PENDING');
  
  if (pending.length === 0) {
    console.log(yellow('\n  No pending updates to review.\n'));
    console.log(`  Run ${bold('node update.js --input')} to enter new data first.\n`);
    return;
  }

  console.log('\n' + bold('🔍 REVIEW PENDING UPDATES') + '\n');
  console.log(`  ${pending.length} update(s) awaiting approval:\n`);
  console.log(divider());

  for (let i = 0; i < pending.length; i++) {
    const u = pending[i];
    const srcTrust = CONFIG.SOURCES[u.source]?.trustLevel;
    const trustLabel = srcTrust === 'HIGH' ? green('[HIGH TRUST]') : yellow('[MED TRUST]');
    
    console.log(`\n  ${bold(`#${i+1}`)} ${bold(u.filmTitle || u.filmId)}`);
    console.log(`     Field:   ${cyan(u.field)}`);
    console.log(`     Change:  ${red(u.oldValue || '(empty)')} → ${green(u.newValue)}`);
    console.log(`     Source:  ${CONFIG.SOURCES[u.source]?.name || u.source} ${trustLabel}`);
    console.log(`     Time:    ${new Date(u.timestamp).toLocaleString()}`);
    
    const action = await prompt(`\n     [A]pprove / [R]eject / [S]kip: `);
    
    if (action.toLowerCase() === 'a') {
      u.status = 'APPROVED';
      console.log(green('     ✓ Approved'));
    } else if (action.toLowerCase() === 'r') {
      u.status = 'REJECTED';
      console.log(red('     ✗ Rejected'));
    } else {
      console.log(yellow('     → Skipped'));
    }
  }

  savePendingUpdates(updates);
  
  const approved = updates.filter(u => u.status === 'APPROVED');
  console.log(`\n  ${green(approved.length + ' approved')} · ${red(updates.filter(u => u.status === 'REJECTED').length + ' rejected')}\n`);
  
  if (approved.length > 0) {
    console.log(`  Run ${bold('node update.js --apply')} to write changes to App.jsx.\n`);
  }
}

async function cmdApply() {
  const updates = loadPendingUpdates();
  const approved = updates.filter(u => u.status === 'APPROVED');
  
  if (approved.length === 0) {
    console.log(yellow('\n  No approved updates to apply.'));
    console.log(`  Run ${bold('node update.js --review')} first.\n`);
    return;
  }

  console.log('\n' + bold('⚡ APPLYING CHANGES TO App.jsx') + '\n');
  console.log(`  ${approved.length} approved update(s) to apply:\n`);
  
  approved.forEach(u => {
    console.log(`  ${bold(u.filmTitle)} · ${cyan(u.field)}: ${red(u.oldValue)} → ${green(u.newValue)}`);
  });
  
  console.log('');
  const confirm = await prompt('  Confirm apply? [y/N]: ');
  if (confirm.toLowerCase() !== 'y') {
    console.log(yellow('  → Cancelled\n'));
    return;
  }

  const { appliedCount, results } = applyChangesToAppJsx(approved);
  
  console.log('');
  results.forEach(r => {
    if (r.success) {
      console.log(green(`  ✓ ${r.filmId} · ${r.field}`));
    } else {
      console.log(red(`  ✗ ${r.filmId} · ${r.field}: ${r.reason}`));
    }
  });

  // Move applied updates to history
  const history = loadUpdateHistory();
  const applied = updates.filter(u => u.status === 'APPROVED');
  applied.forEach(u => {
    u.status = 'APPLIED';
    u.appliedAt = new Date().toISOString();
    history.push(u);
  });
  saveUpdateHistory(history);
  
  // Remove applied from pending
  const remaining = updates.filter(u => u.status !== 'APPROVED');
  savePendingUpdates(remaining);

  console.log(`\n  ${green(`✓ ${appliedCount} change(s) applied to App.jsx`)}`);
  console.log(cyan(`\n  Next steps:`));
  console.log(`    1. Review the diff in VS Code / git diff`);
  console.log(`    2. Run: ${bold('cd C:\\Users\\palla\\boxoffy && git add . && git commit -m "Week XX data update" && git push')}`);
  console.log(`    3. Vercel auto-deploys in ~30 seconds\n`);
  
  log(`Applied ${appliedCount} changes to App.jsx`);
}

async function cmdTrigger() {
  console.log('\n' + bold('📋 GENERATE BO TRIGGER SUMMARY') + '\n');
  console.log('This generates a formatted BO Trigger for Claude updates.\n');
  
  const content = readAppJsx();
  const films = parseFilmsFromAppJsx(content);
  
  const weekMatch = content.match(/WEEK\s+(\d+)/i);
  const weekNum = weekMatch ? weekMatch[1] : '?';
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  let trigger = `BOXOFFY UPDATE — Week ${weekNum}, ${today}\n`;
  trigger += `${'─'.repeat(50)}\n`;
  trigger += `BOX OFFICE:\n`;
  
  const running = films.filter(f => f.status === 'Running' || f.status === 'Closing');
  running.forEach(f => {
    const ww = f.worldwide ? ` / ${f.worldwide} WW` : '';
    const verdict = f.verdict ? ` | ${f.verdict}` : '';
    trigger += `  ${f.title}: ${f.indiaNet} India net${ww}${verdict}\n`;
  });
  
  const upcoming = films.filter(f => f.status === 'Upcoming');
  if (upcoming.length > 0) {
    trigger += `\nUPCOMING:\n`;
    upcoming.forEach(f => {
      trigger += `  ${f.title}: Release date TBD\n`;
    });
  }

  trigger += `\nNOTES:\n  [Add analyst confirmations, OTT deals, new releases here]\n`;
  trigger += `\nDATA SOURCES CHECKED:\n`;
  Object.values(CONFIG.SOURCES).forEach(s => {
    trigger += `  ☐ ${s.name}\n`;
  });
  trigger += `\nANALYST POSTS CHECKED:\n`;
  Object.values(CONFIG.ANALYSTS).forEach(a => {
    trigger += `  ☐ ${a.name} (${a.handle})\n`;
  });

  const triggerPath = path.join(CONFIG.DATA_DIR, `trigger-week${weekNum}-${Date.now()}.txt`);
  fs.writeFileSync(triggerPath, trigger);
  
  console.log(trigger);
  console.log(green(`✓ Saved to: ${triggerPath}\n`));
}

async function cmdStatus() {
  console.log('\n' + bold('╔══════════════════════════════════════╗'));
  console.log(bold('║     BOXOFFY UPDATE ENGINE STATUS     ║'));
  console.log(bold('╚══════════════════════════════════════╝\n'));

  // App.jsx status
  const jsxExists = fs.existsSync(CONFIG.APP_JSX_PATH);
  console.log(`  App.jsx: ${jsxExists ? green('✓ Found') : red('✗ Not found')}`);
  if (jsxExists) {
    const content = readAppJsx();
    const films = parseFilmsFromAppJsx(content);
    const weekMatch = content.match(/WEEK\s+(\d+)/i);
    console.log(`  Films in App.jsx: ${bold(films.length)}`);
    console.log(`  Current week: ${weekMatch ? bold('Week ' + weekMatch[1]) : yellow('Not found')}`);
  }
  
  // Pending updates
  const pending = loadPendingUpdates();
  const pendingCount = pending.filter(u => u.status === 'PENDING').length;
  const approvedCount = pending.filter(u => u.status === 'APPROVED').length;
  
  console.log(`\n  Pending updates:  ${pendingCount > 0 ? yellow(pendingCount) : '0'}`);
  console.log(`  Approved updates: ${approvedCount > 0 ? green(approvedCount) : '0'}`);
  
  // History
  const history = loadUpdateHistory();
  console.log(`  Total applied:    ${history.length}`);
  
  if (history.length > 0) {
    const last = history[history.length - 1];
    console.log(`  Last update:      ${new Date(last.appliedAt).toLocaleString()}`);
  }

  console.log('\n  ' + divider('─', 36));
  console.log('  COMMANDS:');
  console.log(`    ${bold('node update.js')}            → This status screen`);
  console.log(`    ${bold('node update.js --open')}     → Open all sources in browser`);
  console.log(`    ${bold('node update.js --analysts')} → Open analyst X profiles`);
  console.log(`    ${bold('node update.js --input')}    → Enter new data`);
  console.log(`    ${bold('node update.js --review')}   → Review & approve changes`);
  console.log(`    ${bold('node update.js --apply')}    → Write approved changes to App.jsx`);
  console.log(`    ${bold('node update.js --trigger')}  → Generate BO Trigger summary`);
  console.log(`    ${bold('node update.js --history')}  → View past updates`);
  console.log('');
}

async function cmdHistory() {
  const history = loadUpdateHistory();
  
  if (history.length === 0) {
    console.log(yellow('\n  No update history yet.\n'));
    return;
  }
  
  console.log('\n' + bold(`📜 UPDATE HISTORY (${history.length} entries)\n`));
  
  // Group by date
  const byDate = {};
  history.forEach(u => {
    const date = u.appliedAt.split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(u);
  });
  
  Object.entries(byDate).reverse().forEach(([date, entries]) => {
    console.log(bold(`  ${date} (${entries.length} changes)`));
    entries.forEach(u => {
      console.log(`    ${u.filmTitle || u.filmId} · ${cyan(u.field)}: ${u.oldValue} → ${green(u.newValue)} [${u.source}]`);
    });
    console.log('');
  });
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  // Ensure dirs exist
  fs.mkdirSync(CONFIG.LOGS_DIR, { recursive: true });
  fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const cmd = args[0];

  switch (cmd) {
    case '--open':
      await cmdOpenSources();
      break;
    case '--analysts':
      await cmdOpenAnalysts();
      break;
    case '--input':
      await cmdInputData();
      break;
    case '--review':
      await cmdReview();
      break;
    case '--apply':
      await cmdApply();
      break;
    case '--trigger':
      await cmdTrigger();
      break;
    case '--history':
      await cmdHistory();
      break;
    default:
      await cmdStatus();
  }
}

main().catch(err => {
  console.error(red(`\n✗ Error: ${err.message}\n`));
  process.exit(1);
});
