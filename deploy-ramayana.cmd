@echo off
setlocal enabledelayedexpansion
REM ===================================================================
REM  Boxoffy - DEPLOY THE RAMAYANA LIVE TRACKER
REM
REM      deploy-ramayana.cmd           copy + build + verify  (no push)
REM      deploy-ramayana.cmd push      ...then commit and push to main
REM
REM  Copies the three tracker files out of Downloads into public\, builds,
REM  and checks the build actually contains them. Nothing is pushed unless
REM  you pass "push" - a deploy should be a decision, not a side effect.
REM
REM  WHAT GOES WHERE
REM    public\ramayana.html        the tracker page (data baked in as fallback)
REM    public\ramayana-map.json    the live data the page polls every 2 min
REM    public\ramayana-og.png      the social card for link previews
REM
REM  vite copies public\ into dist\, and copy-public.cjs does it again, so
REM  public\ is the only place these belong. Do NOT put them in dist\ by
REM  hand - the next build wipes it.
REM
REM  ALREADY DONE, no action needed:
REM    vercel.json   /ramayana -> /ramayana.html, above the SPA catch-all
REM    src\App.jsx   homepage strip points at www.boxoffy.com/ramayana
REM ===================================================================
cd /d "%~dp0"
set DL=%USERPROFILE%\Downloads
set FAIL=0

echo.
echo === 1. copying from %DL%  (only files NEWER than the ones in public\)
REM xcopy /D, not copy /Y. Once these files live in the repo they get edited
REM there - the IMAX card, the Method text, a rebake after a sweep. A blind
REM copy from Downloads would silently throw all of that away and ship an
REM older page. /D copies only when the Downloads copy is genuinely newer.
for %%f in (ramayana.html ramayana-map.json ramayana-og.png) do (
  if exist "%DL%\%%f" (
    xcopy /D /Y /Q "%DL%\%%f" "public\" >nul
    if errorlevel 1 (
      echo     FAILED to copy %%f
      set FAIL=1
    ) else (
      echo     ok  public\%%f  ^(copied, or already newer in public^)
    )
  ) else (
    echo     not in Downloads: %%f  - using the copy already in public\
  )
)
if "%FAIL%"=="1" (
  echo.
  echo   Something did not copy. Fix that before building.
  exit /b 1
)

echo.
echo === 2. sanity check on the copied page
findstr /C:"og:image" "public\ramayana.html" >nul
if errorlevel 1 ( echo     WARNING: no og:image in ramayana.html ) else ( echo     ok  social tags present )
findstr /C:"www.boxoffy.com/ramayana" "public\ramayana.html" >nul
if errorlevel 1 ( echo     WARNING: canonical is not the www host ) else ( echo     ok  canonical on www )

echo.
echo === 3. building
call npm run build
if errorlevel 1 (
  echo.
  echo   BUILD FAILED - nothing copied to dist. Stopping.
  exit /b 1
)

echo.
echo === 4. verifying the build output
set MISS=0
for %%f in (ramayana.html ramayana-map.json ramayana-og.png) do (
  if exist "dist\%%f" ( echo     ok  dist\%%f ) else ( echo     MISSING dist\%%f & set MISS=1 )
)
if "%MISS%"=="1" (
  echo.
  echo   Files did not reach dist. Check copy-public.cjs and vite's publicDir.
  exit /b 1
)

echo.
if /i "%~1"=="push" (
  echo === 5. committing and pushing
  git add public\ramayana.html public\ramayana-map.json public\ramayana-og.png vercel.json src\App.jsx deploy-ramayana.cmd
  git commit -m "Ramayana live tracker: page, data, social card, /ramayana route"
  if errorlevel 1 echo     nothing to commit, continuing

  REM This repo's local branch is "main" but it tracks "master" on origin, so
  REM a bare `git push` refuses - git will not guess across a name mismatch.
  REM Read the configured upstream and push explicitly to it, rather than
  REM hardcoding master, so a later rename still works.
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
    echo     PUSH FAILED - deploy did not happen.
    echo     The commit is safe locally, nothing was lost.
    exit /b 1
  )
  echo.
  echo   Pushed. Vercel builds from origin/master; watch the deployment, then check:
) else (
  echo === 5. not pushing ^(run "deploy-ramayana.cmd push" to ship^)
  echo.
  echo   Local build is good. To ship:
  echo       git add public\ramayana.html public\ramayana-map.json public\ramayana-og.png vercel.json src\App.jsx
  echo       git commit -m "Ramayana live tracker"
  echo       git push origin HEAD:master
  echo   ^(local branch is "main" but origin's is "master", so a bare push refuses^)
  echo.
  echo   After it deploys, check:
)
echo       https://www.boxoffy.com/ramayana            tracker, not the React app
echo       https://www.boxoffy.com/ramayana-map.json   JSON, not index.html
echo       https://www.boxoffy.com/ramayana-og.png     the social card
echo.
echo   Then paste the page URL into an X composer and confirm the card shows
echo   the map picture. If it does not, X cached an older scrape - its Card
echo   Validator forces a refresh.
echo.
echo   LATER: publishing a new scan is just the JSON - no copy step, because
echo   mapstore.py already writes straight to public\ramayana-map.json.
echo       map-cycle.cmd ALL
echo       git add public\ramayana-map.json ^&^& git commit -m "scan" ^&^& git push origin HEAD:master
echo   Open tabs repaint within two minutes; the page itself is not rebuilt.
exit /b 0
