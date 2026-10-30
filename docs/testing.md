# Testler: komutlar, sonuçlar, sınırlar

Bu belgedeki sayılar, **sürüm 1.0.0 kod dondurulduktan sonra** bu test bilgisayarında yapılan gerçek çalıştırmalardır (Windows 11, Node 24, PHP 8.3, MariaDB 13, Electron 45, Edge başsız).

> **Test verisi kuralı:** Hiçbir test gerçek işletme verisine dokunmaz. Sunucu testleri yalnızca izole yerel veritabanında (`taha_test`, port 3307) çalışır; Electron testleri geçici `--user-data-dir` profili kullanır; yedek klasörü `GTU_BACKUP_DIR` ile geçici dizine yönlendirilir. Kurulum testi (`e2e-installer.ps1`) `%APPDATA%\gaziantepli-taha-usta` klasörünü **siler** — yalnızca test bilgisayarında çalıştırın.

## 1. Hızlı komutlar

```powershell
npm run lint                  # tsc --noEmit
npm test                      # birim testleri (sunucu testleri TEST_API_URL yoksa atlanır)
npm run build                 # üretim derlemesi
```

## 2. Sunucu testlerini çalıştırmak (yerel, izole)

Gerekenler: PHP 8.x (`pdo_mysql`, `mbstring`, `openssl`) ve MariaDB/MySQL. Bu makinede `winget install PHP.PHP.8.3 MariaDB.Server` ile kuruldu; MariaDB `C:\dev-test\mariadb-data` içinde ayrı veri klasörüyle, 3307 portunda çalışır.

```powershell
npm run dev:testapi           # MariaDB(3307) + php -S 127.0.0.1:8080 (test sırlarıyla) başlatır
$env:TEST_API_URL = 'http://127.0.0.1:8080/api/index.php'
npm test                      # birim + entegrasyon
npm run test:e2e              # garson ↔ API ↔ kasa (gerçek tarayıcı)
npm run test:pwa              # garson PWA (gerçek tarayıcı)
node tools/dev/e2e-kasa-auth.cjs      # kasa ilk kurulum / giriş (gerçek Electron)
node tools/dev/e2e-durable.cjs        # SQLite çökme dayanıklılığı (gerçek Electron)
powershell -File tools/dev/e2e-installer.ps1   # kurulum-güncelleme-kaldırma döngüsü
```
Not: VS Code gibi Electron tabanlı ortamlar `ELECTRON_RUN_AS_NODE=1` ayarlar; Electron'u elle başlatırken bu değişkeni kaldırın. Electron ikilisi `npm ci` ile inmezse (`npm` betik engeli) `node node_modules/electron/install.js` çalıştırın.

## 3. Sonuçlar

| Paket | Sonuç | Kapsam |
|---|---|---|
| TypeScript (`tsc --noEmit`) | **temiz** | Tüm kasa kodu |
| Birim + entegrasyon (`vitest`) | **126/126 geçti** (18 dosya) — yalnız birim: 95 geçti, 31 sunucu testi atlandı | Aşağıdaki tabloya bakın |
| `e2e-garson` | **20/20** | Eşleştirme → PIN → sipariş → bağlantı kesintisi → yeniden dene (çift kayıt yok) → kasa çek/onayla → cihaz iptali |
| `e2e-kasa-auth` | **13/13** | İlk kurulum, zayıf parola reddi, hash'li saklama, yeniden başlatma, 5 hatada kilit, düz metinden yükseltme |
| `e2e-durable` | **11/11** | Zorla kapatma, silme, Chromium deposunu silme, SQLite asıl kaynak, eski sürümden geçiş, geri yükleme |
| `pwa-check` | **12/12** | Manifest, servis çalışanı, yerel varlıklar (CDN yok), çevrimdışı kabuk, API önbelleğe alınmıyor, bağlantı uyarısı |
| `e2e-installer` | **10/10** | Sessiz kurulum, çökme, üzerine kurulum, kaldırma (veri duruyor), yeniden kurulum |
| Derleme (`vite build`) | başarılı | Kurulum paketi: `GaziantepliTahaUsta-Kurulum-1.0.0.exe` (≈124 MB, SHA-256 `E81DE0D07236BCC1CE01A2727B6919BB03A5E34A71530047F39E50C0150E11AE` — bu çalıştırmanın özeti; her derlemede değişir) |

### Birim/entegrasyon kapsamı

| Dosya | Ne doğrular |
|---|---|
| `orderApi.integration` | `send_order` idempotent; çift istek tek kayıt; `pull` siparişi tüketmez, `ack` sonrası düşer; kalemler dolu |
| `apiSecurity.integration` | Kimliksiz tüm uçlar 401; yanlış kasa anahtarı; PIN/telefon sızmaz; yanlış/süresi dolmuş/yeniden kullanılmış kod; PIN hız sınırı; oturumsuz/sahte oturumlu sipariş reddi; **istemci fiyatı yok sayılır**; bilinmeyen ürün/adet reddi; cihaz iptali; pasif garson; patron girişi + hız sınırı; QR belirteçleri; webhook imzası; online uç kilidi; CORS ön kontrol |
| `payment`, `zReport`, `tableOps` | Ödeme toplamı doğrulama, çift kapatma, ikram; Z çift sayım yok, iptal kaydı korunur, kuruş yuvarlama; masa taşıma/birleştirme |
| `printQueue` | Kalıcı kuyruk, yeniden deneme, çift basım koruması, elle tekrar |
| `kvStore`, `backupStore`, `fullBackup*` | SQLite çökme dayanıklılığı (SIGKILL), atomik yedek, yol gezinmesi engeli, sayı mutabakatı, otomatik geri alma |
| `auth`, `permissions`, `businessDate`, `syncMerge`, `netGuard`, `logger`, `cloudAuth`, `incomingOrderDedup` | Parola özeti/kilit, yetki matrisi, iş günü (05:00), birleştirme kuralları, ağ doğrulama, günlük maskeleme |

## 4. Bu çalıştırmalarda bulunup düzeltilen gerçek hatalar (özet)

`pull_pending_orders` kalemleri boş döndürüyordu; `reset_device_pairing` olmayan tabloya yazıp 500 veriyordu; eşleştirme süresi PHP/MySQL saat dilimi farkıyla anında "dolmuş" sayılıyordu; derlenmiş Electron `__dirname is not defined` ile pencere açmıyordu; CORS ön kontrolü yeni kimlik başlıklarını reddederdi; webhook kaydedemese bile platforma başarı dönüyordu; localStorage yazmaları çökmede kayboluyordu (kalıcı SQLite ile çözüldü); bulut→kasa çekme yerel veriyi ezebiliyor ve cari hareketleri yanlış anahtara yazıyordu; ayrıntılar için [CHANGELOG.md](../CHANGELOG.md).

## 5. YAPILMAYAN testler (fiziksel / gerçek ortam gerektirir)

Aşağıdakiler **kodda hazırdır ama bu ortamda doğrulanamadı**; kurulum günü yapılmalıdır:

| # | Test | Neden yapılamadı | Nasıl yapılır |
|---|---|---|---|
| 1 | **Afanda 892E çıktısı**: Türkçe karakter (ş,ğ,ı,İ,ö,ü,ç), 80 mm / 48 sütun taşma, kesici, çekmece | Fiziksel yazıcı yok | *Termal Yazıcılar › Donanım testi*; gerçek mutfak ve adisyon fişi; kağıdı çekip yeniden deneme |
| 2 | Yazıcı kablosu çekilince/kağıt bitince **kuyruk davranışı** (yalnızca mantık testli) | Donanım yok | Yazıcıyı kapat → sipariş ver → "Fiş BASILAMADI" uyarısı ve Yazdırma Kuyruğu; yazıcıyı aç → tek çıktı |
| 3 | **Gerçek Android + iPhone**: PWA yükleme, ekran kilidi, arka plan, kamera ile QR | Cihaz yok (başsız Chromium ile otomasyon yapıldı) | [waiter-app.md](waiter-app.md) kurulum adımları; 3 telefon eşzamanlı sipariş |
| 4 | **Gerçek cPanel hosting**: PHP sürümü, `.htaccess` (HTTPS, başlıklar), AutoSSL, hata günlüğü | Hosting erişimi yok (yerel PHP yerleşik sunucu kullanıldı; MariaDB, MySQL'e çok yakın ama aynı değil) | [deployment.md](deployment.md) adımları + `health` ve 401 kontrolleri |
| 5 | Yemeksepeti / Trendyol / Getir **canlı entegrasyon** (imza biçimi, durum bildirimi) | Partner kimlik bilgisi yok | Platform panelinden test siparişi; webhook günlüğü |
| 6 | Caller ID cihazı (GCallerID), çekmece, ses | Donanım yok | Donanım ayar ekranı testleri |
| 7 | Çok garson **yük** (15 masa, 5 cihaz) ve gerçek mobil ağ gecikmesi | Cihaz/ağ yok | Yoğun saat öncesi prova |
| 8 | Windows güvenlik duvarı/antivirüs davranışı, kod imzası olmadan SmartScreen | Hedef bilgisayar yok | Kurulum günü |
| 9 | Z raporunun **muhasebe/mali müşavir** ile mutabakatı; %10 tek KDV oranının işletmeye uygunluğu | İş kuralı onayı gerekir | Bir gün sonu elle hesapla ile karşılaştırın |
