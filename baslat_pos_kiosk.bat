@echo off
chcp 65001 >nul
title Gaziantepli Taha Usta Restoran POS
color 0B

echo ==============================================================================
echo     GAZİANTEPLİ TAHA USTA RESTORAN POS BAŞLATILIYOR...
echo ==============================================================================
echo.

cd /d "%~dp0"

echo [1/2] Yerel POS Sunucusu Başlatılıyor (Port 3000)...
start /b cmd /c "npx vite preview --port 3000 --host 0.0.0.0" >nul 2>&1

timeout /t 2 /nobreak >nul

echo [2/2] POS Dokunmatik Arayüzü Açılıyor...

set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
set CHROME_PATH86="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set EDGE_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set EDGE_PATH64="C:\Program Files\Microsoft\Edge\Application\msedge.exe"

if exist %CHROME_PATH% (
    start "" %CHROME_PATH% --app=http://localhost:3000 --start-maximized --disable-pinch
    exit
)

if exist %CHROME_PATH86% (
    start "" %CHROME_PATH86% --app=http://localhost:3000 --start-maximized --disable-pinch
    exit
)

if exist %EDGE_PATH% (
    start "" %EDGE_PATH% --app=http://localhost:3000 --start-maximized
    exit
)

if exist %EDGE_PATH64% (
    start "" %EDGE_PATH64% --app=http://localhost:3000 --start-maximized
    exit
)

start http://localhost:3000
exit
