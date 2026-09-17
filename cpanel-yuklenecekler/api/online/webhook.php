<?php
/**
 * GAZİANTEPLİ TAHA USTA ERP - Online Yemek Platformları Webhook Alıcısı
 * -------------------------------------------------------------------------
 * Yemeksepeti / Delivery Hero, Trendyol Yemek ve GetirYemek platformlarından
 * gelen anlık sipariş bildirimlerini güvenli şekilde karşılar ve MySQL'e kaydeder.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Signature, X-Platform, X-Api-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

$pdo = getDbConnection();
if ($pdo) {
    ensureDatabaseTables($pdo);
}

// 1. Platformu Belirle (Query string, Header veya Payload)
$platformParam = isset($_GET['platform']) ? strtoupper(trim($_GET['platform'])) : '';
if (empty($platformParam)) {
    $platformHeader = isset($_SERVER['HTTP_X_PLATFORM']) ? strtoupper(trim($_SERVER['HTTP_X_PLATFORM'])) : '';
    if (!empty($platformHeader)) {
        $platformParam = $platformHeader;
    }
}

// Ham Payload Oku
$rawPayload = file_get_contents('php://input');
$data = json_decode($rawPayload, true) ?: [];

// Eğer query parametresinde platform yoksa payload yapısından tespit et
if (empty($platformParam)) {
    if (isset($data['supplierId']) || isset($data['packageId']) || isset($data['orderNumber'])) {
        $platformParam = 'TRENDYOL';
    } elseif (isset($data['restaurantId']) && (isset($data['confirmationId']) || isset($data['clientOrderId']))) {
        $platformParam = 'GETIR';
    } elseif (isset($data['vendorId']) || isset($data['chainCode']) || isset($data['deliveryHeroOrderId'])) {
        $platformParam = 'YEMEKSEPETI';
    } else {
        $platformParam = 'TRENDYOL'; // Varsayılan
    }
}

// Normalize platform kodu
if (strpos($platformParam, 'TREND') !== false) {
    $platformCode = 'TRENDYOL';
} elseif (strpos($platformParam, 'GETIR') !== false) {
    $platformCode = 'GETIR';
} else {
    $platformCode = 'YEMEKSEPETI';
}

// 2. Güvenlik & İmza Doğrulama (HMAC / Secret Key)
$platformConfig = null;
if ($pdo) {
    try {
        $stmt = $pdo->prepare("SELECT * FROM `online_platforms` WHERE `platform_code` = ? LIMIT 1");
        $stmt->execute([$platformCode]);
        $platformConfig = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {}
}

$webhookSecret = !empty($platformConfig['webhook_secret']) ? $platformConfig['webhook_secret'] : '';
$incomingSignature = $_SERVER['HTTP_X_SIGNATURE'] ?? $_SERVER['HTTP_X_HMAC_SIGNATURE'] ?? '';

if (!empty($webhookSecret) && !empty($incomingSignature)) {
    $calculatedSignature = hash_hmac('sha256', $rawPayload, $webhookSecret);
    if (!hash_equals($calculatedSignature, $incomingSignature)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Geçersiz webhook imzası (Signature mismatch)']);
        exit;
    }
}

// 3. Platforma Özgü Alanları Standart Formata Ayrıştır
$platformOrderId = '';
$customerName = 'Bilinmeyen Müşteri';
$customerPhone = '';
$deliveryAddress = 'Adres Belirtilmedi';
$orderNote = '';
$items = [];
$totalAmount = 0.00;
$paymentMethod = 'ONLINE';
$platformStatus = 'NEW';

if ($platformCode === 'TRENDYOL') {
    $platformOrderId = strval($data['orderNumber'] ?? $data['packageId'] ?? $data['id'] ?? ('TY-' . time()));
    $customerName = trim(($data['customer']['firstName'] ?? '') . ' ' . ($data['customer']['lastName'] ?? ''));
    if (empty($customerName)) $customerName = $data['customerName'] ?? 'Trendyol Müşterisi';
    $customerPhone = $data['customer']['phone'] ?? $data['customerPhone'] ?? '';
    
    // Adres
    if (isset($data['shipmentAddress'])) {
        $deliveryAddress = ($data['shipmentAddress']['addressText'] ?? '') . ' ' . ($data['shipmentAddress']['district'] ?? '') . '/' . ($data['shipmentAddress']['city'] ?? '');
    } else {
        $deliveryAddress = $data['address'] ?? 'Trendyol Teslimat Adresi';
    }
    
    $orderNote = $data['notes'] ?? $data['orderNote'] ?? '';
    $totalAmount = floatval($data['totalPrice'] ?? $data['grossAmount'] ?? $data['totalAmount'] ?? 0);
    $paymentMethod = $data['paymentType'] ?? 'Online Kredi Kartı';
    $platformStatus = $data['status'] ?? 'Created';

    if (isset($data['lines']) && is_array($data['lines'])) {
        foreach ($data['lines'] as $line) {
            $items[] = [
                'name' => $line['productName'] ?? $line['name'] ?? 'Ürün',
                'quantity' => intval($line['quantity'] ?? 1),
                'price' => floatval($line['price'] ?? $line['amount'] ?? 0),
                'note' => $line['notes'] ?? '',
                'options' => $line['options'] ?? []
            ];
        }
    }
} elseif ($platformCode === 'GETIR') {
    $platformOrderId = strval($data['clientOrderId'] ?? $data['id'] ?? ('GTR-' . time()));
    $customerName = $data['client']['name'] ?? $data['customerName'] ?? 'Getir Müşterisi';
    $customerPhone = $data['client']['phone'] ?? $data['customerPhone'] ?? '';
    $deliveryAddress = $data['client']['deliveryAddress']['address'] ?? $data['deliveryAddress'] ?? 'Getir Teslimat Adresi';
    $orderNote = $data['clientNote'] ?? $data['orderNote'] ?? '';
    $totalAmount = floatval($data['totalPrice'] ?? $data['totalAmount'] ?? 0);
    $paymentMethod = $data['paymentMethodText'] ?? 'Getir Online Ödeme';
    $platformStatus = $data['status'] ?? 'WAITING_FOR_VERIFICATION';

    if (isset($data['products']) && is_array($data['products'])) {
        foreach ($data['products'] as $prod) {
            $items[] = [
                'name' => $prod['name'] ?? 'Ürün',
                'quantity' => intval($prod['count'] ?? 1),
                'price' => floatval($prod['price'] ?? 0),
                'note' => $prod['note'] ?? '',
                'options' => $prod['options'] ?? []
            ];
        }
    }
} else { // YEMEKSEPETI
    $platformOrderId = strval($data['orderId'] ?? $data['code'] ?? $data['id'] ?? ('YS-' . time()));
    $customerName = trim(($data['customer']['firstName'] ?? '') . ' ' . ($data['customer']['lastName'] ?? ''));
    if (empty($customerName)) $customerName = $data['customerName'] ?? 'Yemeksepeti Müşterisi';
    $customerPhone = $data['customer']['mobilePhone'] ?? $data['customerPhone'] ?? '';
    $deliveryAddress = $data['delivery']['address']['street'] ?? $data['deliveryAddress'] ?? 'Yemeksepeti Teslimat Adresi';
    $orderNote = $data['notes'] ?? $data['orderNote'] ?? '';
    $totalAmount = floatval($data['price'] ?? $data['totalPrice'] ?? $data['totalAmount'] ?? 0);
    $paymentMethod = $data['payment']['type'] ?? 'Yemeksepeti Online Ödeme';
    $platformStatus = $data['status'] ?? 'NEW';

    if (isset($data['products']) && is_array($data['products'])) {
        foreach ($data['products'] as $prod) {
            $items[] = [
                'name' => $prod['name'] ?? 'Ürün',
                'quantity' => intval($prod['quantity'] ?? 1),
                'price' => floatval($prod['unitPrice'] ?? $prod['price'] ?? 0),
                'note' => $prod['instructions'] ?? '',
                'options' => $prod['selectedOptions'] ?? []
            ];
        }
    }
}

// Fallback: Kalemler boşsa ham veriden dene
if (empty($items) && isset($data['items']) && is_array($data['items'])) {
    $items = $data['items'];
}

$itemsJson = json_encode($items, JSON_UNESCAPED_UNICODE);

// 4. MySQL'e Kaydet (online_orders tablosu)
$savedToDb = false;
$orderDbId = null;

if ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO `online_orders` (
                `platform_code`, `platform_order_id`, `customer_name`, `customer_phone`,
                `delivery_address`, `order_note`, `items_json`, `total_amount`,
                `payment_method`, `platform_status`, `local_status`, `created_at`
            ) VALUES (
                :platform_code, :platform_order_id, :customer_name, :customer_phone,
                :delivery_address, :order_note, :items_json, :total_amount,
                :payment_method, :platform_status, 'BEKLIYOR', NOW()
            )
            ON DUPLICATE KEY UPDATE
                `customer_name` = VALUES(`customer_name`),
                `customer_phone` = VALUES(`customer_phone`),
                `delivery_address` = VALUES(`delivery_address`),
                `order_note` = VALUES(`order_note`),
                `items_json` = VALUES(`items_json`),
                `total_amount` = VALUES(`total_amount`),
                `platform_status` = VALUES(`platform_status`),
                `updated_at` = NOW()
        ");

        $stmt->execute([
            ':platform_code' => $platformCode,
            ':platform_order_id' => $platformOrderId,
            ':customer_name' => $customerName,
            ':customer_phone' => $customerPhone,
            ':delivery_address' => $deliveryAddress,
            ':order_note' => $orderNote,
            ':items_json' => $itemsJson,
            ':total_amount' => $totalAmount,
            ':payment_method' => $paymentMethod,
            ':platform_status' => $platformStatus
        ]);

        $orderDbId = $pdo->lastInsertId();
        $savedToDb = true;
    } catch (Exception $e) {
        error_log("Online order DB kayıt hatası: " . $e->getMessage());
    }
}

// Yedek Dosya Kuyruğu (Offline veya DB erişim sorunlarına karşı tam garanti)
$queueFile = __DIR__ . '/online_orders_queue.json';
$queue = [];
if (file_exists($queueFile)) {
    $queue = json_decode(file_get_contents($queueFile), true) ?: [];
}
$orderObject = [
    'id' => $orderDbId ? strval($orderDbId) : ('onl-' . time() . '-' . rand(100, 999)),
    'platform' => $platformCode,
    'platform_order_id' => $platformOrderId,
    'customer_name' => $customerName,
    'customer_phone' => $customerPhone,
    'delivery_address' => $deliveryAddress,
    'order_note' => $orderNote,
    'items' => $items,
    'total_amount' => $totalAmount,
    'payment_method' => $paymentMethod,
    'platform_status' => $platformStatus,
    'local_status' => 'BEKLIYOR',
    'created_at' => date('Y-m-d H:i:s')
];
array_unshift($queue, $orderObject);
$queue = array_slice($queue, 0, 200);
@file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// Platforma HTTP 200 Başarılı Yanıtı
echo json_encode([
    'success' => true,
    'message' => 'Sipariş başarıyla kabul edildi ve kasa kuyruğuna alındı.',
    'platform' => $platformCode,
    'platformOrderId' => $platformOrderId,
    'dbSaved' => $savedToDb,
    'localStatus' => 'BEKLIYOR',
    'timestamp' => date('c')
], JSON_UNESCAPED_UNICODE);
