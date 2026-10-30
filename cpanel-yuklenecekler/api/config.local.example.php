<?php
/**
 * Yerel yapılandırma ŞABLONU.
 * Bu dosyayı sunucuda "config.local.php" adıyla kopyalayıp gerçek değerleri doldurun.
 * config.local.php Git'e EKLENMEZ (.gitignore). Gerçek parolayı bu şablona yazmayın.
 * Alternatif: aynı değerleri sunucu ortam değişkeni olarak verin (TAHA_DB_HOST, TAHA_DB_NAME, TAHA_DB_USER, TAHA_DB_PASS, TAHA_BOSS_PASSWORD).
 */
return [
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_NAME' => '',
    'DB_USER' => '',
    'DB_PASS' => '',
    'BOSS_PASSWORD' => '',
    'GARSON_URL' => '',     // ör. https://garson.ornek.com (alt alan adı kullanıyorsanız ZORUNLU)
    // Rastgele üretin: php -r "echo bin2hex(random_bytes(32));"
    'APP_SECRET' => '',     // >= 32 karakter, oturum imzalama
    'KASA_API_KEY' => '',   // >= 24 karakter, kasa uygulamasına da aynı değer girilir
];
