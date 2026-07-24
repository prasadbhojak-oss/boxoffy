// api/send-digest.js
// Vercel Serverless Function — fires via cron every Sunday
// vercel.json: { "path": "/api/send-digest", "schedule": "30 6 * * 0" }
// = Every Sunday 6:00 AM UTC = 11:30 AM IST
//
// Env vars required (set in Vercel dashboard):
//   RESEND_API_KEY      — your Resend API key (re_xxxxxx)
//   CRON_SECRET         — secret token to prevent manual abuse (any random string)
//
// Resend Audience ID: 6fc2744e-1719-4693-91a9-770d9e0eea36

import filmsRaw        from '../src/data/films.json'    with { type: 'json' };
import editorialsRaw   from '../src/data/editorials.json' with { type: 'json' };
import commentaryRaw   from '../src/data/weekly-commentary.json' with { type: 'json' };

const AUDIENCE_ID = '6fc2744e-1719-4693-91a9-770d9e0eea36';
const FROM        = 'Boxoffy Brief <info@boxoffy.com>';
const REPLY_TO    = 'info@boxoffy.com';
const BASE_URL    = 'https://boxoffy.com';
const TMDB        = 'https://image.tmdb.org/t/p/w185';

// ── Verdict badge styles ─────────────────────────────────────────
const VERDICT_STYLE = {
  'All-Time Blockbuster': ['#6D28D9','#EDE9FE'],
  'Blockbuster':          ['#065F46','#D1FAE5'],
  'BLOCKBUSTER':          ['#065F46','#D1FAE5'],
  'Super Hit':            ['#065F46','#D1FAE5'],
  'SUPER HIT':            ['#065F46','#D1FAE5'],
  'Hit':                  ['#1D4ED8','#DBEAFE'],
  'HIT':                  ['#1D4ED8','#DBEAFE'],
  'Semi Hit':             ['#92400E','#FEF3C7'],
  'SEMI HIT':             ['#92400E','#FEF3C7'],
  'Average':              ['#374151','#F3F4F6'],
  'AVERAGE':              ['#374151','#F3F4F6'],
  'Flop':                 ['#991B1B','#FEF2F2'],
  'FLOP':                 ['#991B1B','#FEF2F2'],
  'Disaster':             ['#7F1D1D','#FEF2F2'],
};

const TAG_STYLE = {
  'DEEP DIVE':        ['#0D1F35','#EEF5FF'],
  'VERDICT':          ['#991B1B','#FEF2F2'],
  'COMPARISON':       ['#1D4ED8','#DBEAFE'],
  'DATA ANALYSIS':    ['#065F46','#D1FAE5'],
  'US BOX OFFICE':    ['#1D4ED8','#DBEAFE'],
  'ANALYSIS':         ['#E8631A','#FFF0E6'],
  'PRICING ANALYSIS': ['#92400E','#FEF3C7'],
};

// ── Helpers ──────────────────────────────────────────────────────
function verdictBadge(verdict, override) {
  const label = override || verdict || '—';
  const [color, bg] = VERDICT_STYLE[label] || VERDICT_STYLE[verdict] || ['#374151','#F3F4F6'];
  return `<span style="display:inline-block;font-family:Arial,sans-serif;font-size:9px;font-weight:700;color:${color};background:${bg};padding:2px 7px;border-radius:2px;">${label}</span>`;
}

function chartRowLarge(film, rank) {
  const { title, posterUrl, weeklyCollection, indiaNet, verdict, language, weekNum, pageUrl } = film;
  const url   = pageUrl ? `${BASE_URL}/${pageUrl}` : BASE_URL;
  const wkStr = weeklyCollection ? `₹${weeklyCollection} Cr` : '—';
  const ttlStr= indiaNet ? `₹${indiaNet} Cr total` : '';
  const [vc, vbg] = VERDICT_STYLE[verdict] || ['#374151','#F3F4F6'];
  const rankColor = rank === 1 ? '#E8631A' : '#7A92AB';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #EEF5FF;">
      <tr>
        <td width="28" style="vertical-align:middle;padding-right:6px;">
          <div style="font-family:Arial,sans-serif;font-size:15px;font-weight:900;color:${rankColor};line-height:1;">#${rank}</div>
        </td>
        <td width="52" style="vertical-align:middle;padding-right:10px;">
          <a href="${url}">
            <img src="${posterUrl || ''}" width="52" height="78" alt="${title}" style="display:block;border-radius:3px;border:0;object-fit:cover;" />
          </a>
        </td>
        <td style="vertical-align:middle;padding-right:8px;">
          <a href="${url}" style="text-decoration:none;">
            <div style="font-family:Georgia,serif;font-weight:700;font-size:15px;color:#0D1F35;line-height:1.2;">${title}</div>
          </a>
          <div style="font-family:Arial,sans-serif;font-size:10px;color:#7A92AB;margin-top:3px;">${language || ''}${weekNum ? ` · Wk ${weekNum}` : ''}</div>
          <div style="margin-top:5px;">${verdictBadge(verdict)}</div>
        </td>
        <td align="right" style="vertical-align:middle;white-space:nowrap;">
          <div style="font-family:Georgia,serif;font-weight:700;font-size:20px;color:#E8631A;line-height:1;">${wkStr}</div>
          <div style="font-family:Arial,sans-serif;font-size:9px;color:#7A92AB;margin-top:2px;">this week</div>
          ${ttlStr ? `<div style="font-family:Arial,sans-serif;font-size:9px;color:#7A92AB;">${ttlStr}</div>` : ''}
        </td>
      </tr>
    </table>`;
}

function chartRowSmall(film, rank) {
  const { title, posterUrl, weeklyCollection, verdict, language, weekNum, pageUrl } = film;
  const url   = pageUrl ? `${BASE_URL}/${pageUrl}` : BASE_URL;
  const wkStr = weeklyCollection ? `₹${weeklyCollection} Cr` : '—';
  const [vc]  = VERDICT_STYLE[verdict] || ['#6B7280'];

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #EEF5FF;">
      <tr>
        <td width="28" style="vertical-align:middle;padding-right:6px;">
          <div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#7A92AB;">#${rank}</div>
        </td>
        <td width="36" style="vertical-align:middle;padding-right:8px;">
          <img src="${posterUrl || ''}" width="36" height="54" alt="${title}" style="display:block;border-radius:2px;border:0;opacity:0.75;object-fit:cover;" />
        </td>
        <td style="vertical-align:middle;">
          <a href="${url}" style="text-decoration:none;">
            <div style="font-family:Arial,sans-serif;font-weight:700;font-size:12px;color:#0D1F35;">${title} <span style="font-weight:400;color:#7A92AB;">(${language || ''}${weekNum ? ` · Wk ${weekNum}` : ''})</span></div>
          </a>
        </td>
        <td align="right" style="vertical-align:middle;white-space:nowrap;">
          <div style="font-family:Arial,sans-serif;font-weight:700;font-size:13px;color:${vc};">${wkStr}</div>
          <div style="font-family:Arial,sans-serif;font-size:8px;color:#7A92AB;">${verdict || ''}</div>
        </td>
      </tr>
    </table>`;
}

function articleCard(article, featured = false) {
  const { tag, headline, dek, date, readTime, url: slug } = article;
  const url = slug ? `${BASE_URL}/${slug}` : BASE_URL;
  const [tc, tbg] = TAG_STYLE[tag] || ['#374151','#F3F4F6'];
  const borderColor = tc;
  const dekShort = (dek || '').slice(0, 130) + ((dek || '').length > 130 ? '…' : '');
  const borderWidth = featured ? '4px' : '3px';
  const bgColor = featured ? '#FDFBFF' : '#FFFFFF';
  const featuredBadge = featured
    ? `<div style="font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${tc};background:${tbg};padding:2px 8px;border-radius:2px;display:inline-block;margin-bottom:7px;">${tag} · NEW THIS WEEK</div>`
    : `<div style="font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${tc};background:${tbg};padding:2px 7px;border-radius:2px;display:inline-block;margin-bottom:7px;">${tag}</div>`;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;border:1px solid #D6E4F0;border-left:${borderWidth} solid ${borderColor};border-radius:0 4px 4px 0;background:${bgColor};">
      <tr>
        <td style="padding:${featured ? '16px 16px 16px 18px' : '14px 14px 14px 16px'};">
          ${featuredBadge}
          <a href="${url}" style="text-decoration:none;">
            <div style="font-family:Georgia,serif;font-weight:700;font-size:${featured ? '17px' : '15px'};color:#0D1F35;line-height:1.3;margin-bottom:${featured ? '8px' : '6px'};">${headline}</div>
          </a>
          <p style="font-family:Arial,sans-serif;font-size:${featured ? '12px' : '11px'};color:#4A6080;line-height:1.65;margin:0 0 ${featured ? '12px' : '10px'};">${dekShort}</p>
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding-right:14px;"><span style="font-family:Arial,sans-serif;font-size:10px;color:#7A92AB;">${date || ''} · ${readTime || ''}</span></td>
            <td><a href="${url}" style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;color:${tc};text-decoration:none;">Read full analysis →</a></td>
          </tr></table>
        </td>
      </tr>
    </table>`;
}

function upcomingCard(film) {
  const { title, posterUrl, releaseDate, director, budget, language, pageUrl } = film;
  const url = pageUrl ? `${BASE_URL}/${pageUrl}` : `${BASE_URL}/upcoming-releases.html`;
  return `
        <td style="vertical-align:top;padding:0 6px;width:33%;">
          <a href="${url}" style="text-decoration:none;">
            <img src="${posterUrl}" width="152" height="90" alt="${title}" style="display:block;border-radius:4px;border:0;object-fit:cover;object-position:top;margin-bottom:8px;width:100%;max-width:152px;" />
            <div style="font-family:Georgia,serif;font-weight:700;font-size:13px;color:#0D1F35;line-height:1.2;margin-bottom:3px;">${title}</div>
          </a>
          <div style="font-family:Arial,sans-serif;font-size:10px;color:#E8631A;font-weight:700;margin-bottom:2px;">${releaseDate || 'TBC'}</div>
          <div style="font-family:Arial,sans-serif;font-size:10px;color:#7A92AB;line-height:1.4;">${director || ''}${budget ? ` · ${budget}` : ''}</div>
        </td>`;
}

// ── Main HTML builder ────────────────────────────────────────────
function buildDigestHtml({ week, chart, articles, upcoming, firstName = '{{firstName}}' }) {

  const { weekNum, dateRange, headline, subline, interval_take, nextWeek } = week;

  // Split chart: top 3 large, next 3 small
  const top3   = chart.slice(0, 3);
  const next3  = chart.slice(3, 6);

  const topHeroFilm = chart[0] || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<title>Boxoffy Brief · ${weekNum} · ${dateRange}</title>
</head>
<body style="margin:0;padding:0;background:#EEF5FF;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${headline} · ${(subline||'').slice(0,80)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF5FF;">
<tr><td align="center" style="padding:24px 12px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

<!-- HEADER -->
<tr>
  <td style="background:#0D1F35;border-radius:8px 8px 0 0;overflow:hidden;">
    <div style="height:4px;background:linear-gradient(90deg,#E8631A,#FFA040);"></div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:24px 28px 20px;vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
            <tr>
              <td style="font-family:Arial,sans-serif;font-size:24px;font-weight:900;letter-spacing:-1px;color:#FFFFFF;">BOX<span style="color:#E8631A;">OF</span>FY</td>
              <td style="padding-left:12px;vertical-align:middle;"><span style="font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#4A6080;background:#162A44;padding:3px 8px;border-radius:2px;">WEEKLY BRIEF</span></td>
            </tr>
          </table>
          <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E8631A;margin-bottom:10px;">${weekNum} · ${dateRange}</div>
          <div style="font-family:Georgia,serif;font-weight:700;font-size:20px;color:#FFFFFF;line-height:1.25;margin-bottom:10px;">${headline}</div>
          <div style="font-family:Arial,sans-serif;font-size:12px;color:#7A92AB;line-height:1.6;">${(subline||'').slice(0,160)}</div>
        </td>
        <td width="88" style="padding:0;vertical-align:bottom;text-align:right;">
          ${topHeroFilm.posterUrl ? `<img src="${topHeroFilm.posterUrl}" width="88" height="132" alt="${topHeroFilm.title}" style="display:block;border:0;border-radius:4px 0 0 0;object-fit:cover;" />` : ''}
        </td>
      </tr>
    </table>
  </td>
</tr>

<!-- GREETING -->
<tr>
  <td style="background:#162A44;padding:12px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-family:Arial,sans-serif;font-size:13px;color:#FFFFFF;">Hey <strong>${firstName}</strong> — your weekly box office intelligence from Boxoffy.</td>
      <td align="right" style="font-family:Arial,sans-serif;font-size:10px;color:#4A6080;white-space:nowrap;">Verified numbers, no spin.</td>
    </tr></table>
  </td>
</tr>

<!-- WEEKLY CHART -->
<tr>
  <td style="background:#FFFFFF;padding:24px 28px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E8631A;padding-bottom:4px;">▶ India Weekly Chart</td>
        <td align="right"><a href="${BASE_URL}" style="font-family:Arial,sans-serif;font-size:10px;color:#2563EB;text-decoration:none;font-weight:700;">Full chart →</a></td>
      </tr>
      <tr><td colspan="2" style="padding-bottom:14px;"><div style="font-family:Arial,sans-serif;font-size:9px;color:#7A92AB;letter-spacing:0.06em;">${weekNum} · ${dateRange} · India Nett</div></td></tr>
    </table>
    ${top3.map((f, i) => chartRowLarge(f, i + 1)).join('')}
    ${next3.map((f, i) => chartRowSmall(f, i + 4)).join('')}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;margin-bottom:4px;">
      <tr><td align="center">
        <a href="${BASE_URL}" style="display:inline-block;background:#0D1F35;color:#FFFFFF;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:10px 28px;border-bottom:2px solid #E8631A;border-radius:2px;">View Full Chart →</a>
      </td></tr>
    </table>
  </td>
</tr>

<!-- BOXOFFY TAKE -->
<tr>
  <td style="background:#FFF8F5;padding:20px 28px;border-top:1px solid #EEF5FF;border-left:4px solid #E8631A;">
    <div style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E8631A;margin-bottom:10px;">✍ BOXOFFY TAKE · ${weekNum}</div>
    <p style="font-family:Georgia,serif;font-size:13px;color:#1E3251;line-height:1.75;margin:0 0 12px;font-style:italic;">${(interval_take||'').slice(0,500)}${(interval_take||'').length > 500 ? '…' : ''}</p>
    ${nextWeek ? `<p style="font-family:Arial,sans-serif;font-size:12px;color:#4A6080;line-height:1.65;margin:0;padding-top:10px;border-top:1px solid #D6E4F0;"><strong style="color:#0D1F35;">Next week:</strong> ${(nextWeek||'').slice(0,200)}${(nextWeek||'').length > 200 ? '…' : ''}</p>` : ''}
  </td>
</tr>

<!-- US BOX OFFICE -->
<tr>
  <td style="background:#1A3A6B;padding:16px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td>
        <div style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#60A5FA;margin-bottom:6px;">🇺🇸 US BOX OFFICE · ${dateRange}</div>
        <div style="font-family:Georgia,serif;font-weight:700;font-size:14px;color:#FFFFFF;">Project Hail Mary #1 · $80.5M &nbsp;·&nbsp; D2 #3 · $9.57M</div>
        <div style="font-family:Arial,sans-serif;font-size:11px;color:#7A92AB;margin-top:4px;">$13.5M 4-day NA — new Indian cinema NA record, beats Kalki 2898-AD</div>
      </td>
      <td align="right" style="vertical-align:middle;">
        <a href="${BASE_URL}" style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;color:#E8631A;text-decoration:none;border:1px solid #E8631A;padding:6px 12px;border-radius:2px;white-space:nowrap;">US Chart →</a>
      </td>
    </tr></table>
  </td>
</tr>

<!-- FROM THE DESK -->
<tr>
  <td style="background:#FFFFFF;padding:24px 28px 16px;">
    <div style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E8631A;margin-bottom:16px;">✍ FROM THE DESK</div>
    ${articles.map((a, i) => articleCard(a, i === 0)).join('')}
  </td>
</tr>

<!-- UPCOMING -->
<tr>
  <td style="background:#F8FBFF;padding:20px 28px;border-top:1px solid #D6E4F0;">
    <div style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E8631A;margin-bottom:14px;">▲ COMING SOON</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${upcoming.map(f => upcomingCard(f)).join('<td width="1" style="background:#D6E4F0;padding:0;"></td>')}
        <td style="vertical-align:middle;padding-left:14px;text-align:center;">
          <div style="font-family:Arial,sans-serif;font-size:11px;color:#7A92AB;line-height:1.6;margin-bottom:10px;">33 films tracked<br>through 2026</div>
          <a href="${BASE_URL}/upcoming-releases.html" style="display:inline-block;font-family:Arial,sans-serif;font-size:10px;font-weight:700;color:#FFFFFF;background:#0D1F35;text-decoration:none;padding:8px 14px;border-radius:3px;border-bottom:2px solid #E8631A;">Full Calendar →</a>
        </td>
      </tr>
    </table>
  </td>
</tr>

<!-- MAIN CTA -->
<tr>
  <td style="background:linear-gradient(135deg,#E8631A,#D4541A);padding:22px 28px;text-align:center;">
    <div style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.85);margin-bottom:14px;">Live data updated daily · Verified numbers · No PR fluff</div>
    <a href="${BASE_URL}" style="display:inline-block;background:#FFFFFF;color:#E8631A;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:14px 36px;border-radius:3px;">Open Boxoffy Live Dashboard →</a>
  </td>
</tr>

<!-- FOOTER -->
<tr>
  <td style="background:#0D1F35;border-radius:0 0 8px 8px;padding:20px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <div style="font-family:Arial,sans-serif;font-size:18px;font-weight:900;letter-spacing:-1px;color:#FFFFFF;margin-bottom:6px;">BOX<span style="color:#E8631A;">OF</span>FY</div>
          <div style="font-family:Arial,sans-serif;font-size:10px;color:#4A6080;line-height:1.7;">India's box office. Verified numbers, honest verdicts.<br><a href="${BASE_URL}" style="color:#2563EB;text-decoration:none;">${BASE_URL}</a></div>
        </td>
        <td align="right" style="vertical-align:top;">
          <table cellpadding="0" cellspacing="4" border="0">
            <tr>
              <td><a href="${BASE_URL}" style="font-family:Arial,sans-serif;font-size:10px;color:#4A6080;text-decoration:none;">Weekly</a></td>
              <td><span style="color:#2D3A4A;">·</span></td>
              <td><a href="${BASE_URL}/india-all-time-box-office.html" style="font-family:Arial,sans-serif;font-size:10px;color:#4A6080;text-decoration:none;">All-Time</a></td>
              <td><span style="color:#2D3A4A;">·</span></td>
              <td><a href="${BASE_URL}/upcoming-releases.html" style="font-family:Arial,sans-serif;font-size:10px;color:#4A6080;text-decoration:none;">Upcoming</a></td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding-top:14px;border-top:1px solid #1E3251;">
          <p style="font-family:Arial,sans-serif;font-size:10px;color:#2D3A4A;line-height:1.7;margin:0;">
            You're receiving this because you subscribed to the Boxoffy Weekly Brief at <a href="${BASE_URL}" style="color:#4A6080;">${BASE_URL}</a><br>
            <a href="{{unsubscribe_url}}" style="color:#4A6080;text-decoration:underline;">Unsubscribe</a> &nbsp;·&nbsp;
            <a href="{{preferences_url}}" style="color:#4A6080;text-decoration:underline;">Manage preferences</a> &nbsp;·&nbsp;
            <a href="${BASE_URL}/privacy.html" style="color:#4A6080;text-decoration:underline;">Privacy policy</a><br>
            © 2026 Boxoffy.com · India Box Office Intelligence
          </p>
        </td>
      </tr>
    </table>
  </td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Main handler ─────────────────────────────────────────────────
export default async function handler(req, res) {
  // Security: block manual calls without the cron secret
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const week = commentaryRaw[0];

    // Running films sorted by weeklyCollection, top 6
    const running = (filmsRaw['2026'] || [])
      .filter(f => f.status === 'Running' && f.weeklyCollection)
      .sort((a, b) => (parseFloat(b.weeklyCollection) || 0) - (parseFloat(a.weeklyCollection) || 0))
      .slice(0, 6);

    // Top 4 articles from editorials.json
    const articles = editorialsRaw.slice(0, 4);

    // Upcoming films with posters (max 2 for email layout)
    const upcoming = (filmsRaw['2026'] || [])
      .filter(f => f.status === 'Upcoming' && f.posterUrl)
      .slice(0, 2);

    const html = buildDigestHtml({ week, chart: running, articles, upcoming });

    const subject = `Boxoffy Brief · ${week.weekNum} · ${week.dateRange}`;

    // Send via Resend broadcast API
    const response = await fetch('https://api.resend.com/broadcasts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audience_id: AUDIENCE_ID,
        from: FROM,
        reply_to: REPLY_TO,
        subject,
        html,
        name: `Boxoffy Brief · ${week.weekNum}`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return res.status(500).json({ error: 'Resend API failed', detail: data });
    }

    // Auto-send the broadcast (Resend creates then sends in one step via broadcasts/send)
    const broadcastId = data.id;
    const sendResponse = await fetch(`https://api.resend.com/broadcasts/${broadcastId}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const sendData = await sendResponse.json();

    console.log(`✅ Digest sent: ${subject} | Broadcast ID: ${broadcastId}`);
    return res.status(200).json({
      success: true,
      subject,
      broadcastId,
      weekNum: week.weekNum,
      films: running.length,
      articles: articles.length,
    });

  } catch (err) {
    console.error('send-digest error:', err);
    return res.status(500).json({ error: err.message });
  }
}
