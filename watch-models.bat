@echo off
setlocal
title Alpha website - model watcher

REM Runs the PowerShell watcher that keeps models/models.json in sync
REM with whatever is actually in the models folder.
REM Missing or changed model preview images are generated automatically.
REM Leave this window open while you work. Close it to stop.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch-models.ps1"

echo.
echo The watcher stopped.
pause
