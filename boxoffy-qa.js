const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
  PageNumber, Footer, HeadingLevel
} = require('docx');
const fs = require('fs');

const RED    = 'C8201A';
const INK    = '111827';
const MID    = '374151';
const MUTED  = '6B7280';
const GREEN  = '065F46';
const AMBER  = '92400E';
const BGRED  = 'FEE2E2';
const BGGREEN= 'DCFCE7';
const BGAMBER= 'FEF3C7';
const BGGREY = 'F9FAFB';
const RULE   = 'E5E7EB';

const border  = { style: BorderStyle.SINGLE, size: 1, color: RULE };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const T = (text, opts={}) => new TextRun({
  text: String(text), font: 'Arial', size: opts.size||20,
  bold: opts.bold||false, color: opts.color||INK,
  italics: opts.italic||false,
});

const P = (children, opts={}) => new Paragraph({
  children: Array.isArray(children) ? children : [children],
  spacing: { before: opts.before||0, after: opts.after||100 },
  indent: opts.indent ? { left: opts.indent } : undefined,
});

const HR = (color=RED) => new Paragraph({
  children: [new TextRun({ text: '' })],
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
  spacing: { before: 160, after: 160 },
});

const cell = (children, opts={}) => new TableCell({
  children: Array.isArray(children) ? children : [children],
  borders: opts.noBorder ? noBorders : borders,
  width: { size: opts.width||4680, type: WidthType.DXA },
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  verticalAlign: opts.vAlign || undefined,
});

// Status symbols
const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️';
const TODO = '□';

// ── QA CHECKLIST DATA ─────────────────────────────────────────────────────

const weeklyChecklist = [
  {
    category: 'INDIA WEEKLY CHART — Every Thursday Night',
    critical: true,
    items: [
      { check: 'Open BookMyShow → currently showing → extract Top 10 running films by occupancy/collections', how: 'bookmyshow.com → Movies → Now Showing → sort by popularity' },
      { check: 'Cross-verify each film collection: Sacnilk (primary) + BOI + Koimoi — use lowest verified net figure', how: 'sacnilk.com/collections + boxofficeindia.com + koimoi.com' },
      { check: 'Update weekly-commentary.json — new week at TOP of array, correct week number and date range', how: 'src/data/weekly-commentary.json — insert at index 0' },
      { check: 'Each film entry has: title, language, director, releaseDate, status, verdict, weeklyCollection, weekNum, indiaNet, totalCollection, pageUrl', how: 'Check against films.json for consistency' },
      { check: 'Dhurandhar re-release / limited runs tracked separately from original run', how: 'Add as separate entry with "(Re-release)" suffix' },
      { check: 'Hollywood films with India gross listed under Running section', how: 'language: "Hollywood", use India gross not WW' },
    ]
  },
  {
    category: 'US BOX OFFICE — Every Monday Morning (after Sunday actuals)',
    critical: true,
    items: [
      { check: 'Get confirmed actuals from Deadline.com or AP Box Office Sunday report', how: 'deadline.com/v/box-office — Sunday evening after 6PM ET' },
      { check: 'Update us-bo-weekly.json — CRITICAL: use exact field names: rank, title, studio, genre, weekend, total, theaters, change, weeks, rtScore, admitsNote', how: 'NOT weekendStr/domesticStr — those are wrong field names' },
      { check: 'Mark current week status: "confirmed" for actuals, "preview" for projections', how: 'status field in week object' },
      { check: 'Update Week+1 preview with tracking data from Boxoffice Pro / Deadline', how: 'Add next week entry with status: "preview"' },
    ]
  },
  {
    category: 'APP.JSX STRINGS — Every Thursday Night',
    critical: true,
    items: [
      { check: 'Week number updated: "Week N, 2026 — ... Mar DD–DD"', how: 'Search: "Week 1X, 2026 —" — update number and dates' },
      { check: 'ForeignFilmsPanel hardcoded header updated: "BOXOFFY · WKD N · MON DD–DD, 2026"', how: 'Search: "BOXOFFY · WKD" — manually update, NOT in data files' },
      { check: 'Date stamp updated: day/date e.g. "Mon, 16 Mar 2026"', how: 'Search: "Fri, 13 Mar" format — update day and date' },
      { check: 'WEEK N · LEAD STORY label updated', how: 'Search: "WEEK 1X · LEAD STORY"' },
      { check: 'YTD stat "Verified tracked releases · Week N" updated', how: 'Line ~3683 — update week number' },
      { check: 'Data note "Data current as of Mon DD Mon YYYY" updated', how: 'Search: "Data current as of"' },
    ]
  },
];

const functionalChecklist = [
  {
    category: 'NAVIGATION — Test on every deploy',
    items: [
      { check: 'Standard white nav appears on every article page (not dark nav, not masthead style)', pages: 'All .html pages' },
      { check: 'BOXOFFY logo = BOXOF (dark) + FY (red) — not green, not all-dark', pages: 'All pages' },
      { check: 'Nav links: Home · About · How BO Works · Articles — NO movie-specific links', pages: 'All article pages' },
      { check: 'Nav is sticky (stays at top on scroll)', pages: 'All pages' },
    ]
  },
  {
    category: 'FILM ROW BUTTONS — Test after every App.jsx update',
    items: [
      { check: 'BoxOfficeRow (All-Time view): "Full Analysis →" or "Preview →" pill appears below title', pages: 'Homepage → All-Time Rank tab' },
      { check: 'WeeklyChartRow (Weekly view): pill appears below title', pages: 'Homepage → Weekly Chart tab' },
      { check: 'BogRow (Foreign Films section): pill appears below title', pages: 'Homepage → Foreign Films panel' },
      { check: 'Clicking pill navigates to correct film page — not 404', pages: 'Test O\'Romeo, Vadh 2, Border 2, Dhurandhar' },
      { check: 'Clicking pill does NOT toggle row expand (stopPropagation working)', pages: 'Click pill on expandable row' },
    ]
  },
  {
    category: 'INDIA WEEKLY CHART',
    items: [
      { check: 'Chart shows correct week number and date range in header', pages: 'Homepage → Box Office tab' },
      { check: 'Running films listed with this week\'s collection (not zero)', pages: 'Top of chart' },
      { check: 'Upcoming films listed below running with "Preview →" button', pages: 'Upcoming section' },
      { check: 'OTT films listed with "Full Analysis →" button', pages: 'OTT section' },
      { check: 'Rows are clean single-height — no prediction blocks, mini bars expanding rows', pages: 'All rows' },
    ]
  },
  {
    category: 'US BOX OFFICE PANEL',
    items: [
      { check: 'Week number and date range in header match current week (not Feb/old dates)', pages: 'Homepage → US/Global toggle' },
      { check: 'Rank, film title, studio, genre all render — no blank cells', pages: 'US BO panel' },
      { check: 'Weekend ($), Total ($), Theaters, Change%, RT score all populate', pages: 'All 7+ rows' },
      { check: 'ForeignFilmsPanel WKD header matches current week (NOT hardcoded Feb 22)', pages: 'Foreign Films masthead' },
    ]
  },
  {
    category: 'EDITORIAL SECTION (From The Desk)',
    items: [
      { check: 'Section appears on homepage regardless of which tab is selected', pages: 'Test: click OTT, Bollywood, Weekly tabs — section must stay visible' },
      { check: 'Articles sorted newest first by date', pages: 'From The Desk section' },
      { check: 'New article appears at position #1 after editorials.json update', pages: 'After adding new entry' },
      { check: 'Article links open correct pages — not 404', pages: 'Click each editorial card' },
    ]
  },
  {
    category: 'FILM PAGES',
    items: [
      { check: 'All film pages return 200 (not 404) — spot check 10 random URLs', pages: 'Check via browser or Vercel logs' },
      { check: 'Each page has correct title, verdict badge, collection data', pages: '5 sample pages' },
      { check: 'Legal popup opens and closes correctly', pages: 'Click "Sources & Legal ↗"' },
      { check: 'Share bar present above footer on all article pages', pages: 'Scroll to bottom' },
    ]
  },
  {
    category: 'DATA INTEGRITY',
    items: [
      { check: 'films.json pageUrls match pages-manifest.json slugs exactly', how: 'Run: python3 -c "import json; [print(f[\'title\'],f[\'pageUrl\']) for f in json.load(open(\'src/data/films.json\'))[\'2026\'] if f.get(\'pageUrl\')]"' },
      { check: 'No film has totalNum showing stale/wrong values (check Dhurandhar = 838.5, Border 2 = 424)', how: 'Check films.json spot values' },
      { check: 'us-bo-weekly.json fields match component: rank,title,studio,genre,weekend,total,theaters,change,weeks,rtScore,admitsNote', how: 'Check first chart entry keys' },
      { check: 'editorials.json articles all have valid url pointing to existing page', how: 'Check each url field' },
    ]
  },
  {
    category: 'SEO / INDEXING',
    items: [
      { check: 'Sitemap.xml accessible at boxoffy.com/sitemap.xml', pages: 'Open URL directly' },
      { check: 'sitemap.xml contains all major pages including new article pages', how: 'View source — count URLs' },
      { check: 'New article pages have canonical URL, meta description, H2 section labels', pages: 'View source on any new page' },
      { check: 'Google Search Console: submit sitemap after every deploy with new pages', how: 'search.google.com/search-console' },
    ]
  },
];

const knownBugs = [
  { id:'KB-001', severity:'HIGH', title:'ForeignFilmsPanel WKD date is hardcoded', component:'App.jsx ~line 2304', fix:'Search "BOXOFFY · WKD" and update manually every week — not driven by data', status:'Permanent workaround' },
  { id:'KB-002', severity:'HIGH', title:'us-bo-weekly.json field names must match USBoTop10 component exactly', component:'App.jsx USBoTop10 + src/data/us-bo-weekly.json', fix:'Fields: rank,title,studio,genre,weekend,total,theaters,change,weeks,rtScore,admitsNote — NOT weekendStr/domesticStr', status:'Must verify every update' },
  { id:'KB-003', severity:'HIGH', title:'films.json pageUrls must match pages-manifest.json slugs', component:'src/data/films.json + src/data/pages-manifest.json', fix:'O\'Romeo = oromeo-box-office.html (no apostrophe/hyphen). Run reconciliation check before deploy.', status:'Must verify every update' },
  { id:'KB-004', severity:'MEDIUM', title:'EditorialSection gets re-gated after App.jsx upload', component:'App.jsx BoxOfficeSection', fix:'After every App.jsx upload from Prasad, verify FROM THE DESK block is outside BoxOfficeSection conditional. Check: grep "FROM THE DESK" App.jsx', status:'Must verify every upload' },
  { id:'KB-005', severity:'MEDIUM', title:'Pill buttons exist in 3 separate row components', component:'BoxOfficeRow + WeeklyChartRow + BogRow', fix:'Adding button to one component does not affect others. Must inject into all 3 separately after every App.jsx rewrite.', status:'Must verify every update' },
  { id:'KB-006', severity:'LOW', title:'generate-pages.cjs must run before npm run build', component:'Build process', fix:'Step order: 1.copy files 2.node generate-pages.cjs 3.node generate-sitemap.cjs 4.npm run build 5.vercel --prod', status:'Process documentation' },
  { id:'KB-007', severity:'LOW', title:'Sitemap duplicate URLs (the-raja-saab, anaganaga-oka-raju appear twice in manifest)', component:'src/data/pages-manifest.json', fix:'Deduplicate manifest entries for these films', status:'Pending' },
  { id:'KB-008', severity:'LOW', title:'Vercel Git integration broken — CLI deploy only', component:'Deploy process', fix:'Always use: vercel --prod from C:\\Users\\palla\\boxoffy\\', status:'Permanent workaround' },
];

const weeklyWorkflow = [
  { day: 'Thursday Night', task: 'Pull India BO from BookMyShow + Sacnilk/BOI/Koimoi', file: 'weekly-commentary.json', critical: true },
  { day: 'Thursday Night', task: 'Update App.jsx week strings (week number, dates, date stamp, WKD header)', file: 'App.jsx', critical: true },
  { day: 'Thursday Night', task: 'Send weekly digest email via send-digest.js', file: 'api/send-digest.js', critical: true },
  { day: 'Monday Morning', task: 'Pull US BO actuals from Deadline/AP (Sunday confirmed)', file: 'us-bo-weekly.json', critical: true },
  { day: 'Monday Morning', task: 'Update films.json running film collections', file: 'src/data/films.json', critical: false },
  { day: 'As needed', task: 'New article: add to editorials.json at TOP, deploy HTML page, run sitemap', file: 'editorials.json + public/*.html', critical: false },
  { day: 'As needed', task: 'Film status change (Running→OTT): update films.json status + ott fields', file: 'src/data/films.json', critical: false },
  { day: 'Weekly', task: 'Verify pill buttons in all 3 row components after any App.jsx change', file: 'App.jsx', critical: true },
  { day: 'Weekly', task: 'Verify US BO field names match USBoTop10 component', file: 'us-bo-weekly.json', critical: true },
  { day: 'Weekly', task: 'Verify ForeignFilmsPanel WKD header updated', file: 'App.jsx ~line 2304', critical: true },
];

// ── BUILD DOCUMENT ────────────────────────────────────────────────────────
const children = [];

// Title
children.push(P([
  T('BOXOF', { size: 52, bold: true, color: INK }),
  T('FY', { size: 52, bold: true, color: RED }),
  T('  ·  Code Review & QA Handbook', { size: 30, color: MID }),
], { after: 40 }));
children.push(P(T('Version 1.0  ·  March 16, 2026  ·  Non-Negotiable Standing Protocol', { size: 18, color: MUTED, italic: true }), { after: 0 }));
children.push(HR());

// ── SECTION 1: WEEKLY WORKFLOW ─────────────────────────────────────────────
children.push(P(T('§1  Standing Weekly Workflow', { size: 30, bold: true, color: INK }), { before: 200, after: 120 }));
children.push(P([
  T('This is the non-negotiable weekly routine. Missing Thursday night = stale India chart on Friday. Missing Monday morning = wrong US data all week. ', { size: 18, color: MID }),
  T('These are not optional.', { size: 18, bold: true, color: RED }),
], { after: 160 }));

const wfRows = weeklyWorkflow.map(w => new TableRow({
  children: [
    cell(P(T(w.day, { size: 18, bold: w.critical, color: w.critical ? RED : MID })), { width: 1600, fill: w.critical ? 'FFF5F5' : BGGREY }),
    cell(P(T(w.task, { size: 18, color: INK })), { width: 4200 }),
    cell(P(T(w.file, { size: 16, color: MUTED, italic: true })), { width: 2200 }),
    cell(P(T(w.critical ? '🔴 CRITICAL' : '⚪ Standard', { size: 16, bold: w.critical, color: w.critical ? RED : MUTED })), { width: 1360 }),
  ],
}));

children.push(new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [1600, 4200, 2200, 1360],
  rows: [
    new TableRow({ children: [
      cell(P(T('DAY', { size: 16, bold: true, color: MUTED })), { width: 1600, fill: 'F3F4F6' }),
      cell(P(T('TASK', { size: 16, bold: true, color: MUTED })), { width: 4200, fill: 'F3F4F6' }),
      cell(P(T('FILE', { size: 16, bold: true, color: MUTED })), { width: 2200, fill: 'F3F4F6' }),
      cell(P(T('PRIORITY', { size: 16, bold: true, color: MUTED })), { width: 1360, fill: 'F3F4F6' }),
    ]}),
    ...wfRows,
  ],
}));

children.push(HR());

// ── SECTION 2: WEEKLY CHECKLIST ────────────────────────────────────────────
children.push(P(T('§2  Weekly Update Checklist', { size: 30, bold: true, color: INK }), { before: 200, after: 120 }));
children.push(P(T('Run through every item below before each deploy. Each □ should be checked off.', { size: 18, color: MID, italic: true }), { after: 160 }));

for (const section of weeklyChecklist) {
  // Section header
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [
      cell(P(T((section.critical ? '🔴 ' : '') + section.category, { size: 20, bold: true, color: section.critical ? 'FFFFFF' : INK })), {
        width: 9360, fill: section.critical ? RED : '374151',
      }),
    ]})]
  }));

  for (const item of section.items) {
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [360, 5400, 3600],
      rows: [new TableRow({ children: [
        cell(P(T(TODO, { size: 18 })), { width: 360 }),
        cell([
          P(T(item.check, { size: 18, color: INK }), { after: 40 }),
        ], { width: 5400 }),
        cell(P(T(item.how || '', { size: 16, color: MUTED, italic: true })), { width: 3600 }),
      ]})]
    }));
  }
  children.push(P(T(''), { before: 80, after: 80 }));
}

children.push(HR());

// ── SECTION 3: FUNCTIONAL QA ───────────────────────────────────────────────
children.push(P(T('§3  Functional QA — Run After Every Deploy', { size: 30, bold: true, color: INK }), { before: 200, after: 120 }));
children.push(P(T('Open the preview URL immediately after vercel --prod completes. Test each item below in a fresh incognito window.', { size: 18, color: MID, italic: true }), { after: 160 }));

for (const section of functionalChecklist) {
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [
      cell(P(T(section.category, { size: 20, bold: true, color: 'FFFFFF' })), { width: 9360, fill: '1F2937' }),
    ]})]
  }));

  for (const item of section.items) {
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [360, 5760, 3240],
      rows: [new TableRow({ children: [
        cell(P(T(TODO, { size: 18 })), { width: 360 }),
        cell(P(T(item.check, { size: 18, color: INK })), { width: 5760 }),
        cell(P(T(item.pages || item.how || '', { size: 15, color: MUTED, italic: true })), { width: 3240 }),
      ]})]
    }));
  }
  children.push(P(T(''), { before: 60, after: 60 }));
}

children.push(HR());

// ── SECTION 4: KNOWN BUGS ──────────────────────────────────────────────────
children.push(P(T('§4  Known Bugs & Gotchas', { size: 30, bold: true, color: INK }), { before: 200, after: 120 }));
children.push(P(T('These issues will recur if not explicitly checked. They are not one-time fixes — they are permanent traps in the codebase.', { size: 18, color: MID, italic: true }), { after: 160 }));

const severityColor = { HIGH: BGRED, MEDIUM: BGAMBER, LOW: BGGREY };
const severityText  = { HIGH: RED, MEDIUM: AMBER, LOW: MUTED };

children.push(new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [600, 700, 2200, 2900, 2960],
  rows: [
    new TableRow({ children: [
      cell(P(T('ID', { size: 16, bold: true, color: MUTED })), { width: 600, fill: 'F3F4F6' }),
      cell(P(T('SEV', { size: 16, bold: true, color: MUTED })), { width: 700, fill: 'F3F4F6' }),
      cell(P(T('TITLE', { size: 16, bold: true, color: MUTED })), { width: 2200, fill: 'F3F4F6' }),
      cell(P(T('FIX', { size: 16, bold: true, color: MUTED })), { width: 2900, fill: 'F3F4F6' }),
      cell(P(T('STATUS', { size: 16, bold: true, color: MUTED })), { width: 2960, fill: 'F3F4F6' }),
    ]}),
    ...knownBugs.map(b => new TableRow({ children: [
      cell(P(T(b.id, { size: 16, bold: true, color: severityText[b.severity] })), { width: 600, fill: severityColor[b.severity] }),
      cell(P(T(b.severity, { size: 16, bold: true, color: severityText[b.severity] })), { width: 700, fill: severityColor[b.severity] }),
      cell([
        P(T(b.title, { size: 17, bold: true, color: INK }), { after: 40 }),
        P(T(b.component, { size: 15, color: MUTED, italic: true }), { after: 0 }),
      ], { width: 2200 }),
      cell(P(T(b.fix, { size: 16, color: INK })), { width: 2900 }),
      cell(P(T(b.status, { size: 16, color: MUTED, italic: true })), { width: 2960 }),
    ]})),
  ],
}));

children.push(HR());

// ── SECTION 5: CODE REVIEW CHECKLIST ──────────────────────────────────────
children.push(P(T('§5  Code Review — Before Every App.jsx Deploy', { size: 30, bold: true, color: INK }), { before: 200, after: 120 }));

const codeReview = [
  ['grep "FROM THE DESK — always visible" src/App.jsx', 'Must return 1 result. If zero — EditorialSection got re-gated.'],
  ['grep -c "Boxoffy page link" src/App.jsx', 'Must return 2 (comment appears twice for 3 button blocks). If less — buttons missing.'],
  ['grep "BoxOfficeRow\\|WeeklyChartRow\\|BogRow" src/App.jsx | grep -c "pageUrl"', 'All 3 components must reference pageUrl.'],
  ['grep "WKD" src/App.jsx', 'Must show current week number (WKD 13, 14 etc.) — NOT WKD 8 or old number.'],
  ['grep "Week 1[0-9], 2026 —" src/App.jsx', 'Must show current week. Should NOT show last week\'s number.'],
  ['python3 -c "import json; data=json.load(open(\'src/data/films.json\')); manifest={m[\'title\']:m[\'slug\'] for m in json.load(open(\'src/data/pages-manifest.json\'))}; [print(f\'MISMATCH: {f[\\\"title\\\"]}\') for f in data[\'2026\'] if f[\'title\'] in manifest and f.get(\'pageUrl\') != manifest[f[\'title\']]]"', 'Must print nothing. Any output = broken film page links.'],
  ['python3 -c "import json; w=json.load(open(\'src/data/us-bo-weekly.json\')); f=list(w.values())[0][\'chart\'][0]; needed={\'rank\',\'title\',\'studio\',\'genre\',\'weekend\',\'total\',\'theaters\',\'change\',\'weeks\',\'rtScore\',\'admitsNote\'}; print(\'MISSING:\',needed-set(f.keys()) or \'OK\')"', 'Must print "MISSING: OK". Any field names = US BO blank cells.'],
];

children.push(new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [360, 4200, 4800],
  rows: [
    new TableRow({ children: [
      cell(P(T('', { size: 14 })), { width: 360, fill: 'F3F4F6' }),
      cell(P(T('RUN THIS COMMAND', { size: 16, bold: true, color: MUTED })), { width: 4200, fill: 'F3F4F6' }),
      cell(P(T('EXPECTED RESULT', { size: 16, bold: true, color: MUTED })), { width: 4800, fill: 'F3F4F6' }),
    ]}),
    ...codeReview.map(([cmd, expected]) => new TableRow({ children: [
      cell(P(T(TODO, { size: 18 })), { width: 360 }),
      cell(P(T(cmd, { size: 14, color: '065F46', italic: true })), { width: 4200 }),
      cell(P(T(expected, { size: 16, color: INK })), { width: 4800 }),
    ]})),
  ],
}));

children.push(HR());

// ── SECTION 6: DEPLOY SEQUENCE ─────────────────────────────────────────────
children.push(P(T('§6  Correct Deploy Sequence', { size: 30, bold: true, color: INK }), { before: 200, after: 120 }));

const deploySteps = [
  ['Step 1', 'cd C:\\Users\\palla\\boxoffy', 'Must be in project root'],
  ['Step 2', 'copy files into src/ and public/', 'App.jsx → src\\, data files → src\\data\\, HTML pages → public\\'],
  ['Step 3', 'node generate-pages.cjs', 'Generates film pages from pages-manifest.json into public/'],
  ['Step 4', 'node generate-sitemap.cjs', 'Regenerates sitemap.xml with all pages'],
  ['Step 5', 'Run §5 Code Review checks', 'Catch bugs BEFORE building'],
  ['Step 6', 'npm run build', 'Vite build — check for errors'],
  ['Step 7', 'git add src/ public/', 'Stage all changes'],
  ['Step 8', 'git commit -m "..."', 'Meaningful commit message with week number'],
  ['Step 9', 'vercel --prod', 'Deploy — Git push does NOT deploy (integration broken)'],
  ['Step 10', 'Open preview URL in incognito', 'Run §3 Functional QA immediately'],
];

children.push(new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [800, 3200, 5360],
  rows: deploySteps.map(([step, cmd, note]) => new TableRow({ children: [
    cell(P(T(step, { size: 18, bold: true, color: RED })), { width: 800, fill: 'FFF5F5' }),
    cell(P(T(cmd, { size: 17, bold: true, color: '065F46', italic: true })), { width: 3200 }),
    cell(P(T(note, { size: 17, color: MID })), { width: 5360 }),
  ]})),
}));

// ── ASSEMBLE ───────────────────────────────────────────────────────────────
const doc = new Document({
  styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    footers: {
      default: new Footer({
        children: [P([
          T('Boxoffy.com  ·  Code Review & QA Handbook  ·  Confidential  ·  Page ', { size: 16, color: MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: MUTED }),
          T(' of ', { size: 16, color: MUTED }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: MUTED }),
        ], { after: 0 })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('/home/claude/boxoffy-qa.docx', buf);
  console.log('✅ boxoffy-qa.docx created');
});
