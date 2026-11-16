#!/usr/bin/env node
// Bake live numbers into plain HTML so AI crawlers and no-JS readers see them.  v2 · 15 Nov 2026
//  1. Ramayana hero (from const LIVE in public/ramayana.html)
//  2. Ramayana day-by-day table (from ledger/boxoffy-ledger.csv: India nett + North America, official/industry/studio only)
//  3. Ramayana Dataset dateModified + temporalCoverage = today
//  4. Homepage India top 10 (from INDIA_BOARD in src/App.jsx) into index.html's crawler block
// Everything sits between <!--bake--> markers, so reruns replace, never append. The page scripts still render live on load.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = __dirname, TODAY = new Date().toISOString().slice(0, 10);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function objAt(s, marker) {
  const a = s.indexOf(marker); if (a < 0) return null;
  let i = s.indexOf('{', a), d = 0, q = null, e = -1;
  for (; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') d++;
    else if (c === '}' && --d === 0) { e = i; break; }
  }
  return vm.runInNewContext('(' + s.slice(s.indexOf('{', a), e + 1) + ')', {}, { timeout: 1000 });
}
function fillId(s, id, html) {
  const re = new RegExp(`(<(\\w+)[^>]*\\bid="${id}"[^>]*>)(?:[^<]*|<!--bake-->[\\s\\S]*?<!--/bake-->)(</\\2>)`);
  return re.test(s) ? [s.replace(re, (m, open, tag, close) => `${open}<!--bake-->${html}<!--/bake-->${close}`), 1] : [s, 0];
}
function csv(file) {
  const t = fs.readFileSync(file, 'utf8').replace(/^﻿/, ''); const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift(); return rows.filter(r => r.length === h.length).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
const log = [];
/* ── Ramayana ─────────────────────────────────────────── */
const RF = path.join(R, 'public', 'ramayana.html');
let s = fs.readFileSync(RF, 'utf8'), n = 0, k;
const LIVE = objAt(s, 'const LIVE = {');
if (LIVE) {
  const H = LIVE.hero || {};
  const parts = {
    'bx-asof': esc(LIVE.asOf || ''), 'bx-kick': esc(H.kick || ''),
    'bx-big': `<b>${esc(H.big || '')}</b><span>${esc(H.inr || '')}</span>`,
    'bx-line': esc(String(H.line || '').replace(/<[^>]+>/g, '')),
    'bx-split': (H.split || []).map(x => `<div><small>${esc(x.k)}</small><b>${esc(x.v)}</b><em>${esc(x.s)}</em></div>`).join(''),
  };
  for (const [id, html] of Object.entries(parts)) { [s, k] = fillId(s, id, html); n += k; }
  log.push(`hero ${n}/5 · ${H.big || ''}`);
}
// day-by-day table from the ledger
const LF = path.join(R, 'ledger', 'boxoffy-ledger.csv');
if (fs.existsSync(LF)) {
  if (!s.includes('id="bx-days"')) {
    s = s.replace(/(<div class="bx-split" id="bx-split">(?:<!--bake-->[\s\S]*?<!--\/bake-->)?<\/div>)/,
      `$1\n    <section class="bx-days" id="bx-days" aria-label="Ramayana box office collection day by day"></section>`);
  }
  const L = csv(LF).filter(r => r.film === 'ramayana' && r.scope === 'day' && ['official', 'industry', 'studio'].includes(r.source_type) && r.status !== 'partial' && r.status !== 'live');
  const pick = (mkt, metric) => {
    const by = {};
    for (const r of L.filter(r => r.market === mkt && r.metric === metric)) {
      const o = by[r.date], prec = v => (Number(v) % 10000 !== 0 ? 1 : 0);
      const score = r => [r.status === 'final' ? 0 : 1, ['official', 'industry', 'studio'].indexOf(r.source_type), -prec(r.value), -Date.parse(r.recorded_at || 0)];
      if (!o || score(r).join() < score(o).join() && JSON.stringify(score(r)) !== JSON.stringify(score(o)) && cmp(score(r), score(o)) < 0) by[r.date] = r;
    }
    return by;
  };
  function cmp(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; }
  const IN = pick('India', 'nett'), NA = pick('North America', 'gross');
  const dates = [...new Set([...Object.keys(IN), ...Object.keys(NA)])].sort();
  const dn = d => (IN[d] || NA[d]).day_no;
  const wd = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const inr = r => r ? `₹${Number(r.value).toFixed(2)} Cr${r.status === 'estimate' ? ' <i>early est.</i>' : ''}` : '—';
  const usd = r => r ? `$${(Number(r.value) / 1e6).toFixed(2)}M${r.source_type === 'studio' ? ' <i>Sony est.</i>' : ''}` : '—';
  let tin = 0; for (const d of dates) if (IN[d]) tin += Number(IN[d].value);
  const rows = dates.map(d => `<tr><td>${dn(d) === '0' ? 'Previews' : 'Day ' + dn(d)}</td><td>${wd(d)}</td><td>${inr(IN[d])}</td><td>${usd(NA[d])}</td></tr>`).join('');
  const html = `<h2>Ramayana box office collection day by day</h2>
<p>India nett in ₹ crore (industry figure) and North America gross in US$ (The Numbers / Comscore actuals; Sony estimate where marked). India total so far ₹${tin.toFixed(2)} Cr nett. From the Boxoffy ledger, updated ${TODAY}.</p>
<div class="bx-days-wrap"><table><thead><tr><th>Day</th><th>Date</th><th>India nett</th><th>North America</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  [s, k] = fillId(s, 'bx-days', html);
  if (k && !s.includes('/*bx-days*/')) s = s.replace('</style>', `/*bx-days*/.bx-days{margin:18px 0 6px}.bx-days h2{font-size:18px;margin:0 0 6px}.bx-days p{font-size:13px;opacity:.8;margin:0 0 8px}.bx-days-wrap{overflow-x:auto}.bx-days table{border-collapse:collapse;width:100%;font-size:14px}.bx-days th,.bx-days td{padding:6px 10px;border-bottom:1px solid rgba(127,127,127,.25);text-align:left;white-space:nowrap}.bx-days td i{font-size:11px;opacity:.75;font-style:normal}\n</style>`);
  log.push(`days ${k ? dates.length : 0} rows`);
}
// Dataset freshness
s = s.replace(/("@id": "https:\/\/www\.boxoffy\.com\/ramayana#data",[\s\S]*?"temporalCoverage": ")(\d{4}-\d{2}-\d{2})\/\d{4}-\d{2}-\d{2}"/, `$1$2/${TODAY}"`);
if (/"@id": "https:\/\/www\.boxoffy\.com\/ramayana#data"[\s\S]*?"dateModified"/.test(s.slice(s.indexOf('ramayana#data"'), s.indexOf('ramayana#data"') + 3000)))
  s = s.replace(/("@id": "https:\/\/www\.boxoffy\.com\/ramayana#data",[\s\S]*?"dateModified": ")[^"]*"/, `$1${TODAY}"`);
else s = s.replace(/("@id": "https:\/\/www\.boxoffy\.com\/ramayana#data",[\s\S]*?"isAccessibleForFree": true,)/, `$1\n      "dateModified": "${TODAY}",`);
fs.writeFileSync(RF, s);
log.push('dataset ' + TODAY);
/* ── Homepage India top 10 ────────────────────────────── */
const AF = path.join(R, 'src', 'App.jsx'), IF = path.join(R, 'index.html');
if (fs.existsSync(AF) && fs.existsSync(IF)) {
  const B = objAt(fs.readFileSync(AF, 'utf8'), 'const INDIA_BOARD = {');
  let h = fs.readFileSync(IF, 'utf8');
  if (B && B.rows) {
    const top = B.rows.slice(0, 10).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.title)}</td><td>${esc(r.lang || '')}</td><td>₹${Number(r.nett).toFixed(2)} Cr${r.est ? ' (est.)' : ''}</td><td>₹${Number(r.total).toFixed(2)} Cr</td></tr>`).join('');
    const block = `<h2>India box office today: top ${Math.min(10, B.rows.length)} (${esc(B.date)})</h2><table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr><th align="left">#</th><th align="left">Film</th><th align="left">Language</th><th align="left">Day nett</th><th align="left">Total nett</th></tr></thead><tbody>${top}</tbody></table><p style="font-size:13px">India nett in ₹ crore. Full chart: <a href="/india-box-office.html">India box office today</a>.</p>`;
    if (!h.includes('id="home-board"')) h = h.replace('</ul>\n      </main>', '</ul>\n        <section id="home-board"></section>\n      </main>');
    [h, k] = fillId(h, 'home-board', block);
    fs.writeFileSync(IF, h); log.push(`home board ${k ? B.rows.length : 0} rows · ${B.date}`);
  }
}

/* ── 2026 hub: latest releases table ─────────────────── */
const YF = path.join(R, 'public', 'india-box-office-2026.html');
if (fs.existsSync(AF) && fs.existsSync(YF)) {
  const B = objAt(fs.readFileSync(AF, 'utf8'), 'const INDIA_BOARD = {');
  let y = fs.readFileSync(YF, 'utf8');
  const links = {};   // keep links already on the page, by title
  for (const m of y.matchAll(/<a href=["']?([^"' >]+)["']?>([^<]+)<\/a>/g)) links[m[2]] = m[1];
  links['Ramayana: Part 1'] = '/ramayana';
  const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const link = t => links[t] || (fs.existsSync(path.join(R, 'public', slug(t) + '-box-office.html')) ? '/' + slug(t) + '-box-office.html' : null);
  if (B && B.rows) {
    const td = 'padding:8px 6px;border-bottom:1px solid #e5e1da', num = td + ';text-align:right;white-space:nowrap';
    const rows = [...B.rows].sort((a, b) => b.total - a.total).map(r => {
      const l = link(r.title), name = l ? `<a href="${l}">${esc(r.title)}</a>` : esc(r.title);
      const ww = r.wwUsd ? `${esc(r.wwUsd)} (${esc(r.ww)})${r.wwNote ? ' ' + esc(r.wwNote.replace(/, industry figure$/, '')) : ''}` : (r.ww ? esc(r.ww) : '—');
      return `<tr><td style="${td}">${name}</td><td style="${td}">${esc(r.lang || '')}</td><td style="${num}">₹${Number(r.total).toFixed(2)} Cr</td><td style="${num}">${ww}</td><td style="${td};color:#6b7280">Day ${r.day}</td></tr>`;
    }).join('');
    const block = `<h2 style="font-family:'Barlow Condensed',sans-serif;font-size:26px;margin:0 0 6px">Latest 2026 box office collection</h2>
    <p style="margin:0 0 10px;color:#6b7280;font-size:14px">India nett to ${esc(B.date)} (industry figures). Daily updates: <a href="/india-box-office.html">India box office today</a>.</p>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.06em"><th style="padding:6px">Film</th><th style="padding:6px">Language</th><th style="padding:6px;text-align:right">India nett</th><th style="padding:6px;text-align:right">Worldwide</th><th style="padding:6px">Run</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    if (!y.includes('id="latest-2026"'))
      y = y.replace(/(<!-- LATEST 2026 RELEASES[^>]*-->\s*)<section style="margin:0 0 28px">[\s\S]*?<\/section>/, '$1<section id="latest-2026" style="margin:0 0 28px"></section>');
    [y, k] = fillId(y, 'latest-2026', block);
    fs.writeFileSync(YF, y); log.push(`2026 table ${k ? B.rows.length : 0} rows`);
  }
}

/* ── King tracker summary (from public/king-live.json) ─ */
const KF = path.join(R, 'public', 'king.html'), KJ = path.join(R, 'public', 'king-live.json');
if (fs.existsSync(KF) && fs.existsSync(KJ)) {
  try {
    const K = JSON.parse(fs.readFileSync(KJ, 'utf8'));
    const live = (K.countries || []).filter(c => c.status === 'selling' || c.status === 'listed' || c.tickets > 0 || c.shows > 0);
    const tk = live.reduce((a, c) => a + (c.tickets || 0), 0), sh = live.reduce((a, c) => a + (c.shows || 0), 0), cn = live.reduce((a, c) => a + (c.cinemas || 0), 0);
    const when = K.asOf ? new Date(K.asOf).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' CT' : '';
    const per = live.map(c => c.shows ? `${esc(c.name)}: ${c.shows} shows at ${c.cinemas || 0} cinemas${c.tickets ? `, ${Number(c.tickets).toLocaleString('en-US')} tickets counted` : ''}` : `${esc(c.name)}: listed, showtimes to come`).join(' · ');
    const txt = live.length
      ? `King advance booking so far: ${live.length} ${live.length === 1 ? 'country' : 'countries'} listed, ${sh} shows at ${cn} cinemas, ${tk.toLocaleString('en-US')} tickets counted. ${per}. Release Thu 24 Dec 2026.`
      : 'King advance booking has not opened yet in any country we track. Release Thu 24 Dec 2026.';
    let k2 = fs.readFileSync(KF, 'utf8'), a, b;
    [k2, a] = fillId(k2, 'scap', esc(txt).replace(/&amp;/g, '&'));
    [k2, b] = fillId(k2, 'asof', esc(when));
    fs.writeFileSync(KF, k2); log.push(`king summary ${a + b}/2 · ${live.length} markets`);
  } catch (e) { log.push('king summary skipped: ' + e.message); }
}
console.log('BAKE ok: ' + log.join(' · '));
