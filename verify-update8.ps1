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

Write-Host ''
Write-Host '=== 1. the edits are actually in the files'
Need $page 'const UK = {'        'United Kingdom data'
Need $page 'function euBody'     'United Kingdom panel'
Need $page 'function auBody'     'Australia panel'
Need $page 'function pendingPanel' 'not-yet-counted panel'
Need $page 'function openSpan'   'opening-run split'
Need $page 'tickets:5472'        'UK 5,472 seats gone, both chains'
Need $page 'cwGone:4985'         'Cineworld 4,985 measured by hand'
Need $page 'scGone:487'          'Showcase 487 modelled on the measured share'
Need $page 'soldShare:44.84'     'the share is measured now, not assumed'
Need $page 'offSale:11117'       'UK 11,117 off sale published beside it'
Need $page 'realLo:2619'         'UK real-bookings band published, not a point'
Need $page 'blockSeats:2366'     'UK house-seat exposure disclosed'
# The city list MUST stay block-corrected. On the seats-gone basis Solihull
# reads 462 and Feltham 281, and both are almost entirely one room's block -
# Solihull corrected is 6. A national total can carry blocks with a note; a
# named cinema cannot, because a reader can open the seat map and disprove it.
Need $page "['Leicester Square',472]" 'UK city list on the corrected basis'
Absent $page "['Solihull',462]"       'no block-inflated Solihull in the city list'
Absent $page "['Feltham',281]"        'no block-inflated Feltham in the city list'
Need $page 'tickets:3964'        'Australia 3,964 tickets (both chains, gate passed)'
Need $page 'tickets:1192'        'Germany 1,192 tickets (all-presale basis)'
Need $page 'booked:2619'         'UK organic booked figure published'
Need $page 'blockedAll:8498'     'UK blocked seats published'
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
Need $page 'tickets:1899'        'Canada 1,899 tickets (counted, not a floor)'
Need $page 'tickets:9362'        'US 7-8 Nov 9,362 tickets'
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
Need $app '32,245'     'NA 4-8 total on the strip'
Need $app '$612,551'   'NA value on the strip'
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
Absent $app  '29,911'       'no pre-Canada NA total on the strip'
Absent $app  '$570,166'     'no pre-Canada NA value on the strip'
Absent $app  '30,337'       'no pre-update-10 NA total on the strip'
Absent $app  '$575,687'     'no pre-update-10 NA value on the strip'
Absent $page 'tickets:8869' 'no pre-update-10 US_EXTRA on the page'
Absent $page '7.45%'        'no pre-update-10 IMAX 4 Nov rate'
Absent $page 'tickets:952'  'no stale Australia figure'
Absent $page 'tickets:1486' 'no modelled Australia figure left behind'
Absent $page 'tickets:3500' 'no pre-refresh Australia figure'
Absent $page 'tickets:3900' 'no pre-19-Oct Australia figure'
Absent $page 'tickets:3060' 'no pre-19-Oct HOYTS figure'
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
    if ($ex -eq 0 -or $ca -eq 0 -or $strip -eq 0) {
      Write-Host "    FAIL  could not parse US_EXTRA ($ex), CA ($ca) or the strip ($strip)"
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
