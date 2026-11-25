@echo off
setlocal
cd /d "%~dp0"
title Clipper - Einrichtung
echo.
echo ==================================================
echo   Clipper - Einrichtung (einmalig)
echo ==================================================
echo.

rem ---- Python suchen (3.12 empfohlen) ----
set "PY="
for %%V in (3.12 3.13 3.11) do (
  if not defined PY (
    py -%%V -c "import sys" >nul 2>nul && set "PY=py -%%V"
  )
)
if not defined PY (
  echo Python 3.12 wird installiert ...
  winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
  echo.
  echo Python wurde installiert. Bitte dieses Fenster schliessen und
  echo setup_windows.bat noch einmal starten.
  pause
  exit /b 1
)
echo Python gefunden: %PY%

rem ---- ffmpeg und Deno (fuer YouTube) ----
set "RESTART="
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo ffmpeg wird installiert ...
  winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
  set "RESTART=1"
) else (
  echo ffmpeg gefunden.
)
where deno >nul 2>nul
if errorlevel 1 (
  echo Deno wird installiert ^(braucht yt-dlp fuer YouTube^) ...
  winget install -e --id DenoLand.Deno --accept-source-agreements --accept-package-agreements
  set "RESTART=1"
) else (
  echo Deno gefunden.
)

rem ---- Eigene Python-Umgebung mit allen Paketen ----
if not exist ".venv\Scripts\python.exe" (
  echo.
  echo Lege die Python-Umgebung an ...
  %PY% -m venv .venv
  if errorlevel 1 goto :fail
)
echo.
echo Installiere Pakete ^(das dauert beim ersten Mal ein paar Minuten^) ...
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install --upgrade -r requirements.txt
if errorlevel 1 goto :fail

where nvidia-smi >nul 2>nul
if not errorlevel 1 (
  echo.
  echo Nvidia-Grafikkarte gefunden. Installiere CUDA-Bibliotheken ^(ca. 1 GB^) ...
  ".venv\Scripts\python.exe" -m pip install --upgrade -r requirements-gpu.txt
  if errorlevel 1 echo Hinweis: CUDA-Bibliotheken nicht installiert, die Transkription laeuft dann auf dem Prozessor.
)

if not exist ".env" copy ".env.example" ".env" >nul

echo.
echo ==================================================
echo   Fertig!
echo ==================================================
if defined RESTART (
  echo WICHTIG: ffmpeg/Deno wurden gerade installiert. Schliesse dieses Fenster,
  echo bevor du "Clip erstellen.bat" startest.
)
echo.
echo Gleich oeffnet sich die Datei .env im Editor.
echo Trage hinter ANTHROPIC_API_KEY= deinen API-Key ein und speichere.
pause
notepad ".env"
exit /b 0

:fail
echo.
echo Es ist ein Fehler aufgetreten. Bitte die Meldungen oben lesen.
pause
exit /b 1
