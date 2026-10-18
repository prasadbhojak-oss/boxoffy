@echo off
setlocal EnableDelayedExpansion
REM ===================================================================
REM  Boxoffy - DEPLOY UPDATE 8
REM
REM      deploy-update8.cmd            verify + build        (no push)
REM      deploy-update8.cmd push       ...then commit and push to origin
REM
REM  The pre-flight checks live in verify-update8.ps1, not here. They used to
REM  be a pile of `call :need` + findstr in this file; cmd.exe re-reads a batch
REM  file by byte offset and mixing a CALLed label with `exit /b` inside a
REM  parenthesised block made it lose its place and replay whole sections.
REM  It also mangles arguments containing escaped quotes, so markers like
REM  id="worldmaps" never actually ran. PowerShell does literal matching with
REM  none of that.
REM
REM  WHAT IS IN THIS DEPLOY
REM    public\ramayana.html
REM      * RENAMED to "Ramayana Presales", leading on the WORLDWIDE total -
REM        tickets and value - with a four-way split underneath: North America
REM        / United Kingdom / Australia / Rest of world. Rest of world is a
REM        labelled zero, never a blank.
REM      * THREE MAPS, ONE OPEN AT A TIME. A row of country thumbnails - United
REM        States (Alaska and Hawaii inside it, not beside it), United Kingdom,
REM        Australia. Clicking one opens that country full width underneath.
REM        America hands back to the existing metro map and filters; Britain
REM        and Australia draw their own map and cinema list, and the North
REM        American filters hide while they are open.
REM      * UNITED KINGDOM, FULL RUN: 3,466 seats gone over 357 shows at 14
REM        cinemas, 3.72%, ~GBP 46,791 / ~US$62,012. Country footprint is
REM        101 cinemas and 1,438 shows.
REM      * AUSTRALIA 1,486 (Event 667 scanned + HOYTS 819 hand-read).
REM        CANADA 1,461 on 227 showtimes at 26 Cineplex cinemas.
REM        US 7-8 Nov carried in US_EXTRA: 7,994 tickets / $143,816.
REM      * PLAIN ENGLISH PASS. Gone from the visible page: the raw-dedupe basis
REM        string that was printed in the byline and footer, "robots.txt
REM        disallows", "HTTP 403", "AMC-owned", "denominator", "not probed
REM        yet". Markets we have not counted now say "Coming soon".
REM    src\App.jsx
REM      * Homepage strip: 27,464 tickets, 2.93%, 6,569 shows, $521,286, T-18.
REM
REM  STILL OUTSTANDING, not handled here:
REM    * public\ramayana-og.png still reads 13,992 - less than half the current
REM      worldwide count. Regenerate from the live page (Share image ->
REM      Download PNG) or every link preview understates.
REM    * The TMDB bearer in src\App.jsx is still unrotated.
REM ===================================================================
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "verify-update8.ps1"
if errorlevel 1 goto :stop

echo.
echo === 7. building
call npm run build
if errorlevel 1 (
  echo.
  echo   BUILD FAILED - nothing reached dist. Stopping.
  exit /b 1
)

echo.
echo === 8. verifying the build output carries the new page
set MISS=0
for %%f in (ramayana.html ramayana-map.json ramayana-og.png) do (
  if exist "dist\%%f" ( echo     ok    dist\%%f ) else ( echo     MISSING dist\%%f & set MISS=1 )
)
REM dist\ramayana.html must be the NEW page, not a stale copy vite kept.
findstr /C:"const MKT=" "dist\ramayana.html" >nul
if errorlevel 1 (
  echo     FAIL  dist\ramayana.html has no country maps - it is a stale copy
  echo           check copy-public.cjs and vite's publicDir
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
if /i "%~1"=="push" goto :push
echo === 9. not pushing ^(run "deploy-update8.cmd push" to ship^)
echo.
echo   Everything checks out and the build is good.
echo.
exit /b 0

:push
echo === 9. committing and pushing
git add public\ramayana.html src\App.jsx deploy-update8.cmd verify-update8.ps1
git commit -m "Ramayana Presales: worldwide headline, three-country maps, UK full run" -m "Renames the tracker to Ramayana Presales and leads on the worldwide total - 32,416 tickets, $615K - with a North America / United Kingdom / Australia / Rest of world split. Adds a row of country maps: United States with Alaska and Hawaii inside it, United Kingdom and Australia, each clicking through to its own full-width frame. United Kingdom completes at 3,466 seats over 357 shows at 14 cinemas. Moves the pre-flight checks out of cmd into verify-update8.ps1 after the batch version silently skipped every marker containing an escaped quote."
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
echo     - the worldwide headline reads 39,489 tickets and $738K
echo     - the four-way split reads NA 29,911 / UK 5,678 / AUS 3,900
echo     - the preview-night line under the title reads 10,989
echo     - the country row opens on United States
echo     - clicking United Kingdom hides the US filters and opens the UK frame
echo     - Australia's map pins read Sydney 1,521, not 782
echo     - Middle East and SE Asia say "Coming soon", nothing technical
echo     - the homepage strip reads 29,911 and T-18
echo.
echo   THESE FIGURES GO STALE. They are the 18 Oct 08:11 sweep. If you are
echo   reading them after a later sweep they are wrong - check the page
echo   against intel\page-refresh.txt, not against this text.
echo.
echo   THEN regenerate the social card: open the live page, Share image,
echo   LINK CARD, Download PNG. It saves itself as ramayana-og.png - drop it
echo   in public\ and push again. The card and its og: tags carry NO figures
echo   on purpose, so this is a one-time job, not a per-sweep one.
echo.
exit /b 0

:stop
echo.
echo   Fix the failures above, then run this again.
exit /b 1
