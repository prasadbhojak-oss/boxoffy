// Vercel Edge Function — api/summarise.js
// Place at: C:\Users\palla\boxoffy\api\summarise.js

export const config = { runtime: 'edge' };

const ARTICLE_CONTEXT = `Dangal (2016), directed by Nitesh Tiwari, starring Aamir Khan. China run: Rs 1,235 crore ($196.89M) over 70 days. 4.31 crore tickets sold, tracked by Maoyan (China's BookMyShow, 60% market share). Douban rating 9.8/10 from 1.2 million users. Film held No.1 for 16 consecutive days. Day 9: 30.99 lakh admissions, 5.66x opening day, pure word-of-mouth. Day 16 (3rd Saturday): 36.47 lakh, bigger than opening weekend. Chinese government granted rare extension beyond 30-day window. Xi Jinping told PM Modi at SCO Summit (June 2017) he watched and loved Dangal, confirmed by Foreign Secretary Jaishankar on record. Xi mentioned it again at Mamallapuram (October 2019). China Ambassador: Xi watched it multiple times. Money laundering arithmetically impossible: 25% revenue share means faking Rs 1,235 Cr gross requires spending Rs 4,940 Cr real cash, receiving Rs 309 Cr back, losing Rs 4,631 Cr — 92% loss rate vs normal 20-40%. India: released 45 days post-demonetisation, industry down 60%. Tax-free across Hindi belt. Corporate and NGO block bookings drove weekday hold. BookMyShow fastest-ever 1 million advance tickets. 3.7 crore domestic footfalls. At today's ATP Rs 225 = Rs 832-888 Cr India nett vs actual Rs 387 Cr. Dangal released 109 days after Jio launch — before affordable data, without Reels or Shorts. Revenue: China Rs 309 Cr + India Rs 165 Cr + ROW Rs 74 Cr = Rs 548 Cr total on Rs 70 Cr budget. 683% ROI. Worldwide Rs 2,059 Cr — all-time highest-grossing Indian film.`;

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = ['https://boxoffy.com', 'https://www.boxoffy.com'];
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0];

  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  // ── Server-side analytics log (visible in Vercel Functions logs) ──
  const ts = new Date().toISOString();
  const country = req.headers.get('x-vercel-ip-country') || 'unknown';
  const city    = req.headers.get('x-vercel-ip-city')    || 'unknown';
  const ref     = req.headers.get('referer')             || 'direct';

  console.log(JSON.stringify({
    event:   'claude_summary_request',
    time:    ts,
    country,
    city,
    referer: ref,
  }));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(JSON.stringify({ event: 'claude_summary_error', reason: 'missing_api_key', time: ts }));
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20251022',
        max_tokens: 600,
        system: 'You are a concise editorial summariser for Boxoffy, an Indian box office intelligence site. Summarise the provided article in 5 punchy bullet points, each one sentence. Start each bullet with a dash and a space. Focus on the most surprising or data-backed claims. Plain English. No intro, no outro. Just the bullets.',
        messages: [{
          role: 'user',
          content: 'Summarise this article for a reader who has not read it:\n\n' + ARTICLE_CONTEXT
        }]
      })
    });

    const data = await upstream.json();

    if (data.error) {
      console.error(JSON.stringify({ event: 'claude_summary_error', reason: data.error.message, time: ts }));
    } else {
      console.log(JSON.stringify({
        event:        'claude_summary_success',
        time:         ts,
        input_tokens: data.usage?.input_tokens,
        output_tokens: data.usage?.output_tokens,
        country,
      }));
    }

    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }
    });

  } catch (err) {
    console.error(JSON.stringify({ event: 'claude_summary_error', reason: err.message, time: ts }));
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
