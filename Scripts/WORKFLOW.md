# 🎬 BOXOFFY WEEKLY UPDATE WORKFLOW
> The semi-automated data pipeline for boxoffy.com

---

## ⚡ QUICK REFERENCE — Weekly Update in 6 Steps

```
1. node update.js --open       → Opens all 6 sources in browser
2. node update.js --analysts   → Opens 4 analyst X profiles
3. [Manual review: 15-20 min]  → Read, compare, note discrepancies  
4. node update.js --input      → Enter what you found
5. node update.js --review     → Approve / reject each change
6. node update.js --apply      → Write to App.jsx → git push
```

---

## 📁 FILE LOCATIONS

```
C:\Users\palla\boxoffy\
├── src\App.jsx                  ← Main data file (engine edits this)
├── scripts\                     ← PUT THIS FOLDER HERE
│   ├── update.js                ← Main engine
│   ├── package.json
│   ├── WORKFLOW.md              ← This file
│   ├── data\
│   │   ├── pending-updates.json ← Queue of edits awaiting approval
│   │   └── update-history.json  ← Log of all past changes
│   └── logs\
│       └── update-YYYY-MM-DD.log
```

**Setup (one time only):**
```cmd
cd C:\Users\palla\boxoffy\scripts
node update.js
```

---

## 🗓️ WHEN TO RUN

| Trigger | Action |
|---|---|
| **Every Monday** | Full weekly audit (all 6 sources) |
| **After a big film releases** | Run within 24hrs of Day 1 |
| **After analyst posts** | Log their figures in --input |
| **Before Week XX goes live** | Run --trigger to generate summary |
| **Day before Dhurandhar 2 (Mar 18)** | Full run + update countdown |
| **Night of Mar 19** | Emergency run for Day 1 figures |

---

## 📰 THE 6 SOURCES — What to Look For

### 1. Box Office India (`boxofficeindia.com`) ← HIGHEST TRUST
- **Verdicts** — BOI calls are the gold standard (Blockbuster/Super Hit/Hit/Average/Flop)
- **Final weekly totals** — their figures are authoritative
- **Look for:** "Week X nett" figures, any verdict announcements
- **URL:** https://www.boxofficeindia.com/box-office.php

### 2. Sacnilk (`sacnilk.com`) ← HIGHEST TRUST
- **Day-wise collections** — most granular data
- **Occupancy %** — early signal for how a film is trending
- **Advance booking** — D2 previews, screen counts
- **OTT release dates** — they're fast to update
- **URL:** https://www.sacnilk.com/entertainmenttopbar/Box_Office_Collection?hl=en
- **New site:** https://boxoffice.sacnilk.com

### 3. Box Office Guru (`boxofficeguru.com`) ← INTERNATIONAL ONLY
- **Only source** for reliable worldwide/overseas gross
- Use for: WW total, overseas breakdown
- **URL:** https://www.boxofficeguru.com

### 4. Adda Today (`addatoday.com`) ← ADVANCE BOOKING
- Best for Dhurandhar 2 pre-sales data
- Screen counts, multiplex data
- **URL:** https://www.addatoday.com/box-office/

### 5. Pinkvilla (`pinkvilla.com`) ← OTT & CAST NEWS
- OTT deals announcements
- Upcoming release news, cast confirms
- Less reliable for raw BO numbers
- **URL:** https://www.pinkvilla.com/box-office

### 6. Koimoi (`koimoi.com`) ← RECORDS & MILESTONES
- Great for "beats record of X" stories
- Advance booking records confirmation
- **URL:** https://www.koimoi.com/box-office/

---

## 🐦 THE 4 ANALYSTS — X/Twitter Manual Check

These can't be automated (no API). Open profiles, scan last 10-15 posts.

| Analyst | Handle | What to check |
|---|---|---|
| **Sumit Kadel** | @SumitKadel_ | South BO, Bollywood collections, verdicts |
| **Rohit Jaiswal** | @rohit_jaiswal_ | Breaking collection figures (often earliest) |
| **Nishit Shaw** | @NishitShaw | Multiplex data, detailed breakdowns |
| **Taran Adarsh** | @taran_adarsh | Official verdicts, trade calls |

**What to log from analyst posts:**
- Collection figures they confirm (e.g. "XYZ crosses ₹X Cr")
- Verdict calls ("XYZ is a HIT at box office")
- OTT date announcements
- Record claims ("breaks record of...")

> Note: Enter these manually via `node update.js --input` and cite source as "analyst-[name]"

---

## 🔁 DATA PRIORITY HIERARCHY

When sources conflict, follow this order:
```
1. BOI (verdict, weekly net)
2. Sacnilk (day-wise, advance)
3. BOGuru (international/WW only)
4. Adda Today (advance booking)
5. Koimoi (records/milestones)
6. Pinkvilla (OTT/cast news)
```

**If BOI says "Average" but Sacnilk says "Hit" → use BOI**
**If Sacnilk has day 12 data but BOI only has week 1 → Sacnilk for running total**
**If analysts disagree with each other → wait for BOI confirmation**

---

## 🚨 EDITORIAL RULES (NEVER BREAK)
- GCC ban: Never add UAE/Qatar/Oman/Bahrain/Saudi as Dhurandhar theatrical markets
- Studio: Always **B62 Studios** (not B26)
- Music: Always **Shashwat Sachdev**
- Producer: Jyoti Deshpande · Aditya Dhar · Lokesh Dhar
- `weeklyCollection`: Current week only — never cumulative
- Status values: `Running` / `Closing` / `Closed` / `OTT` / `Upcoming`

---

## ⚙️ FIELDS YOU CAN UPDATE

| Field | Example Values |
|---|---|
| `indiaNet` | `₹27.68 Cr`, `₹424 Cr` |
| `worldwide` | `₹37.50 Cr`, `₹481.76 Cr` |
| `weeklyCollection` | `₹8.40 Cr` (current week only!) |
| `status` | `Running`, `Closing`, `Closed`, `OTT`, `Upcoming` |
| `verdict` | `Blockbuster`, `Super Hit`, `Hit`, `Average`, `Flop`, `Disaster` |
| `ottPlatform` | `Netflix`, `Amazon Prime Video`, `ZEE5`, `JioCinema` |
| `ottDate` | `Mar 5, 2026`, `Apr 2026` |

---

## 🛠️ TROUBLESHOOTING

**"App.jsx not found"**
→ Edit `CONFIG.APP_JSX_PATH` in update.js line ~20
→ Point it to `C:\Users\palla\boxoffy\src\App.jsx`

**"Could not parse films"**
→ The FILMS array format in App.jsx may have changed
→ Check that films use `id:` and `title:` fields

**"Could not match exact value"**
→ The old value you entered doesn't match what's in App.jsx exactly
→ Run `node update.js` to see current values, re-enter

**Backup files**
→ Every `--apply` creates a `.backup-[timestamp]` file next to App.jsx
→ If something goes wrong: `copy App.jsx.backup-XXXX App.jsx`

---

## 📅 MARCH 19 LAUNCH NIGHT CHECKLIST

Run these in order the night of March 19:

```
1. node update.js --input
   → Dhurandhar 2: status: Upcoming → Running
   → Add Day 1 weeklyCollection
   → Update indiaNet with Day 1 figure

2. node update.js --review    → approve all
3. node update.js --apply     → write to App.jsx

4. In App.jsx manually update:
   → NavBar: WEEK 12 · Mar 19, 2026
   → live banner pill with Day 1 number
   → dhurandhar-2-box-office.html: replace countdown with actuals

5. git add . && git commit -m "D2 Day 1: ₹XX Cr" && git push
```

---

*Update Engine v1.0 · Built for Boxoffy · Mar 2026*
