@echo off
setlocal
REM ===================================================================
REM  Boxoffy - DRISHYAM second weekend, District sweep
REM  Sat 10 Oct 2026 = Day 9.  Sun 11 Oct = Day 10.
REM
REM  RUN FROM THE BOXOFFY ROOT, next to india_district_sweep.py
REM
REM  WHY TWO DATES AND NOT JUST SATURDAY
REM  -----------------------------------
REM  Our week-1 reads were all taken the DAY BEFORE the show:
REM
REM    show 3 Oct (Sat, D2)  captured 2 Oct 12:33 IST
REM    show 4 Oct (Sun, D3)  captured 3 Oct 11:02 IST
REM
REM  It is now ~11:15 IST on Saturday. So:
REM
REM    - Sweeping 10 Oct gives a SAME-DAY Saturday read. Useful, but
REM      NOT comparable to the week-1 Saturday number, which was a
REM      day-before read. Same-day is always lower.
REM
REM    - Sweeping 11 Oct gives a day-before Sunday read taken on a
REM      Saturday morning - which is almost exactly how the week-1
REM      Sunday number was captured, 15 minutes apart in the day.
REM      THAT is the clean like-for-like.
REM
REM  So run both. The Sunday one is the number we grade against.
REM ===================================================================
cd /d "%~dp0"
if not exist india_district_sweep.py (
  echo.
  echo   india_district_sweep.py is not in this folder.
  echo   Put this .cmd in the boxoffy root next to it and re-run.
  echo.
  pause
  exit /b 1
)

echo.
echo ================================================================
echo  1 of 2   SATURDAY 10 OCT - Day 9 - same-day read
echo ================================================================
python india_district_sweep.py drishyam 2026-10-10

echo.
echo ================================================================
echo  2 of 2   SUNDAY 11 OCT - Day 10 - day-before read
echo  THIS is the one that compares cleanly to week 1.
echo ================================================================
python india_district_sweep.py drishyam 2026-10-11

echo.
echo ================================================================
echo  DONE.  intel\drishyam-2026-10-10  and  -2026-10-11
echo.
echo  PASTE BACK the === ALL INDIA === block from BOTH RUN.txt files,
echo  plus the === BY CHAIN === top few lines. That is all I need.
echo ================================================================
pause
endlocal
