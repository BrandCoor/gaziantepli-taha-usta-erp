@echo off
chcp 65001 >nul
title Gaziantepli Taha Usta - Geliştirme & Test Ortamı
color 0B

echo ==============================================================================
echo     GELİŞTİRME ORTAMI BAŞLATILIYOR (Kendi bilgisayarınızda test için)
echo ==============================================================================
echo.

cd /d "%~dp0"

REM ---------------------------------------------------------------- PHP kontrol
where php >nul 2>nul
if %errorlevel% neq 0 (
    color 0E
    echo [UYARI] PHP bulunamadi.
    echo.
    echo   Garson uygulamasini ve sunucuyu test edebilmek icin PHP gereklidir.
    echo   En kolay yol: https://www.apachefriends.org adresinden XAMPP kurun,
    echo   ardindan XAMPP kurulum klasorundeki "php" klasorunu PATH'e ekleyin.
    echo.
    echo   PHP olmadan yalnizca kasa arayuzu acilir; garson girisi CALISMAZ.
    echo.
    pause
    goto :KASA_ONLY
)

echo [OK] PHP bulundu:
php -v | findstr /R "^PHP"
echo.

echo [1/2] Sunucu baslatiliyor -^> http://localhost:8080
echo       (garson uygulamasi:   http://localhost:8080/garson/ )
echo       (QR menu:             http://localhost:8080/menu/   )
start "TAHA USTA SUNUCU" cmd /k "php -S 127.0.0.1:8080 -t cpanel-yuklenecekler"

timeout /t 2 /nobreak >nul

:KASA_ONLY
echo.
echo [2/2] Kasa arayuzu baslatiliyor -^> http://localhost:5173
echo.
echo ------------------------------------------------------------------------------
echo   ONEMLI - ILK CALISTIRMADA YAPILACAKLAR:
echo.
echo   1. Kasa acilinca yonetici sifrenizi belirleyin.
echo   2. Ayarlar ^> Sistem ^& Yedekleme ekranina girin.
echo   3. Sunucu adresi alanina AYNEN sunu yazip Kaydet'e basin:
echo.
echo          http://localhost:8080/api
echo.
echo   4. Ayarlar ^> Garson Terminalleri ekranindan bir garson ekleyin.
echo      PIN kodu otomatik uretilir.
echo   5. Tarayicida yeni sekme acip garson uygulamasini deneyin:
echo.
echo          http://localhost:8080/garson/
echo.
echo   Bu sekmeye garsonun PIN kodunu girerek girisi test edebilirsiniz.
echo ------------------------------------------------------------------------------
echo.

call npm run dev
