// api/send-digest-test.js
// Sends or previews the Boxoffy weekly digest
// Uses https module (works on Node 14/16/18) + inlined data (no filesystem deps)
//
// PREVIEW in browser: https://boxoffy.com/api/send-digest-test?secret=CRON_SECRET&preview=1
// SEND to inbox:      https://boxoffy.com/api/send-digest-test?secret=CRON_SECRET&email=prasadbhojak@gmail.com

var https = require('https');

var BASE_URL = 'https://boxoffy.com';

// ── Inlined data (updated each deploy) ─────────────────────────
var WEEK = {"weekNum": "Week 13", "dateRange": "Mar 19–22, 2026", "headline": "Dhurandhar: The Revenge Stands Alone. ₹397 Crore in 4 Days.", "subline": "Three separate ₹100 Cr+ days in a single opening weekend. D1 ₹102.55 Cr · D3 Eid Sat ₹113 Cr · D4 Sunday ₹102 Cr. 4-day India nett ₹397 Cr · WW ₹675 Cr · NA $13.5M record. UBS ₹66 Cr — FLOP. Thaai Kizhavi ₹55 Cr on ₹9 Cr budget — SUPER HIT. KS2 closes at ₹50 Cr.", "status": "published", "scoreboard": [{"film": "Dhurandhar: The Revenge", "week": "Week 1 (D0–D4)", "collection": "₹397 Cr nett", "verdict": "BLOCKBUSTER"}, {"film": "Ustaad Bhagat Singh", "week": "Week 1", "collection": "₹66.2 Cr nett", "verdict": "FLOP"}, {"film": "Thaai Kizhavi", "week": "Week 4", "collection": "~₹55 Cr nett (total)", "verdict": "SUPER HIT"}, {"film": "The Kerala Story 2", "week": "Week 4", "collection": "~₹50.5 Cr nett (total)", "verdict": "PLUS — closing"}], "sources": [{"name": "Sacnilk", "quote": "D0–D3 India nett confirmed: ₹43 + ₹102.55 + ₹80.72 + ₹113 = ₹339.27 Cr", "analysis": "Sacnilk day-wise tracking across all languages. D0 preview, D1 Thu, D2 Fri, D3 Eid Sat — all language combined nett.", "color": "#2563EB"}, {"name": "Pinkvilla", "quote": "4-day India nett ₹397 Cr · WW ₹675 Cr · D4 Sunday ₹~102 Cr", "analysis": "Pinkvilla Sunday wrap report confirmed 4-day India nett at ₹397 Cr and worldwide gross at ₹675 Cr including overseas of ₹199 Cr.", "color": "#DB2777"}, {"name": "Deadline / Variety", "quote": "D2 North America: $9.57M weekend · $13.5M 4-day — new Indian cinema NA record", "analysis": "US figures cross-verified across Deadline, Variety and Washington Post. 987 locations. Beats Kalki 2898-AD’s $11.2M previous record.", "color": "#374151"}], "interval_take": "Dhurandhar: The Revenge has done something Hindi cinema has never seen: three days above ₹100 Cr nett in a single opening weekend. Day 1 ₹102.55 Cr broke every Bollywood opening record. Eid Saturday at ₹113 Cr was the biggest single day in Hindi film history. Sunday at ₹102 Cr meant the film held almost flat from its opening day — a sign of genuine audience pull, not front-loaded hype. The 4-day India nett of ₹397 Cr and worldwide gross of ₹675 Cr place Dhurandhar 2 in the conversation with Pushpa 2 and RRR as the defining releases of this decade. On a reported budget of ₹280–300 Cr, this film has already returned its investment inside 4 days. The North America record of $13.5M in 4 days underlines the diaspora’s hunger for this franchise globally. \n\nAcross the aisle, Ustaad Bhagat Singh is a commercial disappointment. ₹66 Cr in 4 days against a ₹105 Cr+ Telugu distribution cost alone makes recovery near-impossible. A film that needed ₹250 Cr+ to break even has collected barely a quarter of that in its opening weekend. \n\nThe real story of the week, though, is Thaai Kizhavi. ₹55 Cr on a ₹9 Cr budget is a 500%+ ROI by any measure. In a week dominated by a ₹675 Cr worldwide juggernaut, a quiet Tamil film built entirely on word-of-mouth crossed the SUPER HIT threshold and kept going. The trade will study this for years as the template for content-first regional cinema. \n\nThe Kerala Story 2 closes at ₹50 Cr — a PLUS verdict and a clean exit for a sequel that punched above its weight.", "nextWeek": "D2 Week 2 key read: the Monday hold. If Day 5 clears ₹25 Cr, a ₹600–700 Cr India nett lifetime is confirmed. Project Hail Mary arrives in India this week — premium screen competition will be the first real test for D2’s legs. UBS needs a miracle to approach break-even."};
var CHART = [{"title": "Dhurandhar: The Revenge", "language": "Hindi", "director": "Aditya Dhar", "releaseDate": "Mar 19, 2026", "totalCollection": "675 Cr", "totalNum": 397, "indiaNet": "397 Cr", "overseas": "199 Cr", "weeksInTop10": 1, "status": "Running", "budget": "300 Cr", "verdict": "—", "weeklyCollection": 397, "weekNum": 1, "daysInRelease": 4, "lastWeekRank": 0, "estimated": false, "betaModel": false, "weeklyNote": "3 days above ₹100 Cr nett in a single opening weekend — a first for Hindi cinema. Already in profit on Day 4. WW ₹675 Cr in 4 days places it alongside Pushpa 2 and RRR as the defining release of this decade.", "wkTrend": "new", "wwGross": "₹675 Cr", "note": "CONFIRMED D0-D3 (Sacnilk/Filmibeat/IndiaTV): D0 ₹43 Cr · D1 ₹102.55 Cr · D2 ₹80.72 Cr · D3 ₹113 Cr · D0-D3 total ₹339.27 Cr. D4 Sunday ~₹102 Cr nett (Pinkvilla Hindi ~₹100 Cr estimate). 4-DAY FINAL: India nett ₹397 Cr (Pinkvilla) / ₹394 Cr (BOW) — Boxoffy adopts ₹397 Cr. 4-day WW gross ₹675 Cr (Pinkvilla + BOW aligned). Overseas 4-day: $21.5M / ₹199 Cr. NOTE: BOI paywalled — direct verification not possible. Nishit Shaw (@NishitShawHere) D2 posts not found in current search window — his recent D2 results posts were not accessible. NA: $9.57M 3-day + $13.5M 4-day (Deadline/Variety confirmed). AU AUD 1M+ · CA CAD 1M+ · UK GBP 643K single day — all territory records.", "ott": {"platform": "JioHotstar", "debutViews": "TBD", "debutHours": "TBD", "lifetimeViews": "TBD", "lifetimeHours": "TBD", "globalRank": "TBD", "countries": 0, "rightsDeal": "₹150 Cr", "ottNote": "Non-theatrical package ₹245 Cr total: JioHotstar ₹150 Cr + Star Gold ₹50 Cr + T-Series ₹45 Cr"}, "pageUrl": "dhurandhar2-advance-article.html", "posterUrl": "https://image.tmdb.org/t/p/w185/ov8vrRLZGoXHpYjSY9Vpv1tHJX7.jpg", "admitsNote": "4-day India nett ₹397 Cr ✅ · WW ₹675 Cr · Pinkvilla + BOW aligned · Sacnilk D0-D3 confirmed", "betaBreakdown": {"confirmed_daywise": {"D0_nett": 43, "D1_nett": 102.55, "D2_nett": 80.72, "D3_nett": 113, "D0_D1_D2_D3_nett": 339.27, "D0_D1_D2_D3_india_gross": 400.35, "D0_D1_D2_D3_ww_gross": 550, "overseas_D0_D3": 149.65, "source": "Sacnilk / Filmibeat / IndiaTV — all confirmed"}, "D3_confirmed": {"nett": 113, "hindi": 105, "telugu": 5, "tamil": 2.95, "change": "+40%", "note": "Eid Saturday surge — Hindi 82% occupancy, Telugu 76%", "source": "Sacnilk / IndiaTV / Filmibeat"}, "D4_live": {"partial_to_730pm": 83.6, "india_nett_running": "422+ Cr", "pinkvilla_4day_all_versions": "~400 Cr nett", "pinkvilla_4day_ww_estimate": "600 Cr+", "source": "Filmibeat / Pinkvilla / One News Page"}, "NA_opening_weekend": {"thru_sat": "~$11M (Sacnilk)", "4day_estimate": "$13.5M (Sacnilk) — New Indian cinema NA record", "previous_record": "Kalki 2898 AD $11.2M", "shows_NA": "4,405", "D3_sat_advance": "$2.85M (Venky BO)", "D3_sat_US": "$2.63M (Pinkvilla)", "territory_milestones": {"Australia": "AUD 1M+ single day — new Indian cinema record", "Canada": "CAD 1M+ single day — new record", "UK": "GBP 643K Sat — beats Pathaan GBP 555K record"}}, "D4_confirmed": {"india_nett_D4": "~₹102 Cr (Pinkvilla estimate)", "4day_india_nett": "₹397 Cr (Pinkvilla Sunday wrap) / ₹394 Cr (BOW)", "4day_ww_gross": "₹675 Cr (Pinkvilla + BOW aligned)", "4day_overseas": "$21.5M / ₹199 Cr", "source_notes": "BOI paywalled. Nishit Shaw D2 posts not accessible in search. Pinkvilla + BOW adopted as primary cross-check."}}}, {"title": "Ustaad Bhagat Singh", "language": "Telugu", "director": "Harish Shankar", "cast": "Pawan Kalyan · Sreeleela · Raashii Khanna", "releaseDate": "Mar 19, 2026", "status": "Running", "verdict": "UPCOMING", "weeklyCollection": 66.2, "weekNum": 1, "totalNum": 66.2, "indiaNet": "66.2 Cr", "totalCollection": "₹65 Cr", "budget": "~₹150 Cr", "pageUrl": "ustaad-bhagat-singh-box-office.html", "lastWeekRank": 0, "openingPrediction": {"low": 35, "mid": 45, "high": 60, "note": "Pawan Kalyan power + Ugadi holiday. Clash with D2 dents potential. NA $182K advance vs D2 $4.6M. India pre-sales below The Raja Saab ₹15.31 Cr. Boxoffy central: ₹45 Cr net. They Call Him OG opened ₹140 Cr WW — UBS expected ~40% lower due to remake factor + clash.", "basis": "Koimoi · Filmibeat · Venky BO · Boxoffy Prediction Model v1"}, "note": "D1 ₹31.5 Cr nett · D2 ₹10.9 Cr nett — D2 -65% collapse (Sacnilk). D1+D2 gross: ₹51.9 Cr · 2.4 lakh footfalls (Sacnilk). Crushed by D2 wave. Budget ₹150 Cr · pre-release ₹127 Cr. NA D1: $76K (Venky BO). Verdict trajectory: FLOP. Boxoffy Week 1 call: ₹50-55 Cr nett. OTT: Prime Video est ~6 weeks · deal est ₹20-25 Cr.", "posterUrl": "https://image.tmdb.org/t/p/w185/8n4ypYQWztEXlR8JxD0fctdKwfC.jpg", "admitsNote": "4-day ₹66.2 Cr nett · FLOP · Sacnilk D4 confirmed", "daysInRelease": 3, "wkTrend": "new", "weeklyNote": "4-day India nett ₹66.2 Cr against ₹105 Cr+ AP/TG distribution cost alone. A painful commercial disappointment for a film that needed ₹250 Cr+ to break even. D2’s dominance left minimal screen space to recover.", "weeksInTop10": 1, "estimated": false, "betaModel": false}, {"title": "Thaai Kizhavi", "language": "Tamil", "director": "Sivakumar Murugesan", "releaseDate": "Feb 27, 2026", "totalCollection": "₹66 Cr", "totalNum": 54.95, "indiaNet": "54.95 Cr", "overseas": "~₹9.6 Cr", "weeksInTop10": 3, "status": "Running", "budget": "9 Cr", "verdict": "SUPER HIT", "weeklyCollection": 2.5, "weekNum": 3, "daysInRelease": 15, "lastWeekRank": 1, "weeklyNote": "500%+ ROI on a ₹9 Cr budget. Crossed SUPER HIT in Week 4 entirely on word-of-mouth while competing against a franchise blockbuster. The trade template for content-first Tamil cinema.", "wkTrend": "stable", "ott": {"platform": "TBD", "debutViews": "N/A", "debutHours": "N/A", "lifetimeViews": "N/A", "lifetimeHours": "N/A", "globalRank": "N/A", "countries": 1, "rightsDeal": "N/A", "ottNote": "Tamil comedy drama — Radhika Sarathkumar. 238% ROI in 9 days. 2nd highest-grossing Tamil film of 2026."}, "pageUrl": "thaai-kizhavi-box-office.html", "wwGross": "₹66 Cr", "note": "2nd Tamil film of 2026 to cross ₹50 Cr India. Sivakarthikeyan Productions surprise hit.", "posterUrl": "https://image.tmdb.org/t/p/w185/qbqRzqitfwAReJ3q2v9iMmpoh7k.jpg", "admitsNote": "~₹55 Cr India nett · SUPER HIT · ₹9 Cr budget · 500%+ ROI"}, {"title": "Hoppers", "language": "Hollywood", "director": "TBC", "cast": "Animated (Pixar-style)", "releaseDate": "Mar 6, 2026", "status": "Running", "verdict": "HIT", "weeklyCollection": 2.1, "weekNum": 2, "totalNum": 3.75, "indiaNet": "₹3.75 Cr", "totalCollection": "$164.7M WW", "wwGross": "$164.7M WW", "budget": "$150M", "pageUrl": "hoppers-box-office.html", "lastWeekRank": 4, "note": "Disney/Pixar animated. Film Information Week 1 India: ₹2.82 Cr reported + ₹0.93 Cr unreported = ₹3.75 Cr total.", "posterUrl": "https://image.tmdb.org/t/p/w185/xjtWQ2CL1mpmMNwuU5HeS4Iuwuu.jpg"}, {"title": "The Kerala Story 2: Goes Beyond", "language": "Hindi", "director": "Kamakhya Narayan Singh", "releaseDate": "Feb 27, 2026", "totalCollection": "₹44 Cr", "totalNum": 50.5, "indiaNet": "50.5 Cr", "overseas": "~₹1.93 Cr", "weeksInTop10": 3, "status": "Running", "budget": "28 Cr", "verdict": "AVERAGE", "weeklyCollection": 1.5, "weekNum": 4, "daysInRelease": 20, "lastWeekRank": 2, "weeklyNote": "Closes at ₹50.5 Cr India nett — a clean PLUS verdict. Recovered costs, built an audience on social media momentum, and made way for D2 without a fight. A quiet success.", "wkTrend": "new", "ott": {"platform": "ZEE5 (expected)", "debutViews": "TBD", "debutHours": "TBD", "lifetimeViews": "TBD", "lifetimeHours": "TBD", "globalRank": "TBD", "countries": 0, "rightsDeal": "~₹8 Cr (est.)", "ottNote": "Controversial sequel — released Feb 27 after HC lifted stay. Tracking towards profit on low budget."}, "pageUrl": "the-kerala-story-2-goes-beyond-box-office.html", "note": "Day 19: ₹50.03 Cr India nett crossed (Koimoi). Budget ₹28 Cr — HIT. Most profitable Bollywood film of 2026 by ROI (37%). D2 wave will clear remaining screens this weekend. Boxoffy closing call: ₹52-54 Cr India nett. OTT: Netflix expected ~Apr 15.", "posterUrl": "https://image.tmdb.org/t/p/w185/97jAFQcAnspd416cupbAbGMNT9z.jpg", "admitsNote": "~₹50.5 Cr India nett · PLUS verdict · Closing run", "estimated": false, "betaModel": false}, {"title": "Funky", "language": "Telugu", "director": "Vamshi Paidipally", "releaseDate": "Feb 13, 2026", "totalCollection": "12 Cr", "totalNum": 12, "indiaNet": "9 Cr", "overseas": "3 Cr", "weeksInTop10": 1, "status": "Running", "budget": "40 Cr", "verdict": "Flop", "note": "₹9 Cr India net in 8 days. FLOP on ₹40 Cr budget.", "weeklyCollection": 1.5, "weekNum": 1, "daysInRelease": 8, "lastWeekRank": 0, "weeklyNote": "Week 1 end: ₹9 Cr India net — tracking to FLOP. Valentine's competition from O Romeo and Hindi releases.", "ott": {"platform": "TBD (Prime/Netflix expected)", "debutViews": "TBD", "debutHours": "TBD", "lifetimeViews": "TBD", "lifetimeHours": "TBD", "globalRank": "TBD", "countries": 1, "rightsDeal": "~₹5 Cr (est.)", "ottNote": "Telugu release — poor theatrical debut."}, "pageUrl": "funky-box-office.html", "posterUrl": "https://image.tmdb.org/t/p/w185/iICU2CBNat7q9tm88SzrUFwR1hA.jpg"}];
var ARTICLES = [{"tag": "DEEP DIVE", "headline": "Why Indian Cinema Will Never Have a Number 2", "dek": "The dinner table decision, the comparison trap, and the ego economy that keeps Bollywood a winner-take-all market. A structural autopsy.", "author": "The Boxoffy Team", "date": "Mar 22, 2026", "readTime": "9 min read", "url": "why-indian-cinema-never-has-a-number-2.html", "subline": "ROI blindness · Counter-programming · Broadway hypothesis"}, {"tag": "VERDICT", "headline": "₹339 Crore in 4 Days. Dhurandhar 2 Just Rewrote Indian Cinema.", "dek": "₹43 Cr premieres. ₹102.55 Cr Day 1. Jawan's record gone. North India hadn't even fired yet. Here's what it means.", "author": "The Boxoffy Team", "date": "Mar 20, 2026", "readTime": "4 min read", "url": "dhurandhar2-advance-article.html", "subline": ""}, {"tag": "COMPARISON", "headline": "Dhurandhar vs Dhurandhar 2 — A Franchise That Doubled Itself", "dek": "D1 Day 1: ₹28 Cr. D2 Day 1: ₹102.55 Cr. Same director, same star, one year apart. Complete day-wise, week-wise and ATP breakdown.", "author": "The Boxoffy Team", "date": "Mar 19, 2026", "readTime": "5 min read", "url": "dhurandhar-box-office-d1-vs-d2.html"}, {"tag": "DATA ANALYSIS", "headline": "The ₹100 Crore Day 1 Club — Every Indian Film That Made It, and Why No Hindi Film Has", "dek": "Pushpa 2 ₹144 Cr. RRR, Baahubali 2, KGF2 — all ₹100–110 Cr. Four films. All South Indian. Zero Bollywood. Dhurandhar 2 attempts it March 19. Footfall math + ATP breakdown.", "author": "The Boxoffy Team", "date": "Mar 15, 2026", "readTime": "6 min read", "url": "100-crore-day-one-club-box-office.html"}];
var UPCOMING = [{"title": "Awarapan 2", "language": "Hindi", "director": "Mohit Suri (expected)", "releaseDate": "Apr 3, 2026", "totalCollection": "—", "totalNum": 0, "indiaNet": "—", "overseas": null, "weeksInTop10": 0, "status": "Upcoming", "budget": "TBC", "verdict": "Upcoming", "weeklyCollection": 0, "weekNum": 0, "daysInRelease": 0, "lastWeekRank": null, "weeklyNote": "Emraan Hashmi sequel to 2007 cult classic. Almost 20 years in the making.", "cast": "Emraan Hashmi", "note": "Almost 20 years in the making", "pageUrl": "awarapan-2-box-office.html", "posterUrl": "https://image.tmdb.org/t/p/w185/giSJJDEIJiAazo0gStmynBZoo4P.jpg", "studio": "T-Series Films"}, {"title": "The Paradise", "language": "Telugu", "director": "Dr Bikash Dhar", "releaseDate": "May 2026 (TBC)", "totalCollection": "—", "totalNum": 0, "indiaNet": "—", "overseas": null, "weeksInTop10": 0, "status": "Upcoming", "budget": "TBC", "verdict": "Upcoming", "weeklyCollection": 0, "weekNum": 0, "daysInRelease": 0, "lastWeekRank": null, "weeklyNote": "Nani in a period drama set in 1980s Secunderabad — marginalized tribe vs systemic oppression. Dir: Srikanth Odela (Dasara).", "cast": "Mukesh Chhabra · Triptii Dimri", "note": "Period drama set in 1960s Benaras", "pageUrl": "the-paradise-box-office.html", "posterUrl": "https://image.tmdb.org/t/p/w185/zgswkEluiy0zUgqn7YpsLvsmrfB.jpg"}];

// ── Verdict colours ─────────────────────────────────────────────
var VS = {
  'All-Time Blockbuster':['#6D28D9','#EDE9FE'],
  'Blockbuster':['#065F46','#D1FAE5'],'BLOCKBUSTER':['#065F46','#D1FAE5'],
  'Super Hit':['#065F46','#D1FAE5'],'SUPER HIT':['#065F46','#D1FAE5'],
  'Hit':['#1D4ED8','#DBEAFE'],'HIT':['#1D4ED8','#DBEAFE'],
  'Semi Hit':['#92400E','#FEF3C7'],'SEMI HIT':['#92400E','#FEF3C7'],
  'Average':['#374151','#F3F4F6'],'AVERAGE':['#374151','#F3F4F6'],
  'Flop':['#991B1B','#FEF2F2'],'FLOP':['#991B1B','#FEF2F2'],
  'Disaster':['#7F1D1D','#FEF2F2']
};
var TS = {
  'DEEP DIVE':['#0D1F35','#EEF5FF'],'VERDICT':['#991B1B','#FEF2F2'],
  'COMPARISON':['#1D4ED8','#DBEAFE'],'DATA ANALYSIS':['#065F46','#D1FAE5'],
  'US BOX OFFICE':['#1D4ED8','#DBEAFE'],'ANALYSIS':['#E8631A','#FFF0E6'],
  'PRICING ANALYSIS':['#92400E','#FEF3C7']
};

function vb(v){var s=VS[v]||['#374151','#F3F4F6'];return'<span style="display:inline-block;font-family:Arial,sans-serif;font-size:9px;font-weight:700;color:'+s[0]+';background:'+s[1]+';padding:2px 7px;border-radius:2px;">'+(v||'&mdash;')+'</span>';}

function rowL(f,rank){
  var url=f.pageUrl?BASE_URL+'/'+f.pageUrl:BASE_URL;
  var wk=f.weeklyCollection?'&#8377;'+f.weeklyCollection+' Cr':'&mdash;';
  var tot=f.indiaNet?'&#8377;'+f.indiaNet+' Cr total':'';
  var rc=rank===1?'#E8631A':'#7A92AB';
  return '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #EEF5FF;"><tr>'+
    '<td width="28" style="vertical-align:middle;padding-right:6px;"><div style="font-family:Arial,sans-serif;font-size:15px;font-weight:900;color:'+rc+';">#'+rank+'</div></td>'+
    '<td width="52" style="vertical-align:middle;padding-right:10px;"><a href="'+url+'"><img src="'+(f.posterUrl||'')+'" width="52" height="78" alt="'+f.title+'" style="display:block;border-radius:3px;border:0;object-fit:cover;" /></a></td>'+
    '<td style="vertical-align:middle;padding-right:8px;"><a href="'+url+'" style="text-decoration:none;"><div style="font-family:Georgia,serif;font-weight:700;font-size:15px;color:#0D1F35;line-height:1.2;">'+f.title+'</div></a>'+
    '<div style="font-family:Arial,sans-serif;font-size:10px;color:#7A92AB;margin-top:3px;">'+(f.language||'')+(f.weekNum?' &middot; Wk '+f.weekNum:'')+'</div>'+
    '<div style="margin-top:5px;">'+vb(f.verdict)+'</div></td>'+
    '<td align="right" style="vertical-align:middle;white-space:nowrap;"><div style="font-family:Georgia,serif;font-weight:700;font-size:20px;color:#E8631A;">'+wk+'</div>'+
    '<div style="font-family:Arial,sans-serif;font-size:9px;color:#7A92AB;margin-top:2px;">this week</div>'+
    (tot?'<div style="font-family:Arial,sans-serif;font-size:9px;color:#7A92AB;">'+tot+'</div>':'')+
    '</td></tr></table>';
}

function rowS(f,rank){
  var url=f.pageUrl?BASE_URL+'/'+f.pageUrl:BASE_URL;
  var wk=f.weeklyCollection?'&#8377;'+f.weeklyCollection+' Cr':'&mdash;';
  var vc=(VS[f.verdict]||['#6B7280'])[0];
  return '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #EEF5FF;"><tr>'+
    '<td width="28" style="vertical-align:middle;padding-right:6px;"><div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#7A92AB;">#'+rank+'</div></td>'+
    '<td width="36" style="vertical-align:middle;padding-right:8px;"><img src="'+(f.posterUrl||'')+'" width="36" height="54" alt="'+f.title+'" style="display:block;border-radius:2px;border:0;opacity:0.75;object-fit:cover;" /></td>'+
    '<td style="vertical-align:middle;"><a href="'+url+'" style="text-decoration:none;"><div style="font-family:Arial,sans-serif;font-weight:700;font-size:12px;color:#0D1F35;">'+f.title+' <span style="font-weight:400;color:#7A92AB;">('+f.language+(f.weekNum?' &middot; Wk '+f.weekNum:'')+')</span></div></a></td>'+
    '<td align="right" style="vertical-align:middle;white-space:nowrap;"><div style="font-family:Arial,sans-serif;font-weight:700;font-size:13px;color:'+vc+';">'+wk+'</div><div style="font-family:Arial,sans-serif;font-size:8px;color:#7A92AB;">'+(f.verdict||'')+'</div></td>'+
    '</tr></table>';
}

function artCard(a,featured){
  var url=a.url?BASE_URL+'/'+a.url:BASE_URL;
  var ts=TS[a.tag]||['#374151','#F3F4F6'];
  var tc=ts[0],tbg=ts[1];
  var dek=(a.dek||'').slice(0,130)+((a.dek||'').length>130?'&hellip;':'');
  var tl=featured?a.tag+' &middot; NEW':a.tag;
  return '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;border:1px solid #D6E4F0;border-left:'+(featured?4:3)+'px solid '+tc+';border-radius:0 4px 4px 0;background:'+(featured?'#FDFBFF':'#fff')+';"><tr>'+
    '<td style="padding:'+(featured?'16px 16px 16px 18px':'14px 14px 14px 16px')+';">'+
    '<div style="font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:'+tc+';background:'+tbg+';padding:2px 7px;border-radius:2px;display:inline-block;margin-bottom:7px;">'+tl+'</div>'+
    '<a href="'+url+'" style="text-decoration:none;"><div style="font-family:Georgia,serif;font-weight:700;font-size:'+(featured?17:15)+'px;color:#0D1F35;line-height:1.3;margin-bottom:'+(featured?8:6)+'px;">'+a.headline+'</div></a>'+
    '<p style="font-family:Arial,sans-serif;font-size:'+(featured?12:11)+'px;color:#4A6080;line-height:1.65;margin:0 0 '+(featured?12:10)+'px;">'+dek+'</p>'+
    '<table cellpadding="0" cellspacing="0" border="0"><tr>'+
    '<td style="padding-right:14px;"><span style="font-family:Arial,sans-serif;font-size:10px;color:#7A92AB;">'+(a.date||'')+' &middot; '+(a.readTime||'')+'</span></td>'+
    '<td><a href="'+url+'" style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;color:'+tc+';text-decoration:none;">Read &rarr;</a></td>'+
    '</tr></table></td></tr></table>';
}

function buildHtml(firstName){
  var w=WEEK,hero=CHART[0]||{};
  var rows3=CHART.slice(0,3).map(function(f,i){return rowL(f,i+1);}).join('');
  var rows3s=CHART.slice(3,6).map(function(f,i){return rowS(f,i+4);}).join('');
  var arts=ARTICLES.map(function(a,i){return artCard(a,i===0);}).join('');
  var ups=UPCOMING.map(function(f){
    var url=f.pageUrl?BASE_URL+'/'+f.pageUrl:BASE_URL+'/upcoming-releases.html';
    return '<td style="vertical-align:top;padding:0 6px;width:40%;">'+
      '<a href="'+url+'" style="text-decoration:none;">'+
      '<img src="'+f.posterUrl+'" width="152" height="90" alt="'+f.title+'" style="display:block;border-radius:4px;border:0;object-fit:cover;object-position:top;margin-bottom:8px;width:100%;max-width:152px;" />'+
      '<div style="font-family:Georgia,serif;font-weight:700;font-size:13px;color:#0D1F35;margin-bottom:3px;">'+f.title+'</div></a>'+
      '<div style="font-family:Arial,sans-serif;font-size:10px;color:#E8631A;font-weight:700;margin-bottom:2px;">'+(f.releaseDate||'TBC')+'</div>'+
      '<div style="font-family:Arial,sans-serif;font-size:10px;color:#7A92AB;">'+(f.director||'')+(f.budget?' &middot; '+f.budget:'')+'</div></td>';
  }).join('<td width="1" style="background:#D6E4F0;"></td>');

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Boxoffy Brief &middot; '+w.weekNum+'</title></head>'+
  '<body style="margin:0;padding:0;background:#EEF5FF;">'+
  '<div style="display:none;max-height:0;overflow:hidden;">'+w.headline+'&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>'+
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF5FF;"><tr><td align="center" style="padding:24px 12px;">'+
  '<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">'+

  // HEADER
  '<tr><td style="background:#0D1F35;border-radius:8px 8px 0 0;overflow:hidden;">'+
  '<div style="height:4px;background:linear-gradient(90deg,#E8631A,#FFA040);"></div>'+
  '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'+
  '<td style="padding:24px 28px 20px;">'+
  '<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;"><tr>'+
  '<td style="font-family:Arial,sans-serif;font-size:24px;font-weight:900;letter-spacing:-1px;color:#fff;">BOX<span style="color:#E8631A;">OF</span>FY</td>'+
  '<td style="padding-left:12px;vertical-align:middle;"><span style="font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#4A6080;background:#162A44;padding:3px 8px;border-radius:2px;">WEEKLY BRIEF</span></td>'+
  '</tr></table>'+
  '<div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E8631A;margin-bottom:10px;">'+w.weekNum+' &middot; '+w.dateRange+'</div>'+
  '<div style="font-family:Georgia,serif;font-weight:700;font-size:20px;color:#fff;line-height:1.25;margin-bottom:10px;">'+w.headline+'</div>'+
  '<div style="font-family:Arial,sans-serif;font-size:12px;color:#7A92AB;line-height:1.6;">'+(w.subline||'').slice(0,160)+'</div>'+
  '</td>'+
  '<td width="88" style="padding:0;vertical-align:bottom;text-align:right;">'+
  (hero.posterUrl?'<img src="'+hero.posterUrl+'" width="88" height="132" alt="'+hero.title+'" style="display:block;border:0;border-radius:4px 0 0 0;object-fit:cover;" />':'')+
  '</td></tr></table></td></tr>'+

  // GREETING
  '<tr><td style="background:#162A44;padding:12px 28px;">'+
  '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'+
  '<td style="font-family:Arial,sans-serif;font-size:13px;color:#fff;">Hey <strong>'+firstName+'</strong> &mdash; your weekly box office intel from Boxoffy.</td>'+
  '<td align="right" style="font-family:Arial,sans-serif;font-size:10px;color:#4A6080;white-space:nowrap;">Verified. No spin.</td>'+
  '</tr></table></td></tr>'+

  // CHART
  '<tr><td style="background:#fff;padding:24px 28px 8px;">'+
  '<table width="100%" cellpadding="0" cellspacing="0" border="0">'+
  '<tr><td style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E8631A;padding-bottom:4px;">&#9654; India Weekly Chart</td>'+
  '<td align="right"><a href="'+BASE_URL+'" style="font-family:Arial,sans-serif;font-size:10px;color:#2563EB;text-decoration:none;font-weight:700;">Full chart &rarr;</a></td></tr>'+
  '<tr><td colspan="2" style="padding-bottom:14px;"><div style="font-family:Arial,sans-serif;font-size:9px;color:#7A92AB;">'+w.weekNum+' &middot; '+w.dateRange+' &middot; India Nett</div></td></tr>'+
  '</table>'+rows3+rows3s+
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;margin-bottom:4px;">'+
  '<tr><td align="center"><a href="'+BASE_URL+'" style="display:inline-block;background:#0D1F35;color:#fff;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:10px 28px;border-bottom:2px solid #E8631A;border-radius:2px;">View Full Chart &rarr;</a></td></tr>'+
  '</table></td></tr>'+

  // TAKE
  '<tr><td style="background:#FFF8F5;padding:20px 28px;border-left:4px solid #E8631A;">'+
  '<div style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E8631A;margin-bottom:10px;">&#9998; BOXOFFY TAKE &middot; '+w.weekNum+'</div>'+
  '<p style="font-family:Georgia,serif;font-size:13px;color:#1E3251;line-height:1.75;margin:0 0 12px;font-style:italic;">'+(w.interval_take||'').slice(0,500)+'</p>'+
  (w.nextWeek?'<p style="font-family:Arial,sans-serif;font-size:12px;color:#4A6080;line-height:1.65;margin:0;padding-top:10px;border-top:1px solid #D6E4F0;"><strong style="color:#0D1F35;">Next week:</strong> '+(w.nextWeek||'').slice(0,200)+'</p>':'')+
  '</td></tr>'+

  // US BO
  '<tr><td style="background:#1A3A6B;padding:16px 28px;">'+
  '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'+
  '<td><div style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#60A5FA;margin-bottom:6px;">&#127482;&#127480; US BOX OFFICE &middot; '+w.dateRange+'</div>'+
  '<div style="font-family:Georgia,serif;font-weight:700;font-size:14px;color:#fff;">PHM #1 &middot; $80.5M &nbsp;&middot;&nbsp; D2 #3 &middot; $9.57M</div>'+
  '<div style="font-family:Arial,sans-serif;font-size:11px;color:#7A92AB;margin-top:4px;">$13.5M 4-day NA &mdash; Indian cinema NA record</div></td>'+
  '<td align="right" style="vertical-align:middle;"><a href="'+BASE_URL+'" style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;color:#E8631A;text-decoration:none;border:1px solid #E8631A;padding:6px 12px;border-radius:2px;white-space:nowrap;">US Chart &rarr;</a></td>'+
  '</tr></table></td></tr>'+

  // ARTICLES
  '<tr><td style="background:#fff;padding:24px 28px 16px;">'+
  '<div style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E8631A;margin-bottom:16px;">&#9998; FROM THE DESK</div>'+
  arts+'</td></tr>'+

  // UPCOMING
  '<tr><td style="background:#F8FBFF;padding:20px 28px;border-top:1px solid #D6E4F0;">'+
  '<div style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E8631A;margin-bottom:14px;">&#9650; COMING SOON</div>'+
  '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'+ups+
  '<td style="vertical-align:middle;padding-left:14px;text-align:center;">'+
  '<div style="font-family:Arial,sans-serif;font-size:11px;color:#7A92AB;line-height:1.6;margin-bottom:10px;">33 films tracked<br>through 2026</div>'+
  '<a href="'+BASE_URL+'/upcoming-releases.html" style="display:inline-block;font-family:Arial,sans-serif;font-size:10px;font-weight:700;color:#fff;background:#0D1F35;text-decoration:none;padding:8px 14px;border-radius:3px;border-bottom:2px solid #E8631A;">Full Calendar &rarr;</a>'+
  '</td></tr></table></td></tr>'+

  // CTA
  '<tr><td style="background:linear-gradient(135deg,#E8631A,#D4541A);padding:22px 28px;text-align:center;">'+
  '<div style="font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.85);margin-bottom:14px;">Live data updated daily &middot; Verified numbers &middot; No PR fluff</div>'+
  '<a href="'+BASE_URL+'" style="display:inline-block;background:#fff;color:#E8631A;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:14px 36px;border-radius:3px;">Open Boxoffy &rarr;</a>'+
  '</td></tr>'+

  // FOOTER
  '<tr><td style="background:#0D1F35;border-radius:0 0 8px 8px;padding:20px 28px;">'+
  '<div style="font-family:Arial,sans-serif;font-size:18px;font-weight:900;letter-spacing:-1px;color:#fff;margin-bottom:12px;">BOX<span style="color:#E8631A;">OF</span>FY</div>'+
  '<div style="padding-top:12px;border-top:1px solid #1E3251;">'+
  '<p style="font-family:Arial,sans-serif;font-size:10px;color:#2D3A4A;line-height:1.7;margin:0;">'+
  '&#9888; <strong style="color:#E8631A;">TEST SEND</strong> &mdash; not sent to subscribers &middot; <a href="'+BASE_URL+'" style="color:#4A6080;">'+BASE_URL+'</a> &middot; &copy; 2026 Boxoffy.com'+
  '</p></div></td></tr>'+

  '</table></td></tr></table></body></html>';
}

// ── Resend helper using https module ────────────────────────────
function resendPost(payload){
  return new Promise(function(resolve,reject){
    var body=JSON.stringify(payload);
    var opts={
      hostname:'api.resend.com',
      path:'/emails',
      method:'POST',
      headers:{
        'Authorization':'Bearer '+process.env.RESEND_API_KEY,
        'Content-Type':'application/json',
        'Content-Length':Buffer.byteLength(body)
      }
    };
    var req=https.request(opts,function(res){
      var data='';
      res.on('data',function(c){data+=c;});
      res.on('end',function(){
        try{resolve({status:res.statusCode,body:JSON.parse(data)});}
        catch(e){resolve({status:res.statusCode,body:data});}
      });
    });
    req.on('error',reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req,res){
  try{
    var secret=req.headers['x-cron-secret']||req.query.secret;
    if(secret!==process.env.CRON_SECRET){
      return res.status(401).json({error:'Unauthorized — add ?secret=YOUR_CRON_SECRET'});
    }

    var toEmail=req.query.email||'prasadbhojak@gmail.com';
    var preview=req.query.preview==='1';
    var html=buildHtml('Prasad');

    if(preview){
      res.setHeader('Content-Type','text/html; charset=utf-8');
      return res.status(200).send(html);
    }

    var r=await resendPost({
      from:'Boxoffy Brief <info@boxoffy.com>',
      to:[toEmail],
      reply_to:'info@boxoffy.com',
      subject:'[TEST] Boxoffy Brief · '+WEEK.weekNum+' · '+WEEK.dateRange,
      html:html
    });

    if(r.status!==200&&r.status!==201){
      return res.status(500).json({error:'Resend failed',status:r.status,detail:r.body});
    }
    return res.status(200).json({success:true,sent_to:toEmail,resend_id:r.body.id});

  }catch(err){
    return res.status(500).json({error:err.message,stack:err.stack});
  }
};
