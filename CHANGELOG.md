# Değişiklik günlüğü

Biçim: [Keep a Changelog](https://keepachangelog.com/tr/). Sürümleme: package.json `version`.

## [1.0.0] — Üretime hazırlık sürümü

> Not: Bu sürüm, ilk denetimde (docs/audit) bulunan kritik riskleri gidermek için hazırlandı. Fiziksel yazıcı, gerçek telefonlar ve canlı hosting ile doğrulama kurulum gününde yapılmalıdır ([docs/testing.md](docs/testing.md)).

### Yemek platformları (Getir / Trendyol Go / Yemeksepeti)
- **"Platformda sipariş var, sistemde yok" sorunu giderildi.** Kök nedenler: webhook gizli anahtarı tanımsızken isteklerin sessizce düşmesi, pasif platformun siparişlerinin ekranda gizlenmesi, sunucu/istemci durum sözlüğü uyuşmazlığı, platforma webhook adresinin kaydedilmemesi ve hiçbir tanı bilgisinin olmaması.
- Gelen **her** webhook isteği `online_webhook_log` tablosuna (kabul/ret/neden, başlık adları, kırpılmış gövde; anahtar değeri asla) yazılır; kasada **Yemek Platformları › Gelen İstekler / Tanı** ekranından izlenir.
- Gerçek bağlantı testi (Getir giriş + aktif sipariş sorgusu, Yemeksepeti OAuth). Doğrulanamayan platform "doğrulandı" denmez.
- Gerçek platform eylemleri (onay/ret/hazır/teslim) ve **dürüst durum**: Tamam / Başarısız / Elle yapılmalı. Dokümanı doğrulanamayan Trendyol ve Yemeksepeti uçları ayarlardan "gelişmiş adres" olarak girilir; boşsa işlem platforma bildirilmez ve ekranda belirtilir.
- Webhook yedeği olarak **periyodik sorgulama** (Getir), ayarlarda webhook adresleri + gizli anahtar üretici.
- **Demo/test kalıntıları kaldırıldı:** sahte test siparişi, sahte bağlantı testi, demo menü/salon/garson, kullanılmayan tohum veri üreticileri; para çekmecesi hata durumunda artık başarı yalanı söylemez.

### Otomatik güncelleme sistemi (1.1.0)
- **Kasa:** `electron-updater` ile arka planda denetim/indirme (açılışta + 4 saatte bir), SHA-512 doğrulama, bozuk paket reddi, artan aralıkla yeniden deneme, açık adisyon/ödeme varken kurulum engeli, kurulum öncesi veri anlık görüntüsü + dosya yedeği, sessiz kurulum ve otomatik yeniden açılış, kritik güncelleme politikası. Güncelleme adresi merkezi ayardan (varsayılan `<API>/updates/`).
- **Sunucu:** `version` ucu, istemci sürüm kapısı (426 CLIENT_TOO_OLD), göç öncesi SQL yedeği + kilit + hatada durma (sürüm artmaz, `schema_last_error`), `--update` dağıtım paketi (`config.local.php` içermez).
- **Garson PWA:** bekleyen sürüm + "Güncelle" şeridi, sepet/gönderim varken uygulanmaz, eski/yeni dosya karışmaz, oturum yenilemede korunur.
- **Veri:** daha yeni şemalı yerel veri eski sürümle açılmaz (DATA_NEWER).
- Araçlar: `tools/update-tools.cjs` (yayın üretimi + doğrulama), `tools/bump-version.cjs`, `tools/dev/e2e-updater.cjs`, `tools/dev/pwa-update-check.cjs`. Ayrıntı: [docs/updates.md](docs/updates.md), [docs/versioning.md](docs/versioning.md).

### Mali analiz düzeltmeleri
- **İptal edilen adisyonlar X/Z raporunda ciro, adet ve ürün satışı olarak sayılıyordu** → artık satış sayılmaz; iptal tutarı kalem kayıtlarından bir kez toplanır (filtreli raporda iptal çift sayılıyordu).
- **Net ciro** artık brüt − indirim − *ikram ödemesi*; ödeme dağılımının toplamına eşit (eskiden ikram ödemesi net ciroda kalıyordu).
- İkram kalemler ürün/kategori ciro toplamından çıkarıldı (adet sayılır); bölüm/garson/saat dağılımları net tutar üzerinden (toplamları net ciroya eşit); ortalama adisyon net ciro üzerinden; filtreli rapor tutarları kuruşa yuvarlanır.
- Gece 00:00–05:00 arası kapanan adisyonlar önceki iş günü tarihiyle arşivlenir; "Bugün/Bu hafta/Bu ay…" aralıkları iş gününe göre hesaplanır; "Son 30 gün" bugün dahil 30 gün.
- Z kapanışında girilmeyen açılış avansı için uydurma 1000 ₺ varsayımı kaldırıldı (0).
### Diğer
- Yemek platformlarında kurye/teslimat modeli seçimi ve kurye atama kaldırıldı.
- Platform bağlantı testi, ekranda yazılmış ama kaydedilmemiş anahtarları da gönderir.

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
