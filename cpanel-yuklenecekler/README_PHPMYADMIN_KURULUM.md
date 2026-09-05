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

> ✅ Tebrikler! `ayarlar`, `bolumler`, `masalar`, `kategoriler`, `urunler`, `personeller`, `siparisler`, `online_siparisler` ve `cihazlar` tablolarınız Gaziantepli Taha Usta başlangıç menüsü ve masalarıyla birlikte anında oluştu!

---

## ⚙️ 3. Adım: config.php Dosyasını Düzenleme

Projenizdeki **`cpanel-yuklenecekler/api/config.php`** dosyasını açın ve 1. adımda oluşturduğunuz bilgileri yazın:

```php
define('DB_HOST', 'localhost');                  // Genellikle 'localhost'
define('DB_PORT', '3306');
define('DB_NAME', 'cpanelKullanici_tahausta_pos'); // Veritabanı adınız
define('DB_USER', 'cpanelKullanici_tahausta_user'); // Veritabanı kullanıcınız
define('DB_PASS', 'GucluSifre123!');               // Belirlediğiniz şifre
define('DB_CHARSET', 'utf8mb4');
```

---

## 🌐 4. Adım: Dosyaları Hostinginize Yükleme

cPanel **Dosya Yöneticisi**'ni açın ve `public_html/` dizinine:
- `api/` klasörünü (içinde `index.php`, `config.php`, `db_test.php`) yükleyin.
- `garson/` klasörünü yükleyin.
- `patron/` klasörünü yükleyin.

---

## 🔍 5. Adım: Test ve Doğrulama

Tarayıcınızda şu adresi açın:
```
https://siteniz.com/api/db_test.php
```
Burada **"MySQL Bağlantısı BAŞARILI"** yeşil rozetini ve veritabanı tablolarınızın kayıt sayılarını canlı olarak göreceksiniz.

---

## 📱 Kasa ve Garsonların Bağlantısı

- **Kasa POS Programı:** Sistem Ayarları > Yedekleme & Bulut sekmesinde API Sunucu Adresi kutusuna `https://siteniz.com/api/index.php` adresinizi kaydedin.
- **Garsonlar:** Telefonlarından `https://siteniz.com/garson` adresini açarak sipariş almaya başlayabilir.
- **Patron Paneli:** Telefonunuzdan `https://siteniz.com/patron` adresini açıp varsayılan `1453` şifresiyle canlı ciroyu izleyebilirsiniz.
- **phpMyAdmin:** cPanel'den dilediğiniz an phpMyAdmin'e girerek masaları, ürün fiyatlarını ve geçmiş tüm adisyonları klasik SQL/Tablo görünümünde inceleyebilir veya Excel/SQL olarak yedekleyebilirsiniz.
