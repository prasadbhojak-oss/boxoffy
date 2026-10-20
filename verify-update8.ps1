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
Need $page 'tickets:5707'        'UK 5,707 after the 20 Oct batch-2 re-read'
Need $page 'cwGone:5220'         'Cineworld 5,220 after the 20 Oct batch-2 re-read'
Need $page 'scGone:487'          'Showcase 487 modelled on the measured share'
Need $page 'soldShare:44.84'     'the share is measured now, not assumed'
Need $page 'offSale:11352'       'UK off sale published beside it'
Need $page 'realLo:2854'         'UK real-bookings band published, not a point'
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
Need $page 'booked:2854'         'UK organic booked figure published'
Need $page 'blockedAll:8351'     'UK blocked seats published'
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
Need $page 'tickets:2265'        'Canada 2,265 (recovered floor, labelled as a floor)'
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
Need $page 'tickets:4836'        'Australia 4,836 (Chadstone answering, full clean read)'
Need $page 'tickets:1230'        'Germany 1,230 after the 19 Oct delta'
Need $page 'notYetOnSale:4'      'the 10 Nov rows are not-yet-bookable, not gone'
Need $page 'priced:49'           'priced coverage fell to 49% - no price was invented'
# The carry is RETIRED, not deleted: wasCarried keeps the 496 as the record,
# and carried:0 / carriedShows:1 is the one Sunnybank row still unread. The
# 18 Oct guard asked for carried:496 to stop anyone dropping those sessions;
# the sessions have now been read, so asking for it would pin a stale figure.
Need   $page 'wasCarried:496'    'the retired carry kept as the record'
Need   $page 'chadstoneRead:564' 'Chadstone scanned by our own reader, 564'
Need   $page 'chadstoneHand:556'  'the hand count kept as the record it validated'
Need   $page 'carriedShows:1'    'only the Sunnybank row is still carried'
# The denominator did NOT move. Chadstone's Xtremescreen reads 174 seat
# buttons where our reader counted 182, with unavailable still at 4 - a
# counting-method difference, not eight seats leaving the room. Cutting
# hy.seats to 70,475 would have printed 5.22% off a measurement artefact.
Need   $page 'seats:70335'       'HOYTS denominator from the full clean read'
Need   $page 'rate:5.42'         'HOYTS rate on its own real house count'
Need $page "['VIC',1298]"        'Victoria leads on a fully scanned Chadstone'
# ASCII only in these two. The page writes '153 screens · 9.81%' with a middot,
# but Windows PowerShell 5.1 reads a .ps1 saved as UTF-8 without a BOM as ANSI,
# which mangles the middot and fails the guard for a reason that has nothing to
# do with the page. Matching the rate and the screen count separately is just
# as tight and cannot break that way.
Need $page '10.48%'         'IMAX 4 Nov rate'
Need $page '153 screens'    'IMAX 4 Nov - 153 screens'
Need $page '33 screens'     'IMAX 6 Nov - 33 screens, not 32'
Need $page '7.39%'          'IMAX 6 Nov rate'
Need $page '6.78%'          'IMAX 5 Nov rate'
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
Need $app '35,933'     'NA 4-8 total on the strip'
Need $app '$686,704'   'NA value on the strip'
# rate is a 4-8 figure for the first time. For five updates it was US 4-6
# only, because the baked map stopped at 6 Nov and there was no 4-8
# denominator to divide by. There is one now: 33,668 of 904,291.
Need $app '3.72%'      'US 4-8 Nov sell-through on the strip'
Need $app 'T-17'       'countdown'

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
Absent $page 'tickets:5472' 'no pre-re-read UK total'
Absent $page 'cwGone:4985'  'no pre-re-read Cineworld figure'
# The 98 Feltham seats that moved from held to sold are NOT counted. If
# cwGone ever reads 5,232 it means someone added them, and 98 tickets
# nobody bought are in the UK total.
Need   $page 'relabelled:147' 'the held-to-sold relabel is named, not absorbed'
Absent $page 'cwGone:5367'  'no relabelled seats counted as sales'
Absent $page 'tickets:5621' 'no batch-1 UK total'
Absent $page 'cwGone:5134'  'no batch-1 Cineworld figure'
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
Need   $page 'eur:23237'    'German euros carry the 38 new tickets at EUR 18'
Need   $page 'usd:26111'    'German dollars moved with the euros, at 1.1237'
Need   $page 'atpEur:18.89' 'German ATP eased as the cheaper delta came in'
Absent $page 'eur:22553'    'no pre-delta German euro total'
Absent $page 'usd:25343'    'no pre-delta German dollar total'
Absent $page 'atpEur:18.92' 'no pre-delta German ATP'
# outSeats is the 130 seats that are in the German denominator but in no
# byDate row - the 9-11 Nov rows, which carry outBasis's 13 tickets. It was
# an unexplained gap between seats and the byDate sum until 19 Oct. Naming it
# is the point: an unnamed gap is how CineStar Emden hid for five scans.
Need   $page 'outSeats:130' 'the seat-side gap is named, not silent'
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
      $na = $us + $ex + $ca
      if ($na -eq $strip) {
        Write-Host "    ok    baked map $us + $ex + $ca = $na, matches the strip"
      } else {
        Write-Host "    FAIL  baked map $us gives $na, but the strip says $strip"
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
