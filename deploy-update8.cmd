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
REM        side: Australia / Middle East / Europe / SE Asia. Markets we have
REM        not counted are SHOWN as "not probed yet" rather than hidden.
REM      * Australia panel: 952 tickets counted (Event 666 scanned + HOYTS 286
REM        hand-read), ~A$30K / ~US$21K at OBSERVED prices.
REM      * Opening-run split above the ladder: previews 4 Nov / opening day
REM        5 Nov / weekend 6-8 Nov, with the five-day total.
REM      * Trajectory rebased to the FULL FIVE-DAY OPENING RUN (4-8 Nov).
REM      * Benchmark ladder rebuilt from VERIFIED figures only, each row
REM        carrying its own span. Dhurandhar dropped - could not be verified.
REM      * Method section gained an Australia paragraph.
REM    src\App.jsx
REM      * Homepage strip moved to the North America 4-8 Nov basis so it can
REM        no longer disagree with the page it links to. T-18 corrected to T-19.
REM
REM  NOTHING IS COPIED FROM Downloads. Unlike deploy-ramayana.cmd, every edit
REM  in this update was made in the repo, so a copy step could only overwrite
REM  good work with an older file. If you have a newer ramayana.html sitting
REM  in Downloads, deal with it by hand before running this.
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
REM Each marker is something only this update introduces. If one is missing the
REM file on disk is not the file that was verified, and we stop rather than
REM shipping a half-applied page.
call :need "public\ramayana.html"  "id=\"intlcard\""          "international block container"
call :need "public\ramayana.html"  "const INTL"               "market registry"
call :need "public\ramayana.html"  "function auBody"          "Australia panel"
call :need "public\ramayana.html"  "function pendingPanel"    "not-yet-counted panel"
call :need "public\ramayana.html"  "function openSpan"        "opening-run split"
call :need "public\ramayana.html"  "Kalki 2898 AD"            "verified ladder"
call :need "public\ramayana.html"  "Dhurandhar 2"             "Dhurandhar 2 on the ladder"
call :need "public\ramayana.html"  "5-day opening run at"     "rebased trajectory"
call :need "src\App.jsx"           "T-19"                     "corrected countdown"
call :need "src\App.jsx"           "25,000"                   "NA 4-8 basis on the strip"

echo.
echo === 2. checking what should NOT be there
REM Dhurandhar 2 sits on the ladder at $14.0M, its five-day Wed-Sun opening.
REM TWO WRONG FIGURES MUST NEVER COME BACK IN THAT COLUMN:
REM   ow:23000000 - the $23M+ our own article calls a "5-Day Extended Opening"
REM     while elsewhere calling the same number a "total through W2". It is the
REM     cume. The article's own 7-day total of ~$16.5M proves it, and TheWrap
REM     had the film at $22.7M only on day 10.
REM   ow:10.0e6 / ow:10000000 - the Friday-to-Sunday weekend, which is real but
REM     is not an opening run and must not sit in this column.
findstr /C:"ow:23000000" "public\ramayana.html" >nul
if not errorlevel 1 (
  echo     FAIL  the $23M two-week cume is back in the opening-run column
  set FAIL=1
) else (
  echo     ok    no cume masquerading as an opening
)
findstr /C:"ow:10000000" "public\ramayana.html" >nul
if not errorlevel 1 (
  echo     FAIL  Dhurandhar's 3-day $10.0M is back in the opening-run column
  set FAIL=1
) else (
  echo     ok    no 3-day figure sitting in the opening-run column
)
findstr /C:"ow:14000000" "public\ramayana.html" >nul
if errorlevel 1 (
  echo     FAIL  Dhurandhar 2 is not at its $14.0M five-day opening
  set FAIL=1
) else (
  echo     ok    Dhurandhar 2 on its five-day opening
)
findstr /C:"collage-week35-preview-LOCAL-ONLY" "public\sitemap.xml" >nul
if not errorlevel 1 (
  echo     FAIL  the LOCAL-ONLY preview is back in sitemap.xml - it leaks a token
  set FAIL=1
) else (
  echo     ok    no LOCAL-ONLY file in the sitemap
)
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
findstr /C:"const INTL" "dist\ramayana.html" >nul
if errorlevel 1 (
  echo     FAIL  dist\ramayana.html is missing the international block
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
  git commit -m "Ramayana Update 8: Australia counted, international block, verified opening-run ladder" -m "Adds an Outside North America block with Australia counted (952 tickets: Event 666 scanned, HOYTS 286 hand-read) and Middle East, Europe and SE Asia shown as not yet counted. Rebases the trajectory onto the full five-day opening run and rebuilds the benchmark ladder from verified figures only, each row labelled with its own span. Drops Dhurandhar for lack of a verifiable source. Corrects the homepage strip to the NA 4-8 Nov basis and T-18 to T-19."
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
  echo     - the Outside North America card, all four chips switch
  echo     - the opening-run split reads 9,363 / 3,457 / 11,001
  echo     - the ladder shows a span under every dollar figure
  echo     - the homepage strip reads 25,000 and T-19
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
