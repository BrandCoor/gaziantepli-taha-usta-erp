<?php
/**
 * GAZİANTEPLİ TAHA USTA ERP - Cihaz Eşleştirme & Garson Kimlik Doğrulama API'si
 * -------------------------------------------------------------------------------
 * QR Tabanlı Garson Cihaz Kilitleme (Device Binding), Eşleştirme ve Sert Güvenlik Denetimi
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Device-UUID, X-Device-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';

$pdo = getDbConnection();
$useMysql = false;

if ($pdo) {
    ensureDatabaseTables($pdo);
    $useMysql = true;

    // Garson cihaz eşleme kolonlarının varlığını otomatik doğrula ve ekle
    $migrationQueries = [
        // Eski MySQL sürümleri ADD COLUMN IF NOT EXISTS desteklemez.
        // Her kolon ayrı çalıştırılır; mevcut kolon hatası aşağıdaki catch ile atlanır.
        "ALTER TABLE `users` ADD COLUMN `device_uuid` VARCHAR(255) NULL DEFAULT NULL AFTER `pin_kodu`",
        "ALTER TABLE `users` ADD COLUMN `device_paired_at` DATETIME NULL DEFAULT NULL AFTER `device_uuid`",
        "ALTER TABLE `users` ADD COLUMN `pairing_secret` VARCHAR(64) NULL DEFAULT NULL AFTER `device_paired_at`",
        "ALTER TABLE `users` ADD COLUMN `pairing_expires_at` DATETIME NULL DEFAULT NULL AFTER `pairing_secret`",
        "ALTER TABLE `personeller` ADD COLUMN `device_uuid` VARCHAR(255) NULL DEFAULT NULL AFTER `pin`",
        "ALTER TABLE `personeller` ADD COLUMN `device_paired_at` DATETIME NULL DEFAULT NULL AFTER `device_uuid`",
        "ALTER TABLE `personeller` ADD COLUMN `pairing_secret` VARCHAR(64) NULL DEFAULT NULL AFTER `device_paired_at`",
        "ALTER TABLE `personeller` ADD COLUMN `pairing_expires_at` DATETIME NULL DEFAULT NULL AFTER `pairing_secret`",
        // Kalıcı cihaz anahtarı: telefon bir kez eşleştikten sonra bir daha QR istemez.
        // Anahtarın kendisi saklanmaz, yalnızca SHA-256 özeti tutulur.
        "ALTER TABLE `users` ADD COLUMN `device_token_hash` VARCHAR(64) NULL DEFAULT NULL AFTER `pairing_expires_at`",
        "ALTER TABLE `personeller` ADD COLUMN `device_token_hash` VARCHAR(64) NULL DEFAULT NULL AFTER `pairing_expires_at`",
        "ALTER TABLE `cihazlar` ADD COLUMN `device_token_hash` VARCHAR(64) NULL DEFAULT NULL",
        "ALTER TABLE `cihazlar` ADD COLUMN `son_gorulme` DATETIME NULL DEFAULT NULL",
        // 6 haneli eşleştirme kodu da tek kullanımlık ve süreli olmalı; ham hali değil
        // yalnızca SHA-256 özeti saklanır.
        "ALTER TABLE `users` ADD COLUMN `pairing_code_hash` VARCHAR(64) NULL DEFAULT NULL",
        "ALTER TABLE `personeller` ADD COLUMN `pairing_code_hash` VARCHAR(64) NULL DEFAULT NULL",
        // PIN deneme sınırlaması (kaba kuvvet denemelerine karşı)
        "ALTER TABLE `personeller` ADD COLUMN `pin_denemesi` INT NOT NULL DEFAULT 0",
        "ALTER TABLE `personeller` ADD COLUMN `pin_kilit_bitis` DATETIME NULL DEFAULT NULL"
    ];

    foreach ($migrationQueries as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Exception $e) {
            // MySQL sürüm uyumluluğu için sessiz geç
        }
    }
}

// Fallback JSON Dosyası
$dbFile = __DIR__ . '/restaurant_sync.json';
function loadJsonData($file) {
    if (!file_exists($file)) {
        return ['employees' => [], 'paired_devices' => [], 'users' => []];
    }
    $c = file_get_contents($file);
    return json_decode($c, true) ?: ['employees' => [], 'paired_devices' => [], 'users' => []];
}
function saveJsonData($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Girdi Verilerini Topla (JSON POST veya GET)
$rawInput = file_get_contents('php://input');
$inputData = json_decode($rawInput, true) ?: [];
$action = $_GET['action'] ?? $inputData['action'] ?? '';

// Başlıkta veya gövdede gönderilen device_uuid kontrolü
$deviceUuidHeader = $_SERVER['HTTP_X_DEVICE_UUID'] ?? '';
$deviceUuid = trim($inputData['device_uuid'] ?? $_GET['device_uuid'] ?? $deviceUuidHeader);

// Kalıcı cihaz anahtarı (telefon bir kez eşleştikten sonra her istekte gönderir)
$deviceTokenHeader = $_SERVER['HTTP_X_DEVICE_TOKEN'] ?? '';
$deviceToken = trim($inputData['device_token'] ?? $_GET['device_token'] ?? $deviceTokenHeader);

/**
 * Telefonun MAC adresi tarayıcıdan OKUNAMAZ (hiçbir tarayıcı bu bilgiyi vermez) ve
 * modern telefonlar her ağda farklı rastgele MAC kullanır. Bu yüzden cihaz kimliği
 * için sunucunun ürettiği, iptal edilebilir kalıcı bir anahtar kullanılır.
 * Anahtarın kendisi veritabanında saklanmaz; yalnızca SHA-256 özeti tutulur.
 */
function issueDeviceToken() {
    try {
        return bin2hex(random_bytes(32));
    } catch (Exception $e) {
        return hash('sha256', uniqid('gtu', true) . microtime(true) . mt_rand());
    }
}

function hashDeviceToken($token) {
    return hash('sha256', (string)$token);
}

switch ($action) {
    // ========================================================
    // 1. QR EŞLEŞTİRME BELİRTECİ ÜRET (KASA TARAFINDAN ÇAĞRILIR)
    // ========================================================
    case 'create_pairing_token':
    case 'generate_pairing_token':
        $userId = trim($inputData['userId'] ?? $inputData['personelId'] ?? $_GET['userId'] ?? '');
        if (!$userId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Geçerli bir personel ID belirtilmedi.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $actorId = trim($inputData['actorId'] ?? '');
        $actorPin = trim($inputData['actorPin'] ?? '');
        if (!$actorId || !$actorPin) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Eşleştirme başlatmak için yetkili kullanıcı doğrulaması gerekir.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $token = bin2hex(random_bytes(32)); // Ham değer yalnızca QR yanıtında tutulur.
        $tokenHash = hash('sha256', $token);
        $expiresAt = date('Y-m-d H:i:s', time() + (5 * 60)); // 5 Dakika geçerlilik süresi

        if ($useMysql) {
            $actorStmt = $pdo->prepare("SELECT id, rol FROM `users` WHERE id = ? AND pin_kodu = ? AND aktif = 1 UNION SELECT id, rol FROM `personeller` WHERE id = ? AND pin = ? AND aktif = 1 LIMIT 1");
            $actorStmt->execute([$actorId, $actorPin, $actorId, $actorPin]);
            $actor = $actorStmt->fetch(PDO::FETCH_ASSOC);
            $actorRole = strtoupper($actor['rol'] ?? '');
            if (!$actor || (!in_array($actorRole, ['ADMIN', 'MANAGER', 'CASHIER', 'KASİYER', 'YÖNETİCİ'], true) && $actorId !== $userId)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Bu kullanıcı cihaz eşleştirmesi başlatma yetkisine sahip değil.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $userStmt = $pdo->prepare("SELECT id, ad_soyad, rol FROM `users` WHERE `id` = ? AND aktif = 1 UNION SELECT id, ad as ad_soyad, rol FROM `personeller` WHERE `id` = ? AND aktif = 1 LIMIT 1");
            $userStmt->execute([$userId, $userId]);
            $userData = $userStmt->fetch(PDO::FETCH_ASSOC);
            if (!$userData || !in_array(strtoupper($userData['rol'] ?? 'WAITER'), ['WAITER', 'GARSON'], true)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Bu hesap için cihaz eşleştirmesi başlatılamaz.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // 6 haneli kod da aynı süreyle ve tek kullanımlık olarak saklanır.
            $pairingCodeRaw = preg_replace('/\D/', '', (string)($inputData['pairingCode'] ?? ''));
            $pairingCodeHash = $pairingCodeRaw !== '' ? hash('sha256', $pairingCodeRaw) : null;

            $pdo->beginTransaction();
            try {
                $stmt1 = $pdo->prepare("UPDATE `users` SET `pairing_secret` = ?, `pairing_code_hash` = ?, `pairing_expires_at` = ? WHERE `id` = ? AND `aktif` = 1");
                $stmt1->execute([$tokenHash, $pairingCodeHash, $expiresAt, $userId]);
                $stmt2 = $pdo->prepare("UPDATE `personeller` SET `pairing_secret` = ?, `pairing_code_hash` = ?, `pairing_expires_at` = ? WHERE `id` = ? AND `aktif` = 1");
                $stmt2->execute([$tokenHash, $pairingCodeHash, $expiresAt, $userId]);
                $pdo->commit();
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            $userName = $userData['ad_soyad'] ?? 'Garson';
        } else {
            $json = loadJsonData($dbFile);
            if (!isset($json['pairing_tokens'])) $json['pairing_tokens'] = [];
            $json['pairing_tokens'][$userId] = [
                'token' => $tokenHash,
                'expires_at' => time() + (5 * 60)
            ];
            saveJsonData($dbFile, $json);
            $userName = 'Garson';
        }

        // PWA ve tarayıcı yönlendirme URL'si (Otomatik mevcut host algılama ile)
        $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')) ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
        $rootDir = preg_replace('/\/api$/i', '', $scriptDir);
        $baseUrl = rtrim($scheme . '://' . $host . $rootDir, '/');
        $pairingUrl = "{$baseUrl}/garson/?token={$token}&userId=" . urlencode($userId);

        echo json_encode([
            'success' => true,
            'token' => $token,
            'userId' => $userId,
            'userName' => $userName,
            'expiresAt' => $expiresAt,
            'qrUrl' => $pairingUrl,
            'appUrl' => $pairingUrl,
            'message' => '5 dakika geçerli eşleştirme QR kodu oluşturuldu.'
        ], JSON_UNESCAPED_UNICODE);
        exit;

    // ========================================================
    // ========================================================
    // 2. MOBİL TELEFON CİHAZINI EŞLEŞTİR (GARSON PWA TARAFINDAN ÇAĞRILIR)
    // ========================================================
    case 'pair_with_code':
    case 'pair_device':
        // ====================================================================
        // GÜVENLİK: Eşleştirme YALNIZCA kasada yetkili biri tarafından üretilmiş,
        // süresi dolmamış ve TEK KULLANIMLIK bir belirteçle yapılır.
        //
        // Önceki kodda üç ciddi açık vardı ve üçü de herhangi birinin kendi
        // telefonunu garson olarak tanıtmasına izin veriyordu:
        //   1) Girilen kod hiçbir kayıtla eşleşmezse "ilk aktif garson" seçiliyordu.
        //   2) Yine bulunamazsa girilen kod PIN kabul edilip YENİ garson yaratılıyordu.
        //   3) userId gönderildiğinde QR belirteci hiç doğrulanmıyordu.
        // Ayrıca garsonun 4 haneli PIN'i eşleştirme kodu olarak da kabul ediliyordu.
        // ====================================================================
        $rawCode = preg_replace('/\D/', '', (string)($inputData['code'] ?? $inputData['pairingCode'] ?? $_GET['code'] ?? ''));
        $userId = trim($inputData['userId'] ?? $inputData['waiterId'] ?? $_GET['userId'] ?? '');
        $token = trim($inputData['token'] ?? $_GET['token'] ?? '');
        $targetDeviceUuid = trim($inputData['device_uuid'] ?? $deviceUuid);
        $deviceLabel = trim((string)($inputData['deviceName'] ?? '')) ?: 'Mobil Telefon';

        if ($targetDeviceUuid === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Cihaz kimliği alınamadı.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        if ($token === '' && $rawCode === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Eşleştirme kodu veya QR belirteci gerekli.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $now = date('Y-m-d H:i:s');
        $targetUser = null;

        if ($useMysql) {
            if ($token !== '') {
                $tokenHash = hash('sha256', $token);
                if ($userId !== '') {
                    $stmt = $pdo->prepare("
                        SELECT id, ad_soyad AS ad, rol, pairing_secret AS secret, pairing_expires_at AS expires_at FROM `users` WHERE id = ? AND aktif = 1
                        UNION
                        SELECT id, ad AS ad, rol, pairing_secret AS secret, pairing_expires_at AS expires_at FROM `personeller` WHERE id = ? AND aktif = 1
                        LIMIT 1
                    ");
                    $stmt->execute([$userId, $userId]);
                } else {
                    $stmt = $pdo->prepare("
                        SELECT id, ad_soyad AS ad, rol, pairing_secret AS secret, pairing_expires_at AS expires_at FROM `users` WHERE pairing_secret = ? AND aktif = 1
                        UNION
                        SELECT id, ad AS ad, rol, pairing_secret AS secret, pairing_expires_at AS expires_at FROM `personeller` WHERE pairing_secret = ? AND aktif = 1
                        LIMIT 1
                    ");
                    $stmt->execute([$tokenHash, $tokenHash]);
                }
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row && !empty($row['secret']) && hash_equals((string)$row['secret'], $tokenHash)) {
                    $targetUser = $row;
                }
            } else {
                // 6 haneli kod: yalnızca kasada üretilip hash'i saklanan koda karşı doğrulanır.
                $codeHash = hash('sha256', $rawCode);
                $stmt = $pdo->prepare("
                    SELECT id, ad_soyad AS ad, rol, pairing_code_hash AS secret, pairing_expires_at AS expires_at FROM `users` WHERE pairing_code_hash = ? AND aktif = 1
                    UNION
                    SELECT id, ad AS ad, rol, pairing_code_hash AS secret, pairing_expires_at AS expires_at FROM `personeller` WHERE pairing_code_hash = ? AND aktif = 1
                    LIMIT 1
                ");
                $stmt->execute([$codeHash, $codeHash]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row && !empty($row['secret']) && hash_equals((string)$row['secret'], $codeHash)) {
                    $targetUser = $row;
                }
            }

            if (!$targetUser) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Eşleştirme kodu geçersiz. Kasadan yeni bir kod veya QR alın.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            if (empty($targetUser['expires_at']) || strtotime((string)$targetUser['expires_at']) < time()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Eşleştirme kodunun süresi doldu. Kasadan yeni kod alın.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            if (!in_array(strtoupper((string)($targetUser['rol'] ?? 'WAITER')), ['WAITER', 'GARSON'], true)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Bu hesap garson terminali için yetkili değil.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // Belirteç tek kullanımlıktır: başarıyla kullanıldığı anda düşürülür.
            $newDeviceToken = issueDeviceToken();
            $newDeviceTokenHash = hashDeviceToken($newDeviceToken);
            foreach (['users', 'personeller'] as $tbl) {
                try {
                    $upd = $pdo->prepare("UPDATE `{$tbl}` SET `device_uuid` = ?, `device_paired_at` = ?, `device_token_hash` = ?, `pairing_secret` = NULL, `pairing_code_hash` = NULL, `pairing_expires_at` = NULL WHERE `id` = ?");
                    $upd->execute([$targetDeviceUuid, $now, $newDeviceTokenHash, $targetUser['id']]);
                } catch (Exception $e) {}
            }

            try {
                $updCihaz = $pdo->prepare("
                    INSERT INTO `cihazlar` (`waiter_id`, `waiter_name`, `device_uuid`, `device_token_hash`, `durum`, `eslesme_tarihi`, `son_gorulme`)
                    VALUES (?, ?, ?, ?, 'APPROVED', NOW(), NOW())
                    ON DUPLICATE KEY UPDATE `device_uuid` = VALUES(`device_uuid`), `device_token_hash` = VALUES(`device_token_hash`), `durum` = 'APPROVED', `eslesme_tarihi` = NOW(), `son_gorulme` = NOW()
                ");
                $updCihaz->execute([$targetUser['id'], $targetUser['ad'] ?? 'Garson', $targetDeviceUuid, $newDeviceTokenHash]);
            } catch (Exception $ignore) {}

            // PIN yanıtta DÖNDÜRÜLMEZ.
            echo json_encode([
                'success' => true,
                'message' => 'Cihazınız eşleştirildi',
                'user' => [
                    'id' => $targetUser['id'],
                    'ad' => $targetUser['ad'] ?? 'Garson',
                    'name' => $targetUser['ad'] ?? 'Garson',
                    'rol' => $targetUser['rol'] ?? 'WAITER',
                    'device_paired' => true
                ],
                'waiterId' => $targetUser['id'],
                'device_uuid' => $targetDeviceUuid,
                'device_token' => $newDeviceToken,
                'deviceName' => $deviceLabel,
                'paired_at' => $now
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } else {
            // JSON dosya modunda da aynı kurallar geçerlidir: geçerli ve süresi
            // dolmamış bir belirteç olmadan eşleştirme yapılmaz.
            $json = loadJsonData($dbFile);
            $tokens = $json['pairing_tokens'] ?? [];
            $candidate = $token !== '' ? hash('sha256', $token) : hash('sha256', $rawCode);

            $matchedId = null;
            foreach ($tokens as $wid => $info) {
                $storedToken = (string)($info['token'] ?? '');
                $storedCode = (string)($info['code_hash'] ?? '');
                $expires = (int)($info['expires_at'] ?? 0);
                if ($expires < time()) continue;
                if (($storedToken !== '' && hash_equals($storedToken, $candidate)) ||
                    ($storedCode !== '' && hash_equals($storedCode, $candidate))) {
                    if ($userId !== '' && $token !== '' && (string)$wid !== $userId) continue;
                    $matchedId = (string)$wid;
                    break;
                }
            }

            if ($matchedId === null) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Eşleştirme kodu geçersiz veya süresi dolmuş. Kasadan yeni kod alın.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $waiterName = 'Garson';
            foreach (($json['employees'] ?? []) as $e) {
                if ((string)($e['id'] ?? '') === $matchedId) {
                    $waiterName = $e['name'] ?? $e['ad'] ?? 'Garson';
                    break;
                }
            }

            $newDeviceToken = issueDeviceToken();
            unset($json['pairing_tokens'][$matchedId]); // tek kullanımlık
            if (!isset($json['paired_devices'])) $json['paired_devices'] = [];
            $json['paired_devices'][$matchedId] = [
                'device_uuid' => $targetDeviceUuid,
                'device_token_hash' => hashDeviceToken($newDeviceToken),
                'waiterName' => $waiterName,
                'paired_at' => $now
            ];
            saveJsonData($dbFile, $json);

            echo json_encode([
                'success' => true,
                'message' => 'Cihazınız eşleştirildi',
                'user' => [
                    'id' => $matchedId,
                    'ad' => $waiterName,
                    'name' => $waiterName,
                    'rol' => 'WAITER',
                    'device_paired' => true
                ],
                'waiterId' => $matchedId,
                'device_uuid' => $targetDeviceUuid,
                'device_token' => $newDeviceToken,
                'deviceName' => $deviceLabel,
                'paired_at' => $now
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }


    // ========================================================
    // 3. CİHAZ EŞLEŞMESİNİ SIFIRLA (KASA YÖNETİCİSİ TARAFINDAN ÇAĞRILIR)
    // ========================================================
    case 'reset_device_pairing':
        $userId = trim($inputData['userId'] ?? $_GET['userId'] ?? '');
        if (!$userId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Personel ID belirtilmedi.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($useMysql) {
            $stmt1 = $pdo->prepare("UPDATE `users` SET `device_uuid` = NULL, `device_paired_at` = NULL, `pairing_secret` = NULL WHERE `id` = ?");
            $stmt1->execute([$userId]);

            $stmt2 = $pdo->prepare("UPDATE `personeller` SET `device_uuid` = NULL, `device_paired_at` = NULL, `pairing_secret` = NULL WHERE `id` = ?");
            $stmt2->execute([$userId]);

            try {
                $logStmt = $pdo->prepare("
                    INSERT INTO `audit_logs` (id, islem_turu, yetkili, detay, ip_adresi)
                    VALUES (?, 'CIHAZ_ESLEME_SIFIRLANDI', ?, 'Personel telefon eşleştirmesi sıfırlandı. Yeni QR ile eşleme gereklidir.', ?)
                ");
                $logStmt->execute(['log_' . uniqid(), $userId, $_SERVER['REMOTE_ADDR'] ?? '']);
            } catch (Exception $e) {}
        } else {
            $json = loadJsonData($dbFile);
            if (isset($json['paired_devices'][$userId])) {
                unset($json['paired_devices'][$userId]);
                saveJsonData($dbFile, $json);
            }
        }

        echo json_encode([
            'success' => true,
            'message' => 'Personel cihaz eşleşmesi başarıyla sıfırlandı.'
        ], JSON_UNESCAPED_UNICODE);
        exit;

    // ========================================================
    // 4. GARSON GİRİŞİ VE SERT CİHAZ KİLİDİ (LOGIN)
    // ========================================================
    case 'login':
    case 'waiter_login':
        // ================================================================
        // GARSON GIRISI: yalnizca PIN ile.
        // PIN kodlari benzersizdir, bu yuzden garson dogrudan PIN'inden
        // taninir; ayrica personel ID veya QR/cihaz eslestirmesi istenmez.
        // 4 haneli PIN tek basina zayif oldugu icin cihaz/IP bazli deneme
        // siniri uygulanir; aksi halde 10.000 kombinasyon denenebilirdi.
        // index.php icindeki verify_waiter_pin ile ayni kurallar gecerlidir.
        // ================================================================
        $pin = preg_replace('/\D/', '', (string)($inputData['pin'] ?? $inputData['pin_kodu'] ?? ''));
        $incomingDeviceUuid = trim($inputData['device_uuid'] ?? $deviceUuid);
        $throttleKey = $incomingDeviceUuid !== '' ? $incomingDeviceUuid : ('ip-' . ($_SERVER['REMOTE_ADDR'] ?? 'bilinmeyen'));

        if ($pin === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Lütfen 4 haneli PIN kodunuzu girin.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $user = null;

        if ($useMysql) {
            // Deneme sayaci tablosu (yoksa olusturulur)
            try {
                $pdo->exec("CREATE TABLE IF NOT EXISTS `garson_giris_denemeleri` (
                    `anahtar` VARCHAR(191) NOT NULL PRIMARY KEY,
                    `deneme` INT NOT NULL DEFAULT 0,
                    `kilit_bitis` DATETIME NULL DEFAULT NULL,
                    `son_deneme` DATETIME NULL DEFAULT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            } catch (Exception $e) {}

            // 1) Kilit kontrolu
            try {
                $lk = $pdo->prepare("SELECT `kilit_bitis` FROM `garson_giris_denemeleri` WHERE `anahtar` = ? LIMIT 1");
                $lk->execute([$throttleKey]);
                $lockUntil = $lk->fetchColumn();
                if ($lockUntil && strtotime((string)$lockUntil) > time()) {
                    $kalan = max(1, (int)ceil((strtotime((string)$lockUntil) - time()) / 60));
                    http_response_code(429);
                    echo json_encode([
                        'success' => false,
                        'error_code' => 'TOO_MANY_ATTEMPTS',
                        'error' => "Çok fazla hatalı deneme. {$kalan} dakika sonra tekrar deneyin."
                    ], JSON_UNESCAPED_UNICODE);
                    exit;
                }
            } catch (Exception $e) {}

            // 2) PIN ile personeli bul (PIN benzersizdir).
            // config.php'deki gtuFindStaffByPin kullanilir: her tablo ayri
            // sorgulanir, olmayan tablo atlanir, gercek veritabani hatasi
            // yutulmaz. Onceden tek UNION sorgusu vardi ve `users` tablosu
            // bulunmayan kurulumlarda DOGRU PIN bile reddediliyordu.
            $lookup = gtuFindStaffByPin($pdo, $pin);

            if ($lookup['error'] !== null) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error_code' => 'DB_ERROR',
                    'error' => 'Veritabanı hatası nedeniyle giriş doğrulanamadı. PIN kodunuz yanlış değil; lütfen yöneticinize bildirin.'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $rows = $lookup['rows'];

            // Ayni PIN birden fazla kisideyse kimin girdigi belirlenemez.
            if (count($rows) > 1) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'error_code' => 'DUPLICATE_PIN',
                    'error' => 'Bu PIN birden fazla personele tanımlı. Yöneticinizden PIN kodunuzu değiştirmesini isteyin.'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $user = null;
            if (count($rows) === 1) {
                $user = [
                    'id'  => $rows[0]['id'],
                    'ad'  => $rows[0]['name'],
                    'rol' => $rows[0]['role'],
                    'device_uuid' => null,
                    'device_paired_at' => null,
                ];
            }
        } else {
            $json = loadJsonData($dbFile);
            $allEmployees = $json['employees'] ?? [];
            $matches = [];
            foreach ($allEmployees as $emp) {
                if (isset($emp['isActive']) && !$emp['isActive']) continue;
                $empPin = preg_replace('/\D/', '', (string)($emp['pin'] ?? ''));
                if ($empPin !== '' && $empPin === $pin) $matches[] = $emp;
            }

            if (count($matches) > 1) {
                http_response_code(409);
                echo json_encode([
                    'success' => false,
                    'error_code' => 'DUPLICATE_PIN',
                    'error' => 'Bu PIN birden fazla personele tanımlı. Yöneticinizden PIN kodunuzu değiştirmesini isteyin.'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            if (count($matches) === 1) {
                $emp = $matches[0];
                $pairedInfo = $json['paired_devices'][$emp['id']] ?? null;
                $user = [
                    'id' => $emp['id'],
                    'ad' => $emp['name'] ?? $emp['ad'] ?? 'Garson',
                    'rol' => $emp['role'] ?? $emp['rol'] ?? 'WAITER',
                    'device_uuid' => $pairedInfo['device_uuid'] ?? null,
                    'device_paired_at' => $pairedInfo['paired_at'] ?? null
                ];
            }
        }

        // 3) PIN eslesmedi: deneme sayacini arttir, 5 denemeden sonra 10 dakika kilit
        if (!$user) {
            if ($useMysql) {
                try {
                    $pdo->prepare("INSERT INTO `garson_giris_denemeleri` (`anahtar`, `deneme`, `son_deneme`)
                                   VALUES (?, 1, NOW())
                                   ON DUPLICATE KEY UPDATE `deneme` = `deneme` + 1, `son_deneme` = NOW()")
                        ->execute([$throttleKey]);
                    $c = $pdo->prepare("SELECT `deneme` FROM `garson_giris_denemeleri` WHERE `anahtar` = ? LIMIT 1");
                    $c->execute([$throttleKey]);
                    if ((int)$c->fetchColumn() >= 5) {
                        $pdo->prepare("UPDATE `garson_giris_denemeleri` SET `deneme` = 0, `kilit_bitis` = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE `anahtar` = ?")
                            ->execute([$throttleKey]);
                        http_response_code(429);
                        echo json_encode([
                            'success' => false,
                            'error_code' => 'TOO_MANY_ATTEMPTS',
                            'error' => 'Çok fazla hatalı deneme. Giriş 10 dakika kilitlendi.'
                        ], JSON_UNESCAPED_UNICODE);
                        exit;
                    }
                } catch (Exception $e) {}
            }

            http_response_code(401);
            echo json_encode([
                'success' => false,
                'error_code' => 'INVALID_CREDENTIALS',
                'error' => 'Hatalı PIN kodu veya aktif personel kaydı bulunamadı.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // 4) Basarili giris: deneme sayacini temizle
        if ($useMysql) {
            try {
                $pdo->prepare("DELETE FROM `garson_giris_denemeleri` WHERE `anahtar` = ?")->execute([$throttleKey]);
            } catch (Exception $e) {}
        }

        // 5) Cihaz kaydi: giris sarti DEGILDIR. Hangi telefonun giris yaptigini
        //    kasadan gorebilmek ve gerekirse erisimi kesebilmek icin tutulur.
        //    Garson telefonunu degistirdiginde PIN'i ile girmeye devam eder.
        if ($incomingDeviceUuid !== '') {
            if ($useMysql) {
                // Her ifade AYRI try icinde: `users` tablosu bulunmayan
                // kurulumlarda ilk ifade hata verince digerleri hic
                // calismiyor ve cihaz kaydi hic tutulmuyordu.
                try {
                    $pdo->prepare("UPDATE `users` SET `device_uuid` = ?, `device_paired_at` = NOW() WHERE `id` = ?")
                        ->execute([$incomingDeviceUuid, $user['id']]);
                } catch (Exception $e) {}
                try {
                    $pdo->prepare("UPDATE `personeller` SET `device_uuid` = ?, `device_paired_at` = NOW() WHERE `id` = ?")
                        ->execute([$incomingDeviceUuid, $user['id']]);
                } catch (Exception $e) {}
                try {
                    $pdo->prepare("INSERT INTO `cihazlar` (`waiter_id`, `waiter_name`, `device_uuid`, `durum`, `eslesme_tarihi`, `son_gorulme`)
                                   VALUES (?, ?, ?, 'APPROVED', NOW(), NOW())
                                   ON DUPLICATE KEY UPDATE `device_uuid` = VALUES(`device_uuid`), `durum` = 'APPROVED', `son_gorulme` = NOW()")
                        ->execute([$user['id'], $user['ad'], $incomingDeviceUuid]);
                } catch (Exception $e) {}
            } else {
                $json = loadJsonData($dbFile);
                $json['paired_devices'][$user['id']] = [
                    'waiterId' => $user['id'],
                    'waiterName' => $user['ad'],
                    'device_uuid' => $incomingDeviceUuid,
                    'paired_at' => date('Y-m-d H:i:s'),
                    'status' => 'APPROVED'
                ];
                @file_put_contents($dbFile, json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            }
        }

        // 6) Oturum anahtari uret. PIN yanitta ASLA dondurulmez.
        $sessionToken = bin2hex(random_bytes(24));

        echo json_encode([
            'success' => true,
            'message' => 'Giriş Başarılı',
            'token' => $sessionToken,
            'user' => [
                'id' => $user['id'],
                'ad' => $user['ad'],
                'rol' => $user['rol'] ?? 'WAITER',
                'device_paired' => $incomingDeviceUuid !== '',
                'device_paired_at' => $user['device_paired_at'] ?? date('Y-m-d H:i:s')
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;

    // ========================================================
    // 5. CİHAZ DURUMU DENETLEME (CHECK DEVICE STATUS)
    // ========================================================
    case 'device_lookup':
        // Cihaz kimliğinden eşleşmiş garsonu bulur. Telefonun yerel hafızası silinse
        // bile (iOS/PWA depolama temizliği) cihaz tanınır ve yeniden QR okutmak
        // gerekmez. PIN bu yanıtta DÖNDÜRÜLMEZ: yalnızca cihaz kimliğini bilen birine
        // PIN sızdırmamak için giriş yine PIN doğrulamasından geçer.
        $lookupUuid = trim($inputData['device_uuid'] ?? $_GET['device_uuid'] ?? $deviceUuid);
        if ($lookupUuid === '' && $deviceToken === '') {
            echo json_encode(['success' => false, 'error' => 'Cihaz kimliği veya anahtarı belirtilmedi.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Öncelik kalıcı cihaz anahtarındadır; yalnızca cihaz kimliği bilinen eski
        // eşleşmeler için UUID ile eşleşmeye izin verilir.
        $lookupTokenHash = $deviceToken !== '' ? hashDeviceToken($deviceToken) : '';

        $foundWaiter = null;
        if ($useMysql) {
            if ($lookupTokenHash !== '') {
                try {
                    $ltStmt = $pdo->prepare("
                        SELECT id, ad_soyad AS ad, rol FROM `users` WHERE `device_token_hash` = ? AND `aktif` = 1
                        UNION
                        SELECT id, ad AS ad, rol FROM `personeller` WHERE `device_token_hash` = ? AND `aktif` = 1
                        LIMIT 1
                    ");
                    $ltStmt->execute([$lookupTokenHash, $lookupTokenHash]);
                    $ltRow = $ltStmt->fetch(PDO::FETCH_ASSOC);
                    if ($ltRow) {
                        $foundWaiter = [
                            'id' => $ltRow['id'],
                            'name' => $ltRow['ad'] ?: 'Garson',
                            'role' => $ltRow['rol'] ?: 'WAITER'
                        ];
                    }
                } catch (Exception $e) {}
            }

            if (!$foundWaiter && $lookupUuid !== '') {
                try {
                    $luStmt = $pdo->prepare("
                        SELECT id, ad_soyad AS ad, rol FROM `users` WHERE `device_uuid` = ? AND `aktif` = 1
                        UNION
                        SELECT id, ad AS ad, rol FROM `personeller` WHERE `device_uuid` = ? AND `aktif` = 1
                        LIMIT 1
                    ");
                    $luStmt->execute([$lookupUuid, $lookupUuid]);
                    $luRow = $luStmt->fetch(PDO::FETCH_ASSOC);
                    if ($luRow) {
                        $foundWaiter = [
                            'id' => $luRow['id'],
                            'name' => $luRow['ad'] ?: 'Garson',
                            'role' => $luRow['rol'] ?: 'WAITER'
                        ];
                    }
                } catch (Exception $e) {}
            }

            if (!$foundWaiter) {
                try {
                    // Parantezler şart: SQL'de AND, OR'dan önce bağlar. Parantezsiz yazımda
                    // anahtarla eşleşen ama iptal edilmiş (durum <> APPROVED) cihaz da geçerdi.
                    $cuStmt = $pdo->prepare("
                        SELECT `waiter_id`, `waiter_name` FROM `cihazlar`
                        WHERE (
                            (? <> '' AND `device_token_hash` = ?)
                            OR (? <> '' AND `device_uuid` = ?)
                        )
                        AND `durum` = 'APPROVED'
                        LIMIT 1
                    ");
                    $cuStmt->execute([$lookupTokenHash, $lookupTokenHash, $lookupUuid, $lookupUuid]);
                    $cuRow = $cuStmt->fetch(PDO::FETCH_ASSOC);
                    if ($cuRow) {
                        $foundWaiter = [
                            'id' => $cuRow['waiter_id'],
                            'name' => $cuRow['waiter_name'] ?: 'Garson',
                            'role' => 'WAITER'
                        ];
                    }
                } catch (Exception $e) {}
            }

            if ($foundWaiter) {
                try {
                    $seenStmt = $pdo->prepare("UPDATE `cihazlar` SET `son_gorulme` = NOW() WHERE `waiter_id` = ?");
                    $seenStmt->execute([$foundWaiter['id']]);
                } catch (Exception $e) {}
            }
        } else {
            $luJson = loadJsonData($dbFile);
            foreach (($luJson['paired_devices'] ?? []) as $luWaiterId => $luInfo) {
                $tokenMatch = $lookupTokenHash !== '' && !empty($luInfo['device_token_hash']) && hash_equals($luInfo['device_token_hash'], $lookupTokenHash);
                $uuidMatch = $lookupUuid !== '' && !empty($luInfo['device_uuid']) && $luInfo['device_uuid'] === $lookupUuid;
                if ($tokenMatch || $uuidMatch) {
                    $foundWaiter = [
                        'id' => $luWaiterId,
                        'name' => $luInfo['waiterName'] ?? 'Garson',
                        'role' => 'WAITER'
                    ];
                    break;
                }
            }
        }

        echo json_encode([
            'success' => true,
            'is_paired' => $foundWaiter !== null,
            'waiter' => $foundWaiter
        ], JSON_UNESCAPED_UNICODE);
        exit;

    case 'check_device_status':
        $userId = trim($inputData['userId'] ?? $_GET['userId'] ?? '');
        $checkDeviceUuid = trim($inputData['device_uuid'] ?? $deviceUuid);

        if (!$userId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Personel ID belirtilmedi.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $paired = false;
        $registeredUuid = null;
        $waiterName = '';

        if ($useMysql) {
            $stmt = $pdo->prepare("
                SELECT id, ad_soyad as ad, device_uuid, device_paired_at 
                FROM `users` WHERE id = ? 
                UNION 
                SELECT id, ad, device_uuid, device_paired_at 
                FROM `personeller` WHERE id = ? 
                LIMIT 1
            ");
            $stmt->execute([$userId, $userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['device_uuid'])) {
                $registeredUuid = $row['device_uuid'];
                $waiterName = $row['ad'] ?? '';
                $paired = true;
            } else {
                try {
                    $cStmt = $pdo->prepare("SELECT `device_uuid`, `waiter_name` FROM `cihazlar` WHERE `waiter_id` = ? AND `durum` = 'APPROVED' LIMIT 1");
                    $cStmt->execute([$userId]);
                    $cRow = $cStmt->fetch(PDO::FETCH_ASSOC);
                    if ($cRow && !empty($cRow['device_uuid'])) {
                        $registeredUuid = $cRow['device_uuid'];
                        $waiterName = $cRow['waiter_name'] ?? '';
                        $paired = true;
                    }
                } catch (Exception $e) {}
            }
        } else {
            $json = loadJsonData($dbFile);
            $info = $json['paired_devices'][$userId] ?? null;
            if ($info && !empty($info['device_uuid'])) {
                $registeredUuid = $info['device_uuid'];
                $waiterName = $info['waiterName'] ?? '';
                $paired = true;
            }
        }

        echo json_encode([
            'success' => true,
            'is_paired' => $paired,
            'has_registered_device' => $paired,
            'device_uuid' => $registeredUuid,
            'deviceName' => 'Mobil Telefon',
            'waiter_name' => $waiterName
        ], JSON_UNESCAPED_UNICODE);
        exit;

    default:
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Geçersiz veya eksik işlem parametresi (action).'
        ], JSON_UNESCAPED_UNICODE);
        exit;
}
