<?php
/**
 * YALNIZCA TEST: Getir / Yemeksepeti / Trendyol benzeri davranış gösteren yerel sahte platform sunucusu.
 * php -S 127.0.0.1:8090 tests/helpers/mockPlatform.php  (ürün paketine GİRMEZ)
 * Durum ve çağrı kaydı geçici dosyadadır; /__calls ve /__reset ile okunur/sıfırlanır.
 */
$stateFile = sys_get_temp_dir() . '/gtu_mock_platform.json';
$state = is_file($stateFile) ? (json_decode(file_get_contents($stateFile), true) ?: []) : [];
$state += ['calls' => [], 'orders' => [], 'fail' => false];
$save = function () use (&$state, $stateFile) { file_put_contents($stateFile, json_encode($state)); };

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$raw = file_get_contents('php://input');
$json = json_decode($raw, true);
$h = [];
foreach ($_SERVER as $k => $v) { if (strpos($k, 'HTTP_') === 0) { $h[strtolower(str_replace('_', '-', substr($k, 5)))] = $v; } }
header('Content-Type: application/json');

if ($path === '/__reset') { $state = ['calls' => [], 'orders' => [], 'fail' => false]; $save(); echo '{}'; exit; }
if ($path === '/__calls') { echo json_encode($state['calls']); exit; }
if ($path === '/__config') { $state = array_merge($state, json_decode($raw, true) ?: []); $save(); echo '{}'; exit; }

$state['calls'][] = ['method' => $method, 'path' => $path, 'headers' => array_intersect_key($h, array_flip(['token', 'authorization', 'user-agent', 'content-type'])), 'body' => $json ?? $raw];
$save();

/* ---- Getir ---- */
if ($path === '/auth/login' && $method === 'POST') {
    if (($json['appSecretKey'] ?? '') === 'APP-OK' && ($json['restaurantSecretKey'] ?? '') === 'REST-OK') { echo json_encode(['token' => 'tok123']); exit; }
    http_response_code(401); echo json_encode(['message' => 'invalid credentials']); exit;
}
if (strpos($path, '/food-orders/') === 0) {
    if (($h['token'] ?? '') !== 'tok123') { http_response_code(401); echo json_encode(['message' => 'token required']); exit; }
    if ($state['fail']) { http_response_code(500); echo json_encode(['message' => 'mock failure']); exit; }
    if ($path === '/food-orders/active') { echo json_encode(['data' => $state['orders']]); exit; }
    if ($path === '/food-orders/periodic/unapproved') { echo json_encode(['data' => []]); exit; }
    echo json_encode(['ok' => true]); exit;
}

/* ---- Yemeksepeti OAuth ---- */
if ($path === '/ys/oauth/token' && $method === 'POST') {
    parse_str($raw, $f);
    if (($f['client_id'] ?? '') === 'YS-ID' && ($f['client_secret'] ?? '') === 'YS-SECRET' && ($f['grant_type'] ?? '') === 'client_credentials') { echo json_encode(['access_token' => 'ys-tok', 'token_type' => 'Bearer', 'expires_in' => 7200]); exit; }
    http_response_code(401); echo json_encode(['error' => 'invalid_client']); exit;
}
if (strpos($path, '/ys/orders/') === 0) {
    if (($h['authorization'] ?? '') !== 'Bearer ys-tok') { http_response_code(401); echo '{}'; exit; }
    echo json_encode(['ok' => true]); exit;
}

/* ---- Trendyol (Basic) ---- */
if (strpos($path, '/ty/') === 0) {
    $expected = 'Basic ' . base64_encode('TYKEY:TYSEC');
    if (($h['authorization'] ?? '') !== $expected) { http_response_code(401); echo json_encode(['message' => 'unauthorized']); exit; }
    if ($path === '/ty/orders') { echo json_encode(['content' => $state['orders']]); exit; }
    echo json_encode(['ok' => true]); exit;
}

http_response_code(404);
echo json_encode(['message' => 'not found', 'path' => $path]);
