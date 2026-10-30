# Değişiklik günlüğü

Biçim: [Keep a Changelog](https://keepachangelog.com/tr/). Sürümleme: package.json `version`.

## [1.0.0] — Üretime hazırlık sürümü

> Not: Bu sürüm, ilk denetimde (docs/audit) bulunan kritik riskleri gidermek için hazırlandı. Fiziksel yazıcı, gerçek telefonlar ve canlı hosting ile doğrulama kurulum gününde yapılmalıdır ([docs/testing.md](docs/testing.md)).

### Güvenlik
- **Gizli bilgiler koddan çıkarıldı:** veritabanı parolası, yemek platformu anahtarları, bir API anahtarı içeren araç dosyası. DB ayarları `config.local.php` / ortam değişkenine taşındı. *(Eski sırlar Git geçmişinde durur → iptal edilmeli, bkz. docs/security.md.)*
- **PHP API'ye varsayılan-reddet yetki kapısı** (`security.php`): kasa anahtarı, cihaz anahtarı + PIN oturumu, imzalı patron oturumu, masa QR belirteci, webhook doğrulaması. Kimliksiz erişim kapatıldı.
- **Garson eşleştirme yeniden yazıldı:** sunucuda üretilen 6 haneli, 5 dk, tek kullanımlık kod; "ilk garsonu eşle" yedek yolu ve kimliksiz `pair_device` kaldırıldı; PIN hız sınırı; cihaz iptali anında geçerli.
- Sabit `1453` PIN'i (arka kapı), düz metin patron parolası, PIN/telefon/QR sızdıran garson listesi, web'den okunabilir JSON yedek modu ve `db_test.php` **kaldırıldı**.
- Sunucu **fiyatları kendi veritabanından** hesaplar; garson adı token'dan gelir.
- Electron: `nodeIntegration` kapalı, `contextIsolation` + `sandbox` + izin listeli `preload`, IPC gönderen doğrulama, CSP, yerel sunucu yalnız `127.0.0.1` (+Host/Origin/özel-IP denetimi), tek örnek kilidi.
- Kasa kullanıcıları: **varsayılan hesap yok** (ilk kurulum ekranı), PBKDF2 parola, giriş kilidi, gerçek rol/yetki denetimi (iptal/ikram/ayarlar/raporlar), son yönetici koruması.
- `.htaccess`: HTTPS zorunlu, güvenlik başlıkları, hassas dosyalar kapalı.
- Bağımlılıklar: Electron 33→45, electron-builder 26; kullanılmayan paketler kaldırıldı. Açık sayısı 25 → 2 (orta).

### Veri güvenilirliği
- **Kalıcı SQLite deposu** (WAL, `synchronous=FULL`): arayüz verisi çökme/elektrik kesintisine dayanıklı; Chromium localStorage kotası ve gecikmeli yazma sorunu giderildi; eski sürümden güvenli geçiş.
- **Tam dosya yedeği:** atomik+doğrulamalı yazma, otomatik (6 saat/Z/riskli işlem öncesi), ikinci kopya klasörü, sayı mutabakatlı geri yükleme ve otomatik geri alma.
- Bulut→kasa çekme **yerel veriyi ezmiyor** (geçmiş: birleşim; ana veri: yalnız yerel boşsa); cari hareketler yanlış anahtara yazılıyordu, düzeltildi. Kasa→bulut gizli toplu silme kaldırıldı.
- Eski ve çakışan SQL kurulum dosyaları, Prisma şeması/tohum verisi ve demo personel/salon tohumları kaldırıldı; şema API tarafından otomatik ve sürümlü kurulur.

### Sipariş / senkronizasyon
- **Idempotent `send_order`** (`clientOrderId`), tek işlemde kayıt, **onaylı (ack) çekme**, kasada kalıcı tekrar engelleme. Garson hatayı yutmuyor, sepeti koruyor; "gönderildi" yalnızca sunucu kabul edince.
- `pull_pending_orders` ürün kalemlerini boş döndürüyordu — düzeltildi.
- Webhook veritabanına yazamazsa platforma başarı dönmüyor; JSON kuyruk dosyası kaldırıldı.
- Masa taşıma hedef masayı ezmiyor (boşsa taşır, doluysa **birleştirir**); sunucu tarafında da dolu hedef reddedilir.

### Mutfak / yazdırma
- **Kalıcı yazdırma kuyruğu:** sahte "başarılı" (tarayıcı yedeği) kaldırıldı; otomatik/elle tekrar deneme, çift basım koruması, kuyruk göstergesi. Sipariş kaydı ile fiziksel basım ayrıldı.

### Mali doğruluk
- Tek **iş günü** tanımı (yerel saat, 05:00); 56 yerdeki UTC tarih kullanımı değiştirildi.
- Ödeme toplamı adisyonla birebir doğrulanır; çift tıklama ile iki kez kapatma/cari borç engellendi; cari borç kapanıştan **sonra** yazılır; ödeme ekranındaki kalemler önce kalıcı hale getirilir.
- Z raporu: aynı gün ikinci Z'de gider/toptancı **çift sayımı** giderildi, iptal kayıtları silinmiyor (Z'ye bağlanıp arşivlenir), kuruş yuvarlama.
- Günlük artan adisyon numarası (eski rastgele 100–999 çakışabiliyordu); çakışabilen kimlik üretimleri düzeltildi.

### Garson / QR menü
- Garson uygulaması gerçek **PWA** (manifest, servis çalışanı, simgeler); CDN bağımlılığı kalktı (Tailwind/FontAwesome/yazı tipleri yerel); uydurma menü/masa kaldırıldı; bağlantı uyarı şeridi; geliştirici alan adları kaldırıldı.
- QR menü: imzalı masa belirteci, hız sınırı, sunucu fiyatı; QR görseli yerelde üretilir.
- Kasa içindeki eski garson/eşleştirme modu ve sahte "kasadan anında onayla" düğmesi kaldırıldı.

### Altyapı
- Windows NSIS kurulum paketi; kaldırmada veri korunur (test edildi). Dosya günlüğü (maskeli), arayüz hata raporlama, `/api/health`.
- Test altyapısı: 134 birim/entegrasyon testi + 4 gerçek-ortam (Electron/tarayıcı) uçtan uca paketi.
- Eski `kurulum_ve_setup.bat`, `baslat_pos_kiosk.bat` (Node+Chrome kiosk, güvenlik açığı) kaldırıldı.

### Bilinen eksikler
[docs/known-limitations.md](docs/known-limitations.md)
