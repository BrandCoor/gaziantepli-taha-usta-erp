# Dağıtım: sunucu + kasa + telefonlar

## A. Sunucu (cPanel hosting)

Gerekenler: PHP ≥ 8.1 (`pdo_mysql`, `mbstring`, `openssl`), MySQL/MariaDB, **her alt alan adı için SSL (AutoSSL)**.

Bu kurulum **4 ayrı alt alan adı** kullanır (her biri ayrı "belge kökü"):

| Alt alan adı | Ne | Yüklenecek paket |
|---|---|---|
| `api.alanadi.com` | PHP API + veritabanı bağlantısı | `1-api.zip` |
| `garson.alanadi.com` | Garson PWA | `2-garson.zip` |
| `qr.alanadi.com` | Müşteri QR menü | `3-qr-menu.zip` |
| `patron.alanadi.com` | Patron paneli | `4-patron.zip` |

Paketleri üretmek için (adresleri kendinize göre değiştirin; gizli anahtarlar her çalıştırmada yeniden üretilir):
```powershell
node tools/make-deploy-package.cjs --out "$HOME\Desktop\YUKLEME_PAKETI" `
  --api https://api.alanadi.com --garson https://garson.alanadi.com --menu https://qr.alanadi.com --patron https://patron.alanadi.com
```

1. **Alt alan adları:** cPanel › *Alan Adları* (veya *Alt Alan Adları*) ile dört alt alan adı oluşturun; her birinin belge kökü ayrı bir klasör olur. Her biri için **SSL** etkin olmalı (cPanel › *SSL/TLS Durumu* › *AutoSSL'yi Çalıştır*).
2. **Veritabanı:** cPanel › MySQL Veritabanları › veritabanı + kullanıcı + *tüm ayrıcalıklar*. Tabloları elle içe aktarmanız gerekmez; API ilk çağrıda kurar.
3. **Yükleme:** cPanel › *Dosya Yöneticisi* › ilgili alt alan adının belge kökünü açın › *Karşıya Yükle* ile ilgili `.zip` › sağ tık *Extract (Çıkart)*. Zip'in içeriği doğrudan belge köküne çıkmalıdır (içinde fazladan klasör oluşmamalı); sonra `.zip` dosyasını silin.
4. **API gizli ayarları:** `api` belge kökündeki `config.local.php` dosyasını açıp şu üç satırı doldurun: `DB_NAME`, `DB_USER`, `DB_PASS` (**yeni** parola). `APP_SECRET` ve `KASA_API_KEY` pakette hazır üretilmiştir; `GARSON_URL` garson adresiniz olmalıdır (eşleştirme QR'ı buna gider). Bu dosya Git'e girmez ve web'den okunamaz.
5. **Doğrulama:**
   - `https://api.alanadi.com/index.php?action=health` → `{"success":true,"status":"ONLINE",…}`
   - `https://api.alanadi.com/index.php?action=get_live_state` → **401 Yetkisiz** (kimliksiz erişim kapalı olmalı)
   - `https://garson.alanadi.com/` garson giriş ekranı, `https://qr.alanadi.com/` QR menü, `https://patron.alanadi.com/` patron girişi açılmalı.
6. **Patron parolası:** `BOSS_PASSWORD` boşsa ilk girişte hiçbir parola kabul edilmez. `api/config.local.php` içine **geçici** `BOSS_PASSWORD` yazın, `https://patron.alanadi.com/` ile giriş yapın (parola ilk girişte `ayarlar` tablosuna **hash** olarak yazılır), sonra `config.local.php` içinden silin ve panelden *Parolayı değiştir* ile kalıcı parolanızı verin.
7. **PHP hataları:** üretimde ekrana basılmaz; sorun için cPanel › *Hatalar* (error_log).

Sayfalar API adresini kendi klasöründeki `config.js` dosyasından alır (pakette hazır). Adres değişirse yalnızca bu dosya düzenlenir.

### Eski sunucudan geçiş uyarısı
Yeni `index.php` ile eski kasa sürümü **birlikte çalışmaz** (`ack_orders` ve kasa anahtarı gerekir). Sunucuyu ve kasayı birlikte güncelleyin.

## B. Kasa bilgisayarı (Windows 10/11 x64)

1. `GaziantepliTahaUsta-Kurulum-<sürüm>.exe` çalıştırılır (kurulum klasörü seçilebilir; masaüstü kısayolu oluşur). Paket kod imzalı olmadığı için SmartScreen uyarısında *Yine de çalıştır* denir.
2. İlk açılış: **yönetici hesabı oluşturma** ekranı (hazır parola yoktur).
3. **Restoran & Donanım Ayarları › Bulut & Yedekleme:**
   - *Merkezi API Endpoint Adresi:* `https://api.alanadi.com/index.php`
   - *QR Menü Sayfası Adresi:* `https://qr.alanadi.com`
   - *Kasa API Anahtarı:* sunucudaki `KASA_API_KEY` ile **aynı** değer → Kaydet → *Bağlantıyı test et* (MySQL bağlı görünmeli).
4. **Restoran & Donanım Ayarları › Termal Yazıcılar:** Afanda 892E'yi ekleyin (USB/Windows sürücüsü veya ağ IP'si + 9100). *Donanım testi* ile fiziksel çıktıyı doğrulayın ([testing.md](testing.md) › fiziksel testler).
5. **Restoran & Donanım Ayarları › Garson Terminalleri & QR:** garson ekleyin (4 haneli PIN) → *Eşleştir* ile telefona kod/QR verin.
6. **Yedek:** *İkinci Kopya Klasörü Seç* (USB/ikinci disk) ve bir kez *Şimdi Yedek Al*.
7. **Ağ:** Kasa yalnızca dışarı HTTPS (443) bağlanır. Gelen port açmayın, güvenlik duvarını kapatmayın. Yerel yazıcı servisi yalnızca `127.0.0.1`'de dinler.
8. **Windows önerileri:** BitLocker, otomatik güncelleme saatleri iş saati dışında, UPS (ani kapanmaya karşı; veri yine de SQLite ile korunur).

### Güncelleme (yeni sürüm)
1. *Şimdi Yedek Al* (ve mümkünse ikinci kopyaya kopyalayın).
2. Yeni kurulum paketini **eskisinin üzerine** kurun (veri klasörü `%APPDATA%` altında olduğu için korunur).
3. Açılışta kayıt sayılarını kontrol edin (Restoran & Donanım Ayarları › Bulut & Yedekleme › veri deposu "SQLite ✔").
4. Sorun olursa: eski sürümü yeniden kurun ve yedekten geri yükleyin ([backup-restore.md](backup-restore.md)).

### Kaldırma
Programlar ve Özellikler › *Gaziantepli Taha Usta*. **Veri klasörü silinmez.** Veriyi de silmek isterseniz `%APPDATA%\gaziantepli-taha-usta` klasörünü elle silin (önce yedek alın).

## C. Telefonlar ve yazdırma ağı

- Garson telefonları: [waiter-app.md](waiter-app.md).
- Mutfak yazıcıları yerel ağda sabit IP'de olmalıdır (ör. 192.168.1.201/202, port 9100); kasa bilgisayarı aynı ağda olmalıdır. Telefonların bu ağda olması **gerekmez**.

## D. Derleme (geliştirici)

```powershell
npm ci
npm run lint ; npm test
npm run build:web       # garson/menu/patron CSS-yazı tipi varlıklarını yeniden üretir (değişiklik olduysa commit edin)
npm run build
npx electron-builder --win --x64     # release\GaziantepliTahaUsta-Kurulum-<sürüm>.exe
```
Sürüm numarası `package.json › version` alanındadır.

## Güncelleme (sürüm yayınlama)
Kasa, sunucu ve garson sürümlerinin yayınlanması, geri dönüşü ve uyumluluğu için: [updates.md](updates.md) ve [versioning.md](versioning.md).
Özet: `node tools/make-deploy-package.cjs --update ...` → `sunucu-guncelleme/` klasöründeki zip'ler `config.local.php` İÇERMEZ; mevcut ayarlarınız korunur.
