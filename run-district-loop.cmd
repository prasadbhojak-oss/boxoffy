@echo off
setlocal enabledelayedexpansion
REM ===================================================================
REM  Boxoffy - RAMAYANA INDIA, DISTRICT ON A 3-HOUR LOOP
REM
REM      cd C:\Users\palla\boxoffy
REM      run-district-loop.cmd
REM
REM  Runs the District sweep NOW and then every 3 hours, four passes in
REM  all, then stops on its own. Close this window to stop it sooner.
REM
REM  WHY A LOOP AND NOT A SCHEDULED TASK. Nothing here needs Claude to be
REM  awake, the desktop app to be open, or a session to survive. The only
REM  thing it needs is this window left open and the machine not asleep.
REM  Fewer moving parts than anything that calls back out.
REM
REM  -------------------------------------------------------------------
REM  *** THIS FILE EXISTS BECAUSE THE LAST INDIA READ WAS DESTROYED ***
REM
REM  district_sweep.py writes into intel\ramayana-2026-11-05\. So does
REM  dunesday_seats.py, the North American sweep - it owns RUN.txt in
REM  that folder and it recreates the directory. On 20 October the NA
REM  sweep started at 22:27, 35 minutes after the India run finished,
REM  and took district_shows.csv AND the -prev- snapshot with it. The
REM  comment in run-india2.cmd said the two were safe to run side by
REM  side because the filenames do not collide. The filenames don't.
REM  The directory does. That was wrong and this is the fix.
REM
REM  Every read is copied straight out to
REM      intel\india-district-runs\district_shows-<stamp>.csv
REM  which nothing else writes to. The history survives whatever else
REM  runs, and a matched re-read is always possible because the previous
REM  file is always still there.
REM  -------------------------------------------------------------------
REM
REM  WHAT TO LOOK FOR, IN ORDER OF HOW MUCH IT MATTERS
REM
REM  1. A LANGUAGE THAT IS NOT HINDI. Step A prints every id District
REM     resolves. Every India figure we have published is a HINDI figure.
REM     Tamil has now turned up in Germany and the UK, Telugu in the UK
REM     and the United States, and India - where the film is from - is
REM     the one market whose data resolves no language at all. If Tamil
REM     or Telugu appears on this list, say so before any ticket count.
REM
REM  2. SHOWTIMES AND CINEMAS. 3,129 and 321 last read. If those are
REM     roughly flat, the whole move is BUYING and we can quote a rate.
REM     If they jump, most of the move is new inventory, as it was on
REM     20 October when the footprint more than doubled in three hours.
REM
REM  3. TICKETS AND RUPEES. 46,539 and Rs 2,95,74,423 last read.
REM
REM  4. CHENNAI, HYDERABAD, KOCHI. Zero on both platforms so far. Still
REM     zero means NOT LISTED, not no demand. Say it that way.
REM ===================================================================
cd /d "%~dp0"

if not exist district_sweep.py (
  echo.
  echo   district_sweep.py is not in this folder. Run this from
  echo   C:\Users\palla\boxoffy.
  echo.
  pause
  exit /b 1
)

python --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo   python is not on PATH. Nothing would run and the loop would
  echo   just spin, so stopping now instead.
  echo.
  pause
  exit /b 1
)

set KEEP=intel\india-district-runs
if not exist "%KEEP%" mkdir "%KEEP%"
set LOG=intel\scan-district-loop.log
echo LOOP_START %DATE% %TIME%>> "%LOG%"

set PASSES=4
for /L %%P in (1,1,%PASSES%) do (

  for /f %%S in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set STAMP=%%S

  echo.
  echo ================================================================
  echo  PASS %%P of %PASSES%   !STAMP!
  echo ================================================================
  echo PASS %%P !STAMP!>> "%LOG%"

  REM --- keep whatever is there before this run can overwrite it ------
  if exist "intel\ramayana-2026-11-05\district_shows.csv" (
    copy /y "intel\ramayana-2026-11-05\district_shows.csv" ^
            "%KEEP%\district_shows-before-!STAMP!.csv" >nul
    echo     saved the previous read to %KEEP%\district_shows-before-!STAMP!.csv
  ) else (
    echo     NOTE no district_shows.csv to save. Fine on a first run and
    echo          a problem on any other - it means something ate it.
  )

  echo.
  echo  A of B   resolve ids only. Writes nothing.
  echo           READ THIS LIST. A language that is not Hindi is a
  echo           bigger finding than any ticket count.
  echo ----------------------------------------------------------------
  python district_sweep.py --film ramayana --ids 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -Append -FilePath %LOG%"

  echo.
  echo  B of B   the sweep. Seats and rupees.
  echo           Gate: 46,539 tickets or higher. A fall is a scan
  echo           failure, not a market going backwards - stop and look.
  echo ----------------------------------------------------------------
  python district_sweep.py --film ramayana 2026-11-05 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -Append -FilePath %LOG%"

  REM --- and copy the fresh read somewhere nothing else writes --------
  if exist "intel\ramayana-2026-11-05\district_shows.csv" (
    copy /y "intel\ramayana-2026-11-05\district_shows.csv" ^
            "%KEEP%\district_shows-!STAMP!.csv" >nul
    echo.
    echo     this read is now also at
    echo     %KEEP%\district_shows-!STAMP!.csv
    echo     Nothing else writes to that folder. It cannot be eaten.
  ) else (
    echo.
    echo     *** THE SWEEP PRODUCED NO district_shows.csv. ***
    echo     Do not treat a missing file as a zero. Check the log above.
  )

  if %%P LSS %PASSES% (
    echo.
    echo ----------------------------------------------------------------
    echo  Pass %%P done. Sleeping 3 hours, then pass up to %PASSES%.
    echo  Close this window to stop. Nothing is lost if you do - every
    echo  read is already saved in %KEEP%.
    echo ----------------------------------------------------------------
    timeout /t 10800 /nobreak
  )
)

echo.
echo LOOP_END %DATE% %TIME%>> "%LOG%"
echo ================================================================
echo  All %PASSES% passes done.
echo.
echo  Every read:   %KEEP%\
echo  The log:      %LOG%
echo.
echo  TELL CLAUDE, IN THIS ORDER:
echo    1. every District id and its language - Tamil or Telugu first
echo    2. showtimes and cinemas, flat or growing
echo    3. tickets and rupees
echo    4. whether Chennai, Hyderabad and Kochi are still absent
echo ================================================================
pause
endlocal
