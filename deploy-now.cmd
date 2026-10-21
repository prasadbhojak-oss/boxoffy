@echo off
setlocal
REM ===================================================================
REM  Boxoffy - SHIP UPDATE 17
REM
REM      cd C:\Users\palla\boxoffy
REM      deploy-now.cmd
REM
REM  verify  ->  commit  ->  build + push.  In that order, and the first
REM  step is a GATE: if verify-update8.ps1 exits non-zero this stops and
REM  nothing is built, committed or pushed.
REM
REM  WHY THE COMMIT MESSAGE LIVES IN A FILE. cmd.exe mangles quotes and
REM  parentheses inside -m, and it has already cost us one broken run
REM  this week. git commit -F reads the message from intel\deploy-msg.txt
REM  and there is nothing left to escape.
REM
REM  WHY THE COMMIT COMES BEFORE deploy-ramayana.cmd. That script does its
REM  own `git add` of a fixed five-file list and commits it with a generic
REM  message. Committing first means the real message is the one that
REM  lands; its commit then finds nothing to do and it goes straight to
REM  the push.
REM
REM  ONE THING THIS DOES NOT DO: public\ramayana-og.png is still the
REM  16 October card, so the social preview will show old numbers until
REM  it is regenerated from the live page. Not a blocker, not forgotten.
REM ===================================================================
cd /d "%~dp0"
set LOG=intel\deploy-21oct.log
echo DEPLOY_START %DATE% %TIME%> "%LOG%"

if not exist intel\deploy-msg.txt (
  echo.
  echo   intel\deploy-msg.txt is missing - that is the commit message.
  echo   Stopping rather than committing something generic.
  echo.
  pause
  exit /b 1
)

echo.
echo ================================================================
echo  1 of 3   VERIFY. This is the gate. 280-odd literal checks on
echo           public\ramayana.html and src\App.jsx.
echo.
echo           Section 6 is the one to watch: it recomputes
echo           baked map + US_EXTRA + Cineplex + Landmark from the
echo           files themselves and fails if the strip disagrees.
echo           Expect: 49434 + 0 + 3719 + 1323 = 54476.
echo ================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File verify-update8.ps1 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -Append -FilePath %LOG%"

REM Tee eats the exit code, so ask PowerShell for it directly instead of
REM trusting errorlevel through the pipe.
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { .\verify-update8.ps1 | Out-Null; exit $LASTEXITCODE }"
if errorlevel 1 (
  echo.
  echo ================================================================
  echo   VERIFY FAILED. Nothing has been committed, built or pushed.
  echo   The live site is untouched.
  echo.
  echo   Scroll up for the FAIL line, or read %LOG%.
  echo   Send Claude the failing line - do not loosen the guard.
  echo ================================================================
  echo DEPLOY_ABORT_VERIFY %DATE% %TIME%>> "%LOG%"
  echo.
  pause
  exit /b 1
)
echo.
echo     verify passed.

echo.
echo ================================================================
echo  2 of 3   COMMIT, with the real message.
echo ================================================================
git add public\ramayana.html public\ramayana-map.json src\App.jsx ^
        verify-update8.ps1 run-district-loop.cmd deploy-now.cmd ^
        intel\deploy-msg.txt ^
        intel\ramayana_germany_worklist.csv ^
        intel\ramayana_germany_followup_20261021.csv ^
        intel\ramayana_germany_followup_brief.txt ^
        intel\ramayana_uk_cineworld_21oct_showtimes.csv ^
        intel\ramayana_uk_cineworld_21oct_by_cinema.csv ^
        intel\ramayana_uk_cineworld_21oct_by_date.csv ^
        intel\ramayana_landmark_canada_21oct.csv ^
        intel\ramayana_showcase_uk_grok_brief.txt ^
        intel\ramayana_showcase_uk_worklist.csv ^
        intel\ramayana_landmark_screenx_worklist.csv ^
        intel\ramayana_india_bms_district_datapack_20261021.md ^
        intel\ramayana-worldwide-update-21oct.txt ^
        intel\ramayana-worldwide-update-21oct-revenue.txt 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -Append -FilePath %LOG%"

git commit -F intel\deploy-msg.txt 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -Append -FilePath %LOG%"
if errorlevel 1 echo     nothing new to commit - carrying on to the push.

echo.
echo ================================================================
echo  3 of 3   BUILD AND PUSH.
echo.
echo           deploy-ramayana.cmd copies from Downloads first, but
echo           only with xcopy /D - newer-only. All three files there
echo           are from 16 October and the repo copies are newer, so
echo           nothing of today's work gets overwritten. Checked.
echo ================================================================
call deploy-ramayana.cmd push 2>&1 | powershell -NoProfile -Command "$input | Tee-Object -Append -FilePath %LOG%"
if errorlevel 1 (
  echo.
  echo   BUILD OR PUSH FAILED. The commit is safe locally; nothing is
  echo   lost. Read %LOG% and tell Claude what it said.
  echo DEPLOY_FAIL_PUSH %DATE% %TIME%>> "%LOG%"
  echo.
  pause
  exit /b 1
)

echo DEPLOY_DONE %DATE% %TIME%>> "%LOG%"
echo.
echo ================================================================
echo  SHIPPED. Vercel builds from origin/master - give it a minute.
echo.
echo  Then look at https://www.boxoffy.com/ramayana and check:
echo    strip         54,476 tickets, $1,003,831
echo    Germany       2,023, and the Tamil paragraph is there
echo    the UK        6,465, and the Bradford row is there
echo    Canada        3,719 Cineplex + 1,323 Landmark
echo.
echo  India still reads 46,539 on the page. That is correct and not a
echo  miss: the 50,758 from tonight's District run is deliberately not
echo  folded in yet, because run-district-loop.cmd has three more
echo  passes and the next one gives India its first matched pair.
echo ================================================================
echo.
pause
endlocal
