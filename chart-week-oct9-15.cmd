@echo off
setlocal
REM ===================================================================
REM  Boxoffy - FIX THE INDIA NATIONAL WEEKLY CHART
REM  Current week 9-15 Oct 2026. We hold 3 of 7 days (Fri/Sat/Sun).
REM
REM  RUN FROM THE BOXOFFY ROOT, next to chart_week_oct9-15-LOCAL-ONLY.py
REM
REM  WHAT WAS BROKEN
REM  ---------------
REM  The live chart was publishing -100% on all ten rows, ranking
REM  Drishyam 9th behind Vvan, and printing a header that read
REM  "WEEK 41 - JUN 5-7" in October.
REM
REM  Cause: weeklyCollection is a literal "0" for every charted film.
REM  The column names are correct and the sheet fetch works - nobody
REM  filled the week in. src\App.jsx already carries the matching code
REM  fixes (both-sides percentage guard, sort tiebreak, header date
REM  taken from the data instead of a hardcoded string).
REM
REM  WHY THREE STEPS AND NOT ONE
REM  ---------------------------
REM  Step 1 is a DRY RUN. It sends nothing. It prints the week computed
REM  two different ways plus the length of every URL it would send -
REM  which is the only thing that reliably goes wrong with this
REM  endpoint. A URL near 245 characters REACHES the Apps Script and
REM  writes NOTHING while still answering ok:true. Read step 1 before
REM  you let step 2 run.
REM
REM  Step 2 writes. Step 3 reads the sheet back and checks every value
REM  landed, so a silent no-op cannot pass as a success.
REM
REM  BEFORE YOU RUN - ONE DECISION
REM  -----------------------------
REM  3 days against a full week means the chart will read Drishyam
REM  -74%. It has NOT fallen 74% - it has four days left to run.
REM  The header says "Oct 9-11 (3/7)" and every row is noted, but if
REM  you would rather show NO percentage until Thursday, open
REM  chart_week_oct9-15-LOCAL-ONLY.py and set
REM
REM      BLANK_LAST_WEEK = True
REM
REM  then run this again. Re-run on Thu 15 Oct with the full week.
REM ===================================================================
cd /d "%~dp0"

if not exist chart_week_oct9-15-LOCAL-ONLY.py (
  echo.
  echo   chart_week_oct9-15-LOCAL-ONLY.py is not in this folder.
  echo   Put this .cmd in the boxoffy root next to it and re-run.
  echo.
  pause
  exit /b 1
)

echo.
echo ================================================================
echo  1 of 3   DRY RUN - nothing is sent
echo.
echo  Check three things in the output:
echo    - no row says "NOT POSITIVE, refusing"
echo    - no URL says "OVER LIMIT"
echo    - the ranking starts Drishyam, Premada Oorali, Comrade Kalyan
echo ================================================================
python chart_week_oct9-15-LOCAL-ONLY.py --dry-run
if errorlevel 1 (
  echo.
  echo   Dry run failed. Nothing was sent. Stopping here.
  pause
  exit /b 1
)

echo.
echo ================================================================
echo  Dry run finished. NOTHING HAS BEEN WRITTEN YET.
echo.
echo  This next step writes to the live sheet, which is what the
echo  public site reads. Close this window now if the output above
echo  looked wrong.
echo ================================================================
echo.
pause

echo.
echo ================================================================
echo  2 of 3   WRITING to the sheet
echo ================================================================
python chart_week_oct9-15-LOCAL-ONLY.py
if errorlevel 1 (
  echo.
  echo   The write reported a failure. Run step 3 anyway to see what
  echo   did land before re-running.
  echo.
)

echo.
echo ================================================================
echo  3 of 3   VERIFY - reading the sheet back
echo ================================================================
python chart_week_oct9-15-LOCAL-ONLY.py --verify

echo.
echo ================================================================
echo  DONE.
echo.
echo  Now hard-reload the site - Ctrl+F5 on www.boxoffy.com - and
echo  check the weekly chart:
echo.
echo    header reads      Oct 9-11 (3/7)     not WEEK 41 - JUN 5-7
echo    1st is            Drishyam           not Vvan
echo    no row shows      -100%%
echo    charted films     10, with Comrade Kalyan and Other Mommy in
echo                      and Meesaya Murukku 2 and Sigma out
echo.
echo  If "landed" was 0 and "empty" was high, the URLs truncated.
echo  Lower MAX_URL in the .py and run this again.
echo.
echo  PASTE BACK the [0] table and the [4] verify block. That is all
echo  I need to confirm it worked.
echo ================================================================
pause
endlocal
