-- Mevcut bir veritabanini guncellemek icin MySQL 5.7+ uyumlu migration.
-- Bu dosya tekrar calistirilabilir; mevcut kolonlari atlar.

DROP PROCEDURE IF EXISTS `gtu_add_column_if_missing`;
DELIMITER $$
CREATE PROCEDURE `gtu_add_column_if_missing`(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(255),
  IN p_after VARCHAR(64)
)
BEGIN
  DECLARE table_count INT DEFAULT 0;
  DECLARE column_count INT DEFAULT 0;

  SELECT COUNT(*) INTO table_count
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table;

  SELECT COUNT(*) INTO column_count
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = p_table
    AND COLUMN_NAME = p_column;

  IF table_count > 0 AND column_count = 0 THEN
    SET @gtu_sql = CONCAT(
      'ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition,
      IF(p_after IS NULL OR p_after = '', '', CONCAT(' AFTER `', p_after, '`'))
    );
    PREPARE gtu_stmt FROM @gtu_sql;
    EXECUTE gtu_stmt;
    DEALLOCATE PREPARE gtu_stmt;
  END IF;
END$$
DELIMITER ;

CALL `gtu_add_column_if_missing`('users', 'device_uuid', 'VARCHAR(255) NULL DEFAULT NULL', 'pin_kodu');
CALL `gtu_add_column_if_missing`('users', 'device_paired_at', 'DATETIME NULL DEFAULT NULL', 'device_uuid');
CALL `gtu_add_column_if_missing`('users', 'pairing_secret', 'VARCHAR(64) NULL DEFAULT NULL', 'device_paired_at');
CALL `gtu_add_column_if_missing`('users', 'pairing_expires_at', 'DATETIME NULL DEFAULT NULL', 'pairing_secret');

CALL `gtu_add_column_if_missing`('employees', 'device_uuid', 'VARCHAR(255) NULL DEFAULT NULL', 'pin');
CALL `gtu_add_column_if_missing`('employees', 'device_paired_at', 'DATETIME NULL DEFAULT NULL', 'device_uuid');
CALL `gtu_add_column_if_missing`('employees', 'pairing_secret', 'VARCHAR(64) NULL DEFAULT NULL', 'device_paired_at');
CALL `gtu_add_column_if_missing`('employees', 'pairing_expires_at', 'DATETIME NULL DEFAULT NULL', 'pairing_secret');

CALL `gtu_add_column_if_missing`('personeller', 'pairing_secret', 'VARCHAR(64) NULL DEFAULT NULL', 'qr_token');
CALL `gtu_add_column_if_missing`('personeller', 'pairing_expires_at', 'DATETIME NULL DEFAULT NULL', 'pairing_secret');

CALL `gtu_add_column_if_missing`('online_platforms', 'delivery_model', "ENUM('RESTAURANT_COURIER', 'PLATFORM_COURIER') NOT NULL DEFAULT 'RESTAURANT_COURIER'", 'store_status');
CALL `gtu_add_column_if_missing`('online_orders', 'delivery_model', "ENUM('RESTAURANT_COURIER', 'PLATFORM_COURIER') NOT NULL DEFAULT 'RESTAURANT_COURIER'", 'payment_method');
CALL `gtu_add_column_if_missing`('online_orders', 'assigned_courier_id', 'VARCHAR(50) NULL DEFAULT NULL', 'delivery_model');
CALL `gtu_add_column_if_missing`('online_orders', 'platform_courier_name', 'VARCHAR(100) NULL DEFAULT NULL', 'assigned_courier_id');
CALL `gtu_add_column_if_missing`('online_orders', 'platform_courier_phone', 'VARCHAR(30) NULL DEFAULT NULL', 'platform_courier_name');
CALL `gtu_add_column_if_missing`('online_orders', 'handover_code', 'VARCHAR(20) NULL DEFAULT NULL', 'platform_courier_phone');

DROP PROCEDURE IF EXISTS `gtu_add_column_if_missing`;
