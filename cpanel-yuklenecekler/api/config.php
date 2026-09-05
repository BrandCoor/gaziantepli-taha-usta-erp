<?php
/**
 * GAZİANTEPLİ TAHA USTA ERP - phpMyAdmin / MySQL Veritabanı Yapılandırması
 * -----------------------------------------------------------------------
 * Bu dosyayı cPanel / Hosting veritabanı bilgilerinizle düzenleyiniz.
 */

// 1. VERİTABANI BAĞLANTI BİLGİLERİ (cPanel -> MySQL Veritabanları)
define('DB_HOST', 'localhost');                  // Hosting sunucusu (genellikle 'localhost')
define('DB_PORT', '3306');                       // MySQL varsayılan port
define('DB_NAME', 'kullanici_tahausta');         // cPanel'de oluşturduğunuz Veritabanı Adı
define('DB_USER', 'kullanici_posuser');          // cPanel Veritabanı Kullanıcısı
define('DB_PASS', 'GucluSifreniz123!');          // Veritabanı Kullanıcı Şifresi
define('DB_CHARSET', 'utf8mb4');

// 2. PATRON PANELİ ŞİFRESİ (İsteğe bağlı değiştirebilirsiniz)
define('DEFAULT_BOSS_PASSWORD', '1453');

// 3. PDO VERİTABANI BAĞLANTI FONKSİYONU
function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    // Eğer henüz varsayılan değerler değiştirilmemişse veya boşsa null dön
    if (DB_NAME === 'kullanici_tahausta' || empty(DB_NAME)) {
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
          `resim_url` VARCHAR(255) NULL,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          INDEX `idx_kategori` (`kategori_id`),
          INDEX `idx_aktif` (`aktif`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `personeller` (
          `id` VARCHAR(50) NOT NULL,
          `ad` VARCHAR(100) NOT NULL,
          `rol` VARCHAR(30) DEFAULT 'WAITER',
          `telefon` VARCHAR(30) NULL,
          `pin` VARCHAR(10) NULL,
          `qr_token` VARCHAR(100) NULL,
          `aktif` TINYINT(1) DEFAULT 1,
          `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`)
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
        ";
        $pdo->exec($sql);
        return true;
    } catch (Exception $e) {
        error_log("Tablo kontrol hatası: " . $e->getMessage());
        return false;
    }
}
