# Boxoffy — Site Map & Link Registry
**Last Updated:** Week 11 · March 10, 2026  
**Repo:** https://github.com/prasadbhojak-oss/boxoffy  
**Live:** https://boxoffy.com  

> **INSTRUCTIONS FOR CLAUDE:** Read this file at the start of every session before touching any page. When building or editing any page, update this file to reflect new pages, new links, or changed cross-references. When a data point changes, check the "Appears In" column in DATA_REGISTRY.md and update every listed file.

---

## Site Architecture

```
boxoffy.com/                          ← React SPA (src/App.jsx)
├── /about.html                       ← Static · public/about.html
├── /dhurandhar-box-office.html       ← Static · public/dhurandhar-box-office.html
├── /dhurandhar-2-box-office.html     ← Static · public/dhurandhar-2-box-office.html
├── /dhurandhar2-editorial.html       ← Static · public/dhurandhar2-editorial.html
└── /dhurandhar2-advance-article.html ← Static · public/dhurandhar2-advance-article.html
```

**Static files location:** `C:\Users\palla\boxoffy\public\`  
**React app:** `C:\Users\palla\boxoffy\src\App.jsx`  
**Deploy:** git push → GitHub → Vercel auto-deploys in ~30 sec  

---

## Pages — Detailed Registry

---

### 1. `/` — Main App
**File:** `src/App.jsx`  
**Type:** React SPA (Vite build)  
**Status:** ✅ Live  

**Links OUT to:**
| Destination | How | Location in App.jsx |
|---|---|---|
| `/dhurandhar-box-office.html` | `pageUrl` on Dhurandhar (OTT) film row — renders "📊 Full Box Office →" button | Lines 293, 341 — WeeklyChartRow |
| `/dhurandhar-2-box-office.html` | `pageUrl` on Dhurandhar: The Revenge (Upcoming) row — renders "📊 Live Tracker →" button | Line 466 — WeeklyChartRow |
| `/dhurandhar2-advance-article.html` | EDITORIALS array + Featured Editorial Strip | Lines 607, 638, 646 |
| `/dhurandhar2-editorial.html` | EDITORIALS array + Featured Editorial Strip | Lines 616, 661 |
| `/about.html` | NavBar link | Line 1015 |

**Linked from:** None (root page)  

**Key data arrays in App.jsx:**
- `FILMS_2026` — current weekly chart films (Running/Closed/OTT/Upcoming)
- `UPCOMING_FILMS` — calendar of upcoming releases
- `EDITORIALS` — editorial articles strip (Bollywood/OTT/TV sections)
- `WEEKLY_COMMENTARY` — week-by-week analyst coverage
- `US_BO_WEEKLY` — US box office data
- `OTT_TOP10` — combined OTT rankings widget

**Current state (Week 11 · Mar 9, 2026):**
- NavBar: WEEK 11 · 2026
- Live banner: "Border 2 closed · ₹481.76 Cr WW"
- Timestamp: Mon, 9 Mar 2026 · 11:55 PM IST
- Snapshot card #1: Kerala Story 2 — ₹32.87 Cr net · Wk 2 · Plus verdict
- Snapshot card #2: 2026 YTD Combined — ₹1,567 Cr

**SEO:** React SPA — limited direct Google indexing. Main SEO value comes from the static pages linked from here.

---

### 2. `/dhurandhar-box-office.html` — Dhurandhar Part 1 Deep Dive
**File:** `public/dhurandhar-box-office.html`  
**Type:** Static HTML  
**Status:** ✅ Live  
**Last verified:** March 10, 2026 (full data audit)  

**Links OUT to:**
| Destination | How |
|---|---|
| `/` | NavBar "← Home" + "← Back to Live Dashboard" footer link |
| `/dhurandhar-2-box-office.html` | NavBar tab + CTA block at bottom of page |

**Linked from:**
| Source | How |
|---|---|
| `/` (App.jsx) | WeeklyChartRow `pageUrl` — "📊 Full Box Office →" on both OTT table and weekly chart Dhurandhar entries |
| `/dhurandhar-2-box-office.html` | NavBar tab + Part 1 CTA block at bottom |

**SEO:**
- Title: `Dhurandhar Box Office Collection — ₹1,303 Cr WW | All-Time Hindi Record | Boxoffy`
- Description: `Dhurandhar box office collection: ₹895 Cr India net, ₹1,303 Cr worldwide. Week-by-week breakdown, Netflix OTT records, full verdict analysis.`
- Keywords: `Dhurandhar box office collection, Dhurandhar total collection, Dhurandhar hit or flop, Dhurandhar OTT Netflix, Ranveer Singh box office, highest grossing Hindi film ever`
- Canonical: `https://boxoffy.com/dhurandhar-box-office.html`

**Page sections:**
1. Hero stats grid (WW, India Net, Overseas, Budget, Weeks, OTT)
2. Verdict & Analysis block
3. Week-by-week collection table (Wk1–Wk12 with running totals)
4. Records Shattered grid (6 cards)
5. Netflix OTT performance block
6. All-time Hindi comparison table
7. Crew grid
8. CTA → Dhurandhar 2 page

---

### 3. `/dhurandhar-2-box-office.html` — Dhurandhar 2 Live Tracker
**File:** `public/dhurandhar-2-box-office.html`  
**Type:** Static HTML  
**Status:** ✅ Live  
**Last verified:** March 10, 2026 (full data audit)  

**Links OUT to:**
| Destination | How |
|---|---|
| `/` | NavBar "← Home" + "← Live Dashboard" footer link |
| `/dhurandhar-box-office.html` | NavBar tab + Part 1 CTA block at bottom |

**Linked from:**
| Source | How |
|---|---|
| `/` (App.jsx) | WeeklyChartRow `pageUrl` — "📊 Live Tracker →" on Dhurandhar: The Revenge upcoming row |
| `/dhurandhar-box-office.html` | NavBar tab + CTA at bottom |

**SEO:**
- Title: `Dhurandhar 2 Box Office Collection — Live Tracker | ₹20 Cr Advance | Mar 19 | Boxoffy`
- Description: `Dhurandhar 2 box office collection live tracker. Premiere record ₹12.29 Cr, 2.06 lakh tickets, ₹20 Cr total advance, $1.7M US. Day 1 prediction ₹85–100 Cr.`
- Keywords: `Dhurandhar 2 box office collection, Dhurandhar 2 advance booking, Dhurandhar 2 Day 1 collection, Dhurandhar The Revenge box office`
- Canonical: `https://boxoffy.com/dhurandhar-2-box-office.html`

**Page sections:**
1. Live banner (pulsing dot, "Updated daily")
2. Hero: live countdown timer to Mar 19 2026 6AM IST (JavaScript)
3. Advance booking stats grid (6 stats)
4. Advance breakdown table
5. Analyst predictions (6 cards: Jaiswal, Kadel, Adarsh, Shaw, CineHub, Boxoffy)
6. Records in sight grid
7. OTT deal block (JioHotstar ₹150 Cr vs Part 1 Netflix ₹85 Cr)
8. Opening day history comparison table
9. CTA → Dhurandhar 1 page

**⚠️ UPDATE REQUIRED MARCH 19:** Replace countdown + advance section with actual Day 1 numbers. Change title/meta to reflect actual opening.

---

### 4. `/dhurandhar2-editorial.html` — "Ladies and Gentlemen, You Are STILL Not Ready"
**File:** `public/dhurandhar2-editorial.html`  
**Type:** Static HTML — Editorial Article  
**Status:** ✅ Live  
**Published:** March 8, 2026  

**Links OUT to:**
| Destination | How |
|---|---|
| `https://boxoffy.com` | Masthead logo + breadcrumb |

**Linked from:**
| Source | How |
|---|---|
| `/` (App.jsx) | EDITORIALS array (tag: "Analysis", 2d ago) · Line 661 |
| `/` (App.jsx) | Featured Editorial Strip (newest editorial) · Line 616 |

**SEO:**
- Title: `Ladies and Gentlemen, You Are STILL Not Ready For This — Boxoffy Editorial`
- Description: `Dhurandhar: The Revenge arrives March 19 with ₹80–100 Cr Day 1 projections. Boxoffy breaks down every number.`

**⚠️ NOTE:** Uses absolute URL `https://boxoffy.com` for home link (not relative `/`). Works fine but inconsistent with other pages.

---

### 5. `/dhurandhar2-advance-article.html` — "₹20 Crore and Counting"
**File:** `public/dhurandhar2-advance-article.html`  
**Type:** Static HTML — News Article  
**Status:** ✅ Live  
**Published:** March 9, 2026  

**Links OUT to:**
| Destination | How |
|---|---|
| `https://boxoffy.com` | Masthead logo + back link |

**Linked from:**
| Source | How |
|---|---|
| `/` (App.jsx) | EDITORIALS array (tag: "Advance Booking", Now, hot) · Lines 607, 638, 646 |
| `/` (App.jsx) | Featured Editorial Strip (newest article) · Line 607 |

**SEO:**
- Title: `₹20 Crore and Counting — Dhurandhar 2 Advance Booking Update | Boxoffy`
- Description: `2.06 lakh tickets. ₹12.29 Cr premiere gross. $1.7M US weekend. Boxoffy's March 9 advance booking breakdown.`
- Canonical: `https://boxoffy.com/dhurandhar2-advance-article.html`

---

### 6. `/about.html` — About Boxoffy
**File:** `public/about.html`  
**Type:** Static HTML  
**Status:** ✅ Live  

**Links OUT to:**
| Destination | How |
|---|---|
| `https://boxoffy.com` | Masthead logo + back links |

**Linked from:**
| Source | How |
|---|---|
| `/` (App.jsx) | NavBar link | Line 1015 |

**SEO:**
- Title: `About Boxoffy — Making Box Office Cool Again`
- Description: `Boxoffy is building the definitive box office intelligence layer for Indian cinema. Clean data. Validated numbers. All languages.`

---

## Planned Pages — Not Yet Built

| Page | URL | Priority | Notes |
|---|---|---|---|
| Hit or Flop Calculator | `/hit-or-flop.html` | 🔴 High | ROI logic already in App.jsx calculator. Evergreen traffic. |
| Border 2 Deep Dive | `/border-2-box-office.html` | 🔴 High | Same template as Dhurandhar 1 page. Data ready. |
| Kerala Story 2 Page | `/kerala-story-2-box-office.html` | 🟡 Medium | Running this week, good timing |
| Week Archive | `/week-12.html` | 🟡 Medium | Static weekly summary. Good SEO for "box office this week" |
| OTT Release Dates | `/ott-release-dates.html` | 🟡 Medium | "When does X release on OTT" — high search volume |
| Dhurandhar 2 Day 1 | `/dhurandhar-2-day-1.html` | 🔴 High | Ready to publish March 19 night |
| Media Kit | `/media-kit.pdf` | 🟡 Medium | For production houses / ad agencies |
| All-Time Hindi Table | `/all-time-hindi-box-office.html` | 🟢 Low | Evergreen. Data already in App.jsx |

---

## Cross-Link Health Check

| Link | From | To | Status |
|---|---|---|---|
| Dhurandhar 1 Full Page | App.jsx WeeklyChartRow (OTT table + chart) | `/dhurandhar-box-office.html` | ✅ Working |
| Dhurandhar 2 Live Tracker | App.jsx WeeklyChartRow (Upcoming row) | `/dhurandhar-2-box-office.html` | ✅ Working |
| Editorial — Advance Article | App.jsx EDITORIALS strip | `/dhurandhar2-advance-article.html` | ✅ Working |
| Editorial — Analysis | App.jsx EDITORIALS strip | `/dhurandhar2-editorial.html` | ✅ Working |
| About | App.jsx NavBar | `/about.html` | ✅ Working |
| D1 → D2 | `/dhurandhar-box-office.html` footer CTA + NavBar | `/dhurandhar-2-box-office.html` | ✅ Working |
| D2 → D1 | `/dhurandhar-2-box-office.html` footer CTA + NavBar | `/dhurandhar-box-office.html` | ✅ Working |
| D1 → Home | `/dhurandhar-box-office.html` NavBar + footer | `/` | ✅ Working |
| D2 → Home | `/dhurandhar-2-box-office.html` NavBar + footer | `/` | ✅ Working |
| Editorial → Home | Both editorial pages | `https://boxoffy.com` | ✅ Working (absolute URL) |

---

## Rules for New Pages

When adding any new static page:
1. Add it to this SITEMAP.md under "Pages" with full links-in / links-out
2. Add a NavBar linking back to `/` (Home)
3. Add cross-links to related pages (e.g. a Border 2 page links to the weekly chart)
4. Add `pageUrl` field to the film's data object in App.jsx
5. Add canonical meta tag pointing to `https://boxoffy.com/[page-name].html`
6. Update DATA_REGISTRY.md with any data points that appear on the new page
7. Update the "Planned Pages" table (move from planned → live)
