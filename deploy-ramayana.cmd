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
echo === 1. copying from %DL%
for %%f in (ramayana.html ramayana-map.json ramayana-og.png) do (
  if exist "%DL%\%%f" (
    copy /Y "%DL%\%%f" "public\%%f" >nul
    if errorlevel 1 (
      echo     FAILED to copy %%f
      set FAIL=1
    ) else (
      echo     ok  public\%%f
    )
  ) else (
    echo     MISSING in Downloads: %%f
    set FAIL=1
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
  git push
  if errorlevel 1 (
    echo     PUSH FAILED - deploy did not happen.
    exit /b 1
  )
  echo.
  echo   Pushed. Vercel builds from main; watch the deployment, then check:
) else (
  echo === 5. not pushing ^(run "deploy-ramayana.cmd push" to ship^)
  echo.
  echo   Local build is good. To ship:
  echo       git add public\ramayana.html public\ramayana-map.json public\ramayana-og.png vercel.json src\App.jsx
  echo       git commit -m "Ramayana live tracker"
  echo       git push
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
echo       git add public\ramayana-map.json ^&^& git commit -m "scan" ^&^& git push
echo   Open tabs repaint within two minutes; the page itself is not rebuilt.
exit /b 0
