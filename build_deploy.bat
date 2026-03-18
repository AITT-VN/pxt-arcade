@echo off
REM ========================================
REM OhStem MakeCode Arcade - Build for Deployment
REM ========================================
echo.

REM Step 1: Build pxt-core from local pxt/ sources
echo [1/5] Building pxt-core from local sources...
cd /d "%~dp0..\pxt"
call npm run build
if errorlevel 1 (
    echo ERROR: pxt-core build failed!
    exit /b 1
)
echo pxt-core build complete.
echo.

REM Step 2: Link local pxt-core into pxt-arcade
echo [2/5] Linking local pxt-core...
cd /d "%~dp0"
if exist "node_modules\pxt-core" (
    rmdir "node_modules\pxt-core" 2>nul
    if exist "node_modules\pxt-core" (
        rmdir /s /q "node_modules\pxt-core"
    )
)
mklink /J "node_modules\pxt-core" "..\pxt"
if errorlevel 1 (
    echo ERROR: Failed to create junction link!
    exit /b 1
)
echo pxt-core linked.
echo.

REM Step 3: Build static package with minification
echo [3/5] Building static package with minification (this may take several minutes)...
set PXT_FORCE_LOCAL=true
call npx pxt staticpkg --minify
if errorlevel 1 (
    echo ERROR: staticpkg build failed!
    exit /b 1
)
echo Static package built.
echo.

REM Step 4: Clean up unnecessary docs from build output
echo [4/5] Cleaning up unnecessary docs...
if exist "built\packaged\docs\graveyard" rmdir /s /q "built\packaged\docs\graveyard"
if exist "built\packaged\docs\test" rmdir /s /q "built\packaged\docs\test"
echo Cleaned up graveyard and test docs.
echo.

REM Step 5: Create /static/ mapping for deployment
REM For local testing with http-server: use junction link
REM For AWS S3 + CloudFront: use CloudFront Function to rewrite /static/ -> /docs/static/
echo [5/5] Creating static path mapping for local testing...
if exist "built\packaged\static" rmdir /s /q "built\packaged\static" 2>nul
cd /d "%~dp0built\packaged"
mklink /J "static" "docs\static"
cd /d "%~dp0"
echo Static path junction created (for local testing only).
echo.

echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo Output: built\packaged\
echo.
echo For LOCAL testing:
echo   Junction link already created: /static/ -^> /docs/static/
echo.
echo For AWS S3 + CloudFront deployment:
echo   1. Delete the 'static' junction before uploading: rmdir built\packaged\static
echo   2. Upload built\packaged\ to S3
echo   3. Add CloudFront Function to rewrite /static/ -^> /docs/static/
echo.
