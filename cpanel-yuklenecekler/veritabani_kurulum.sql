-- ==========================================================
-- GAZİANTEPLİ TAHA USTA ERP & POS - phpMyAdmin MySQL Veritabanı Şeması
-- Karakter Seti: utf8mb4 / utf8mb4_unicode_ci
-- ==========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. GENEL AYARLAR TABLOSU (Patron şifresi, şirket bilgileri vb.)
CREATE TABLE IF NOT EXISTS `ayarlar` (
  `anahtar` VARCHAR(64) NOT NULL,
  `deger` LONGTEXT NULL,
  `aciklama` VARCHAR(255) NULL,
  `guncelleme_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`anahtar`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BÖLÜMLER (Ana Salon, Bahçe, Teras, Paket Servis vb.)
CREATE TABLE IF NOT EXISTS `bolumler` (
  `id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(100) NOT NULL,
  `masa_sayisi` INT DEFAULT 12,
  `kapasite_kisi` INT DEFAULT 4,
  `sira` INT DEFAULT 0,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. MASALAR (Masa durumları, açık adisyonlar, toplam tutarlar)
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

-- 4. KATEGORİLER (Kebaplar, Pideler, Çorbalar, İçecekler vb.)
CREATE TABLE IF NOT EXISTS `kategoriler` (
  `id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(100) NOT NULL,
  `renk` VARCHAR(30) DEFAULT '#ef4444',
  `yazici_id` VARCHAR(50) NULL,
  `sira` INT DEFAULT 0,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ÜRÜNLER (Menü Ürünleri, Fiyatlar, Resimler, Açıklamalar)
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

-- 6. PERSONELLER (Garsonlar, Kasiyerler, Ustalar & Yönetim)
CREATE TABLE IF NOT EXISTS `personeller` (
  `id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(100) NOT NULL,
  `rol` VARCHAR(30) DEFAULT 'WAITER', -- WAITER, CASHIER, CHEF, ADMIN
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
  `device_uuid` VARCHAR(100) NULL,
  `device_paired_at` DATETIME NULL,
  `pairing_secret` VARCHAR(64) NULL,
  `pairing_expires_at` DATETIME NULL,
  `aktif` TINYINT(1) DEFAULT 1,
  `baslangic_tarihi` VARCHAR(30) NULL,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `guncelleme_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_aktif` (`aktif`),
  INDEX `idx_pin` (`pin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. PERSONEL HAREKETLERİ (Maaş Tahakkuku, Avans, Mesai, Prim, Kesinti, Ekstreler)
CREATE TABLE IF NOT EXISTS `personel_hareketler` (
  `id` VARCHAR(60) NOT NULL,
  `personel_id` VARCHAR(50) NOT NULL,
  `tip` VARCHAR(50) NOT NULL, -- SALARY_ACCRUAL, ADVANCE, SALARY_PAYMENT, BONUS, DEDUCTION, OVERTIME_PAYMENT
  `tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `odeme_yontemi` VARCHAR(30) DEFAULT 'CASH', -- CASH, BANK
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

-- 8. MÜŞTERİLER / CARİLER (Veresiye Müşterileri, Bakiyeler & Ekstreler)
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

-- 9. CARİ HAREKETLER / EKSTRELER (Borçlandırma, Tahsilat, Sipariş Fişleri)
CREATE TABLE IF NOT EXISTS `cari_hareketler` (
  `id` VARCHAR(60) NOT NULL,
  `musteri_id` VARCHAR(50) NOT NULL,
  `tip` VARCHAR(30) NOT NULL, -- DEBT (Borç), COLLECTION (Tahsilat)
  `tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `odeme_yontemi` VARCHAR(30) DEFAULT 'CASH', -- CASH, BANK, CREDIT_CARD
  `tarih` VARCHAR(30) NOT NULL,
  `aciklama` TEXT NULL,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_musteri` (`musteri_id`),
  INDEX `idx_tarih` (`tarih`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. TOPTANCILAR / TEDARİKÇİLER
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

-- 11. TOPTANCI HAREKETLERİ (Fatura Girişi, Ödemeler)
CREATE TABLE IF NOT EXISTS `toptanci_hareketler` (
  `id` VARCHAR(60) NOT NULL,
  `toptanci_id` VARCHAR(50) NOT NULL,
  `tip` VARCHAR(30) NOT NULL, -- INVOICE, PAYMENT, PURCHASE
  `tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `odeme_yontemi` VARCHAR(30) DEFAULT 'CASH',
  `tarih` VARCHAR(30) NOT NULL,
  `fatura_no` VARCHAR(50) NULL,
  `aciklama` TEXT NULL,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_toptanci` (`toptanci_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. GİDERLER (Kira, Fatura, Mutfak Alımları, Personel Harcamaları)
CREATE TABLE IF NOT EXISTS `giderler` (
  `id` VARCHAR(60) NOT NULL,
  `baslik` VARCHAR(150) NOT NULL,
  `kategori` VARCHAR(100) NOT NULL,
  `toptanci_id` VARCHAR(50) NULL,
  `toptanci_adi` VARCHAR(150) NULL,
  `tutar` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `odeme_yontemi` VARCHAR(30) DEFAULT 'CASH', -- CASH, CREDIT_CARD, BANK
  `tarih` VARCHAR(30) NOT NULL,
  `aciklama` TEXT NULL,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tarih` (`tarih`),
  INDEX `idx_kategori` (`kategori`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Z RAPORLARI (Gün Sonu Kapanış Raporları & Detaylı Veriler)
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
  `detay_json` LONGTEXT NULL, -- Kategori dökümü, saatlik satışlar, kalemler
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_z_no` (`z_no`),
  INDEX `idx_tarih` (`tarih`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. TAMAMLANAN ADİSYONLAR / SİPARİŞ GEÇMİŞİ
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

-- 15. CANLI MUTFAK / KASA YAZDIRMA KUYRUĞU (Siparişler)
CREATE TABLE IF NOT EXISTS `siparisler` (
  `id` VARCHAR(60) NOT NULL,
  `masa_id` VARCHAR(50) NOT NULL,
  `masa_adi` VARCHAR(50) NOT NULL,
  `garson_adi` VARCHAR(100) DEFAULT 'Garson',
  `siparis_turu` VARCHAR(30) DEFAULT 'ORDER', -- ORDER, WAITER_CALL, BILL_REQUEST, TRANSFER_TABLE
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

-- 16. ONLİNE SİPARİŞLER (Getir, Yemeksepeti, Trendyol)
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
  INDEX `idx_durum` (`durum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. EŞLEŞEN CİHAZLAR (Garson Telefonları & Tabletler)
CREATE TABLE IF NOT EXISTS `cihazlar` (
  `waiter_id` VARCHAR(50) NOT NULL,
  `waiter_name` VARCHAR(100) NOT NULL,
  `device_uuid` VARCHAR(100) NOT NULL,
  `device_name` VARCHAR(100) NULL,
  `durum` VARCHAR(30) DEFAULT 'APPROVED',
  `eslesme_tarihi` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`waiter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- BAŞLANGIÇ VERİLERİ (SEED DATA)
-- ==========================================================

-- Ayarlar
INSERT INTO `ayarlar` (`anahtar`, `deger`, `aciklama`) VALUES
('boss_password', '1453', 'Patron Paneli Giriş Parolası'),
('boss_settings', '{\"password\":\"1453\",\"approved_devices\":[]}', 'Patron Paneli Güvenlik Ayarı'),
('platform_store_status', '{\"TRENDYOL\":{\"isOpen\":true},\"GETIR\":{\"isOpen\":true},\"YEMEKSEPETI\":{\"isOpen\":true}}', 'Entegrasyon Mağazaları Açık/Kapalı Durumu'),
('company_settings', '{\"companyName\":\"Gaziantepli Taha Usta\",\"phone\":\"0530 000 0000\"}', 'Firma Bilgileri')
ON DUPLICATE KEY UPDATE `anahtar` = VALUES(`anahtar`);

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
INSERT INTO `urunler` (`id`, `kategori_id`, `ad`, `fiyat`, `hazirlik_dk`, `aktif`, `aciklama`, `resim_url`) VALUES
('p1', 'cat-kebap', 'Adana Kebap (Porsiyon)', 320.00, 15, 1, 'Zırhla çekilmiş kuzu eti, köz biber ve domates ile.', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80'),
('p2', 'cat-kebap', 'Urfa Kebap (Porsiyon)', 320.00, 15, 1, 'Acısız kuzu kıyma kebap, közlenmiş sebzeler eşliğinde.', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80'),
('p3', 'cat-kebap', 'Kuzu Şiş Kebap', 380.00, 18, 1, 'Marine kuzu but parçaları kömür ızgarada.', 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&auto=format&fit=crop&q=80'),
('p4', 'cat-kebap', 'Ali Nazik Kebap', 390.00, 20, 1, 'Sarımsaklı süzme yoğurtlu köz patlıcan üzerinde kuşbaşı kuzu.', 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80'),
('p5', 'cat-firin', 'Gaziantep Lahmacun', 110.00, 8, 1, 'Çıtır taş fırında Antep usulü sarımsaklı ve maydanozlu lahmacun.', 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80'),
('p6', 'cat-firin', 'Kuşbaşılı Kaşarlı Pide', 280.00, 12, 1, 'Taş fırında tereyağlı çıtır kenarlı özel pide.', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80'),
('p7', 'cat-firin', 'Kıymalı Kaşarlı Pide', 260.00, 10, 1, 'Kıymalı harç ve bol taze kaşar peyniri.', 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80'),
('p8', 'cat-icecek', 'Açık Yayık Ayranı', 40.00, 1, 1, 'Doğal bol köpüklü taze yayık ayranı.', 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80'),
('p9', 'cat-icecek', 'Kutu Meşrubat / Şalgam', 45.00, 1, 1, 'Soğuk meşrubat ve acılı/acısız Adana şalgamı.', 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80'),
('p10', 'cat-tatli', 'Antep Fıstıklı Künefe', 180.00, 12, 1, 'Özel peynirli, hakiki tereyağlı ve bol fıstıklı sıcak künefe.', 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=600&auto=format&fit=crop&q=80')
ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `fiyat` = VALUES(`fiyat`);

-- Masalar (Kasa ile Birebir Uyumlu)
INSERT INTO `masalar` (`id`, `bolum_id`, `ad`, `durum`) VALUES
('tbl-sec-salon-1', 'sec-salon', 'Ana Salon 1', 'EMPTY'),
('tbl-sec-salon-2', 'sec-salon', 'Ana Salon 2', 'EMPTY'),
('tbl-sec-salon-3', 'sec-salon', 'Ana Salon 3', 'EMPTY'),
('tbl-sec-salon-4', 'sec-salon', 'Ana Salon 4', 'EMPTY'),
('tbl-sec-salon-5', 'sec-salon', 'Ana Salon 5', 'EMPTY'),
('tbl-sec-salon-6', 'sec-salon', 'Ana Salon 6', 'EMPTY'),
('tbl-sec-salon-7', 'sec-salon', 'Ana Salon 7', 'EMPTY'),
('tbl-sec-salon-8', 'sec-salon', 'Ana Salon 8', 'EMPTY'),
('tbl-sec-salon-9', 'sec-salon', 'Ana Salon 9', 'EMPTY'),
('tbl-sec-salon-10', 'sec-salon', 'Ana Salon 10', 'EMPTY'),
('tbl-sec-salon-11', 'sec-salon', 'Ana Salon 11', 'EMPTY'),
('tbl-sec-salon-12', 'sec-salon', 'Ana Salon 12', 'EMPTY'),
('tbl-sec-bahce-1', 'sec-bahce', 'Bahçe 1', 'EMPTY'),
('tbl-sec-bahce-2', 'sec-bahce', 'Bahçe 2', 'EMPTY'),
('tbl-sec-bahce-3', 'sec-bahce', 'Bahçe 3', 'EMPTY'),
('tbl-sec-bahce-4', 'sec-bahce', 'Bahçe 4', 'EMPTY'),
('tbl-sec-bahce-5', 'sec-bahce', 'Bahçe 5', 'EMPTY'),
('tbl-sec-bahce-6', 'sec-bahce', 'Bahçe 6', 'EMPTY'),
('tbl-sec-bahce-7', 'sec-bahce', 'Bahçe 7', 'EMPTY'),
('tbl-sec-bahce-8', 'sec-bahce', 'Bahçe 8', 'EMPTY'),
('tbl-sec-bahce-9', 'sec-bahce', 'Bahçe 9', 'EMPTY'),
('tbl-sec-bahce-10', 'sec-bahce', 'Bahçe 10', 'EMPTY'),
('tbl-sec-paket-1', 'sec-paket', 'Paket Servis 1', 'EMPTY'),
('tbl-sec-paket-2', 'sec-paket', 'Paket Servis 2', 'EMPTY'),
('tbl-sec-paket-3', 'sec-paket', 'Paket Servis 3', 'EMPTY'),
('tbl-sec-paket-4', 'sec-paket', 'Paket Servis 4', 'EMPTY'),
('tbl-sec-paket-5', 'sec-paket', 'Paket Servis 5', 'EMPTY'),
('tbl-sec-paket-6', 'sec-paket', 'Paket Servis 6', 'EMPTY'),
('tbl-sec-paket-7', 'sec-paket', 'Paket Servis 7', 'EMPTY'),
('tbl-sec-paket-8', 'sec-paket', 'Paket Servis 8', 'EMPTY')
ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`);

-- Varsayılan Tanımlı Garson (Örnek Personel)
INSERT INTO `personeller` (`id`, `ad`, `rol`, `pozisyon`, `telefon`, `maas`, `pin`, `aktif`) VALUES
('emp-1', 'Ahmet Yılmaz', 'WAITER', 'Şef Garson', '0555 111 2233', 32000.00, '2580', 1),
('emp-2', 'Mehmet Kaya', 'WAITER', 'Garson', '0555 222 3344', 28000.00, '1905', 1),
('emp-3', 'Ali Demir', 'WAITER', 'Garson', '0555 333 4455', 28000.00, '1453', 1)
ON DUPLICATE KEY UPDATE `ad` = VALUES(`ad`), `pin` = VALUES(`pin`);

SET FOREIGN_KEY_CHECKS = 1;
