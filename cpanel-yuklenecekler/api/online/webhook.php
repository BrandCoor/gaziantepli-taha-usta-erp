<?php
/**
 * Online platform webhook alıcısı (Yemeksepeti Partner API / Trendyol Go Yemek).
 *
 * Yemeksepeti: Partner Portal'da "sipariş bildirimi (webhook)" adresi olarak şunu kaydedin:
 *     https://<api>/online/webhook.php?platform=YEMEKSEPETI
 *   Portal'daki "statik token" alanına Ayarlar'daki Webhook Gizli Anahtarını yazın (Authorization başlığı veya x-api-key olarak gelir).
 * Trendyol Go: sipariş çekme (polling) varsayılandır; webhook kayıtlıysa:
 *     https://<api>/online/webhook.php?platform=TRENDYOL
 *
 * Her çağrı (kabul/ret) `online_webhook_log` tablosuna yazılır.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Api-Key, X-Signature, X-Platform, X-Webhook-Secret, Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/lib.php';

$pdo = getDbConnection();
if (!$pdo) { http_response_code(503); echo json_encode(['success' => false, 'error' => 'Veritabanı yok']); exit; }
ensureDatabaseTables($pdo);

// Adres doğrulama/ping istekleri (bazı platformlar kayıt sırasında GET/HEAD atar)
if ($method === 'GET' || $method === 'HEAD') {
    echo json_encode(['success' => true, 'service' => 'online-webhook', 'time' => date('c')]);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$headers = op_headers_lower();
$headerNames = array_keys($headers);
$data = json_decode($raw, true);
if (!is_array($data)) {
    $form = [];
    parse_str($raw, $form);
    $data = is_array($form) && $form ? $form : [];
}

/* ---------- platform tespiti ---------- */
$platform = strtoupper(trim((string)($_GET['platform'] ?? '')));
if ($platform === '' && !empty($headers['x-platform'])) { $platform = strtoupper(trim($headers['x-platform'])); }
if (strpos($platform, 'TREND') !== false || strpos($platform, 'GETIR') !== false) { $platform = 'TRENDYOL'; } // GetirYemek siparişleri Trendyol üzerinden gelir
elseif (strpos($platform, 'YEMEK') !== false || strpos($platform, 'YS') === 0) { $platform = 'YEMEKSEPETI'; }
if (!in_array($platform, OP_PLATFORMS, true)) {
    op_log($pdo, 'BILINMIYOR', 'WEBHOOK', 'REJECTED', 400, 'Platform belirlenemedi (adreste ?platform= yok)', $headerNames, $raw);
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Platform belirlenemedi']);
    exit;
}

$row = op_platform($pdo, $platform);
$secret = $row['secret'];

/* ---------- kimlik doğrulama (platforma özgü) ---------- */
$given = [];
$auth = $headers['authorization'] ?? '';
if ($auth !== '') {
    $given[] = $auth;
    if (stripos($auth, 'bearer ') === 0) { $given[] = trim(substr($auth, 7)); }
    if (stripos($auth, 'basic ') === 0) { $given[] = trim(substr($auth, 6)); $dec = base64_decode(trim(substr($auth, 6)), true); if ($dec !== false) { $given[] = $dec; $given[] = ltrim(strstr($dec, ':') ?: '', ':'); } }
}
foreach (['x-api-key', 'x-webhook-secret', 'x-secret', 'x-webhook-token', 'token', 'apikey', 'api-key'] as $h) { if (!empty($headers[$h])) { $given[] = $headers[$h]; } }
foreach (['secret', 'key', 'token', 'apikey', 'api_key'] as $q) { if (!empty($_GET[$q])) { $given[] = (string)$_GET[$q]; } }
// Eski HMAC imza düzeni (geri uyumluluk)
$sigOk = false;
$sig = $headers['x-signature'] ?? ($headers['x-hmac-signature'] ?? '');
if ($secret !== '' && $sig !== '') { $sigOk = hash_equals(hash_hmac('sha256', $raw, $secret), $sig); }

$authOk = $sigOk;
foreach ($given as $g) { if (op_secret_equals($secret, (string)$g)) { $authOk = true; break; } }

if (strlen($secret) < 8) {
    op_log($pdo, $platform, 'WEBHOOK', 'REJECTED', 403, 'Bu platform için Webhook Gizli Anahtarı kaydedilmemiş (Ayarlar › Yemek Platformları)', $headerNames, $raw);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Webhook gizli anahtarı yapılandırılmamış']);
    exit;
}
if (!$authOk) {
    $why = $given ? 'Gönderilen anahtar kayıtlı gizli anahtarla eşleşmedi' : 'İstekte anahtar/Authorization başlığı yok';
    op_log($pdo, $platform, 'WEBHOOK', 'REJECTED', 401, $why, $headerNames, $raw);
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Yetkisiz']);
    exit;
}

/* ---------- olay türü: platformun gönderdiği DURUMdan çıkarılır ---------- */
if (isset($data['order']) && is_array($data['order'])) { $data = $data['order']; } // bazı sarmalayıcılar
$n = op_normalize($platform, $data);
$statusWord = (string)$n['status'];
$mapped = op_map_remote_status($platform, $statusWord);
$event = $mapped === 'IPTAL' ? 'cancel' : (($mapped === 'BEKLIYOR' || $mapped === null) ? 'new' : 'status');

if ($n['id'] === '') {
    op_log($pdo, $platform, 'WEBHOOK', 'ERROR', 200, 'Sipariş kimliği ayrıştırılamadı — ham veri kaydedildi, alan eşlemesi gözden geçirilmeli', $headerNames, $raw);
    // Platformun yeniden deneme fırtınası oluşturmaması için 200; ham veri günlükte saklı.
    echo json_encode(['success' => true, 'warning' => 'ayrıştırılamadı']);
    exit;
}

try {
    $pdo->prepare("UPDATE `online_platforms` SET `last_webhook_at` = NOW() WHERE `platform_code` = ?")->execute([$platform]);
} catch (Throwable $e) {}

/* ---------- iptal / durum ---------- */
if ($event === 'cancel' || $event === 'status') {
    $order = op_find_order($pdo, $n['id']);
    if ($order) {
        $changed = op_sync_remote_status($pdo, $platform, $n['id'], $statusWord);
        if ($event === 'cancel') {
            $reason = op_str(op_pick($data, ['cancellation.reason', 'cancelInfo.reason', 'cancelReason', 'reason'], 'Platform tarafından iptal edildi'));
            $pdo->prepare("UPDATE `online_orders` SET `cancel_reason` = ? WHERE `id` = ? AND `local_status` = 'IPTAL'")->execute([mb_substr($reason, 0, 250), $order['id']]);
        }
        op_log($pdo, $platform, 'WEBHOOK', 'ACCEPTED', 200, ($event === 'cancel' ? 'Platform iptali işlendi' : 'Durum bildirimi işlendi: ' . $statusWord) . ($changed ? '' : ' (yerel durum zaten güncel)'), $headerNames, $raw, $n['id']);
    } else {
        op_log($pdo, $platform, 'WEBHOOK', 'ACCEPTED', 200, ($event === 'cancel' ? 'İptal' : 'Durum') . ' bildirimi geldi ama sipariş kayıtlı değil: ' . $statusWord, $headerNames, $raw, $n['id']);
    }
    echo json_encode(['success' => true]);
    exit;
}

/* ---------- yeni sipariş ---------- */
try {
    $res = op_store_order($pdo, $platform, $n, $raw);
    $enabledNote = empty($row['is_enabled']) ? ' (UYARI: platform kasada "pasif" — sipariş kayıtlı ama listede gizli)' : '';
    op_log($pdo, $platform, 'WEBHOOK', $res['created'] ? 'ACCEPTED' : 'DUPLICATE', 200,
        ($res['created'] ? 'Yeni sipariş kaydedildi' : 'Tekrar gelen sipariş (yeni kayıt oluşturulmadı)') . $enabledNote, $headerNames, $raw, $n['id']);
    echo json_encode(['success' => true, 'orderId' => $res['id'], 'duplicate' => !$res['created']], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Online sipariş kayıt hatası: ' . $e->getMessage());
    op_log($pdo, $platform, 'WEBHOOK', 'ERROR', 503, 'Veritabanına yazılamadı: ' . $e->getMessage(), $headerNames, $raw, $n['id']);
    // Kalıcı kayıt yoksa BAŞARI dönülmez: platform siparişi yeniden dener.
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'Sipariş şu an kaydedilemedi']);
}
