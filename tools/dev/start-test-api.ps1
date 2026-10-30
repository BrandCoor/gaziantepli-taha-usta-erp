# YALNIZCA GELİŞTİRME/TEST: izole yerel MariaDB (port 3307) + PHP yerleşik sunucu (8080).
# Gerçek üretim değerleri burada KULLANILMAZ; aşağıdaki sırlar sadece test içindir.
$php = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP*" -Recurse -Filter php.exe | Select-Object -First 1).FullName
$maria = 'C:\Program Files\MariaDB 13.0\bin\mariadbd.exe'
if (-not (Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process $maria -ArgumentList '--datadir=C:\dev-test\mariadb-data','--port=3307','--bind-address=127.0.0.1' -WindowStyle Hidden
  Start-Sleep 8
}
Get-Process php -ErrorAction SilentlyContinue | Stop-Process -Force
$env:TAHA_DB_HOST='127.0.0.1'; $env:TAHA_DB_PORT='3307'; $env:TAHA_DB_NAME='taha_test'
$env:TAHA_DB_USER='taha_test'; $env:TAHA_DB_PASS='test_only_pw'
$env:TAHA_APP_SECRET='test-only-app-secret-0123456789abcdef0123456789abcdef'
$env:TAHA_KASA_KEY='test-only-kasa-key-0123456789abcdef'
$env:TAHA_BOSS_PASSWORD='test-boss-password'
$root = Resolve-Path "$PSScriptRoot\..\..\cpanel-yuklenecekler"
Start-Process $php -ArgumentList '-S','127.0.0.1:8080','-t',"$root" -WindowStyle Hidden -RedirectStandardError 'C:\dev-test\php-err.log' -RedirectStandardOutput 'C:\dev-test\php-out.log'
Start-Sleep 2
Write-Output 'Test API: http://127.0.0.1:8080/api/index.php'
