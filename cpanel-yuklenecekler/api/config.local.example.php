<?php
/**
 * VERİTABANI BİLGİLERİ ŞABLONU
 * ----------------------------
 * 1. Bu dosyanın bir kopyasını aynı klasöre "config.local.php" adıyla oluşturun.
 * 2. Aşağıdaki değerleri cPanel > MySQL Veritabanları bölümündeki bilgilerle doldurun.
 * 3. "config.local.php" git deposuna GİRMEZ; şifreniz sadece sunucunuzda kalır.
 *
 * Alternatif: Sunucunuzda ortam değişkeni tanımlayabiliyorsanız bu dosya yerine
 * TAHA_DB_HOST / TAHA_DB_PORT / TAHA_DB_NAME / TAHA_DB_USER / TAHA_DB_PASS
 * değişkenlerini kullanabilirsiniz; ortam değişkenleri bu dosyadan önceliklidir.
 */

return [
    'host' => 'localhost',
    'port' => '3306',
    'name' => '',  // cPanel veritabanı adı
    'user' => '',  // cPanel veritabanı kullanıcısı
    'pass' => '',  // veritabanı şifresi
];
