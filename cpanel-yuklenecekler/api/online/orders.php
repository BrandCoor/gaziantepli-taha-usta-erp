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

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';

// 1. PLATFORM LİSTESİ VE DURUMLARI (GET_PLATFORMS)
if ($action === 'get_platforms') {
    $platforms = [];
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT `id`, `platform_code`, `display_name`, `is_enabled`, `store_status`, `delivery_model`, `credentials_json`, `webhook_secret`, `updated_at` FROM `online_platforms` ORDER BY `id` ASC");
            $platforms = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {}
    }

    if (empty($platforms)) {
        // Fallback varsayılan kayıtlar
        $platforms = [
            ['platform_code' => 'YEMEKSEPETI', 'display_name' => 'Yemeksepeti', 'is_enabled' => 0, 'store_status' => 'CLOSED', 'delivery_model' => 'RESTAURANT_COURIER'],
            ['platform_code' => 'TRENDYOL', 'display_name' => 'Trendyol Yemek', 'is_enabled' => 0, 'store_status' => 'CLOSED', 'delivery_model' => 'RESTAURANT_COURIER'],
            ['platform_code' => 'GETIR', 'display_name' => 'GetirYemek', 'is_enabled' => 0, 'store_status' => 'CLOSED', 'delivery_model' => 'RESTAURANT_COURIER']
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
if ($action === 'list' || $action === 'get_orders') {
    $statusFilter = $_GET['status'] ?? 'ACTIVE'; // ACTIVE, ALL, HISTORY, BEKLIYOR vb.
    $platformFilter = $_GET['platform'] ?? 'ALL'; // ALL, YEMEKSEPETI, TRENDYOL, GETIR
    $orders = [];
    $pendingCount = 0;

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
                    'handoverCode' => $row['handover_code'] ?? null
                ];

                if ($row['local_status'] === 'BEKLIYOR') {
                    $pendingCount++;
                }
            }
        } catch (Exception $e) {
            error_log("Online orders listeleme hatası: " . $e->getMessage());
        }
    }

    // Eğer DB yoksa veya boştaysa dosya kuyruğundan oku
    if (empty($orders)) {
        $queueFile = __DIR__ . '/online_orders_queue.json';
        if (file_exists($queueFile)) {
            $queue = json_decode(file_get_contents($queueFile), true) ?: [];
            foreach ($queue as $q) {
                $orders[] = [
                    'id' => strval($q['id'] ?? ('onl-' . rand(100, 999))),
                    'platform' => $q['platform'] ?? 'TRENDYOL',
                    'platformCode' => $q['platform'] ?? 'TRENDYOL',
                    'platformOrderId' => $q['platform_order_id'] ?? ('ORD-' . rand(1000, 9999)),
                    'customerName' => $q['customer_name'] ?? 'Müşteri',
                    'customerPhone' => $q['customer_phone'] ?? '',
                    'address' => $q['delivery_address'] ?? 'Adres',
                    'orderNote' => $q['order_note'] ?? '',
                    'items' => $q['items'] ?? [],
                    'totalAmount' => floatval($q['total_amount'] ?? 0),
                    'paymentMethod' => $q['payment_method'] ?? 'Online',
                    'platformStatus' => $q['platform_status'] ?? 'NEW',
                    'status' => $q['local_status'] ?? 'BEKLIYOR',
                    'cancelReason' => $q['cancel_reason'] ?? '',
                    'createdAt' => $q['created_at'] ?? date('Y-m-d H:i:s'),
                    'deliveryModel' => 'RESTAURANT'
                ];
                if (($q['local_status'] ?? '') === 'BEKLIYOR') {
                    $pendingCount++;
                }
            }
        }
    }

    echo json_encode([
        'success' => true,
        'orders' => $orders,
        'count' => count($orders),
        'pendingCount' => $pendingCount,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// NOT: "create_test_order" (sahte siparis enjeksiyonu) KALDIRILDI.
// Bu ucu bilen herkes isletmenin canli siparis tablosuna uydurma siparis
// yazabiliyordu; ustelik kayitlarda isletme sahibinin gercek ad/adres
// bilgileri sabit olarak duruyordu. Siparisler artik yalnizca platform
// webhook'lari uzerinden olusur.

echo json_encode(['success' => false, 'error' => 'Geçersiz orders aksiyonu']);
