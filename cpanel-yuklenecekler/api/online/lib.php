<?php
/**
 * Online yemek platformları (Getir Yemek, Trendyol Go Yemek, Yemeksepeti) — ortak kütüphane.
 *
 * İLKELER
 *  - Hiçbir "başarılı" mesajı gerçek bir platform yanıtı olmadan üretilmez.
 *  - Platformdan gelen HER istek (kabul/ret) `online_webhook_log` tablosuna yazılır → "sipariş neden gelmedi" görülebilir.
 *  - Ham gövde (`raw_json`) siparişle birlikte saklanır; alan eşlemesi hatalıysa veri kaybolmaz, düzeltilebilir.
 *  - Doğrulanamayan platform işlemleri "MANUAL" (elle) olarak işaretlenir; platforma iletilmiş gibi gösterilmez.
 */

const OP_PLATFORMS = ['YEMEKSEPETI', 'TRENDYOL', 'GETIR'];
const OP_GETIR_DEFAULT_BASE = 'https://food-external-api-gateway.getirapi.com';
// Yemeksepeti Partner API (developer.yemeksepeti.com › api-specifications): OAuth2 client_credentials
const OP_YS_DEFAULT_TOKEN_URL = 'https://yemeksepeti.partner.deliveryhero.io/v2/oauth/token';

/* ------------------------------------------------------------------ yardımcılar */

function op_headers_lower(): array {
    $out = [];
    foreach ($_SERVER as $k => $v) {
        if (strpos($k, 'HTTP_') === 0) {
            $out[strtolower(str_replace('_', '-', substr($k, 5)))] = (string)$v;
        }
    }
    if (isset($_SERVER['CONTENT_TYPE'])) { $out['content-type'] = (string)$_SERVER['CONTENT_TYPE']; }
    if (!isset($out['authorization']) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $out['authorization'] = (string)$_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    return $out;
}

/** "a.b.c" yollarından ilk dolu değeri döndürür. */
function op_pick($data, array $paths, $default = null) {
    foreach ($paths as $path) {
        $cur = $data;
        foreach (explode('.', $path) as $seg) {
            if (is_array($cur) && array_key_exists($seg, $cur)) { $cur = $cur[$seg]; } else { $cur = null; break; }
        }
        if ($cur !== null && $cur !== '' && $cur !== []) { return $cur; }
    }
    return $default;
}

function op_str($v, $default = ''): string {
    if ($v === null) return $default;
    if (is_scalar($v)) return trim((string)$v);
    return $default;
}

function op_money($v): float {
    if (is_array($v)) { $v = op_pick($v, ['amount', 'value', 'total'], 0); }
    if (is_string($v)) { $v = str_replace(',', '.', preg_replace('/[^0-9,.\-]/', '', $v)); }
    return round((float)$v, 2);
}

function op_secret_equals(string $expected, string $given): bool {
    return $expected !== '' && $given !== '' && hash_equals($expected, $given);
}

/* ------------------------------------------------------------------ platform kaydı */

function op_platform(PDO $pdo, string $code): array {
    $row = null;
    try {
        $st = $pdo->prepare("SELECT * FROM `online_platforms` WHERE `platform_code` = ? LIMIT 1");
        $st->execute([$code]);
        $row = $st->fetch(PDO::FETCH_ASSOC) ?: null;
    } catch (Throwable $e) {}
    $row = $row ?: ['platform_code' => $code, 'is_enabled' => 0, 'credentials_json' => '{}', 'webhook_secret' => '', 'delivery_model' => 'RESTAURANT_COURIER'];
    $row['creds'] = json_decode($row['credentials_json'] ?? '{}', true) ?: [];
    $row['secret'] = (string)($row['webhook_secret'] ?? '');
    return $row;
}

/* ------------------------------------------------------------------ tanı günlüğü */

function op_log(PDO $pdo, string $platform, string $source, string $result, int $http, string $reason, array $headerNames = [], string $body = '', string $ref = ''): void {
    try {
        $st = $pdo->prepare("INSERT INTO `online_webhook_log` (`platform`, `source`, `result`, `http_code`, `reason`, `header_names`, `body_sample`, `order_ref`) VALUES (?,?,?,?,?,?,?,?)");
        $st->execute([$platform, $source, $result, $http, mb_substr($reason, 0, 250), mb_substr(implode(', ', $headerNames), 0, 900), mb_substr($body, 0, 12000), mb_substr($ref, 0, 100)]);
        if (mt_rand(1, 40) === 1) {
            $pdo->exec("DELETE FROM `online_webhook_log` WHERE `id` < (SELECT mx FROM (SELECT MAX(`id`) - 800 AS mx FROM `online_webhook_log`) t)");
        }
    } catch (Throwable $e) { error_log('online_webhook_log: ' . $e->getMessage()); }
}

/* ------------------------------------------------------------------ dış HTTP */

/** Gerçek HTTP isteği. Dönüş: ok(2xx), status, body, json, error */
function op_http(string $method, string $url, array $headers = [], $body = null, int $timeout = 12): array {
    if (!preg_match('#^https?://#i', $url)) {
        return ['ok' => false, 'status' => 0, 'body' => '', 'json' => null, 'error' => 'Geçersiz adres: ' . $url];
    }
    $ch = curl_init($url);
    $hdr = [];
    foreach ($headers as $k => $v) { $hdr[] = is_int($k) ? $v : ($k . ': ' . $v); }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => $hdr,
        CURLOPT_USERAGENT => 'TahaUsta-POS/1.0',
    ]);
    if ($body !== null) { curl_setopt($ch, CURLOPT_POSTFIELDS, is_array($body) ? json_encode($body, JSON_UNESCAPED_UNICODE) : $body); }
    $resp = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($resp === false) {
        return ['ok' => false, 'status' => 0, 'body' => '', 'json' => null, 'error' => $err ?: 'Bağlantı kurulamadı'];
    }
    $json = json_decode((string)$resp, true);
    return ['ok' => $status >= 200 && $status < 300, 'status' => $status, 'body' => (string)$resp, 'json' => is_array($json) ? $json : null, 'error' => ''];
}

function op_brief(array $r): string {
    if ($r['status'] === 0) { return 'Ağ hatası: ' . $r['error']; }
    $msg = '';
    if (is_array($r['json'])) { $msg = op_str(op_pick($r['json'], ['message', 'error', 'errorMessage', 'detail', 'title', 'description'], '')); }
    if ($msg === '') { $msg = mb_substr(trim(strip_tags($r['body'])), 0, 160); }
    return 'HTTP ' . $r['status'] . ($msg !== '' ? ' — ' . $msg : '');
}

/* ------------------------------------------------------------------ GETIR */

function op_getir_base(array $creds): string {
    $b = rtrim(op_str($creds['apiBaseUrl'] ?? ''), '/');
    return $b !== '' ? $b : OP_GETIR_DEFAULT_BASE;
}

/** Getir oturum anahtarı: POST /auth/login {appSecretKey, restaurantSecretKey} → token. ~1 saat geçerli, önbelleğe alınır. */
function op_getir_token(PDO $pdo, array $row, bool $force = false): array {
    $creds = $row['creds'];
    $app = op_str($creds['appKey'] ?? $creds['appSecretKey'] ?? '');
    $rest = op_str($creds['restaurantSecretKey'] ?? '');
    if ($app === '' || $rest === '') {
        return ['ok' => false, 'token' => '', 'message' => 'Getir için "App Secret Key" ve "Restaurant Secret Key" girilmelidir.'];
    }
    if (!$force && !empty($row['token_cache']) && !empty($row['token_expires_at']) && strtotime($row['token_expires_at']) > time() + 60) {
        return ['ok' => true, 'token' => $row['token_cache'], 'message' => 'önbellek'];
    }
    $r = op_http('POST', op_getir_base($creds) . '/auth/login', ['Content-Type' => 'application/json'], ['appSecretKey' => $app, 'restaurantSecretKey' => $rest]);
    $token = is_array($r['json']) ? op_str(op_pick($r['json'], ['token', 'data.token', 'accessToken'], '')) : '';
    if (!$r['ok'] || $token === '') {
        return ['ok' => false, 'token' => '', 'message' => 'Getir girişi başarısız: ' . op_brief($r)];
    }
    try {
        $pdo->prepare("UPDATE `online_platforms` SET `token_cache` = ?, `token_expires_at` = DATE_ADD(NOW(), INTERVAL 50 MINUTE) WHERE `platform_code` = 'GETIR'")->execute([$token]);
    } catch (Throwable $e) {}
    return ['ok' => true, 'token' => $token, 'message' => 'Getir girişi başarılı'];
}

/** Getir isteği; 401'de bir kez yeniden giriş yapar. */
function op_getir_call(PDO $pdo, array $row, string $method, string $path, $body = null): array {
    $t = op_getir_token($pdo, $row);
    if (!$t['ok']) { return ['ok' => false, 'status' => 0, 'body' => '', 'json' => null, 'error' => $t['message']]; }
    $do = function (string $token) use ($row, $method, $path, $body) {
        return op_http($method, op_getir_base($row['creds']) . $path, ['token' => $token, 'Content-Type' => 'application/json'], $body);
    };
    $r = $do($t['token']);
    if ($r['status'] === 401) {
        $t2 = op_getir_token($pdo, $row, true);
        if ($t2['ok']) { $r = $do($t2['token']); }
    }
    return $r;
}

/* ------------------------------------------------------------------ YEMEKSEPETİ (OAuth2 client_credentials) */

function op_ys_token(array $row): array {
    $c = $row['creds'];
    $id = op_str($c['clientId'] ?? ''); $secret = op_str($c['clientSecret'] ?? '');
    if ($id === '' || $secret === '') { return ['ok' => false, 'token' => '', 'message' => 'Yemeksepeti için "Client ID" ve "Client Secret" girilmelidir.']; }
    $url = op_str($c['tokenUrl'] ?? '') ?: OP_YS_DEFAULT_TOKEN_URL;
    $r = op_http('POST', $url, ['Content-Type' => 'application/x-www-form-urlencoded'],
        http_build_query(['grant_type' => 'client_credentials', 'client_id' => $id, 'client_secret' => $secret]));
    $token = is_array($r['json']) ? op_str($r['json']['access_token'] ?? '') : '';
    if (!$r['ok'] || $token === '') { return ['ok' => false, 'token' => '', 'message' => 'Yemeksepeti yetkilendirmesi başarısız: ' . op_brief($r)]; }
    return ['ok' => true, 'token' => $token, 'message' => 'Yemeksepeti yetkilendirmesi başarılı'];
}

/* ------------------------------------------------------------------ TRENDYOL */

function op_ty_headers(array $creds): array {
    $key = op_str($creds['apiKey'] ?? ''); $sec = op_str($creds['secretKey'] ?? ''); $sid = op_str($creds['supplierId'] ?? '');
    return ['Authorization' => 'Basic ' . base64_encode($key . ':' . $sec), 'User-Agent' => $sid . ' - SelfIntegration', 'Content-Type' => 'application/json'];
}

/** Yapılandırılmış adres şablonu ({id}, {supplierId}) → gerçek adres. */
function op_tpl(string $tpl, array $vars): string {
    foreach ($vars as $k => $v) { $tpl = str_replace('{' . $k . '}', rawurlencode((string)$v), $tpl); }
    return $tpl;
}

/* ------------------------------------------------------------------ normalleştiriciler (alan adlarına toleranslı) */

function op_items_from(array $list, array $nameP, array $qtyP, array $priceP, array $noteP, array $optP): array {
    $items = [];
    foreach ($list as $it) {
        if (!is_array($it)) continue;
        $qty = (int)op_pick($it, $qtyP, 1); if ($qty < 1) { $qty = 1; }
        $price = op_money(op_pick($it, $priceP, 0));
        $opts = [];
        $rawOpts = op_pick($it, $optP, []);
        $walk = function ($arr) use (&$walk, &$opts) {
            if (!is_array($arr)) return;
            foreach ($arr as $o) {
                if (!is_array($o)) continue;
                $n = op_str(op_pick($o, ['name', 'title', 'optionName'], ''));
                if ($n !== '') { $opts[] = $n; }
                foreach (['options', 'children', 'selectedToppings', 'items'] as $sub) { if (isset($o[$sub])) { $walk($o[$sub]); } }
            }
        };
        $walk($rawOpts);
        $items[] = [
            'name' => op_str(op_pick($it, $nameP, 'Ürün')) ?: 'Ürün',
            'quantity' => $qty,
            'price' => $price,
            'note' => op_str(op_pick($it, $noteP, '')),
            'options' => $opts,
        ];
    }
    return $items;
}

function op_addr(array $a): string {
    $parts = [];
    foreach (['address', 'fullAddress', 'addressText', 'street', 'streetName', 'number', 'building', 'buildingName', 'apartment', 'aptNo', 'floor', 'doorNo', 'room', 'district', 'neighborhood', 'city', 'postcode', 'description', 'directions'] as $k) {
        if (isset($a[$k]) && is_scalar($a[$k]) && trim((string)$a[$k]) !== '') { $parts[] = (in_array($k, ['aptNo', 'floor', 'doorNo', 'room'], true) ? ucfirst($k) . ': ' : '') . trim((string)$a[$k]); }
    }
    return implode(', ', array_unique($parts));
}

function op_norm_getir(array $d): array {
    $id = op_str(op_pick($d, ['id', '_id', 'foodOrderId', 'orderId', 'confirmationId'], ''));
    $addr = op_pick($d, ['client.deliveryAddress', 'deliveryAddress', 'address'], []);
    $addrText = is_array($addr) ? op_addr($addr) : op_str($addr);
    $first = op_str(op_pick($d, ['client.name', 'client.fullName', 'customer.name', 'clientName'], ''));
    return [
        'id' => $id,
        'code' => op_str(op_pick($d, ['confirmationId', 'orderNo', 'orderCode'], $id)),
        'customerName' => $first ?: 'Getir Müşterisi',
        'phone' => op_str(op_pick($d, ['client.clientPhoneNumber', 'client.contactPhoneNumber', 'client.phoneNumber', 'client.phone', 'phone'], '')),
        'address' => $addrText ?: 'Adres bilgisi payload içinde bulunamadı (ham veriye bakın)',
        'note' => op_str(op_pick($d, ['clientNote', 'client.note', 'note', 'restaurantNote'], '')),
        'items' => op_items_from((array)op_pick($d, ['products', 'items', 'lines'], []), ['name', 'product.name', 'productName'], ['count', 'quantity', 'amount'], ['price', 'unitPrice', 'totalPrice'], ['note', 'productNote'], ['optionCategories', 'options', 'toppings']),
        'total' => op_money(op_pick($d, ['totalPrice', 'totalAmount', 'price.total', 'total', 'chargedAmount', 'payment.total'], 0)),
        'payment' => op_str(op_pick($d, ['paymentMethodText', 'paymentMethod', 'checkoutMethod', 'payment.type'], 'Online')),
        'status' => 'NEW',
    ];
}

function op_norm_trendyol(array $d): array {
    $id = op_str(op_pick($d, ['orderId', 'id', 'packageId', 'orderNumber', 'orderCode', 'number'], ''));
    $name = trim(op_str(op_pick($d, ['customer.firstName', 'customerFirstName'], '')) . ' ' . op_str(op_pick($d, ['customer.lastName', 'customerLastName'], '')));
    if ($name === '') { $name = op_str(op_pick($d, ['customerName', 'customer.name', 'customer.fullName', 'buyerName'], '')); }
    $addr = op_pick($d, ['address', 'deliveryAddress', 'shipmentAddress', 'customer.address'], []);
    return [
        'id' => $id,
        'code' => op_str(op_pick($d, ['orderNumber', 'orderCode', 'number'], $id)),
        'customerName' => $name ?: 'Trendyol Müşterisi',
        'phone' => op_str(op_pick($d, ['customer.phone', 'customer.gsm', 'customer.mobilePhone', 'customerPhone', 'phone'], '')),
        'address' => (is_array($addr) ? op_addr($addr) : op_str($addr)) ?: 'Adres bilgisi payload içinde bulunamadı (ham veriye bakın)',
        'note' => op_str(op_pick($d, ['customerNote', 'note', 'notes', 'orderNote', 'comment'], '')),
        'items' => op_items_from((array)op_pick($d, ['lines', 'items', 'products', 'packageItems', 'orderItems'], []), ['name', 'productName', 'itemName', 'title'], ['quantity', 'count', 'amount'], ['price', 'unitPrice', 'salePrice', 'amount'], ['note', 'comment', 'notes'], ['modifiers', 'options', 'extras', 'selectedOptions']),
        'total' => op_money(op_pick($d, ['totalPrice', 'grossAmount', 'totalAmount', 'total', 'payableAmount', 'price.total'], 0)),
        'payment' => op_str(op_pick($d, ['paymentType', 'paymentMethod', 'payment.type'], 'Online')),
        'status' => op_str(op_pick($d, ['status', 'packageStatus'], 'Created')),
    ];
}

function op_norm_ys(array $d): array {
    // Delivery Hero POS Plugin "Dispatch Order": token (sipariş kimliği), code (görünen kod); Partner API: order_id/order_code
    $id = op_str(op_pick($d, ['token', 'order_id', 'orderId', 'external_order_id', 'id'], ''));
    $first = op_str(op_pick($d, ['customer.firstName', 'customer.first_name', 'client.first_name'], ''));
    $last = op_str(op_pick($d, ['customer.lastName', 'customer.last_name', 'client.last_name'], ''));
    $name = trim($first . ' ' . $last);
    if ($name === '') { $name = op_str(op_pick($d, ['customer.name', 'customerName'], '')); }
    $addr = op_pick($d, ['delivery.address', 'customer.address', 'address'], []);
    $comments = op_pick($d, ['comments.customerComment', 'comments', 'comment', 'customer_comment'], '');
    return [
        'id' => $id,
        'code' => op_str(op_pick($d, ['code', 'order_code', 'shortCode'], $id)),
        'customerName' => $name ?: 'Yemeksepeti Müşterisi',
        'phone' => op_str(op_pick($d, ['customer.mobilePhone', 'customer.phone', 'customer.mobile', 'customer.phone_number'], '')),
        'address' => (is_array($addr) ? op_addr($addr) : op_str($addr)) ?: 'Adres bilgisi payload içinde bulunamadı (ham veriye bakın)',
        'note' => is_array($comments) ? op_str(op_pick($comments, ['customerComment', 'comment'], '')) : op_str($comments),
        'items' => op_items_from((array)op_pick($d, ['products', 'items'], []), ['name', 'productName', 'sku'], ['quantity', 'pricing.quantity'], ['unitPrice', 'paidPrice', 'pricing.unit_price', 'price'], ['comment', 'remark'], ['selectedToppings', 'variations', 'options']),
        'total' => op_money(op_pick($d, ['price.grandTotal', 'price.total', 'payment.total', 'totalAmount', 'total'], 0)),
        'payment' => op_str(op_pick($d, ['payment.type', 'payment.method', 'paymentMethod'], 'Online')),
        'status' => op_str(op_pick($d, ['status'], 'RECEIVED')),
        'callbacks' => op_pick($d, ['callbackUrls'], null),
    ];
}

function op_normalize(string $platform, array $d): array {
    switch ($platform) {
        case 'GETIR': return op_norm_getir($d);
        case 'TRENDYOL': return op_norm_trendyol($d);
        default: return op_norm_ys($d);
    }
}

/* ------------------------------------------------------------------ sipariş kaydı */

/** Dönüş: ['created'=>bool, 'id'=>local id]. Aynı (platform, sipariş) ikinci kez gelirse yeni kayıt OLUŞMAZ. */
function op_store_order(PDO $pdo, string $platform, array $n, string $rawJson): array {
    $row = op_platform($pdo, $platform);
    $deliveryModel = $row['delivery_model'] ?? 'RESTAURANT_COURIER';
    $st = $pdo->prepare("INSERT INTO `online_orders`
        (`platform_code`,`platform_order_id`,`customer_name`,`customer_phone`,`delivery_address`,`order_note`,`items_json`,`total_amount`,`payment_method`,`platform_status`,`local_status`,`raw_json`,`callback_urls_json`,`delivery_model`,`created_at`)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'BEKLIYOR', ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE `raw_json` = VALUES(`raw_json`), `callback_urls_json` = COALESCE(VALUES(`callback_urls_json`), `callback_urls_json`)");
    $st->execute([
        $platform, $n['id'], mb_substr($n['customerName'], 0, 100), mb_substr($n['phone'], 0, 30), $n['address'], $n['note'],
        json_encode($n['items'], JSON_UNESCAPED_UNICODE), $n['total'], mb_substr($n['payment'], 0, 50), mb_substr($n['status'] ?: 'NEW', 0, 50),
        $rawJson, isset($n['callbacks']) && $n['callbacks'] ? json_encode($n['callbacks']) : null, $deliveryModel,
    ]);
    // rowCount: 1 = yeni kayıt, 2 = güncelleme, 0 = değişmedi
    $created = $st->rowCount() === 1;
    $idRow = $pdo->prepare("SELECT `id` FROM `online_orders` WHERE `platform_code` = ? AND `platform_order_id` = ?");
    $idRow->execute([$platform, $n['id']]);
    return ['created' => $created, 'id' => (string)$idRow->fetchColumn()];
}

function op_find_order(PDO $pdo, string $orderId): ?array {
    $st = $pdo->prepare("SELECT * FROM `online_orders` WHERE `id` = ? OR `platform_order_id` = ? LIMIT 1");
    $st->execute([$orderId, $orderId]);
    return $st->fetch(PDO::FETCH_ASSOC) ?: null;
}

function op_set_sync(PDO $pdo, int $id, string $status, string $message): void {
    try {
        $pdo->prepare("UPDATE `online_orders` SET `platform_sync_status` = ?, `platform_sync_message` = ?, `platform_sync_at` = NOW() WHERE `id` = ?")->execute([$status, mb_substr($message, 0, 250), $id]);
    } catch (Throwable $e) {}
}

/* ------------------------------------------------------------------ platforma işlem bildirimi */

/**
 * Sipariş işlemini platforma ileter. Dönüş: ['status' => 'OK'|'FAILED'|'MANUAL', 'message' => ...].
 * MANUAL = bu işlem için doğrulanmış otomatik uç yok; kullanıcı platform uygulamasında da işlemi yapmalı.
 */
function op_platform_action(PDO $pdo, array $order, string $action, array $extra = []): array {
    $platform = $order['platform_code'];
    $row = op_platform($pdo, $platform);
    $oid = (string)$order['platform_order_id'];

    if ($platform === 'GETIR') {
        $calls = [];
        switch ($action) {
            case 'accept':   $calls = [['POST', "/food-orders/{$oid}/verify", null]]; break;
            case 'dispatch':
                $calls[] = ['POST', "/food-orders/{$oid}/prepare", null];
                if (($order['delivery_model'] ?? '') === 'PLATFORM_COURIER') { $calls[] = ['POST', "/food-orders/{$oid}/handover", null]; }
                break;
            case 'deliver':  $calls = [['POST', "/food-orders/{$oid}/deliver", null]]; break;
            case 'reject':   $calls = [['POST', "/food-orders/{$oid}/cancel", ['cancelNote' => (string)($extra['reason'] ?? '')]]]; break;
            default: return ['status' => 'MANUAL', 'message' => 'Bu işlem için Getir uç noktası tanımlı değil.'];
        }
        $msgs = [];
        foreach ($calls as [$m, $path, $b]) {
            $r = op_getir_call($pdo, $row, $m, $path, $b);
            if (!$r['ok']) { return ['status' => 'FAILED', 'message' => "Getir {$path}: " . ($r['status'] === 0 ? $r['error'] : op_brief($r))]; }
            $msgs[] = $path;
        }
        return ['status' => 'OK', 'message' => 'Getir\'e iletildi: ' . implode(', ', $msgs)];
    }

    // Trendyol / Yemeksepeti: yalnızca KULLANICININ platform dokümanından girdiği adresler çağrılır.
    $c = $row['creds'];
    $keyMap = ['accept' => 'acceptUrl', 'reject' => 'rejectUrl', 'dispatch' => 'dispatchUrl', 'deliver' => 'deliverUrl'];
    $tpl = op_str($c[$keyMap[$action] ?? ''] ?? '');

    // Yemeksepeti POS Plugin: sipariş yükündeki callbackUrls adresleri (varsa) kullanılır
    if ($tpl === '' && $platform === 'YEMEKSEPETI' && !empty($order['callback_urls_json'])) {
        $cb = json_decode($order['callback_urls_json'], true) ?: [];
        $cbMap = ['accept' => 'orderAcceptedUrl', 'reject' => 'orderRejectedUrl', 'dispatch' => 'orderPickedUpUrl', 'deliver' => ''];
        $tpl = op_str($cb[$cbMap[$action] ?? ''] ?? '');
    }
    if ($tpl === '') {
        return ['status' => 'MANUAL', 'message' => $platform . ' için bu işlemin otomatik bildirimi tanımlı değil; işlemi platformun kendi uygulamasında da yapın (Ayarlar › Yemek Platformları › Gelişmiş adresler).'];
    }
    $url = op_tpl($tpl, ['id' => $oid, 'supplierId' => op_str($c['supplierId'] ?? ''), 'vendorId' => op_str($c['vendorId'] ?? ''), 'chainId' => op_str($c['chainId'] ?? '')]);
    $method = strtoupper(op_str($c[($keyMap[$action] ?? 'x') . 'Method'] ?? '') ?: 'PUT');
    if ($platform === 'TRENDYOL') {
        $headers = op_ty_headers($c);
    } else {
        $tk = op_ys_token($row);
        if (!$tk['ok']) { return ['status' => 'FAILED', 'message' => $tk['message']]; }
        $headers = ['Authorization' => 'Bearer ' . $tk['token'], 'Content-Type' => 'application/json'];
    }
    $payload = ['status' => $action === 'accept' ? 'order_accepted' : ($action === 'reject' ? 'order_rejected' : ($action === 'dispatch' ? 'order_picked_up' : 'delivered'))];
    if ($action === 'accept') { $payload['acceptanceTime'] = gmdate('Y-m-d\TH:i:s\Z', time() + 1800); }
    if ($action === 'reject') { $payload['message'] = (string)($extra['reason'] ?? ''); }
    $r = op_http($method, $url, $headers, $payload);
    return $r['ok'] ? ['status' => 'OK', 'message' => "{$platform}'a iletildi (HTTP {$r['status']})"] : ['status' => 'FAILED', 'message' => "{$platform}: " . op_brief($r)];
}

/* ------------------------------------------------------------------ sipariş çekme (polling) */

function op_extract_list($json): array {
    if (!is_array($json)) return [];
    if (isset($json[0])) return $json;
    foreach (['data', 'orders', 'foodOrders', 'content', 'items', 'packages', 'results'] as $k) {
        if (isset($json[$k]) && is_array($json[$k])) {
            return isset($json[$k][0]) ? $json[$k] : (isset($json[$k]['orders']) ? (array)$json[$k]['orders'] : []);
        }
    }
    return [];
}

/** Etkin platformlardan siparişleri çeker. Dönüş: platform => ['fetched','new','error'|null] */
function op_poll_all(PDO $pdo): array {
    $out = [];
    foreach (OP_PLATFORMS as $code) {
        $row = op_platform($pdo, $code);
        if (empty($row['is_enabled'])) { continue; }
        $res = ['fetched' => 0, 'new' => 0, 'error' => null, 'skipped' => null];
        $lists = [];
        if ($code === 'GETIR') {
            foreach (['/food-orders/active', '/food-orders/periodic/unapproved'] as $path) {
                $r = op_getir_call($pdo, $row, 'GET', $path);
                if (!$r['ok']) { $res['error'] = "Getir {$path}: " . ($r['status'] === 0 ? $r['error'] : op_brief($r)); break; }
                $lists[] = op_extract_list($r['json']);
            }
        } else {
            $c = $row['creds'];
            $url = op_str($c['ordersUrl'] ?? '');
            if ($url === '') { $res['skipped'] = 'Sipariş okuma adresi tanımlı değil (yalnızca webhook ile sipariş alınır).'; $out[$code] = $res; continue; }
            $url = op_tpl($url, ['supplierId' => op_str($c['supplierId'] ?? ''), 'vendorId' => op_str($c['vendorId'] ?? ''), 'chainId' => op_str($c['chainId'] ?? '')]);
            if ($code === 'TRENDYOL') { $headers = op_ty_headers($c); }
            else {
                $tk = op_ys_token($row);
                if (!$tk['ok']) { $res['error'] = $tk['message']; $out[$code] = $res; continue; }
                $headers = ['Authorization' => 'Bearer ' . $tk['token']];
            }
            $r = op_http('GET', $url, $headers);
            if (!$r['ok']) { $res['error'] = "{$code}: " . ($r['status'] === 0 ? $r['error'] : op_brief($r)); } else { $lists[] = op_extract_list($r['json']); }
        }
        foreach ($lists as $list) {
            foreach ($list as $d) {
                if (!is_array($d)) continue;
                $n = op_normalize($code, $d);
                if ($n['id'] === '') { op_log($pdo, $code, 'POLL', 'ERROR', 200, 'Sipariş kimliği ayrıştırılamadı', [], json_encode($d, JSON_UNESCAPED_UNICODE)); continue; }
                $res['fetched']++;
                try {
                    $s = op_store_order($pdo, $code, $n, json_encode($d, JSON_UNESCAPED_UNICODE));
                    if ($s['created']) { $res['new']++; op_log($pdo, $code, 'POLL', 'ACCEPTED', 200, 'Yeni sipariş çekildi', [], json_encode($d, JSON_UNESCAPED_UNICODE), $n['id']); }
                } catch (Throwable $e) { $res['error'] = 'Kayıt hatası: ' . $e->getMessage(); }
            }
        }
        $out[$code] = $res;
    }
    return $out;
}
