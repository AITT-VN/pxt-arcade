@echo off
REM ========================================
REM OhStem MakeCode Arcade - Build for Deployment
REM ========================================
echo.

REM Step 1: Build pxt-core from local pxt/ sources
echo [1/4] Building pxt-core from local sources...
cd /d "%~dp0..\pxt"
call npm run build
if errorlevel 1 (
    echo ERROR: pxt-core build failed!
    exit /b 1
)
echo pxt-core build complete.
echo.

REM Step 2: Link local pxt-core into pxt-arcade
echo [2/4] Linking local pxt-core...
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

REM Step 3: Build static package
echo [3/4] Building static package (this may take several minutes)...
set PXT_FORCE_LOCAL=true
call npx pxt staticpkg
if errorlevel 1 (
    echo ERROR: staticpkg build failed!
    exit /b 1
)
echo Static package built.
echo.

REM Step 4: Copy docs/static to static for correct path mapping
echo [4/4] Copying static assets for deployment...
if exist "built\packaged\static" rmdir /s /q "built\packaged\static"
xcopy /E /I /Q "built\packaged\docs\static" "built\packaged\static" >nul
echo Static assets copied.
echo.

echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo Output: built\packaged\
echo Deploy this folder to your web server or S3.
echo.
