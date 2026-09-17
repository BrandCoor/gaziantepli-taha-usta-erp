<?php
/**
 * GAZİANTEPLİ TAHA USTA ERP - phpMyAdmin / MySQL Veritabanı Yapılandırması
 * -----------------------------------------------------------------------
 * Bu dosyayı cPanel / Hosting veritabanı bilgilerinizle düzenleyiniz.
 */

// 1. VERİTABANI BAĞLANTI BİLGİLERİ (cPanel -> MySQL Veritabanları)
define('DB_HOST', 'localhost');                  // Hosting sunucusu
define('DB_PORT', '3306');                       // MySQL varsayılan port
define('DB_NAME', 'ngsiteyo_tahausta_pos');      // cPanel Veritabanı Adı
define('DB_USER', 'ngsiteyo_tahausta_user');     // cPanel Veritabanı Kullanıcısı
define('DB_PASS', 'Tahausta2727');               // Veritabanı Şifresi
define('DB_CHARSET', 'utf8mb4');

// PATRON PANELİ ŞİFRESİ
define('DEFAULT_BOSS_PASSWORD', getenv('TAHA_BOSS_PASSWORD') ?: '');

// 3. PDO VERİTABANI BAĞLANTI FONKSİYONU
function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    // Eğer henüz varsayılan değerler değiştirilmemişse veya boşsa null dön
    if (empty(DB_NAME) || empty(DB_USER) || empty(DB_PASS)) {
        return null;
    }

    try {
        $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        // Hata durumunda log tutabiliriz veya false döneriz
        error_log("Veritabanı bağlantı hatası: " . $e->getMessage());
        return null;
    }
}

// 4. OTOMATİK TABLO KONTROLÜ VE OLUŞTURMA (SQL İçe Aktarma Yapılmadıysa Kendisi Kurar)
function ensureDatabaseTables($pdo) {
    if (!$pdo) return false;
    try {
        $sql = "
        CREATE TABLE IF NOT EXISTS `ayarlar` (
          `anahtar` VARCHAR(64) NOT NULL,
          `deger` LONGTEXT NULL,
          `aciklama` VARCHAR(255) NULL,
          `guncelleme_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`anahtar`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `bolumler` (
          `id` VARCHAR(50) NOT NULL,
          `ad` VARCHAR(100) NOT NULL,
          `masa_sayisi` INT DEFAULT 12,
          `kapasite_kisi` INT DEFAULT 4,
          `sira` INT DEFAULT 0,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `masalar` (
          `id` VARCHAR(50) NOT NULL,
          `bolum_id` VARCHAR(50) NOT NULL,
          `ad` VARCHAR(50) NOT NULL,
          `durum` VARCHAR(30) DEFAULT 'EMPTY',
          `aktif_siparis` LONGTEXT NULL,
          `toplam_tutar` DECIMAL(10,2) DEFAULT 0.00,
          `son_islem_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_bolum` (`bolum_id`),
          INDEX `idx_durum` (`durum`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `kategoriler` (
          `id` VARCHAR(50) NOT NULL,
          `ad` VARCHAR(100) NOT NULL,
          `renk` VARCHAR(30) DEFAULT '#ef4444',
          `yazici_id` VARCHAR(50) NULL,
          `sira` INT DEFAULT 0,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `urunler` (
          `id` VARCHAR(50) NOT NULL,
          `kategori_id` VARCHAR(50) NOT NULL,
          `ad` VARCHAR(150) NOT NULL,
          `fiyat` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `hazirlik_dk` INT DEFAULT 15,
          `barkod` VARCHAR(50) NULL,
          `yazici_id` VARCHAR(50) NULL,
          `aktif` TINYINT(1) DEFAULT 1,
          `aciklama` TEXT NULL,
          `resim_url` LONGTEXT NULL,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_kategori` (`kategori_id`),
          INDEX `idx_aktif` (`aktif`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `personeller` (
          `id` VARCHAR(50) NOT NULL,
          `ad` VARCHAR(100) NOT NULL,
          `rol` VARCHAR(30) DEFAULT 'WAITER',
          `pozisyon` VARCHAR(100) NULL,
          `telefon` VARCHAR(30) NULL,
          `maas` DECIMAL(10,2) DEFAULT 0.00,
          `maas_gunu` INT DEFAULT 1,
          `calisma_saati` DECIMAL(5,2) DEFAULT 8.00,
          `mesai_carpani` DECIMAL(4,2) DEFAULT 1.50,
          `iban` VARCHAR(50) NULL,
          `bakiye` DECIMAL(10,2) DEFAULT 0.00,
          `pin` VARCHAR(10) NULL,
          `qr_token` VARCHAR(100) NULL,
          `pairing_secret` VARCHAR(64) NULL,
          `pairing_expires_at` DATETIME NULL,
          `device_uuid` VARCHAR(100) NULL,
          `device_paired_at` DATETIME NULL,
          `aktif` TINYINT(1) DEFAULT 1,
          `baslangic_tarihi` VARCHAR(30) NULL,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `guncelleme_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_aktif` (`aktif`),
          INDEX `idx_pin` (`pin`),
          INDEX `idx_device_uuid` (`device_uuid`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `personel_hareketler` (
          `id` VARCHAR(60) NOT NULL,
          `personel_id` VARCHAR(50) NOT NULL,
          `tip` VARCHAR(50) NOT NULL,
          `tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `odeme_yontemi` VARCHAR(30) DEFAULT 'CASH',
          `tarih` VARCHAR(30) NOT NULL,
          `aciklama` TEXT NULL,
          `mesai_saati` DECIMAL(5,2) NULL,
          `mesai_carpani` DECIMAL(4,2) NULL,
          `saatlik_ucret` DECIMAL(10,2) NULL,
          `odeme_turu` VARCHAR(30) NULL,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_personel` (`personel_id`),
          INDEX `idx_tarih` (`tarih`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `musteriler` (
          `id` VARCHAR(50) NOT NULL,
          `ad` VARCHAR(150) NOT NULL,
          `telefon` VARCHAR(30) NULL,
          `email` VARCHAR(100) NULL,
          `adres` TEXT NULL,
          `notlar` TEXT NULL,
          `bakiye` DECIMAL(10,2) DEFAULT 0.00,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `guncelleme_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_ad` (`ad`),
          INDEX `idx_telefon` (`telefon`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `cari_hareketler` (
          `id` VARCHAR(60) NOT NULL,
          `musteri_id` VARCHAR(50) NOT NULL,
          `tip` VARCHAR(30) NOT NULL,
          `tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `odeme_yontemi` VARCHAR(30) DEFAULT 'CASH',
          `tarih` VARCHAR(30) NOT NULL,
          `aciklama` TEXT NULL,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_musteri` (`musteri_id`),
          INDEX `idx_tarih` (`tarih`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `toptancilar` (
          `id` VARCHAR(50) NOT NULL,
          `ad` VARCHAR(150) NOT NULL,
          `yetkili` VARCHAR(100) NULL,
          `telefon` VARCHAR(30) NULL,
          `email` VARCHAR(100) NULL,
          `kategori` VARCHAR(100) NULL,
          `adres` TEXT NULL,
          `bakiye` DECIMAL(10,2) DEFAULT 0.00,
          `notlar` TEXT NULL,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `guncelleme_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `toptanci_hareketler` (
          `id` VARCHAR(60) NOT NULL,
          `toptanci_id` VARCHAR(50) NOT NULL,
          `tip` VARCHAR(30) NOT NULL,
          `tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `odeme_yontemi` VARCHAR(30) DEFAULT 'CASH',
          `tarih` VARCHAR(30) NOT NULL,
          `fatura_no` VARCHAR(50) NULL,
          `aciklama` TEXT NULL,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_toptanci` (`toptanci_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `giderler` (
          `id` VARCHAR(60) NOT NULL,
          `baslik` VARCHAR(150) NOT NULL,
          `kategori` VARCHAR(100) NOT NULL,
          `toptanci_id` VARCHAR(50) NULL,
          `toptanci_adi` VARCHAR(150) NULL,
          `tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `odeme_yontemi` VARCHAR(30) DEFAULT 'CASH',
          `tarih` VARCHAR(30) NOT NULL,
          `aciklama` TEXT NULL,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_tarih` (`tarih`),
          INDEX `idx_kategori` (`kategori`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `z_raporlari` (
          `id` VARCHAR(60) NOT NULL,
          `z_no` INT NOT NULL,
          `tarih` VARCHAR(30) NOT NULL,
          `saat` VARCHAR(20) NULL,
          `kapanis_zamani` VARCHAR(50) NULL,
          `toplam_ciro` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `nakit` DECIMAL(10,2) DEFAULT 0.00,
          `kredi_karti` DECIMAL(10,2) DEFAULT 0.00,
          `veresiye` DECIMAL(10,2) DEFAULT 0.00,
          `yemek_karti` DECIMAL(10,2) DEFAULT 0.00,
          `ikram` DECIMAL(10,2) DEFAULT 0.00,
          `indirim` DECIMAL(10,2) DEFAULT 0.00,
          `iptal` DECIMAL(10,2) DEFAULT 0.00,
          `adisyon_sayisi` INT DEFAULT 0,
          `kapatan` VARCHAR(100) DEFAULT 'Kasa',
          `notlar` TEXT NULL,
          `detay_json` LONGTEXT NULL,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_z_no` (`z_no`),
          INDEX `idx_tarih` (`tarih`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `tamamlanan_adisyonlar` (
          `id` VARCHAR(60) NOT NULL,
          `masa_id` VARCHAR(50) NULL,
          `masa_adi` VARCHAR(100) NOT NULL,
          `garson_adi` VARCHAR(100) DEFAULT 'Garson',
          `toplam_tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `indirim_tutari` DECIMAL(10,2) DEFAULT 0.00,
          `ikram_tutari` DECIMAL(10,2) DEFAULT 0.00,
          `odemeler_json` LONGTEXT NULL,
          `kalemler_json` LONGTEXT NOT NULL,
          `z_raporu_id` VARCHAR(60) NULL,
          `durum` VARCHAR(30) DEFAULT 'PAID',
          `olusturma_tarihi` VARCHAR(50) NOT NULL,
          `kapanis_tarihi` VARCHAR(50) NULL,
          PRIMARY KEY (`id`),
          INDEX `idx_z_raporu` (`z_raporu_id`),
          INDEX `idx_olusturma` (`olusturma_tarihi`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `siparisler` (
          `id` VARCHAR(60) NOT NULL,
          `masa_id` VARCHAR(50) NOT NULL,
          `masa_adi` VARCHAR(50) NOT NULL,
          `garson_adi` VARCHAR(100) DEFAULT 'Garson',
          `siparis_turu` VARCHAR(30) DEFAULT 'ORDER',
          `kalemler` LONGTEXT NOT NULL,
          `toplam_tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `yazdirildi` TINYINT(1) DEFAULT 0,
          `durum` VARCHAR(30) DEFAULT 'NEW',
          `olusturma_tarihi` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_yazdirildi` (`yazdirildi`),
          INDEX `idx_masa` (`masa_id`),
          INDEX `idx_tarih` (`olusturma_tarihi`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `online_siparisler` (
          `id` VARCHAR(60) NOT NULL,
          `platform` VARCHAR(30) NOT NULL,
          `platform_kodu` VARCHAR(50) NOT NULL,
          `teslimat_modeli` VARCHAR(30) DEFAULT 'RESTAURANT',
          `musteri_adi` VARCHAR(150) NULL,
          `musteri_telefon` VARCHAR(50) NULL,
          `adres` TEXT NULL,
          `siparis_notu` TEXT NULL,
          `kalemler` LONGTEXT NOT NULL,
          `toplam_tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `odeme_yontemi` VARCHAR(100) NULL,
          `durum` VARCHAR(30) DEFAULT 'NEW',
          `red_nedeni` TEXT NULL,
          `hazirlik_suresi` INT DEFAULT 25,
          `olusturma_tarihi` DATETIME DEFAULT CURRENT_TIMESTAMP,
          `guncelleme_tarihi` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_platform` (`platform`),
          INDEX `idx_durum` (`durum`),
          INDEX `idx_tarih` (`olusturma_tarihi`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `cihazlar` (
          `waiter_id` VARCHAR(50) NOT NULL,
          `waiter_name` VARCHAR(100) NOT NULL,
          `device_uuid` VARCHAR(100) NOT NULL,
          `device_name` VARCHAR(100) NULL,
          `durum` VARCHAR(30) DEFAULT 'APPROVED',
          `eslesme_tarihi` DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`waiter_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 1. YAZICILAR (printers)
        CREATE TABLE IF NOT EXISTS `printers` (
          `id` VARCHAR(50) NOT NULL,
          `ad` VARCHAR(100) NOT NULL,
          `baglanti_turu` ENUM('NETWORK_TCP', 'SYSTEM_DRIVER') NOT NULL DEFAULT 'NETWORK_TCP',
          `ip_adresi` VARCHAR(45) NULL,
          `port` INT NOT NULL DEFAULT 9100,
          `driver_adi` VARCHAR(150) NULL,
          `kagit_genisligi` INT NOT NULL DEFAULT 80,
          `karakter_seti` VARCHAR(20) NOT NULL DEFAULT 'PC857',
          `auto_cut` TINYINT(1) NOT NULL DEFAULT 1,
          `buzzer` TINYINT(1) NOT NULL DEFAULT 1,
          `yedek_printer_id` VARCHAR(50) NULL,
          `aktif` TINYINT(1) NOT NULL DEFAULT 1,
          `olusturma_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `guncelleme_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_aktif` (`aktif`),
          INDEX `idx_yedek` (`yedek_printer_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 2. YAZICI ROTALARI (printer_routes)
        CREATE TABLE IF NOT EXISTS `printer_routes` (
          `id` VARCHAR(50) NOT NULL,
          `printer_id` VARCHAR(50) NOT NULL,
          `hedef_tipi` ENUM('KATEGORI', 'URUN', 'HESAP', 'IPTAL', 'GIDER', 'Z_RAPORU', 'MUTFAK_SIPARIS') NOT NULL,
          `hedef_id` VARCHAR(50) NULL,
          `olusturma_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_printer` (`printer_id`),
          INDEX `idx_hedef` (`hedef_tipi`, `hedef_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 3. KATEGORİLER (categories)
        CREATE TABLE IF NOT EXISTS `categories` (
          `id` VARCHAR(50) NOT NULL,
          `sira` INT NOT NULL DEFAULT 0,
          `ad` VARCHAR(100) NOT NULL,
          `renk_kodu` VARCHAR(30) NOT NULL DEFAULT '#ef4444',
          `olusturma_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 4. ÜRÜNLER (products)
        CREATE TABLE IF NOT EXISTS `products` (
          `id` VARCHAR(50) NOT NULL,
          `category_id` VARCHAR(50) NOT NULL,
          `ad` VARCHAR(150) NOT NULL,
          `taban_fiyat` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `kdv_orani` INT NOT NULL DEFAULT 10,
          `hazirlik_dk` INT NOT NULL DEFAULT 15,
          `barkod` VARCHAR(50) NULL,
          `resim_url` TEXT NULL,
          `aktif` TINYINT(1) NOT NULL DEFAULT 1,
          `olusturma_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_category` (`category_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 5. ÜRÜN VARYANTLARI (product_variants)
        CREATE TABLE IF NOT EXISTS `product_variants` (
          `id` VARCHAR(50) NOT NULL,
          `product_id` VARCHAR(50) NOT NULL,
          `varyant_adi` VARCHAR(100) NOT NULL,
          `fiyat_farki` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `varsayilan` TINYINT(1) NOT NULL DEFAULT 0,
          `sira` INT NOT NULL DEFAULT 0,
          PRIMARY KEY (`id`),
          INDEX `idx_product` (`product_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 6. ÜRÜN SEÇENEKLERİ (product_options)
        CREATE TABLE IF NOT EXISTS `product_options` (
          `id` VARCHAR(50) NOT NULL,
          `grup_adi` VARCHAR(100) NOT NULL,
          `secenek_adi` VARCHAR(100) NOT NULL,
          `fiyat_farki` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `sira` INT NOT NULL DEFAULT 0,
          PRIMARY KEY (`id`),
          INDEX `idx_grup` (`grup_adi`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 7. MASALAR (tables)
        CREATE TABLE IF NOT EXISTS `tables` (
          `id` VARCHAR(50) NOT NULL,
          `masa_kodu` VARCHAR(50) NOT NULL,
          `bolum` ENUM('SALON', 'BAHCE', 'PAKET') NOT NULL DEFAULT 'SALON',
          `durum` ENUM('BOS', 'DOLU', 'HESAP_ISTENDI', 'PAKET_SERVIS') NOT NULL DEFAULT 'BOS',
          `aktif_order_id` VARCHAR(50) NULL,
          `son_guncelleme` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uk_masa_kodu` (`masa_kodu`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 8. SİPARİŞLER (orders)
        CREATE TABLE IF NOT EXISTS `orders` (
          `id` VARCHAR(50) NOT NULL,
          `table_id` VARCHAR(50) NOT NULL,
          `garson_id` VARCHAR(50) NULL,
          `musteri_id` VARCHAR(50) NULL,
          `durum` ENUM('ACIK', 'KAPANDI', 'IPTAL') NOT NULL DEFAULT 'ACIK',
          `toplam_tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `indirim_tutari` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `odenen_tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `kalan_tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `versiyon` INT NOT NULL DEFAULT 1,
          `siparis_notu` TEXT NULL,
          `acilis_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `kapanis_zamani` TIMESTAMP NULL,
          PRIMARY KEY (`id`),
          INDEX `idx_table` (`table_id`),
          INDEX `idx_durum` (`durum`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 9. SİPARİŞ KALEMLERİ (order_items)
        CREATE TABLE IF NOT EXISTS `order_items` (
          `id` VARCHAR(50) NOT NULL,
          `order_id` VARCHAR(50) NOT NULL,
          `product_id` VARCHAR(50) NOT NULL,
          `varyant_bilgisi` VARCHAR(100) NULL,
          `secenekler_json` LONGTEXT NULL,
          `adet` DECIMAL(6,2) NOT NULL DEFAULT 1.00,
          `birim_fiyat` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `toplam_fiyat` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `siparis_notu` VARCHAR(255) NULL,
          `yazdirildi_mi` TINYINT(1) NOT NULL DEFAULT 0,
          `ikram_mi` TINYINT(1) NOT NULL DEFAULT 0,
          `iptal_edildi_mi` TINYINT(1) NOT NULL DEFAULT 0,
          `iptal_sebebi` VARCHAR(255) NULL,
          `iptal_eden_user_id` VARCHAR(50) NULL,
          `olusturma_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_order` (`order_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 10. ÖDEMELER (payments)
        CREATE TABLE IF NOT EXISTS `payments` (
          `id` VARCHAR(50) NOT NULL,
          `order_id` VARCHAR(50) NOT NULL,
          `tutar` DECIMAL(10,2) NOT NULL,
          `odeme_yontemi` ENUM('NAKIT', 'KREDİ_KARTI', 'HAVALE', 'CARI') NOT NULL,
          `musteri_id` VARCHAR(50) NULL,
          `kasa_user_id` VARCHAR(50) NULL,
          `aciklama` VARCHAR(255) NULL,
          `islem_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_order` (`order_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 11. MÜŞTERİLER (customers)
        CREATE TABLE IF NOT EXISTS `customers` (
          `id` VARCHAR(50) NOT NULL,
          `ad_soyad` VARCHAR(150) NOT NULL,
          `telefon` VARCHAR(30) NOT NULL,
          `adres` TEXT NULL,
          `adres_tarifi` TEXT NULL,
          `cari_bakiye` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `olusturma_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uk_telefon` (`telefon`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 12. TEDARİKÇİLER (suppliers)
        CREATE TABLE IF NOT EXISTS `suppliers` (
          `id` VARCHAR(50) NOT NULL,
          `unvan` VARCHAR(150) NOT NULL,
          `yetkili` VARCHAR(100) NULL,
          `telefon` VARCHAR(30) NULL,
          `kategori` VARCHAR(100) NULL,
          `cari_bakiye` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `olusturma_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 13. TEDARİKÇİ İŞLEMLERİ (supplier_transactions)
        CREATE TABLE IF NOT EXISTS `supplier_transactions` (
          `id` VARCHAR(50) NOT NULL,
          `supplier_id` VARCHAR(50) NOT NULL,
          `islem_turu` ENUM('FATURA_ALIS', 'ODEME') NOT NULL,
          `tutar` DECIMAL(10,2) NOT NULL,
          `odeme_kanali` VARCHAR(50) NULL,
          `fatura_no` VARCHAR(50) NULL,
          `aciklama` VARCHAR(255) NULL,
          `tarih` DATE NOT NULL,
          `olusturma_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_supplier` (`supplier_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 14. İŞLETME GİDERLERİ (expenses)
        CREATE TABLE IF NOT EXISTS `expenses` (
          `id` VARCHAR(50) NOT NULL,
          `kategori` VARCHAR(100) NOT NULL,
          `baslik` VARCHAR(150) NOT NULL,
          `tutar` DECIMAL(10,2) NOT NULL,
          `odeme_kanali` VARCHAR(50) NOT NULL DEFAULT 'KASA_NAKIT',
          `tarih` DATE NOT NULL,
          `aciklama` TEXT NULL,
          `olusturma_zamani` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 15. Z RAPORLARI (z_reports)
        CREATE TABLE IF NOT EXISTS `z_reports` (
          `id` VARCHAR(50) NOT NULL,
          `z_no` INT NOT NULL,
          `acilis_zamani` TIMESTAMP NOT NULL,
          `kapanis_zamani` TIMESTAMP NOT NULL,
          `toplam_satis` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `toplam_nakit` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `toplam_kart` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `toplam_veresiye` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `toplam_gider` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `kasada_kalan_nakit` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          `adisyon_sayisi` INT NOT NULL DEFAULT 0,
          `detay_json` LONGTEXT NULL,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uk_z_no` (`z_no`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 16. AUDIT LOGLARI (audit_logs)
        CREATE TABLE IF NOT EXISTS `audit_logs` (
          `id` VARCHAR(50) NOT NULL,
          `user_id` VARCHAR(50) NOT NULL,
          `islem_tipi` ENUM('IPTAL', 'IKRAM', 'MASA_TASIMA', 'MASA_BIRLESTIRME', 'ADISYON_BOLME', 'Z_KAPATMA', 'FIYAT_DEGISTIRME') NOT NULL,
          `detay` TEXT NOT NULL,
          `zaman` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 17. ONLİNE PLATFORMLAR (online_platforms)
        CREATE TABLE IF NOT EXISTS `online_platforms` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `platform_code` ENUM('YEMEKSEPETI', 'TRENDYOL', 'GETIR') NOT NULL UNIQUE,
          `display_name` VARCHAR(50) NOT NULL,
          `is_enabled` TINYINT(1) NOT NULL DEFAULT 0,
          `store_status` ENUM('OPEN', 'BUSY', 'CLOSED') NOT NULL DEFAULT 'CLOSED',
          `credentials_json` TEXT NULL,
          `webhook_secret` VARCHAR(100) NULL,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        -- 18. ONLİNE SİPARİŞLER (online_orders)
        CREATE TABLE IF NOT EXISTS `online_orders` (
          `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
          `platform_code` ENUM('YEMEKSEPETI', 'TRENDYOL', 'GETIR') NOT NULL,
          `platform_order_id` VARCHAR(100) NOT NULL,
          `customer_name` VARCHAR(100) NOT NULL,
          `customer_phone` VARCHAR(30) NULL,
          `delivery_address` TEXT NOT NULL,
          `order_note` TEXT NULL,
          `items_json` JSON NOT NULL,
          `total_amount` DECIMAL(10, 2) NOT NULL,
          `payment_method` VARCHAR(50) NOT NULL,
          `platform_status` VARCHAR(50) NOT NULL,
          `local_status` ENUM('BEKLIYOR', 'HAZIRLANIYOR', 'YOLA_CIKTI', 'TESLIM_EDILDI', 'IPTAL') NOT NULL DEFAULT 'BEKLIYOR',
          `cancel_reason` VARCHAR(255) NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY `uk_platform_order` (`platform_code`, `platform_order_id`),
          INDEX `idx_online_status` (`local_status`),
          INDEX `idx_online_created` (`created_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        $pdo->exec($sql);

        // Varsayılan platform kayıtları
        try {
            $pdo->exec("INSERT INTO `online_platforms` (`platform_code`, `display_name`, `is_enabled`, `store_status`) VALUES
                ('YEMEKSEPETI', 'Yemeksepeti', 0, 'CLOSED'),
                ('TRENDYOL', 'Trendyol Yemek', 0, 'CLOSED'),
                ('GETIR', 'GetirYemek', 0, 'CLOSED')
                ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`)");
        } catch (Exception $ignore) {}

        // Ekstra sütun kontrolleri
        try {
            $pdo->exec("ALTER TABLE `urunler` ADD COLUMN `aciklama` TEXT NULL");
        } catch (Exception $ignore) {}
        try {
            $pdo->exec("ALTER TABLE `urunler` MODIFY COLUMN `resim_url` LONGTEXT NULL");
        } catch (Exception $ignore) {}
        try {
            $pdo->exec("ALTER TABLE `personeller` ADD COLUMN `maas` DECIMAL(10,2) DEFAULT 0.00");
        } catch (Exception $ignore) {}
        try {
            $pdo->exec("ALTER TABLE `personeller` ADD COLUMN `bakiye` DECIMAL(10,2) DEFAULT 0.00");
        } catch (Exception $ignore) {}
        try {
            $pdo->exec("ALTER TABLE `personeller` ADD COLUMN `pozisyon` VARCHAR(100) NULL");
        } catch (Exception $ignore) {}
        try {
            $pdo->exec("ALTER TABLE `personeller` ADD COLUMN `device_uuid` VARCHAR(100) NULL");
        } catch (Exception $ignore) {}
        try {
            $pdo->exec("ALTER TABLE `personeller` ADD COLUMN `device_paired_at` DATETIME NULL");
        } catch (Exception $ignore) {}
        try {
            $pdo->exec("ALTER TABLE `personeller` ADD COLUMN `qr_token` VARCHAR(100) NULL");
        } catch (Exception $ignore) {}
        try {
            $pdo->exec("ALTER TABLE `personeller` ADD COLUMN `pairing_secret` VARCHAR(64) NULL");
        } catch (Exception $ignore) {}
        try {
            $pdo->exec("ALTER TABLE `personeller` ADD COLUMN `pairing_expires_at` DATETIME NULL");
        } catch (Exception $ignore) {}

        return true;
    } catch (Exception $e) {
        error_log("Tablo kontrol hatası: " . $e->getMessage());
        return false;
    }
}
