@echo off
chcp 65001 >nul
title Gaziantepli Taha Usta - Müşteri Bilgisayarı Kurulum Sihirbazı
color 0A

echo ==============================================================================
echo     GAZİANTEPLİ TAHA USTA RESTORAN ERP & POS KURULUM SİHİRBAZI
echo ==============================================================================
echo.
echo [1/4] Node.js ve ortam kontrolleri yapılıyor...

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [HATA] Bilgisayarınızda Node.js kurulu bulunamadı!
    echo Lütfen https://nodejs.org adresinden Node.js (LTS sürümü) indirip kurunuz.
    echo Kurulum bittikten sonra bu dosyayı tekrar çalıştırın.
    echo.
    pause
    exit /b
)

echo [OK] Node.js tespit edildi:
node -v

echo.
echo [2/4] Gerekli paketler ve kütüphaneler kuruluyor (npm install)...
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo [HATA] Paket yükleme sırasında bir sorun oluştu!
    pause
    exit /b
)

echo.
echo [3/4] Sistem derleniyor (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo [HATA] Derleme sırasında hata oluştu!
    pause
    exit /b
)

echo.
echo [4/4] Masaüstü kısayolu hazırlanıyor...

set SCRIPT_DIR=%~dp0
set VBS_FILE=%TEMP%\CreateShortcut.vbs

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_FILE%"
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\Gaziantepli Taha Usta POS.lnk" >> "%VBS_FILE%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_FILE%"
echo oLink.TargetPath = "%SCRIPT_DIR%baslat_pos_kiosk.bat" >> "%VBS_FILE%"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%VBS_FILE%"
echo oLink.Description = "Gaziantepli Taha Usta Restoran POS & ERP Sistemi" >> "%VBS_FILE%"
echo oLink.Save >> "%VBS_FILE%"

cscript //nologo "%VBS_FILE%"
del "%VBS_FILE%"

echo.
echo ==============================================================================
echo     [BAŞARILI] KURULUM TAMAMLANDI!
echo ==============================================================================
echo.
echo Masaüstünüze "Gaziantepli Taha Usta POS" kısayolu eklendi.
echo.
echo İsteğe bağlı seçenekler:
echo  1. Masaüstü uygulamasını (Setup.exe) derlemek isterseniz konsolda:
echo     npm run electron:build
echo  2. Programı hemen başlatmak için baslat_pos_kiosk.bat dosyasını açabilirsiniz.
echo.
pause
