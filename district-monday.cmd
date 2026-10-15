@echo off
REM ===================================================================
REM  Boxoffy - Monday 5 Oct 2026 comprehensive India read
REM  RUN THIS FROM THE BOXOFFY ROOT so every intel\ folder lands
REM  in the same place. Double-clicking it from anywhere else will
REM  scatter the output.
REM
REM  153 cities now, up from 50. Roughly 5 minutes per film.
REM  Drishyam runs FIRST because that is the number we grade today.
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
echo  1 of 4   DRISHYAM - Monday 5 Oct - the graded number
echo ================================================================
python india_district_sweep.py drishyam 2026-10-05

echo.
echo ================================================================
echo  2 of 4   VVAN - Monday 5 Oct
echo ================================================================
python india_district_sweep.py vvan 2026-10-05

echo.
echo ================================================================
echo  3 of 4   HANUMAN ANSH - Monday 5 Oct
echo ================================================================
python india_district_sweep.py hanuman 2026-10-05

echo.
echo ================================================================
echo  4 of 4   BOOKMYSHOW RECON - is a BMS sweep even possible
echo ================================================================
if exist bms_probe.py (
  python bms_probe.py drishyam
) else (
  echo   bms_probe.py not found, skipping.
)

echo.
echo ================================================================
echo  DONE. Folders written:
echo    intel\drishyam-2026-10-05
echo    intel\vvan-2026-10-05
echo    intel\hanuman-2026-10-05
echo    intel\bms-probe-2026-10-05
echo.
echo  Paste the === ALL INDIA === block from the Drishyam RUN.txt
echo  and the === VERDICT === block from the BMS probe.
echo ================================================================
pause
