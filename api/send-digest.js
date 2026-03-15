// api/send-digest.js — Vercel Serverless Function
// Runs on cron: every Friday at 12:30 UTC (6PM IST)
// Fetches all Resend contacts and sends the weekly Boxoffy Brief

export default async function handler(req, res) {

  // Allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_API_KEY    = process.env.RESEND_API_KEY;
  const RESEND_AUDIENCE_ID = '6fc2744e-1719-4693-91a9-770d9e0eea36';
  const FROM_EMAIL        = process.env.DIGEST_FROM_EMAIL || 'digest@boxoffy.com';
  const REPLY_TO          = 'info@boxoffy.com';

  try {
    // ── Step 1: Get all subscribers ──────────────────────────────
    const contactsRes = await fetch(
      `https://api.resend.com/audiences/${RESEND_AUDIENCE_ID}/contacts`,
      { headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` } }
    );
    const contactsData = await contactsRes.json();
    const contacts = (contactsData.data || []).filter(c => !c.unsubscribed);

    if (!contacts.length) {
      return res.status(200).json({ message: 'No subscribers yet', sent: 0 });
    }

    // ── Step 2: Build email HTML ──────────────────────────────────
    const weekNum   = getWeekNumber();
    const dateStr   = getDateString();
    const html      = buildEmailHtml(weekNum, dateStr);
    const subject   = `Boxoffy Brief · Week ${weekNum} · ${dateStr}`;

    // ── Step 3: Send to each subscriber ──────────────────────────
    // Resend free plan: send individually (no bulk endpoint on free)
    let sent = 0;
    const errors = [];

    for (const contact of contacts) {
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
            html: html.replace('{{FIRST_NAME}}', contact.first_name || 'there'),
          }),
        });
        if (sendRes.ok) sent++;
        else {
          const err = await sendRes.json();
          errors.push({ email: contact.email, error: err.message });
        }
      } catch (e) {
        errors.push({ email: contact.email, error: e.message });
      }
    }

    return res.status(200).json({
      success: true,
      sent,
      total: contacts.length,
      errors: errors.length ? errors : undefined,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ── Helpers ────────────────────────────────────────────────────

function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

function getDateString() {
  return new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ── Email HTML Builder ─────────────────────────────────────────
// Edit the sections below each week to update content
// Or connect to films.json via dynamic import in a future version

function buildEmailHtml(weekNum, dateStr) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boxoffy Brief · Week ${weekNum}</title>
</head>
<body style="margin:0;padding:0;background:#F0EBE1;font-family:'Helvetica Neue',Arial,sans-serif;">

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EBE1;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:#0D0D0D;padding:24px 32px;border-bottom:3px solid #C8201A;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-weight:900;font-size:26px;color:#fff;letter-spacing:-0.02em;">
              BOXOF<span style="color:#C8201A;">FY</span>
            </div>
            <div style="font-size:10px;color:#6B7280;letter-spacing:0.18em;text-transform:uppercase;margin-top:3px;">
              India Box Office Intelligence
            </div>
          </td>
          <td align="right">
            <div style="font-size:10px;color:#6B7280;letter-spacing:0.1em;text-transform:uppercase;">
              THE BRIEF
            </div>
            <div style="font-size:11px;color:#9CA3AF;margin-top:2px;">
              Week ${weekNum} · ${dateStr}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td style="background:#fff;padding:28px 32px 20px;border-bottom:1px solid #E5E0D8;">
      <p style="margin:0;font-size:15px;color:#0D0D0D;line-height:1.6;">
        Hey {{FIRST_NAME}},
      </p>
      <p style="margin:10px 0 0;font-size:14px;color:#4B5563;line-height:1.7;">
        Here's your weekly box office intelligence from Boxoffy. No spin, no PR fluff — just the numbers and what they mean.
      </p>
    </td>
  </tr>

  <!-- Section 1: Weekly India Chart -->
  <tr>
    <td style="background:#fff;padding:24px 32px 8px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#C8201A;margin-bottom:12px;">
        ₹ India Box Office · Week ${weekNum}
      </div>
      <div style="font-size:17px;font-weight:700;color:#0D0D0D;margin-bottom:16px;line-height:1.2;">
        This Week's Top 5
      </div>

      <!-- Film rows — UPDATE THESE WEEKLY -->
      ${buildChartRow(1, 'Dhurandhar 2: The Revenge', '₹87 Cr', 'Day 1 · All-Time Hindi Record', '#B8860B')}
      ${buildChartRow(2, 'Border 2', '₹12 Cr', 'Week 8 · OTT: Netflix Mar 20', '#15803D')}
      ${buildChartRow(3, 'Chhaava', '₹3.2 Cr', 'Week 5 · Closing run', '#6B7280')}
      ${buildChartRow(4, 'Sky Force', '₹1.1 Cr', 'Week 9 · Long tail', '#6B7280')}
      ${buildChartRow(5, 'Avatar: Fire & Ash', '₹1.5 Cr', 'Week 10 · Hollywood', '#3B82F6')}

      <p style="margin:12px 0 0;font-size:11px;color:#9CA3AF;">
        Source: Sacnilk · Box Office India · Boxoffy Verified
      </p>
    </td>
  </tr>

  <!-- Divider -->
  <tr><td style="background:#fff;padding:0 32px;"><div style="height:1px;background:#E5E0D8;margin:16px 0;"></div></td></tr>

  <!-- Section 2: OTT This Week -->
  <tr>
    <td style="background:#fff;padding:8px 32px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#7C3AED;margin-bottom:12px;">
        📺 OTT Arrivals This Week
      </div>
      <div style="font-size:17px;font-weight:700;color:#0D0D0D;margin-bottom:16px;">
        What Landed on Streaming
      </div>

      <!-- UPDATE THESE WEEKLY -->
      ${buildOttRow('Border 2', 'Netflix', 'Mar 20', '₹424 Cr India net · Super Hit · Sunny Deol')}
      ${buildOttRow('Mardaani 3', 'Netflix', 'Mar 27', 'Rani Mukerji returns · Crime thriller')}
      ${buildOttRow('Dhurandhar 2', 'JioHotstar', 'May/Jun est.', '₹130 Cr deal · 8-week theatrical window')}
    </td>
  </tr>

  <!-- Divider -->
  <tr><td style="background:#fff;padding:0 32px;"><div style="height:1px;background:#E5E0D8;margin:16px 0;"></div></td></tr>

  <!-- Section 3: Boxoffy Bold Call -->
  <tr>
    <td style="background:#0D0D0D;padding:28px 32px;border-left:4px solid #E8C547;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#E8C547;margin-bottom:10px;">
        🎯 Boxoffy Bold Call · Week ${weekNum}
      </div>
      <div style="font-size:18px;font-weight:700;color:#fff;line-height:1.35;margin-bottom:12px;">
        <!-- UPDATE THIS WEEKLY -->
        Dhurandhar 2 will cross ₹500 Cr India net by Day 10
      </div>
      <p style="margin:0;font-size:13px;color:#9CA3AF;line-height:1.7;">
        <!-- UPDATE THIS WEEKLY -->
        Based on Day 1 of ₹87 Cr, the advance booking trajectory, and D1's week-by-week drop pattern — we're calling ₹500 Cr by Day 10. The film needs to average ₹41.3 Cr/day from Day 2 onwards. With the Holi weekend in play, that's conservative.
      </p>
      <div style="margin-top:16px;">
        <a href="https://boxoffy.com/dhurandhar-2-box-office.html"
           style="display:inline-block;background:#C8201A;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:10px 20px;">
          Track Live →
        </a>
      </div>
    </td>
  </tr>

  <!-- Section 4: Coming Next Week -->
  <tr>
    <td style="background:#fff;padding:24px 32px 8px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#1D4ED8;margin-bottom:12px;">
        📅 Coming Next Week
      </div>
      <div style="font-size:17px;font-weight:700;color:#0D0D0D;margin-bottom:16px;">
        On Boxoffy's Radar
      </div>

      <!-- UPDATE THESE WEEKLY -->
      ${buildUpcomingRow('Bhooth Bangla', 'Apr 10', 'Akshay Kumar · Priyadarshan · ₹120 Cr budget')}
      ${buildUpcomingRow('D2 Week 2 Update', 'Mar 22', 'Holi weekend collections — crucial hold test')}
      ${buildUpcomingRow('Border 2 Netflix numbers', 'Mar 27', 'Week 1 streaming debut — watching closely')}
    </td>
  </tr>

  <!-- Divider -->
  <tr><td style="background:#fff;padding:0 32px 16px;"><div style="height:1px;background:#E5E0D8;margin:8px 0 0;"></div></td></tr>

  <!-- CTA -->
  <tr>
    <td style="background:#fff;padding:16px 32px 28px;text-align:center;">
      <a href="https://boxoffy.com"
         style="display:inline-block;background:#0D0D0D;color:#fff;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-bottom:3px solid #C8201A;">
        Open Live Dashboard →
      </a>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#0D0D0D;padding:20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:10px;color:#4B5563;line-height:1.7;">
              You're receiving this because you subscribed at boxoffy.com.<br>
              No ads. No PR fluff. Just the numbers.
            </div>
          </td>
          <td align="right" style="vertical-align:top;">
            <a href="https://boxoffy.com/unsubscribe?email={{EMAIL}}"
               style="font-size:10px;color:#6B7280;text-decoration:underline;">
              Unsubscribe
            </a>
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

// ── Row builders ───────────────────────────────────────────────

function buildChartRow(rank, title, collection, note, color = '#0D0D0D') {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
    <tr>
      <td width="28" style="vertical-align:middle;">
        <div style="font-size:18px;font-weight:900;color:#D4C9B4;font-family:'Helvetica Neue',Arial,sans-serif;">${rank}</div>
      </td>
      <td style="vertical-align:middle;padding-left:10px;">
        <div style="font-size:14px;font-weight:700;color:#0D0D0D;">${title}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px;">${note}</div>
      </td>
      <td align="right" style="vertical-align:middle;">
        <div style="font-size:16px;font-weight:900;color:${color};font-family:'Helvetica Neue',Arial,sans-serif;">${collection}</div>
      </td>
    </tr>
  </table>`;
}

function buildOttRow(title, platform, date, note) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-left:3px solid #7C3AED;padding-left:12px;">
    <tr>
      <td>
        <div style="font-size:13px;font-weight:700;color:#0D0D0D;">${title} <span style="font-size:10px;font-weight:700;color:#7C3AED;background:#F3F0FF;padding:2px 7px;margin-left:6px;">${platform}</span></div>
        <div style="font-size:11px;color:#6B7280;margin-top:3px;">${date} · ${note}</div>
      </td>
    </tr>
  </table>`;
}

function buildUpcomingRow(title, date, note) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
    <tr>
      <td width="70" style="vertical-align:top;">
        <div style="font-size:10px;font-weight:700;color:#1D4ED8;letter-spacing:0.06em;text-transform:uppercase;background:#EFF6FF;padding:3px 8px;text-align:center;">${date}</div>
      </td>
      <td style="padding-left:12px;vertical-align:top;">
        <div style="font-size:13px;font-weight:700;color:#0D0D0D;">${title}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px;">${note}</div>
      </td>
    </tr>
  </table>`;
}
