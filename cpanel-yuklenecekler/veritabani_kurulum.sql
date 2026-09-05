-- ==========================================================
-- GAZİANTEPLİ TAHA USTA ERP - phpMyAdmin MySQL Veritabanı Şeması
-- Karakter Seti: utf8mb4 / utf8mb4_unicode_ci
-- ==========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. GENEL AYARLAR TABLOSU
CREATE TABLE IF NOT EXISTS `ayarlar` (
  `anahtar` VARCHAR(64) NOT NULL,
  `deger` LONGTEXT NULL,
  `aciklama` VARCHAR(255) NULL,
  `guncelleme_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`anahtar`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BÖLÜMLER (Ana Salon, Bahçe, Paket Servis vb.)
CREATE TABLE IF NOT EXISTS `bolumler` (
  `id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(100) NOT NULL,
  `masa_sayisi` INT DEFAULT 12,
  `kapasite_kisi` INT DEFAULT 4,
  `sira` INT DEFAULT 0,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. MASALAR (Masa durumları ve anlık açık adisyonlar)
CREATE TABLE IF NOT EXISTS `masalar` (
  `id` VARCHAR(50) NOT NULL,
  `bolum_id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(50) NOT NULL,
  `durum` VARCHAR(30) DEFAULT 'EMPTY', -- EMPTY, OCCUPIED, BILL_REQUESTED
  `aktif_siparis` LONGTEXT NULL,        -- Anlık masa siparişi (JSON)
  `toplam_tutar` DECIMAL(10,2) DEFAULT 0.00,
  `son_islem_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_bolum` (`bolum_id`),
  INDEX `idx_durum` (`durum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. KATEGORİLER (Kebaplar, Pideler, İçecekler vb.)
CREATE TABLE IF NOT EXISTS `kategoriler` (
  `id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(100) NOT NULL,
  `renk` VARCHAR(30) DEFAULT '#ef4444',
  `yazici_id` VARCHAR(50) NULL,
  `sira` INT DEFAULT 0,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ÜRÜNLER (Menü Ürünleri, Fiyatlar, Barkodlar)
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

-- 6. PERSONELLER & GARSONLAR
CREATE TABLE IF NOT EXISTS `personeller` (
  `id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(100) NOT NULL,
  `rol` VARCHAR(30) DEFAULT 'WAITER', -- WAITER, CASHIER, CHEF, ADMIN
  `telefon` VARCHAR(30) NULL,
  `pin` VARCHAR(10) NULL,
  `qr_token` VARCHAR(100) NULL,
  `aktif` TINYINT(1) DEFAULT 1,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. SİPARİŞLER (Garson & Kasa Siparişleri, Yazdırma Kuyruğu)
CREATE TABLE IF NOT EXISTS `siparisler` (
  `id` VARCHAR(60) NOT NULL,
  `masa_id` VARCHAR(50) NOT NULL,
  `masa_adi` VARCHAR(50) NOT NULL,
  `garson_adi` VARCHAR(100) DEFAULT 'Garson',
  `siparis_turu` VARCHAR(30) DEFAULT 'ORDER', -- ORDER, BILL_REQUEST, TRANSFER_TABLE
  `kalemler` LONGTEXT NOT NULL,               -- Sipariş içerisindeki ürünler (JSON)
  `toplam_tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `yazdirildi` TINYINT(1) DEFAULT 0,          -- Kasa mutfak yazıcısına iletildi mi?
  `durum` VARCHAR(30) DEFAULT 'NEW',          -- NEW, PREPARING, SERVED, COMPLETED, CANCELLED
  `olusturma_tarihi` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_yazdirildi` (`yazdirildi`),
  INDEX `idx_masa` (`masa_id`),
  INDEX `idx_tarih` (`olusturma_tarihi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. ONLİNE YEMEK PLATFORM SİPARİŞLERİ (Trendyol, Getir, Yemeksepeti)
CREATE TABLE IF NOT EXISTS `online_siparisler` (
  `id` VARCHAR(60) NOT NULL,
  `platform` VARCHAR(30) NOT NULL,             -- TRENDYOL, GETIR, YEMEKSEPETI
  `platform_kodu` VARCHAR(50) NOT NULL,        -- #TY-1234, #GT-5678, #YS-9012
  `teslimat_modeli` VARCHAR(30) DEFAULT 'RESTAURANT', -- RESTAURANT, PLATFORM
  `musteri_adi` VARCHAR(150) NULL,
  `musteri_telefon` VARCHAR(50) NULL,
  `adres` TEXT NULL,
  `siparis_notu` TEXT NULL,
  `kalemler` LONGTEXT NOT NULL,
  `toplam_tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `odeme_yontemi` VARCHAR(100) NULL,
  `durum` VARCHAR(30) DEFAULT 'NEW',           -- NEW, ACCEPTED, PREPARING, ON_DELIVERY, DELIVERED, REJECTED, CANCELLED
  `red_nedeni` TEXT NULL,
  `hazirlik_suresi` INT DEFAULT 25,
  `olusturma_tarihi` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `guncelleme_tarihi` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_platform` (`platform`),
  INDEX `idx_durum` (`durum`),
  INDEX `idx_tarih` (`olusturma_tarihi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. EŞLEŞEN CİHAZLAR (Garson Telefonları & Tabletler)
CREATE TABLE IF NOT EXISTS `cihazlar` (
  `waiter_id` VARCHAR(50) NOT NULL,
  `waiter_name` VARCHAR(100) NOT NULL,
  `device_uuid` VARCHAR(100) NOT NULL,
  `device_name` VARCHAR(100) NULL,
  `durum` VARCHAR(30) DEFAULT 'APPROVED',
  `eslesme_tarihi` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`waiter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. KASA GEÇMİŞ İŞLEMLERİ & GELİR / GİDER
CREATE TABLE IF NOT EXISTS `kasa_islemleri` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `islem_turu` VARCHAR(50) NOT NULL, -- SATIS, GIDER, IADE, NAKIT_GIRIS
  `tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `odeme_yontemi` VARCHAR(50) NOT NULL, -- NAKIT, KREDI_KARTI, YEMEK_KARTI, ONLINE
  `aciklama` TEXT NULL,
  `tarih` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tarih` (`tarih`),
  INDEX `idx_tur` (`islem_turu`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- BAŞLANGIÇ VERİLERİ (SEED DATA)
-- ==========================================================

-- Ayarlar
INSERT INTO `ayarlar` (`anahtar`, `deger`, `aciklama`) VALUES
('boss_settings', '{\"password\":\"1453\",\"approved_devices\":[]}', 'Patron Paneli Güvenlik ve Şifre Ayarı'),
('platform_store_status', '{\"TRENDYOL\":{\"isOpen\":true},\"GETIR\":{\"isOpen\":true},\"YEMEKSEPETI\":{\"isOpen\":true}}', 'Entegrasyon Mağazaları Açık/Kapalı Durumu'),
('last_updated', UNIX_TIMESTAMP(), 'Son veri senkronizasyon zamanı')
ON DUPLICATE KEY UPDATE `deger` = VALUES(`deger`);

-- Bölümler
INSERT INTO `bolumler` (`id`, `ad`, `masa_sayisi`, `kapasite_kisi`, `sira`) VALUES
('sec-salon', 'Ana Salon', 12, 4, 1),
('sec-bahce', 'Bahçe', 10, 6, 2),
('sec-paket', 'Paket Servis', 8, 1, 3)
ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`);

-- Kategoriler
INSERT INTO `kategoriler` (`id`, `ad`, `renk`, `sira`) VALUES
('cat-kebap', 'Kebaplar & Izgaralar', '#ef4444', 1),
('cat-firin', 'Pide & Lahmacun', '#f97316', 2),
('cat-corba', 'Çorbalar & Mezeler', '#eab308', 3),
('cat-icecek', 'İçecekler & Meşrubat', '#06b6d4', 4),
('cat-tatli', 'Tatlılar & Meyve', '#ec4899', 5)
ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `renk` = VALUES(`renk`);

-- Menü Ürünleri
INSERT INTO `urunler` (`id`, `kategori_id`, `ad`, `fiyat`, `hazirlik_dk`, `aktif`) VALUES
('p1', 'cat-kebap', 'Adana Kebap (Porsiyon)', 320.00, 15, 1),
('p2', 'cat-kebap', 'Urfa Kebap (Porsiyon)', 320.00, 15, 1),
('p3', 'cat-kebap', 'Kuzu Şiş Kebap', 380.00, 18, 1),
('p4', 'cat-kebap', 'Ali Nazik Kebap', 390.00, 20, 1),
('p5', 'cat-firin', 'Gaziantep Lahmacun', 110.00, 8, 1),
('p6', 'cat-firin', 'Kuşbaşılı Kaşarlı Pide', 280.00, 12, 1),
('p7', 'cat-firin', 'Kıymalı Kaşarlı Pide', 260.00, 10, 1),
('p8', 'cat-icecek', 'Açık Yayık Ayranı', 40.00, 1, 1),
('p9', 'cat-icecek', 'Kutu Meşrubat / Şalgam', 45.00, 1, 1),
('p10', 'cat-tatli', 'Antep Fıstıklı Künefe', 180.00, 12, 1)
ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `fiyat` = VALUES(`fiyat`);

-- Masalar (Ana Salon: Masa 1-12)
INSERT INTO `masalar` (`id`, `bolum_id`, `ad`, `durum`) VALUES
('sec-salon-1', 'sec-salon', 'Masa 1', 'EMPTY'),
('sec-salon-2', 'sec-salon', 'Masa 2', 'EMPTY'),
('sec-salon-3', 'sec-salon', 'Masa 3', 'EMPTY'),
('sec-salon-4', 'sec-salon', 'Masa 4', 'EMPTY'),
('sec-salon-5', 'sec-salon', 'Masa 5', 'EMPTY'),
('sec-salon-6', 'sec-salon', 'Masa 6', 'EMPTY'),
('sec-salon-7', 'sec-salon', 'Masa 7', 'EMPTY'),
('sec-salon-8', 'sec-salon', 'Masa 8', 'EMPTY'),
('sec-salon-9', 'sec-salon', 'Masa 9', 'EMPTY'),
('sec-salon-10', 'sec-salon', 'Masa 10', 'EMPTY'),
('sec-salon-11', 'sec-salon', 'Masa 11', 'EMPTY'),
('sec-salon-12', 'sec-salon', 'Masa 12', 'EMPTY'),
-- Bahçe Masaları
('sec-bahce-1', 'sec-bahce', 'Bahçe 1', 'EMPTY'),
('sec-bahce-2', 'sec-bahce', 'Bahçe 2', 'EMPTY'),
('sec-bahce-3', 'sec-bahce', 'Bahçe 3', 'EMPTY'),
('sec-bahce-4', 'sec-bahce', 'Bahçe 4', 'EMPTY'),
('sec-bahce-5', 'sec-bahce', 'Bahçe 5', 'EMPTY'),
('sec-bahce-6', 'sec-bahce', 'Bahçe 6', 'EMPTY')
ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`);

SET FOREIGN_KEY_CHECKS = 1;
