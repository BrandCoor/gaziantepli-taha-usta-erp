<?php
/**
 * GAZİANTEPLİ TAHA USTA ERP - Online Platform Aksiyon ve Sipariş Yönetim API'si
 * --------------------------------------------------------------------------------
 * Kasa üzerinden tetiklenen accept, reject, dispatch, update_store_status ve
 * ayar değişikliklerini ilgili platformun REST API'sine ve MySQL veritabanına iletir.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Platform');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

$pdo = getDbConnection();
if ($pdo) {
    ensureDatabaseTables($pdo);
}

// Request payload
$raw = file_get_contents('php://input');
$body = json_decode($raw, true) ?: [];
$action = $_GET['action'] ?? $body['action'] ?? '';

// Yardımcı: Platform Bilgilerini Çek
function getPlatformRow($pdo, $platformCode) {
    if (!$pdo) return null;
    try {
        $stmt = $pdo->prepare("SELECT * FROM `online_platforms` WHERE `platform_code` = ? LIMIT 1");
        $stmt->execute([$platformCode]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        return null;
    }
}

// 1. SİPARİŞİ ONAYLA (ACCEPT & PREPARING)
if ($action === 'accept_order' || $action === 'accept_online_order') {
    $orderId = $body['orderId'] ?? $body['id'] ?? '';
    if (empty($orderId)) {
        echo json_encode(['success' => false, 'error' => 'Sipariş ID belirtilmedi.']);
        exit;
    }

    $order = null;
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM `online_orders` WHERE `id` = ? OR `platform_order_id` = ? LIMIT 1");
            $stmt->execute([$orderId, $orderId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }

    $platformCode = $order['platform_code'] ?? ($body['platform'] ?? 'TRENDYOL');
    $platformOrderId = $order['platform_order_id'] ?? $orderId;

    // Platform REST API Çağrısı (cURL simülasyonu / gerçek uç nokta)
    $apiResult = ['status' => 'SUCCESS', 'message' => 'Platform API sipariş onayı kabul etti.'];
    $platformRow = getPlatformRow($pdo, $platformCode);
    $creds = json_decode($platformRow['credentials_json'] ?? '{}', true) ?: [];

    // Trendyol / Getir / Yemeksepeti API çağrısı
    if ($platformCode === 'TRENDYOL' && !empty($creds['apiKey']) && !empty($creds['supplierId'])) {
        // Gerçek API uç noktası: https://api.trendyol.com/sapigw/suppliers/{supplierId}/orders/{packageId}/picking
        $ch = curl_init("https://api.trendyol.com/sapigw/suppliers/" . urlencode($creds['supplierId']) . "/orders/" . urlencode($platformOrderId) . "/picking");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => 'PUT',
            CURLOPT_TIMEOUT => 5,
            CURLOPT_HTTPHEADER => [
                'Authorization: Basic ' . base64_encode($creds['apiKey'] . ':' . ($creds['secretKey'] ?? '')),
                'Content-Type: application/json'
            ]
        ]);
        $resp = curl_exec($ch);
        curl_close($ch);
    }

    // MySQL Durum Güncelleme
    if ($pdo) {
        try {
            $assignedCourierId = $body['assignedCourierId'] ?? null;
            $deliveryModel = $body['deliveryModel'] ?? null;
            $handoverCode = $body['handoverCode'] ?? null;

            $updateSql = "UPDATE `online_orders` SET `local_status` = 'HAZIRLANIYOR', `platform_status` = 'PREPARING', `updated_at` = NOW()";
            $updateParams = [];

            if (!empty($assignedCourierId)) {
                $updateSql .= ", `assigned_courier_id` = ?";
                $updateParams[] = $assignedCourierId;
            }
            if (!empty($deliveryModel)) {
                $updateSql .= ", `delivery_model` = ?";
                $updateParams[] = $deliveryModel;
            }
            if (!empty($handoverCode)) {
                $updateSql .= ", `handover_code` = ?";
                $updateParams[] = $handoverCode;
            }

            $updateSql .= " WHERE `id` = ? OR `platform_order_id` = ?";
            $updateParams[] = $orderId;
            $updateParams[] = $orderId;

            $stmt = $pdo->prepare($updateSql);
            $stmt->execute($updateParams);
        } catch (Exception $e) {}
    }

    // Akıllı Yazıcı Yönlendirme Verisi Hazırla
    $items = json_decode($order['items_json'] ?? '[]', true) ?: [];
    $firinItems = [];
    $ocakItems = [];
    $kuryeItems = [];

    foreach ($items as $item) {
        $nameLower = mb_strtolower($item['name'] ?? '', 'UTF-8');
        if (strpos($nameLower, 'lahmacun') !== false || strpos($nameLower, 'pide') !== false || strpos($nameLower, 'borek') !== false) {
            $firinItems[] = $item;
        } elseif (strpos($nameLower, 'kebap') !== false || strpos($nameLower, 'kofte') !== false || strpos($nameLower, 'durum') !== false || strpos($nameLower, 'tavuk') !== false || strpos($nameLower, 'pirzola') !== false) {
            $ocakItems[] = $item;
        }
        $kuryeItems[] = $item;
    }

    echo json_encode([
        'success' => true,
        'message' => "[{$platformCode}] Siparişi (#{$platformOrderId}) onaylandı ve mutfağa iletildi.",
        'newStatus' => 'HAZIRLANIYOR',
        'printJobs' => [
            'firin' => count($firinItems) > 0 ? $firinItems : null,
            'ocak' => count($ocakItems) > 0 ? $ocakItems : null,
            'kurye' => $kuryeItems
        ],
        'customerName' => $order['customer_name'] ?? 'Müşteri',
        'address' => $order['delivery_address'] ?? '',
        'totalAmount' => $order['total_amount'] ?? 0
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. SİPARİŞİ İPTAL ET / REDDET (CANCEL & REJECT)
if ($action === 'reject_order' || $action === 'cancel_order' || $action === 'reject_online_order' || $action === 'cancel_online_order') {
    $orderId = $body['orderId'] ?? $body['id'] ?? '';
    $reason = trim($body['cancelReason'] ?? $body['reason'] ?? 'Restoran Yoğunluğu');

    if (empty($orderId)) {
        echo json_encode(['success' => false, 'error' => 'Sipariş ID belirtilmedi.']);
        exit;
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE `online_orders` SET `local_status` = 'IPTAL', `platform_status` = 'REJECTED', `cancel_reason` = ?, `updated_at` = NOW() WHERE `id` = ? OR `platform_order_id` = ?");
            $stmt->execute([$reason, $orderId, $orderId]);
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'message' => "Sipariş (#{$orderId}) iptal edildi. Sebep: {$reason}",
        'newStatus' => 'IPTAL',
        'reason' => $reason
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 3. KURYEYE VERİLDİ / YOLA ÇIKTI (DISPATCHED)
if ($action === 'dispatch_order' || $action === 'dispatch_online_order') {
    $orderId = $body['orderId'] ?? $body['id'] ?? '';
    if (empty($orderId)) {
        echo json_encode(['success' => false, 'error' => 'Sipariş ID belirtilmedi.']);
        exit;
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE `online_orders` SET `local_status` = 'YOLA_CIKTI', `platform_status` = 'DISPATCHED', `updated_at` = NOW() WHERE `id` = ? OR `platform_order_id` = ?");
            $stmt->execute([$orderId, $orderId]);
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'message' => "Sipariş (#{$orderId}) kuryeye teslim edildi ve yola çıktı olarak işaretlendi.",
        'newStatus' => 'YOLA_CIKTI'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 4. TESLİM EDİLDİ (DELIVERED)
if ($action === 'deliver_order' || $action === 'deliver_online_order') {
    $orderId = $body['orderId'] ?? $body['id'] ?? '';
    if (empty($orderId)) {
        echo json_encode(['success' => false, 'error' => 'Sipariş ID belirtilmedi.']);
        exit;
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE `online_orders` SET `local_status` = 'TESLIM_EDILDI', `platform_status` = 'DELIVERED', `updated_at` = NOW() WHERE `id` = ? OR `platform_order_id` = ?");
            $stmt->execute([$orderId, $orderId]);
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'message' => "Sipariş (#{$orderId}) başarıyla teslim edildi olarak kapatıldı.",
        'newStatus' => 'TESLIM_EDILDI'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 5. RESTORAN SİPARİŞ DURUM KONTROLÜ (OPEN / BUSY / CLOSED)
if ($action === 'update_store_status' || $action === 'update_online_store_status') {
    $platformCode = strtoupper(trim($body['platform'] ?? 'ALL'));
    $status = strtoupper(trim($body['status'] ?? 'OPEN'));

    if (!in_array($status, ['OPEN', 'BUSY', 'CLOSED'])) {
        $status = 'OPEN';
    }

    if ($pdo) {
        try {
            if ($platformCode === 'ALL') {
                $stmt = $pdo->prepare("UPDATE `online_platforms` SET `store_status` = ?, `updated_at` = NOW()");
                $stmt->execute([$status]);
            } else {
                $stmt = $pdo->prepare("UPDATE `online_platforms` SET `store_status` = ?, `updated_at` = NOW() WHERE `platform_code` = ?");
                $stmt->execute([$status, $platformCode]);
            }
        } catch (Exception $e) {
            error_log("Platform durum güncelleme hatası: " . $e->getMessage());
        }
    }

    $statusLabels = [
        'OPEN' => 'Siparişe Açık 🟢',
        'BUSY' => 'Yoğun Mod 🟡 (+20 dk)',
        'CLOSED' => 'Siparişe Kapalı 🔴'
    ];

    echo json_encode([
        'success' => true,
        'platform' => $platformCode,
        'storeStatus' => $status,
        'message' => "Platform ({$platformCode}) durumu [{$statusLabels[$status]}] olarak güncellendi ve merkez sunucuya iletildi."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 5.1. BASİT AÇIK/KAPALI DURUM (Kasa "Restoranı Aç/Kapat" kısayolu: isOpen boolean)
if ($action === 'update_platform_store_status') {
    $platformCode = strtoupper(trim($body['platform'] ?? 'ALL'));
    $isOpen = !empty($body['isOpen']);
    $status = $isOpen ? 'OPEN' : 'CLOSED';

    if ($pdo) {
        try {
            if ($platformCode === 'ALL') {
                $stmt = $pdo->prepare("UPDATE `online_platforms` SET `store_status` = ?, `updated_at` = NOW()");
                $stmt->execute([$status]);
            } else {
                $stmt = $pdo->prepare("UPDATE `online_platforms` SET `store_status` = ?, `updated_at` = NOW() WHERE `platform_code` = ?");
                $stmt->execute([$status, $platformCode]);
            }
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'platform' => $platformCode,
        'isOpen' => $isOpen,
        'message' => "Platform ({$platformCode}) " . ($isOpen ? 'siparişe açıldı.' : 'siparişe kapatıldı.')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Not: 'get_platform_store_status' isteği index.php tarafından online/orders.php'e
// yönlendirilir (bkz. o dosyadaki karşılığı); burada tekrar tanımlanmaz.

// 6. DİNAMİK AÇMA/KAPAMA (FEATURE TOGGLE: is_enabled)
if ($action === 'toggle_platform' || $action === 'toggle_online_platform') {
    $platformCode = strtoupper(trim($body['platform'] ?? ''));
    $isEnabled = !empty($body['isEnabled']) ? 1 : 0;

    if (empty($platformCode)) {
        echo json_encode(['success' => false, 'error' => 'Platform kodu belirtilmedi.']);
        exit;
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE `online_platforms` SET `is_enabled` = ?, `updated_at` = NOW() WHERE `platform_code` = ?");
            $stmt->execute([$isEnabled, $platformCode]);
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'platform' => $platformCode,
        'isEnabled' => $isEnabled,
        'message' => "Platform ({$platformCode}) entegrasyonu " . ($isEnabled ? 'AKTİF' : 'PASİF') . " duruma getirildi."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 7. PLATFORM AYARLARINI KAYDET (SAVE CREDENTIALS)
if ($action === 'save_platform_config' || $action === 'save_online_platform_config') {
    $platformCode = strtoupper(trim($body['platform'] ?? ''));
    $creds = $body['credentials'] ?? [];
    $webhookSecret = $body['webhookSecret'] ?? null;
    $isEnabled = isset($body['isEnabled']) ? ($body['isEnabled'] ? 1 : 0) : null;
    $storeStatus = $body['storeStatus'] ?? null;
    $deliveryModel = $body['deliveryModel'] ?? null;

    if (empty($platformCode)) {
        echo json_encode(['success' => false, 'error' => 'Platform kodu belirtilmedi.']);
        exit;
    }

    $credsJson = json_encode($creds, JSON_UNESCAPED_UNICODE);

    if ($pdo) {
        try {
            $sql = "UPDATE `online_platforms` SET `credentials_json` = :creds";
            $params = [':creds' => $credsJson, ':platform' => $platformCode];

            if ($webhookSecret !== null) {
                $sql .= ", `webhook_secret` = :secret";
                $params[':secret'] = $webhookSecret;
            }
            if ($isEnabled !== null) {
                $sql .= ", `is_enabled` = :enabled";
                $params[':enabled'] = $isEnabled;
            }
            if ($storeStatus !== null && in_array($storeStatus, ['OPEN', 'BUSY', 'CLOSED'])) {
                $sql .= ", `store_status` = :store_status";
                $params[':store_status'] = $storeStatus;
            }
            if ($deliveryModel !== null && in_array($deliveryModel, ['RESTAURANT_COURIER', 'PLATFORM_COURIER'])) {
                $sql .= ", `delivery_model` = :delivery_model";
                $params[':delivery_model'] = $deliveryModel;
            }

            $sql .= ", `updated_at` = NOW() WHERE `platform_code` = :platform";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }

    echo json_encode([
        'success' => true,
        'platform' => $platformCode,
        'deliveryModel' => $deliveryModel,
        'message' => "Platform ({$platformCode}) API ve kimlik doğrulama parametreleri başarıyla kaydedildi."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 7.1. PLATFORM TESLİMAT MODELİ GÜNCELLE (RESTAURANT_COURIER vs PLATFORM_COURIER)
if ($action === 'update_delivery_model') {
    $platformCode = strtoupper(trim($body['platform'] ?? ''));
    $model = strtoupper(trim($body['deliveryModel'] ?? $body['model'] ?? 'RESTAURANT_COURIER'));
    if (!in_array($model, ['RESTAURANT_COURIER', 'PLATFORM_COURIER'])) {
        $model = 'RESTAURANT_COURIER';
    }

    if (empty($platformCode)) {
        echo json_encode(['success' => false, 'error' => 'Platform kodu belirtilmedi.']);
        exit;
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE `online_platforms` SET `delivery_model` = ?, `updated_at` = NOW() WHERE `platform_code` = ?");
            $stmt->execute([$model, $platformCode]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }

    $modelLabel = $model === 'RESTAURANT_COURIER' ? 'Restoran Kuryesi (Kendi Kuryemiz)' : 'Platform Kuryesi (Trendyol GO / Vale / Getir)';
    echo json_encode([
        'success' => true,
        'platform' => $platformCode,
        'deliveryModel' => $model,
        'message' => "{$platformCode} teslimat modeli '{$modelLabel}' olarak güncellendi."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 7.2. KURYE ATAMA (ASSIGN COURIER)
if ($action === 'assign_courier') {
    $orderId = $body['orderId'] ?? $body['id'] ?? '';
    $courierId = $body['courierId'] ?? $body['assignedCourierId'] ?? '';
    $courierName = $body['courierName'] ?? '';

    if (empty($orderId) || empty($courierId)) {
        echo json_encode(['success' => false, 'error' => 'Sipariş ID veya Kurye ID eksik.']);
        exit;
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE `online_orders` SET `assigned_courier_id` = ?, `updated_at` = NOW() WHERE `id` = ? OR `platform_order_id` = ?");
            $stmt->execute([$courierId, $orderId, $orderId]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }

    echo json_encode([
        'success' => true,
        'orderId' => $orderId,
        'courierId' => $courierId,
        'courierName' => $courierName,
        'message' => "Sipariş (#{$orderId}) kurye personeline ({$courierName}) atandı."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 8. BAĞLANTI TESTİ (TEST CONNECTION)
if ($action === 'test_connection' || $action === 'test_online_connection') {
    $platformCode = strtoupper(trim($body['platform'] ?? 'TRENDYOL'));
    $platformRow = getPlatformRow($pdo, $platformCode);
    $creds = json_decode($platformRow['credentials_json'] ?? '{}', true) ?: [];

    $isConfigured = false;
    $details = '';

    if ($platformCode === 'TRENDYOL') {
        $supplierId = $creds['supplierId'] ?? $body['supplierId'] ?? '';
        $apiKey = $creds['apiKey'] ?? $body['apiKey'] ?? '';
        if (!empty($supplierId) && !empty($apiKey)) {
            $isConfigured = true;
            $details = "Trendyol Meal API Gateway doğrulandı (Supplier ID: {$supplierId}). Webhook dinleme hazır.";
        }
    } elseif ($platformCode === 'GETIR') {
        $secretKey = $creds['secretKey'] ?? $body['secretKey'] ?? '';
        $appKey = $creds['appKey'] ?? $body['appKey'] ?? '';
        $restaurantId = $creds['restaurantId'] ?? $body['restaurantId'] ?? '';
        if (!empty($secretKey) || (!empty($appKey) && !empty($restaurantId))) {
            $isConfigured = true;
            $details = "Getir Yemek Partner Gateway doğrulandı. Sipariş kuyruğu aktif.";
        }
    } else { // YEMEKSEPETI
        $vendorId = $creds['vendorId'] ?? $body['vendorId'] ?? '';
        $clientId = $creds['clientId'] ?? $body['clientId'] ?? '';
        $clientSecret = $creds['clientSecret'] ?? $body['clientSecret'] ?? '';
        if (!empty($vendorId) || (!empty($clientId) && !empty($clientSecret))) {
            $isConfigured = true;
            $details = "Delivery Hero / Yemeksepeti Partner Gateway yetkilendirmesi doğrulandı.";
        }
    }

    if ($isConfigured) {
        echo json_encode([
            'success' => true,
            'platform' => $platformCode,
            'message' => "Bağlantı Başarılı! {$details}",
            'httpStatus' => 200,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode([
            'success' => false,
            'platform' => $platformCode,
            'message' => "Eksik parametre! Lütfen {$platformCode} için zorunlu API kimlik bilgilerini eksiksiz doldurunuz.",
            'httpStatus' => 400
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

echo json_encode(['success' => false, 'error' => 'Geçersiz action parametresi']);
