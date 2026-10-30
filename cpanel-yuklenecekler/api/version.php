<?php
/**
 * Sürüm bilgisi (KOD sahibi; güncelleme paketiyle birlikte değişir, config.local.php'ye YAZILMAZ).
 *
 * Uyumluluk kuralları (ayrıntı: docs/versioning.md)
 *  - GTU_API_VERSION    : bu sunucu kodunun sürümü.
 *  - GTU_MIN_KASA/GARSON: sunucunun desteklediği EN ESKİ istemci. Daha eskisi 426 ile reddedilir (sessiz veri kaybı olmasın).
 *  - Şema sürümü        : config.php içindeki runSchemaMigrations() son numarası.
 */
const GTU_API_VERSION = '1.1.0';
const GTU_MIN_KASA = '1.0.0';
const GTU_MIN_GARSON = '1.0.0';

function gtu_ver_cmp($a, $b) {
    $pa = array_map('intval', array_pad(explode('.', preg_replace('/[^0-9.]/', '', (string)$a)), 3, 0));
    $pb = array_map('intval', array_pad(explode('.', preg_replace('/[^0-9.]/', '', (string)$b)), 3, 0));
    for ($i = 0; $i < 3; $i++) { if ($pa[$i] !== $pb[$i]) return $pa[$i] < $pb[$i] ? -1 : 1; }
    return 0;
}
