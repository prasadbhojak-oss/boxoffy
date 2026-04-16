#!/usr/bin/env node
/**
 * Boxoffy Film Page Generator — v3 (Comprehensive)
 * ──────────────────────────────────────────────────
 * Generates rich, indexable HTML pages for ALL films in films.json
 * that have real collection data. Uses every available data point
 * to create substantive content that earns Google indexing.
 *
 * What makes each page rich:
 *  • Full stats (WW, India nett, overseas, budget, footfalls)
 *  • Verdict explanation prose (data-driven, unique per tier)
 *  • Box office vs budget ROI analysis
 *  • FAQPage JSON-LD schema (3-4 questions per film)
 *  • Year context pulled from yearStats in films-historical.json
 *  • Comparable films from same year/language
 *  • OTT section if applicable
 *  • Internal links to Boxoffy editorial articles
 *  • Mobile share bar
 *
 * Hand-crafted pages are defined in HAND_CRAFTED set — all others generate.
 *
 * Usage:
 *   node generate-pages.cjs              → all films
 *   node generate-pages.cjs "RRR"        → single film
 *   node generate-pages.cjs --year 2022  → one year
 *   node generate-pages.cjs --count      → just show counts
 */

const fs   = require('fs');
const path = require('path');

const DATA_FILE      = path.join(__dirname, 'src/data/films.json');
const HIST_FILE      = path.join(__dirname, 'src/data/films-historical.json');
const OUTPUT_DIR     = path.join(__dirname, 'public');
const BASE_URL       = 'https://boxoffy.com';
const GA_ID          = 'G-K6C9EVRFH4';
const TODAY          = new Date().toISOString().split('T')[0];

// These slugs have hand-crafted editorial pages — never overwrite
const HAND_CRAFTED = new Set([
  'dhurandhar-2-box-office.html',
  'dhurandhar-box-office.html',
  'dhurandhar2-advance-article.html',
  'dhurandhar2-us-boxoffice.html',
  'dhurandhar-comparison.html',
  'dhurandhar-2-vs-pushpa-2-box-office.html',
  'dhurandhar-box-office-d1-vs-d2.html',
  'dhurandhar-2-1000-crore.html',
  'dhurandhar-the-revenge-ode.html',
  'dhurandhar2-editorial.html',
  'bhooth-bangla-box-office-preview.html',
  'bhooth-bangla-trailer-review.html',
  'india-all-time-box-office.html',
  'india-boxoffice-how-it-works.html',
  'ott-releases.html',
  'ramayana-part-one-box-office.html',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}

function fmtCr(n) {
  const num = parseFloat(n) || 0;
  if (num >= 1000) return `₹${(num/1000).toFixed(2).replace(/\.?0+$/,'')}K Cr`;
  return `₹${num.toFixed(2).replace(/\.?0+$/,'')} Cr`;
}

function verdictColor(v) {
  const m = {
    'All-Time Blockbuster':'#B8860B','Blockbuster':'#15803D','Super Blockbuster':'#15803D',
    'Super Hit':'#0369A1','Hit':'#0369A1','Average':'#D97706',
    'Flop':'#C8201A','Disaster':'#7F1D1D','OTT Hit':'#7C3AED','Upcoming':'#6B7280'
  };
  return m[v] || '#6B7280';
}

function verdictBg(v) {
  const m = {
    'All-Time Blockbuster':'#FEF9C3','Blockbuster':'#DCFCE7','Super Blockbuster':'#DCFCE7',
    'Super Hit':'#DBEAFE','Hit':'#DBEAFE','Average':'#FEF3C7',
    'Flop':'#FEE2E2','Disaster':'#FEE2E2','OTT Hit':'#EDE9FE','Upcoming':'#F3F4F6'
  };
  return m[v] || '#F3F4F6';
}

// ── Verdict explanation — data-driven prose ───────────────────────────────────
function verdictExplanation(film) {
  const v        = film.verdict || '';
  const title    = film.title || '';
  const india    = parseFloat(film.totalNum) || 0;
  const budget   = parseFloat(film.budget) || 0;
  const roi      = budget > 0 ? Math.round((india / budget) * 100) : 0;
  const lang     = film.language || 'Hindi';
  const year     = film.year || film.releaseDate?.match(/\d{4}/)?.[0] || '';

  const roiStr   = budget > 0 ? ` against a reported budget of ${fmtCr(budget)}, representing a ${roi}% return on production cost` : '';
  const indiaStr = india > 0 ? `${fmtCr(india)} India nett` : '';

  const explanations = {
    'All-Time Blockbuster': `${title} is classified as an All-Time Blockbuster — Boxoffy's highest verdict, reserved for films that permanently altered the commercial landscape of Indian cinema. With ${indiaStr}${roiStr}, it belongs to a small elite of films that transcend their release year and enter the cultural record. An All-Time Blockbuster does not just recoup costs — it redefines what a successful film can be.`,

    'Blockbuster': `${title} earned the Blockbuster verdict — a film that significantly exceeded its break-even point and delivered strong returns for all stakeholders. With ${indiaStr}${roiStr}, the film demonstrates the rare combination of wide audience reach and sustained theatrical momentum. A Blockbuster in Indian cinema is not just profitable — it is a film that found a genuine mass audience and kept them coming back.`,

    'Super Blockbuster': `${title} earned the Super Blockbuster verdict — among the highest tier in Indian box office history, reserved for films with extraordinary commercial performance. With ${indiaStr}${roiStr}, it ranks among the biggest earners of its era. Super Blockbusters define release seasons and set benchmarks that shape how the industry plans its next slate.`,

    'Super Hit': `${title} is classified as a Super Hit — a film that performed well above break-even, delivering strong profit for producers and distributors alike. With ${indiaStr}${roiStr}, the film demonstrates solid audience pull across multiple weeks. A Super Hit signals that a film successfully converted its pre-release buzz into sustained footfall, a rare achievement in the competitive Indian theatrical market.`,

    'Hit': `${title} earned a Hit verdict — comfortably profitable, with ${indiaStr}${roiStr}. A Hit at the Indian box office means the film recovered its production and distribution costs and returned profit to all stakeholders. While not a record-breaker, the Hit verdict confirms genuine audience approval and successful commercial execution across its theatrical run.`,

    'Average': `${title} ended with an Average verdict — the film broadly recovered costs but generated limited profit for producers. With ${indiaStr}${roiStr}, it performed within the band where theatrical revenue roughly equals total investment. An Average verdict in Indian cinema often reflects a film with audience appreciation but limited mass reach — or a film that opened well and declined quickly.`,

    'Flop': `${title} ended as a Flop at the Indian box office. With ${indiaStr}${roiStr ? roiStr + ', the film failed to recover its total investment theatrically' : ', the film fell short of break-even'}. A Flop verdict means theatrical revenue was insufficient to cover production and distribution costs — though OTT rights, satellite deals and music licensing often partially offset the losses. Industry verdicts consider theatrical performance only.`,

    'Disaster': `${title} ended as a Disaster at the Indian box office — the most severe verdict in the Boxoffy classification system. With ${indiaStr}${roiStr ? ', the film recovered only a fraction of its investment' : ''}, it represents a significant financial loss for producers and distributors. A Disaster verdict typically results from a combination of poor opening, rapid weekday collapse, and minimal word-of-mouth — leaving little room for OTT or satellite rights to compensate.`,

    'OTT Hit': `${title} had a limited theatrical release before making its primary impact on OTT. Films in this category are evaluated on their streaming performance and cultural footprint rather than theatrical box office alone. The OTT Hit verdict reflects strong platform viewership, subscriber engagement, or viral social media reach that validates the production's commercial value outside cinemas.`,
  };

  return explanations[v] || `${title} was released in ${year} and earned the ${v} verdict based on its theatrical performance in the ${lang} market. All box office figures are India nett unless stated otherwise, representing collections after GST extraction.`;
}

// ── ROI analysis prose ────────────────────────────────────────────────────────
function roiAnalysis(film) {
  const india  = parseFloat(film.totalNum) || 0;
  const budget = parseFloat(film.budget) || 0;
  const ww     = parseFloat(film.ww?.replace(/[^0-9.]/g,'')) || parseFloat(film.totalCollection?.replace(/[^0-9.]/g,'')) || 0;
  if (budget <= 0 || india <= 0) return '';

  const roi         = Math.round((india / budget) * 100);
  const breakEven   = Math.round(budget * 1.5);
  const cleared     = india >= breakEven;
  const multiple    = (india / budget).toFixed(1);
  const verdict     = film.verdict || '';

  const wwStr       = ww > 0 ? ` Worldwide gross reached ${fmtCr(ww)}, including overseas contribution of ${fmtCr(parseFloat(film.overseas) || (ww - india * 1.18))}.` : '';

  return `
  <div class="section">
    <div class="sec-head"><span class="sec-eyebrow">Financial Analysis</span><span class="sec-title">Box Office vs Budget</span></div>
    <div class="analysis-block">
      <p>${film.title} was reportedly made on a budget of ${fmtCr(budget)}. Against that investment, the film collected ${fmtCr(india)} India nett — a <strong>${multiple}x multiple</strong> on production cost and a <strong>${roi}% return</strong> on the reported budget.${wwStr}</p>
      <p>Break-even at the Indian box office typically requires approximately 1.5x the production budget once prints, advertising and distribution costs are factored in — placing the break-even threshold for ${film.title} at roughly ${fmtCr(breakEven)} India nett. The film <strong>${cleared ? 'cleared this threshold' : 'fell short of this threshold'}</strong>, resulting in the <strong>${verdict}</strong> verdict.</p>
      <div class="roi-bar-wrap">
        <div class="roi-label-row">
          <span>₹0</span>
          <span>Break-even ~${fmtCr(breakEven)}</span>
          <span>${fmtCr(india)} collected</span>
        </div>
        <div class="roi-bar">
          <div class="roi-fill" style="width:${Math.min(100, (india/Math.max(india,breakEven)*100).toFixed(0))}%;background:${verdictColor(verdict)}"></div>
          <div class="roi-line" style="left:${Math.min(100,(breakEven/Math.max(india,breakEven)*100)).toFixed(0)}%"></div>
        </div>
      </div>
    </div>
  </div>`;
}

// ── FAQ schema + HTML ─────────────────────────────────────────────────────────
function buildFAQ(film, yearContext) {
  const title   = film.title || '';
  const verdict = film.verdict || '';
  const india   = parseFloat(film.totalNum) || 0;
  const ww      = film.totalCollection || (india > 0 ? fmtCr(india) : null);
  const budget  = parseFloat(film.budget) || 0;
  const year    = film.year || film.releaseDate?.match(/\d{4}/)?.[0] || '';
  const lang    = film.language || 'Hindi';
  const director= film.director || '';
  const ott     = film.ott?.platform && film.ott.platform !== 'TBD' ? film.ott.platform : null;
  const ottDate = film.ott?.ottDate || '';

  const faqs = [];

  // Q1: Hit or flop
  faqs.push({
    q: `Is ${title} a hit or flop?`,
    a: `${title} is classified as a ${verdict} by Boxoffy. The film collected ${india > 0 ? fmtCr(india) + ' India nett' : 'limited theatrical revenue'} against a${budget > 0 ? ` reported budget of ${fmtCr(budget)}.` : ' production budget.'} ${verdict === 'All-Time Blockbuster' || verdict === 'Blockbuster' || verdict === 'Super Hit' || verdict === 'Hit' ? 'The film was commercially profitable.' : verdict === 'Average' ? 'The film broadly recovered its costs.' : 'The film fell short of break-even theatrically.'}`
  });

  // Q2: Total collection
  if (india > 0) {
    faqs.push({
      q: `What is ${title} total box office collection?`,
      a: `${title} collected ${fmtCr(india)} India nett at the box office${ww && ww !== fmtCr(india) ? `, with a worldwide gross of ${ww}` : ''}. The India nett figure represents collections after GST extraction, as reported by Box Office India and cross-referenced with Sacnilk and Pinkvilla.`
    });
  }

  // Q3: OTT
  if (ott) {
    faqs.push({
      q: `Where can I watch ${title} online?`,
      a: `${title} is available for streaming on ${ott} in India${ottDate ? `, with its OTT premiere from ${ottDate}` : ''}. Check the platform's app or website for regional availability and subscription requirements.`
    });
  } else {
    faqs.push({
      q: `Is ${title} available on OTT?`,
      a: `${title} released in ${year} and is likely available on major Indian streaming platforms. Check Netflix, Amazon Prime Video, JioHotstar, ZEE5 and SonyLIV for current availability, as OTT rights shift periodically.`
    });
  }

  // Q4: Director/cast
  if (director) {
    faqs.push({
      q: `Who directed ${title}?`,
      a: `${title} was directed by ${director}. The ${year} ${lang} film earned a ${verdict} verdict at the Indian box office${india > 0 ? `, collecting ${fmtCr(india)} India nett` : ''}.`
    });
  }

  // Q5: Year context if available
  if (yearContext && india > 0) {
    faqs.push({
      q: `How did ${title} perform compared to other films of ${year}?`,
      a: `${title} collected ${fmtCr(india)} India nett in ${year}, earning a ${verdict} verdict. ${yearContext.substring(0, 200)}${yearContext.length > 200 ? '...' : ''}`
    });
  }

  // JSON-LD
  const schemaFAQs = faqs.map(f => `{
      "@type": "Question",
      "name": ${JSON.stringify(f.q)},
      "acceptedAnswer": { "@type": "Answer", "text": ${JSON.stringify(f.a)} }
    }`).join(',\n    ');

  const schema = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    ${schemaFAQs}
  ]
}
</script>`;

  // HTML accordion
  const htmlFAQs = faqs.map((f, i) => `
    <div class="faq-item">
      <button class="faq-q" onclick="var a=this.nextElementSibling;var o=a.style.display==='block';document.querySelectorAll('.faq-a').forEach(function(x){x.style.display='none';x.previousElementSibling.setAttribute('aria-expanded','false')});if(!o){a.style.display='block';this.setAttribute('aria-expanded','true')}" aria-expanded="false">
        ${esc(f.q)}
        <span class="faq-arrow">›</span>
      </button>
      <div class="faq-a" style="display:none">${esc(f.a)}</div>
    </div>`).join('');

  return { schema, htmlFAQs };
}

// ── Comparable films ──────────────────────────────────────────────────────────
function getComparables(film, allFilmsFlat) {
  const india = parseFloat(film.totalNum) || 0;
  if (india <= 0) return [];

  return allFilmsFlat
    .filter(f =>
      f.title !== film.title &&
      f.language === film.language &&
      f.year === film.year &&
      (parseFloat(f.totalNum) || 0) > 0
    )
    .sort((a, b) => Math.abs(parseFloat(a.totalNum) - india) - Math.abs(parseFloat(b.totalNum) - india))
    .slice(0, 4);
}

// ── Full HTML page ────────────────────────────────────────────────────────────
function generatePage(film, slug, allFilmsFlat, yearStats) {
  const url       = `${BASE_URL}/${slug}`;
  const title     = film.title || '';
  const year      = film.year || film.releaseDate?.match(/\d{4}/)?.[0] || '';
  const lang      = film.language || 'Hindi';
  const verdict   = film.verdict || '';
  const vColor    = verdictColor(verdict);
  const vBg       = verdictBg(verdict);
  const india     = parseFloat(film.totalNum) || 0;
  const indiaStr  = film.indiaNet && film.indiaNet !== '—' ? film.indiaNet : (india > 0 ? fmtCr(india) : null);
  const ww        = film.totalCollection || null;
  const overseas  = film.overseas || null;
  const budget    = film.budget || null;
  const director  = film.director || null;
  const cast      = film.cast && Array.isArray(film.cast) ? film.cast.slice(0,5).join(', ') : (film.cast || null);
  const ott       = film.ott?.platform && film.ott.platform !== 'TBD' ? film.ott : null;
  const releaseDate = film.releaseDate || year;
  const isHollywood = lang === 'Hollywood' || lang === 'English';

  // Year context from historical data
  const yearContext = yearStats[year]?.note || yearStats[year]?.editorial || '';

  // Verdict explanation prose
  const verdictProse = verdictExplanation({...film, year});

  // ROI analysis
  const roiBlock = roiAnalysis({...film, year});

  // FAQ
  const { schema: faqSchema, htmlFAQs } = buildFAQ({...film, year}, yearContext);

  // Comparable films
  const comparables = getComparables({...film, year}, allFilmsFlat);

  // SEO title + description
  const seoTitle = india > 0
    ? `${title} Box Office Collection — ${ww || fmtCr(india)} | ${verdict} | Boxoffy`
    : `${title} Box Office Collection | ${verdict} | Boxoffy`;

  const seoDesc = india > 0
    ? `${title} (${year}) box office collection: ${indiaStr ? indiaStr + ' India nett' : ''}${ww ? ' · ' + ww + ' worldwide' : ''}. ${verdict}. ${lang} film${director ? ' directed by ' + director : ''}. Boxoffy verified verdict and analysis.`
    : `${title} (${year}) ${lang} film box office collection, verdict and OTT information. Boxoffy India box office intelligence.`;

  // Stats to show
  const stats = [];
  if (ww)      stats.push({ l:'Worldwide', v: ww, s:'Gross collection' });
  if (indiaStr) stats.push({ l:'India Nett', v: indiaStr, s:'After GST' });
  if (overseas && overseas !== 'null') stats.push({ l:'Overseas', v:`₹${overseas}`, s:'International gross' });
  if (budget)  stats.push({ l:'Budget', v:`₹${budget}`, s:'Production cost' });
  if (ott?.rightsDeal && ott.rightsDeal !== 'TBD') stats.push({ l:'OTT Rights', v:ott.rightsDeal, s:ott.platform });

  const statsHTML = stats.map(s => `
    <div class="stat-box">
      <div class="stat-lbl">${esc(s.l)}</div>
      <div class="stat-val">${esc(s.v)}</div>
      <div class="stat-sub">${esc(s.s)}</div>
    </div>`).join('');

  // Comparables HTML
  const comparablesHTML = comparables.length > 0 ? `
  <div class="section">
    <div class="sec-head"><span class="sec-eyebrow">Also from ${year}</span><span class="sec-title">Compare with Similar Films</span></div>
    <div class="comp-grid">
      ${comparables.map(c => {
        const cSlug = c.pageUrl || `${slugify(c.title)}-box-office.html`;
        const cIndia = parseFloat(c.totalNum) || 0;
        return `<a href="/${cSlug}" class="comp-card">
          <div class="comp-title">${esc(c.title)}</div>
          <div class="comp-meta">${esc(c.language)} · ${esc(c.year)}</div>
          <div class="comp-verdict" style="color:${verdictColor(c.verdict)}">${esc(c.verdict)}</div>
          ${cIndia > 0 ? `<div class="comp-collection">${fmtCr(cIndia)} India nett</div>` : ''}
        </a>`;
      }).join('')}
    </div>
  </div>` : '';

  // OTT block
  const ottHTML = ott ? `
  <div class="section">
    <div class="sec-head"><span class="sec-eyebrow">Streaming</span><span class="sec-title">OTT Release</span></div>
    <div class="ott-grid">
      <div class="ott-row"><div class="ott-label">Platform</div><div class="ott-val">${esc(ott.platform)}</div></div>
      ${ott.ottDate ? `<div class="ott-row"><div class="ott-label">OTT Date</div><div class="ott-val">${esc(ott.ottDate)}</div></div>` : ''}
      ${ott.rightsDeal && ott.rightsDeal !== 'TBD' ? `<div class="ott-row"><div class="ott-label">Rights Deal</div><div class="ott-val">${esc(ott.rightsDeal)}</div></div>` : ''}
      ${ott.debutViews && ott.debutViews !== 'TBD' ? `<div class="ott-row"><div class="ott-label">Debut Views</div><div class="ott-val">${esc(ott.debutViews)}</div></div>` : ''}
      ${ott.lifetimeViews && ott.lifetimeViews !== 'TBD' ? `<div class="ott-row"><div class="ott-label">Lifetime Views</div><div class="ott-val">${esc(ott.lifetimeViews)}</div></div>` : ''}
    </div>
  </div>` : '';

  // Year context block
  const yearContextHTML = yearContext ? `
  <div class="section">
    <div class="sec-head"><span class="sec-eyebrow">The ${year} Box Office</span><span class="sec-title">Year in Context</span></div>
    <div class="year-context">${esc(yearContext)}</div>
  </div>` : '';

  // Internal links
  const internalLinks = [
    { href:'/india-all-time-box-office.html', label:'All-Time Highest Grossing Indian Films' },
    { href:'/india-boxoffice-how-it-works.html', label:'How India Box Office Works — Nett, Gross & Verdicts' },
    { href:'/', label:'Live 2026 Box Office Dashboard' },
  ];
  if (!isHollywood) {
    internalLinks.unshift({ href:'/dhurandhar-2-vs-pushpa-2-box-office.html', label:'Biggest Indian Films — D2 vs Pushpa 2 Comparison' });
  }

  const internalLinksHTML = internalLinks.map(l =>
    `<a href="${l.href}" class="internal-link">${esc(l.label)} →</a>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<script>
(function(){
  var c=null;try{c=localStorage.getItem("boxoffy_cookie_consent");}catch(e){}
  if(c==="accepted"){
    var s=document.createElement("script");s.async=true;
    s.src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}";
    document.head.appendChild(s);window.dataLayer=window.dataLayer||[];
    window.gtag=function(){window.dataLayer.push(arguments);};
    gtag("js",new Date());gtag("config","${GA_ID}",{anonymize_ip:true});
  }
})();
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(seoTitle)}</title>
<meta name="description" content="${esc(seoDesc)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)} Box Office — ${esc(verdict)} | Boxoffy">
<meta property="og:description" content="${esc(seoDesc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE_URL}/og-image.png">
<meta property="og:site_name" content="Boxoffy — India Box Office Intelligence">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@boxoffy">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "${esc(title)} Box Office Collection — ${esc(verdict)}",
      "description": "${esc(seoDesc)}",
      "url": "${url}",
      "datePublished": "${year}-01-01",
      "dateModified": "${TODAY}",
      "author": {"@type":"Organization","name":"Boxoffy","url":"${BASE_URL}"},
      "publisher": {"@type":"Organization","name":"Boxoffy","url":"${BASE_URL}"}
    },
    {
      "@type": "Movie",
      "name": "${esc(title)}",
      "datePublished": "${esc(releaseDate)}"${director ? `,\n      "director": {"@type":"Person","name":"${esc(director)}"}` : ''}
    }
  ]
}
</script>
${faqSchema}
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0D0C0B;--paper:#F7F4EF;--rule:#E4DDD3;--accent:#C8201A;--fog:#7A7470;--surface:#fff}
body{background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif;line-height:1.6}
a{color:var(--accent);text-decoration:none}
.nav{background:#fff;border-bottom:2px solid var(--ink);padding:0 24px;height:52px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:99}
.nav-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px}
.nav-logo span{color:var(--accent)}
.nav-links a{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--fog);margin-left:20px}
.nav-links a:hover{color:var(--ink)}
.hero{background:#0D0C0B;padding:40px 24px 32px}
.hero-inner{max-width:760px;margin:0 auto}
.hero-eyebrow{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#6B7280;margin-bottom:10px}
.hero-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(34px,6vw,64px);color:#fff;line-height:.92;letter-spacing:-.02em;margin-bottom:10px}
.verdict-badge{display:inline-flex;align-items:center;padding:5px 14px;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:12px;letter-spacing:.14em;text-transform:uppercase;border-radius:2px;margin-bottom:16px}
.meta-row{font-size:12px;color:#6B7280;margin-bottom:20px}
.meta-row strong{color:#9CA3AF}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1px;background:#222;border:1px solid #222;margin-top:24px}
.stat-box{background:#161412;padding:14px 16px}
.stat-lbl{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6B7280;margin-bottom:4px}
.stat-val{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:20px;color:#fff;line-height:1}
.stat-sub{font-size:10px;color:#4B5563;margin-top:3px}
.content{max-width:760px;margin:0 auto;padding:36px 24px 60px}
.section{margin-bottom:32px}
.sec-head{display:flex;align-items:baseline;gap:12px;padding-bottom:10px;border-bottom:2px solid var(--rule);margin-bottom:16px}
.sec-eyebrow{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--fog)}
.sec-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:20px;color:var(--ink)}
.verdict-section{background:var(--surface);border:1px solid var(--rule);border-left:4px solid ${vColor};padding:20px 22px}
.verdict-section p{font-size:14px;color:#374151;line-height:1.8;margin-bottom:10px}
.verdict-section p:last-child{margin-bottom:0}
.analysis-block p{font-size:14px;color:#374151;line-height:1.8;margin-bottom:12px}
.roi-bar-wrap{margin-top:14px}
.roi-label-row{display:flex;justify-content:space-between;font-size:10px;color:var(--fog);margin-bottom:4px}
.roi-bar{height:8px;background:#E5E7EB;border-radius:4px;position:relative;overflow:visible}
.roi-fill{height:100%;border-radius:4px;transition:width .4s ease}
.roi-line{position:absolute;top:-3px;width:2px;height:14px;background:#374151;border-radius:1px}
.ott-grid{background:var(--surface);border:1px solid var(--rule)}
.ott-row{display:grid;grid-template-columns:140px 1fr;padding:10px 16px;border-bottom:1px solid var(--rule)}
.ott-row:last-child{border-bottom:none}
.ott-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--fog)}
.ott-val{font-size:13px;color:var(--ink)}
.year-context{font-size:14px;color:#374151;line-height:1.8;background:#FFFBF0;border:1px solid #FDE68A;border-left:4px solid #D97706;padding:16px 18px}
.comp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.comp-card{display:block;background:var(--surface);border:1px solid var(--rule);padding:14px;text-decoration:none;transition:border-color .15s}
.comp-card:hover{border-color:#9CA3AF}
.comp-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;color:var(--ink);line-height:1.2;margin-bottom:4px}
.comp-meta{font-size:10px;color:var(--fog);margin-bottom:3px}
.comp-verdict{font-size:11px;font-weight:700;margin-bottom:3px}
.comp-collection{font-size:11px;color:var(--fog)}
.faq-section{margin-top:32px;border-top:2px solid var(--rule);padding-top:24px}
.faq-heading{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;color:var(--ink);margin-bottom:16px}
.faq-item{border-bottom:1px solid var(--rule)}
.faq-q{width:100%;background:none;border:none;text-align:left;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;color:var(--ink);padding:14px 0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px}
.faq-q:hover{color:var(--accent)}
.faq-arrow{font-size:18px;color:var(--fog);transition:transform .2s;flex-shrink:0}
.faq-q[aria-expanded="true"] .faq-arrow{transform:rotate(90deg)}
.faq-a{font-size:13px;color:#374151;line-height:1.75;padding:0 0 14px}
.internal-links{display:flex;flex-direction:column;gap:8px;margin-top:24px;padding-top:20px;border-top:1px solid var(--rule)}
.internal-link{font-size:13px;color:var(--accent);font-weight:500}
.internal-link:hover{text-decoration:underline}
.share-bar{background:#0D0C0B;padding:18px 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sh-lbl{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#6B7280}
.sh{display:inline-flex;align-items:center;gap:6px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:8px 14px;text-decoration:none;border-radius:2px;border:none;cursor:pointer}
.sh.wa{background:#25D366;color:#000}
.sh.tw{background:#000;color:#fff;border:1px solid #333}
.sh.cp{background:#1F2937;color:#9CA3AF}
footer{background:#0D0C0B;border-top:2px solid #1F2937;padding:22px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.ft-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:20px;color:#fff}
.ft-logo span{color:var(--accent)}
.ft-link{font-size:12px;color:#6B7280;text-decoration:none}
.ft-link:hover{color:#fff}
.disclaimer{background:#111;padding:12px 24px;font-size:9px;color:#4B5563;line-height:1.7}
/* Mobile share floating bar */
.mob-float{display:none;position:fixed;bottom:0;left:0;right:0;z-index:888;background:#fff;border-top:2px solid #0D0C0B;box-shadow:0 -4px 20px rgba(0,0,0,.15);transform:translateY(100%);transition:transform .3s ease}
@media(max-width:640px){.mob-float{display:block}}
.mob-float.up{transform:translateY(0)}
.mob-float-inner{display:grid;grid-template-columns:repeat(4,1fr)}
.mob-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:11px 4px 9px;border:none;cursor:pointer;text-decoration:none;border-right:1px solid #F3F4F6}
.mob-btn:last-child{border-right:none}
.mob-icon{font-size:18px;line-height:1}
.mob-lbl{font-family:'DM Sans',sans-serif;font-weight:700;font-size:9px;letter-spacing:.05em;text-transform:uppercase}
.mob-btn.wa{background:#25D366;color:#000}
.mob-btn.tw{background:#0D0C0B;color:#fff}
.mob-btn.th{background:#1A1A1A;color:#fff}
.mob-btn.cp{background:#F9FAFB;color:#374151}
@media(max-width:640px){
  .hero,.content,.share-bar,.disclaimer,footer{padding-left:16px;padding-right:16px}
  .stats-grid{grid-template-columns:1fr 1fr}
  .comp-grid{grid-template-columns:1fr 1fr}
  .ott-row{grid-template-columns:110px 1fr}
}
</style>
</head>
<body>

<nav class="nav">
  <a href="/" class="nav-logo">BOX<span>OF</span>FY</a>
  <div class="nav-links">
    <a href="/">Dashboard</a>
    <a href="/india-all-time-box-office.html">All-Time</a>
    <a href="/india-boxoffice-how-it-works.html">How BO Works</a>
  </div>
</nav>

<section class="hero">
  <div class="hero-inner">
    <div class="hero-eyebrow">${esc(lang)} Film · ${esc(year)} · Box Office Collection</div>
    <h1 class="hero-title">${esc(title)}</h1>
    <div class="verdict-badge" style="background:${vBg};color:${vColor}">${esc(verdict)}</div>
    <div class="meta-row">
      ${director ? `<strong>Director</strong> ${esc(director)}` : ''}
      ${cast ? ` &nbsp;·&nbsp; <strong>Cast</strong> ${esc(cast)}` : ''}
      ${releaseDate ? ` &nbsp;·&nbsp; <strong>Released</strong> ${esc(releaseDate)}` : ''}
    </div>
    ${statsHTML ? `<div class="stats-grid">${statsHTML}</div>` : ''}
  </div>
</section>

<main class="content">

  <!-- Verdict explanation -->
  <div class="section">
    <div class="sec-head"><span class="sec-eyebrow">Boxoffy Verdict</span><span class="sec-title">${esc(verdict)}</span></div>
    <div class="verdict-section">
      <p>${esc(verdictProse)}</p>
    </div>
  </div>

  <!-- ROI analysis -->
  ${roiBlock}

  <!-- OTT -->
  ${ottHTML}

  <!-- Year context -->
  ${yearContextHTML}

  <!-- Comparables -->
  ${comparablesHTML}

  <!-- FAQ -->
  <div class="faq-section">
    <div class="faq-heading">Frequently Asked Questions</div>
    ${htmlFAQs}
  </div>

  <!-- Internal links -->
  <div class="section">
    <div class="sec-head"><span class="sec-eyebrow">From Boxoffy</span><span class="sec-title">Related Analysis</span></div>
    <div class="internal-links">${internalLinksHTML}</div>
  </div>

  <p style="font-size:10px;font-family:'DM Sans',sans-serif;color:var(--fog);line-height:1.75;margin-top:24px;padding-top:16px;border-top:1px solid var(--rule)">
    <strong>Source:</strong> Box Office India (canonical India nett) · Sacnilk (day-wise tracking) · Pinkvilla (cross-reference). All figures are estimates based on publicly available trade data. India nett represents collections after GST extraction. Last updated ${TODAY}. © 2026 Boxoffy.com
  </p>

</main>

<!-- Desktop share bar -->
<div class="share-bar">
  <span class="sh-lbl">Share</span>
  <a class="sh wa" href="https://wa.me/?text=${encodeURIComponent(title + ' box office: ' + (ww || fmtCr(india)) + ' | ' + verdict + ' | Boxoffy')}" onclick="this.href='https://wa.me/?text='+encodeURIComponent('${esc(title)} box office — ${esc(verdict)} | Boxoffy '+window.location.href)" target="_blank" rel="noopener">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    WhatsApp
  </a>
  <a class="sh tw" href="#" onclick="this.href='https://twitter.com/intent/tweet?text='+encodeURIComponent('${esc(title)} — ${esc(verdict)} | Boxoffy'+'&url='+window.location.href+'&via=boxoffy')" target="_blank" rel="noopener">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.629 5.905-5.629zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    Post
  </a>
  <button class="sh cp" onclick="navigator.clipboard.writeText(window.location.href).then(()=>{this.textContent='✓ Copied';setTimeout(()=>this.textContent='Copy Link',2000)})">Copy Link</button>
</div>

<!-- Mobile floating share bar -->
<div class="mob-float" id="mob-share">
  <div class="mob-float-inner">
    <a class="mob-btn wa" href="#" onclick="this.href='https://wa.me/?text='+encodeURIComponent('${esc(title)} — ${esc(verdict)} | Boxoffy '+window.location.href);return true" target="_blank" rel="noopener">
      <span class="mob-icon">💬</span><span class="mob-lbl">WhatsApp</span>
    </a>
    <a class="mob-btn tw" href="#" onclick="this.href='https://twitter.com/intent/tweet?text='+encodeURIComponent('${esc(title)} ${esc(verdict)} | Boxoffy')+'&url='+encodeURIComponent(window.location.href);return true" target="_blank" rel="noopener">
      <span class="mob-icon">𝕏</span><span class="mob-lbl">Twitter</span>
    </a>
    <a class="mob-btn th" href="#" onclick="this.href='https://www.threads.net/intent/post?text='+encodeURIComponent('${esc(title)} — ${esc(verdict)} | Boxoffy '+window.location.href);return true" target="_blank" rel="noopener">
      <span class="mob-icon">⊛</span><span class="mob-lbl">Threads</span>
    </a>
    <button class="mob-btn cp" onclick="navigator.clipboard.writeText(window.location.href).then(()=>{this.querySelector('.mob-icon').textContent='✓';setTimeout(()=>this.querySelector('.mob-icon').textContent='🔗',2000)})">
      <span class="mob-icon">🔗</span><span class="mob-lbl">Copy</span>
    </button>
  </div>
</div>
<script>
(function(){
  if(window.innerWidth>640)return;
  var bar=document.getElementById('mob-share'),shown=false;
  window.addEventListener('scroll',function(){
    var pct=window.scrollY/(document.body.scrollHeight-window.innerHeight);
    if(pct>0.3&&pct<0.92&&!shown){bar.classList.add('up');shown=true;}
    if(pct>=0.92)bar.classList.remove('up');
  },{passive:true});
})();
</script>

<footer>
  <a href="/" class="ft-logo">BOX<span>OF</span>FY</a>
  <a href="/" class="ft-link">← Live 2026 Dashboard</a>
</footer>
<div class="disclaimer">Boxoffy.com is an independent box office intelligence platform. All figures are estimates based on publicly available trade data from Box Office India, Sacnilk and Pinkvilla. Boxoffy is not affiliated with any production house, studio or distributor. © 2026 Boxoffy.com</div>

</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const args       = process.argv.slice(2);
  const filterTitle = args.find(a => !a.startsWith('--'));
  const filterYear  = args.includes('--year') ? args[args.indexOf('--year') + 1] : null;
  const countOnly   = args.includes('--count');

  // Load data
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const hist = fs.existsSync(HIST_FILE) ? JSON.parse(fs.readFileSync(HIST_FILE, 'utf8')) : {};

  // Build yearStats lookup
  const yearStats = {};
  for (const [yr, d] of Object.entries(hist)) {
    if (d.yearStats) yearStats[yr] = d.yearStats;
  }

  // Flatten all films for comparable film lookups
  const allFilmsFlat = [];
  for (const [year, films] of Object.entries(data)) {
    for (const f of films) {
      allFilmsFlat.push({ ...f, year });
    }
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let generated = 0, skipped = 0, handCrafted = 0;

  for (const [year, films] of Object.entries(data)) {
    if (filterYear && year !== filterYear) continue;

    for (const film of films) {
      const filmWithYear = { ...film, year };
      const slug = film.pageUrl || `${slugify(film.title)}-box-office.html`;

      // Skip hand-crafted pages — never overwrite
      if (HAND_CRAFTED.has(slug)) {
        handCrafted++;
        continue;
      }

      // Skip films with no meaningful data
      const total = parseFloat(film.totalNum) || 0;
      const verdict = film.verdict || '';
      if (total <= 0 || verdict === 'Upcoming') {
        skipped++;
        continue;
      }

      // Skip if filtering by title and no match
      if (filterTitle && !film.title.toLowerCase().includes(filterTitle.toLowerCase())) continue;

      if (countOnly) {
        console.log(`  ${year} | ${film.title} → ${slug}`);
        generated++;
        continue;
      }

      const html = generatePage(filmWithYear, slug, allFilmsFlat, yearStats);
      fs.writeFileSync(path.join(OUTPUT_DIR, slug), html, 'utf8');
      generated++;

      if (generated % 50 === 0) console.log(`  ... ${generated} pages generated`);
    }
  }

  console.log(`\n✅ Done`);
  console.log(`   Generated:   ${generated} pages`);
  console.log(`   Hand-crafted (skipped): ${handCrafted}`);
  console.log(`   No data (skipped):      ${skipped}`);
  console.log(`   Output: ${OUTPUT_DIR}`);
}

main();
