# Dağıtım: sunucu + kasa + telefonlar

## A. Sunucu (cPanel hosting)

Gerekenler: PHP ≥ 8.1 (`pdo_mysql`, `mbstring`, `openssl`), MySQL/MariaDB, **SSL sertifikası (AutoSSL)**.

1. **Veritabanı:** cPanel › MySQL Veritabanları › yeni veritabanı + kullanıcı + *tüm ayrıcalıklar*. (Tabloları elle içe aktarmanız gerekmez; API ilk çağrıda kurar.)
2. **Dosyalar:** `cpanel-yuklenecekler/` klasörünün **içeriğini** hosting'e yükleyin (ör. `public_html/` altında: `api/`, `garson/`, `menu/`, `patron/`, `assets/`, `.htaccess`).
3. **Gizli ayarlar:** `api/config.local.example.php` dosyasını `api/config.local.php` olarak kopyalayın ve doldurun:
   ```php
   return [
     'DB_HOST' => 'localhost', 'DB_PORT' => '3306',
     'DB_NAME' => '…', 'DB_USER' => '…', 'DB_PASS' => '…',   // YENİ parola
     'APP_SECRET'   => '<rastgele ≥32 karakter>',
     'KASA_API_KEY' => '<rastgele ≥24 karakter>',
     'BOSS_PASSWORD'=> '',   // boş bırakın; patron parolasını panelden belirleyin (bkz. aşağı)
   ];
   ```
   Rastgele değer üretmek için (bilgisayarınızda): `php -r "echo bin2hex(random_bytes(32));"` veya PowerShell: `-join ((1..64) | % { '{0:x}' -f (Get-Random -Max 16) })`.
   Bu dosya **Git'e girmez** ve `.htaccess` ile web'den okunamaz.
4. **Doğrulama:** tarayıcıda `https://alanadiniz.com/api/index.php?action=health` → `{"success":true,"status":"ONLINE",…}`. `https://…/api/index.php?action=get_live_state` → **401 Yetkisiz** vermelidir (kimliksiz erişim kapalı).
5. **Patron parolası:** `BOSS_PASSWORD` boşsa ilk girişte hiçbir parola kabul edilmez. Patron parolasını belirlemek için sunucuda `config.local.php` içine **geçici** bir `BOSS_PASSWORD` yazın, `https://…/patron/` ile giriş yapın (parola ilk girişte `ayarlar` tablosuna **hash** olarak yazılır), sonra `config.local.php` içinden silin ve panelden *Parolayı değiştir* ile kalıcı parolanızı verin.
6. **PHP hataları:** üretimde ekrana basılmaz (`display_errors=0`); sorun için cPanel › Hatalar (error_log).

### Eski sunucudan geçiş uyarısı
Yeni `index.php` ile eski kasa sürümü **birlikte çalışmaz** (`ack_orders` ve kasa anahtarı gerekir). Sunucuyu ve kasayı birlikte güncelleyin.

## B. Kasa bilgisayarı (Windows 10/11 x64)

1. `GaziantepliTahaUsta-Kurulum-<sürüm>.exe` çalıştırılır (kurulum klasörü seçilebilir; masaüstü kısayolu oluşur). Paket kod imzalı olmadığı için SmartScreen uyarısında *Yine de çalıştır* denir.
2. İlk açılış: **yönetici hesabı oluşturma** ekranı (hazır parola yoktur).
3. **Restoran & Donanım Ayarları › Bulut & Yedekleme:**
   - *Merkezi API Endpoint Adresi:* `https://alanadiniz.com/api/index.php`
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
