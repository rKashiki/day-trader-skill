@echo off
setlocal
cd /d "%~dp0"
title Clipper
if not exist ".venv\Scripts\python.exe" (
  echo Bitte zuerst setup_windows.bat ausfuehren.
  pause
  exit /b 1
)
set "PYTHONUTF8=1"
echo.
echo ==================================================
echo   Clipper: YouTube-Link oder Videodatei zu Clips
echo ==================================================
echo   Tipp: Du kannst auch eine Videodatei auf diese
echo   Datei ziehen.
echo.
if "%~1"=="" (
  ".venv\Scripts\python.exe" clip.py --open
) else (
  ".venv\Scripts\python.exe" clip.py "%~1" --open
)
echo.
pause
