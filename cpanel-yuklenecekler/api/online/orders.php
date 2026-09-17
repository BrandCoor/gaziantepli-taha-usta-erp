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

// 0. BASİT AÇIK/KAPALI DURUMU OKU (Kasa açılışında senkronize etmek için)
if ($action === 'get_platform_store_status') {
    $platformStoreStatus = [
        'TRENDYOL' => ['isOpen' => true],
        'GETIR' => ['isOpen' => true],
        'YEMEKSEPETI' => ['isOpen' => true],
    ];

    if ($pdo) {
        try {
            $rows = $pdo->query("SELECT `platform_code`, `store_status` FROM `online_platforms`")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $row) {
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
if ($action === 'list' || $action === 'get_orders' || $action === 'get_online_orders' || $action === 'list_online_orders') {
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

// 3. SİPARİŞ TEST ENJEKSİYONU (Manuel / Test Amaçlı)
if ($action === 'create_test_order' || $action === 'create_test_online_order') {
    $rawPayload = file_get_contents('php://input');
    $data = json_decode($rawPayload, true) ?: [];

    $platformCode = $data['platform'] ?? 'TRENDYOL';
    $customerName = $data['customerName'] ?? 'Mehmet Taha Gümüş';
    $customerPhone = $data['customerPhone'] ?? '0532 555 1234';
    $deliveryAddress = $data['address'] ?? 'Fenerbahçe Mah. Bağdat Cad. No: 184 D: 5 Kadıköy/İstanbul';
    $orderNote = $data['orderNote'] ?? 'Lütfen acılı ezme ve sıcak pide bol olsun. Zili çalmayın bebek uyuyor.';
    $items = $data['items'] ?? [
        ['name' => 'Antep Usulü Özel Lahmacun', 'quantity' => 4, 'price' => 110, 'note' => 'Çıtır olsun'],
        ['name' => 'Küşleme Kebap Porsiyon', 'quantity' => 1, 'price' => 420, 'note' => 'Orta pişmiş'],
        ['name' => 'Fıstıklı Havuç Dilim Baklava', 'quantity' => 1, 'price' => 240, 'note' => 'Kaymaklı']
    ];
    $totalAmount = 0;
    foreach ($items as $it) {
        $totalAmount += ($it['quantity'] * $it['price']);
    }

    $platformOrderId = 'TEST-' . strtoupper(substr($platformCode, 0, 2)) . '-' . rand(10000, 99999);
    $itemsJson = json_encode($items, JSON_UNESCAPED_UNICODE);

    $insertId = null;
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO `online_orders` (
                    `platform_code`, `platform_order_id`, `customer_name`, `customer_phone`,
                    `delivery_address`, `order_note`, `items_json`, `total_amount`,
                    `payment_method`, `platform_status`, `local_status`, `created_at`
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, 'Online Kredi Kartı', 'NEW', 'BEKLIYOR', NOW()
                )
            ");
            $stmt->execute([
                $platformCode, $platformOrderId, $customerName, $customerPhone,
                $deliveryAddress, $orderNote, $itemsJson, $totalAmount
            ]);
            $insertId = $pdo->lastInsertId();
        } catch (Exception $e) {
            error_log("Test order oluşturma hatası: " . $e->getMessage());
        }
    }

    echo json_encode([
        'success' => true,
        'message' => "Test siparişi [{$platformCode}] başarıyla oluşturuldu.",
        'orderId' => $insertId ?: ('test-' . time()),
        'platformOrderId' => $platformOrderId,
        'totalAmount' => $totalAmount
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['success' => false, 'error' => 'Geçersiz orders aksiyonu']);
