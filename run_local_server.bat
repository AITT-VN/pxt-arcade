@echo off
REM set PXT_FORCE_LOCAL=true
REM Note: PXT_FORCE_LOCAL is disabled to allow cloud builds for STM32F4
echo Copying local translations...
rmdir /s /q built
rmdir /s /q %USERPROFILE%\.pxt\cache
node scripts/copyLocales.js
echo Starting PXT server with cloud build support...
pxt serve

