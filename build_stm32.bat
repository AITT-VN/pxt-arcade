@echo off
echo ========================================
echo STM32F4 Hardware Build Script
echo ========================================
echo.

REM Set environment variables
set PXT_FORCE_LOCAL=true
set PXT_DEBUG=1

echo Building for STM32F4...
echo.

REM Build the project for STM32F4
pxt build --hw stm32f401

echo.
echo ========================================
echo Build complete!
echo Check the built/ directory for output
echo ========================================
pause
