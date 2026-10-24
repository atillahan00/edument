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
echo   EduMent - Ağ seçimi
echo   1. Tek düğüm
echo   2. Çoklu düğüm (4 doğrulayıcı)
echo   0. İptal
echo.
echo   İki ağın kayıtları ayrı tutulur. Mod değiştirmeden işlemlerinizi bitirin.
echo.
choice /C 120 /N /M "Seçiminiz [1/2/0]: "
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
echo Uygulama açılamadı. Yukarıdaki hata mesajını kontrol edin.
pause
exit /b 1
