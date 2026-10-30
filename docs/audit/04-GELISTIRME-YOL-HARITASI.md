> **Tarihsel belge:** Bu rapor ilk denetimin (commit `285c2ec`, uygulama öncesi) görüntüsüdür. Bulguların **güncel durumu** için [08-UYGULAMA-DURUMU.md](08-UYGULAMA-DURUMU.md) dosyasına bakın.

# 04 — Geliştirme Yol Haritası

İlke: Önce veri kaybı ve para güvenliği, sonra mobil/senkron, sonra özellik. Tüm yeniden yazma önerileri "kademeli": çalışan UI mantığı korunur, altındaki depolama ve API değişir. Her aşama onayınızla başlar. Hiçbir aşama mevcut veriyi yedeksiz değiştirmez.

## Aşama 0 — Acil güvenlik ve yedek (kod değişikliği minimal, öncelik KRİTİK)
- **Amaç:** Açık kapıları kapatmak, mevcut işletme verisini güvene almak.
- **İşler:** (1) cPanel DB parolası ve platform API anahtarlarını **döndür** (kod dışı, sizin yapacağınız işlem); (2) kasadaki mevcut localStorage verisini (Electron profil klasörü `%APPDATA%\gaziantepli-taha-usta`) **yalnızca kopyalayarak** yedekle; (3) PHP API'yi geçici olarak IP/`.htaccess` ile kısıtla veya devre dışı bırak; (4) `config.php`'yi repo dışına al.
- **Bağımlılık:** Yok. **Etkilenen:** `api/config.php`, hosting ayarları. **Veri kaybı riski:** Düşük (kopyalama). 
- **Kabul:** Eski DB parolası çalışmıyor; yedek kopyası başka diske alınmış ve açılabiliyor.
- **Test:** Taze klonda gizli bilgi taraması; hosting'te auth'suz çağrı reddi.

## Aşama 1 — Güvenilir merkez: kasa SQLite + yerel API (temel)
- **Amaç:** Tek doğruluk kaynağı. Kasa Electron "main" sürecinde SQLite (Prisma ya da better-sqlite3 — gerekçe: Prisma şeması hazır; dosya tek, yedeklemesi kolay, internet gerektirmez).
- **İşler:** Şemayı gözden geçir (kuruş tamsayı, `clientOrderId` UNIQUE, olay/denetim tablosu, baskı işi tablosu); veriyi `%ProgramData%\RYMedya\GaziantepliTahaUsta\` altına koy (kurulum klasöründen bağımsız); **localStorage → SQLite tek yönlü, doğrulamalı göç aracı** (eski veri silinmez); `restaurantDataService` işlemlerini API üzerinden çağıran ince katmana dönüştür.
- **Bağımlılık:** Aşama 0. **Etkilenen:** `restaurantDataService.ts`, `dataService.ts`, `prisma/`, `electron/main.ts`. **Veri kaybı riski:** YÜKSEK (göç) → göç öncesi tam yedek, kuru çalıştırma, kayıt sayısı/bakiye eşleştirme raporu, geri dönüş yolu.
- **Kabul:** Göçten sonra tüm müşteri/cari bakiyeleri, adisyon ve Z toplamları eski veriyle birebir aynı; çökme testi sonrası kayıp yok.
- **Test:** Göç doğrulama betiği, kapanma/güç kesintisi, 10 bin kayıt performansı.

## Aşama 2 — Sipariş çekirdeği (idempotent, işlemli)
- **İşler:** Sunucu tarafı sipariş servisi: `clientOrderId` ile idempotent ekleme, masa sürümü (optimistic concurrency), taşıma/birleştirme işlemli, fiyatı sunucuda hesaplama, sipariş durum makinesi; kalıcı sıralı sipariş numarası; ödeme tek işlemde (cari dahil).
- **Bağımlılık:** Aşama 1. **Kabul:** Aynı istek 2 kez gelince 1 kayıt; iki cihaz aynı anda aynı masaya ekleyince iki ürün de görünür; taşıma dolu masaya reddedilir.
- **Test:** Eş zamanlılık ve tekrar deneme otomatik testleri (ilk test paketi burada kurulur).

## Aşama 3 — Mutfak/yazıcı kuyruğu
- **İşler:** Kalıcı baskı işi (PENDING/PRINTED/FAILED), gerçek sonuç, yeniden deneme + el ile yeniden bas, "yazdırıldı" gerçek bilgi, tarayıcı fallback'i kaldır, kasada görünür uyarı. Afanda 892E: önce fiziksel doğrulama.
- **Bağımlılık:** Aşama 2. **Kabul:** Yazıcı kapalıyken sipariş kaybolmaz, "başarısız" görünür; açılınca tek çıktı. **Test:** Fiziksel yazıcı senaryoları (05 belgesi).

## Aşama 4 — Mobil garson (yerel ağ PWA) — bkz. 07
- **İşler:** Garson PWA'yı kasa sunucusundan servis et; manifest + service worker + yerel varlıklar (CDN'siz); kimlik doğrulama (cihaz eşleme + PIN, oturum token); WebSocket ile canlı masa; sipariş durum göstergesi; HTTPS (yerel sertifika) ya da kamera gerektirmeyen eşleme kodu.
- **Bağımlılık:** Aşama 2 (3 önerilir). **Kabul:** 3 telefon aynı anda; internet kablosu çekilince sipariş akışı sürer.

## Aşama 5 — Yetki, denetim, Electron sertleştirme
- Hash'li parola/PIN, rol-izin uygulaması, iptal/ikram/indirim için onay, denetim günlüğü, `contextIsolation`+preload, sunucuyu yetkili cihazla sınırlama. **Kabul:** Yetkisiz iptal denemesi reddedilir ve loglanır.

## Aşama 6 — Mali doğruluk
- İş günü/saat dilimi, giderlerin Z'ye bağlanması, ürün bazlı KDV, kuruş aritmetiği, gerçek indirim/iade, Z değişmezliği. **Test:** Gece yarısı, çift Z, karma KDV senaryoları.

## Aşama 7 — Yedek/geri yükleme ve güncelleme
- Otomatik günlük SQLite yedeği (rotasyon, ikinci diske), geri yükleme sihirbazı, sürüm göçü (migration) ve geri dönüş; NSIS kurulumunda veriyi silmeme; otomatik güncelleme (imzalı).

## Aşama 8 — Uzak katman (gerekirse)
- Bulut PHP API'yi yalnızca **kasa→bulut tek yönlü senkron + patron paneli + QR menü** için yeniden yaz (auth'lu). Garson akışı artık buluta bağımlı değil.

## Aşama 9 — Yeni özellikler
KDS, QR menü/online sipariş, stok/maliyet, çoklu şube, gerekirse yerel mobil uygulama (API zaten hazır olacağı için ek maliyet düşük).

**İlk önerilen adım:** Aşama 0 + Aşama 1 için ayrıntılı göç tasarımı. Kod yazmaya onayınızdan önce göç planı ayrıca sunulacaktır.
