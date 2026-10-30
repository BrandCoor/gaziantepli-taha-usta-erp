<?php
/**
 * Online yemek platformları — ortak kütüphane.
 *   • Trendyol Go Yemek (Uber Eats Trendyol Go - Meal): GetirYemek siparişleri de buradan gelir (appName=Galaxy).
 *   • Yemeksepeti (Partner API v2).
 * Platform uçları doküman sitelerinden DOĞRULANMIŞTIR (bkz. docs/platform-api-notes.md).
 *
 * İLKELER
 *  - Hiçbir "başarılı" mesajı gerçek bir platform yanıtı olmadan üretilmez.
 *  - Platformdan gelen/çekilen HER istek `online_webhook_log` tablosuna yazılır → "sipariş neden gelmedi" görülebilir.
 *  - Ham gövde (`raw_json`) siparişle birlikte saklanır; alan eşlemesi hatalıysa veri kaybolmaz.
 */

const OP_PLATFORMS = ['TRENDYOL', 'YEMEKSEPETI'];
const OP_TY_DEFAULT_BASE = 'https://api.tgoapis.com';
const OP_YS_DEFAULT_BASE = 'https://yemeksepeti.partner.deliveryhero.io';

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

/* ------------------------------------------------------------------ ayar deposu (ayarlar tablosu) */

function op_setting_get(PDO $pdo, string $key, string $default = ''): string {
    try {
        $st = $pdo->prepare("SELECT `deger` FROM `ayarlar` WHERE `anahtar` = ?");
        $st->execute([$key]);
        $v = $st->fetchColumn();
        return $v === false || $v === null ? $default : (string)$v;
    } catch (Throwable $e) { return $default; }
}

function op_setting_set(PDO $pdo, string $key, string $value): void {
    try {
        $pdo->prepare("INSERT INTO `ayarlar` (`anahtar`, `deger`, `aciklama`) VALUES (?, ?, 'Online platform') ON DUPLICATE KEY UPDATE `deger` = VALUES(`deger`)")->execute([$key, mb_substr($value, 0, 250)]);
    } catch (Throwable $e) {}
}

/* ------------------------------------------------------------------ TRENDYOL GO YEMEK (Uber Eats Trendyol Go - Meal)
 * Kaynak: developers.tgoapps.com › Trendyol GO Meal › Order Integration / Restaurant Integration (doğrulanmış uçlar):
 *   GET  /integrator/order/meal/suppliers/{sid}/packages            (packageStatuses, packageModificationStartDate/EndDate [ms], page, size ≤ 50)
 *   PUT  /integrator/order/meal/suppliers/{sid}/packages/picked     {packageId, preparationTime}        → kabul (Picking)
 *   PUT  /integrator/order/meal/suppliers/{sid}/packages/invoiced   {packageId, actualDate[ms]}         → hazırlandı (Invoiced)
 *   PUT  /integrator/order/meal/suppliers/{sid}/packages/{id}/manual-shipped    {actualDate}            → yalnızca kendi kuryesi
 *   PUT  /integrator/order/meal/suppliers/{sid}/packages/{id}/manual-delivered  {actualDate}            → yalnızca kendi kuryesi
 *   PUT  /integrator/order/meal/suppliers/{sid}/packages/unsupplied {packageId, itemIdList[], reasonId} → iptal
 *   GET  /integrator/store/meal/suppliers/{sid}/stores                         (restoranlar; bağlantı testi)
 *   PUT  /integrator/store/meal/suppliers/{sid}/stores/{storeId}/status        {status: OPEN|CLOSED}
 * Kimlik: Basic base64(apiKey:apiSecret); User-Agent "{supplierId} - SelfIntegration"; x-agentname; x-executor-user (e-posta).
 * Hız sınırı: aynı uca 10 sn'de en çok 50 istek. GetirYemek (Uber) siparişleri de burada gelir (appName = Galaxy).
 */

/** API taban adresi geçersiz kılma: yalnızca https:// (ya da yerel test için http://127.0.0.1 / localhost). */
function op_safe_base(string $b, string $default): string {
    $b = rtrim($b, '/');
    if ($b !== '' && (preg_match('#^https://[^/\s]+#i', $b) || preg_match('#^http://(127\.0\.0\.1|localhost)(:\d+)?(/|$)#i', $b))) { return $b; }
    return $default;
}

function op_ty_base(array $c): string {
    return op_safe_base(op_str($c['apiBaseUrl'] ?? ''), OP_TY_DEFAULT_BASE);
}

/** Eksik zorunlu bilgi varsa açıklaması, yoksa null. */
function op_ty_missing(array $c): ?string {
    $miss = [];
    foreach (['supplierId' => 'Satıcı ID', 'apiKey' => 'API Key', 'secretKey' => 'Secret Key', 'email' => 'Trendyol e-posta'] as $k => $label) {
        if (op_str($c[$k] ?? '') === '') { $miss[] = $label; }
    }
    return $miss ? ('Trendyol için eksik bilgi: ' . implode(', ', $miss) . '.') : null;
}

function op_ty_headers(array $c): array {
    $sid = op_str($c['supplierId'] ?? '');
    return [
        'Authorization' => 'Basic ' . base64_encode(op_str($c['apiKey'] ?? '') . ':' . op_str($c['secretKey'] ?? '')),
        'User-Agent' => $sid . ' - SelfIntegration',
        'x-agentname' => 'TahaUstaERP',
        'x-executor-user' => op_str($c['email'] ?? ''),
        'Content-Type' => 'application/json',
        'Accept' => 'application/json',
    ];
}

function op_ty_call(array $row, string $method, string $path, $body = null, array $query = [], int $timeout = 10): array {
    $c = $row['creds'];
    $miss = op_ty_missing($c);
    if ($miss) { return ['ok' => false, 'status' => 0, 'body' => '', 'json' => null, 'error' => $miss]; }
    $url = op_ty_base($c) . $path . ($query ? ('?' . http_build_query($query)) : '');
    return op_http($method, $url, op_ty_headers($c), $body, $timeout);
}

function op_ty_orders_path(array $c, string $suffix = ''): string {
    return '/integrator/order/meal/suppliers/' . rawurlencode(op_str($c['supplierId'] ?? '')) . '/packages' . $suffix;
}

/** Restoran listesi (bağlantı testi + mağaza kimliği). */
function op_ty_stores(array $row): array {
    $c = $row['creds'];
    $r = op_ty_call($row, 'GET', '/integrator/store/meal/suppliers/' . rawurlencode(op_str($c['supplierId'] ?? '')) . '/stores', null, ['page' => 0, 'size' => 50]);
    if (!$r['ok']) { return ['ok' => false, 'stores' => [], 'message' => 'Trendyol: ' . ($r['status'] === 0 ? $r['error'] : op_brief($r))]; }
    $list = [];
    if (is_array($r['json'])) {
        $list = isset($r['json']['restaurants']) && is_array($r['json']['restaurants']) ? $r['json']['restaurants'] : op_extract_list($r['json']);
    }
    return ['ok' => true, 'stores' => array_values(array_filter($list, 'is_array')), 'message' => ''];
}

/** Mağaza kimliği: ayarda varsa o, yoksa tek restoran varsa o. */
function op_ty_store_id(array $row): array {
    $sid = op_str($row['creds']['storeId'] ?? '');
    if ($sid !== '') { return ['ok' => true, 'id' => $sid, 'message' => '']; }
    $s = op_ty_stores($row);
    if (!$s['ok']) { return ['ok' => false, 'id' => '', 'message' => $s['message']]; }
    if (count($s['stores']) === 1) { return ['ok' => true, 'id' => op_str($s['stores'][0]['id'] ?? ''), 'message' => '']; }
    if (count($s['stores']) === 0) { return ['ok' => false, 'id' => '', 'message' => 'Trendyol hesabında restoran bulunamadı.']; }
    return ['ok' => false, 'id' => '', 'message' => 'Hesapta birden çok restoran var; ayarlarda "Mağaza ID (storeId)" girin.'];
}

/** Modifier (seçenek/ekstra) ağacını gezer: [ad listesi, ek fiyat toplamı]. */
function op_ty_modifiers($mods): array {
    $names = []; $sum = 0.0;
    $walk = function ($arr) use (&$walk, &$names, &$sum) {
        if (!is_array($arr)) return;
        foreach ($arr as $m) {
            if (!is_array($m)) continue;
            $n = op_str($m['name'] ?? '');
            $p = op_money($m['price'] ?? 0);
            if ($n !== '') { $names[] = $p > 0 ? ($n . ' (+' . number_format($p, 2, ',', '.') . ' ₺)') : $n; }
            $sum += $p;
            if (!empty($m['modifierProducts'])) { $walk($m['modifierProducts']); }
        }
    };
    $walk($mods);
    return [$names, round($sum, 2)];
}

function op_ty_ingredient_names($v): array {
    $out = [];
    if (!is_array($v)) return $out;
    foreach ($v as $x) { $n = is_array($x) ? op_str($x['name'] ?? '') : op_str($x); if ($n !== '') { $out[] = $n; } }
    return $out;
}

function op_norm_trendyol(array $d): array {
    $id = op_str($d['id'] ?? '');
    $code = op_str($d['orderCode'] ?? '') ?: op_str($d['orderNumber'] ?? '') ?: $id;
    $delivery = strtoupper(op_str($d['deliveryType'] ?? 'STORE'));
    $app = op_str($d['appName'] ?? '');
    $addr = is_array($d['address'] ?? null) ? $d['address'] : [];
    $name = trim(op_str(op_pick($d, ['customer.firstName'], '')) . ' ' . op_str(op_pick($d, ['customer.lastName'], '')));
    if ($name === '') { $name = trim(op_str($addr['firstName'] ?? '') . ' ' . op_str($addr['lastName'] ?? '')); }
    $phone = op_str($addr['phone'] ?? '') ?: op_str($d['callCenterPhone'] ?? '');

    // Adres: Model 2'de (Trendyol kuryesi) adres alanları "TGO Yemek" yer tutucusudur → paylaşılmaz
    $addrText = '';
    if ($delivery === 'GO') {
        $addrText = 'Trendyol kuryesi teslim eder (adres paylaşılmaz)';
    } else {
        $parts = [];
        foreach (['address1', 'address2', 'neighborhood', 'district', 'city'] as $k) { $v = op_str($addr[$k] ?? ''); if ($v !== '' && $v !== 'TGO Yemek') { $parts[] = $v; } }
        foreach (['apartmentNumber' => 'Bina', 'floor' => 'Kat', 'doorNumber' => 'Daire'] as $k => $label) { $v = op_str($addr[$k] ?? ''); if ($v !== '' && $v !== 'TGO Yemek') { $parts[] = $label . ': ' . $v; } }
        $desc = op_str($addr['addressDescription'] ?? '');
        if ($desc !== '' && $desc !== 'TGO Yemek') { $parts[] = $desc; }
        $addrText = implode(', ', array_unique($parts));
    }

    $note = op_str($d['customerNote'] ?? '');
    $pin = op_str($addr['pinCode'] ?? ($d['pinCode'] ?? ''));
    if ($pin !== '') { $note = trim($note . ($note !== '' ? ' | ' : '') . 'Müşteriyi aramak için ' . ($phone !== '' ? $phone : 'platform hattını') . ' arayıp kod girin: ' . $pin); }

    $items = [];
    foreach ((array)($d['lines'] ?? []) as $line) {
        if (!is_array($line)) continue;
        $qty = 0;
        foreach ((array)($line['items'] ?? []) as $it) { if (is_array($it) && empty($it['isCancelled'])) { $qty++; } }
        if ($qty < 1 && empty($line['items'])) { $qty = 1; }
        if ($qty < 1) { continue; } // tüm adetleri iptal edilmiş satır
        [$modNames, $modSum] = op_ty_modifiers($line['modifierProducts'] ?? []);
        $extra = op_ty_ingredient_names($line['extraIngredients'] ?? []);
        $removed = op_ty_ingredient_names($line['removedIngredients'] ?? []);
        $lineNote = [];
        if ($extra) { $lineNote[] = 'Ekstra: ' . implode(', ', $extra); }
        if ($removed) { $lineNote[] = 'Çıkar: ' . implode(', ', $removed); }
        $items[] = [
            'name' => op_str($line['name'] ?? '') ?: 'Ürün',
            'quantity' => $qty,
            'price' => round(op_money($line['price'] ?? ($line['unitSellingPrice'] ?? 0)) + $modSum, 2),
            'note' => implode(' | ', $lineNote),
            'options' => $modNames,
        ];
    }

    $pay = is_array($d['payment'] ?? null) ? $d['payment'] : [];
    if (!empty($pay['onDelivery'])) {
        $od = is_array($pay['onDelivery']) ? op_str(op_pick($pay['onDelivery'], ['paymentType', 'type', 'name'], '')) : '';
        $payment = 'Kapıda Ödeme' . ($od !== '' ? ' (' . $od . ')' : '');
    } elseif (!empty($pay['mealCard'])) {
        $payment = 'Yemek Kartı (Ödendi)';
    } elseif (stripos(op_str($pay['paymentType'] ?? ''), 'CARD') !== false) {
        $payment = 'Online Kart (Ödendi)';
    } else {
        $payment = 'Online (Ödendi)';
    }

    return [
        'id' => $id,
        'code' => $code,
        'customerName' => $name ?: 'Trendyol Müşterisi',
        'phone' => $phone,
        'address' => $addrText !== '' ? $addrText : 'Adres bilgisi yok',
        'note' => $note,
        'items' => $items,
        'total' => op_money($d['totalPrice'] ?? 0),
        'payment' => $payment,
        'status' => op_str($d['packageStatus'] ?? 'Created'),
        'deliveryModel' => $delivery === 'GO' ? 'PLATFORM_COURIER' : 'RESTAURANT_COURIER',
        'sourceApp' => strcasecmp($app, 'Galaxy') === 0 ? 'GETIR' : 'TRENDYOL',
    ];
}

/** Trendyol yeni siparişleri (Created, tarihten bağımsız) + son değişiklikler (durum eşitleme). */
function op_ty_poll(PDO $pdo, array $row): array {
    $res = ['fetched' => 0, 'new' => 0, 'error' => null, 'skipped' => null];
    $c = $row['creds'];
    if ($miss = op_ty_missing($c)) { $res['error'] = $miss; return $res; }
    $now = (int)(microtime(true) * 1000);
    $since = (int)op_setting_get($pdo, 'op_since_TRENDYOL', '0');
    if ($since <= 0 || $since > $now) { $since = $now - 6 * 3600 * 1000; }

    $fetchPages = function (array $query) use ($row, $c, &$res): ?array {
        $all = [];
        for ($page = 0; $page < 10; $page++) {
            $r = op_ty_call($row, 'GET', op_ty_orders_path($c), null, $query + ['page' => $page, 'size' => 50]);
            if (!$r['ok']) { $res['error'] = 'Trendyol: ' . ($r['status'] === 0 ? $r['error'] : op_brief($r)); return null; }
            $content = is_array($r['json']) && isset($r['json']['content']) && is_array($r['json']['content']) ? $r['json']['content'] : op_extract_list($r['json']);
            foreach ($content as $p) { if (is_array($p)) { $all[] = $p; } }
            $totalPages = (int)($r['json']['totalPages'] ?? 1);
            if ($page + 1 >= $totalPages || count($content) < 50) break;
        }
        return $all;
    };

    // 1) Yeni (Created) siparişler
    $created = $fetchPages(['packageStatuses' => 'Created']);
    if ($created === null) { return $res; }
    // 2) Son değişiklikler: bilinen siparişlerin durumu (iptal, teslim vb.)
    $changed = $fetchPages(['packageStatuses' => 'Picking,Invoiced,Shipped,Delivered,Cancelled,UnSupplied', 'packageModificationStartDate' => $since - 120000, 'packageModificationEndDate' => $now]);
    if ($changed === null) { return $res; }

    foreach ($created as $d) {
        $n = op_norm_trendyol($d);
        if ($n['id'] === '') { op_log($pdo, 'TRENDYOL', 'POLL', 'ERROR', 200, 'Paket kimliği yok', [], json_encode($d, JSON_UNESCAPED_UNICODE)); continue; }
        $res['fetched']++;
        try {
            $s = op_store_order($pdo, 'TRENDYOL', $n, json_encode($d, JSON_UNESCAPED_UNICODE));
            if ($s['created']) { $res['new']++; op_log($pdo, 'TRENDYOL', 'POLL', 'ACCEPTED', 200, 'Yeni sipariş çekildi (' . $n['sourceApp'] . ')', [], json_encode($d, JSON_UNESCAPED_UNICODE), $n['id']); }
        } catch (Throwable $e) { $res['error'] = 'Kayıt hatası: ' . $e->getMessage(); }
    }
    foreach ($changed as $d) {
        $id = op_str($d['id'] ?? '');
        if ($id === '') continue;
        try { op_sync_remote_status($pdo, 'TRENDYOL', $id, op_str($d['packageStatus'] ?? '')); } catch (Throwable $e) {}
    }
    if ($res['error'] === null) { op_setting_set($pdo, 'op_since_TRENDYOL', (string)$now); }
    return $res;
}

/* ------------------------------------------------------------------ YEMEKSEPETİ (Partner API v2)
 * Kaynak: developer.yemeksepeti.com › api-specifications (OpenAPI 2.0.2). Doğrulanmış uçlar:
 *   POST /v2/oauth/token                                     (client_credentials; client_id/secret = Partner Portal › Shop Integrations Plugin)
 *   GET  /v2/chains/{chain}/vendors/{vendor}/orders           (start_time, end_time, page, page_size ≤ 500)  → sipariş çekme
 *   PUT  /v2/chains/{chain}/orders/{order_id}                 {order_id, status: READY_FOR_PICKUP|DISPATCHED|CANCELLED, items[], cancellation{reason}}
 *   GET/PUT /v2/chains/{chain}/vendors/{vendor}/status        (OPEN | CLOSED_TODAY | CLOSED_UNTIL + closed_reason)
 * Sipariş bildirimi (webhook) Partner Portal'da tanımlanırsa anlık gelir; tanımlı değilse yoklama (polling) kullanılır.
 * Not: müşteri bilgileri Yemeksepeti tarafından maskelenmiş (***) gelir.
 */

function op_ys_base(array $c): string {
    return op_safe_base(op_str($c['apiBaseUrl'] ?? ''), OP_YS_DEFAULT_BASE);
}

function op_ys_token(array $row, ?PDO $pdo = null): array {
    $c = $row['creds'];
    $id = op_str($c['clientId'] ?? ''); $secret = op_str($c['clientSecret'] ?? '');
    if ($id === '' || $secret === '') { return ['ok' => false, 'token' => '', 'message' => 'Yemeksepeti için "Client ID" ve "Client Secret" girilmelidir (Partner Portal › Shop Integrations Plugin).']; }
    if ($pdo && !empty($row['token_cache']) && !empty($row['token_expires_at']) && strtotime($row['token_expires_at']) > time() + 60) {
        return ['ok' => true, 'token' => $row['token_cache'], 'message' => 'önbellek'];
    }
    $url = op_str($c['tokenUrl'] ?? '') ?: (op_ys_base($c) . '/v2/oauth/token');
    $r = op_http('POST', $url, ['Content-Type' => 'application/x-www-form-urlencoded', 'Accept' => 'application/json'],
        http_build_query(['grant_type' => 'client_credentials', 'client_id' => $id, 'client_secret' => $secret]));
    $token = is_array($r['json']) ? op_str($r['json']['access_token'] ?? '') : '';
    if (!$r['ok'] || $token === '') { return ['ok' => false, 'token' => '', 'message' => 'Yemeksepeti yetkilendirmesi başarısız: ' . op_brief($r)]; }
    if ($pdo) {
        $ttl = max(120, (int)($r['json']['expires_in'] ?? 3600) - 120);
        try { $pdo->prepare("UPDATE `online_platforms` SET `token_cache` = ?, `token_expires_at` = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE `platform_code` = 'YEMEKSEPETI'")->execute([$token, $ttl]); } catch (Throwable $e) {}
    }
    return ['ok' => true, 'token' => $token, 'message' => 'Yemeksepeti yetkilendirmesi başarılı'];
}

function op_ys_call(PDO $pdo, array $row, string $method, string $path, $body = null, array $query = []): array {
    $tk = op_ys_token($row, $pdo);
    if (!$tk['ok']) { return ['ok' => false, 'status' => 0, 'body' => '', 'json' => null, 'error' => $tk['message']]; }
    $url = op_ys_base($row['creds']) . $path . ($query ? ('?' . http_build_query($query)) : '');
    $hdr = ['Authorization' => 'Bearer ' . $tk['token'], 'Content-Type' => 'application/json', 'Accept' => 'application/json'];
    $r = op_http($method, $url, $hdr, $body, 10);
    if ($r['status'] === 401) { // belirteç süresi dolmuş olabilir: bir kez yeniden al
        try { $pdo->prepare("UPDATE `online_platforms` SET `token_cache` = NULL, `token_expires_at` = NULL WHERE `platform_code` = 'YEMEKSEPETI'")->execute(); } catch (Throwable $e) {}
        $row['token_cache'] = null; $row['token_expires_at'] = null;
        $tk = op_ys_token($row, $pdo);
        if ($tk['ok']) { $hdr['Authorization'] = 'Bearer ' . $tk['token']; $r = op_http($method, $url, $hdr, $body, 10); }
    }
    return $r;
}

function op_ys_missing(array $c, bool $needIds = true): ?string {
    $miss = [];
    foreach (['clientId' => 'Client ID', 'clientSecret' => 'Client Secret'] as $k => $l) { if (op_str($c[$k] ?? '') === '') { $miss[] = $l; } }
    if ($needIds) { foreach (['chainId' => 'Chain ID', 'vendorId' => 'Vendor ID (restoran kodu)'] as $k => $l) { if (op_str($c[$k] ?? '') === '') { $miss[] = $l; } } }
    return $miss ? ('Yemeksepeti için eksik bilgi: ' . implode(', ', $miss) . '.') : null;
}

function op_is_masked(string $s): bool { return $s === '' || preg_match('/^[\*\s]+$/', $s) === 1; }

function op_norm_ys(array $d): array {
    $id = op_str($d['order_id'] ?? '') ?: op_str($d['external_order_id'] ?? '');
    $first = op_str(op_pick($d, ['customer.first_name'], '')); $last = op_str(op_pick($d, ['customer.last_name'], ''));
    $name = trim((op_is_masked($first) ? '' : $first) . ' ' . (op_is_masked($last) ? '' : $last));
    $phone = op_str(op_pick($d, ['customer.phone_number'], ''));
    $da = is_array(op_pick($d, ['customer.delivery_address'], null)) ? $d['customer']['delivery_address'] : [];
    $parts = [];
    foreach (['formattedAddress', 'street', 'number', 'building', 'block', 'entrance', 'floor', 'apartment', 'intercom', 'suburb', 'city', 'company'] as $k) {
        $v = op_str($da[$k] ?? '');
        if ($v !== '' && !op_is_masked($v)) { $parts[] = (in_array($k, ['floor', 'apartment', 'building', 'block', 'entrance', 'intercom'], true) ? ucfirst($k) . ': ' : '') . $v; }
    }
    $instr = op_str($da['instructions'] ?? '');
    $note = trim(op_str($d['comment'] ?? '') . ($instr !== '' && !op_is_masked($instr) ? ' | ' . $instr : ''), ' |');

    $items = [];
    foreach ((array)($d['items'] ?? []) as $it) {
        if (!is_array($it)) continue;
        $pricing = is_array($it['pricing'] ?? null) ? $it['pricing'] : [];
        $qty = (int)($pricing['quantity'] ?? ($it['quantity'] ?? 1)); if ($qty < 1) { $qty = 1; }
        $opts = [];
        foreach (['options', 'selected_options', 'toppings', 'modifiers', 'variations'] as $ok) {
            foreach ((array)($it[$ok] ?? []) as $o) { $n = is_array($o) ? op_str(op_pick($o, ['name', 'title'], '')) : op_str($o); if ($n !== '') { $opts[] = $n; } }
        }
        $items[] = [
            'name' => op_str($it['name'] ?? '') ?: 'Ürün',
            'quantity' => $qty,
            'price' => op_money($pricing['unit_price'] ?? ($it['price'] ?? 0)),
            'note' => op_str($it['instructions'] ?? ''),
            'options' => $opts,
        ];
    }
    $pay = is_array($d['payment'] ?? null) ? $d['payment'] : [];
    $collect = op_money($pay['collect_at_pickup'] ?? 0);
    $ptype = strtoupper(op_str($pay['type'] ?? ''));
    $payment = ($collect > 0 || ($ptype !== '' && $ptype !== 'PAID')) ? 'Kapıda Ödeme' : 'Online (Ödendi)';
    $transport = strtoupper(op_str($d['transport_type'] ?? ''));

    return [
        'id' => $id,
        'code' => op_str($d['order_code'] ?? '') ?: $id,
        'customerName' => $name ?: 'Yemeksepeti Müşterisi',
        'phone' => op_is_masked($phone) ? '' : $phone,
        'address' => $parts ? implode(', ', array_unique($parts)) : 'Adres bilgisi Yemeksepeti tarafından paylaşılmıyor/maskeli',
        'note' => $note,
        'items' => $items,
        'total' => op_money($pay['order_total'] ?? 0),
        'payment' => $payment,
        'status' => op_str($d['status'] ?? 'RECEIVED'),
        'deliveryModel' => $transport === 'LOGISTICS_DELIVERY' ? 'PLATFORM_COURIER' : 'RESTAURANT_COURIER',
        'sourceApp' => 'YEMEKSEPETI',
        'chainId' => op_str(op_pick($d, ['client.chain_id'], '')),
        'vendorId' => op_str(op_pick($d, ['client.store_id'], '')),
    ];
}

function op_ys_poll(PDO $pdo, array $row): array {
    $res = ['fetched' => 0, 'new' => 0, 'error' => null, 'skipped' => null];
    $c = $row['creds'];
    if ($miss = op_ys_missing($c)) { $res['error'] = $miss; return $res; }
    $start = gmdate('Y-m-d\TH:i:s\Z', time() - 6 * 3600);
    $path = '/v2/chains/' . rawurlencode(op_str($c['chainId'])) . '/vendors/' . rawurlencode(op_str($c['vendorId'])) . '/orders';
    for ($page = 1; $page <= 5; $page++) {
        $r = op_ys_call($pdo, $row, 'GET', $path, null, ['start_time' => $start, 'page_size' => 100, 'page' => $page]);
        if (!$r['ok']) { $res['error'] = 'Yemeksepeti: ' . ($r['status'] === 0 ? $r['error'] : op_brief($r)); return $res; }
        $list = op_extract_list($r['json']);
        foreach ($list as $d) {
            if (!is_array($d)) continue;
            $n = op_norm_ys($d);
            if ($n['id'] === '') { continue; }
            $res['fetched']++;
            try {
                if (strtoupper($n['status']) === 'RECEIVED') {
                    $s = op_store_order($pdo, 'YEMEKSEPETI', $n, json_encode($d, JSON_UNESCAPED_UNICODE));
                    if ($s['created']) { $res['new']++; op_log($pdo, 'YEMEKSEPETI', 'POLL', 'ACCEPTED', 200, 'Yeni sipariş çekildi', [], json_encode($d, JSON_UNESCAPED_UNICODE), $n['id']); }
                } else {
                    op_sync_remote_status($pdo, 'YEMEKSEPETI', $n['id'], $n['status']);
                }
            } catch (Throwable $e) { $res['error'] = 'Kayıt hatası: ' . $e->getMessage(); }
        }
        if (count($list) < 100) break;
    }
    return $res;
}

/* ------------------------------------------------------------------ durum eşitleme (platform → yerel) */

function op_status_rank(string $local): int {
    return ['BEKLIYOR' => 0, 'HAZIRLANIYOR' => 1, 'YOLA_CIKTI' => 2, 'TESLIM_EDILDI' => 3, 'IPTAL' => 4][$local] ?? 0;
}

function op_map_remote_status(string $platform, string $status): ?string {
    $s = strtoupper(trim($status));
    if ($platform === 'TRENDYOL') {
        return ['CREATED' => 'BEKLIYOR', 'PICKING' => 'HAZIRLANIYOR', 'INVOICED' => 'HAZIRLANIYOR', 'SHIPPED' => 'YOLA_CIKTI', 'DELIVERED' => 'TESLIM_EDILDI', 'CANCELLED' => 'IPTAL', 'UNSUPPLIED' => 'IPTAL'][$s] ?? null;
    }
    return ['RECEIVED' => 'BEKLIYOR', 'READY_FOR_PICKUP' => 'YOLA_CIKTI', 'DISPATCHED' => 'YOLA_CIKTI', 'CANCELLED' => 'IPTAL', 'CANCELED' => 'IPTAL'][$s] ?? null;
}

/** Platformdaki durum yerelden "ileri" ise yerel durumu günceller (iptal her zaman). Dönüş: değişti mi. */
function op_sync_remote_status(PDO $pdo, string $platform, string $orderId, string $remoteStatus): bool {
    $mapped = op_map_remote_status($platform, $remoteStatus);
    if ($mapped === null) return false;
    $st = $pdo->prepare("SELECT `id`, `local_status` FROM `online_orders` WHERE `platform_code` = ? AND `platform_order_id` = ? LIMIT 1");
    $st->execute([$platform, $orderId]);
    $o = $st->fetch(PDO::FETCH_ASSOC);
    if (!$o) return false;
    $pdo->prepare("UPDATE `online_orders` SET `platform_status` = ? WHERE `id` = ?")->execute([mb_substr($remoteStatus, 0, 50), $o['id']]);
    if ($mapped === 'IPTAL' && $o['local_status'] !== 'IPTAL') {
        $pdo->prepare("UPDATE `online_orders` SET `local_status` = 'IPTAL', `cancel_reason` = COALESCE(`cancel_reason`, 'Platform tarafından iptal edildi') WHERE `id` = ?")->execute([$o['id']]);
        return true;
    }
    if ($mapped !== 'IPTAL' && op_status_rank($mapped) > op_status_rank((string)$o['local_status']) && $o['local_status'] !== 'IPTAL') {
        $pdo->prepare("UPDATE `online_orders` SET `local_status` = ? WHERE `id` = ?")->execute([$mapped, $o['id']]);
        return true;
    }
    return false;
}

function op_normalize(string $platform, array $d): array {
    return $platform === 'TRENDYOL' ? op_norm_trendyol($d) : op_norm_ys($d);
}

/* ------------------------------------------------------------------ sipariş kaydı */

/** Dönüş: ['created'=>bool, 'id'=>local id]. Aynı (platform, sipariş) ikinci kez gelirse yeni kayıt OLUŞMAZ. */
function op_store_order(PDO $pdo, string $platform, array $n, string $rawJson): array {
    $st = $pdo->prepare("INSERT INTO `online_orders`
        (`platform_code`,`platform_order_id`,`customer_name`,`customer_phone`,`delivery_address`,`order_note`,`items_json`,`total_amount`,`payment_method`,`platform_status`,`local_status`,`raw_json`,`delivery_model`,`source_app`,`display_code`,`created_at`)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'BEKLIYOR', ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE `raw_json` = VALUES(`raw_json`)");
    $st->execute([
        $platform, $n['id'], mb_substr($n['customerName'], 0, 100), mb_substr($n['phone'], 0, 30), $n['address'], $n['note'],
        json_encode($n['items'], JSON_UNESCAPED_UNICODE), $n['total'], mb_substr($n['payment'], 0, 50), mb_substr($n['status'] ?: 'NEW', 0, 50),
        $rawJson, $n['deliveryModel'] ?? 'RESTAURANT_COURIER', mb_substr((string)($n['sourceApp'] ?? $platform), 0, 20), mb_substr((string)($n['code'] ?? ''), 0, 40),
    ]);
    $created = $st->rowCount() === 1; // 1 = yeni kayıt, 2 = güncelleme, 0 = değişmedi
    $idRow = $pdo->prepare("SELECT `id` FROM `online_orders` WHERE `platform_code` = ? AND `platform_order_id` = ?");
    $idRow->execute([$platform, $n['id']]);
    // Yemeksepeti: webhook'tan öğrenilen Chain/Vendor kimlikleri ayara eklenir (kullanıcı elle girmediyse)
    if ($platform === 'YEMEKSEPETI' && ($n['chainId'] ?? '') !== '') {
        try {
            $row = op_platform($pdo, 'YEMEKSEPETI');
            $c = $row['creds']; $chg = false;
            if (op_str($c['chainId'] ?? '') === '') { $c['chainId'] = $n['chainId']; $chg = true; }
            if (op_str($c['vendorId'] ?? '') === '' && ($n['vendorId'] ?? '') !== '') { $c['vendorId'] = $n['vendorId']; $chg = true; }
            if ($chg) { $pdo->prepare("UPDATE `online_platforms` SET `credentials_json` = ? WHERE `platform_code` = 'YEMEKSEPETI'")->execute([json_encode($c, JSON_UNESCAPED_UNICODE)]); }
        } catch (Throwable $e) {}
    }
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

/** Trendyol iptal nedenleri (Package Models › Reasons for Cancellation Due to Restaurant). 624/626 yalnızca kendi kuryesiyle teslim edenler. */
const OP_TY_CANCEL_REASONS = [621 => 'Tedarik problemi', 622 => 'Mağaza kapalı', 623 => 'Mağaza siparişi hazırlayamıyor', 624 => 'Yüksek yoğunluk / kurye yok', 626 => 'Alan dışı', 627 => 'Sipariş karışıklığı'];

/**
 * Sipariş işlemini platforma ileter. Dönüş: ['status' => 'OK'|'FAILED'|'MANUAL', 'message' => ...].
 * OK = platform onayladı ya da platformda bu adım yoktur (açıklamada belirtilir); FAILED = platform reddetti/ulaşılamadı.
 */
function op_platform_action(PDO $pdo, array $order, string $action, array $extra = []): array {
    $platform = $order['platform_code'];
    $row = op_platform($pdo, $platform);
    $oid = (string)$order['platform_order_id'];
    $own = ($order['delivery_model'] ?? 'RESTAURANT_COURIER') !== 'PLATFORM_COURIER'; // kendi kuryesi mi
    $raw = json_decode($order['raw_json'] ?? 'null', true) ?: [];

    if ($platform === 'TRENDYOL') {
        $c = $row['creds'];
        if ($miss = op_ty_missing($c)) { return ['status' => 'FAILED', 'message' => $miss]; }
        $call = function (string $path, array $body) use ($row) {
            $r = op_ty_call($row, 'PUT', $path, $body);
            return $r['ok'] ? null : ('Trendyol: ' . ($r['status'] === 0 ? $r['error'] : op_brief($r)));
        };
        $nowMs = (int)(microtime(true) * 1000);
        switch ($action) {
            case 'accept':
                $prep = max(5, min(120, (int)($extra['preparationTime'] ?? 25)));
                $err = $call(op_ty_orders_path($c, '/picked'), ['packageId' => $oid, 'preparationTime' => $prep]);
                return $err ? ['status' => 'FAILED', 'message' => $err] : ['status' => 'OK', 'message' => "Trendyol'a iletildi: sipariş kabul edildi ({$prep} dk)."];
            case 'dispatch':
                $err = $call(op_ty_orders_path($c, '/invoiced'), ['packageId' => $oid, 'actualDate' => $nowMs]);
                if ($err) { return ['status' => 'FAILED', 'message' => $err]; }
                if ($own) {
                    $err = $call(op_ty_orders_path($c, '/' . rawurlencode($oid) . '/manual-shipped'), ['actualDate' => $nowMs]);
                    if ($err) { return ['status' => 'FAILED', 'message' => 'Hazırlandı bildirildi ama yola çıktı bildirilemedi — ' . $err]; }
                    return ['status' => 'OK', 'message' => "Trendyol'a iletildi: hazırlandı ve yola çıktı."];
                }
                return ['status' => 'OK', 'message' => "Trendyol'a iletildi: hazırlandı. Teslimatı Trendyol kuryesi yapar."];
            case 'deliver':
                if (!$own) { return ['status' => 'OK', 'message' => 'Teslimatı Trendyol kuryesi yapar; ayrıca bildirim gerekmez.']; }
                $err = $call(op_ty_orders_path($c, '/' . rawurlencode($oid) . '/manual-delivered'), ['actualDate' => $nowMs]);
                return $err ? ['status' => 'FAILED', 'message' => $err] : ['status' => 'OK', 'message' => "Trendyol'a iletildi: teslim edildi."];
            case 'reject':
                $reasonId = (int)($extra['reasonId'] ?? 623);
                if (!isset(OP_TY_CANCEL_REASONS[$reasonId]) || (!$own && in_array($reasonId, [624, 626], true))) { $reasonId = 623; }
                $ids = [];
                foreach ((array)($raw['lines'] ?? []) as $line) { foreach ((array)($line['items'] ?? []) as $it) { if (is_array($it) && empty($it['isCancelled']) && isset($it['packageItemId'])) { $ids[] = (string)$it['packageItemId']; } } }
                if (!$ids) { return ['status' => 'FAILED', 'message' => 'Trendyol: iptal edilecek paket kalemleri ham veride bulunamadı.']; }
                $err = $call(op_ty_orders_path($c, '/unsupplied'), ['packageId' => $oid, 'itemIdList' => $ids, 'reasonId' => $reasonId]);
                return $err ? ['status' => 'FAILED', 'message' => $err] : ['status' => 'OK', 'message' => "Trendyol'a iletildi: iptal (" . OP_TY_CANCEL_REASONS[$reasonId] . ').'];
        }
        return ['status' => 'MANUAL', 'message' => 'Bu işlem için Trendyol uç noktası yok.'];
    }

    // YEMEKSEPETİ (Partner API)
    $c = $row['creds'];
    if ($miss = op_ys_missing($c, false)) { return ['status' => 'FAILED', 'message' => $miss]; }
    $chain = op_str($c['chainId'] ?? '') ?: op_str(op_pick($raw, ['client.chain_id'], ''));
    $transport = strtoupper(op_str($raw['transport_type'] ?? ''));
    switch ($action) {
        case 'accept':
            return ['status' => 'OK', 'message' => "Yemeksepeti'nde ayrı bir 'kabul' adımı yoktur; sipariş hazır olduğunda bildirilir."];
        case 'deliver':
            return ['status' => 'OK', 'message' => "Yemeksepeti'nde 'teslim edildi' bildirimi yoktur; platform kendisi takip eder."];
        case 'dispatch':
        case 'reject':
            if ($chain === '') { return ['status' => 'FAILED', 'message' => 'Yemeksepeti: Chain ID bilinmiyor (ayarlara girin).']; }
            $body = ['order_id' => $oid, 'items' => []];
            if ($action === 'reject') {
                $body['status'] = 'CANCELLED';
                $body['cancellation'] = ['reason' => 'ITEM_UNAVAILABLE'];
            } else {
                $body['status'] = $transport === 'LOGISTICS_DELIVERY' ? 'READY_FOR_PICKUP' : 'DISPATCHED';
            }
            $r = op_ys_call($pdo, $row, 'PUT', '/v2/chains/' . rawurlencode($chain) . '/orders/' . rawurlencode($oid), $body);
            if (!$r['ok']) { return ['status' => 'FAILED', 'message' => 'Yemeksepeti: ' . ($r['status'] === 0 ? $r['error'] : op_brief($r))]; }
            return ['status' => 'OK', 'message' => "Yemeksepeti'ne iletildi: " . ($action === 'reject' ? 'iptal' : ($body['status'] === 'READY_FOR_PICKUP' ? 'kurye için hazır' : 'yola çıktı')) . '.'];
    }
    return ['status' => 'MANUAL', 'message' => 'Bu işlem için Yemeksepeti uç noktası yok.'];
}

/** Mağaza durumunu platforma iletir (OPEN | BUSY | CLOSED). */
function op_store_status_sync(PDO $pdo, string $platform, string $status): array {
    $row = op_platform($pdo, $platform);
    if (empty($row['is_enabled'])) { return ['platform' => $platform, 'sync' => 'MANUAL', 'message' => 'Platform pasif; yalnızca kasa kaydı güncellendi.']; }
    if ($platform === 'TRENDYOL') {
        if ($miss = op_ty_missing($row['creds'])) { return ['platform' => $platform, 'sync' => 'FAILED', 'message' => $miss]; }
        if ($status === 'BUSY') { return ['platform' => $platform, 'sync' => 'MANUAL', 'message' => "Trendyol'da 'yoğun' modu yok; kasa kaydı güncellendi (mağaza açık kaldı)."]; }
        $sid = op_ty_store_id($row);
        if (!$sid['ok']) { return ['platform' => $platform, 'sync' => 'FAILED', 'message' => $sid['message']]; }
        $r = op_ty_call($row, 'PUT', '/integrator/store/meal/suppliers/' . rawurlencode(op_str($row['creds']['supplierId'])) . '/stores/' . rawurlencode($sid['id']) . '/status', ['status' => $status === 'CLOSED' ? 'CLOSED' : 'OPEN']);
        return ['platform' => $platform, 'sync' => $r['ok'] ? 'OK' : 'FAILED', 'message' => $r['ok'] ? 'Trendyol mağaza durumu güncellendi.' : ('Trendyol: ' . ($r['status'] === 0 ? $r['error'] : op_brief($r)))];
    }
    $c = $row['creds'];
    if ($miss = op_ys_missing($c)) { return ['platform' => $platform, 'sync' => 'FAILED', 'message' => $miss]; }
    $body = $status === 'OPEN' ? ['status' => 'OPEN']
        : ($status === 'BUSY' ? ['status' => 'CLOSED_UNTIL', 'closed_reason' => 'TOO_BUSY_KITCHEN', 'closed_until' => gmdate('Y-m-d\TH:i:s\Z', time() + 20 * 60)]
        : ['status' => 'CLOSED_TODAY', 'closed_reason' => 'OTHER']);
    $r = op_ys_call($pdo, $row, 'PUT', '/v2/chains/' . rawurlencode(op_str($c['chainId'])) . '/vendors/' . rawurlencode(op_str($c['vendorId'])) . '/status', $body);
    return ['platform' => $platform, 'sync' => $r['ok'] ? 'OK' : 'FAILED', 'message' => $r['ok'] ? 'Yemeksepeti mağaza durumu güncellendi.' : ('Yemeksepeti: ' . ($r['status'] === 0 ? $r['error'] : op_brief($r)))];
}

/* ------------------------------------------------------------------ sipariş çekme (polling) */

function op_extract_list($json): array {
    if (!is_array($json)) return [];
    if (isset($json[0])) return $json;
    foreach (['orders', 'content', 'data', 'items', 'results', 'packages'] as $k) {
        if (isset($json[$k]) && is_array($json[$k])) {
            return isset($json[$k][0]) ? $json[$k] : (isset($json[$k]['orders']) ? (array)$json[$k]['orders'] : []);
        }
    }
    return [];
}

/**
 * Etkin platformlardan siparişleri çeker. Dönüş: platform => ['fetched','new','error'|null,'skipped'].
 * $force=false iken (kasa her 4 sn'de liste isterken) platform başına en çok 20 sn'de bir sorgu yapılır ve
 * aynı anda tek sorgu çalışır (kilit).
 */
function op_poll_all(PDO $pdo, bool $force = false): array {
    $out = [];
    $locked = false;
    try { $locked = (bool)$pdo->query("SELECT GET_LOCK('gtu_op_poll', 0)")->fetchColumn(); } catch (Throwable $e) { $locked = true; }
    if (!$locked) { return []; }
    try {
        foreach (OP_PLATFORMS as $code) {
            $row = op_platform($pdo, $code);
            if (empty($row['is_enabled'])) { continue; }
            $last = (int)op_setting_get($pdo, 'op_last_poll_' . $code, '0');
            if (!$force && time() - $last < 20) { continue; }
            op_setting_set($pdo, 'op_last_poll_' . $code, (string)time());
            $res = $code === 'TRENDYOL' ? op_ty_poll($pdo, $row) : op_ys_poll($pdo, $row);
            op_setting_set($pdo, 'op_poll_err_' . $code, (string)($res['error'] ?? ''));
            if ($res['error']) { op_log($pdo, $code, 'POLL', 'ERROR', 0, mb_substr($res['error'], 0, 240)); }
            $out[$code] = $res;
        }
    } finally {
        try { $pdo->query("SELECT RELEASE_LOCK('gtu_op_poll')"); } catch (Throwable $e) {}
    }
    return $out;
}
