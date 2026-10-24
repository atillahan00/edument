@echo off
setlocal
chcp 65001 >nul
title EduMent
cd /d "%~dp0"
if errorlevel 1 goto fail
set "NODE_EXE=node.exe"
where node.exe >nul 2>nul
if errorlevel 1 set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
"%NODE_EXE%" scripts\easy-stop.mjs
if errorlevel 1 goto fail
exit /b 0
:fail
echo.
echo Uygulama kapatılamadı. Yukarıdaki hata mesajını kontrol edin.
pause
exit /b 1
