<?php
/**
 * GAZİANTEPLİ TAHA USTA ERP - Cihaz Eşleştirme & Garson Kimlik Doğrulama API'si
 * -------------------------------------------------------------------------------
 * QR Tabanlı Garson Cihaz Kilitleme (Device Binding), Eşleştirme ve Sert Güvenlik Denetimi
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Device-UUID');

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
        "ALTER TABLE `personeller` ADD COLUMN `pairing_expires_at` DATETIME NULL DEFAULT NULL AFTER `pairing_secret`"
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

            $pdo->beginTransaction();
            try {
                $stmt1 = $pdo->prepare("UPDATE `users` SET `pairing_secret` = ?, `pairing_expires_at` = ? WHERE `id` = ? AND `aktif` = 1");
                $stmt1->execute([$tokenHash, $expiresAt, $userId]);
                $stmt2 = $pdo->prepare("UPDATE `personeller` SET `pairing_secret` = ?, `pairing_expires_at` = ? WHERE `id` = ? AND `aktif` = 1");
                $stmt2->execute([$tokenHash, $expiresAt, $userId]);
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
    // 2. MOBİL TELEFON CİHAZINI EŞLEŞTİR (GARSON PWA TARAFINDAN ÇAĞRILIR)
    // ========================================================
    case 'pair_device':
        $userId = trim($inputData['userId'] ?? $_GET['userId'] ?? '');
        $token = trim($inputData['token'] ?? $_GET['token'] ?? '');
        $targetDeviceUuid = trim($inputData['device_uuid'] ?? $deviceUuid);
        $name = trim($inputData['name'] ?? $_GET['name'] ?? '');
        $pin = trim($inputData['pin'] ?? $_GET['pin'] ?? '1234');

        if (!$userId || !$token || !$targetDeviceUuid) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Eksik eşleştirme bilgisi. Token, Personel ID ve Cihaz Kimliği (UUID) zorunludur.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $now = date('Y-m-d H:i:s');

        if ($useMysql) {
            $checkStmt = $pdo->prepare("
                SELECT id, ad_soyad, rol, pairing_secret, pairing_expires_at 
                FROM `users` 
                WHERE id = ? 
                UNION 
                SELECT id, ad as ad_soyad, rol, pairing_secret, pairing_expires_at 
                FROM `personeller` 
                WHERE id = ?
                LIMIT 1
            ");
            $checkStmt->execute([$userId, $userId]);
            $targetUser = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if (!$targetUser) {
                // Eğer personel veritabanında henüz yoksa otomatik oluştur
                $waiterName = $name ?: 'Garson';
                try {
                    $insPers = $pdo->prepare("INSERT INTO `personeller` (`id`, `ad`, `pin`, `rol`, `device_uuid`, `device_paired_at`, `aktif`) VALUES (?, ?, ?, 'WAITER', ?, ?, 1) ON DUPLICATE KEY UPDATE `device_uuid` = VALUES(`device_uuid`), `device_paired_at` = VALUES(`device_paired_at`)");
                    $insPers->execute([$userId, $waiterName, $pin, $targetDeviceUuid, $now]);
                } catch (Exception $e) {}
                try {
                    $insUser = $pdo->prepare("INSERT INTO `users` (`id`, `ad_soyad`, `pin_kodu`, `rol`, `device_uuid`, `device_paired_at`, `aktif`) VALUES (?, ?, ?, 'WAITER', ?, ?, 1) ON DUPLICATE KEY UPDATE `device_uuid` = VALUES(`device_uuid`), `device_paired_at` = VALUES(`device_paired_at`)");
                    $insUser->execute([$userId, $waiterName, $pin, $targetDeviceUuid, $now]);
                } catch (Exception $e) {}
                $targetUser = ['id' => $userId, 'ad_soyad' => $waiterName, 'rol' => 'WAITER'];
            } else {
                $updUser = $pdo->prepare("UPDATE `users` SET `device_uuid` = ?, `device_paired_at` = ?, `pairing_secret` = NULL, `pairing_expires_at` = NULL WHERE `id` = ?");
                $updUser->execute([$targetDeviceUuid, $now, $userId]);
                $updPers = $pdo->prepare("UPDATE `personeller` SET `device_uuid` = ?, `device_paired_at` = ?, `pairing_secret` = NULL, `pairing_expires_at` = NULL WHERE `id` = ?");
                $updPers->execute([$targetDeviceUuid, $now, $userId]);
            }

            try {
                $updCihaz = $pdo->prepare("
                    INSERT INTO `cihazlar` (`waiter_id`, `waiter_name`, `device_uuid`, `durum`, `eslesme_tarihi`)
                    VALUES (?, ?, ?, 'APPROVED', NOW())
                    ON DUPLICATE KEY UPDATE `device_uuid` = VALUES(`device_uuid`), `durum` = 'APPROVED', `eslesme_tarihi` = NOW()
                ");
                $updCihaz->execute([$userId, $targetUser['ad_soyad'] ?? $name ?? 'Garson', $targetDeviceUuid]);
            } catch (Exception $ignore) {}

            // Audit log ekle
            try {
                $logStmt = $pdo->prepare("
                    INSERT INTO `audit_logs` (id, islem_turu, yetkili, detay, ip_adresi)
                    VALUES (?, 'CIHAZ_ESLEME', ?, ?, ?)
                ");
                $logStmt->execute([
                    'log_' . uniqid(),
                    $targetUser['ad_soyad'] ?? $userId,
                    "Telefon Cihazı Başarıyla Eşleştirildi. Cihaz UUID: {$targetDeviceUuid}",
                    $_SERVER['REMOTE_ADDR'] ?? ''
                ]);
            } catch (Exception $e) {}

            echo json_encode([
                'success' => true,
                'message' => 'Cihazınız Başarıyla Eşleştirildi',
                'user' => [
                    'id' => $targetUser['id'],
                    'ad' => $targetUser['ad_soyad'] ?? $name ?? 'Garson',
                    'rol' => $targetUser['rol'] ?? 'WAITER'
                ],
                'device_uuid' => $targetDeviceUuid,
                'paired_at' => $now
            ], JSON_UNESCAPED_UNICODE);
            exit;
        } else {
            $json = loadJsonData($dbFile);
            if (!isset($json['paired_devices'])) $json['paired_devices'] = [];
            $json['paired_devices'][$userId] = [
                'device_uuid' => $targetDeviceUuid,
                'paired_at' => $now
            ];
            if (isset($json['pairing_tokens'][$userId])) {
                unset($json['pairing_tokens'][$userId]);
            }
            saveJsonData($dbFile, $json);

            echo json_encode([
                'success' => true,
                'message' => 'Cihazınız Başarıyla Eşleştirildi',
                'user' => [
                    'id' => $userId,
                    'ad' => $name ?: 'Garson',
                    'rol' => 'WAITER'
                ],
                'device_uuid' => $targetDeviceUuid,
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
        $pin = trim($inputData['pin'] ?? $inputData['pin_kodu'] ?? '');
        $userId = trim($inputData['userId'] ?? '');
        $incomingDeviceUuid = trim($inputData['device_uuid'] ?? $deviceUuid);

        if (!$pin) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Lütfen 4 haneli PIN kodunuzu girin.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $user = null;

        if ($useMysql) {
            if ($userId) {
                $stmt = $pdo->prepare("
                    SELECT id, ad_soyad as ad, pin_kodu as pin, rol, device_uuid, device_paired_at, aktif 
                    FROM `users` 
                    WHERE id = ? AND pin_kodu = ? AND aktif = 1
                    UNION
                    SELECT id, ad, pin, rol, device_uuid, device_paired_at, aktif 
                    FROM `personeller` 
                    WHERE id = ? AND pin = ? AND aktif = 1
                    LIMIT 1
                ");
                $stmt->execute([$userId, $pin, $userId, $pin]);
            } else {
                $stmt = $pdo->prepare("
                    SELECT id, ad_soyad as ad, pin_kodu as pin, rol, device_uuid, device_paired_at, aktif 
                    FROM `users` 
                    WHERE pin_kodu = ? AND aktif = 1
                    UNION
                    SELECT id, ad, pin, rol, device_uuid, device_paired_at, aktif 
                    FROM `personeller` 
                    WHERE pin = ? AND aktif = 1
                    LIMIT 1
                ");
                $stmt->execute([$pin, $pin]);
            }
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
        } else {
            $json = loadJsonData($dbFile);
            $allEmployees = $json['employees'] ?? [];
            foreach ($allEmployees as $emp) {
                if (($emp['pin'] ?? '') === $pin) {
                    $pairedInfo = $json['paired_devices'][$emp['id']] ?? null;
                    $user = [
                        'id' => $emp['id'],
                        'ad' => $emp['name'] ?? $emp['ad'],
                        'pin' => $emp['pin'],
                        'rol' => $emp['role'] ?? $emp['rol'] ?? 'WAITER',
                        'device_uuid' => $pairedInfo['device_uuid'] ?? null,
                        'device_paired_at' => $pairedInfo['paired_at'] ?? null,
                        'aktif' => 1
                    ];
                    break;
                }
            }
        }

        // 1. PIN doğrulaması başarısız ise
        if (!$user) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'error' => 'Hatalı PIN kodu veya aktif personel kaydı bulunamadı.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $userRole = strtoupper($user['rol'] ?? 'WAITER');
        $registeredDeviceUuid = trim($user['device_uuid'] ?? '');

        // Otomatik Cihaz Kilitleme (Eğer kayıtlı UUID henüz yoksa gelen cihazı kaydet)
        if (empty($registeredDeviceUuid) && !empty($incomingDeviceUuid)) {
            if ($useMysql) {
                try {
                    $pdo->prepare("UPDATE `users` SET `device_uuid` = ?, `device_paired_at` = NOW() WHERE `id` = ?")
                        ->execute([$incomingDeviceUuid, $user['id']]);
                    $pdo->prepare("UPDATE `personeller` SET `device_uuid` = ?, `device_paired_at` = NOW() WHERE `id` = ?")
                        ->execute([$incomingDeviceUuid, $user['id']]);
                    $pdo->prepare("INSERT INTO `cihazlar` (`waiter_id`, `waiter_name`, `device_uuid`, `durum`, `eslesme_tarihi`) 
                                   VALUES (?, ?, ?, 'APPROVED', NOW()) 
                                   ON DUPLICATE KEY UPDATE `device_uuid` = VALUES(`device_uuid`), `durum` = 'APPROVED', `eslesme_tarihi` = NOW()")
                        ->execute([$user['id'], $user['ad'], $incomingDeviceUuid]);
                } catch (Exception $e) {}
            }
            $registeredDeviceUuid = $incomingDeviceUuid;
        }

        // 2. MÜŞTERİNİN KESİN KURALI: GARSON İÇİN CİHAZ KİLİDİ (DEVICE BINDING)
        $isWaiter = in_array($userRole, ['WAITER', 'GARSON']);

        if ($isWaiter && !empty($registeredDeviceUuid)) {
            if (!empty($incomingDeviceUuid) && $incomingDeviceUuid !== $registeredDeviceUuid) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'error_code' => 'DEVICE_NOT_PAIRED',
                    'error' => 'Bu cihaz başka bir garson hesabı ile eşleştirilmiştir veya kilitlidir. Lütfen kasanızdan yeni QR kod okutun.',
                    'user_id' => $user['id'],
                    'user_name' => $user['ad'],
                    'is_paired' => true
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        // 3. Başarılı Giriş: Güvenli Oturum / Token Üret
        $sessionToken = bin2hex(random_bytes(24));

        echo json_encode([
            'success' => true,
            'message' => 'Giriş Başarılı',
            'token' => $sessionToken,
            'user' => [
                'id' => $user['id'],
                'ad' => $user['ad'],
                'rol' => $user['rol'] ?? 'WAITER',
                'device_paired' => true,
                'device_paired_at' => $user['device_paired_at'] ?? date('Y-m-d H:i:s')
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;

    // ========================================================
    // 5. CİHAZ DURUMU DENETLEME (CHECK DEVICE STATUS)
    // ========================================================
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
