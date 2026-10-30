# UÇTAN UCA kurulum döngüsü (TEST BİLGİSAYARI): kur → veri yaz → zorla kapat → üzerine kur → aç → kaldır → veri duruyor mu → yeniden kur → aç.
# Gerçek işletme bilgisayarında ÇALIŞTIRMAYIN: %APPDATA%\gaziantepli-taha-usta klasörünü silerek başlar.
param([string]$Setup = "$PSScriptRoot\..\..\release\GaziantepliTahaUsta-Kurulum-1.0.0.exe")
$ErrorActionPreference = 'Continue'
$Setup = (Resolve-Path $Setup).Path
$inst = 'C:\dev-test\inst'
$data = "$env:APPDATA\gaziantepli-taha-usta"
$exe  = "$inst\Gaziantepli Taha Usta.exe"
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
$results = @()
function Check($name, $ok, $extra = '') { $script:results += [bool]$ok; $m = if ($ok) { 'GEÇTİ ' } else { 'KALDI ' }; Write-Output ("$m $name" + $(if ($extra) { "  → $extra" })) }
function Stop-App { Get-Process -Name 'Gaziantepli Taha Usta' -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2 }
function Run-App { $env:ELECTRON_RUN_AS_NODE = $null; Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; $env:GTU_BACKUP_DIR = 'C:\dev-test\inst-yedek'; Start-Process $exe -ArgumentList '--remote-debugging-port=9333'; Start-Sleep 14 }
function Cdp($e) { (& node "$root\tools\dev\cdp-eval.cjs" $e) -join "`n" }
function ReadDb { & node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1],{readOnly:true});const r=d.prepare('select value from kv where key=?').get('gtu_pos_completed_orders');console.log(r?r.value:'YOK')" "$data\data\kasa.db" }

Stop-App
Remove-Item $inst, $data, 'C:\dev-test\inst-yedek' -Recurse -Force -ErrorAction SilentlyContinue

$p = Start-Process $Setup -ArgumentList '/S', "/D=$inst" -PassThru -Wait
Check 'sessiz kurulum başarılı' ($p.ExitCode -eq 0 -and (Test-Path $exe)) "çıkış kodu $($p.ExitCode)"
Check 'kaldırıcı oluştu' (Test-Path "$inst\Uninstall Gaziantepli Taha Usta.exe")

Run-App
Check 'kurulu uygulama açıldı (ilk kurulum ekranı)' ((Cdp 'document.body.innerText.slice(0,12)') -match 'İlk Kurulum')
Cdp "localStorage.setItem('gtu_pos_completed_orders', JSON.stringify([{id:'KURULUM-1',totalAmount:123},{id:'KURULUM-2',totalAmount:77}])); 1" | Out-Null
Start-Sleep -Milliseconds 400
Stop-App   # ZORLA kapatma (çökme benzetimi)
Check 'zorla kapatma sonrası veri SQLite dosyasında' ((ReadDb) -match 'KURULUM-2')

$p = Start-Process $Setup -ArgumentList '/S', "/D=$inst" -PassThru -Wait
Check 'üzerine kurulum (güncelleme) başarılı' ($p.ExitCode -eq 0)
Run-App
Check 'güncelleme sonrası veri arayüzde' ((Cdp "JSON.parse(localStorage.getItem('gtu_pos_completed_orders')||'[]').length") -match '=> 2')
Stop-App

$u = Start-Process "$inst\Uninstall Gaziantepli Taha Usta.exe" -ArgumentList '/S' -PassThru -Wait
Start-Sleep 4
Check 'kaldırma başarılı, program dosyaları silindi' ($u.ExitCode -eq 0 -and -not (Test-Path $exe))
Check 'KALDIRMADAN SONRA veri dosyası duruyor' (Test-Path "$data\data\kasa.db")
Check 'kaldırmadan sonra veri içeriği sağlam' ((ReadDb) -match 'KURULUM-1')

$p = Start-Process $Setup -ArgumentList '/S', "/D=$inst" -PassThru -Wait
Run-App
Check 'yeniden kurulum sonrası veri arayüzde geri geldi' ((Cdp "JSON.parse(localStorage.getItem('gtu_pos_completed_orders')||'[]').map(function(o){return o.id}).join(',')") -match 'KURULUM-1,KURULUM-2')
Stop-App

# temizlik
$u = Start-Process "$inst\Uninstall Gaziantepli Taha Usta.exe" -ArgumentList '/S' -PassThru -Wait
Start-Sleep 3
Remove-Item $inst, $data, 'C:\dev-test\inst-yedek' -Recurse -Force -ErrorAction SilentlyContinue
$pass = ($results | Where-Object { $_ }).Count
Write-Output "`nSONUÇ: $pass/$($results.Count) kontrol geçti"
if ($pass -ne $results.Count) { exit 1 }
