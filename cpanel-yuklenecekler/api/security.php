<?php
/**
 * Merkezi yetki kapısı (varsayılan: REDDET).
 *
 * Politikalar:
 *   public        : herkese açık (kısıtlı çıktı, hız sınırlı)
 *   device        : eşleşmiş garson cihazı (X-Device-Token) + PIN ile açılmış oturum (X-Session)
 *   device_or_kasa: yukarıdakilerden biri VEYA kasa anahtarı
 *   kasa          : yalnızca kasa (X-Kasa-Key)
 *   boss          : imzalı patron oturumu (Authorization: Bearer ...)
 *   webhook       : platform imzası ayrıca doğrulanır
 *
 * Gizli değerler config.local.php / ortam değişkenlerinden gelir; boşsa ilgili yol KAPALI kalır.
 */

const SEC_POLICIES = [
    'health' => 'public',
    'qr_menu' => 'public',
    'qr_table_state' => 'public',
    'qr_send' => 'public',
    'get_table_qr_tokens' => 'kasa',
    'get_active_waiters' => 'device_or_kasa',
    'pair_with_code' => 'public',
    'pair_device' => 'public',
    'verify_waiter_pin' => 'device',
    'boss_login' => 'public',
    'platform_webhook' => 'webhook',
    'get_live_state' => 'device_or_kasa',
    'send_order' => 'device_or_kasa',
    'check_device_status' => 'device_or_kasa',
    'get_boss_z_reports' => 'boss',
    'get_customers_overview' => 'boss',
    'get_employees_overview' => 'boss',
    'get_boss_summary' => 'boss',
    'change_boss_password' => 'boss',
];

function sec_json_exit($code, $payload) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function sec_header($name) {
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return isset($_SERVER[$key]) ? trim((string)$_SERVER[$key]) : '';
}

function sec_b64url($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function sec_b64url_dec($s) { return base64_decode(strtr($s, '-_', '+/')); }

function sec_secret() {
    return defined('APP_SECRET') ? APP_SECRET : '';
}

/** İmzalı, süreli token üretir. $claims: dizi. */
function sec_sign(array $claims, $ttlSeconds) {
    $secret = sec_secret();
    if (strlen($secret) < 32) return null;
    $claims['exp'] = time() + (int)$ttlSeconds;
    $body = sec_b64url(json_encode($claims, JSON_UNESCAPED_UNICODE));
    return $body . '.' . sec_b64url(hash_hmac('sha256', $body, $secret, true));
}

function sec_verify($token) {
    $secret = sec_secret();
    if (strlen($secret) < 32 || !is_string($token) || substr_count($token, '.') !== 1) return null;
    list($body, $sig) = explode('.', $token, 2);
    $expected = sec_b64url(hash_hmac('sha256', $body, $secret, true));
    if (!hash_equals($expected, $sig)) return null;
    $claims = json_decode(sec_b64url_dec($body), true);
    if (!is_array($claims) || ($claims['exp'] ?? 0) < time()) return null;
    return $claims;
}

function sec_is_kasa() {
    $key = defined('KASA_API_KEY') ? KASA_API_KEY : '';
    if (strlen($key) < 24) return false; // yapılandırılmamışsa kasa yolu kapalı
    $sent = sec_header('X-Kasa-Key');
    return $sent !== '' && hash_equals($key, $sent);
}

function sec_is_boss() {
    $auth = sec_header('Authorization');
    if (stripos($auth, 'Bearer ') !== 0) return false;
    $c = sec_verify(trim(substr($auth, 7)));
    return is_array($c) && ($c['role'] ?? '') === 'boss';
}

/** Eşleşmiş cihaz + PIN oturumu. Başarılıysa ['waiterId'=>..,'waiterName'=>..] döner. */
function sec_device_identity($pdo, $requireSession = true) {
    if (!$pdo) return null;
    $deviceToken = sec_header('X-Device-Token');
    if ($deviceToken === '') return null;
    $hash = hash('sha256', $deviceToken);
    try {
        $st = $pdo->prepare("SELECT c.`waiter_id`, c.`waiter_name` FROM `cihazlar` c
            LEFT JOIN `personeller` p ON p.`id` = c.`waiter_id`
            WHERE c.`device_token_hash` = ? AND c.`durum` = 'APPROVED' AND (p.`aktif` = 1 OR p.`id` IS NULL) LIMIT 1");
        $st->execute([$hash]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
    } catch (Throwable $e) { return null; }
    if (!$row) return null;
    if ($requireSession) {
        $c = sec_verify(sec_header('X-Session'));
        if (!is_array($c) || ($c['role'] ?? '') !== 'waiter' || ($c['wid'] ?? '') !== $row['waiter_id'] || ($c['dev'] ?? '') !== $hash) return null;
    }
    return ['waiterId' => $row['waiter_id'], 'waiterName' => $row['waiter_name'], 'deviceHash' => $hash];
}

/** Basit hız sınırı (MySQL). true: izin var. */
function sec_rate_limit($pdo, $bucket, $max, $windowSec) {
    if (!$pdo) return true;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `rate_limits` (`k` VARCHAR(190) NOT NULL, `hits` INT NOT NULL DEFAULT 0, `window_start` INT NOT NULL, PRIMARY KEY (`k`)) ENGINE=InnoDB");
        $now = time();
        $key = substr($bucket, 0, 190);
        $pdo->beginTransaction();
        $st = $pdo->prepare("SELECT `hits`, `window_start` FROM `rate_limits` WHERE `k` = ? FOR UPDATE");
        $st->execute([$key]);
        $r = $st->fetch(PDO::FETCH_ASSOC);
        if (!$r || ($now - (int)$r['window_start']) > $windowSec) {
            $pdo->prepare("REPLACE INTO `rate_limits` (`k`, `hits`, `window_start`) VALUES (?, 1, ?)")->execute([$key, $now]);
            $pdo->commit();
            return true;
        }
        if ((int)$r['hits'] >= $max) { $pdo->commit(); return false; }
        $pdo->prepare("UPDATE `rate_limits` SET `hits` = `hits` + 1 WHERE `k` = ?")->execute([$key]);
        $pdo->commit();
        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        return true; // sınırlayıcı arızası hizmeti durdurmasın
    }
}

function sec_client_ip() { return $_SERVER['REMOTE_ADDR'] ?? 'unknown'; }

/**
 * Eylem için yetkiyi zorunlu kılar. Bilinmeyen eylem = 'kasa' (kapalı kapı).
 * Dönüş: ['who' => 'kasa'|'boss'|'device'|'public', 'identity' => ?array]
 */
function sec_enforce($action, $pdo) {
    $policy = SEC_POLICIES[$action] ?? 'kasa';
    $ctx = ['who' => 'public', 'identity' => null];

    if ($policy === 'public' || $policy === 'webhook') return $ctx;

    if (in_array($policy, ['kasa', 'device_or_kasa'], true) && sec_is_kasa()) {
        return ['who' => 'kasa', 'identity' => null];
    }
    if ($policy === 'boss' && sec_is_boss()) {
        return ['who' => 'boss', 'identity' => null];
    }
    if (in_array($policy, ['device', 'device_or_kasa'], true)) {
        $id = sec_device_identity($pdo, !in_array($action, ['verify_waiter_pin', 'check_device_status', 'get_active_waiters'], true));
        if ($id) return ['who' => 'device', 'identity' => $id];
    }
    sec_json_exit(401, ['success' => false, 'error' => 'Yetkisiz istek.', 'code' => 'UNAUTHORIZED']);
}

/** Masa QR belirteci: masa kimliğine bağlı HMAC. Kasa üretir/basar; müşteri QR ile taşır. */
function sec_table_qr_token($tableId) {
    $secret = sec_secret();
    if (strlen($secret) < 32) return '';
    return substr(hash_hmac('sha256', 'qr|' . $tableId, $secret), 0, 20);
}

function sec_table_qr_valid($tableId, $token) {
    $expected = sec_table_qr_token((string)$tableId);
    return $expected !== '' && is_string($token) && $token !== '' && hash_equals($expected, $token);
}
