@echo off
setlocal EnableDelayedExpansion
REM ===================================================================
REM  Boxoffy - DEPLOY UPDATE 8
REM
REM      deploy-update8.cmd            verify + build + check   (no push)
REM      deploy-update8.cmd push       ...then commit and push to origin
REM
REM  WHAT IS IN THIS DEPLOY
REM    public\ramayana.html
REM      * "Outside North America" block - one card, chips, markets side by
REM        side. United Kingdom now leads the chips, then Australia, then the
REM        two markets we have not counted.
REM      * UNITED KINGDOM, COUNTED: 2,057 seats gone over 225 shows at 9
REM        cinemas, 3.35%, ~GBP 27,770 / ~US$36,803. Full country footprint
REM        101 cinemas and 1,438 shows.
REM      * AUSTRALIA: 1,486 tickets (Event 667 scanned + HOYTS 819 hand-read),
REM        ~A$45,390 / ~US$31,528 at prices we read off the site ourselves.
REM      * CANADA: 1,461 tickets on 227 showtimes at 26 Cineplex cinemas.
REM      * US 7-8 Nov carried in US_EXTRA: 7,994 tickets / $143,816.
REM      * PLAIN ENGLISH PASS. Everything a reader sees is now written for a
REM        reader. Gone from the visible page: the raw-dedupe basis string that
REM        was printed in the byline and footer, "robots.txt disallows",
REM        "HTTP 403", "AMC-owned", "denominator", "not probed yet". Markets we
REM        have not counted now simply say "Coming soon".
REM      * Trajectory on the FULL FIVE-DAY OPENING RUN (4-8 Nov), ladder built
REM        from verified figures only with each row carrying its own span.
REM    src\App.jsx
REM      * Homepage strip on the North America 4-8 Nov basis: 27,464 tickets,
REM        2.93%, 6,569 shows, $521,286, T-18.
REM
REM  RUN rebake_page.py FIRST if you have swept since the last bake. The page
REM  headline is DATA.total.sold + US_EXTRA + CA, so a stale map understates
REM  the total. At the last bake that sum was 18,009 + 7,994 + 1,461 = 27,464,
REM  which is what the homepage strip says.
REM
REM  NOTHING IS COPIED FROM Downloads. Every edit in this update was made in
REM  the repo, so a copy step could only overwrite good work with an older file.
REM
REM  STILL OUTSTANDING, not handled here:
REM    * public\ramayana-og.png still reads 13,992. Regenerate it from the live
REM      page (Share image -> Download PNG) or link previews will understate.
REM    * The TMDB bearer in src\App.jsx is still unrotated.
REM ===================================================================
cd /d "%~dp0"
set FAIL=0

echo.
echo === 1. checking the edits are actually in the files
call :need "public\ramayana.html"  "id=\"intlcard\""          "international block container"
call :need "public\ramayana.html"  "const INTL"               "market registry"
call :need "public\ramayana.html"  "const UK = {"             "United Kingdom data"
call :need "public\ramayana.html"  "function euBody"          "United Kingdom panel"
call :need "public\ramayana.html"  "function auBody"          "Australia panel"
call :need "public\ramayana.html"  "function pendingPanel"    "not-yet-counted panel"
call :need "public\ramayana.html"  "function openSpan"        "opening-run split"
call :need "public\ramayana.html"  "tickets:2057"             "UK 2,057 tickets"
call :need "public\ramayana.html"  "tickets:1486"             "Australia 1,486 tickets"
call :need "public\ramayana.html"  "tickets:1461"             "Canada 1,461 tickets"
call :need "public\ramayana.html"  "tickets:7994"             "US 7-8 Nov 7,994 tickets"
call :need "public\ramayana.html"  "Kalki 2898 AD"            "verified ladder"
call :need "public\ramayana.html"  "Dhurandhar 2"             "Dhurandhar 2 on the ladder"
call :need "public\ramayana.html"  "5-day opening run at"     "rebased trajectory"
call :need "public\ramayana.html"  "Coming soon"              "plain wording for uncounted markets"
call :need "src\App.jsx"           "27,464"                   "NA 4-8 total on the strip"
call :need "src\App.jsx"           "$521,286"                 "NA value on the strip"
call :need "src\App.jsx"           "T-18"                     "countdown"

echo.
echo === 2. checking what should NOT be there
REM --- the two wrong Dhurandhar figures -----------------------------
REM Dhurandhar 2 sits on the ladder at $14.0M, its five-day Wed-Sun opening.
REM   ow:23000000 - the two-week cume our own article elsewhere calls a
REM     "total through W2". The article's 7-day total of ~$16.5M proves it.
REM   ow:10000000 - the Friday-to-Sunday weekend. Real, but not an opening run.
call :absent "public\ramayana.html" "ow:23000000"  "no two-week cume in the opening-run column"
call :absent "public\ramayana.html" "ow:10000000"  "no 3-day figure in the opening-run column"
findstr /C:"ow:14000000" "public\ramayana.html" >nul
if errorlevel 1 (
  echo     FAIL  Dhurandhar 2 is not at its $14.0M five-day opening
  set FAIL=1
) else (
  echo     ok    Dhurandhar 2 on its five-day opening
)

REM --- the plain-English pass must not regress ----------------------
REM These all used to be printed on the page where readers could see them.
call :absent "public\ramayana.html" "${DATA.basis}"          "no dedupe basis string shown to readers"
call :absent "public\ramayana.html" "robots.txt disallows"  "no robots talk in reader copy"
call :absent "public\ramayana.html" "HTTP 403"              "no status codes in reader copy"
call :absent "public\ramayana.html" "AMC-owned"             "no chain-ownership asides"
call :absent "public\ramayana.html" "not probed yet"        "uncounted markets say Coming soon"

REM --- the token leak guard -----------------------------------------
call :absent "public\sitemap.xml" "collage-week35-preview-LOCAL-ONLY" "no LOCAL-ONLY file in the sitemap"
if exist "public\collage-week35-preview-LOCAL-ONLY.html" (
  echo     FAIL  public\collage-week35-preview-LOCAL-ONLY.html exists - move it to local-only\
  set FAIL=1
) else (
  echo     ok    no LOCAL-ONLY file in public\
)

echo.
echo === 3. the page's own sanity checks
findstr /C:"og:image" "public\ramayana.html" >nul
if errorlevel 1 ( echo     WARNING no og:image ) else ( echo     ok    social tags present )
findstr /C:"www.boxoffy.com/ramayana" "public\ramayana.html" >nul
if errorlevel 1 ( echo     WARNING canonical is not the www host ) else ( echo     ok    canonical on www )

if "%FAIL%"=="1" (
  echo.
  echo   One or more checks failed. NOT building. Fix the above first.
  exit /b 1
)

echo.
echo === 4. building
call npm run build
if errorlevel 1 (
  echo.
  echo   BUILD FAILED - nothing reached dist. Stopping.
  exit /b 1
)

echo.
echo === 5. verifying the build output carries the new page
set MISS=0
for %%f in (ramayana.html ramayana-map.json ramayana-og.png) do (
  if exist "dist\%%f" ( echo     ok    dist\%%f ) else ( echo     MISSING dist\%%f & set MISS=1 )
)
REM dist\ramayana.html must be the NEW page, not a stale copy vite kept.
findstr /C:"const UK = {" "dist\ramayana.html" >nul
if errorlevel 1 (
  echo     FAIL  dist\ramayana.html is missing the United Kingdom data
  echo           - check copy-public.cjs and vite's publicDir
  set MISS=1
) else (
  echo     ok    dist\ramayana.html is the updated page
)
if "%MISS%"=="1" (
  echo.
  echo   The build output is wrong. Not shipping it.
  exit /b 1
)

echo.
if /i "%~1"=="push" (
  echo === 6. committing and pushing
  git add public\ramayana.html src\App.jsx deploy-update8.cmd
  git commit -m "Ramayana Update 8: United Kingdom counted, plain-English pass" -m "Adds the United Kingdom to the international block as a counted market - 2,057 seats gone over 225 shows at 9 of 101 cinemas, 3.35%%, ~GBP 27,770 - and moves it ahead of Australia in the chips. Updates Australia to 1,486 tickets, Canada to 1,461 and the US 7-8 Nov block to 7,994. Rewrites everything a reader sees in plain English: removes the raw-dedupe basis string that was printed in the byline and footer, and replaces robots.txt, HTTP status codes and chain-ownership asides with Coming soon for markets we have not counted. Homepage strip moves to 27,464 / $521,286 / T-18."
  if errorlevel 1 echo     nothing to commit, continuing

  REM Local branch is "main" but it tracks "master" on origin, so a bare push
  REM refuses. Read the configured upstream instead of hardcoding it.
  set UPS=
  for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2^>nul') do set UPS=%%b
  if not defined UPS (
    echo     no upstream set - pushing to origin under the same branch name
    git push -u origin HEAD
  ) else (
    for /f "tokens=1,* delims=/" %%a in ("!UPS!") do (
      set REMOTE=%%a
      set RBRANCH=%%b
    )
    echo     upstream !UPS!  --^> git push !REMOTE! HEAD:!RBRANCH!
    git push !REMOTE! HEAD:!RBRANCH!
  )
  if errorlevel 1 (
    echo     PUSH FAILED - deploy did not happen. The commit is safe locally.
    exit /b 1
  )
  echo.
  echo   Pushed. Vercel builds from origin. Once it is live, check:
  echo       https://www.boxoffy.com/ramayana
  echo     - the Outside North America card opens on United Kingdom
  echo     - all four chips switch: UK / Australia / Middle East / SE Asia
  echo     - Middle East and SE Asia say "Coming soon", nothing technical
  echo     - the byline and footer no longer print a dedupe basis string
  echo     - the opening-run split reads 10,207 / 3,596 / 12,200
  echo     - the homepage strip reads 27,464 and T-18
  echo.
  echo   THEN regenerate the social card: open the live page, Share image,
  echo   Download PNG, overwrite public\ramayana-og.png and redeploy. It still
  echo   says 13,992 until you do.
) else (
  echo === 6. not pushing ^(run "deploy-update8.cmd push" to ship^)
  echo.
  echo   Everything checks out and the build is good.
)
echo.
exit /b 0

REM ---- helper: fail loudly if a marker is missing -------------------
:need
findstr /C:%2 %1 >nul
if errorlevel 1 (
  echo     FAIL  %~3 not found in %~1
  set FAIL=1
) else (
  echo     ok    %~3
)
goto :eof

REM ---- helper: fail loudly if something forbidden came back --------
:absent
findstr /C:%2 %1 >nul
if not errorlevel 1 (
  echo     FAIL  %~3 - found %~2 in %~1
  set FAIL=1
) else (
  echo     ok    %~3
)
goto :eof
