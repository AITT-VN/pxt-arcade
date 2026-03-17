@echo off
REM Script to build and cache hex files for STM32F4 templates
REM This enables web UI downloads without a build server

echo ========================================
echo STM32F4 Hex Cache Builder
echo ========================================
echo.

set TEMPLATE_DIR=%1
set CACHE_DIR=..\built\hexcache

if "%TEMPLATE_DIR%"=="" (
    echo Usage: build_and_cache.bat ^<template-directory^>
    echo Example: build_and_cache.bat my-game
    exit /b 1
)

if not exist "%TEMPLATE_DIR%" (
    echo Error: Template directory "%TEMPLATE_DIR%" not found
    exit /b 1
)

echo Building template: %TEMPLATE_DIR%
cd %TEMPLATE_DIR%

REM Build for STM32F4
echo.
echo [1/3] Building for STM32F401...
pxt build --hw stm32f401
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

REM Get the project hash (this is what PXT uses for cache filenames)
echo.
echo [2/3] Calculating project hash...
for /f "delims=" %%i in ('pxt gethash') do set PROJECT_HASH=%%i

if "%PROJECT_HASH%"=="" (
    echo Warning: Could not get project hash, using timestamp
    set PROJECT_HASH=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
    set PROJECT_HASH=%PROJECT_HASH: =0%
)

echo Project hash: %PROJECT_HASH%

REM Copy hex file to cache
echo.
echo [3/3] Copying to hex cache...
if not exist "%CACHE_DIR%" mkdir "%CACHE_DIR%"

REM PXT uses .hex files in the cache, but we have .uf2
REM We need to convert or use the hex file if available
if exist "built\binary.hex" (
    copy /Y "built\binary.hex" "%CACHE_DIR%\%PROJECT_HASH%.hex"
    echo Cached: %PROJECT_HASH%.hex
) else if exist "built\binary.uf2" (
    REM UF2 files can be used directly by some targets
    copy /Y "built\binary.uf2" "%CACHE_DIR%\%PROJECT_HASH%.uf2"
    echo Cached: %PROJECT_HASH%.uf2
    echo Warning: No .hex file found, cached .uf2 instead
) else (
    echo Error: No binary output found in built/
    exit /b 1
)

cd ..

echo.
echo ========================================
echo Success! Template cached for web UI
echo ========================================
echo.
echo To use this template in the web UI:
echo 1. Create a new project
echo 2. Copy the code from %TEMPLATE_DIR%
echo 3. Click Download - it should use the cached hex
echo.
