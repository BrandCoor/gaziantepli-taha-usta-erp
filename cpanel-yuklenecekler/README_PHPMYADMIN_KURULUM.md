# 🗄️ Gaziantepli Taha Usta ERP - phpMyAdmin & MySQL Kurulum Rehberi

Bu rehber, restorandaki masaları, ürünleri, garsonları ve tüm siparişleri kendi hostinginizdeki **phpMyAdmin / MySQL** veritabanında saklamanız ve yönetmeniz için hazırlanmıştır.

---

## 🚀 1. Adım: cPanel'de Veritabanı Oluşturma

1. cPanel'inize giriş yapın.
2. **Veritabanları (Databases)** bölümünden **"MySQL® Veritabanları"** veya **"MySQL® Veritabanı Sihirbazı"**na tıklayın.
3. Yeni bir veritabanı adı belirleyin (Örnek: `tahausta_pos`).
4. Yeni bir veritabanı kullanıcısı ve güçlü bir şifre oluşturun (Örnek: `tahausta_user` ve `GucluSifre123!`).
5. Kullanıcıyı bu veritabanına ekleyin ve **"TÜM AYRICALIKLAR" (ALL PRIVILEGES)** kutucuğunu işaretleyip kaydedin.

---

## 📥 2. Adım: phpMyAdmin'de Tabloları Tek Tıkla İçe Aktarma

1. cPanel ana ekranından **phpMyAdmin**'e tıklayın.
2. Sol menüden 1. adımda oluşturduğunuz veritabanına tıklayın.
3. Üst menüdeki **"İçe Aktar" (Import)** sekmesine geçin.
4. **"Dosya Seç"** butonuna basarak projenizdeki **`cpanel-yuklenecekler/veritabani_kurulum.sql`** dosyasını seçin.
5. Sayfanın en altındaki **"İçe Aktar" (Git / Go)** butonuna tıklayın.

Mevcut ve daha önce kurulmuş bir veritabanını güncelliyorsanız, aynı işlemi ayrıca **`cpanel-yuklenecekler/database_migration.sql`** dosyasıyla yapın. Bu migration MySQL 5.7 uyumludur ve `ADD COLUMN IF NOT EXISTS` kullanmadığı için eski hosting sürümlerinde de çalışır. `database.sql` başlangıç şemasını içerir; migration dosyası mevcut tablolar içindir.

> ✅ Tebrikler! `ayarlar`, `bolumler`, `masalar`, `kategoriler`, `urunler`, `personeller`, `siparisler`, `online_siparisler` ve `cihazlar` tablolarınız Gaziantepli Taha Usta başlangıç menüsü ve masalarıyla birlikte anında oluştu!

---

## ⚙️ 3. Adım: config.php Dosyasını Düzenleme

Hosting ortamında `TAHA_DB_NAME`, `TAHA_DB_USER`, `TAHA_DB_PASS` ve `TAHA_BOSS_PASSWORD` ortam değişkenlerini tanımlayın. Gizli bilgileri PHP dosyasına veya git deposuna yazmayın:

```php
define('DB_HOST', 'localhost');                  // Genellikle 'localhost'
define('DB_PORT', '3306');
define('DB_NAME', getenv('TAHA_DB_NAME'));
define('DB_USER', getenv('TAHA_DB_USER'));
define('DB_PASS', getenv('TAHA_DB_PASS'));
define('DB_CHARSET', 'utf8mb4');
```

Sunucu ortam değişkeni tanımlayamıyorsa, hosting sağlayıcısının gizli yapılandırma mekanizmasını kullanın. `config.php` içindeki boş değerler yalnızca JSON fallback/yerel geliştirme içindir; üretimde MySQL bağlantısı doğrulanmadan garson eşleştirmesi yapılmaz.

---

## 🌐 4. Adım: Dosyaları Hostinginize Yükleme

cPanel **Dosya Yöneticisi**'ni açın ve `public_html/` dizinine:
- `api/` klasörünü (içinde `index.php`, `config.php`, `db_test.php`, `database.sql`) yükleyin.
- `garson/` klasörünü yükleyin (Mobil Garson Sipariş Terminali).
- `menu/` klasörünü yükleyin (Müşteri Canlı QR Menü & Sipariş Verme Ekranı).
- `patron/` klasörünü yükleyin (Mobil Anlık Ciro & Masa Doluluk İzleme).

---

## 🔍 5. Adım: Test ve Doğrulama

Tarayıcınızda şu adresi açın:
```
https://siteniz.com/api/db_test.php
```
Burada **"MySQL Bağlantısı BAŞARILI"** yeşil rozetini ve veritabanı tablolarınızın kayıt sayılarını canlı olarak göreceksiniz.

---

## 📱 Kasa, Garson ve Müşteri QR Menü Bağlantısı

- **Kasa POS Programı:** Sistem Ayarları > Yedekleme & Bulut sekmesinde API Sunucu Adresi kutusuna `https://siteniz.com/api/index.php` adresinizi kaydedin.
- **Müşteri QR Menü:** Masaların üzerine basacağınız karekodlar `https://siteniz.com/menu/?masa=1`, `?masa=2` şeklinde çalışır. Kasa > Ayarlar > Salon & Masalar sekmesinden her masa için QR kodları tek tıkla görüntüleyip yazdırabilirsiniz. Müşteri menüyü inceler, sepetine ürün ekleyip siparişini direkt mutfağa gönderebilir ve garson çağırabilir.
- **Garsonlar:** Telefonlarından `https://siteniz.com/garson` adresini açarak masalardan sipariş almaya başlayabilir.
- **Cihaz eşleştirme:** Kasa/yönetici ekranı veya yetkili garson, sunucuda doğrulandıktan sonra 5 dakika geçerli tek kullanımlık QR üretir. QR ham MAC adresi değildir; token sunucuda hash'li tutulur, ilk başarılı kullanımda tüketilir. QR başarısızsa telefon yerel oturum oluşturmaz.
- **Patron Paneli:** Telefonunuzdan `https://siteniz.com/patron` adresini açıp canlı ciroyu izleyebilirsiniz. Güvenlik gereği sabit bir varsayılan şifre gönderilmez: kurulumdan sonra patron şifresini `TAHA_BOSS_PASSWORD` ortam değişkeniyle veya `ayarlar` tablosundaki `boss_password` kaydıyla siz belirlemelisiniz. Şifre belirlenmeden panele giriş yapılamaz.
- **phpMyAdmin:** cPanel'den dilediğiniz an phpMyAdmin'e girerek masaları, ürün fiyatlarını ve geçmiş tüm adisyonları klasik SQL/Tablo görünümünde inceleyebilir veya Excel/SQL olarak yedekleyebilirsiniz.

### Eski MySQL sürümünde `#1064` hatası

`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` bazı MySQL/MariaDB sürümlerinde desteklenmez. Aşağıdaki eski sorguyu çalıştırmayın; mevcut veritabanı için `database_migration.sql` dosyasını içe aktarın. Migration kolon zaten varsa onu atlar.
