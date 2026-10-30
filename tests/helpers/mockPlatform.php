<?php
/**
 * YALNIZCA TEST: Trendyol Go Yemek (Uber Eats Trendyol Go - Meal) ve Yemeksepeti Partner API benzeri yerel sahte sunucu.
 * Uçlar ve başlıklar resmi dokümanlardaki gibidir (bkz. docs/platform-api-notes.md).
 *   php -S 127.0.0.1:8090 tests/helpers/mockPlatform.php   (ürün paketine GİRMEZ)
 * Durum ve çağrı kaydı geçici dosyadadır; /__calls, /__reset, /__config, /__state ile okunur/sıfırlanır.
 */
$stateFile = sys_get_temp_dir() . '/gtu_mock_platform.json';
$state = is_file($stateFile) ? (json_decode(file_get_contents($stateFile), true) ?: []) : [];
$state += ['calls' => [], 'packages' => [], 'ysOrders' => [], 'fail' => false, 'tokens' => 0, 'storeStatus' => 'OPEN', 'ysStatus' => 'OPEN'];
$save = function () use (&$state, $stateFile) { file_put_contents($stateFile, json_encode($state)); };

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
parse_str((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY), $q);
$method = $_SERVER['REQUEST_METHOD'];
$raw = file_get_contents('php://input');
$json = json_decode($raw, true);
$h = [];
foreach ($_SERVER as $k => $v) { if (strpos($k, 'HTTP_') === 0) { $h[strtolower(str_replace('_', '-', substr($k, 5)))] = $v; } }
header('Content-Type: application/json');

if ($path === '/__reset') { $state = ['calls' => [], 'packages' => [], 'ysOrders' => [], 'fail' => false, 'tokens' => 0, 'storeStatus' => 'OPEN', 'ysStatus' => 'OPEN']; $save(); echo '{}'; exit; }
if ($path === '/__calls') { echo json_encode($state['calls']); exit; }
if ($path === '/__state') { echo json_encode($state); exit; }
if ($path === '/__config') { $state = array_merge($state, json_decode($raw, true) ?: []); $save(); echo '{}'; exit; }

$state['calls'][] = ['method' => $method, 'path' => $path, 'query' => $q, 'headers' => array_intersect_key($h, array_flip(['authorization', 'user-agent', 'content-type', 'x-agentname', 'x-executor-user'])), 'body' => $json ?? $raw];
$save();

/* ---------------- Trendyol Go Meal ---------------- */
if (strpos($path, '/integrator/') === 0) {
    $expected = 'Basic ' . base64_encode('TYKEY:TYSEC');
    if (($h['authorization'] ?? '') !== $expected) { http_response_code(401); echo json_encode(['message' => 'ClientApiAuthenticationException']); exit; }
    // Doğrulanmış zorunlu başlıklar: User-Agent "{supplierId} - ...", x-agentname, x-executor-user
    if (!preg_match('/^\d+ - \S+/', $h['user-agent'] ?? '') || empty($h['x-agentname']) || empty($h['x-executor-user'])) { http_response_code(403); echo json_encode(['message' => 'missing headers']); exit; }
    if ($state['fail']) { http_response_code(500); echo json_encode(['message' => 'mock failure']); exit; }

    if (preg_match('#^/integrator/store/meal/suppliers/(\d+)/stores$#', $path) && $method === 'GET') {
        echo json_encode(['restaurants' => [['id' => 153, 'name' => 'Taha Usta Şube', 'supplierId' => 100200, 'workingStatus' => $state['storeStatus']]]]); exit;
    }
    if (preg_match('#^/integrator/store/meal/suppliers/(\d+)/stores/(\d+)/status$#', $path) && $method === 'PUT') {
        $state['storeStatus'] = $json['status'] ?? '?'; $save(); echo '{}'; exit;
    }
    if (preg_match('#^/integrator/order/meal/suppliers/(\d+)/packages(/[^/]+)?(/[^/]+)?$#', $path, $m)) {
        $sub = ltrim(($m[2] ?? '') . ($m[3] ?? ''), '/');
        if ($method === 'GET' && $sub === '') {
            $want = array_filter(explode(',', $q['packageStatuses'] ?? ''));
            $list = array_values(array_filter($state['packages'], function ($p) use ($want, $q) {
                if ($want && !in_array($p['packageStatus'], $want, true)) return false;
                if (isset($q['packageModificationStartDate']) && ($p['packageModificationDate'] ?? 0) < (int)$q['packageModificationStartDate']) return false;
                return true;
            }));
            echo json_encode(['page' => (int)($q['page'] ?? 0), 'size' => 50, 'totalPages' => 1, 'totalCount' => count($list), 'content' => $list]); exit;
        }
        $setStatus = function ($id, $status) use (&$state, $save) {
            foreach ($state['packages'] as &$p) { if ($p['id'] === $id) { $p['packageStatus'] = $status; $p['packageModificationDate'] = (int)(microtime(true) * 1000); } }
            $save();
        };
        if ($method === 'PUT' && $sub === 'picked') { if (empty($json['packageId']) || !isset($json['preparationTime'])) { http_response_code(400); echo '{"message":"bad"}'; exit; } $setStatus($json['packageId'], 'Picking'); echo '{}'; exit; }
        if ($method === 'PUT' && $sub === 'invoiced') { if (empty($json['packageId'])) { http_response_code(400); echo '{"message":"bad"}'; exit; } $setStatus($json['packageId'], 'Invoiced'); echo '{}'; exit; }
        if ($method === 'PUT' && $sub === 'unsupplied') { if (empty($json['packageId']) || empty($json['itemIdList']) || empty($json['reasonId'])) { http_response_code(400); echo '{"message":"bad"}'; exit; } $setStatus($json['packageId'], 'UnSupplied'); echo '{}'; exit; }
        if ($method === 'PUT' && preg_match('#^([^/]+)/manual-shipped$#', $sub, $mm)) { $setStatus(rawurldecode($mm[1]), 'Shipped'); echo '{}'; exit; }
        if ($method === 'PUT' && preg_match('#^([^/]+)/manual-delivered$#', $sub, $mm)) { $setStatus(rawurldecode($mm[1]), 'Delivered'); echo '{}'; exit; }
    }
    http_response_code(404); echo json_encode(['message' => 'not found', 'path' => $path]); exit;
}

/* ---------------- Yemeksepeti Partner API ---------------- */
if ($path === '/v2/oauth/token' && $method === 'POST') {
    parse_str($raw, $f);
    if (($f['client_id'] ?? '') === 'YS-ID' && ($f['client_secret'] ?? '') === 'YS-SECRET' && ($f['grant_type'] ?? '') === 'client_credentials') {
        $state['tokens']++; $save();
        echo json_encode(['access_token' => 'ys-tok', 'token_type' => 'Bearer', 'expires_in' => 7200]); exit;
    }
    http_response_code(401); echo json_encode(['error' => 'invalid_client']); exit;
}
if (strpos($path, '/v2/chains/') === 0) {
    if (($h['authorization'] ?? '') !== 'Bearer ys-tok') { http_response_code(401); echo '{}'; exit; }
    if ($state['fail']) { http_response_code(500); echo json_encode(['message' => 'mock failure']); exit; }
    if (preg_match('#^/v2/chains/([^/]+)/vendors/([^/]+)/orders$#', $path) && $method === 'GET') { echo json_encode(['orders' => $state['ysOrders']]); exit; }
    if (preg_match('#^/v2/chains/([^/]+)/vendors/([^/]+)/status$#', $path)) {
        if ($method === 'GET') { echo json_encode(['vendor_id' => 'naez', 'status' => $state['ysStatus']]); exit; }
        if ($method === 'PUT') { $state['ysStatus'] = $json['status'] ?? '?'; $save(); echo '{}'; exit; }
    }
    if (preg_match('#^/v2/chains/([^/]+)/orders/([^/]+)$#', $path, $m) && $method === 'PUT') {
        if (empty($json['status'])) { http_response_code(400); echo '{"message":"bad"}'; exit; }
        foreach ($state['ysOrders'] as &$o) { if ($o['order_id'] === rawurldecode($m[2])) { $o['status'] = $json['status']; } }
        $save(); echo '{}'; exit;
    }
}

http_response_code(404);
echo json_encode(['message' => 'not found', 'path' => $path]);
