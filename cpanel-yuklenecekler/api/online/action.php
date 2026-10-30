<?php
/**
 * Online platform işlemleri (YALNIZCA kasa): onay/ret/yolda/teslim, ayar kaydı, GERÇEK bağlantı testi,
 * sipariş çekme (polling), tanı günlüğü.
 *
 * Dürüstlük kuralı: platforma iletilemeyen/otomatik olmayan işlem "başarılı" gösterilmez;
 * yanıtta `platformSync` = OK | FAILED | MANUAL ve açıklaması döner.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Platform, X-Kasa-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../security.php';
require_once __DIR__ . '/lib.php';
if (!sec_is_kasa()) { sec_json_exit(401, ['success' => false, 'error' => 'Yetkisiz istek.', 'code' => 'UNAUTHORIZED']); }

$pdo = getDbConnection();
if (!$pdo) { sec_json_exit(503, ['success' => false, 'error' => 'Veritabanı yapılandırılmamış.']); }
ensureDatabaseTables($pdo);

$raw = file_get_contents('php://input');
$body = json_decode($raw, true) ?: [];
$action = $_GET['action'] ?? $body['action'] ?? '';

function out(array $a, int $code = 200): void { http_response_code($code); echo json_encode($a, JSON_UNESCAPED_UNICODE); exit; }
function plat(array $body): string { return strtoupper(trim((string)($body['platform'] ?? ''))); }

/* ---------------- 1-4. SİPARİŞ İŞLEMLERİ ---------------- */
$orderActions = [
    'accept_order' => 'accept', 'accept_online_order' => 'accept',
    'reject_order' => 'reject', 'cancel_order' => 'reject', 'reject_online_order' => 'reject', 'cancel_online_order' => 'reject',
    'dispatch_order' => 'dispatch', 'dispatch_online_order' => 'dispatch',
    'deliver_order' => 'deliver', 'deliver_online_order' => 'deliver',
];
if (isset($orderActions[$action])) {
    $op = $orderActions[$action];
    $orderId = (string)($body['orderId'] ?? $body['id'] ?? '');
    if ($orderId === '') { out(['success' => false, 'error' => 'Sipariş ID belirtilmedi.'], 400); }
    $order = op_find_order($pdo, $orderId);
    if (!$order) { out(['success' => false, 'error' => 'Sipariş bulunamadı.'], 404); }

    $reason = trim((string)($body['cancelReason'] ?? $body['reason'] ?? ''));
    if ($op === 'reject' && $reason === '') { $reason = 'Restoran tarafından iptal edildi'; }

    // 1) Platforma ilet (gerçek HTTP) — sonuç dürüstçe raporlanır
    $sync = op_platform_action($pdo, $order, $op, ['reason' => $reason]);
    op_set_sync($pdo, (int)$order['id'], $sync['status'], $sync['message']);

    // 2) Yerel durum
    $map = [
        'accept' => ['HAZIRLANIYOR', 'PREPARING'], 'dispatch' => ['YOLA_CIKTI', 'DISPATCHED'],
        'deliver' => ['TESLIM_EDILDI', 'DELIVERED'], 'reject' => ['IPTAL', 'REJECTED'],
    ];
    [$local, $platformStatus] = $map[$op];
    $sql = "UPDATE `online_orders` SET `local_status` = ?, `platform_status` = ?";
    $params = [$local, $platformStatus];
    if ($op === 'reject') { $sql .= ", `cancel_reason` = ?"; $params[] = mb_substr($reason, 0, 250); }
    if ($op === 'accept') {
        foreach (['assignedCourierId' => 'assigned_courier_id', 'deliveryModel' => 'delivery_model', 'handoverCode' => 'handover_code'] as $k => $col) {
            if (!empty($body[$k])) { $sql .= ", `{$col}` = ?"; $params[] = (string)$body[$k]; }
        }
    }
    $sql .= " WHERE `id` = ?";
    $params[] = $order['id'];
    $pdo->prepare($sql)->execute($params);

    $labels = ['accept' => 'onaylandı', 'reject' => 'iptal edildi', 'dispatch' => 'yola çıktı olarak işaretlendi', 'deliver' => 'teslim edildi olarak kapatıldı'];
    $resp = [
        'success' => true,
        'message' => "Sipariş (#{$order['platform_order_id']}) {$labels[$op]}.",
        'newStatus' => $local,
        'platformSync' => $sync['status'],
        'platformSyncMessage' => $sync['message'],
    ];
    if ($op === 'accept') {
        // Mutfak fişi için kalemler (yazıcı yönlendirmesi kasada, ürün/kategori eşlemesiyle yapılır)
        $items = json_decode($order['items_json'] ?? '[]', true) ?: [];
        $resp['printJobs'] = ['kurye' => $items, 'items' => $items];
        $resp['customerName'] = $order['customer_name'];
        $resp['address'] = $order['delivery_address'];
        $resp['totalAmount'] = (float)$order['total_amount'];
    }
    out($resp);
}

/* ---------------- 5. MAĞAZA DURUMU ---------------- */
if ($action === 'update_store_status' || $action === 'update_online_store_status' || $action === 'update_platform_store_status') {
    $code = plat($body) ?: 'ALL';
    if ($action === 'update_platform_store_status') { $status = !empty($body['isOpen']) ? 'OPEN' : 'CLOSED'; }
    else { $status = strtoupper(trim((string)($body['status'] ?? 'OPEN'))); if (!in_array($status, ['OPEN', 'BUSY', 'CLOSED'], true)) { $status = 'OPEN'; } }
    $targets = $code === 'ALL' ? OP_PLATFORMS : [$code];
    $results = [];
    foreach ($targets as $t) {
        if (!in_array($t, OP_PLATFORMS, true)) continue;
        $pdo->prepare("UPDATE `online_platforms` SET `store_status` = ? WHERE `platform_code` = ?")->execute([$status, $t]);
        $row = op_platform($pdo, $t);
        $res = ['platform' => $t, 'sync' => 'MANUAL', 'message' => 'Kasa kaydı güncellendi; platformun mağaza durumu otomatik değiştirilmedi — platform panelinden de açıp kapatın.'];
        if ($t === 'YEMEKSEPETI' && !empty($row['is_enabled']) && op_str($row['creds']['chainId'] ?? '') !== '' && op_str($row['creds']['vendorId'] ?? '') !== '') {
            $tk = op_ys_token($row);
            if ($tk['ok']) {
                $url = 'https://yemeksepeti.partner.deliveryhero.io/v2/chains/' . rawurlencode($row['creds']['chainId']) . '/vendors/' . rawurlencode($row['creds']['vendorId']) . '/status';
                $payload = $status === 'CLOSED' ? ['status' => 'CLOSED_TODAY', 'closed_reason' => 'TOO_BUSY_KITCHEN'] : ['status' => 'OPEN'];
                $r = op_http('PUT', $url, ['Authorization' => 'Bearer ' . $tk['token'], 'Content-Type' => 'application/json'], $payload);
                $res = ['platform' => $t, 'sync' => $r['ok'] ? 'OK' : 'FAILED', 'message' => $r['ok'] ? 'Yemeksepeti mağaza durumu güncellendi.' : ('Yemeksepeti: ' . op_brief($r))];
            } else { $res = ['platform' => $t, 'sync' => 'FAILED', 'message' => $tk['message']]; }
        }
        $results[] = $res;
    }
    out(['success' => true, 'platform' => $code, 'storeStatus' => $status, 'isOpen' => $status !== 'CLOSED', 'results' => $results,
        'message' => 'Mağaza durumu kaydedildi: ' . implode(' | ', array_map(fn($r) => $r['platform'] . ': ' . $r['message'], $results))]);
}

/* ---------------- 6-7. AYARLAR ---------------- */
if ($action === 'toggle_platform' || $action === 'toggle_online_platform') {
    $code = plat($body);
    if (!in_array($code, OP_PLATFORMS, true)) { out(['success' => false, 'error' => 'Geçersiz platform.'], 400); }
    $en = !empty($body['isEnabled']) ? 1 : 0;
    $pdo->prepare("UPDATE `online_platforms` SET `is_enabled` = ? WHERE `platform_code` = ?")->execute([$en, $code]);
    out(['success' => true, 'platform' => $code, 'isEnabled' => $en, 'message' => "Platform ({$code}) " . ($en ? 'AKTİF' : 'PASİF') . ' yapıldı.']);
}

if ($action === 'save_platform_config' || $action === 'save_online_platform_config') {
    $code = plat($body);
    if (!in_array($code, OP_PLATFORMS, true)) { out(['success' => false, 'error' => 'Geçersiz platform.'], 400); }
    $creds = is_array($body['credentials'] ?? null) ? $body['credentials'] : [];
    $sets = ["`credentials_json` = :creds"];
    $params = [':creds' => json_encode($creds, JSON_UNESCAPED_UNICODE), ':p' => $code];
    if (isset($body['webhookSecret'])) { $sets[] = "`webhook_secret` = :sec"; $params[':sec'] = mb_substr((string)$body['webhookSecret'], 0, 100); }
    if (isset($body['isEnabled'])) { $sets[] = "`is_enabled` = :en"; $params[':en'] = $body['isEnabled'] ? 1 : 0; }
    if (isset($body['storeStatus']) && in_array($body['storeStatus'], ['OPEN', 'BUSY', 'CLOSED'], true)) { $sets[] = "`store_status` = :ss"; $params[':ss'] = $body['storeStatus']; }
    if (isset($body['deliveryModel']) && in_array($body['deliveryModel'], ['RESTAURANT_COURIER', 'PLATFORM_COURIER'], true)) { $sets[] = "`delivery_model` = :dm"; $params[':dm'] = $body['deliveryModel']; }
    // Anahtarlar değiştiyse önbellekteki oturum anahtarı geçersiz sayılır
    $sets[] = "`token_cache` = NULL"; $sets[] = "`token_expires_at` = NULL";
    $st = $pdo->prepare("UPDATE `online_platforms` SET " . implode(', ', $sets) . " WHERE `platform_code` = :p");
    $st->execute($params);
    out(['success' => true, 'platform' => $code, 'message' => "Platform ({$code}) ayarları sunucuya kaydedildi. (Kaydetmek bağlantıyı DOĞRULAMAZ — 'Bağlantıyı Test Et' kullanın.)"]);
}

if ($action === 'update_delivery_model') {
    $code = plat($body);
    $model = strtoupper(trim((string)($body['deliveryModel'] ?? $body['model'] ?? 'RESTAURANT_COURIER')));
    if (!in_array($code, OP_PLATFORMS, true) || !in_array($model, ['RESTAURANT_COURIER', 'PLATFORM_COURIER'], true)) { out(['success' => false, 'error' => 'Geçersiz istek.'], 400); }
    $pdo->prepare("UPDATE `online_platforms` SET `delivery_model` = ? WHERE `platform_code` = ?")->execute([$model, $code]);
    out(['success' => true, 'platform' => $code, 'deliveryModel' => $model, 'message' => "{$code} teslimat modeli güncellendi."]);
}

if ($action === 'assign_courier') {
    $orderId = (string)($body['orderId'] ?? $body['id'] ?? '');
    $courierId = (string)($body['courierId'] ?? $body['assignedCourierId'] ?? '');
    if ($orderId === '' || $courierId === '') { out(['success' => false, 'error' => 'Sipariş veya kurye eksik.'], 400); }
    $order = op_find_order($pdo, $orderId);
    if (!$order) { out(['success' => false, 'error' => 'Sipariş bulunamadı.'], 404); }
    $pdo->prepare("UPDATE `online_orders` SET `assigned_courier_id` = ?, `assigned_courier_name` = ? WHERE `id` = ?")->execute([$courierId, (string)($body['courierName'] ?? ''), $order['id']]);
    out(['success' => true, 'orderId' => $orderId, 'courierId' => $courierId, 'message' => 'Kurye atandı.']);
}

/* ---------------- 8. GERÇEK BAĞLANTI TESTİ ---------------- */
if ($action === 'test_connection' || $action === 'test_online_connection') {
    $code = plat($body);
    if (!in_array($code, OP_PLATFORMS, true)) { out(['success' => false, 'error' => 'Geçersiz platform.'], 400); }
    $row = op_platform($pdo, $code);
    // Henüz kaydedilmemiş alanlar test isteğiyle gelebilir
    if (is_array($body['credentials'] ?? null) && $body['credentials']) { $row['creds'] = array_merge($row['creds'], $body['credentials']); }

    $lines = [];
    $verified = false;
    if ($code === 'GETIR') {
        $t = op_getir_token($pdo, $row, true);
        if (!$t['ok']) { out(['success' => false, 'verified' => false, 'platform' => $code, 'message' => $t['message']]); }
        $r = op_getir_call($pdo, $row, 'GET', '/food-orders/active');
        if ($r['ok']) { $verified = true; $lines[] = 'Getir girişi başarılı ve aktif sipariş sorgusu çalışıyor (HTTP ' . $r['status'] . ').'; }
        else { $lines[] = 'Getir girişi başarılı ancak aktif sipariş sorgusu başarısız: ' . op_brief($r); }
    } elseif ($code === 'YEMEKSEPETI') {
        $t = op_ys_token($row);
        if (!$t['ok']) { out(['success' => false, 'verified' => false, 'platform' => $code, 'message' => $t['message']]); }
        $verified = true; $lines[] = 'Yemeksepeti OAuth kimlik doğrulaması başarılı (client_id/client_secret geçerli).';
    } else { // TRENDYOL
        $c = $row['creds'];
        $url = op_str($c['ordersUrl'] ?? '');
        if ($url === '') {
            out(['success' => false, 'verified' => false, 'platform' => $code,
                'message' => 'Trendyol anahtarları kaydedildi ancak DOĞRULANAMADI: "Sipariş okuma adresi" tanımlı değil. Trendyol dokümanındaki paket/sipariş listeleme adresini "Gelişmiş adresler"e girip tekrar test edin.']);
        }
        $url = op_tpl($url, ['supplierId' => op_str($c['supplierId'] ?? '')]);
        $r = op_http('GET', $url, op_ty_headers($c));
        if (!$r['ok']) { out(['success' => false, 'verified' => false, 'platform' => $code, 'message' => 'Trendyol yanıtı: ' . op_brief($r)]); }
        $verified = true; $lines[] = 'Trendyol sipariş sorgusu başarılı (HTTP ' . $r['status'] . ').';
    }

    $hook = '';
    if (!empty($row['last_webhook_at'])) { $hook = ' Son webhook: ' . $row['last_webhook_at'] . '.'; }
    elseif (empty($row['secret'])) { $hook = ' UYARI: Webhook gizli anahtarı yok.'; }
    else { $hook = ' Henüz bu platformdan webhook GELMEDİ (adresi platforma kaydettiniz mi?).'; }
    out(['success' => $verified, 'verified' => $verified, 'platform' => $code, 'message' => implode(' ', $lines) . $hook, 'timestamp' => date('c')]);
}

/* ---------------- 9. SİPARİŞ ÇEKME (kasa belirli aralıkla çağırır) ---------------- */
if ($action === 'poll_online_orders') {
    out(['success' => true, 'results' => op_poll_all($pdo), 'timestamp' => date('c')]);
}

/* ---------------- 10. TANI ---------------- */
if ($action === 'get_online_diagnostics') {
    $platforms = [];
    foreach (OP_PLATFORMS as $code) {
        $row = op_platform($pdo, $code);
        $cnt = $pdo->prepare("SELECT COUNT(*) FROM `online_orders` WHERE `platform_code` = ?"); $cnt->execute([$code]);
        $platforms[] = [
            'platform' => $code, 'enabled' => (bool)$row['is_enabled'], 'hasSecret' => strlen($row['secret']) >= 8,
            'configured' => !empty($row['creds']), 'lastWebhookAt' => $row['last_webhook_at'] ?? null, 'orderCount' => (int)$cnt->fetchColumn(),
        ];
    }
    $hidden = (int)$pdo->query("SELECT COUNT(*) FROM `online_orders` WHERE `platform_code` IN (SELECT `platform_code` FROM `online_platforms` WHERE `is_enabled` = 0)")->fetchColumn();
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 40)));
    $log = $pdo->query("SELECT `id`, `created_at`, `platform`, `source`, `result`, `http_code`, `reason`, `header_names`, `order_ref`, LEFT(`body_sample`, 4000) AS body_sample FROM `online_webhook_log` ORDER BY `id` DESC LIMIT {$limit}")->fetchAll(PDO::FETCH_ASSOC);
    out(['success' => true, 'platforms' => $platforms, 'hiddenOrders' => $hidden, 'log' => $log]);
}

out(['success' => false, 'error' => 'Geçersiz action parametresi'], 400);
