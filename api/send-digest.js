// api/send-digest.js — Boxoffy Weekly Brief
// Cron: every Friday 12:30 UTC (6PM IST)
// Pulls live data from src/data/ JSON files — no hardcoded content

import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_API_KEY     = process.env.RESEND_API_KEY;
  const RESEND_AUDIENCE_ID = '6fc2744e-1719-4693-91a9-770d9e0eea36';
  const FROM_EMAIL         = process.env.DIGEST_FROM_EMAIL || 'info@boxoffy.com';
  const REPLY_TO           = 'info@boxoffy.com';

  try {
    // ── Load live data from JSON files ─────────────────────────
    const weekly    = JSON.parse(readFileSync(path.join(__dirname, '../src/data/weekly-commentary.json'), 'utf8'));
    const articles  = JSON.parse(readFileSync(path.join(__dirname, '../src/data/articles.json'), 'utf8'));
    const editorials = JSON.parse(readFileSync(path.join(__dirname, '../src/data/editorials.json'), 'utf8'));
    const films     = JSON.parse(readFileSync(path.join(__dirname, '../src/data/films.json'), 'utf8'));

    const latestWeek  = weekly[0];
    const ottArticles = (articles.OTT || []).filter(a => a.hot).slice(0, 3);
    const editorial   = editorials[0];

    // Get upcoming films from films data
    const allFilms    = Object.values(films).flat();
    // Filter upcoming: status Upcoming + release date is in the future
    const today = new Date();
    const upcoming = allFilms
      .filter(f => {
        if (f.status !== 'Upcoming') return false;
        // Try to parse release date — skip if unparseable or in the past
        const rd = (f.releaseDate || '').replace('(expected)', '').trim();
        const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
        const yearM = rd.match(/\d{4}/);
        const monM  = rd.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
        const dayM  = rd.match(/^(\d{1,2})\s/);
        if (!yearM) return true; // keep if no year parseable
        const year = parseInt(yearM[1]);
        const mon  = monM ? months[monM[1]] : 0;
        const day  = dayM ? parseInt(dayM[1]) : 1;
        const releaseDate = new Date(year, mon, day);
        return releaseDate > today;
      })
      .sort((a, b) => {
        // Sort by soonest first
        const parseDate = rd => {
          const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
          const yearM = (rd||'').match(/\d{4}/);
          const monM  = (rd||'').toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
          if (!yearM) return new Date(9999,0,1);
          return new Date(parseInt(yearM[1]), monM ? months[monM[1]] : 0, 1);
        };
        return parseDate(a.releaseDate) - parseDate(b.releaseDate);
      })
      .slice(0, 3);

    // ── Get all subscribers ─────────────────────────────────────
    const contactsRes = await fetch(
      `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
      { headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` } }
    );
    const contactsData = await contactsRes.json();
    const contacts = (contactsData.data || []).filter(c => !c.unsubscribed);

    if (!contacts.length) {
      return res.status(200).json({ message: 'No subscribers yet', sent: 0 });
    }

    // ── Build subject and email ─────────────────────────────────
    const subject = `Boxoffy Brief · ${latestWeek.weekNum} · ${latestWeek.dateRange}`;
    const baseHtml = buildEmailHtml(latestWeek, ottArticles, editorial, upcoming);

    // ── Send to each subscriber ─────────────────────────────────
    let sent = 0;
    const errors = [];

    for (const contact of contacts) {
      const html = baseHtml
        .replace(/\{\{FIRST_NAME\}\}/g, contact.first_name || 'there')
        .replace(/\{\{EMAIL\}\}/g, encodeURIComponent(contact.email));

      try {
        const sendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `Boxoffy Brief <${FROM_EMAIL}>`,
            to: contact.email,
            reply_to: REPLY_TO,
            subject,
            html,
          }),
        });

        if (sendRes.ok) {
          sent++;
        } else {
          const err = await sendRes.json();
          errors.push({ email: contact.email, error: err.message });
        }
      } catch (e) {
        errors.push({ email: contact.email, error: e.message });
      }

      // Rate limit: 600ms between sends (Resend: 2 req/sec max)
      await new Promise(r => setTimeout(r, 600));
    }

    return res.status(200).json({
      success: true,
      sent,
      total: contacts.length,
      week: latestWeek.weekNum,
      errors: errors.length ? errors : undefined,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.slice(0, 200) });
  }
}

// ── Email HTML ─────────────────────────────────────────────────
function buildEmailHtml(week, ottArticles, editorial, upcoming) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boxoffy Brief · ${esc(week.weekNum)}</title>
</head>
<body style="margin:0;padding:0;background:#F0EBE1;font-family:'Helvetica Neue',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EBE1;padding:24px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr>
    <td style="background:#0D0D0D;padding:24px 32px;border-bottom:3px solid #C8201A;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="font-weight:900;font-size:28px;color:#fff;letter-spacing:-0.02em;">
            BOXOF<span style="color:#C8201A;">FY</span>
          </div>
          <div style="font-size:9px;color:#6B7280;letter-spacing:0.2em;text-transform:uppercase;margin-top:3px;">
            India Box Office Intelligence
          </div>
        </td>
        <td align="right">
          <div style="font-size:9px;color:#6B7280;letter-spacing:0.16em;text-transform:uppercase;">The Brief</div>
          <div style="font-size:12px;color:#9CA3AF;margin-top:3px;">${esc(week.weekNum)} · ${esc(week.dateRange)}</div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- GREETING -->
  <tr>
    <td style="background:#fff;padding:28px 32px 20px;border-bottom:1px solid #E5E0D8;">
      <p style="margin:0;font-size:15px;color:#0D0D0D;line-height:1.6;">Hey {{FIRST_NAME}},</p>
      <p style="margin:10px 0 0;font-size:13px;color:#4B5563;line-height:1.7;">
        Your weekly box office intelligence from Boxoffy. Verified numbers, no spin, no PR fluff.
      </p>
    </td>
  </tr>

  <!-- SECTION 1: WEEKLY TAKE -->
  <tr>
    <td style="background:#0D0D0D;padding:28px 32px;border-left:4px solid #E8C547;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#E8C547;margin-bottom:10px;">
        📰 This Week's Story
      </div>
      <div style="font-size:18px;font-weight:700;color:#fff;line-height:1.35;margin-bottom:12px;">
        ${esc(week.headline)}
      </div>
      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.7;">
        ${esc(week.subline)}
      </p>
      ${week.interval_take ? `
      <p style="margin:14px 0 0;font-size:13px;color:#9CA3AF;line-height:1.7;border-top:1px solid #1F2937;padding-top:14px;">
        ${esc(truncateAtSentence(week.interval_take, 400))}
      </p>` : ''}
    </td>
  </tr>

  <!-- SECTION 2: WEEKLY CHART -->
  <tr>
    <td style="background:#fff;padding:24px 32px 16px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#C8201A;margin-bottom:12px;">
        ₹ India Box Office · ${esc(week.weekNum)}
      </div>
      <div style="font-size:17px;font-weight:700;color:#0D0D0D;margin-bottom:18px;">Weekly Chart</div>

      ${(week.scoreboard || []).slice(0, 5).map((entry, i) => {
        const vBg = verdictBadgeColor(entry.verdict || entry.film);
        const slug = slugify(entry.film);
        return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-bottom:1px solid #F0EBE1;padding-bottom:12px;">
        <tr>
          <td width="44" style="vertical-align:top;padding-top:2px;">
            <div style="background:${vBg};color:#fff;font-size:16px;font-weight:900;width:36px;height:36px;display:table-cell;text-align:center;vertical-align:middle;border-radius:2px;">${i + 1}</div>
          </td>
          <td style="vertical-align:top;padding-left:10px;">
            <a href="https://boxoffy.com/${slug}-box-office.html" style="text-decoration:none;">
              <div style="font-size:14px;font-weight:700;color:#0D0D0D;">${esc(entry.film)}</div>
            </a>
            <div style="font-size:11px;color:#6B7280;margin-top:2px;">${esc(truncateAtSentence(entry.verdict || entry.week || '', 80))}</div>
          </td>
          <td align="right" style="vertical-align:top;white-space:nowrap;">
            <div style="font-size:16px;font-weight:900;color:${entry.color || '#0D0D0D'};">${esc(entry.wkCollection || '—')}</div>
            <div style="font-size:10px;color:#9CA3AF;margin-top:2px;">${esc(entry.total ? entry.total.slice(0, 45) : '')}</div>
          </td>
        </tr>
      </table>`;
      }).join('')}

      <div style="margin-top:8px;text-align:center;">
        <a href="https://boxoffy.com"
           style="display:inline-block;background:#0D0D0D;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:10px 24px;border-bottom:2px solid #C8201A;">
          View Full Dashboard →
        </a>
      </div>
    </td>
  </tr>

  <!-- SECTION 3: OTT THIS WEEK -->
  ${ottArticles.length ? `
  <tr>
    <td style="background:#F8F5F0;padding:24px 32px 16px;border-top:1px solid #E5E0D8;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#7C3AED;margin-bottom:12px;">
        📺 OTT This Week
      </div>
      <div style="font-size:17px;font-weight:700;color:#0D0D0D;margin-bottom:18px;">What Just Landed on Streaming</div>

      ${ottArticles.map(article => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
        <tr>
          <td style="border-left:3px solid #7C3AED;padding-left:14px;">
            <div style="font-size:13px;font-weight:700;color:#0D0D0D;line-height:1.4;">
              ${esc(article.headline)}
            </div>
            <div style="font-size:11px;color:#6B7280;margin-top:4px;line-height:1.5;">
              ${esc((article.summary || '').slice(0, 120))}${(article.summary || '').length > 120 ? '...' : ''}
            </div>
            ${article.url ? `
            <div style="margin-top:6px;">
              <a href="${esc(article.url)}" style="font-size:10px;color:#7C3AED;text-decoration:none;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
                Read More →
              </a>
            </div>` : ''}
          </td>
        </tr>
      </table>`).join('')}
    </td>
  </tr>` : ''}

  <!-- SECTION 4: FEATURED EDITORIAL -->
  ${editorial ? `
  <tr>
    <td style="background:#fff;padding:24px 32px;border-top:1px solid #E5E0D8;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#B8860B;margin-bottom:12px;">
        ✍️ From The Desk
      </div>
      <div style="font-size:16px;font-weight:700;color:#0D0D0D;line-height:1.4;margin-bottom:8px;">
        ${esc(editorial.headline || '')}
      </div>
      ${editorial.dek ? `<p style="margin:0 0 14px;font-size:13px;color:#4B5563;line-height:1.7;font-style:italic;">${esc(editorial.dek)}</p>` : ''}
      ${editorial.url ? `
      <a href="https://boxoffy.com/${esc(editorial.url)}"
         style="display:inline-block;background:#B8860B;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:9px 20px;">
        Read Full Analysis →
      </a>` : ''}
    </td>
  </tr>` : ''}

  <!-- SECTION 5: COMING NEXT WEEK -->
  ${week.nextWeek ? `
  <tr>
    <td style="background:#F8F5F0;padding:24px 32px;border-top:1px solid #E5E0D8;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#1D4ED8;margin-bottom:12px;">
        📅 On Boxoffy's Radar
      </div>
      <div style="font-size:17px;font-weight:700;color:#0D0D0D;margin-bottom:12px;">Coming Next Week</div>
      <p style="margin:0 0 16px;font-size:13px;color:#4B5563;line-height:1.7;">${esc(week.nextWeek)}</p>
      ${upcoming.length ? upcoming.map(f => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
        <tr>
          <td width="90" style="vertical-align:top;">
            <div style="font-size:9px;font-weight:700;color:#1D4ED8;letter-spacing:0.06em;text-transform:uppercase;background:#EFF6FF;padding:3px 8px;text-align:center;">
              ${esc(f.releaseDate)}
            </div>
          </td>
          <td style="padding-left:12px;vertical-align:top;">
            <div style="font-size:13px;font-weight:700;color:#0D0D0D;">${esc(f.title)}</div>
            <div style="font-size:11px;color:#6B7280;margin-top:2px;">${esc(f.language)} · Dir. ${esc(f.director)} · Budget: ${esc(f.budget)}</div>
          </td>
        </tr>
      </table>`).join('') : ''}
    </td>
  </tr>` : ''}

  <!-- MAIN CTA -->
  <tr>
    <td style="background:#C8201A;padding:24px 32px;text-align:center;">
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-bottom:12px;">
        Live box office data, updated daily
      </div>
      <a href="https://boxoffy.com"
         style="display:inline-block;background:#fff;color:#C8201A;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:14px 36px;">
        Open Boxoffy Live Dashboard →
      </a>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#0D0D0D;padding:20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="font-size:10px;color:#4B5563;line-height:1.8;">
            You subscribed at <a href="https://boxoffy.com" style="color:#C8201A;text-decoration:none;">boxoffy.com</a><br>
            No ads. No spin. Just the numbers that matter.
          </div>
        </td>
        <td align="right" style="vertical-align:top;">
          <a href="https://boxoffy.com/unsubscribe?email={{EMAIL}}"
             style="font-size:10px;color:#4B5563;text-decoration:underline;">
            Unsubscribe
          </a>
        </td>
      </tr></table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateAtSentence(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  const cut = str.slice(0, maxLen);
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return lastDot > maxLen * 0.5 ? cut.slice(0, lastDot + 1) : cut + '...';
}

function verdictBadgeColor(verdictOrFilm) {
  const v = (verdictOrFilm || '').toLowerCase();
  if (v.includes('all-time blockbuster')) return '#B8860B';
  if (v.includes('blockbuster'))          return '#15803D';
  if (v.includes('super hit'))            return '#16A34A';
  if (v.includes('hit'))                  return '#16A34A';
  if (v.includes('average'))              return '#D97706';
  if (v.includes('flop'))                 return '#C8201A';
  if (v.includes('disaster'))             return '#991B1B';
  return '#6B7280';
}

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}
