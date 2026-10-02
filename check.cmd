@echo off
REM Boxoffy pre-commit check — run from C:\Users\palla\boxoffy
REM Regenerates derived files, then fails loudly if anything would 404.

echo.
echo [1/3] Year archive pages
node generate-year-pages.cjs
if errorlevel 1 goto fail

echo [2/3] Sitemap
node generate-sitemap.cjs
if errorlevel 1 goto fail

echo [3/3] Integrity check
node check-links.cjs
if errorlevel 1 goto fail

echo.
echo OK - safe to commit. Remember: git status before git add.
exit /b 0

:fail
echo.
echo BLOCKED - fix the errors above. Do not commit.
exit /b 1
