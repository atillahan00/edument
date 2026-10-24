@echo off
setlocal
chcp 65001 >nul
title EduMent
cd /d "%~dp0"
if errorlevel 1 goto fail
set "NODE_EXE=node.exe"
where node.exe >nul 2>nul
if errorlevel 1 set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
echo.
echo   EduMent - Ag secimi
echo   1. Tek dugum
echo   2. Coklu dugum (4 dogrulayici)
echo   0. Iptal
echo.
echo   Iki agin kayitlari ayri tutulur. Mod degistirmeden islemlerinizi bitirin.
echo.
choice /C 120 /N /M "Seciminiz [1/2/0]: "
if errorlevel 3 exit /b 0
if errorlevel 2 goto multi
set "CHAIN_SELECTION=single"
goto start
:multi
set "CHAIN_SELECTION=multi"
:start
"%NODE_EXE%" scripts\easy-start.mjs --mode %CHAIN_SELECTION%
if errorlevel 1 goto fail
exit /b 0
:fail
echo.
echo Uygulama acilamadi. Yukaridaki hata mesajini kontrol edin.
pause
exit /b 1
