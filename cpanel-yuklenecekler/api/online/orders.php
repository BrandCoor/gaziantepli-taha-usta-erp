<?php
/**
 * GAZİANTEPLİ TAHA USTA ERP - Online Siparişler Polling ve Liste API'si
 * -----------------------------------------------------------------------
 * Kasa terminalinin arka plan servisinin 5-10 saniyede bir siparişleri
 * sorgulamasını ve platform ayarlarını yönetmesini sağlar.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Platform, X-Kasa-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/lib.php';
// Bu uç yalnızca kasa içindir; merkezi kapıyı atlamasın diye burada da zorunlu kılınır.
if (!sec_is_kasa()) { sec_json_exit(401, ['success' => false, 'error' => 'Yetkisiz istek.', 'code' => 'UNAUTHORIZED']); }

$pdo = getDbConnection();
if ($pdo) {
    ensureDatabaseTables($pdo);
}

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

// 0. BASİT AÇIK/KAPALI DURUMU OKU (Kasa açılışında senkronize etmek için)
if ($action === 'get_platform_store_status') {
    $platformStoreStatus = [
        'TRENDYOL' => ['isOpen' => true],
        'YEMEKSEPETI' => ['isOpen' => true],
    ];

    if ($pdo) {
        try {
            $rows = $pdo->query("SELECT `platform_code`, `store_status` FROM `online_platforms`")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $row) {
                if (!in_array($row['platform_code'], OP_PLATFORMS, true)) { continue; }
                $platformStoreStatus[$row['platform_code']] = [
                    'isOpen' => $row['store_status'] !== 'CLOSED'
                ];
            }
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'platformStoreStatus' => $platformStoreStatus,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 1. PLATFORM LİSTESİ VE DURUMLARI (GET_PLATFORMS)
if ($action === 'get_platforms' || $action === 'get_online_platforms') {
    $platforms = [];
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT `id`, `platform_code`, `display_name`, `is_enabled`, `store_status`, `delivery_model`, `credentials_json`, `webhook_secret`, `updated_at` FROM `online_platforms` WHERE `platform_code` IN ('TRENDYOL','YEMEKSEPETI') ORDER BY `id` ASC");
            $platforms = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }

    if (empty($platforms)) {
        // Fallback varsayılan kayıtlar
        $platforms = [
            ['platform_code' => 'YEMEKSEPETI', 'display_name' => 'Yemeksepeti', 'is_enabled' => 0, 'store_status' => 'CLOSED'],
            ['platform_code' => 'TRENDYOL', 'display_name' => 'Trendyol Go Yemek', 'is_enabled' => 0, 'store_status' => 'CLOSED']
        ];
    }

    echo json_encode([
        'success' => true,
        'platforms' => $platforms,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. SİPARİŞLERİ LİSTELE (POLLING / LIST)
if ($action === 'list' || $action === 'get_orders' || $action === 'get_online_orders' || $action === 'list_online_orders') {
    $statusFilter = $_GET['status'] ?? 'ACTIVE'; // ACTIVE, ALL, HISTORY, BEKLIYOR vb.
    $platformFilter = $_GET['platform'] ?? 'ALL'; // ALL, YEMEKSEPETI, TRENDYOL
    $orders = [];
    $pendingCount = 0;
    $hiddenCount = 0;
    if ($pdo) {
        // Siparisler platformdan CEKILIR (webhook beklenmez): platform basina en cok 20 sn'de bir, tek seferde bir sorgu.
        try { op_poll_all($pdo, false); } catch (Throwable $e) { error_log('online poll: ' . $e->getMessage()); }
    }
    if ($pdo) {
        try { $hiddenCount = (int)$pdo->query("SELECT COUNT(*) FROM `online_orders` WHERE `local_status` IN ('BEKLIYOR','HAZIRLANIYOR','YOLA_CIKTI') AND `platform_code` IN (SELECT `platform_code` FROM `online_platforms` WHERE `is_enabled` = 0)")->fetchColumn(); } catch (Throwable $e) {}
    }

    if ($pdo) {
        try {
            $whereParts = [];
            $params = [];

            // Durum Filtresi
            if ($statusFilter === 'ACTIVE') {
                $whereParts[] = "`local_status` IN ('BEKLIYOR', 'HAZIRLANIYOR', 'YOLA_CIKTI')";
            } elseif ($statusFilter === 'HISTORY') {
                $whereParts[] = "`local_status` IN ('TESLIM_EDILDI', 'IPTAL')";
            } elseif ($statusFilter !== 'ALL') {
                $whereParts[] = "`local_status` = :status";
                $params[':status'] = $statusFilter;
            }

            // Platform Filtresi
            if ($platformFilter !== 'ALL') {
                $whereParts[] = "`platform_code` = :platform";
                $params[':platform'] = $platformFilter;
            }

            // Sadece AKTİF (is_enabled = 1) olan platformların siparişlerini getir kuralı:
            // Kullanıcı kuralı: "Pasif duruma getirilen platform; sol menüdeki Yemek Platformları sekmesinden, filtrelerden, bildirim sayaçlarından ve sipariş listelerinden TAMAMEN gizlenecektir."
            $whereParts[] = "`platform_code` IN (SELECT `platform_code` FROM `online_platforms` WHERE `is_enabled` = 1)";
            $whereParts[] = "`platform_code` IN ('TRENDYOL','YEMEKSEPETI')";

            $sql = "SELECT * FROM `online_orders`";
            if (!empty($whereParts)) {
                $sql .= " WHERE " . implode(" AND ", $whereParts);
            }
            $sql .= " ORDER BY CASE WHEN `local_status` = 'BEKLIYOR' THEN 1 WHEN `local_status` = 'HAZIRLANIYOR' THEN 2 WHEN `local_status` = 'YOLA_CIKTI' THEN 3 ELSE 4 END, `created_at` DESC LIMIT 100";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $row) {
                $items = json_decode($row['items_json'] ?? '[]', true) ?: [];
                $orders[] = [
                    'id' => strval($row['id']),
                    'platform' => $row['platform_code'],
                    'platformCode' => $row['platform_code'],
                    'platformOrderId' => $row['platform_order_id'],
                    'customerName' => $row['customer_name'],
                    'customerPhone' => $row['customer_phone'] ?? '',
                    'address' => $row['delivery_address'],
                    'orderNote' => $row['order_note'] ?? '',
                    'items' => $items,
                    'totalAmount' => floatval($row['total_amount']),
                    'paymentMethod' => $row['payment_method'],
                    'platformStatus' => $row['platform_status'],
                    'status' => $row['local_status'], // 'BEKLIYOR', 'HAZIRLANIYOR', 'YOLA_CIKTI', 'TESLIM_EDILDI', 'IPTAL'
                    'cancelReason' => $row['cancel_reason'] ?? '',
                    'createdAt' => $row['created_at'],
                    'deliveryModel' => $row['delivery_model'] ?? 'RESTAURANT_COURIER',
                    'assignedCourierId' => $row['assigned_courier_id'] ?? null,
                    'platformCourierName' => $row['platform_courier_name'] ?? null,
                    'platformCourierPhone' => $row['platform_courier_phone'] ?? null,
                    'handoverCode' => $row['handover_code'] ?? null,
                    'platformSync' => $row['platform_sync_status'] ?? null,
                    'platformSyncMessage' => $row['platform_sync_message'] ?? null,
                    'displayCode' => $row['display_code'] ?? null,
                    'sourceApp' => $row['source_app'] ?? $row['platform_code']
                ];

                if ($row['local_status'] === 'BEKLIYOR') {
                    $pendingCount++;
                }
            }
        } catch (Exception $e) {
            error_log("Online orders listeleme hatası: " . $e->getMessage());
        }
    }

    echo json_encode([
        'success' => true,
        'orders' => $orders,
        'count' => count($orders),
        'pendingCount' => $pendingCount,
        'hiddenCount' => $hiddenCount,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Geçersiz orders aksiyonu']);
