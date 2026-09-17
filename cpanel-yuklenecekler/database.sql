-- ==========================================================
-- GAZİANTEPLİ TAHA USTA ERP - phpMyAdmin MySQL Veritabanı Şeması
-- Karakter Seti: utf8mb4 / utf8mb4_turkish_ci
-- GCallerID 2Hat, Dinamik Donanım, POS & Tam ERP Mimarisi
-- ==========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. SİSTEM AYARLARI
CREATE TABLE IF NOT EXISTS `ayarlar` (
  `anahtar` VARCHAR(64) NOT NULL,
  `deger` LONGTEXT NULL,
  `aciklama` VARCHAR(255) NULL,
  `guncelleme_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`anahtar`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 2. MÜŞTERİLER (Paket Servis & Cari)
CREATE TABLE IF NOT EXISTS `customers` (
  `id` VARCHAR(50) NOT NULL,
  `ad_soyad` VARCHAR(150) NOT NULL,
  `telefon` VARCHAR(30) NOT NULL,
  `adres` TEXT NULL,
  `adres_tarifi` TEXT NULL,
  `cari_bakiye` DECIMAL(10,2) DEFAULT 0.00,
  `notlar` TEXT NULL,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_customers_telefon` (`telefon`),
  INDEX `idx_customers_ad` (`ad_soyad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 3. GCALLERID ÇAĞRI GEÇMİŞİ (2 Hat Destekli)
CREATE TABLE IF NOT EXISTS `calls_history` (
  `id` VARCHAR(50) NOT NULL,
  `hat_no` INT NOT NULL DEFAULT 1,
  `telefon` VARCHAR(30) NOT NULL,
  `customer_id` VARCHAR(50) NULL,
  `durum` ENUM('CEVAPLANDI', 'SIPARISE_DONUSTU', 'KACAN_CAGRI') DEFAULT 'CEVAPLANDI',
  `zaman` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_calls_tel` (`telefon`),
  INDEX `idx_calls_cust` (`customer_id`),
  CONSTRAINT `fk_calls_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 4. DİNAMİK YAZICILAR (Network TCP & Windows Driver Spooler)
CREATE TABLE IF NOT EXISTS `printers` (
  `id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(100) NOT NULL,
  `baglanti_turu` ENUM('NETWORK_TCP', 'SYSTEM_DRIVER') DEFAULT 'NETWORK_TCP',
  `ip_adresi` VARCHAR(50) NULL,
  `port` INT DEFAULT 9100,
  `driver_adi` VARCHAR(150) NULL,
  `kagit_genisligi` INT DEFAULT 80,
  `yedek_printer_id` VARCHAR(50) NULL,
  `aktif` TINYINT(1) DEFAULT 1,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 5. YAZICI YÖNLENDİRME MATRİSİ (Routing Matrix)
CREATE TABLE IF NOT EXISTS `printer_routes` (
  `id` VARCHAR(50) NOT NULL,
  `printer_id` VARCHAR(50) NOT NULL,
  `hedef_tipi` ENUM('KATEGORI', 'URUN', 'HESAP', 'IPTAL', 'KURYE', 'Z_RAPORU') NOT NULL,
  `hedef_id` VARCHAR(50) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_route_printer` (`printer_id`),
  INDEX `idx_route_hedef` (`hedef_tipi`, `hedef_id`),
  CONSTRAINT `fk_routes_printer` FOREIGN KEY (`printer_id`) REFERENCES `printers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 6. RESTORAN BÖLÜMLERİ
CREATE TABLE IF NOT EXISTS `bolumler` (
  `id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(100) NOT NULL,
  `masa_sayisi` INT DEFAULT 12,
  `kapasite_kisi` INT DEFAULT 4,
  `sira` INT DEFAULT 0,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 7. KATEGORİLER
CREATE TABLE IF NOT EXISTS `categories` (
  `id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(100) NOT NULL,
  `renk` VARCHAR(30) DEFAULT '#ef4444',
  `yazici_id` VARCHAR(50) NULL,
  `sira` INT DEFAULT 0,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 8. ÜRÜNLER
CREATE TABLE IF NOT EXISTS `products` (
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
  INDEX `idx_prod_cat` (`kategori_id`),
  CONSTRAINT `fk_prod_cat` FOREIGN KEY (`kategori_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 9. ÜRÜN VARYANTLARI (Porsiyon, Dürüm, Kilo vb.)
CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` VARCHAR(50) NOT NULL,
  `product_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `price_delta` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `sira` INT DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_var_prod` (`product_id`),
  CONSTRAINT `fk_variant_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 10. ÜRÜN SEÇENEK VE EKSTRALARI (Pişme derecesi, Acı durumu, Sos, Ekstra malzeme)
CREATE TABLE IF NOT EXISTS `product_options` (
  `id` VARCHAR(50) NOT NULL,
  `product_id` VARCHAR(50) NOT NULL,
  `group_name` VARCHAR(100) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `price_delta` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  INDEX `idx_opt_prod` (`product_id`),
  CONSTRAINT `fk_option_prod` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 11. MASALAR
CREATE TABLE IF NOT EXISTS `tables` (
  `id` VARCHAR(50) NOT NULL,
  `bolum_id` VARCHAR(50) NOT NULL,
  `ad` VARCHAR(50) NOT NULL,
  `durum` VARCHAR(30) DEFAULT 'EMPTY',
  `aktif_siparis` LONGTEXT NULL,
  `toplam_tutar` DECIMAL(10,2) DEFAULT 0.00,
  `son_islem_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tbl_bolum` (`bolum_id`),
  INDEX `idx_tbl_durum` (`durum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 12. SİPARİŞLER / ADİSYONLAR
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(50) NOT NULL,
  `table_id` VARCHAR(50) NULL,
  `table_name` VARCHAR(100) NOT NULL,
  `waiter_id` VARCHAR(50) NULL,
  `waiter_name` VARCHAR(100) NULL,
  `customer_id` VARCHAR(50) NULL,
  `order_type` ENUM('DINE_IN', 'TAKEAWAY', 'DELIVERY') DEFAULT 'DINE_IN',
  `status` ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
  `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `remaining_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ord_tbl` (`table_id`),
  INDEX `idx_ord_status` (`status`),
  INDEX `idx_ord_cust` (`customer_id`),
  CONSTRAINT `fk_ord_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 13. SİPARİŞ KALEMLERİ (Akıllı Delta Yazdırma & İptal Takibi)
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` VARCHAR(50) NOT NULL,
  `order_id` VARCHAR(50) NOT NULL,
  `product_id` VARCHAR(50) NULL,
  `name` VARCHAR(150) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `quantity` INT NOT NULL DEFAULT 1,
  `notes` VARCHAR(255) NULL,
  `variant_name` VARCHAR(100) NULL,
  `options` LONGTEXT NULL,
  `printed_to_kitchen` TINYINT(1) DEFAULT 0,
  `printed_at` TIMESTAMP NULL,
  `is_cancelled` TINYINT(1) DEFAULT 0,
  `cancel_reason` VARCHAR(255) NULL,
  `cancel_authorized_by` VARCHAR(50) NULL,
  `is_complimentary` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_oi_order` (`order_id`),
  CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 14. TAHSİLATLAR & PARÇALI ÖDEMELER (Alman Usulü, Nakit, Kart, Veresiye)
CREATE TABLE IF NOT EXISTS `payments` (
  `id` VARCHAR(50) NOT NULL,
  `order_id` VARCHAR(50) NOT NULL,
  `payment_type` ENUM('CASH', 'CREDIT_CARD', 'MEAL_CARD', 'OPEN_ACCOUNT', 'OTHER') NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `processed_by` VARCHAR(100) NULL,
  `customer_id` VARCHAR(50) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pay_order` (`order_id`),
  CONSTRAINT `fk_pay_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 15. TEDARİKÇİLER / TOPTANCILAR
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` VARCHAR(50) NOT NULL,
  `unvan` VARCHAR(150) NOT NULL,
  `yetkili` VARCHAR(100) NULL,
  `telefon` VARCHAR(30) NULL,
  `adres` TEXT NULL,
  `kategori` VARCHAR(100) NULL,
  `bakiye` DECIMAL(10,2) DEFAULT 0.00,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 16. TEDARİKÇİ İŞLEMLERİ (Alış Faturaları, Ödemeler)
CREATE TABLE IF NOT EXISTS `supplier_transactions` (
  `id` VARCHAR(50) NOT NULL,
  `supplier_id` VARCHAR(50) NOT NULL,
  `tip` ENUM('ALIS_FATURASI', 'ODEME', 'IADE') NOT NULL,
  `tutar` DECIMAL(10,2) NOT NULL,
  `aciklama` VARCHAR(255) NULL,
  `tarih` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_st_supplier` (`supplier_id`),
  CONSTRAINT `fk_st_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 17. İŞLETME GİDERLERİ
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` VARCHAR(50) NOT NULL,
  `kategori` VARCHAR(100) NOT NULL,
  `tutar` DECIMAL(10,2) NOT NULL,
  `odeme_yontemi` VARCHAR(50) DEFAULT 'Nakit',
  `aciklama` VARCHAR(255) NULL,
  `tarih` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 18. PERSONELLER
CREATE TABLE IF NOT EXISTS `employees` (
  `id` VARCHAR(50) NOT NULL,
  `ad_soyad` VARCHAR(100) NOT NULL,
  `telefon` VARCHAR(30) NULL,
  `pin` VARCHAR(10) NOT NULL,
  `rol` VARCHAR(50) DEFAULT 'GARSON',
  `maas` DECIMAL(10,2) DEFAULT 0.00,
  `aktif` TINYINT(1) DEFAULT 1,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 19. GÜN SONU Z RAPORLARI
CREATE TABLE IF NOT EXISTS `z_reports` (
  `id` VARCHAR(50) NOT NULL,
  `rapor_no` INT NOT NULL,
  `acilis_tarihi` TIMESTAMP NOT NULL,
  `kapanis_tarihi` TIMESTAMP NOT NULL,
  `toplam_ciro` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `nakit_toplam` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `kredi_karti_toplam` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `veresiye_toplam` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `iptal_toplam` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `ikram_toplam` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `adisyon_adedi` INT NOT NULL DEFAULT 0,
  `detay_json` LONGTEXT NULL,
  `olusturan` VARCHAR(100) NULL,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 20. YETKİLİ DENETİM VE İŞLEM GÜNLÜĞÜ (Audit Logs)
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(50) NOT NULL,
  `islem_turu` VARCHAR(100) NOT NULL,
  `yetkili` VARCHAR(100) NULL,
  `detay` TEXT NULL,
  `ip_adresi` VARCHAR(50) NULL,
  `tarih` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 21. KULLANICILAR VE CİHAZ EŞLEŞTİRME (Users & Garson Cihaz Kilidi)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL,
  `ad_soyad` VARCHAR(100) NOT NULL,
  `username` VARCHAR(50) NULL,
  `email` VARCHAR(100) NULL,
  `telefon` VARCHAR(30) NULL,
  `pin_kodu` VARCHAR(20) NOT NULL,
  `device_uuid` VARCHAR(255) NULL DEFAULT NULL,
  `device_paired_at` DATETIME NULL DEFAULT NULL,
  `pairing_secret` VARCHAR(64) NULL DEFAULT NULL,
  `pairing_expires_at` DATETIME NULL DEFAULT NULL,
  `rol` VARCHAR(50) DEFAULT 'GARSON',
  `aktif` TINYINT(1) DEFAULT 1,
  `olusturma_tarihi` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_users_pin` (`pin_kodu`),
  INDEX `idx_users_device` (`device_uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Mevcut tablolar için migration gerekiyorsa, MySQL 5.7 uyumlu
-- cpanel-yuklenecekler/database_migration.sql dosyasını ayrıca çalıştırın.
  ADD INDEX IF NOT EXISTS `idx_assigned_courier` (`assigned_courier_id`);

-- 22. ONLİNE PLATFORM TANIMLARI VE ENTEGRASYON AYARLARI
CREATE TABLE IF NOT EXISTS `online_platforms` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `platform_code` ENUM('YEMEKSEPETI', 'TRENDYOL', 'GETIR') NOT NULL UNIQUE,
  `display_name` VARCHAR(50) NOT NULL,
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `store_status` ENUM('OPEN', 'BUSY', 'CLOSED') NOT NULL DEFAULT 'CLOSED',
  `delivery_model` ENUM('RESTAURANT_COURIER', 'PLATFORM_COURIER') NOT NULL DEFAULT 'RESTAURANT_COURIER',
  `credentials_json` TEXT NULL COMMENT 'API Key, Secret, Vendor ID bilgileri (AES/Base64)',
  `webhook_secret` VARCHAR(100) NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- 23. ONLİNE PLATFORM SİPARİŞLERİ
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
  `delivery_model` ENUM('RESTAURANT_COURIER', 'PLATFORM_COURIER') NOT NULL DEFAULT 'RESTAURANT_COURIER',
  `assigned_courier_id` VARCHAR(50) NULL DEFAULT NULL,
  `platform_courier_name` VARCHAR(100) NULL DEFAULT NULL,
  `platform_courier_phone` VARCHAR(30) NULL DEFAULT NULL,
  `handover_code` VARCHAR(20) NULL DEFAULT NULL,
  `platform_status` VARCHAR(50) NOT NULL COMMENT 'Platformun kendi status stringi',
  `local_status` ENUM('BEKLIYOR', 'HAZIRLANIYOR', 'YOLA_CIKTI', 'TESLIM_EDILDI', 'IPTAL') NOT NULL DEFAULT 'BEKLIYOR',
  `cancel_reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_platform_order` (`platform_code`, `platform_order_id`),
  INDEX `idx_assigned_courier` (`assigned_courier_id`),
  INDEX `idx_online_status` (`local_status`),
  INDEX `idx_online_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Başlangıç Tohum Verileri
INSERT INTO `online_platforms` (`platform_code`, `display_name`, `is_enabled`, `store_status`, `delivery_model`) VALUES
('YEMEKSEPETI', 'Yemeksepeti', 0, 'CLOSED', 'RESTAURANT_COURIER'),
('TRENDYOL', 'Trendyol Yemek', 0, 'CLOSED', 'RESTAURANT_COURIER'),
('GETIR', 'GetirYemek', 0, 'CLOSED', 'RESTAURANT_COURIER')
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`);

SET FOREIGN_KEY_CHECKS = 1;
