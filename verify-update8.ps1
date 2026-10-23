# Boxoffy - Update 8 pre-flight checks.
#
# This used to live in deploy-update8.cmd as a pile of `call :need` + findstr.
# cmd.exe re-reads a batch file by byte offset, and mixing a CALLed label with
# `exit /b` inside a parenthesised block made it lose its place and replay whole
# sections. It also mangles arguments containing escaped quotes, so markers like
# id="worldmaps" silently never ran. PowerShell does plain literal matching with
# none of that, so the checks live here and the .cmd just calls this.
#
# Every marker is LITERAL - no regex - so ${DATA.basis} and id="x" are safe.

$ErrorActionPreference = 'Stop'
$fail = 0

function Need($file, $marker, $label) {
  if (-not (Test-Path $file)) { Write-Host "    FAIL  $file is missing"; $script:fail = 1; return }
  $t = [IO.File]::ReadAllText((Resolve-Path $file))
  if ($t.Contains($marker)) { Write-Host "    ok    $label" }
  else { Write-Host "    FAIL  $label - '$marker' not in $file"; $script:fail = 1 }
}
function Absent($file, $marker, $label) {
  if (-not (Test-Path $file)) { Write-Host "    ok    $label (no $file)"; return }
  $t = [IO.File]::ReadAllText((Resolve-Path $file))
  if ($t.Contains($marker)) { Write-Host "    FAIL  $label - found '$marker' in $file"; $script:fail = 1 }
  else { Write-Host "    ok    $label" }
}

$page = 'public\ramayana.html'
$app  = 'src\App.jsx'
$vercel = 'vercel.json'

Write-Host ''
Write-Host '=== 1. the edits are actually in the files'
Need $page 'const UK = {'        'United Kingdom data'
# The tracker looked like an internal dashboard until 19 Oct because it shared
# the articles' design TOKENS but none of their components. These are the share
# bar and accent blocks. If they go missing the page silently reverts to having
# no way for a reader to pass it on.
Need $page 'class="sharebar inline"' 'tracker has the header share bar'
Need $page 'class="sharebar end"'    'tracker has the closing share bar'
Need $page 'id="sharecard"'          'Make an image pill wired to the share dialog'
Need $page 'background:#111827'      'end share bar is fixed dark, not var(--ink)'
Absent $page 'North America presales — '  'share text does not call four markets North America'
Need $page 'function euBody'     'United Kingdom panel'
Need $page 'function auBody'     'Australia panel'
Need $page 'function pendingPanel' 'not-yet-counted panel'
Need $page 'function openSpan'   'opening-run split'
# BATCH 4 REPLACES BATCH 3, it does not stack on it: Grok's file is
# cumulative from the same 19 Oct baseline, so the published figure is
# 4,985 + 468 clean, never 5,279 + 468.
# FINAL 20 OCT RE-READ: all 85 cinemas, 1,091 showtimes with numbers. The
# chain shows 6,098; we publish 5,551. Bradford (held 308->128, sold 0->180)
# and Whiteley (held 192->48, sold 0->144) are 324 of the 547 difference and
# neither has one seat fewer off sale than it had on 19 October.
# 21 OCT SECOND RE-READ: the same 1,083 showtimes twice in 8h29m. The chain's
# own column moved 536; only 427 seats actually left the inventory. 5,551 +
# 427 = 5,978 Cineworld, + 487 Showcase = 6,465.
#
# BRADFORD RELABELLED AGAIN, ON TWO CONSECUTIVE READS. Screen 8 moved held
# 10->4 and sold 0->6 on all twelve of its showtimes: raw +73, clean +1. The
# 20 Oct guard below exists because Bradford and Whiteley did this once. It
# has now happened twice, to the same cinema, and these guards are the only
# thing standing between that and a published +73.
Need $page 'tickets:6465'        'UK 6,465 after the 21 Oct re-read'
Need $page 'cwGone:5978'         'Cineworld 5,978, relabelling excluded'
Need $page 'gbp:87278'           'UK pounds at the pinned 13.50 ATP'
Need $page 'usd:115669'          'UK dollars moved with the pounds, at 1.3253'
Need $page 'realHi:5978'         'the top of the UK range is cwGone by definition'
Need $page 'reRead2Delta:427'    'the 21 Oct clean delta'
Need $page 'reRead2Relabelled:109' 'and the seats excluded to get it'
Need $page 'bradfordClean:1'     'Bradford: one seat, not seventy-three'
Absent $page 'tickets:6038,'     'no pre-21-Oct UK total'
Absent $page 'cwGone:5551,'      'no pre-21-Oct Cineworld figure'
Absent $page 'gbp:81513'         'no pre-21-Oct UK pounds'
Absent $page 'usd:108029'        'no pre-21-Oct UK dollars'
Absent $page 'realHi:5551'       'no pre-21-Oct top of range'
Absent $page 'reRead2Delta:536'  'the raw movement must never be published as clean'
Absent $page 'bradfordClean:73'  'Bradford raw is never the clean figure'
# THE UK CARRIES THREE LANGUAGE TRACKS. The 21 Oct file is the first UK file
# with a language on every row. Telugu sells at 4.45% against Hindi's 2.16%,
# off 49 showtimes at 17 cinemas. Tamil is third at 0.76%. Germany turned up
# a Tamil track the same day; two markets in one day is not a coincidence,
# and no India figure we hold can resolve a language at all.
Need $page "langs:[['Hindi'"   'the UK language split is on the page'
Need $page "['Telugu',49,17"   'and Telugu is named with its own footprint'
# Leicester Square went unread this round - 9 showtimes, all IMAX or
# Superscreen. Its figure is carried, so it must be named as carried.
Need $page 'lsUnread:9'          'the unread West End rooms are named'
# The 20 Oct round is KEPT, not overwritten. Two clean deltas on two dates
# is the series; collapsing them into one would lose it.
Need $page 'chainShows:6098'     'what the chain shows is published beside what we count'
Need $page 'relabelled:552'      'every relabelled seat named'
Absent $page 'cwGone:6098'       'the chain figure is never the published one'
Absent $page 'tickets:6029,'     'no batch-5 UK total'
Absent $page 'cwGone:5542,'      'no batch-5 Cineworld figure'
# 557 = the file's own 532 clean PLUS Ilford's 25 from batch 4, which this
# file folded into its baseline when it re-read that cinema from 62 instead
# of 37. Publishing the file's 532 would silently drop them.
Need $page 'reReadDelta:566'     'the clean delta from the full re-read'
Absent $page 'reReadDelta:557'   'no partial-batch clean delta'
Absent $page 'reReadDelta:1118'  'the raw delta must never be published as clean'
Absent $page 'reReadDelta:532'   'the file total alone loses the re-baselined 25'
Absent $page 'reReadDelta:746'   'the raw delta must never be published as clean'
Absent $page 'cwGone:5985'       'batch 5 must not be stacked on batch 4'
Need $page 'scGone:487'          'Showcase 487 modelled on the measured share'
Need $page 'soldShare:44.84'     'the share is measured now, not assumed'
# offSale is a direct read now: 6,098 shown sold plus 5,576 labelled held.
Need $page 'offSale:11674'       'UK off sale published beside it'
Need $page 'realLo:3185'         'UK real-bookings band published, not a point'
Need $page 'blockSeats:2366'     'UK house-seat exposure disclosed'
# The city list MUST stay block-corrected. On the seats-gone basis Solihull
# reads 462 and Feltham 281, and both are almost entirely one room's block -
# Solihull corrected is 6. A national total can carry blocks with a note; a
# named cinema cannot, because a reader can open the seat map and disprove it.
Need $page "['Leicester Square',520]" 'UK city list on the corrected basis'
Absent $page "['Solihull',462]"       'no block-inflated Solihull in the city list'
Absent $page "['Feltham',281]"        'no block-inflated Feltham in the city list'
# 3,964 and 1,192 USED TO BE Need LINES HERE. They were the live Australian
# and German totals on 18 Oct, and when update 12 replaced them with 4,598
# and 1,230 the new Need lines went in but these two were never taken out.
# Section 4 then correctly added them as Absent. The file has been asking for
# a string and forbidding the same string ever since, which means this
# pre-flight could not pass at all - every run failed on two guards that were
# only ever each other. Retired figures live in section 4 as Absent; the live
# figure is the only thing section 1 Needs. One number, one guard, one place.
Need $page 'booked:3185'         'UK organic booked figure published'
Need $page 'blockedAll:7942'     'UK blocked seats published'
Need $page 'INCLUDES BLOCKED SEATS' 'UK footer discloses blocks in the headline'
Need $page 'function deBody'     'Germany panel'
Need $page "de :{name:'Germany'" 'Germany tile in the map row'
# Germany was a FOOTPRINT for six hours on 18 Oct - showtimes drawn as hollow
# rings, explicitly not tickets. mktSvg/worldMaps still CARRY that mode for
# the next market we can see but not count, so the strings stay in the file;
# what must not come back is a market switched into it while it has real
# tickets. foot:true is the switch, so that is what is checked.
Absent $page 'foot:true'            'no market drawn as a footprint'
Absent $page 'on sale, not counted' 'no footprint-era Germany kicker'
# 19 Oct: Canada's published figure is now the recovered FLOOR, 2,102, and the
# 1,899 hand count is retired. The 18 Oct rule was "a floor 13 above the count
# is a warning light, keep the human-verified number". On the Update 11 scan
# the floor is 2,102 over 223 showtimes - FOUR FEWER than the 227 the hand
# count covered. A floor that rises 203 while its own inventory shrinks is
# sales, not an artefact, so 1,899 is provably low and is checked as absent
# below with the rest of the retired Canadian figures.
# 19 OCT 21:56: 2,265 -> 2,449 on IDENTICAL inventory - same 229 showtimes,
# same 26 cinemas, same 32 auditoriums. No coverage in the move, so the +184
# is buying. soloRooms went 1 -> 2 and offered seats FELL 66,642 -> 66,384 on
# the same showtimes, because a room's capacity floor is its own best
# availability reading and that drops as it sells. The floor therefore
# understates by MORE than last time, not less. Both are guarded below.
# 21 OCT 04:33Z: 3,040 -> 3,719, AND THE DENOMINATOR DID NOT MOVE.
# Every previous Canadian delta came with the recovered-capacity warning -
# the floor is max(seatsAvail) over a room's own showtimes, so adding
# near-empty sittings inflates computed sold everywhere. Offered seats went
# 95,681 -> 95,658, twenty-three DOWN across the same seven dates, so the
# +679 is buying rather than arithmetic. seats and tickets must move together
# or the mechanic is back: that is what these two guards are for.
Need $page 'tickets:4986'        'Cineplex 4,986 on its own all-presale dates, 23 Oct 01:03'
Absent $page 'tickets:4851,'     'no 22 Oct 21:51 Cineplex total'
Absent $page 'tickets:4711,'     'no 22 Oct 20:18 Cineplex total'
Absent $page 'tickets:4447,'     'no 22 Oct 08:22 Cineplex total'
Absent $page 'tickets:4344,'     'no 21 Oct 23:29 Cineplex total'
Absent $page 'tickets:3719,'     'no 21 Oct 04:33Z Cineplex total'
Need $page 'buying:135'          'and the buying figure'
Need $page 'usd:64619'           'Canadian dollars at the flat C$18 assumption'
# WHY THE MARKER IS THE PAIR AND NOT 'tickets:3040,'. The retired figures
# are kept on the page as wasTickets and wasSeats. Contains() is case
# SENSITIVE, so 'tickets:3040,' does not match 'wasTickets:3040,' - the
# capital T saves it, and the same camelCase accident is what lets
# Absent 'soloRooms:2,' coexist with wasSoloRooms:2 further down.
# That is luck, not design, and one renamed field would turn every one of
# these guards into a false failure on our own record. The adjacent pair
# only ever existed in the live field, so it cannot collide at all.
Absent $page 'tickets:3040, seats:95681' 'no pre-21-Oct Cineplex figure'
Absent $page 'tickets:2449,'     'no five-date Cineplex figure'
Absent $page 'usd:39398'         'no pre-21-Oct Canadian dollar figure'
Absent $page 'rate:3.18,'        'no pre-21-Oct Canadian rate'
Absent $page "['Tue 10 Nov',383" 'no pre-21-Oct Canadian second-week row'
# LANDMARK, SECOND READ 20 OCT 09:11 CT. Opened by hand - robots.txt answers
# 403 and no scanner of ours fetches that chain. Seats gone off a one-state
# map, not a counted sale, and 295 of the 676 are identical on both nights.
# THIS WAS THE FIRST MATCHED PAIR ON THE PAGE, and it is no longer the only
# one - the method it proved is now running in Germany, the UK, India and the
# United States. Same twelve showtimes, same six
# cinemas, 9h38m apart, nothing added to the worklist. So the +26 is movement
# and belongs to the clean read, which is why lo goes 60 -> 86 while
# blockFloor stays at 590. A block is a count that does not move.
# 20 OCT 23:36 CT, THIRD READ, AND IT IS TWO THINGS IN ONE FILE.
#   IMAX     same 12 showtimes, 676 -> 769 in 14h25m. All six cinemas moved.
#            +93 is BUYING. The series is 650 -> 676 -> 769, +119 clean.
#   ScreenX  36 showtimes at 3 cinemas, 554 seats gone, NEVER READ BEFORE.
#            Zero of it buying. It is footprint we had not opened.
# 676 -> 1,323 is +93 bought and +554 coverage. 86% of the jump is coverage,
# and these guards exist so nobody quotes the 647 as a move.
Need $page 'lm:{tickets:1776'    'Landmark on the fourth read, both formats'
Absent $page 'lm:{tickets:1323'  'no 20 Oct Landmark'
Need $page 'imax:{tickets:963'   'the matched IMAX set on its own'
Absent $page 'imax:{tickets:769' 'no 20 Oct IMAX'
Need $page 'sx:{tickets:813'     'and ScreenX on its own, never pooled'
Absent $page 'sx:{tickets:554'   'no 20 Oct ScreenX'
Need $page 'buying:311,'         'the part of the move that is buying'
Need $page 'newInventory:142'    'and the part that is coverage'
Absent $page 'lm:{tickets:650'   'no first-read Landmark figure'
Absent $page 'lm:{tickets:676'   'no second-read Landmark figure'
Need $page 'was2:676, was3:650' 'the earlier IMAX reads stay on the record'
Need $page 'was:769, added:194'  'and the 769 -> 963 delta beside it'
Need $page 'addedAll:313'        'the whole IMAX series, 650 -> 963'
# SCREENX IS THE THIRD SITTING WE HAVE BEEN ASKING FOR, AND WE HAVE NOT USED
# IT YET. Two of its rooms run 14 showtimes each against IMAX's two, which is
# finally enough to run the room-minimum test at this chain. The file gives
# per-cinema totals only, so the test has not been run: blockTested must stay
# false and the chain's clean floor must stay 179 rather than quietly rising
# with ScreenX's 554. Delete that flag and the 554 becomes an unlabelled
# guess, which is the one thing this page does not publish.
Need $page 'blockTested:true'    'ScreenX room-minimum block test run 23 Oct'
# THE FLOOR IS CARRIED BY EACH SHOWTIME, NOT ONCE PER ROOM. Solihull proves
# the rule on this same page: screen 6 reads 57 across eight showings and its
# block is published as 456, which is 57 x 8. Landmark's six rooms repeat a
# combined floor of 295 on both of their nights, so the block is 590 and the
# clean read is 60 - not the 355 a once-per-room subtraction gives.
Need $page 'blockFloor:590'      'the Landmark block on the per-showtime rule'
Need $page 'lo:1064,'            'the Landmark clean read is published'
Absent $page 'lo:60,'            'no pre-re-read Landmark clean figure'
Absent $page 'lo:86,'            'no second-read Landmark clean figure'
Absent $page 'blockFloor:295'    'no once-per-room block arithmetic'
Absent $page 'between 355 and 650' 'no band from the wrong rule'
# The Method panel carried 18 Oct Canadian and Australian figures for two
# days and still said Landmark was uncounted. It is derived by hand, so it is
# guarded by hand.
Absent $page '1,899 tickets</b> across 26 cinemas' 'no 18 Oct Canada in Method'
Absent $page '<b>840 tickets</b>'                  'no 18 Oct Event in Method'
Absent $page 'none of it is counted here'          'Method must not say Landmark is uncounted'
Need   $page '590 of the 769 is held inventory'    'the block is in the footnote, as agreed'
Absent $page '590 of the 650 is held inventory'    'no first-read Landmark block line'
Absent $page '590 of the 676 is held inventory'    'no second-read Landmark block line'
Absent $page 'Landmark Cinemas is not counted'     'the roll-up must not say Landmark is uncounted'
Absent $page 'Landmark is in for the first time'   'no first-read framing on the third read'
Need $page 'canTix'              'the Canadian roll-up uses both chains'
Absent $page 'const naTix=usSold+xTix()+CA.tickets;' 'no Cineplex-only North America'
Need $page 'seats:96156'         'the offered-seat floor this scan actually read'
Need $page 'wasSeats2:95602,'      'the retired floor stays on the record'
# Back to one unrecoverable room on the widened dates - the extra sittings
# gave the second room something to recover its capacity from.
Need $page 'soloRooms:1,'        'the unrecoverable room is disclosed'
Absent $page 'soloRooms:2,'      'no five-date solo-room count'
Need $page 'wasTickets7:2449'    'the 2,449 stays on the record behind the 3,040'
Need $page 'wasTickets5:3719'     'and the 3,719 the 4,344 replaced'
Need $page 'wasTickets6:3040'    'and the 3,040 before it'
# UPDATE 14: US_EXTRA IS ZERO AND THAT IS THE POINT. 7-8 Nov are measured
# inside the baked map now, so a non-zero US_EXTRA would DOUBLE-COUNT them.
# The retired figure is kept as wasTickets so the record survives, and
# byDate must be empty - usOn(d) prefers US_EXTRA.byDate[d] when the key is
# there, so a stale "2026-11-07":0 would print zero over a map holding
# thousands. That is the failure this pair of guards exists to catch.
Need   $page 'const US_EXTRA = {tickets:0, usd:0' 'US_EXTRA retired to zero'
Need   $page 'byDate:{},'                         'US_EXTRA byDate is empty, not zeroed'
Need   $page 'wasTickets:10282'                   'the retired 7-8 Nov figure kept as the record'
# THE $1.07M BUG, 19 OCT. The page was briefly serving a worldwide total of
# about $1,072,508 against a true $889,758, because ramayana.html was cached
# for 300s while ramayana-map.json was cached for 60s. For four minutes a
# returning visitor held OLD constants and fetched the NEW map, so 7-8 Nov -
# already inside the map - were added a second time from the stale US_EXTRA.
# Two guards, because the fix has two halves and either alone still breaks:
#   xTix/xUsd   the page asks the MAP what dates it covers and zeroes the
#               supplement itself, instead of trusting a constant about data
#   cache       ramayana.html must never outlive ramayana-map.json
Need   $page 'const MAP_HAS_78' 'the page derives its own basis from DATA.dates'
Need   $page 'function xTix()'  'the 7-8 Nov supplement goes through the guard'
Need   $page 'function xUsd()'  'the dollar supplement goes through the guard'
Need   $vercel 'max-age=0, must-revalidate' 'the page revalidates - never cached longer than its data'
# The unguarded shapes. If any of these come back, something reads US_EXTRA
# directly again and the double-count returns on the next basis change.
Absent $page 'US_EXTRA.tickets+CA.tickets' 'no unguarded US_EXTRA in the NA sum'
Absent $page '+US_EXTRA.usd+'              'no unguarded US_EXTRA in a dollar sum'
Absent $page 'DATA.total.sold+US_EXTRA.tickets' 'no unguarded US_EXTRA in the US tile'
Absent $vercel 'max-age=300'               'no 5-minute cache on a live tracker page'
Need $page 'handCount:1899'      'the retired hand count kept as the record'
# 19 Oct 22:26/22:40 re-read: 4,836 -> 4,922 on IDENTICAL inventory in both
# chains - HOYTS 419 sessions none new none gone none failed, Event 443 and
# the same 107,490 seats. All 86 is buying.
# 21 OCT 21:39-21:54 CT AU/NZ RE-READ: HOYTS 5,496 on the same 419 sessions,
# Event 1,535, Australia 7,031; NZ Event 314. Chadstone 797 = PB's hand read.
Need $page 'tickets:8000'        'Australia 8,000 after the 22 Oct re-read'
Absent $page 'tickets:7031,'     'no 21 Oct Australia total'
Absent $page 'tickets:5006,'     'no 20 Oct Australia total'
Absent $page 'tickets:4922,'     'no pre-Event-re-read Australian total'
# NEW ZEALAND FOLDED IN 20 OCT. The tile and every roll-up read
# "Australia & NZ" and use anzTix/anzUsd; AU.tickets stays Australia alone so
# the Australian panel keeps being about Australia. Only the four Australian
# dates roll up - Event NZ lists 5-11 Nov and sold 259 over the lot, 200 of
# them on 5-8 Nov. The other 59 are recorded, never added.
# 20 OCT, PB: ALL-PRESALE BASIS. Every date a market has on sale counts,
# because the whole run is presale. New Zealand is 5-11 Nov and all 259 are
# in. inBasis keeps the 5-8 Nov subset so the earlier figure stays checkable.
Need $page 'nz:{tickets:369'     'New Zealand on its full all-presale basis'
Absent $page 'nz:{tickets:314'   'no 21 Oct New Zealand'
Absent $page 'nz:{tickets:259'   'no 20 Oct New Zealand'
Need $page 'inBasis:285'         'the 5-8 Nov subset kept checkable'
Need $page 'secondWeek:84'       'the second-week NZ tickets named, not hidden'
Absent $page 'nz:{tickets:200'   'no four-date-only New Zealand'
Need $page 'anzTix'              'the roll-up uses the combined getter'
Need $page "'Australia & NZ'"    'the market is labelled for what is in it'
# INDIA WENT LIVE 20 OCT on District's own seat data. One platform, one
# INDIA, SECOND READ 20 OCT 09:02. 2,731 showtimes at 284 cinemas in 69
# cities - the footprint MORE THAN DOUBLED since 06:32, so 13,702 -> 24,588
# is mostly coverage and the panel says so. 49% is a standing block.
# The band is published the way the UK's is.
Need $page 'const IN = {'        'India is a counted market'
# THIRD INDIA READ, 20 Oct 21:5x - AND THE FIRST ONE WE CAN GRADE.
# district_shows.csv was snapshotted before the sweep overwrote it, so
# 2,680 showtimes appear in BOTH reads: 22,730 -> 38,769 over 12.8h.
# That +16,039 is BUYING. A further 449 showtimes are new and carry
# 7,770 - inventory, separated out rather than folded in.
# THE BLOCK BARELY MOVED: 11,971 -> 12,206 while everything else added
# twenty thousand. That is the strongest confirmation of the test we have.
# 21 OCT, TWO READS IN ONE NIGHT: 46,539 -> 50,758 (00:45) -> 64,696 (07:35).
# 3,054 showtimes appear in BOTH of last night's passes: 50,621 -> 60,162,
# so +9,541 is BUYING over 6h50m - about 1,397 an hour against 1,249 on the
# 20 Oct matched read. 128 new showtimes carried 4,534 and 34 dropped out
# holding 137, so the +13,938 headline is 68% buying.
#
# THE FIRST SOLD-OUT SHOWTIME IN INDIA. Every read before today returned
# zero across three thousand showtimes. soldOutShows must stay on the page:
# the day it goes back to a bare 0 we want to see it change, not discover it
# was quietly dropped.
# 21 OCT 20:59 CT, THE OVERNIGHT INDIA READ: 64,696 -> 76,227. 3,171 showtimes
# in both: 64,689 -> 74,559, +9,870 over 13.4h (India's night, so 737/hr is
# not a slowdown). 1,867 of it is one Amritsar cinema going full on all
# eight showtimes. Block re-run with the rebuilt room_block on both reads.
# 22 OCT 21:32 CT: 90,828 -> 91,171 on the same 3,402 showtimes (+362 / -19).
# Block same-rebuild delta 17,345 -> 16,758. All-India call re-run against
# Sacnilk 06:47 IST: Rs 8.17 Cr, 132,245 tickets.
# 23 OCT 08:48 CT: 91,171 -> 99,408. Matched 3,364 showtimes 90,057 -> 96,870
# (+7,862 on 962 / -1,049 on 60, 620 of it the Amritsar hold released);
# 170 new showtimes +2,538 coverage, 38 dropped -1,114. Block same-rebuild
# delta 16,758 -> 15,848. All-India call vs Sacnilk 4:50 PM IST: Rs 8.85 Cr,
# 142,810 tickets.
Need $page 'tickets:99408'       'the 23 Oct 08:48 CT India figure'
Absent $page 'tickets:91171,'    'no 22 Oct 21:32 India total as the live figure'
# ALL-INDIA CALL: District + BMS side from Sacnilk, city-by-city higher of
# the two. The worldwide total and the India map both use it.
Need $page 'allTix:142810'      'the all-India call is on the page'
Need $page 'allInr:88451710'   'and its rupees'
Absent $page 'allTix:132245'    'no 22 Oct all-India call'
Need $page 'IN.allTix+NL.tickets' 'the worldwide total uses the all-India call'
Need $page 'bmsCity:{'  'the India map carries the BookMyShow side city by city'
Need $page 'bmsOthers:[10068,5705192]' 'the unnamed-cities remainder is stated, not hidden'
Need $page 'clean:83560'         'the block-corrected floor'
Need $page 'block:15848'         'the block is named, not absorbed'
Need $page 'soldOutShows:2'      'two sold-out showtimes, Noida Gold and Nehru Place Insignia'
Need $page 'amritsarNow:2'       'the Amritsar release is tracked, not hidden'
Need $page 'wasTickets:91171'    'the 21:32 read is kept so the move can be described'
Need $page 'wasTickets8:46539'   'and the read the NA sweep destroyed'
Need $page 'matchedShows:3364'   'the matched set is published, not just the total'
Need $page 'buying:7862'         'buying is separated from coverage'
Need $page 'newShows:170'        'and the coverage is named'
Need $page 'wasPerHour:113'      'against the rate it replaced'
Absent $page 'tickets:90828,'    'no 18:18 India total as the live figure'
Absent $page 'tickets:82298,'    'no 06:22 India total as the live figure'
Absent $page 'tickets:76297,'    'no 23:47 India total as the live figure'
Absent $page 'tickets:46539,'    'no pre-21-Oct India total'
Absent $page 'tickets:50758,'    'no 00:45 India total as the live figure'
Absent $page 'tickets:24588,'    'no second-read India total'
Absent $page 'tickets:13702,'    'no first-read India total'
Absent $page 'atpInr:635'        'no third-read Indian price'
Absent $page 'atpInr:578'        'no second-read Indian price'
Absent $page 'atpInr:432'        'no first-read Indian price'
Absent $page 'tickets:64696,'    'no 07:35 India total as the live figure'
Absent $page 'atpInr:651'        'no 07:35 Indian price'
Absent $page 'clean:49868'       'no 07:35 India floor'
Absent $page 'block:14828'       'no 07:35 India block'
Absent $page ' buying:9541,'     'no 07:35 buying figure as the live one'
Absent $page 'buying:16039'      'no stale Indian buying figure as the live one'
Need $page 'bmsShows:2751'       'BookMyShow footprint after its own jump'
# THE BMS VENUE COUNT IS AN ARTIFACT. venueName and venueCode are EMPTY on
# every row of bms_shows.csv, so bms_sweep.py's "venues" figure is just its
# city count (37/37 here, 9/9 on the earlier read) and its chain column is a
# default string. Published as cities until the parser is fixed.
Absent $page 'bmsVenues'         'no BMS venue count - the parser does not read one'
Need $page 'bmsCities:37'        'BMS reported as cities, which is what it actually counts'
Need $page 'bmsCodes:4'          'four language tracks now listed, not two'
Need $page "['India',IN.allTix,IN.allUsd]" 'India row in the worldwide table is the all-India call'
Absent $page "sub:'presales opened 20 Oct', soon:true" 'India is no longer coming soon'
# PB, 20 OCT: THE PLATFORM IS NAMED IN THE FOOTER AND NOWHERE ELSE.
# The rendered labels say "one ticketing platform". These guards are literal
# string matches against the file, so they check the SOURCE of the rendered
# strings, not comments - the comment blocks still name it on purpose.
Absent $page "sub:'District only" 'the tile label must not name the platform'
Absent $page 'India - first count - District' 'the panel kicker must not name it'
Need $page 'India is District'   'the footer names the platform, once'
# THE NETHERLANDS AND SWEDEN, FIRST COUNT 20 OCT, read by hand like Germany.
# NL is the cleanest foreign read we have: the block test fires on 5 rooms
# for 36 seats, about 2%. Sweden is a MEASURED ZERO and is published as one.
Need $page 'const NL = {'        'the Netherlands is a counted market'
Need $page 'tickets:2175'        'the Netherlands seats-gone figure, 22 Oct matched re-read'
Absent $page 'tickets:1959,'     'no 21 Oct Netherlands total'
Absent $page '<b>1,959 seats gone</b>' 'no 21 Oct Netherlands copy'
Absent $page 'tickets:1546,'     'no 20 Oct Netherlands total'
Absent $page '1,546 seats gone' 'no 20 Oct Netherlands copy'
Absent $page 'Australia totals <b>5,006</b>' 'no 20 Oct Australia copy'
Need $page 'atpIsOurs:true'      'the Dutch price is ours, and flagged as ours'
Need $page "['Netherlands',NL.tickets,NL.usd]" 'the Netherlands is in the roll-up'
Need $page 'const SE = {'        'Sweden is on the page as a measured zero'
Need $page "['Sweden',SE.tickets,0]" 'Sweden is in the roll-up at zero, with a label'
Need $page 'Filmstaden'          'the unreadable Swedish chain is disclosed'
Absent $page "['Australia',AU.tickets,AU.usd]" 'no roll-up row on Australia alone'
Need $page 'tickets:6219'        'HOYTS 6,219'
Absent $page 'tickets:5496'      'no 21 Oct HOYTS'
Absent $page 'tickets:3864'      'no 20 Oct HOYTS'
Need $page 'tickets:1781'        'Event 1,781 on 421 sessions'
Absent $page 'tickets:1535'      'no 21 Oct Event'
Absent $page 'tickets:1142'      'no 20 Oct Event'
Absent $page 'tickets:1058,'     'no pre-re-read Event figure'
Absent $page 'tickets:4836,'     'no pre-re-read Australian total'
# 21 OCT THIRD GERMAN READ: 281 of 294 scannable showtimes carry a figure,
# 99 cinemas, 73 towns. 1,173 of the 2,023 are published SOLD (Compeso);
# 850 are one-state seats gone.
#
# THE TOTAL IS TWO READS AND THESE GUARDS EXIST TO KEEP IT HONEST. 191 rows
# were opened on 21 Oct. 90 more were read on 20 Oct and could not be opened
# again - one chain's booking site began refusing us and took 78 of them, and
# 12 showtimes are no longer listed. Those 90 keep their 20 Oct figure.
# carriedTickets must stay on the page: a blended total that hides which
# rows are stale is the thing we are guarding against.
Need $page 'tickets:2436'        'Germany 2,436, 22 Oct full re-read reconciled on our basis'
Absent $page 'tickets:2360,'     'no 21-22 Oct interim German total'
Absent $page 'tickets:2023,'     'no 21 Oct German total'
Need $page 'compeso:1280'        'the half of Germany that is a true sold count'
Need $page 'oneState:1156'        'the half that is only seats gone'
Need $page 'seats:67905'         'the German denominator moved with the rows'
Need $page 'carried:16,'         'the carried-forward rows are counted'
Need $page 'carriedTickets:91'  'and their tickets are named, not blended'
Absent $page 'tickets:1230,'     'no pre-re-read German total'
Absent $page 'tickets:1706,'     'no pre-21-Oct German total'
Absent $page 'compeso:976,'      'no pre-21-Oct Compeso figure'
Absent $page 'oneState:730,'     'no pre-21-Oct one-state figure'
Absent $page 'seats:67201,'      'no pre-21-Oct German denominator'
Absent $page 'priced:42,'        'no pre-21-Oct price coverage'
# GERMANY'S FIRST MEASURED VELOCITY. 187 showtimes read on both days against
# an unchanged footprint: 1,480 -> 1,789. That +309 is buying, and it is the
# only German number that is not part coverage. If it ever disappears from
# the page, the re-read was wasted.
Need $page 'matchedShows:261'    'the matched-read set is on the page'
Need $page 'buying:76'          'and the buying figure it produced'
# THE VERSION SPLIT IS A CORRECTION. 63 of 191 rows had our own isOV flag
# wrong, carrying 578 tickets, nearly all of them rows we called dubbed that
# the cinema calls the original. 1,073/633 was wrong and must never come back.
Need $page 'orig:1749'           'the corrected original-version figure'
Need $page 'flagsCorrected:63'   'and the count of rows our flag got wrong'
Absent $page 'orig:1073,'        'no pre-correction original figure'
Absent $page 'dub:633,'          'no pre-correction dub figure'
Absent $page '63% of every German sale' 'no pre-correction version share in copy'
Absent $page 'off 30% of the seats'     'no pre-correction seat share in copy'
# A THIRD LANGUAGE TRACK NOBODY HAD ASKED ABOUT. The worklist only ever
# recorded original-or-dubbed. The booking pages name Tamil: 32 of the 191
# showtimes, 17 cinemas, 16 towns. Every German figure before 21 Oct was
# reported as if this were a Hindi-and-dub market.
Need $page 'tamil:119'           'the Tamil track is on the page'
Need $page 'hindi:1194'          'and Hindi is stated beside it, not assumed'
Absent $page '384 tickets'       'no pre-21-Oct Munich figure in copy'
Absent $page '181 at one multiplex' 'no pre-21-Oct Main-Taunus figure in copy'
Need $page 'notYetOnSale:4'      'the 10 Nov rows are not-yet-bookable, not gone'
Need $page 'priced:51'           'priced coverage is 49% - no price was invented'
# The carry is RETIRED, not deleted: wasCarried keeps the 496 as the record,
# and carried:0 / carriedShows:1 is the one Sunnybank row still unread. The
# 18 Oct guard asked for carried:496 to stop anyone dropping those sessions;
# the sessions have now been read, so asking for it would pin a stale figure.
Need   $page 'wasCarried:496'    'the retired carry kept as the record'
Need   $page 'chadstoneRead:797' 'Chadstone scanned by our own reader, 797'
Need   $page 'chadstoneHand:797'  'PB 21 Oct hand read, matched seat for seat'
# 22:26 read every one of HOYTS' 419 sessions, so nothing is carried now.
Need   $page 'carriedShows:0'    'only the Sunnybank row is still carried'
# The denominator did NOT move. Chadstone's Xtremescreen reads 174 seat
# buttons where our reader counted 182, with unavailable still at 4 - a
# counting-method difference, not eight seats leaving the room. Cutting
# hy.seats to 70,475 would have printed 5.22% off a measurement artefact.
Need   $page 'seats:70459'       'HOYTS denominator from the full clean read'
Need   $page 'rate:8.83'         'HOYTS rate on its own real house count'
Need $page "['VIC',1873]"        'Victoria leads on a fully scanned Chadstone'
Absent $page "['VIC',1298]"      'no pre-re-read state split'
# ASCII only in these two. The page writes '153 screens · 9.81%' with a middot,
# but Windows PowerShell 5.1 reads a .ps1 saved as UTF-8 without a BOM as ANSI,
# which mangles the middot and fails the guard for a reason that has nothing to
# do with the page. Matching the rate and the screen count separately is just
# as tight and cannot break that way.
Need $page '11.17%'         'IMAX 4 Nov rate'
Need $page '154 screens'    'IMAX 4 Nov - 154 screens'
Need $page '33 screens'     'IMAX 6 Nov - 33 screens, not 32'
Need $page '8.18%'          'IMAX 6 Nov rate'
Need $page '7.29%'          'IMAX 5 Nov rate'
Absent $page '153 screens'  'no pre-re-sweep IMAX screen count'
Absent $page '10.48%'       'no pre-re-sweep IMAX 4 Nov rate'
Need $page '+DE.tickets'         'Germany is in the worldwide roll-up'
Need $page "['Germany',DE.tickets,DE.usd]" 'Germany has a worldwide row'
Need $page 'Kalki 2898 AD'       'verified ladder'
Need $page 'Dhurandhar 2'        'Dhurandhar 2 on the ladder'
Need $page 'ow:14000000'         'Dhurandhar 2 at its five-day opening'
Need $page '5-day opening run at' 'rebased trajectory'
Need $page 'Coming soon'         'plain wording for uncounted markets'

Write-Host ''
Write-Host '=== 2. the worldwide rename and the three-country maps'
Need $page '<h1>Ramayana Presales' 'page renamed'
Need $page 'Rest of world'       'worldwide ticket split'
Need $page 'const MKT='          'three-country map registry'
Need $page 'function worldMaps'  'country map thumbnails'
Need $page 'function mktFrame'   'expanding country frame'
Need $page 'id="worldmaps"'      'map row container'
Need $page 'id="mktframe"'       'expanded frame container'
Need $page 'id="napanels"'       'US panels are toggleable'
Need $page 'worldMaps(); }'      'maps painted on load'
Need $page 'M35.9,5.8'           'United Kingdom outline'
Need $page "me :{name:'Middle East'" 'Middle East tile in the map row'
Need $page "sea:{name:'SE Asia'"     'SE Asia tile in the map row'

Write-Host ''
Write-Host '=== 3. the homepage strip agrees with the page'
# 20 OCT: ALL-PRESALE BASIS, 4-12 NOV. The jump is inventory, not demand.
# UPDATE 17 STRIP. 49,434 + 0 + 3,719 + 1,323 = 54,476, valued at the
# format-blended $18.98 plus Canada's two chains: $1,003,831.
#
# THIS BLOCK IS WHY THE 21 OCT DEPLOY ABORTED, AND THE LESSON IS THE ONE
# ALREADY WRITTEN FURTHER UP THIS FILE. The retirements went in at the
# bottom of section 4 while these Need lines were left pointing at the old
# figures, so the file spent one run asking for '47,424' and forbidding it
# forty lines later. That is exactly what happened with 3,964 and 1,192 on
# 18 October. ONE NUMBER, ONE GUARD, ONE PLACE: when the strip moves, the
# Need lines here and the Absent lines in section 4 change together or not
# at all.
Need $app '70,005'     'NA all-presale total on the strip, 23 Oct 07:57 Landmark'
Absent $app '69,552'   'no 23 Oct 01:03 NA total'
Absent $app '67,711'   'no 22 Oct 21:51 NA total'
Absent $app '67,571'   'no 22 Oct 20:18 NA total'
Absent $app '63,789'   'no 22 Oct 08:22 NA total'
Absent $app '62,720'   'no 21 Oct 23:29 NA total'
Need $app '$1,301,693' 'NA value on the strip'
Absent $app '$1,295,822' 'no 23 Oct 01:03 NA value'
Absent $app '$1,261,466' 'no 22 Oct 21:51 NA value'
Absent $app '$1,259,652' 'no 22 Oct 20:18 NA value'
Absent $app '$1,187,432' 'no 22 Oct 08:22 NA value'
Absent $app '$1,166,372' 'no 21 Oct 23:29 NA value'
Absent $app '54,476'   'no 20 Oct NA total'
Absent $app '$1,003,831' 'no 20 Oct NA value'
Absent $app '47,398'   'no pre-Landmark-re-read NA total'
Absent $app '$875,667' 'no pre-Landmark-re-read NA value'
Absent $app '46,807'   'no pre-Canada-widening NA total'
Absent $app '$868,008' 'no pre-Canada-widening NA value'
Absent $app '46,157'   'no pre-Landmark NA total on the strip'
Absent $app '$859,584' 'no pre-Landmark NA value on the strip'
# Anchored to the FIELD, not the bare number: 10,539 and 3.19% also appear
# in the update-16 comment above the strip, so a bare marker would pass off
# the comment while the live value said anything at all.
Need $app 'shows: "11,203"'  'US 4-12 Nov showtimes on the strip'
Absent $app 'shows: "11,176"' 'no 22 Oct 20:18 showtime count'
Absent $app 'shows: "10,841"' 'no 22 Oct 08:22 showtime count'
Absent $app 'shows: "10,793"' 'no 21 Oct showtime count'
Absent $app 'shows: "10,661"' 'no 20 Oct showtime count'
Need $app '7:57am'     'the strip carries the scan time'
# rate is a 4-8 figure for the first time. For five updates it was US 4-6
# only, because the baked map stopped at 6 Nov and there was no 4-8
# denominator to divide by. There is one now: 33,668 of 904,291.
Need $app 'rate: "4.38%"'    'US 4-12 Nov sell-through on the strip'
Absent $app 'rate: "4.27%"' 'no 22 Oct 20:18 sell-through'
Absent $app 'rate: "4.11%"'  'no 22 Oct 08:22 sell-through'
Absent $app 'rate: "4.06%"'  'no 21 Oct sell-through'
Absent $app 'rate: "3.57%"'  'no 20 Oct sell-through'
Need $app 'T-14'       'countdown'

Write-Host ''
Write-Host '=== 4. what must NOT be there'
# Two wrong Dhurandhar figures. ow:23000000 is the two-week cume our own
# article elsewhere calls a "total through W2"; ow:10000000 is the Fri-Sun
# weekend, real but not an opening run.
Absent $page 'ow:23000000' 'no two-week cume in the opening-run column'
Absent $page 'ow:10000000' 'no 3-day figure in the opening-run column'
# The plain-English pass must not regress. All of these were printed on the
# page where readers could see them.
Absent $page '${DATA.basis}'       'no dedupe basis string shown to readers'
Absent $page 'robots.txt disallows' 'no robots talk in reader copy'
Absent $page 'HTTP 403'            'no status codes in reader copy'
Absent $page 'AMC-owned'           'no chain-ownership asides'
Absent $page 'not probed yet'      'uncounted markets say Coming soon'
# Stale UK figures from the part-run.
Absent $page 'tickets:2057' 'no part-run UK figure left behind'
Absent $page 'tickets:3466' 'no first-report UK figure left behind'
Absent $page 'tickets:7212' 'no stale US 7-8 Nov figure'
Absent $page 'tickets:7994' 'no pre-refresh US 7-8 Nov figure'
Absent $page 'tickets:1179' 'no stale Canada figure'
Absent $page 'tickets:1461' 'no stale Canada figure (18 Oct)'
# 1,473 was published for a day and reproduced from NO scan in intel\ - every
# real run of canada_tickets.py gave 28 or 29 auditoriums, never the 48 that
# constant claimed. 1,714 was the recovered FLOOR on the same data, correct as
# a minimum but not a count. Both are retired; neither comes back.
Absent $page 'tickets:1473' 'no unreproducible Canada figure'
Absent $page 'tickets:1714' 'no Canada floor published as a count'
Absent $page 'tickets:1912' 'no 18 Oct Canada floor published as a count'
# 1,899 was a real hand count of all 227 maps and was the right figure to
# publish on 18 Oct. It is retired because it is STALE, not because it was
# wrong - a different reason from the three above, and the comment matters so
# nobody "restores" it later thinking the floor was the suspect number.
Absent $page 'tickets:1899' 'no stale Canada hand count as the live figure'
Absent $page 'tickets:9362' 'no pre-update-11 US_EXTRA on the page'
Absent $page '9.31%'        'no pre-update-11 IMAX 4 Nov rate'
Absent $page '6.07%'        'no pre-update-11 IMAX 6 Nov rate'
Absent $page '6.27%'        'no pre-update-11 IMAX 5 Nov rate'
Absent $app  '32,245'       'no pre-update-11 NA total on the strip'
Absent $app  '$612,551'     'no pre-update-11 NA value on the strip'
# Update 11's own figures, now superseded by update 12.
Absent $page 'tickets:2102' 'no pre-update-12 Canada floor'
Absent $page 'tickets:9960' 'no pre-update-12 US_EXTRA'
Absent $page '9.81%'        'no pre-update-12 IMAX 4 Nov rate'
Absent $page '7.09%'        'no pre-update-12 IMAX 6 Nov rate'
Absent $page '6.47%'        'no pre-update-12 IMAX 5 Nov rate'
Absent $app  '34,213'       'no pre-update-12 NA total on the strip'
Absent $app  '$650,348'     'no pre-update-12 NA value on the strip'
Absent $app  '3.93%'        'no pre-update-12 sell-through on the strip'
Absent $app  '29,911'       'no pre-Canada NA total on the strip'
Absent $app  '$570,166'     'no pre-Canada NA value on the strip'
Absent $app  '30,337'       'no pre-update-10 NA total on the strip'
Absent $app  '$575,687'     'no pre-update-10 NA value on the strip'
Absent $page 'tickets:8869' 'no pre-update-10 US_EXTRA on the page'
Absent $page '7.45%'        'no pre-update-10 IMAX 4 Nov rate'
Absent $page 'tickets:952'  'no stale Australia figure'
Absent $page 'tickets:1486' 'no modelled Australia figure left behind'
Absent $page 'tickets:3500' 'no pre-refresh Australia figure'
# 3,964 was correct on 18 Oct. 4,101 and 4,102 are the two reads that DROPPED
# Chadstone's 28 HTTP-500 sessions - both are about 500 light and both make
# HOYTS look like it fell when it rose 357 like-for-like. Neither goes out.
Absent $page 'tickets:3964' 'no pre-update-12 Australia total'
Absent $page 'tickets:4101' 'no Chadstone-less Australia total'
Absent $page 'tickets:4102' 'no Chadstone-less Australia total'
Absent $page 'tickets:3119' 'no Chadstone-less HOYTS figure'
Absent $page 'tickets:3120' 'no Chadstone-less HOYTS figure'
Absent $page 'tickets:3900' 'no pre-19-Oct Australia figure'
Absent $page 'tickets:4598' 'no pre-Chadstone-read Australia total'
Absent $page "['VIC',1213]"  'no carried-Chadstone Victoria figure'
Absent $page 'tickets:3616' 'no pre-Chadstone-read HOYTS figure'
# 20 OCT RETIREMENTS.
Absent $page 'tickets:4658' 'no pre-full-read Australia total'
Absent $page 'tickets:3676' 'no carried-era HOYTS figure'
Absent $page "['VIC',1273]" 'no carried-era Victoria figure'
Absent $page 'tickets:5472,' 'no pre-re-read UK total'
Absent $page 'tickets:5766,' 'no batch-3 UK total'
Absent $page 'tickets:5940,' 'no batch-4 UK total'
Absent $page 'cwGone:5453,'  'no batch-4 Cineworld figure'
Absent $page "['Thu 5 Nov',2043]" 'no stale UK date split'
Absent $page "['Thu 5 Nov',2181]" 'no partial UK date split'
Absent $page "['Thu 5 Nov',2205]" 'no pre-21-Oct UK date split'
# The four dates must still sum to cwGone with nothing unallocated:
#   2,445 + 1,251 + 1,210 + 1,072 = 5,978
Need   $page "['Thu 5 Nov',2445]" 'the complete measured UK date split'
Need   $page "['Sun 8 Nov',1072]" 'and the last day of it, so the sum is checkable'
Need   $page 'byDateAdded'        'each day carries its own clean delta'
Absent $page 'cwGone:4985,'  'no pre-re-read Cineworld figure'
Absent $page 'cwGone:5279,'  'no batch-3 Cineworld figure'
# foot is BUILT from the constants now. It carried 4,985 and 2,619 as typed
# text through two re-reads while the headline above it moved twice.
Absent $page 'Cineworld is 4,985 of it' 'the footnote must be built, not typed'
# The 98 Feltham seats that moved from held to sold are NOT counted. If
# cwGone ever reads 5,232 it means someone added them, and 98 tickets
# nobody bought are in the UK total.
Need   $page 'byDateNote'     'the UK date column says what it does not cover'
Absent $page 'cwGone:5367'  'no relabelled seats counted as sales'
Absent $page 'tickets:5621' 'no batch-1 UK total'
Absent $page 'cwGone:5134'  'no batch-1 Cineworld figure'
Absent $page 'tickets:5707' 'no batch-2 UK total'
Absent $page 'cwGone:5220'  'no batch-2 Cineworld figure'
Absent $page 'tickets:1192' 'no pre-delta Germany total'
Absent $page 'tickets:1177' 'no pre-basis-change Germany total'
# EUR MOVES WITH THE DELTA NOW, AND THAT IS NOT A CHANGE OF POLICY.
# The 18 Oct guard said EUR must not move because none of the 22 new rows
# carried an adult price. That reasoning was wrong about our own figure. The
# published euro total, 22,553 over 1,192 tickets, is EXACTLY 18.92 - the
# stated atpEur - and that can only be true if the observed average was
# already being extended to every unpriced row. So the delta's 38 tickets at
# PB's EUR 18 median RESTORE consistency; leaving them at zero was the
# departure. 49% of German tickets carry a price the cinema printed, 51%
# carry ours, and the page says so in all three places a reader can see it.
# What this guard still protects: it must be 18, the median PB set, and it
# must be visible in the euro total. A silent 0 or a silent 18.92 both fail.
Need   $page 'eur:41733'    'German euros at their own observed EUR 17.21'
Absent $page 'eur:23237'    'no pre-re-read German euros'
Absent $page 'eur:29187'    'no pre-21-Oct German euro total'
Need   $page 'usd:46895'    'German dollars moved with the euros, at 1.1237'
Absent $page 'usd:32796'    'no pre-21-Oct German dollar total'
Need   $page 'atpEur:17.13' 'German ATP held steady across the third read'
Absent $page 'atpEur:17.11' 'no pre-21-Oct German ATP'
Absent $page 'eur:22553'    'no pre-delta German euro total'
Absent $page 'usd:25343'    'no pre-delta German dollar total'
Absent $page 'atpEur:18.92' 'no pre-delta German ATP'
# outSeats started life as 130 unexplained seats sitting between the German
# denominator and the byDate sum. An unnamed gap is how CineStar Emden hid
# for five scans, so naming it was the point. The 20 Oct read attributed it
# row by row - 3,662 seats of second week - and on 21 Oct the 9-11 Nov rows
# finally opened and got byDate rows of their own.
#
# SO outSeats IS NO LONGER A GAP. It is now the second-week subset of a
# denominator that reconciles exactly:
#     byDate seats 30,699 + 6,699 + 8,212 + 18,420 + 2,112 + 1,536 + 108
#                = 67,786 = seats, nothing left over
#     outSeats     2,112 + 1,536 + 108 = 3,756, carrying outBasis's 30
# The guard stays because the reconciliation is the thing worth protecting,
# not the gap it used to describe.
Need   $page 'outSeats:3756' 'the second-week seats are named and reconcile'
Absent $page 'outSeats:3662' 'no pre-21-Oct second-week seat count'
Absent $page 'tickets:3060' 'no pre-19-Oct HOYTS figure'
# UPDATE 14 RETIREMENTS. The 4-6 Nov basis and everything derived from it.
Absent $page 'tickets:10282' 'no live US_EXTRA - 7-8 Nov is in the map now'
Absent $page 'tickets:2172'  'no pre-19-Oct-16:21 Canada figure'
Absent $page '10.04%'        'no pre-update-14 IMAX 4 Nov rate'
Absent $page '152 screens'   'no pre-update-14 IMAX 4 Nov screen count'
Absent $page '7.26%'         'no pre-update-14 IMAX 6 Nov rate'
Absent $page '6.55%'         'no pre-update-14 IMAX 5 Nov rate'
Absent $page '4-6 November'  'no reader copy still splitting the US at 6 Nov'
Absent $app  '34,866'        'no pre-update-14 NA total on the strip'
Absent $app  '$662,617'      'no pre-update-14 NA value on the strip'
# Canada-only re-read, 19 Oct 21:56: 2,265 -> 2,449 on identical inventory.
Absent $app  '35,933'        'no pre-Canada-reread NA total on the strip'
Absent $app  '$686,704'      'no pre-Canada-reread NA value on the strip'
# UPDATE 15, the full North American re-sweep, 19 Oct 21:32. The map is
# rebaked, so the strip and the page must both come off that build and never
# off page_refresh.py, which is still hardwired to 4-6 Nov and printed a
# three-date total this run that is nowhere near the 4-8 figure.
Absent $app  '36,117'        'no pre-update-15 NA total on the strip'
Absent $app  '$689,089'      'no pre-update-15 NA value on the strip'
Absent $app  '3.72%'         'no pre-update-15 sell-through on the strip'
# UPDATE 17, 21 OCT 04:33Z. The map is rebuilt across all nine dates:
# 49,434 tickets, 1,383,690 seats, 10,661 showtimes, 549 venues, 69 metros,
# every one of them with an x/y so rebake_page.py did not refuse.
Need   $page '"sold":63243'  'the baked map is the 23 Oct 01:03 CT sweep, sold-out shows counted'
Absent $page '"sold":61537'  'no 22 Oct 20:18 baked map'
Absent $page '"sold":58019'  'no 22 Oct 08:22 baked map'
Absent $page '"sold":57053'  'no 21 Oct 23:29 baked map'
Absent $page '"sold":49434'  'no 21 Oct 04:33Z baked map'
Absent $page '"sold":43708'  'no pre-21-Oct baked map'
Need   $page '"2026-11-12"'  'the baked map carries the second week'
Absent $page '"sold":35540'  'no 4-8 Nov baked map'
Absent $page '"sold":33668'  'no pre-re-sweep baked map'
# UPDATE 17 STRIP. 49,434 + 0 + 3,719 + 1,323 = 54,476, and $1,003,831 is
# the map at the format-blended $18.98 plus Canada's two chains at flat C$18.
# The live pair is NOT Need-guarded here on purpose - section 6 recomputes it
# from the page and App.jsx, so a hardcoded Need would only ever go stale.
# These are the retirements, and App.jsx spells their digits out in words so
# these four guards cannot trip on its own record of them.
Absent $app  '47,424'        'no pre-update-17 NA total on the strip'
Absent $app  '$876,004'      'no pre-update-17 NA value on the strip'
# These two name the FIELD, not the bare number, and that is deliberate.
# 3.19% and 10,539 also appear in the update-16 comment block directly above
# the strip in App.jsx, where they are the record of what that build read.
# A bare Absent would fail on that record rather than on a mistake, and the
# fix would be to obfuscate our own history to satisfy a guard - which is
# backwards. Matching 'rate: "..."' and 'shows: "..."' catches a stale live
# value and cannot touch prose.
Absent $app  'rate: "3.19%"'   'no pre-update-17 sell-through on the strip'
Absent $app  'shows: "10,539"' 'no pre-update-17 showtime count on the strip'
Absent $app  '37,989'        'no pre-update-16 NA total on the strip'
Absent $app  '$726,991'      'no pre-update-16 NA value on the strip'
Absent $app  '3.88%'         'no 4-8 Nov sell-through on the strip'
Absent $page '4–8 November'  'no 4-8 Nov basis line left on the page'
Absent $page 'tickets:2265,' 'no pre-reread Canada ticket count'
Absent $page 'seats:66642'   'no pre-reread Canadian seat floor'
Absent $app  '4.01%'         'no 4-6 Nov sell-through on the strip'
# UK was a MODELLED midpoint of 2,103-9,253 until 19 Oct, when every
# Cineworld seat map was opened by hand. The midpoint was roughly double the
# block-corrected count. Neither it nor its raw partner comes back.
Absent $page 'tickets:5678'     'no UK modelled midpoint'
Absent $page 'rawTickets:11838' 'no UK pre-scan off-sale figure'
Absent $page 'loTickets:2103'   'no UK modelled low end'
Absent $page 'hiTickets:9253'   'no UK modelled high end'
Absent $page 'tickets:1177'     'no pre-all-presale Germany figure'
# Blocked revenue is NOTIONAL - nobody paid it. It is reported per market and
# never summed into a worldwide dollar total. If the UK blocked USD ever shows
# up inside a worldwide figure, that figure is wrong by $152,042.
Absent $page 'wwUsd:946' 'no worldwide total inflated by notional block revenue'
# The old chip card duplicated the UK numbers under the map row, so clicking
# United States still left "Outside North America" showing Britain. One
# control now: the map row. The card and its paint() call are gone.
Absent $page 'id="intlcard"'  'no duplicate Outside North America card'
Absent $page 'worldMaps(); intl();' 'the duplicate card is not painted'
# Token leak.
Absent 'public\sitemap.xml' 'collage-week35-preview-LOCAL-ONLY' 'no LOCAL-ONLY file in the sitemap'
if (Test-Path 'public\collage-week35-preview-LOCAL-ONLY.html') {
  Write-Host '    FAIL  public\collage-week35-preview-LOCAL-ONLY.html exists - move it to local-only\'
  $fail = 1
} else { Write-Host '    ok    no LOCAL-ONLY file in public\' }

Write-Host ''
Write-Host '=== 5. the page sanity checks'
Need $page 'og:image' 'social tags present'
Need $page 'www.boxoffy.com/ramayana' 'canonical on www'

# The page headline is DATA.total.sold + US_EXTRA + CA. If the baked map is
# stale the page quietly understates, so check the sum rather than trusting it.
Write-Host ''
Write-Host '=== 6. the headline adds up'
$t = [IO.File]::ReadAllText((Resolve-Path $page))
$i = $t.IndexOf('"total":{"seats"')
if ($i -lt 0) { Write-Host '    FAIL  cannot find the baked map total'; $fail = 1 }
else {
  $seg = $t.Substring($i, 120)
  if ($seg -match '"sold":(\d+)') {
    $us = [int]$Matches[1]
    # Read US_EXTRA and Canada OUT OF THE PAGE rather than hardcoding them.
    # Hardcoding is why this check failed on 18 Oct for three markets that had
    # moved correctly - the guard went stale, not the data. Same for the strip
    # figure, which is now parsed from App.jsx.
    $ex = 0; $ca = 0; $strip = 0
    if ($t -match 'const US_EXTRA = \{tickets:(\d+)')   { $ex = [int]$Matches[1] }
    # 7-8 Nov day figures must agree with the US_EXTRA total they sit inside.
    if ($t -match '"2026-11-07":(\d+), "2026-11-08":(\d+)') {
      $d7 = [int]$Matches[1]; $d8 = [int]$Matches[2]
      if ($d7 + $d8 -ne $ex) {
        Write-Host "    FAIL  US_EXTRA says $ex but its days are $d7 + $d8 = $($d7+$d8)"
        $fail = 1
      }
    }
    if ($t -match 'const CA = \{[^}]*?tickets:(\d+)')   { $ca = [int]$Matches[1] }
    # LANDMARK, 20 Oct. Canada is TWO chains now and the strip carries both,
    # so this sum has to as well. The first time it did not, it failed a page
    # that was right - the guard was stale, not the data, which is the exact
    # failure mode the note above was written about.
    $lm = 0
    if ($t -match 'lm:\{tickets:(\d+)')                 { $lm = [int]$Matches[1] }
    $a = [IO.File]::ReadAllText((Resolve-Path $app))
    if ($a -match 'tickets:\s*"([\d,]+)"')              { $strip = [int](($Matches[1]) -replace ',','') }
    # US_EXTRA is ZERO from Update 14 on and that is correct, so zero is no
    # longer evidence of a failed parse here. CA and the strip must still be
    # non-zero - if either reads 0 the regex missed and the sum below is
    # meaningless rather than wrong.
    if ($ca -eq 0 -or $strip -eq 0) {
      Write-Host "    FAIL  could not parse CA ($ca) or the strip ($strip)"
      $fail = 1
    } else {
      $na = $us + $ex + $ca + $lm
      if ($na -eq $strip) {
        Write-Host "    ok    baked map $us + $ex + Cineplex $ca + Landmark $lm = $na, matches the strip"
      } else {
        Write-Host "    FAIL  baked map $us + $ex + $ca + $lm gives $na, but the strip says $strip"
        Write-Host '          run: python rebake_page.py, then fix src\App.jsx'
        $fail = 1
      }
    }
  } else { Write-Host '    FAIL  cannot read the baked map total'; $fail = 1 }
}

Write-Host ''
if ($fail -eq 1) { Write-Host '  One or more checks failed. NOT building.'; exit 1 }
Write-Host '  All checks passed.'
exit 0
