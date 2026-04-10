#!/usr/bin/env node
/**
 * Boxoffy Film Page Generator v2 — SEO-optimised
 * Run: node generate-pages.cjs
 */
const fs   = require('fs');
const path = require('path');

const DATA_FILE  = path.join(__dirname, 'src/data/films.json');
const OUTPUT_DIR = path.join(__dirname, 'public');
const BASE_URL   = 'https://boxoffy.com';
const GA_ID      = 'G-K6C9EVRFH4';

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function verdictColor(v) {
  return {'All-Time Blockbuster':'#B8860B','Blockbuster':'#15803D','Super Hit':'#15803D','Hit':'#0369A1','Average':'#D97706','Flop':'#C8201A','Disaster':'#7F1D1D','Upcoming':'#6B7280'}[v]||'#6B7280';
}
function releaseYear(film) {
  return (film.releaseDate||'').match(/\d{4}/)?.[0] || '2026';
}

// ── TITLE: concise, number-forward, click-worthy ────────────────────────────
function generateTitle(film) {
  const year  = releaseYear(film);
  const india = film.indiaNet && film.indiaNet !== '—' ? `₹${film.indiaNet} India` : '';
  const ww    = film.totalCollection && film.totalNum > 0 ? `₹${film.totalCollection} WW` : '';
  const num   = india || ww;

  if (film.status === 'Upcoming') {
    return `${film.title} Box Office — Day 1 Prediction & Advance Booking ${year} | Boxoffy`;
  }
  // Pattern: "Film — ₹X India | Verdict | Boxoffy"  (keeps title ~60 chars)
  if (num) {
    return `${film.title} Box Office: ${num} | ${film.verdict} | Boxoffy`;
  }
  return `${film.title} Box Office Collection — ${film.verdict} | ${year} | Boxoffy`;
}

// ── DESCRIPTION: answers the real question, hooks the click ─────────────────
function generateDescription(film) {
  const year  = releaseYear(film);
  const india = film.indiaNet && film.indiaNet !== '—' ? `₹${film.indiaNet} India nett` : '';
  const ww    = film.totalCollection && film.totalNum > 0 ? `₹${film.totalCollection} worldwide` : '';
  const ott   = film.ott?.platform && film.ott.platform !== 'TBD' ? `Streaming on ${film.ott.platform}.` : '';
  const cast  = Array.isArray(film.cast) ? film.cast[0] : (film.cast || '');
  const castSnippet = cast ? ` Starring ${cast.split('·')[0].trim()}.` : '';

  if (film.status === 'Upcoming') {
    return `${film.title} (${year}) advance booking, Day 1 collection prediction and opening weekend forecast.${castSnippet} Releasing ${film.releaseDate}. Budget, OTT date and Boxoffy verdict — updated daily.`;
  }

  const earnings = [india, ww].filter(Boolean).join(', ');
  const verdict = film.verdict || 'N/A';

  return `How much did ${film.title} earn? ${earnings ? earnings + '. ' : ''}${verdict} at the Indian box office.${castSnippet} Complete day-wise breakdown, budget vs collection, ${ott} Boxoffy verified · ${film.language} · ${year}.`;
}

// ── JSON-LD: Movie + FAQPage for rich snippets ───────────────────────────────
function generateJsonLd(film, slug) {
  const year   = releaseYear(film);
  const url    = `${BASE_URL}/${slug}.html`;
  const isReal = film.totalNum > 0;
  const cast   = Array.isArray(film.cast) ? film.cast : (film.cast ? [film.cast] : []);

  const movie = {
    "@context": "https://schema.org",
    "@type": "Movie",
    "name": film.title,
    "url": url,
    "inLanguage": film.language === 'Hindi' ? 'hi' : film.language === 'Telugu' ? 'te' : film.language === 'Tamil' ? 'ta' : 'hi',
    ...(film.releaseDate ? {"datePublished": film.releaseDate} : {}),
    ...(film.director ? {"director": {"@type":"Person","name": film.director}} : {}),
    ...(cast.length ? {"actor": cast.map(c=>c.split('·').map(n=>n.trim()).filter(Boolean).map(n=>({
      "@type":"Person","name":n
    }))).flat()} : {}),
    ...(film.ott?.platform && film.ott.platform !== 'TBD' ? {
      "potentialAction": {"@type":"WatchAction","target":`https://boxoffy.com/${slug}.html`}
    } : {})
  };

  const faqs = [];
  if (film.verdict && film.verdict !== 'Upcoming') {
    faqs.push({
      "@type":"Question",
      "name":`Is ${film.title} a Hit or Flop?`,
      "acceptedAnswer":{"@type":"Answer","text":`${film.title} is a ${film.verdict} at the Indian box office.${film.indiaNet && film.indiaNet !== '—' ? ` India nett collection: ₹${film.indiaNet}.` : ''}`}
    });
  }
  if (film.indiaNet && film.indiaNet !== '—') {
    faqs.push({
      "@type":"Question",
      "name":`How much did ${film.title} earn in India?`,
      "acceptedAnswer":{"@type":"Answer","text":`${film.title} earned ₹${film.indiaNet} India nett at the box office.${film.totalCollection && film.totalNum > 0 ? ` The worldwide gross is ₹${film.totalCollection}.` : ''}`}
    });
  }
  if (film.ott?.platform && film.ott.platform !== 'TBD') {
    faqs.push({
      "@type":"Question",
      "name":`Where can I watch ${film.title} online?`,
      "acceptedAnswer":{"@type":"Answer","text":`${film.title} is available to stream on ${film.ott.platform}.${film.ott.ottNote ? ' ' + film.ott.ottNote : ''}`}
    });
  }
  if (film.budget && film.budget !== '—') {
    faqs.push({
      "@type":"Question",
      "name":`What is the budget of ${film.title}?`,
      "acceptedAnswer":{"@type":"Answer","text":`The production budget of ${film.title} is approximately ₹${film.budget}.`}
    });
  }

  const faqSchema = faqs.length ? {
    "@context":"https://schema.org",
    "@type":"FAQPage",
    "mainEntity": faqs
  } : null;

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": generateTitle(film),
    "description": generateDescription(film),
    "author": {"@type":"Organization","name":"Boxoffy","url": BASE_URL},
    "publisher": {"@type":"Organization","name":"Boxoffy","url": BASE_URL},
    "url": url,
    "dateModified": new Date().toISOString().split('T')[0]
  };

  return [movie, faqSchema, article].filter(Boolean).map(s=>`<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n');
}

// ── FULL PAGE TEMPLATE ────────────────────────────────────────────────────────
function generatePage(film, slug) {
  const url       = `${BASE_URL}/${slug}.html`;
  const title     = generateTitle(film);
  const desc      = generateDescription(film);
  const jsonld    = generateJsonLd(film, slug);
  const vclr      = verdictColor(film.verdict);
  const isUpcoming = film.status === 'Upcoming';
  const isRunning  = film.status === 'Running';
  const year       = releaseYear(film);
  const cast       = Array.isArray(film.cast) ? film.cast.join(', ') : (film.cast || '');
  const today      = new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
  const ogImg      = film.posterUrl || `${BASE_URL}/og-image.png`;

  // Stats strip
  const stats = [];
  if (film.totalNum > 0) stats.push({l:'Worldwide', v:`₹${film.totalCollection}`, s:'Gross'});
  if (film.indiaNet && film.indiaNet !== '—') stats.push({l:'India Nett', v:`₹${film.indiaNet}`, s:'Net collection'});
  if (film.overseas && film.overseas !== 'null' && film.overseas !== null) stats.push({l:'Overseas', v:`₹${film.overseas}`, s:'International'});
  if (film.budget && film.budget !== '—') stats.push({l:'Budget', v:`₹${film.budget}`, s:'Production cost'});
  if (film.ott?.rightsDeal && film.ott.rightsDeal !== 'TBD') stats.push({l:'OTT Rights', v:film.ott.rightsDeal, s:film.ott.platform||'OTT'});
  const statsHTML = stats.map(s=>`<div class="stat-box"><div class="stat-l">${esc(s.l)}</div><div class="stat-v">${esc(s.v)}</div><div class="stat-s">${esc(s.s)}</div></div>`).join('');

  // Verdict prose — more specific now
  const verdictProse = (() => {
    if (isUpcoming) return '';
    const v = film.verdict || '';
    const india = film.indiaNet && film.indiaNet !== '—' ? ` ₹${film.indiaNet} India nett.` : '';
    const ww    = film.totalCollection && film.totalNum > 0 ? ` ₹${film.totalCollection} worldwide gross.` : '';
    const base = {
      'All-Time Blockbuster': `${film.title} is one of the all-time box office champions in Indian cinema history.${india}${ww}`,
      'Blockbuster': `${film.title} delivered a blockbuster run at the Indian box office.${india}${ww}`,
      'Super Hit': `${film.title} was a super hit, comfortably exceeding expectations.${india}${ww}`,
      'Hit': `${film.title} was a hit, recovering its investment and posting a healthy profit.${india}${ww}`,
      'Average': `${film.title} had an average run — breaking even but falling short of hit territory.${india}${ww}`,
      'Flop': `${film.title} failed to recover its theatrical investment.${india}${ww}`,
      'Disaster': `${film.title} was a box office disaster, unable to recover even a fraction of its costs.${india}${ww}`,
    }[v] || `${film.title} completed its theatrical run.${india}${ww}`;
    return `<div class="verdict-block">
      <div class="verdict-lbl">Boxoffy Verdict — ${esc(v)}</div>
      <div class="verdict-txt">${base}${film.note ? ' ' + esc(film.note) : ''}</div>
    </div>`;
  })();

  // OTT section
  const ottHTML = (film.ott?.platform && film.ott.platform !== 'TBD') ? `
    <div class="section">
      <div class="sec-hd"><span class="sec-eye">Streaming</span><span class="sec-t">OTT Release</span></div>
      <div class="info-grid">
        <div class="info-row"><div class="info-l">Platform</div><div class="info-v">${esc(film.ott.platform)}</div></div>
        ${film.ott.rightsDeal && film.ott.rightsDeal !== 'TBD' ? `<div class="info-row"><div class="info-l">Rights Deal</div><div class="info-v">${esc(film.ott.rightsDeal)}</div></div>` : ''}
        ${film.ott.debutViews && !['TBD','N/A'].includes(film.ott.debutViews) ? `<div class="info-row"><div class="info-l">Debut Views</div><div class="info-v">${esc(film.ott.debutViews)}</div></div>` : ''}
        ${film.ott.ottNote ? `<div class="info-row"><div class="info-l">Note</div><div class="info-v" style="color:#4B5563;font-size:12px">${esc(film.ott.ottNote)}</div></div>` : ''}
      </div>
    </div>` : '';

  // Weekly note
  const weeklyHTML = film.weeklyNote ? `
    <div class="section">
      <div class="sec-hd"><span class="sec-eye">Live</span><span class="sec-t">This Week</span></div>
      <div class="note">${esc(film.weeklyNote)}</div>
    </div>` : '';

  // Related links — internal linking to boost crawl depth
  const relatedLinks = `
    <div class="section">
      <div class="sec-hd"><span class="sec-eye">Explore</span><span class="sec-t">More on Boxoffy</span></div>
      <div class="related-grid">
        <a href="/" class="rel-link">← Live Box Office Dashboard</a>
        <a href="/india-boxoffice-how-it-works.html" class="rel-link">How India Box Office Works</a>
        <a href="/dhurandhar-2-vs-pushpa-2-box-office.html" class="rel-link">D2 vs Pushpa 2 Comparison</a>
        <a href="/100-crore-day-one-club-box-office.html" class="rel-link">₹100 Cr Opening Day Club</a>
        <a href="/india-all-time-box-office.html" class="rel-link">All-Time India Box Office</a>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="keywords" content="${esc(film.title)} box office, ${esc(film.title)} collection, ${esc(film.title)} hit or flop, ${esc(film.title)} ${year}, ${esc(film.language)} box office ${year}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImg)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Boxoffy">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@boxoffy">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImg)}">
${jsonld}
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;700&family=Lora:ital@0;1&display=swap" rel="stylesheet">
<!-- GA4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#111;--surface:#F9F7F4;--paper:#FFF;--rule:#E5E0D8;--accent:#C8201A;--gold:#D97706;--muted:#6B7280}
body{background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;font-size:15px;line-height:1.6}
a{color:inherit}
.nav{background:#fff;border-bottom:2px solid var(--ink);padding:0 32px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:99}
.nav-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;letter-spacing:-.01em;text-decoration:none;color:var(--ink)}
.nav-logo span{color:var(--accent)}
.nav-links{display:flex;gap:20px}
.nav-links a{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:var(--muted)}
.nav-links a:hover{color:var(--ink)}
.hero{background:var(--ink);padding:48px 32px 36px;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 20% 50%,rgba(200,32,26,.08) 0%,transparent 70%)}
.hero-eye{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.badge{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:11px;letter-spacing:.16em;text-transform:uppercase;padding:4px 10px;border:1px solid}
.badge-verdict{color:${vclr};border-color:${vclr};background:rgba(0,0,0,.3)}
.badge-lang{color:#9CA3AF;border-color:#374151}
.hero-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(32px,6vw,60px);color:#fff;line-height:.95;letter-spacing:-.02em;margin-bottom:8px}
.hero-cast{font-family:'DM Sans',sans-serif;font-size:13px;color:#9CA3AF;margin-bottom:20px}
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;background:#374151;margin-top:4px;border:1px solid #374151}
.stat-box{background:#1F2937;padding:14px 16px}
.stat-l{font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#6B7280;margin-bottom:4px}
.stat-v{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;color:#F9FAFB;line-height:1}
.stat-s{font-size:10px;color:#4B5563;margin-top:2px}
.byline{background:#F3EDE4;border-bottom:1px solid var(--rule);padding:10px 32px;font-size:11px;color:var(--muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.byline strong{color:var(--ink)}
.content{max-width:800px;margin:0 auto;padding:36px 32px 48px}
.section{margin-bottom:36px}
.sec-hd{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid var(--ink)}
.sec-eye{font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.sec-t{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:20px;color:var(--ink)}
.verdict-block{background:var(--ink);padding:24px 28px;border-left:4px solid ${vclr}}
.verdict-lbl{font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${vclr};margin-bottom:8px}
.verdict-txt{font-family:'Lora',Georgia,serif;font-size:17px;line-height:1.75;color:#E5E7EB}
.info-grid{border:1px solid var(--rule)}
.info-row{display:flex;border-bottom:1px solid var(--rule);padding:11px 16px;gap:12px}
.info-row:last-child{border-bottom:none}
.info-l{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;min-width:130px;flex-shrink:0}
.info-v{font-size:13px;color:var(--ink);font-weight:500}
.note{background:#FFF7ED;border-left:3px solid var(--gold);padding:14px 18px;font-size:13px;color:#374151;line-height:1.7}
.related-grid{display:flex;flex-wrap:wrap;gap:8px}
.rel-link{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:8px 14px;border:1px solid var(--rule);text-decoration:none;color:var(--muted);transition:all .15s}
.rel-link:hover{border-color:var(--ink);color:var(--ink)}
.share{background:var(--ink);padding:18px 32px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.share-lbl{font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#6B7280}
.sh{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:8px 16px;border:1px solid;text-decoration:none;transition:background .15s;cursor:pointer;background:transparent}
.sh:hover{background:rgba(255,255,255,.08)}
.sh-x{color:#fff;border-color:#4B5563}
.sh-wa{color:#25D366;border-color:#25D366}
.sh-cp{color:#9CA3AF;border-color:#4B5563}
footer{background:var(--ink);padding:24px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.ft-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:20px;color:#fff}
.ft-logo span{color:var(--accent)}
.ft-link{font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);text-decoration:none}
.disclaimer{padding:16px 32px;font-size:10px;color:#6B7280;line-height:1.7;background:#0D0D0D}
@media(max-width:640px){.hero{padding:32px 20px 24px}.content{padding:24px 20px 36px}.byline{padding:8px 20px}.share{padding:14px 20px}.nav{padding:0 16px}}
</style>
</head>
<body>

<nav class="nav">
  <a href="/" class="nav-logo">BOX<span>OF</span>FY</a>
  <div class="nav-links">
    <a href="/">Dashboard</a>
    <a href="/india-boxoffice-how-it-works.html">How It Works</a>
  </div>
</nav>

<section class="hero">
  <div class="hero-eye">
    <span class="badge badge-verdict">${isUpcoming ? '◎ UPCOMING' : isRunning ? '● IN CINEMAS' : esc((film.verdict||'').toUpperCase())}</span>
    <span class="badge badge-lang">${esc(film.language)} · ${esc(year)}</span>
    ${film.director ? `<span class="badge badge-lang">Dir. ${esc(film.director)}</span>` : ''}
  </div>
  <div class="hero-title">${esc(film.title)}</div>
  ${cast ? `<div class="hero-cast">${esc(cast)}</div>` : ''}
  ${stats.length ? `<div class="stats-row">${statsHTML}</div>` : ''}
</section>

<div class="byline">
  <strong>Boxoffy Data Desk</strong><span>·</span>
  <span>Updated ${today}</span><span>·</span>
  <span>Sources: Box Office India · Sacnilk · Pinkvilla</span>
</div>

<main class="content">

  ${verdictProse ? `<div class="section">${verdictProse}</div>` : ''}
  ${weeklyHTML}
  ${ottHTML}

  <div class="section">
    <div class="sec-hd"><span class="sec-eye">Details</span><span class="sec-t">Film Information</span></div>
    <div class="info-grid">
      <div class="info-row"><div class="info-l">Film</div><div class="info-v">${esc(film.title)}</div></div>
      ${film.director ? `<div class="info-row"><div class="info-l">Director</div><div class="info-v">${esc(film.director)}</div></div>` : ''}
      ${cast ? `<div class="info-row"><div class="info-l">Cast</div><div class="info-v">${esc(cast)}</div></div>` : ''}
      <div class="info-row"><div class="info-l">Language</div><div class="info-v">${esc(film.language)}</div></div>
      <div class="info-row"><div class="info-l">Release</div><div class="info-v">${esc(film.releaseDate)}</div></div>
      ${film.budget && film.budget !== '—' ? `<div class="info-row"><div class="info-l">Budget</div><div class="info-v">₹${esc(film.budget)}</div></div>` : ''}
      <div class="info-row"><div class="info-l">Boxoffy Verdict</div><div class="info-v" style="color:${vclr};font-weight:700">${esc(film.verdict)}</div></div>
      ${film.totalCollection && film.totalNum > 0 ? `<div class="info-row"><div class="info-l">Worldwide</div><div class="info-v">₹${esc(film.totalCollection)}</div></div>` : ''}
      ${film.indiaNet && film.indiaNet !== '—' ? `<div class="info-row"><div class="info-l">India Nett</div><div class="info-v">₹${esc(String(film.indiaNet))}</div></div>` : ''}
    </div>
  </div>

  ${relatedLinks}

</main>

<div class="share">
  <span class="share-lbl">Share</span>
  <a class="sh sh-x" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}&via=boxoffy" target="_blank" rel="noopener">&#120143; X</a>
  <a class="sh sh-wa" href="https://wa.me/?text=${encodeURIComponent(title+' '+url)}" target="_blank" rel="noopener">WhatsApp</a>
  <button class="sh sh-cp" onclick="navigator.clipboard.writeText(window.location.href).then(()=>{this.textContent='Copied ✓';setTimeout(()=>this.textContent='Copy Link',2000)})">Copy Link</button>
</div>

<footer>
  <div class="ft-logo">BOX<span>OF</span>FY</div>
  <a href="/" class="ft-link">← Live Dashboard</a>
</footer>

<div class="disclaimer">India Box Office Intelligence. Figures sourced from Box Office India, Sacnilk and Pinkvilla. All numbers in ₹ Crore unless stated. Boxoffy is independent and not affiliated with any studio or distributor. © 2026 Boxoffy.com</div>

</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const filterTitle = args.find(a=>!a.startsWith('--'));
  const filterYear  = args.includes('--year') ? args[args.indexOf('--year')+1] : null;
  const force       = args.includes('--force'); // bypass pageUrl skip

  const data = JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR,{recursive:true});

  let generated = 0, skipped = 0;

  Object.entries(data).forEach(([year, films]) => {
    if (filterYear && year !== filterYear) return;
    films.forEach(film => {
      if (film.pageUrl && !force) {
        skipped++;
        return;
      }
      if (filterTitle && !film.title.toLowerCase().includes(filterTitle.toLowerCase())) return;
      const slug     = generateSlug(film);
      const filename = `${slug}.html`;
      const filepath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filepath, generatePage(film, slug), 'utf8');
      console.log(`  ✅ ${film.title} (${year}) → ${filename}`);
      generated++;
    });
  });

  console.log(`\n✅ ${generated} generated, ${skipped} skipped (hand-crafted)`);
  console.log('   To regenerate hand-crafted pages: node generate-pages.cjs --force');
}

main();
